'use strict';
/* Linewright — top-down plan: drawing (walls, openings, rooms, objects, camera) and pointer editing
   (move with snapping, corner resize, rotate handle, camera drag). Used full-size in Plan view and as an inset in Perspective view. */

const pv=$('pv'),pc=pv.getContext('2d');
let KP=1;   // canvas px per CSS px for the plan canvas
function planXf(){const m=26*KP,b=worldBounds(),W=b.x1-b.x0,D=b.z1-b.z0;
  const s=Math.min((pv.width-2*m)/W,(pv.height-2*m)/D);
  const ox=(pv.width-W*s)/2-b.x0*s,oy=(pv.height-D*s)/2-b.z0*s;
  return{s,to:(x,z)=>[ox+x*s,oy+z*s],from:(px,py)=>[(px-ox)/s,(py-oy)/s]};}
function rotHandle(X){const it=single();if(!it||itemLocked(it))return null;const ms=selBoxes().filter(visible);if(!ms.length)return null;
  const b=bbox(ms),cx=(b.x0+b.x1)/2,top=X.to(cx,b.z0);return{p:[top[0],top[1]-24*KP],top,c:X.to(cx,(b.z0+b.z1)/2)};}

function drawPlan(){
  if(!pv.width)return;const X=planXf(),s=X.s,c=pc,k=KP,b=worldBounds();
  c.fillStyle=C.paper;c.fillRect(0,0,pv.width,pv.height);
  const line=(a,bb,col,lw,dash)=>{c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(bb[0],bb[1]);c.strokeStyle=col;c.lineWidth=lw*k;c.setLineDash((dash||[]).map(v=>v*k));c.stroke();c.setLineDash([]);};
  c.font=`${10*k}px "IBM Plex Mono",monospace`;
  if(S.grid){for(let x=Math.ceil(b.x0/0.5)*0.5;x<=b.x1+1e-9;x+=0.5)line(X.to(x,b.z0),X.to(x,b.z1),C.faint,.6);for(let z=Math.ceil(b.z0/0.5)*0.5;z<=b.z1+1e-9;z+=0.5)line(X.to(b.x0,z),X.to(b.x1,z),C.faint,.6);}
  drawPlanUnder(c,X,k);
  // room names
  for(const r of S.rooms){if(!r.pts||r.pts.length<3)continue;const[cx,cz]=polyInner(r.pts);
    const p=X.to(cx,cz);c.fillStyle=C.faint;c.font=`500 ${12*k}px "IBM Plex Sans Condensed",sans-serif`;const t=r.name||'Room';c.fillText(t,p[0]-c.measureText(t).width/2,p[1]+(S.rooms.length>1?4:40)*k);}
  c.font=`${10*k}px "IBM Plex Mono",monospace`;
  // walls with openings
  for(const w of S.walls){const L=wallLen(w),u=wallU(w),P=t=>X.to(w.a[0]+u[0]*t,w.a[1]+u[1]*t);
    const ops=S.openings.filter(o=>o.wall===w.id).sort((a,bb)=>a.off-bb.off);let t=0;
    for(const o of ops){const t0=clamp(o.off,0,L),t1=clamp(o.off+o.w,0,L);if(t0>t)line(P(t),P(t0),C.ink,2.4);t=Math.max(t,t1);
      if(o.type==='window'){line(P(t0),P(t1),C.ink,5);line(P(t0),P(t1),C.paper,1.6);}
      else{const g=doorGeom(o,w),H=X.to(g.H[0],g.H[1]),tip=X.to(g.H[0]+g.d1[0]*g.r,g.H[1]+g.d1[1]*g.r);
        line(H,tip,C.ink,1.4);
        const a0=Math.atan2(g.d0[1],g.d0[0]),a1=Math.atan2(g.d1[1],g.d1[0]),cr=g.d0[0]*g.d1[1]-g.d0[1]*g.d1[0];
        c.beginPath();c.arc(H[0],H[1],g.r*s,a0,a1,cr<0);c.strokeStyle=C.muted;c.lineWidth=1*k;c.setLineDash([3*k,3*k]);c.stroke();c.setLineDash([]);
        if(o.entrance){const n=wallN(w),m=X.to(w.a[0]+u[0]*(o.off+o.w/2)-n[0]*0.18,w.a[1]+u[1]*(o.off+o.w/2)-n[1]*0.18);c.fillStyle=C.guide;const tx='entrance';c.fillText(tx,m[0]-c.measureText(tx).width/2,m[1]+3*k);}}}
    if(t<L)line(P(t),P(L),C.ink,2.4);}
  for(const m of S.marks){const a=X.to(m.a[0],m.a[1]);line(a,X.to(m.b[0],m.b[1]),C.muted,1.2,[6,4]);c.fillStyle=C.muted;c.fillText(m.label||'',a[0]+3*k,a[1]-3*k);}
  drawGhostPlan(c,X,k);
  // objects
  const selSet=new Set(selBoxes().map(o=>o.id));
  for(const o of S.objects){if(!visible(o))continue;const on=selSet.has(o.id),col=isLocked(o)&&!S.colorTags?C.faint:objColor(o),pts=foot(o).map(q=>X.to(q[0],q[1]));
    c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();
    c.globalAlpha=on?.2:.07;c.fillStyle=col;c.fill();c.globalAlpha=1;c.strokeStyle=col;c.lineWidth=(on?2.2:1.2)*k;c.stroke();}
  for(const kk of sel){if(kk[0]!=='g')continue;const ms=members(kk.slice(2)).filter(visible);if(!ms.length)continue;const bb=bbox(ms),p=X.to(bb.x0,bb.z0);
    c.strokeStyle=C.accent;c.lineWidth=1*k;c.setLineDash([4*k,3*k]);c.strokeRect(p[0]-3*k,p[1]-3*k,(bb.x1-bb.x0)*s+6*k,(bb.z1-bb.z0)*s+6*k);c.setLineDash([]);}
  if(S.labels){const done=new Set();
    for(const o of S.objects){if(!visible(o))continue;let nm=o.n,bb=aabb(o);
      if(o.g){if(done.has(o.g))continue;done.add(o.g);const g=grpById(o.g);nm=g?g.n:'Group';bb=bbox(members(o.g).filter(visible));}
      if((bb.x1-bb.x0)*s>c.measureText(nm).width+4*k&&(bb.z1-bb.z0)*s>13*k){const p=X.to(bb.x0,bb.z0);c.fillStyle=objColor(o);c.fillText(nm,p[0]+3*k,p[1]+11*k);}}}
  // camera
  const cp=X.to(S.cx,S.cz),y=S.yaw*Math.PI/180,hf=S.fov*Math.PI/360;
  for(const a of[y-hf,y+hf])line(cp,X.to(S.cx+Math.sin(a)*1.1,S.cz-Math.cos(a)*1.1),C.guide,1.2,[4,3]);
  line(cp,X.to(S.cx+Math.sin(y)*0.35,S.cz-Math.cos(y)*0.35),C.guide,2);
  c.beginPath();c.arc(cp[0],cp[1],5.5*k,0,7);c.fillStyle=S.lockCam?C.paper:C.guide;c.fill();c.strokeStyle=C.guide;c.lineWidth=1.5*k;c.stroke();
  // handles
  const it=single();
  if(resizable(it)){const ms=selBoxes().filter(visible);if(ms.length){const bb=bbox(ms),r=5*k;
    for(const q of[[bb.x0,bb.z0],[bb.x1,bb.z0],[bb.x1,bb.z1],[bb.x0,bb.z1]]){const p=X.to(q[0],q[1]);c.fillStyle=C.paper;c.fillRect(p[0]-r,p[1]-r,2*r,2*r);c.strokeStyle=C.accent;c.lineWidth=1.6*k;c.strokeRect(p[0]-r,p[1]-r,2*r,2*r);}}}
  const rh=rotHandle(X);
  if(rh){line(rh.top,rh.p,C.accent,1.2);c.beginPath();c.arc(rh.p[0],rh.p[1],6*k,0,7);c.fillStyle=C.paper;c.fill();c.strokeStyle=C.accent;c.lineWidth=1.6*k;c.stroke();}
  drawPlanOver(c,X,k);
  if(drag&&drag.view==='v'&&drag.text&&drag.cur)readout(c,drag.cur[0],drag.cur[1],drag.text,k);
}

function planHit(p,tol){const X=planXf(),s=X.s,it=single();
  const rh=rotHandle(X);if(rh&&dist(p,rh.p)<tol+3*KP)return{t:'rot',c:rh.c};
  if(resizable(it)){const ms=selBoxes().filter(visible);if(ms.length){const b=bbox(ms),cs=[[b.x0,b.z0],[b.x1,b.z0],[b.x1,b.z1],[b.x0,b.z1]];
    for(let i=0;i<4;i++)if(dist(p,X.to(cs[i][0],cs[i][1]))<tol+2*KP)return{t:'corner',i};}}
  if(!S.lockCam&&dist(p,X.to(S.cx,S.cz))<tol+3*KP)return{t:'cam'};
  const w=X.from(p[0],p[1]),pad=3*KP/s;let best=null,ba=Infinity;
  for(const o of S.objects){if(!visible(o))continue;
    if(inFoot(o,w,pad)){const ar=Math.max(o.w,.005)*Math.max(o.d,.005);if(ar<ba){ba=ar;best=o;}}}
  return best?{t:'box',o:best}:{t:'none'};}

function snapshotSel(){const st={};for(const o of selMove())st[o.id]={x:o.x,y:o.y,z:o.z,w:o.w,d:o.d,h:o.h,rot:o.rot};
  const gr={};for(const k of sel)if(k[0]==='g'){const g=grpById(k.slice(2));if(g)gr[g.id]={rot:g.rot,prot:g.preset?g.preset.rot:0};}return{st,gr};}

pv.addEventListener('pointerdown',e=>{
  if(e.button>0)return;const p=cpos(e,pv);if(planToolDown(e,p))return;const tol=(e.pointerType==='touch'?18:8)*KP,h=planHit(p,tol);
  if(psel&&h.t==='box'){psel=null;renderRooms();}
  if(h.t==='rot'){const sn=snapshotSel();drag={view:'v',t:'rot',c:h.c,a0:Math.atan2(p[1]-h.c[1],p[0]-h.c[0]),st:sn.st,gr:sn.gr,start:p,cur:p,moved:false};}
  else if(h.t==='corner')drag={view:'v',t:'corner',i:h.i,start:p,cur:p,bb0:bbox(selBoxes()),moved:false};
  else if(h.t==='cam')drag={view:'v',t:'cam',start:p,cur:p,moved:false};
  else if(h.t==='box'){const k=keyOf(h.o);
    if(e.shiftKey){selClick(h.o,true);if(!sel.includes(k))return;}
    else if(!sel.includes(k)){sel=[k];renderSel();}
    if(selLocked())drag={view:'v',t:'locked',start:p,cur:p,moved:false};
    else{const sn=snapshotSel();drag={view:'v',t:'pmove',start:p,cur:p,bb0:bbox(selBoxes()),st:sn.st,noFace:selBoxes().some(o=>o.rot),moved:false};}}
  else drag={view:'v',t:'empty',start:p,cur:p,shift:e.shiftKey,moved:false};
  try{pv.setPointerCapture(e.pointerId);}catch(_){}
  drawAll();
});
pv.addEventListener('pointermove',e=>{
  const p=cpos(e,pv);if(planToolMove(e,p))return;
  if(!drag||drag.view!=='v'){if(e.pointerType==='mouse'){const h=planHit(p,8*KP);pv.style.cursor=h.t==='corner'?'nwse-resize':h.t==='rot'?'grab':h.t==='none'?'default':'move';}return;}
  drag.cur=p;if(dist(p,drag.start)>3*KP)drag.moved=true;if(!drag.moved)return;
  const X=planXf(),s=X.s,w=X.from(p[0],p[1]),free=e.altKey,tol=10*KP/s;
  if(drag.t==='locked'){flash('This item is locked. Untick Locked in the Objects panel to move it.');drag.t='empty';return;}
  if(drag.t==='pmove'){const b=drag.bb0,dx=(p[0]-drag.start[0])/s,dz=(p[1]-drag.start[1])/s,ex=new Set(selMove().map(o=>o.id));
    const rx=snapMove(b.x0+dx,b.x1-b.x0,'x',ex,tol,free,drag.noFace),rz=snapMove(b.z0+dz,b.z1-b.z0,'z',ex,tol,free,drag.noFace);
    for(const o of selMove()){const s0=drag.st[o.id];if(!s0)continue;o.x=s0.x+rx.v-b.x0;o.z=s0.z+rz.v-b.z0;}
    /* angled walls: push flush against the face of the nearest one */
    let how=[rx.how,rz.how].find(x=>x&&x!=='free')||(free?'free':'');
    if(!free){const fs=wallFaceSnap(selBoxes(),tol);if(fs){for(const o of selMove()){o.x+=fs.dx;o.z+=fs.dz;}how='wall face';}}
    const on=applyOnto(e.shiftKey&&!free);
    drag.text=`x ${fmt(rx.v)}  z ${fmt(rz.v)} m`+(how?' · '+how:'')+on;updateInspector();}
  else if(drag.t==='corner'){const it=single();if(!it)return;const b=drag.bb0,i=drag.i,ex=new Set(selBoxes().map(o=>o.id)),minX=i===0||i===3,minZ=i<2;
    const rx=snapEdge(w[0],'x',ex,tol,free,minX?b.x1:b.x0),rz=snapEdge(w[1],'z',ex,tol,free,minZ?b.z1:b.z0);
    const x0=minX?Math.min(rx.v,b.x1-0.01):b.x0,x1=minX?b.x1:Math.max(rx.v,b.x0+0.01);
    const z0=minZ?Math.min(rz.v,b.z1-0.01):b.z0,z1=minZ?b.z1:Math.max(rz.v,b.z0+0.01);
    setExtent(it,'x',x0,x1-x0);setExtent(it,'z',z0,z1-z0);drag.text=`w ${fmt(x1-x0)}  d ${fmt(z1-z0)} m`;updateInspector();}
  else if(drag.t==='rot'){let deg=(Math.atan2(p[1]-drag.c[1],p[0]-drag.c[0])-drag.a0)*180/Math.PI;deg=normDeg(deg);if(!free)deg=Math.round(deg/15)*15;
    for(const o of selMove()){const s0=drag.st[o.id];if(s0)Object.assign(o,s0);}
    for(const id in drag.gr){const g=grpById(id);if(!g)continue;g.rot=drag.gr[id].rot;if(g.preset)g.preset.rot=drag.gr[id].prot;}
    rotateItems(selBoxes(),deg,false);addGroupRot(sel,deg);drag.text=`rotation ${deg>0?'+':''}${fmtIn(deg)}°`;updateInspector();}
  else if(drag.t==='cam'){if(S.lockCam)return;const cb=camBounds();S.cx=clamp(w[0],cb.x0,cb.x1);S.cz=clamp(w[1],cb.z0,cb.z1);syncCamUI();drag.text=`camera ${fmt(S.cx)}, ${fmt(S.cz)} m`;}
  drawAll();
});
pv.addEventListener('pointerup',e=>endDrag(e,false));
pv.addEventListener('pointercancel',e=>endDrag(e,true));
pv.addEventListener('pointerleave',()=>{if(hover){hover=null;drawAll();}});
pv.addEventListener('dblclick',e=>{if(planDbl(cpos(e,pv)))return;const h=planHit(cpos(e,pv),8*KP);if(h.t==='box'){sel=[keyOf(h.o)];renderSel();startRename();}});
pv.addEventListener('touchstart',e=>{if(e.touches.length!==1)return;const p=cpos(e.touches[0],pv),X=planXf(),h2=elemHit2(p,18*KP,X);
  if(tool!=='select'||planHit(p,18*KP).t!=='none'||elemHit(p,18*KP,X)||(h2&&h2.t!=='room'))e.preventDefault();},{passive:false});
