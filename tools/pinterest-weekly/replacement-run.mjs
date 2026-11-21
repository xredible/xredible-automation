// Invoked after five samples are shown and the owner has requested the full replacement.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from '../brand-images/node_modules/playwright/index.mjs';
import {render,verifyPrintable} from '../brand-images/render.mjs';
import {promisesFreePrintable} from './coverage.mjs';
import {replacementPlan,replacementSeeds} from './replacement.mjs';
import {previewThumbnail,decodePreviewImages} from './images.mjs';
import {csv} from './plan.mjs';
const batch=process.env.PINTEREST_REPLACEMENT_BATCH;
if(!/^weekly-\d{4}-\d{2}-\d{2}-replacement-\d+$/.test(batch||''))throw new Error('Explicit sample-shown replacement batch required');
const out=path.resolve(process.env.PINTEREST_OUTPUT||'pinterest-output');await mkdir(out,{recursive:true});
const ledger=JSON.parse(await readFile('media-input/nestoodle/pinterest/ledger.json','utf8'));
const pending=ledger.filter(r=>r.batch===batch&&r.status==='pending-review');
if(!pending.length||ledger.some(r=>r.batch===batch&&r.status!=='pending-review'))throw new Error('Replacement is not pending review; do not rerun an exported batch');
const old=replacementSeeds(ledger,batch);
if(!old.length)throw new Error('Replacement source reservations missing');
const response=await fetch('https://n8n.xredible.in/webhook/nst-pinterest-inputs',{headers:{'X-Reel-Secret':process.env.N8N_REELS_SECRET},redirect:'error',signal:AbortSignal.timeout(120000)});
if(!response.ok)throw new Error('Cannot read protected current inputs');const inputs=await response.json();
const plan=replacementPlan(old,inputs,ledger,{batch,start:batch.slice(7,17)});
if(plan.rows.some(row=>!pending.some(p=>p.link===row.Link&&p.publishDate===row['Publish date']&&p.title===row.Title&&p.sourceMediaId===plan.ledger.find(n=>n.batch===batch&&n.link===row.Link).sourceMediaId&&p.editorialDigest===plan.ledger.find(n=>n.batch===batch&&n.link===row.Link).editorialDigest)))throw new Error('Sample-plan dates/links changed; show new samples before exporting');
for(const group of plan.groups){
 const post=inputs.posts.find(p=>p.id===group.id);
 if(promisesFreePrintable([group.title,...group.pins.map(p=>p.benefit)].join(' '))){let verified=false;for(const m of post.html.matchAll(/href=["'](https:\/\/nestoodle\.com\/[^"']+\.pdf(?:\?[^"']*)?)["']/gi)){try{await verifyPrintable({printableUrl:m[1].replace(/&amp;/g,'&')});verified=true;break;}catch{}}if(!verified)throw new Error(`Post ${group.id}: free printable promise needs a verified linked PDF`);}
 const hashes=new Set();
 for(const pin of group.pins){
  const result=await fetch(pin.photo.src,{redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!result.ok)throw new Error(`Post ${group.id}: approved photo HTTP${result.status}`);
  const mime=result.headers.get('content-type')?.split(';')[0],ext={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'}[mime];
  if(!ext||Number(result.headers.get('content-length'))>8*1024*1024)throw new Error('Invalid approved photo format/size');
  const bytes=Buffer.from(await result.arrayBuffer());if(bytes.length>8*1024*1024)throw new Error('Approved photo too large');
  const hash=createHash('sha256').update(bytes).digest('hex');if(hashes.has(hash))throw new Error('Duplicate source photo bytes');hashes.add(hash);
  const dir=path.join(out,`fresh-${pin.file}`);await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'photo'+ext),bytes);
  const job={slug:`post-${group.id}`,title:pin.title,benefit:pin.benefit,keyword:'READ',photos:[{src:'photo'+ext,alt:pin.photo.alt,review:pin.photo.review}],steps:[]};
  const file=path.join(dir,'job.json');await writeFile(file,JSON.stringify(job));await render(file,dir,{pinOnly:true,pinEditorial:true});
  const full=await readFile(path.join(dir,'pin.jpg'));await writeFile(path.join(out,pin.file),full);
  const row=plan.rows.find(r=>r.postId===group.id&&r['Media URL'].endsWith('/'+pin.file));row.localFile=path.join(out,pin.file);row.photoHash=hash;
 }
}
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
try{
 const cards=[];for(const row of plan.rows){const thumb=await previewThumbnail(browser,await readFile(row.localFile));cards.push(`<article><img src="data:image/jpeg;base64,${thumb}"><b>${escape(row.Title)}</b><p>${escape(row['Publish date'])} UTC</p><p>${escape(new Date(row['Publish date']+'Z').toLocaleString('en-US',{timeZone:'America/New_York'}))} Eastern</p></article>`);}
 const page=await browser.newPage({viewport:{width:1200,height:900}});await page.route('**/*',r=>r.abort());
 await page.setContent(`<html><style>body{font:14px Arial;background:#f8f4eb;color:#304f43}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}img{width:100%;height:360px;object-fit:contain}article{text-align:center}</style><h1>Nestoodle · Fresh replacement</h1><p>${plan.rows.length} pins · max3/day · articles3 days apart · UTC01:00/02:00/03:00 · Manual import only</p><div class="grid">${cards.join('')}</div></html>`);
 if((await decodePreviewImages(page)).length)throw new Error('Replacement preview failed decoding');
 await page.screenshot({path:path.join(out,'preview.jpg'),fullPage:true,type:'jpeg',quality:78});
}finally{await browser.close();}
const rows=plan.rows.map(({localFile,...r})=>r);
const manifest={batch,start:plan.start,end:plan.end,count:rows.length,rows,groups:plan.groups.map(g=>({id:g.id,title:g.title})),skipped:[],deferred:[],files:['pinterest.csv','preview.jpg','manifest.json','ledger.json',...plan.groups.flatMap(g=>g.pins.map(p=>p.file))]};
await writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));await writeFile(path.join(out,'pinterest.csv'),csv(rows));
const updated=plan.ledger.map(p=>p.batch===batch?{...p,photoHash:rows.find(r=>r.Link===p.link).photoHash,status:'exported-not-confirmed-published',note:'Five samples shown; full replacement prepared at owner request for manual import'}:p);
await writeFile(path.join(out,'ledger.json'),JSON.stringify(updated,null,2));console.log(`Prepared ${rows.length} fresh replacement pins, ${plan.start} to ${plan.end}; no Pinterest publishing`);
