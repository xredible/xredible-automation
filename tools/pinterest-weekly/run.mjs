import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from '../brand-images/node_modules/playwright/index.mjs';
import {render} from '../brand-images/render.mjs';
import {eligible,boardFor,variations,schedule,csv} from './plan.mjs';
const out=path.resolve(process.env.PINTEREST_OUTPUT||'pinterest-output');
const secret=process.env.N8N_REELS_SECRET;
if(!secret)throw new Error('Missing renderer authentication');
const api='https://n8n.xredible.in/webhook/';
async function request(route,body){
 const r=await fetch(api+route,{method:body?'POST':'GET',headers:{'X-Reel-Secret':secret,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(120000),redirect:'error'});
 if(!r.ok)throw new Error(`n8n ${route.split('?')[0]} HTTP ${r.status}`);
 return r.json();
}
await mkdir(out,{recursive:true});
const data=await request('nst-pinterest-inputs');
if(!Array.isArray(data.posts)||!Array.isArray(data.pins)||!Array.isArray(data.boards))throw new Error('Invalid inputs');
let ledger=[];try{ledger=JSON.parse(await readFile('media-input/nestoodle/pinterest/ledger.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const today=new Date(Date.now()+19800000).toISOString().slice(0,10);
const start=new Date(Date.parse(today+'T00:00:00Z')+86400000).toISOString().slice(0,10);
const batch=`weekly-${start}`;
if(ledger.some(r=>r.batch===batch))throw new Error('This planning week was already exported; reuse its CSV');
let posts=eligible(data.posts,data.pins,ledger);
if(process.env.PINTEREST_SCOPE==='this-week'){
 const d=new Date(today+'T00:00:00Z'),day=d.getUTCDay();d.setUTCDate(d.getUTCDate()-((day+6)%7));
 const monday=d.toISOString().slice(0,10);posts=posts.filter(p=>p.date.slice(0,10)>=monday);
}
const reserved=ledger.filter(r=>r.publishDate&&new Date(r.publishDate+'Z').getTime()>=Date.parse(start+'T00:00:00+05:30')&&new Date(r.publishDate+'Z').getTime()<Date.parse(start+'T00:00:00+05:30')+7*86400000).length;
const limit=Math.max(0,Math.min(18,Math.floor((56-reserved)/3)));
const deferred=posts.slice(limit).map(p=>p.id),skipped=[],groups=[];
for(const p of posts.slice(0,limit)){
 try{
  const board=boardFor(p,data.boards),vs=variations(p),pins=[],hashes=new Set();
  const candidates=[...String(p.html||p.content?.raw||'').matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
  for(const src of [...new Set(candidates)].slice(0,18)){
   if(pins.length===5)break;
   const u=new URL(src);
   if(u.hostname!=='nestoodle.com'||!u.pathname.startsWith('/wp-content/uploads/')||u.protocol!=='https:'||u.search||u.hash)continue;
   const res=await fetch(u,{redirect:'error',signal:AbortSignal.timeout(30000)});if(!res.ok)continue;
   const mime=res.headers.get('content-type')?.split(';')[0];if(!['image/jpeg','image/png','image/webp'].includes(mime))continue;
   if(Number(res.headers.get('content-length'))>8*1024*1024)continue;
   const buf=Buffer.from(await res.arrayBuffer());if(buf.length>8*1024*1024)continue;
   const hash=createHash('sha256').update(buf).digest('hex');if(hashes.has(hash))continue;
   const verdict=await request('nst-pinterest-photo-check',{image:buf.toString('base64'),mime,topic:p.title});
   let v;try{v=JSON.parse(verdict.content.map(c=>c.text||'').join(''));}catch{continue;}
   if(v.pass!==true||v.score<7||v.faceFree!==true||!Array.isArray(v.problems)||v.problems.length)continue;
   hashes.add(hash);
   const n=pins.length,folder=path.join(out,`post-${p.id}-${n+1}`);await mkdir(folder,{recursive:true});
   const ext={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'}[mime];
   await writeFile(path.join(folder,'photo'+ext),buf);
   const job={slug:p.slug,title:vs[n].title,benefit:vs[n].benefit,keyword:'READ',photos:[{src:'photo'+ext,alt:p.title,review:{approved:true,reviewer:'NST clean-photo checker',faceFree:true,score:v.score}}],steps:[]};
   // No printable claim unless an actual PDF is verified; weekly pins conservatively omit the badge.
   await writeFile(path.join(folder,'job.json'),JSON.stringify(job));
   await render(path.join(folder,'job.json'),folder,{pinOnly:true});
   const file=`${p.id}-${n+1}.jpg`;await copyFile(path.join(folder,'pin.jpg'),path.join(out,file));
   pins.push({...vs[n],file,localFile:path.join(out,file),photoHash:hash,review:v});
  }
  if(pins.length<3){skipped.push({id:p.id,reason:`Only ${pins.length} distinct photos passed strict review; need at least 3`});continue;}
  groups.push({id:p.id,link:p.link,board,pins,actual:p.actual,exported:p.exported});
 }catch(e){skipped.push({id:p.id,reason:String(e.message).slice(0,250)});}
}
const base=`https://raw.githubusercontent.com/xredible/xredible-automation/media/nestoodle/pinterest/${batch}`;
const rows=schedule(groups,start,base,Date.now(),ledger);
await writeFile(path.join(out,'pinterest.csv'),csv(rows));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{
 const page=await browser.newPage({viewport:{width:1200,height:900}});await page.route('**/*',r=>r.abort());
 const cards=[];
 for(const [i,r] of rows.entries()){
  const image=(await readFile(r.localFile)).toString('base64');
  cards.push(`<article><a href="${escape(r['Media URL'])}"><img src="data:image/jpeg;base64,${image}"></a><strong>${i+1}. ${escape(r.Title)}</strong><p>${escape(r['Pinterest board'])}</p><p>UTC: ${escape(r['Publish date'])}<br>IST: ${escape(new Date(r['Publish date']+'Z').toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}))}</p><a href="${escape(r.Link)}">Open article</a><p>${escape(r.Description)}</p></article>`);
 }
 await page.setContent(`<html><head><style>@page{size:A4;margin:12mm}body{font:11px Arial;color:#304f43}h1{font-size:23px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}article{break-inside:avoid}img{width:100%;height:220px;object-fit:contain}strong{display:block;font-size:12px}p{margin:6px 0}a{color:#af512d}</style></head><body><h1>Nestoodle · Pinterest weekly</h1><p>${escape(start)} · ${rows.length} pins · Manual upload only · CSV times are UTC · Review before importing</p><div class="grid">${cards.join('')}</div><p>Skipped: ${escape(JSON.stringify(skipped))}. Deferred: ${escape(deferred.join(', '))}.</p></body></html>`);
 await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
 await page.screenshot({path:path.join(out,'preview.jpg'),fullPage:true,type:'jpeg',quality:78});
}finally{await browser.close();}
const manifest={batch,start,count:rows.length,groups:groups.map(g=>({id:g.id,actual:g.actual,previouslyExported:g.exported})),skipped,deferred,files:['pinterest.csv','preview.jpg',...rows.map(r=>r['Media URL'].split('/').pop())],rows:rows.map(({localFile,...r})=>r)};
await writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
await writeFile(path.join(out,'ledger.json'),JSON.stringify([...ledger,...rows.map(r=>({batch,postId:r.postId,link:r.Link,media:r['Media URL'],photoHash:r.photoHash,publishDate:r['Publish date'],title:r.Title,status:'exported-not-confirmed-published'}))],null,2));
console.log(`Prepared ${rows.length} manual-upload pins; ${skipped.length} posts skipped, ${deferred.length} deferred`);
