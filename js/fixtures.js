'use strict';
/* Linewright — wall, object and ceiling fixtures (outlet, switch, wall light, ceiling light, power strip).
   Object fixtures sit on a side face of an object (obj + face index of its footprint + off along the face + y up from the
   object's base) and move and turn with it; everything below goes through fxPlan(), which gives the same anchor for both.
   Catalog FX, fxVariant(), fxSize() and normFx() live in state.js. Wall fixtures: wall + off (distance from the wall start to the
   centre) + y (centre height). Ceiling fixtures: x/z. Drawn as standard symbols in the plan and on elevations, flush plates in
   perspective. In perspective a selected fixture gets a two-axis gizmo: along its wall + height, or x/z on the ceiling. */

function fxVisible(f){if(!f.vis)return false;if(S.colorTags&&S.hiddenTags.length&&S.hiddenTags.includes(f.tag||'_none'))return false;return true;}
function fxColor(f){if(S.trace)return C.ink;const c=S.colorTags&&tagColor(f.tag);return c||C.ink;}
function fxLabel(f){const V=fxVariant(f);return FX[f.type].label+(V?' · '+V.label:'');}
/* plan anchor: point on the wall line / object face (or ceiling x/z), the normal pointing away from the surface, the direction
   along it, its length L, the height its y is measured from (y0) and the height available (H) */
function fxPlan(f){if(FX[f.type].ceil)return{p:[f.x,f.z],n:null,u:null};
  if(f.obj){const o=byId(f.obj);if(!o)return null;const P=foot(o),N=P.length,i=((f.face%N)+N)%N,a=P[i],b=P[(i+1)%N],L=Math.hypot(b[0]-a[0],b[1]-a[1])||1e-9,
    u=[(b[0]-a[0])/L,(b[1]-a[1])/L],sg=polyArea(P)>0?1:-1;return{p:[a[0]+u[0]*f.off,a[1]+u[1]*f.off],n:[u[1]*sg,-u[0]*sg],u,L,y0:o.y,H:o.h,o};}
  const w=wallById(f.wall);if(!w)return null;
  const u=wallU(w),s=wallIn(w),n=wallN(w);return{p:[w.a[0]+u[0]*f.off,w.a[1]+u[1]*f.off],n:[n[0]*s,n[1]*s],u,L:wallLen(w),y0:0,H:wallH(w),w};}
/* height of the fixture centre above the floor */
function fxY(f){if(FX[f.type].ceil)return S.ceil;if(f.obj){const o=byId(f.obj);return(o?o.y:0)+f.y;}return f.y;}
function fxCentre3(f){if(FX[f.type].ceil)return[f.x,S.ceil,f.z];const A=fxPlan(f);return A?[A.p[0],fxY(f),A.p[1]]:null;}
/* faces of an object for the panel: Back / Right / Front / Left on a box, Side n on a shaped footprint */
function faceName(o,i){if(!o.poly)return['Back','Right','Front','Left'][i%4]+' face';return'Side '+(i+1);}
function faceCount(o){return o.poly?o.poly.length:4;}
function fxPlanLen(o,i){const P=foot(o),N=P.length;return dist(P[((i%N)+N)%N],P[(((i+1)%N)+N)%N]);}
function objLabel(o){const g=o&&o.g&&grpById(o.g);return o?(g?`${g.n} › ${o.n}`:o.n):'';}
/* face detail in plate coordinates (t across, y up, metres from the centre), shared by perspective and elevations */
function fxDetail(f){const V=fxVariant(f),n=V?V.n||1:1,k=V&&V.k,D={lines:[],rects:[],circles:[]};
  for(let i=0;i<n;i++){const t=(i-(n-1)/2)*0.06;
    if(f.type==='outlet'){
      if(k==='data')D.rects.push([t-0.012,-0.01,t+0.012,0.012]);
      else if(k==='tv'){D.circles.push([t,0,0.013],[t,0,0.003]);}
      else{const y0=k==='usb'?-0.002:-0.012,y1=k==='usb'?0.02:0.012;D.lines.push([[t-0.009,y0],[t-0.009,y1]],[[t+0.009,y0],[t+0.009,y1]]);
        if(k==='usb')D.rects.push([t-0.009,-0.024,t+0.009,-0.014]);if(k==='high')D.circles.push([t,-0.022,0.004]);}}
    else if(f.type==='switch'){
      if(k==='dimmer')D.circles.push([t,0,0.018]);
      else{D.rects.push([t-0.012,-0.026,t+0.012,0.026]);if(k==='twoway')D.lines.push([[t-0.007,0.012],[t+0.007,0.012]],[[t-0.007,-0.012],[t+0.007,-0.012]]);}}
    else if(f.type==='strip')D.circles.push([t+0.02,0,0.016]);}
  if(f.type==='strip'){const hw=fxSize(f).w/2;D.rects.push([-hw+0.008,-0.012,-hw+0.026,0.012]);}
  return D;}
/* 3D outline: plate flush on the wall (2 mm proud) or a circle on the ceiling */
function fxOutline(f){const T=FX[f.type],Z=fxSize(f);
  if(T.ceil){const r=Z.w/2,pts=[];for(let i=0;i<16;i++){const a=i/16*Math.PI*2;pts.push([f.x+Math.cos(a)*r,S.ceil-0.002,f.z+Math.sin(a)*r]);}return pts;}
  const A=fxPlan(f);if(!A)return null;const e=0.002,hw=Z.w/2,hh=Z.h/2,y=fxY(f),P=(t,yy)=>[A.p[0]+A.u[0]*t+A.n[0]*e,yy,A.p[1]+A.u[1]*t+A.n[1]*e];
  return[P(-hw,y-hh),P(hw,y-hh),P(hw,y+hh),P(-hw,y+hh)];}
function drawFixturesP(){const T=S.trace;
  for(const f of S.fixtures){if(!fxVisible(f))continue;const pts=fxOutline(f);if(!pts)continue;const col=fxColor(f),on=psel&&psel.k==='fx'&&psel.id===f.id;
    if(on&&!T)poly(pts,[C.accent,8,[],.25]);
    if(T&&glowSet().length){if(fxGlows(f)){const gc=glowCol(f.tag);ctx.save();ctx.shadowColor=gc;ctx.shadowBlur=14*K;poly(pts,[gc,3,[]]);ctx.restore();poly(pts,[gc,1.8,[]]);}else poly(pts,[C.faint,1,[]]);continue;}
    poly(pts,[on&&!T?C.accent:col,on?2.4:1.5,[]]);if(T)continue;const Z=fxSize(f);
    if(FX[f.type].ceil){const r=Z.w*0.32,y=S.ceil-0.002;seg([f.x-r,y,f.z-r],[f.x+r,y,f.z+r],[col,1,[]]);seg([f.x-r,y,f.z+r],[f.x+r,y,f.z-r],[col,1,[]]);continue;}
    const A=fxPlan(f),fy=fxY(f);
    if(f.type==='wlight'){const P=(t,y)=>[A.p[0]+A.u[0]*t+A.n[0]*0.06,y,A.p[1]+A.u[1]*t+A.n[1]*0.06];
      poly([P(-Z.w/2,fy-Z.h/2),P(Z.w/2,fy-Z.h/2),P(Z.w/2,fy+Z.h/2),P(-Z.w/2,fy+Z.h/2)],[col,1,[]]);continue;}
    const e=0.003,P=(t,y)=>[A.p[0]+A.u[0]*t+A.n[0]*e,fy+y,A.p[1]+A.u[1]*t+A.n[1]*e],D=fxDetail(f),st=[col,1.1,[]];
    for(const[a,b]of D.lines)seg(P(a[0],a[1]),P(b[0],b[1]),st);
    for(const[t0,y0,t1,y1]of D.rects)poly([P(t0,y0),P(t1,y0),P(t1,y1),P(t0,y1)],st);
    for(const[t,y,r]of D.circles){const c=[];for(let i=0;i<10;i++){const a=i/10*Math.PI*2;c.push(P(t+Math.cos(a)*r,y+Math.sin(a)*r));}poly(c,st);}}
  if(S.labels&&!T)for(const f of S.fixtures){if(!fxVisible(f))continue;const pts=fxOutline(f);if(!pts)continue;const p=pts[FX[f.type].ceil?4:3];
    label([p[0],p[1]+(FX[f.type].ceil?-0.06:0.02),p[2]],f.n,fxColor(f));}}

/* ---------- perspective: picking and the two-axis gizmo ---------- */
function fxPickP(p,tol){let best=null,bd=tol;
  for(const f of S.fixtures){if(!fxVisible(f))continue;const pts=fxOutline(f);if(!pts)continue;
    for(let i=0;i<pts.length;i++){const s=clipProj(pts[i],pts[(i+1)%pts.length]);if(!s)continue;const d=segDist(p,s[0],s[1]);if(d<bd){bd=d;best=f;}}
    const c=fxCentre3(f),cc=c&&toCam(c);if(cc&&cc[2]>NEAR){const d=dist(p,proj(cc));if(d<bd){bd=d;best=f;}}}
  return best;}
function fxGizmo(){if(!psel||psel.k!=='fx'||S.trace||layerMode()||S.view!=='persp'||sel.length)return null;const f=fxById(psel.id);if(!f||!fxVisible(f)||f.locked)return null;
  const O=fxCentre3(f);if(!O)return null;const c0=toCam(O);if(c0[2]<NEAR)return null;const p0=proj(c0),L=50*K,G={p0,O,f,axes:[]};
  let list;if(FX[f.type].ceil)list=[['x',[1,0,0],C.gx],['z',[0,0,1],C.gz]];
  else{const A=fxPlan(f);if(!A)return null;const u=A.u;list=[['along',[u[0],0,u[1]],Math.abs(u[0])>=Math.abs(u[1])?C.gx:C.gz],['y',[0,1,0],C.gy]];}
  for(const[axis,v,col]of list){const e=0.01,c1=toCam([O[0]+v[0]*e,O[1]+v[1]*e,O[2]+v[2]*e]);if(c1[2]<NEAR)continue;
    const p1=proj(c1),dx=(p1[0]-p0[0])/e,dy=(p1[1]-p0[1])/e,len=Math.hypot(dx,dy);if(len<1e-6)continue;const dir=[dx/len,dy/len];
    G.axes.push({axis,dir,col,ppm:Math.max(len,40*K),end:[p0[0]+dir[0]*L,p0[1]+dir[1]*L]});}
  return G;}
function drawFxGizmo(G){
  for(const a of G.axes){const act=drag&&drag.view==='p'&&drag.t==='fxmove'&&drag.axis===a.axis;
    ctx.strokeStyle=a.col;ctx.fillStyle=a.col;ctx.lineWidth=(act?3.8:2.4)*K;ctx.lineCap='round';
    /* double-headed: a fixture slides both ways along its wall or up and down */
    const s0=[G.p0[0]-a.dir[0]*50*K*0.55,G.p0[1]-a.dir[1]*50*K*0.55];
    ctx.beginPath();ctx.moveTo(s0[0],s0[1]);ctx.lineTo(a.end[0],a.end[1]);ctx.stroke();
    for(const[tip,sg]of[[a.end,1],[s0,-1]]){const dx=a.dir[0]*sg,dy=a.dir[1]*sg,hl=11*K,hw=5.5*K,ex=tip[0]+dx*4*K,ey=tip[1]+dy*4*K;
      ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(ex-dx*hl-dy*hw,ey-dy*hl+dx*hw);ctx.lineTo(ex-dx*hl+dy*hw,ey-dy*hl-dx*hw);ctx.closePath();ctx.fill();}
    ctx.font=`500 ${11*K}px "IBM Plex Mono",monospace`;const[dx,dy]=a.dir;ctx.fillText(a.axis==='along'?'along':a.axis,a.end[0]-dy*12*K-3*K,a.end[1]+dx*12*K+4*K);}
  ctx.beginPath();ctx.arc(G.p0[0],G.p0[1],3.5*K,0,7);ctx.fillStyle=C.ink;ctx.fill();}
function fxGizmoHit(p,tol){const G=fxGizmo();if(!G)return null;
  for(const a of G.axes){const s0=[G.p0[0]-a.dir[0]*50*K*0.55,G.p0[1]-a.dir[1]*50*K*0.55];if(segDist(p,s0,a.end)<tol)return a;}return null;}
/* drag along one gizmo axis: wd metres. Along snaps like the plan (wall ends, openings, other fixtures, grid);
   height snaps to other fixtures' heights and the openings' sill/head on the same wall; Alt is free */
function fxDrag(wd,tol,free){const f=fxById(drag.id);if(!f)return;const a=drag.axis,f0=drag.f0;
  if(a==='along'){const A=fxPlan(f);if(!A)return;const L=A.L,hw=Math.min(fxSize(f).w/2,L/2),r=snapSpan(f0.off+wd,0,fxCands(f),tol,free,0);
    f.off=rnd(clamp(r.v,hw,L-hw));drag.text=`${fmt(f.off)} m along · ${fmt(L-f.off)} m to the end`+(r.how==='snap'?' · snap':'');}
  else if(a==='y'){const A=fxPlan(f);if(!A)return;const hh=fxSize(f).h/2;
    if(f.obj){/* on an object: snap to its base, top and other fixtures on it; the centre stays within the face */
      const c=[0,A.H,A.H/2].concat(S.fixtures.filter(x=>x!==f&&x.obj===f.obj).map(x=>x.y)),r=snap1v(f0.y+wd,c,tol,free);f.y=rnd(clamp(r.v,0,A.H));
      drag.text=`${fmt(f.y)} m up the face · ${fmt(fxY(f))} m high`+(r.how==='aligned'?' · lined up':'');}
    else{const c=S.fixtures.filter(x=>x!==f&&!FX[x.type].ceil).map(fxY);
      for(const o of S.openings)if(o.wall===f.wall)c.push(o.sill,o.sill+o.h);
      const r=snap1v(f0.y+wd,c,tol,free);f.y=rnd(clamp(r.v,hh,A.H-hh));drag.text=`height ${fmt(f.y)} m`+(r.how==='aligned'?' · lined up':'');}}
  else{const i=a==='x'?0:1,r=snap1v(f0[a]+wd,snapVals(i),tol,free);f[a]=rnd(r.v);drag.text=`${a} ${fmt(f[a])} m`;}
  updatePselFields();}
/* snap candidates along a fixture's surface: the ends, openings and fixtures on the same wall, or fixtures on the same face */
function fxCands(f){if(!f.obj){const w=wallById(f.wall);return w?wallCands(w,f.id):[];}const A=fxPlan(f);if(!A)return[];
  return[0,A.L,A.L/2].concat(S.fixtures.filter(x=>x!==f&&x.obj===f.obj&&x.face===f.face).map(x=>x.off));}

/* ---------- plan symbols (canvas) ----------
   outlet = circle with one stroke per socket (data: triangle, TV: circle with TV), switch = S per gang (Sw two-way, Sd dimmer)
   on a stub, wall light = circle on a bracket, ceiling light = circle with a cross */
function fxSwitchText(f){const V=fxVariant(f);if(!V)return'S';return V.k==='twoway'?'Sw':V.k==='dimmer'?'Sd':'S'.repeat(V.n||1);}
function fxSymbol(c,f,X,k,col,lw){const A=fxPlan(f);if(!A)return null;
  c.strokeStyle=col;c.fillStyle=col;c.lineWidth=lw*k;c.setLineDash([]);
  if(FX[f.type].ceil){const p=X.to(A.p[0],A.p[1]),r=8*k;c.beginPath();c.arc(p[0],p[1],r,0,7);c.stroke();
    const q=r*0.7;c.beginPath();c.moveTo(p[0]-q,p[1]-q);c.lineTo(p[0]+q,p[1]+q);c.moveTo(p[0]-q,p[1]+q);c.lineTo(p[0]+q,p[1]-q);c.stroke();return p;}
  const w0=X.to(A.p[0],A.p[1]),nn=A.n,uu=A.u,V=fxVariant(f),kd=V&&V.k,d=f.type==='switch'?9:11,ctr=[w0[0]+nn[0]*d*k,w0[1]+nn[1]*d*k],r=6*k;
  if(f.type==='strip'){/* power strip: a bar along the face (to scale, at least 16 px) with one dot per socket */
    const hl=Math.max(fxSize(f).w*X.s,16*k)/2,o=4*k,th=5*k,c0=[w0[0]+nn[0]*(o+th/2),w0[1]+nn[1]*(o+th/2)],q=(t,s)=>[c0[0]+uu[0]*t+nn[0]*s,c0[1]+uu[1]*t+nn[1]*s];
    const pts=[q(-hl,-th/2),q(hl,-th/2),q(hl,th/2),q(-hl,th/2)];c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();c.stroke();
    const n=V?V.n||1:1;for(let i=0;i<n;i++){const p=q(-hl+(i+1)*2*hl/(n+1),0);c.beginPath();c.arc(p[0],p[1],1.2*k,0,7);c.fill();}return c0;}
  c.beginPath();c.moveTo(w0[0],w0[1]);c.lineTo(ctr[0]-nn[0]*(f.type==='switch'?0:r/k)*k,ctr[1]-nn[1]*(f.type==='switch'?0:r/k)*k);c.stroke();
  if(f.type==='switch'){const t=fxSwitchText(f);c.font=`600 ${10*k}px "IBM Plex Mono",monospace`;const tw=c.measureText(t).width;
    c.fillText(t,ctr[0]-tw/2+nn[0]*5*k,ctr[1]+3.6*k+nn[1]*5*k);return ctr;}
  if(f.type==='outlet'&&kd==='data'){const a=[ctr[0]-nn[0]*r,ctr[1]-nn[1]*r],b=[ctr[0]+nn[0]*r+uu[0]*r,ctr[1]+nn[1]*r+uu[1]*r],e=[ctr[0]+nn[0]*r-uu[0]*r,ctr[1]+nn[1]*r-uu[1]*r];
    c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.lineTo(e[0],e[1]);c.closePath();c.stroke();return ctr;}
  c.beginPath();c.arc(ctr[0],ctr[1],r,0,7);c.stroke();
  if(f.type==='outlet'){if(kd==='tv'){c.font=`600 ${6.5*k}px "IBM Plex Mono",monospace`;const tw=c.measureText('TV').width;c.fillText('TV',ctr[0]-tw/2,ctr[1]+2.3*k);return ctr;}
    const n=V?V.n||1:1,str=kd==='high'||kd==='usb'?1:n;
    for(let i=0;i<str;i++){const s=(i-(str-1)/2)*2.4,o=[ctr[0]+nn[0]*s*k,ctr[1]+nn[1]*s*k];c.beginPath();c.moveTo(o[0]-uu[0]*r*1.5,o[1]-uu[1]*r*1.5);c.lineTo(o[0]+uu[0]*r*1.5,o[1]+uu[1]*r*1.5);c.stroke();}
    if(kd==='high'){c.beginPath();c.arc(ctr[0],ctr[1],r*0.55,0,7);c.stroke();}
    if(kd==='usb'){c.font=`600 ${6.5*k}px "IBM Plex Mono",monospace`;c.fillText('U',ctr[0]+nn[0]*(r+5*k)-2*k,ctr[1]+nn[1]*(r+5*k)+2.3*k);}}
  else{c.beginPath();c.arc(ctr[0],ctr[1],r*0.45,0,7);c.fill();}
  return ctr;}
function drawFixturesPlan(c,X,k){for(const f of S.fixtures){if(!fxVisible(f))continue;const on=psel&&psel.k==='fx'&&psel.id===f.id;
  const p=fxSymbol(c,f,X,k,on?C.accent:fxColor(f),on?2:1.3);if(p&&on){c.strokeStyle=C.accent;c.lineWidth=1*k;c.setLineDash([3*k,2*k]);c.beginPath();c.arc(p[0],p[1],12*k,0,7);c.stroke();c.setLineDash([]);}}}
function fxHit(p,tol,X){let best=null,bd=tol+8*KP;
  for(const f of S.fixtures){if(!fxVisible(f))continue;const A=fxPlan(f);if(!A)continue;let q=X.to(A.p[0],A.p[1]);
    if(A.n){const d=f.type==='switch'?9:11;q=[q[0]+A.n[0]*d*KP,q[1]+A.n[1]*d*KP];}
    const dd=dist(p,q);if(dd<bd){bd=dd;best=f;}}
  return best;}
/* new fixture at a wall position (t = centre along the wall) or a ceiling point; reuses the last variant picked for that type */
function addFixture(type,w,t,xz,of){const T=FX[type],last=S.fixtures.slice().reverse().find(x=>x.type===type),
    f=normFx({type,v:last?last.v:undefined,n:T.label+' '+(S.fixtures.filter(x=>x.type===type).length+1)});
  if(T.ceil){f.x=xz[0];f.z=xz[1];f.wall=null;}
  else if(of){/* on a face of an object: centred up the face */
    f.wall=null;f.obj=of.o.id;f.face=of.face;f.y=rnd(of.o.h/2);const A=fxPlan(f),hw=Math.min(fxSize(f).w/2,A.L/2);f.off=rnd(clamp(of.t,hw,Math.max(hw,A.L-hw)));}
  else{const L=wallLen(w),hw=fxSize(f).w/2;f.wall=w.id;f.off=+clamp(t,hw,Math.max(hw,L-hw)).toFixed(4);f.y=last&&!FX[last.type].ceil&&!last.obj?last.y:T.y;}
  S.fixtures.push(f);return f;}
/* nearest side face of a visible object to a plan point: {o, face, t (along the face), d} */
function nearestFace(p,tol){let best=null;
  for(const o of S.objects){if(!visible(o)||o.h<=0)continue;const P=foot(o);
    for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<0.02)continue;const d=segDist(p,a,b);
      if(d<=tol&&(!best||d<best.d)){const u=[(b[0]-a[0])/L,(b[1]-a[1])/L];best={o,face:i,t:clamp((p[0]-a[0])*u[0]+(p[1]-a[1])*u[1],0,L),d};}}}
  return best;}

/* ---------- SVG (sheet) ---------- */
/* elevation: cx,cy = centre in mm (page), k = mm per metre */
function fxSvgElev(f,cx,cy,k,col){const Z=fxSize(f),w=Z.w*k,h=Z.h*k,x=cx-w/2,y=cy-h/2;let s=`<g stroke="${col}" fill="none" stroke-width="0.25">`;
  if(f.type==='wlight')s+=`<path d="M${x} ${y+h} H${x+w} A${w/2} ${h} 0 0 0 ${x} ${y+h}Z"/><line x1="${cx}" y1="${y+h}" x2="${cx}" y2="${y+h+Math.min(2,h*0.4)}"/>`;
  else if(f.type==='clight')s+=`<path d="M${x} ${cy-h*0.1} H${x+w} A${w/2} ${h*0.5} 0 0 1 ${x} ${cy-h*0.1}Z"/>`;
  else{s+=`<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`;const D=fxDetail(f),P=(t,yy)=>[cx+t*k,cy-yy*k],sw=' stroke-width="0.18"';
    for(const[a,b]of D.lines){const A=P(a[0],a[1]),B=P(b[0],b[1]);s+=`<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}"${sw}/>`;}
    for(const[t0,y0,t1,y1]of D.rects){const A=P(t0,y1);s+=`<rect x="${A[0]}" y="${A[1]}" width="${(t1-t0)*k}" height="${(y1-y0)*k}"${sw}/>`;}
    for(const[t,yy,r]of D.circles){const A=P(t,yy);s+=`<circle cx="${A[0]}" cy="${A[1]}" r="${r*k}"${sw}/>`;}}
  return s+'</g>';}
/* plan: M maps world x/z to page mm */
function fxSvgPlan(f,M,col){const A=fxPlan(f);if(!A)return'';const P=M(A.p[0],A.p[1]);let s=`<g stroke="${col}" fill="none" stroke-width="0.25">`;
  if(!A.n){const r=2.2,q=r*0.7;return s+`<circle cx="${P[0]}" cy="${P[1]}" r="${r}"/><path d="M${P[0]-q} ${P[1]-q}L${P[0]+q} ${P[1]+q}M${P[0]-q} ${P[1]+q}L${P[0]+q} ${P[1]-q}"/></g>`;}
  const n=A.n,u=A.u,V=fxVariant(f),kd=V&&V.k,d=f.type==='switch'?2.4:3,c=[P[0]+n[0]*d,P[1]+n[1]*d],r=1.6;
  if(f.type==='strip'){const E=M(A.p[0]+u[0]*0.5,A.p[1]+u[1]*0.5),mm=Math.hypot(E[0]-P[0],E[1]-P[1])*2,hl=Math.max(fxSize(f).w*mm,4)/2,o=1,th=1.4,q=(t,s)=>[P[0]+u[0]*t+n[0]*(o+s),P[1]+u[1]*t+n[1]*(o+s)];
    const nn=V?V.n||1:1;s+=`<polygon points="${[q(-hl,0),q(hl,0),q(hl,th),q(-hl,th)].map(p=>p.map(r2).join(',')).join(' ')}"/>`;
    for(let i=0;i<nn;i++){const p=q(-hl+(i+1)*2*hl/(nn+1),th/2);s+=`<circle cx="${r2(p[0])}" cy="${r2(p[1])}" r="0.3" fill="${col}"/>`;}return s+'</g>';}
  if(f.type==='switch')return s+`<line x1="${P[0]}" y1="${P[1]}" x2="${c[0]}" y2="${c[1]}"/></g><text x="${c[0]+n[0]*1.6}" y="${c[1]+n[1]*1.6+0.9}" font-size="2.4" text-anchor="middle" fill="${col}">${fxSwitchText(f)}</text>`;
  s+=`<line x1="${P[0]}" y1="${P[1]}" x2="${c[0]-n[0]*r}" y2="${c[1]-n[1]*r}"/>`;
  if(kd==='data'){const a=[c[0]-n[0]*r,c[1]-n[1]*r],b=[c[0]+n[0]*r+u[0]*r,c[1]+n[1]*r+u[1]*r],e=[c[0]+n[0]*r-u[0]*r,c[1]+n[1]*r-u[1]*r];return s+`<polygon points="${a} ${b} ${e}"/></g>`;}
  s+=`<circle cx="${c[0]}" cy="${c[1]}" r="${r}"/>`;
  if(f.type==='outlet'){if(kd==='tv')return s+`</g><text x="${c[0]}" y="${c[1]+0.6}" font-size="1.6" text-anchor="middle" fill="${col}">TV</text>`;
    const str=kd==='high'||kd==='usb'?1:(V?V.n||1:1);
    for(let i=0;i<str;i++){const o=(i-(str-1)/2)*0.6,q=[c[0]+n[0]*o,c[1]+n[1]*o];s+=`<line x1="${q[0]-u[0]*r*1.5}" y1="${q[1]-u[1]*r*1.5}" x2="${q[0]+u[0]*r*1.5}" y2="${q[1]+u[1]*r*1.5}"/>`;}
    if(kd==='high')s+=`<circle cx="${c[0]}" cy="${c[1]}" r="${r*0.55}"/>`;
    if(kd==='usb')return s+`</g><text x="${c[0]+n[0]*(r+1.4)}" y="${c[1]+n[1]*(r+1.4)+0.6}" font-size="1.6" text-anchor="middle" fill="${col}">U</text>`;}
  else s+=`<circle cx="${c[0]}" cy="${c[1]}" r="${r*0.45}" fill="${col}"/>`;
  return s+'</g>';}
