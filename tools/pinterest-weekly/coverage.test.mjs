import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedFor,exportBatch,fillCoverage,priorReport,promisesFreePrintable} from './coverage.mjs';
const photo={postId:42,mediaId:9,src:'https://nestoodle.com/wp-content/uploads/craft.webp',alt:'Paper craft',approved:true,score:10,faceFree:true,problems:'[]',reviewer:'Native review'};
const post={id:42,title:'Craft',html:'<img class="wp-image-9" src="https://nestoodle.com/wp-content/uploads/craft-1200x800.webp">'};
test('reuse only strict table approvals matching current article media ID and URL',()=>{
 assert.equal(approvedFor(post,[photo,photo]).length,1);
 for(const bad of [{score:9},{faceFree:false},{problems:'["text"]'},{problems:'bad'},{reviewer:''},{postId:43},{mediaId:99},{src:'https://nestoodle.com/wp-content/uploads/replaced.webp'},{src:'https://evil.test/x.webp'}])assert.equal(approvedFor(post,[{...photo,...bad}]).length,0);
 assert.equal(approvedFor({...post,html:''},[photo]).length,0);
});
test('failed first 18 articles do not defer a later usable article',async()=>{
 const posts=Array.from({length:21},(_,id)=>({id,title:`Post ${id}`}));
 const result=await fillCoverage(posts,2,async p=>{if(p.id<18)throw Error('No approved photos');return {id:p.id};});
 assert.deepEqual(result.groups.map(g=>g.id),[18,19]);assert.equal(result.skipped.length,18);assert.deepEqual(result.deferred,[20]);
 assert.equal(result.skipped[0].reason,'No approved photos');
});
test('supplement has a separate asset namespace and preserves default duplicate-week guard',()=>{
 const ledger=[{batch:'weekly-2030-01-01'}];
 assert.throws(()=>exportBatch('2030-01-01',ledger,false,'123'),/already exported/);
 assert.equal(exportBatch('2030-01-01',ledger,true,'123'),'weekly-2030-01-01-supplement-123');
 assert.throws(()=>exportBatch('2030-01-01',ledger,true,'bad'),/run ID/);
 assert.equal(ledger.length,1);
});
test('historical report lists every skipped and deferred article with its reason',()=>{
 const report=priorReport({skipped:[{id:42,reason:'Only 1 photo'}],deferred:[43]},[post,{id:43,title:'Other'}]);
 assert.equal(report.length,2);assert.equal(report[0].title,'Craft');assert.equal(report[0].reason,'Only 1 photo');assert.match(report[1].reason,/18 input/);
});

test('screen-free activities are not a free-download promise',()=>{
 assert.equal(promisesFreePrintable('screen-free activities for kids'),false);
 assert.equal(promisesFreePrintable('screen free activities'),false);
 assert.equal(promisesFreePrintable('screen-free activities with free printables'),true);
 assert.equal(promisesFreePrintable('free chore chart'),true);
});
