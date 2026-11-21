import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from '../brand-images/node_modules/playwright/index.mjs';
import {render} from '../brand-images/render.mjs';
import {eligible,boardFor,pinCopy,schedule,csv,activeReservation} from './plan.mjs';
import {decodePreviewImages,excludeUndecodable,previewThumbnail} from './images.mjs';
import {editorialPhotos,benefitLine} from './editorial.mjs';
import {importIssues} from './import-check.mjs';
import {verifyPostPrintable} from './printable.mjs';
import {approvedFor,exportBatch,fillCoverage,promisesFreePrintable} from './coverage.mjs';
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
const batch=exportBatch(start,ledger,process.env.PINTEREST_SUPPLEMENT==='true',process.env.GITHUB_RUN_ID);
let posts=eligible(data.posts,data.pins,ledger);
if(process.env.PINTEREST_SCOPE==='this-week'){
 const d=new Date(today+'T00:00:00Z'),day=d.getUTCDay();d.setUTCDate(d.getUTCDate()-((day+6)%7));
 const monday=d.toISOString().slice(0,10);posts=posts.filter(p=>p.date.slice(0,10)>=monday);
}
const limit=7; //21 new pins per weekly run; global slots are reserved by the scheduler.
const skippedImages=[];
const {groups,skipped,deferred}=await fillCoverage(posts,limit,async p=>{
  const board=boardFor(p,data.boards);let printableUrl;
  const advertised=[p.keyword,p.meta?._yoast_wpseo_focuskw,p.title?.raw||p.title?.rendered||p.title,benefitLine(p)].filter(Boolean).join(' ');
  if(promisesFreePrintable(advertised)){const offer=await verifyPostPrintable(p);if(offer.kind==='direct-pdf')printableUrl=offer.url;}
  const pins=[],hashes=new Set(ledger.filter(r=>activeReservation(r)&&r.postId===p.id).map(r=>r.photoHash));
  const approved=editorialPhotos(p,approvedFor(p,data.approvedPhotos||[]));
  if(approved.length<3)throw new Error(`Only ${approved.length} current approved table photos; need at least 3`);
  for(const src of approved.map(p=>p.src).slice(0,18)){
   try{
   if(pins.length===3)break;
   const u=new URL(src);
   if(u.hostname!=='nestoodle.com'||!u.pathname.startsWith('/wp-content/uploads/')||u.protocol!=='https:'||u.search||u.hash)continue;
   const res=await fetch(u,{redirect:'error',signal:AbortSignal.timeout(30000)});if(!res.ok)continue;
   const mime=res.headers.get('content-type')?.split(';')[0];if(!['image/jpeg','image/png','image/webp'].includes(mime))continue;
   if(Number(res.headers.get('content-length'))>8*1024*1024)continue;
   const buf=Buffer.from(await res.arrayBuffer());if(buf.length>8*1024*1024)continue;
   const hash=createHash('sha256').update(buf).digest('hex');if(hashes.has(hash))continue;
   const trusted=approved.find(p=>p.src===src),v=trusted.review;
   if(v.pass!==true||v.score!==10||v.faceFree!==true||!Array.isArray(v.problems)||v.problems.length)continue;
   hashes.add(hash);
   const copy=pinCopy(p,trusted);
   const n=pins.length,folder=path.join(out,`post-${p.id}-${n+1}`);await mkdir(folder,{recursive:true});
   const ext={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'}[mime];
   await writeFile(path.join(folder,'photo'+ext),buf);
   const job={slug:p.slug,title:copy.title,benefit:copy.benefit,keyword:'READ',photos:[{src:'photo'+ext,alt:trusted?.alt||p.title,review:{approved:true,reviewer:v.reviewer||'NST clean-photo checker',faceFree:true,score:v.score}}],steps:[]};
   if(printableUrl){job.printableUrl=printableUrl;job.printableVerified=true;} // Badge requires this article's linked PDF and a verified PDF signature.
   await writeFile(path.join(folder,'job.json'),JSON.stringify(job));
   try{await render(path.join(folder,'job.json'),folder,{pinOnly:true,pinEditorial:true});}
   catch(e){if(!/EncodingError|cannot be decoded/.test(String(e.message)))throw e;
    const failure={id:p.id,image:src,reason:'Source image cannot be decoded'};skippedImages.push(failure);console.warn(JSON.stringify(failure));continue;}
   const file=`${p.id}-${n+1}.jpg`;await copyFile(path.join(folder,'pin.jpg'),path.join(out,file));
   pins.push({...copy,mediaId:trusted.mediaId,file,localFile:path.join(out,file),photoHash:hash,sourceImage:src,review:v});
   }catch(e){skippedImages.push({id:p.id,image:src,reason:String(e.message).slice(0,250)});}
  }
  if(pins.length<3)throw new Error(`Only ${pins.length} distinct usable photos; need at least 3`);
  return {id:p.id,title:p.title,link:p.link,board,pins,actual:p.actual,exported:p.exported};
});
const base=`https://raw.githubusercontent.com/xredible/xredible-automation/media/nestoodle/pinterest/${batch}`;
let safeGroups=groups,rows;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{
 const thumbnails=new Map();
 const page=await browser.newPage({viewport:{width:1200,height:900}});await page.route('**/*',r=>r.abort());
 for(;;){
 rows=schedule(safeGroups,start,base,Date.now(),ledger,{blockedLinks:[...ledger.map(r=>r.link),...data.pins.map(p=>p.link)].filter(Boolean)});
 const cards=[],thumbnailFailures=[];
 for(const [i,r] of rows.entries()){
  const file=path.basename(r.localFile);let image=thumbnails.get(file);
  if(!image){try{image=await previewThumbnail(browser,await readFile(r.localFile));thumbnails.set(file,image);}
   catch(e){if(!/EncodingError|cannot be decoded/.test(String(e.message)))throw e;thumbnailFailures.push({file,reason:'Pin image cannot be decoded independently'});continue;}}
  cards.push(`<article><a href="${escape(r['Media URL'])}"><img data-file="${escape(path.basename(r.localFile))}" src="data:image/jpeg;base64,${image}"></a><strong>${i+1}. ${escape(r.Title)}</strong><p>${escape(r['Pinterest board'])}</p><p>UTC: ${escape(r['Publish date'])}<br>US Eastern: ${escape(new Date(r['Publish date']+'Z').toLocaleString('en-US',{timeZone:'America/New_York'}))}</p><a href="${escape(r.Link)}">Open article</a><p>${escape(r.Description)}</p></article>`);
 }
 if(thumbnailFailures.length){safeGroups=excludeUndecodable(safeGroups,thumbnailFailures,skippedImages,skipped);continue;}
 await page.setContent(`<html><head><style>@page{size:A4;margin:12mm}body{font:11px Arial;color:#304f43}h1{font-size:23px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}article{break-inside:avoid}img{width:100%;height:220px;object-fit:contain}strong{display:block;font-size:12px}p{margin:6px 0}a{color:#af512d}</style></head><body><h1>Nestoodle · Pinterest weekly</h1><p>${escape(start)} · ${rows.length} pins · Manual upload only · CSV times are UTC · Review before importing</p><div class="grid">${cards.join('')}</div><p>Skipped: ${escape(JSON.stringify([...skipped,...skippedImages]))}. Deferred: ${escape(deferred.join(', '))}.</p></body></html>`);
 const failures=await decodePreviewImages(page);
 if(!failures.length)break;
 safeGroups=excludeUndecodable(safeGroups,failures,skippedImages,skipped);
 for(const failure of failures)console.warn('Undecodable preview image: '+JSON.stringify(failure));
 }
 const issues=importIssues(rows,data.boards);if(issues.length)throw new Error(JSON.stringify(issues));
 await writeFile(path.join(out,'pinterest.csv'),csv(rows));
 await page.screenshot({path:path.join(out,'preview.jpg'),fullPage:true,type:'jpeg',quality:78});
}finally{await browser.close();}
const manifest={batch,start,count:rows.length,end:rows.at(-1)?.['Publish date'].slice(0,10)||start,groups:safeGroups.map(g=>({id:g.id,title:g.title,actual:g.actual,previouslyExported:g.exported})),skipped,skippedImages,deferred,files:['pinterest.csv','preview.jpg',...rows.map(r=>r['Media URL'].split('/').pop())],rows:rows.map(({localFile,...r})=>r)};
await writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
await writeFile(path.join(out,'ledger.json'),JSON.stringify([...ledger,...rows.map(r=>({batch,postId:r.postId,link:r.Link,media:r['Media URL'],photoHash:r.photoHash,publishDate:r['Publish date'],title:r.Title,status:'exported-not-confirmed-published'}))],null,2));
console.log('COVERAGE_REPORT '+JSON.stringify({groups:manifest.groups,skipped,deferred:deferred.map(id=>({id,title:posts.find(p=>p.id===id)?.title,reason:'Weekly generation quota reached; future UTC reservations retained'})),skippedImages}));
console.log(`Prepared ${rows.length} manual-upload pins; ${skipped.length} posts skipped, ${deferred.length} deferred`);
