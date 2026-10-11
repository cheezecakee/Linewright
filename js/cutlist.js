'use strict';
/* Linewright — cut list: board sizes and counts from preset groups (each preset's cuts(p)), merged by size and grouped by
   thickness. Shown in the Objects panel and on the sheet. */

function cutList(){const by=new Map();
  for(const g of S.groups){if(!g.preset)continue;const P=PRESETS[g.preset.type];if(!P||!P.cuts)continue;const p={...g.preset.p};P.fix(p);
    for(const c of P.cuts(p)){if(!(c.qty>0))continue;const mm=v=>Math.round(v*1000),L=Math.max(mm(c.l),mm(c.w)),W=Math.min(mm(c.l),mm(c.w)),T=mm(c.t*10)/10;
      if(!by.has(T))by.set(T,new Map());const rows=by.get(T),key=L+'x'+W;
      if(!rows.has(key))rows.set(key,{L,W,T,qty:0,parts:[]});const r=rows.get(key);r.qty+=c.qty;const nm=`${g.n}: ${c.part}`;if(!r.parts.includes(nm))r.parts.push(nm);}}
  return[...by.entries()].sort((a,b)=>b[0]-a[0]).map(([T,rows])=>{const list=[...rows.values()].sort((a,b)=>b.L-a.L||b.W-a.W);
    return{T,rows:list,area:list.reduce((s,r)=>s+r.L*r.W*r.qty,0)/1e6,count:list.reduce((s,r)=>s+r.qty,0)};});}
function cutListHTML(compact){const cl=cutList();
  if(!cl.length)return'<p class="note">No boards yet. Add a Bookshelf or Drawer unit; their boards are listed here.</p>';
  return cl.map(b=>`<div class="cut"><div class="cut-h">${fmtIn(b.T)} mm board · ${b.count} piece${b.count>1?'s':''} · ${b.area.toFixed(2)} m²</div>
    <table class="tbl"><tr><th>Qty</th><th>Length × width (mm)</th>${compact?'':'<th>Parts</th>'}</tr>
    ${b.rows.map(r=>`<tr><td class="n">${r.qty}</td><td class="n">${r.L} × ${r.W}</td>${compact?'':`<td>${esc(r.parts.join(', '))}</td>`}</tr>`).join('')}</table></div>`).join('');}
function renderCuts(){const el=$('cuts');if(el)el.innerHTML=cutListHTML(true);}
