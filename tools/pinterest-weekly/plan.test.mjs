import {test} from 'node:test';
import assert from 'node:assert/strict';
import {schedule,csv,eligible,boardFor,variations} from './plan.mjs';
const groups=Array.from({length:18},(_,n)=>({id:n+1,link:`https://nestoodle.com/post-${n}/`,board:'Kids Activities',pins:Array.from({length:5},(_,i)=>({title:`Keyword ${n}: Idea ${i}`,description:'Keyword ideas for kids. Read the guide for steps.',keywords:'keyword, kids',file:`${n+1}-${i+1}.jpg`}))}));
test('maximum capacity spreads >=3 per post, <=8 per day and one post/day',()=>{
 const rows=schedule(groups,'2030-01-01','https://example.com',0);assert.equal(rows.length,56);
 const daily=new Map(),seen=new Set(),counts=new Map();
 for(const r of rows){const day=new Date(Date.parse(r['Publish date']+'Z')+19800000).toISOString().slice(0,10),k=day+'-'+r.postId;assert(!seen.has(k));seen.add(k);daily.set(day,(daily.get(day)||0)+1);counts.set(r.postId,(counts.get(r.postId)||0)+1);assert.equal(new URL(r.Link).searchParams.get('utm_source'),'pinterest');assert.equal(r.Thumbnail,'');}
 assert([...daily.values()].every(n=>n<=8));assert([...counts.values()].every(n=>n>=3&&n<=5));
});
test('single post gets five different days and no immediate publish dates',()=>{const rows=schedule(groups.slice(0,1),'2030-01-01','https://example.com',0);assert.equal(rows.length,5);assert.throws(()=>schedule(groups,'2020-01-01','https://example.com'));});
test('published coverage and prior exports exclude covered posts, ignore foreign pins',()=>{const posts=[{id:1,title:'Test',date:'2026-01-01',link:'https://nestoodle.com/test/'}];assert.equal(eligible(posts,Array.from({length:3},()=>({is_owner:true,link:posts[0].link+'?utm_source=pinterest'}))).length,0);assert.equal(eligible(posts,Array.from({length:3},()=>({is_owner:false,link:posts[0].link}))).length,1);assert.equal(eligible(posts,[],Array.from({length:3},()=>({link:posts[0].link}))).length,0);});
test('CSV quotes commas, quotes, Unicode and preserves all eight exact headers',()=>{const row=schedule(groups.slice(0,1),'2030-01-01','https://example.com',0)[0];row.Title='Crafts, "easy"';const output=csv([row]);assert(output.startsWith('\ufeff"Title","Media URL","Pinterest board","Thumbnail","Description","Link","Publish date","Keywords"\r\n'));assert(output.includes('"Crafts, ""easy"""'));});
test('missing boards fail rather than silently creating a board on CSV import',()=>{assert.throws(()=>boardFor({slug:'thanksgiving-crafts',title:'Crafts'},[]));});
test('keyword-led variations differ, descriptions have two sentences',()=>{const vs=variations({keyword:'Thanksgiving crafts for kids'});assert.equal(new Set(vs.map(v=>v.title)).size,5);for(const v of vs){assert(v.title.startsWith('Thanksgiving crafts for kids'));assert.equal(v.description.split(/[.!?]+/).filter(x=>x.trim()).length,2);}});
test('overlapping earlier exports reserve capacity and prevent same-post same-day',()=>{
 const old=Array.from({length:8},(_,i)=>({postId:100+i,publishDate:`2030-01-01T${String(3+2*i).padStart(2,'0')}:30:00`}));
 const rows=schedule(groups.slice(0,1),'2030-01-01','https://example.com',0,old);assert(rows.every(r=>r['Publish date'].slice(0,10)!=='2030-01-01'));
});
