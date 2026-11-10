import test from 'node:test';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validate,render,sizes,verifyPrintable} from './render.mjs';
const sample=path.join(path.dirname(fileURLToPath(import.meta.url)),'samples/indoor-winter-activities-for-kids/job.json');
const fixture=JSON.parse(await readFile(sample,'utf8'));
test('unreviewed photos, unsafe slugs and unverified printable promises are rejected',()=>{
 for(const modify of [j=>j.photos[0].review.approved=false,j=>delete j.photos[0].review.faceFree,j=>j.slug='../escape',j=>j.printableUrl='https://nestoodle.com/fake.pdf',j=>j.title='One two three four five six seven eight nine',j=>j.steps[0].photo=99]){const j=structuredClone(fixture);modify(j);assert.throws(()=>validate(j));}
});
async function withJob(job,fn,webp=false){const dir=await mkdtemp(path.join(os.tmpdir(),'brand-test-'));try{for(const p of job.photos)p.src=path.relative(dir,path.resolve(path.dirname(sample),p.src));/* remote/local path safety stays on: copy fixtures into job sandbox */for(let i=0;i<job.photos.length;i++){const bytes=await readFile(path.resolve(path.dirname(sample),fixture.photos[i].src));await writeFile(path.join(dir,`photo-${i}.png`),bytes);job.photos[i].src=`photo-${i}.png`;if(webp&&i===0){const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});try{const page=await browser.newPage();const converted=await page.evaluate(async src=>{const image=new Image();image.src=src;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').drawImage(image,0,0);return canvas.toDataURL('image/webp',.92);},'data:image/png;base64,'+bytes.toString('base64'));await writeFile(path.join(dir,'photo-0.webp'),Buffer.from(converted.split(',')[1],'base64'));job.photos[i].src='photo-0.webp';}finally{await browser.close();}}}const file=path.join(dir,'job.json');await writeFile(file,JSON.stringify(job));return await fn(file,path.join(dir,'out'));}finally{await rm(dir,{recursive:true,force:true});}}
test('WebP photo input renders exact JPEG dimensions; 8-word long title auto-shrinks',async()=>{
 const job=structuredClone(fixture);job.title='Easy Winter Activities For Cozy Days At Home';delete job.highlight;
 await withJob(job,async(file,out)=>{const reports=await render(file,out);assert.equal(reports.length,12);let shrunk=false;for(const report of reports){assert.deepEqual(report.size,sizes[report.template]);for(const t of report.text){assert.ok(t.lines<=3);assert.ok(t.fontSize>=Math.ceil(report.size[0]/30));if(t.field==='title'&&t.fontSize<60)shrunk=true;}
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

test('eyebrow repetition and cover/step photo reuse fail closed',()=>{
 for(const change of [j=>j.eyebrow='Easy play',j=>j.steps[0].photo=0,j=>j.steps[1].photo=j.steps[0].photo,j=>j.photos[2].src=j.photos[1].src]){const job=structuredClone(fixture);change(job);assert.throws(()=>validate(job));}
});
test('printable badges require a real PDF response; both badge layouts fit',async()=>{
 const job=structuredClone(fixture);job.printableUrl='https://nestoodle.com/wp-content/uploads/test.pdf';job.printableVerified=true;
 await assert.rejects(verifyPrintable(job,async()=>new Response('<html>missing</html>')),/did not return a PDF/);
 await assert.rejects(verifyPrintable(job,async()=>new Response('missing',{status:404})),/could not be verified/);
 await withJob(job,async(file,out)=>{const reports=await render(file,out,{fetchPrintable:async()=>new Response('%PDF-1.7 fixture')});assert.ok(reports.find(r=>r.file==='pin.jpg').printableBadge);assert.ok(reports.find(r=>r.file==='ig-cover.jpg').printableBadge);assert.deepEqual(reports.filter(r=>r.template==='ig-step').map(r=>r.photoSources[0]),[1,2]);for(const step of reports.filter(r=>r.template==='ig-step'))assert.equal(step.text.find(t=>t.field==='body').fontSize,58);assert.ok(reports.find(r=>r.file==='pin.jpg').text.find(t=>t.field==='title').fontSize>=100);});
});
test('pin-only mode uses one reviewed photo, fits long keyword-led titles, renders no social side effects',async()=>{
 const job=structuredClone(fixture);job.title='Thanksgiving Crafts for Kids with Toilet Paper Rolls: Creative Play Ideas';job.photos=job.photos.slice(0,1);job.steps=[];delete job.eyebrow;delete job.highlight;delete job.printableUrl;delete job.printableVerified;
 assert.throws(()=>validate(job));
 await withJob(job,async(file,out)=>{const reports=await render(file,out,{pinOnly:true});assert.equal(reports.length,1);assert.deepEqual(reports[0].size,[1000,1500]);assert.equal(reports[0].file,'pin.jpg');assert(reports[0].text.find(t=>t.field==='title').lines<=3);});
});
