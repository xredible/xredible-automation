import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '../brand-images/node_modules/playwright/index.mjs';
import {decodePreviewImages,excludeUndecodable,previewThumbnail} from './images.mjs';
import {schedule,csv} from './plan.mjs';

test('corrupt JPEG is identified; other article pins still decode and export',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 try{
  const page=await browser.newPage();await page.route('**/*',r=>r.abort());
  await page.setContent('<p>valid pin</p>');
  const jpeg=(await page.screenshot({type:'jpeg'})).toString('base64');
  await page.setContent(`<img data-file="11-1.jpg" src="data:image/jpeg;base64,/9gAAA=="><img data-file="12-1.jpg" src="data:image/jpeg;base64,${jpeg}">`);
  // The old all-or-nothing preview crashes on this exact mixed batch.
  await assert.rejects(page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode()))),/EncodingError/);
  const failures=await decodePreviewImages(page);
  assert.deepEqual(failures,[{file:'11-1.jpg',reason:'Preview image cannot be decoded'}]);
  const pin=(id,n)=>({file:`${id}-${n}.jpg`,sourceImage:`https://nestoodle.com/wp-content/uploads/${id}-${n}.webp`,title:'Title',description:'Description',keywords:'kids',photoHash:`${id}-${n}`,localFile:`/tmp/${id}-${n}.jpg`});
  const group=(id,n)=>({id,link:`https://nestoodle.com/post-${id}/`,board:'Kids Activities',pins:Array.from({length:n},(_,i)=>pin(id,i+1))});
  const images=[],skipped=[];
  const groups=excludeUndecodable([group(11,4),group(12,3)],failures,images,skipped);
  assert.deepEqual(groups.map(g=>g.pins.length),[3,3]);
  assert.equal(images[0].id,11);assert.match(images[0].image,/11-1.webp$/);assert.equal(skipped.length,0);
  const rows=schedule(groups,'2030-01-01','https://example.com',0);
  assert.equal(rows.length,6);assert.ok(!csv(rows).includes('/11-1.jpg'));
  assert.ok(rows.every(r=>r.photoHash!=='11-1')); // Same rows feed the reservation ledger.
  const dropped=[];
  const surviving=excludeUndecodable([group(11,3),group(12,3)],failures,[],dropped);
  assert.deepEqual(surviving.map(g=>g.id),[12]);assert.equal(dropped[0].id,11);
 }finally{await browser.close();}
});

test('unidentified failures fail visibly rather than silently loop',()=>{
 assert.throws(()=>excludeUndecodable([], [{file:'missing.jpg'}],[],[]),/does not match/);
});


test('large pin contact sheet uses bounded thumbnails and still rejects corrupt files',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 try{
  const source=await browser.newPage({viewport:{width:1000,height:1500}});
  await source.setContent('<canvas width="1000" height="1500"></canvas>');
  await source.evaluate(()=>{const c=document.querySelector('canvas'),ctx=c.getContext('2d');for(let y=0;y<1500;y+=5)for(let x=0;x<1000;x+=5){ctx.fillStyle=`rgb(${x%255},${y%255},${(x+y)%255})`;ctx.fillRect(x,y,5,5);}});
  const bytes=await source.screenshot({type:'jpeg',quality:94});await source.close();
  await assert.rejects(previewThumbnail(browser,Buffer.from([255,216,0,0])),/EncodingError/);
  const thumbnails=[];
  for(let i=0;i<56;i++)thumbnails.push(await previewThumbnail(browser,bytes));
  const page=await browser.newPage();await page.route('**/*',r=>r.abort());
  await page.setContent(thumbnails.map((image,i)=>`<img data-file="${i}.jpg" src="data:image/jpeg;base64,${image}">`).join(''));
  assert.deepEqual(await decodePreviewImages(page),[]);
  assert.ok(thumbnails.every(t=>Buffer.from(t,'base64').length<bytes.length));
  assert.equal(await page.evaluate(()=>document.images[0].naturalWidth),300);
  assert.equal(await page.evaluate(()=>document.images[0].naturalHeight),450);
 }finally{await browser.close();}
});
