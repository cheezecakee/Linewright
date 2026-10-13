'use strict';
/* Linewright — object catalog.
   Each preset builds a list of parts in local space (width along x, depth along z, front face at z = depth). A part is an upright
   box, or an extruded polygon when it carries poly (footprint points normalised to the part's w × d, see SHAPES in geom.js).
   No part is tilted. To add an object: add an entry with label, category, tag, defaults, fields ([key,label,'m'|'#'] or
   [key,label,'opt',[[value,label],…]]), fix(p) to clamp params, build(p). Optional: cuts(p) returns the boards to cut
   [{part,l,w,t,qty}] in metres; wall:true places it against the back wall; y0(p) is the height it starts at (wall shelves,
   things that stand on a desk). The Add panel lists every entry automatically (category filter and search). */

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
        {...bx('Shade',c-p.shade/2,p.height-p.shadeh,c-p.shade/2,p.shade,p.shade,p.shadeh),poly:R}];}},
  /* ---------- base catalog: seating ---------- */
  sofa:{label:'Sofa',category:'Seating and lighting',tag:'furniture',
    defaults:{width:1.9,depth:0.9,height:0.85,seath:0.45,arm:0.15,seats:2,chaise:0,cside:'r'},
    fields:[['width','Width','m'],['depth','Depth','m'],['height','Height','m'],['seath','Seat height','m'],['arm','Arm width','m'],['seats','Seats','#']],
    fix(p){sofaFix(p);},build(p){return sofaParts(p,0);}},
  lsofa:{label:'L-sofa',category:'Seating and lighting',tag:'furniture',
    defaults:{width:2.4,depth:0.9,height:0.85,seath:0.45,arm:0.15,seats:3,chaise:1.6,cside:'r'},
    fields:[['width','Width','m'],['depth','Depth','m'],['height','Height','m'],['seath','Seat height','m'],['arm','Arm width','m'],['seats','Seats','#'],['chaise','Chaise length','m'],['cside','Chaise side','opt',[['r','Right'],['l','Left']]]],
    fix(p){sofaFix(p);p.chaise=Math.max(+p.chaise||0,p.depth+0.3);},build(p){return sofaParts(p,p.chaise);}},
  armchair:{label:'Armchair',category:'Seating and lighting',tag:'furniture',
    defaults:{width:0.85,depth:0.85,height:0.85,seath:0.45,arm:0.15,seats:1,chaise:0,cside:'r'},
    fields:[['width','Width','m'],['depth','Depth','m'],['height','Height','m'],['seath','Seat height','m'],['arm','Arm width','m']],
    fix(p){sofaFix(p);p.seats=1;},build(p){return sofaParts(p,0);}},
  dchair:{label:'Dining chair',category:'Seating and lighting',tag:'furniture',
    defaults:{width:0.42,depth:0.45,seath:0.46,height:0.9},
    fields:[['width','Width','m'],['depth','Depth','m'],['seath','Seat height','m'],['height','Overall height','m']],
    fix(p){p.width=Math.max(+p.width||0,0.25);p.depth=Math.max(+p.depth||0,0.25);p.seath=clamp(+p.seath||0.46,0.25,0.7);p.height=Math.max(+p.height||0,p.seath+0.2);},
    build(p){const W=p.width,D=p.depth,s=p.seath,l=0.035,r=[bx('Seat',0,s-0.04,0,W,D,0.04)];
      for(const[k,x,z]of[[1,0,0],[2,W-l,0],[3,0,D-l],[4,W-l,D-l]])r.push(bx('Leg '+k,x,0,z,l,l,s-0.04));
      r.push(bx('Back post L',0,s,0,l,0.03,p.height-s),bx('Back post R',W-l,s,0,l,0.03,p.height-s),bx('Back rail',l,p.height-0.15,0,W-2*l,0.03,0.12),bx('Back rail low',l,s+0.08,0,W-2*l,0.03,0.08));
      return r;}},
  barstool:{label:'Bar stool',category:'Seating and lighting',tag:'furniture',
    defaults:{diameter:0.36,height:0.66},
    fields:[['diameter','Seat Ø','m'],['height','Seat height','m']],
    fix(p){p.diameter=Math.max(+p.diameter||0,0.2);p.height=Math.max(+p.height||0,0.3);},
    build(p){const d=p.diameter,c=d/2,b=Math.max(0.3,d*0.9),W=Math.max(d,b),o=(W-d)/2;
      return[roundOf(bx('Seat',o,p.height-0.05,o,d,d,0.05)),roundOf(bx('Column',W/2-0.025,0.04,W/2-0.025,0.05,0.05,p.height-0.09)),roundOf(bx('Base',(W-b)/2,0,(W-b)/2,b,b,0.04)),
        roundOf(bx('Foot ring',(W-0.26)/2,p.height*0.35,(W-0.26)/2,0.26,0.26,0.02))];}},
  /* ---------- bedroom ---------- */
  bed:{label:'Bed',category:'Bedroom',tag:'furniture',
    defaults:{width:1.4,length:2.0,mattress:0.5,head:1.0,foot:'no'},
    fields:[['width','Width','m'],['length','Length','m'],['mattress','Mattress top','m'],['head','Headboard height','m'],['foot','Footboard','opt',[['no','None'],['yes','Low footboard']]]],
    fix(p){p.width=Math.max(+p.width||0,0.6);p.length=Math.max(+p.length||0,1.2);p.mattress=clamp(+p.mattress||0.5,0.3,0.9);p.head=Math.max(+p.head||0,p.mattress+0.1);p.foot=p.foot==='yes'?'yes':'no';},
    build(p){const W=p.width,L=p.length,m=p.mattress,r=[bx('Headboard',0,0.1,0,W,0.06,p.head-0.1),bx('Frame',0,0.1,0.06,W,L-0.06,0.18),bx('Mattress',0.02,0.28,0.08,W-0.04,L-0.1,m-0.28)];
      for(const[k,x,z]of[[1,0,0],[2,W-0.06,0],[3,0,L-0.06],[4,W-0.06,L-0.06]])r.push(bx('Leg '+k,x,0,z,0.06,0.06,0.1));
      if(p.foot==='yes')r.push(bx('Footboard',0,0.1,L-0.05,W,0.05,0.4));return r;}},
  bunk:{label:'Bunk bed',category:'Bedroom',tag:'furniture',
    defaults:{width:0.9,length:2.0,height:1.7},
    fields:[['width','Width','m'],['length','Length','m'],['height','Overall height','m']],
    fix(p){p.width=Math.max(+p.width||0,0.6);p.length=Math.max(+p.length||0,1.4);p.height=Math.max(+p.height||0,1.4);},
    build(p){const W=p.width,L=p.length,H=p.height,t=0.06,r=[];
      for(const[k,x,z]of[[1,0,0],[2,W-t,0],[3,0,L-t],[4,W-t,L-t]])r.push(bx('Post '+k,x,0,z,t,t,H));
      r.push(bx('Lower deck',t,0.3,t,W-2*t,L-2*t,0.15),bx('Upper deck',t,H-0.75,t,W-2*t,L-2*t,0.15),bx('Guard left',0,H-0.5,t,0.02,L-2*t,0.4),bx('Guard right',W-0.02,H-0.5,t,0.02,L-2*t,0.4));
      for(let k=0;k<4;k++)r.push(bx('Rung '+(k+1),t,0.25+k*0.28,L-0.03,W-2*t,0.03,0.03));return r;}},
  nightstand:{label:'Nightstand',category:'Bedroom',tag:'furniture',
    defaults:{width:0.42,depth:0.4,height:0.52,drawers:1},
    fields:[['width','Width','m'],['depth','Depth','m'],['height','Height','m'],['drawers','Drawers','#']],
    fix(p){p.width=Math.max(+p.width||0,0.2);p.depth=Math.max(+p.depth||0,0.2);p.height=Math.max(+p.height||0,0.3);p.drawers=clamp(Math.round(+p.drawers||1),1,4);},
    build(p){const W=p.width,D=p.depth,H=p.height,n=p.drawers,lh=0.12,bh=H-lh-0.02,fh=bh/n,r=[bx('Body',0,lh,0,W,D,bh),bx('Top',0,H-0.02,0,W,D,0.02)];
      for(const[k,x,z]of[[1,0.02,0.02],[2,W-0.05,0.02],[3,0.02,D-0.05],[4,W-0.05,D-0.05]])r.push(bx('Leg '+k,x,0,z,0.03,0.03,lh));
      for(let k=0;k<n;k++)r.push(bx('Drawer '+(k+1),0.01,lh+k*fh+0.005,D,W-0.02,0,fh-0.01));return r;}},
  /* ---------- storage additions ---------- */
  wardrobe:{label:'Wardrobe',category:'Storage',tag:'storage',
    defaults:{width:1.0,height:2.0,depth:0.58,doors:2,style:'hinged'},
    fields:[['width','Width','m'],['height','Height','m'],['depth','Depth','m'],['doors','Doors','#'],['style','Doors','opt',[['hinged','Hinged'],['sliding','Sliding']]]],
    fix(p){p.doors=clamp(Math.round(+p.doors||2),1,6);p.style=p.style==='sliding'?'sliding':'hinged';p.width=Math.max(+p.width||0,0.4);p.height=Math.max(+p.height||0,0.8);p.depth=Math.max(+p.depth||0,0.3);},
    build(p){const W=p.width,H=p.height,D=p.depth,n=p.doors,pl=0.08,g=0.003,sl=p.style==='sliding',dw=W/n,r=[bx('Plinth',0.02,0,0.02,W-0.04,D-0.04,pl),bx('Carcass',0,pl,0,W,D-(sl?0.03:0),H-pl)];
      for(let k=0;k<n;k++){let x,w,z,hx;
        if(sl){w=Math.min(W,dw+0.04);x=clamp(k*dw-0.02,0,W-w);z=D-(k%2?0:0.03);hx=x+w/2-0.005;}
        else{w=dw-2*g;x=k*dw+g;z=D;hx=k%2===0?(k+1)*dw-0.05:k*dw+0.04;}
        r.push(bx('Door '+(k+1),x,pl+g,z,w,0,H-pl-2*g),bx('Handle '+(k+1),hx,H*0.5,z,0.01,0,0.14));}
      return r;}},
  dresser:{label:'Chest of drawers',category:'Storage',tag:'storage',
    defaults:{width:0.8,height:0.85,depth:0.45,rows:4,cols:1},
    fields:[['width','Width','m'],['height','Height','m'],['depth','Depth','m'],['rows','Drawers high','#'],['cols','Drawers wide','#']],
    fix(p){p.rows=clamp(Math.round(+p.rows||1),1,8);p.cols=clamp(Math.round(+p.cols||1),1,4);p.width=Math.max(+p.width||0,0.3);p.height=Math.max(+p.height||0,0.4);p.depth=Math.max(+p.depth||0,0.25);},
    build(p){const W=p.width,H=p.height,D=p.depth,lh=0.1,bh=H-lh-0.025,fw=(W-0.02)/p.cols,fh=bh/p.rows,r=[bx('Body',0.01,lh,0.01,W-0.02,D-0.02,bh),bx('Top',0,H-0.025,0,W,D,0.025)];
      for(const[k,x,z]of[[1,0.02,0.02],[2,W-0.06,0.02],[3,0.02,D-0.06],[4,W-0.06,D-0.06]])r.push(bx('Leg '+k,x,0,z,0.04,0.04,lh));
      for(let j=0;j<p.rows;j++)for(let i=0;i<p.cols;i++)r.push(bx(`Drawer ${j+1}.${i+1}`,0.01+i*fw+0.004,lh+j*fh+0.004,D,fw-0.008,0,fh-0.008));return r;}},
  tvunit:{label:'TV unit',category:'Storage',tag:'furniture',
    defaults:{width:1.5,height:0.5,depth:0.4,doors:2},
    fields:[['width','Width','m'],['height','Height','m'],['depth','Depth','m'],['doors','Doors','#']],
    fix(p){p.doors=clamp(Math.round(+p.doors||0),0,6);p.width=Math.max(+p.width||0,0.4);p.height=Math.max(+p.height||0,0.25);p.depth=Math.max(+p.depth||0,0.2);},
    build(p){const W=p.width,H=p.height,D=p.depth,lh=0.1,n=p.doors,r=[bx('Carcass',0,lh,0,W,D,H-lh)];
      for(const[k,x,z]of[[1,0.04,0.04],[2,W-0.08,0.04],[3,0.04,D-0.08],[4,W-0.08,D-0.08]])r.push(bx('Leg '+k,x,0,z,0.04,0.04,lh));
      for(let k=0;k<n;k++){const dw=W/n;r.push(bx('Door '+(k+1),k*dw+0.004,lh+0.004,D,dw-0.008,0,H-lh-0.008));}return r;}},
  shoerack:{label:'Shoe rack',category:'Storage',tag:'storage',
    defaults:{width:0.8,height:0.6,depth:0.3,tiers:3},
    fields:[['width','Width','m'],['height','Height','m'],['depth','Depth','m'],['tiers','Tiers','#']],
    fix(p){p.tiers=clamp(Math.round(+p.tiers||2),1,8);p.width=Math.max(+p.width||0,0.3);p.height=Math.max(+p.height||0,0.2);p.depth=Math.max(+p.depth||0,0.15);},
    build(p){const W=p.width,H=p.height,D=p.depth,t=0.015,n=p.tiers,r=[bx('Side L',0,0,0,t,D,H),bx('Side R',W-t,0,0,t,D,H)];
      for(let k=0;k<n;k++)r.push(bx('Tier '+(k+1),t,0.05+k*(H-0.05-t)/Math.max(1,n-1),0,W-2*t,D,t));return r;}},
  coatrack:{label:'Coat rack (wall)',category:'Storage',tag:'furniture',wall:true,y0:()=>1.6,
    defaults:{width:0.8,hooks:4},
    fields:[['width','Width','m'],['hooks','Hooks','#']],
    fix(p){p.width=Math.max(+p.width||0,0.2);p.hooks=clamp(Math.round(+p.hooks||1),1,12);},
    build(p){const r=[bx('Rail',0,0,0,p.width,0.02,0.1)],n=p.hooks;
      for(let k=0;k<n;k++)r.push(bx('Hook '+(k+1),n===1?p.width/2-0.01:0.06+k*(p.width-0.12-0.02)/(n-1),0.04,0.02,0.02,0.07,0.02));return r;}},
  bench:{label:'Bench',category:'Storage',tag:'furniture',
    defaults:{width:1.0,depth:0.35,height:0.45},
    fields:[['width','Width','m'],['depth','Depth','m'],['height','Height','m']],
    fix(p){p.width=Math.max(+p.width||0,0.3);p.depth=Math.max(+p.depth||0,0.2);p.height=Math.max(+p.height||0,0.2);},
    build(p){const W=p.width,D=p.depth,H=p.height,t=0.04,l=0.05,r=[bx('Seat',0,H-t,0,W,D,t)];
      for(const[k,x,z]of[[1,0.04,0.04],[2,W-0.04-l,0.04],[3,0.04,D-0.04-l],[4,W-0.04-l,D-0.04-l]])r.push(bx('Leg '+k,x,0,z,l,l,H-t));
      r.push(bx('Stretcher',0.04+l,0.12,D/2-0.01,W-0.08-2*l,0.02,0.04));return r;}},
  /* ---------- work ---------- */
  standing:{label:'Standing desk',category:'Desks and tables',tag:'furniture',
    defaults:{width:1.4,depth:0.7,height:1.0,top:0.03},
    fields:[['width','Width','m'],['depth','Depth','m'],['height','Height (0.65–1.30)','m'],['top','Top','m']],
    fix(p){p.top=clamp(+p.top||0.03,0.01,0.08);p.width=Math.max(+p.width||0,0.6);p.depth=Math.max(+p.depth||0,0.4);p.height=clamp(+p.height||1,0.6,1.3);},
    build(p){const W=p.width,D=p.depth,H=p.height,t=p.top,lh=H-t,r=[bx('Top',0,lh,0,W,D,t)];
      for(const[k,x]of[[1,0.08],[2,W-0.14]]){r.push(bx('Foot '+k,x,0,0.05,0.06,D-0.1,0.04),bx('Column '+k,x,0.04,D/2-0.035,0.06,0.07,lh-0.04-0.04));}
      r.push(bx('Crossbar',0.14,lh-0.1,D/2-0.02,W-0.28,0.04,0.06));return r;}},
  riser:{label:'Monitor riser',category:'Desks and tables',tag:'furniture',y0:()=>0.75,
    defaults:{width:0.6,depth:0.22,height:0.1},
    fields:[['width','Width','m'],['depth','Depth','m'],['height','Height','m']],
    fix(p){p.width=Math.max(+p.width||0,0.2);p.depth=Math.max(+p.depth||0,0.1);p.height=Math.max(+p.height||0,0.04);},
    build(p){const t=0.02;return[bx('Top',0,p.height-t,0,p.width,p.depth,t),bx('Leg L',0.02,0,0,0.02,p.depth,p.height-t),bx('Leg R',p.width-0.04,0,0,0.02,p.depth,p.height-t)];}},
  kbtray:{label:'Keyboard tray',category:'Desks and tables',tag:'furniture',y0:()=>0.62,
    defaults:{width:0.65,depth:0.3},
    fields:[['width','Width','m'],['depth','Depth','m']],
    fix(p){p.width=Math.max(+p.width||0,0.3);p.depth=Math.max(+p.depth||0,0.15);},
    build(p){return[bx('Tray',0,0,0,p.width,p.depth,0.02),bx('Rail L',0.05,0.02,0,0.02,p.depth,0.03),bx('Rail R',p.width-0.07,0.02,0,0.02,p.depth,0.03)];}},
  workbench:{label:'Workbench',category:'Desks and tables',tag:'furniture',
    defaults:{width:1.5,depth:0.6,height:0.9,peg:0.9},
    fields:[['width','Width','m'],['depth','Depth','m'],['height','Height','m'],['peg','Pegboard height (0 = none)','m']],
    fix(p){p.width=Math.max(+p.width||0,0.6);p.depth=Math.max(+p.depth||0,0.3);p.height=Math.max(+p.height||0,0.5);p.peg=clamp(+p.peg||0,0,1.5);},
    build(p){const W=p.width,D=p.depth,H=p.height,t=0.04,l=0.07,r=[bx('Top',0,H-t,0,W,D,t),bx('Lower shelf',l,0.2,0.04,W-2*l,D-0.08,0.025)];
      for(const[k,x,z]of[[1,0,0],[2,W-l,0],[3,0,D-l],[4,W-l,D-l]])r.push(bx('Leg '+k,x,0,z,l,l,H-t));
      if(p.peg>0)r.push(bx('Pegboard',0.05,H,0,W-0.1,0.015,p.peg));return r;}},
  whiteboard:{label:'Whiteboard (wall)',category:'Desks and tables',tag:'furniture',wall:true,y0:()=>1.0,
    defaults:{width:1.2,height:0.9},
    fields:[['width','Width','m'],['height','Height','m']],
    fix(p){p.width=Math.max(+p.width||0,0.3);p.height=Math.max(+p.height||0,0.3);},
    build(p){return[bx('Board',0,0,0,p.width,0.025,p.height),bx('Tray',0.1,0,0.025,Math.max(0.05,p.width-0.2),0.06,0.02)];}},
  rack:{label:'Server rack (19″)',category:'Electronics',tag:'electronics',
    defaults:{units:12,width:0.6,depth:0.8},
    fields:[['units','Rack units','#'],['width','Width','m'],['depth','Depth','m']],
    fix(p){p.units=clamp(Math.round(+p.units||12),2,48);p.width=Math.max(+p.width||0,0.5);p.depth=Math.max(+p.depth||0,0.4);},
    build(p){const W=p.width,D=p.depth,H=p.units*0.04445+0.1,t=0.03,r=[bx('Base',0,0.04,0,W,D,0.06),bx('Top',0,H-0.04,0,W,D,0.04),bx('Plinth',0.02,0,0.02,W-0.04,D-0.04,0.04)];
      for(const[k,x,z]of[[1,0,0],[2,W-t,0],[3,0,D-t],[4,W-t,D-t]])r.push(bx('Post '+k,x,0.1,z,t,t,H-0.14));
      r.push(bx('Front door',0.03,0.1,D,W-0.06,0,H-0.14),bx('Side L',0,0.1,t,0.01,D-2*t,H-0.14),bx('Side R',W-0.01,0.1,t,0.01,D-2*t,H-0.14));return r;}},
  printerstand:{label:'Printer stand',category:'Desks and tables',tag:'furniture',
    defaults:{width:0.5,depth:0.45,height:0.6},
    fields:[['width','Width','m'],['depth','Depth','m'],['height','Height','m']],
    fix(p){p.width=Math.max(+p.width||0,0.2);p.depth=Math.max(+p.depth||0,0.2);p.height=Math.max(+p.height||0,0.25);},
    build(p){const W=p.width,D=p.depth,H=p.height,l=0.04,r=[bx('Top',0,H-0.025,0,W,D,0.025),bx('Shelf',l,H*0.35,l,W-2*l,D-2*l,0.02)];
      for(const[k,x,z]of[[1,0,0],[2,W-l,0],[3,0,D-l],[4,W-l,D-l]])r.push(bx('Leg '+k,x,0,z,l,l,H-0.025));return r;}},
  /* ---------- electronics additions ---------- */
  tv:{label:'TV on stand',category:'Electronics',tag:'electronics',y0:()=>0.5,
    defaults:{screenw:1.23,screenh:0.71,thick:0.05,stand:0.08},
    fields:[['screenw','Screen width (55″ = 1.23)','m'],['screenh','Screen height','m'],['thick','Depth','m'],['stand','Stand height','m']],
    fix(p){p.screenw=Math.max(+p.screenw||0,0.3);p.screenh=Math.max(+p.screenh||0,0.2);p.thick=clamp(+p.thick||0.05,0.01,0.3);p.stand=clamp(+p.stand||0.08,0.02,0.4);},
    build(p){const W=p.screenw,D=Math.max(0.2,p.thick+0.15);return[bx('Foot',W/2-0.25,0,D/2-0.1,0.5,0.2,0.02),bx('Neck',W/2-0.03,0.02,D/2-0.02,0.06,0.04,p.stand-0.02),bx('Screen',0,p.stand,D/2-p.thick/2,W,p.thick,p.screenh)];}},
  speaker:{label:'Speaker on stand',category:'Electronics',tag:'electronics',
    defaults:{height:1.0,box:0.2,boxd:0.25,boxh:0.35},
    fields:[['height','Stand height','m'],['box','Speaker width','m'],['boxd','Speaker depth','m'],['boxh','Speaker height','m']],
    fix(p){p.height=Math.max(+p.height||0,0.3);p.box=Math.max(+p.box||0,0.1);p.boxd=Math.max(+p.boxd||0,0.1);p.boxh=Math.max(+p.boxh||0,0.1);},
    build(p){const W=Math.max(0.3,p.box),D=Math.max(0.3,p.boxd);return[roundOf(bx('Base',W/2-0.15,0,D/2-0.15,0.3,0.3,0.02)),roundOf(bx('Pole',W/2-0.02,0.02,D/2-0.02,0.04,0.04,p.height-0.02)),
      bx('Plate',W/2-p.box/2,p.height,D/2-p.boxd/2,p.box,p.boxd,0.01),bx('Speaker',W/2-p.box/2,p.height+0.01,D/2-p.boxd/2,p.box,p.boxd,p.boxh)];}},
  router:{label:'Router',category:'Electronics',tag:'electronics',y0:()=>0.75,
    defaults:{width:0.25,depth:0.17,height:0.04},
    fields:[['width','Width','m'],['depth','Depth','m'],['height','Height','m']],
    fix(p){p.width=Math.max(+p.width||0,0.08);p.depth=Math.max(+p.depth||0,0.06);p.height=Math.max(+p.height||0,0.02);},
    build(p){return[bx('Body',0,0,0.01,p.width,p.depth-0.01,p.height),roundOf(bx('Antenna L',0.02,0,0,0.012,0.012,p.height+0.16)),roundOf(bx('Antenna R',p.width-0.032,0,0,0.012,0.012,p.height+0.16))];}},
  ups:{label:'UPS',category:'Electronics',tag:'electrical',
    defaults:{width:0.15,depth:0.4,height:0.22},
    fields:[['width','Width','m'],['depth','Depth','m'],['height','Height','m']],
    fix(p){p.width=Math.max(+p.width||0,0.08);p.depth=Math.max(+p.depth||0,0.1);p.height=Math.max(+p.height||0,0.05);},
    build(p){return[bx('Body',0,0.01,0,p.width,p.depth,p.height-0.01),bx('Front panel',0.01,0.04,p.depth,p.width-0.02,0,p.height*0.5),bx('Feet',0.01,0,0.01,p.width-0.02,p.depth-0.02,0.01)];}},
  printer3d:{label:'3D printer',category:'Electronics',tag:'electronics',y0:()=>0.75,
    defaults:{width:0.45,depth:0.45,height:0.5,spool:0.2},
    fields:[['width','Width','m'],['depth','Depth','m'],['height','Height','m'],['spool','Spool Ø (0 = none)','m']],
    fix(p){p.width=Math.max(+p.width||0,0.15);p.depth=Math.max(+p.depth||0,0.15);p.height=Math.max(+p.height||0,0.15);p.spool=clamp(+p.spool||0,0,Math.min(p.width,p.depth));},
    build(p){const W=p.width,D=p.depth,H=p.height,sp=p.spool,bh=sp>0?H-sp*0.4:H,r=[bx('Body',0,0.01,0,W,D,bh-0.01),bx('Door',0.03,0.04,D,W-0.06,0,bh-0.08),bx('Feet',0.02,0,0.02,W-0.04,D-0.04,0.01)];
      if(sp>0)r.push(roundOf(bx('Spool',W/2-sp/2,bh,D/2-sp/2,sp,sp,sp*0.4)));return r;}},
  vesawall:{label:'VESA wall mount',category:'Electronics',tag:'electronics',wall:true,y0:()=>1.0,
    defaults:{screenw:0.61,screenh:0.36,thick:0.05,reach:0.35,screen:'yes'},
    fields:[['screenw','Screen width','m'],['screenh','Screen height','m'],['thick','Screen depth','m'],['reach','Arm reach','m'],['screen','Show screen','opt',[['yes','Yes'],['no','No (mount only)']]]],
    fix(p){p.screenw=Math.max(+p.screenw||0,0.2);p.screenh=Math.max(+p.screenh||0,0.12);p.thick=clamp(+p.thick||0.05,0.005,0.2);p.reach=Math.max(+p.reach||0,0.08);p.screen=p.screen==='no'?'no':'yes';},
    /* wall plate against the back wall, a single horizontal arm out to the VESA plate, the screen facing +z. Attach it to its wall in
       the inspector so it follows the wall; fixtures (a power outlet behind the screen) can sit on the wall next to it. */
    build(p){const W=p.screenw,c=W/2,y=p.screenh/2,R=p.reach,r=[bx('Wall plate',c-0.06,Math.max(0,y-0.1),0,0.12,0.012,0.2),
        bx('Pivot',c-0.025,Math.max(0,y-0.025),0.012,0.05,0.04,0.05),bx('Arm',c-0.02,Math.max(0,y-0.02),0.05,0.04,Math.max(0.02,R-0.05),0.04),
        bx('VESA plate',c-0.05,Math.max(0,y-0.05),R,0.1,0.012,0.1)];
      if(p.screen==='yes')r.push(bx('Screen',0,0,R+0.012,W,p.thick,p.screenh));return r;}},
  /* ---------- kitchen and utility ---------- */
  basecab:{label:'Base cabinet',category:'Kitchen and utility',tag:'storage',
    defaults:{width:0.6,height:0.87,depth:0.6,fronts:1,drawers:'doors'},
    fields:[['width','Width','m'],['height','Height (with worktop)','m'],['depth','Depth','m'],['fronts','Fronts','#'],['drawers','Fronts are','opt',[['doors','Doors'],['drawers','Drawers']]]],
    fix(p){p.fronts=clamp(Math.round(+p.fronts||1),1,6);p.drawers=p.drawers==='drawers'?'drawers':'doors';p.width=Math.max(+p.width||0,0.3);p.height=Math.max(+p.height||0,0.5);p.depth=Math.max(+p.depth||0,0.3);},
    build(p){const W=p.width,H=p.height,D=p.depth,pl=0.1,wt=0.04,n=p.fronts,r=[bx('Plinth',0.02,0,0.04,W-0.04,D-0.06,pl),bx('Carcass',0,pl,0,W,D-0.02,H-pl-wt),bx('Worktop',0,H-wt,0,W,D,wt)];
      const fh=(H-pl-wt)/(p.drawers==='drawers'?n:1),fw=p.drawers==='drawers'?W:W/n;
      for(let k=0;k<n;k++)r.push(bx((p.drawers==='drawers'?'Drawer ':'Door ')+(k+1),p.drawers==='drawers'?0.004:k*fw+0.004,pl+(p.drawers==='drawers'?k*fh:0)+0.004,D-0.02,fw-0.008,0,fh-0.008));
      return r;}},
  fridge:{label:'Fridge-freezer',category:'Kitchen and utility',tag:'furniture',
    defaults:{width:0.6,depth:0.65,height:1.8,freezer:0.6},
    fields:[['width','Width','m'],['depth','Depth','m'],['height','Height','m'],['freezer','Freezer door height','m']],
    fix(p){p.width=Math.max(+p.width||0,0.4);p.depth=Math.max(+p.depth||0,0.4);p.height=Math.max(+p.height||0,0.6);p.freezer=clamp(+p.freezer||0,0,p.height-0.3);},
    build(p){const W=p.width,D=p.depth,H=p.height,f=p.freezer,r=[bx('Body',0,0.03,0,W,D-0.03,H-0.03)];
      if(f>0)r.push(bx('Freezer door',0.004,0.034,D-0.03,W-0.008,0,f-0.008),bx('Fridge door',0.004,0.034+f,D-0.03,W-0.008,0,H-0.038-f),bx('Freezer handle',W-0.06,0.034+f-0.25,D-0.03,0.02,0,0.2),bx('Fridge handle',W-0.06,0.034+f+0.05,D-0.03,0.02,0,0.5));
      else r.push(bx('Door',0.004,0.034,D-0.03,W-0.008,0,H-0.038),bx('Handle',W-0.06,H*0.5,D-0.03,0.02,0,0.5));
      return r;}},
  washer:{label:'Washing machine',category:'Kitchen and utility',tag:'furniture',
    defaults:{width:0.6,depth:0.6,height:0.85},
    fields:[['width','Width','m'],['depth','Depth','m'],['height','Height','m']],
    fix(p){p.width=Math.max(+p.width||0,0.4);p.depth=Math.max(+p.depth||0,0.4);p.height=Math.max(+p.height||0,0.5);},
    build(p){const W=p.width,D=p.depth,H=p.height;return[bx('Body',0,0.02,0,W,D,H-0.02),bx('Door',W/2-0.2,H*0.12,D,0.4,0,0.4),bx('Controls',0.03,H-0.12,D,W-0.06,0,0.08),bx('Drawer',0.03,H-0.12,D,0.14,0.001,0.08)];}},
  /* ---------- bathroom ---------- */
  toilet:{label:'Toilet',category:'Bathroom',tag:'plumbing',
    defaults:{width:0.37,depth:0.68,height:0.4},
    fields:[['width','Width','m'],['depth','Depth','m'],['height','Seat height','m']],
    fix(p){p.width=Math.max(+p.width||0,0.25);p.depth=Math.max(+p.depth||0,0.4);p.height=clamp(+p.height||0.4,0.25,0.6);},
    build(p){const W=p.width,D=p.depth,H=p.height;return[bx('Cistern',0.02,0,0,W-0.04,0.2,H+0.38),roundOf(bx('Bowl',0,0,0.18,W,D-0.18,H-0.03)),roundOf(bx('Seat',0.01,H-0.03,0.19,W-0.02,D-0.2,0.03))];}},
  vanity:{label:'Vanity with basin',category:'Bathroom',tag:'plumbing',
    defaults:{width:0.6,depth:0.45,height:0.85},
    fields:[['width','Width','m'],['depth','Depth','m'],['height','Height','m']],
    fix(p){p.width=Math.max(+p.width||0,0.3);p.depth=Math.max(+p.depth||0,0.25);p.height=Math.max(+p.height||0,0.5);},
    build(p){const W=p.width,D=p.depth,H=p.height,bw=Math.min(0.4,W-0.1),bd=Math.min(0.32,D-0.08);
      return[bx('Cabinet',0,0.1,0,W,D,H-0.1-0.03),bx('Plinth',0.02,0,0.02,W-0.04,D-0.04,0.1),bx('Top',0,H-0.03,0,W,D,0.03),roundOf(bx('Basin',W/2-bw/2,H,D/2-bd/2,bw,bd,0.02)),roundOf(bx('Tap',W/2-0.01,H,0.04,0.02,0.02,0.15)),bx('Door',0.004,0.104,D,W-0.008,0,H-0.14)];}},
  shower:{label:'Shower tray and screen',category:'Bathroom',tag:'plumbing',
    defaults:{width:0.9,depth:0.9,height:2.0},
    fields:[['width','Width','m'],['depth','Depth','m'],['height','Screen height','m']],
    fix(p){p.width=Math.max(+p.width||0,0.6);p.depth=Math.max(+p.depth||0,0.6);p.height=Math.max(+p.height||0,1.4);},
    build(p){const W=p.width,D=p.depth,H=p.height;return[bx('Tray',0,0,0,W,D,0.06),bx('Glass front',0,0.06,D-0.01,W,0.01,H-0.06),bx('Glass side',W-0.01,0.06,0,0.01,D-0.01,H-0.06),roundOf(bx('Drain',W/2-0.04,0.06,D/2-0.04,0.08,0.08,0.005))];}},
  bath:{label:'Bath',category:'Bathroom',tag:'plumbing',
    defaults:{length:1.7,width:0.75,height:0.56},
    fields:[['length','Length','m'],['width','Width','m'],['height','Height','m']],
    fix(p){p.length=Math.max(+p.length||0,0.9);p.width=Math.max(+p.width||0,0.5);p.height=Math.max(+p.height||0,0.3);},
    build(p){const L=p.length,W=p.width,H=p.height;return[bx('Shell',0,0,0,L,W,H),bx('Rim',0.02,H,0.02,L-0.04,W-0.04,0.01),roundOf(bx('Tap',0.03,H,W/2-0.02,0.04,0.04,0.12))];}},
  /* ---------- decor ---------- */
  rug:{label:'Rug',category:'Decor',tag:'furniture',
    defaults:{width:2.0,depth:1.4,shape:'rect'},
    fields:[['width','Width','m'],['depth','Depth','m'],['shape','Shape','opt',[['rect','Rectangle'],['round','Round / oval']]]],
    fix(p){p.width=Math.max(+p.width||0,0.3);p.depth=Math.max(+p.depth||0,0.3);p.shape=p.shape==='round'?'round':'rect';},
    build(p){const e=bx('Rug',0,0,0,p.width,p.depth,0.01);return[p.shape==='round'?roundOf(e):e];}},
  plant:{label:'Plant in pot',category:'Decor',tag:'furniture',
    defaults:{pot:0.3,potheight:0.3,spread:0.55,height:1.2},
    fields:[['pot','Pot Ø','m'],['potheight','Pot height','m'],['spread','Foliage Ø','m'],['height','Overall height','m']],
    fix(p){p.pot=Math.max(+p.pot||0,0.1);p.potheight=Math.max(+p.potheight||0,0.1);p.spread=Math.max(+p.spread||0,0.1);p.height=Math.max(+p.height||0,p.potheight+0.2);},
    build(p){const W=Math.max(p.pot,p.spread),c=W/2;return[roundOf(bx('Pot',c-p.pot/2,0,c-p.pot/2,p.pot,p.pot,p.potheight)),roundOf(bx('Foliage',c-p.spread/2,p.potheight,c-p.spread/2,p.spread,p.spread,p.height-p.potheight))];}},
  mirror:{label:'Mirror (wall)',category:'Decor',tag:'furniture',wall:true,y0:()=>0.9,
    defaults:{width:0.6,height:1.6},
    fields:[['width','Width','m'],['height','Height','m']],
    fix(p){p.width=Math.max(+p.width||0,0.15);p.height=Math.max(+p.height||0,0.15);},
    build(p){return[bx('Mirror',0,0,0,p.width,0.03,p.height)];}},
  curtain:{label:'Curtain and rail',category:'Decor',tag:'furniture',wall:true,y0:p=>2.2-p.drop-0.02,
    defaults:{length:2.0,drop:2.0,panels:2},
    fields:[['length','Rail length','m'],['drop','Drop','m'],['panels','Curtain panels (0 = rail only)','#']],
    fix(p){p.length=Math.max(+p.length||0,0.4);p.drop=clamp(+p.drop||2,0.3,3);p.panels=clamp(Math.round(+p.panels||0),0,4);},
    build(p){const L=p.length,d=p.drop,r=[bx('Rail',0,d,0.07,L,0.02,0.02),bx('Bracket L',0.05,d,0,0.02,0.09,0.02),bx('Bracket R',L-0.07,d,0,0.02,0.09,0.02)],n=p.panels;
      for(let k=0;k<n;k++)r.push(bx('Curtain '+(k+1),k*L/n+0.01,0,0.06,L/n-0.02,0.04,d));return r;}},
  radiator:{label:'Radiator (wall)',category:'Decor',tag:'plumbing',wall:true,y0:()=>0.15,
    defaults:{width:0.8,height:0.6,depth:0.08},
    fields:[['width','Width','m'],['height','Height','m'],['depth','Depth','m']],
    fix(p){p.width=Math.max(+p.width||0,0.2);p.height=Math.max(+p.height||0,0.2);p.depth=Math.max(+p.depth||0,0.04);},
    build(p){return[bx('Panel',0,0,0.02,p.width,p.depth-0.02,p.height),bx('Valve',p.width-0.06,0,0.02,0.04,0.04,0.05),bx('Pipe',p.width-0.045,0,0.02,0.01,0.01,0.01)];}},
  /* ---------- music ---------- */
  keyboard:{label:'Keyboard on stand',category:'Music',tag:'electronics',
    defaults:{width:1.3,depth:0.35,height:0.75},
    fields:[['width','Keyboard width','m'],['depth','Depth','m'],['height','Playing height','m']],
    fix(p){p.width=Math.max(+p.width||0,0.4);p.depth=Math.max(+p.depth||0,0.15);p.height=Math.max(+p.height||0,0.4);},
    build(p){const W=p.width,D=p.depth,H=p.height;return[bx('Keyboard',0,H-0.1,0,W,D,0.1),bx('Stand leg L',0.15,0,D/2-0.015,0.03,0.03,H-0.1),bx('Stand leg R',W-0.18,0,D/2-0.015,0.03,0.03,H-0.1),
      bx('Foot L',0.1,0,0.03,0.04,D-0.06,0.02),bx('Foot R',W-0.14,0,0.03,0.04,D-0.06,0.02),bx('Cross brace',0.18,H*0.45,D/2-0.01,W-0.36,0.02,0.02)];}},
  guitar:{label:'Guitar stand',category:'Music',tag:'furniture',
    defaults:{height:0.85},
    fields:[['height','Height','m']],
    fix(p){p.height=Math.max(+p.height||0,0.4);},
    build(p){const H=p.height;return[bx('Foot L',0,0,0,0.04,0.35,0.02),bx('Foot R',0.3,0,0,0.04,0.35,0.02),bx('Cross foot',0,0,0.33,0.34,0.04,0.02),roundOf(bx('Pole',0.15,0.02,0.15,0.03,0.03,H-0.02)),bx('Neck rest',0.1,H-0.04,0.13,0.14,0.07,0.04)];}},
  drums:{label:'Drum kit (footprint)',category:'Music',tag:'furniture',
    defaults:{scale:1},
    fields:[['scale','Scale','#']],
    fix(p){p.scale=clamp(+p.scale||1,0.5,2);},
    build(p){const s=p.scale,d=(n,x,z,w,h,y)=>roundOf(bx(n,x*s,y*s,z*s,w*s,w*s,h*s));
      return[d('Kick drum',0.55,0.45,0.55,0.5,0),d('Snare',0.15,0.15,0.36,0.2,0.55),d('Tom 1',0.45,0.15,0.3,0.2,0.95),d('Tom 2',0.8,0.15,0.3,0.2,0.95),d('Floor tom',1.15,0.5,0.42,0.45,0),
        d('Hi-hat',-0.1,0.2,0.36,0.01,0.9),d('Crash',0.1,-0.05,0.4,0.01,1.4),d('Ride',1.15,-0.05,0.5,0.01,1.35),d('Throne',0.62,1.05,0.36,0.1,0.42)];}}
};
/* part helper: name, min corner, then width (x), depth (z), height (y) */
function bx(n,x,y,z,w,d,h){return{n,x,y,z,w:Math.max(0,w),d:Math.max(0,d),h:Math.max(0,h)};}
/* a part as a round (extruded ellipse) footprint */
function roundOf(e){return{...e,poly:SHAPES.round.pts()};}
/* sofas and armchairs: base, arms, back, then a seat cushion and back cushion per seat; with chaise > 0 a lounger extends from one end */
function sofaFix(p){p.arm=clamp(+p.arm||0.15,0.05,0.4);p.seats=clamp(Math.round(+p.seats||1),1,5);p.seath=clamp(+p.seath||0.45,0.25,0.7);
  p.width=Math.max(+p.width||0,2*p.arm+0.3*p.seats);p.depth=Math.max(+p.depth||0,0.5);p.height=Math.max(+p.height||0,p.seath+0.2);p.cside=p.cside==='l'?'l':'r';p.chaise=Math.max(+p.chaise||0,0);}
function sofaParts(p,ch){const W=p.width,D=p.depth,H=p.height,sh=p.seath,a=p.arm,n=p.seats,cth=0.15,fy=0.08,bk=0.14,iw=W-2*a,cw=iw/n,fh=sh-cth-fy,r=[];
  r.push(bx('Base',a,fy,0,iw,D,fh),bx('Arm L',0,fy,0,a,D,sh+0.1-fy),bx('Arm R',W-a,fy,0,a,D,sh+0.1-fy),bx('Back',a,fy,0,iw,bk,H-fy));
  for(let k=0;k<n;k++){const x=a+k*cw+0.004;r.push(bx('Seat cushion '+(k+1),x,sh-cth,bk,cw-0.008,D-bk,cth),bx('Back cushion '+(k+1),x,sh,bk,cw-0.008,0.12,H-sh-0.04));}
  const feet=[[0.04,0.04],[W-0.08,0.04],[0.04,D-0.08],[W-0.08,D-0.08]];
  if(ch>0){const right=p.cside!=='l',x=right?W-a-cw:a;
    r.push(bx('Chaise base',x,fy,D,cw,ch-D,fh),bx('Chaise cushion',x+0.004,sh-cth,D,cw-0.008,ch-D,cth),bx('Chaise arm',right?W-a:0,fy,D,a,ch-D,sh-fy-0.05));
    feet.push([right?W-0.08:0.04,ch-0.08]);}
  feet.forEach(([x,z],k)=>r.push(roundOf(bx('Foot '+(k+1),x,0,z,0.04,0.04,fy))));
  return r;}
