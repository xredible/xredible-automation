import {columns} from './plan.mjs';
export function parseCSV(input){
 const text=String(input).replace(/^\uFEFF/,'');const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
 else if(c===','&&!quoted){row.push(cell);cell='';}
 else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw new Error('Unclosed CSV quote');if(cell||row.length){row.push(cell);rows.push(row);}
 if(JSON.stringify(rows.shift())!==JSON.stringify(columns))throw new Error('Incorrect Pinterest CSV headers');
 return rows.map((values,i)=>{if(values.length!==columns.length)throw new Error(`Row ${i+2}: incorrect field count`);return Object.fromEntries(columns.map((c,j)=>[c,values[j]]));});
}
export function importIssues(rows,boards){
 const errors=[],links=new Map(),media=new Set();
 for(const [i,r] of rows.entries()){
  if(!r.Title||r.Title.length>100)errors.push({row:i+2,reason:'Invalid title length'});
  if(r.Description.length>500)errors.push({row:i+2,reason:'Description exceeds500 characters'});
  if(boards&&!boards.some(b=>b.privacy==='PUBLIC'&&b.name===r['Pinterest board']))errors.push({row:i+2,reason:'Board name does not match public board'});
  if(links.has(r.Link))errors.push({row:i+2,reason:'Duplicate Pin link',firstRow:links.get(r.Link)});else links.set(r.Link,i+2);
  if(media.has(r['Media URL']))errors.push({row:i+2,reason:'Duplicate media URL'});media.add(r['Media URL']);
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(r['Publish date'])||!Number.isFinite(Date.parse(r['Publish date']+'Z')))errors.push({row:i+2,reason:'Invalid UTC publish date'});
 }
 return errors;
}
