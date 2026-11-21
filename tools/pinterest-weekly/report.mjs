import {readFile} from 'node:fs/promises';
import {priorReport} from './coverage.mjs';
const manifest=JSON.parse(await readFile(process.argv[2],'utf8'));
const response=await fetch('https://n8n.xredible.in/webhook/nst-pinterest-inputs',{headers:{'X-Reel-Secret':process.env.N8N_REELS_SECRET},redirect:'error',signal:AbortSignal.timeout(120000)});
if(!response.ok)throw new Error('Cannot read current published article titles');
const {posts,approvedPhotos=[]}=await response.json();
console.log('PRIOR_REPORT '+JSON.stringify(priorReport(manifest,posts)));
console.log('APPROVED_COUNTS '+JSON.stringify(Object.fromEntries(posts.map(p=>[p.id,approvedPhotos.filter(r=>r.postId===p.id).length]))));

if(manifest.skippedImages?.length){
 const {chromium}=await import('../brand-images/node_modules/playwright/index.mjs');
 const {previewThumbnail}=await import('./images.mjs');
 const path=await import('node:path');
 const browser=await chromium.launch({headless:true});
 try{for(const file of new Set(manifest.skippedImages.map(r=>r.file).filter(Boolean))){
  try{const bytes=await readFile(path.join(path.dirname(process.argv[2]),file));await previewThumbnail(browser,bytes);console.log('INDEPENDENT_DECODE '+JSON.stringify({file,bytes:bytes.length,ok:true}));}
  catch(e){console.log('INDEPENDENT_DECODE '+JSON.stringify({file,ok:false,reason:String(e.message).slice(0,150)}));}
 }}finally{await browser.close();}
}
