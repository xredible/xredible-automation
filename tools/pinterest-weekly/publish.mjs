// Only publishes image assets/export reservations to GitHub media, never Pinterest.
import {execFileSync} from 'node:child_process';
import {readFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve(process.env.PINTEREST_OUTPUT||'pinterest-output'),tree=path.resolve('media-input');
const m=JSON.parse(await readFile(path.join(out,'manifest.json'),'utf8'));
if(!/^weekly-\d{4}-\d{2}-\d{2}$/.test(m.batch)||m.count>56||m.count!==m.rows.length)throw new Error('Invalid export manifest');
const git=args=>execFileSync('git',args,{cwd:tree,stdio:'pipe',encoding:'utf8'}).trim();
const dest=path.join(tree,'nestoodle','pinterest',m.batch);await mkdir(dest,{recursive:true});
for(const r of m.rows){const file=r['Media URL'].split('/').pop();if(!/^\d+-[1-5]\.jpg$/.test(file))throw new Error('Invalid media name');await copyFile(path.join(out,file),path.join(dest,file));}
await copyFile(path.join(out,'ledger.json'),path.join(tree,'nestoodle/pinterest/ledger.json'));
git(['config','user.name','github-actions[bot]']);git(['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
git(['add','--','nestoodle/pinterest']);
if(git(['diff','--cached','--name-only'])){
 git(['commit','-m',`Nestoodle manual Pinterest export assets: ${m.batch}`]);
 for(let n=0;n<4;n++){try{git(['push','origin','HEAD:media']);break;}catch{if(n===3)throw new Error('Media push failed');git(['fetch','origin','media']);git(['rebase','FETCH_HEAD']);}}
}
