'use strict';
/* Linewright — state, data model (schema v6), persistence, history, import/export.
   v3 adds: fixtures (outlets, switches, lights on a wall or the ceiling), object parent offsets (po) and clearances (clr),
   rooms flagged auto/drawn, sheet + paper settings, notes as titled sections with items that can carry a "verify" mark.
   v4 adds a variant (v) to fixtures: outlet sockets/kind, switch gangs/kind.
   v5 adds: extruded polygon footprints (o.poly, points normalised to the box w × d, 0..1), a quarter-turn counter (o.q) so a
   box keeps track of its absolute orientation, fixtures on a face of an object (f.obj + f.face; y is then measured from the
   object's base), the power-strip fixture, image corner-pin (L.pin, four view points) and camera-match traces (L.cm),
   and scenarios (named sets of object positions) with an optional ghost overlay. Walls may be at any angle.
   Later v5 additions (optional, default off): f.locked on wall/ceiling fixtures, traceHL (list of tags, kinds and items that glow in trace mode; an old single string is wrapped in a list).
   v6 adds: wall material (type 'concrete' | 'wood', wood style + slat width/gap), camera pitch, saved viewpoints (views),
   and the view settings solid, miniPlan and lockWalls (all optional; older files get concrete walls, a level camera and no views).
   v7 adds: o.locked on openings (doors and windows can be locked) and the view setting fxMini (fixtures shown in the mini plan).
   v9 adds: sheet.draw, the Sheet scratchpad marks (lines, arrows, rectangles, text, dimension lines in page millimetres).
   v8 adds: fixtures on the top surface of an object (f.top; f.x/f.z are then offsets from the object's centre in its own axes)
   and objects attached to a wall (o.pw = wall id; o.pt / o.pn / o.pa = position along the wall, distance from its face and
   angle relative to the wall's front, refreshed on every commit so the object follows the wall).
   v7 also adds the Power box and Pipe (wall / floor / ceiling) fixture types, the built-in Plumbing tag and the view setting showLight.
   Plan:      walls (segments), openings (doors/windows on a wall), rooms (named floor outlines), marks (reference lines like END).
   Furniture: objects (boxes, optional yaw `rot` around their centre), groups (optionally parametric presets).
   Also: tags, project notes, image layers (metadata only; image data lives in IndexedDB). */

/* storage keys keep the old 'rsg' prefix (rsg, rsg-keys, rsg-layers) so projects saved before the rename still load */
const APP_ID='linewright',SCHEMA=9;
const VIEWS={
  door:{cx:1.27,cz:4.4,eye:1.55,yaw:0,fov:70},
  corner:{cx:2.3,cz:3.2,eye:1.6,yaw:-32,fov:75},
  top:{cx:1.6,cz:4.5,eye:2.2,yaw:-8,fov:72}
};
const TAG_DEFAULTS=[
  {id:'furniture',name:'Furniture',c:['#2F5BD3','#86A6FF']},
  {id:'electronics',name:'Electronics',c:['#B86E12','#E9A54E']},
  {id:'programming',name:'Programming',c:['#16807A','#4FC7BE']},
  {id:'storage',name:'Storage',c:['#7B4FC4','#B49CF2']},
  {id:'electrical',name:'Electrical',c:['#C23A3A','#F07A7A']},
  {id:'existing',name:'Existing',c:['#7E868C','#8A939A']},
  {id:'plumbing',name:'Plumbing',c:['#1F7FA8','#6CC3E8']}
];
/* wall material: wood walls get a pattern (vertical or horizontal slats with a gap, boards, or a plain panel) */
const WALL_STYLES={slats:'Slatted, vertical',hslats:'Slatted, horizontal',boards:'Horizontal boards',panel:'Plain panel'};
const AX={x:['x','w'],y:['y','h'],z:['z','d']};
const IS_MAC=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent);

function clamp(v,a,b){return Math.min(b,Math.max(a,v));}
function uid(p){return p+Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-3);}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function fmt(v){return (+v).toFixed(2);}
function fmtIn(v){return String(+(+v).toFixed(4));}
const $=id=>document.getElementById(id);

function defaultScene(){
  const W=2.55,D=4.70,END=2.80;
  return{
    walls:[{id:'w1',a:[0,0],b:[W,0],h:null},{id:'w2',a:[W,0],b:[W,D],h:null},{id:'w3',a:[W,D],b:[0,D],h:null},{id:'w4',a:[0,D],b:[0,0],h:null}],
    openings:[
      {id:'op1',wall:'w1',type:'window',off:+((W-1.455)/2).toFixed(4),w:1.455,h:1.19,sill:1.1},
      {id:'op2',wall:'w2',type:'door',off:2.30,w:0.835,h:2.10,sill:0,hinge:'b',side:-1,angle:90,entrance:false}
    ],
    rooms:[{id:'r1',name:'Living room',pts:[[0,0],[W,0],[W,D],[0,D]],auto:true}],
    fixtures:[],
    marks:[{id:'m1',a:[0,END],b:[W,END],label:'END'}],
    groups:[{id:'gk',n:'Kitchen side',vis:true,preset:null,tag:'existing',notes:'',rot:0,locked:true}],
    objects:[
      {id:'bk1',n:'Counter',x:0,y:0,z:END,w:0.55,h:0.92,d:1.204,g:'gk'},
      {id:'bk2',n:'Counter (far)',x:W-0.49,y:0,z:D-1.376,w:0.49,h:0.93,d:1.376,g:'gk'}
    ]
  };
}
const DEF={...VIEWS.door,pitch:0,solid:false,miniPlan:true,fxMini:false,showLight:false,lockWalls:false,views:[],ceil:2.6,guides:true,grid:false,labels:true,trace:false,traceHL:[],lockCam:false,colorTags:false,hiddenTags:[],
  snap:0.05,view:'persp',panels:{plan:'rooms',persp:'camera',sheet:'sheet'},notes:[],layers:[],showClr:false,
  paper:{size:'A4',orient:'landscape',scale:50,persp:false,grid:true},sheet:{title:'',elev:[],depth:1.2},
  scenarios:[],scenario:null,ghost:null};

/* footprint polygon: at least 3 finite points, clamped to the unit square */
function normPoly(p){if(!Array.isArray(p))return null;const a=p.filter(q=>Array.isArray(q)&&isFinite(+q[0])&&isFinite(+q[1])).map(q=>[clamp(+q[0],0,1),clamp(+q[1],0,1)]);return a.length>=3?a:null;}
/* walls: a→b, h (null = ceiling height), material. Slat width sw and gap sg in metres. */
function normWall(w){const wood=w.type==='wood';return{...w,h:w.h?+w.h||null:null,type:wood?'wood':'concrete',style:WALL_STYLES[w.style]?w.style:'slats',sw:clamp(+w.sw||0.05,0.01,0.5),sg:clamp(w.sg===undefined?0.02:+w.sg||0,0,0.5)};}
function normView(v){return{id:v.id||uid('v'),name:String(v.name??'View'),cx:+v.cx||0,cz:+v.cz||0,eye:clamp(+v.eye||1.6,0.3,2.4),yaw:+v.yaw||0,pitch:clamp(+v.pitch||0,-80,80),fov:clamp(+v.fov||72,20,100)};}
function normObj(o){return{id:o.id||uid('b'),n:String(o.n??'Box'),x:+o.x||0,y:+o.y||0,z:+o.z||0,
  w:Math.max(0,+o.w||0),d:Math.max(0,+o.d||0),h:Math.max(0,+o.h||0),rot:+o.rot||0,q:((Math.round(+o.q||0)%4)+4)%4,poly:normPoly(o.poly),vis:o.vis!==false,g:o.g||null,
  tag:o.tag||'',notes:String(o.notes||''),locked:!!o.locked,parent:o.parent||null,pw:o.pw?String(o.pw):null,pt:+o.pt||0,pn:+o.pn||0,pa:+o.pa||0,po:o.po&&typeof o.po==='object'?{x:+o.po.x||0,y:+o.po.y||0,z:+o.po.z||0}:null,
  clr:Math.max(0,+o.clr||0),clrLabel:String(o.clrLabel||'')};}
/* sheet scratchpad marks: {id, k:'line'|'arrow'|'rect'|'text'|'dim', a:[x,y], b:[x,y], t} in sheet-page millimetres */
function normDraw(a){const ok=['line','arrow','rect','text','dim'],pt=p=>Array.isArray(p)&&p.length===2&&isFinite(+p[0])&&isFinite(+p[1])?[+p[0],+p[1]]:null;
  return(Array.isArray(a)?a:[]).filter(m=>m&&ok.includes(m.k)&&pt(m.a)).map(m=>({id:m.id||uid('k'),k:m.k,a:pt(m.a),b:pt(m.b)||pt(m.a),t:String(m.t||'')}));}
function normGroup(g){return{id:g.id,n:String(g.n??'Group'),vis:g.vis!==false,preset:g.preset||null,tag:g.tag||'',
  notes:String(g.notes||''),rot:+g.rot||0,locked:!!g.locked,clr:Math.max(0,+g.clr||0),clrLabel:String(g.clrLabel||'')};}
/* notes: titled sections; accepts older plain strings */
function normNotes(a){if(!Array.isArray(a))return[];return a.map(x=>{
  if(typeof x==='string')return{id:uid('n'),title:'Notes',items:[{id:uid('i'),text:x,verify:false}]};
  if(!x||typeof x!=='object')return null;
  return{id:x.id||uid('n'),title:String(x.title??'Notes'),items:(Array.isArray(x.items)?x.items:[]).map(i=>typeof i==='string'?{id:uid('i'),text:i,verify:false}:{id:i.id||uid('i'),text:String(i.text||''),verify:!!i.verify})};}).filter(Boolean);}
function normOpening(o){const d=o.type==='door';return{...o,type:d?'door':'window',locked:!!o.locked,off:+o.off||0,w:Math.max(0.05,+o.w||0.8),h:Math.max(0.05,+o.h||(d?2.1:1.2)),sill:d?0:(+o.sill||0),
  ...(d?{hinge:o.hinge==='a'?'a':'b',side:o.side===-1?-1:1,angle:clamp(+(o.angle??90),0,180),entrance:!!o.entrance}:{})};}
/* wall + ceiling fixtures: positioned by wall + distance along it (off, to the centre) + height (y), or x/z on the ceiling.
   Variants (v): n = sockets / gangs (sets the plate width), k = kind (drives the symbol). */
/* pipe and hole variants: d = diameter in metres (also the size of the mark), k = kind */
const PIPE_V={water15:{label:'Water supply 15 mm',d:0.015,k:'water'},water22:{label:'Water supply 22 mm',d:0.022,k:'water'},
  drain50:{label:'Drain 50 mm',d:0.05,k:'drain'},drain110:{label:'Drain 110 mm',d:0.11,k:'drain'},
  vent100:{label:'Vent / duct 100 mm',d:0.1,k:'vent'},conduit25:{label:'Cable conduit 25 mm',d:0.025,k:'conduit'}};
/* nottop: can't sit on the top of an object (hanging or in-wall fixtures). ceil: x/z anchored on the ceiling, floor: x/z anchored
   on the floor (flat = either), r: light reach in metres (Light coverage),
   round: drawn as a circle of the variant's diameter, tag: default tag */
const FX={
  outlet:{label:'Outlet',w:0.08,h:0.08,y:0.3,variants:{
    single:{label:'Single',n:1},double:{label:'Double',n:2},triple:{label:'Triple',n:3},
    high:{label:'High current (20 A)',n:1,k:'high'},usb:{label:'With USB',n:1,k:'usb'},data:{label:'Data (RJ45)',n:1,k:'data'},cat6:{label:'Network (Cat6)',n:2,k:'data'},
    fibre:{label:'Fibre (optical)',n:1,k:'data'},tv:{label:'TV / coax',n:1,k:'tv'}}},
  switch:{label:'Switch',w:0.08,h:0.12,y:1.1,variants:{
    g1:{label:'1-gang',n:1},g2:{label:'2-gang',n:2},g3:{label:'3-gang',n:3},twoway:{label:'Two-way',n:1,k:'twoway'},dimmer:{label:'Dimmer',n:1,k:'dimmer'}}},
  wlight:{label:'Wall light',w:0.24,h:0.14,y:2.0,r:1.0,nottop:true},
  clight:{label:'Ceiling light',w:0.3,h:0.3,ceil:true,r:1.5},
  strip:{label:'Power strip',w:0.1,h:0.05,y:0.05,variants:{s3:{label:'3 sockets',n:3},s4:{label:'4 sockets',n:4},s6:{label:'6 sockets',n:6}}},
  smoke:{label:'Smoke detector',w:0.1,h:0.1,ceil:true,round:true,sym:'SD'},
  thermo:{label:'Thermostat',w:0.09,h:0.09,y:1.5,sym:'T'},
  intercom:{label:'Intercom',w:0.1,h:0.16,y:1.4,sym:'IC'},
  fan:{label:'Extractor fan',w:0.15,h:0.15,y:2.2,round:true,sym:'EF'},
  cfan:{label:'Ceiling fan',w:1.2,h:1.2,ceil:true,round:true,sym:'CF'},
  sprinkler:{label:'Sprinkler',w:0.06,h:0.06,ceil:true,round:true,sym:'SP'},
  hatch:{label:'Access hatch (wall)',w:0.4,h:0.4,y:0.6,rect:true,sym:'AH'},
  hatchc:{label:'Access hatch (ceiling)',w:0.5,h:0.5,ceil:true,rect:true,sym:'AH'},
  radvalve:{label:'Radiator valve',w:0.05,h:0.05,y:0.2,round:true,sym:'RV',tag:'plumbing'},
  powerbox:{label:'Power box',w:0.3,h:0.4,y:1.5,variants:{surface:{label:'Surface mounted',n:1,k:'surface'},recessed:{label:'Recessed',n:1,k:'recessed'}}},
  pipe:{label:'Pipe (wall)',w:0.05,h:0.05,y:0.3,round:true,nottop:true,tag:'plumbing',variants:PIPE_V},
  pipef:{label:'Pipe (floor)',w:0.05,h:0.05,floor:true,round:true,tag:'plumbing',variants:PIPE_V},
  pipec:{label:'Pipe (ceiling)',w:0.05,h:0.05,ceil:true,round:true,tag:'plumbing',variants:PIPE_V}
};
for(const k in FX)FX[k].flat=!!(FX[k].ceil||FX[k].floor);
function fxVariant(f){const V=FX[f.type].variants;return V?V[f.v]||Object.values(V)[0]:null;}
/* plate size: each extra socket or gang adds 0.06 m of width */
function fxSize(f){const T=FX[f.type],V=fxVariant(f),n=V?V.n||1:1;if(V&&V.d)return{w:V.d,h:V.d};return{w:T.w+(n-1)*0.06,h:T.h};}
/* wall fixtures: wall + off + y (from the floor). Object fixtures: obj + face (edge index of the footprint) + off + y (from the object's base). */
function normFx(f){const type=FX[f.type]?f.type:'outlet',T=FX[type],V=T.variants,obj=!T.flat&&f.obj?String(f.obj):null;
  return{id:f.id||uid('f'),type,v:V?(V[f.v]?f.v:Object.keys(V)[0]):'',n:String(f.n??T.label),wall:obj?null:f.wall||null,obj,face:Math.max(0,Math.round(+f.face||0)),
    top:!!obj&&!!f.top&&!T.nottop,off:+f.off||0,y:f.y===undefined?T.y||0:+f.y||0,x:+f.x||0,z:+f.z||0,tag:f.tag===undefined?(T.tag||'electrical'):String(f.tag||''),notes:String(f.notes||''),vis:f.vis!==false,locked:!obj&&!!f.locked};}
/* scenarios: grp[gid] = {x0,y0,z0 (bbox min), rot, vis}; pos[oid] = {cx,cz,y,a (absolute yaw = rot + 90·q), vis} for ungrouped objects */
function normScenario(s){if(!s||typeof s!=='object')return null;const ob=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
  const pos={},grp={};for(const[k,v]of Object.entries(ob(s.pos)))if(v&&typeof v==='object')pos[k]={cx:+v.cx||0,cz:+v.cz||0,y:+v.y||0,a:+v.a||0,vis:v.vis!==false};
  for(const[k,v]of Object.entries(ob(s.grp)))if(v&&typeof v==='object')grp[k]={x0:+v.x0||0,y0:+v.y0||0,z0:+v.z0||0,rot:+v.rot||0,vis:v.vis!==false};
  return{id:s.id||uid('s'),name:String(s.name??'Scenario'),pos,grp};}
function normLayer(L){const pin=Array.isArray(L.pin)&&L.pin.length===4&&L.pin.every(p=>Array.isArray(p)&&isFinite(+p[0])&&isFinite(+p[1]))?L.pin.map(p=>[+p[0],+p[1]]):null;
  let cm=null;if(L.cm&&Array.isArray(L.cm.lines)&&L.cm.lines.length===4)cm={lines:L.cm.lines.map(l=>Array.isArray(l)&&l.length===2?l.map(p=>[+(p&&p[0])||0,+(p&&p[1])||0]):[[0.2,0.8],[0.5,0.6]]),
    on:Array.isArray(L.cm.on)?[0,1,2,3].map(i=>String(L.cm.on[i]||'')):['','','',''],res:L.cm.res||null};
  return{fx:false,fy:false,keep:true,over:true,op:0.6,rot:0,vis:true,...L,pin,cm};}
function copyTags(){return TAG_DEFAULTS.map(t=>({...t,c:[...t.c]}));}

/* Accepts v0 (boxes), v1 (objects/groups, fixed room) and v2–v6. Returns a complete v7 state.
   v6 → v7: openings get locked = false, fxMini = false.
   v5 → v6: walls get type 'concrete' (plus style/sw/sg defaults), pitch = 0, views = [], solid off, miniPlan on, lockWalls off.
   v4 → v5: objects get q = 0 (quarter turns) and poly = null (a plain box); fixtures get obj = null (on a wall or the ceiling);
   layers get pin = null (flat) and cm = null; scenarios start empty. Nothing else changes meaning. */
function migrate(raw){
  const s={...DEF,...defaultScene(),tags:copyTags(),panels:{...DEF.panels},paper:{...DEF.paper},sheet:{...DEF.sheet,elev:[],draw:[]},scenarios:[],scenario:null,ghost:null,views:[]};
  if(!raw||typeof raw!=='object')return s;
  const v=+raw.version||1;
  for(const k of['cx','cz','eye','yaw','pitch','fov','ceil','guides','grid','labels','trace','traceHL','lockCam','snap','colorTags','solid','miniPlan','fxMini','showLight','lockWalls'])if(raw[k]!==undefined)s[k]=raw[k];
  if(v>=2){
    for(const k of['walls','openings','rooms','marks','objects','groups','tags','notes','hiddenTags','layers','fixtures','scenarios','views'])if(Array.isArray(raw[k]))s[k]=raw[k];
    if(v>=5){if(typeof raw.scenario==='string')s.scenario=raw.scenario;if(typeof raw.ghost==='string')s.ghost=raw.ghost;}
    if(['plan','persp','sheet'].includes(raw.view))s.view=raw.view;
    if(raw.showClr!==undefined)s.showClr=!!raw.showClr;
    /* v2 rooms predate auto-detection: treat them as detected outlines so they follow wall edits */
    if(v<3)s.rooms=s.rooms.map(r=>r&&r.drawn===undefined&&r.auto===undefined?{...r,auto:true}:r);
    if(raw.panels&&typeof raw.panels==='object')s.panels={...s.panels,...raw.panels};
  }else{
    const win=s.openings.find(o=>o.type==='window');if(win&&raw.sill!==undefined)win.sill=+raw.sill||1.1;
    if(raw.beyond===false)s.groups[0].vis=false;
    const objs=Array.isArray(raw.objects)?raw.objects:Array.isArray(raw.boxes)?raw.boxes:[];
    s.objects=s.objects.concat(objs);
    const gs=Array.isArray(raw.groups)?raw.groups.filter(g=>g&&g.id).map(g=>g.preset?{...g,preset:{...g.preset,rot:((+g.preset.rot||0)%4)*90}}:g):[];
    s.groups=s.groups.concat(gs);
    if(Array.isArray(raw.layers))s.layers=raw.layers;
  }
  s.objects=s.objects.filter(o=>o&&typeof o==='object').map(normObj);
  s.groups=s.groups.filter(g=>g&&g.id).map(normGroup);
  s.layers=s.layers.filter(L=>L&&L.id).map(normLayer);
  s.scenarios=(Array.isArray(s.scenarios)?s.scenarios:[]).map(normScenario).filter(Boolean);
  if(!s.scenarios.some(x=>x.id===s.scenario))s.scenario=s.scenarios.length?s.scenarios[0].id:null;
  if(!s.scenarios.some(x=>x.id===s.ghost)||s.ghost===s.scenario)s.ghost=null;
  s.tags=(s.tags||[]).filter(t=>t&&t.id&&Array.isArray(t.c));if(!s.tags.length)s.tags=copyTags();
  if(!s.tags.some(t=>t.id==='plumbing'))s.tags.push(copyTags().find(t=>t.id==='plumbing'));
  s.walls=s.walls.filter(w=>w&&w.id&&Array.isArray(w.a)&&Array.isArray(w.b)).map(normWall);
  s.pitch=clamp(+s.pitch||0,-80,80);s.solid=!!s.solid;s.miniPlan=s.miniPlan!==false;s.fxMini=!!s.fxMini;s.showLight=!!s.showLight;s.lockWalls=!!s.lockWalls;
  s.views=(Array.isArray(s.views)?s.views:[]).filter(v=>v&&typeof v==='object').map(normView);
  s.openings=s.openings.filter(o=>o&&o.id);
  s.hiddenTags=Array.isArray(s.hiddenTags)?s.hiddenTags:[];
  s.openings=s.openings.map(normOpening);
  s.rooms=(s.rooms||[]).filter(r=>r&&Array.isArray(r.pts)).map(r=>({id:r.id||uid('r'),name:String(r.name??'Room'),pts:r.pts,auto:!!r.auto,drawn:!!r.drawn}));
  s.marks=(s.marks||[]).filter(m=>m&&Array.isArray(m.a)&&Array.isArray(m.b)).map(m=>({id:m.id||uid('m'),a:m.a,b:m.b,label:String(m.label??'')}));
  s.fixtures=(Array.isArray(s.fixtures)?s.fixtures:[]).filter(f=>f&&typeof f==='object').map(normFx);
  s.notes=normNotes(s.notes);
  s.traceHL=Array.isArray(s.traceHL)?s.traceHL.filter(x=>typeof x==='string'):typeof s.traceHL==='string'&&s.traceHL?[s.traceHL]:[];
  s.paper={...DEF.paper,...(raw.paper&&typeof raw.paper==='object'?raw.paper:{})};
  const sh=raw.sheet&&typeof raw.sheet==='object'?raw.sheet:{};
  s.sheet={...DEF.sheet,...sh,elev:(Array.isArray(sh.elev)?sh.elev:[]).filter(e=>e&&e.wall).map(e=>({wall:e.wall,flip:!!e.flip})),draw:normDraw(sh.draw)};
  s.version=SCHEMA;
  for(const k of['boxes','sill','beyond','tab'])delete s[k];
  return s;
}
function loadState(){try{return migrate(JSON.parse(localStorage.getItem('rsg')||'null'));}catch(e){return migrate(null);}}
let S=loadState();
function save(){try{localStorage.setItem('rsg',JSON.stringify(S));}catch(e){}}

/* history: everything a user would expect Undo to revert */
const HKEYS=['cx','cz','eye','yaw','pitch','fov','views','ceil','walls','openings','rooms','marks','objects','groups','layers','tags','notes','fixtures','sheet','scenarios','scenario','ghost'];
let hist=[],hi=-1;
function snapState(){const o={};for(const k of HKEYS)o[k]=S[k];return JSON.stringify(o);}
function commit(){if(typeof updOffsets==='function')updOffsets();const s=snapState();if(hist[hi]===s){save();return;}hist=hist.slice(0,hi+1);hist.push(s);if(hist.length>300)hist.shift();hi=hist.length-1;save();if(typeof updToolbar==='function')updToolbar();}
function restore(s){Object.assign(S,JSON.parse(s));sel=sel.filter(validKey);if(psel&&!pselObj())psel=null;if(activeLayer&&!S.layers.some(L=>L.id===activeLayer))activeLayer=null;save();renderAll();size();}
function undo(){if(hi<=0)return;hi--;restore(hist[hi]);flash('Undone');}
function redo(){if(hi>=hist.length-1)return;hi++;restore(hist[hi]);flash('Redone');}

/* selection + interaction state */
let sel=[];            // 'b:<id>' or 'g:<id>'
let activeLayer=null;
let drag=null;
let settingsOpen=false;
let psel=null;         // plan element selection: {k:'wall'|'op'|'fx'|'mark'|'room', id}
let tool='select';     // plan/perspective tool: select, wall, room, door, window, fixture, mark, measure
const openGroups=new Set();

/* model accessors */
const byId=id=>S.objects.find(o=>o.id===id);
const grpById=id=>S.groups.find(g=>g.id===id);
const members=gid=>S.objects.filter(o=>o.g===gid);
const tagById=id=>S.tags.find(t=>t.id===id);
const wallById=id=>S.walls.find(w=>w.id===id);
const fxById=id=>S.fixtures.find(f=>f.id===id);
function pselObj(){if(!psel)return null;const L={wall:S.walls,op:S.openings,fx:S.fixtures,mark:S.marks,room:S.rooms}[psel.k];return L?L.find(x=>x.id===psel.id)||null:null;}
function effTag(o){if(o.tag)return o.tag;if(o.g){const g=grpById(o.g);if(g&&g.tag)return g.tag;}return'';}
function visible(o){if(!o.vis)return false;if(o.g){const g=grpById(o.g);if(g&&!g.vis)return false;}
  if(S.colorTags&&S.hiddenTags.length&&S.hiddenTags.includes(effTag(o)||'_none'))return false;return true;}
function isLocked(o){if(o.locked)return true;if(o.g){const g=grpById(o.g);if(g&&g.locked)return true;}return false;}
function keyOf(o){return o.g?'g:'+o.g:'b:'+o.id;}
function validKey(k){const id=k.slice(2);return k[0]==='b'?!!byId(id):!!grpById(id);}
function selBoxes(){const out=[];for(const k of sel){const id=k.slice(2);if(k[0]==='b'){const o=byId(id);if(o)out.push(o);}else out.push(...members(id));}return out;}
function single(){if(sel.length!==1)return null;const k=sel[0],id=k.slice(2);if(k[0]==='b'){const o=byId(id);return o?{kind:'b',o}:null;}const g=grpById(id);return g?{kind:'g',g}:null;}
function itemLocked(it){return it.kind==='b'?isLocked(it.o):!!it.g.locked;}
function selLocked(){return selBoxes().some(isLocked);}
function resizable(it){if(!it)return false;if(it.kind==='b')return!it.o.rot&&!isLocked(it.o);const g=it.g;return!!g.preset&&!g.locked&&(((g.preset.rot||0)%90+90)%90===0);}

/* box footprint corners (x,z) with yaw about the box centre */
function corners(o){if(!o.rot)return[[o.x,o.z],[o.x+o.w,o.z],[o.x+o.w,o.z+o.d],[o.x,o.z+o.d]];
  const cx=o.x+o.w/2,cz=o.z+o.d/2,hw=o.w/2,hd=o.d/2,a=o.rot*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a);
  return[[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([lx,lz])=>[cx+lx*ca-lz*sa,cz+lx*sa+lz*ca]);}
/* real footprint: the box corners, or the extruded polygon (normalised to w × d) turned with the box */
function foot(o){if(!o.poly)return corners(o);const cx=o.x+o.w/2,cz=o.z+o.d/2,a=(o.rot||0)*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a);
  return o.poly.map(([u,v])=>{const lx=(u-0.5)*o.w,lz=(v-0.5)*o.d;return[cx+lx*ca-lz*sa,cz+lx*sa+lz*ca];});}
function aabb(o){let x0=Infinity,z0=Infinity,x1=-Infinity,z1=-Infinity;for(const[x,z]of foot(o)){x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);}
  return{x0,x1,y0:o.y,y1:o.y+o.h,z0,z1};}
function bbox(list){const b={x0:Infinity,y0:Infinity,z0:Infinity,x1:-Infinity,y1:-Infinity,z1:-Infinity};
  for(const o of list){const a=aabb(o);for(const k of['x','y','z']){b[k+'0']=Math.min(b[k+'0'],a[k+'0']);b[k+'1']=Math.max(b[k+'1'],a[k+'1']);}}
  return b;}
function cleanGroups(){S.groups=S.groups.filter(g=>S.objects.some(o=>o.g===g.id));for(const o of S.objects)if(o.g&&!grpById(o.g))o.g=null;sel=sel.filter(validKey);}

/* import / export (scene only, no images) */
const SCENE_KEYS=['traceHL','cx','cz','eye','yaw','pitch','views','solid','lockWalls','fov','ceil','walls','openings','rooms','marks','objects','groups','tags','notes','snap','colorTags','hiddenTags','guides','grid','labels','fixtures','sheet','paper','showClr','showLight','scenarios','scenario','ghost'];
function exportScene(compact){const o={app:APP_ID,version:SCHEMA,exported:new Date().toISOString()};for(const k of SCENE_KEYS)o[k]=S[k];return JSON.stringify(o,null,compact?0:1);}
function importScene(text){
  let raw;try{raw=JSON.parse(text);}catch(e){throw new Error("That isn't valid JSON. Check that the whole file was pasted.");}
  if(!raw||typeof raw!=='object'||(!raw.walls&&!raw.objects&&!raw.boxes))throw new Error('No room or objects found in that file.');
  const m=migrate(raw);for(const k of SCENE_KEYS)S[k]=m[k];
  sel=[];psel=null;
}
