import * as T from '../vendor/three.module.js';
import {surfaceAt} from './world.js';
import {BOSSES,inHazard} from './bosses.js';

const RED=0xff3b2a,UNBLOCKABLE=0xff2d86,SHAPES={circle:0,pool:0,ring:1,cone:2,line:3},RAIN=new Set(['hail','meteors','crowns']),WAVES={ice:0x9fe4ff,rift:0xc6a4ff};
// Rain circles are recognised by an explicit field or by the boss's rain radius (unique among its circles).
const RAIN_R=Object.fromEntries(Object.entries(BOSSES).map(([k,b])=>[k,b.attacks.find(a=>a.shape==='rain')?.radius])),SELF=new Set(['parry','evade','dodge','guard-break','reflect']);
const POOL_STYLE={mire:[0x22360e,0x8fdc4f,0],cinder:[0x6a1603,0xffa040,1.3]};
const num=(v,d=0)=>Number.isFinite(v)?v:d,isRain=e=>!!e.rain||RAIN.has(e.attack)||e.shape==='circle'&&Math.abs(num(e.radius)-num(RAIN_R[e.style],-9))<.01,clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),has=e=>Number.isFinite(e?.x)&&Number.isFinite(e?.z);
const VS=`varying vec2 vL;void main(){vL=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
// Hazard telegraph: faint shape, a fill growing from the origin that reaches the rim at resolve, a pulsing rim.
const HAZARD_FS=`uniform vec3 color,tint;uniform float progress,time,pulse,shape,radius,inner,angle,len,width,alpha,flash;varying vec2 vL;
void main(){float d=length(vL),m,edge;
if(shape<.5){m=d/max(radius,.01);edge=radius-d;}
else if(shape<1.5){m=(d-inner)/max(radius-inner,.01);edge=min(d-inner,radius-d);}
else if(shape<2.5){float a=abs(atan(vL.x,vL.y)),side=a<angle?d*sin(min(angle-a,1.5708)):-1.;edge=min(radius-d,max(side,1.2-d));m=d/max(radius,.01);}
else{m=vL.y/max(len,.01);edge=min(width*.5-abs(vL.x),min(vL.y,len-vL.y));}
if(edge<0.)discard;
float beat=.72+.28*sin(time*pulse),rim=smoothstep(.5,0.,edge),fill=step(m,progress),front=fill*smoothstep(progress-.07,progress,m)*step(.002,progress),flow=.5+.5*sin(m*18.-time*5.);
vec3 c=mix(color,tint,.18*(1.-rim)*(1.-front)*fill+.12*(1.-fill));c=mix(c,vec3(1.,.95,.88),front*.5+flash*.55);
float a=.16+.06*flow*(1.-fill)+fill*(.36+.08*flow)+front*.55+rim*beat*.95;
gl_FragColor=vec4(c*(1.+.35*rim*beat),min(1.,max(a,flash*.85))*alpha);}`;
const POOL_FS=`uniform vec3 color,glow;uniform float time,radius,alpha,hot;varying vec2 vL;
void main(){float d=length(vL),e=radius-d;if(e<0.)discard;
float n=sin(vL.x*1.9+time*1.4)*sin(vL.y*2.1-time*1.2)+.6*sin((vL.x-vL.y)*3.3+time*2.6),b=smoothstep(.8,1.25,n),r=smoothstep(.45,0.,e);
gl_FragColor=vec4(mix(color,glow,b*.75+r*.55)*(1.+hot*(b+r)),(.78*smoothstep(0.,.5,e)+r*.5)*alpha);}`;
// Terrain-hugging mesh for a hazard shape (polar for circle/ring/cone/pool, strips for lines). Local +z is forward (sin yaw, cos yaw).
function groundGeometry(h,y0,lift=.07,soft=false){
 const s=h.shape,R=Math.max(.05,num(h.radius)),yaw=num(h.yaw),c=Math.cos(yaw),sn=Math.sin(yaw),pos=[],col=[],idx=[];let cols,rows,at;
 if(s==='line'){const L=Math.max(.05,num(h.length)),W=Math.max(.05,num(h.width));cols=clamp(Math.ceil(W/1.2),2,8);rows=clamp(Math.ceil(L/1.2),1,48);at=(i,j)=>[-W/2+W*i/cols,L*j/rows,Math.min(1,Math.min(i,cols-i)/cols*2)];}
 else{const I=s==='ring'?clamp(num(h.inner),0,R):0,A=Math.PI;cols=clamp(Math.ceil(2*A*R/1.3),12,72);rows=clamp(Math.ceil((R-I)/1.2),1,24);at=(i,j)=>{const t=-A+2*A*i/cols,r=I+(R-I)*j/rows;return[Math.sin(t)*r,Math.cos(t)*r,1-j/rows];};}
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const [lx,lz,k]=at(i,j),y=surfaceAt(h.x+lx*c+lz*sn,h.z-lx*sn+lz*c);pos.push(lx,(Number.isFinite(y)?y-y0:0)+lift,lz);if(soft){const f=Math.min(1,k*2.2);col.push(f,f,f);}}
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+1,d=a+cols+1;idx.push(a,d,b,b,d,d+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));if(soft)g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeBoundingSphere();return g;
}
// Crescent wave: a flat tapering blade plus a low curved wall so it reads from eye height. Bulges toward +z.
function crescentGeometry(){const pos=[],idx=[],n=24,A=1.15;for(let i=0;i<=n;i++){const a=-A+2*A*i/n,u=a/A,t=.36*(1-u*u),h=.42*(1-u*u)+.02,s=Math.sin(a),c=Math.cos(a);pos.push(s,0,c,s*(1-t),0,c*(1-t),s,h,c,s,-h,c);}for(let i=0;i<n;i++){const a=i*4,b=a+4;idx.push(a,a+1,b,b,a+1,b+1,a+2,a+3,b+2,b+2,a+3,b+3);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeBoundingSphere();return g;}

// One fixed particle buffer serves every spell. Expired effects return their slots.
export function createSpellEffects(scene,settings={}){
 const root=new T.Group();root.name='spell-effects';scene.add(root);
 const capacity=1800,positions=new Float32Array(capacity*3),colors=new Float32Array(capacity*3),sizes=new Float32Array(capacity),alphas=new Float32Array(capacity),particles=new Array(capacity).fill(null);
 const geometry=new T.BufferGeometry();for(const [name,array,size]of[['position',positions,3],['color',colors,3],['size',sizes,1],['alpha',alphas,1]])geometry.setAttribute(name,new T.BufferAttribute(array,size).setUsage(T.DynamicDrawUsage));
 const particleMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,vertexColors:true,uniforms:{viewport:{value:700}},vertexShader:`attribute float size;attribute float alpha;varying vec3 vColor;varying float vAlpha;uniform float viewport;void main(){vColor=color;vAlpha=alpha;vec4 view=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*view;gl_PointSize=clamp(size*viewport/max(1.,-view.z),1.,80.);}`,fragmentShader:`varying vec3 vColor;varying float vAlpha;void main(){float d=length(gl_PointCoord-.5)*2.;float glow=pow(max(0.,1.-d),2.);gl_FragColor=vec4(vColor*1.8,glow*vAlpha);}`});
 const points=new T.Points(geometry,particleMaterial);points.frustumCulled=false;root.add(points);
 const sphere=new T.IcosahedronGeometry(1,2),crystal=new T.OctahedronGeometry(1,0),ringGeometry=new T.RingGeometry(.95,1,64),torusGeometry=new T.TorusGeometry(1,.025,6,64);
 const capsule=new T.CapsuleGeometry(.3,1.1,4,10),spike=new T.ConeGeometry(1,1,5,1).translate(0,.5,0),cylinder=new T.CylinderGeometry(1,1,1,24,1,true).translate(0,.5,0),crescent=crescentGeometry();
 const shared=new Set([sphere,crystal,ringGeometry,torusGeometry,capsule,spike,cylinder,crescent]);
 const effects=[],bolts=new Map(),telegraphs=new Map(),shots=new Map(),hazards=new Map(),pools=new Map(),colorCache=new Map();let cursor=0,time=0,ambient=0,player=null,lastDodge=null;
 const low=()=>settings.quality==='low',qn=n=>Math.max(1,Math.ceil(n*(low()?.45:1)));
 const mat=(color,opacity=.8)=>{const m=new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(1.35),transparent:true,opacity,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});m.userData.base=opacity;return m;};
 const dark=(color,opacity)=>{const m=new T.MeshBasicMaterial({color,transparent:true,opacity,side:T.DoubleSide,depthWrite:false});m.userData.base=opacity;return m;};
 const ground=(x,z,dy=.08)=>({x,y:surfaceAt(x,z)+dy,z}),P=(e,dy=0)=>({x:e.x,y:(Number.isFinite(e.y)?e.y:surfaceAt(e.x,e.z))+dy,z:e.z}),V=p=>new T.Vector3(p.x,Number.isFinite(p.y)?p.y:surfaceAt(p.x,p.z)+1,p.z);
 const styleBurst=key=>key==='frost'?'ice':key==='cinder'?'ember':'spark';
 function mesh(parent,geo,material){const m=new T.Mesh(geo,material);parent.add(m);return m;}
 function disposeObject(object){object.removeFromParent();const geos=new Set(),materials=new Set();object.traverse(o=>{if(o.geometry&&!shared.has(o.geometry))geos.add(o.geometry);if(o.material)materials.add(o.material);});for(const g of geos)g.dispose();for(const m of materials)m.dispose();}
 // fade: true keeps the original flat envelope; 'base' scales each material's own opacity; false leaves it to animate.
 function add(object,duration,animate=()=>{},fade=true){root.add(object);effects.push({object,duration,remaining:duration,animate,fade});while(effects.length>48)disposeObject(effects.shift().object);return object;}
 function rgb(color){let c=colorCache.get(color);if(!c){if(colorCache.size>96)colorCache.clear();const k=new T.Color(color);c=[k.r,k.g,k.b];colorCache.set(color,c);}return c;}
 function particle(p,color,{vx=0,vy=1,vz=0,life=.7,size=.15,gravity=0,drag=0}={}){if(!Number.isFinite(p.x+p.y+p.z))return;const i=cursor++%capacity,[r,g,b]=rgb(color);particles[i]={x:p.x,y:p.y,z:p.z,vx,vy,vz,life,total:life,size,gravity,drag,r,g,b};}
 function burst(p,color,count=40,speed=3,style='spark'){
  const n=Math.ceil(count*(low()?.45:1)),dust=style==='dust';for(let i=0;i<n;i++){const a=i*2.3999,u=Math.random()*2-1,r=Math.sqrt(1-u*u),v=speed*(.35+Math.random()*.65);particle(p,color,{vx:Math.cos(a)*r*v,vy:dust?Math.abs(u)*v*.5+.6:u*v+(style==='ember'?2:1),vz:Math.sin(a)*r*v,life:.4+Math.random()*.9,size:style==='ember'?.3:dust?.22+Math.random()*.14:.12+Math.random()*.13,gravity:style==='ice'?4:dust?2.5:.5,drag:style==='ember'?1:dust?2.2:.3});}
 }
 function rune(p,radius,color,duration=1.1,{rise=0,expand=true}={}){
  const g=new T.Group();g.position.set(p.x,p.y??surfaceAt(p.x,p.z)+.1,p.z);const material=mat(color,.7);
  for(const r of [1,.82]){const m=mesh(g,ringGeometry,material);m.rotation.x=-Math.PI/2;m.scale.setScalar(r);}
  const segments=[];for(let i=0;i<24;i++){const a=i/24*Math.PI*2;for(const [r1,r2,da]of[[.88,.97,0],[.88,.94,.025]])segments.push(Math.cos(a)*r1,0,Math.sin(a)*r1,Math.cos(a+da)*r2,0,Math.sin(a+da)*r2);}
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2,b=(i+3)/8*Math.PI*2;segments.push(Math.cos(a)*.69,0,Math.sin(a)*.69,Math.cos(b)*.69,0,Math.sin(b)*.69);}
  const lineMat=new T.LineBasicMaterial({color:new T.Color(color).multiplyScalar(1.3),transparent:true,opacity:.85,depthWrite:false,blending:T.AdditiveBlending});g.add(new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(segments,3)),lineMat));
  g.scale.setScalar(radius*.25);add(g,duration,(age,dt)=>{const k=expand?Math.min(1,age*4):1;g.scale.setScalar(radius*(.25+k*.75));g.rotation.y+=dt*.3;g.position.y=(p.y??surfaceAt(p.x,p.z)+.1)+age*rise;});return g;
 }
 function shockwave(p,radius,color,duration=.65){const g=new T.Group();g.position.set(p.x,p.y,p.z);const shell=mesh(g,sphere,mat(color,.18));shell.scale.y=.35;const ring=mesh(g,ringGeometry,mat(color,.8));ring.rotation.x=-Math.PI/2;add(g,duration,age=>{g.scale.setScalar(.1+radius*age);});}
 function ripple(p,radius,color,duration=.6,from=.2){const g=new T.Group();g.position.set(p.x,p.y,p.z);for(const [s,o]of[[1,.85],[.9,.4]]){const m=mesh(g,ringGeometry,mat(color,o));m.rotation.x=-Math.PI/2;m.scale.setScalar(s);}add(g,duration,age=>{g.scale.setScalar(from+(radius-from)*(1-(1-age)*(1-age)));},'base');}
 function column(p,radius,height,color,duration){const g=new T.Group();g.position.set(p.x,p.y,p.z);const outer=mesh(g,cylinder,mat(color,.32)),inner=mesh(g,cylinder,mat(0xfff6e0,.55));add(g,duration,age=>{const up=Math.min(1,age*duration*3),w=radius*(1+age*.35);outer.scale.set(w,height*up,w);inner.scale.set(w*.32,height*up,w*.32);},'base');}
 function arc(from,to,color){const a=new T.Vector3(from.x,from.y,from.z),b=new T.Vector3(to.x,to.y,to.z),pts=[];for(let i=0;i<=14;i++){const p=a.clone().lerp(b,i/14);if(i&&i<14)p.add(new T.Vector3((Math.random()-.5)*.6,(Math.random()-.5)*.6,(Math.random()-.5)*.6));pts.push(p);}const g=new T.Group(),geo=new T.TubeGeometry(new T.CatmullRomCurve3(pts),28,.023,5,false);mesh(g,geo,mat(0xf5fbff,1));mesh(g,geo.clone(),mat(color,.32)).scale.setScalar(1.001);for(const j of [4,9]){const branch=[pts[j],pts[j].clone().add(new T.Vector3(.5,.3,-.2)),pts[j].clone().add(new T.Vector3(.7,-.5,.3))];mesh(g,new T.TubeGeometry(new T.CatmullRomCurve3(branch),8,.015,4,false),mat(color,.7));}add(g,.3,age=>{g.visible=Math.sin(age*40)>-.5;});burst(to,color,18,2);}
 function icicles(p,radius,color){const g=new T.Group();g.position.set(p.x,surfaceAt(p.x,p.z),p.z);const material=mat(color,.7);for(let i=0;i<10;i++){const a=i/10*Math.PI*2,m=mesh(g,crystal,material);m.position.set(Math.cos(a)*radius,.25,Math.sin(a)*radius);m.scale.set(.1,.3+Math.random()*.5,.1);}add(g,.85,(age)=>{g.scale.y=Math.sin(age*Math.PI);});}
 function roots(p,radius,color){rune(p,radius,color,1.7);const g=new T.Group();g.position.set(p.x,p.y,p.z);const material=new T.MeshStandardMaterial({color:0x556b37,emissive:color,emissiveIntensity:.25,roughness:.95,transparent:true,opacity:1});for(let i=0;i<14;i++){const a=i*2.4,r=radius*(.25+(i%4)*.2),path=[];for(let j=0;j<8;j++){const t=j/7;path.push(new T.Vector3(Math.cos(a+t*2)*(.3+t*.1),t*1.8,Math.sin(a+t*2)*(.3+t*.1)));}const vine=mesh(g,new T.TubeGeometry(new T.CatmullRomCurve3(path),12,.055,5,false),material);vine.position.set(Math.cos(a)*r,0,Math.sin(a)*r);}add(g,2,(age)=>{g.scale.y=Math.min(1,age*7)*(1-Math.max(0,(age-.75)*4));});}
 function blink(e){const from=new T.Vector3(e.from.x,e.from.y,e.from.z),to=new T.Vector3(e.to.x,e.to.y,e.to.z);for(const p of [from,to]){const g=new T.Group();g.position.copy(p);g.rotation.y=e.yaw||0;const r=mesh(g,torusGeometry,mat(e.color));r.scale.set(.6,1,1);add(g,.7,age=>{g.scale.setScalar(Math.sin(age*Math.PI));});burst(p,e.color,45,2.4);}const length=from.distanceTo(to),count=Math.ceil(length*7);for(let i=0;i<count;i++){const p=from.clone().lerp(to,i/Math.max(1,count-1));p.y+=Math.sin(i*2.4)*.5;particle(p,e.color,{life:.3+Math.random()*.5,size:.22,vy:.4});}}
 function meteor(e){rune(e,e.radius,e.color,e.duration,{expand:false});const g=new T.Group();const core=mesh(g,sphere,new T.MeshBasicMaterial({color:0x402c31}));core.scale.setScalar(.8);const shell=mesh(g,sphere,mat(e.color,.65));shell.scale.setScalar(1);g.position.set(e.x+6,e.y+23,e.z-4);let trail=0;add(g,e.duration,(age,dt)=>{g.position.set(e.x+(1-age)*6,e.y+(1-age)*23,e.z-(1-age)*4);g.rotation.x+=dt*3;g.rotation.z+=dt*2;trail+=dt;if(trail>.02){trail=0;burst(g.position,e.color,8,1.4,'ember');}},false);}
 function blizzard(e){rune(e,e.radius,e.color,e.duration,{expand:false});const g=new T.Group();g.position.set(e.x,e.y,e.z);const material=mat(e.color,.23);for(let i=0;i<3;i++){const r=mesh(g,torusGeometry,material);r.rotation.x=Math.PI/2;r.position.y=.5+i*.85;r.scale.setScalar(e.radius*(.5+i*.16));}let timer=0;add(g,e.duration,(age,dt)=>{g.rotation.y+=dt;for(let i=0;i<g.children.length;i++)g.children[i].rotation.y=Math.sin(time+i)*.12;timer+=dt;if(timer>.045){timer=0;const count=settings.quality==='low'?4:10;for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*e.radius;particle({x:e.x+Math.cos(a)*r,y:e.y+1+Math.random()*3,z:e.z+Math.sin(a)*r},e.color,{vx:-Math.sin(a)*2.5,vz:Math.cos(a)*2.5,vy:-2,size:.12,life:1.1});}}},true);}
 // Player-centred feedback sits just in front of the camera (player forward = (-sin yaw, -cos yaw)) and faces it.
 function ahead(e,d=.95){const yaw=num(player?.yaw),y=Number.isFinite(e.y)?e.y:surfaceAt(e.x,e.z)+1.2;return{x:e.x-Math.sin(yaw)*d,y,z:e.z-Math.cos(yaw)*d,yaw};}
 function sparkRing(e,color,scale=.6,count=24){const p=ahead(e),g=new T.Group();g.position.set(p.x,p.y,p.z);g.rotation.y=p.yaw;const a=mesh(g,torusGeometry,mat(color,.95)),b=mesh(g,torusGeometry,mat(0xffffff,.7)),core=mesh(g,sphere,mat(color,.5));add(g,.34,age=>{const k=1-(1-age)*(1-age);a.scale.setScalar(.12+scale*k);b.scale.setScalar(.08+scale*.8*k);core.scale.setScalar(.14*(1-age));},'base');const rx=Math.cos(p.yaw),rz=-Math.sin(p.yaw),n=qn(count);for(let i=0;i<n;i++){const t=i/n*Math.PI*2+Math.random()*.2,v=4+Math.random()*3;particle(p,i%3?color:0xffffff,{vx:rx*Math.cos(t)*v,vy:Math.sin(t)*v,vz:rz*Math.cos(t)*v,life:.22+Math.random()*.16,size:.07,drag:3});}}
 function afterimage(e){const perfect=!!e.perfect,col=perfect?0xffe08a:0x9fd0ff,d=lastDodge&&time-lastDodge.t<.7?lastDodge:null,p=ground(e.x-(d?.x||0)*.7,e.z-(d?.z||0)*.7,0),g=new T.Group();g.position.set(p.x,p.y,p.z);const m=mat(col,perfect?.42:.28);m.side=T.FrontSide;mesh(g,capsule,m).position.y=.95;const head=mesh(g,sphere,m);head.scale.setScalar(.22);head.position.y=1.72;add(g,perfect?.7:.45,(age,dt)=>{g.scale.set(1+age*.6,1+age*.08,1+age*.6);if(d){g.position.x-=d.x*dt*1.2;g.position.z-=d.z*dt*1.2;}},'base');for(let i=0;i<qn(14);i++)particle({x:p.x+(Math.random()-.5)*.5,y:p.y+.3+Math.random()*1.5,z:p.z+(Math.random()-.5)*.5},col,{vx:-(d?.x||0)*2,vz:-(d?.z||0)*2,vy:.2,life:.35+Math.random()*.25,size:.14,drag:2});if(perfect){ripple(ground(e.x,e.z),3.2,col,.55);sparkRing(e,col,.75,30);}}
 function dodgeDust(e){const l=Math.hypot(num(e.dx),num(e.dz)),dx=l>1e-4?e.dx/l:0,dz=l>1e-4?e.dz/l:0;lastDodge={x:dx,z:dz,t:time};const p=ground(e.x,e.z,.12);for(let i=0;i<qn(16);i++){const a=Math.random()*Math.PI*2,v=.8+Math.random()*1.6;particle({x:p.x+(Math.random()-.5)*.6,y:p.y,z:p.z+(Math.random()-.5)*.6},i%4?0xb9a88a:0xe0d6c2,{vx:-dx*2.6+Math.cos(a)*v,vz:-dz*2.6+Math.sin(a)*v,vy:.5+Math.random(),gravity:2.2,drag:2.4,life:.5+Math.random()*.3,size:.26});}}
 function stagger(e){const boss=!!e.boss,p=P(e,boss?.9:.5),n=boss?8:5,col=0xffe27a,g=new T.Group();g.position.set(p.x,p.y,p.z);const m=mat(col,.95),stars=[];for(let i=0;i<n;i++)stars.push(mesh(g,crystal,m));add(g,.85,age=>{for(let i=0;i<n;i++){const a=i/n*Math.PI*2+age*4,r=(boss?1.3:.45)+age*(boss?2.6:1.2),s=(boss?.3:.17)*(1-age*.5);stars[i].position.set(Math.cos(a)*r,age*.8+Math.sin(age*9+i)*.1,Math.sin(a)*r);stars[i].rotation.set(age*6,age*9+i,0);stars[i].scale.set(s,s,s*.35);}},'base');burst(p,col,boss?60:22,boss?5:2.6);if(boss){ripple(ground(e.x,e.z),6,col,.7);shockwave(p,4.5,col,.5);}}
 function earthshatter(e){
  const yaw=num(e.yaw),L=clamp(num(e.length,15),1,60),W=clamp(num(e.width,3),.5,12),col=e.color??0xd9ad6c,fx=Math.sin(yaw),fz=Math.cos(yaw),y0=surfaceAt(e.x,e.z),g=new T.Group();g.position.set(e.x,y0,e.z);g.rotation.y=yaw;
  const stone=new T.MeshStandardMaterial({color:0x6e5c48,roughness:.95,flatShading:true,emissive:col,emissiveIntensity:.12,transparent:true,opacity:1}),crackMat=mat(col,.55);crackMat.vertexColors=true;mesh(g,groundGeometry({shape:'line',x:e.x,z:e.z,yaw,length:L,width:W*.3},y0,.06,true),crackMat);
  const n=Math.min(26,Math.ceil(L/.8)),spikes=[];
  for(let i=0;i<n;i++){const along=(i+.5)/n*L,side=(i%2?1:-1)*(.15+Math.random()*.3)*W,wx=e.x+fx*along+Math.cos(yaw)*side,wz=e.z+fz*along-Math.sin(yaw)*side,m=mesh(g,spike,stone),w=.28+Math.random()*.3;m.position.set(side,surfaceAt(wx,wz)-y0-.1,along);m.rotation.set((Math.random()-.5)*.5,Math.random()*3,(Math.random()-.5)*.5);m.scale.set(w,.001,w);spikes.push({m,w,h:1.1+Math.random()*1.4+(i%3===0?.8:0),delay:along/L*.32,wx,wz,up:false});}
  const dur=1.9;add(g,dur,age=>{const t=age*dur;for(const s of spikes){const k=t-s.delay;if(k<0)continue;if(!s.up){s.up=true;burst({x:s.wx,y:surfaceAt(s.wx,s.wz)+.2,z:s.wz},0xb59a78,5,2.2,'dust');}const up=Math.min(1,k/.09),sink=clamp((k-.95)/.45,0,1);s.m.scale.set(s.w,Math.max(.001,s.h*up*(1-sink)),s.w);}crackMat.opacity=.55*Math.min(1,(1-age)*2.5);stone.opacity=1-clamp((age-.85)/.15,0,1);},false);
 }
 function thunderstorm(e){
  const p=P(e,.1),R=clamp(num(e.radius,9),1,30),dur=clamp(num(e.duration,2.4),.3,20)+.6,col=e.color??0xaebcff;rune(p,R,col,dur,{expand:false});
  const g=new T.Group();g.position.set(p.x,p.y+14,p.z);const cloud=dark(0x262a38,0),glow=mat(col,0);
  for(let i=0;i<9;i++){const a=i*2.4,r=i?R*(.3+.5*((i*7)%5)/5):0,m=mesh(g,sphere,cloud);m.position.set(Math.cos(a)*r,(i%3)*.4,Math.sin(a)*r);m.scale.set(R*.42,R*.13,R*.42);}
  const flash=mesh(g,sphere,glow);flash.scale.set(R*.8,R*.12,R*.8);flash.position.y=-.3;let timer=0;
  add(g,dur,(age,dt)=>{const env=Math.min(1,age*dur/.35)*Math.min(1,(1-age)*dur/.5);cloud.opacity=.82*env;glow.opacity=(Math.random()<.06?.45:glow.opacity*.8)*env;g.rotation.y+=dt*.25;timer+=dt;if(timer>.04){timer=0;for(let i=0;i<qn(5);i++){const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*R;particle({x:p.x+Math.cos(a)*r,y:p.y+13,z:p.z+Math.sin(a)*r},0x9fb4e8,{vy:-19,life:.68,size:.07});}}},false);
 }
 function siphon(e){
  if(!has(e.from)||!has(e.to))return;const a=V(e.from),b=V(e.to),col=e.color??0xe0739b,mid=a.clone().lerp(b,.5);mid.y+=e.miss?.3:.9;const curve=new T.QuadraticBezierCurve3(a,mid,b),g=new T.Group();
  mesh(g,new T.TubeGeometry(curve,24,.03,5,false),mat(0xffe6ef,e.miss?.4:.9));mesh(g,new T.TubeGeometry(curve,24,.1,6,false),mat(col,e.miss?.15:.35));
  if(e.miss){add(g,.3,age=>{g.visible=Math.sin(age*60)>-.3;},'base');burst(b,col,10,1.2);return;}
  let timer=0;const tmp=new T.Vector3();add(g,.8,(age,dt)=>{g.visible=Math.sin(age*50)>-.8;timer+=dt;if(timer>.025){timer=0;for(let i=0;i<qn(3);i++){curve.getPoint(.55+Math.random()*.45,tmp);const life=.4+Math.random()*.15;particle({x:tmp.x+(Math.random()-.5)*.3,y:tmp.y+(Math.random()-.5)*.3,z:tmp.z+(Math.random()-.5)*.3},i%2?col:0xff9dbb,{vx:(a.x-tmp.x)/life,vy:(a.y-tmp.y)/life,vz:(a.z-tmp.z)/life,life,size:.18});}}},'base');
  burst(b,col,30,2.2);ripple({x:a.x,y:surfaceAt(a.x,a.z)+.08,z:a.z},1.4,0x89efb7,.6);
 }
 function embers(e){
  const p=P(e,0),R=clamp(num(e.radius,2.6),.3,20),dur=clamp(num(e.duration,3),.2,30),col=e.color??0xff8b43,g=new T.Group();g.position.set(p.x,p.y,p.z);const m=mat(col,.28);m.vertexColors=true;mesh(g,groundGeometry({shape:'circle',x:p.x,z:p.z,radius:R},p.y,.05,true),m);let timer=0;
  add(g,dur,(age,dt)=>{m.opacity=(.2+Math.random()*.1)*Math.min(1,(1-age)*dur/.4)*Math.min(1,age*dur/.2);timer+=dt;if(timer>.05){timer=0;for(let i=0;i<qn(5);i++){const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*R,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;particle({x,y:surfaceAt(x,z)+.1,z},Math.random()<.3?0xffd27a:col,{vy:1.4+Math.random()*1.4,vx:(Math.random()-.5)*.4,vz:(Math.random()-.5)*.4,life:.45+Math.random()*.4,size:.22+Math.random()*.2,drag:.6});}}},false);
 }
 function summon(e){const p=ground(e.x,e.z,.09),col=e.color??0x9be36b,g=new T.Group();g.position.set(p.x,p.y,p.z);const disc=mesh(g,groundGeometry({shape:'circle',x:p.x,z:p.z,radius:1.9},p.y,.02),dark(0x07040c,.6));let timer=0;add(g,1.6,(age,dt)=>{disc.material.opacity=.6*Math.min(1,age*8)*Math.min(1,(1-age)*3);timer+=dt;if(timer>.05){timer=0;for(let i=0;i<qn(4);i++){const a=Math.random()*Math.PI*2,r=Math.random()*1.6;particle({x:p.x+Math.cos(a)*r,y:p.y+.1,z:p.z+Math.sin(a)*r},col,{vy:1.2+Math.random()*1.5,life:.7,size:.2,drag:.4});}}},false);rune(p,1.8,col,1.6);column(p,.8,3.2,col,.9);burst({...p,y:p.y+.5},col,26,2.2);}
 function bossBlink(e){if(!has(e.from)||!has(e.to))return;const a=V(e.from),b=V(e.to),col=e.color??0x9be36b;for(const [p,inward]of[[a,true],[b,false]]){const g=new T.Group();g.position.copy(p);for(let i=0;i<2;i++){const r=mesh(g,torusGeometry,mat(col,.9));r.rotation.x=Math.PI/2;r.position.y=i*.9-.4;}add(g,.6,age=>{const k=inward?1-age:Math.min(1,age*3);g.scale.set(.2+2.2*k,1,.2+2.2*k);},'base');column({x:p.x,y:surfaceAt(p.x,p.z),z:p.z},inward?1.1:1.4,4.5,col,.6);burst(p,col,inward?30:50,inward?1.6:3.2);}const n=Math.min(90,Math.ceil(a.distanceTo(b)*6));for(let i=0;i<n;i++){const p=a.clone().lerp(b,i/Math.max(1,n-1));p.y+=Math.sin(i*2.4)*.7;particle(p,col,{life:.3+Math.random()*.6,size:.3,vy:.3});}}
 function bossDash(e){if(!has(e.from)||!has(e.to))return;const a=V(e.from),b=V(e.to),col=e.color??0xc6a4ff,len=Math.hypot(b.x-a.x,b.z-a.z);if(len<.05)return;const y0=surfaceAt(a.x,a.z),g=new T.Group();g.position.set(a.x,y0,a.z);g.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);const m=mat(col,.5);m.vertexColors=true;mesh(g,groundGeometry({shape:'line',x:a.x,z:a.z,yaw:g.rotation.y,length:len,width:2},y0,.06,true),m);add(g,.9,()=>{},'base');const n=Math.min(70,Math.ceil(len*2.5));for(let i=0;i<n;i++){const t=i/Math.max(1,n-1),x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=surfaceAt(x,z);particle({x:x+(Math.random()-.5)*.8,y:y+.2+Math.random()*1.6,z:z+(Math.random()-.5)*.8},col,{life:.3+t*.5,size:.26,vy:.5,drag:1});if(i%3===0)particle({x,y:y+.1,z},0xb8a88c,{vx:(Math.random()-.5)*2,vz:(Math.random()-.5)*2,vy:1,life:.6,size:.3,drag:2});}burst(b,col,40,4);ripple({x:b.x,y:surfaceAt(b.x,b.z)+.08,z:b.z},3.5,col,.5);}
 function bossDefeat(e){const p=ground(e.x,e.z,0),c=P(e,1.5),col=e.color??0xfff0c0;column(p,3,70,col,5);rune({...p,y:p.y+.1},7,col,4.5);shockwave(c,24,col,1.8);burst(c,col,260,12,'ember');burst(c,0xfff4d8,140,6);let timer=0;add(new T.Group(),4.2,(age,dt)=>{timer+=dt;if(timer>.05){timer=0;for(let i=0;i<qn(6);i++){const a=Math.random()*Math.PI*2,r=Math.random()*2.6;particle({x:p.x+Math.cos(a)*r,y:p.y+Math.random()*3,z:p.z+Math.sin(a)*r},i%2?col:0xfff4d8,{vy:3+Math.random()*4,life:1.4,size:.3,drag:.2});}}},false);}
 // Pieces fall onto rain circles when combat names the attack (optional field); they land exactly at resolve.
 function faller(g,e){const col=e.style==='cinder'?0xff7a2a:e.style==='hollow'?0xc6a4ff:0xd8f5ff,m=mesh(g,e.style==='cinder'?sphere:crystal,e.style==='cinder'?mat(col,.9):mat(col,.85));if(e.style==='cinder')m.scale.setScalar(.55);else m.scale.set(.25,.9,.25);m.position.y=22;return m;}
 function addHazard(e){
  const old=hazards.get(e.id);if(old){disposeObject(old.group);hazards.delete(e.id);}while(hazards.size>=24){let id=null,best=Infinity;for(const [k,h]of hazards){const v=h.mode==='wait'?h.remaining:-9;if(v<best){best=v;id=k;}}disposeObject(hazards.get(id).group);hazards.delete(id);}
  const R=Math.max(.1,num(e.radius)),y0=num(e.y,surfaceAt(e.x,e.z)),h={...e,yaw:num(e.yaw),radius:R},g=new T.Group();g.position.set(e.x,y0,e.z);g.rotation.y=h.yaw;
  const u={color:{value:new T.Color(e.unblockable?UNBLOCKABLE:RED)},tint:{value:new T.Color(BOSSES[e.style]?.color??e.color??RED)},progress:{value:0},time:{value:time},pulse:{value:e.unblockable?16:6},shape:{value:SHAPES[e.shape]??0},radius:{value:R},inner:{value:clamp(num(e.inner),0,R)},angle:{value:num(e.angle,.5)},len:{value:Math.max(.1,num(e.length))},width:{value:Math.max(.1,num(e.width))},alpha:{value:1},flash:{value:0}};
  const material=new T.ShaderMaterial({uniforms:u,vertexShader:VS,fragmentShader:HAZARD_FS,transparent:true,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,toneMapped:false});
  const surface=mesh(g,groundGeometry(h,y0,.07),material);surface.renderOrder=2;root.add(g);
  hazards.set(e.id,{group:g,u,total:Math.max(.05,num(e.duration,1)),remaining:Math.max(.05,num(e.duration,1)),mode:'wait',t:0,span:1,fall:isRain(e)?faller(g,e):null,style:e.style,trail:0,x:e.x,y:y0,z:e.z});
 }
 function endHazard(id,mode,span){const h=hazards.get(id);if(h&&h.mode==='wait'){h.mode=mode;h.t=h.span=span;if(h.fall)h.fall.visible=false;}}
 function scatter(h,n){const out=[],c=Math.cos(h.yaw),s=Math.sin(h.yaw),R=h.radius,L=Math.max(.1,num(h.length)),W=Math.max(.1,num(h.width));for(let k=0;k<n*10&&out.length<n;k++){const lx=h.shape==='line'?(Math.random()-.5)*W:(Math.random()*2-1)*R,lz=h.shape==='line'?Math.random()*L:(Math.random()*2-1)*R,p={x:h.x+lx*c+lz*s,z:h.z-lx*s+lz*c};if(inHazard(h,p,0)){p.y=surfaceAt(p.x,p.z);out.push(p);}}return out;}
 function shards(pts,c,violet){const g=new T.Group();g.position.set(c.x,c.y,c.z);const m=violet?mat(0xb58cff,.85):new T.MeshStandardMaterial({color:0xdff6ff,emissive:0x4fa8d8,emissiveIntensity:.7,roughness:.12,metalness:.1,flatShading:true,transparent:true,opacity:1}),list=[];for(const p of pts){const s=mesh(g,crystal,m),h=violet?1.6+Math.random()*1.4:1+Math.random()*1.3,w=violet?.12:.2+Math.random()*.16;s.position.set(p.x-c.x,p.y-c.y,p.z-c.z);s.rotation.set((Math.random()-.5)*.6,Math.random()*3,(Math.random()-.5)*.6);s.scale.set(w,.001,w);list.push({s,h,w});}add(g,1.1,age=>{const grow=Math.min(1,age*12),sink=clamp((age-.55)/.45,0,1);for(const l of list)l.s.scale.set(l.w,Math.max(.001,l.h*grow*(1-sink*.9)),l.w);m.opacity=(m.userData.base??1)*(1-sink);},false);}
 const i2=p=>((p.x*7+p.z*13)|0)%3===0;
 function resolveImpact(e){
  const h={...e,yaw:num(e.yaw),radius:Math.max(.1,num(e.radius)),inner:num(e.inner),angle:num(e.angle,.5)},R=h.radius,area=e.shape==='line'?num(e.length)*num(e.width):e.shape==='ring'?Math.PI*(R*R-h.inner*h.inner):e.shape==='cone'?R*R*h.angle:Math.PI*R*R;
  const pts=scatter(h,clamp(Math.round(area/5),4,14)),c={x:e.x,y:num(e.y,surfaceAt(e.x,e.z))+.1,z:e.z},col=BOSSES[e.style]?.color??e.color??RED,round=e.shape==='circle'||e.shape==='ring'||e.shape==='pool';
  if(e.style==='frost'){shards(pts,c,false);for(const p of pts.slice(0,6))burst({x:p.x,y:p.y+.3,z:p.z},0xcff4ff,8,3,'ice');for(const p of pts)particle({x:p.x,y:p.y+.2,z:p.z},0xe8f8ff,{vx:(Math.random()-.5)*2,vz:(Math.random()-.5)*2,vy:.4,drag:1.5,life:1,size:.5});}
  else if(e.style==='mire'){for(const p of pts)for(let i=0;i<qn(7);i++)particle({x:p.x,y:p.y+.15,z:p.z},i%3?0x8fdc4f:0x4f8f2a,{vx:(Math.random()-.5)*3,vz:(Math.random()-.5)*3,vy:3.5+Math.random()*2.5,gravity:11,life:.7,size:.2});if(round)ripple(c,R,0x8fdc4f,.55,R*.3);}
  else if(e.style==='cinder'){for(const p of pts)burst({x:p.x,y:p.y+.2,z:p.z},i2(p)?0xffd27a:0xff8a3d,10,4.5,'ember');shockwave(c,round?R:Math.min(8,R||4),0xff7a2a,.6);}
  else if(e.style==='hollow'){shards(pts,c,true);for(const p of pts)for(let i=0;i<qn(4);i++)particle({x:p.x+(Math.random()-.5)*.6,y:p.y+.2,z:p.z+(Math.random()-.5)*.6},i%2?0xc6a4ff:0x7b4dff,{vy:2+Math.random()*2,life:.8,size:.24,drag:.5});if(round)ripple(c,R,0xc6a4ff,.5,R*.4);}
  else for(const p of pts)burst({x:p.x,y:p.y+.2,z:p.z},col,8,3);
  if(e.unblockable)shockwave(c,Math.min(Math.max(R,4),16),UNBLOCKABLE,.55);
  const hz=hazards.get(e.id);if(hz?.fall&&e.style)burst({x:e.x,y:c.y+.3,z:e.z},col,24,4,styleBurst(e.style));
 }
 function addPool(e){
  const old=pools.get(e.id);if(old){disposeObject(old.group);pools.delete(e.id);}while(pools.size>=12){const [id,p]=pools.entries().next().value;disposeObject(p.group);pools.delete(id);}
  const R=clamp(num(e.radius,3),.3,30),y0=num(e.y,surfaceAt(e.x,e.z)),[base,glow,hot]=POOL_STYLE[e.style]||[0x20130a,e.color??0xff5a3c,.4],g=new T.Group();g.position.set(e.x,y0,e.z);
  const u={color:{value:new T.Color(base)},glow:{value:new T.Color(glow)},time:{value:time},radius:{value:R},alpha:{value:0},hot:{value:hot}};
  const surface=mesh(g,groundGeometry({shape:'circle',x:e.x,z:e.z,radius:R},y0,.05),new T.ShaderMaterial({uniforms:u,vertexShader:VS,fragmentShader:POOL_FS,transparent:true,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,toneMapped:false}));surface.renderOrder=1;root.add(g);
  const duration=clamp(num(e.duration,6),.2,60);pools.set(e.id,{group:g,u,x:e.x,z:e.z,y:y0,radius:R,style:e.style,glow,age:0,remaining:duration,fade:null,timer:0});
 }
 function endPool(id){const p=pools.get(id);if(p&&p.fade==null)p.fade=.6;}
 function emit(e){
  if(!e||typeof e!=='object')return;
  if(e.type==='clear'){clear();return;}
  if(e.type==='cast'){rune({x:e.x,y:surfaceAt(e.x,e.z)+.1,z:e.z},.8,e.color,.65);return;}
  if(e.type==='lightning'){arc(e.from,e.to,e.color);return;}
  if(e.type==='meteor'){meteor(e);return;}
  if(e.type==='blizzard'){blizzard(e);return;}
  if(e.type==='blink'){blink(e);return;}
  if(e.type==='roots'){roots(e,e.radius,e.color);return;}
  if(e.type==='nova'){shockwave(e,e.radius,e.color,.75);rune(e,e.radius,e.color,.9);burst(e,e.color,65,8);return;}
  if(e.type==='heal'||e.type==='level'||e.type==='focus'){
   rune(e,e.type==='level'?3:2,e.color,1.7);const g=new T.Group();let timer=0;add(g,1.7,(age,dt)=>{timer+=dt;if(timer>.04){timer=0;for(let i=0;i<4;i++){const a=age*Math.PI*8+i*Math.PI/2;particle({x:e.x+Math.cos(a)*.7,y:e.y+age*2.4,z:e.z+Math.sin(a)*.7},e.color,{vy:.6,life:.8,size:.24});}}});return;
  }
  if(e.type==='impact'){shockwave(e,e.radius*1.2,e.color,.9);rune(e,e.radius,e.color,1.6);burst(e,e.color,120,9,'ember');return;}
  if(e.type==='combo'){shockwave(e,e.combo==='overload'?3.2:2,e.color,.45);burst(e,e.color,45,4,e.combo==='shatter'?'ice':'spark');if(e.combo==='shatter')icicles(e,1.2,0xc8f2ff);if(e.combo==='overload'){burst(e,0xff9a4a,40,5,'ember');ripple(ground(e.x,e.z),4.5,0xffd27a,.5);}return;}
  if(e.type==='hit'){if(!e.periodic){burst(e,e.crit?0xffe6a0:e.color,e.crit?26:12,e.crit?2.6:1.5,e.element==='ice'?'ice':'spark');if(e.tag)sparkRingAt(e,0xffd36b);}return;}
  if(e.type==='burst'){if(e.foe){const col=e.color??0xff5a3c;burst(e,col,qn(22),2.6,e.element==='fire'?'ember':'spark');sparkRingAt(e,col);return;}if(e.wave){const col=WAVES[e.wave]??e.color??0xffffff;burst(e,col,30,3.2,e.wave==='ice'?'ice':'spark');burst(e,0xffffff,10,2);return;}burst(e,e.color,e.spell==='fireball'?85:25,e.radius||2,e.element==='fire'?'ember':e.element==='ice'?'ice':'spark');if(e.spell==='fireball')shockwave(e,e.radius,e.color);if(e.element==='ice')icicles(e,.65,e.color);return;}
  if(e.type==='defeat'||e.type==='training-down'){burst(e,e.color,60,3);rune({...e,y:surfaceAt(e.x,e.z)+.1},1.6,e.color,1.2);return;}
  if(e.type==='training-reset'){rune(e,1,e.color,.8);return;}
  if(e.type==='ring'){rune(e,e.radius||2,e.color,e.duration||.6);return;}
  if(e.type==='guard'){burst(e,e.color,18,1.8);return;}
  if(e.type==='telegraph'){
   const old=telegraphs.get(e.targetId);if(old){disposeObject(old);telegraphs.delete(e.targetId);}
   if(e.phase==='start'){const g=new T.Group();g.position.set(e.x,e.y,e.z);const m=mesh(g,ringGeometry,mat(0xff654e,.75));m.rotation.x=-Math.PI/2;m.scale.setScalar(e.radius);g.userData={remaining:e.duration,total:e.duration,radius:e.radius};root.add(g);telegraphs.set(e.targetId,g);}return;
  }
  if(e.type==='hazard'){
   if(e.id==null)return;if(e.phase==='start'){if(has(e))addHazard(e);return;}
   if(e.phase==='resolve'){if(has(e))resolveImpact(e);endHazard(e.id,'flash',.28);return;}
   if(e.phase==='cancel'){endHazard(e.id,'fade',.25);endPool(e.id);return;}
   if(e.phase==='end'){endHazard(e.id,'fade',.2);endPool(e.id);}return;
  }
  if(e.type==='pool'){if(e.id!=null&&has(e))addPool(e);return;}
  if(e.type==='channel-start'){if(has(e))rune(ground(e.x,e.z,.1),1,e.color??0xffe38a,.6);return;}
  if(e.type==='boss-reset'){const b=has(e)?e:BOSSES[e.boss];if(has(b))ripple(ground(b.x,b.z),4,e.color??BOSSES[e.boss]?.color??0xffffff,.8);return;}
  if(!has(e)&&SELF.has(e.type)&&has(player))e={...e,x:player.x,y:surfaceAt(player.x,player.z)+1.3,z:player.z};
  if(!has(e)&&!(has(e.from)&&has(e.to)))return;
  if(e.type==='impact-melee'){const s=clamp(num(e.strength,.45),0,1);burst(e,0xfff0d0,Math.round(10+30*s),2+5*s);if(s>=.9){const g=ground(e.x,e.z);ripple(g,3.2,0xe8d8b8,.45);burst(g,0xb9a88a,20,3,'dust');}return;}
  if(e.type==='swing'){if(e.heavy&&e.move==='slam'){const yaw=num(player?.yaw),q=ground(e.x-Math.sin(yaw)*2.2,e.z-Math.cos(yaw)*2.2);ripple(q,3,0xe8d8b8,.45);burst({...q,y:q.y+.1},0xb9a88a,24,3.5,'dust');}if(e.heavy&&(e.move==='whirl'||e.move==='slam'||e.move==='cleave')){const g=ground(e.x,e.z,.3),n=qn(22);for(let i=0;i<n;i++){const a=i/n*Math.PI*2;particle({x:g.x+Math.cos(a)*1.6,y:g.y,z:g.z+Math.sin(a)*1.6},0xe8e0cf,{vx:-Math.sin(a)*4+Math.cos(a)*1.5,vz:Math.cos(a)*4+Math.sin(a)*1.5,vy:.5,life:.35,size:.16,drag:2});}}return;}
  if(e.type==='parry'){sparkRing(e,e.color??0xffe6a0,.62,30);return;}
  if(e.type==='reflect'){sparkRingAt(e,0xffe6a0);burst(e,0xffe6a0,24,4);return;}
  if(e.type==='evade'){afterimage(e);return;}
  if(e.type==='dodge'){dodgeDust(e);return;}
  if(e.type==='stagger'){stagger(e);return;}
  if(e.type==='guard-break'){sparkRing(e,0xff7a5c,.5,20);const p=ahead(e,1.1);burst(p,0xbfd8ff,34,4.5,'ice');return;}
  if(e.type==='earthshatter'){earthshatter(e);return;}
  if(e.type==='thunderstorm'){thunderstorm(e);return;}
  if(e.type==='siphon'){siphon(e);return;}
  if(e.type==='embers'){embers(e);return;}
  if(e.type==='summon'){summon(e);return;}
  if(e.type==='echo-summon'){rune({x:e.x,y:e.y,z:e.z},6,e.color??0xc6a4ff,2.4,{rise:.2});burst({x:e.x,y:e.y+1.5,z:e.z},e.color??0xc6a4ff,90,5);summon(e);return;}
  if(e.type==='boss-cast'){const col=e.color??BOSSES[e.boss]?.color??0xffffff;rune(ground(e.x,e.z,.12),(BOSSES[e.boss]?.size?.r??1.2)*1.5,col,.7);burst(P(e),col,18,1.6,styleBurst(e.boss));return;}
  if(e.type==='boss-awaken'){const col=e.color??0xffffff,p=P(e,.1);rune(ground(e.x,e.z,.12),clamp(num(e.radius,20),4,40),col,3.6);column(ground(e.x,e.z,0),2.2,36,col,2.2);shockwave(p,14,col,1.2);burst({...p,y:p.y+2},col,140,9,styleBurst(e.boss)==='spark'?'ember':styleBurst(e.boss));return;}
  if(e.type==='boss-phase'){const col=e.color??BOSSES[e.boss]?.color??0xffffff,p=P(e,.3);shockwave(p,16,col,1.1);ripple(ground(e.x,e.z),18,col,1);rune(ground(e.x,e.z,.12),6,col,1.4);burst(p,col,110,8,styleBurst(e.boss));return;}
  if(e.type==='boss-blink'){bossBlink(e);return;}
  if(e.type==='boss-dash'){bossDash(e);return;}
  if(e.type==='boss-defeat'){bossDefeat(e);return;}
  if(e.type==='rift-open'){const col=e.color??0xc6a4ff,p=P(e,1);rune(ground(e.x,e.z,.12),5,col,2.4);column(ground(e.x,e.z,0),1.5,20,col,1.8);burst(p,col,120,7);shockwave(p,8,col,.9);return;}
 }
 function sparkRingAt(e,color){const g=new T.Group();g.position.set(e.x,e.y,e.z);if(Number.isFinite(player?.x))g.rotation.y=Math.atan2(player.x-e.x,player.z-e.z);const r=mesh(g,torusGeometry,mat(color,.9));add(g,.25,age=>{r.scale.setScalar(.15+age*.6);},'base');}
 function makeBolt(p){
  const g=new T.Group(),ice=p.element==='ice',arrow=p.weapon==='longbow'||p.weapon==='crossbow';
  if(p.wave){const col=WAVES[p.wave]??p.color??0xffffff;mesh(g,crescent,mat(0xffffff,.8)).scale.setScalar(1.35);mesh(g,crescent,mat(col,.55)).scale.set(1.55,1.4,1.55);g.userData.wave=col;}
  else if(p.weapon==='reflect'){mesh(g,sphere,mat(0xffffff,1)).scale.setScalar(.14);mesh(g,sphere,mat(p.color??0xffe6a0,.5)).scale.set(.26,.26,.42);for(let i=0;i<2;i++){const ring=mesh(g,torusGeometry,mat(0xffe6a0,.75));ring.scale.setScalar(.34);ring.rotation.x=i*1.57;}}
  else if(arrow){const shaft=mesh(g,new T.CylinderGeometry(.017,.017,.65,5),new T.MeshBasicMaterial({color:0xb8a380}));shaft.rotation.x=Math.PI/2;if(p.heavy){const glow=mesh(g,sphere,mat(p.color??0xfff0c0,.45));glow.scale.set(.09,.09,.5);}}else if(ice){const m=mesh(g,crystal,mat(p.color,.9));m.scale.set(.13,.13,.65);const halo=mesh(g,crystal,mat(0xe3faff,.4));halo.scale.set(.21,.21,.75);}else{mesh(g,sphere,mat(0xfff2d3,1)).scale.setScalar(.12);const shell=mesh(g,sphere,mat(p.color,.5));shell.scale.set(.22,.22,.35);for(let i=0;i<2;i++){const ring=mesh(g,torusGeometry,mat(p.color,.4));ring.scale.setScalar(.25);ring.rotation.x=i*1.5;}}
  g.userData.trail=0;root.add(g);return g;
 }
 function makeShot(s){const g=new T.Group(),col=s.color??0xff5a3c;mesh(g,sphere,mat(0xffffff,1)).scale.setScalar(.11);mesh(g,sphere,mat(col,.55)).scale.set(.27,.27,.42);
  if(s.element==='arcane')for(let i=0;i<2;i++){const r=mesh(g,torusGeometry,mat(col,.6));r.scale.setScalar(.34);r.rotation.x=i*1.57;}
  else if(s.element==='nature')for(let i=0;i<3;i++){const m=mesh(g,crystal,mat(col,.7)),a=i*2.09;m.scale.set(.05,.05,.24);m.position.set(Math.cos(a)*.2,Math.sin(a)*.2,-.05);}
  else if(s.element==='fire'){const m=mesh(g,sphere,mat(0xffb060,.35));m.scale.set(.36,.36,.55);}
  if(s.parry){const r=mesh(g,torusGeometry,mat(0xffe3a0,.5));r.scale.setScalar(.44);g.userData.glint=r;}
  g.userData.trail=0;root.add(g);return g;}
 function update(dt,combat,playing=true){
  if(!Number.isFinite(dt)||dt<0)return;time+=dt;root.visible=playing;if(!playing)return;particleMaterial.uniforms.viewport.value=Math.min(1400,(globalThis.innerHeight||700)*(globalThis.devicePixelRatio||1));player=combat?.player||null;
  const ids=new Set();for(const p of combat?.projectiles||[]){if(!p||!Number.isFinite(p.x+p.y+p.z))continue;ids.add(p.id);let g=bolts.get(p.id);if(!g){g=makeBolt(p);bolts.set(p.id,g);}g.position.set(p.x,p.y,p.z);g.lookAt(p.x+num(p.dx),p.y+num(p.dy),p.z+num(p.dz,1));if(!p.wave)g.rotation.z+=time*2;g.userData.trail+=dt;if(g.userData.trail>.025){g.userData.trail=0;
   if(p.wave){const l=Math.hypot(num(p.dx),num(p.dz))||1,fx=num(p.dx)/l,fz=num(p.dz)/l,col=g.userData.wave;for(let i=0;i<qn(6);i++){const a=(Math.random()*2-1)*1.1,r=1.5;particle({x:p.x+(fx*Math.cos(a)+fz*Math.sin(a))*r,y:p.y+(Math.random()-.5)*.5,z:p.z+(fz*Math.cos(a)-fx*Math.sin(a))*r},i%3?col:0xffffff,{life:.35,size:.2,vy:.2,drag:2});}}
   else{const arrow=p.weapon==='longbow'||p.weapon==='crossbow',n=arrow?(p.heavy?3:1):settings.quality==='low'?2:5,col=p.weapon==='reflect'?0xffe6a0:p.color;for(let i=0;i<n;i++){const t=i/n*.045*p.speed;particle({x:p.x-num(p.dx)*t,y:p.y-num(p.dy)*t,z:p.z-num(p.dz)*t},col,{life:arrow?(p.heavy?.4:.18):.4+Math.random()*.2,size:arrow?(p.heavy?.16:.06):p.element==='fire'?.28:.14,vy:p.element==='fire'?.5:0,drag:1});}}}}
  for(const [id,g]of bolts)if(!ids.has(id)){disposeObject(g);bolts.delete(id);}
  const seen=new Set();for(const s of combat?.foeShots||[]){if(!Number.isFinite(s.x+s.y+s.z))continue;seen.add(s.id);let g=shots.get(s.id);if(!g){if(shots.size>=64)continue;g=makeShot(s);shots.set(s.id,g);}g.position.set(s.x,s.y,s.z);g.lookAt(s.x+num(s.dx),s.y+num(s.dy),s.z+num(s.dz,1));g.rotation.z+=time*5;if(g.userData.glint)g.userData.glint.scale.setScalar(.4+Math.sin(time*14)*.06);g.userData.trail+=dt;if(g.userData.trail>.03){g.userData.trail=0;const col=s.color??0xff5a3c,sp=num(s.speed,12);for(let i=0;i<qn(3);i++){const t=i*.012*sp;particle({x:s.x-num(s.dx)*t+(Math.random()-.5)*.12,y:s.y-num(s.dy)*t+(Math.random()-.5)*.12,z:s.z-num(s.dz)*t+(Math.random()-.5)*.12},col,{life:.35+Math.random()*.15,size:s.element==='fire'?.3:.2,vy:s.element==='fire'?.6:0,drag:1});}}}
  for(const [id,g]of shots)if(!seen.has(id)){disposeObject(g);shots.delete(id);}
  ambient+=dt;if(ambient>.08){ambient=0;const pl=combat?.player;for(const e of pl?combat.enemies||[]:[]){if(e.dead||e.dormant||Math.hypot(e.x-pl.x,e.z-pl.z)>45)continue;const y=surfaceAt(e.x,e.z),r=num(e.size?.r,.7),top=num(e.size?.y,1.1);if(e.burn>0)for(let i=0;i<3;i++)particle({x:e.x+(Math.random()-.5)*r*.7,y:y+.5+Math.random()*top,z:e.z+(Math.random()-.5)*r*.7},0xff9b49,{vy:1.7,life:.5,size:.25});if(e.chill>0)particle({x:e.x+(Math.random()-.5)*r*1.4,y:y+top*1.35,z:e.z+(Math.random()-.5)*r*1.4},0x9bdfff,{vy:-.4,life:.6,size:.16});if(e.poison>0)particle({x:e.x+(Math.random()-.5)*r,y:y+.3+Math.random()*top,z:e.z+(Math.random()-.5)*r},0x8fdc4f,{vy:.7,life:.6,size:.17});}}
  for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.remaining-=dt;const age=Math.min(1,1-e.remaining/e.duration);e.animate(age,dt);if(e.fade===true)e.object.traverse(m=>{if(m.material?.transparent)m.material.opacity=Math.min(1,(1-age)*3)*(m.isLineSegments?.8:.6);});else if(e.fade==='base'){const k=Math.min(1,(1-age)*3);e.object.traverse(m=>{if(m.material?.transparent)m.material.opacity=(m.material.userData.base??.6)*k;});}if(e.remaining<=0){disposeObject(e.object);effects.splice(i,1);}}
  for(const [id,g]of telegraphs){g.userData.remaining-=dt;const f=1-g.userData.remaining/g.userData.total;g.rotation.y=time;g.children[0].scale.setScalar(g.userData.radius*(.6+f*.4));if(g.userData.remaining<-.15){disposeObject(g);telegraphs.delete(id);}}
  for(const c of combat?.hazards||[]){const h=c&&!c.active?hazards.get(c.id):null;if(h?.mode==='wait'&&Number.isFinite(c.remaining)&&Number.isFinite(c.total)&&c.total>0){h.total=c.total;h.remaining=c.remaining+dt;}}
  for(const [id,h]of hazards){h.u.time.value=time;
   if(h.mode==='wait'){h.remaining-=dt;const f=clamp(1-h.remaining/h.total,0,1);h.u.progress.value=f;if(h.fall){h.fall.position.y=.4+21.6*(1-f)*(1-f);h.fall.rotation.y+=dt*4;h.trail+=dt;if(h.trail>.04&&f<.98){h.trail=0;particle({x:h.x,y:h.y+h.fall.position.y+.6,z:h.z},h.style==='cinder'?0xff8a3d:h.style==='hollow'?0xc6a4ff:0xd8f5ff,{vy:1,life:.4,size:h.style==='cinder'?.4:.2,drag:1});}}if(h.remaining<-1.5){h.mode='fade';h.t=h.span=.3;}continue;}
   h.t-=dt;const k=clamp(h.t/h.span,0,1);if(h.mode==='flash'){h.u.progress.value=1;h.u.flash.value=k;}h.u.alpha.value=k;if(h.t<=0){disposeObject(h.group);hazards.delete(id);}}
  for(const [id,p]of pools){p.age+=dt;p.remaining-=dt;p.u.time.value=time;if(p.fade==null&&p.remaining<-1.5)p.fade=.6;if(p.fade!=null){p.fade-=dt;if(p.fade<=0){disposeObject(p.group);pools.delete(id);continue;}}
   p.u.alpha.value=Math.min(1,p.age/.35)*(p.fade!=null?p.fade/.6:1);p.timer+=dt;if(p.timer>.09&&p.fade==null){p.timer=0;for(let i=0;i<qn(Math.min(6,1+p.radius*.8));i++){const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*p.radius*.92,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r,lava=p.style==='cinder';particle({x,y:surfaceAt(x,z)+.08,z},lava&&Math.random()<.3?0xffd27a:p.glow,{vy:lava?1.2+Math.random()*2:.3+Math.random()*.6,life:lava?.6:.45,size:lava?.24:.2,drag:.5});}}}
  const limit=settings.quality==='low'?600:capacity;let alive=0;
  for(let i=0;i<capacity;i++){const p=particles[i];if(!p)continue;p.life-=dt;if(p.life<=0){particles[i]=null;continue;}p.vy-=p.gravity*dt;const drag=Math.exp(-p.drag*dt);p.vx*=drag;p.vz*=drag;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(alive>=limit)continue;const j=alive*3;positions[j]=p.x;positions[j+1]=p.y;positions[j+2]=p.z;colors[j]=p.r;colors[j+1]=p.g;colors[j+2]=p.b;sizes[alive]=p.size*(.4+p.life/p.total*.6);alphas[alive]=Math.min(1,p.life*4);alive++;}
  geometry.setDrawRange(0,alive);for(const attribute of Object.values(geometry.attributes))attribute.needsUpdate=true;
 }
 function clear(){for(const e of effects)disposeObject(e.object);effects.length=0;for(const map of [bolts,shots,telegraphs])for(const g of map.values())disposeObject(g);for(const map of [hazards,pools])for(const h of map.values())disposeObject(h.group);bolts.clear();shots.clear();telegraphs.clear();hazards.clear();pools.clear();particles.fill(null);geometry.setDrawRange(0,0);lastDodge=null;}
 return{emit,update,clear,rune,burst,particle,get counts(){let n=0;for(let i=0;i<capacity;i++)if(particles[i])n++;return{particles:n,effects:effects.length,projectiles:bolts.size,telegraphs:telegraphs.size};},get details(){return{hazards:hazards.size,pools:pools.size,shots:shots.size};},dispose(){clear();for(const g of shared)g.dispose();geometry.dispose();particleMaterial.dispose();root.removeFromParent();}};
}
