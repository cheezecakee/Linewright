'use strict';
/* Linewright — interface: views and panels, controls, inspector, object list, room panel, tags, legend,
   shortcuts settings, import/export, status, sizing and boot. Loaded last. */

const PANELS={plan:[['rooms','Room'],['objects','Objects']],persp:[['camera','Camera'],['objects','Objects'],['pfx','Fixtures'],['layers','Layers']],sheet:[['sheet','Sheet'],['objects','Objects']]};
const mqPhone=matchMedia('(max-width:700px)');
const EYE='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></svg>';
const EYEOFF='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z" opacity=".45"/><path d="M2.5 13.5l11-11"/></svg>';

/* ---------- views, panels, settings ---------- */
function setView(v){if(!PANELS[v])return;S.view=v;save();if(v==='persp'&&psel&&psel.k!=='fx')psel=null;
  if(draft)finishDraft();if(v==='sheet'||(v==='persp'&&!['select','measure'].includes(tool)))tool='select';hover=null;
  $('stage').classList.toggle('v-plan',v==='plan');$('stage').classList.toggle('v-sheet',v==='sheet');
  $('board-p').hidden=v!=='persp';$('board-v').hidden=v==='sheet';$('board-s').hidden=v!=='sheet';
  document.querySelectorAll('[data-viewbtn]').forEach(b=>{const on=b.dataset.viewbtn===v;b.setAttribute('aria-selected',on);b.tabIndex=on?0:-1;});
  document.querySelectorAll('[data-only]').forEach(el=>el.hidden=!el.dataset.only.split(' ').includes(v));
  renderTools();renderPtabs();renderRooms();if(v==='sheet'){renderSheetPanel();renderNotes();}size();}
function renderPtabs(){const pt=$('ptabs'),list=PANELS[S.view];let cur=S.panels[S.view];
  if(!list.some(p=>p[0]===cur))cur=S.panels[S.view]=list[0][0];
  pt.hidden=settingsOpen;
  pt.innerHTML=list.map(([id,l])=>`<button class="ptab" role="tab" type="button" data-ptab="${id}" aria-selected="${id===cur}">${l}</button>`).join('');
  pt.querySelectorAll('[data-ptab]').forEach(b=>b.addEventListener('click',()=>setPanel(b.dataset.ptab)));
  document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=settingsOpen?p.dataset.panel!=='settings':p.dataset.panel!==cur);
  $('b-settings').setAttribute('aria-pressed',settingsOpen);}
function setPanel(p){settingsOpen=false;if(!PANELS[S.view].some(x=>x[0]===p))return;S.panels[S.view]=p;save();renderPtabs();drawAll();}
function toggleSettings(v){settingsOpen=v===undefined?!settingsOpen:v;renderPtabs();drawAll();}
document.querySelectorAll('[data-viewbtn]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.viewbtn)));
$('b-settings').addEventListener('click',()=>toggleSettings());
$('b-settings-close').addEventListener('click',()=>toggleSettings(false));

/* ---------- camera + display controls ---------- */
const ids=['cx','cz','eye','yaw','fov'];
const fmtO={yaw:v=>(+v).toFixed(1)+'°',fov:v=>Math.round(v)+'°'};
function syncCamUI(){const b=camBounds();$('cx').min=b.x0;$('cx').max=b.x1;$('cz').min=b.z0;$('cz').max=b.z1;
  ids.forEach(k=>{const el=$(k);el.value=S[k];$('o-'+k).textContent=fmtO[k]?fmtO[k](S[k]):(+S[k]).toFixed(2);el.disabled=S.lockCam;});
  document.querySelectorAll('[data-view]').forEach(b=>b.disabled=S.lockCam);$('b-reset').disabled=S.lockCam;}
$('b-reset').addEventListener('click',resetView);
function syncToggles(){$('t-guides').checked=!!S.guides;$('t-trace').checked=!!S.trace;$('t-lock').checked=$('t-lock2').checked=!!S.lockCam;
  for(const[id,k]of[['b-tags','colorTags'],['b-labels','labels'],['b-grid','grid'],['b-trace','trace'],['b-lock','lockCam'],['b-clr','showClr']])$(id).setAttribute('aria-pressed',!!S[k]);
  $('snap').value=String(S.snap);}
ids.forEach(k=>{const el=$(k);
  el.addEventListener('input',()=>{if(S.lockCam){syncCamUI();return;}S[k]=+el.value;$('o-'+k).textContent=fmtO[k]?fmtO[k](S[k]):S[k].toFixed(2);drawAll();});
  el.addEventListener('change',commit);});
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{if(S.lockCam)return;Object.assign(S,VIEWS[b.dataset.view]);clampCam();syncCamUI();commit();drawAll();}));
$('t-guides').addEventListener('change',e=>setToggle('guides',e.target.checked));
$('t-trace').addEventListener('change',e=>setToggle('trace',e.target.checked));
$('t-lock').addEventListener('change',e=>setToggle('lockCam',e.target.checked));
$('t-lock2').addEventListener('change',e=>setToggle('lockCam',e.target.checked));
$('b-tags').addEventListener('click',()=>setToggle('colorTags',!S.colorTags));
$('b-labels').addEventListener('click',()=>setToggle('labels',!S.labels));
$('b-grid').addEventListener('click',()=>setToggle('grid',!S.grid));
$('b-trace').addEventListener('click',()=>setToggle('trace',!S.trace));
$('b-lock').addEventListener('click',()=>setToggle('lockCam',!S.lockCam));
$('snap').addEventListener('change',e=>{S.snap=+e.target.value||0.05;save();});
$('b-undo').addEventListener('click',undo);$('b-redo').addEventListener('click',redo);
$('b-dup').addEventListener('click',actDup);$('b-rot').addEventListener('click',()=>actRot(90,true));$('b-rot15').addEventListener('click',()=>actRot(15,false));
$('b-del').addEventListener('click',actDel);$('b-group').addEventListener('click',actGroup);$('b-ungroup').addEventListener('click',actUngroup);
$('b-hide').addEventListener('click',actHide);$('b-locksel').addEventListener('click',actLockSel);
$('b-copy').addEventListener('click',actCopy);$('b-paste').addEventListener('click',actPaste);
$('b-clr').addEventListener('click',()=>setToggle('showClr',!S.showClr));
$('b-paper').addEventListener('click',()=>RUN.paper());
document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
$('fx-type').addEventListener('change',()=>{if(tool!=='fixture')setTool('fixture');else drawAll();});
function updToolbar(){$('b-undo').disabled=hi<=0;$('b-redo').disabled=hi>=hist.length-1;
  const n=sel.length;['b-dup','b-rot','b-rot15','b-hide','b-locksel','b-copy'].forEach(i=>$(i).disabled=!n);
  $('b-del').disabled=!n&&!psel;$('b-paste').disabled=!CLIP;
  $('b-group').disabled=n<2;$('b-ungroup').disabled=!sel.some(k=>k[0]==='g');
  $('b-locksel').textContent=n&&sel.every(k=>{const id=k.slice(2);return k[0]==='b'?byId(id)?.locked:grpById(id)?.locked;})?'Unlock':'Lock';}

/* ---------- inspector ---------- */
function tagName(id){const t=id&&tagById(id);return t?t.name:'';}
function renderInspector(){const el=$('insp'),it=single(),list=selBoxes();
  if(!sel.length){el.innerHTML='<p class="note">Nothing selected. Click a box edge in the perspective, a shape in the plan, or a name in the list below. Shift-click adds to the selection.</p>';return;}
  const locked=selLocked();let h='';
  if(it){const nm=it.kind==='b'?it.o.n:it.g.n;h+=`<label class="fl" for="i-n">Name</label><input id="i-n" class="tx" value="${esc(nm)}">`;
    if(it.kind==='g')h+=`<p class="note">${it.g.preset?esc(PRESETS[it.g.preset.type]?.label||'Preset')+' · ':''}${list.length} parts. Changing x, y or z moves the whole group.</p>`;}
  else h+=`<p class="note">${sel.length} items selected. Press G or Group to keep them together.</p>`;
  let curTag='';if(it)curTag=it.kind==='b'?it.o.tag:it.g.tag;else{const ts=sel.map(k=>{const id=k.slice(2);return k[0]==='b'?byId(id)?.tag:grpById(id)?.tag;});if(ts.every(t=>t===ts[0]))curTag=ts[0]||'';}
  const inherit=it&&it.kind==='b'&&it.o.g?`From group (${esc(tagName(grpById(it.o.g)?.tag)||'none')})`:'No tag';
  h+=`<div class="ig"><label class="wide" for="i-tag"><span>Tag</span><select id="i-tag"><option value="">${inherit}</option>${S.tags.map(t=>`<option value="${t.id}"${t.id===curTag?' selected':''}>${esc(t.name)}</option>`).join('')}</select></label>
    <label for="i-rot"><span>Rotation °</span><input id="i-rot" type="number" step="1"${it&&!locked?'':' disabled'}></label></div>`;
  const roSize=!(it&&(it.kind==='b'||resizable(it)));
  h+='<div class="ig">'+['x','y','z','w','d','h'].map(k=>`<label for="i-${k}"><span>${k}</span><input id="i-${k}" type="number" step="0.01" data-k="${k}"${locked||(roSize&&'wdh'.includes(k))?' readonly':''}></label>`).join('')+'</div>';
  const lockedNow=it?(it.kind==='b'?it.o.locked:it.g.locked):sel.every(k=>{const id=k.slice(2);return k[0]==='b'?byId(id)?.locked:grpById(id)?.locked;});
  h+=`<label class="inl"><input id="i-lock" type="checkbox"${lockedNow?' checked':''}> Locked (can't be moved, resized, rotated or deleted)</label>`;
  if(it){const own=list,ex=new Set(own.concat(descendants(own)).map(o=>o.id)),cur=own.length&&own.every(o=>o.parent===own[0].parent)?own[0].parent||'':'',nk=childCount(own);
    const opts=S.objects.filter(o=>!ex.has(o.id)&&!(it.kind==='g'&&o.g===it.g.id)).map(o=>{const g=o.g&&grpById(o.g);return[o.id,g?`${g.n} › ${o.n}`:o.n];}).sort((a,b)=>a[1].localeCompare(b[1]));
    h+=`<div class="ig params"><label class="wide" for="i-parent"><span>Attached to</span><select id="i-parent"${locked?' disabled':''}><option value="">Nothing (free)</option>${opts.map(([id,n])=>`<option value="${id}"${id===cur?' selected':''}>${esc(n)}</option>`).join('')}</select></label>
      <label for="i-detach"><span>&nbsp;</span><button id="i-detach" type="button"${cur?'':' disabled'}>Detach</button></label></div>
      <p class="note">${nk?`Carries ${nk} attached item${nk>1?'s':''}. `:''}Attached items move and turn with what they're attached to. Hold <kbd>Shift</kbd> while dragging to drop onto the box underneath and attach.</p>`;
    const clr=it.kind==='b'?it.o.clr:it.g.clr,cl=it.kind==='b'?it.o.clrLabel:it.g.clrLabel;
    h+=`<div class="ig"><label for="i-clr"><span>Clearance (m)</span><input id="i-clr" type="number" step="0.05" min="0" value="${fmtIn(clr||0)}"></label>
      <label class="wide" for="i-clrl"><span>Clearance name</span><input id="i-clrl" class="tx" value="${esc(cl||'')}" placeholder="e.g. chair recline"></label></div>
      <div class="chips"><button type="button" data-clrp="0.45|chair recline">Chair recline</button><button type="button" data-clrp="0.6|walkway">Walkway</button><button type="button" data-clrp="0|">None</button></div>`;}
  if(it&&it.kind==='g'&&it.g.preset&&PRESETS[it.g.preset.type]){const P=PRESETS[it.g.preset.type];
    h+='<div class="ig params">'+P.fields.map(([k,l,u,opts])=>u==='opt'?`<label for="p-${k}"><span>${l}</span><select id="p-${k}" data-p="${k}" data-opt="1"${locked?' disabled':''}>${opts.map(([v,t])=>`<option value="${v}"${v===it.g.preset.p[k]?' selected':''}>${esc(t)}</option>`).join('')}</select></label>`:
      `<label for="p-${k}"><span>${l}${u==='m'?' (m)':''}</span><input id="p-${k}" type="number" step="${u==='#'?1:0.005}" min="0" data-p="${k}" value="${fmtIn(it.g.preset.p[k])}"${locked?' readonly':''}></label>`).join('')+'</div>';}
  if(it&&it.kind==='b'){const sh=shapeOf(it.o);
    h+=`<div class="ig"><label class="wide" for="i-shape"><span>Footprint (extruded)</span><select id="i-shape"${locked?' disabled':''}>${Object.entries(SHAPES).map(([k,s])=>`<option value="${k}"${k===sh?' selected':''}>${esc(s.label)}</option>`).join('')}${sh==='custom'?'<option value="custom" selected>Custom</option>':''}</select></label></div>`;}
  if(S.walls.length)h+=`<div class="chips"><button type="button" id="i-align"${locked?' disabled':''} title="Turn so the front faces into the room from the nearest wall, then push flush">Align to nearest wall</button></div>`;
  if(it){const notes=it.kind==='b'?it.o.notes:it.g.notes;h+=`<label class="fl" for="i-notes">Notes</label><textarea id="i-notes" class="tx" rows="3" placeholder="Material, where to buy, how it's mounted…">${esc(notes||'')}</textarea>`;}
  el.innerHTML=h;
  const n=$('i-n');if(n){n.addEventListener('input',()=>{const t=single();if(!t)return;if(t.kind==='b')t.o.n=n.value;else t.g.n=n.value;drawAll();});
    n.addEventListener('change',()=>{commit();renderList();});n.addEventListener('keydown',e=>{if(e.key==='Enter')n.blur();});}
  $('i-tag').addEventListener('change',e=>{for(const k of sel){const id=k.slice(2);if(k[0]==='b'){const o=byId(id);if(o)o.tag=e.target.value;}else{const g=grpById(id);if(g)g.tag=e.target.value;}}
    commit();renderList();renderLegend();drawAll();});
  const r=$('i-rot');r.addEventListener('change',()=>{const t=single(),v=parseFloat(r.value);if(!t||!isFinite(v)||selLocked())return;
    const cur=t.kind==='b'?t.o.rot:t.g.rot;const d=v-(cur||0);if(Math.abs(d)<1e-9)return;rotateItems(selBoxes(),d,false);addGroupRot(sel,d);commit();updateInspector();drawAll();});
  el.querySelectorAll('[data-k]').forEach(inp=>{
    inp.addEventListener('input',()=>{if(inp.readOnly)return;const v=parseFloat(inp.value);if(!isFinite(v))return;applyInsp(inp.dataset.k,v);drawAll();});
    inp.addEventListener('change',()=>{if(inp.readOnly)return;commit();updateInspector();});});
  $('i-lock').addEventListener('change',e=>{for(const k of sel){const id=k.slice(2);if(k[0]==='b'){const o=byId(id);if(o)o.locked=e.target.checked;}else{const g=grpById(id);if(g)g.locked=e.target.checked;}}
    commit();renderSel();});
  el.querySelectorAll('[data-p]').forEach(inp=>inp.addEventListener('change',()=>{const t=single();if(!t||t.kind!=='g'||!t.g.preset||inp.readOnly||inp.disabled)return;
    let v=inp.value;if(!inp.dataset.opt){v=parseFloat(v);if(!isFinite(v))return;}
    t.g.preset.p[inp.dataset.p]=v;regen(t.g);commit();renderInspector();renderList();drawAll();}));
  const ish=$('i-shape');if(ish)ish.addEventListener('change',()=>{const t=single();if(!t||t.kind!=='b'||ish.value==='custom')return;t.o.poly=SHAPES[ish.value].pts();commit();renderInspector();drawAll();});
  const ial=$('i-align');if(ial)ial.addEventListener('click',alignToWall);
  const nt=$('i-notes');if(nt)nt.addEventListener('change',()=>{const t=single();if(!t)return;if(t.kind==='b')t.o.notes=nt.value;else t.g.notes=nt.value;commit();});
  const ip=$('i-parent');if(ip)ip.addEventListener('change',()=>{const ls=selBoxes();if(ip.value){if(attachTo(ls,ip.value))flash(`Attached to ${parentName(ls[0])}.`);}else{detach(ls);flash('Detached.');}commit();renderInspector();renderList();drawAll();});
  const idt=$('i-detach');if(idt)idt.addEventListener('click',()=>{detach(selBoxes());commit();renderInspector();renderList();flash('Detached.');});
  const setClr=(v,l)=>{const t=single();if(!t)return;const o=t.kind==='b'?t.o:t.g;if(v!==null)o.clr=Math.max(0,v);if(l!==null)o.clrLabel=l;commit();renderInspector();drawAll();};
  const ic=$('i-clr');if(ic)ic.addEventListener('change',()=>{const v=parseFloat(ic.value);setClr(isFinite(v)?v:0,null);if(!S.showClr&&v>0)setToggle('showClr',true);});
  const icl=$('i-clrl');if(icl)icl.addEventListener('change',()=>setClr(null,icl.value));
  el.querySelectorAll('[data-clrp]').forEach(b=>b.addEventListener('click',()=>{const[v,l]=b.dataset.clrp.split('|');setClr(+v,l);if(+v>0&&!S.showClr)setToggle('showClr',true);}));
  updateInspector();}
function applyInsp(k,v){const it=single(),list=selBoxes();if(!list.length)return;const b=bbox(list);
  if('xyz'.includes(k)){moveSel(k,v-b[k+'0']);return;}
  const axis={w:'x',d:'z',h:'y'}[k];
  if(it&&it.kind==='b'){const o=it.o;v=Math.max(0,v);if(o.rot&&k!=='h'){const dv=v-o[k];if(k==='w')o.x-=dv/2;else o.z-=dv/2;}o[k]=v;}
  else if(resizable(it))setExtent(it,axis,b[axis+'0'],v);}
function updateInspector(){const list=selBoxes();if(!list.length)return;const b=bbox(list),it=single();
  const vals={x:b.x0,y:b.y0,z:b.z0,w:b.x1-b.x0,d:b.z1-b.z0,h:b.y1-b.y0};
  if(it&&it.kind==='b'){vals.w=it.o.w;vals.d=it.o.d;vals.h=it.o.h;}
  for(const k in vals){const el=$('i-'+k);if(el&&el!==document.activeElement)el.value=fmtIn(vals[k]);}
  const r=$('i-rot');if(r&&r!==document.activeElement)r.value=it?fmtIn(it.kind==='b'?it.o.rot:it.g.rot):'';}
function startRename(){if(!single())return;if(!PANELS[S.view].some(p=>p[0]==='objects'))return;if(settingsOpen||S.panels[S.view]!=='objects')setPanel('objects');
  const n=$('i-n');if(n){n.focus();n.select();n.scrollIntoView({block:'nearest'});}}

/* ---------- object list ---------- */
function row(key,name,vis,on,sub,pre,meta,tag){const col=S.colorTags&&tagColor(tag);
  return`<div class="orow${on?' on':''}${sub?' sub':''}${vis?'':' off'}">${pre}<button type="button" class="ib" data-eye="${key}" aria-label="${vis?'Hide':'Show'} ${esc(name)}">${vis?EYE:EYEOFF}</button><button type="button" class="nm" data-pick="${key}" title="Double-click to rename">${col?`<i class="sw" style="background:${col}"></i>`:''}${esc(name)}${meta?`<small>${meta}</small>`:''}</button></div>`;}
function renderList(){const el=$('olist');
  if(!S.objects.length){el.innerHTML='<p class="note">No objects yet. Add a box, a preset, or our plan.</p>';return;}
  const on=new Set(sel),seen=new Set();let h='';
  for(const o of S.objects){
    if(o.g){if(seen.has(o.g))continue;seen.add(o.g);const g=grpById(o.g);if(!g)continue;const ms=members(g.id),open=openGroups.has(g.id);
      const meta=(g.preset?(PRESETS[g.preset.type]?.label||'preset').toLowerCase():'group')+' · '+ms.length+(g.locked?' · locked':'');
      h+=row('g:'+g.id,g.n,g.vis,on.has('g:'+g.id),false,`<button type="button" class="ib tw" data-tw="${g.id}" aria-expanded="${open}" aria-label="${open?'Hide':'Show'} parts of ${esc(g.n)}">${open?'▾':'▸'}</button>`,meta,g.tag);
      if(open)for(const m of ms)h+=row('m:'+m.id,m.n,m.vis,false,true,'','',effTag(m));}
    else h+=row('b:'+o.id,o.n,o.vis,on.has('b:'+o.id),false,'<span class="tw" style="display:inline-block"></span>',[o.parent?'on '+esc(parentName(o)):'',o.locked?'locked':''].filter(Boolean).join(' · '),o.tag);}
  el.innerHTML=h;renderCuts();renderTraceHL();
  el.querySelectorAll('[data-tw]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.tw;openGroups.has(id)?openGroups.delete(id):openGroups.add(id);renderList();}));
  el.querySelectorAll('[data-eye]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.eye,id=k.slice(2);
    if(k[0]==='g'){const g=grpById(id);if(g)g.vis=!g.vis;}else{const o=byId(id);if(o)o.vis=!o.vis;}commit();renderList();drawAll();}));
  el.querySelectorAll('[data-pick]').forEach(b=>{
    b.addEventListener('click',e=>{let k=b.dataset.pick;if(k[0]==='m'){const o=byId(k.slice(2));if(!o)return;k=keyOf(o);}
      if(e.shiftKey){const i=sel.indexOf(k);if(i>=0)sel.splice(i,1);else sel.push(k);}else sel=[k];renderSel();});
    b.addEventListener('dblclick',()=>inlineRename(b));});}
function inlineRename(btn){const k=btn.dataset.pick,id=k.slice(2),obj=k[0]==='g'?grpById(id):byId(id);if(!obj)return;
  const inp=document.createElement('input');inp.className='tx ren';inp.value=obj.n;inp.setAttribute('aria-label','New name');btn.replaceWith(inp);inp.focus();inp.select();
  let done=false;const finish=ok=>{if(done)return;done=true;if(ok&&inp.value.trim()&&inp.value!==obj.n){obj.n=inp.value.trim();commit();}renderList();renderInspector();drawAll();};
  inp.addEventListener('keydown',e=>{if(e.key==='Enter')finish(true);else if(e.key==='Escape'){e.stopPropagation();finish(false);}});
  inp.addEventListener('blur',()=>finish(true));}

/* ---------- add ---------- */
function renderAddButtons(){const cats={};for(const k in PRESETS){const c=PRESETS[k].category||'Other';(cats[c]=cats[c]||[]).push(k);}
  let h='<div class="addcat"><span class="fl">Basic</span><div class="chips"><button type="button" data-add="box">Box</button><button type="button" data-add="shape">Shape (extruded)</button></div></div>';
  for(const c in cats)h+=`<div class="addcat"><span class="fl">${esc(c)}</span><div class="chips">${cats[c].map(k=>`<button type="button" data-add="${k}">${esc(PRESETS[k].label)}</button>`).join('')}</div></div>`;
  h+='<div class="chips"><button type="button" data-add="clear">Clear furniture</button></div>';
  const el=$('add-chips');el.innerHTML=h;
  el.querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>addItem(b.dataset.add)));}
function addItem(kind){const wb=worldBounds();
  if(kind==='box'||kind==='shape'){const sh=kind==='shape';const o=normObj({id:uid('b'),n:(sh?'Shape ':'Box ')+(S.objects.filter(x=>!x.g).length+1),x:wb.x0+1,y:0,z:wb.z0+1.5,w:0.5,d:0.5,h:sh?0.75:0.5,poly:sh?SHAPES.round.pts():null});S.objects.push(o);sel=['b:'+o.id];}
  else if(kind==='clear'){const n=S.objects.filter(o=>!isLocked(o)).length;if(!n){flash('Nothing to clear. Locked items stay.');return;}
    S.objects=S.objects.filter(isLocked);sel=[];cleanGroups();commit();renderSel();flash('Furniture cleared. Locked items stay. Undo brings everything back.');return;}
  else if(PRESETS[kind]){const P=PRESETS[kind],g={id:uid('g'),n:P.label,vis:true,preset:{type:kind,p:{...P.defaults},rot:0},tag:P.tag||'',notes:'',rot:0,locked:false};
    S.groups.push(g);P.fix(g.preset.p);regen(g,{x:wb.x0+0.4,y:P.y0?P.y0(g.preset.p):0,z:P.wall?wb.z0:wb.z0+1.6});sel=['g:'+g.id];}
  commit();if(S.panels[S.view]!=='objects')setPanel('objects');renderSel();}

/* ---------- tags + legend ---------- */
function renderTags(){const el=$('tags'),dk=isDark()?1:0;
  el.innerHTML=S.tags.map(t=>{const def=TAG_DEFAULTS.some(d=>d.id===t.id);return`<div class="trow"><input type="color" data-tc="${t.id}" value="${t.c[dk]}" aria-label="Colour for ${esc(t.name)}"><input class="tx" data-tn="${t.id}" value="${esc(t.name)}" aria-label="Tag name"><button type="button" data-tdel="${t.id}"${def?' disabled title="Built-in tags can be renamed but not removed"':''}>Remove</button></div>`;}).join('');
  el.querySelectorAll('[data-tc]').forEach(i=>i.addEventListener('change',()=>{const t=tagById(i.dataset.tc);if(!t)return;t.c=[i.value,i.value];commit();renderLegend();renderList();drawAll();}));
  el.querySelectorAll('[data-tn]').forEach(i=>i.addEventListener('change',()=>{const t=tagById(i.dataset.tn);if(!t||!i.value.trim())return;t.name=i.value.trim();commit();renderLegend();renderInspector();}));
  el.querySelectorAll('[data-tdel]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.tdel;S.tags=S.tags.filter(t=>t.id!==id);
    for(const o of S.objects)if(o.tag===id)o.tag='';for(const g of S.groups)if(g.tag===id)g.tag='';S.hiddenTags=S.hiddenTags.filter(x=>x!==id);commit();renderTags();renderLegend();renderInspector();drawAll();}));}
$('tag-add').addEventListener('click',()=>{const n=$('tag-new').value.trim();if(!n){$('tag-new').focus();return;}const c=$('tag-col').value;
  S.tags.push({id:uid('t'),name:n,c:[c,c]});$('tag-new').value='';commit();renderTags();renderInspector();flash(`Tag "${n}" added.`);});
function renderLegend(){const el=$('legend');el.hidden=!S.colorTags;if(!S.colorTags){el.innerHTML='';return;}
  const used=new Set(S.objects.map(o=>effTag(o)||'_none'));
  const items=S.tags.filter(t=>used.has(t.id)).map(t=>[t.id,t.name,tagColor(t.id)]);if(used.has('_none'))items.push(['_none','Untagged',C.accent]);
  if(!items.length){el.innerHTML='<span class="note">No tagged objects yet. Pick a tag in the Objects panel.</span>';return;}
  el.innerHTML=items.map(([id,n,c])=>{const off=S.hiddenTags.includes(id);return`<button type="button" data-lg="${id}" class="lg${off?' off':''}" aria-pressed="${!off}" title="${off?'Show':'Hide'} ${esc(n)}"><i style="background:${c};border-color:${c}"></i>${esc(n)}</button>`;}).join('');
  el.querySelectorAll('[data-lg]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.lg,i=S.hiddenTags.indexOf(id);if(i>=0)S.hiddenTags.splice(i,1);else S.hiddenTags.push(id);save();renderLegend();drawAll();}));}

/* ---------- shortcuts settings ---------- */
function renderKeys(){let h='',grp='';
  for(const[a,l,,g]of ACTIONS){if(g!==grp){grp=g;h+=`<div class="khead">${g}</div>`;}
    h+=`<div class="krow"><span>${l}</span><button type="button" class="kb${capture===a?' cap':''}" data-bind="${a}" aria-label="Shortcut for ${l}: ${capture===a?'waiting for key':keyLabel(KM[a])}">${capture===a?'Press a key…':keyLabel(KM[a])}</button></div>`;}
  $('keys').innerHTML=h;
  $('keys').querySelectorAll('[data-bind]').forEach(b=>b.addEventListener('click',()=>{capture=capture===b.dataset.bind?null:b.dataset.bind;renderKeys();const nb=$('keys').querySelector(`[data-bind="${b.dataset.bind}"]`);nb&&nb.focus();}));}
$('keys-reset').addEventListener('click',()=>{KM=defaultKeys();capture=null;saveKeys();renderKeys();flash('Shortcuts reset to defaults.');});

/* ---------- import / export ---------- */
function doExport(after){const txt=exportScene(),name=`linewright-${new Date().toISOString().slice(0,10)}.json`;
  try{const url=URL.createObjectURL(new Blob([txt],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);}catch(e){}
  const done=c=>flash(`Exported ${name}${c?' and copied the JSON to the clipboard':''}. Images are not included.${after||''}`);
  try{navigator.clipboard.writeText(txt).then(()=>done(true),()=>done(false));}catch(e){done(false);}}
function importText(t){try{importScene(t);clampCam();commit();renderAll();size();flash('Imported. Undo brings back the previous project.');}catch(e){flash(e.message);}}
function readJsonFile(f){const r=new FileReader();r.onload=()=>importText(String(r.result||''));r.onerror=()=>flash(`Couldn't read ${f.name}.`);r.readAsText(f);}
$('b-export').addEventListener('click',doExport);
$('b-import').addEventListener('click',()=>$('f-import').click());
$('f-import').addEventListener('change',e=>{const f=e.target.files[0];if(f)readJsonFile(f);e.target.value='';});
$('imp-go').addEventListener('click',()=>{const t=$('imp-text').value.trim();if(!t){flash('Paste exported JSON into the box first.');return;}importText(t);});
$('file').addEventListener('change',e=>{addFiles(e.target.files);e.target.value='';});
const stage=$('stage');let dragDepth=0;
const hasFiles=e=>[...(e.dataTransfer?.types||[])].includes('Files');
stage.addEventListener('dragenter',e=>{if(hasFiles(e)){e.preventDefault();dragDepth++;stage.classList.add('drop');}});
stage.addEventListener('dragover',e=>{if(hasFiles(e))e.preventDefault();});
stage.addEventListener('dragleave',()=>{dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)stage.classList.remove('drop');});
stage.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;stage.classList.remove('drop');const fs=[...(e.dataTransfer?.files||[])];if(!fs.length)return;
  const json=fs.find(f=>/\.json$/i.test(f.name)||f.type==='application/json');if(json)readJsonFile(json);
  const im=fs.filter(f=>f.type&&f.type.startsWith('image/'));if(im.length)addFiles(im);
  if(!json&&!im.length)flash('Drop images or an exported .json file.');});

/* ---------- status ---------- */
let flashMsg='',flashT=null;
function flash(m){flashMsg=m;clearTimeout(flashT);flashT=setTimeout(()=>{flashMsg='';status();},2600);status();}
function status(){const el=$('status');if(flashMsg){el.textContent=flashMsg;return;}
  if(S.view==='sheet'){el.textContent='Sheet: drawings at 1:'+S.paper.scale+' on '+S.paper.size+' '+S.paper.orient+'. Click note text to edit it. Choose elevations and paper in the Sheet panel.';return;}
  if(tool==='measure'){el.textContent=measureText()||TOOL_HINT.measure;return;}
  if(tool!=='select'){el.textContent=TOOL_HINT[tool]+(tool==='fixture'?` (${FX[$('fx-type').value]?.label||''})`:'');return;}
  if(psel&&!sel.length){const o=pselObj();if(o){const k=psel.k;el.textContent=k==='wall'?`Wall ${S.walls.indexOf(o)+1} · ${fmt(wallLen(o))} m · drag to move, drag a square end to change its length · Delete removes it`:
    k==='op'?`${o.type==='door'?'Door':'Window'} · ${fmt(o.w)} m wide · ${fmt(o.off)} m from the wall start · drag along the wall, ends resize · Alt for free`:
    k==='fx'?`${o.n} · ${fxWhere(o)} · drag to slide it`:k==='mark'?`${o.label||'Reference line'} · ${fmt(dist(o.a,o.b))} m · drag to move, ends resize`:`${o.name} · ${fmt(Math.abs(polyArea(o.pts)))} m²`;return;}}
  if(layerMode()){const L=S.layers.find(l=>l.id===activeLayer);el.textContent=L?`Image: ${L.name} · ${Math.round(L.op*100)}% · ${L.rot.toFixed(1)}°`+(L.fx?' · mirrored':'')+(L.fy?' · flipped':'')+(S.lockCam?' · camera locked':''):'Layers: click an image on the drawing to select it, or add images.';return;}
  const list=selBoxes();
  if(S.view==='persp'&&S.trace&&glowSet().length&&!list.length){el.textContent=`Trace: ${glowSet().map(hlLabel).join(', ')} glow in their tag colours; everything else is faint. Clear the Glow list to trace everything.`;return;}
  if(!list.length){el.textContent=S.view==='plan'?'Click a shape, wall, door or fixture to select it and drag to move. The round handle rotates in 15° steps, Alt for any angle. Drag the orange dot to move the camera. Draw with the tools above.':'Click a box edge to select it. Shift-click adds more. Arrows move along an axis, square tips resize. Alt turns snapping off.';return;}
  const b=bbox(list),it=single(),nm=it?(it.kind==='b'?it.o.n:it.g.n):`${sel.length} items`,tg=it?tagName(it.kind==='b'?effTag(it.o):it.g.tag):'',rot=it?(it.kind==='b'?it.o.rot:it.g.rot):0;
  el.textContent=`${nm}${tg?' · '+tg:''} · x ${fmt(b.x0)} y ${fmt(b.y0)} z ${fmt(b.z0)} · w ${fmt(b.x1-b.x0)} d ${fmt(b.z1-b.z0)} h ${fmt(b.y1-b.y0)} m${rot?` · ${fmtIn(rot)}°`:''}${selLocked()?' · locked':''}`;}

/* ---------- trace glow: any mix of tags, kinds and single items/groups glows in trace mode, each in its tag colour ---------- */
/* tokens in S.traceHL: 'tag:<id>' ('tag:_none' = untagged), 'kind:<k>' (see objKind; 'kind:fx' = fixtures), 'item:g:<group id>', 'item:b:<object id>' */
function objKind(o){if(o.g){const g=grpById(o.g);return g&&g.preset?'p:'+g.preset.type:'group';}return o.poly?'shape':'box';}
function kindLabel(k){if(k==='fx')return'Fixtures';if(k==='group')return'Groups';if(k==='box')return'Boxes';if(k==='shape')return'Shapes';return(PRESETS[k.slice(2)]?.label||'Preset')+'s';}
function glowSet(){return Array.isArray(S.traceHL)?S.traceHL:[];}
function hlMatch(o){const t=effTag(o)||'_none',k=objKind(o);
  return glowSet().some(v=>v==='tag:'+t||v==='kind:'+k||v==='item:b:'+o.id||(o.g&&v==='item:g:'+o.g));}
function fxGlows(f){const v=glowSet();return v.includes('kind:fx')||v.includes('tag:'+(f.tag||'_none'));}
/* glow colour: the item's tag colour, or the guide colour when it has none */
function glowCol(tag){return tagColor(tag)||C.guide;}
function hlLabel(v){if(v.startsWith('kind:'))return kindLabel(v.slice(5));if(v.startsWith('tag:')){const id=v.slice(4);return id==='_none'?'Untagged':tagName(id)||'Tag';}
  const id=v.slice(7);if(v.startsWith('item:g:'))return grpById(id)?.n||'Group';return byId(id)?.n||'Item';}
function glowValid(v){if(v.startsWith('item:g:'))return!!grpById(v.slice(7));if(v.startsWith('item:b:'))return!!byId(v.slice(7));if(v.startsWith('tag:'))return v==='tag:_none'||!!tagById(v.slice(4));return v.startsWith('kind:');}
function setGlow(list){S.traceHL=[...new Set(list)].filter(glowValid);save();if(S.traceHL.length&&!S.trace)setToggle('trace',true);else drawAll();renderTraceHL();}
function glowOpen(){return!$('glow-pop').hidden;}
function closeGlow(){$('glow-pop').hidden=true;$('glow-btn').setAttribute('aria-expanded','false');}
function renderTraceHL(){const btn=$('glow-btn'),pop=$('glow-pop');if(!btn)return;
  if(glowSet().some(v=>!glowValid(v)))S.traceHL=glowSet().filter(glowValid);
  const on=new Set(glowSet()),n=on.size;btn.textContent=n?`Glow · ${n}`:'Glow';btn.setAttribute('aria-pressed',n>0);
  if(pop.hidden)return;
  const vis=S.objects.filter(visible),tags=[...new Set(vis.map(o=>effTag(o)||'_none').concat(S.fixtures.filter(fxVisible).map(f=>f.tag||'_none')))];
  const kinds=[...new Set(vis.map(objKind))];if(S.fixtures.some(fxVisible))kinds.push('fx');
  const items=[],seen=new Set();for(const o of vis){if(o.g){if(seen.has(o.g))continue;seen.add(o.g);const g=grpById(o.g);if(g)items.push(['item:g:'+g.id,g.n,g.tag]);}else items.push(['item:b:'+o.id,o.n,o.tag]);}
  const box=(v,label,col)=>`<label class="inl"><input type="checkbox" data-glow="${esc(v)}"${on.has(v)?' checked':''}>${col?`<i class="gsw" style="background:${col}"></i>`:''}${esc(label)}</label>`;
  pop.innerHTML=`<div class="glowh"><span class="fl">In trace mode, ticked items glow in their tag colour; the rest turn faint.</span></div>
    <div class="glowcols"><div><span class="fl">Tags</span>${tags.map(t=>box('tag:'+t,t==='_none'?'Untagged':tagName(t)||t,t==='_none'?C.guide:glowCol(t))).join('')||'<p class="note">No items.</p>'}</div>
    <div><span class="fl">Kinds</span>${kinds.map(k=>box('kind:'+k,kindLabel(k))).join('')}</div>
    <div class="glowitems"><span class="fl">Items and groups</span>${items.map(([v,nm,t])=>box(v,nm,t?glowCol(t):'')).join('')}</div></div>
    <div class="chips"><button type="button" id="glow-sel"${sel.length?'':' disabled'}>Add selection</button><button type="button" id="glow-clear"${n?'':' disabled'}>Clear</button><button type="button" id="glow-done">Done</button></div>`;
  pop.querySelectorAll('[data-glow]').forEach(c=>c.addEventListener('change',()=>{const v=c.dataset.glow;setGlow(c.checked?glowSet().concat(v):glowSet().filter(x=>x!==v));}));
  $('glow-sel').addEventListener('click',()=>setGlow(glowSet().concat(sel.map(k=>'item:'+k))));
  $('glow-clear').addEventListener('click',()=>setGlow([]));$('glow-done').addEventListener('click',closeGlow);}
$('glow-btn').addEventListener('click',()=>{const p=$('glow-pop');p.hidden=!p.hidden;$('glow-btn').setAttribute('aria-expanded',String(!p.hidden));renderTraceHL();
  /* keep the list on screen when the button sits near the right edge */
  if(!p.hidden){p.style.left='0';const r=p.getBoundingClientRect();if(r.right>innerWidth-8)p.style.left=Math.round(innerWidth-8-r.right)+'px';}});
document.addEventListener('pointerdown',e=>{if(glowOpen()&&!e.target.closest('.glowpick'))closeGlow();});

/* ---------- new project ---------- */
function newDlgOpen(){return!$('new-dlg').hidden;}
function openNewDlg(){$('new-dlg').hidden=false;setTimeout(()=>$('new-export').focus(),0);}
function closeNewDlg(){$('new-dlg').hidden=true;$('b-new').focus();}
/* clears the model; tags, shortcuts and view settings stay. Image pixels stay in the browser until the next reload, so Undo can bring the old project back. */
function newProject(quiet){const room=$('new-room').checked,W=Math.max(1.2,parseFloat($('new-w').value)||4),D=Math.max(1.2,parseFloat($('new-d').value)||5);
  const keep={tags:S.tags,snap:S.snap,panels:S.panels,colorTags:S.colorTags,labels:S.labels,guides:S.guides,grid:S.grid,ceil:S.ceil,paper:S.paper,view:S.view==='sheet'?'plan':S.view};
  const m=migrate(null);for(const k of['walls','openings','rooms','marks','objects','groups','fixtures','notes','layers','scenarios'])m[k]=[];
  if(room){const P=[[0,0],[W,0],[W,D],[0,D]];m.walls=P.map((a,i)=>({id:uid('w'),a:[...a],b:[...P[(i+1)%4]],h:null}));m.rooms=[{id:uid('r'),name:'Room 1',pts:P.map(p=>[...p]),auto:true,drawn:false}];
    /* a window centred on the first wall, the entrance door near the start of the opposite wall */
    const ww=Math.min(1.4,W-0.4),dw=Math.min(0.85,W-0.3);
    m.openings=[normOpening({id:uid('op'),wall:m.walls[0].id,type:'window',off:+((W-ww)/2).toFixed(4),w:ww,h:1.2,sill:0.9}),
      normOpening({id:uid('op'),wall:m.walls[2].id,type:'door',off:Math.min(0.4,W-dw-0.05),w:dw,h:2.1,hinge:'a',side:1,angle:90,entrance:true})];}
  Object.assign(S,m,keep);S.scenario=null;S.ghost=null;S.traceHL=[];S.sheet={title:'',elev:[],depth:1.2};
  sel=[];psel=null;activeLayer=null;cmOn=null;MS.pts=[];CLIP=null;
  Object.assign(S,room?spawnView():{cx:1.3,cz:3,eye:1.6,yaw:0,fov:72});clampCam();
  $('new-dlg').hidden=true;commit();setView(S.view);renderAll();size();
  if(!quiet)flash(room?`New project: a ${fmt(W)} × ${fmt(D)} m room with a window and an entrance door. Undo brings the previous project back.`:'New project: empty. Draw walls with the Wall tool (W). Undo brings the previous project back.');}
$('b-new').addEventListener('click',openNewDlg);
$('new-cancel').addEventListener('click',closeNewDlg);
$('new-go').addEventListener('click',newProject);
$('new-export').addEventListener('click',()=>{doExport(' New project started; Undo brings the previous one back.');newProject(true);});
$('new-dlg').addEventListener('click',e=>{if(e.target===$('new-dlg'))closeNewDlg();});
['new-w','new-d'].forEach(id=>$(id).addEventListener('focus',()=>{$('new-room').checked=true;}));

/* ---------- sizing, render-all, boot ---------- */
function size(){const dpr=Math.min(window.devicePixelRatio||1,2);
  if(S.view==='sheet'){drawAll();return;}
  if(S.view==='persp'){const r=cv.getBoundingClientRect();if(r.width){cv.width=Math.round(r.width*dpr);cv.height=Math.round(r.width*0.75*dpr);K=cv.width/r.width;}}
  const pr=pv.getBoundingClientRect();if(!pr.width){drawAll();return;}
  let ph;if(S.view==='plan'){const b=worldBounds(),asp=(b.z1-b.z0+0.6)/(b.x1-b.x0+0.6);ph=clamp(pr.width*asp,300,Math.max(320,window.innerHeight*0.78));}
  else ph=mqPhone.matches?Math.min(pr.width*1.15,420):cv.getBoundingClientRect().width*0.75;
  pv.style.height=Math.round(ph)+'px';pv.width=Math.round(pr.width*dpr);pv.height=Math.round(ph*dpr);KP=pv.width/pr.width;
  drawAll();}
function drawAll(){tok();CLR=clrCheck();GHOST=ghostObjs();if(S.view==='sheet')renderSheet();else{draw();drawPlan();}status();renderWarn();}
function renderAll(){syncCamUI();syncToggles();renderPtabs();renderInspector();renderList();renderRooms();renderAddButtons();renderLayers();renderKeys();renderTags();renderLegend();
  renderTools();renderPaperCtls();renderSheetPanel();renderNotes();renderScenarios();renderTraceHL();updToolbar();drawAll();}

matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{renderTags();renderLegend();renderList();drawAll();});
new MutationObserver(()=>{renderTags();renderLegend();drawAll();}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
if(window.ResizeObserver)new ResizeObserver(()=>size()).observe(stage);else window.addEventListener('resize',size);
clampCam();commit();
setView(S.view);renderAll();size();
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(drawAll);
initStore();
