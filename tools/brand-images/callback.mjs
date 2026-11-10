import {readFile} from 'node:fs/promises';
import path from 'node:path';
export async function callback(body){
 const key=process.env.N8N_REELS_SECRET;if(!key)throw new Error('Renderer callback credential not configured');
 const response=await fetch('https://n8n.xredible.in/webhook/nst-brand-done',{method:'POST',redirect:'error',headers:{'X-Reel-Secret':key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw new Error(`Brand callback HTTP ${response.status}`);const result=await response.json();if(result.ok!==true)throw new Error('Brand callback refused result');
}
if(process.argv[2]==='done'){
 const info=JSON.parse(await readFile(path.join(process.env.BRAND_OUTPUT,'render-info.json'),'utf8'));
 if(info.jobId)await callback({jobId:info.jobId,slug:info.slug,files:info.outputs.map(o=>o.file)});
}
