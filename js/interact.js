'use strict';
/* Linewright — perspective pointer editing (gizmo, picking, layers), shared drag end, edit actions, keyboard shortcuts. */

function cpos(e,c){const r=c.getBoundingClientRect();return[(e.clientX-r.left)*c.width/r.width,(e.clientY-r.top)*c.height/r.height];}
/* where the ray through canvas point p meets the ceiling plane (x, z), or null when it points at or below the horizon */
function ceilPoint(p,y){setupCam(cv.width,cv.height);const r=camRay(p);if(Math.abs(r.d[1])<1e-6)return null;const t=((y===undefined?S.ceil:y)-r.o[1])/r.d[1];return t>0?[r.o[0]+r.d[0]*t,r.o[2]+r.d[2]*t]:null;}
function pHit(p,tol){
  if(layerMode())return layerHit(p,tol);
  if(!S.trace){const G=gizmo();if(G){
    if(G.resize)for(const a of G.axes)if(dist(p,a.tip)<tol+3*K)return{t:'size',a};
    for(const a of G.axes)if(segDist(p,G.p0,a.end)<tol)return{t:'move',a};}
    const fa=fxGizmoHit(p,tol);if(fa)return{t:'fxmove',a:fa};
    const oa=fxGizmoHit(p,tol,opGizmo()||false);if(oa)return{t:'opmove',a:oa};
    const f=fxPickP(p,tol);if(f)return{t:'fx',f};}
  const o=pickBox(p,tol);if(o)return{t:'box',o};
  if(!S.trace){const op=opPickP(p,tol);if(op)return{t:'op',o:op};}
  return{t:'none'};}
function selClick(o,shift){const k=keyOf(o);
  if(shift){const i=sel.indexOf(k);if(i>=0)sel.splice(i,1);else sel.push(k);}else sel=[k];
  renderSel();}

cv.addEventListener('pointerdown',e=>{
  if(e.button>0)return;const p=cpos(e,cv);
  if(tool==='measure'&&!layerMode()){measureClickP(p);return;}
  const tol=(e.pointerType==='touch'?18:8)*K,h=pHit(p,tol);
  if(['lmove','lscale','lrot','lpin','lcm'].includes(h.t)){const sw=activeLayer!==h.L.id;activeLayer=h.L.id;drag={view:'p',t:h.t,L:h.L,i:h.i,li:h.li,ei:h.ei,start:p,cur:p,L0:{...h.L},moved:false};if(sw||h.t!=='lcm')renderLayers();}
  else if(h.t==='move'||h.t==='size'){const list=selBoxes(),st={};for(const o of selMove())st[o.id]={x:o.x,y:o.y,z:o.z};
    drag={view:'p',t:h.t,axis:h.a.axis,dir:h.a.dir,ppm:h.a.ppm,start:p,cur:p,bb0:bbox(list),st,noFace:list.some(o=>o.rot),moved:false};}
  else if(h.t==='fxmove'){const f=fxById(psel.id);drag={view:'p',t:'fxmove',axis:h.a.axis,dir:h.a.dir,ppm:h.a.ppm,id:f.id,f0:{off:f.off,y:f.y,x:f.x,z:f.z},start:p,cur:p,moved:false,
    cy:fxY(f),c0:isFlat(f)?ceilPoint(p,fxY(f)):null,onEnd:()=>renderRooms()};}
  else if(h.t==='opmove'){const o=S.openings.find(x=>x.id===psel.id);drag={view:'p',t:'opmove',axis:h.a.axis,dir:h.a.dir,ppm:h.a.ppm,id:o.id,o0:{off:o.off,sill:o.sill},start:p,cur:p,moved:false,onEnd:()=>renderRooms()};}
  else if(h.t==='fx'){selectP('fx',h.f.id);drag=null;return;}
  else if(h.t==='op'){selectP('op',h.o.id);drag=null;return;}
  else if(h.t==='box'){if(psel){psel=null;renderRooms();}selClick(h.o,e.shiftKey);drag=null;return;}
  else drag={view:'p',t:'empty',start:p,cur:p,shift:e.shiftKey,moved:false};
  try{cv.setPointerCapture(e.pointerId);}catch(_){}
  drawAll();
});
cv.addEventListener('pointermove',e=>{
  const p=cpos(e,cv);
  if(!drag||drag.view!=='p'){if(e.pointerType==='mouse'){if(tool==='measure'&&!layerMode()){cv.style.cursor='crosshair';return;}const h=pHit(p,8*K);cv.style.cursor=h.t==='none'?'default':h.t==='box'||h.t==='fx'||h.t==='op'?'pointer':h.t==='lrot'||h.t==='lcm'?'crosshair':h.t==='lscale'||h.t==='lpin'?'nwse-resize':'grab';}return;}
  drag.cur=p;if(dist(p,drag.start)>3*K)drag.moved=true;
  const d=[p[0]-drag.start[0],p[1]-drag.start[1]];
  if(drag.t==='move'||drag.t==='size')axisDrag((d[0]*drag.dir[0]+d[1]*drag.dir[1])/drag.ppm,10*K/drag.ppm,e.altKey,e.shiftKey);
  else if(drag.t==='fxmove'){const q=drag.c0&&ceilPoint(p,drag.cy);
    if(q)fxDrag(q[drag.axis==='x'?0:1]-drag.c0[drag.axis==='x'?0:1],10*K/drag.ppm,e.altKey);
    else fxDrag((d[0]*drag.dir[0]+d[1]*drag.dir[1])/drag.ppm,10*K/drag.ppm,e.altKey);}
  else if(drag.t==='opmove')opDrag((d[0]*drag.dir[0]+d[1]*drag.dir[1])/drag.ppm,10*K/drag.ppm,e.altKey);
  else if(drag.L)layerDrag(p,d,e.shiftKey);
  drawAll();
});
function axisDrag(wd,tol,free,shift){
  const axis=drag.axis,[c,s]=AX[axis],b=drag.bb0,min0=b[axis+'0'],size0=b[axis+'1']-b[axis+'0'],ex=new Set(selMove().map(o=>o.id));
  if(drag.t==='move'){const r=snapMove(min0+wd,size0,axis,ex,tol,free,drag.noFace),off=r.v-min0;
    for(const o of selMove()){const s0=drag.st[o.id];if(s0)o[c]=s0[c]+off;}
    const on=axis==='y'?'':applyOnto(shift&&!free);
    drag.text=`${axis} ${fmt(r.v)} m`+(r.how?' · '+r.how+(r.n?' · '+r.n:''):'')+on;}
  else{const it=single();if(!it)return;const r=snapEdge(min0+size0+wd,axis,ex,tol,free,min0),size=Math.max(0.01,r.v-min0);
    setExtent(it,axis,min0,size);drag.text=`${s} ${fmt(size)} m`+(r.how?' · '+r.how+(r.n?' · '+r.n:''):'');}
  updateInspector();}
function endDrag(e,cancel){
  if(!drag)return;const d=drag;drag=null;
  if(d.onEnd&&d.moved)d.onEnd(cancel);
  if(!cancel&&d.moved&&d.onto)finishOnto(d);
  if(d.t==='empty'&&!d.moved&&!cancel&&psel&&!d.keep){psel=null;renderRooms();}
  if(d.t==='empty'){if(!cancel&&!d.moved&&!d.shift){if(d.view==='p'&&layerMode()){activeLayer=null;renderLayers();}else if(sel.length){sel=[];renderSel();return;}}}
  else if(d.moved&&d.t!=='locked'){commit();renderInspector();if(d.L)renderLayers();}
  drawAll();}
cv.addEventListener('pointerup',e=>endDrag(e,false));
cv.addEventListener('pointercancel',e=>endDrag(e,true));
cv.addEventListener('dblclick',e=>{if(layerMode())return;const o=pickBox(cpos(e,cv),8*K);if(o){sel=[keyOf(o)];renderSel();startRename();}});
cv.addEventListener('touchstart',e=>{if(e.touches.length!==1)return;const p=cpos(e.touches[0],cv);if(pHit(p,18*K).t!=='none')e.preventDefault();},{passive:false});

/* ---------- actions ---------- */
function renderSel(){renderInspector();renderList();updToolbar();drawAll();}
function guardLocked(){if(selLocked()){flash('Part of the selection is locked. Unlock it in the Objects panel first.');return true;}return false;}
function actDup(){if(!sel.length)return;const list=selMove();sel=cloneSet(list,0.1,0.1,' copy');commit();renderSel();flash('Duplicated'+(list.length>selBoxes().length?' with attached items':''));}
/* copy / paste: selection plus attached children, kept in memory; each paste lands 0.2 m further along */
let CLIP=null;
function actCopy(){if(!sel.length){flash('Select something to copy first.');return;}const list=selMove(),gids=new Set(list.filter(o=>o.g).map(o=>o.g));
  const oids=new Set(list.map(o=>o.id));
  CLIP={objects:JSON.parse(JSON.stringify(list)),groups:JSON.parse(JSON.stringify(S.groups.filter(g=>gids.has(g.id)))),fixtures:JSON.parse(JSON.stringify(S.fixtures.filter(f=>f.obj&&oids.has(f.obj)))),n:0};flash(`Copied ${sel.length} item${sel.length>1?'s':''}${list.length>selBoxes().length?' with attached items':''}.`);}
function actPaste(){if(!CLIP){flash('Nothing copied yet. Select something and press '+keyLabel(KM.copy)+'.');return;}CLIP.n++;const d=0.2*CLIP.n;
  sel=cloneSet(CLIP.objects,d,d,'',CLIP.groups);psel=null;commit();if(S.view==='sheet')setView('plan');renderSel();renderRooms();flash('Pasted');}
function actDel(){if(S.view==='sheet'&&skSel){skDelete();return;}if(psel&&!sel.length){delPsel();return;}if(!sel.length||guardLocked())return;const ids=new Set(selBoxes().map(o=>o.id));
  const kids=S.objects.filter(o=>o.parent&&ids.has(o.parent)&&!ids.has(o.id)).length;
  const nfx=S.fixtures.filter(f=>f.obj&&ids.has(f.obj)).length;
  S.objects=S.objects.filter(o=>!ids.has(o.id));for(const o of S.objects)if(o.parent&&ids.has(o.parent)){o.parent=null;o.po=null;}
  if(psel&&psel.k==='fx'&&!byId(fxById(psel.id)?.obj||'')&&fxById(psel.id)?.obj)psel=null;
  sel=[];cleanGroups();commit();renderSel();renderRooms();flash('Deleted'+(kids?`. ${kids} attached item${kids>1?'s were':' was'} detached and stay${kids>1?'':'s'} in place.`:'')+(nfx?` ${nfx} fixture${nfx>1?'s':''} on it went too.`:''));}
function actRot(deg,anchor){if(!sel.length||guardLocked())return;rotateItems(selBoxes(),deg,anchor);addGroupRot(sel,deg);commit();renderInspector();drawAll();}
function actGroup(){if(sel.length<2){flash('Select two or more items with Shift-click first.');return;}
  const list=selBoxes(),g={id:uid('g'),n:'Group '+(S.groups.length+1),vis:true,preset:null,tag:'',notes:'',rot:0,locked:false};S.groups.push(g);
  for(const o of list)o.g=g.id;cleanGroups();sel=['g:'+g.id];commit();renderSel();flash('Grouped');}
function actUngroup(){const gs=sel.filter(k=>k[0]==='g');if(!gs.length)return;const ns=sel.filter(k=>k[0]==='b');
  for(const k of gs){const id=k.slice(2),g=grpById(id);for(const o of members(id)){o.g=null;if(g){if(!o.tag)o.tag=g.tag;if(g.locked)o.locked=true;}ns.push('b:'+o.id);}S.groups=S.groups.filter(x=>x.id!==id);}
  sel=ns;commit();renderSel();flash('Ungrouped');}
function actHide(){if(!sel.length)return;for(const k of sel){const id=k.slice(2);if(k[0]==='b'){const o=byId(id);if(o)o.vis=false;}else{const g=grpById(id);if(g)g.vis=false;}}
  sel=[];commit();renderSel();flash('Hidden. Use the eye in the Objects list to show it again.');}
function actLockSel(){if(!sel.length)return;const lock=!sel.every(k=>{const id=k.slice(2);return k[0]==='b'?byId(id)?.locked:grpById(id)?.locked;});
  for(const k of sel){const id=k.slice(2);if(k[0]==='b'){const o=byId(id);if(o)o.locked=lock;}else{const g=grpById(id);if(g)g.locked=lock;}}
  commit();renderSel();flash(lock?'Locked':'Unlocked');}
function actDesel(){if(S.view==='sheet'&&(skTool!=='select'||skSel)){skCancel();return;}if(draft){finishDraft();return;}if(tool==='measure'&&MS.pts.length){MS.pts=[];drawAll();return;}if(tool!=='select'){setTool('select');return;}
  if(layerMode()&&activeLayer){activeLayer=null;renderLayers();drawAll();return;}if(psel){selectP(null);return;}if(sel.length){sel=[];renderSel();}}
function setToggle(k,v){S[k]=v;save();syncToggles();if(k==='lockCam'){syncCamUI();renderViews();}renderLegend();drawAll();}

/* ---------- camera keys ---------- */
let camT=null;
function clampCam(){const b=camBounds();S.cx=clamp(S.cx,b.x0,b.x1);S.cz=clamp(S.cz,b.z0,b.z1);S.eye=clamp(S.eye,0.3,2.4);S.yaw=normDeg(S.yaw);S.pitch=clamp(+S.pitch||0,-80,80);S.fov=clamp(S.fov,20,100);}
function camMove(a){if(S.lockCam){flash('Camera is locked. Press L or untick Lock camera to move it.');return;}
  const y=S.yaw*Math.PI/180,f=[Math.sin(y),-Math.cos(y)],r=[Math.cos(y),Math.sin(y)],st=0.1;
  if(a==='fwd'){S.cx+=f[0]*st;S.cz+=f[1]*st;}else if(a==='back'){S.cx-=f[0]*st;S.cz-=f[1]*st;}
  else if(a==='strafeL'){S.cx-=r[0]*st;S.cz-=r[1]*st;}else if(a==='strafeR'){S.cx+=r[0]*st;S.cz+=r[1]*st;}
  else if(a==='turnL')S.yaw-=2.5;else if(a==='turnR')S.yaw+=2.5;else if(a==='eyeUp')S.eye+=0.05;else if(a==='eyeDown')S.eye-=0.05;
  else if(a==='lookUp')S.pitch=(S.pitch||0)+2.5;else if(a==='lookDown')S.pitch=(S.pitch||0)-2.5;
  clampCam();syncCamUI();drawAll();clearTimeout(camT);camT=setTimeout(commit,400);}

/* spawn point: just inside the entrance door looking into the room, or the straight doorway view when no entrance is set */
function spawnView(){const o=S.openings.find(x=>x.entrance&&x.type==='door'),w=o&&wallById(o.wall);
  if(!w)return{...VIEWS.door,pitch:0};
  const u=wallU(w),n0=wallN(w),si=wallIn(w),n=[n0[0]*si,n0[1]*si],t=o.off+o.w/2;
  return{cx:w.a[0]+u[0]*t+n[0]*0.6,cz:w.a[1]+u[1]*t+n[1]*0.6,eye:1.6,fov:72,yaw:normDeg(Math.atan2(n[0],-n[1])*180/Math.PI),pitch:0};}
function resetView(){if(S.view==='plan'){planFit();return;}if(S.lockCam){flash('Camera is locked. Press L or untick Lock camera to move it.');return;}
  const fromDoor=S.openings.some(x=>x.entrance&&x.type==='door'&&wallById(x.wall));
  Object.assign(S,spawnView());clampCam();syncCamUI();commit();drawAll();
  flash(fromDoor?'View reset to the entrance.':'View reset to the default straight view. Mark a door as the entrance in the Room panel to start there instead.');}

/* ---------- keyboard shortcuts ---------- */
const ACTIONS=[
  ['fwd','Move forward','ArrowUp','Camera'],['back','Move back','ArrowDown','Camera'],
  ['turnL','Turn left','ArrowLeft','Camera'],['turnR','Turn right','ArrowRight','Camera'],
  ['strafeL','Step left','Shift+ArrowLeft','Camera'],['strafeR','Step right','Shift+ArrowRight','Camera'],
  ['eyeUp','Raise eye height','PageUp','Camera'],['eyeDown','Lower eye height','PageDown','Camera'],
  ['lookUp','Look up','Shift+ArrowUp','Camera'],['lookDown','Look down','Shift+ArrowDown','Camera'],['frame','Frame the selection (or the room)','Z','Camera'],
  ['del','Delete selected','Delete','Objects'],['dup','Duplicate','D','Objects'],['rot','Rotate 90°','R','Objects'],['rot15','Rotate 15°','Shift+R','Objects'],
  ['group','Group','G','Objects'],['ungroup','Ungroup','Shift+G','Objects'],['hide','Hide selected','H','Objects'],['lockSel','Lock / unlock selected','Shift+L','Objects'],
  ['rename','Rename selected','F2','Objects'],['desel','Deselect','Escape','Objects'],
  ['resetView','Reset view','Home','View'],['viewPlan','Plan view','1','View'],['viewPersp','Perspective view','2','View'],['trace','Trace mode','T','View'],['lock','Lock camera','L','View'],['lockWalls','Lock walls','K','View'],['solid','Solid view (hide hidden lines)','S','View'],
  ['viewSheet','Sheet view','3','View'],['clr','Show clearances','Shift+C','View'],['light','Show light coverage','I','View'],['paper','Paper frame over perspective','P','View'],
  ['tags','Tag colours','C','View'],['undo','Undo','Mod+Z','Edit'],['redo','Redo','Mod+Shift+Z','Edit'],
  ['copy','Copy','Mod+C','Edit'],['paste','Paste','Mod+V','Edit'],
  ['toolSelect','Select tool','V','Tools'],['toolWall','Draw walls','W','Tools'],['toolRoom','Draw room outline','Shift+W','Tools'],
  ['toolDoor','Add door','O','Tools'],['toolWindow','Add window','Shift+O','Tools'],['toolFixture','Add fixture','F','Tools'],
  ['toolMark','Add reference line','E','Tools'],['toolMeasure','Measure','M','Tools']
];
function defaultKeys(){const m={};for(const a of ACTIONS)m[a[0]]=a[2];return m;}
let KM=defaultKeys();
try{const k=JSON.parse(localStorage.getItem('rsg-keys')||'null');if(k)for(const a of ACTIONS)if(typeof k[a[0]]==='string')KM[a[0]]=k[a[0]];}catch(e){}
function saveKeys(){try{localStorage.setItem('rsg-keys',JSON.stringify(KM));}catch(e){}}
const RUN={fwd:()=>camMove('fwd'),back:()=>camMove('back'),turnL:()=>camMove('turnL'),turnR:()=>camMove('turnR'),strafeL:()=>camMove('strafeL'),strafeR:()=>camMove('strafeR'),
  eyeUp:()=>camMove('eyeUp'),eyeDown:()=>camMove('eyeDown'),lookUp:()=>camMove('lookUp'),lookDown:()=>camMove('lookDown'),frame:()=>frameView(),
  lockWalls:()=>setToggle('lockWalls',!S.lockWalls),solid:()=>setToggle('solid',!S.solid),del:actDel,dup:actDup,rot:()=>actRot(90,true),rot15:()=>actRot(15,false),
  group:actGroup,ungroup:actUngroup,hide:actHide,lockSel:actLockSel,rename:()=>{if(single())startRename();},desel:actDesel,
  resetView,viewPlan:()=>setView('plan'),viewPersp:()=>setView('persp'),trace:()=>setToggle('trace',!S.trace),lock:()=>setToggle('lockCam',!S.lockCam),
  tags:()=>setToggle('colorTags',!S.colorTags),undo,redo,
  viewSheet:()=>setView('sheet'),clr:()=>setToggle('showClr',!S.showClr),light:()=>setToggle('showLight',!S.showLight),paper:()=>{S.paper.persp=!S.paper.persp;save();renderPaperCtls();if(S.paper.persp&&S.view!=='persp')setView('persp');drawAll();},
  copy:actCopy,paste:actPaste,toolSelect:()=>setTool('select'),toolWall:()=>setTool('wall'),toolRoom:()=>setTool('room'),toolDoor:()=>setTool('door'),
  toolWindow:()=>setTool('window'),toolFixture:()=>setTool('fixture'),toolMark:()=>setTool('mark'),toolMeasure:()=>setTool('measure')};
function comboOf(e){if(['Shift','Control','Alt','Meta','AltGraph','CapsLock'].includes(e.key))return null;
  let k=e.key;const m=/^Key([A-Z])$/.exec(e.code||'')||/^Digit(\d)$/.exec(e.code||'');if(m)k=m[1];
  else if(k===' ')k='Space';else if(k.length===1)k=k.toUpperCase();
  return(e.ctrlKey||e.metaKey?'Mod+':'')+(e.altKey?'Alt+':'')+(e.shiftKey?'Shift+':'')+k;}
function keyLabel(c){if(!c)return'—';return c.split('+').map(p=>({Mod:IS_MAC?'⌘':'Ctrl',Alt:IS_MAC?'⌥':'Alt',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Escape:'Esc',PageUp:'PgUp',PageDown:'PgDn'}[p]||p)).join(' + ');}
let capture=null;
function isTyping(t){if(!t)return false;if(t.isContentEditable)return true;if(t.tagName==='TEXTAREA'||t.tagName==='SELECT')return true;
  if(t.tagName==='INPUT')return!['checkbox','radio','button','submit','reset','file','color'].includes((t.type||'').toLowerCase());return false;}
window.addEventListener('keydown',e=>{
  /* the New project dialog takes the keyboard while it is open: Esc closes it, nothing else fires */
  if(typeof newDlgOpen==='function'&&newDlgOpen()){if(e.key==='Escape'){e.preventDefault();closeNewDlg();}return;}
  if(typeof shareOpen==='function'&&shareOpen()){if(e.key==='Escape'){e.preventDefault();closeShare();}return;}
  if(typeof glowOpen==='function'&&glowOpen()&&e.key==='Escape'){e.preventDefault();closeGlow();return;}
  if(capture){e.preventDefault();e.stopPropagation();if(e.key==='Escape'&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey){capture=null;renderKeys();return;}
    const c=comboOf(e);if(!c)return;let note='';for(const a of ACTIONS)if(a[0]!==capture&&KM[a[0]]===c){KM[a[0]]='';note=` (removed from "${a[1]}")`;}
    KM[capture]=c;const lbl=ACTIONS.find(a=>a[0]===capture)[1];capture=null;saveKeys();renderKeys();flash(`${lbl}: ${keyLabel(c)}${note}`);return;}
  if(isTyping(e.target))return;
  if(typeof flyKey==='function'&&flyKey(e,true))return;
  if(draft&&e.key==='Enter'){e.preventDefault();finishDraft();return;}
  const c=comboOf(e);if(!c)return;const a=ACTIONS.find(x=>KM[x[0]]===c);if(!a)return;
  /* leave the browser's own copy alone when text on the page is selected */
  if(a[0]==='copy'&&String(window.getSelection&&window.getSelection()||'').trim())return;
  e.preventDefault();RUN[a[0]]();
},true);
