import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {callback} from './callback.mjs';
import {realpath} from 'node:fs/promises';
import path from 'node:path';
import {render} from './render.mjs';
const payload=process.env.BRAND_JOB_JSON;
let manifest=process.env.BRAND_MANIFEST??process.argv[2];
const out=path.resolve(process.env.BRAND_OUTPUT??'tools/brand-images/output');
let remote;
if(payload){
 if(Buffer.byteLength(payload)>60000)throw new Error('Brand job exceeds dispatch limit');
 remote=JSON.parse(payload);
 if(!/^bi-[a-z0-9-]+-\d{13}$/.test(remote.jobId??''))throw new Error('Invalid brand job ID');
 if(remote.photos.some(p=>!p.src.startsWith('https://')))throw new Error('Dispatched photos must be public HTTPS');
 const temp=path.join(out,'input');await mkdir(temp,{recursive:true});manifest=path.join(temp,'job.json');await writeFile(manifest,JSON.stringify(remote));
}

if(!remote&&!/^tools\/brand-images\/(?:samples|jobs)\/[a-z0-9-]+\/job\.json$/.test(manifest??''))throw new Error('Choose a committed job.json inside tools/brand-images/samples or jobs');
const root=await realpath(process.cwd()),file=await realpath(manifest);
if(!remote&&!file.startsWith(root+path.sep))throw new Error('Manifest outside repo');
try{
 const result=await render(file,out);
 if(remote){const reportFile=path.join(out,'render-info.json');const report=JSON.parse(await readFile(reportFile,'utf8'));report.jobId=remote.jobId;await writeFile(reportFile,JSON.stringify(report,null,2)+'\n');}
 console.log(`Validated ${result.length} outputs`);
}catch(error){if(remote)await callback({jobId:remote.jobId,error:'Brand rendering failed validation; inspect Action logs.'}).catch(()=>{});throw error;}

