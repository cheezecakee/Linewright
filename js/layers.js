'use strict';
/* Linewright — image overlay layers: drawing, on-canvas editing, IndexedDB storage, layer panel. */

const imgs=new Map();
function lgeo(L){const W=cv.width,c=[L.x*W,L.y*W],w=L.w*W,h=L.h*W,a=L.rot*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a);
  const tp=(lx,ly)=>[c[0]+lx*ca-ly*sa,c[1]+lx*sa+ly*ca];
  return{c,w,h,tp,corners:[tp(-w/2,-h/2),tp(w/2,-h/2),tp(w/2,h/2),tp(-w/2,h/2)],top:tp(0,-h/2),rh:tp(0,-h/2-28*K),
    toLocal:p=>{const dx=p[0]-c[0],dy=p[1]-c[1];return[dx*ca+dy*sa,-dx*sa+dy*ca];}};}
function drawLayers(over){
  for(const L of S.layers){if(!L.vis||!!L.over!==over)continue;
    const r=imgs.get(L.id),g=lgeo(L);
    if(L.pin){/* corner-pinned: perspective warp (warp.js) */
      if(r&&r.img&&r.img.complete&&r.img.naturalWidth){drawWarped(L,r.img);continue;}
      const q=layerQuad(L);ctx.strokeStyle=C.muted;ctx.lineWidth=1.2*K;ctx.setLineDash([6*K,4*K]);ctx.beginPath();q.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle=C.muted;ctx.font=`${12*K}px "IBM Plex Mono",monospace`;ctx.fillText(r&&r.loading?'Loading image…':'Image not available here',q[0][0]+8*K,q[0][1]+20*K);continue;}
    ctx.save();ctx.translate(g.c[0],g.c[1]);ctx.rotate(L.rot*Math.PI/180);ctx.scale(L.fx?-1:1,L.fy?-1:1);
    if(r&&r.img&&r.img.complete&&r.img.naturalWidth){ctx.globalAlpha=L.op;ctx.drawImage(r.img,-g.w/2,-g.h/2,g.w,g.h);}
    else{ctx.scale(L.fx?-1:1,L.fy?-1:1);ctx.strokeStyle=C.muted;ctx.lineWidth=1.2*K;ctx.setLineDash([6*K,4*K]);ctx.strokeRect(-g.w/2,-g.h/2,g.w,g.h);ctx.setLineDash([]);
      ctx.fillStyle=C.muted;ctx.font=`${12*K}px "IBM Plex Mono",monospace`;ctx.fillText(r&&r.loading?'Loading image…':'Image not available here',-g.w/2+8*K,-g.h/2+20*K);}
    ctx.restore();}}
function drawLayerHandles(){const L=S.layers.find(l=>l.id===activeLayer);if(!L||!L.vis)return;
  if(cmOn===L.id){drawCM(L);return;}
  if(L.pin){const q=layerQuad(L);ctx.strokeStyle=C.accent;ctx.lineWidth=1.5*K;ctx.setLineDash([6*K,4*K]);ctx.beginPath();q.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.stroke();ctx.setLineDash([]);
    for(const p of q){ctx.beginPath();ctx.arc(p[0],p[1],7*K,0,7);ctx.fillStyle=C.paper;ctx.fill();ctx.stroke();ctx.beginPath();ctx.arc(p[0],p[1],2.2*K,0,7);ctx.fillStyle=C.accent;ctx.fill();}return;}
  const g=lgeo(L);
  ctx.strokeStyle=C.accent;ctx.lineWidth=1.5*K;ctx.setLineDash([6*K,4*K]);ctx.beginPath();g.corners.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.stroke();ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(g.top[0],g.top[1]);ctx.lineTo(g.rh[0],g.rh[1]);ctx.stroke();
  const r=6*K;for(const p of g.corners){ctx.fillStyle=C.paper;ctx.fillRect(p[0]-r,p[1]-r,2*r,2*r);ctx.strokeRect(p[0]-r,p[1]-r,2*r,2*r);}
  ctx.beginPath();ctx.arc(g.rh[0],g.rh[1],7*K,0,7);ctx.fillStyle=C.paper;ctx.fill();ctx.stroke();}
function layerHit(p,tol){const A=S.layers.find(l=>l.id===activeLayer);
  if(A&&A.vis&&cmOn===A.id){const h=cmHit(A,p,tol);if(h)return h;}
  if(A&&A.vis&&A.pin){const q=layerQuad(A);for(let i=0;i<4;i++)if(dist(p,q[i])<tol+5*K)return{t:'lpin',L:A,i};}
  else if(A&&A.vis){const g=lgeo(A);if(dist(p,g.rh)<tol+5*K)return{t:'lrot',L:A};for(let i=0;i<4;i++)if(dist(p,g.corners[i])<tol+3*K)return{t:'lscale',L:A,i};}
  for(let i=S.layers.length-1;i>=0;i--){const L=S.layers[i];if(!L.vis)continue;
    if(L.pin){if(pointInPoly(p,layerQuad(L)))return{t:'lmove',L};continue;}
    const g=lgeo(L),q=g.toLocal(p);if(Math.abs(q[0])<=g.w/2&&Math.abs(q[1])<=g.h/2)return{t:'lmove',L};}
  return{t:'none'};}
function layerDrag(p,d,shift){const L=drag.L,L0=drag.L0,W=cv.width;
  if(drag.t==='lcm'){cmDrag(p);return;}
  if(drag.t==='lpin'){const np=L0.pin.map((q,i)=>i===drag.i?[q[0]+d[0]/W,q[1]+d[1]/W]:q.slice());if(quadOK(np.map(q=>[q[0]*W,q[1]*W])))L.pin=np;drag.text='tilt: drag each corner to where it sits in depth';return;}
  if(drag.t==='lmove'){L.x=L0.x+d[0]/W;L.y=L0.y+d[1]/W;if(L0.pin)L.pin=L0.pin.map(q=>[q[0]+d[0]/W,q[1]+d[1]/W]);drag.text=null;}
  else if(drag.t==='lscale'){const g=lgeo(L0),q=g.toLocal(p),w0=L0.w*W,h0=L0.h*W;
    if(L.keep){const sc=Math.max(Math.abs(q[0])/(w0/2),Math.abs(q[1])/(h0/2),24*K/Math.min(w0,h0));L.w=L0.w*sc;L.h=L0.h*sc;}
    else{L.w=Math.max(2*Math.abs(q[0]),20*K)/W;L.h=Math.max(2*Math.abs(q[1]),20*K)/W;}
    drag.text=`width ${Math.round(L.w*100)}% of view`;}
  else{const g=lgeo(L0);let a=Math.atan2(p[1]-g.c[1],p[0]-g.c[0])*180/Math.PI+90;if(shift)a=Math.round(a/15)*15;L.rot=normDeg(a);drag.text=`rotation ${L.rot.toFixed(1)}°`;}
  updateLayerProps();}

/* ---------- IndexedDB image store with in-memory fallback ---------- */
let idb=null,idbOK=false;
function idbOpen(){return Promise.race([new Promise(res=>{try{const r=indexedDB.open('rsg-layers',1);
  r.onupgradeneeded=()=>{try{r.result.createObjectStore('img');}catch(e){}};
  r.onsuccess=()=>{idb=r.result;idbOK=true;res(true);};r.onerror=()=>res(false);r.onblocked=()=>res(false);}catch(e){res(false);}}),
  new Promise(res=>setTimeout(()=>res(false),2500))]);}
function idbReq(mode,fn){return new Promise(res=>{if(!idbOK)return res(null);try{const tx=idb.transaction('img',mode);const rq=fn(tx.objectStore('img'));
  rq.onsuccess=()=>res(rq.result===undefined?null:rq.result);rq.onerror=()=>res(null);}catch(e){res(null);}});}
const idbPut=(id,blob)=>idbReq('readwrite',s=>s.put(blob,id));
const idbGet=id=>idbReq('readonly',s=>s.get(id));
const idbKeys=()=>idbReq('readonly',s=>s.getAllKeys());
const idbDel=id=>idbReq('readwrite',s=>s.delete(id));
function makeImg(id,blob,onload){const rec={loading:true,blob,img:new Image()};imgs.set(id,rec);
  rec.img.onload=()=>{rec.loading=false;onload&&onload(rec.img);drawAll();};
  rec.img.onerror=()=>{rec.loading=false;rec.img=null;onload&&onload(null);drawAll();};
  try{rec.img.src=URL.createObjectURL(blob);}catch(e){rec.loading=false;rec.img=null;}
  return rec;}
function setStoreNote(){$('store-note').textContent=idbOK?'Images are saved in this browser and come back after a reload. They are not included in exports.':'This browser blocks storage here, so images last until you close the page.';}
async function initStore(){
  await idbOpen();setStoreNote();
  for(const L of S.layers){imgs.set(L.id,{loading:true});const b=await idbGet(L.id);if(b)makeImg(L.id,b);else imgs.set(L.id,{loading:false});}
  if(idbOK){const keys=await idbKeys();if(Array.isArray(keys))for(const k of keys)if(!S.layers.some(L=>L.id===k))idbDel(k);}
  drawAll();}
function addFiles(files){
  const list=[...files].filter(f=>f.type&&f.type.startsWith('image/'));if(!list.length)return;
  for(const f of list){const id=uid('L');
    makeImg(id,f,img=>{if(!img){flash(`Couldn't open ${f.name}. Try PNG or JPEG.`);imgs.delete(id);return;}
      const nat=img.naturalHeight/img.naturalWidth;let w=0.6,h=w*nat;if(h>0.65){h=0.65;w=h/nat;}
      const n=S.layers.length;
      S.layers.push({id,name:f.name.replace(/\.[^.]+$/,'')||'Image',x:0.5+n*0.02,y:0.375+n*0.02,w,h,nat,rot:0,op:0.6,vis:true,over:true,keep:true,fx:false,fy:false});
      activeLayer=id;idbPut(id,f);commit();
      if(S.view!=='persp')setView('persp');setPanel('layers');renderLayers();drawAll();});}}

/* ---------- layer panel ---------- */
function renderLayers(){const el=$('llist');
  if(!S.layers.length)el.innerHTML='<p class="note">No images yet. Add a photo of the room to trace or compare against.</p>';
  else{let h='';const n=S.layers.length;
    for(let i=n-1;i>=0;i--){const L=S.layers[i];
      h+=`<div class="orow${L.id===activeLayer?' on':''}${L.vis?'':' off'}"><button type="button" class="ib" data-leye="${L.id}" aria-label="${L.vis?'Hide':'Show'} ${esc(L.name)}">${L.vis?EYE:EYEOFF}</button>
      <button type="button" class="nm" data-lpick="${L.id}">${esc(L.name)}<small>${L.over?'over':'under'} · ${Math.round(L.op*100)}%</small></button>
      <button type="button" class="ib" data-lup="${L.id}" aria-label="Move ${esc(L.name)} up"${i===n-1?' disabled':''}>↑</button>
      <button type="button" class="ib" data-ldn="${L.id}" aria-label="Move ${esc(L.name)} down"${i===0?' disabled':''}>↓</button>
      <button type="button" class="ib" data-ldel="${L.id}" aria-label="Delete ${esc(L.name)}">×</button></div>`;}
    el.innerHTML=h;}
  const find=id=>S.layers.findIndex(L=>L.id===id);
  el.querySelectorAll('[data-leye]').forEach(b=>b.addEventListener('click',()=>{const L=S.layers[find(b.dataset.leye)];L.vis=!L.vis;commit();renderLayers();drawAll();}));
  el.querySelectorAll('[data-lpick]').forEach(b=>b.addEventListener('click',()=>{activeLayer=b.dataset.lpick;renderLayers();drawAll();}));
  el.querySelectorAll('[data-lup]').forEach(b=>b.addEventListener('click',()=>{const i=find(b.dataset.lup);if(i<S.layers.length-1){const[L]=S.layers.splice(i,1);S.layers.splice(i+1,0,L);commit();renderLayers();drawAll();}}));
  el.querySelectorAll('[data-ldn]').forEach(b=>b.addEventListener('click',()=>{const i=find(b.dataset.ldn);if(i>0){const[L]=S.layers.splice(i,1);S.layers.splice(i-1,0,L);commit();renderLayers();drawAll();}}));
  el.querySelectorAll('[data-ldel]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.ldel;S.layers.splice(find(id),1);if(activeLayer===id)activeLayer=null;glForget(id);if(cmOn===id)cmOn=null;commit();renderLayers();drawAll();flash('Image removed. Undo brings it back.');}));
  renderLayerProps();}
function renderLayerProps(){const L=S.layers.find(l=>l.id===activeLayer),f=$('lprops-f');f.hidden=!L;if(!L)return;
  $('lprops').innerHTML=`<label class="fl" for="l-name">Name</label><input id="l-name" class="tx" value="${esc(L.name)}">
   <div class="row"><label for="l-op">Opacity</label><input id="l-op" type="range" min="0.05" max="1" step="0.01" value="${L.op}"><output id="o-lop">${Math.round(L.op*100)}%</output></div>
   <div class="ig"><label for="l-rot"><span>Rotation °</span><input id="l-rot" type="number" step="0.5" value="${L.rot}"${L.pin?' disabled':''}></label>
   <label for="l-w"><span>Width % of view</span><input id="l-w" type="number" step="1" min="1" value="${Math.round(L.w*1000)/10}"${L.pin?' disabled':''}></label>
   <label for="l-pos"><span>Draw</span><select id="l-pos"><option value="over"${L.over?' selected':''}>Over drawing</option><option value="under"${L.over?'':' selected'}>Under drawing</option></select></label></div>
   <label class="inl"><input id="l-keep" type="checkbox"${L.keep?' checked':''}> Keep aspect ratio when resizing</label>
   <div class="chips"><button id="l-fx" type="button" aria-pressed="${!!L.fx}">Mirror ↔</button><button id="l-fy" type="button" aria-pressed="${!!L.fy}">Flip ↕</button>
   <button id="l-reset" type="button"${L.pin?' disabled':''}>Original proportions</button><button id="l-center" type="button">Center in view</button></div>
   <div class="params" style="display:grid;gap:6px"><span class="fl">Tilt in depth</span>
   <div class="chips"><button id="l-pin" type="button" aria-pressed="${!!L.pin}">Corner pin</button><button id="l-flat" type="button"${L.pin?'':' disabled'}>Reset to flat</button></div>
   <p class="note">${L.pin?'Drag each round corner to where that corner of the photo sits in the drawing; the image warps in true perspective. Drag inside to move it.':'Turn on to tilt the image in depth by dragging its four corners, e.g. to lay a photo of a rug on the floor.'}${L.pin&&glSetup()===false?' WebGL is unavailable here, so the warp is approximated.':''}</p></div>
   ${cmPanelHTML(L)}`;
  const cur=()=>S.layers.find(l=>l.id===activeLayer);
  $('l-name').addEventListener('input',e=>{cur().name=e.target.value;});$('l-name').addEventListener('change',()=>{commit();renderLayers();});
  $('l-op').addEventListener('input',e=>{cur().op=+e.target.value;$('o-lop').textContent=Math.round(cur().op*100)+'%';drawAll();});$('l-op').addEventListener('change',()=>{commit();renderLayers();});
  $('l-rot').addEventListener('input',e=>{const v=parseFloat(e.target.value);if(isFinite(v)){cur().rot=v;drawAll();}});$('l-rot').addEventListener('change',commit);
  $('l-w').addEventListener('input',e=>{const v=parseFloat(e.target.value)/100;if(!(v>0))return;const L=cur(),r=L.h/L.w;L.w=v;L.h=v*r;drawAll();});$('l-w').addEventListener('change',commit);
  $('l-pos').addEventListener('change',e=>{cur().over=e.target.value==='over';commit();renderLayers();drawAll();});
  $('l-keep').addEventListener('change',e=>{cur().keep=e.target.checked;commit();});
  $('l-fx').addEventListener('click',()=>{const L=cur();L.fx=!L.fx;commit();renderLayerProps();drawAll();});
  $('l-fy').addEventListener('click',()=>{const L=cur();L.fy=!L.fy;commit();renderLayerProps();drawAll();});
  $('l-reset').addEventListener('click',()=>{const L=cur();if(L.nat){L.h=L.w*L.nat;commit();drawAll();}});
  $('l-center').addEventListener('click',()=>{const L=cur();if(L.pin){const q=L.pin,cx=q.reduce((s,p)=>s+p[0],0)/4,cy=q.reduce((s,p)=>s+p[1],0)/4;L.pin=q.map(p=>[p[0]-cx+0.5,p[1]-cy+0.375]);}L.x=0.5;L.y=0.375;commit();drawAll();});
  $('l-pin').addEventListener('click',()=>{const L=cur();if(L.pin)return;const W=cv.width;L.pin=lgeo(L).corners.map(p=>[p[0]/W,p[1]/W]);commit();renderLayerProps();drawAll();flash('Corner pin on: drag the four corners.');});
  $('l-flat').addEventListener('click',()=>{const L=cur();if(!L.pin)return;L.pin=null;commit();renderLayerProps();drawAll();flash('Back to flat.');});
  bindCM(cur());}
function updateLayerProps(){const L=S.layers.find(l=>l.id===activeLayer);if(!L)return;const r=$('l-rot'),w=$('l-w');
  if(r&&r!==document.activeElement)r.value=L.rot;if(w&&w!==document.activeElement)w.value=Math.round(L.w*1000)/10;}
