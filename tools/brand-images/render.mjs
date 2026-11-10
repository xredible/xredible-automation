import { chromium } from 'playwright';
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
export const sizes = {pin:[1000,1500], 'ig-cover':[1080,1350], 'ig-step':[1080,1350], 'ig-cta':[1080,1350], og:[1200,630], story:[1080,1920], 'featured-collage':[1200,800], 'article-photo':[1200,800]};
const fail = message => { throw new Error(message); };
function shortText(value, field, max=200) { if(typeof value!=='string'||!value.trim()||value.length>max||/[\x00-\x1f<>]/.test(value)) fail(`Invalid ${field}`); }
export function validate(job) {
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(job.slug)||job.slug.length>100) fail('Invalid slug');
 for(const key of ['title','eyebrow','benefit','keyword']) shortText(job[key],key);
 if(job.title.trim().split(/\s+/).length>8) fail('Headline must have at most 8 words; supply an editorial short title');
 if(!/^[A-Z0-9]{2,24}$/.test(job.keyword)) fail('Invalid keyword');
 if(job.highlight && !job.title.includes(job.highlight)) fail('Highlight must occur in title');
 if(job.printableUrl && !/^https:\/\/nestoodle\.com\/.+\.pdf(?:\?.*)?$/.test(job.printableUrl)) fail('Printable must be a verified Nestoodle PDF');
 if(job.printableUrl && job.printableVerified!==true) fail('Verify printable exists and belongs to this post');
 if(!Array.isArray(job.photos)||job.photos.length<2||job.photos.length>12) fail('Need 2–12 reviewed clean photos');
 for(const photo of job.photos){
  shortText(photo.src,'photo src',2000);shortText(photo.alt,'photo alt',500);
  const r=photo.review;
  if(r?.approved!==true||!r.reviewer) fail('Photo needs visual quality review');
  if(r.faceFree!==true && (!Array.isArray(r.faces)||!r.faces.length)) fail('Review must declare faceFree or annotate every face');
  if(r.faceFree===true && r.faces?.length) fail('Conflicting face review');
  for(const box of r.faces??[]) if(!Array.isArray(box)||box.length!==4||box.some(n=>!Number.isFinite(n)||n<0||n>1)||box[2]<=0||box[3]<=0||box[0]+box[2]>1||box[1]+box[3]>1) fail('Invalid normalized face box');
 }
 if(!Array.isArray(job.steps)||!job.steps.length||job.steps.length>8) fail('Need 1–8 steps');
 for(const step of job.steps){shortText(step.title,'step title');shortText(step.body,'step body',300);if(step.title.split(/\s+/).length>8) fail('Step headline exceeds 8 words');if(!Number.isInteger(step.photo)||!job.photos[step.photo]) fail('Invalid step photo');}
 return job;
}
async function dataUri(file) { const ext=path.extname(file).toLowerCase(); const mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ttf':'font/ttf'}[ext];if(!mime) fail('Unsupported image/font type');return `data:${mime};base64,${(await readFile(file)).toString('base64')}`; }
async function photoData(photo, base) {
 if(/^https:\/\//.test(photo.src)) {
  let url=new URL(photo.src);
  if(url.username||url.password||url.port||url.search||url.hash) fail('Photo URL must be public, without credentials/query/hash');
  if(!((url.hostname==='nestoodle.com'&&url.pathname.startsWith('/wp-content/uploads/'))||(url.hostname==='raw.githubusercontent.com'&&url.pathname.startsWith('/xredible/xredible-automation/media/nestoodle/')))) fail('Photo host/path not allowed');
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!response.ok) fail(`Photo fetch failed (${response.status})`);
  const mime=response.headers.get('content-type')?.split(';')[0];if(!['image/jpeg','image/png'].includes(mime)) fail('Photo must be JPEG/PNG');
  const limit=12*1024*1024;if(Number(response.headers.get('content-length'))>limit) fail('Photo too large');
  const chunks=[];let length=0;for await(const chunk of response.body){length+=chunk.length;if(length>limit)fail('Photo too large');chunks.push(chunk);}
  return `data:${mime};base64,${Buffer.concat(chunks).toString('base64')}`;
 }
 const root=await realpath(base), target=await realpath(path.resolve(base,photo.src));
 if(!target.startsWith(root+path.sep)) fail('Photo must be inside job directory');return dataUri(target);
}
export async function render(jobPath,outDir) {
 const job=validate(JSON.parse(await readFile(jobPath,'utf8')));
 const photos=await Promise.all(job.photos.map(p=>photoData(p,path.dirname(jobPath))));
 const css=(await readFile(path.join(here,'templates/shared.css'),'utf8')).replace('{{BALOO}}',await dataUri(path.join(here,'../reels/assets/Baloo2-ExtraBold.ttf'))).replace('{{KARLA}}',await dataUri(path.join(here,'../reels/assets/Karla-Regular.ttf'))).replace('{{KARLABOLD}}',await dataUri(path.join(here,'../reels/assets/Karla-Bold.ttf')));
 const logo=await dataUri(path.join(here,'../reels/assets/nestoodle-logo.png'));
 await mkdir(outDir,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const reports=[];
 try {
 const slides=[['pin','pin'],['ig-cover','ig-cover'],...job.steps.map((s,i)=>['ig-step',`ig-step-${String(i+1).padStart(2,'0')}`,i]),['ig-cta','ig-cta'],['ig-cover','facebook'],['og','og'],['story','story'],['featured-collage','featured-collage'],...job.photos.map((_,i)=>['article-photo',`article-photo-${String(i+1).padStart(2,'0')}`,i])];
 for(const [template,name,index] of slides){
  const [width,height]=sizes[template],page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  await page.route('**/*',route=>route.abort()); // All assets embedded; no external page requests.
  await page.setContent((await readFile(path.join(here,'templates',`${template}.html`),'utf8')).replace('{{CSS}}',css));
  const step=template==='ig-step'?job.steps[index]:undefined;
  await page.evaluate(async ({job,photos,logo,step,index,template,name})=>{
   const fields={...job,title:step?.title??job.title,body:step?.body,number:String((index??0)+1).padStart(2,'0'),navigation:name==='facebook'?'Read the guide at nestoodle.com':'Swipe →',cta:job.printableUrl?'for the full guide + free printable':'for the full guide'};
   document.querySelectorAll('[data-field]').forEach(el=>{
    const key=el.dataset.field;el.textContent=fields[key]??'';
    if(key==='title'&&job.highlight&&!step&&fields.title.includes(job.highlight)){
     const at=fields.title.indexOf(job.highlight);el.replaceChildren(document.createTextNode(fields.title.slice(0,at)));const em=document.createElement('em');em.textContent=job.highlight;el.append(em,document.createTextNode(fields.title.slice(at+job.highlight.length)));
    }
   });
   document.querySelectorAll('[data-photo]').forEach(img=>{const photoIndex=step?step.photo:template==='article-photo'?index:Number(img.dataset.photo);img.dataset.source=photoIndex;img.src=photos[photoIndex];img.alt=job.photos[photoIndex].alt;});
   document.querySelectorAll('[data-logo]').forEach(img=>{img.src=logo;});
   const dots=document.querySelector('[data-dots]');if(dots) for(let n=0;n<job.steps.length;n++){const dot=document.createElement('i');if(n===index)dot.className='active';dots.append(dot);}
   await document.fonts.ready;
   await Promise.all([...document.images].map(img=>img.decode()));
  },{job,photos,logo,step,index,template,name});
  const report=await page.evaluate(({job,width,height,template})=>{
   const result={text:[],faces:[],size:[width,height]};
   for(const el of document.querySelectorAll('[data-fit]')) {
    const min=Math.ceil(36*width/1080),max=Number(el.dataset.max)||parseFloat(getComputedStyle(el).fontSize),maxLines=Number(el.dataset.lines)||3;
    let found=false;
    for(let size=max;size>=min;size--){
     el.style.fontSize=`${size}px`;
     const style=getComputedStyle(el),lineHeight=parseFloat(style.lineHeight),rect=el.getBoundingClientRect();
     if(el.scrollWidth<=el.clientWidth+1&&el.scrollHeight<=el.clientHeight+1&&rect.height-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)<=lineHeight*maxLines+2){found=true;result.text.push({field:el.dataset.field??el.className,fontSize:size,lines:Math.round((rect.height-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom))/lineHeight)});break;}
    }
    if(!found)throw new Error(`Text cannot fit: ${template}/${el.dataset.field??el.className} ${el.clientWidth}x${el.clientHeight} scroll ${el.scrollWidth}x${el.scrollHeight} style ${getComputedStyle(el).lineHeight}`);
   }
   const overlays=[...document.querySelectorAll('[data-overlay]')];
   for(let i=0;i<overlays.length;i++)for(let j=i+1;j<overlays.length;j++){const a=overlays[i],b=overlays[j];if(a.contains(b)||b.contains(a))continue;const r=a.getBoundingClientRect(),s=b.getBoundingClientRect();if(r.left<s.right-1&&r.right>s.left+1&&r.top<s.bottom-1&&r.bottom>s.top+1)throw new Error('Text/logo panels overlap');}
   if(template==='ig-step'&&document.querySelector('.copy').getBoundingClientRect().bottom>document.querySelector('.photo-card').getBoundingClientRect().top-20)throw new Error('Step text overlaps photo');
   const rects=overlays.map(el=>{const r=el.getBoundingClientRect();if(r.x<0||r.y<0||r.right>width+1||r.bottom>height+1) throw new Error('Overlay outside canvas');if(template==='story'&&(r.y<240||r.bottom>1680)) throw new Error('Story safe area exceeded');return {x:r.x,y:r.y,w:r.width,h:r.height};});
   for(const img of document.querySelectorAll('[data-photo]')){
    const review=job.photos[Number(img.dataset.source)].review;if(review.faceFree)continue;
    const r=img.getBoundingClientRect(),scale=Math.max(r.width/img.naturalWidth,r.height/img.naturalHeight),dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;
    for(const [x,y,w,h] of review.faces){
     const face={x:r.x+(r.width-dw)/2+x*dw,y:r.y+(r.height-dh)/2+y*dh,w:w*dw,h:h*dh};
     // 45px inset conservatively protects rounded photo corners and adds overlay clearance.
     if(face.x<r.x+45||face.y<r.y+45||face.x+face.w>r.right-45||face.y+face.h>r.bottom-45)throw new Error('Face would be cropped');
     for(const text of rects)if(face.x<text.x+text.w+24&&face.x+face.w>text.x-24&&face.y<text.y+text.h+24&&face.y+face.h>text.y-24)throw new Error('Overlay would cover a face');
     result.faces.push(face);
    }
   }
   // Catch accidental text panel collisions, not just the headline itself.
   for(const el of document.querySelectorAll('h1,.body,.benefit,.pill,.brand,.swipe,.action')){
    if(el.scrollHeight>el.clientHeight+2||el.scrollWidth>el.clientWidth+2)throw new Error(`Overflow: ${el.className}`);
   }
   return result;
  },{job,width,height,template});
  reports.push({file:`${name}.jpg`,template,...report});
  await page.screenshot({path:path.join(outDir,`${name}.jpg`),type:'jpeg',quality:94});await page.close();
 }
 await writeFile(path.join(outDir,'render-info.json'),JSON.stringify({slug:job.slug,articleUrl:job.articleUrl,renderer:1,approval:'template approved 2026-11-10; new article/social content remains subject to owner review',photos:job.photos.map(({alt,review})=>({alt,review})),outputs:reports},null,2)+'\n');
 } finally {await browser.close();}
 return reports;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const [job,out]=process.argv.slice(2);if(!job||!out)fail('Usage: node render.mjs job.json output-directory');const result=await render(path.resolve(job),path.resolve(out));console.log(`Validated and rendered ${result.length} images`);}
