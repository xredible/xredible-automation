import {realpath} from 'node:fs/promises';
import path from 'node:path';
import {render} from './render.mjs';
const manifest=process.env.BRAND_MANIFEST??process.argv[2];
if(!/^tools\/brand-images\/(?:samples|jobs)\/[a-z0-9-]+\/job\.json$/.test(manifest??''))throw new Error('Choose a committed job.json inside tools/brand-images/samples or jobs');
const root=await realpath(process.cwd()),file=await realpath(manifest);
if(!file.startsWith(root+path.sep))throw new Error('Manifest outside repo');
const out=path.resolve(process.env.BRAND_OUTPUT??'tools/brand-images/output');
const result=await render(file,out);console.log(`Validated ${result.length} outputs in ${out}`);
