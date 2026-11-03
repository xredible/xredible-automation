// node render.mjs <work-dir>/spec.json <output.mp4>. Local assets only.
import fs from 'node:fs';
import {mixAudio} from './audio.mjs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const [specPath,outPath]=process.argv.slice(2);
if(!specPath||!outPath?.endsWith('.mp4'))throw new Error('Usage: render.mjs spec.json out.mp4');
const dir=path.dirname(path.resolve(specPath));const spec=JSON.parse(fs.readFileSync(specPath,'utf8'));
const fps=Number(spec.fps||30);if(![12,24,30].includes(fps))throw new Error('Unsupported frame rate');
const local=p=>{const result=path.resolve(dir,p);if(!result.startsWith(dir+path.sep))throw new Error('Asset escapes work directory');return result};
const probe=file=>Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',file],{encoding:'utf8'}).trim());
let total=0;for(const s of spec.scenes){if(s.vo)s.dur=probe(local(s.vo))+.5;else if(!s.dur)throw new Error('Missing voice clip');if(!(s.dur>0&&s.dur<40))throw new Error('Invalid scene duration');total+=s.dur;}
if(!(total>0&&total<=180))throw new Error('Invalid total duration');
const silent=outPath.replace(/\.mp4$/,'.silent.mp4');let browser;
try{browser=await chromium.launch({headless:true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--single-process','--no-zygote']} : {})});const page=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
await page.route('**/*',route=>{const url=route.request().url();return url.startsWith('file:')?route.continue():route.abort()});
await page.goto(pathToFileURL(path.join(dir,'reel.html')).href);await page.evaluate(s=>{window.SPEC=s;window.renderAt(0)},spec);await page.evaluate(()=>document.fonts.ready);
const assets=[spec.logo,...spec.scenes.filter(s=>s.kind!=='cta').map(s=>s.image)].filter(Boolean);await page.evaluate(async urls=>{await Promise.all(urls.map(url=>new Promise((resolve,reject)=>{const im=new Image();im.onload=resolve;im.onerror=()=>reject(new Error('Image did not load'));im.src=url})))},assets);
const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate',String(fps),'-c:v','mjpeg','-i','-','-c:v','libx264','-pix_fmt','yuv420p','-preset','veryfast','-crf','21',silent],{stdio:['pipe','inherit','inherit']});
const finished=new Promise((resolve,reject)=>{ff.on('error',reject);ff.on('close',code=>code===0?resolve():reject(new Error('Video encoder failed: '+code)))});finished.catch(()=>{});
for(let f=0;f<Math.ceil(total*fps);f++){await page.evaluate(t=>window.renderAt(t),f/fps);const buf=await page.screenshot({type:'jpeg',quality:88});if(!ff.stdin.write(buf))await new Promise((resolve,reject)=>{const cleanup=()=>{ff.stdin.off('drain',drain);ff.stdin.off('error',fail)};const drain=()=>{cleanup();resolve()};const fail=error=>{cleanup();reject(error)};ff.stdin.once('drain',drain);ff.stdin.once('error',fail)});}
ff.stdin.end();await finished;
await page.evaluate(()=>{window.renderAt(1.6);document.querySelectorAll('.caption,.progress').forEach(el=>el.style.visibility='hidden')});await page.screenshot({path:path.join(path.dirname(outPath),'cover.jpg'),type:'jpeg',quality:92});
mixAudio(silent, spec.scenes, total, outPath, local);
fs.writeFileSync(path.join(path.dirname(outPath),'render-info.json'),JSON.stringify({seconds:probe(outPath),width:1080,height:1920,fps}));
}finally{await browser?.close();if(fs.existsSync(silent))fs.unlinkSync(silent);}
