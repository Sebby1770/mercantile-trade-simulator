import * as T from '../vendor/three.module.js';
import {surfaceAt} from './world.js';

// One fixed particle buffer serves every spell. Expired effects return their slots.
export function createSpellEffects(scene,settings={}){
 const root=new T.Group();root.name='spell-effects';scene.add(root);
 const capacity=1800,positions=new Float32Array(capacity*3),colors=new Float32Array(capacity*3),sizes=new Float32Array(capacity),alphas=new Float32Array(capacity),particles=new Array(capacity).fill(null);
 const geometry=new T.BufferGeometry();for(const [name,array,size]of[['position',positions,3],['color',colors,3],['size',sizes,1],['alpha',alphas,1]])geometry.setAttribute(name,new T.BufferAttribute(array,size).setUsage(T.DynamicDrawUsage));
 const particleMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,vertexColors:true,uniforms:{viewport:{value:700}},vertexShader:`attribute float size;attribute float alpha;varying vec3 vColor;varying float vAlpha;uniform float viewport;void main(){vColor=color;vAlpha=alpha;vec4 view=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*view;gl_PointSize=clamp(size*viewport/max(1.,-view.z),1.,80.);}`,fragmentShader:`varying vec3 vColor;varying float vAlpha;void main(){float d=length(gl_PointCoord-.5)*2.;float glow=pow(max(0.,1.-d),2.);gl_FragColor=vec4(vColor*1.8,glow*vAlpha);}`});
 const points=new T.Points(geometry,particleMaterial);points.frustumCulled=false;root.add(points);
 const sphere=new T.IcosahedronGeometry(1,2),crystal=new T.OctahedronGeometry(1,0),ringGeometry=new T.RingGeometry(.95,1,64),torusGeometry=new T.TorusGeometry(1,.025,6,64);
 const shared=new Set([sphere,crystal,ringGeometry,torusGeometry]);
 const effects=[],bolts=new Map(),telegraphs=new Map();let cursor=0,time=0,ambient=0;
 const mat=(color,opacity=.8)=>new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(1.35),transparent:true,opacity,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
 function mesh(parent,geo,material){const m=new T.Mesh(geo,material);parent.add(m);return m;}
 function disposeObject(object){object.removeFromParent();const geos=new Set(),materials=new Set();object.traverse(o=>{if(o.geometry&&!shared.has(o.geometry))geos.add(o.geometry);if(o.material)materials.add(o.material);});for(const g of geos)g.dispose();for(const m of materials)m.dispose();}
 function add(object,duration,animate=()=>{},fade=true){root.add(object);effects.push({object,duration,remaining:duration,animate,fade});while(effects.length>48)disposeObject(effects.shift().object);return object;}
 function particle(p,color,{vx=0,vy=1,vz=0,life=.7,size=.15,gravity=0,drag=0}={}){const i=cursor++%capacity,c=new T.Color(color);particles[i]={x:p.x,y:p.y,z:p.z,vx,vy,vz,life,total:life,size,gravity,drag,r:c.r,g:c.g,b:c.b};}
 function burst(p,color,count=40,speed=3,style='spark'){
  const n=Math.ceil(count*(settings.quality==='low'?.45:1));for(let i=0;i<n;i++){const a=i*2.3999,u=Math.random()*2-1,r=Math.sqrt(1-u*u),v=speed*(.35+Math.random()*.65);particle(p,color,{vx:Math.cos(a)*r*v,vy:u*v+(style==='ember'?2:1),vz:Math.sin(a)*r*v,life:.4+Math.random()*.9,size:style==='ember'?.3:.12+Math.random()*.13,gravity:style==='ice'?4:.5,drag:style==='ember'?1:.3});}
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
 function arc(from,to,color){const a=new T.Vector3(from.x,from.y,from.z),b=new T.Vector3(to.x,to.y,to.z),pts=[];for(let i=0;i<=14;i++){const p=a.clone().lerp(b,i/14);if(i&&i<14)p.add(new T.Vector3((Math.random()-.5)*.6,(Math.random()-.5)*.6,(Math.random()-.5)*.6));pts.push(p);}const g=new T.Group(),geo=new T.TubeGeometry(new T.CatmullRomCurve3(pts),28,.023,5,false);mesh(g,geo,mat(0xf5fbff,1));mesh(g,geo.clone(),mat(color,.32)).scale.setScalar(1.001);for(const j of [4,9]){const branch=[pts[j],pts[j].clone().add(new T.Vector3(.5,.3,-.2)),pts[j].clone().add(new T.Vector3(.7,-.5,.3))];mesh(g,new T.TubeGeometry(new T.CatmullRomCurve3(branch),8,.015,4,false),mat(color,.7));}add(g,.3,age=>{g.visible=Math.sin(age*40)>-.5;});burst(to,color,18,2);}
 function icicles(p,radius,color){const g=new T.Group();g.position.set(p.x,surfaceAt(p.x,p.z),p.z);const material=mat(color,.7);for(let i=0;i<10;i++){const a=i/10*Math.PI*2,m=mesh(g,crystal,material);m.position.set(Math.cos(a)*radius,.25,Math.sin(a)*radius);m.scale.set(.1,.3+Math.random()*.5,.1);}add(g,.85,(age)=>{g.scale.y=Math.sin(age*Math.PI);});}
 function roots(p,radius,color){rune(p,radius,color,1.7);const g=new T.Group();g.position.set(p.x,p.y,p.z);const material=new T.MeshStandardMaterial({color:0x556b37,emissive:color,emissiveIntensity:.25,roughness:.95,transparent:true,opacity:1});for(let i=0;i<14;i++){const a=i*2.4,r=radius*(.25+(i%4)*.2),path=[];for(let j=0;j<8;j++){const t=j/7;path.push(new T.Vector3(Math.cos(a+t*2)*(.3+t*.1),t*1.8,Math.sin(a+t*2)*(.3+t*.1)));}const vine=mesh(g,new T.TubeGeometry(new T.CatmullRomCurve3(path),12,.055,5,false),material);vine.position.set(Math.cos(a)*r,0,Math.sin(a)*r);}add(g,2,(age)=>{g.scale.y=Math.min(1,age*7)*(1-Math.max(0,(age-.75)*4));});}
 function blink(e){const from=new T.Vector3(e.from.x,e.from.y,e.from.z),to=new T.Vector3(e.to.x,e.to.y,e.to.z);for(const p of [from,to]){const g=new T.Group();g.position.copy(p);g.rotation.y=e.yaw||0;const r=mesh(g,torusGeometry,mat(e.color));r.scale.set(.6,1,1);add(g,.7,age=>{g.scale.setScalar(Math.sin(age*Math.PI));});burst(p,e.color,45,2.4);}const length=from.distanceTo(to),count=Math.ceil(length*7);for(let i=0;i<count;i++){const p=from.clone().lerp(to,i/Math.max(1,count-1));p.y+=Math.sin(i*2.4)*.5;particle(p,e.color,{life:.3+Math.random()*.5,size:.22,vy:.4});}}
 function meteor(e){rune(e,e.radius,e.color,e.duration,{expand:false});const g=new T.Group();const core=mesh(g,sphere,new T.MeshBasicMaterial({color:0x402c31}));core.scale.setScalar(.8);const shell=mesh(g,sphere,mat(e.color,.65));shell.scale.setScalar(1);g.position.set(e.x+6,e.y+23,e.z-4);let trail=0;add(g,e.duration,(age,dt)=>{g.position.set(e.x+(1-age)*6,e.y+(1-age)*23,e.z-(1-age)*4);g.rotation.x+=dt*3;g.rotation.z+=dt*2;trail+=dt;if(trail>.02){trail=0;burst(g.position,e.color,8,1.4,'ember');}},false);}
 function blizzard(e){rune(e,e.radius,e.color,e.duration,{expand:false});const g=new T.Group();g.position.set(e.x,e.y,e.z);const material=mat(e.color,.23);for(let i=0;i<3;i++){const r=mesh(g,torusGeometry,material);r.rotation.x=Math.PI/2;r.position.y=.5+i*.85;r.scale.setScalar(e.radius*(.5+i*.16));}let timer=0;add(g,e.duration,(age,dt)=>{g.rotation.y+=dt;for(let i=0;i<g.children.length;i++)g.children[i].rotation.y=Math.sin(time+i)*.12;timer+=dt;if(timer>.045){timer=0;const count=settings.quality==='low'?4:10;for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*e.radius;particle({x:e.x+Math.cos(a)*r,y:e.y+1+Math.random()*3,z:e.z+Math.sin(a)*r},e.color,{vx:-Math.sin(a)*2.5,vz:Math.cos(a)*2.5,vy:-2,size:.12,life:1.1});}}},true);}
 function emit(e){
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
  if(e.type==='combo'){shockwave(e,2,e.color,.45);burst(e,e.color,45,4,e.combo==='shatter'?'ice':'spark');if(e.combo==='shatter')icicles(e,1.2,0xc8f2ff);return;}
  if(e.type==='hit'){if(!e.periodic)burst(e,e.color,12,1.5,e.element==='ice'?'ice':'spark');return;}
  if(e.type==='burst'){burst(e,e.color,e.spell==='fireball'?85:25,e.radius||2,e.element==='fire'?'ember':e.element==='ice'?'ice':'spark');if(e.spell==='fireball')shockwave(e,e.radius,e.color);if(e.element==='ice')icicles(e,.65,e.color);return;}
  if(e.type==='defeat'||e.type==='training-down'){burst(e,e.color,60,3);rune({...e,y:surfaceAt(e.x,e.z)+.1},1.6,e.color,1.2);return;}
  if(e.type==='training-reset'){rune(e,1,e.color,.8);return;}
  if(e.type==='ring'){rune(e,e.radius||2,e.color,e.duration||.6);return;}
  if(e.type==='guard'){burst(e,e.color,18,1.8);return;}
  if(e.type==='telegraph'){
   const old=telegraphs.get(e.targetId);if(old){disposeObject(old);telegraphs.delete(e.targetId);}
   if(e.phase==='start'){const g=new T.Group();g.position.set(e.x,e.y,e.z);const m=mesh(g,ringGeometry,mat(0xff654e,.75));m.rotation.x=-Math.PI/2;m.scale.setScalar(e.radius);g.userData={remaining:e.duration,total:e.duration,radius:e.radius};root.add(g);telegraphs.set(e.targetId,g);}return;
  }
 }
 function makeBolt(p){const g=new T.Group(),ice=p.element==='ice',arrow=p.weapon==='longbow'||p.weapon==='crossbow';if(arrow){const shaft=mesh(g,new T.CylinderGeometry(.017,.017,.65,5),new T.MeshBasicMaterial({color:0xb8a380}));shaft.rotation.x=Math.PI/2;}else if(ice){const m=mesh(g,crystal,mat(p.color,.9));m.scale.set(.13,.13,.65);const halo=mesh(g,crystal,mat(0xe3faff,.4));halo.scale.set(.21,.21,.75);}else{mesh(g,sphere,mat(0xfff2d3,1)).scale.setScalar(.12);const shell=mesh(g,sphere,mat(p.color,.5));shell.scale.set(.22,.22,.35);for(let i=0;i<2;i++){const ring=mesh(g,torusGeometry,mat(p.color,.4));ring.scale.setScalar(.25);ring.rotation.x=i*1.5;}}g.userData.trail=0;root.add(g);return g;}
 function update(dt,combat,playing=true){
  if(!Number.isFinite(dt)||dt<0)return;time+=dt;root.visible=playing;if(!playing)return;particleMaterial.uniforms.viewport.value=Math.min(1400,(globalThis.innerHeight||700)*(globalThis.devicePixelRatio||1));
  const ids=new Set();for(const p of combat.projectiles){ids.add(p.id);let g=bolts.get(p.id);if(!g){g=makeBolt(p);bolts.set(p.id,g);}g.position.set(p.x,p.y,p.z);g.lookAt(p.x+p.dx,p.y+p.dy,p.z+p.dz);g.rotation.z+=time*2;g.userData.trail+=dt;if(g.userData.trail>.025){g.userData.trail=0;const arrow=p.weapon==='longbow'||p.weapon==='crossbow',n=arrow?1:settings.quality==='low'?2:5;for(let i=0;i<n;i++){const t=i/n*.045*p.speed;particle({x:p.x-p.dx*t,y:p.y-p.dy*t,z:p.z-p.dz*t},p.color,{life:arrow?.18:.4+Math.random()*.2,size:arrow?.06:p.element==='fire'?.28:.14,vy:p.element==='fire'?.5:0,drag:1});}}}
  for(const [id,g]of bolts)if(!ids.has(id)){disposeObject(g);bolts.delete(id);}
  ambient+=dt;if(ambient>.08){ambient=0;for(const e of combat.enemies){if(e.dead||Math.hypot(e.x-combat.player.x,e.z-combat.player.z)>45)continue;const y=surfaceAt(e.x,e.z);if(e.burn>0)for(let i=0;i<3;i++)particle({x:e.x+(Math.random()-.5)*.5,y:y+.5+Math.random(),z:e.z+(Math.random()-.5)*.5},0xff9b49,{vy:1.7,life:.5,size:.25});if(e.chill>0)particle({x:e.x+(Math.random()-.5),y:y+1.5,z:e.z+(Math.random()-.5)},0x9bdfff,{vy:-.4,life:.6,size:.16});}}
  for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.remaining-=dt;const age=Math.min(1,1-e.remaining/e.duration);e.animate(age,dt);if(e.fade)e.object.traverse(m=>{if(m.material?.transparent)m.material.opacity=Math.min(1,(1-age)*3)*(m.isLineSegments?.8:.6);});if(e.remaining<=0){disposeObject(e.object);effects.splice(i,1);}}
  for(const [id,g]of telegraphs){g.userData.remaining-=dt;const f=1-g.userData.remaining/g.userData.total;g.rotation.y=time;g.children[0].scale.setScalar(g.userData.radius*(.6+f*.4));if(g.userData.remaining<-.15){disposeObject(g);telegraphs.delete(id);}}
  const limit=settings.quality==='low'?600:capacity;let alive=0;
  for(let i=0;i<capacity;i++){const p=particles[i];if(!p)continue;p.life-=dt;if(p.life<=0){particles[i]=null;continue;}p.vy-=p.gravity*dt;const drag=Math.exp(-p.drag*dt);p.vx*=drag;p.vz*=drag;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(alive>=limit)continue;const j=alive*3;positions[j]=p.x;positions[j+1]=p.y;positions[j+2]=p.z;colors[j]=p.r;colors[j+1]=p.g;colors[j+2]=p.b;sizes[alive]=p.size*(.4+p.life/p.total*.6);alphas[alive]=Math.min(1,p.life*4);alive++;}
  geometry.setDrawRange(0,alive);for(const attribute of Object.values(geometry.attributes))attribute.needsUpdate=true;
 }
 function clear(){for(const e of effects)disposeObject(e.object);effects.length=0;for(const g of bolts.values())disposeObject(g);bolts.clear();for(const g of telegraphs.values())disposeObject(g);telegraphs.clear();particles.fill(null);geometry.setDrawRange(0,0);}
 return{emit,update,clear,rune,burst,particle,get counts(){return{particles:particles.filter(Boolean).length,effects:effects.length,projectiles:bolts.size,telegraphs:telegraphs.size};},dispose(){clear();for(const g of shared)g.dispose();geometry.dispose();particleMaterial.dispose();root.removeFromParent();}};
}
