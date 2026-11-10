import {readFile} from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve(process.env.PINTEREST_OUTPUT||'pinterest-output');
const m=JSON.parse(await readFile(path.join(out,'manifest.json'),'utf8'));
const csv=await readFile(path.join(out,'pinterest.csv')),preview=await readFile(path.join(out,'preview.jpg'));
if(csv.length>200000||preview.length>8*1024*1024)throw new Error('Delivery file exceeds size bound');
if(!process.env.N8N_REELS_SECRET)throw new Error('Missing renderer authentication');
for(const row of m.rows){
 const u=new URL(row['Media URL']);
 if(u.origin!=='https://raw.githubusercontent.com'||!u.pathname.startsWith('/xredible/xredible-automation/media/nestoodle/pinterest/'))throw new Error('Unexpected export media URL');
 let ready=false;
 for(let n=0;n<4;n++){
  const image=await fetch(u,{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(30000)});
  if(image.ok&&image.headers.get('content-type')?.startsWith('image/jpeg')){ready=true;break;}
  await new Promise(resolve=>setTimeout(resolve,1000*(n+1)));
 }
 if(!ready)throw new Error('A pin asset is not public yet; retry delivery from the saved artifact');
}
const end=new Date(Date.parse(m.start+'T00:00:00Z')+6*86400000).toISOString().slice(0,10);
const body={batch:m.batch,start:m.start,end,count:m.count,csv:csv.toString('base64'),preview:preview.toString('base64'),skipped:m.skipped,deferred:m.deferred};
const r=await fetch('https://n8n.xredible.in/webhook/nst-pinterest-deliver',{method:'POST',headers:{'X-Reel-Secret':process.env.N8N_REELS_SECRET,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(120000)});
if(!r.ok)throw new Error(`Telegram delivery HTTP ${r.status}; retry the deliver step using the saved artifact`);
const response=await r.json();if(response.ok!==true)throw new Error('Delivery was not acknowledged');
console.log(`Delivered ${m.count} pins and preview to owner review`);
