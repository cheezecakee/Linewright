'use strict';
/* Linewright — attachments: an object can be attached to another (o.parent = id, o.po = offset of its min corner from the
   parent's min corner, refreshed on every commit). Moving or rotating a parent carries its children: the move/rotate paths use
   selMove() / rotateItems(), which add descendants. "Snap onto face" = Shift while dragging places the selection on top of the
   box under it and attaches it on drop. */

function descendants(list){const ids=new Set(list.map(o=>o.id)),out=[];let fr=list.slice();
  while(fr.length){const nx=[];for(const p of fr)for(const c of S.objects)if(c.parent===p.id&&!ids.has(c.id)){ids.add(c.id);out.push(c);nx.push(c);}fr=nx;}
  return out;}
/* everything that moves with the selection */
function selMove(){const l=selBoxes();return l.concat(descendants(l));}
/* groups carried along entirely by a rotation also need their rotation bookkeeping updated */
function kidGroupKeys(keys){const list=[];for(const k of keys){const id=k.slice(2);if(k[0]==='b'){const o=byId(id);if(o)list.push(o);}else list.push(...members(id));}
  const ds=descendants(list),gs=new Set(ds.filter(o=>o.g).map(o=>o.g)),have=new Set(keys),out=[];
  for(const g of gs){const key='g:'+g;if(have.has(key))continue;const ms=members(g);if(ms.length&&ms.every(m=>ds.includes(m)))out.push(key);}
  return out;}
/* ---------- attached to a wall ----------
   An object with o.pw sits in the frame of that wall: pt along it (from its start), pn out from its face into the room (to the
   object's centre) and pa its yaw relative to the wall's front. The frame is refreshed on every commit; when walls are moved
   keepOnWalls() puts the object back into the frame of the wall's new position, and what is attached to it follows. */
function wallFrameYaw(w){const n=wallInN(w);return Math.atan2(-n[0],n[1])*180/Math.PI;}
function wallFrameOf(o,w){const u=wallU(w),n=wallInN(w),c=[o.x+o.w/2-w.a[0],o.z+o.d/2-w.a[1]],r=v=>+v.toFixed(4);
  return{pt:r(c[0]*u[0]+c[1]*u[1]),pn:r(c[0]*n[0]+c[1]*n[1]),pa:r(normDeg(absYaw(o)-wallFrameYaw(w)))};}
function placeOnWall(o,w,t,n,a){const u=wallU(w),nn=wallInN(w);
  o.rot=(o.rot||0)+normDeg(wallFrameYaw(w)+a-absYaw(o));normRot(o);
  o.x=w.a[0]+u[0]*t+nn[0]*n-o.w/2;o.z=w.a[1]+u[1]*t+nn[1]*n-o.d/2;}
/* things attached to o (by parent) follow it from its previous centre c0 and yaw a0 to where it is now */
function followParent(o,c0,a0){const c1=[o.x+o.w/2,o.z+o.d/2],d=normDeg(absYaw(o)-a0),r=d*Math.PI/180,ca=Math.cos(r),sa=Math.sin(r);
  for(const k of descendants([o])){const dx=k.x+k.w/2-c0[0],dz=k.z+k.d/2-c0[1];
    k.x=c1[0]+dx*ca-dz*sa-k.w/2;k.z=c1[1]+dx*sa+dz*ca-k.d/2;if(Math.abs(d)>1e-9){k.rot=(k.rot||0)+d;normRot(k);}}}
function attachToWall(list,wid){const w=wallById(wid);if(!w)return 0;for(const o of list){o.parent=null;o.po=null;o.pw=wid;}updOffsets();return list.length;}
function wallName2(o){const w=o&&o.pw&&wallById(o.pw);return w?`wall ${S.walls.indexOf(w)+1}`:'';}
function updOffsets(){
  for(const o of S.objects){if(!o.pw)continue;const w=wallById(o.pw);if(!w){o.pw=null;continue;}Object.assign(o,wallFrameOf(o,w));}
  for(const o of S.objects){if(!o.parent){o.po=null;continue;}const p=byId(o.parent);
  if(!p||p===o){o.parent=null;o.po=null;continue;}
  o.po={x:+(o.x-p.x).toFixed(4),y:+(o.y-p.y).toFixed(4),z:+(o.z-p.z).toFixed(4)};}
  /* fixtures on an object go with it when it is deleted */
  S.fixtures=S.fixtures.filter(f=>!f.obj||byId(f.obj));}
function parentName(o){const p=o&&byId(o.parent);if(!p)return'';const g=p.g&&grpById(p.g);return g?`${g.n} › ${p.n}`:p.n;}
/* attach every box of the list (group members included) to parent id; refuses cycles */
function attachTo(list,pid){const p=byId(pid);if(!p)return 0;const bad=new Set(list.concat(descendants(list)).map(o=>o.id));
  if(bad.has(pid)){flash("Can't attach an item to itself or to something attached to it.");return 0;}
  let n=0;for(const o of list){if(o.g&&o.g===p.g)continue;o.parent=pid;o.pw=null;n++;}updOffsets();return n;}
function detach(list){for(const o of list){o.parent=null;o.po=null;o.pw=null;}}
function childCount(list){return descendants(list).length;}

/* box whose top face is under the centre of the list's footprint (the highest one), ignoring the list and its children */
function ontoTarget(list){const ex=new Set(list.concat(descendants(list)).map(o=>o.id)),b=bbox(list),c=[(b.x0+b.x1)/2,(b.z0+b.z1)/2];
  let best=null;
  for(const o of S.objects){if(ex.has(o.id)||!visible(o)||o.h<=0)continue;
    if(inFoot(o,c,0)&&(!best||o.y+o.h>best.y))best={o,y:o.y+o.h};}
  return best;}
/* during a drag: drop onto the face under the selection (y follows) or restore the start height */
function applyOnto(on){const list=selBoxes(),all=selMove();
  if(!on){for(const o of all){const s0=drag.st[o.id];if(s0)o.y=s0.y;}drag.onto=null;return'';}
  const t=ontoTarget(list);if(!t){for(const o of all){const s0=drag.st[o.id];if(s0)o.y=s0.y;}drag.onto=null;return' · no face under it';}
  const dy=t.y-drag.bb0.y0;for(const o of all){const s0=drag.st[o.id];if(s0)o.y=s0.y+dy;}
  drag.onto=t.o.id;const g=t.o.g&&grpById(t.o.g);return` · onto ${g?g.n+' › ':''}${t.o.n}, attaches on drop`;}
function finishOnto(d){if(!d.onto)return;const n=attachTo(selBoxes(),d.onto);if(n)flash(`Placed on ${parentName(selBoxes()[0])} and attached.`);}

/* copy/duplicate a set of boxes with their groups; parent links inside the set are remapped, others kept.
   Returns selection keys for the top-level items (children attached inside the set are carried, not selected). */
function cloneSet(list,dx,dz,suffix,groupsSrc){const idm={},gm={},keys=[],sub=new Set();
  for(const o of list)idm[o.id]=uid('b');
  for(const o of list)if(o.parent&&idm[o.parent])sub.add(o.id);
  for(const o of list)if(o.g&&!gm[o.g]){const g=grpById(o.g)||(groupsSrc||[]).find(x=>x.id===o.g);if(!g)continue;
    const ng=normGroup({...JSON.parse(JSON.stringify(g)),id:uid('g'),n:g.n+(suffix||''),locked:false});S.groups.push(ng);gm[o.g]=ng.id;
    if(list.some(m=>m.g===o.g&&!sub.has(m.id)))keys.push('g:'+ng.id);}
  for(const o of list){const c=normObj({...JSON.parse(JSON.stringify(o)),id:idm[o.id],x:o.x+dx,z:o.z+dz,g:o.g?gm[o.g]||null:null,locked:false,
      parent:o.parent?(idm[o.parent]||(byId(o.parent)?o.parent:null)):null});
    if(!c.g)c.n=o.n+(suffix||'');S.objects.push(c);if(!c.g&&!sub.has(o.id))keys.push('b:'+c.id);}
  /* fixtures on copied objects are copied with them (from the live model, or from the clipboard copy) */
  const fsrc=(groupsSrc&&CLIP&&CLIP.fixtures)||S.fixtures;
  for(const f of fsrc.slice())if(f.obj&&idm[f.obj])S.fixtures.push(normFx({...JSON.parse(JSON.stringify(f)),id:uid('f'),obj:idm[f.obj]}));
  return keys;}
