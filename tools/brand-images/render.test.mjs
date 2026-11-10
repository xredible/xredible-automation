import test from 'node:test';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validate,render,sizes} from './render.mjs';
const sample=path.join(path.dirname(fileURLToPath(import.meta.url)),'samples/indoor-winter-activities-for-kids/job.json');
const fixture=JSON.parse(await readFile(sample,'utf8'));
test('unreviewed photos, unsafe slugs and unverified printable promises are rejected',()=>{
 for(const modify of [j=>j.photos[0].review.approved=false,j=>delete j.photos[0].review.faceFree,j=>j.slug='../escape',j=>j.printableUrl='https://nestoodle.com/fake.pdf',j=>j.title='One two three four five six seven eight nine',j=>j.steps[0].photo=99]){const j=structuredClone(fixture);modify(j);assert.throws(()=>validate(j));}
});
async function withJob(job,fn,webp=false){const dir=await mkdtemp(path.join(os.tmpdir(),'brand-test-'));try{for(const p of job.photos)p.src=path.relative(dir,path.resolve(path.dirname(sample),p.src));/* remote/local path safety stays on: copy fixtures into job sandbox */for(let i=0;i<job.photos.length;i++){const bytes=await readFile(path.resolve(path.dirname(sample),fixture.photos[i].src));await writeFile(path.join(dir,`photo-${i}.png`),bytes);job.photos[i].src=`photo-${i}.png`;if(webp&&i===0){const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});try{const page=await browser.newPage();const converted=await page.evaluate(async src=>{const image=new Image();image.src=src;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').drawImage(image,0,0);return canvas.toDataURL('image/webp',.92);},'data:image/png;base64,'+bytes.toString('base64'));await writeFile(path.join(dir,'photo-0.webp'),Buffer.from(converted.split(',')[1],'base64'));job.photos[i].src='photo-0.webp';}finally{await browser.close();}}}const file=path.join(dir,'job.json');await writeFile(file,JSON.stringify(job));return await fn(file,path.join(dir,'out'));}finally{await rm(dir,{recursive:true,force:true});}}
test('WebP photo input renders exact JPEG dimensions; 8-word long title auto-shrinks',async()=>{
 const job=structuredClone(fixture);job.title='Easy Winter Activities For Cozy Days At Home';delete job.highlight;
 await withJob(job,async(file,out)=>{const reports=await render(file,out);assert.equal(reports.length,11);let shrunk=false;for(const report of reports){assert.deepEqual(report.size,sizes[report.template]);for(const t of report.text){assert.ok(t.lines<=3);assert.ok(t.fontSize>=Math.ceil(report.size[0]/30));if(t.field==='title'&&t.fontSize<60)shrunk=true;}
 // JPEG SOF0 stores the rendered height/width; catches viewport scaling errors.
 const bytes=await readFile(path.join(out,report.file));let found=false;for(let n=2;n<bytes.length-9;){assert.equal(bytes[n],255);const marker=bytes[n+1],length=bytes.readUInt16BE(n+2);if(marker===192){assert.equal(bytes.readUInt16BE(n+5),report.size[1]);assert.equal(bytes.readUInt16BE(n+7),report.size[0]);found=true;break;}n+=length+2;}assert.ok(found,'JPEG size marker');}assert.ok(shrunk);},true);
});
test('annotated face under cover title is rejected',async()=>{
 const job=structuredClone(fixture);job.photos[0].review={approved:true,reviewer:'synthetic bounding-box test',faces:[[.2,.62,.18,.12]]};
 await withJob(job,async(file,out)=>{await assert.rejects(render(file,out),/cover a face|cropped/);});
});
test('impossible one-line benefit fails instead of shrinking below minimum',async()=>{
 const job=structuredClone(fixture);job.benefit='A'.repeat(180);
 await withJob(job,async(file,out)=>{await assert.rejects(render(file,out),/cannot fit/);});
});
