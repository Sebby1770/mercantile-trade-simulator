/** Regional weather: bounded point clouds that wrap around the camera. Snow, ash, embers and marsh motes. */
import * as T from '../vendor/three.module.js';
// n: points at high quality · R: horizontal half-extent · lo/hi: vertical band around the camera.
const LAYERS=[
 {id:'snow',biome:'frost',n:560,R:24,lo:-5,hi:15,size:.13,color:0xf4f8ff,additive:false,alpha:.9},
 {id:'ash',biome:'ash',n:260,R:26,lo:-4,hi:12,size:.1,color:0x4a4541,additive:false,alpha:.75},
 {id:'embers',biome:'ash',n:180,R:18,lo:-3,hi:9,size:.11,color:0xff8a3d,additive:true,alpha:1},
 {id:'motes',biome:'mire',n:200,R:18,lo:-1.6,hi:4,size:.12,color:0x9be36b,additive:true,alpha:.85}];
const vertexShader=`attribute float seed;uniform float size;uniform float viewport;uniform float time;uniform float flicker;uniform vec3 center;uniform float range;varying float vAlpha;void main(){vec4 view=modelViewMatrix*vec4(position,1.);float d=length(position.xz-center.xz);vAlpha=(1.-smoothstep(range*.62,range,d))*mix(1.,.45+.55*sin(time*(2.+seed*3.)+seed*40.),flicker);gl_PointSize=clamp(size*(.65+seed*.7)*viewport/max(.2,-view.z),1.,48.);gl_Position=projectionMatrix*view;}`;
const fragmentShader=`uniform vec3 color;uniform float opacity;varying float vAlpha;void main(){vec2 c=gl_PointCoord-.5;float r=dot(c,c)*4.;if(r>1.)discard;gl_FragColor=vec4(color,opacity*vAlpha*(1.-r*r));}`;
export function createWeather(scene,settings={}){
 const root=new T.Group();root.name='weather';scene.add(root);let time=0,last=null;
 const wrap=(v,c,R)=>c+(((v-c+R)%(2*R))+2*R)%(2*R)-R;
 const layers=LAYERS.map(def=>{
  const n=Math.max(1,Math.round(def.n*(settings.quality==='low'?.5:1))),pos=new Float32Array(n*3),seed=new Float32Array(n),geometry=new T.BufferGeometry();
  for(let i=0;i<n;i++){seed[i]=Math.random();pos[i*3]=(Math.random()*2-1)*def.R;pos[i*3+1]=def.lo+Math.random()*(def.hi-def.lo);pos[i*3+2]=(Math.random()*2-1)*def.R;}
  geometry.setAttribute('position',new T.BufferAttribute(pos,3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('seed',new T.BufferAttribute(seed,1));geometry.setDrawRange(0,0);
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:def.additive?T.AdditiveBlending:T.NormalBlending,uniforms:{color:{value:new T.Color(def.color)},opacity:{value:0},size:{value:def.size},viewport:{value:700},time:{value:0},flicker:{value:def.id==='embers'||def.id==='motes'?1:0},center:{value:new T.Vector3()},range:{value:def.R}},vertexShader,fragmentShader});
  const points=new T.Points(geometry,material);points.frustumCulled=false;points.visible=false;points.renderOrder=5;root.add(points);
  return{...def,n,pos,seed,geometry,material,points,base:new T.Color(def.color),seeded:false,weight:0};
 });
 // First sighting (or a waystone jump) scatters the layer around the camera instead of sweeping it in.
 function scatter(l,c){for(let i=0;i<l.n;i++){l.pos[i*3]=c.x+(Math.random()*2-1)*l.R;l.pos[i*3+1]=c.y+l.lo+Math.random()*(l.hi-l.lo);l.pos[i*3+2]=c.z+(Math.random()*2-1)*l.R;}l.seeded=true;}
 function step(l,dt,c,count){const p=l.pos,s=l.seed,band=l.hi-l.lo,wind=Math.sin(time*.13)*.6;
  for(let i=0;i<count;i++){const k=i*3,q=s[i],ph=q*50+time;let vx=0,vy=0,vz=0;
   if(l.id==='snow'){vy=-(1.05+q*.9);vx=.55+wind+Math.sin(ph*1.3)*.45;vz=.2+Math.cos(ph*1.1)*.4;}
   else if(l.id==='ash'){vy=-(.22+q*.35);vx=.8+wind+Math.sin(ph*.7)*.6;vz=Math.cos(ph*.9)*.55;}
   else if(l.id==='embers'){vy=.55+q*1.1;vx=.35+Math.sin(ph*2.3)*.5;vz=Math.cos(ph*1.9)*.5;}
   else{vy=Math.sin(ph*.8)*.18;vx=Math.sin(ph*.35+q*9)*.35;vz=Math.cos(ph*.4+q*7)*.35;}
   p[k]=wrap(p[k]+vx*dt,c.x,l.R);p[k+2]=wrap(p[k+2]+vz*dt,c.z,l.R);p[k+1]=wrap(p[k+1]+vy*dt,c.y+(l.lo+l.hi)/2,band/2);}
  l.geometry.attributes.position.needsUpdate=true;}
 function update(dt,cameraPosition,biome={},daylight=1,visible=true){
  if(!Number.isFinite(dt)||dt<0)dt=0;dt=Math.min(dt,.1);time+=dt;const c=cameraPosition,day=Number.isFinite(daylight)?Math.max(0,Math.min(1,daylight)):1;
  if(!c||!Number.isFinite(c.x)||!Number.isFinite(c.y)||!Number.isFinite(c.z)){for(const l of layers)l.points.visible=false;return;}
  const jumped=last&&Math.hypot(c.x-last.x,c.z-last.z)>12;last={x:c.x,z:c.z};
  const viewport=Math.min(1400,(globalThis.innerHeight||700)*(globalThis.devicePixelRatio||1));
  for(const l of layers){const w=Number.isFinite(biome?.[l.biome])?Math.max(0,Math.min(1,biome[l.biome])):0;
   // Ease intensity so crossing a border fades the weather rather than popping it.
   l.weight+=(w-l.weight)*Math.min(1,dt*1.5);if(!visible||l.weight<.02){l.points.visible=false;if(l.weight<.02)l.seeded=false;continue;}
   if(!l.seeded||jumped)scatter(l,c);const count=Math.max(1,Math.ceil(l.n*Math.min(1,l.weight*1.15)));
   step(l,dt,c,count);l.geometry.setDrawRange(0,count);l.points.visible=true;
   const u=l.material.uniforms;u.time.value=time;u.viewport.value=viewport;u.center.value.set(c.x,c.y,c.z);
   const light=l.additive?1:l.id==='snow'?.3+day*.7:.55+day*.45;u.color.value.copy(l.base).multiplyScalar(light);u.opacity.value=l.alpha*Math.min(1,l.weight*1.4)*(l.id==='motes'?.55+(1-day)*.45:1);}
 }
 function dispose(){for(const l of layers){l.geometry.dispose();l.material.dispose();}root.removeFromParent();}
 return{update,dispose,get counts(){return Object.fromEntries(layers.map(l=>[l.id,l.points.visible?l.geometry.drawRange.count:0]));},root};
}
