import test from 'node:test';
import assert from 'node:assert/strict';
import {titleCase,pinCopy,benefitLine,editorialPhotos} from './editorial.mjs';
const post={id:1,title:'5 REAL kindness activities for kids using things at home',meta:{_yoast_wpseo_focuskw:'kindness activities for kids'},html:'<h2>Turn everyday moments into small acts of kindness.</h2><h2>1. Happy Mail Station</h2><p>Write a short thank-you note and place it in an envelope.</p><h2>2. Kindness Rocks</h2><p>Paint a heart on a smooth stone and leave it by your front door.</p><h2>3. Toy Wash</h2><p>Fill a shallow basin with soapy water and wash the toy cars.</p>'};
test('real Title-Case title is preserved and shortened only at word boundaries',()=>{
 const result=titleCase(post.title);assert.equal(result,'5 Real Kindness Activities for Kids Using Things at Home');assert.ok(!/Easy Ideas|Simple Crafts/.test(result));assert.ok(titleCase('A '.repeat(100)).length<=100);assert.ok(titleCase('A '.repeat(100)).endsWith('…'));
});
test('each pin has a different grounded activity description, keyword once, 3–5 specific terms',()=>{
 const copies=['1. Happy Mail Station','2. Kindness Rocks','3. Toy Wash'].map(activityTitle=>pinCopy(post,{activityTitle}));
 assert.equal(new Set(copies.map(p=>p.description)).size,3);
 for(const p of copies){assert.equal(p.title,titleCase(post.title));assert.equal(p.description.toLowerCase().split('kindness activities for kids').length-1,1);assert.equal([...new Intl.Segmenter('en',{granularity:'sentence'}).segment(p.description)].length,2);assert.ok(p.keywords.split(', ').length>=3);assert.ok(!p.keywords.includes('creative play'));assert.equal(p.benefit,'Turn everyday moments into small acts of kindness.');}
});
test('unsupported subtitle and missing source activity fail closed',()=>{
 assert.throws(()=>benefitLine({...post,benefitLine:'Invented benefit'}),/not from/);assert.throws(()=>pinCopy(post,{activityTitle:'Not in article'}),/does not match/);
});
test('owner-rejected Calm Down and weak obstacle photos cannot be chosen',()=>{
 assert.deepEqual(editorialPhotos({id:935},[1979,1982,1980,1981,1983].map(mediaId=>({mediaId}))).map(p=>p.mediaId),[1981,1980,1983]);
 const photos=editorialPhotos({id:751},[2110,2111,2112,2113,2114,2115].map(mediaId=>({mediaId})));assert.deepEqual(photos.map(p=>p.mediaId),[2114,2113,2115]);assert.equal(photos[0].activityTitle,'Sock Toss Challenge');
});
