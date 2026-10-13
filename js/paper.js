'use strict';
/* Linewright — paper framing: A4/A3 frame with a 1 cm grid over the perspective (for copying onto real paper) and the
   paper size + scale used by the sheet. In the perspective, the chosen scale is shown as the floor line where the picture
   is true to scale on the paper (things standing at that depth measure 1:N on the sheet). */

const PAPER={A4:[210,297],A3:[297,420]};
const SCALES=[10,20,25,50,100];
function paperDims(){const[a,b]=PAPER[S.paper.size]||PAPER.A4;return S.paper.orient==='portrait'?[a,b]:[b,a];}
function paperFrame(W,H){const[pw,ph]=paperDims(),m=0.035*Math.min(W,H),s=Math.min((W-2*m)/pw,(H-2*m)/ph);return{pw,ph,s,x0:(W-pw*s)/2,y0:(H-ph*s)/2,fw:pw*s,fh:ph*s};}
let PRINTING=false;   // true while printPaper() renders the frame: no overlay mask, border, gizmos or selection
function drawPaperP(){if(!S.paper.persp&&!PRINTING)return;const W=cv.width,H=cv.height,F=paperFrame(W,H),u=W/1200;
  if(!PRINTING){ctx.save();ctx.beginPath();ctx.rect(0,0,W,H);ctx.rect(F.x0,F.y0,F.fw,F.fh);ctx.globalAlpha=.62;ctx.fillStyle=C.paper;ctx.fill('evenodd');ctx.restore();}
  if(S.paper.grid){ctx.beginPath();for(let x=10;x<F.pw;x+=10){const X=F.x0+x*F.s;ctx.moveTo(X,F.y0);ctx.lineTo(X,F.y0+F.fh);}
    for(let y=10;y<F.ph;y+=10){const Y=F.y0+y*F.s;ctx.moveTo(F.x0,Y);ctx.lineTo(F.x0+F.fw,Y);}
    ctx.strokeStyle=C.guide;ctx.globalAlpha=.2;ctx.lineWidth=1*u;ctx.stroke();ctx.globalAlpha=1;}
  if(!PRINTING){ctx.strokeStyle=C.guide;ctx.lineWidth=1.8*u;ctx.strokeRect(F.x0,F.y0,F.fw,F.fh);}
  /* true-scale plane: depth D where 1 m = 1000/scale mm on paper → fp/D px = (1000/scale)*s px */
  const pxm=1000/S.paper.scale*F.s,D=cam.fp/pxm;let txt=`${S.paper.size} ${S.paper.orient}${S.paper.grid?' · 1 cm grid':''} · 1:${S.paper.scale} at ${fmt(D)} m from the eye`;
  /* floor point where the depth along the (possibly tilted) view axis is D: horizontal distance h = (D + eye·sin p) / cos p */
  const pr=(S.pitch||0)*Math.PI/180,hd=(D+S.eye*Math.sin(pr))/Math.max(Math.cos(pr),0.1),
    f=[Math.sin(S.yaw*Math.PI/180),-Math.cos(S.yaw*Math.PI/180)],r=[-f[1],f[0]],c=[S.cx+f[0]*hd,S.cz+f[1]*hd];
  if(D>NEAR){seg([c[0]-r[0]*3,0,c[1]-r[1]*3],[c[0]+r[0]*3,0,c[1]+r[1]*3],[C.guide,1.4,[3,5]]);}
  const hit=rayPick([W/2,H/2]);if(hit){const dz=toCam(hit.P)[2];if(dz>NEAR)txt+=` · centre (${hit.what}, ${fmt(dz)} m) ≈ 1:${Math.round(dz*1000/(cam.fp/F.s))}`;}
  ctx.font=`${Math.max(11*u,10*K)}px "IBM Plex Mono",monospace`;const tw=ctx.measureText(txt).width;
  ctx.fillStyle=C.paper;ctx.globalAlpha=.85;ctx.fillRect(F.x0+4*u,F.y0+F.fh-22*u,tw+12*u,18*u);ctx.globalAlpha=1;ctx.fillStyle=C.guide;ctx.fillText(txt,F.x0+10*u,F.y0+F.fh-9*u);}
/* paper controls, rendered into the Camera panel and the Sheet panel (prefix keeps ids unique) */
function paperCtl(px){return`<div class="ig"><label for="${px}-size"><span>Paper</span><select id="${px}-size">${Object.keys(PAPER).map(k=>`<option${k===S.paper.size?' selected':''}>${k}</option>`).join('')}</select></label>
  <label for="${px}-orient"><span>Orientation</span><select id="${px}-orient"><option value="landscape"${S.paper.orient==='landscape'?' selected':''}>Landscape</option><option value="portrait"${S.paper.orient==='portrait'?' selected':''}>Portrait</option></select></label>
  <label for="${px}-scale"><span>Scale</span><select id="${px}-scale">${SCALES.map(s=>`<option value="${s}"${s===+S.paper.scale?' selected':''}>1:${s}</option>`).join('')}</select></label></div>
  <div class="toggles"><label><input type="checkbox" id="${px}-persp"${S.paper.persp?' checked':''}> Frame over perspective</label><label><input type="checkbox" id="${px}-grid"${S.paper.grid?' checked':''}> 1 cm grid</label></div>
  ${px==='cp'?'<div class="chips"><button type="button" id="cp-print" title="Print the framed area at true paper size">Print frame</button></div>':''}`;}
function bindPaperCtl(px){const on=(id,ev,fn)=>{const el=$(px+'-'+id);if(el)el.addEventListener(ev,()=>{fn(el);save();renderPaperCtls();drawAll();});};
  on('size','change',el=>S.paper.size=el.value);on('orient','change',el=>S.paper.orient=el.value);on('scale','change',el=>S.paper.scale=+el.value);
  on('persp','change',el=>S.paper.persp=el.checked);on('grid','change',el=>S.paper.grid=el.checked);
  const pb=$(px+'-print');if(pb)pb.addEventListener('click',printPaper);}
/* Print frame: renders the framed area of the perspective at about 200 dpi in light colours (grid included when it is on) and
   prints it on one page of the chosen paper size, edge to edge, so the 1 cm squares are 1 cm at 100% print scale. */
const PRINT_COLS={paper:'#ffffff',ink:'#161718',faint:'#a3a7aa',guide:'#C96A4A',accent:'#2F5BD3',muted:'#585d61',gx:'#C8362C',gy:'#2C8A43',gz:'#1C64E8',line:'#C9CCCE'};
function printPaper(){if(S.view!=='persp')setView('persp');
  const W0=cv.width,H0=cv.height,K0=K;if(!W0){flash('Open the Perspective view first.');return;}
  const F0=paperFrame(W0,H0),m=Math.min(F0.pw/25.4*200/F0.fw,6000/Math.max(W0,H0)),saved={...C};let url='';
  cv.width=Math.round(W0*m);cv.height=Math.round(H0*m);K=K0*m;Object.assign(C,PRINT_COLS);PRINTING=true;
  try{draw();const F=paperFrame(cv.width,cv.height),out=document.createElement('canvas');out.width=Math.round(F.fw);out.height=Math.round(F.fh);
    out.getContext('2d').drawImage(cv,F.x0,F.y0,F.fw,F.fh,0,0,out.width,out.height);url=out.toDataURL('image/png');}
  catch(err){flash("Couldn't render the frame for printing.");}
  finally{PRINTING=false;Object.assign(C,saved);cv.width=W0;cv.height=H0;K=K0;drawAll();}
  if(!url)return;
  const host=$('print-frame');host.style.setProperty('--pw',F0.pw+'mm');host.style.setProperty('--ph',F0.ph+'mm');
  $('print-page').textContent=`@page{size:${F0.pw}mm ${F0.ph}mm;margin:0}`;
  const img=new Image();img.alt='';img.onload=()=>{host.innerHTML='';host.appendChild(img);document.body.classList.add('pp');
    const done=()=>{document.body.classList.remove('pp');host.innerHTML='';};window.addEventListener('afterprint',done,{once:true});
    setTimeout(()=>{try{window.print();}catch(e){done();flash("Printing isn't available here. Export the project and open the app in a browser tab to print.");}},50);
    flash(`Printing ${S.paper.size} ${S.paper.orient}: choose 100% / actual size (no "fit to page") so ${S.paper.grid?'the 1 cm squares are 1 cm':'the scale holds'}.`);};
  img.src=url;}
function renderPaperCtls(){for(const[px,id]of[['cp','cam-paper'],['pp','sheet-paper']]){const el=$(id);if(!el)continue;el.innerHTML=paperCtl(px);bindPaperCtl(px);}
  const b=$('b-paper');if(b)b.setAttribute('aria-pressed',!!S.paper.persp);}
