'use strict';
/* Linewright — scenarios: named sets of object positions ("Work mode", "Guest mode") over one shared model.
   A scenario stores, per group, its bounding-box min corner, rotation and visibility (so a preset can change size and still
   land in the right place) and, per ungrouped object, its centre, height, absolute yaw (rot + 90·q) and visibility.
   Saving a new scenario stores the live layout and leaves the others alone; after that the live layout belongs to the active
   scenario: switching first saves the live layout into it, then applies the other one.
   Objects a scenario doesn't know (added later) stay where they are. Another scenario can be shown as a dashed ghost in the
   plan, the perspective and on the sheet; only objects that sit elsewhere there are drawn. */

let GHOST=[];   // ghost objects for this frame (computed in drawAll)

function scCapture(){const pos={},grp={},done=new Set(),r4=v=>+(+v).toFixed(4);
  for(const o of S.objects){
    if(o.g){if(done.has(o.g))continue;done.add(o.g);const g=grpById(o.g),ms=members(o.g);if(!g||!ms.length)continue;const b=bbox(ms);
      grp[o.g]={x0:r4(b.x0),y0:r4(b.y0),z0:r4(b.z0),rot:r4(g.rot||0),vis:g.vis!==false};}
    else pos[o.id]={cx:r4(o.x+o.w/2),cz:r4(o.z+o.d/2),y:r4(o.y),a:r4(absYaw(o)),vis:o.vis!==false};}
  return{pos,grp};}
/* apply a scenario to the given object and group arrays (the live model, or copies for the ghost) */
function scApply(objs,groups,sc){
  for(const gid in sc.grp){const g=groups.find(x=>x.id===gid),ms=objs.filter(o=>o.g===gid);if(!g||!ms.length)continue;const t=sc.grp[gid],d=normDeg(t.rot-(g.rot||0));
    if(Math.abs(d)>1e-6){turnBlock(ms,d);g.rot=normDeg((g.rot||0)+d);if(g.preset)g.preset.rot=(((g.preset.rot||0)+d)%360+360)%360;}
    const b=bbox(ms);for(const o of ms){o.x+=t.x0-b.x0;o.y+=t.y0-b.y0;o.z+=t.z0-b.z0;}g.vis=t.vis;}
  for(const o of objs){if(o.g)continue;const t=sc.pos[o.id];if(!t)continue;
    const d=t.a-absYaw(o);if(Math.abs(d)>1e-6){o.rot=(o.rot||0)+d;normRot(o);}o.x=t.cx-o.w/2;o.z=t.cz-o.d/2;o.y=t.y;o.vis=t.vis;}}
const scById=id=>S.scenarios.find(x=>x.id===id);
function scSaveLive(){const cur=scById(S.scenario);if(cur)Object.assign(cur,scCapture());}
function switchScenario(id){if(id===S.scenario)return;const t=scById(id);if(!t)return;const prev=S.scenario;
  scSaveLive();scApply(S.objects,S.groups,t);S.scenario=id;if(S.ghost===id)S.ghost=prev&&scById(prev)?prev:null;
  sel=sel.filter(validKey);commit();renderScenarios();renderSel();renderRooms();flash(`Switched to “${t.name}”.${prev?'':' The unsaved layout was replaced; Undo brings it back.'}`);}
/* saving leaves the other scenarios as they were stored: the layout on screen becomes the new one (and the active one) */
function addScenario(name){const s={id:uid('s'),name:name||`Scenario ${S.scenarios.length+1}`,...scCapture()};S.scenarios.push(s);S.scenario=s.id;commit();renderScenarios();
  flash(S.scenarios.length===1?`Saved the current layout as “${s.name}”. Rearrange and save again for a variant.`:`Saved the layout on screen as “${s.name}”; the other scenarios are unchanged.`);}
function deleteScenario(id){const s=scById(id);if(!s)return;S.scenarios=S.scenarios.filter(x=>x!==s);if(S.ghost===id)S.ghost=null;
  if(S.scenario===id)S.scenario=null;commit();renderScenarios();drawAll();flash(`Scenario “${s.name}” deleted. The layout on screen stays${S.scenario?'':' (not saved as a scenario)'}. Undo brings it back.`);}
function setGhost(id){S.ghost=S.ghost===id||id===S.scenario?null:id;save();renderScenarios();drawAll();}

/* objects as they sit in the ghost scenario, only where that differs from the live layout */
function ghostObjs(){const sc=S.ghost&&S.ghost!==S.scenario&&scById(S.ghost);if(!sc)return[];
  const objs=S.objects.map(o=>({...o,poly:o.poly?o.poly.map(p=>p.slice()):null})),groups=S.groups.map(g=>({...g,preset:g.preset?{...g.preset}:null}));
  scApply(objs,groups,sc);const out=[],e=1e-4;
  for(let i=0;i<objs.length;i++){const a=S.objects[i],b=objs[i];if(!b.vis)continue;if(b.g){const g=groups.find(x=>x.id===b.g);if(g&&!g.vis)continue;}
    if(S.colorTags&&S.hiddenTags.length&&S.hiddenTags.includes(effTag(a)||'_none'))continue;
    const moved=visible(a)?['x','y','z','w','d','rot'].some(k=>Math.abs((a[k]||0)-(b[k]||0))>e)||(a.q||0)!==(b.q||0):true;if(moved)out.push(b);}
  return out;}
function drawGhostP(){if(S.trace)return;for(const o of GHOST)drawBox(o,[C.muted,1.2,[6,5],.8]);}
function drawGhostPlan(c,X,k){if(!GHOST.length)return;c.strokeStyle=C.muted;c.lineWidth=1*k;c.setLineDash([4*k,3*k]);
  for(const o of GHOST){c.beginPath();foot(o).forEach((q,i)=>{const p=X.to(q[0],q[1]);i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]);});c.closePath();c.stroke();}c.setLineDash([]);}

/* ---------- panel (Objects tab) ---------- */
const GHOSTICON='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 1.6"><rect x="2.5" y="3.5" width="11" height="9" rx="1"/></svg>';
function renderScenarios(){const el=$('scen-body');if(!el)return;let h='';
  if(S.scenarios.length){h+='<div class="list">';
    for(const s of S.scenarios){const on=s.id===S.scenario,gh=s.id===S.ghost;
      h+=`<div class="orow${on?' on':''}"><span class="tw" style="display:inline-block;text-align:center">${on?'●':''}</span><button type="button" class="nm" data-scsw="${s.id}" title="${on?'Active scenario':'Switch to this scenario'}">${esc(s.name)}${on?'<small>active</small>':''}${gh?'<small>ghost</small>':''}</button>
        <button type="button" class="ib" data-scgh="${s.id}" aria-pressed="${gh}" aria-label="Show ${esc(s.name)} as a dashed ghost"${on?' disabled':''} title="Ghost overlay"${gh?' style="color:var(--accent)"':''}>${GHOSTICON}</button>
        <button type="button" class="ib" data-scren="${s.id}" aria-label="Rename ${esc(s.name)}">✎</button><button type="button" class="ib" data-scdel="${s.id}" aria-label="Delete ${esc(s.name)}">×</button></div>`;}
    h+='</div>';if(!S.scenario)h+='<p class="note">The layout on screen isn\'t saved as a scenario. Save it, or switch to one (Undo brings this layout back).</p>';}
  h+=`<div class="tagadd" style="grid-template-columns:minmax(0,1fr) auto"><input id="sc-new" class="tx" placeholder="${S.scenarios.length?'e.g. Guest mode':'e.g. Work mode'}" aria-label="Scenario name"><button id="sc-add" type="button">${S.scenarios.length?'Save as new':'Save layout as'}</button></div>
    <p class="note">${S.scenarios.length?'Saving stores the layout on screen under a new name and leaves the others alone. Moves, turns and hiding you make afterwards belong to the active scenario and are kept when you switch. Sizes, names and the room are shared. The dashed-box button shows another scenario as a ghost.':'Named variants of where things stand, e.g. Work mode and Guest mode. Name the current layout, rearrange, then save again.'}</p>`;
  el.innerHTML=h;
  el.querySelectorAll('[data-scsw]').forEach(b=>b.addEventListener('click',()=>switchScenario(b.dataset.scsw)));
  el.querySelectorAll('[data-scgh]').forEach(b=>b.addEventListener('click',()=>setGhost(b.dataset.scgh)));
  el.querySelectorAll('[data-scdel]').forEach(b=>b.addEventListener('click',()=>deleteScenario(b.dataset.scdel)));
  el.querySelectorAll('[data-scren]').forEach(b=>b.addEventListener('click',()=>{const s=scById(b.dataset.scren),nm=el.querySelector(`[data-scsw="${s.id}"]`);if(!s||!nm)return;
    const inp=document.createElement('input');inp.className='tx ren';inp.value=s.name;inp.setAttribute('aria-label','Scenario name');nm.replaceWith(inp);inp.focus();inp.select();let done=false;
    const fin=ok=>{if(done)return;done=true;if(ok&&inp.value.trim()&&inp.value.trim()!==s.name){s.name=inp.value.trim();commit();}renderScenarios();if(S.view==='sheet')renderSheet();};
    inp.addEventListener('keydown',e=>{if(e.key==='Enter')fin(true);else if(e.key==='Escape'){e.stopPropagation();fin(false);}});inp.addEventListener('blur',()=>fin(true));}));
  const add=()=>{const v=$('sc-new').value.trim();addScenario(v);};
  $('sc-add').addEventListener('click',add);$('sc-new').addEventListener('keydown',e=>{if(e.key==='Enter')add();});}
