'use strict';
/* Linewright — room building in the plan: tools (select, wall, room, door, window, fixture, reference line),
   orthogonal wall drawing with snapping, wall/opening/fixture/line selection and dragging, T-junction splitting,
   room detection from closed wall loops, and the Room panel. */

const PE=1e-4;
const peq=(a,b)=>Math.abs(a[0]-b[0])<PE&&Math.abs(a[1]-b[1])<PE;
const rnd=v=>+(+v).toFixed(4);
const isHz=w=>Math.abs(w.a[1]-w.b[1])<PE,isVt=w=>Math.abs(w.a[0]-w.b[0])<PE;
let draft=null;   // in-progress wall chain / room outline / reference line: {k,pts,added,cur,how}

const TOOL_HINT={
  select:'',
  wall:'Wall: click to start, click again for each corner. Directions snap to 15° steps, lengths to the grid. Click the start, an existing wall or press Enter / double-click to finish. Alt turns snapping off.',
  room:'Room outline: click the corners, click the first point (or press Enter) to close it.',
  door:'Door: click on a wall to add one.',window:'Window: click on a wall to add one.',
  fixture:'Fixture: click on a wall (ceiling light: anywhere in the room).',
  mark:'Reference line: click the start and end point.',
  measure:'Measure: click two points (faces in the perspective). Esc clears.'};
function setTool(t){if(t===tool&&t!=='select')t='select';finishDraft();tool=t;hover=null;
  if(t!=='measure'&&typeof MS!=='undefined')MS.pts=[];
  if(S.view==='sheet'&&t!=='select')tool='select';
  if(S.view==='persp'&&!['select','measure'].includes(t)){setView('plan');}
  renderTools();drawAll();}
function renderTools(){document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.tool===tool));
  const fx=$('fx-type');if(fx)fx.value=fx.value||'outlet';}

/* ---------- snapping for points ---------- */
function snapVals(i,incObj,skip){const v=[];
  for(const w of S.walls)for(const p of[w.a,w.b])if(!skip||!skip.some(q=>peq(q,p)))v.push(p[i]);
  for(const m of S.marks)for(const p of[m.a,m.b])if(!skip||!skip.some(q=>peq(q,p)))v.push(p[i]);
  if(draft)for(const p of draft.pts)v.push(p[i]);
  if(incObj)for(const o of S.objects)if(visible(o))for(const c of corners(o))v.push(c[i]);
  return v;}
function snap1v(v,cands,tol,free){if(free)return{v,how:'free'};let best=null;
  for(const c of cands){const d=Math.abs(c-v);if(d<=tol&&(!best||d<best.d))best={d,v:c};}
  if(best)return{v:best.v,how:'aligned'};const st=S.snap;return{v:Math.round(v/st)*st,how:''};}
function ptVals(incObj){const p=[];for(const w of S.walls)p.push(w.a,w.b);for(const m of S.marks)p.push(m.a,m.b);if(draft)p.push(...draft.pts);
  if(incObj)for(const o of S.objects)if(visible(o))p.push(...corners(o));return p;}
/* from: previous point → the direction snaps to 15° steps (0°/90° behave as before: aligned values, then the grid);
   an existing point near the cursor wins at any angle. how: 'end', 'on wall', 'aligned', 'free', '' (grid) or 'NN°' */
function snapPt(w,tol,free,from,incObj){let p=[w[0],w[1]];
  if(from){if(free)return{p:[rnd(p[0]),rnd(p[1])],how:'free'};
    let bp=null;for(const q of ptVals(incObj)){if(peq(q,from))continue;const d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d<=tol&&(!bp||d<bp.d))bp={d,q};}
    if(bp)return{p:[bp.q[0],bp.q[1]],how:'end'};
    const dx=p[0]-from[0],dz=p[1]-from[1],st=Math.PI/12,ang=Math.round(Math.atan2(dz,dx)/st)*st,deg=normDeg(ang*180/Math.PI);
    if(Math.abs(deg%90)<1e-6){const i=Math.abs(Math.abs(deg)-90)<1e-6?1:0;p[1-i]=from[1-i];
      const r=snap1v(p[i],snapVals(i,incObj),tol,false);p[i]=r.v;p=[rnd(p[0]),rnd(p[1])];
      const end=ptVals(incObj).some(q=>peq(q,p))&&!peq(p,from);
      return{p,how:end?'end':onAnyWall(p)?'on wall':r.how};}
    const u=[Math.cos(ang),Math.sin(ang)];let t=dx*u[0]+dz*u[1];
    /* where the snapped ray crosses an existing wall near the cursor */
    for(const ww of S.walls){const a=ww.a,b=ww.b,ex=b[0]-a[0],ez=b[1]-a[1],den=u[0]*ez-u[1]*ex;if(Math.abs(den)<1e-9)continue;
      const tt=((a[0]-from[0])*ez-(a[1]-from[1])*ex)/den,s=((a[0]-from[0])*u[1]-(a[1]-from[1])*u[0])/den;
      if(s>=-1e-6&&s<=1+1e-6&&tt>1e-3&&Math.abs(tt-t)<=tol)return{p:[rnd(from[0]+u[0]*tt),rnd(from[1]+u[1]*tt)],how:'on wall'};}
    /* line up with another point's x or z, else whole grid steps of length */
    let best=null;for(const i of[0,1]){if(Math.abs(u[i])<1e-6)continue;for(const v of snapVals(i,incObj)){const tt=(v-from[i])/u[i];if(tt<=1e-3)continue;const d=Math.abs(tt-t);if(d<=tol&&(!best||d<best.d))best={d,t:tt};}}
    if(best)t=best.t;else t=Math.round(t/S.snap)*S.snap;
    return{p:[rnd(from[0]+u[0]*t),rnd(from[1]+u[1]*t)],how:best?`${fmtIn(deg)}° · aligned`:`${fmtIn(deg)}°`};}
  if(free)return{p,how:'free'};
  let best=null;for(const q of ptVals(incObj)){const d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d<=tol&&(!best||d<best.d))best={d,q};}
  if(best)return{p:[best.q[0],best.q[1]],how:'end'};
  for(const ww of S.walls){const L=wallLen(ww);if(L<PE)continue;const u=wallU(ww),t=(p[0]-ww.a[0])*u[0]+(p[1]-ww.a[1])*u[1];if(t<0||t>L)continue;
    let q=[ww.a[0]+u[0]*t,ww.a[1]+u[1]*t];if(Math.hypot(q[0]-p[0],q[1]-p[1])>tol)continue;
    if(isHz(ww)||isVt(ww)){const i=isHz(ww)?0:1,lo=Math.min(ww.a[i],ww.b[i]),hi=Math.max(ww.a[i],ww.b[i]);q[i]=clamp(Math.round(q[i]/S.snap)*S.snap,lo,hi);}
    else{const ts=clamp(Math.round(t/S.snap)*S.snap,0,L);q=[ww.a[0]+u[0]*ts,ww.a[1]+u[1]*ts];}
    return{p:[rnd(q[0]),rnd(q[1])],how:'on wall'};}
  const rx=snap1v(p[0],snapVals(0,incObj),tol,false),rz=snap1v(p[1],snapVals(1,incObj),tol,false);
  return{p:[rnd(rx.v),rnd(rz.v)],how:rx.how||rz.how};}
function onAnyWall(p,skipIds){return S.walls.some(w=>{if(skipIds&&skipIds.includes(w.id))return false;if(peq(p,w.a)||peq(p,w.b))return true;
  const L=wallLen(w);if(L<PE)return false;const u=wallU(w),t=(p[0]-w.a[0])*u[0]+(p[1]-w.a[1])*u[1];
  return t>0&&t<L&&Math.abs((p[0]-w.a[0])*u[1]-(p[1]-w.a[1])*u[0])<PE*5;});}
function nearestWall(w,tol){let best=null;
  for(const ww of S.walls){const L=wallLen(ww);if(L<PE)continue;const u=wallU(ww),t=(w[0]-ww.a[0])*u[0]+(w[1]-ww.a[1])*u[1];if(t<-tol||t>L+tol)continue;
    const d=Math.abs((w[0]-ww.a[0])*u[1]-(w[1]-ww.a[1])*u[0]);if(d<=tol&&(!best||d<best.d))best={d,w:ww,t:clamp(t,0,L)};}
  return best;}

/* ---------- wall graph: splitting, faces, rooms ---------- */
function splitWall(w,pt){const L=wallLen(w),u=wallU(w),t=(pt[0]-w.a[0])*u[0]+(pt[1]-w.a[1])*u[1];if(t<1e-3||t>L-1e-3)return null;
  const nw={...w,id:uid('w'),a:[rnd(pt[0]),rnd(pt[1])],b:w.b};w.b=[rnd(pt[0]),rnd(pt[1])];S.walls.splice(S.walls.indexOf(w)+1,0,nw);
  for(const o of S.objects)if(o.pw===w.id&&o.pt>t){o.pw=nw.id;o.pt=rnd(o.pt-t);}
  for(const o of S.openings)if(o.wall===w.id&&o.off+o.w/2>t){o.wall=nw.id;o.off=rnd(Math.max(0,o.off-t));}
  for(const f of S.fixtures)if(f.wall===w.id&&f.off>t){f.wall=nw.id;f.off=rnd(f.off-t);}
  return nw;}
function onSegInterior(p,w){const L=wallLen(w);if(L<PE)return false;const u=wallU(w),t=(p[0]-w.a[0])*u[0]+(p[1]-w.a[1])*u[1];
  if(t<=1e-3||t>=L-1e-3)return false;return Math.abs((p[0]-w.a[0])*u[1]-(p[1]-w.a[1])*u[0])<PE*5;}
/* round coordinates, drop zero-length and duplicate walls, split walls where another wall ends on them (T-junctions) */
function normalizeWalls(){for(const w of S.walls){w.a=[rnd(w.a[0]),rnd(w.a[1])];w.b=[rnd(w.b[0]),rnd(w.b[1])];}
  S.walls=S.walls.filter(w=>wallLen(w)>1e-3);const seen=[];
  S.walls=S.walls.filter(w=>{if(seen.some(v=>(peq(v.a,w.a)&&peq(v.b,w.b))||(peq(v.a,w.b)&&peq(v.b,w.a))))return false;seen.push(w);return true;});
  let guard=0,changed=true;
  while(changed&&guard++<300){changed=false;
    outer:for(const w of S.walls)for(const v of S.walls){if(v===w)continue;for(const p of[v.a,v.b])if(onSegInterior(p,w)){splitWall(w,p);changed=true;break outer;}}}
  const ids=new Set(S.walls.map(w=>w.id));S.openings=S.openings.filter(o=>ids.has(o.wall));S.fixtures=S.fixtures.filter(f=>FX[f.type].flat||f.obj||ids.has(f.wall));
  for(const o of S.openings){const L=wallLen(wallById(o.wall));o.w=Math.min(o.w,L);o.off=rnd(clamp(o.off,0,L-o.w));}}
function simplifyPoly(pts){const a=pts.map(p=>[p[0],p[1]]);let ch=true;
  while(ch&&a.length>2){ch=false;for(let i=0;i<a.length;i++){const p=a[(i-1+a.length)%a.length],q=a[i],r=a[(i+1)%a.length];
    const cr=(q[0]-p[0])*(r[1]-q[1])-(q[1]-p[1])*(r[0]-q[0]);if(peq(p,q)||Math.abs(cr)<1e-7){a.splice(i,1);ch=true;break;}}}
  return a;}
/* bounded faces of the wall graph (half-edge walk, always taking the next edge clockwise); positive area = enclosed room */
function wallFaces(){const nodes=[],nid=p=>{for(let i=0;i<nodes.length;i++)if(peq(nodes[i],p))return i;nodes.push([p[0],p[1]]);return nodes.length-1;};
  const adj=[],add=(a,b)=>{(adj[a]=adj[a]||[]);if(!adj[a].includes(b))adj[a].push(b);};
  for(const w of S.walls){if(wallLen(w)<1e-3)continue;const a=nid(w.a),b=nid(w.b);if(a===b)continue;add(a,b);add(b,a);}
  const ang=(a,b)=>Math.atan2(nodes[b][1]-nodes[a][1],nodes[b][0]-nodes[a][0]);
  for(let i=0;i<nodes.length;i++)if(adj[i])adj[i].sort((p,q)=>ang(i,p)-ang(i,q));
  const used=new Set(),faces=[];
  for(let a=0;a<nodes.length;a++)for(const b of adj[a]||[]){if(used.has(a+'>'+b))continue;const cyc=[];let u=a,v=b,n=0;
    while(n++<2000){const k=u+'>'+v;if(used.has(k))break;used.add(k);cyc.push(u);const L=adj[v],i=L.indexOf(u),nx=L[(i-1+L.length)%L.length];u=v;v=nx;}
    const pts=simplifyPoly(cyc.map(i=>nodes[i]));if(pts.length>=3&&polyArea(pts)>1e-3)faces.push(pts);}
  return faces;}
function nextRoomName(taken){let i=1;const names=new Set(S.rooms.map(r=>r.name).concat(taken||[]));while(names.has('Room '+i))i++;return'Room '+i;}
/* keep named rooms that still match a closed loop (their label point is inside it), add new loops, drop vanished auto rooms */
function detectRooms(){const faces=wallFaces(),used=new Set(),fresh=[];
  const ok=r=>!used.has(r.id)&&!r.drawn&&r.pts&&r.pts.length>2;
  for(const f of faces){const pts=f.map(p=>[rnd(p[0]),rnd(p[1])]);
    let r=S.rooms.find(r=>ok(r)&&pointInPoly(polyInner(r.pts),pts))||S.rooms.find(r=>ok(r)&&pointInPoly(polyInner(pts),r.pts));
    if(r){used.add(r.id);r.pts=pts;r.auto=true;}
    else{const nr={id:uid('r'),name:nextRoomName(fresh.map(x=>x.name)),pts,auto:true,drawn:false};fresh.push(nr);}}
  S.rooms=S.rooms.filter(r=>r.drawn||used.has(r.id)).concat(fresh);
  if(psel&&psel.k==='room'&&!pselObj())psel=null;
  return fresh.length;}

/* ---------- moving wall points ---------- */
function collinearW(v,w){const u=wallU(w),cr=x=>Math.abs((x[0]-w.a[0])*u[1]-(x[1]-w.a[1])*u[0]);return cr(v.a)<PE*5&&cr(v.b)<PE*5;}
function perpW(v,w){const a=wallU(v),b=wallU(w);return Math.abs(a[0]*b[0]+a[1]*b[1])<1e-3;}
/* endpoints of the straight run of walls that w belongs to (pieces split at T-junctions move together) */
function chainPts(w){const chain=[w],pts=[w.a,w.b];let grow=true;
  while(grow){grow=false;for(const v of S.walls){if(chain.includes(v)||!collinearW(v,w))continue;if(pts.some(p=>peq(p,v.a)||peq(p,v.b))){chain.push(v);pts.push(v.a,v.b);grow=true;}}}
  return pts.map(p=>[p[0],p[1]]);}
/* the snapshot also holds objects attached to walls, and what is attached to those, so a drag preview can start from the same place every step */
function wallSnap(){const att=S.objects.filter(o=>o.pw),all=[...new Set(att.concat(descendants(att)))];
  return{walls:JSON.parse(JSON.stringify(S.walls)),openings:JSON.parse(JSON.stringify(S.openings)),fixtures:JSON.parse(JSON.stringify(S.fixtures)),objects:JSON.parse(JSON.stringify(all))};}
function restoreSnap(sn){S.walls=JSON.parse(JSON.stringify(sn.walls));S.openings=JSON.parse(JSON.stringify(sn.openings));S.fixtures=JSON.parse(JSON.stringify(sn.fixtures));
  for(const c of sn.objects||[]){const o=byId(c.id);if(o)Object.assign(o,JSON.parse(JSON.stringify(c)));}}
/* every wall endpoint that sits on one of pts moves by dv; openings and fixtures keep their place in the world */
function movePts(sn,pts,dv){restoreSnap(sn);
  const mv=p=>pts.some(q=>peq(q,p))?[rnd(p[0]+dv[0]),rnd(p[1]+dv[1])]:[p[0],p[1]];
  for(const w of S.walls){w.a=mv(w.a);w.b=mv(w.b);}
  keepOnWalls(sn);}
function keepOnWalls(sn){const sw=id=>sn.walls.find(w=>w.id===id);
  const place=(id,off,size)=>{const w0=sw(id),w=wallById(id);if(!w0||!w)return null;const u0=wallU(w0),c=[w0.a[0]+u0[0]*off,w0.a[1]+u0[1]*off],u=wallU(w);
    return{t:(c[0]-w.a[0])*u[0]+(c[1]-w.a[1])*u[1],L:wallLen(w)};};
  for(const o of S.openings){const s=sn.openings.find(x=>x.id===o.id);if(!s)continue;const r=place(o.wall,s.off+s.w/2);if(!r)continue;
    o.w=Math.min(s.w,r.L);o.off=rnd(clamp(r.t-o.w/2,0,r.L-o.w));}
  for(const f of S.fixtures){if(FX[f.type].flat||f.obj)continue;const s=sn.fixtures.find(x=>x.id===f.id);if(!s)continue;const r=place(f.wall,s.off);if(!r)continue;f.off=rnd(clamp(r.t,0,r.L));}
  /* objects attached to a wall: back into the wall's frame, keeping their place along it where possible */
  for(const o of S.objects){if(!o.pw)continue;const s=(sn.objects||[]).find(x=>x.id===o.id),w=wallById(o.pw),w0=sn.walls.find(x=>x.id===o.pw);if(!s||!w||!w0)continue;
    const u0=wallU(w0),n0=wallInN(w0),c0=[w0.a[0]+u0[0]*s.pt+n0[0]*s.pn,w0.a[1]+u0[1]*s.pt+n0[1]*s.pn],u=wallU(w),
      t=clamp((c0[0]-w.a[0])*u[0]+(c0[1]-w.a[1])*u[1],0,wallLen(w)),cc=[o.x+o.w/2,o.z+o.d/2],aa=absYaw(o);
    placeOnWall(o,w,t,s.pn,s.pa);followParent(o,cc,aa);}}
/* points that move when the given end of w slides along w: the end, plus the straight runs of walls meeting it at 90° */
function endPts(w,e){const P=w[e],pts=[[P[0],P[1]]];
  for(const v of S.walls){if(v===w||!(peq(v.a,P)||peq(v.b,P))||!perpW(v,w))continue;for(const q of chainPts(v))if(!pts.some(x=>peq(x,q)))pts.push(q);}
  return pts;}
function afterWalls(){normalizeWalls();detectRooms();}
function setWallLen(w,L){L=Math.max(0.05,+L||0);const d=L-wallLen(w);if(Math.abs(d)<1e-6)return;const u=wallU(w),sn=wallSnap();
  movePts(sn,endPts(w,'b'),[u[0]*d,u[1]*d]);afterWalls();commit();renderRooms();size();flash(`Wall length ${fmt(L)} m. Walls meeting its end moved with it.`);}
/* turn a wall about its start: the end point moves, walls meeting it there follow that corner */
function setWallAng(w,deg){const L=wallLen(w),a=deg*Math.PI/180,nb=[rnd(w.a[0]+Math.cos(a)*L),rnd(w.a[1]+Math.sin(a)*L)],sn=wallSnap();
  movePts(sn,[[w.b[0],w.b[1]]],[nb[0]-w.b[0],nb[1]-w.b[1]]);afterWalls();commit();renderRooms();size();flash(`Wall turned to ${fmtIn(deg)}°. Walls meeting its end followed that corner.`);}
function deleteWall(id){S.walls=S.walls.filter(w=>w.id!==id);S.openings=S.openings.filter(o=>o.wall!==id);S.fixtures=S.fixtures.filter(f=>f.wall!==id||FX[f.type].flat);
  if(psel&&psel.id===id)psel=null;detectRooms();}

/* ---------- rotating the whole room ----------
   Everything that has a place in the plan turns about the middle of the walls (and drawn rooms) by deg, clockwise on screen:
   walls, rooms, reference lines, floor/ceiling fixtures, objects and their groups' rotation, scenarios, the camera.
   Things anchored to walls or objects (openings, wall and object fixtures, attached objects) keep their anchors. */
function rotateRoom(deg){if(S.lockWalls){flash('Walls are locked. Press K or click Lock walls to unlock them.');return;}
  deg=normDeg(+deg||0);if(Math.abs(deg)<1e-6)return;if(!S.walls.length&&!S.objects.length){flash('Nothing to rotate yet.');return;}
  const b=worldBounds(),P=[(b.x0+b.x1)/2,(b.z0+b.z1)/2],a=deg*Math.PI/180,r12=v=>Math.round(v*1e12)/1e12,ca=r12(Math.cos(a)),sa=r12(Math.sin(a));
  const rp=q=>{const dx=q[0]-P[0],dz=q[1]-P[1];return[rnd(P[0]+dx*ca-dz*sa),rnd(P[1]+dx*sa+dz*ca)];};
  /* scenarios first, from copies of the layout they describe: apply, turn, capture the entries they already had */
  const turnObjs=(objs,groups)=>{for(const o of objs){const c=rp([o.x+o.w/2,o.z+o.d/2]);o.x=c[0]-o.w/2;o.z=c[1]-o.d/2;o.rot=(o.rot||0)+deg;normRot(o);}
    for(const g of groups){g.rot=normDeg((g.rot||0)+deg);if(g.preset)g.preset.rot=(((g.preset.rot||0)+deg)%360+360)%360;}};
  for(const sc of S.scenarios){const objs=S.objects.map(o=>({...o,poly:o.poly?o.poly.map(p=>p.slice()):null})),groups=S.groups.map(g=>({...g,preset:g.preset?{...g.preset}:null}));
    scApply(objs,groups,sc);turnObjs(objs,groups);const cap=scCapture(objs,groups);
    for(const k in sc.pos)if(cap.pos[k])sc.pos[k]=cap.pos[k];for(const k in sc.grp)if(cap.grp[k])sc.grp[k]=cap.grp[k];}
  turnObjs(S.objects,S.groups);
  for(const w of S.walls){w.a=rp(w.a);w.b=rp(w.b);}
  for(const r of S.rooms)r.pts=r.pts.map(rp);
  for(const m of S.marks){m.a=rp(m.a);m.b=rp(m.b);}
  for(const f of S.fixtures)if(FX[f.type].flat){const c=rp([f.x,f.z]);f.x=c[0];f.z=c[1];}
  const cp=rp([S.cx,S.cz]);S.cx=cp[0];S.cz=cp[1];S.yaw=normDeg(S.yaw+deg);
  afterWalls();clampCam();commit();renderAll();size();PV.x=0;PV.y=0;
  flash(`Room turned ${fmtIn(deg)}° clockwise. Undo brings it back.`);}

/* ---------- plan element selection ---------- */
function selectP(k,id){psel=k?{k,id}:null;if(psel&&sel.length){sel=[];renderInspector();renderList();}
  if(psel&&S.view==='plan'&&!settingsOpen&&S.panels.plan!=='rooms')setPanel('rooms');
  if(psel&&(psel.k==='fx'||psel.k==='op')&&S.view==='persp'&&!settingsOpen&&S.panels.persp!=='pfx')setPanel('pfx');
  renderRooms();updToolbar();drawAll();
  if(psel){const el=document.querySelector(`[data-psel-row="${psel.id}"]`);if(el)el.scrollIntoView({block:'nearest'});}}
function delPsel(){const o=pselObj();if(!o)return false;const k=psel.k;if(k==='wall'&&S.lockWalls){flash('Walls are locked. Press K or click Lock walls to unlock them.');return true;}
  if(k==='fx'&&fxLocked(o)){flash('This fixture is locked. Untick Locked in its settings (or unlock its object) to delete it.');return true;}
  if(k==='op'&&o.locked){flash('This opening is locked. Untick Locked in its settings to delete it.');return true;}
  if(k==='wall')deleteWall(o.id);else if(k==='op')S.openings=S.openings.filter(x=>x!==o);else if(k==='fx')S.fixtures=S.fixtures.filter(x=>x!==o);
  else if(k==='mark')S.marks=S.marks.filter(x=>x!==o);else if(k==='room')S.rooms=S.rooms.filter(x=>x!==o);
  psel=null;commit();renderRooms();size();flash({wall:'Wall',op:'Opening',fx:'Fixture',mark:'Reference line',room:'Room'}[k]+' deleted. Undo brings it back.');return true;}

/* ---------- plan pointer (called from plan.js) ---------- */
function openingPts(o,X){const w=wallById(o.wall);if(!w)return null;const u=wallU(w);return[X.to(w.a[0]+u[0]*o.off,w.a[1]+u[1]*o.off),X.to(w.a[0]+u[0]*(o.off+o.w),w.a[1]+u[1]*(o.off+o.w))];}
/* ---------- openings in the perspective: outline, picking, gizmo (along the wall; windows also up and down), drag ---------- */
function opOutline(o,w){const P=(t,y)=>wallP(w,t,y),t0=o.off,t1=o.off+o.w,y0=o.type==='door'?0:o.sill,y1=o.type==='door'?o.h:o.sill+o.h;
  return[P(t0,y0),P(t1,y0),P(t1,y1),P(t0,y1)];}
function opPickP(p,tol){let best=null,bd=tol;
  for(const o of S.openings){const w=wallById(o.wall);if(!w)continue;const pts=opOutline(o,w);
    for(let i=0;i<4;i++){const s=clipProj(pts[i],pts[(i+1)%4]);if(!s)continue;const d=segDist(p,s[0],s[1]);if(d<bd){bd=d;best=o;}}}
  return best;}
function opGizmo(){if(!psel||psel.k!=='op'||S.trace||layerMode()||S.view!=='persp'||sel.length)return null;
  const o=S.openings.find(x=>x.id===psel.id),w=o&&wallById(o.wall);if(!o||!w||o.locked)return null;
  const u=wallU(w),O=wallP(w,o.off+o.w/2,o.type==='door'?o.h/2:o.sill+o.h/2),c0=toCam(O);if(c0[2]<NEAR)return null;
  const p0=proj(c0),L=50*K,G={p0,O,o,axes:[]},list=[['along',[u[0],0,u[1]],Math.abs(u[0])>=Math.abs(u[1])?C.gx:C.gz]];
  if(o.type==='window')list.push(['y',[0,1,0],C.gy]);
  for(const[axis,v,col]of list){const e=0.01,c1=toCam([O[0]+v[0]*e,O[1]+v[1]*e,O[2]+v[2]*e]);if(c1[2]<NEAR)continue;
    const p1=proj(c1),dx=(p1[0]-p0[0])/e,dy=(p1[1]-p0[1])/e,len=Math.hypot(dx,dy);if(len<1e-6)continue;const dir=[dx/len,dy/len];
    G.axes.push({axis,dir,col,ppm:Math.max(len,40*K),end:[p0[0]+dir[0]*L,p0[1]+dir[1]*L]});}
  return G;}
/* wd metres along the gizmo axis: along snaps like in the plan; the sill snaps to the floor, the ceiling-high head, other windows and fixtures on the wall */
function opDrag(wd,tol,free){const o=S.openings.find(x=>x.id===drag.id),w=o&&wallById(o.wall);if(!o||!w||o.locked)return;
  if(drag.axis==='along'){const L=wallLen(w),r=snapSpan(drag.o0.off+wd,o.w,wallCands(w,o.id),tol,free,0);o.off=rnd(clamp(r.v,0,L-o.w));
    drag.text=`from start ${fmt(o.off)} m · to end ${fmt(L-o.off-o.w)} m`+(r.how==='snap'?' · snap':'');}
  else{const H=wallH(w),c=[0,Math.max(0,H-o.h)].concat(S.openings.filter(x=>x!==o&&x.wall===o.wall&&x.type==='window').map(x=>x.sill),S.fixtures.filter(f=>f.wall===o.wall).map(f=>f.y)),
      r=snap1v(drag.o0.sill+wd,c,tol,free);o.sill=rnd(clamp(r.v,0,Math.max(0,H-o.h)));drag.text=`sill ${fmt(o.sill)} m · top ${fmt(o.sill+o.h)} m`+(r.how==='aligned'?' · lined up':'');}
  updatePselFields();}
function elemHit(p,tol,X){const o=pselObj(),ht=tol+3*KP;
  if(o&&psel.k==='wall')for(const e of['a','b'])if(dist(p,X.to(o[e][0],o[e][1]))<ht)return{t:'wend',w:o,e};
  if(o&&psel.k==='op'){const q=openingPts(o,X);if(q)for(let i=0;i<2;i++)if(dist(p,q[i])<ht)return{t:'opend',o,i};}
  if(o&&psel.k==='mark')for(const e of['a','b'])if(dist(p,X.to(o[e][0],o[e][1]))<ht)return{t:'mend',m:o,e};
  const f=fxHit(p,tol,X);if(f)return{t:'fx',f};
  for(const op of S.openings){const q=openingPts(op,X);if(q&&segDist(p,q[0],q[1])<tol)return{t:'op',o:op};
    if(op.type==='door'){const w=wallById(op.wall);if(!w)continue;const g=doorGeom(op,w),H=X.to(g.H[0],g.H[1]),T=X.to(g.H[0]+g.d1[0]*g.r,g.H[1]+g.d1[1]*g.r);if(segDist(p,H,T)<tol)return{t:'op',o:op};}}
  return null;}
function elemHit2(p,tol,X){for(const m of S.marks)if(segDist(p,X.to(m.a[0],m.a[1]),X.to(m.b[0],m.b[1]))<tol)return{t:'mark',m};
  let best=null,bd=tol;for(const w of S.walls){const d=segDist(p,X.to(w.a[0],w.a[1]),X.to(w.b[0],w.b[1]));if(d<bd){bd=d;best=w;}}
  if(best)return{t:'wall',w:best};
  const wp=X.from(p[0],p[1]);for(const r of S.rooms.slice().reverse())if(r.pts&&r.pts.length>2&&pointInPoly(wp,r.pts))return{t:'room',r};
  return null;}
function startElemDrag(h,p,X,e){const base={view:'v',b:true,start:p,cur:p,moved:false,w0:X.from(p[0],p[1])};
  if((h.t==='wall'||h.t==='wend')&&S.lockWalls){selectP('wall',h.w.id);drag={...base,t:'wlocked'};}
  else if(h.t==='wall'||h.t==='wend'){selectP('wall',h.w.id);const w=h.w,sn=wallSnap(),corner=h.t==='wend'&&e&&e.shiftKey;
    /* Shift on an end: move that corner freely (walls meeting there turn with it) — this is how walls get an angle after drawing */
    drag={...base,t:corner?'wcorner':h.t,id:w.id,e:h.e,sn,P0:h.t==='wend'?[w[h.e][0],w[h.e][1]]:null,pts:h.t==='wall'?chainPts(w):corner?[[w[h.e][0],w[h.e][1]]]:endPts(w,h.e),onEnd:()=>{afterWalls();renderRooms();size();}};}
  else if((h.t==='op'||h.t==='opend')&&h.o.locked){selectP('op',h.o.id);drag={...base,t:'oplocked'};}
  else if(h.t==='op'||h.t==='opend'){selectP('op',h.o.id);drag={...base,t:h.t,id:h.o.id,i:h.i,o0:{off:h.o.off,w:h.o.w},onEnd:()=>renderRooms()};}
  else if(h.t==='fx'&&fxLocked(h.f)){selectP('fx',h.f.id);drag={...base,t:'fxlocked'};}
  else if(h.t==='fx'){selectP('fx',h.f.id);drag={...base,t:'fx',id:h.f.id,f0:{off:h.f.off,x:h.f.x,z:h.f.z},onEnd:()=>renderRooms()};}
  else if(h.t==='mark'||h.t==='mend'){selectP('mark',h.m.id);drag={...base,t:h.t,id:h.m.id,e:h.e,m0:{a:[...h.m.a],b:[...h.m.b]},onEnd:()=>renderRooms()};}
  else if(h.t==='room'){selectP('room',h.r.id);drag={...base,t:'empty',keep:true};}}
/* 1-D snap of an interval [min, min+size] to candidate values, else the grid (relative to origin) */
function snapSpan(min,size,cands,tol,free,origin){if(free)return{v:min,how:'free'};let best=null;
  for(const c of cands)for(const off of size?[0,size]:[0]){const d=Math.abs(c-(min+off));if(d<=tol&&(!best||d<best.d))best={d,v:c-off,how:'snap'};}
  if(best)return best;const st=S.snap,o=origin||0;return{v:o+Math.round((min-o)/st)*st,how:''};}
function wallCands(w,exId){const L=wallLen(w),c=[0,L];
  for(const o of S.openings)if(o.wall===w.id&&o.id!==exId)c.push(o.off,o.off+o.w);
  for(const f of S.fixtures)if(f.wall===w.id&&f.id!==exId)c.push(f.off);
  /* line up with openings/fixtures on the parallel wall opposite */
  return c;}
function elemDragMove(e,p){if(drag.t==='fxlocked'||drag.t==='wlocked'||drag.t==='oplocked'){if(!drag.warned){drag.warned=true;
    flash(drag.t==='wlocked'?'Walls are locked. Press K or click Lock walls to unlock them.':drag.t==='oplocked'?'This opening is locked. Untick Locked in its settings to move it.':
      'This fixture is locked. Untick Locked in its settings (or unlock its object) to move it.');}return;}
  const X=planXf(),s=X.s,wp=X.from(p[0],p[1]),free=e.altKey,tol=10*KP/s,d=[wp[0]-drag.w0[0],wp[1]-drag.w0[1]];
  if(drag.t==='wall'){const w0=drag.sn.walls.find(w=>w.id===drag.id);if(!w0)return;const n=wallN(w0);let dd=d[0]*n[0]+d[1]*n[1];
    if(isHz(w0)||isVt(w0)){const i=isHz(w0)?1:0,orig=w0.a[i],r=snap1v(orig+dd*n[i],snapVals(i,false,drag.pts),tol,free);dd=(r.v-orig)*n[i];}
    else if(!free)dd=Math.round(dd/S.snap)*S.snap;
    movePts(drag.sn,drag.pts,[n[0]*dd,n[1]*dd]);detectRooms();const w=wallById(drag.id);
    drag.text=`moved ${dd>=0?'+':''}${fmt(dd)} m`+(w&&(isHz(w)||isVt(w))?` · ${fmt(isHz(w)?w.a[1]:w.a[0])}`:'');}
  else if(drag.t==='wcorner'){const P=drag.P0,q=[P[0]+d[0],P[1]+d[1]];restoreSnap(drag.sn);let r;
    if(free)r={p:[rnd(q[0]),rnd(q[1])],how:'free'};
    else{let bp=null;for(const w of S.walls)for(const x of[w.a,w.b]){if(peq(x,P))continue;const dd=Math.hypot(x[0]-q[0],x[1]-q[1]);if(dd<=tol&&(!bp||dd<bp.d))bp={d:dd,x};}
      if(bp)r={p:[bp.x[0],bp.x[1]],how:'corner'};
      else{const rx=snap1v(q[0],snapVals(0,false,[P]),tol,false),rz=snap1v(q[1],snapVals(1,false,[P]),tol,false);r={p:[rnd(rx.v),rnd(rz.v)],how:rx.how||rz.how};}}
    movePts(drag.sn,drag.pts,[r.p[0]-P[0],r.p[1]-P[1]]);detectRooms();const w=wallById(drag.id);
    drag.text=w?`corner ${fmt(r.p[0])}, ${fmt(r.p[1])} · ${fmt(wallLen(w))} m at ${fmtIn(wallAng(w))}°`+(r.how?' · '+r.how:''):'';}
  else if(drag.t==='wend'){const w0=drag.sn.walls.find(w=>w.id===drag.id);if(!w0)return;const u=wallU(w0),P=w0[drag.e];let dd=d[0]*u[0]+d[1]*u[1];
    if(isHz(w0)||isVt(w0)){const i=isHz(w0)?0:1,r=snap1v(P[i]+dd*u[i],snapVals(i,false,drag.pts),tol,free);dd=(r.v-P[i])*u[i];}
    else if(!free){const L0=wallLen(w0),Ls=Math.round((drag.e==='b'?L0+dd:L0-dd)/S.snap)*S.snap;dd=drag.e==='b'?Ls-L0:L0-Ls;}
    const L0=wallLen(w0),L=drag.e==='b'?L0+dd:L0-dd;if(L<0.05)dd=drag.e==='b'?0.05-L0:L0-0.05;
    movePts(drag.sn,drag.pts,[u[0]*dd,u[1]*dd]);detectRooms();const w=wallById(drag.id);drag.text=w?`length ${fmt(wallLen(w))} m`:'';}
  else if(drag.t==='op'||drag.t==='opend'){const o=S.openings.find(x=>x.id===drag.id),w=o&&wallById(o.wall);if(!w)return;const u=wallU(w),L=wallLen(w),dt=d[0]*u[0]+d[1]*u[1],c=wallCands(w,o.id);
    if(drag.t==='op'){const r=snapSpan(drag.o0.off+dt,drag.o0.w,c,tol,free,0);o.off=rnd(clamp(r.v,0,L-o.w));drag.text=`from start ${fmt(o.off)} m · to end ${fmt(L-o.off-o.w)} m`+(r.how==='snap'?' · snap':'');}
    else{const e0=drag.o0.off,e1=drag.o0.off+drag.o0.w,mn=0.2;
      if(drag.i===0){const r=snapSpan(e0+dt,0,c,tol,free,0),v=clamp(r.v,0,e1-mn);o.off=rnd(v);o.w=rnd(e1-v);}
      else{const r=snapSpan(e1+dt,0,c,tol,free,0),v=clamp(r.v,e0+mn,L);o.w=rnd(v-e0);}
      drag.text=`width ${fmt(o.w)} m`;}}
  else if(drag.t==='fx'){const f=fxById(drag.id);if(!f)return;
    if(fxTop(f)){topMove(f,drag.f0,d[0],d[1],tol,free);drag.text=`${fmt(f.x)}, ${fmt(f.z)} m from the centre of the top`;}
    else if(FX[f.type].flat){const rx=snap1v(drag.f0.x+d[0],snapVals(0),tol,free),rz=snap1v(drag.f0.z+d[1],snapVals(1),tol,free);f.x=rnd(rx.v);f.z=rnd(rz.v);drag.text=`x ${fmt(f.x)}  z ${fmt(f.z)} m`;}
    else{const A=fxPlan(f);if(!A)return;const u=A.u,L=A.L,r=snapSpan(drag.f0.off+d[0]*u[0]+d[1]*u[1],0,fxCands(f),tol,free,0);
      f.off=rnd(clamp(r.v,0,L));drag.text=`${fmt(f.off)} m along · ${fmt(fxY(f))} m high`;}}
  else if(drag.t==='mark'||drag.t==='mend'){const m=S.marks.find(x=>x.id===drag.id);if(!m)return;const a=drag.m0.a,b=drag.m0.b,hz=Math.abs(a[1]-b[1])<PE,vt=Math.abs(a[0]-b[0])<PE;
    if(drag.t==='mark'){/* moves freely both ways, each axis snapping to other points and the grid; Shift keeps a straight line on its own axis */
      const sk=[a,b],rx=snap1v(a[0]+d[0],snapVals(0,false,sk),tol,free),rz=snap1v(a[1]+d[1],snapVals(1,false,sk),tol,free),keep=e.shiftKey&&(hz||vt);
      const dv=keep?(hz?[0,rz.v-a[1]]:[rx.v-a[0],0]):[rx.v-a[0],rz.v-a[1]];
      m.a=[rnd(a[0]+dv[0]),rnd(a[1]+dv[1])];m.b=[rnd(b[0]+dv[0]),rnd(b[1]+dv[1])];drag.text=`from ${fmt(m.a[0])}, ${fmt(m.a[1])} m`;}
    else{const P=drag.m0[drag.e],o=drag.m0[drag.e==='a'?'b':'a'],r=snapPt([P[0]+d[0],P[1]+d[1]],tol,free,o,false);m[drag.e]=r.p;
      drag.text=`length ${fmt(dist(m.a,m.b))} m`;}}
  updatePselFields();}
function draftDown(p,X,e){const tolM=10*KP/X.s,w=X.from(p[0],p[1]),last=draft&&draft.pts.length?draft.pts[draft.pts.length-1]:null;
  const r=snapPt(w,tolM,e.altKey,tool==='measure'?null:last,tool==='measure');
  if(tool==='measure'){measurePlanClick([r.p[0],0,r.p[1]]);return;}
  if(!draft){draft={k:tool,pts:[r.p],added:[],cur:r.p,how:r.how};drawAll();return;}
  if(peq(r.p,last))return;
  if(tool==='mark'){const m={id:uid('m'),a:last,b:r.p,label:'Line '+(S.marks.length+1)};S.marks.push(m);draft=null;commit();setTool('select');selectP('mark',m.id);
    const inp=$('pm-label');if(inp){inp.focus();inp.select();}flash('Reference line added. Name it in the Room panel.');return;}
  if(tool==='room'){if(peq(r.p,draft.pts[0])&&draft.pts.length>=3){finishDraft();return;}draft.pts.push(r.p);drawAll();return;}
  /* wall */
  const wl=normWall({id:uid('w'),a:last,b:r.p,h:null}),hitsWall=onAnyWall(r.p,draft.added);S.walls.push(wl);draft.added.push(wl.id);draft.pts.push(r.p);
  if(peq(r.p,draft.pts[0])||(hitsWall&&draft.pts.length>=2))finishDraft();else drawAll();}
function finishDraft(){const d=draft;draft=null;if(!d)return;
  if(d.k==='wall'&&d.added.length){afterWalls();commit();renderRooms();size();const n=S.rooms.length;flash(`${d.added.length} wall${d.added.length>1?'s':''} added · ${n} room${n===1?'':'s'}. Drag a wall to move it, its end to change its length.`);}
  else if(d.k==='room'&&d.pts.length>=3){const r={id:uid('r'),name:nextRoomName(),pts:d.pts.map(p=>[p[0],p[1]]),auto:false,drawn:true};S.rooms.push(r);commit();setTool('select');selectP('room',r.id);
    const inp=$('pr-name');if(inp){inp.focus();inp.select();}}
  drawAll();}
function planToolDown(e,p){if(S.view!=='plan'&&S.view!=='persp')return false;const X=planXf(),tol=(e.pointerType==='touch'?18:8)*KP,w=X.from(p[0],p[1]);
  if(['wall','room','mark','measure'].includes(tool)){draftDown(p,X,e);return true;}
  if(tool==='door'||tool==='window'){const h=nearestWall(w,tol/X.s*1.6);if(!h){flash(`Click on a wall to add a ${tool}.`);return true;}
    const L=wallLen(h.w),ww=Math.min(tool==='door'?0.8:1.0,L),off=rnd(clamp(Math.round((h.t-ww/2)/S.snap)*S.snap,0,L-ww));
    const o=tool==='door'?{id:uid('op'),wall:h.w.id,type:'door',off,w:ww,h:2.1,sill:0,hinge:'a',side:1,angle:90,entrance:false}:{id:uid('op'),wall:h.w.id,type:'window',off,w:ww,h:1.2,sill:0.9};
    S.openings.push(o);commit();setTool('select');selectP('op',o.id);flash(`${tool==='door'?'Door':'Window'} added. Drag it along the wall, drag its ends to resize.`);return true;}
  if(tool==='fixture'){const type=$('fx-type').value||'outlet',T=FX[type];let f;
    if(T.flat){f=addFixture(type,null,0,[rnd(Math.round(w[0]/S.snap)*S.snap),rnd(Math.round(w[1]/S.snap)*S.snap)]);}
    else{const tw=tol/X.s*1.6,h=nearestWall(w,tw),of=nearestFace(w,tw),tp=!T.nottop&&!of?topAt(w):null;
      if(!h&&!of&&!tp){flash(`Click on a wall${T.nottop?' or the side of an object':', the side of an object or its top'} to place it.`);return true;}
      if(tp)f=addFixture(type,null,0,null,{o:tp.o,top:true,lx:tp.lx,lz:tp.lz});
      else if(of&&(!h||of.d<h.d))f=addFixture(type,null,Math.round(of.t/S.snap)*S.snap,null,of);else f=addFixture(type,h.w,Math.round(h.t/S.snap)*S.snap);}
    commit();selectP('fx',f.id);flash(`${T.label} added${f.obj?' on '+objLabel(byId(f.obj))+', '+(f.top?'top':faceName(byId(f.obj),f.face).toLowerCase())+'. It moves and turns with it':''}. Pick another spot to add more, or press V to select.`);return true;}
  /* select tool: object handles and camera first, then plan elements, then objects, then walls/lines/rooms */
  const ph=planHit(p,tol);if(ph.t==='rot'||ph.t==='corner'||ph.t==='cam')return false;
  const h=elemHit(p,tol,X);if(h){startElemDrag(h,p,X,e);try{pv.setPointerCapture(e.pointerId);}catch(_){}drawAll();return true;}
  if(ph.t==='box'){if(psel){psel=null;renderRooms();}return false;}
  const h2=elemHit2(p,tol,X);if(h2){startElemDrag(h2,p,X,e);try{pv.setPointerCapture(e.pointerId);}catch(_){}drawAll();return true;}
  return false;}
function planToolMove(e,p){const X=planXf();
  if(drag&&drag.view==='v'&&drag.b){drag.cur=p;if(dist(p,drag.start)>3*KP)drag.moved=true;if(drag.moved&&drag.t!=='empty')elemDragMove(e,p);drawAll();return true;}
  if(drag)return false;
  if(['wall','room','mark','measure'].includes(tool)){const w=X.from(p[0],p[1]),last=draft&&draft.pts.length?draft.pts[draft.pts.length-1]:null;
    const r=snapPt(w,10*KP/X.s,e.altKey,tool==='measure'?null:last,tool==='measure');
    hover={p:r.p,how:r.how,scr:p};pv.style.cursor='crosshair';drawAll();return true;}
  if(tool!=='select'){const w=X.from(p[0],p[1]),tw=(e.pointerType==='touch'?18:8)*KP/X.s*1.6;hover={p:w,scr:p,wall:nearestWall(w,tw)};
    if(tool==='fixture'){const of=nearestFace(w,tw);if(of&&(!hover.wall||of.d<hover.wall.d)){hover.face=of;hover.wall=null;}
      const T=FX[$('fx-type').value];if(!hover.face&&T&&!T.flat&&!T.nottop){const tp=topAt(w);if(tp){hover.top=tp;hover.wall=null;}}}
    pv.style.cursor='copy';drawAll();return true;}
  if(e.pointerType==='mouse'){const tol=8*KP,ph=planHit(p,tol);if(ph.t==='rot'||ph.t==='corner'||ph.t==='cam')return false;
    const h=elemHit(p,tol,X);if(h){pv.style.cursor=h.t==='wend'||h.t==='opend'||h.t==='mend'?'ew-resize':'move';return true;}
    if(ph.t==='box')return false;const h2=elemHit2(p,tol,X);if(h2&&h2.t!=='room'){pv.style.cursor='move';return true;}}
  return false;}
let hover=null;
function planDbl(p){if(draft){finishDraft();return true;}if(tool!=='select')return true;const X=planXf(),h=elemHit(p,8*KP,X)||elemHit2(p,8*KP,X);if(!h)return false;
  const focus={wall:'pw-len',mark:'pm-label',room:'pr-name',fx:'pf-n'}[h.t==='wend'?'wall':h.t==='mend'?'mark':h.t];
  if(h.t==='box')return false;const el=focus&&$(focus);if(el){el.focus();el.select&&el.select();}return!!el;}

/* ---------- plan drawing extras (called from drawPlan) ---------- */
function drawPlanUnder(c,X,k){
  for(const r of S.rooms){if(!r.pts||r.pts.length<3)continue;const on=psel&&psel.k==='room'&&psel.id===r.id;if(!on&&!r.drawn)continue;
    c.beginPath();r.pts.forEach((q,i)=>{const p=X.to(q[0],q[1]);i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]);});c.closePath();
    if(on){c.globalAlpha=.08;c.fillStyle=C.accent;c.fill();c.globalAlpha=1;}
    c.strokeStyle=on?C.accent:C.faint;c.lineWidth=1*k;c.setLineDash([2*k,3*k]);c.stroke();c.setLineDash([]);}
  if(typeof drawClrPlan==='function')drawClrPlan(c,X,k);
  drawLightPlan(c,X,k);}
function drawPlanOver(c,X,k){const line=(a,b,col,lw,dash)=>{c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.strokeStyle=col;c.lineWidth=lw*k;c.setLineDash((dash||[]).map(v=>v*k));c.stroke();c.setLineDash([]);};
  const sq=(p,col)=>{const r=5*k;c.fillStyle=C.paper;c.fillRect(p[0]-r,p[1]-r,2*r,2*r);c.strokeStyle=col||C.accent;c.lineWidth=1.6*k;c.strokeRect(p[0]-r,p[1]-r,2*r,2*r);};
  drawFixturesPlan(c,X,k);
  const o=pselObj();
  if(o&&psel.k==='wall'){const A=X.to(o.a[0],o.a[1]),B=X.to(o.b[0],o.b[1]);line(A,B,C.accent,4);sq(A);sq(B);
    const m=[(A[0]+B[0])/2,(A[1]+B[1])/2],t=fmt(wallLen(o))+' m';c.font=`500 ${11*k}px "IBM Plex Mono",monospace`;c.fillStyle=C.accent;c.fillText(t,m[0]+6*k,m[1]-6*k);}
  if(o&&psel.k==='op'){const q=openingPts(o,X);if(q){line(q[0],q[1],C.accent,5);sq(q[0]);sq(q[1]);}}
  if(o&&psel.k==='mark'){const A=X.to(o.a[0],o.a[1]),B=X.to(o.b[0],o.b[1]);line(A,B,C.accent,2,[6,4]);sq(A);sq(B);}
  /* draft + hover */
  if(['wall','room','mark'].includes(tool)){const pts=draft?draft.pts:[];
    for(let i=1;i<pts.length;i++)if(tool!=='wall')line(X.to(pts[i-1][0],pts[i-1][1]),X.to(pts[i][0],pts[i][1]),C.accent,2,[5,3]);
    if(hover){const hp=X.to(hover.p[0],hover.p[1]);
      if(pts.length){const l=pts[pts.length-1],lp=X.to(l[0],l[1]);line(lp,hp,C.accent,tool==='wall'?2.4:1.6,tool==='wall'?[]:[5,3]);
        readout(c,hover.scr[0],hover.scr[1],`${fmt(dist(l,hover.p))} m`+(hover.how&&hover.how!=='free'?' · '+hover.how:''),k);}
      c.beginPath();c.arc(hp[0],hp[1],(hover.how==='end'?6:3.5)*k,0,7);c.strokeStyle=C.accent;c.lineWidth=1.5*k;c.stroke();}
    for(const q of pts){const p=X.to(q[0],q[1]);c.beginPath();c.arc(p[0],p[1],3*k,0,7);c.fillStyle=C.accent;c.fill();}}
  if((tool==='door'||tool==='window'||tool==='fixture')&&hover){const ty=$('fx-type').value;
    if(tool==='fixture'&&FX[ty]&&FX[ty].flat){const p=X.to(hover.p[0],hover.p[1]);c.beginPath();c.arc(p[0],p[1],8*k,0,7);c.strokeStyle=C.accent;c.lineWidth=1.2*k;c.stroke();}
    else if(hover.wall){const w=hover.wall.w;line(X.to(w.a[0],w.a[1]),X.to(w.b[0],w.b[1]),C.accent,3,[4,3]);const u=wallU(w),p=X.to(w.a[0]+u[0]*hover.wall.t,w.a[1]+u[1]*hover.wall.t);
      c.beginPath();c.arc(p[0],p[1],4*k,0,7);c.fillStyle=C.accent;c.fill();}
    else if(hover.top){const P=foot(hover.top.o).map(q=>X.to(q[0],q[1]));c.beginPath();P.forEach((q,i)=>i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]));c.closePath();
      c.globalAlpha=.18;c.fillStyle=C.accent;c.fill();c.globalAlpha=1;c.strokeStyle=C.accent;c.lineWidth=2*k;c.setLineDash([4*k,3*k]);c.stroke();c.setLineDash([]);
      const q=X.to(hover.p[0],hover.p[1]);c.beginPath();c.arc(q[0],q[1],4*k,0,7);c.fillStyle=C.accent;c.fill();}
    else if(hover.face){const P=foot(hover.face.o),i=hover.face.face,a=P[i],b=P[(i+1)%P.length],L=dist(a,b)||1,t=hover.face.t,q=X.to(a[0]+(b[0]-a[0])*t/L,a[1]+(b[1]-a[1])*t/L);
      line(X.to(a[0],a[1]),X.to(b[0],b[1]),C.accent,3,[4,3]);c.beginPath();c.arc(q[0],q[1],4*k,0,7);c.fillStyle=C.accent;c.fill();}}
  /* what the tool would attach to, next to the cursor */
  if((tool==='door'||tool==='window'||tool==='fixture')&&hover&&hover.scr){const T=FX[$('fx-type').value],nm=tool==='fixture'?(T?T.label:'Fixture'):tool==='door'?'Door':'Window';let txt;
    if(tool==='fixture'&&T&&T.flat)txt=`${nm} → ${T.floor?'floor':'ceiling'} · ${fmt(hover.p[0])}, ${fmt(hover.p[1])}`;
    else if(hover.top)txt=`${nm} → ${objLabel(hover.top.o)} · top`;
    else if(hover.wall)txt=`${nm} → wall ${S.walls.indexOf(hover.wall.w)+1} · ${fmt(hover.wall.t)} m along`;
    else if(hover.face)txt=`${nm} → ${objLabel(hover.face.o)} · ${faceName(hover.face.o,hover.face.face).toLowerCase()}`;
    else txt=`${nm}: nothing to attach to here`;
    readout(c,hover.scr[0],hover.scr[1],txt,k);}
  if(typeof drawMeasurePlan==='function')drawMeasurePlan(c,X,k);}

/* ---------- Room panel ---------- */
function rowSel(k,id,label,meta,on){return`<div class="orow${on?' on':''}" data-psel-row="${id}"><span class="tw" style="display:inline-block"></span><button type="button" class="nm" data-pk="${k}" data-pid="${id}">${esc(label)}${meta?`<small>${meta}</small>`:''}</button></div>`;}
function wallIdx(w){return S.walls.indexOf(w)+1;}
function fxWhere(f){if(fxTop(f)){const o=byId(f.obj);return o?`on ${objLabel(o)} · top · ${fmt(f.x)}, ${fmt(f.z)} from centre`:'no object';}
  if(FX[f.type].flat)return`${FX[f.type].floor?'floor':'ceiling'} · ${fmt(f.x)}, ${fmt(f.z)}`;
  if(f.obj){const o=byId(f.obj);return o?`on ${objLabel(o)} · ${faceName(o,f.face).toLowerCase()} · ${fmt(f.off)} along · ${fmt(fxY(f))} high`:'no object';}
  const w=wallById(f.wall);return w?`wall ${wallIdx(w)} · ${fmt(f.off)} along · ${fmt(f.y)} high`:'no wall';}
function renderRooms(){const o=pselObj();let h='';
  /* selected element */
  const sf=$('psel-f');sf.hidden=!o;
  /* the same fieldset (same ids) moves to the Fixtures panel in the perspective, so fixtures can be edited there */
  const host=$(S.view==='persp'?'pfx-host':'rooms-host');if(host&&sf.parentNode!==host)host.appendChild(sf);
  if(o){const k=psel.k;$('psel-lg').textContent={wall:'Selected wall',op:'Selected opening',fx:'Selected fixture',mark:'Selected reference line',room:'Selected room'}[k];
    if(k==='wall'){const ws=S.walls.filter(w=>w!==o&&(peq(w.a,o.a)||peq(w.b,o.a)||peq(w.a,o.b)||peq(w.b,o.b))).length;
      h+=`<p class="note">Wall ${wallIdx(o)} · from ${fmt(o.a[0])}, ${fmt(o.a[1])} to ${fmt(o.b[0])}, ${fmt(o.b[1])}${ws?` · joins ${ws} wall${ws>1?'s':''}`:''}</p>
      <div class="ig"><label for="pw-len"><span>Length (m)</span><input id="pw-len" type="number" step="0.01" min="0.05" value="${fmtIn(wallLen(o))}"></label>
      <label for="pw-h"><span>Height (m)</span><input id="pw-h" type="number" step="0.01" min="0" placeholder="${fmtIn(S.ceil)}" value="${o.h?fmtIn(o.h):''}"></label>
      <label for="pw-ang"><span>Angle °</span><input id="pw-ang" type="number" step="1" value="${fmtIn(+wallAng(o).toFixed(2))}"></label></div>
      <div class="ig"><label class="wide" for="pw-type"><span>Material</span><select id="pw-type"><option value="concrete"${o.type!=='wood'?' selected':''}>Concrete</option><option value="wood"${o.type==='wood'?' selected':''}>Wood</option></select></label>
      ${o.type==='wood'?`<label class="wide" for="pw-style"><span>Wood style</span><select id="pw-style">${Object.entries(WALL_STYLES).map(([v,l])=>`<option value="${v}"${v===o.style?' selected':''}>${l}</option>`).join('')}</select></label>
      ${o.style==='panel'?'':`<label for="pw-sw"><span>${o.style==='boards'?'Board height (m)':'Slat width (m)'}</span><input id="pw-sw" type="number" step="0.005" min="0.01" value="${fmtIn(o.sw)}"></label>`}
      ${o.style==='slats'||o.style==='hslats'?`<label for="pw-sg"><span>Gap (m)</span><input id="pw-sg" type="number" step="0.005" min="0" value="${fmtIn(o.sg)}"></label>`:''}`:''}</div>
      ${S.walls.length>1?'<div class="chips"><button type="button" id="pw-all">Use this material on all walls</button></div>':''}
      <p class="note">${S.openings.filter(x=>x.wall===o.id).length} opening(s). Changing the length moves the end point; walls meeting that end at 90° move with it. The angle turns the wall about its start (0° = along x, 90° = along z). Drag the wall to move it, drag a square end to resize, <kbd>Shift</kbd>-drag an end to move that corner freely. Leave height empty to use the ceiling.</p>`;}
    else if(k==='op'){const dr=o.type==='door',dis=o.locked?' disabled':'',fl=(id,l,v,st)=>`<label for="${id}"><span>${l}</span><input id="${id}" type="number" step="${st||0.01}" value="${fmtIn(v)}"${dis}></label>`;
      h+=`<p class="note">${dr?'Door':'Window'} on wall ${wallIdx(wallById(o.wall))}. In the plan, drag it along the wall and drag the square ends to resize (Alt for free). In the perspective, click its outline and use the arrows${dr?'':': along the wall and up and down for the sill'}.</p>
      <div class="ig">${fl('po-off','From wall start',o.off)}${fl('po-w','Width',o.w)}${fl('po-h','Height',o.h)}${dr?fl('po-angle','Swing °',o.angle??90,1):fl('po-sill','Sill',o.sill)}</div>
      <label class="inl"><input id="po-lock" type="checkbox"${o.locked?' checked':''}> Locked (can't be dragged, resized or removed)</label>`;}
    else if(k==='fx'){const T=FX[o.type],fl=(id,l,v,step)=>`<label for="${id}"><span>${l}</span><input id="${id}" type="number" step="${step||0.01}" value="${fmtIn(v)}"></label>`;
      h+=`<label class="fl" for="pf-n">Name</label><input id="pf-n" class="tx" value="${esc(o.n)}">
      <div class="ig"><label for="pf-type"><span>Type</span><select id="pf-type">${Object.keys(FX).map(t=>`<option value="${t}"${t===o.type?' selected':''}>${FX[t].label}</option>`).join('')}</select></label>
      ${T.variants?`<label class="wide" for="pf-v"><span>Variant</span><select id="pf-v">${Object.entries(T.variants).map(([v,V])=>`<option value="${v}"${v===o.v?' selected':''}>${esc(V.label)}</option>`).join('')}</select></label>`:''}
      ${T.flat?fl('pf-x','x',o.x)+fl('pf-z','z',o.z):`<label class="wide" for="pf-on"><span>On</span><select id="pf-on"><optgroup label="Walls">${S.walls.map(w=>`<option value="w:${w.id}"${w.id===o.wall?' selected':''}>Wall ${wallIdx(w)} · ${fmt(wallLen(w))} m</option>`).join('')}</optgroup>
        <optgroup label="Objects">${S.objects.filter(b=>b.h>0).map(b=>[b.id,objLabel(b)]).sort((a,b)=>a[1].localeCompare(b[1])).map(([id,n])=>`<option value="o:${id}"${id===o.obj?' selected':''}>${esc(n)}</option>`).join('')}</optgroup></select></label>
        ${o.obj&&byId(o.obj)?`<label for="pf-face"><span>Face</span><select id="pf-face">${Array.from({length:faceCount(byId(o.obj))},(_,i)=>`<option value="${i}"${i===o.face&&!o.top?' selected':''}>${faceName(byId(o.obj),i)}</option>`).join('')}${T.nottop?'':`<option value="top"${o.top?' selected':''}>Top surface</option>`}</select></label>`:''}
        ${o.top?fl('pf-x','Left–right (from centre)',o.x)+fl('pf-z','Front–back (from centre)',o.z):fl('pf-off','Along (centre)',o.off)+fl('pf-y',o.obj?'Up the face (centre)':'Height (centre)',o.y)}`}
      <label for="pf-tag"><span>Tag</span><select id="pf-tag"><option value="">No tag</option>${S.tags.map(t=>`<option value="${t.id}"${t.id===o.tag?' selected':''}>${esc(t.name)}</option>`).join('')}</select></label></div>
      ${o.obj?(fxLocked(o)?'<p class="note">Locked because its object is locked.</p>':''):`<label class="inl"><input id="pf-lock" type="checkbox"${o.locked?' checked':''}> Locked (can't be moved or deleted)</label>`}
      <label class="fl" for="pf-notes">Notes</label><textarea id="pf-notes" class="tx" rows="2" placeholder="Circuit, box depth, switched by…">${esc(o.notes)}</textarea>
      ${o.obj?`<p class="note">Sits on ${esc(objLabel(byId(o.obj)))} and moves and turns with it. Height is measured from the object's base (${fmt(fxY(o))} m from the floor). Drag it in the plan or with the arrows in the perspective.</p>`:''}`;}
    else if(k==='mark'){h+=`<label class="fl" for="pm-label">Name</label><input id="pm-label" class="tx" value="${esc(o.label)}">
      <div class="ig"><label for="pm-len"><span>Size (m)</span><input id="pm-len" type="number" step="0.001" min="0.01" value="${fmtIn(+dist(o.a,o.b).toFixed(4))}"></label>
      <label for="pm-ang"><span>Angle °</span><input id="pm-ang" type="number" step="1" value="${fmtIn(+markAng(o).toFixed(2))}"></label></div>
      <div class="ig">${['a0','a1','b0','b1'].map(q=>`<label for="pm-${q}"><span>${q[0]==='a'?'Start':'End'} ${q[1]==='0'?'x':'z'}</span><input id="pm-${q}" type="number" step="0.001" data-mk="${q}" value="${fmtIn(o[q[0]][+q[1]])}"></label>`).join('')}</div>
      <p class="note">Boxes snap to straight reference lines. Drag the line to move it in any direction (<kbd>Shift</kbd> keeps a straight line on its own axis), or drag a square end to resize it. Type the size, angle or end points for exact values; the size changes the end point and keeps the start. Alt drags freely.</p>`;}
    else if(k==='room'){h+=`<label class="fl" for="pr-name">Name</label><input id="pr-name" class="tx" value="${esc(o.name)}">
      <p class="note">${o.drawn?'Drawn outline':'Detected from walls'} · ${fmt(Math.abs(polyArea(o.pts)))} m² · ${o.pts.length} corners</p>`;}
    h+=`<div class="chips"><button type="button" id="psel-del">Delete</button><button type="button" id="psel-none">Deselect</button></div>`;}
  $('psel-body').innerHTML=h;
  if(o)bindPsel(o);
  /* rooms */
  h=S.rooms.map((r,i)=>rowSel('room',r.id,r.name||'Room',`${fmt(Math.abs(polyArea(r.pts)))} m²${r.drawn?' · drawn':''}`,psel&&psel.id===r.id)).join('')||'<p class="note">No rooms yet. Close a loop of walls, or draw an outline with the Room tool.</p>';
  h+=`<div class="row"><label for="ceil">Ceiling</label><input id="ceil" type="range" min="2.2" max="3.5" step="0.01" value="${S.ceil}"><output id="o-ceil">${fmt(S.ceil)}</output></div>
    <div class="chips"><button type="button" id="b-detect">Detect rooms from walls</button></div>`;
  $('room-body').innerHTML=h;
  $('ceil').addEventListener('input',e=>{S.ceil=+e.target.value;$('o-ceil').textContent=fmt(S.ceil);drawAll();});$('ceil').addEventListener('change',commit);
  $('b-detect').addEventListener('click',()=>{normalizeWalls();const n=detectRooms();commit();renderRooms();drawAll();flash(n?`${n} new room${n>1?'s':''} found.`:`${S.rooms.length} room${S.rooms.length===1?'':'s'}, nothing new.`);});
  /* walls */
  $('walls-body').innerHTML=(S.walls.map(w=>{const n=S.openings.filter(o=>o.wall===w.id).length;return rowSel('wall',w.id,`Wall ${wallIdx(w)}`,`${fmt(wallLen(w))} m${axisWall(w)?'':` · ${fmtIn(+wallAng(w).toFixed(1))}°`}${w.type==='wood'?' · wood':''}${n?` · ${n} opening${n>1?'s':''}`:''}`,psel&&psel.id===w.id);}).join('')||'<p class="note">No walls.</p>')+
    '<p class="note">Use the Wall tool (W) above the plan to draw more. Walls snap to corners, other walls and the grid.</p>';
  /* fixtures */
  $('fx-body').innerHTML=fxListHTML('<p class="note">No fixtures. Use the Fixture tool (F) to add outlets, switches and lights.</p>');bindFxLockAll($('fx-body'));
  renderPfx();
  /* reference lines */
  $('marks-body').innerHTML=(S.marks.map(m=>rowSel('mark',m.id,m.label||'(unnamed)',`${fmt(dist(m.a,m.b))} m`,psel&&psel.id===m.id)).join('')||'<p class="note">No reference lines.</p>')+
    '<p class="note">Use the Line tool (E) to add one.</p>';
  document.querySelectorAll('[data-panel="rooms"] [data-pk]').forEach(b=>b.addEventListener('click',()=>selectP(b.dataset.pk,b.dataset.pid)));
  renderOpenings();}
function bindPsel(o){const k=psel.k;
  $('psel-del').addEventListener('click',delPsel);$('psel-none').addEventListener('click',()=>selectP(null));
  const num=(id,fn)=>{const el=$(id);if(!el)return;el.addEventListener('change',()=>{const v=parseFloat(el.value);fn(isFinite(v)?v:null,el.value);});};
  if(k==='wall'){const lk=()=>{if(!S.lockWalls)return false;flash('Walls are locked. Press K or click Lock walls to unlock them.');renderRooms();return true;};
    num('pw-len',v=>{if(lk())return;if(v!==null)setWallLen(o,v);});num('pw-h',v=>{o.h=v&&v>0?v:null;commit();drawAll();});num('pw-ang',v=>{if(lk())return;if(v!==null&&Math.abs(normDeg(v-wallAng(o)))>1e-6)setWallAng(o,v);});
    const mat=()=>{commit();renderRooms();drawAll();};
    $('pw-type').addEventListener('change',e=>{o.type=e.target.value==='wood'?'wood':'concrete';mat();});
    const st=$('pw-style');if(st)st.addEventListener('change',()=>{o.style=st.value;if(o.style==='boards'&&o.sw<0.08)o.sw=0.12;mat();});
    num('pw-sw',v=>{if(v!==null){o.sw=clamp(v,0.01,0.5);mat();}});num('pw-sg',v=>{if(v!==null){o.sg=clamp(v,0,0.5);mat();}});
    const all=$('pw-all');if(all)all.addEventListener('click',()=>{for(const w of S.walls){w.type=o.type;w.style=o.style;w.sw=o.sw;w.sg=o.sg;}commit();renderRooms();drawAll();flash('Every wall now uses this material.');});}
  if(k==='op'){const upd=fn=>v=>{if(v===null||o.locked)return;fn(v);const w=wallById(o.wall);if(w){const L=wallLen(w);o.w=Math.min(o.w,L);o.off=clamp(o.off,0,L-o.w);}commit();renderRooms();drawAll();};
    num('po-off',upd(v=>o.off=Math.max(0,v)));num('po-w',upd(v=>o.w=Math.max(0.05,v)));num('po-h',upd(v=>o.h=Math.max(0.05,v)));
    num('po-sill',upd(v=>o.sill=Math.max(0,v)));num('po-angle',upd(v=>o.angle=clamp(v,0,180)));
    $('po-lock').addEventListener('change',e=>{o.locked=e.target.checked;commit();renderRooms();drawAll();flash(o.locked?'Opening locked.':'Opening unlocked.');});}
  if(k==='fx'){if(fxLocked(o))['pf-on','pf-face','pf-off','pf-y','pf-x','pf-z'].forEach(id=>{const e=$(id);if(e)e.disabled=true;});
    const pl=$('pf-lock');if(pl)pl.addEventListener('change',()=>{o.locked=pl.checked;commit();renderRooms();drawAll();flash(o.locked?'Fixture locked.':'Fixture unlocked.');});
    const n=$('pf-n');n.addEventListener('input',()=>{o.n=n.value;drawAll();});n.addEventListener('change',()=>{commit();renderRooms();});
    const pv2=$('pf-v');if(pv2)pv2.addEventListener('change',()=>{o.v=pv2.value;const A=fxPlan(o);if(A&&A.L){const hw=Math.min(fxSize(o).w/2,A.L/2);o.off=rnd(clamp(o.off,hw,Math.max(hw,A.L-hw)));}commit();renderRooms();drawAll();});
    $('pf-type').addEventListener('change',e=>{const was=FX[o.type].flat;o.type=e.target.value;o.v=FX[o.type].variants?Object.keys(FX[o.type].variants)[0]:'';const now=FX[o.type].flat;
      if(was&&!now){const h=nearestWall([o.x,o.z],99);if(h){o.wall=h.w.id;o.off=rnd(h.t);}o.y=FX[o.type].y;}
      else if(!was&&now){const A=fxPlan({...o,type:'outlet'});if(A){o.x=rnd(A.p[0]+(A.n?A.n[0]*0.5:0));o.z=rnd(A.p[1]+(A.n?A.n[1]*0.5:0));}o.obj=null;o.top=false;}
      else if(!now&&!o.obj)o.y=FX[o.type].y;
      if(o.top&&FX[o.type].nottop){o.top=false;o.face=0;const A2=fxPlan(o);o.off=A2&&A2.L?rnd(A2.L/2):0;o.y=byId(o.obj)?rnd(byId(o.obj).h/2):o.y;}
      commit();renderRooms();drawAll();});
    const pon=$('pf-on');if(pon)pon.addEventListener('change',()=>{const[k,id]=[pon.value[0],pon.value.slice(2)],c=fxCentre3(o);
      if(k==='w'){const w=wallById(id);if(!w)return;o.wall=id;o.obj=null;o.top=false;const u=wallU(w);o.off=rnd(c?clamp((c[0]-w.a[0])*u[0]+(c[2]-w.a[1])*u[1],0,wallLen(w)):wallLen(w)/2);o.y=rnd(c?clamp(c[1],0,wallH(w)):FX[o.type].y);}
      else{const b=byId(id);if(!b)return;const nf=c?nearestFace([c[0],c[2]],99):null;o.obj=id;o.wall=null;o.top=false;
        if(nf&&nf.o===b){o.face=nf.face;o.off=rnd(nf.t);}else{o.face=2;o.off=rnd(fxPlanLen(b,2)/2);}o.y=rnd(c?clamp(c[1]-b.y,0,b.h):b.h/2);}
      commit();renderRooms();drawAll();});
    const pfc=$('pf-face');if(pfc)pfc.addEventListener('change',()=>{const ob=byId(o.obj);
      if(pfc.value==='top'){o.top=true;o.x=0;o.z=0;o.y=0;}
      else{o.top=false;o.face=+pfc.value;const A=fxPlan(o);o.off=A&&A.L?rnd(A.L/2):0;if(!o.y&&ob)o.y=rnd(ob.h/2);}
      commit();renderRooms();drawAll();});
    num('pf-x',v=>{if(v!==null){const ob=o.top&&byId(o.obj);o.x=ob?clamp(v,-ob.w/2,ob.w/2):v;commit();renderRooms();drawAll();}});
    num('pf-z',v=>{if(v!==null){const ob=o.top&&byId(o.obj);o.z=ob?clamp(v,-ob.d/2,ob.d/2):v;commit();renderRooms();drawAll();}});
    num('pf-off',v=>{if(v!==null){const A=fxPlan(o);o.off=A&&A.L?clamp(v,0,A.L):v;commit();renderRooms();drawAll();}});
    num('pf-y',v=>{if(v!==null){const A=fxPlan(o);o.y=clamp(v,0,o.obj&&A?A.H:S.ceil);commit();renderRooms();drawAll();}});
    $('pf-tag').addEventListener('change',e=>{o.tag=e.target.value;commit();drawAll();});
    $('pf-notes').addEventListener('change',e=>{o.notes=e.target.value;commit();});}
  if(k==='mark'){num('pm-len',v=>{if(v!==null&&v>=0.01){setMarkLen(o,v);}});num('pm-ang',v=>{if(v!==null)setMarkAng(o,v);});
    const n=$('pm-label');n.addEventListener('input',()=>{o.label=n.value;drawAll();});n.addEventListener('change',()=>{commit();renderRooms();});
    n.addEventListener('keydown',e=>{if(e.key==='Enter')n.blur();});
    document.querySelectorAll('[data-mk]').forEach(inp=>inp.addEventListener('change',()=>{const v=parseFloat(inp.value);if(!isFinite(v))return;const q=inp.dataset.mk;o[q[0]][+q[1]]=v;commit();renderRooms();drawAll();}));}
  if(k==='room'){const n=$('pr-name');n.addEventListener('input',()=>{o.name=n.value;drawAll();});n.addEventListener('change',()=>{commit();renderRooms();});n.addEventListener('keydown',e=>{if(e.key==='Enter')n.blur();});}}
/* reference lines: size = distance start → end, angle like walls (0° along +x, 90° along +z). Both keep the start point. */
function markAng(m){return normDeg(Math.atan2(m.b[1]-m.a[1],m.b[0]-m.a[0])*180/Math.PI);}
function setMarkLen(m,L){const l=dist(m.a,m.b),u=l>1e-9?[(m.b[0]-m.a[0])/l,(m.b[1]-m.a[1])/l]:[1,0];
  m.b=[rnd(m.a[0]+u[0]*L),rnd(m.a[1]+u[1]*L)];commit();renderRooms();drawAll();flash(`Reference line size ${fmt(L)} m.`);}
function setMarkAng(m,deg){const L=dist(m.a,m.b),a=deg*Math.PI/180;m.b=[rnd(m.a[0]+Math.cos(a)*L),rnd(m.a[1]+Math.sin(a)*L)];commit();renderRooms();drawAll();}
/* live update of the selected element's fields while dragging */
function updatePselFields(){const o=pselObj();if(!o)return;const set=(id,v)=>{const el=$(id);if(el&&el!==document.activeElement)el.value=fmtIn(v);};
  if(psel.k==='wall'){set('pw-len',wallLen(o));set('pw-ang',+wallAng(o).toFixed(2));}
  if(psel.k==='fx'){set('pf-off',o.off);set('pf-x',o.x);set('pf-z',o.z);set('pf-y',o.y);}
  if(psel.k==='mark'){set('pm-len',dist(o.a,o.b));set('pm-ang',+markAng(o).toFixed(2));set('pm-a0',o.a[0]);set('pm-a1',o.a[1]);set('pm-b0',o.b[0]);set('pm-b1',o.b[1]);}
  if(psel.k==='op'){set(`op-${o.id}-off`,o.off);set(`op-${o.id}-w`,o.w);set(`op-${o.id}-sill`,o.sill);set('po-off',o.off);set('po-w',o.w);set('po-sill',o.sill);}}
function renderOpenings(){let o='';
  for(const op of S.openings){const w=wallById(op.wall),isDoor=op.type==='door',on=psel&&psel.k==='op'&&psel.id===op.id,
    dis=op.locked?' disabled':'',f=(k,l,step)=>`<label for="op-${op.id}-${k}"><span>${l}</span><input id="op-${op.id}-${k}" type="number" step="${step||0.01}" data-op="${op.id}" data-k="${k}" value="${fmtIn(op[k]??0)}"${dis}></label>`;
    o+=`<div class="op${on?' on':''}" data-psel-row="${op.id}"><h3><button type="button" class="nm opn" data-pk="op" data-pid="${op.id}">${isDoor?'Door':'Window'}${w?' · wall '+wallIdx(w):''}${op.entrance?' · entrance':''}</button></h3>
      <div class="ig"><label class="wide" for="op-${op.id}-wall"><span>Wall</span><select id="op-${op.id}-wall" data-op="${op.id}" data-k="wall"${dis}>${S.walls.map(x=>`<option value="${x.id}"${x.id===op.wall?' selected':''}>${esc(wallName(x))}</option>`).join('')}</select></label>
      ${f('off','From wall start')}${f('w','Width')}${f('h','Height')}${isDoor?f('angle','Swing °',1):f('sill','Sill')}</div>`;
    if(isDoor)o+=`<div class="ig"><label for="op-${op.id}-hinge"><span>Hinge</span><select id="op-${op.id}-hinge" data-op="${op.id}" data-k="hinge"${dis}><option value="a"${op.hinge==='a'?' selected':''}>Start side</option><option value="b"${op.hinge!=='a'?' selected':''}>End side</option></select></label>
      <label class="wide" for="op-${op.id}-side"><span>Opens</span><select id="op-${op.id}-side" data-op="${op.id}" data-k="side"${dis}><option value="1"${(op.side||1)===1?' selected':''}>Into the room</option><option value="-1"${op.side===-1?' selected':''}>Out of the room</option></select></label></div>
      <label class="inl"><input type="checkbox" data-op="${op.id}" data-k="entrance"${op.entrance?' checked':''}> Entrance door</label>`;
    o+=`<label class="inl"><input type="checkbox" data-op="${op.id}" data-k="locked"${op.locked?' checked':''}> Locked</label><div class="chips"><button type="button" data-opdel="${op.id}"${dis}>Remove</button></div>${w?'':'<p class="note">This opening has no wall. Pick one above.</p>'}</div>`;}
  o+='<div class="chips"><button type="button" data-opadd="window">Add window</button><button type="button" data-opadd="door">Add door</button></div><p class="note">Or use the Door (O) / Window (Shift+O) tools and click on a wall.</p>';
  const ob=$('ops-body');ob.innerHTML=o;
  ob.querySelectorAll('[data-pk]').forEach(b=>b.addEventListener('click',()=>selectP('op',b.dataset.pid)));
  ob.querySelectorAll('[data-op]').forEach(inp=>{const apply=live=>{const op=S.openings.find(x=>x.id===inp.dataset.op);if(!op)return;const k=inp.dataset.k;
      if(op.locked&&k!=='locked')return;
      if(inp.type==='checkbox'){op[k]=inp.checked;if(k==='entrance'&&inp.checked)for(const x of S.openings)if(x!==op)x.entrance=false;}
      else if(inp.tagName==='SELECT')op[k]=k==='side'?+inp.value:inp.value;
      else{const v=parseFloat(inp.value);if(!isFinite(v))return;op[k]=k==='angle'?clamp(v,0,180):Math.max(0,v);}
      const w=wallById(op.wall);if(w&&!live){const L=wallLen(w);op.w=Math.min(op.w,L);op.off=clamp(op.off,0,L-op.w);}
      drawAll();if(!live){commit();renderRooms();}};
    if(inp.type==='number')inp.addEventListener('input',()=>apply(true));inp.addEventListener('change',()=>apply(false));});
  ob.querySelectorAll('[data-opdel]').forEach(b=>b.addEventListener('click',()=>{if(S.openings.find(x=>x.id===b.dataset.opdel)?.locked)return;S.openings=S.openings.filter(x=>x.id!==b.dataset.opdel);if(psel&&psel.id===b.dataset.opdel)psel=null;commit();renderRooms();drawAll();flash('Opening removed. Undo brings it back.');}));
  ob.querySelectorAll('[data-opadd]').forEach(b=>b.addEventListener('click',()=>{const sw=psel&&psel.k==='wall'?pselObj():null,w=sw||S.walls[0];if(!w)return;const door=b.dataset.opadd==='door',L=wallLen(w),ww=Math.min(door?0.8:1.0,L);
    const op=door?{id:uid('op'),wall:w.id,type:'door',off:rnd(Math.max(0,(L-ww)/2)),w:ww,h:2.1,sill:0,hinge:'a',side:1,angle:90,entrance:false}:{id:uid('op'),wall:w.id,type:'window',off:rnd(Math.max(0,(L-ww)/2)),w:ww,h:1.2,sill:0.9};
    S.openings.push(op);commit();selectP('op',op.id);}));}

/* ---------- fixture list (Room panel and the perspective's Fixtures panel) ---------- */
function fxRow(f){const on=psel&&psel.id===f.id,meta=`${fxVariant(f)?fxVariant(f).label+' · ':''}${fxWhere(f)}${fxLocked(f)?' · locked':''}`;
  return`<div class="orow${on?' on':''}${f.vis?'':' off'}" data-psel-row="${f.id}"><button type="button" class="ib" data-fxeye="${f.id}" aria-label="${f.vis?'Hide':'Show'} ${esc(f.n)}">${f.vis?EYE:EYEOFF}</button><button type="button" class="nm" data-pk="fx" data-pid="${f.id}">${esc(f.n)}<small>${meta}</small></button></div>`;}
function fxListHTML(empty){if(!S.fixtures.length)return empty;const free=S.fixtures.filter(f=>!f.obj),all=free.length&&free.every(f=>f.locked),nh=S.fixtures.filter(f=>!f.vis).length;
  return`<div class="chips" style="margin-bottom:6px"><button type="button" data-fxvis="1"${nh?'':' disabled'}>Show all</button><button type="button" data-fxvis="0"${nh===S.fixtures.length?' disabled':''}>Hide all</button>${nh?`<span class="note">${nh} hidden</span>`:''}</div>`+
    S.fixtures.map(fxRow).join('')+
    (free.length?`<div class="chips" style="margin-top:6px"><button type="button" data-fxlockall="${all?0:1}">${all?'Unlock':'Lock'} wall and ceiling fixtures</button></div>`:'');}
function bindFxLockAll(root){if(root)root.querySelectorAll('[data-fxeye]').forEach(btn=>btn.addEventListener('click',()=>{const f=fxById(btn.dataset.fxeye);if(!f)return;f.vis=!f.vis;commit();renderRooms();drawAll();}));
  if(root)root.querySelectorAll('[data-fxvis]').forEach(btn=>btn.addEventListener('click',()=>{const on=btn.dataset.fxvis==='1';for(const f of S.fixtures)f.vis=on;commit();renderRooms();drawAll();flash(on?'All fixtures shown.':'All fixtures hidden. Show all brings them back.');}));
  if(root)root.querySelectorAll('[data-fxlockall]').forEach(b=>b.addEventListener('click',()=>{const on=b.dataset.fxlockall==='1';let n=0;
  for(const f of S.fixtures)if(!f.obj&&f.locked!==on){f.locked=on;n++;}commit();renderRooms();drawAll();flash(`${n} fixture${n===1?'':'s'} ${on?'locked':'unlocked'}. Fixtures on objects follow their object.`);}));}
/* perspective Fixtures panel: put a new fixture on a chosen object (or wall), and the list of all fixtures */
let pfxLast={type:'strip',on:''};
function pfxDefaultOn(){const it=single();if(it){const ms=it.kind==='b'?[it.o]:members(it.g.id);const b=ms.filter(m=>m.h>0).sort((a,c)=>c.w*c.d-a.w*a.d)[0];if(b)return'o:'+b.id;}
  if(pfxLast.on&&((pfxLast.on[0]==='o'&&byId(pfxLast.on.slice(2)))||(pfxLast.on[0]==='w'&&wallById(pfxLast.on.slice(2)))))return pfxLast.on;
  const b=S.objects.find(o=>o.h>0&&visible(o));return b?'o:'+b.id:S.walls[0]?'w:'+S.walls[0].id:'';}
function renderPfx(){const el=$('pfx-add');if(!el)return;const on=pfxDefaultOn(),ob=on[0]==='o'?byId(on.slice(2)):null;
  const types=Object.keys(FX).filter(t=>!FX[t].flat);if(!types.includes(pfxLast.type))pfxLast.type=types[0];
  el.innerHTML=`<div class="ig"><label for="pa-type"><span>Type</span><select id="pa-type">${types.map(t=>`<option value="${t}"${t===pfxLast.type?' selected':''}>${FX[t].label}</option>`).join('')}</select></label>
    <label class="wide" for="pa-on"><span>On</span><select id="pa-on"><optgroup label="Objects">${S.objects.filter(b=>b.h>0).map(b=>[b.id,objLabel(b)]).sort((a,b)=>a[1].localeCompare(b[1])).map(([id,n])=>`<option value="o:${id}"${'o:'+id===on?' selected':''}>${esc(n)}</option>`).join('')}</optgroup>
      <optgroup label="Walls">${S.walls.map(w=>`<option value="w:${w.id}"${'w:'+w.id===on?' selected':''}>Wall ${wallIdx(w)} · ${fmt(wallLen(w))} m</option>`).join('')}</optgroup></select></label>
    ${ob?`<label class="wide" for="pa-face"><span>Face</span><select id="pa-face">${Array.from({length:faceCount(ob)},(_,i)=>`<option value="${i}"${i===(ob.poly?0:2)?' selected':''}>${faceName(ob,i)} · ${fmt(fxPlanLen(ob,i))} m</option>`).join('')}<option value="top">Top surface (not for wall or ceiling lights, pipes)</option></select></label>`:''}
    <label for="pa-add"><span>&nbsp;</span><button id="pa-add" type="button"${on?'':' disabled'}>Add</button></label></div>
    <p class="note">The new fixture goes in the middle of the face (or wall); then drag its arrows on the drawing to place it. Selecting an object first picks it here.</p>`;
  $('pa-type').addEventListener('change',e=>{pfxLast.type=e.target.value;});
  $('pa-on').addEventListener('change',e=>{pfxLast.on=e.target.value;renderPfx();});
  $('pa-add').addEventListener('click',()=>{const v=$('pa-on').value,type=$('pa-type').value;pfxLast={type,on:v};let f;
    if(v[0]==='o'){const o=byId(v.slice(2));if(!o)return;const fv=$('pa-face')?.value;
      if(fv==='top'&&!FX[type].nottop)f=addFixture(type,null,0,null,{o,top:true,lx:0,lz:0});
      else{const face=fv==='top'||fv===undefined?(o.poly?0:2):+fv;f=addFixture(type,null,fxPlanLen(o,face)/2,null,{o,face,t:fxPlanLen(o,face)/2});}}
    else{const w=wallById(v.slice(2));if(!w)return;f=addFixture(type,w,wallLen(w)/2);}
    sel=[];renderInspector();renderList();commit();selectP('fx',f.id);flash(`${FX[type].label} added ${f.obj?'on '+objLabel(byId(f.obj))+(f.top?' (top)':''):'on the wall'}. Drag its arrows to place it.`);});
  const lb=$('pfx-list');if(lb)lb.innerHTML=fxListHTML('<p class="note">No fixtures yet.</p>');
  document.querySelectorAll('#pfx-list [data-pk]').forEach(b=>b.addEventListener('click',()=>selectP(b.dataset.pk,b.dataset.pid)));
  bindFxLockAll(lb);}
