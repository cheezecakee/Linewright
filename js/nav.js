'use strict';
/* Linewright — mouse and wheel navigation, framing and saved viewpoints.
   Plan: right- or middle-drag pans; the wheel scrolls up and down (Shift: sideways); Ctrl + wheel zooms at the cursor.
   Perspective: the wheel zooms the lens, Shift + wheel walks; right-drag looks around (Alt: orbit the selection or room);
   middle-drag slides the camera; W A S D Q E fly while the right button is held (Shift: faster). */

/* wheel mapping for the plan: natural (default: wheel up and down, Shift sideways) or sideways, kept per browser */
let wheelSideways=false;
try{wheelSideways=localStorage.getItem('rsg-wheel')==='sideways';}catch(e){}
function setWheelPref(sideways){wheelSideways=sideways;try{localStorage.setItem('rsg-wheel',sideways?'sideways':'natural');}catch(e){}}
/* right-drag pan: by default the view follows the cursor (the drawing moves the other way); "grab" drags the drawing itself */
let panGrab=false;
try{panGrab=localStorage.getItem('rsg-pan')==='grab';}catch(e){}
function setPanPref(grab){panGrab=grab;try{localStorage.setItem('rsg-pan',grab?'grab':'view');}catch(e){}}
const wheelPx=e=>e.deltaMode===1?16:e.deltaMode===2?400:1;

/* ---------- plan ---------- */
pv.addEventListener('contextmenu',e=>e.preventDefault());
pv.addEventListener('wheel',e=>{if(S.view!=='plan')return;e.preventDefault();
  const m=wheelPx(e),dx=e.deltaX*m,dy=e.deltaY*m,X0=planXf();
  if(e.ctrlKey||e.metaKey){const p=cpos(e,pv),w0=X0.from(p[0],p[1]);PV.z*=Math.exp(-(dy||dx)*0.0016);clampPV();
    const X1=planXf(),q=X1.to(w0[0],w0[1]);PV.x+=(q[0]-p[0])/X1.s;PV.y+=(q[1]-p[1])/X1.s;clampPV();flash(`Plan zoom ${Math.round(PV.z*100)}%. Home fits the room.`);}
  else{let hx,vy;
    if(wheelSideways){if(e.shiftKey){hx=0;vy=dy+dx;}else{hx=dx+dy;vy=0;}}
    else{if(e.shiftKey){hx=dx+dy;vy=0;}else{hx=dx;vy=dy;}}
    PV.x+=hx*KP/X0.s;PV.y+=vy*KP/X0.s;clampPV();}
  drawAll();},{passive:false});
let panDrag=null;
pv.addEventListener('pointerdown',e=>{if(S.view!=='plan'||(e.button!==2&&e.button!==1))return;e.preventDefault();
  panDrag={id:e.pointerId,x:e.clientX,y:e.clientY,px:PV.x,py:PV.y};try{pv.setPointerCapture(e.pointerId);}catch(_){}pv.style.cursor='grabbing';});
pv.addEventListener('pointermove',e=>{if(!panDrag||e.pointerId!==panDrag.id)return;const s=planXf().s;
  const g=panGrab?-1:1;PV.x=panDrag.px+g*(e.clientX-panDrag.x)*KP/s;PV.y=panDrag.py+g*(e.clientY-panDrag.y)*KP/s;clampPV();drawAll();});
const endPan=e=>{if(panDrag&&e.pointerId===panDrag.id){panDrag=null;pv.style.cursor='default';}};
pv.addEventListener('pointerup',endPan);pv.addEventListener('pointercancel',endPan);

/* ---------- perspective ---------- */
let look=null,fly={},flyRaf=0,flyT=0;
const camLockedMsg=()=>flash('Camera is locked. Press L or untick Lock camera to move it.');
function camChanged(){clampCam();syncCamUI();drawAll();}
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('wheel',e=>{if(S.view!=='persp')return;e.preventDefault();
  if(S.lockCam){camLockedMsg();return;}
  const dy=(e.deltaY||e.deltaX)*wheelPx(e);
  if(e.shiftKey){const y=S.yaw*Math.PI/180,d=-dy*0.004;S.cx+=Math.sin(y)*d;S.cz+=-Math.cos(y)*d;}   /* walk */
  else S.fov+=dy*0.03;                                                                                 /* zoom the lens: wheel up narrows it */
  camChanged();clearTimeout(camT);camT=setTimeout(commit,400);},{passive:false});
/* orbit centre: the selection, or the middle of the room at about waist height */
function orbitTarget(){const l=selBoxes().filter(visible);if(l.length){const b=bbox(l);return[(b.x0+b.x1)/2,(b.y0+b.y1)/2,(b.z0+b.z1)/2];}
  const w=worldBounds();return[(w.x0+w.x1)/2,Math.min(1,S.ceil/2),(w.z0+w.z1)/2];}
function aimAt(T){const f=[T[0]-S.cx,T[1]-S.eye,T[2]-S.cz],l=Math.hypot(...f)||1;S.yaw=Math.atan2(f[0],-f[2])*180/Math.PI;S.pitch=clamp(Math.asin(clamp(f[1]/l,-1,1))*180/Math.PI,-80,80);}
cv.addEventListener('pointerdown',e=>{if(S.view!=='persp'||(e.button!==2&&e.button!==1))return;e.preventDefault();
  if(S.lockCam){camLockedMsg();return;}
  const mode=e.button===1?'pan':e.altKey?'orbit':'look';
  look={id:e.pointerId,mode,x:e.clientX,y:e.clientY,s0:{cx:S.cx,cz:S.cz,eye:S.eye,yaw:S.yaw,pitch:S.pitch||0},moved:false,T:mode==='orbit'?orbitTarget():null};
  try{cv.setPointerCapture(e.pointerId);}catch(_){}cv.style.cursor=mode==='pan'?'move':'grabbing';});
cv.addEventListener('pointermove',e=>{if(!look||e.pointerId!==look.id)return;
  const r=cv.getBoundingClientRect(),dx=e.clientX-look.x,dy=e.clientY-look.y,s0=look.s0;look.moved=true;
  if(look.mode==='look'){const k=S.fov/r.width;S.yaw=s0.yaw+dx*k;S.pitch=s0.pitch-dy*k;}
  else if(look.mode==='pan'){const k=2.5/r.width,y=s0.yaw*Math.PI/180;S.cx=s0.cx-Math.cos(y)*dx*k;S.cz=s0.cz-Math.sin(y)*dx*k;S.eye=s0.eye+dy*k;}
  else{const T=look.T,v=[s0.cx-T[0],s0.eye-T[1],s0.cz-T[2]],R=Math.max(Math.hypot(...v),0.6),az=Math.atan2(v[0],v[2])-dx*0.006,
      el=clamp(Math.asin(clamp(v[1]/R,-1,1))+dy*0.006,-0.3,1.3);
    S.cx=T[0]+R*Math.cos(el)*Math.sin(az);S.cz=T[2]+R*Math.cos(el)*Math.cos(az);S.eye=T[1]+R*Math.sin(el);clampCam();aimAt(T);}
  camChanged();});
const endLook=e=>{if(!look||e.pointerId!==look.id)return;const moved=look.moved;look=null;fly={};cv.style.cursor='default';if(moved)commit();};
cv.addEventListener('pointerup',endLook);cv.addEventListener('pointercancel',endLook);

/* fly: with the right button held, W/S forward and back, A/D sideways, E/Q up and down (called from the keydown handler) */
const FLY_KEYS={KeyW:'w',KeyA:'a',KeyS:'s',KeyD:'d',KeyQ:'q',KeyE:'e'};
function flyKey(e,down){const k=FLY_KEYS[e.code];if(!k||!look||look.mode!=='look')return false;e.preventDefault();e.stopPropagation();
  if(down){fly[k]=true;fly.fast=e.shiftKey;if(!flyRaf)flyRaf=requestAnimationFrame(flyStep);}else delete fly[k];return true;}
function flyStep(ts){flyRaf=0;if(!look||look.mode!=='look')return;
  if(!'wasdqe'.split('').some(k=>fly[k])){flyT=0;return;}
  const dt=flyT?Math.min((ts-flyT)/1000,0.1):0.016,v=(fly.fast?3:1.5)*dt,y=S.yaw*Math.PI/180;flyT=ts;
  const f=(fly.w?v:0)-(fly.s?v:0),r=(fly.d?v:0)-(fly.a?v:0),u=(fly.e?v:0)-(fly.q?v:0);
  S.cx+=Math.sin(y)*f+Math.cos(y)*r;S.cz+=-Math.cos(y)*f+Math.sin(y)*r;S.eye+=u;look.moved=true;camChanged();flyRaf=requestAnimationFrame(flyStep);}
window.addEventListener('keyup',e=>{flyKey(e,false);},true);

/* ---------- framing ---------- */
/* Selection: face it and back off until all of it sits inside the picture, staying inside the room when that works, else
   stepping outside (the walls in the way turn faint). Room: stand at the near end looking at the far end and pick the
   narrowest lens that shows everything in front of the camera, so the room fills the picture. The eye height stays.
   In the plan, this fits the room instead. */
function frameView(){if(S.view==='plan'){planFit();return;}
  if(S.lockCam){camLockedMsg();return;}
  const list=selBoxes().filter(visible),w=worldBounds(),room=!list.length,b=room?{x0:w.x0,x1:w.x1,z0:w.z0,z1:w.z1,y0:0,y1:S.ceil}:bbox(list);
  const cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2,cz=(b.z0+b.z1)/2,W=cv.width||1200,H=cv.height||900,fov0=S.fov,cb=camBounds(),pts=[];
  const ib={x0:Math.min(w.x0+0.15,(w.x0+w.x1)/2),x1:Math.max(w.x1-0.15,(w.x0+w.x1)/2),z0:Math.min(w.z0+0.15,(w.z0+w.z1)/2),z1:Math.max(w.z1-0.15,(w.z0+w.z1)/2)};
  for(const x of[b.x0,b.x1])for(const y of[b.y0,b.y1])for(const z of[b.z0,b.z1])pts.push([x,y,z]);
  let hx=cx-S.cx,hz=cz-S.cz;if(Math.hypot(hx,hz)<0.05){hx=Math.sin(S.yaw*Math.PI/180);hz=-Math.cos(S.yaw*Math.PI/180);}
  const hl=Math.hypot(hx,hz);hx/=hl;hz/=hl;
  const fits=()=>{setupCam(W,H);return pts.every(P=>{const c=toCam(P);if(c[2]<NEAR)return room;const p=proj(c);return p[0]>W*0.05&&p[0]<W*0.95&&p[1]>H*0.05&&p[1]<H*0.95;});};
  const aim=D=>{S.cx=clamp(cx-hx*D,cb.x0,cb.x1);S.cz=clamp(cz-hz*D,cb.z0,cb.z1);
    const dx=cx-S.cx,dz=cz-S.cz;S.yaw=Math.atan2(dx,-dz)*180/Math.PI;S.pitch=clamp(Math.atan2(cy-S.eye,Math.hypot(dx,dz)||1e-6)*180/Math.PI,-80,80);};
  let ok=false;
  if(room){let D=0;for(let d=0.2;d<=30;d+=0.1){const x=cx-hx*d,z=cz-hz*d;if(x<ib.x0||x>ib.x1||z<ib.z0||z>ib.z1)break;D=d;}
    aim(D);for(let f=45;f<=100&&!ok;f+=5){S.fov=f;ok=fits();}if(!ok)S.fov=100;ok=true;}
  else{for(const lim of[ib,cb]){for(const f of[fov0,...[70,80,90,100].filter(v=>v>fov0)]){S.fov=f;
      for(let D=0.4;D<=30&&!ok;D+=0.15){const x=cx-hx*D,z=cz-hz*D;if(lim===ib&&(x<ib.x0||x>ib.x1||z<ib.z0||z>ib.z1))break;aim(D);ok=fits();}
      if(ok)break;}
    if(ok)break;}
    if(!ok){S.fov=100;aim(30);}}
  camChanged();commit();
  flash(ok?`Framed ${room?'the room':'the selection'}${S.fov!==fov0?` (lens ${Math.round(S.fov)}°)`:''}.`:'Framed as much as the room allows. Walk back or widen the lens to see more.');}

/* ---------- saved viewpoints ---------- */
function saveView(){S.views.push(normView({name:'View '+(S.views.length+1),cx:S.cx,cz:S.cz,eye:S.eye,yaw:S.yaw,pitch:S.pitch,fov:S.fov}));commit();renderViews();flash('Viewpoint saved. Rename it in the list.');}
function gotoView(id){const v=S.views.find(x=>x.id===id);if(!v)return;if(S.lockCam){camLockedMsg();return;}
  Object.assign(S,{cx:v.cx,cz:v.cz,eye:v.eye,yaw:v.yaw,pitch:v.pitch,fov:v.fov});camChanged();commit();}
function delView(id){S.views=S.views.filter(v=>v.id!==id);commit();renderViews();}
