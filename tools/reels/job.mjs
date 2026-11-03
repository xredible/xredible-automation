// Authenticated, single-job worker. No third-party credentials are embedded in source or artifacts.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../../',import.meta.url));const here=path.join(root,'tools/reels');
const base='https://n8n.xredible.in/webhook';const secret=process.env.N8N_REELS_SECRET;
if(!secret)throw new Error('N8N_REELS_SECRET is not configured');
const api=async(route,body)=>{const res=await fetch(base+route,{method:body?'POST':'GET',headers:{'X-Reel-Secret':secret,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(60000)});if(!res.ok)throw new Error('n8n returned HTTP '+res.status);const value=await res.json();if(value.ok===false)throw new Error('n8n refused job result');return value;};
const sh=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const work=process.env.RUNNER_TEMP||path.join(root,'.reels-tmp');
const {jobs=[]}=await api('/nst-reel-jobs');
if(!Array.isArray(jobs)||jobs.length>1)throw new Error('Expected at most one claimed job');
for(const job of jobs){if(!/^nst-\d+-\d+$/.test(job.jobId))throw new Error('Invalid job identifier');
try{const dir=path.join(work,job.jobId);fs.mkdirSync(dir,{recursive:true});fs.cpSync(path.join(here,'assets'),path.join(dir,'assets'),{recursive:true});fs.copyFileSync(path.join(here,'reel.html'),path.join(dir,'reel.html'));
const spec=structuredClone(job.spec);if(!Array.isArray(spec.scenes)||spec.scenes.length<4||spec.scenes.length>7)throw new Error('Invalid scenes');
async function asset(url,destination){const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='nestoodle.com'||!u.pathname.startsWith('/wp-content/uploads/'))throw new Error('Unexpected asset origin');const response=await fetch(u,{redirect:'error',signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error('Asset download failed');const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>25*1024*1024)throw new Error('Asset too large');fs.writeFileSync(destination,bytes);}
spec.logo='assets/nestoodle-logo.png';spec.fps=30;
for(const [i,scene] of spec.scenes.entries()){const image=`image-${i}.jpg`,voice=`voice-${i}.wav`;if(scene.kind!=='cta'){await asset(scene.image,path.join(dir,image));scene.image=image;}if(!scene.audioUrl)throw new Error('Missing narration URL');await asset(scene.audioUrl,path.join(dir,voice));scene.vo=voice;delete scene.audioUrl;}
fs.writeFileSync(path.join(dir,'spec.json'),JSON.stringify(spec));sh(process.execPath,[path.join(here,'render.mjs'),path.join(dir,'spec.json'),path.join(dir,'reel.mp4')]);
const info=JSON.parse(fs.readFileSync(path.join(dir,'render-info.json'),'utf8'));if(info.seconds<10||info.seconds>180)throw new Error('Rendered duration invalid');
const media=path.join(work,'media');if(!fs.existsSync(media)){sh('git',['-C',root,'fetch','--depth','1','origin','media']);sh('git',['-C',root,'worktree','add','--detach',media,'FETCH_HEAD']);}
const relative=`nestoodle/reels/${job.jobId}`;const destination=path.join(media,relative);fs.mkdirSync(destination,{recursive:true});for(const file of ['reel.mp4','cover.jpg'])fs.copyFileSync(path.join(dir,file),path.join(destination,file));
sh('git',['-C',media,'add','--',relative]);if(sh('git',['-C',media,'status','--porcelain'])){sh('git',['-C',media,'-c','user.name=Nestoodle Renderer','-c','user.email=actions@users.noreply.github.com','commit','-m',`Nestoodle reel ${job.jobId}`]);let pushed=false;for(let attempt=0;attempt<3;attempt++){try{sh('git',['-C',media,'push','origin','HEAD:media']);pushed=true;break;}catch{sh('git',['-C',media,'fetch','origin','media']);sh('git',['-C',media,'rebase','FETCH_HEAD']);}}if(!pushed)throw new Error('Media push failed');}
const url=`https://raw.githubusercontent.com/xredible/xredible-automation/media/${relative}`;
// Retry identical callback: per-platform markers make sequential retries safe.
let delivered=false;for(let attempt=0;attempt<3;attempt++){try{await api('/nst-reel-done',{jobId:job.jobId,video:url+'/reel.mp4',cover:url+'/cover.jpg',seconds:info.seconds});delivered=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,2000));}}if(!delivered)throw new Error('Result delivery failed; inspect n8n execution before retry');
console.log('Rendered and delivered',job.jobId);
}catch(error){console.error('Job failed',job.jobId);await api('/nst-reel-done',{jobId:job.jobId,error:'Renderer failed; inspect private runner logs and n8n execution.'}).catch(()=>{});process.exitCode=1;}}
