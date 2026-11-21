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
  const exported=ledger.filter(r=>activeReservation(r)&&canonical(r.link)===url).length;
  return {...p,title:text(p.title?.raw||p.title?.rendered||p.title),actual,exported};
 }).filter(p=>p.actual+p.exported<3).sort((a,b)=>b.date.localeCompare(a.date));
}
export {pinCopy,benefitLine,titleCase} from './editorial.mjs';
export const activeReservation=r=>!['superseded','cancelled'].includes(r.status);
export const utcSlots=['01:00:00','02:00:00','03:00:00'];
export function holidayRank(g){const text=g.title||g.slug||'';return /advent/i.test(text)?0:/christmas/i.test(text)?1:/hanukkah/i.test(text)?2:/winter.break/i.test(text)?3:/winter/i.test(text)?4:10;}
export function schedule(groups,start,mediaBase,now=Date.now(),reservations=[],options={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start))throw new Error('Invalid start date');
 const horizon=options.days??90;if(!Number.isInteger(horizon)||horizon<1||horizon>90)throw new Error('Invalid planning horizon');
 const days=Array.from({length:horizon},(_,i)=>({date:new Date(Date.parse(start+'T00:00:00Z')+i*86400000).toISOString().slice(0,10),rows:[],times:new Set()}));
 const dates=new Map();const dayNumber=s=>Math.floor(Date.parse(s+'T00:00:00Z')/86400000);
 for(const r of reservations.filter(activeReservation)){
  const time=r.publishDate||r['Publish date'];if(!time)continue;const day=days.find(d=>d.date===time.slice(0,10));
  if(day){day.rows.push(r);day.times.add(time.slice(11,19));}
  const id=String(r.postId);if(!dates.has(id))dates.set(id,[]);dates.get(id).push(dayNumber(time.slice(0,10)));
 }
 const rows=[],links=new Set([...reservations.map(r=>r.link||r.Link),...options.blockedLinks||[]].filter(Boolean)),numbers=new Map();const ordered=[...groups].sort((a,b)=>holidayRank(a)-holidayRank(b));
 const rounds=Math.max(0,...ordered.map(g=>g.pins.length));
 for(let round=0;round<rounds;round++)for(const group of ordered){
  const pin=group.pins[round];if(!pin)continue;const id=String(group.id);
  let choice;
  for(const day of days){
   if(day.rows.length>=3||(dates.get(id)||[]).some(n=>Math.abs(n-dayNumber(day.date))<3))continue;
   const slot=utcSlots.find(t=>!day.times.has(t)&&Date.parse(day.date+'T'+t+'Z')>now);if(slot){choice={day,slot};break;}
  }
  if(!choice)throw new Error('Insufficient three-per-day capacity with three-day article spacing');
  const {day,slot}=choice;const link=new URL(group.link);link.searchParams.set('utm_source',group.tracking?.utm_source||link.searchParams.get('utm_source')||'pinterest');link.searchParams.set('utm_medium',group.tracking?.utm_medium||link.searchParams.get('utm_medium')||'social');link.searchParams.set('utm_campaign',group.tracking?.utm_campaign||link.searchParams.get('utm_campaign')||`weekly-${start}`);
  if(!numbers.has(id)){let max=0;for(const old of links){try{const u=new URL(old);if(canonical(u.href)!==canonical(group.link))continue;const m=u.searchParams.get('utm_content')?.match(new RegExp('^'+id+'-(\\d+)$'));if(m)max=Math.max(max,Number(m[1]));}catch{}}numbers.set(id,max);}
  let number;do{number=numbers.get(id)+1;numbers.set(id,number);link.searchParams.set('utm_content',`${id}-${number}`);}while(links.has(link.href));links.add(link.href);
  const description=pin.description+' '+link.href;
  const row={'Title':pin.title,'Media URL':`${mediaBase}/${pin.file}`,'Pinterest board':group.board,'Thumbnail':'','Description':description,'Link':link.href,'Publish date':day.date+'T'+slot,'Keywords':pin.keywords,postId:group.id,pinNumber:number,photoHash:pin.photoHash,localFile:pin.localFile};
  if(row.Title.length>100||row.Description.length>500)throw new Error('Pinterest text limit exceeded');
  day.rows.push(row);day.times.add(slot);if(!dates.has(id))dates.set(id,[]);dates.get(id).push(dayNumber(day.date));rows.push(row);
 }
 if(rows.length>200)throw new Error('Pinterest200-row limit exceeded');
 return rows.sort((a,b)=>a['Publish date'].localeCompare(b['Publish date']));
}
export function csv(rows){const cell=v=>'"'+String(v??'').replaceAll('"','""')+'"';return '\ufeff'+[columns,...rows.map(r=>columns.map(c=>r[c]))].map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';}
