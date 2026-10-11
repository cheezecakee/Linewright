'use strict';
/* Linewright — projection, wall helpers, geometry ops (rotate, regenerate presets, resize), snapping. */

/* ---------- camera / projection ---------- */
let cam;
const NEAR=0.05;
function setupCam(w,h){const y=S.yaw*Math.PI/180;
  cam={p:[S.cx,S.eye,S.cz],r:[Math.cos(y),0,Math.sin(y)],f:[Math.sin(y),0,-Math.cos(y)],fp:(w/2)/Math.tan(S.fov*Math.PI/360),ox:w/2,oy:h/2};}
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function toCam(P){const d=[P[0]-cam.p[0],P[1]-cam.p[1],P[2]-cam.p[2]];return[dot(d,cam.r),d[1],dot(d,cam.f)];}
function proj(c){return[cam.ox+cam.fp*c[0]/c[2],cam.oy-cam.fp*c[1]/c[2]];}
function clipProj(A,B){let a=toCam(A),b=toCam(B);if(a[2]<NEAR&&b[2]<NEAR)return null;
  if(a[2]<NEAR||b[2]<NEAR){const t=(NEAR-a[2])/(b[2]-a[2]);const m=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1]),NEAR];if(a[2]<NEAR)a=m;else b=m;}
  return[proj(a),proj(b)];}
function segDist(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;let t=l?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l:0;t=clamp(t,0,1);return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

/* ---------- walls ---------- */
function wallLen(w){return Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]);}
function wallU(w){const L=wallLen(w)||1;return[(w.b[0]-w.a[0])/L,(w.b[1]-w.a[1])/L];}
/* normal pointing to the left of a→b in plan (x right, z down). For clockwise room walls this points into the room. */
function wallN(w){const u=wallU(w);return[-u[1],u[0]];}
function wallP(w,t,y){const u=wallU(w);return[w.a[0]+u[0]*t,y,w.a[1]+u[1]*t];}
function wallH(w){return w.h||S.ceil;}
/* direction in plan degrees: 0 = along +x, 90 = along +z */
function wallAng(w){return normDeg(Math.atan2(w.b[1]-w.a[1],w.b[0]-w.a[0])*180/Math.PI);}
function wallName(w){const i=S.walls.indexOf(w);return`Wall ${i+1} (${fmt(wallLen(w))} m)`;}
/* polygons (x,z) */
function pointInPoly(p,pts){let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];
  if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function polyArea(pts){let s=0;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];s+=a[0]*b[1]-b[0]*a[1];}return s/2;}
function polyCentroid(pts){const A=polyArea(pts);if(Math.abs(A)<1e-9){let x=0,z=0;for(const p of pts){x+=p[0];z+=p[1];}return[x/pts.length,z/pts.length];}
  let cx=0,cz=0;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length],f=a[0]*b[1]-b[0]*a[1];cx+=(a[0]+b[0])*f;cz+=(a[1]+b[1])*f;}return[cx/(6*A),cz/(6*A)];}
/* a point inside the polygon, for labels and room matching (centroid when it is inside, otherwise a scan-line midpoint) */
function polyInner(pts){const c=polyCentroid(pts);if(pointInPoly(c,pts))return c;
  const zs=pts.map(p=>p[1]),z=(Math.min(...zs)+Math.max(...zs))/2+1e-4,xs=[];
  for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];if((a[1]>z)!==(b[1]>z))xs.push(a[0]+(z-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
  xs.sort((a,b)=>a-b);return xs.length>=2?[(xs[0]+xs[1])/2,z]:c;}
/* +1 when the wall's left normal points into a room, -1 when the room is on the other side (walls drawn in either direction) */
function wallIn(w){if(!S.rooms.length)return 1;const u=wallU(w),n=[-u[1],u[0]],L=wallLen(w),m=[w.a[0]+u[0]*L/2,w.a[1]+u[1]*L/2],e=0.05;
  const inAny=p=>S.rooms.some(r=>r.pts&&r.pts.length>2&&pointInPoly(p,r.pts));
  if(inAny([m[0]+n[0]*e,m[1]+n[1]*e]))return 1;if(inAny([m[0]-n[0]*e,m[1]-n[1]*e]))return-1;return 1;}
/* door geometry in plan coordinates: hinge point, closed and open leaf directions. side +1 opens into the room. */
function doorGeom(o,w){const u=wallU(w),n=wallN(w),t=o.hinge==='a'?o.off:o.off+o.w;
  const H=[w.a[0]+u[0]*t,w.a[1]+u[1]*t],d0=o.hinge==='a'?u:[-u[0],-u[1]],a=(o.angle??90)*Math.PI/180,s=(o.side||1)*wallIn(w);
  const d1=[d0[0]*Math.cos(a)+n[0]*s*Math.sin(a),d0[1]*Math.cos(a)+n[1]*s*Math.sin(a)];return{H,d0,d1,r:o.w};}

function worldBounds(){let x0=Infinity,z0=Infinity,x1=-Infinity,z1=-Infinity;
  const add=p=>{x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);z0=Math.min(z0,p[1]);z1=Math.max(z1,p[1]);};
  for(const w of S.walls){add(w.a);add(w.b);}for(const r of S.rooms)(r.pts||[]).forEach(add);
  if(!isFinite(x0))return{x0:0,z0:0,x1:2.55,z1:4.7};return{x0,z0,x1,z1};}
function camBounds(){const b=worldBounds();return{x0:b.x0+0.1,x1:Math.max(b.x0+0.2,b.x1-0.1),z0:b.z0+0.3,z1:Math.max(b.z0+0.4,b.z1-0.1)};}

/* ---------- rotation ---------- */
/* keep rot in [0,90): a box turned 90° equals the same box with w and d swapped. Each quarter turn taken out of rot is
   counted in q (so rot + 90·q is the box's absolute yaw), turns its footprint polygon and moves fixtures on its faces
   to the face that now has the same place in the world. Quarter turns are exact, so 180° turns are not dropped. */
function quarterTurn(o){const cx=o.x+o.w/2,cz=o.z+o.d/2,w=o.d,d=o.w;o.w=w;o.d=d;o.x=cx-w/2;o.z=cz-d/2;o.q=(((o.q||0)+1)%4+4)%4;
  if(o.poly)o.poly=o.poly.map(([u,v])=>[+(1-v).toFixed(6),+u.toFixed(6)]);
  else if(typeof S!=='undefined'&&S.objects.includes(o))for(const f of S.fixtures)if(f.obj===o.id)f.face=(f.face+1)%4;}
function normRot(o){let r=o.rot||0,q=Math.floor((r+1e-6)/90);r-=q*90;if(r>90-1e-6){r-=90;q++;}if(r<1e-6)r=0;
  q=((q%4)+4)%4;for(let i=0;i<q;i++)quarterTurn(o);o.rot=+r.toFixed(4);}
function absYaw(o){return(o.rot||0)+90*(o.q||0);}
/* turn a list as one rigid block about its bounding-box centre (no attached children; used by scenarios) */
function turnBlock(list,deg){if(!list.length||Math.abs(deg)<1e-9)return;const b=bbox(list),cx=(b.x0+b.x1)/2,cz=(b.z0+b.z1)/2,a=deg*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a);
  for(const o of list){const ox=o.x+o.w/2-cx,oz=o.z+o.d/2-cz;o.x=cx+ox*ca-oz*sa-o.w/2;o.z=cz+ox*sa+oz*ca-o.d/2;o.rot=(o.rot||0)+deg;normRot(o);}}

/* ---------- extruded polygon footprints ---------- */
/* generators return points normalised to the unit square (u along w, v along d; v = 1 is the front) */
const SHAPES={
  rect:{label:'Rectangle',pts:()=>null},
  tri:{label:'Triangle (corner)',pts:()=>[[0,0],[1,0],[0,1]]},
  quarter:{label:'Quarter round (corner)',pts:()=>{const p=[[0,0]];for(let i=0;i<=12;i++){const a=i/12*Math.PI/2;p.push([Math.cos(a),Math.sin(a)]);}return p;}},
  round:{label:'Round',pts:()=>ngon(24,0.5,0)},
  hex:{label:'Hexagon',pts:()=>ngon(6,0.5,0)},
  star5:{label:'5-star base',pts:()=>{const p=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?0.11:0.5;p.push([0.5+Math.cos(a)*r,0.5+Math.sin(a)*r]);}return p;}}
};
function ngon(n,r,a0){const p=[];for(let i=0;i<n;i++){const a=a0+i/n*Math.PI*2;p.push([+(0.5+Math.cos(a)*r).toFixed(6),+(0.5+Math.sin(a)*r).toFixed(6)]);}return p;}
function shapeOf(o){if(!o.poly)return'rect';const s=JSON.stringify(o.poly);for(const k in SHAPES){const p=SHAPES[k].pts();if(p&&JSON.stringify(p.map(q=>q.map(v=>+(+v).toFixed(6))))===s)return k;}return'custom';}
/* convex hull (for clearance overlap tests on concave footprints such as a chair base) */
function hull(P){const a=P.map(p=>[p[0],p[1]]).sort((p,q)=>p[0]-q[0]||p[1]-q[1]);if(a.length<3)return a;const cr=(o,p,q)=>(p[0]-o[0])*(q[1]-o[1])-(p[1]-o[1])*(q[0]-o[0]);
  const lo=[],up=[];for(const p of a){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p);}
  for(let i=a.length-1;i>=0;i--){const p=a[i];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p);}
  return lo.slice(0,-1).concat(up.slice(0,-1));}
/* point (x,z) inside an object's footprint, with an edge tolerance */
function inFoot(o,p,pad){const P=foot(o);if(pointInPoly(p,P))return true;if(!pad)return false;for(let i=0;i<P.length;i++)if(segDist(p,P[i],P[(i+1)%P.length])<=pad)return true;return false;}
/* rotate a set of boxes as one block about its bounding-box centre; anchor keeps the bbox min corner in place */
/* attached children (see attach.js) turn with their parents about the same centre */
function rotateItems(list,deg,anchor){if(!list.length||!deg)return;
  const all=list.concat(typeof descendants==='function'?descendants(list):[]);
  const b=bbox(list),cx=(b.x0+b.x1)/2,cz=(b.z0+b.z1)/2,a=deg*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a);
  for(const o of all){const ox=o.x+o.w/2-cx,oz=o.z+o.d/2-cz;o.x=cx+ox*ca-oz*sa-o.w/2;o.z=cz+ox*sa+oz*ca-o.d/2;o.rot=(o.rot||0)+deg;normRot(o);}
  if(anchor){const nb=bbox(list),dx=b.x0-nb.x0,dz=b.z0-nb.z0;for(const o of all){o.x+=dx;o.z+=dz;}}}
const normDeg=d=>+((((d%360)+540)%360)-180).toFixed(4);
/* keep group rotation bookkeeping in step with rotateItems (presets need it to regenerate in the same orientation) */
function addGroupRot(keys,deg){if(typeof kidGroupKeys==='function')keys=keys.concat(kidGroupKeys(keys));for(const k of keys){if(k[0]!=='g')continue;const g=grpById(k.slice(2));if(!g)continue;
  g.rot=normDeg((g.rot||0)+deg);if(g.preset)g.preset.rot=(((g.preset.rot||0)+deg)%360+360)%360;}}

/* ---------- presets ---------- */
function regen(g,origin){
  const old=members(g.id);const b=old.length?bbox(old):null;
  const o0=origin||(b?{x:b.x0,y:b.y0,z:b.z0}:{x:0.4,y:0,z:1.6});
  const P=PRESETS[g.preset.type];if(!P)return;P.fix(g.preset.p);
  const keep=old.length?{vis:old.every(o=>o.vis)}:{vis:true};
  const firstIdx=S.objects.findIndex(o=>o.g===g.id);
  S.objects=S.objects.filter(o=>o.g!==g.id);
  /* parts keep their id (and attachments) when a part of the same name comes back, so fixtures and attached items survive edits */
  const byName=new Map();for(const o of old)if(!byName.has(o.n))byName.set(o.n,o);
  const parts=P.build(g.preset.p).map(r=>{const m=byName.get(r.n);if(m)byName.delete(r.n);
    return normObj({...r,id:m?m.id:uid('b'),vis:keep.vis,g:g.id,parent:m?m.parent:null,tag:m?m.tag:'',notes:m?m.notes:''});});
  turnBlock(parts,g.preset.rot||0);
  const nb=bbox(parts);for(const p of parts){p.x+=o0.x-nb.x0;p.y+=o0.y-nb.y0;p.z+=o0.z-nb.z0;}
  if(firstIdx<0)S.objects.push(...parts);else S.objects.splice(Math.min(firstIdx,S.objects.length),0,...parts);
}
/* set position+size of a single box or preset group along one world axis */
function setExtent(it,axis,min,size){const[c,s]=AX[axis];size=Math.max(0.01,size);
  if(it.kind==='b'){it.o[c]=min;it.o[s]=size;return;}
  const g=it.g;if(!g.preset)return;const odd=Math.round((g.preset.rot||0)/90)%2===1;
  const pk=axis==='y'?'height':((axis==='x')!==odd?'width':'depth');
  g.preset.p[pk]=+size.toFixed(4);regen(g);
  const ms=members(g.id),b=bbox(ms),off=min-b[c+'0'];for(const o of ms)o[c]+=off;}
function moveSel(axis,off){const c=AX[axis][0];for(const o of selMove())o[c]+=off;}

/* ---------- snapping ---------- */
function targets(axis,ex){const t=[];
  if(axis==='y')t.push({v:0,k:'floor'},{v:S.ceil,k:'ceiling'});
  else{const i=axis==='x'?0:1;
    for(const w of S.walls)if(Math.abs(w.a[i]-w.b[i])<1e-6)t.push({v:w.a[i],k:'wall'});
    for(const m of S.marks)if(Math.abs(m.a[i]-m.b[i])<1e-6)t.push({v:m.a[i],k:m.label||'line'});}
  for(const o of S.objects){if(ex.has(o.id)||!visible(o)||o.rot)continue;const b=aabb(o);t.push({v:b[axis+'0'],k:'face'},{v:b[axis+'1'],k:'face'});}
  return t;}
function snapMove(min,size,axis,ex,tol,free,noFace){if(free)return{v:min,how:'free'};
  if(!noFace){let best=null;for(const t of targets(axis,ex))for(const off of[0,size]){const d=Math.abs(t.v-(min+off));if(d<=tol&&(!best||d<best.d))best={d,v:t.v-off,how:t.k};}
    if(best)return best;}
  const st=S.snap;return{v:Math.round(min/st)*st,how:''};}
/* angled walls: the axis targets above only cover walls along x or z. This moves the selection along the interior normal of
   the nearest angled wall so its footprint touches the wall's face (returns the extra offset, or null) */
const axisWall=w=>Math.abs(w.a[0]-w.b[0])<1e-4||Math.abs(w.a[1]-w.b[1])<1e-4;
function wallInN(w){const n=wallN(w),s=wallIn(w);return[n[0]*s,n[1]*s];}
function wallFaceSnap(list,tol){const P=[];for(const o of list)P.push(...foot(o));let best=null;
  for(const w of S.walls){if(axisWall(w))continue;const L=wallLen(w),u=wallU(w),n=wallInN(w);let mn=Infinity,mt=0;
    for(const p of P){const dd=(p[0]-w.a[0])*n[0]+(p[1]-w.a[1])*n[1];if(dd<mn){mn=dd;mt=(p[0]-w.a[0])*u[0]+(p[1]-w.a[1])*u[1];}}
    if(mt<-0.05||mt>L+0.05||Math.abs(mn)>tol)continue;if(!best||Math.abs(mn)<best.d)best={d:Math.abs(mn),dx:-n[0]*mn,dz:-n[1]*mn,w};}
  return best;}
/* turn the selection so its front (local +z) faces into the room from the nearest wall, then push it flush against that wall */
function alignToWall(){const list=selBoxes();if(!list.length||guardLocked())return;const b=bbox(list),c=[(b.x0+b.x1)/2,(b.z0+b.z1)/2];
  let w=null,bd=Infinity;for(const ww of S.walls){const d=segDist(c,ww.a,ww.b);if(d<bd){bd=d;w=ww;}}if(!w){flash('No walls to align to.');return;}
  const n=wallInN(w),a=Math.atan2(-n[0],n[1])*180/Math.PI,it=single(),cur=it?(it.kind==='b'?absYaw(it.o):it.g.rot||0):absYaw(list[0]),d=normDeg(a-cur);
  if(Math.abs(d)>1e-6){rotateItems(list,d,false);addGroupRot(sel,d);}
  const P=[];for(const o of list)P.push(...foot(o));let mn=Infinity;for(const p of P)mn=Math.min(mn,(p[0]-w.a[0])*n[0]+(p[1]-w.a[1])*n[1]);
  if(isFinite(mn))for(const o of selMove()){o.x-=n[0]*mn;o.z-=n[1]*mn;}
  commit();renderInspector();drawAll();flash(`Aligned to ${wallName(w)}: turned ${fmtIn(d)}° and pushed flush.`);}
function snapEdge(v,axis,ex,tol,free,origin){if(free)return{v,how:'free'};
  let best=null;for(const t of targets(axis,ex)){const d=Math.abs(t.v-v);if(d<=tol&&(!best||d<best.d))best={d,v:t.v,how:t.k};}
  if(best)return best;const st=S.snap,o=origin||0;return{v:o+Math.round((v-o)/st)*st,how:''};}
