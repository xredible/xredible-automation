// Read-only checks: never submit the subscriber form or use a signed download.
const origin='https://nestoodle.com';
const attr=(tag,name)=>tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`,'i'))?.[1];
export function matchingPrintableGate(html,post,pdf){
 const relative=decodeURIComponent(new URL(pdf).pathname.slice('/wp-content/uploads/'.length));
 const clean=String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 for(const match of clean.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/gi)){
  const form=match[0],head=form.slice(0,form.indexOf('>')+1);
  if(!String(attr(head,'class')).split(/\s+/).includes('nst-gate-form')||attr(head,'method')?.toLowerCase()!=='post'||attr(head,'action')!==origin+'/wp-admin/admin-ajax.php?action=nestoodle_printable')continue;
  const fields=new Map([...form.matchAll(/<input\b[^>]*>/gi)].map(m=>[attr(m[0],'name'),attr(m[0],'value')]));
  const token=fields.get('file')||'',parts=token.split('.');
  if(fields.get('from')!==String(post.id)||parts.length!==2||!/^[a-f0-9]{20}$/.test(parts[1]))continue;
  if(Buffer.from(parts[0],'base64url').toString('utf8')===relative&&/<input\b[^>]*type=["']email["']/i.test(form))return true;
 }
 return false;
}
export async function verifyPostPrintable(post,{fetchImpl=fetch}={}){
 const article=new URL(post.link);article.search='';article.hash='';
 if(article.origin!==origin)throw new Error('Printable article must belong to Nestoodle');
 for(const m of String(post.html||'').matchAll(/href=["'](https:\/\/nestoodle\.com\/wp-content\/uploads\/[^"']+\.pdf(?:\?[^"']*)?)["']/gi)){
  const pdf=m[1].replace(/&amp;/g,'&');
  try{
   const result=await fetchImpl(pdf,{redirect:'manual',headers:{Range:'bytes=0-4'},signal:AbortSignal.timeout(30000)});
   if(result.ok&&result.headers.get('content-type')?.split(';')[0]==='application/pdf'){
    if(Buffer.from(await result.arrayBuffer()).subarray(0,5).toString()==='%PDF-')return {kind:'direct-pdf',url:pdf};
   }else if([301,302,303,307,308].includes(result.status)){
    const location=new URL(result.headers.get('location'),pdf);
    if(location.href!==article.href+'#free-printable')continue;
    const page=await fetchImpl(article.href,{redirect:'error',signal:AbortSignal.timeout(30000)});
    if(page.ok&&page.headers.get('content-type')?.startsWith('text/html')&&matchingPrintableGate(await page.text(),post,pdf))return {kind:'email-gated-pdf',url:article.href+'#free-printable'};
   }
  }catch{}
 }
 throw new Error(`Post ${post.id}: free printable promise needs a verified PDF or matching live email-gated file card`);
}
