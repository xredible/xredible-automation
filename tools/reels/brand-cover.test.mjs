import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {brandCover} from './brand-cover.mjs';
test('unreviewed or imperfect cover photos fail before asset access',async()=>{
 for(const review of [{},{approved:true,score:9,faceFree:true,problems:[],reviewer:'fixture'},{approved:true,score:10,faceFree:false,problems:[],reviewer:'fixture'},{approved:true,score:10,faceFree:true,problems:['logo'],reviewer:'fixture'}])await assert.rejects(brandCover({brandCover:{review}},'/not-used'),/pending/);
});
test('checked source creates a canonical story JPEG and records its review',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'nst-cover-test-'));try{
 const fixture=JSON.parse(await fs.readFile(new URL('../brand-images/samples/indoor-winter-activities-for-kids/job.json',import.meta.url)));const photo=new URL('../brand-images/samples/indoor-winter-activities-for-kids/'+fixture.photos[0].src,import.meta.url);await fs.copyFile(photo,path.join(dir,'photo.png'));
 const spec={jobId:'nst-1-1234567890123',link:'https://nestoodle.com/fixture/',title:'Indoor play fixture',keyword:'GUIDE',brandCover:{title:'Simple Indoor Play Ideas',review:{approved:true,score:10,faceFree:true,problems:[],reviewer:'Offline fixture'}},scenes:[{kind:'hook',image:'photo.png'}]};
 const report=await brandCover(spec,dir);assert.equal(report.coverTemplate,'nestoodle-story');assert.equal(report.coverReviewScore,10);assert.equal((await fs.readFile(path.join(dir,'cover.jpg'))).subarray(0,3).toString('hex'),'ffd8ff');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
