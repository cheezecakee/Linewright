'use strict';
/* Linewright — perspective drawing: room shell from walls/openings/marks, objects, labels, guides, gizmo. */

const cv=$('cv'),ctx=cv.getContext('2d');
let C={},K=1;   // theme colours; K = canvas px per CSS px for the perspective canvas
function tok(){const cs=getComputedStyle(document.documentElement);for(const k of['paper','ink','faint','guide','accent','muted','gx','gy','gz','line'])C[k]=cs.getPropertyValue('--'+k).trim();}
function isDark(){const t=document.documentElement.getAttribute('data-theme');if(t==='dark')return true;if(t==='light')return false;return matchMedia('(prefers-color-scheme: dark)').matches;}
function tagColor(id){const t=id&&tagById(id);return t?t.c[isDark()?1:0]:null;}
function objColor(o){if(S.trace)return C.ink;if(S.colorTags){const c=tagColor(effTag(o));if(c)return c;}return C.accent;}
function layerMode(){return S.view==='persp'&&S.panels.persp==='layers'&&!settingsOpen;}

/* style: name or [colour, width, dash, alpha] */
function stroke(st){const u=cv.width/1200,T=S.trace;
  const m=typeof st==='string'?{main:[C.ink,T?3.6:2.2,[]],faint:[C.faint,1.2,[]],dash:[C.muted,1.4,[8,6]],grid:[C.faint,0.9,[]]}[st]:st;
  ctx.strokeStyle=m[0];ctx.lineWidth=m[1]*u;ctx.setLineDash((m[2]||[]).map(v=>v*u));ctx.globalAlpha=m[3]||1;ctx.lineCap='round';ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;}
function seg(A,B,st){if(ZB){zbSeg(A,B,st);return;}const s=clipProj(A,B);if(!s)return;ctx.beginPath();ctx.moveTo(s[0][0],s[0][1]);ctx.lineTo(s[1][0],s[1][1]);stroke(st);}
function poly(pts,st,closed=true){for(let i=0;i<pts.length-(closed?0:1);i++)seg(pts[i],pts[(i+1)%pts.length],st);}
/* edges of a box or extruded polygon: top and bottom outlines, plus verticals at sharp corners and, for curved outlines,
   at the silhouette as seen from the camera (where one neighbouring side faces the eye and the other doesn't) */
function boxEdges(o){const c=foot(o),N=c.length,y0=o.y,y1=o.y+o.h,e=[];
  if(!o.poly||N<=4){for(let i=0;i<N;i++){const a=c[i],b=c[(i+1)%N];e.push([[a[0],y0,a[1]],[b[0],y0,b[1]]],[[a[0],y1,a[1]],[b[0],y1,b[1]]],[[a[0],y0,a[1]],[a[0],y1,a[1]]]);}return e;}
  const sg=polyArea(c)>0?1:-1,face=[];
  for(let i=0;i<N;i++){const a=c[i],b=c[(i+1)%N],ux=b[0]-a[0],uz=b[1]-a[1],n=[uz*sg,-ux*sg];face.push((S.cx-a[0])*n[0]+(S.cz-a[1])*n[1]>0);
    e.push([[a[0],y0,a[1]],[b[0],y0,b[1]]],[[a[0],y1,a[1]],[b[0],y1,b[1]]]);}
  for(let i=0;i<N;i++){const p=c[(i-1+N)%N],q=c[i],r=c[(i+1)%N],a1=Math.atan2(q[1]-p[1],q[0]-p[0]),a2=Math.atan2(r[1]-q[1],r[0]-q[0]);
    const turn=Math.abs(normDeg((a2-a1)*180/Math.PI));if(turn>25||face[(i-1+N)%N]!==face[i])e.push([[q[0],y0,q[1]],[q[0],y1,q[1]]]);}
  return e;}
function drawBox(o,st){for(const[A,B]of boxEdges(o))seg(A,B,st);}
function drawGlow(o){const col=glowCol(effTag(o));ctx.save();ctx.shadowColor=col;ctx.shadowBlur=16*K;drawBox(o,[col,3.4,[]]);ctx.restore();drawBox(o,[col,2,[]]);}

/* ---------- solid view: depth-buffer hidden-line removal ----------
   While solid view is on, the faces of every visible object (and the walls that aren't faded) are rasterised into a
   low-resolution depth buffer ZB first. Every line drawn through seg() afterwards is sampled along its length and only the
   runs that are not behind a nearer face are stroked. No paint order is needed, so overlapping or interpenetrating objects
   hide each other correctly. Depth is stored as 1/z, which is linear across the screen for a flat face. */
let ZB=null,zbMem=null;
function zbBegin(){const sc=Math.min(1,1000/cv.width),w=Math.max(1,Math.ceil(cv.width*sc)),h=Math.max(1,Math.ceil(cv.height*sc));
  if(!zbMem||zbMem.length<w*h)zbMem=new Float32Array(w*h);zbMem.fill(0,0,w*h);ZB={w,h,s:sc,d:zbMem};}
/* flat polygon (world points) into the buffer, clipped at the near plane */
function zbPoly(P3){const c=P3.map(toCam),q=[];
  for(let i=0;i<c.length;i++){const a=c[i],b=c[(i+1)%c.length],ia=a[2]>=NEAR,ib=b[2]>=NEAR;
    if(ia)q.push(a);if(ia!==ib){const t=(NEAR-a[2])/(b[2]-a[2]);q.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1]),NEAR]);}}
  if(q.length<3)return;
  const{w,h,s,d}=ZB,P=q.map(v=>{const p=proj(v);return[p[0]*s,p[1]*s,1/v[2]];}),n=P.length;
  /* 1/z = a·x + b·y + c over the polygon, from the vertex pair that spans the most area with vertex 0 */
  let best=0,j0=1,k0=2;
  for(let j=1;j<n;j++)for(let k=j+1;k<n;k++){const ar=Math.abs((P[j][0]-P[0][0])*(P[k][1]-P[0][1])-(P[k][0]-P[0][0])*(P[j][1]-P[0][1]));if(ar>best){best=ar;j0=j;k0=k;}}
  if(best<1e-9)return;
  const p0=P[0],p1=P[j0],p2=P[k0],dx1=p1[0]-p0[0],dy1=p1[1]-p0[1],dx2=p2[0]-p0[0],dy2=p2[1]-p0[1],dw1=p1[2]-p0[2],dw2=p2[2]-p0[2],det=dx1*dy2-dx2*dy1;
  const ca=(dw1*dy2-dw2*dy1)/det,cb=(dx1*dw2-dx2*dw1)/det,cc=p0[2]-ca*p0[0]-cb*p0[1];
  let y0=Infinity,y1=-Infinity;for(const p of P){y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);}
  y0=Math.max(0,Math.ceil(y0));y1=Math.min(h-1,Math.floor(y1));
  const xs=[];
  for(let y=y0;y<=y1;y++){xs.length=0;
    for(let i=0;i<n;i++){const A=P[i],B=P[(i+1)%n];if((A[1]<=y&&B[1]>y)||(B[1]<=y&&A[1]>y))xs.push(A[0]+(y-A[1])*(B[0]-A[0])/(B[1]-A[1]));}
    xs.sort((m,k)=>m-k);
    for(let i=0;i+1<xs.length;i+=2){const xa=Math.max(0,Math.ceil(xs[i])),xb=Math.min(w-1,Math.floor(xs[i+1]));
      for(let x=xa,idx=y*w+xa;x<=xb;x++,idx++){const v=ca*x+cb*y+cc;if(v>d[idx])d[idx]=v;}}}}
function solidFaces(o){const c=foot(o),N=c.length,y0=o.y,y1=o.y+o.h,sg=polyArea(c)>0?1:-1,side=[];
  for(let i=0;i<N;i++){const a=c[i],b=c[(i+1)%N];side.push((S.cx-a[0])*((b[1]-a[1])*sg)+(S.cz-a[1])*(-(b[0]-a[0])*sg)>0);}
  return{c,N,y0,y1,side,topF:S.eye>y1+1e-6,botF:S.eye<y0-1e-6};}
/* camera-facing faces only: the others always sit behind them */
function zbObject(o){if(o.h<1e-6)return;const f=solidFaces(o),{c,N,y0,y1}=f,P=(q,y)=>[q[0],y,q[1]];
  for(let i=0;i<N;i++)if(f.side[i]){const a=c[i],b=c[(i+1)%N];zbPoly([P(a,y0),P(b,y0),P(b,y1),P(a,y1)]);}
  if(f.topF)zbPoly(c.map(q=>P(q,y1)));if(f.botF)zbPoly(c.map(q=>P(q,y0)));}
/* a wall as rectangles around its door and window holes, so things can be seen through the openings */
function zbWall(w){const L=wallLen(w),H=wallH(w),ops=S.openings.filter(o=>o.wall===w.id).sort((a,b)=>a.off-b.off);
  const Q=(t0,t1,y0,y1)=>{if(t1-t0>1e-4&&y1-y0>1e-4)zbPoly([wallP(w,t0,y0),wallP(w,t1,y0),wallP(w,t1,y1),wallP(w,t0,y1)]);};
  let t=0;for(const o of ops){const a=clamp(o.off,0,L),b=clamp(o.off+o.w,0,L),lo=o.type==='door'?0:o.sill,hi=o.type==='door'?o.h:o.sill+o.h;
    Q(t,a,0,H);Q(a,b,0,lo);Q(a,b,hi,H);t=Math.max(t,b);}
  Q(t,L,0,H);}
/* stroke only the parts of a 3D segment that are not behind a nearer face (a sample counts as visible when it, or a
   neighbouring pixel, is at least as near as the buffer there, within 0.3% of its depth) */
function zbSeg(A,B,st){let a=toCam(A),b=toCam(B);if(a[2]<NEAR&&b[2]<NEAR)return;
  if(a[2]<NEAR||b[2]<NEAR){const t=(NEAR-a[2])/(b[2]-a[2]),m=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1]),NEAR];if(a[2]<NEAR)a=m;else b=m;}
  const pa=proj(a),pb=proj(b),{w,h,s,d}=ZB,dx=pb[0]-pa[0],dy=pb[1]-pa[1],wa=1/a[2],wb=1/b[2],n=clamp(Math.ceil(Math.hypot(dx,dy)*s/2),1,800);
  const vis=i=>{const t=i/n,x=Math.round((pa[0]+dx*t)*s),y=Math.round((pa[1]+dy*t)*s);if(x<0||y<0||x>=w||y>=h)return true;
    const ww=wa+(wb-wa)*t,k=y*w+x;let m=d[k];
    if(x>0)m=Math.min(m,d[k-1]);if(x<w-1)m=Math.min(m,d[k+1]);if(y>0)m=Math.min(m,d[k-w]);if(y<h-1)m=Math.min(m,d[k+w]);
    return m<=ww*1.003;};
  ctx.beginPath();let on=-1,any=false;
  const run=(i0,i1)=>{if(i1<i0)return;if(i1===i0&&n>1)return;const t0=Math.max(0,i0-0.5)/n,t1=Math.min(n,i1+0.5)/n;
    ctx.moveTo(pa[0]+dx*t0,pa[1]+dy*t0);ctx.lineTo(pa[0]+dx*t1,pa[1]+dy*t1);any=true;};
  for(let i=0;i<=n;i++){const v=vis(i);if(v&&on<0)on=i;else if(!v&&on>=0){run(on,i-1);on=-1;}}
  if(on>=0)run(on,n);
  if(any)stroke(st);}
function lblFont(){return Math.max(13*cv.width/1200,10.5*K);}
function label(P,txt,col){const c=toCam(P);if(c[2]<NEAR)return;const p=proj(c),f=lblFont();
  ctx.font=`${f}px "IBM Plex Mono",monospace`;ctx.fillStyle=col||C.muted;ctx.fillText(txt,p[0]+f*.3,p[1]-f*.3);}
function readout(c,x,y,txt,k){c.font=`500 ${12*k}px "IBM Plex Mono",monospace`;const w=c.measureText(txt).width+12*k,h=20*k;
  let bx=x+16*k,by=y-30*k;if(bx+w>c.canvas.width-4)bx=x-w-16*k;if(by<4)by=y+18*k;
  c.globalAlpha=.9;c.fillStyle=C.ink;c.fillRect(bx,by,w,h);c.globalAlpha=1;c.fillStyle=C.paper;c.fillText(txt,bx+6*k,by+14*k);}

function draw(){
  ZB=null;if(!cv.width||S.view!=='persp')return;setupCam(cv.width,cv.height);
  const u=cv.width/1200,T=S.trace,H=S.ceil,b=worldBounds();
  ctx.fillStyle=C.paper;ctx.fillRect(0,0,cv.width,cv.height);
  drawLayers(false);
  if(S.grid&&!T){for(let x=Math.ceil(b.x0/0.5)*0.5;x<=b.x1;x+=0.5)seg([x,0,b.z0],[x,0,b.z1],'grid');for(let z=Math.ceil(b.z0/0.5)*0.5;z<=b.z1;z+=0.5)seg([b.x0,0,z],[b.x1,0,z],'grid');}
  if(S.guides&&!T&&S.walls.length){
    const hy=cam.oy+cam.fp*Math.tan((S.pitch||0)*Math.PI/180);
    ctx.beginPath();ctx.moveTo(0,hy);ctx.lineTo(cv.width,hy);ctx.strokeStyle=C.guide;ctx.lineWidth=1.2*u;ctx.setLineDash([10*u,6*u]);ctx.stroke();ctx.setLineDash([]);
    ctx.font=`${Math.max(12*u,10*K)}px "IBM Plex Mono",monospace`;ctx.fillStyle=C.guide;ctx.fillText('horizon = eye level '+S.eye.toFixed(2)+' m',8*u,hy-6*u);
    const w0=S.walls[0],h0=wallH(w0);
    const crn=[[w0.a[0],0,w0.a[1]],[w0.b[0],0,w0.b[1]],[w0.a[0],h0,w0.a[1]],[w0.b[0],h0,w0.b[1]]];
    [[0,0,-1],[1,0,0],[-1,0,0]].forEach((dir,i)=>{
      const df=dot(dir,cam.f);if(df<1e-3)return;
      const vx=cam.ox+cam.fp*dot(dir,cam.r)/df,vy=cam.oy-cam.fp*dot(dir,cam.u)/df;if(Math.abs(vx-cam.ox)>cv.width*3||Math.abs(vy-cam.oy)>cv.width*3)return;
      ctx.beginPath();ctx.arc(vx,vy,5*u,0,7);ctx.fillStyle=C.guide;ctx.fill();
      ctx.fillText(i===0?'VP depth':'VP width',vx+8*u,vy+16*u);
      ctx.strokeStyle=C.guide;ctx.globalAlpha=.35;ctx.lineWidth=1*u;
      for(const P of crn){const c=toCam(P);if(c[2]<NEAR)continue;const p=proj(c),dx=p[0]-vx,dy=p[1]-vy;
        ctx.beginPath();ctx.moveTo(vx,vy);ctx.lineTo(vx+dx*4,vy+dy*4);ctx.stroke();}
      ctx.globalAlpha=1;});
  }
  // walls
  /* camera outside every room: the walls between it and the room are drawn faint so the inside stays readable */
  const outside=S.rooms.length>0&&!S.rooms.some(r=>r.pts&&r.pts.length>2&&pointInPoly([S.cx,S.cz],r.pts)),fade=new Set();
  if(outside)for(const w of S.walls){const n=wallInN(w);if((S.cx-w.a[0])*n[0]+(S.cz-w.a[1])*n[1]<-0.02)fade.add(w.id);}
  const SOL=S.solid&&!layerMode();
  if(SOL){zbBegin();for(const o of S.objects)if(visible(o))zbObject(o);for(const w of S.walls)if(!fade.has(w.id))zbWall(w);}
  for(const w of S.walls){const h=wallH(w),A=[w.a[0],0,w.a[1]],B=[w.b[0],0,w.b[1]],st=fade.has(w.id)?'dash':'main';
    seg(A,B,st);seg([A[0],h,A[2]],[B[0],h,B[2]],st);seg(A,[A[0],h,A[2]],st);seg(B,[B[0],h,B[2]],st);
    if(st==='main')for(const[t0,y0,t1,y1]of wallPat(w))seg(wallP(w,t0,y0),wallP(w,t1,y1),'faint');}
  // openings
  for(const o of S.openings){const w=wallById(o.wall);if(!w||fade.has(w.id))continue;const P=(t,y)=>wallP(w,t,y),t0=o.off,t1=o.off+o.w;
    if(o.type==='window'){const y0=o.sill,y1=o.sill+o.h,e=0.05;
      poly([P(t0,y0),P(t1,y0),P(t1,y1),P(t0,y1)],'main');
      if(o.w>2*e&&o.h>2*e){poly([P(t0+e,y0+e),P(t1-e,y0+e),P(t1-e,y1-e),P(t0+e,y1-e)],'faint');if(o.w>0.6)seg(P((t0+t1)/2,y0+e),P((t0+t1)/2,y1-e),'faint');}}
    else{poly([P(t0,0),P(t0,o.h),P(t1,o.h),P(t1,0)],'main',false);
      if(!T){const g=doorGeom(o,w),tip=[g.H[0]+g.d1[0]*g.r,g.H[1]+g.d1[1]*g.r];
        seg([g.H[0],0,g.H[1]],[tip[0],0,tip[1]],'faint');seg([tip[0],0,tip[1]],[tip[0],o.h,tip[1]],'faint');seg([g.H[0],o.h,g.H[1]],[tip[0],o.h,tip[1]],'faint');}}}
  const sop=psel&&psel.k==='op'&&S.openings.find(x=>x.id===psel.id),sw=sop&&wallById(sop.wall);
  if(sop&&sw&&!T&&!PRINTING){const pts=opOutline(sop,sw);poly(pts,[C.accent,8,[],.25]);poly(pts,[C.accent,2.4,[]]);}
  drawFixturesP();
  drawClrP();
  drawLightP();
  // reference lines
  for(const m of S.marks){seg([m.a[0],0,m.a[1]],[m.b[0],0,m.b[1]],'dash');seg([m.a[0],0,m.a[1]],[m.a[0],H,m.a[1]],'dash');seg([m.b[0],0,m.b[1]],[m.b[0],H,m.b[1]],'dash');}
  drawGhostP();
  // objects
  const selSet=new Set(PRINTING?[]:selBoxes().map(o=>o.id));
  const HL=T&&glowSet().length>0;
  for(const o of S.objects){if(!visible(o))continue;const c=objColor(o);
    /* trace highlight: the chosen kind or tag glows, everything else drops to a faint line */
    if(HL){if(hlMatch(o))drawGlow(o);else drawBox(o,[C.faint,1,[]]);}
    else if(!T&&selSet.has(o.id)){drawBox(o,[c,9,[],.2]);drawBox(o,[c,2.8,[]]);}
    else if(isLocked(o)&&!T)drawBox(o,[S.colorTags?c:C.faint,1.2,[]]);
    else drawBox(o,[c,T?1.5:1.8,[]]);}
  ZB=null;   /* everything after this (labels, dimensions, gizmos) is drawn unfiltered */
  if(S.labels&&!T){
    for(const o of S.openings){const w=wallById(o.wall);if(!w)continue;
      if(o.type==='window')label(wallP(w,o.off,o.sill+o.h+0.04),`window ${fmtIn(o.w)} × ${fmtIn(o.h)}`);
      else label(wallP(w,o.off,o.h+0.03),`door ${fmtIn(o.w)}${o.entrance?' · entrance':''}`);}
    for(const m of S.marks)label([m.a[0]+0.05,0.02,m.a[1]],m.label||'');
    for(const w of S.walls){const u2=wallU(w);label([w.a[0]+u2[0]*0.05,0.02,w.a[1]+u2[1]*0.05],fmt(wallLen(w))+' m');}
    const done=new Set();
    for(const o of S.objects){if(!visible(o))continue;
      if(o.g){if(done.has(o.g))continue;done.add(o.g);const g=grpById(o.g),ms=members(o.g).filter(visible),bb=bbox(ms);label([bb.x0,bb.y1+0.02,bb.z0],g?g.n:'Group',objColor(o));}
      else{const bb=aabb(o);label([bb.x0,bb.y1+0.02,bb.z0],o.n,objColor(o));}}
  }
  if(!T&&!PRINTING)drawDimsP();
  if(!PRINTING)drawMeasureP();
  drawLayers(true);
  drawPaperP();
  if(PRINTING){}
  else if(layerMode())drawLayerHandles();
  else if(!T){const G=gizmo();if(G)drawGizmo(G);const FG=fxGizmo();if(FG)drawFxGizmo(FG);const OG=opGizmo();if(OG)drawFxGizmo(OG);}
  if(!PRINTING&&drag&&drag.view==='p'&&drag.text&&drag.cur)readout(ctx,drag.cur[0],drag.cur[1],drag.text,K);
}

/* dimensions of the selected box (or group bounding box) along three of its edges */
function drawDimsP(){const it=single();if(!it||drag&&drag.view==='p'&&drag.L)return;const list=selBoxes().filter(visible);if(!list.length)return;
  let cs,y0,y1,w,d,h;
  if(it.kind==='b'){const o=it.o;cs=corners(o);y0=o.y;y1=o.y+o.h;w=o.w;d=o.d;h=o.h;}
  else{const b=bbox(list);cs=[[b.x0,b.z0],[b.x1,b.z0],[b.x1,b.z1],[b.x0,b.z1]];y0=b.y0;y1=b.y1;w=b.x1-b.x0;d=b.z1-b.z0;h=b.y1-b.y0;}
  /* edges nearest the camera read best: pick the bottom corner closest to the eye */
  let ci=0,bd=Infinity;for(let i=0;i<4;i++){const dd=Math.hypot(cs[i][0]-S.cx,cs[i][1]-S.cz);if(dd<bd){bd=dd;ci=i;}}
  const P=(i,y)=>[cs[i%4][0],y,cs[i%4][1]],nx=ci%2===0?(ci+1)%4:(ci+3)%4,pv2=ci%2===0?(ci+3)%4:(ci+1)%4;
  const e1=[P(ci,y0),P(nx,y0)],e2=[P(ci,y0),P(pv2,y0)],e3=[P(ci,y0),P(ci,y1)];
  const len=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
  const put=(e,txt)=>{const m=[(e[0][0]+e[1][0])/2,(e[0][1]+e[1][1])/2,(e[0][2]+e[1][2])/2],c=toCam(m);if(c[2]<NEAR)return;const p=proj(c),f=lblFont();
    ctx.font=`500 ${f}px "IBM Plex Mono",monospace`;const tw=ctx.measureText(txt).width;ctx.globalAlpha=.85;ctx.fillStyle=C.paper;ctx.fillRect(p[0]-tw/2-3*K,p[1]-f*0.85,tw+6*K,f*1.2);ctx.globalAlpha=1;
    ctx.fillStyle=C.accent;ctx.fillText(txt,p[0]-tw/2,p[1]+f*0.15);};
  const lw=len(...e1),ld=len(...e2);put(e1,fmt(lw));put(e2,fmt(ld));if(h>0)put(e3,fmt(h));}

/* ---------- 3-axis gizmo ---------- */
function gizmo(){
  if(!sel.length||S.trace||layerMode()||selLocked())return null;
  const list=selBoxes().filter(visible);if(!list.length)return null;
  const b=bbox(list),O=[(b.x0+b.x1)/2,(b.y0+b.y1)/2,(b.z0+b.z1)/2];
  const c0=toCam(O);if(c0[2]<NEAR)return null;
  const p0=proj(c0),L=58*K,G={p0,O,b,resize:resizable(single()),axes:[]};
  for(const[axis,v]of[['x',[1,0,0]],['y',[0,1,0]],['z',[0,0,1]]]){
    const e=0.01,c1=toCam([O[0]+v[0]*e,O[1]+v[1]*e,O[2]+v[2]*e]);if(c1[2]<NEAR)continue;
    const p1=proj(c1),dx=(p1[0]-p0[0])/e,dy=(p1[1]-p0[1])/e,len=Math.hypot(dx,dy);if(len<1e-6)continue;
    const dir=[dx/len,dy/len];
    G.axes.push({axis,dir,ppm:Math.max(len,40*K),end:[p0[0]+dir[0]*L,p0[1]+dir[1]*L],tip:[p0[0]+dir[0]*(L+17*K),p0[1]+dir[1]*(L+17*K)]});
  }
  return G;}
function drawGizmo(G){const col={x:C.gx,y:C.gy,z:C.gz};
  for(const a of G.axes){const act=drag&&drag.axis===a.axis&&drag.view==='p';
    ctx.strokeStyle=col[a.axis];ctx.fillStyle=col[a.axis];ctx.lineWidth=(act?3.8:2.4)*K;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(G.p0[0],G.p0[1]);ctx.lineTo(a.end[0],a.end[1]);ctx.stroke();
    const[dx,dy]=a.dir,hl=12*K,hw=6*K,ex=a.end[0]+dx*4*K,ey=a.end[1]+dy*4*K;
    ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(ex-dx*hl-dy*hw,ey-dy*hl+dx*hw);ctx.lineTo(ex-dx*hl+dy*hw,ey-dy*hl-dx*hw);ctx.closePath();ctx.fill();
    if(G.resize){const r=5*K;ctx.fillStyle=C.paper;ctx.fillRect(a.tip[0]-r,a.tip[1]-r,2*r,2*r);ctx.lineWidth=2*K;ctx.strokeRect(a.tip[0]-r,a.tip[1]-r,2*r,2*r);}
    ctx.font=`500 ${11*K}px "IBM Plex Mono",monospace`;ctx.fillStyle=col[a.axis];ctx.fillText(a.axis,a.end[0]-dy*12*K-3*K,a.end[1]+dx*12*K+4*K);}
  ctx.beginPath();ctx.arc(G.p0[0],G.p0[1],3.5*K,0,7);ctx.fillStyle=C.ink;ctx.fill();}
function pickBox(p,tol){let best=null,bd=tol;
  for(const o of S.objects){if(!visible(o)||isLocked(o))continue;
    for(const[A,B]of boxEdges(o)){const s=clipProj(A,B);if(!s)continue;const d=segDist(p,s[0],s[1]);if(d<bd){bd=d;best=o;}}}
  return best;}
