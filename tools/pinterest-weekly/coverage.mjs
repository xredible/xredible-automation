const norm=u=>String(u||'').replace(/&amp;/g,'&').replace(/-\d+x\d+(?=\.(?:webp|jpe?g|png)(?:$|\?))/i,'');
export function approvedFor(post,rows){
 const html=String(post.html||post.content?.raw||post.content?.rendered||'');
 const tags=[...html.matchAll(/<img\b[^>]*>/gi)].map(m=>m[0]),seen=new Set();
 return rows.flatMap(r=>{
  let problems;try{problems=typeof r.problems==='string'?JSON.parse(r.problems):r.problems;}catch{return [];}
  if(r.postId!==Number(post.id)||!Number.isSafeInteger(r.mediaId)||r.mediaId<1||r.approved!==true||r.score!==10||r.faceFree!==true||!Array.isArray(problems)||problems.length||!String(r.reviewer||'').trim())return [];
  let u;try{u=new URL(r.src);}catch{return [];}
  if(u.origin!=='https://nestoodle.com'||!u.pathname.startsWith('/wp-content/uploads/')||u.search||u.hash)return [];
  const tag=tags.find(t=>new RegExp('\\bwp-image-'+r.mediaId+'\\b').test(t));
  if(norm(tag?.match(/\bsrc=["']([^"']+)["']/i)?.[1])!==norm(r.src))return [];
  if(seen.has(norm(r.src)))return [];seen.add(norm(r.src));
  return [{src:r.src,alt:r.alt||post.title,review:{approved:true,pass:true,score:10,faceFree:true,problems:[],reviewer:r.reviewer},mediaId:r.mediaId}];
 });
}
export function exportBatch(start,ledger,supplement,runId){
 const base=`weekly-${start}`;
 if(supplement){if(!/^\d+$/.test(String(runId)))throw new Error('Supplement needs an Actions run ID');return `${base}-supplement-${runId}`;}
 if(ledger.some(r=>r.batch===base))throw new Error('This planning week was already exported; reuse its CSV or explicitly request a supplement');
 return base;
}
export function priorReport(manifest,posts){
 const byId=new Map(posts.map(p=>[p.id,p]));
 return [...manifest.skipped.map(r=>({...r,status:'skipped'})),...manifest.deferred.map(id=>({id,status:'deferred',reason:'Previous exporter stopped after its first 18 input articles; not reviewed in that run'}))].map(r=>({...r,title:byId.get(r.id)?.title?.raw||byId.get(r.id)?.title?.rendered||byId.get(r.id)?.title||`Article ${r.id}`,link:byId.get(r.id)?.link||''}));
}
export async function fillCoverage(posts,limit,build){
 const groups=[],skipped=[],deferred=[];
 for(const p of posts){
  if(groups.length>=limit){deferred.push(p.id);continue;}
  try{groups.push(await build(p));}catch(e){skipped.push({id:p.id,title:p.title,reason:String(e.message).slice(0,250)});}
 }
 return {groups,skipped,deferred};
}

export const promisesFreePrintable=keyword=>/\bfree\b/i.test(String(keyword||'').replace(/\bscreen[-\s]+free\b/gi,''));
