// Covers use the canonical Nestoodle story template, never a captured video frame.
import fs from 'node:fs/promises';
import path from 'node:path';
import {render} from '../brand-images/render.mjs';
export async function brandCover(spec,dir){
 const cover=spec.brandCover,review=cover?.review;
 if(review?.approved!==true||review.score!==10||review.faceFree!==true||!Array.isArray(review.problems)||review.problems.length||!review.reviewer)throw new Error('Checked brand cover photo pending (Codex)');
 const scene=spec.scenes.find(s=>s.kind!=='cta'&&s.image);if(!scene?.image)throw new Error('No checked cover photo');
 const slug='reel-cover-'+String(spec.jobId||spec.postId||'fixture');
 const job={slug,articleUrl:spec.link,title:cover.title,benefit:cover.benefit||'Read the guide at nestoodle.com',keyword:spec.keyword||'GUIDE',coverPhoto:0,photos:[{src:scene.image,alt:cover.alt||spec.title,review}],steps:[]};
 const file=path.join(dir,'brand-cover-job.json'),out=path.join(dir,'brand-cover-output');
 await fs.writeFile(file,JSON.stringify(job));await render(file,out,{storyOnly:true});
 const bytes=await fs.readFile(path.join(out,'story.jpg'));if(bytes.subarray(0,3).toString('hex')!=='ffd8ff')throw new Error('Cover is not JPEG');
 await fs.writeFile(path.join(dir,'cover.jpg'),bytes);return {coverTemplate:'nestoodle-story',coverReviewScore:10,coverMime:'image/jpeg'};
}
