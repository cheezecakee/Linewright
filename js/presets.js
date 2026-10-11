'use strict';
/* Linewright — object catalog.
   Each preset builds a list of parts in local space (width along x, depth along z, front face at z = depth). A part is an upright
   box, or an extruded polygon when it carries poly (footprint points normalised to the part's w × d, see SHAPES in geom.js).
   No part is tilted. To add an object: add an entry with label, category, tag, defaults, fields ([key,label,'m'|'#'] or
   [key,label,'opt',[[value,label],…]]), fix(p) to clamp params, build(p). Optional: cuts(p) returns the boards to cut
   [{part,l,w,t,qty}] in metres; wall:true places it against the back wall; y0(p) is the height it starts at (wall shelves,
   things that stand on a desk). The Add panel lists every entry automatically, grouped by category. */

const PRESETS={
  bookshelf:{label:'Bookshelf',category:'Storage',tag:'storage',
    defaults:{width:0.8,height:1.8,depth:0.3,shelves:4,thick:0.018},
    fields:[['width','Width','m'],['height','Height','m'],['depth','Depth','m'],['shelves','Shelves','#'],['thick','Board','m']],
    fix(p){p.thick=clamp(+p.thick||0.018,0.005,0.1);p.width=Math.max(+p.width||0,2*p.thick+0.02);p.height=Math.max(+p.height||0,2*p.thick+0.02);
      p.depth=Math.max(+p.depth||0,0.05);p.shelves=clamp(Math.round(+p.shelves||0),0,30);},
    build(p){const t=p.thick,W=p.width,H=p.height,D=p.depth,n=p.shelves;
      const r=[{n:'Side L',x:0,y:0,z:0,w:t,d:D,h:H},{n:'Side R',x:W-t,y:0,z:0,w:t,d:D,h:H},
        {n:'Top',x:t,y:H-t,z:0,w:W-2*t,d:D,h:t},{n:'Bottom',x:t,y:0,z:0,w:W-2*t,d:D,h:t}];
      const gap=(H-2*t-n*t)/(n+1);
      for(let i=0;i<n;i++)r.push({n:'Shelf '+(i+1),x:t,y:t+gap*(i+1)+t*i,z:0,w:W-2*t,d:D,h:t});
      return r;},
    cuts(p){const t=p.thick;return[{part:'Side',l:p.height,w:p.depth,t,qty:2},{part:'Top / bottom',l:p.width-2*t,w:p.depth,t,qty:2},
      {part:'Shelf',l:p.width-2*t,w:p.depth,t,qty:p.shelves}];}},
  drawers:{label:'Drawer unit',category:'Storage',tag:'storage',
    defaults:{width:0.4,height:0.6,depth:0.5,count:3,thick:0.018},
    fields:[['width','Width','m'],['height','Height','m'],['depth','Depth','m'],['count','Drawers','#'],['thick','Board','m']],
    fix(p){p.thick=clamp(+p.thick||0.018,0.005,0.05);p.width=Math.max(+p.width||0,2*p.thick+0.1);p.height=Math.max(+p.height||0,2*p.thick+0.05);
      p.depth=Math.max(+p.depth||0,0.1);p.count=clamp(Math.round(+p.count||1),1,12);},
    /* carcass of sides, top and bottom; drawer boxes 13 mm clear each side for runners, 6 mm back and drawer bottoms */
    cuts(p){const t=p.thick,n=p.count,fh=p.height/n,g=0.004,iw=p.width-2*t,bw=iw-0.026,bd=Math.max(0.05,p.depth-0.03),bh=Math.max(0.03,fh-2*g-0.03);
      return[{part:'Side',l:p.height,w:p.depth,t,qty:2},{part:'Top / bottom',l:iw,w:p.depth,t,qty:2},
        {part:'Drawer front',l:p.width-2*g,w:fh-2*g,t,qty:n},{part:'Drawer side',l:bd,w:bh,t:0.012,qty:2*n},
        {part:'Drawer front / back (inner)',l:bw-0.024,w:bh,t:0.012,qty:2*n},
        {part:'Drawer bottom',l:bw,w:bd,t:0.006,qty:n},{part:'Back panel',l:p.height,w:p.width,t:0.006,qty:1}];},
    build(p){const n=p.count,g=0.004,fh=p.height/n;
      const r=[{n:'Carcass',x:0,y:0,z:0,w:p.width,d:p.depth,h:p.height}];
      for(let i=0;i<n;i++)r.push({n:'Drawer '+(i+1),x:g,y:i*fh+g,z:p.depth,w:p.width-2*g,d:0,h:fh-2*g});
      return r;}},
  /* ---------- desks and tables ---------- */
  table:{label:'Desk / table',category:'Desks and tables',tag:'furniture',
    defaults:{width:1.2,depth:0.6,height:0.75,top:0.025,leg:0.05,apron:0.08,inset:0.03},
    fields:[['width','Width','m'],['depth','Depth','m'],['height','Height','m'],['top','Top','m'],['leg','Leg','m'],['apron','Apron','m'],['inset','Leg inset','m']],
    fix(p){p.top=clamp(+p.top||0.025,0.005,0.1);p.leg=clamp(+p.leg||0.05,0.015,0.2);p.inset=clamp(+p.inset||0,0,0.3);p.apron=clamp(+p.apron||0,0,0.3);
      p.width=Math.max(+p.width||0,2*(p.inset+p.leg)+0.05);p.depth=Math.max(+p.depth||0,2*(p.inset+p.leg)+0.05);p.height=Math.max(+p.height||0,p.top+p.apron+0.05);},
    build(p){const W=p.width,D=p.depth,H=p.height,t=p.top,l=p.leg,i=p.inset,a=p.apron,at=0.02,lh=H-t;
      const r=[bx('Top',0,lh,0,W,D,t)];
      for(const[nm,x,z]of[['Leg BL',i,i],['Leg BR',W-i-l,i],['Leg FL',i,D-i-l],['Leg FR',W-i-l,D-i-l]])r.push(bx(nm,x,0,z,l,l,lh));
      if(a>0){r.push(bx('Apron back',i+l,lh-a,i,W-2*(i+l),at,a),bx('Apron front',i+l,lh-a,D-i-at,W-2*(i+l),at,a),
        bx('Apron left',i,lh-a,i+l,at,D-2*(i+l),a),bx('Apron right',W-i-at,lh-a,i+l,at,D-2*(i+l),a));}
      return r;},
    cuts(p){const i=p.inset,l=p.leg,r=[{part:'Top',l:p.width,w:p.depth,t:p.top,qty:1},{part:'Leg',l:p.height-p.top,w:l,t:l,qty:4}];
      if(p.apron>0)r.push({part:'Apron (long)',l:p.width-2*(i+l),w:p.apron,t:0.02,qty:2},{part:'Apron (short)',l:p.depth-2*(i+l),w:p.apron,t:0.02,qty:2});return r;}},
  ldesk:{label:'L-desk',category:'Desks and tables',tag:'furniture',
    defaults:{width:1.6,depth:0.7,ret:1.3,retd:0.6,height:0.75,top:0.025,leg:0.05,side:'r',module:0.42},
    fields:[['width','Width','m'],['depth','Depth','m'],['ret','Return length','m'],['retd','Return width','m'],['height','Height','m'],['top','Top','m'],['leg','Leg','m'],
      ['side','Return side','opt',[['r','Right'],['l','Left']]],['module','Rolling module (0 = none)','m']],
    fix(p){p.top=clamp(+p.top||0.025,0.005,0.1);p.leg=clamp(+p.leg||0.05,0.015,0.2);p.side=p.side==='l'?'l':'r';
      p.depth=Math.max(+p.depth||0,0.3);p.retd=clamp(+p.retd||0,0.25,Math.max(0.25,(+p.width||0)-0.3));p.width=Math.max(+p.width||0,p.retd+0.3);
      p.ret=Math.max(+p.ret||0,p.depth+0.25);p.height=Math.max(+p.height||0,0.4);p.module=clamp(+p.module||0,0,Math.max(0,p.width-p.retd-0.1));},
    build(p){const W=p.width,D=p.depth,R=p.ret,rw=p.retd,H=p.height,t=p.top,l=p.leg,lh=H-t,right=p.side!=='l';
      const rx=right?W-rw:0,r=[bx('Top',0,lh,0,W,D,t),bx('Return top',rx,lh,D,rw,R-D,t)];
      const legs=right?[[0,0],[0,D-l],[W-l,0],[W-l,R-l],[W-rw,R-l]]:[[W-l,0],[W-l,D-l],[0,0],[0,R-l],[rw-l,R-l]];
      legs.forEach(([x,z],k)=>r.push(bx('Leg '+(k+1),x,0,z,l,l,lh)));
      r.push(bx('Modesty panel',l,lh-0.35,0.01,W-2*l,0.016,0.3));
      if(p.module>0){const mw=p.module,md=Math.min(0.52,D-0.08),mh=Math.min(0.62,lh-0.06),ch=0.06,mx=right?W-rw-mw-0.04:rw+0.04,mz=0.05;
        r.push(bx('Module',mx,ch,mz,mw,md,mh-ch));const fh=(mh-ch)/3;
        for(let k=0;k<3;k++)r.push(bx('Module drawer '+(k+1),mx+0.004,ch+k*fh+0.004,mz+md,mw-0.008,0,fh-0.008));
        for(const[k,cx,cz]of[[1,mx+0.02,mz+0.02],[2,mx+mw-0.06,mz+0.02],[3,mx+0.02,mz+md-0.06],[4,mx+mw-0.06,mz+md-0.06]])r.push({...bx('Caster '+k,cx,0,cz,0.04,0.04,ch),poly:SHAPES.round.pts()});}
      return r;},
    cuts(p){return[{part:'Top',l:p.width,w:p.depth,t:p.top,qty:1},{part:'Return top',l:p.ret-p.depth,w:p.retd,t:p.top,qty:1},{part:'Modesty panel',l:p.width-2*p.leg,w:0.3,t:0.016,qty:1}];}},
  roundtable:{label:'Round table',category:'Desks and tables',tag:'furniture',
    defaults:{diameter:0.8,height:0.74,top:0.025,column:0.08,base:0.5},
    fields:[['diameter','Diameter','m'],['height','Height','m'],['top','Top','m'],['column','Column','m'],['base','Base','m']],
    fix(p){p.diameter=Math.max(+p.diameter||0,0.2);p.top=clamp(+p.top||0.025,0.005,0.1);p.column=clamp(+p.column||0.08,0.02,p.diameter);p.base=clamp(+p.base||0.5,p.column,p.diameter);p.height=Math.max(+p.height||0,p.top+0.1);},
    build(p){const Dm=p.diameter,c=Dm/2,R=SHAPES.round.pts(),bh=0.03;
      return[{...bx('Top',0,p.height-p.top,0,Dm,Dm,p.top),poly:R},{...bx('Column',c-p.column/2,bh,c-p.column/2,p.column,p.column,p.height-p.top-bh),poly:R},
        {...bx('Base',c-p.base/2,0,c-p.base/2,p.base,p.base,bh),poly:R}];},
    cuts(p){return[{part:'Round top (Ø)',l:p.diameter,w:p.diameter,t:p.top,qty:1}];}},
  /* ---------- storage ---------- */
  cubes:{label:'Cube shelf',category:'Storage',tag:'storage',
    defaults:{width:0.77,height:0.77,depth:0.39,cols:2,rows:2,thick:0.015},
    fields:[['width','Width','m'],['height','Height','m'],['depth','Depth','m'],['cols','Columns','#'],['rows','Rows','#'],['thick','Board','m']],
    fix(p){p.thick=clamp(+p.thick||0.015,0.005,0.06);p.cols=clamp(Math.round(+p.cols||1),1,12);p.rows=clamp(Math.round(+p.rows||1),1,12);
      p.width=Math.max(+p.width||0,(p.cols+1)*p.thick+0.05*p.cols);p.height=Math.max(+p.height||0,(p.rows+1)*p.thick+0.05*p.rows);p.depth=Math.max(+p.depth||0,0.1);},
    build(p){const t=p.thick,W=p.width,H=p.height,D=p.depth,C=p.cols,R=p.rows,cw=(W-(C+1)*t)/C,ch=(H-(R+1)*t)/R;
      const r=[bx('Side L',0,0,0,t,D,H),bx('Side R',W-t,0,0,t,D,H),bx('Top',t,H-t,0,W-2*t,D,t),bx('Bottom',t,0,0,W-2*t,D,t)];
      for(let j=1;j<R;j++)r.push(bx('Shelf '+j,t,j*(ch+t),0,W-2*t,D,t));
      for(let i=1;i<C;i++)for(let j=0;j<R;j++)r.push(bx(`Divider ${i}.${j+1}`,i*(cw+t),t+j*(ch+t),0,t,D,ch));
      return r;},
    cuts(p){const t=p.thick,ch=(p.height-(p.rows+1)*t)/p.rows;return[{part:'Side',l:p.height,w:p.depth,t,qty:2},{part:'Top / bottom',l:p.width-2*t,w:p.depth,t,qty:2},
      {part:'Shelf',l:p.width-2*t,w:p.depth,t,qty:p.rows-1},{part:'Divider',l:ch,w:p.depth,t,qty:(p.cols-1)*p.rows}];}},
  wallshelf:{label:'Wall shelf',category:'Storage',tag:'storage',wall:true,y0:()=>1.25,
    defaults:{width:0.8,depth:0.2,thick:0.018,brackets:2,bracket:0.15},
    fields:[['width','Width','m'],['depth','Depth','m'],['thick','Board','m'],['brackets','Brackets','#'],['bracket','Bracket height','m']],
    fix(p){p.thick=clamp(+p.thick||0.018,0.005,0.06);p.brackets=clamp(Math.round(+p.brackets||2),0,8);p.width=Math.max(+p.width||0,0.1);p.depth=Math.max(+p.depth||0,0.05);p.bracket=clamp(+p.bracket||0.15,0.03,0.6);},
    build(p){const W=p.width,D=p.depth,t=p.thick,bh=p.bracket,n=p.brackets,bw=0.025,arm=Math.max(0.03,D*0.85),r=[bx('Board',0,bh,0,W,D,t)];
      for(let k=0;k<n;k++){const x=n===1?W/2-bw/2:0.08+k*(W-0.16-bw)/(n-1);r.push(bx(`Bracket ${k+1}`,x,0,0,bw,0.02,bh),bx(`Bracket ${k+1} arm`,x,bh-0.02,0.02,bw,arm-0.02,0.02));}
      return r;},
    cuts(p){return[{part:'Shelf board',l:p.width,w:p.depth,t:p.thick,qty:1}];}},
  wallcab:{label:'Wall cabinet',category:'Storage',tag:'storage',wall:true,y0:()=>1.45,
    defaults:{width:0.6,height:0.7,depth:0.32,doors:2,shelves:1,thick:0.018},
    fields:[['width','Width','m'],['height','Height','m'],['depth','Depth','m'],['doors','Doors','#'],['shelves','Shelves','#'],['thick','Board','m']],
    fix(p){p.thick=clamp(+p.thick||0.018,0.005,0.05);p.doors=clamp(Math.round(+p.doors||1),1,6);p.shelves=clamp(Math.round(+p.shelves||0),0,8);
      p.width=Math.max(+p.width||0,2*p.thick+0.1);p.height=Math.max(+p.height||0,2*p.thick+0.1);p.depth=Math.max(+p.depth||0,0.1);},
    build(p){const W=p.width,H=p.height,D=p.depth,n=p.doors,g=0.003,dw=W/n,r=[bx('Carcass',0,0,0,W,D,H)];
      for(let k=0;k<n;k++){r.push(bx('Door '+(k+1),k*dw+g,g,D,dw-2*g,0,H-2*g));const hx=n>1&&k%2===0?(k+1)*dw-0.04:k*dw+0.03;r.push(bx('Handle '+(k+1),hx,0.04,D,0.01,0,0.1));}
      return r;},
    cuts(p){const t=p.thick,n=p.doors;return[{part:'Side',l:p.height,w:p.depth,t,qty:2},{part:'Top / bottom',l:p.width-2*t,w:p.depth,t,qty:2},
      {part:'Shelf',l:p.width-2*t,w:p.depth-0.02,t,qty:p.shelves},{part:'Door',l:p.height-0.006,w:p.width/n-0.006,t,qty:n},{part:'Back panel',l:p.height,w:p.width,t:0.006,qty:1}];}},
  cornerrect:{label:'Corner shelf (rect)',category:'Storage',tag:'storage',
    defaults:{width:0.6,depth:0.6,height:1.6,shelves:4,thick:0.018},
    fields:[['width','Width','m'],['depth','Depth','m'],['height','Height','m'],['shelves','Shelves','#'],['thick','Board','m']],
    fix(p){p.thick=clamp(+p.thick||0.018,0.005,0.05);p.shelves=clamp(Math.round(+p.shelves||2),2,20);p.width=Math.max(+p.width||0,p.thick+0.1);p.depth=Math.max(+p.depth||0,p.thick+0.1);p.height=Math.max(+p.height||0,p.shelves*p.thick+0.1);},
    /* two panels against the walls of a corner (back along x, side along z) and square shelves between them */
    build(p){const t=p.thick,W=p.width,D=p.depth,H=p.height,n=p.shelves,r=[bx('Back panel',0,0,0,W,t,H),bx('Side panel',0,0,t,t,D-t,H)];
      for(let k=0;k<n;k++)r.push(bx('Shelf '+(k+1),t,k*(H-t)/(n-1),t,W-t,D-t,t));return r;},
    cuts(p){const t=p.thick;return[{part:'Back panel',l:p.height,w:p.width,t,qty:1},{part:'Side panel',l:p.height,w:p.depth-t,t,qty:1},{part:'Shelf',l:p.width-t,w:p.depth-t,t,qty:p.shelves}];}},
  cornerpoly:{label:'Corner shelf (shaped)',category:'Storage',tag:'storage',
    defaults:{size:0.45,height:1.6,shelves:4,thick:0.018,shape:'quarter'},
    fields:[['size','Size along walls','m'],['height','Height','m'],['shelves','Shelves','#'],['thick','Board','m'],['shape','Shape','opt',[['tri','Triangle'],['quarter','Quarter round']]]],
    fix(p){p.thick=clamp(+p.thick||0.018,0.005,0.05);p.shelves=clamp(Math.round(+p.shelves||2),2,20);p.size=Math.max(+p.size||0,p.thick+0.1);p.height=Math.max(+p.height||0,p.shelves*p.thick+0.1);p.shape=p.shape==='tri'?'tri':'quarter';},
    build(p){const t=p.thick,Sz=p.size,H=p.height,n=p.shelves,P=SHAPES[p.shape].pts(),r=[bx('Back strip',0,0,0,Sz,t,H),bx('Side strip',0,0,t,t,Sz-t,H)];
      for(let k=0;k<n;k++)r.push({...bx('Shelf '+(k+1),t,k*(H-t)/(n-1),t,Sz-t,Sz-t,t),poly:P});return r;},
    cuts(p){const t=p.thick;return[{part:(p.shape==='tri'?'Triangle':'Quarter-round')+' shelf',l:p.size-t,w:p.size-t,t,qty:p.shelves},{part:'Back strip',l:p.height,w:p.size,t,qty:1},{part:'Side strip',l:p.height,w:p.size-t,t,qty:1}];}},
  stool:{label:'Storage stool',category:'Storage',tag:'storage',
    defaults:{size:0.4,height:0.45,lid:0.05,shape:'square'},
    fields:[['size','Size','m'],['height','Height','m'],['lid','Lid','m'],['shape','Shape','opt',[['square','Square'],['round','Round']]]],
    fix(p){p.size=Math.max(+p.size||0,0.15);p.lid=clamp(+p.lid||0.05,0.01,0.2);p.height=Math.max(+p.height||0,p.lid+0.05);p.shape=p.shape==='round'?'round':'square';},
    build(p){const s=p.size,i=0.01,P=p.shape==='round'?SHAPES.round.pts():null,o=e=>P?{...e,poly:P}:e;
      return[o(bx('Body',i,0,i,s-2*i,s-2*i,p.height-p.lid)),o(bx('Lid',0,p.height-p.lid,0,s,s,p.lid))];}},
  cart:{label:'Rolling cart',category:'Storage',tag:'storage',
    defaults:{width:0.45,depth:0.35,height:0.78,tiers:3,tray:0.07,caster:0.07},
    fields:[['width','Width','m'],['depth','Depth','m'],['height','Height','m'],['tiers','Tiers','#'],['tray','Tray depth','m'],['caster','Caster height','m']],
    fix(p){p.tiers=clamp(Math.round(+p.tiers||1),1,8);p.tray=clamp(+p.tray||0.07,0.01,0.3);p.caster=clamp(+p.caster||0,0,0.2);p.width=Math.max(+p.width||0,0.15);p.depth=Math.max(+p.depth||0,0.15);
      p.height=Math.max(+p.height||0,p.caster+p.tiers*p.tray+0.05);},
    build(p){const W=p.width,D=p.depth,H=p.height,n=p.tiers,c=p.caster,tr=p.tray,po=0.02,r=[];
      for(const[k,x,z]of[[1,0,0],[2,W-po,0],[3,0,D-po],[4,W-po,D-po]]){r.push(bx('Post '+k,x,c,z,po,po,H-c),{...bx('Caster '+k,x-0.01,0,z-0.01,0.04,0.04,c),poly:SHAPES.round.pts()});}
      for(let k=0;k<n;k++){const y=c+0.03+k*(H-c-0.03-tr)/Math.max(1,n-1);r.push(bx('Tier '+(k+1),po,n===1?c+0.03:y,po,W-2*po,D-2*po,tr));}
      return r;}},
  /* ---------- electronics ---------- */
  monitor:{label:'Monitor on arm',category:'Electronics',tag:'electronics',y0:()=>0.75,
    defaults:{screenw:0.61,screenh:0.36,thick:0.05,centre:0.38,reach:0.3},
    fields:[['screenw','Screen width','m'],['screenh','Screen height','m'],['thick','Screen depth','m'],['centre','Centre above desk','m'],['reach','Arm reach','m']],
    fix(p){p.screenw=Math.max(+p.screenw||0,0.15);p.screenh=Math.max(+p.screenh||0,0.1);p.thick=clamp(+p.thick||0.05,0.005,0.2);p.centre=Math.max(+p.centre||0,p.screenh/2+0.02);p.reach=Math.max(+p.reach||0,0.08);},
    /* clamp at the desk's back edge, pole, horizontal arm, VESA plate, screen facing +z */
    build(p){const c=p.screenw/2,y=p.centre,R=p.reach;
      return[bx('Clamp',c-0.04,0,0,0.08,0.08,0.05),{...bx('Pole',c-0.017,0.05,0.023,0.034,0.034,y+0.04),poly:SHAPES.round.pts()},bx('Arm',c-0.02,y-0.02,0.04,0.04,R-0.04,0.04),
        bx('VESA plate',c-0.05,y-0.05,R,0.1,0.012,0.1),bx('Screen',0,y-p.screenh/2,R+0.012,p.screenw,p.thick,p.screenh)];}},
  pc:{label:'PC tower',category:'Electronics',tag:'electronics',
    defaults:{width:0.21,height:0.46,depth:0.45},
    fields:[['width','Width','m'],['height','Height','m'],['depth','Depth','m']],
    fix(p){p.width=Math.max(+p.width||0,0.08);p.height=Math.max(+p.height||0,0.15);p.depth=Math.max(+p.depth||0,0.15);},
    build(p){const W=p.width,H=p.height,D=p.depth,f=0.02,r=[bx('Case',0,f,0,W,D,H-f)];
      for(const[k,x,z]of[[1,0.01,0.01],[2,W-0.04,0.01],[3,0.01,D-0.04],[4,W-0.04,D-0.04]])r.push(bx('Foot '+k,x,0,z,0.03,0.03,f));
      r.push(bx('Front panel',0.015,f+0.03,D,W-0.03,0,H-f-0.06),bx('Power button',W/2-0.01,H-0.05,D,0.02,0,0.02));return r;}},
  tray:{label:'Cable tray',category:'Electronics',tag:'electrical',y0:()=>0.6,
    defaults:{length:0.8,width:0.12,height:0.1},
    fields:[['length','Length','m'],['width','Width','m'],['height','Height','m']],
    fix(p){p.length=Math.max(+p.length||0,0.1);p.width=Math.max(+p.width||0,0.03);p.height=Math.max(+p.height||0,0.02);},
    build(p){const L=p.length,W=p.width,H=p.height,t=0.003;return[bx('Bottom',0,0,0,L,W,t),bx('Side back',0,0,0,L,t,H),bx('Side front',0,0,W-t,L,t,H)];}},
  esd:{label:'ESD mat',category:'Electronics',tag:'electronics',y0:()=>0.75,
    defaults:{width:0.6,depth:0.5,thick:0.003},
    fields:[['width','Width','m'],['depth','Depth','m'],['thick','Thickness','m']],
    fix(p){p.width=Math.max(+p.width||0,0.1);p.depth=Math.max(+p.depth||0,0.1);p.thick=clamp(+p.thick||0.003,0.001,0.02);},
    build(p){return[bx('Mat',0,0,0,p.width,p.depth,p.thick),{...bx('Ground snap',0.02,p.thick,0.02,0.015,0.015,0.006),poly:SHAPES.round.pts()}];}},
  /* ---------- seating and lighting ---------- */
  chair:{label:'Office chair',category:'Seating and lighting',tag:'furniture',
    defaults:{base:0.66,seatw:0.5,seatd:0.47,seath:0.47,back:0.52},
    fields:[['base','Base Ø','m'],['seatw','Seat width','m'],['seatd','Seat depth','m'],['seath','Seat height','m'],['back','Back height','m']],
    fix(p){p.base=Math.max(+p.base||0,0.3);p.seatw=Math.max(+p.seatw||0,0.25);p.seatd=Math.max(+p.seatd||0,0.25);p.seath=Math.max(+p.seath||0,0.25);p.back=clamp(+p.back||0,0,1.2);},
    build(p){const B=p.base,W=Math.max(B,p.seatw),D=Math.max(B,p.seatd),cx=W/2,cz=D/2,R=SHAPES.round.pts(),r=[];
      r.push({...bx('Base',cx-B/2,0.05,cz-B/2,B,B,0.04),poly:SHAPES.star5.pts()});
      for(let k=0;k<5;k++){const a=-Math.PI/2+k*2*Math.PI/5,x=cx+Math.cos(a)*(B/2-0.03),z=cz+Math.sin(a)*(B/2-0.03);r.push({...bx('Caster '+(k+1),x-0.025,0,z-0.025,0.05,0.05,0.05),poly:R});}
      r.push({...bx('Column',cx-0.03,0.09,cz-0.03,0.06,0.06,Math.max(0.02,p.seath-0.16)),poly:R});
      r.push(bx('Seat',cx-p.seatw/2,p.seath-0.07,cz-p.seatd/2,p.seatw,p.seatd,0.07));
      if(p.back>0)r.push(bx('Back',cx-p.seatw/2+0.02,p.seath+0.04,cz-p.seatd/2-0.02,p.seatw-0.04,0.05,p.back));
      return r;}},
  lamp:{label:'Floor lamp',category:'Seating and lighting',tag:'electrical',
    defaults:{height:1.6,base:0.28,shade:0.4,shadeh:0.3},
    fields:[['height','Height','m'],['base','Base Ø','m'],['shade','Shade Ø','m'],['shadeh','Shade height','m']],
    fix(p){p.base=Math.max(+p.base||0,0.08);p.shade=Math.max(+p.shade||0,0.08);p.shadeh=clamp(+p.shadeh||0.3,0.05,1);p.height=Math.max(+p.height||0,p.shadeh+0.2);},
    build(p){const W=Math.max(p.base,p.shade),c=W/2,R=SHAPES.round.pts();
      return[{...bx('Base',c-p.base/2,0,c-p.base/2,p.base,p.base,0.03),poly:R},{...bx('Pole',c-0.0125,0.03,c-0.0125,0.025,0.025,p.height-p.shadeh-0.03),poly:R},
        {...bx('Shade',c-p.shade/2,p.height-p.shadeh,c-p.shade/2,p.shade,p.shade,p.shadeh),poly:R}];}}
};
/* part helper: name, min corner, then width (x), depth (z), height (y) */
function bx(n,x,y,z,w,d,h){return{n,x,y,z,w:Math.max(0,w),d:Math.max(0,d),h:Math.max(0,h)};}
