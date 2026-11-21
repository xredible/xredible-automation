// Isolate each decode rejection: a bad pin must never abort every article's export.
export async function decodePreviewImages(page){
 return page.evaluate(async()=>{
  const images=[...document.images];
  const results=await Promise.allSettled(images.map(image=>image.decode()));
  return results.flatMap((result,i)=>{
   if(result.status==='fulfilled')return [];
   if(result.reason?.name!=='EncodingError')throw result.reason;
   return [{file:images[i].dataset.file,reason:'Preview image cannot be decoded'}];
  });
 });
}
export function excludeUndecodable(groups,failures,skippedImages,skipped){
 const failed=new Set(failures.map(f=>f.file));
 if(!failed.size||failures.some(f=>!f.file))throw new Error('Decode failure has no pin identity');
 let removed=0;
 const kept=groups.flatMap(group=>{
  const pins=group.pins.filter(pin=>{
   if(!failed.has(pin.file))return true;
   skippedImages.push({id:group.id,image:pin.sourceImage,file:pin.file,reason:'Preview image cannot be decoded'});removed++;return false;
  });
  if(pins.length<3){skipped.push({id:group.id,reason:`Only ${pins.length} decodable pins; need at least 3`});return [];}
  return [{...group,pins}];
 });
 if(!removed)throw new Error('Decode failure does not match an export pin');
 return kept;
}
