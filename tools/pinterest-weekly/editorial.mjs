export const clean=s=>String(s??'').replace(/<[^>]*>/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):+n)).replace(/&(?:amp|nbsp|rsquo|lsquo|rdquo|ldquo|quot|ndash|mdash);/g,m=>({'&amp;':'&','&nbsp;':' ','&rsquo;':"'",'&lsquo;':"'",'&rdquo;':'"','&ldquo;':'"','&quot;':'"','&ndash;':'–','&mdash;':'—'}[m])).replace(/\s+/g,' ').trim();
const minor=new Set('a an and as at but by for from in nor of on or per the to via with'.split(' '));
export function titleCase(value,max=100){
 const words=clean(value).split(' ');let result=words.map((word,i)=>word.split('-').map((part,j)=>{const lower=part.toLowerCase();if(/^(?:DIY|US|PDF|ADHD)$/.test(part))return part;if(i>0&&i<words.length-1&&j===0&&minor.has(lower))return lower;return lower.replace(/[a-z]/,c=>c.toUpperCase());}).join('-')).join(' ');
 if(result.length>max)result=result.slice(0,max-1).replace(/\s+\S*$/,'').replace(/[,:;\s]+$/,'')+'…';
 return result;
}
const sentences=s=>[...new Intl.Segmenter('en',{granularity:'sentence'}).segment(clean(s))].map(v=>v.segment.trim()).filter(Boolean);
const norm=s=>clean(s).toLowerCase().replace(/^\d+[.)]\s*/,'').replace(/[^a-z0-9]/g,'');
export function headings(post){return [...String(post.html||'').matchAll(/<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map(m=>({level:+m[1],title:clean(m[2]),start:m.index,end:m.index+m[0].length}));}
export function benefitLine(post){
 const lead=clean(String(post.html||'').match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1]);
 if(!lead)throw new Error('Article benefit line is missing');
 if(post.benefitLine){if(!lead.toLowerCase().includes(clean(post.benefitLine).replace(/[.!?]$/,'').toLowerCase()))throw new Error('Benefit is not from article lead');return clean(post.benefitLine);}
 const choices=sentences(lead);const sentence=choices.find(s=>!s.endsWith('?')&&s.length<=145&&s.split(' ').length>=6)||choices.find(s=>s.length<=145);if(sentence)return sentence;
 const clause=lead.match(/\b(?:use|turn|help|make|build|bring|keep)\s+[\s\S]+?(?=\s+to\s+(?:make|build|bring|help|keep|teach)|[.!?]|$)/i)?.[0];if(clause&&clause.length<=145)return clause[0].toUpperCase()+clause.slice(1)+'.';
 const longer=choices.find(s=>s.length<=180);if(longer)return longer;
 throw new Error('Article benefit line needs a shorter sourced excerpt');
}
export const photoPolicy={
 935:{exclude:[1979,1982],prefer:[1981,1980,1983],activities:{}},
 751:{exclude:[2110,2111,2112],prefer:[2114,2113,2115],activities:{2114:'Sock Toss Challenge',2113:'Follow-the-Line Challenge',2115:'Animal Walk Challenge'}}
};
export function editorialPhotos(post,photos){
 const policy=photoPolicy[post.id]||{exclude:[],prefer:[]};
 return photos.filter(p=>!policy.exclude.includes(p.mediaId)).map(p=>({...p,activityTitle:policy.activities?.[p.mediaId]||p.activityTitle})).sort((a,b)=>{const rank=p=>{const i=policy.prefer.indexOf(p.mediaId);return i<0?100:i;};return rank(a)-rank(b)||Number(!/^\d+[.)]\s/.test(a.activityTitle||''))-Number(!/^\d+[.)]\s/.test(b.activityTitle||''));});
}
export function activityFor(post,photo){
 const hs=headings(post);let at=hs.findIndex(h=>norm(h.title)===norm(photo.activityTitle));
 if(at<0)throw new Error('Photo activity does not match an article section');
 const h=hs[at];const next=hs.slice(at+1).find(n=>n.level<=h.level);const html=post.html.slice(h.end,next?.start??post.html.length);
 return {title:h.title.replace(/^\d+[.)]\s*/,''),html};
}
export function pinCopy(post,photo){
 const rawTitle=clean(post.title?.raw||post.title?.rendered||post.title);const title=titleCase(rawTitle);
 const keyword=clean(post.keyword||post.meta?._yoast_wpseo_focuskw||'');if(!keyword)throw new Error('Missing article keyword');
 const activity=activityFor(post,photo),name=activity.title.replace(/^The\s+/,'');
 const naturalKeyword=keyword.toLowerCase().replace(/\b(christmas|hanukkah|advent|diwali|thanksgiving|easter)\b/g,w=>w[0].toUpperCase()+w.slice(1));
 const naturalName=name.split(/[:(]/)[0].trim().toLowerCase().replace(/\b(christmas|hanukkah|advent|diwali|thanksgiving|easter|diy)\b/g,w=>w==='diy'?'DIY':w[0].toUpperCase()+w.slice(1));
 const article=/^the\s/i.test(activity.title)||/^\d/.test(name)?'the ':/\b(?:art|coloring|sorting|breathing|storytelling|roleplay|rocks|jars|stones|bags|cards|puppets|lights|ornaments)\b/i.test(name)&&! /\b(?:game|challenge|station|session)\b/i.test(name)?'':/^[aeiou]/i.test(name)?'an ':'a ';
 const phrase=article+naturalName;
 let first;
 if(/^(?:teach|help|keep|make|build)\b/i.test(keyword))first=`Use ${phrase} to ${naturalKeyword}.`;
 else if(/^how to\b/i.test(keyword))first=`Try ${phrase} as you learn ${naturalKeyword}.`;
 else if(/course/i.test(keyword))first=`Add ${phrase} to an ${naturalKeyword}.`;
 else if(/routine/i.test(keyword))first=`Make ${phrase} part of a ${naturalKeyword}.`;
 else if(/story/i.test(keyword))first=`Explore the ${naturalKeyword} with ${phrase}.`;
 else first=`Try ${phrase} from these ${naturalKeyword}.`;
 const blocks=[...activity.html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi),...activity.html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>clean(m[1]));
 const usable=s=>s.length>=25&&s.length<=140&&!s.toLowerCase().includes(keyword.toLowerCase())&&!/^(?:materials|supplies|ages?|time|tip|what you need|best for)\s*:/i.test(s)&&!/^\d+\s+(?:things?|sounds?|objects?)\b/i.test(s);
 const candidates=blocks.map(s=>s.replace(/^(?:steps?|how to (?:do it|play)):\s*/i,'')).flatMap(sentences).filter(usable);
 const action=/^(?:ask|add|cut|fill|place|put|set|roll|draw|paint|fold|tape|let|invite|show|have|choose|make|press|turn|take|trace|tear|sort|glue|use|hide|try|give|read|wrap|lay|attach|hold|write|gather|start|follow|toss|blow|sit|pretend|help|tell|name|notice|point|touch|listen|look|breathe|count|stack|find|keep|leave|cover|squeeze|stretch|push|bring|move)\b/i;
 const paragraphSentences=[...activity.html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>clean(m[1])).flatMap(sentences).filter(usable);
 const second=candidates.find(s=>action.test(s))||paragraphSentences.find(s=>/^(?:This|These|It)\b/.test(s))||paragraphSentences[0];
 if(!second)throw new Error('Activity needs a grounded second sentence');
 const description=first+' '+second.replace(/[.!?]+$/,'')+'.';
 if(sentences(description).length!==2||description.toLowerCase().split(keyword.toLowerCase()).length-1!==1)throw new Error('Description must have two sentences and keyword once');
 const terms=[keyword,name,...headings(post).filter(h=>/^\d+[.)]\s/.test(h.title)).map(h=>h.title.replace(/^\d+[.)]\s*/,''))];
 const keys=[];const seen=new Set();for(const term of terms){if(!seen.has(norm(term))){seen.add(norm(term));keys.push(term);}if(keys.length===4)break;}
 if(keys.length<3)throw new Error('Need at least three article-specific keywords');
 return {title,headline:title,benefit:benefitLine(post),description,keywords:keys.map(k=>k.replace(/,/g,' ')).join(', '),activity:name,keyword};
}
