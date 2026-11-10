// Only the new brand media folder is written. No n8n callbacks or social publishing.
import {execFileSync} from 'node:child_process';
import {readFile,copyFile,mkdtemp,mkdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const git=(args,cwd=process.cwd())=>execFileSync('git',args,{cwd,stdio:'pipe',encoding:'utf8'}).trim();
const out=path.resolve(process.env.BRAND_OUTPUT??'tools/brand-images/output');
const info=JSON.parse(await readFile(path.join(out,'render-info.json'),'utf8'));
if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(info.slug)||info.slug.length>100)throw new Error('Invalid output slug');
const files=['render-info.json',...info.outputs.map(o=>o.file)];
if(files.some(f=>! /^(?:render-info\.json|[a-z0-9-]+\.jpg)$/.test(f)))throw new Error('Invalid output file');
const temp=await mkdtemp(path.join(os.tmpdir(),'brand-media-')),tree=path.join(temp,'media');
try{
 git(['fetch','origin','media','--depth=1']);git(['worktree','add','--detach',tree,'FETCH_HEAD']);
 const dest=path.join(tree,'nestoodle','brand',info.slug);await mkdir(dest,{recursive:true});
 for(const file of files)await copyFile(path.join(out,file),path.join(dest,file));
 git(['config','user.name','github-actions[bot]'],tree);git(['config','user.email','41898282+github-actions[bot]@users.noreply.github.com'],tree);
 git(['add','--',`nestoodle/brand/${info.slug}`],tree);
 if(git(['diff','--cached','--name-only'],tree)){
  git(['commit','-m',`Nestoodle brand samples: ${info.slug}`],tree);
  for(let attempt=0;attempt<4;attempt++){
   try{git(['push','origin','HEAD:media'],tree);break;}catch(error){if(attempt===3)throw error;git(['fetch','origin','media'],tree);git(['rebase','FETCH_HEAD'],tree);}
  }
 }
 console.log(`Media ready: https://raw.githubusercontent.com/xredible/xredible-automation/media/nestoodle/brand/${info.slug}/pin.jpg`);
}finally{try{git(['worktree','remove','--force',tree]);}finally{await rm(temp,{recursive:true,force:true});}}
