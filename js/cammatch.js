'use strict';
/* Linewright — camera matching from a photo layer.
   The user traces two pairs of floor lines on the photo: pair A follows one floor direction, pair B the perpendicular one
   (e.g. the bases of two opposite walls, and of the back wall and a rug edge). Each traced line can be linked to a wall or a
   reference line it lies on. The traces are stored in the layer's own rectangle (s, t in 0..1, before any corner pin) so they
   stay on the photo when it moves.

   Solve (pinhole camera, principal point at the photo centre, square pixels):
   - each pair meets at a vanishing point v1, v2; perpendicular floor directions give the focal length f² = −(v1−c)·(v2−c)
   - the camera rays to v1, v2 are the two floor directions; their cross product is the floor normal (world up)
   - the world directions come from the linked walls/lines (else pair A = room x axis); the sign that is left over is the one
     that puts the camera inside the room
   - traced lines meet the floor at distances proportional to the eye height; linked lines give linear equations for the
     camera's plan position and the eye height (least squares, gently held at the current values where nothing pins them).
   The app's camera is level (yaw only), so the photo is placed full width with its horizon on the canvas centre line; any
   pitch or roll in the photo is reported because verticals won't line up exactly. */

let cmOn=null;   // layer id whose traces are being edited
const CM_DEF=[[[0.15,0.92],[0.5,0.7]],[[0.4,0.98],[0.82,0.74]],[[0.85,0.93],[0.55,0.7]],[[0.6,0.99],[0.2,0.75]]];
const cmName=i=>(i<2?'A':'B')+(i%2+1);
function cmCol(i){return i<2?C.gx:C.gz;}
function cmEnsure(L){if(!L.cm)L.cm={lines:CM_DEF.map(l=>l.map(p=>p.slice())),on:['','','',''],res:null};return L.cm;}
function cmElem(v){if(!v)return null;const id=v.slice(2);if(v[0]==='w'){const w=wallById(id);return w?{a:w.a,b:w.b,name:wallName(w)}:null;}
  const m=S.marks.find(x=>x.id===id);return m?{a:m.a,b:m.b,name:m.label||'reference line'}:null;}

/* ---------- drawing and editing on the canvas ---------- */
function cmScreen(L){const map=layerMap(L);return{map,lines:L.cm.lines.map(l=>l.map(p=>map.fwd(p[0],p[1])))};}
function lineX(a,b,c,d){const den=(a[0]-b[0])*(c[1]-d[1])-(a[1]-b[1])*(c[0]-d[0]);if(Math.abs(den)<1e-9)return null;
  const t=((a[0]-c[0])*(c[1]-d[1])-(a[1]-c[1])*(c[0]-d[0]))/den;return[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];}
function drawCM(L){cmEnsure(L);const{map,lines}=cmScreen(L),u=K;
  ctx.strokeStyle=C.muted;ctx.lineWidth=1*u;ctx.setLineDash([5*u,4*u]);ctx.beginPath();map.q.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.stroke();
  for(const pr of[0,2]){const A=lines[pr],B=lines[pr+1],vp=lineX(A[0],A[1],B[0],B[1]),col=cmCol(pr);
    if(vp&&Math.abs(vp[0])<cv.width*6&&Math.abs(vp[1])<cv.height*6){ctx.strokeStyle=col;ctx.globalAlpha=.45;ctx.lineWidth=1*u;
      for(const l of[A,B]){const e=dist(l[0],vp)>dist(l[1],vp)?l[1]:l[0];ctx.beginPath();ctx.moveTo(e[0],e[1]);ctx.lineTo(vp[0],vp[1]);ctx.stroke();}
      ctx.globalAlpha=1;ctx.setLineDash([]);ctx.beginPath();ctx.arc(vp[0],vp[1],4*u,0,7);ctx.fillStyle=col;ctx.fill();ctx.setLineDash([5*u,4*u]);}}
  ctx.setLineDash([]);
  lines.forEach((l,i)=>{const col=cmCol(i);ctx.strokeStyle=col;ctx.lineWidth=2.6*u;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(l[0][0],l[0][1]);ctx.lineTo(l[1][0],l[1][1]);ctx.stroke();
    for(const p of l){ctx.beginPath();ctx.arc(p[0],p[1],6*u,0,7);ctx.fillStyle=C.paper;ctx.fill();ctx.lineWidth=1.8*u;ctx.stroke();}
    const m=[(l[0][0]+l[1][0])/2,(l[0][1]+l[1][1])/2];ctx.font=`600 ${11*u}px "IBM Plex Mono",monospace`;ctx.fillStyle=col;
    const el=cmElem(L.cm.on[i]);ctx.fillText(cmName(i)+(el?' · '+el.name:''),m[0]+8*u,m[1]-8*u);});}
function cmHit(L,p,tol){if(!L.cm)return null;const{lines}=cmScreen(L);
  for(let i=0;i<4;i++)for(let e=0;e<2;e++)if(dist(p,lines[i][e])<tol+5*K)return{t:'lcm',L,li:i,ei:e};return null;}
function cmDrag(p){const L=drag.L,st=layerMap(L).inv(p[0],p[1]);L.cm.lines[drag.li][drag.ei]=[clamp(st[0],-0.5,1.5),clamp(st[1],-0.5,1.5)];L.cm.res=null;drag.text=`${cmName(drag.li)}: drag each end onto a floor line in the photo`;}

/* ---------- panel ---------- */
function cmPanelHTML(L){const on=cmOn===L.id,cm=L.cm;let h=`<div class="params" style="display:grid;gap:6px"><span class="fl">Match camera</span>
  <div class="chips"><button id="cm-on" type="button" aria-pressed="${on}">Trace floor lines</button>${on?'<button id="cm-solve" type="button">Solve and apply</button>':''}</div>`;
  if(on){const opts=`<option value="">— not a known line</option><optgroup label="Walls">${S.walls.map(w=>`<option value="w:${w.id}">${esc(wallName(w))}</option>`).join('')}</optgroup>${S.marks.length?`<optgroup label="Reference lines">${S.marks.map(m=>`<option value="m:${m.id}">${esc(m.label||'(unnamed)')}</option>`).join('')}</optgroup>`:''}`;
    h+='<div style="display:grid;gap:4px">'+[0,1,2,3].map(i=>`<label class="inl" for="cm-l${i}"><i style="display:inline-block;width:10px;height:10px;background:${cmCol(i)}"></i><span style="min-width:2em;font-family:var(--f-mono);font-size:12px">${cmName(i)}</span>
      <select id="cm-l${i}" data-cml="${i}" aria-label="Line ${cmName(i)} lies on">${opts.replace(`value="${(cm&&cm.on[i])||'~'}"`,`value="${cm&&cm.on[i]}" selected`)}</select></label>`).join('')+'</div>'+
      '<p class="note">Drag the red pair (A) onto two floor lines that run the same way in the room, the blue pair (B) onto two that run at right angles to them, as far apart as possible. Link each line to the wall or reference line it lies on: two parallel known lines give the eye height, links in both directions give the position.</p>';}
  else h+='<p class="note">Sets the camera from this photo: you trace two pairs of floor lines and it works out the lens, the turn, the eye height and where you stood.</p>';
  if(cm&&cm.res)h+=`<p class="note" style="color:var(--ink)">${esc(cm.res)}</p>`;
  return h+'</div>';}
function bindCM(L){const b=$('cm-on');if(!b||!L)return;
  b.addEventListener('click',()=>{if(cmOn===L.id)cmOn=null;else{cmOn=L.id;cmEnsure(L);if(S.view!=='persp')setView('persp');}renderLayerProps();drawAll();});
  document.querySelectorAll('[data-cml]').forEach(s=>s.addEventListener('change',()=>{cmEnsure(L).on[+s.dataset.cml]=s.value;L.cm.res=null;commit();drawAll();}));
  const sv=$('cm-solve');if(sv)sv.addEventListener('click',()=>cmApply(L));}

/* ---------- solve ---------- */
const v3={sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],sc:(a,k)=>[a[0]*k,a[1]*k,a[2]*k],
  nrm:a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l];}};
/* 3 × 3 linear solve (Gaussian elimination with pivoting) */
function solve3(A,b){const M=A.map((r,i)=>[...r,b[i]]);for(let c=0;c<3;c++){let p=c;for(let r=c+1;r<3;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;
  if(Math.abs(M[p][c])<1e-12)return null;[M[c],M[p]]=[M[p],M[c]];for(let r=0;r<3;r++){if(r===c)continue;const f=M[r][c]/M[c][c];for(let k=c;k<4;k++)M[r][k]-=f*M[c][k];}}
  return[M[0][3]/M[0][0],M[1][3]/M[1][1],M[2][3]/M[2][2]];}
function cmSolve(L){const cm=L.cm,nat=L.nat||L.h/L.w,c=[0.5,0.5*nat],img=p=>[p[0],p[1]*nat];
  const hl=l=>v3.cross([...img(l[0]),1],[...img(l[1]),1]);
  const vp=(i)=>{const X=v3.cross(hl(cm.lines[i]),hl(cm.lines[i+1]));if(Math.abs(X[2])<1e-9)return null;return[X[0]/X[2],X[1]/X[2]];};
  const v1=vp(0),v2=vp(2);
  if(!v1||!v2)throw new Error(`Pair ${v1?'B':'A'}'s lines are parallel in the photo, so they have no vanishing point. Pick lines that converge (ones running away from the camera), or a photo taken at an angle to the walls.`);
  const f2=-((v1[0]-c[0])*(v2[0]-c[0])+(v1[1]-c[1])*(v2[1]-c[1]));
  if(!(f2>1e-6))throw new Error("These two directions can't be at right angles for a real camera. Check that pair A and pair B follow perpendicular directions on the floor, and that each pair's lines really are parallel in the room.");
  const f=Math.sqrt(f2),ray=p=>[(p[0]-c[0])/f,-(p[1]-c[1])/f,1];
  const d1=v3.nrm(ray(v1)),d2a=v3.nrm(ray(v2)),d2=v3.nrm(v3.sub(d2a,v3.sc(d1,v3.dot(d2a,d1))));
  let up=v3.nrm(v3.cross(d1,d2));if(up[1]<0)up=v3.sc(up,-1);const detc=v3.dot(v3.cross(d1,d2),up);
  /* floor points of the traced lines with the eye 1 m above the floor (camera coordinates: x right, y up, z forward) */
  const fl=cm.lines.map((l,i)=>l.map(p=>{const r=ray(img(p)),den=v3.dot(up,r);if(den>-1e-6)throw new Error(`${cmName(i)} reaches the horizon or above it. Floor lines must sit below eye level in the photo.`);return v3.sc(r,-1/den);}));
  /* world directions from the links */
  const el=cm.on.map(cmElem),dirOf=e=>{const dx=e.b[0]-e.a[0],dz=e.b[1]-e.a[1],l=Math.hypot(dx,dz)||1;return[dx/l,dz/l];};
  const eA=el[0]||el[1],eB=el[2]||el[3];let W1;
  if(eA)W1=dirOf(eA);else if(eB){const b=dirOf(eB);W1=[b[1],-b[0]];}else W1=[1,0];
  const W2=[-W1[1],W1[0]],warn=[];
  if(eA&&eB){const b=dirOf(eB);if(Math.abs(b[0]*W1[0]+b[1]*W1[1])>0.1)warn.push("pair B's linked line isn't at right angles to pair A's in the plan");}
  const W1_3=[W1[0],0,W1[1]],W2_3=[W2[0],0,W2[1]],detw=v3.cross(W1_3,W2_3)[1];
  let best=null;
  for(const s1 of[1,-1]){const s2=-detc/(s1*detw);
    const R=v=>[s1*W1_3[0]*v3.dot(d1,v)+s2*W2_3[0]*v3.dot(d2,v),v3.dot(up,v),s1*W1_3[2]*v3.dot(d1,v)+s2*W2_3[2]*v3.dot(d2,v)];
    const rows=[],rhs=[];
    el.forEach((e,i)=>{if(!e)return;const dd=dirOf(e),N=[-dd[1],dd[0]],q=N[0]*e.a[0]+N[1]*e.a[1];
      for(const X of fl[i]){const g=R(X);rows.push([N[0],N[1],N[0]*g[0]+N[1]*g[2]]);rhs.push(q);}});
    const lam=0.05;rows.push([lam,0,0],[0,lam,0],[0,0,lam]);rhs.push(lam*S.cx,lam*S.cz,lam*S.eye);
    const AtA=[0,1,2].map(i=>[0,1,2].map(j=>rows.reduce((s,r)=>s+r[i]*r[j],0))),Atb=[0,1,2].map(i=>rows.reduce((s,r,k)=>s+r[i]*rhs[k],0)),x=solve3(AtA,Atb);if(!x)continue;
    let res=0;for(let k=0;k<rows.length-3;k++){const e=rows[k][0]*x[0]+rows[k][1]*x[1]+rows[k][2]*x[2]-rhs[k];res+=e*e;}
    const P=[x[0],x[1]],inside=S.rooms.some(r=>r.pts&&r.pts.length>2&&pointInPoly(P,r.pts))||(!S.rooms.length&&(()=>{const b=worldBounds();return P[0]>b.x0&&P[0]<b.x1&&P[1]>b.z0&&P[1]<b.z1;})());
    const fw=R([0,0,1]),b=worldBounds(),ctr=[(b.x0+b.x1)/2-P[0],(b.z0+b.z1)/2-P[1]],cl=Math.hypot(...ctr)||1,fl2=Math.hypot(fw[0],fw[2])||1;
    const score=res+(inside?0:1)+(x[2]<0.2?10:0)-0.1*(fw[0]*ctr[0]+fw[2]*ctr[1])/(cl*fl2);
    if(!best||score<best.score)best={score,res,x,R,inside};}
  if(!best)throw new Error("Couldn't solve for the camera with these lines. Try lines further apart.");
  /* horizon: line through v1 and v2; its point nearest the photo centre becomes the canvas centre */
  const hx=v2[0]-v1[0],hy=v2[1]-v1[1],hlen=Math.hypot(hx,hy)||1,ux=hx/hlen,uy=hy/hlen,tt=(c[0]-v1[0])*ux+(c[1]-v1[1])*uy,hp=[v1[0]+ux*tt,v1[1]+uy*tt];
  let hang=Math.atan2(hy,hx)*180/Math.PI;if(hang>90)hang-=180;if(hang<=-90)hang+=180;
  const R=best.R,wh=R(ray(hp)),fw=R([0,0,1]),rt=R([1,0,0]);
  const linked=p=>{const s=new Set();for(const i of[p,p+1]){const e=el[i];if(!e)continue;const dd=dirOf(e),N=[-dd[1],dd[0]];s.add((N[0]*e.a[0]+N[1]*e.a[1]).toFixed(3));}return s.size>=2;};
  return{cx:best.x[0],cz:best.x[1],eye:best.x[2],yaw:normDeg(Math.atan2(wh[0],-wh[2])*180/Math.PI),fov:2*Math.atan(0.5/f)*180/Math.PI,
    pitch:Math.asin(clamp(fw[1],-1,1))*180/Math.PI,roll:Math.asin(clamp(rt[1],-1,1))*180/Math.PI,hang,hp,c,nat,inside:best.inside,res:best.res,
    eyeMeasured:linked(0)||linked(2),posLinks:el.filter(Boolean).length,warn};}
function cmApply(L){if(S.lockCam){flash('The camera is locked. Untick Lock camera first.');return;}
  let r;try{r=cmSolve(L);}catch(e){L.cm.res=e.message;renderLayerProps();flash(e.message);return;}
  const notes=[],fov=clamp(r.fov,40,100),eye=clamp(r.eye,0.3,2.4);
  if(Math.abs(fov-r.fov)>0.5)notes.push(`the lens works out at ${r.fov.toFixed(0)}°, outside the 40–100° range, so it was clamped`);
  if(Math.abs(eye-r.eye)>0.01)notes.push(`the eye height works out at ${fmt(r.eye)} m, so it was clamped`);
  S.yaw=r.yaw;S.fov=Math.round(fov);S.eye=+eye.toFixed(3);S.pitch=+clamp(r.pitch,-80,80).toFixed(2);const ox=r.cx,oz=r.cz;S.cx=+r.cx.toFixed(3);S.cz=+r.cz.toFixed(3);clampCam();
  if(Math.hypot(S.cx-ox,S.cz-oz)>0.02)notes.push('the camera stood far outside the room, so it was moved back to the nearest allowed spot');
  if(!r.eyeMeasured)notes.push(`eye height kept at ${fmt(S.eye)} m (link both lines of a pair to two parallel walls or lines to measure it)`);
  if(!r.posLinks)notes.push('position kept (link lines to walls to measure it)');
  if(Math.abs(r.roll)>1.5)notes.push(`the photo is rolled ${r.roll.toFixed(1)}°; the app's camera has no roll, so the photo is turned level instead and verticals won't line up exactly`);
  notes.push(...r.warn);
  /* photo full width, unpinned, horizon level; the horizon sits where the tilted camera puts it (centre line when level) */
  L.pin=null;L.w=1;L.h=r.nat;L.rot=+(-r.hang).toFixed(3);const a=L.rot*Math.PI/180,dx=r.c[0]-r.hp[0],dy=r.c[1]-r.hp[1],
    hy=0.375+0.5/Math.tan(S.fov*Math.PI/360)*Math.tan(S.pitch*Math.PI/180);
  L.x=0.5+dx*Math.cos(a)-dy*Math.sin(a);L.y=hy+dx*Math.sin(a)+dy*Math.cos(a);
  const msg=`Camera matched: lens ${S.fov}°, eye ${fmt(S.eye)} m, turn ${S.yaw.toFixed(1)}°${Math.abs(S.pitch)>0.05?`, ${S.pitch>0?'up':'down'} ${Math.abs(S.pitch).toFixed(1)}°`:''}, at ${fmt(S.cx)}, ${fmt(S.cz)}.`;
  L.cm.res=msg+(notes.length?' Note: '+notes.join('; ')+'.':'');cmOn=null;
  commit();syncCamUI();renderLayerProps();drawAll();flash(msg);}
