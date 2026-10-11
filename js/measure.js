'use strict';
/* Linewright — measure tool (two points in the plan, or two points/faces in the perspective via ray picking)
   and clearance zones (door swing, drawer pull-out, per-object clearance such as chair recline) with intrusion warnings. */

const MS={pts:[]};   // transient: [{P:[x,y,z], n:[nx,ny,nz]|null, what}]

/* ---------- ray picking in the perspective ---------- */
function camRay(p){const x=(p[0]-cam.ox)/cam.fp,y=(cam.oy-p[1])/cam.fp,d=[cam.r[0]*x+cam.f[0],y,cam.r[2]*x+cam.f[2]],l=Math.hypot(...d);return{o:cam.p.slice(),d:d.map(v=>v/l)};}
function rayPick(p){setupCam(cv.width,cv.height);const{o,d}=camRay(p);let best=null;
  const take=(t,n,what)=>{if(t>NEAR&&(!best||t<best.t))best={t,n,what};};
  if(Math.abs(d[1])>1e-9){take(-o[1]/d[1],[0,1,0],'floor');take((S.ceil-o[1])/d[1],[0,-1,0],'ceiling');}
  for(const w of S.walls){const u=wallU(w),n=wallN(w),den=d[0]*n[0]+d[2]*n[1];if(Math.abs(den)<1e-9)continue;
    const t=((w.a[0]-o[0])*n[0]+(w.a[1]-o[2])*n[1])/den;if(t<=NEAR)continue;const P=[o[0]+d[0]*t,o[1]+d[1]*t,o[2]+d[2]*t],s=(P[0]-w.a[0])*u[0]+(P[2]-w.a[1])*u[1];
    if(s<0||s>wallLen(w)||P[1]<0||P[1]>wallH(w))continue;const sg=den<0?1:-1;take(t,[n[0]*sg,0,n[1]*sg],wallName(w));}
  for(const b of S.objects){if(!visible(b))continue;
    if(b.poly){const h=prismHit(b,o,d);if(h){const g=b.g&&grpById(b.g);take(h.t,h.n,g?`${g.n} › ${b.n}`:b.n);}continue;}
    const cx=b.x+b.w/2,cz=b.z+b.d/2,a=(b.rot||0)*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a);
    const lo=[(o[0]-cx)*ca+(o[2]-cz)*sa,o[1]-b.y,-(o[0]-cx)*sa+(o[2]-cz)*ca],ld=[d[0]*ca+d[2]*sa,d[1],-d[0]*sa+d[2]*ca];
    const mn=[-b.w/2,0,-b.d/2],mx=[b.w/2,b.h,b.d/2];let t0=-Infinity,t1=Infinity,ax=-1,sg=0;
    for(let i=0;i<3;i++){if(Math.abs(ld[i])<1e-12){if(lo[i]<mn[i]||lo[i]>mx[i]){t0=Infinity;break;}continue;}
      let ta=(mn[i]-lo[i])/ld[i],tb=(mx[i]-lo[i])/ld[i],s=-1;if(ta>tb){[ta,tb]=[tb,ta];s=1;}if(ta>t0){t0=ta;ax=i;sg=s;}t1=Math.min(t1,tb);}
    if(t0>t1||t0<=NEAR||ax<0)continue;const ln=[0,0,0];ln[ax]=sg;const n=[ln[0]*ca-ln[2]*sa,ln[1],ln[0]*sa+ln[2]*ca];
    const g=b.g&&grpById(b.g);take(t0,n,g?`${g.n} › ${b.n}`:b.n);}
  if(!best)return null;return{P:[o[0]+d[0]*best.t,o[1]+d[1]*best.t,o[2]+d[2]*best.t],n:best.n,what:best.what};}
/* ray against an extruded polygon: bottom/top caps and the side faces */
function prismHit(b,o,d){const P=foot(b),N=P.length,y0=b.y,y1=b.y+b.h;let best=null;const take=(t,n)=>{if(t>NEAR&&(!best||t<best.t))best={t,n};};
  if(Math.abs(d[1])>1e-12)for(const[y,ny]of[[y0,-1],[y1,1]]){const t=(y-o[1])/d[1];if(t>NEAR&&pointInPoly([o[0]+d[0]*t,o[2]+d[2]*t],P))take(t,[0,ny,0]);}
  const sg=polyArea(P)>0?1:-1;
  for(let i=0;i<N;i++){const a=P[i],c=P[(i+1)%N],ux=c[0]-a[0],uz=c[1]-a[1],L=Math.hypot(ux,uz);if(L<1e-9)continue;const n=[uz/L*sg,-ux/L*sg],den=d[0]*n[0]+d[2]*n[1];
    if(Math.abs(den)<1e-12)continue;const t=((a[0]-o[0])*n[0]+(a[1]-o[2])*n[1])/den;if(t<=NEAR)continue;const X=[o[0]+d[0]*t,o[1]+d[1]*t,o[2]+d[2]*t],s=((X[0]-a[0])*ux+(X[2]-a[1])*uz)/L;
    if(s<0||s>L||X[1]<y0||X[1]>y1)continue;take(t,[n[0],0,n[1]]);}
  return best;}
function measureClickP(p){const h=rayPick(p);if(!h){flash('Nothing there to measure to.');return;}addMeasure(h);}
function measurePlanClick(P){addMeasure({P,n:null,what:'plan'});}
function addMeasure(h){if(MS.pts.length>=2)MS.pts=[];MS.pts.push(h);drawAll();}
function measureText(){if(MS.pts.length<2)return MS.pts.length?`Point 1: ${fmt(MS.pts[0].P[0])}, ${fmt(MS.pts[0].P[1])}, ${fmt(MS.pts[0].P[2])} (${MS.pts[0].what}). Click the second point.`:'';
  const[a,b]=MS.pts,d=[b.P[0]-a.P[0],b.P[1]-a.P[1],b.P[2]-a.P[2]],L=Math.hypot(...d);
  let t=`Distance ${fmt(L)} m · Δx ${fmt(Math.abs(d[0]))} Δy ${fmt(Math.abs(d[1]))} Δz ${fmt(Math.abs(d[2]))}`;
  if(a.n&&b.n&&Math.abs(a.n[0]*b.n[0]+a.n[1]*b.n[1]+a.n[2]*b.n[2])>0.999)t+=` · face to face ${fmt(Math.abs(d[0]*a.n[0]+d[1]*a.n[1]+d[2]*a.n[2]))} m`;
  return t+` · ${a.what} → ${b.what}`;}
function drawMeasureP(){if(!MS.pts.length)return;const u=cv.width/1200;
  for(const m of MS.pts){const c=toCam(m.P);if(c[2]<NEAR)continue;const p=proj(c);ctx.beginPath();ctx.arc(p[0],p[1],5*u,0,7);ctx.fillStyle=C.guide;ctx.fill();}
  if(MS.pts.length===2){const[a,b]=MS.pts;seg(a.P,b.P,[C.guide,2.2,[]]);const L=Math.hypot(b.P[0]-a.P[0],b.P[1]-a.P[1],b.P[2]-a.P[2]);
    const m=toCam([(a.P[0]+b.P[0])/2,(a.P[1]+b.P[1])/2,(a.P[2]+b.P[2])/2]);if(m[2]>NEAR){const p=proj(m);readout(ctx,p[0]-16*K,p[1]+30*K,`${fmt(L)} m`,K);}}}
function drawMeasurePlan(c,X,k){if(!MS.pts.length)return;
  const ps=MS.pts.map(m=>X.to(m.P[0],m.P[2]));for(const p of ps){c.beginPath();c.arc(p[0],p[1],4*k,0,7);c.fillStyle=C.guide;c.fill();}
  if(ps.length===2){c.beginPath();c.moveTo(ps[0][0],ps[0][1]);c.lineTo(ps[1][0],ps[1][1]);c.strokeStyle=C.guide;c.lineWidth=2*k;c.stroke();
    const[a,b]=MS.pts,L=Math.hypot(b.P[0]-a.P[0],b.P[1]-a.P[1],b.P[2]-a.P[2]);readout(c,(ps[0][0]+ps[1][0])/2-16*k,(ps[0][1]+ps[1][1])/2+30*k,`${fmt(L)} m`,k);}}

/* ---------- clearance zones ---------- */
/* convex polygon overlap (separating axis); touching edges don't count */
function polyOverlap(A,B){for(const P of[A,B])for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length],n=[-(b[1]-a[1]),b[0]-a[0]];
  let a0=Infinity,a1=-Infinity,b0=Infinity,b1=-Infinity;for(const q of A){const v=q[0]*n[0]+q[1]*n[1];a0=Math.min(a0,v);a1=Math.max(a1,v);}
  for(const q of B){const v=q[0]*n[0]+q[1]*n[1];b0=Math.min(b0,v);b1=Math.max(b1,v);}const l=Math.hypot(n[0],n[1])||1;
  if(Math.min(a1,b1)-Math.max(a0,b0)<1e-3*l)return false;}return true;}
/* footprint of a box grown by m on every side (keeps its rotation) */
function grownFoot(o,m){const cx=o.x+o.w/2,cz=o.z+o.d/2,hw=o.w/2+m,hd=o.d/2+m,a=(o.rot||0)*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a);
  return[[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([x,z])=>[cx+x*ca-z*sa,cz+x*sa+z*ca]);}
function clrZones(){const Z=[];
  for(const o of S.openings){if(o.type!=='door'||!(o.angle>0))continue;const w=wallById(o.wall);if(!w)continue;const g=doorGeom(o,w),a=o.angle*Math.PI/180;
    const pts=[g.H],n=Math.max(2,Math.ceil(o.angle/15));const d1=g.d1,d0=g.d0;
    /* sweep from closed (d0) to open (d1) */
    const s=Math.sign(d0[0]*d1[1]-d0[1]*d1[0])||1;
    for(let i=0;i<=n;i++){const t=a*i/n,ct=Math.cos(t),st=Math.sin(t)*s;pts.push([g.H[0]+(d0[0]*ct-d0[1]*st)*g.r,g.H[1]+(d0[0]*st+d0[1]*ct)*g.r]);}
    Z.push({kind:'door',label:'door swing',pts,y0:0,y1:o.h,ign:new Set(),src:'door on wall '+(S.walls.indexOf(w)+1)});}
  for(const g of S.groups){if(!g.preset||g.preset.type!=='drawers'||!g.vis)continue;const ms=members(g.id).filter(visible);if(!ms.length)continue;
    const car=ms.find(m=>/carcass/i.test(m.n))||ms[0],a=(g.preset.rot||0)*Math.PI/180,dir=[-Math.sin(a),Math.cos(a)],cs=corners(car);
    let bi=0,bd=-Infinity;for(let i=0;i<4;i++){const p=cs[i],q=cs[(i+1)%4],m=[(p[0]+q[0])/2-(car.x+car.w/2),(p[1]+q[1])/2-(car.z+car.d/2)],l=Math.hypot(...m)||1,v=(m[0]*dir[0]+m[1]*dir[1])/l;if(v>bd){bd=v;bi=i;}}
    const p=cs[bi],q=cs[(bi+1)%4],pull=(+g.preset.p.depth||0.5)*0.85+0.05;
    Z.push({kind:'pull',label:'drawer pull-out',pts:[p,q,[q[0]+dir[0]*pull,q[1]+dir[1]*pull],[p[0]+dir[0]*pull,p[1]+dir[1]*pull]],y0:car.y,y1:car.y+car.h,ign:new Set(ms.map(m=>m.id)),src:g.n});}
  const doneG=new Set();
  for(const o of S.objects){if(!visible(o))continue;let src=o,m=o.clr,list=[o],name=o.n,lab=o.clrLabel;
    if(o.g){if(doneG.has(o.g))continue;doneG.add(o.g);const g=grpById(o.g);if(!g||!g.clr)continue;m=g.clr;list=members(g.id).filter(visible);name=g.n;lab=g.clrLabel;src=null;}
    if(!(m>0))continue;const b=bbox(list),pts=src?grownFoot(src,m):[[b.x0-m,b.z0-m],[b.x1+m,b.z0-m],[b.x1+m,b.z1+m],[b.x0-m,b.z1+m]];
    const ign=new Set(list.concat(descendants(list)).map(x=>x.id));for(const x of list)if(x.parent)ign.add(x.parent);
    Z.push({kind:'obj',label:lab||'clearance',pts,y0:0,y1:Math.max(b.y1,0.3),ign,src:name});}
  return Z;}
function clrCheck(){const Z=clrZones(),hits=[];
  for(const z of Z){z.hit=[];for(const o of S.objects){if(!visible(o)||z.ign.has(o.id)||o.h<=0)continue;if(o.y>=z.y1-1e-3||o.y+o.h<=z.y0+1e-3)continue;
    if(polyOverlap(z.pts,o.poly?hull(foot(o)):corners(o))){const g=o.g&&grpById(o.g),nm=g?g.n:o.n;if(!z.hit.includes(nm))z.hit.push(nm);}}
    for(const nm of z.hit)hits.push(`${nm} is in the ${z.label} of ${z.src}`);}
  return{Z,hits};}
let CLR={Z:[],hits:[]};
function drawClrPlan(c,X,k){if(!S.showClr)return;
  for(const z of CLR.Z){c.beginPath();z.pts.forEach((q,i)=>{const p=X.to(q[0],q[1]);i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]);});c.closePath();
    const col=z.hit.length?C.gx:C.guide;c.globalAlpha=z.hit.length?.16:.07;c.fillStyle=col;c.fill();c.globalAlpha=1;c.strokeStyle=col;c.lineWidth=1*k;c.setLineDash([4*k,3*k]);c.stroke();c.setLineDash([]);}}
function drawClrP(){if(!S.showClr||S.trace)return;
  for(const z of CLR.Z){const col=z.hit.length?C.gx:C.guide,pts=z.pts.map(q=>[q[0],0.002,q[1]]);poly(pts,[col,z.hit.length?2:1.3,[6,5],.9]);}}
function renderWarn(){const el=$('warn'),b=$('b-clr');if(b)b.textContent=CLR.hits.length?`Clearances · ${CLR.hits.length} ⚠`:'Clearances';
  if(!el)return;el.hidden=!S.showClr||!CLR.hits.length||S.view==='sheet';el.textContent=CLR.hits.length?'⚠ '+CLR.hits.join(' · '):'';}
