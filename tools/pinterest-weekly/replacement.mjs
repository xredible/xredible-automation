import {createHash} from 'node:crypto';
import {parseCSV,importIssues} from './import-check.mjs';
import {approvedFor} from './coverage.mjs';
import {editorialPhotos,pinCopy} from './editorial.mjs';
import {boardFor,canonical,schedule} from './plan.mjs';
export function replacementPlan(csvInput,inputs,ledger,{start='2026-11-23',batch,now=Date.now()}={}){
 if(!/^weekly-\d{4}-\d{2}-\d{2}-replacement-\d+$/.test(batch||''))throw new Error('Replacement batch ID required');
 const old=Array.isArray(csvInput)?csvInput:parseCSV(csvInput),media=new Set(old.map(r=>r['Media URL']));
 if(old.length!==media.size)throw new Error('Original file repeats media URLs');
 const targets=new Map();for(const r of old){const url=canonical(r.Link);if(!url)throw new Error('Unexpected article link');targets.set(url,(targets.get(url)||0)+1);}
 if(ledger.filter(r=>media.has(r.media)).length!==old.length)throw new Error('Original CSV does not match reservation ledger');
 const preserved=ledger.filter(r=>r.batch!==batch).map(r=>media.has(r.media)?{...r,status:'superseded',supersededBy:batch,note:'Owner will remove old scheduled pins before importing replacement'}:r);
 const groups=[],issues=[];
 for(const [link,count] of targets){
  const post=inputs.posts.find(p=>canonical(p.link)===link);if(!post)throw new Error('Article is no longer published');
  const pins=[];
  for(const photo of editorialPhotos(post,approvedFor(post,inputs.approvedPhotos))){
   try{const copy=pinCopy(post,photo);if(pins.some(p=>p.description===copy.description))continue;pins.push({...copy,photo,mediaId:photo.mediaId,file:`${post.id}-${pins.length+1}.jpg`});}catch(e){issues.push({id:post.id,mediaId:photo.mediaId,reason:e.message});}
   if(pins.length===count)break;
  }
  if(pins.length!==count)throw new Error(`Post ${post.id}: ${pins.length}/${count} grounded approved-photo pins; ${JSON.stringify(issues.filter(i=>i.id===post.id))}`);
  const existing=new URL(old.find(r=>canonical(r.Link)===link).Link),tracking=Object.fromEntries(['utm_source','utm_medium','utm_campaign'].map(k=>[k,existing.searchParams.get(k)]));
  groups.push({id:post.id,tracking,title:post.title?.raw||post.title?.rendered||post.title,link:post.link,board:boardFor({...post,title:post.title?.raw||post.title?.rendered||post.title},inputs.boards),pins});
 }
 const base=`https://raw.githubusercontent.com/xredible/xredible-automation/media/nestoodle/pinterest/${batch}`;
 const rows=schedule(groups,start,base,now,preserved,{days:60,blockedLinks:[...ledger.filter(r=>r.batch!==batch).map(r=>r.link),...inputs.pins.map(r=>r.link),...old.map(r=>r.Link)].filter(Boolean)});
 const failures=importIssues(rows,inputs.boards);if(failures.length)throw new Error(JSON.stringify(failures));
 const pending=rows.map(r=>({batch,postId:r.postId,link:r.Link,media:r['Media URL'],publishDate:r['Publish date'],title:r.Title,status:'pending-review',sourceMediaId:groups.find(g=>g.id===r.postId).pins.find(p=>p.file===r['Media URL'].split('/').pop()).mediaId,editorialDigest:createHash('sha256').update(JSON.stringify([r.Title,r.Description,r.Keywords,groups.find(g=>g.id===r.postId).pins.find(p=>p.file===r['Media URL'].split('/').pop()).benefit])).digest('hex'),note:'Five image samples shown first; full CSV follows at owner request. Owner removes17 old scheduled pins before upload.'}));
 return {batch,start,end:rows.at(-1)?.['Publish date'].slice(0,10),groups,rows,ledger:[...preserved,...pending],issues};
}
export function replacementSeeds(ledger,batch){
 return ledger.filter(r=>r.supersededBy===batch).sort((a,b)=>a.publishDate.localeCompare(b.publishDate)).map(r=>({'Media URL':r.media,Link:r.link,'Publish date':r.publishDate}));
}
