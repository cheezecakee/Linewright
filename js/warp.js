'use strict';
/* Linewright — image corner-pin: a layer with L.pin (four view points TL, TR, BR, BL in units of the canvas width, like
   L.x / L.y) is drawn as one textured quad with a true perspective warp. The quad's homography maps the unit square
   (s right, t down) onto the four points; a small WebGL routine inverts it per pixel and samples the image. Without WebGL
   the quad is drawn as a grid of affine triangles (close, not exact). Unpinned layers keep the plain 2D drawImage path. */

/* 3 × 3 matrices as row-major arrays of 9 */
function sqToQuad(q){const[x0,y0]=q[0],[x1,y1]=q[1],[x2,y2]=q[2],[x3,y3]=q[3];
  const dx1=x1-x2,dx2=x3-x2,dy1=y1-y2,dy2=y3-y2,sx=x0-x1+x2-x3,sy=y0-y1+y2-y3;let g=0,h=0;
  if(Math.abs(sx)>1e-9||Math.abs(sy)>1e-9){const den=dx1*dy2-dx2*dy1;if(Math.abs(den)>1e-12){g=(sx*dy2-dx2*sy)/den;h=(dx1*sy-sx*dy1)/den;}}
  return[x1-x0+g*x1,x3-x0+h*x3,x0,y1-y0+g*y1,y3-y0+h*y3,y0,g,h,1];}
function m3inv(m){const[a,b,c,d,e,f,g,h,i]=m,A=e*i-f*h,B=-(d*i-f*g),Cc=d*h-e*g,det=a*A+b*B+c*Cc;if(Math.abs(det)<1e-15)return null;
  return[A/det,-(b*i-c*h)/det,(b*f-c*e)/det,B/det,(a*i-c*g)/det,-(a*f-c*d)/det,Cc/det,-(a*h-b*g)/det,(a*e-b*d)/det];}
function m3apply(m,x,y){const w=m[6]*x+m[7]*y+m[8];return[(m[0]*x+m[1]*y+m[2])/w,(m[3]*x+m[4]*y+m[5])/w];}
/* the layer's quad in canvas px, and the mapping between its unit square and the canvas */
function layerQuad(L){const W=cv.width;return L.pin?L.pin.map(p=>[p[0]*W,p[1]*W]):lgeo(L).corners;}
function layerMap(L){const q=layerQuad(L),M=sqToQuad(q),Mi=m3inv(M)||[1,0,0,0,1,0,0,0,1];return{q,M,Mi,fwd:(s,t)=>m3apply(M,s,t),inv:(x,y)=>m3apply(Mi,x,y)};}
/* a quad is usable when it is convex and not folded */
function quadOK(q){let s=0;for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4],c=q[(i+2)%4],cr=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);if(Math.abs(cr)<1e-6)return false;if(!s)s=Math.sign(cr);else if(Math.sign(cr)!==s)return false;}return true;}

/* ---------- WebGL ---------- */
let GL=null;   // null = not tried, false = unavailable
const WARP_VS='attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}';
const WARP_FS=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform mat3 mi;uniform vec2 size;uniform sampler2D tex;uniform vec2 flip;uniform float op;
void main(){vec2 p=vec2(gl_FragCoord.x,size.y-gl_FragCoord.y);vec3 q=mi*vec3(p,1.0);if(q.z<=0.0)discard;vec2 st=q.xy/q.z;
  if(st.x<0.0||st.x>1.0||st.y<0.0||st.y>1.0)discard;st=mix(st,1.0-st,flip);gl_FragColor=texture2D(tex,st)*op;}`;
function glSetup(){if(GL!==null)return GL;GL=false;
  try{const c=document.createElement('canvas'),gl=c.getContext('webgl',{premultipliedAlpha:true,alpha:true,antialias:false,preserveDrawingBuffer:true});if(!gl)return GL;
    const sh=(t,src)=>{const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'shader');return s;};
    const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,WARP_VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,WARP_FS));gl.linkProgram(pr);
    if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw new Error('link');
    const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    GL={c,gl,pr,buf,tex:new Map(),max:gl.getParameter(gl.MAX_TEXTURE_SIZE)||2048,
      loc:{p:gl.getAttribLocation(pr,'p'),mi:gl.getUniformLocation(pr,'mi'),size:gl.getUniformLocation(pr,'size'),tex:gl.getUniformLocation(pr,'tex'),flip:gl.getUniformLocation(pr,'flip'),op:gl.getUniformLocation(pr,'op')}};
    c.addEventListener('webglcontextlost',e=>{e.preventDefault();GL=false;drawAll();});}
  catch(e){GL=false;}
  return GL;}
/* one texture per layer, re-uploaded when its image changes; large photos are scaled to fit the GPU's limit */
function glTex(L,img){const gl=GL.gl,key=img.src;let t=GL.tex.get(L.id);if(t&&t.k===key)return t.t;if(t)gl.deleteTexture(t.t);
  let src=img;const mx=Math.min(GL.max,4096),nw=img.naturalWidth,nh=img.naturalHeight;
  if(nw>mx||nh>mx){const s=mx/Math.max(nw,nh),c=document.createElement('canvas');c.width=Math.max(1,Math.round(nw*s));c.height=Math.max(1,Math.round(nh*s));c.getContext('2d').drawImage(img,0,0,c.width,c.height);src=c;}
  const tx=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tx);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  GL.tex.set(L.id,{k:key,t:tx});return tx;}
function glForget(id){if(GL&&GL.tex.has(id)){try{GL.gl.deleteTexture(GL.tex.get(id).t);}catch(e){}GL.tex.delete(id);}}
/* draw a pinned layer onto the perspective canvas */
function drawWarped(L,img){const map=layerMap(L);
  if(glSetup()){try{const{c,gl,loc}=GL;if(c.width!==cv.width||c.height!==cv.height){c.width=cv.width;c.height=cv.height;}
      gl.viewport(0,0,c.width,c.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(GL.pr);
      gl.bindBuffer(gl.ARRAY_BUFFER,GL.buf);gl.enableVertexAttribArray(loc.p);gl.vertexAttribPointer(loc.p,2,gl.FLOAT,false,0,0);
      const m=map.Mi;gl.uniformMatrix3fv(loc.mi,false,new Float32Array([m[0],m[3],m[6],m[1],m[4],m[7],m[2],m[5],m[8]]));
      gl.uniform2f(loc.size,c.width,c.height);gl.uniform2f(loc.flip,L.fx?1:0,L.fy?1:0);gl.uniform1f(loc.op,L.op);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,glTex(L,img));gl.uniform1i(loc.tex,0);gl.drawArrays(gl.TRIANGLES,0,6);
      ctx.drawImage(c,0,0);return;}
    catch(e){GL=false;}}
  drawWarp2D(L,img,map);}
/* fallback: 10 × 10 cells of two affine triangles each */
function drawWarp2D(L,img,map){const n=10,iw=img.naturalWidth,ih=img.naturalHeight,T=(s,t)=>[(L.fx?1-s:s)*iw,(L.fy?1-t:t)*ih];
  ctx.save();ctx.globalAlpha=L.op;
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){const s0=i/n,s1=(i+1)/n,t0=j/n,t1=(j+1)/n,A=map.fwd(s0,t0),B=map.fwd(s1,t0),Cc=map.fwd(s1,t1),D=map.fwd(s0,t1);
    affTri(img,T(s0,t0),T(s1,t0),T(s1,t1),A,B,Cc);affTri(img,T(s0,t0),T(s1,t1),T(s0,t1),A,Cc,D);}
  ctx.restore();}
function affTri(img,a,b,c,A,B,Cc){const u0=b[0]-a[0],u1=b[1]-a[1],v0=c[0]-a[0],v1=c[1]-a[1],den=u0*v1-v0*u1;if(Math.abs(den)<1e-9)return;
  const U0=B[0]-A[0],U1=B[1]-A[1],V0=Cc[0]-A[0],V1=Cc[1]-A[1],m11=(U0*v1-V0*u1)/den,m12=(u0*V0-v0*U0)/den,m21=(U1*v1-V1*u1)/den,m22=(u0*V1-v0*U1)/den;
  /* grow the clip triangle by half a pixel so neighbouring cells don't leave hairline seams */
  const cx=(A[0]+B[0]+Cc[0])/3,cy=(A[1]+B[1]+Cc[1])/3,g=p=>{const dx=p[0]-cx,dy=p[1]-cy,l=Math.hypot(dx,dy)||1;return[p[0]+dx/l*0.6,p[1]+dy/l*0.6];};
  const P=[g(A),g(B),g(Cc)];ctx.save();ctx.beginPath();ctx.moveTo(P[0][0],P[0][1]);ctx.lineTo(P[1][0],P[1][1]);ctx.lineTo(P[2][0],P[2][1]);ctx.closePath();ctx.clip();
  ctx.transform(m11,m21,m12,m22,A[0]-m11*a[0]-m12*a[1],A[1]-m21*a[0]-m22*a[1]);ctx.drawImage(img,0,0);ctx.restore();}
