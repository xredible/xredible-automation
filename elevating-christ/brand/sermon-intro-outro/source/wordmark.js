// Elevating CHRIST 3D metal wordmark (SVG lighting): "Elevating" platinum, "CHRIST" gold.
// makeWordmark(el, fontSize) builds it inside el; returns {setShine(p)} where p in 0..1 sweeps a light band, p<0 hides.
(function(){
let uid=0;
const NS='http://www.w3.org/2000/svg';
function mk(tag,attrs,parent){const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e;}
window.makeWordmark=function(el,fs){
 const id='wm'+(uid++);el.innerHTML='';
 const depth=Math.max(3,Math.round(fs*0.055));      // extrusion depth (crisp, no blur)
 const svg=mk('svg',{xmlns:NS},el);svg.style.overflow='visible';svg.style.display='inline-block';
 const defs=mk('defs',{},svg);
 // metal face gradients
 const plat=mk('linearGradient',{id:id+'p',x1:0,y1:0,x2:0,y2:1},defs);
 [['0','#f7f8fa'],['.22','#dfe2e6'],['.44','#a9adb4'],['.5','#6f737a'],['.56','#9ea3aa'],['.78','#e3e5e8'],['1','#b9bdc3']].forEach(([o,c])=>mk('stop',{offset:o,'stop-color':c},plat));
 const gold=mk('linearGradient',{id:id+'g',x1:0,y1:0,x2:0,y2:1},defs);
 [['0','#fff7cf'],['.2','#f6dc86'],['.42','#d9b245'],['.5','#9a7418'],['.57','#c99c2c'],['.78','#f4d77a'],['1','#d6ac3f']].forEach(([o,c])=>mk('stop',{offset:o,'stop-color':c},gold));
 // extrusion side colours
 const sideP=mk('linearGradient',{id:id+'sp',x1:0,y1:0,x2:0,y2:1},defs);
 [['0','#7c8087'],['1','#3f4247']].forEach(([o,c])=>mk('stop',{offset:o,'stop-color':c},sideP));
 const sideG=mk('linearGradient',{id:id+'sg',x1:0,y1:0,x2:0,y2:1},defs);
 [['0','#9c7718'],['1','#5a420b']].forEach(([o,c])=>mk('stop',{offset:o,'stop-color':c},sideG));
 // bevel lighting: highlight from top-left, shade from bottom-right
 const f=mk('filter',{id:id+'b',x:'-5%',y:'-20%',width:'110%',height:'140%','color-interpolation-filters':'sRGB'},defs);
 mk('feGaussianBlur',{in:'SourceAlpha',stdDeviation:(fs*0.022).toFixed(2),result:'blur'},f);
 const s1=mk('feSpecularLighting',{in:'blur',surfaceScale:(fs*0.05).toFixed(2),specularConstant:'1.15',specularExponent:'18','lighting-color':'#ffffff',result:'hi'},f);
 mk('feDistantLight',{azimuth:'235',elevation:'42'},s1);
 mk('feComposite',{in:'hi',in2:'SourceAlpha',operator:'in',result:'hiIn'},f);
 const s2=mk('feSpecularLighting',{in:'blur',surfaceScale:(fs*0.05).toFixed(2),specularConstant:'0.9',specularExponent:'14','lighting-color':'#ffffff',result:'lo'},f);
 mk('feDistantLight',{azimuth:'55',elevation:'40'},s2);
 mk('feComposite',{in:'lo',in2:'SourceAlpha',operator:'in',result:'loIn'},f);
 mk('feComposite',{in:'SourceGraphic',in2:'hiIn',operator:'arithmetic',k1:0,k2:1,k3:0.75,k4:0,result:'lit'},f);
 mk('feComposite',{in:'lit',in2:'loIn',operator:'arithmetic',k1:0,k2:1,k3:-0.38,k4:0,result:'shaded'},f);
 mk('feComposite',{in:'shaded',in2:'SourceAlpha',operator:'in'},f);
 // moving shine band
 const sh=mk('linearGradient',{id:id+'s',gradientUnits:'userSpaceOnUse',x1:0,y1:0,x2:fs*2.2,y2:fs*0.7},defs);
 [['0','#ffffff','0'],['.36','#fffbe8','0'],['.46','#fffbe8','.55'],['.5','#ffffff','1'],['.54','#fffbe8','.55'],['.64','#fffbe8','0'],['1','#ffffff','0']].forEach(([o,c,a])=>mk('stop',{offset:o,'stop-color':c,'stop-opacity':a},sh));
 const font={'font-family':'Raleway','font-size':fs,'dominant-baseline':'alphabetic'};
 const base=fs*1.0, gap=fs*0.26;
 // measure
 const tA=mk('text',{...font,'font-weight':500,x:0,y:base},svg);tA.textContent='Elevating';
 const tB=mk('text',{...font,'font-weight':700,x:0,y:base},svg);tB.textContent='CHRIST';
 const wA=tA.getComputedTextLength(), wB=tB.getComputedTextLength(); tA.remove(); tB.remove();
 const pad=fs*0.06, xA=pad, xB=pad+wA+gap, W=xB+wB+pad, H=fs*1.32+depth;
 svg.setAttribute('width',W);svg.setAttribute('height',H);svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
 const parts=[['Elevating',500,xA,'sp','p'],['CHRIST',700,xB,'sg','g']];
 const shineEls=[];
 for(const [txt,wt,x,side,face] of parts){
  const g=mk('g',{},svg);
  for(let d=depth;d>=1;d--){const e=mk('text',{...font,'font-weight':wt,x:x,y:base+d,fill:`url(#${id+side})`},g);e.textContent=txt;}
  const faceEl=mk('text',{...font,'font-weight':wt,x:x,y:base,fill:`url(#${id+face})`,filter:`url(#${id}b)`},g);faceEl.textContent=txt;
  const rim=mk('text',{...font,'font-weight':wt,x:x,y:base,fill:'none',stroke:face==='p'?'rgba(255,255,255,.55)':'rgba(255,240,190,.6)','stroke-width':Math.max(0.6,fs*0.006)},g);rim.textContent=txt;
  const s=mk('text',{...font,'font-weight':wt,x:x,y:base,fill:`url(#${id}s)`},g);s.textContent=txt;s.style.mixBlendMode='screen';shineEls.push(s);
 }
 return {width:W,height:H,setShine(p){
   if(p<0||p>1){shineEls.forEach(s=>s.style.opacity=0);return;}
   shineEls.forEach(s=>s.style.opacity=1);
   const x=-fs*2.2+(W+fs*2.2)*p; sh.setAttribute('gradientTransform',`translate(${x},0)`);
 }};
};
})();
