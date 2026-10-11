'use strict';
/* Linewright — Sheet view: a drawing set built from the model. Page 1 is an SVG at true scale on the chosen paper
   (plan + one orthographic elevation per chosen wall + title block); below it the spec table, cut list, project notes
   (titled sections edited inline, items can carry a "verify" mark) and the tag legend. Only stored dimensions are shown. */

const SH_INK='var(--ink)',SH_MUTED='var(--muted)',SH_LINE='var(--line)';
const r2=v=>Math.round(v*100)/100;
function shTagCol(id){return tagColor(id)||C.accent;}
function shText(x,y,t,o){o=o||{};return`<text x="${r2(x)}" y="${r2(y)}" font-size="${o.fs||2.4}"${o.fill?` fill="${o.fill}"`:''}${o.anchor?` text-anchor="${o.anchor}"`:''}${o.rot?` transform="rotate(${o.rot} ${r2(x)} ${r2(y)})"`:''}${o.w?` font-weight="${o.w}"`:''}>${esc(t)}</text>`;}
function fitsText(t,w,fs){return t.length*fs*0.6<w;}
function sheetTitle(){return S.sheet.title||S.rooms.map(r=>r.name).filter(Boolean).join(' + ')||'Room sketch';}
/* walls that get an elevation: the user's choice, or on first open the walls with a window or fixture (at most two) */
function sheetElevs(){if(!S.sheet.init){S.sheet.init=true;S.sheet.elev=S.walls.filter(w=>S.openings.some(o=>o.wall===w.id&&o.type==='window')||S.fixtures.some(f=>f.wall===w.id)).slice(0,2).map(w=>({wall:w.id,flip:false}));save();}
  return S.sheet.elev.filter(e=>wallById(e.wall));}

function sheetLayout(){const[pw,ph]=paperDims(),k=1000/S.paper.scale,m=10,tb=16,pad=5,gap=9,lab=6,pm=7;
  const area={x:m+pad,y:m+pad,w:pw-2*(m+pad),h:ph-2*m-tb-2*pad},b=worldBounds(),items=[];
  items.push({kind:'plan',b,w:(b.x1-b.x0)*k+2*pm,h:(b.z1-b.z0)*k+2*pm,pm});
  for(const e of sheetElevs()){const w=wallById(e.wall);items.push({kind:'elev',e,wall:w,w:wallLen(w)*k+2*pm,h:wallH(w)*k+pm*1.4,pm});}
  let x=area.x,y=area.y,rowH=0;const over=[];
  for(const it of items){if(x+it.w>area.x+area.w&&x>area.x){x=area.x;y+=rowH+gap;rowH=0;}it.x=x;it.y=y+lab;x+=it.w+gap;rowH=Math.max(rowH,it.h+lab);
    if(it.x+it.w>area.x+area.w+0.5||it.y+it.h>area.y+area.h+0.5)over.push(it);}
  return{pw,ph,k,m,tb,area,items,over};}

function planSVG(it,k){const b=it.b,M=(x,z)=>[it.x+it.pm+(x-b.x0)*k,it.y+it.pm+(z-b.z0)*k];let s='';
  const P=pts=>pts.map(q=>M(q[0],q[1]).map(r2).join(',')).join(' ');
  for(const r of S.rooms){if(!r.pts||r.pts.length<3)continue;s+=`<polygon points="${P(r.pts)}" fill="${SH_LINE}" fill-opacity=".12" stroke="none"/>`;}
  for(const m of S.marks){const A=M(m.a[0],m.a[1]),B=M(m.b[0],m.b[1]);s+=`<line x1="${r2(A[0])}" y1="${r2(A[1])}" x2="${r2(B[0])}" y2="${r2(B[1])}" stroke="${SH_MUTED}" stroke-width="0.25" stroke-dasharray="2 1.4"/>`+shText(A[0]+1,A[1]-1,m.label||'',{fill:SH_MUTED,fs:2.2});}
  const done=new Set();
  /* ghost of another scenario: dashed outlines of the objects that sit elsewhere there */
  for(const o of ghostObjs())s+=`<polygon points="${P(foot(o))}" fill="none" stroke="${SH_MUTED}" stroke-width="0.22" stroke-dasharray="1.2 0.9"/>`;
  for(const o of S.objects){if(!visible(o))continue;const col=shTagCol(effTag(o));
    s+=`<polygon points="${P(foot(o))}" fill="${col}" fill-opacity=".07" stroke="${col}" stroke-width="${isLocked(o)?0.18:0.3}"${isLocked(o)?' stroke-dasharray="1 0.8"':''}/>`;}
  for(const o of S.objects){if(!visible(o))continue;let nm=o.n,bb=aabb(o);
    if(o.g){if(done.has(o.g))continue;done.add(o.g);const g=grpById(o.g);nm=g?g.n:'Group';bb=bbox(members(o.g).filter(visible));}
    const A=M(bb.x0,bb.z0),w=(bb.x1-bb.x0)*k,h=(bb.z1-bb.z0)*k;if(fitsText(nm,w-1,2.1)&&h>3.2)s+=shText(A[0]+0.8,A[1]+2.8,nm,{fs:2.1,fill:shTagCol(effTag(o))});}
  for(const r of S.rooms){if(!r.pts||r.pts.length<3)continue;const c=polyInner(r.pts),p=M(c[0],c[1]);s+=shText(p[0],p[1],r.name||'Room',{fs:3,anchor:'middle',fill:SH_MUTED,w:500});}
  for(const w of S.walls){const L=wallLen(w),u=wallU(w),Q=t=>M(w.a[0]+u[0]*t,w.a[1]+u[1]*t),seg=(t0,t1,sw,col)=>{const A=Q(t0),B=Q(t1);return`<line x1="${r2(A[0])}" y1="${r2(A[1])}" x2="${r2(B[0])}" y2="${r2(B[1])}" stroke="${col||SH_INK}" stroke-width="${sw}" stroke-linecap="square"/>`;};
    const ops=S.openings.filter(o=>o.wall===w.id).sort((a,c)=>a.off-c.off);let t=0;
    for(const o of ops){const t0=clamp(o.off,0,L),t1=clamp(o.off+o.w,0,L);if(t0>t)s+=seg(t,t0,0.7);t=Math.max(t,t1);
      if(o.type==='window'){const n=wallN(w),A=Q(t0),B=Q(t1),e=0.9;s+=`<polygon points="${r2(A[0]-n[0]*e)},${r2(A[1]-n[1]*e)} ${r2(B[0]-n[0]*e)},${r2(B[1]-n[1]*e)} ${r2(B[0]+n[0]*e)},${r2(B[1]+n[1]*e)} ${r2(A[0]+n[0]*e)},${r2(A[1]+n[1]*e)}" fill="rgba(80,150,210,.18)" stroke="${SH_INK}" stroke-width="0.2"/>`;}
      else{const g=doorGeom(o,w),H=M(g.H[0],g.H[1]),T=M(g.H[0]+g.d1[0]*g.r,g.H[1]+g.d1[1]*g.r),C0=M(g.H[0]+g.d0[0]*g.r,g.H[1]+g.d0[1]*g.r),cr=g.d0[0]*g.d1[1]-g.d0[1]*g.d1[0];
        s+=`<line x1="${r2(H[0])}" y1="${r2(H[1])}" x2="${r2(T[0])}" y2="${r2(T[1])}" stroke="${SH_INK}" stroke-width="0.3"/><path d="M${r2(T[0])} ${r2(T[1])} A${r2(g.r*k)} ${r2(g.r*k)} 0 0 ${cr>0?0:1} ${r2(C0[0])} ${r2(C0[1])}" fill="none" stroke="${SH_MUTED}" stroke-width="0.2" stroke-dasharray="1 1"/>`;
        if(o.entrance){const c=Q((t0+t1)/2),n=wallN(w),si=wallIn(w);s+=shText(c[0]-n[0]*si*3,c[1]-n[1]*si*3+0.8,'entrance',{fs:2,anchor:'middle',fill:'var(--guide)'});}}}
    if(t<L)s+=seg(t,L,0.7);
    /* stored wall length, written outside the room */
    const si=wallIn(w),n=wallN(w),c=Q(L/2),o2=[c[0]-n[0]*si*3.2,c[1]-n[1]*si*3.2],ang=Math.atan2(u[1],u[0])*180/Math.PI,rot=ang>90||ang<-90?ang+180:ang;
    s+=shText(o2[0],o2[1]+0.8,fmt(L),{fs:2.4,anchor:'middle',rot:Math.abs(rot)<0.01?0:rot});}
  for(const f of S.fixtures)if(fxVisible(f))s+=fxSvgPlan(f,M,shTagCol(f.tag));
  return s;}

function elevSVG(it,k){const w=it.wall,e=it.e,L=wallLen(w),H=wallH(w),u=wallU(w),n=wallN(w),sg=wallIn(w)*(e.flip?-1:1),dep=+S.sheet.depth||1.2;
  const X=t=>it.x+it.pm+(sg>0?t:L-t)*k,Y=y=>it.y+it.pm*0.4+(H-y)*k;let s='';
  const rect=(t0,t1,y0,y1,a)=>{const x0=Math.min(X(t0),X(t1)),x1=Math.max(X(t0),X(t1));return`<rect x="${r2(x0)}" y="${r2(Y(y1))}" width="${r2(x1-x0)}" height="${r2((y1-y0)*k)}" ${a}/>`;};
  s+=`<line x1="${r2(X(0))}" y1="${r2(Y(H))}" x2="${r2(X(L))}" y2="${r2(Y(H))}" stroke="${SH_LINE}" stroke-width="0.25" stroke-dasharray="2 1.4"/>`;
  s+=shText(Math.min(X(0),X(L))+1,Y(H)-1,`ceiling ${fmt(H)}`,{fs:2.1,fill:SH_MUTED});
  /* objects in front of the wall within the depth band, far ones first */
  const vis=[];
  for(const o of S.objects){if(!visible(o)||o.h<=0)continue;const cs=foot(o),ts=cs.map(c=>(c[0]-w.a[0])*u[0]+(c[1]-w.a[1])*u[1]),dn=cs.map(c=>((c[0]-w.a[0])*n[0]+(c[1]-w.a[1])*n[1])*sg);
    if(Math.max(...dn)<=1e-3||Math.min(...dn)>dep)continue;const t0=Math.max(0,Math.min(...ts)),t1=Math.min(L,Math.max(...ts));if(t1-t0<1e-3)continue;
    vis.push({o,t0,t1,dn:Math.min(...dn)});}
  vis.sort((a,b)=>b.dn-a.dn);
  for(const v of vis){const o=v.o,col=shTagCol(effTag(o)),y1=Math.min(H,o.y+o.h);if(y1<=o.y)continue;
    s+=rect(v.t0,v.t1,o.y,y1,`fill="var(--paper)" stroke="${col}" stroke-width="0.28"${isLocked(o)?' stroke-dasharray="1 0.8"':''}`);
    s+=rect(v.t0,v.t1,o.y,y1,`fill="${col}" fill-opacity=".07" stroke="none"`);}
  const named=new Set();
  for(const v of vis.slice().reverse()){const o=v.o,g=o.g&&grpById(o.g),key=g?g.id:o.id;if(named.has(key))continue;
    const list=g?vis.filter(x=>x.o.g===o.g):[v],t0=Math.min(...list.map(x=>x.t0)),t1=Math.max(...list.map(x=>x.t1)),top=Math.max(...list.map(x=>x.o.y+x.o.h)),nm=g?g.n:o.n;
    const wmm=(t1-t0)*k;if(fitsText(nm,wmm,2)){named.add(key);s+=shText(Math.min(X(t0),X(t1))+0.6,Y(Math.min(H,top))-0.8,nm,{fs:2,fill:shTagCol(effTag(o))});}}
  for(const o of S.openings){if(o.wall!==w.id)continue;const t0=o.off,t1=o.off+o.w;
    if(o.type==='window'){s+=rect(t0,t1,o.sill,o.sill+o.h,`fill="rgba(80,150,210,.18)" stroke="${SH_INK}" stroke-width="0.35"`);
      const xm=X((t0+t1)/2);if(o.w>0.6)s+=`<line x1="${r2(xm)}" y1="${r2(Y(o.sill+o.h))}" x2="${r2(xm)}" y2="${r2(Y(o.sill))}" stroke="${SH_INK}" stroke-width="0.2"/>`;
      s+=shText(Math.min(X(t0),X(t1))+0.8,Y(o.sill)-1,`window ${fmtIn(o.w)} × ${fmtIn(o.h)}, sill ${fmtIn(o.sill)}`,{fs:2,fill:SH_MUTED});}
    else{s+=rect(t0,t1,0,o.h,`fill="var(--paper)" stroke="${SH_INK}" stroke-width="0.35"`);
      const hx=X(o.hinge==='a'?t0:t1),fx=X(o.hinge==='a'?t1:t0);
      s+=`<path d="M${r2(fx)} ${r2(Y(o.h))} L${r2(hx)} ${r2(Y(o.h/2))} L${r2(fx)} ${r2(Y(0))}" fill="none" stroke="${SH_MUTED}" stroke-width="0.2" stroke-dasharray="1 1"/>`;
      s+=shText(Math.min(X(t0),X(t1))+0.8,Y(o.h)-1,`door ${fmtIn(o.w)} × ${fmtIn(o.h)}${o.entrance?' · entrance':''}`,{fs:2,fill:SH_MUTED});}}
  for(const f of S.fixtures){if(!fxVisible(f)||FX[f.type].ceil)continue;
    if(f.obj){/* on an object in the depth band, on a face turned towards the viewer */
      const A=fxPlan(f);if(!A||!visible(A.o))continue;const vn=[n[0]*sg,n[1]*sg];if(A.n[0]*vn[0]+A.n[1]*vn[1]<0.5)continue;
      const t=(A.p[0]-w.a[0])*u[0]+(A.p[1]-w.a[1])*u[1],dn=(A.p[0]-w.a[0])*vn[0]+(A.p[1]-w.a[1])*vn[1];if(t<0||t>L||dn<-1e-3||dn>dep)continue;
      s+=fxSvgElev(f,X(t),Y(fxY(f)),k,shTagCol(f.tag));continue;}
    if(f.wall!==w.id)continue;s+=fxSvgElev(f,X(f.off),Y(f.y),k,shTagCol(f.tag));}
  s+=`<path d="M${r2(X(0))} ${r2(Y(H))} V${r2(Y(0))} H${r2(X(L))} V${r2(Y(H))}" fill="none" stroke="${SH_INK}" stroke-width="0.6"/>`;
  return s;}

function elevName(e){const w=wallById(e.wall),i=S.walls.indexOf(w)+1;return`Wall ${i}${e.flip?' (other side)':''} · ${fmt(wallLen(w))} m`;}
function sheetSVG(L){const{pw,ph,k,m,tb}=L;let s=`<svg viewBox="0 0 ${pw} ${ph}" xmlns="http://www.w3.org/2000/svg" aria-label="Drawing sheet" class="sheet-svg" data-w="${pw}" data-h="${ph}">`;
  s+=`<rect x="0" y="0" width="${pw}" height="${ph}" fill="var(--paper)"/><rect x="${m}" y="${m}" width="${pw-2*m}" height="${ph-2*m}" fill="none" stroke="${SH_INK}" stroke-width="0.5"/>`;
  let letter=65;
  for(const it of L.items){const tag=String.fromCharCode(letter++),ttl=it.kind==='plan'?'Plan':'Elevation · '+elevName(it.e);
    s+=shText(it.x,it.y-2,`${tag} · ${ttl}`,{fs:2.8,w:600})+`<g>${it.kind==='plan'?planSVG(it,k):elevSVG(it,k)}</g>`;
    if(L.over.includes(it))s+=`<rect x="${r2(it.x)}" y="${r2(it.y)}" width="${r2(it.w)}" height="${r2(it.h)}" fill="none" stroke="var(--gx)" stroke-width="0.4" stroke-dasharray="2 1.5"/>`;}
  /* title block */
  const sc=S.scenarios.find(x=>x.id===S.scenario),gh=S.scenarios.find(x=>x.id===S.ghost);
  const y0=ph-m-tb,cols=[[sheetTitle()+(sc?' · '+sc.name:''),'Title'+(gh?` · dashed: ${gh.name}`:''),0.38],[`1:${S.paper.scale}`,'Scale',0.12],[`${S.paper.size} ${S.paper.orient}`,'Paper',0.17],['metres','Units',0.11],[new Date().toISOString().slice(0,10),'Date',0.22]];
  s+=`<line x1="${m}" y1="${y0}" x2="${pw-m}" y2="${y0}" stroke="${SH_INK}" stroke-width="0.5"/>`;let x=m;
  for(const[v,l,f]of cols){const w=(pw-2*m)*f;s+=shText(x+2.5,y0+5,l.toUpperCase(),{fs:1.9,fill:SH_MUTED})+shText(x+2.5,y0+11.5,v,{fs:l.startsWith('Title')?4.2:3.2,w:l.startsWith('Title')?600:500});
    x+=w;if(x<pw-m-1)s+=`<line x1="${r2(x)}" y1="${y0}" x2="${r2(x)}" y2="${ph-m}" stroke="${SH_INK}" stroke-width="0.3"/>`;}
  return s+'</svg>';}

/* ---------- tables ---------- */
function specRows(){const rows=[],done=new Set();
  for(const o of S.objects){if(!visible(o))continue;
    if(o.g){if(done.has(o.g))continue;done.add(o.g);const g=grpById(o.g),ms=members(o.g),b=bbox(ms),pp=g&&g.preset&&g.preset.p;
      rows.push({n:g?g.n:'Group',tag:g?g.tag:'',size:pp?[pp.width,pp.depth,pp.height]:[b.x1-b.x0,b.z1-b.z0,b.y1-b.y0],y:[b.y0,b.y1],notes:g?g.notes:'',kind:g&&g.preset?(PRESETS[g.preset.type]?.label||''):'group'});}
    else rows.push({n:o.n,tag:o.tag,size:[o.w,o.d,o.h],y:[o.y,o.y+o.h],notes:o.notes,kind:o.parent?'on '+parentName(o):''});}
  for(const f of S.fixtures){if(!fxVisible(f))continue;const T=FX[f.type],Z=fxSize(f);rows.push({n:f.n,tag:f.tag,size:[Z.w,null,Z.h],y:T.ceil?null:[fxY(f),null],notes:f.notes,kind:fxLabel(f)+' · '+fxWhere(f).replace(/ · [\d.]+ high$/,'')+(f.obj?` · ${fmt(f.y)} up the face`:'')});}
  return rows;}
function specHTML(){const rows=specRows();if(!rows.length)return'<p class="note">Nothing placed yet.</p>';
  const sz=s=>s.filter(v=>v!==null).map(fmt).join(' × ');
  return`<table class="tbl"><tr><th>Item</th><th>Size (m)</th><th>Height</th><th>Notes</th></tr>${rows.map(r=>`<tr><td>${esc(r.n)}${r.tag&&tagById(r.tag)?`<span class="tagc" style="border-color:${shTagCol(r.tag)};color:${shTagCol(r.tag)}">${esc(tagName(r.tag))}</span>`:''}${r.kind?`<div class="sub">${esc(r.kind)}</div>`:''}</td>
    <td class="n">${sz(r.size)}</td><td class="n">${r.y===null?'ceiling':r.y[1]===null?'@'+fmt(r.y[0]):fmt(r.y[0])+'–'+fmt(r.y[1])}</td><td>${esc(r.notes||'')}</td></tr>`).join('')}</table>`;}
function legendHTML(){const used=new Set(S.objects.filter(visible).map(o=>effTag(o)||'_none').concat(S.fixtures.filter(fxVisible).map(f=>f.tag||'_none')));
  const it=S.tags.filter(t=>used.has(t.id)).map(t=>[t.name,shTagCol(t.id)]);if(used.has('_none'))it.push(['Untagged',C.accent]);
  if(!it.length)return'<p class="note">No items.</p>';
  return`<div class="slegend">${it.map(([n,c])=>`<span><i style="border-color:${c};background:color-mix(in srgb,${c} 14%,transparent)"></i>${esc(n)}</span>`).join('')}</div>
    <div class="slegend"><span><i style="border-style:dashed;border-color:var(--muted)"></i>locked / existing</span><span><i style="border-color:var(--ink);background:rgba(80,150,210,.18)"></i>window</span>${S.ghost&&S.scenarios.find(x=>x.id===S.ghost)?`<span><i style="border-style:dotted;border-color:var(--muted)"></i>${esc(S.scenarios.find(x=>x.id===S.ghost).name)} (ghost)</span>`:''}</div>`;}

/* ---------- notes (inline editing) ---------- */
function renderNotes(){const el=$('sheet-notes');if(!el)return;let h='';
  for(const s of S.notes){h+=`<div class="nsec"><div class="nsec-h"><h3 contenteditable="true" data-stitle="${s.id}" aria-label="Section title">${esc(s.title)}</h3><button type="button" class="ib np" data-sdel="${s.id}" aria-label="Delete section ${esc(s.title)}">×</button></div><ul>`;
    for(const it of s.items)h+=`<li class="${it.verify?'vfy':''}"><span class="ntext" contenteditable="true" data-item="${s.id}:${it.id}" aria-label="Note">${esc(it.text)}</span><button type="button" class="vf" data-vf="${s.id}:${it.id}" aria-pressed="${it.verify}" title="Mark as something to verify">verify</button><button type="button" class="ib np" data-idel="${s.id}:${it.id}" aria-label="Delete note">×</button></li>`;
    h+=`</ul><button type="button" class="np addi" data-iadd="${s.id}">+ Note</button></div>`;}
  const have=new Set(S.notes.map(s=>s.title));
  h+=`<div class="chips np"><button type="button" data-sadd="">Add section</button>${['Guest modes','Assumptions'].filter(t=>!have.has(t)).map(t=>`<button type="button" data-sadd="${t}">Add “${t}”</button>`).join('')}</div>`;
  if(!S.notes.length)h=`<p class="note np">Titled sections for decisions, guest modes, assumptions… Click any text to edit it. Mark items to check with “verify”.</p>`+h;
  el.innerHTML=h;
  const find=key=>{const[a,b]=key.split(':'),s=S.notes.find(x=>x.id===a);return{s,it:s&&b?s.items.find(x=>x.id===b):null};};
  el.querySelectorAll('[data-stitle]').forEach(t=>{t.addEventListener('input',()=>{const{s}=find(t.dataset.stitle);if(s)s.title=t.textContent;});t.addEventListener('blur',()=>{commit();});
    t.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();t.blur();}});});
  el.querySelectorAll('[data-item]').forEach(t=>{t.addEventListener('input',()=>{const{it}=find(t.dataset.item);if(it)it.text=t.textContent;});t.addEventListener('blur',()=>commit());
    t.addEventListener('keydown',e=>{const{s,it}=find(t.dataset.item);if(!s||!it)return;
      if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();const ni={id:uid('i'),text:'',verify:false};s.items.splice(s.items.indexOf(it)+1,0,ni);commit();renderNotes();focusNote(s.id,ni.id);}
      else if(e.key==='Backspace'&&!t.textContent){e.preventDefault();const i=s.items.indexOf(it);s.items.splice(i,1);commit();renderNotes();const p=s.items[Math.max(0,i-1)];if(p)focusNote(s.id,p.id,true);}});});
  el.querySelectorAll('[data-vf]').forEach(b=>b.addEventListener('click',()=>{const{it}=find(b.dataset.vf);if(!it)return;it.verify=!it.verify;commit();renderNotes();}));
  el.querySelectorAll('[data-idel]').forEach(b=>b.addEventListener('click',()=>{const{s,it}=find(b.dataset.idel);if(!s)return;s.items=s.items.filter(x=>x!==it);commit();renderNotes();}));
  el.querySelectorAll('[data-sdel]').forEach(b=>b.addEventListener('click',()=>{S.notes=S.notes.filter(x=>x.id!==b.dataset.sdel);commit();renderNotes();flash('Section deleted. Undo brings it back.');}));
  el.querySelectorAll('[data-iadd]').forEach(b=>b.addEventListener('click',()=>{const{s}=find(b.dataset.iadd);if(!s)return;const ni={id:uid('i'),text:'',verify:s.title==='Assumptions'};s.items.push(ni);commit();renderNotes();focusNote(s.id,ni.id);}));
  el.querySelectorAll('[data-sadd]').forEach(b=>b.addEventListener('click',()=>{const t=b.dataset.sadd,ns={id:uid('n'),title:t||'New section',items:[{id:uid('i'),text:'',verify:t==='Assumptions'}]};S.notes.push(ns);commit();renderNotes();
    if(t)focusNote(ns.id,ns.items[0].id);else{const h3=el.querySelector(`[data-stitle="${ns.id}"]`);if(h3){h3.focus();document.execCommand&&document.execCommand('selectAll',false,null);}}}));}
function focusNote(sid,iid,end){const t=$('sheet-notes').querySelector(`[data-item="${sid}:${iid}"]`);if(!t)return;t.focus();
  if(end){const r=document.createRange();r.selectNodeContents(t);r.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(r);}}

/* ---------- render ---------- */
function renderSheet(){if(S.view!=='sheet')return;const L=sheetLayout();
  $('sheet-draw').innerHTML=sheetSVG(L);
  $('sheet-warn').textContent=L.over.length?`At 1:${S.paper.scale} on ${S.paper.size} ${S.paper.orient}, ${L.over.map(it=>it.kind==='plan'?'the plan':elevName(it.e)).join(', ')} ${L.over.length>1?"don't":"doesn't"} fit (red outline). Try a smaller scale, A3, or fewer elevations.`:'';
  $('sheet-warn').hidden=!L.over.length;
  $('sheet-spec').innerHTML=specHTML();$('sheet-cuts').innerHTML=cutListHTML(false);$('sheet-legend').innerHTML=legendHTML();
  setPrintPage();}
function setPrintPage(){let st=$('print-page');if(!st){st=document.createElement('style');st.id='print-page';document.head.appendChild(st);}
  const[pw,ph]=paperDims();st.textContent=`@media print{@page{size:${S.paper.size} ${S.paper.orient};margin:0}#sheet-draw svg{width:${pw}mm;height:${ph}mm;min-width:0}}`;}
function renderSheetPanel(){const el=$('sh-elev');if(!el)return;const t=$('sh-title');if(t&&t!==document.activeElement){t.value=S.sheet.title||'';t.placeholder=sheetTitle();}
  if(S.view==='sheet')sheetElevs();
  el.innerHTML=S.walls.map((w,i)=>{const e=S.sheet.elev.find(x=>x.wall===w.id);return`<div class="erow"><label class="inl"><input type="checkbox" data-ew="${w.id}"${e?' checked':''}> Wall ${i+1} · ${fmt(wallLen(w))} m${S.openings.some(o=>o.wall===w.id)?' · '+S.openings.filter(o=>o.wall===w.id).map(o=>o.type).join(', '):''}</label>
    <label class="inl"><input type="checkbox" data-ef="${w.id}"${e&&e.flip?' checked':''}${e?'':' disabled'}> other side</label></div>`;}).join('')||'<p class="note">No walls.</p>';
  const d=$('sh-depth');if(d){d.value=S.sheet.depth;$('o-sh-depth').textContent=fmt(S.sheet.depth);}
  el.querySelectorAll('[data-ew]').forEach(c=>c.addEventListener('change',()=>{const id=c.dataset.ew;S.sheet.init=true;
    if(c.checked){if(!S.sheet.elev.some(x=>x.wall===id))S.sheet.elev.push({wall:id,flip:false});}else S.sheet.elev=S.sheet.elev.filter(x=>x.wall!==id);
    commit();renderSheetPanel();renderSheet();}));
  el.querySelectorAll('[data-ef]').forEach(c=>c.addEventListener('change',()=>{const e=S.sheet.elev.find(x=>x.wall===c.dataset.ef);if(e)e.flip=c.checked;commit();renderSheet();}));}
$('sh-title').addEventListener('input',e=>{S.sheet.title=e.target.value;renderSheet();});$('sh-title').addEventListener('change',commit);
$('sh-depth').addEventListener('input',e=>{S.sheet.depth=+e.target.value;$('o-sh-depth').textContent=fmt(S.sheet.depth);renderSheet();});$('sh-depth').addEventListener('change',commit);
$('b-print').addEventListener('click',()=>{if(S.view!=='sheet')setView('sheet');renderSheet();setTimeout(()=>{try{window.print();}catch(e){flash("Printing isn't available here. Export the project and open the app in a browser tab to print.");}},50);});
