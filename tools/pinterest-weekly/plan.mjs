// Manual CSV exports only. This module never calls Pinterest's write APIs.
export const columns=['Title','Media URL','Pinterest board','Thumbnail','Description','Link','Publish date','Keywords'];
export const canonical=url=>{try{const u=new URL(url);return u.hostname==='nestoodle.com'?u.origin+u.pathname.replace(/\/?$/,'/'):'';}catch{return '';}};
const text=s=>String(s||'').replace(/<[^>]*>/g,'').replace(/&#8217;|&rsquo;/g,"'").replace(/&amp;/g,'&').replace(/[\r\n]+/g,' ').trim();
export function boardFor(post,boards){
 const s=(post.slug+' '+post.title).toLowerCase();
 const name=/christmas|hanukkah|diwali|thanksgiving|halloween|gratitude|holiday/.test(s)?'Seasonal & Holiday Activities':/bedtime|routine|chore|calm.down/.test(s)?'Routines & Organization':/printable|worksheet/.test(s)?'Printables for Kids':/learning|letter|fine.motor|preschool/.test(s)?'Learning Activities':'Kids Activities';
 if(!boards.some(b=>b.name===name&&b.privacy==='PUBLIC'))throw new Error(`Missing public board: ${name}`);
 return name;
}
export function eligible(posts,pins,ledger=[]){
 const live=new Map();for(const p of pins){if(!p.is_owner)continue;const u=canonical(p.link);if(u)live.set(u,(live.get(u)||0)+1);}
 return posts.map(p=>{
  const url=canonical(p.link),actual=live.get(url)||0;
  // Exports reserve variants, but are never described as live/published pins.
  const exported=ledger.filter(r=>canonical(r.link)===url).length;
  return {...p,title:text(p.title?.raw||p.title?.rendered||p.title),actual,exported};
 }).filter(p=>p.actual+p.exported<3).sort((a,b)=>b.date.localeCompare(a.date));
}
export function variations(post){
 const keyword=text(post.keyword||post.meta?._yoast_wpseo_focuskw||post.slug.replaceAll('-',' '));
 if(!keyword||keyword.length>74)throw new Error('Keyword too long for a clear Pinterest title');
 const suffixes=['Easy Ideas','Simple Crafts to Try','Creative Play Ideas','Step-by-Step Ideas','Make It Your Own'];
 return suffixes.map((suffix,i)=>({title:`${keyword}: ${suffix}`,headline:keyword,benefit:['Simple ideas to try together','Make room for creative play','Find your next craft idea','Materials and steps inside','Choose a project together'][i],description:`Explore ${keyword.toLowerCase()} with practical ideas from Nestoodle. Visit the full guide for materials, step-by-step directions, and tips to choose an activity for your child.`,keywords:[keyword,'kids activities','creative play'].join(', ')}));
}
export function schedule(groups,start,mediaBase,now=Date.now(),reservations=[]){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start))throw new Error('Invalid start date');
 const days=Array.from({length:7},(_,i)=>({date:new Date(Date.parse(start+'T00:00:00Z')+i*86400000).toISOString().slice(0,10),posts:new Set(),rows:[]}));
 const rows=[];let cursor=0;
 for(const r of reservations){if(!r.publishDate)continue;const date=new Date(Date.parse(r.publishDate+'Z')+19800000).toISOString().slice(0,10),day=days.find(d=>d.date===date);if(day){day.posts.add(r.postId);day.rows.push(r);}}
 for(let round=0;round<5;round++)for(const group of groups){
  const pin=group.pins[round];if(!pin)continue;
  let chosen;
  for(let n=0;n<7;n++){const day=days[(cursor+n)%7];if(day.rows.length<8&&!day.posts.has(group.id)){chosen=day;cursor=(cursor+n+1)%7;break;}}
  if(!chosen){if(round<3)throw new Error('Capacity cannot fit minimum three variations');continue;}
  // 09:00–23:00 IST slots, encoded as the UTC timestamp Pinterest requires.
  const date=new Date(`${chosen.date}T${String(9+2*chosen.rows.length).padStart(2,'0')}:00:00+05:30`);
  if(date.getTime()<=now)throw new Error('Publish date is not in the future');
  const link=new URL(group.link);link.searchParams.set('utm_source','pinterest');link.searchParams.set('utm_medium','social');link.searchParams.set('utm_campaign',`weekly-${start}`);
  const row={'Title':pin.title,'Media URL':`${mediaBase}/${pin.file}`,'Pinterest board':group.board,'Thumbnail':'','Description':pin.description,'Link':link.href,'Publish date':date.toISOString().slice(0,19),'Keywords':pin.keywords,postId:group.id,photoHash:pin.photoHash,localFile:pin.localFile};
  if(row.Title.length>100||row.Description.length>500)throw new Error('Pinterest text limit exceeded');
  chosen.posts.add(group.id);chosen.rows.push(row);rows.push(row);
 }
 if(rows.length>56||rows.length>200)throw new Error('Export capacity exceeded');
 return rows.sort((a,b)=>a['Publish date'].localeCompare(b['Publish date']));
}
export function csv(rows){const cell=v=>'"'+String(v??'').replaceAll('"','""')+'"';return '\ufeff'+[columns,...rows.map(r=>columns.map(c=>r[c]))].map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';}
