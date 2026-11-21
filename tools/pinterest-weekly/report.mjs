import {readFile} from 'node:fs/promises';
import {priorReport} from './coverage.mjs';
const manifest=JSON.parse(await readFile(process.argv[2],'utf8'));
const response=await fetch('https://n8n.xredible.in/webhook/nst-pinterest-inputs',{headers:{'X-Reel-Secret':process.env.N8N_REELS_SECRET},redirect:'error',signal:AbortSignal.timeout(120000)});
if(!response.ok)throw new Error('Cannot read current published article titles');
const {posts,approvedPhotos=[]}=await response.json();
console.log('PRIOR_REPORT '+JSON.stringify(priorReport(manifest,posts)));
console.log('APPROVED_COUNTS '+JSON.stringify(Object.fromEntries(posts.map(p=>[p.id,approvedPhotos.filter(r=>r.postId===p.id).length]))));
