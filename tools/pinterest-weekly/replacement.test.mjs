import test from 'node:test';
import assert from 'node:assert/strict';
import {replacementPlan,replacementSeeds} from './replacement.mjs';
import {csv,eligible,schedule} from './plan.mjs';
const html='<h2>Turn everyday moments into small acts of kindness.</h2>'+['Happy Mail Station','Kindness Rocks','Toy Wash'].map((name,i)=>`<h2>${i+1}. ${name}</h2><p>Write a kind note with your child and place it in envelope number ${i+1}.</p><img class="wp-image-${10+i}" src="https://nestoodle.com/wp-content/uploads/${10+i}.webp">`).join('');
const post={id:1,slug:'kindness',title:'3 Kindness Activities for Kids',link:'https://nestoodle.com/kindness/',date:'2030-01-01',html,meta:{_yoast_wpseo_focuskw:'kindness activities for kids'}};
const approvedPhotos=['Happy Mail Station','Kindness Rocks','Toy Wash'].map((t,i)=>({postId:1,mediaId:10+i,activityTitle:`${i+1}. ${t}`,src:`https://nestoodle.com/wp-content/uploads/${10+i}.webp`,alt:t,approved:true,score:10,faceFree:true,problems:'[]',reviewer:'Native check'}));
const rows=approvedPhotos.map((p,i)=>({Title:'Old Generic Title','Media URL':`https://example.com/old-${i}.jpg`,'Pinterest board':'Kids Activities',Thumbnail:'',Description:'Old generic text.',Link:post.link+'?utm_source=pinterest&utm_medium=social&utm_campaign=original','Publish date':`2030-01-0${i+1}T05:00:00`,Keywords:'generic'}));
const ledger=rows.map(r=>({media:r['Media URL'],link:r.Link,postId:1,publishDate:r['Publish date'],status:'exported-not-confirmed-published'}));
test('fresh replacement supersedes only exact old rows and reserves pending dates for future weekly runs',()=>{
 const plan=replacementPlan(csv(rows),{posts:[post],boards:[{name:'Kids Activities',privacy:'PUBLIC'}],approvedPhotos,pins:[]},ledger,{start:'2030-01-01',batch:'weekly-2030-01-01-replacement-123',now:0});
 assert.equal(plan.rows.length,3);assert.ok(plan.rows.every(r=>!rows.some(o=>o['Media URL']===r['Media URL']||o.Link===r.Link)));assert.equal(plan.ledger.filter(r=>r.status==='superseded').length,3);assert.equal(plan.ledger.filter(r=>r.status==='pending-review').length,3);
 assert.equal(eligible([post],[],plan.ledger).length,0);
 const again=replacementPlan(csv(rows),{posts:[post],boards:[{name:'Kids Activities',privacy:'PUBLIC'}],approvedPhotos,pins:[]},plan.ledger,{start:'2030-01-01',batch:'weekly-2030-01-01-replacement-123',now:0});assert.deepEqual(again.rows.map(r=>r.Link),plan.rows.map(r=>r.Link));assert.equal(again.ledger.length,plan.ledger.length);
 const next=schedule([{id:2,title:'Other',link:'https://nestoodle.com/other/',board:'Kids Activities',pins:Array.from({length:3},(_,i)=>({title:'Other',description:'Try an activity. Follow the steps.',keywords:'other',file:`2-${i}.jpg`}))}],'2030-01-01','https://example.com',0,plan.ledger);
 assert.ok(next.every(r=>!plan.rows.some(p=>p['Publish date']===r['Publish date'])));
 assert.equal(new URL(plan.rows[0].Link).searchParams.get('utm_campaign'),'original');
});
test('replacement refuses an unknown old export rather than reset reservations',()=>{
 assert.throws(()=>replacementPlan(csv(rows),{posts:[post],approvedPhotos,boards:[],pins:[]},[],{start:'2030-01-01',batch:'weekly-2030-01-01-replacement-123',now:0}),/does not match/);
});


test('replaying source exports restores combined CSV chronology before allocating slots',()=>{
 const source=[{media:'later.jpg',link:'https://nestoodle.com/b/',publishDate:'2030-01-02T02:00:00',supersededBy:'batch'},{media:'earliest.jpg',link:'https://nestoodle.com/a/',publishDate:'2030-01-01T01:00:00',supersededBy:'batch'},{media:'middle.jpg',link:'https://nestoodle.com/b/',publishDate:'2030-01-01T02:00:00',supersededBy:'batch'},{media:'unrelated.jpg',link:'https://nestoodle.com/c/',publishDate:'2029-01-01T01:00:00'}];
 assert.deepEqual(replacementSeeds(source,'batch').map(r=>r['Media URL']),['earliest.jpg','middle.jpg','later.jpg']);
 assert.equal(source[0].media,'later.jpg');
});
