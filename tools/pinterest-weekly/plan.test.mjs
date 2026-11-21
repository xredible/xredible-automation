import {test} from 'node:test';
import assert from 'node:assert/strict';
import {schedule,csv,eligible,boardFor} from './plan.mjs';
import {parseCSV,importIssues} from './import-check.mjs';
const groups=Array.from({length:17},(_,n)=>({id:n+1,title:n<7?'Christmas Activities':'Family Activities',link:`https://nestoodle.com/post-${n}/`,board:'Kids Activities',pins:Array.from({length:n<3?4:3},(_,i)=>({title:`Real Article Title ${n}`,description:`Try activity ${i}. Follow the article steps.`,keywords:'specific activity, family routines, paper craft',file:`${n+1}-${i+1}.jpg`}))}));
test('54 pins stay in US evening window, max3/day, each article at least3 days apart',()=>{
 const rows=schedule(groups,'2030-01-01','https://example.com',0);assert.equal(rows.length,54);
 const daily=new Map(),dates=new Map();for(const r of rows){assert.ok(['01:00:00','02:00:00','03:00:00'].includes(r['Publish date'].slice(11)));const day=r['Publish date'].slice(0,10);daily.set(day,(daily.get(day)||0)+1);const n=Date.parse(day)/86400000;for(const prev of dates.get(r.postId)||[])assert.ok(Math.abs(prev-n)>=3);dates.set(r.postId,[...dates.get(r.postId)||[],n]);}
 assert.ok([...daily.values()].every(n=>n<=3));assert.ok(daily.size>=18);assert.equal(new Set(rows.map(r=>r.Link)).size,54);
 assert.ok(rows.every(r=>r.Description.endsWith(r.Link)));
});
test('new links use postId-pinNumber and preserve tracking across all prior/superseded/scheduled links',()=>{
 const group={...groups[0],tracking:{utm_source:'pinterest',utm_medium:'organic',utm_campaign:'keep-me'}};
 const old='https://nestoodle.com/post-0/?utm_source=pinterest&utm_medium=organic&utm_campaign=keep-me&utm_content=1-7';
 const rows=schedule([group],'2030-01-01','https://example.com',0,[{postId:1,link:old,status:'superseded'}],{blockedLinks:[old]});
 assert.equal(new URL(rows[0].Link).searchParams.get('utm_content'),'1-8');
 for(const r of rows){const p=new URL(r.Link).searchParams;assert.equal(p.get('utm_source'),'pinterest');assert.equal(p.get('utm_medium'),'organic');assert.equal(p.get('utm_campaign'),'keep-me');assert.notEqual(r.Link,old);}
});
test('holiday articles get earliest slots even when input is reversed',()=>{
 const rows=schedule([...groups].reverse(),'2030-01-01','https://example.com',0);assert.ok(rows.slice(0,3).every(r=>r.postId<=7));
});
test('weekly planning sees pending-review dates and covered articles; superseded rows do not reserve twice',()=>{
 const reserved=[{postId:99,publishDate:'2030-01-01T01:00:00',status:'pending-review'},{postId:98,publishDate:'2030-01-01T02:00:00',status:'pending-review'},{postId:97,publishDate:'2030-01-01T03:00:00',status:'pending-review'}];
 const rows=schedule(groups.slice(0,1),'2030-01-01','https://example.com',0,reserved);assert.ok(rows.every(r=>r['Publish date'].slice(0,10)!=='2030-01-01'));
 const posts=[{id:1,title:'Real Title',date:'2030-01-01',link:groups[0].link}];
 const pending=Array.from({length:3},()=>({link:posts[0].link,status:'pending-review'}));assert.equal(eligible(posts,[],pending).length,0);assert.equal(eligible(posts,[],pending.map(r=>({...r,status:'superseded'}))).length,1);
});
test('spacing applies across old reservations and insufficient horizons fail before export',()=>{
 const rows=schedule(groups.slice(0,1),'2030-01-01','https://example.com',0,[{postId:1,publishDate:'2030-01-01T02:00:00'}]);assert.ok(rows[0]['Publish date'].startsWith('2030-01-04'));
 assert.throws(()=>schedule(groups,'2030-01-01','https://example.com',0,[],{days:1}),/capacity/);
});
test('CSV round-trips commas, quotes, Unicode, embedded line breaks and exact headers',()=>{
 const rows=schedule(groups.slice(0,1),'2030-01-01','https://example.com',0);rows[0].Title='Crafts, "easy"';rows[0].Description='One sentence.\nAnother sentence.';
 const output=csv(rows);assert.ok(output.startsWith('\ufeff"Title","Media URL","Pinterest board","Thumbnail","Description","Link","Publish date","Keywords"\r\n'));assert.deepEqual(parseCSV(output)[0].Title,rows[0].Title);assert.deepEqual(parseCSV(output)[0].Description,rows[0].Description);
});
test('import preflight reproduces one-per-link rejection and catches wrong boards',()=>{
 const rows=schedule(groups.slice(0,1),'2030-01-01','https://example.com',0);rows.forEach(r=>r.Link='https://nestoodle.com/repeated/');
 const issues=importIssues(rows,[{name:'Kids Activities',privacy:'PUBLIC'}]);assert.equal(issues.filter(i=>i.reason==='Duplicate Pin link').length,rows.length-1);
 assert.ok(importIssues(rows,[]).some(i=>i.reason.includes('Board')));
});
test('unreachable or invalid dates/limits and absent board fail visibly',()=>{
 assert.throws(()=>schedule(groups,'2020-01-01','https://example.com'),/capacity/);assert.throws(()=>boardFor({slug:'thanksgiving-crafts',title:'Crafts'},[]));
});
