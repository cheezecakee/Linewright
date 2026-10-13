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
    const wood=w.type==='wood',nw=wallN(w),wseg=(ta,tb)=>{if(!wood)return seg(ta,tb,0.7);
      const A=Q(ta),B=Q(tb),o=[nw[0]*0.7,nw[1]*0.7],ln=(P1,P2)=>`<line x1="${r2(P1[0])}" y1="${r2(P1[1])}" x2="${r2(P2[0])}" y2="${r2(P2[1])}" stroke="${SH_INK}" stroke-width="0.3"/>`;
      return ln([A[0]+o[0],A[1]+o[1]],[B[0]+o[0],B[1]+o[1]])+ln([A[0]-o[0],A[1]-o[1]],[B[0]-o[0],B[1]-o[1]])+ln([A[0]+o[0],A[1]+o[1]],[A[0]-o[0],A[1]-o[1]])+ln([B[0]+o[0],B[1]+o[1]],[B[0]-o[0],B[1]-o[1]]);};
    const ops=S.openings.filter(o=>o.wall===w.id).sort((a,c)=>a.off-c.off);let t=0;
    for(const o of ops){const t0=clamp(o.off,0,L),t1=clamp(o.off+o.w,0,L);if(t0>t)s+=wseg(t,t0);t=Math.max(t,t1);
      if(o.type==='window'){const n=wallN(w),A=Q(t0),B=Q(t1),e=0.9;s+=`<polygon points="${r2(A[0]-n[0]*e)},${r2(A[1]-n[1]*e)} ${r2(B[0]-n[0]*e)},${r2(B[1]-n[1]*e)} ${r2(B[0]+n[0]*e)},${r2(B[1]+n[1]*e)} ${r2(A[0]+n[0]*e)},${r2(A[1]+n[1]*e)}" fill="rgba(80,150,210,.18)" stroke="${SH_INK}" stroke-width="0.2"/>`;}
      else{const g=doorGeom(o,w),H=M(g.H[0],g.H[1]),T=M(g.H[0]+g.d1[0]*g.r,g.H[1]+g.d1[1]*g.r),C0=M(g.H[0]+g.d0[0]*g.r,g.H[1]+g.d0[1]*g.r),cr=g.d0[0]*g.d1[1]-g.d0[1]*g.d1[0];
        s+=`<line x1="${r2(H[0])}" y1="${r2(H[1])}" x2="${r2(T[0])}" y2="${r2(T[1])}" stroke="${SH_INK}" stroke-width="0.3"/><path d="M${r2(T[0])} ${r2(T[1])} A${r2(g.r*k)} ${r2(g.r*k)} 0 0 ${cr>0?0:1} ${r2(C0[0])} ${r2(C0[1])}" fill="none" stroke="${SH_MUTED}" stroke-width="0.2" stroke-dasharray="1 1"/>`;
        if(o.entrance){const c=Q((t0+t1)/2),n=wallN(w),si=wallIn(w);s+=shText(c[0]-n[0]*si*3,c[1]-n[1]*si*3+0.8,'entrance',{fs:2,anchor:'middle',fill:'var(--guide)'});}}}
    if(t<L)s+=wseg(t,L);
    /* stored wall length, written outside the room */
    const si=wallIn(w),n=wallN(w),c=Q(L/2),o2=[c[0]-n[0]*si*3.2,c[1]-n[1]*si*3.2],ang=Math.atan2(u[1],u[0])*180/Math.PI,rot=ang>90||ang<-90?ang+180:ang;
    s+=shText(o2[0],o2[1]+0.8,fmt(L),{fs:2.4,anchor:'middle',rot:Math.abs(rot)<0.01?0:rot});}
  for(const f of S.fixtures)if(fxVisible(f)){s+=fxSvgPlan(f,M,shTagCol(f.tag));
    const A=fxPlan(f);if(A){const P=M(A.p[0],A.p[1]),n=A.n||[0.7,-0.7];s+=shText(P[0]+n[0]*5.4,P[1]+n[1]*5.4+0.6,'F'+fxNum(f),{fs:1.8,anchor:'middle',fill:SH_MUTED});}}
  return s;}

function elevSVG(it,k){const w=it.wall,e=it.e,L=wallLen(w),H=wallH(w),u=wallU(w),n=wallN(w),sg=wallIn(w)*(e.flip?-1:1),dep=+S.sheet.depth||1.2;
  const X=t=>it.x+it.pm+(sg>0?t:L-t)*k,Y=y=>it.y+it.pm*0.4+(H-y)*k;let s='';
  const rect=(t0,t1,y0,y1,a)=>{const x0=Math.min(X(t0),X(t1)),x1=Math.max(X(t0),X(t1));return`<rect x="${r2(x0)}" y="${r2(Y(y1))}" width="${r2(x1-x0)}" height="${r2((y1-y0)*k)}" ${a}/>`;};
  s+=`<line x1="${r2(X(0))}" y1="${r2(Y(H))}" x2="${r2(X(L))}" y2="${r2(Y(H))}" stroke="${SH_LINE}" stroke-width="0.25" stroke-dasharray="2 1.4"/>`;
  s+=shText(Math.min(X(0),X(L))+1,Y(H)-1,`ceiling ${fmt(H)}`,{fs:2.1,fill:SH_MUTED});
  for(const[t0,y0,t1,y1]of wallPat(w))s+=`<line x1="${r2(X(t0))}" y1="${r2(Y(y0))}" x2="${r2(X(t1))}" y2="${r2(Y(y1))}" stroke="${SH_MUTED}" stroke-width="0.12"/>`;
  if(w.type==='wood')s+=shText(Math.max(X(0),X(L))-1,Y(H)-1,`wood · ${WALL_STYLES[w.style]||''}`,{fs:2.1,fill:SH_MUTED,anchor:'end'});
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
  const fnum=(f,cx,cy)=>shText(cx,cy-fxSize(f).h/2*k-0.7,'F'+fxNum(f),{fs:1.7,anchor:'middle',fill:SH_MUTED});
  for(const f of S.fixtures){if(!fxVisible(f)||isFlat(f))continue;
    if(f.obj){/* on an object in the depth band, on a face turned towards the viewer */
      const A=fxPlan(f);if(!A||!visible(A.o))continue;const vn=[n[0]*sg,n[1]*sg];if(A.n[0]*vn[0]+A.n[1]*vn[1]<0.5)continue;
      const t=(A.p[0]-w.a[0])*u[0]+(A.p[1]-w.a[1])*u[1],dn=(A.p[0]-w.a[0])*vn[0]+(A.p[1]-w.a[1])*vn[1];if(t<0||t>L||dn<-1e-3||dn>dep)continue;
      s+=fxSvgElev(f,X(t),Y(fxY(f)),k,shTagCol(f.tag))+fnum(f,X(t),Y(fxY(f)));continue;}
    if(f.wall!==w.id)continue;s+=fxSvgElev(f,X(f.off),Y(f.y),k,shTagCol(f.tag))+fnum(f,X(f.off),Y(f.y));}
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
  return s+sketchSVG()+'</svg>';}

/* ---------- tables ---------- */
function specRows(){const rows=[],done=new Set();
  for(const o of S.objects){if(!visible(o))continue;
    if(o.g){if(done.has(o.g))continue;done.add(o.g);const g=grpById(o.g),ms=members(o.g),b=bbox(ms),pp=g&&g.preset&&g.preset.p;
      rows.push({n:g?g.n:'Group',tag:g?g.tag:'',size:pp?[pp.width,pp.depth,pp.height]:[b.x1-b.x0,b.z1-b.z0,b.y1-b.y0],y:[b.y0,b.y1],notes:g?g.notes:'',kind:g&&g.preset?(PRESETS[g.preset.type]?.label||''):'group'});}
    else rows.push({n:o.n,tag:o.tag,size:[o.w,o.d,o.h],y:[o.y,o.y+o.h],notes:o.notes,kind:o.parent?'on '+parentName(o):''});}
  S.walls.forEach((w,i)=>{if(w.type!=='wood')return;const sl=w.style==='slats'||w.style==='hslats',n=sl?Math.floor(wallLen(w)/((w.sw||0.05)+(w.sg||0))):0;
    rows.push({n:`Wall ${i+1} · wood`,tag:'',size:[wallLen(w),null,wallH(w)],y:[0,wallH(w)],kind:'wall finish',
      notes:`${WALL_STYLES[w.style]||''}${w.style==='panel'?'':`, ${w.style==='boards'?'boards':'slats'} ${fmtIn(+(w.sw*1000).toFixed(1))} mm`}${sl&&w.sg>0?`, gap ${fmtIn(+(w.sg*1000).toFixed(1))} mm`:''}${n?` · about ${n} slats`:''}`});});
  return rows;}
/* fixtures: numbered F1, F2… by their place in the project (the number stays when others are hidden), grouped by type */
const fxNum=f=>S.fixtures.indexOf(f)+1;
function fixturesHTML(){const all=S.fixtures,vis=all.filter(fxVisible),hid=all.length-vis.length;
  if(!all.length)return'<p class="note">No fixtures yet.</p>';
  if(!vis.length)return`<p class="note">${hid} fixture${hid>1?'s are':' is'} hidden.</p>`;
  const where=f=>fxTop(f)?`on ${esc(objLabel(byId(f.obj)))} · top`:FX[f.type].flat?`${FX[f.type].floor?'floor':'ceiling'} · ${fmt(f.x)}, ${fmt(f.z)}`:f.obj?`on ${esc(objLabel(byId(f.obj)))} · ${faceName(byId(f.obj),f.face).toLowerCase()} · ${fmt(f.off)} along`:
    `wall ${S.walls.indexOf(wallById(f.wall))+1} · ${fmt(f.off)} from start`,
    high=f=>fxTop(f)?fmt(fxY(f)):FX[f.type].flat?(FX[f.type].floor?'floor':'ceiling'):f.obj?fmt(fxY(f)):fmt(f.y);
  let h='<table class="tbl"><tr><th>No.</th><th>Fixture</th><th>Where</th><th>Height</th><th>Notes</th></tr>';
  for(const type of Object.keys(FX)){const g=vis.filter(f=>f.type===type);if(!g.length)continue;
    const cnt={};for(const f of g){const v=fxVariant(f),l=v?v.label:'';cnt[l]=(cnt[l]||0)+1;}
    h+=`<tr class="grp"><td colspan="5"><b>${esc(FX[type].label)}</b> · ${g.length}${Object.keys(cnt).length>1||Object.keys(cnt)[0]?` <span class="sub">(${Object.entries(cnt).map(([l,n])=>`${esc(l||'standard')} ×${n}`).join(', ')})</span>`:''}</td></tr>`;
    for(const f of g){const v=fxVariant(f);h+=`<tr><td class="n">F${fxNum(f)}</td><td>${esc(f.n)}${v?`<div class="sub">${esc(v.label)}</div>`:''}${f.tag&&tagById(f.tag)?`<span class="tagc" style="border-color:${shTagCol(f.tag)};color:${shTagCol(f.tag)}">${esc(tagName(f.tag))}</span>`:''}</td>
      <td>${where(f)}</td><td class="n">${high(f)}</td><td>${esc(f.notes||'')}</td></tr>`;}}
  return h+'</table>'+(hid?`<p class="note np">${hid} hidden fixture${hid>1?'s are':' is'} not listed; numbers keep their place.</p>`:'');}
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
  $('sheet-spec').innerHTML=specHTML();$('sheet-fx').innerHTML=fixturesHTML();$('sheet-cuts').innerHTML=cutListHTML(false);$('sheet-legend').innerHTML=legendHTML();
  setPrintPage();}
function setPrintPage(){let st=$('print-page');if(!st){st=document.createElement('style');st.id='print-page';document.head.appendChild(st);}
  const[pw,ph]=paperDims();st.textContent=`@media print{@page{size:${S.paper.size} ${S.paper.orient};margin:0}#sheet-draw svg{width:${pw}mm;height:${ph}mm;min-width:0}}`;}
function renderSheetPanel(){renderSketchUI();const el=$('sh-elev');if(!el)return;const t=$('sh-title');if(t&&t!==document.activeElement){t.value=S.sheet.title||'';t.placeholder=sheetTitle();}
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

/* ---------- scratchpad: marks drawn on the sheet page ----------
   S.sheet.draw = [{id, k, a, b, t}] in page millimetres, so they sit where you put them (they don't follow the drawings when the
   scale or paper changes). Tools: line, arrow, rectangle (a, b = opposite corners), text (at a) and dimension (a→b; reads its
   length at the sheet scale unless it has its own label). Selected marks show handles that are not printed (class np). */
const SK_TOOLS=[['select','Select'],['line','Line'],['arrow','Arrow'],['rect','Rectangle'],['text','Text'],['dim','Dimension']];
let skTool='select',skSel=null,skDrag=null;
const skById=id=>S.sheet.draw.find(m=>m.id===id);
const skLen=m=>Math.hypot(m.b[0]-m.a[0],m.b[1]-m.a[1]);
const skLabel=m=>m.t||`${fmt(skLen(m)*(+S.paper.scale||50)/1000)} m`;
function sketchSVG(){let s='';const f=r2;
  const L=(a,b,sw,col,x)=>`<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${col||SH_INK}" stroke-width="${sw}" stroke-linecap="round"${x||''}/>`;
  for(const m of S.sheet.draw){const on=m.id===skSel;
    if(m.k==='line')s+=L(m.a,m.b,0.35);
    else if(m.k==='arrow'){s+=L(m.a,m.b,0.35);const l=skLen(m)||1,u=[(m.b[0]-m.a[0])/l,(m.b[1]-m.a[1])/l],h=Math.min(2.8,l*0.5);
      s+=`<polygon points="${f(m.b[0])},${f(m.b[1])} ${f(m.b[0]-u[0]*h-u[1]*h*0.38)},${f(m.b[1]-u[1]*h+u[0]*h*0.38)} ${f(m.b[0]-u[0]*h+u[1]*h*0.38)},${f(m.b[1]-u[1]*h-u[0]*h*0.38)}" fill="${SH_INK}"/>`;}
    else if(m.k==='rect')s+=`<rect x="${f(Math.min(m.a[0],m.b[0]))}" y="${f(Math.min(m.a[1],m.b[1]))}" width="${f(Math.abs(m.b[0]-m.a[0]))}" height="${f(Math.abs(m.b[1]-m.a[1]))}" fill="none" stroke="${SH_INK}" stroke-width="0.35"/>`;
    else if(m.k==='text')(m.t||'').split('\n').forEach((ln,i)=>{s+=shText(m.a[0],m.a[1]+i*3.8,ln,{fs:3.2,fill:SH_INK});});
    else if(m.k==='dim'){const l=skLen(m)||1,u=[(m.b[0]-m.a[0])/l,(m.b[1]-m.a[1])/l],n=[-u[1],u[0]],t=1.4;
      s+=L(m.a,m.b,0.3)+L([m.a[0]-n[0]*t,m.a[1]-n[1]*t],[m.a[0]+n[0]*t,m.a[1]+n[1]*t],0.3)+L([m.b[0]-n[0]*t,m.b[1]-n[1]*t],[m.b[0]+n[0]*t,m.b[1]+n[1]*t],0.3)
        +L([m.a[0]-u[0]*t*0.7+n[0]*t*0.7,m.a[1]-u[1]*t*0.7+n[1]*t*0.7],[m.a[0]+u[0]*t*0.7-n[0]*t*0.7,m.a[1]+u[1]*t*0.7-n[1]*t*0.7],0.3)
        +L([m.b[0]-u[0]*t*0.7+n[0]*t*0.7,m.b[1]-u[1]*t*0.7+n[1]*t*0.7],[m.b[0]+u[0]*t*0.7-n[0]*t*0.7,m.b[1]+u[1]*t*0.7-n[1]*t*0.7],0.3);
      let ang=Math.atan2(u[1],u[0])*180/Math.PI;if(ang>90||ang<-90)ang+=180;
      const up=n[1]>0||(n[1]===0&&n[0]>0)?[-n[0],-n[1]]:n;   /* the normal that points up the page */
      s+=shText((m.a[0]+m.b[0])/2+up[0]*1.4,(m.a[1]+m.b[1])/2+up[1]*1.4,skLabel(m),{fs:2.6,anchor:'middle',rot:Math.abs(ang)<0.01?0:ang,fill:SH_INK});}
    if(on){const pts=m.k==='text'?[m.a]:[m.a,m.b];
      if(m.k!=='text')s+=L(m.a,m.b,0.9,'var(--accent)',' opacity=".25" class="np"');
      for(const p of pts)s+=`<rect class="np" x="${f(p[0]-1.1)}" y="${f(p[1]-1.1)}" width="2.2" height="2.2" fill="var(--paper)" stroke="var(--accent)" stroke-width="0.35"/>`;}}
  return s;}
function skPoint(e){const svg=$('sheet-draw').querySelector('svg');if(!svg)return null;const m=svg.getScreenCTM();if(!m)return null;
  const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const p=pt.matrixTransform(m.inverse());return[p.x,p.y,m.a];}
function skSnap(e,p,from,tool){let x=e.altKey?p[0]:Math.round(p[0]*2)/2,y=e.altKey?p[1]:Math.round(p[1]*2)/2;
  if(from&&e.shiftKey&&!e.altKey){const dx=x-from[0],dy=y-from[1];
    if(tool==='rect'){const d=Math.max(Math.abs(dx),Math.abs(dy));x=from[0]+Math.sign(dx||1)*d;y=from[1]+Math.sign(dy||1)*d;}
    else{const l=Math.hypot(dx,dy),a=Math.round(Math.atan2(dy,dx)/(Math.PI/12))*(Math.PI/12);x=from[0]+Math.cos(a)*l;y=from[1]+Math.sin(a)*l;}}
  return[x,y];}
function skHit(m,p,tol){
  if(m.k==='text'){const ls=(m.t||'').split('\n'),w=Math.max(2,...ls.map(l=>l.length))*1.9+1;return p[0]>=m.a[0]-1&&p[0]<=m.a[0]+w&&p[1]>=m.a[1]-3.6&&p[1]<=m.a[1]+(ls.length-1)*3.8+1;}
  if(m.k==='rect'){const x0=Math.min(m.a[0],m.b[0]),x1=Math.max(m.a[0],m.b[0]),y0=Math.min(m.a[1],m.b[1]),y1=Math.max(m.a[1],m.b[1]);
    return[[[x0,y0],[x1,y0]],[[x1,y0],[x1,y1]],[[x1,y1],[x0,y1]],[[x0,y1],[x0,y0]]].some(([a,b])=>segDist(p,a,b)<=tol);}
  return segDist(p,m.a,m.b)<=tol;}
$('sheet-draw').addEventListener('pointerdown',e=>{if(S.view!=='sheet'||e.button!==0)return;const q=skPoint(e);if(!q)return;
  const p=[q[0],q[1]],tol=7/(q[2]||1);   /* 7 CSS px in page mm */
  if(skTool==='select'){
    const cur=skSel&&skById(skSel);
    if(cur){const ends=cur.k==='text'?[['a',cur.a]]:[['a',cur.a],['b',cur.b]];
      for(const[nm,pt]of ends)if(Math.hypot(p[0]-pt[0],p[1]-pt[1])<=tol*1.2){skDrag={m:cur,mode:nm,p0:p,a0:[...cur.a],b0:[...cur.b],moved:false};$('sheet-draw').setPointerCapture(e.pointerId);return;}}
    let hit=null;for(const m of S.sheet.draw.slice().reverse())if(skHit(m,p,tol)){hit=m;break;}
    skSel=hit?hit.id:null;
    if(hit){skDrag={m:hit,mode:'move',p0:p,a0:[...hit.a],b0:[...hit.b],moved:false};$('sheet-draw').setPointerCapture(e.pointerId);}
    renderSketchUI();renderSheet();return;}
  e.preventDefault();
  const a=skSnap(e,p,null,skTool);
  if(skTool==='text'){const m={id:uid('k'),k:'text',a,b:[...a],t:'Text'};S.sheet.draw.push(m);skSel=m.id;skTool='select';commit();renderSketchUI();renderSheet();
    const inp=$('sk-text');if(inp){inp.focus();inp.select();}return;}
  const m={id:uid('k'),k:skTool,a,b:[...a],t:''};S.sheet.draw.push(m);skSel=m.id;
  skDrag={m,mode:'create',p0:p,a0:[...a],b0:[...a],moved:false};$('sheet-draw').setPointerCapture(e.pointerId);renderSheet();});
$('sheet-draw').addEventListener('pointermove',e=>{if(!skDrag)return;const q=skPoint(e);if(!q)return;const p=[q[0],q[1]],d=skDrag,m=d.m;d.moved=true;
  if(d.mode==='create'){m.b=skSnap(e,p,m.a,m.k);}
  else if(d.mode==='a'){const o=skSnap(e,p,m.k==='text'?null:d.b0,m.k);m.a=o;if(m.k==='text')m.b=[...o];}
  else if(d.mode==='b'){m.b=skSnap(e,p,d.a0,m.k);}
  else{const dx=p[0]-d.p0[0],dy=p[1]-d.p0[1],r=e.altKey?v=>v:v=>Math.round(v*2)/2;m.a=[r(d.a0[0]+dx),r(d.a0[1]+dy)];m.b=[r(d.b0[0]+dx),r(d.b0[1]+dy)];}
  renderSheet();});
const skEnd=()=>{if(!skDrag)return;const d=skDrag,m=d.m;skDrag=null;
  if(d.mode==='create'){if(skLen(m)<1){S.sheet.draw=S.sheet.draw.filter(x=>x!==m);skSel=null;}else skTool='select';}
  if(d.moved||d.mode==='create')commit();renderSketchUI();renderSheet();};
$('sheet-draw').addEventListener('pointerup',skEnd);$('sheet-draw').addEventListener('pointercancel',skEnd);
function skCancel(){skTool='select';skSel=null;skDrag=null;renderSketchUI();renderSheet();}
function skDelete(){if(!skSel)return;S.sheet.draw=S.sheet.draw.filter(m=>m.id!==skSel);skSel=null;commit();renderSketchUI();renderSheet();}
function renderSketchUI(){const t=$('sk-tools');if(!t)return;
  t.innerHTML=SK_TOOLS.map(([k,l])=>`<button type="button" data-sk="${k}" aria-pressed="${skTool===k}">${l}</button>`).join('');
  t.querySelectorAll('[data-sk]').forEach(b=>b.addEventListener('click',()=>{skTool=b.dataset.sk;if(skTool!=='select')skSel=null;renderSketchUI();renderSheet();}));
  $('sheet-draw').classList.toggle('sk-on',skTool!=='select');
  const m=skSel&&skById(skSel),pr=$('sk-props');
  if(!m)skSel=null;
  pr.innerHTML=m&&(m.k==='text')?`<label class="fl" for="sk-text">Text</label><textarea id="sk-text" class="tx" rows="2">${esc(m.t)}</textarea>`:
    m&&m.k==='dim'?`<label class="fl" for="sk-text">Label (empty = measured at 1:${S.paper.scale}: ${fmt(skLen(m)*(+S.paper.scale||50)/1000)} m)</label><input id="sk-text" class="tx" value="${esc(m.t)}">`:'';
  const inp=$('sk-text');if(inp){inp.addEventListener('input',()=>{m.t=inp.value;renderSheet();});inp.addEventListener('change',commit);}
  $('sk-del').disabled=!m;$('sk-clear').disabled=!S.sheet.draw.length;}
$('sk-del').addEventListener('click',skDelete);
$('sk-clear').addEventListener('click',()=>{if(!S.sheet.draw.length)return;S.sheet.draw=[];skSel=null;commit();renderSketchUI();renderSheet();flash('Scratchpad cleared. Undo brings it back.');});
