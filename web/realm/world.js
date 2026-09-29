import * as T from '../vendor/three.module.js';
import {projectedMaterial,terrainMaterial} from './materials.js';
import {BOSSES} from './bosses.js';
export const TOWNS = [
 {id:'eldermere',name:'Eldermere',tag:'THE MARKET TOWN',x:0,z:0,color:0xa15036},
 {id:'mossbrook',name:'Mossbrook',tag:'THE HARVEST HAMLET',x:-100,z:-78,color:0x897744},
 {id:'ironhold',name:'Ironhold',tag:'THE KING’S FRONTIER',x:108,z:-105,color:0x4c6570},
 {id:'frostwatch',name:'Frostwatch',tag:'THE NORTHERN OUTPOST',x:-8,z:-205,color:0x5b6f86}
];
export const ROADS = [[[0,35],[0,0],[-6,-5],[-24,-5],[-45,-34],[-100,-52],[-100,-78]],[[0,0],[6,-5],[24,-5],[35,-35],[43,-55],[69,-55],[108,-78],[108,-105]],[[0,22],[45,32],[68,32],[113,2]],[[-100,-78],[-104,-82],[-100,-89],[-100,-108],[-116,-115]],[[108,-105],[104,-109],[108,-116],[108,-145]],
 [[-100,-108],[-74,-158],[-40,-190],[-8,-205]],[[108,-145],[96,-172],[70,-185],[42,-185],[18,-196],[-8,-205]],[[-8,-205],[-2,-222],[8,-238],[16,-246]],[[-24,-5],[-66,22],[-118,58],[-158,92],[-180,128]],[[113,2],[152,-4],[188,-24],[214,-44]]];
export const WORLD_LIMIT = 300;
export const RIVER = {x:56,north:-213};
export const BRIDGES = [-185,-55,32];
export const TARN = {x:60,z:-228,radius:15};
export const REGIONS = [
 {id:'frost',name:'Frostfang Highlands',tag:'THE WHITE PASS',x:10,z:-235,radius:0},
 {id:'mire',name:'Mirefen Marsh',tag:'THE DROWNED FEN',x:-178,z:120,radius:78},
 {id:'cinder',name:'Cinder Reach',tag:'THE ASHEN WASTE',x:212,z:-35,radius:78}];
export const WAYSTONES = [
 {id:'eldermere',name:'Eldermere',x:13,z:16},{id:'mossbrook',name:'Mossbrook',x:-87,z:-62},{id:'ironhold',name:'Ironhold',x:121,z:-89},{id:'frostwatch',name:'Frostwatch',x:5,z:-189},
 {id:'whitepass',name:'The White Pass',x:-5,z:-238},{id:'mirefen',name:'Mirefen causeway',x:-112,z:48},{id:'cinder',name:'Cinder gate',x:146,z:-14},{id:'stones',name:'The Old Stones',x:-84,z:-112}];
export function seeded(seed=7341){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
const MIRE=REGIONS[1],ASH=REGIONS[2],FROST=BOSSES.frost,ARENAS=Object.values(BOSSES);
// Combat camp centres, stilt huts, the barrow and the added gathering spots stay clear of trees and pools.
const CAMPS=[[-43,29],[-60,-19],[-40,-118],[104,26],[145,-133],[-48,-212],[80,-246],[-100,-232],[-140,80],[-218,108],[-150,170],[180,8],[205,-95],[250,10],[40,130]];
const HUTS=[[-150,72,.4],[-130,92,2.1],[-222,132,-.9]];
const SPOTS=[['herbs',-30,-222],['herbs',-60,-240],['herbs',30,-212],['mushrooms',-160,110],['mushrooms',-205,92],['mushrooms',-140,140],['berries',20,110],['berries',-35,120]];
const CLEAR=[...CAMPS.map(([x,z])=>[x,z,7]),...HUTS.map(([x,z])=>[x,z,6]),...SPOTS.map(([,x,z])=>[x,z,2]),[-100,-243,9],[-38,-219,4]];
const near={d:0,x:0,z:0};
function roadNear(x,z){near.d=Infinity;for(const line of ROADS)for(let i=1;i<line.length;i++){const [ax,az]=line[i-1],[bx,bz]=line[i],dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz))),px=ax+dx*t,pz=az+dz*t,d=Math.hypot(x-px,z-pz);if(d<near.d){near.d=d;near.x=px;near.z=pz;}}return near;}
const nearRoad=(x,z,pad=0)=>roadNear(x,z).d<5+pad;
const clearOf=(x,z,pad=0)=>CLEAR.every(([cx,cz,r])=>Math.hypot(x-cx,z-cz)>r+pad)&&ARENAS.every(b=>Math.hypot(x-b.x,z-b.z)>b.arena+4+pad)&&WAYSTONES.every(w=>Math.hypot(x-w.x,z-w.z)>6+pad);
// Bog and lava pools are deterministic so terrain queries, the map and the scene always agree.
export const POOLS=(()=>{const rnd=seeded(9127),out=[];
 for(const [kind,c,n,r0,r1]of [['bog',MIRE,16,2.6,6],['lava',ASH,9,2.5,5]]){let k=0;for(let i=0;i<900&&k<n;i++){const a=rnd()*Math.PI*2,d=Math.sqrt(rnd())*60,x=c.x+Math.cos(a)*d,z=c.z+Math.sin(a)*d,r=r0+rnd()*(r1-r0);
  if(Math.hypot(x,z)>258-r||roadNear(x,z).d<r+5.2||ARENAS.some(b=>Math.hypot(x-b.x,z-b.z)<b.arena+3+r)||WAYSTONES.some(w=>Math.hypot(x-w.x,z-w.z)<8+r)||CLEAR.some(([cx,cz,cr])=>Math.hypot(x-cx,z-cz)<Math.max(cr,4)+r+2)||out.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+r+3))continue;
  out.push({kind,x:Math.round(x*10)/10,z:Math.round(z*10)/10,r:Math.round(r*10)/10});k++;}}return out;})();
const LAVA=POOLS.filter(p=>p.kind==='lava');
export function heightAt(x,z){const r=Math.sqrt(x*x+z*z),m=Math.max(Math.abs(x),Math.abs(z)),ring=r>268?(r-268)/24:0,edge=m>284?(m-284)/8:0;
 let h=Math.min(16,Math.max(ring*ring,edge*edge))+Math.sin(x*.045)*Math.cos(z*.034)*.24;
 // Northern highlands roll gently but clear flat around Frostwatch, the tarn, the lair, the river and its bridge.
 if(z<-172){let c=smooth(9,22,Math.abs(x-RIVER.x));if(c>0)c*=smooth(36,58,Math.hypot(x+8,z+205))*smooth(22,40,Math.hypot(x-TARN.x,z-TARN.z))*smooth(FROST.arena+6,FROST.arena+22,Math.hypot(x-FROST.x,z-FROST.z))*smooth(12,26,Math.hypot(x-RIVER.x,z-BRIDGES[0]));
  if(c>0)h+=smooth(-172,-205,z)*c*(1.7*Math.sin(x*.047+1.3)*Math.cos(z*.058)+1.1*Math.sin(x*.021-z*.033+.4));}
 else if(x<-98&&x>-258&&z>40&&z<200){const d=Math.hypot(x-MIRE.x,z-MIRE.z);if(d<78)h-=.35*smooth(78,56,d);}
 else if(x>132&&z>-115&&z<45){const d=Math.hypot(x-ASH.x,z-ASH.z);if(d<78){let f=1;for(const p of LAVA){const q=Math.hypot(x-p.x,z-p.z);if(q<p.r+5)f=Math.min(f,smooth(p.r+.5,p.r+5,q));}h+=smooth(78,56,d)*(.5+.4*f*Math.sin(x*.23+z*.07)*Math.sin(z*.19-x*.05));}}
 return h;}
const onBridge=(z,pad)=>{for(const b of BRIDGES)if(Math.abs(z-b)<pad)return b;return null;};
export function surfaceAt(x,z){if(Math.abs(x-RIVER.x)<7.6){const b=onBridge(z,3.6);if(b!==null)return heightAt(RIVER.x,b)+.55;}return heightAt(x,z);}
function weights(x,z,o){o.frost=smooth(-170,-200,z);o.mire=smooth(78,56,Math.hypot(x-MIRE.x,z-MIRE.z));o.ash=smooth(78,56,Math.hypot(x-ASH.x,z-ASH.z));return o;}
export const biomeAt=(x,z)=>weights(x,z,{frost:0,mire:0,ash:0});
export function terrainAt(x,z){if(Math.hypot(x-TARN.x,z-TARN.z)<TARN.radius)return'ice';for(const p of POOLS)if(Math.abs(x-p.x)<p.r&&Math.abs(z-p.z)<p.r&&Math.hypot(x-p.x,z-p.z)<p.r)return p.kind;return null;}
let random=seeded();
const boxG=new T.BoxGeometry(1,1,1),sphereG=new T.SphereGeometry(1,10,7),coneG=new T.ConeGeometry(1,1,10),cylG=new T.CylinderGeometry(1,1,1,8),rockG=new T.DodecahedronGeometry(1,0),discG=new T.CylinderGeometry(1,1,1,24),octaG=new T.OctahedronGeometry(1,0),hexG=new T.CylinderGeometry(1,1,1,6);
let roofG=null;
const mats=new Map();let worldTextures={};const windTime={value:0};
function material(color){if(!mats.has(color)){let m;
 const woodColors=[0x543b2b,0x987046,0x665038,0x745431,0xb39565,0x806b42];
 const stoneColors=[0x8b9085,0x92958a,0x606960,0x8f8870,0xa79c7c,0xb5a17a,0xb4a888,0xc0b490,0x9e987d];
 if(woodColors.includes(color)&&worldTextures.wood)m=projectedMaterial(0xe5d3b8,worldTextures.wood,.35);
 else if(stoneColors.includes(color)&&worldTextures.stone)m=projectedMaterial(0xd4d4c9,worldTextures.stone,.5);
 else m=new T.MeshStandardMaterial({color,roughness:.88});
 if([0x496437,0x658047,0x7a8c47,0x304f3d,0x416248,0x4c7050,0x3f5230,0x9a8f55].includes(color)){m.roughness=1;m.onBeforeCompile=shader=>{shader.uniforms.realmWindTime=windTime;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float realmWindTime;');shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=sin(realmWindTime*.7+position.y*2.)*.022*max(0.,position.y+1.);');};}
 mats.set(color,m);}return mats.get(color);}
function piece(parent,geo,color,x,y,z,sx=1,sy=1,sz=1){const m=new T.Mesh(geo,typeof color==='number'?material(color):color);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
const box=(p,c,x,y,z,w,h,d)=>piece(p,boxG,c,x,y,z,w,h,d);
const sphere=(p,c,x,y,z,w,h=w,d=w)=>piece(p,sphereG,c,x,y,z,w,h,d);
const cylinder=(p,c,x,y,z,r,h)=>piece(p,cylG,c,x,y,z,r,h,r);
function beam(p,c,a,b,r=.09){const d=new T.Vector3(...b).sub(new T.Vector3(...a));const m=piece(p,cylG,c,...new T.Vector3(...a).addScaledVector(d,.5).toArray(),r,d.length(),r);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;}
const wood=0x543b2b,lightwood=0x987046,plaster=0xe1d2a5,stone=0x8b9085;
const snow=0xe6ecef,snowCap=0xe9eff3,frostPine=0x2c4a44,deadwood=0x3b3128,swampLeaf=0x3f5230,charcoal=0x1d1a18,reed=0x9a8f55,bone=0xd9d2bb,basalt=0x2e2b2a,rock=0x869286;
export function blocksAt(x,z,colliders,r=.32){if(Math.abs(x)>WORLD_LIMIT||Math.abs(z)>WORLD_LIMIT)return true;if(z>RIVER.north&&Math.abs(x-RIVER.x)<5.8+r&&onBridge(z,4-r)===null)return true;for(let i=0;i<colliders.length;i++){const c=colliders[i];if(x>c.x1-r&&x<c.x2+r&&z>c.z1-r&&z<c.z2+r)return true;}return false;}
export function moveWithCollision(position,dx,dz,colliders,r=.32){const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.18));for(let i=0;i<n;i++){if(!blocksAt(position.x+dx/n,position.z,colliders,r))position.x+=dx/n;if(!blocksAt(position.x,position.z+dz/n,colliders,r))position.z+=dz/n;}return position;}
const LAYOUTS={frostwatch:{inn:[-11,-15],shop:[15,-15],west:[-22,-4],east:[22,-4],well:[0,5],stubs:[[[-11,-10],[-6,-3]],[[15,-10],[8,-3]],[[-16,-4],[-8,-1]],[[16,-4],[8,-1]]]}};
const LAYOUT={inn:[-11,-15],shop:[11,-15],west:[-20,4],east:[20,4],well:[0,-3],stubs:[[[-11,-10],[-7,-2]],[[-14,4],[-7,2]],[[11,-10],[7,-2]],[[14,4],[7,2]]]};
const NAMES={eldermere:['The Gilded Stag','Willow & Root','Weaver’s cottage','Merchant’s cottage','Bram'],mossbrook:['The Barley Rest','The Wool House','Weaver’s cottage','Merchant’s cottage','Mara'],ironhold:['The Iron Hearth','Hammer & Tongs','Weaver’s cottage','Merchant’s cottage','Oswin'],frostwatch:['The Frosted Antler','Hearth & Hide','Hunter’s lodge','Furrier’s cottage','Sigrun']};
export function createWorld(scene,{textures={}}={}){worldTextures=textures;mats.clear();random=seeded();
 const root=new T.Group();scene.add(root);const colliders=[],houses=[],npcs=[],animals=[],gatherables=[],animated=[],fireflies=[];
 function obstacle(x,z,w,d){colliders.push({x1:x-w/2,x2:x+w/2,z1:z-d/2,z2:z+d/2});}
 function placed(x,z,yaw=0){const g=new T.Group();g.position.set(x,heightAt(x,z),z);g.rotation.y=yaw;root.add(g);return g;}
 function localObstacle(g,x,z,w,d){const v=new T.Vector3(x,0,z).applyAxisAngle(new T.Vector3(0,1,0),g.rotation.y).add(g.position);const swap=Math.abs(Math.sin(g.rotation.y))>.5;obstacle(v.x,v.z,swap?d:w,swap?w:d);}
 const glowing=(color,emissive,emissiveIntensity,roughness=.5,metalness=0)=>new T.MeshStandardMaterial({color,emissive,emissiveIntensity,roughness,metalness});
 const lava=glowing(0xff6a22,0xff4a10,1.6,.55),crystal=glowing(0xbfe9ff,0x6fc6ff,.7,.2,.1),rune=glowing(0x9fe8f0,0x49d6e8,1.1),teal=glowing(0x6fe3cc,0x3fd8b8,.8),hexLight=glowing(0xa8ff8a,0x6cff3c,1.3);
 const ice=new T.MeshStandardMaterial({color:0xcfe8f3,roughness:.12,metalness:.08}),bog=new T.MeshStandardMaterial({color:0x1e2a1f,roughness:.06,metalness:.25}),obsidian=new T.MeshStandardMaterial({color:0x16131a,roughness:.18,metalness:.3});
 // The ground is a real undulating mesh; paths and feet share the same height function. Biome weights tint it.
 const groundG=new T.PlaneGeometry(760,760,380,190);groundG.rotateX(-Math.PI/2);groundG.translate(1,0,0);const a=groundG.attributes.position,colors=new Float32Array(a.count*3),biome=new Float32Array(a.count*3),w={frost:0,mire:0,ash:0},c=new T.Color();
 const greens=[0x657b3e,0x6a8042,0x718849,0x62783d].map(v=>new T.Color(v)),snowC=new T.Color(0xe6ecef),frostC=new T.Color(0xcfdbe4),marshC=new T.Color(0x4f5a3a),ashC=new T.Color(0x2b2724);
 for(let i=0;i<a.count;i++){const x=a.getX(i),z=a.getZ(i);a.setY(i,Math.abs(x-RIVER.x)<6.5&&z>RIVER.north+2?-1.6:heightAt(x,z));weights(x,z,w);c.copy(greens[Math.floor(random()*4)]).lerp(marshC,w.mire*.85).lerp(ashC,w.ash*.9).lerp(random()<.3?frostC:snowC,w.frost*.92);colors.set([c.r,c.g,c.b],i*3);biome.set([w.frost,w.mire,w.ash],i*3);}
 groundG.setAttribute('color',new T.BufferAttribute(colors,3));groundG.setAttribute('biome',new T.BufferAttribute(biome,3));groundG.computeVertexNormals();const ground=new T.Mesh(groundG,textures.grass?terrainMaterial(textures.grass):new T.MeshStandardMaterial({vertexColors:true,roughness:1}));ground.receiveShadow=true;root.add(ground);
 // Road segments pitch with the slope so they lie on the hills; the river gap is left to the bridges.
 function road(points,width=4.4,color=0xb5a17a){for(let i=1;i<points.length;i++){const [ax,az]=points[i-1],[bx,bz]=points[i],length=Math.hypot(bx-ax,bz-az),steps=Math.ceil(length/2),seg=length/steps,yaw=Math.atan2(bx-ax,bz-az);for(let j=0;j<steps;j++){const x0=ax+(bx-ax)*j/steps,z0=az+(bz-az)*j/steps,x1=ax+(bx-ax)*(j+1)/steps,z1=az+(bz-az)*(j+1)/steps,x=(x0+x1)/2,z=(z0+z1)/2;if(z>RIVER.north&&Math.abs(x-RIVER.x)<7.2)continue;const h0=heightAt(x0,z0),h1=heightAt(x1,z1);const m=box(root,color,x,(h0+h1)/2+.02,z,width,.08,Math.hypot(seg,h1-h0)+.15);m.rotation.set(-Math.atan2(h1-h0,seg),yaw,0,'YXZ');m.castShadow=false;}}}
 for(const r of ROADS)road(r);
 // River, banks, the frozen tarn it springs from, and three traversable bridges.
 const water=new T.Mesh(new T.PlaneGeometry(11,WORLD_LIMIT-RIVER.north,1,1),new T.MeshStandardMaterial({color:0x5c9e9b,metalness:.34,roughness:.24,transparent:true,opacity:.88}));water.rotation.x=-Math.PI/2;water.position.set(RIVER.x,-.07,(WORLD_LIMIT+RIVER.north)/2);if(!textures.grass)root.add(water);
 for(let z=RIVER.north+2;z<WORLD_LIMIT;z+=4){for(const x of [49.8,62.2])sphere(root,z<-165?snow:0x949885,x,heightAt(x,z)-.1,z,1+random(),.35,.9+random());}
 for(const bz of BRIDGES){const g=placed(RIVER.x,bz);for(let x=-7;x<=7;x+=.5)box(g,lightwood,x,.4,0,.47,.3,7.5);for(const sz of [-3.65,3.65]){for(let x=-7;x<=7;x+=3.5)box(g,wood,x,1,sz,.16,1.8,.16);box(g,lightwood,0,1.6,sz,14,.15,.15);} }
 const rippleG=new T.TorusGeometry(.8,.014,3,20);for(let i=0;i<36;i++){const m=piece(root, rippleG,0xb9d3b1,52+random()*8,.015,RIVER.north+8+random()*(WORLD_LIMIT-RIVER.north-16),1,1,1);m.rotation.x=-Math.PI/2;m.scale.setScalar(.6+random());m.userData.dynamic=true;animated.push({type:'ripple',mesh:m,phase:random()*6});}
 function disc(m,x,z,r,lift=.03){let lo=Infinity,hi=-Infinity;for(let i=0;i<=12;i++){const t=i/12*Math.PI*2,q=i===12?0:r,h=heightAt(x+Math.cos(t)*q,z+Math.sin(t)*q);lo=Math.min(lo,h);hi=Math.max(hi,h);}const d=piece(root,discG,m,x,(hi+lift+lo-.14)/2,z,r,hi+lift-lo+.14,r);d.castShadow=false;return d;}
 disc(ice,TARN.x,TARN.z,TARN.radius+.8,.04);
 for(let i=0;i<22;i++){const t=i/22*Math.PI*2+random()*.2,r=TARN.radius+.6+random()*2.6,x=TARN.x+Math.cos(t)*r,z=TARN.z+Math.sin(t)*r;if(z>TARN.z+9&&Math.abs(x-RIVER.x)<9)continue;const s=.35+random()*.5,hh=1+random()*1.8;const m=piece(root,octaG,ice,x,heightAt(x,z)+hh*.35,z,s,hh,s*.8);m.rotation.set(Math.sin(t)*.35,random()*3,-Math.cos(t)*.35);if(i%2)sphere(root,snow,x+Math.cos(t)*1.2,heightAt(x,z)-.1,z+Math.sin(t)*1.2,.6+random()*.6,.3,.7);if(s>.62)obstacle(x,z,s,s);}
 // Distant mountain silhouettes beyond the rim, and cloud banks.
 for(let i=0;i<64;i++){const theta=i/64*Math.PI*2,r=335+random()*70,x=Math.cos(theta)*r,z=Math.sin(theta)*r,hh=70+random()*70,ww=38+random()*40;piece(root,coneG,[0x748a78,0x7d9181,0x6b8173][i%3],x,14+hh*.3,z,ww,hh,ww*(.85+random()*.3));}
 const cloudMat=new T.MeshStandardMaterial({color:0xf2f0d8,roughness:1,flatShading:true});for(let i=0;i<(textures.grass?0:26);i++){const g=placed(-280+random()*560,-280+random()*560);g.position.y=46+random()*20;for(let j=0;j<5;j++)sphere(g,cloudMat,j*6,random()*1.5,random()*3,9,2.3,5);}
 function tree(x,z,s=1,pine=false){const g=placed(x,z,random()*6);cylinder(g,0x665038,0,2*s,0,.22*s,4*s);if(pine){for(let k=0;k<3;k++)piece(g,coneG,[0x304f3d,0x416248,0x4c7050][k],0,(3+k*1.3)*s,0,(2.5-k*.45)*s,3.8*s,(2.5-k*.45)*s);}else{sphere(g,0x496437,0,4.9*s,0,2.7*s,2.8*s,2.7*s);sphere(g,0x658047,-1.6*s,4.1*s,.3*s,1.9*s,2.1*s,2*s);sphere(g,0x7a8c47,1.3*s,4.7*s,.5*s,1.8*s,2*s,1.8*s);}if(s>.6)obstacle(x,z,.5*s,.5*s);}
 function snowPine(x,z,s){const g=placed(x,z,random()*6);cylinder(g,0x665038,0,2*s,0,.22*s,4*s);for(let k=0;k<3;k++){const rr=(2.5-k*.45)*s;piece(g,coneG,frostPine,0,(3+k*1.3)*s,0,rr,3.8*s,rr);piece(g,coneG,snowCap,0,(3.74+k*1.3)*s,0,rr*.68,2.36*s,rr*.68);}if(s>.6)obstacle(x,z,.5*s,.5*s);}
 function deadTree(x,z,s){const g=placed(x,z,random()*6),lean=(random()-.5)*.25;const t=cylinder(g,deadwood,0,1.7*s,0,.2*s,3.4*s);t.rotation.z=lean;const top=[-lean*3.4*s,3.3*s,0];for(let k=0;k<3;k++){const th=k*2.1+random(),y=(1.8+k*.6)*s;beam(g,deadwood,[-lean*y,y,0],[Math.cos(th)*1.3*s,y+(.5+random()*.6)*s,Math.sin(th)*1.3*s],.07*s);}beam(g,deadwood,top,[top[0]+.5*s,top[1]+.9*s,.3*s],.06*s);if(s>.6)obstacle(x,z,.45*s,.45*s);}
 function swampTree(x,z,s){const g=placed(x,z,random()*6);cylinder(g,0x665038,0,1.8*s,0,.28*s,3.6*s);for(let k=0;k<3;k++){const th=k*2.1,px=Math.cos(th)*.9*s,pz=Math.sin(th)*.9*s;sphere(g,swampLeaf,px,3.9*s,pz,1.7*s,.8*s,1.6*s);for(let j=0;j<2;j++)sphere(g,swampLeaf,px+Math.cos(th+j)*1.2*s,2.8*s,pz+Math.sin(th+j)*1.2*s,.14*s,.9*s,.14*s);}if(s>.6)obstacle(x,z,.55*s,.55*s);}
 function burnt(x,z,s){const g=placed(x,z,random()*6),hh=(random()<.35?1.2:2.6+random()*1.8)*s;cylinder(g,charcoal,0,hh/2,0,.18*s,hh);if(hh>2)beam(g,charcoal,[0,hh*.7,0],[.8*s,hh*.7+.9*s,.2*s],.06*s);if(s>.6)obstacle(x,z,.4*s,.4*s);}
 // Trees fill the world; each biome grows its own kind and roads, towns, lairs and pools stay open.
 let planted=0;for(let i=0;i<2300&&planted<1100;i++){const x=(random()-.5)*580,z=(random()-.5)*580;if((Math.abs(x-RIVER.x)<10&&z>RIVER.north-6)||Math.hypot(x-TARN.x,z-TARN.z)<TARN.radius+6||TOWNS.some(t=>Math.hypot(x-t.x,z-t.z)<34)||nearRoad(x,z)||!clearOf(x,z)||POOLS.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+2))continue;
  weights(x,z,w);const s=.7+random()*.8;if(w.ash>.2&&random()<w.ash*.8)continue;planted++;
  if(w.frost>.5)snowPine(x,z,s);else if(w.mire>.45)(random()<.55?deadTree:swampTree)(x,z,s);else if(w.ash>.45)burnt(x,z,s);else tree(x,z,s,z<-105||random()<.24);}
 for(const [x,z,s] of [[-9,22,1.2],[12,23,1.1],[-20,-14,1.4],[26,-20,1.3],[-19,30,.8],[23,35,.9],[-112,-65,1.1],[-82,-89,1.5],[88,-88,.9]])tree(x,z,s);
 // Modest grass clumps and flowers are instanced with the rest of the static world; reeds in the fen.
 for(let i=0;i<4400;i++){const x=(random()-.5)*570,z=(random()-.5)*570;if(Math.abs(x-RIVER.x)<7||nearRoad(x,z,-1)||TOWNS.some(t=>Math.hypot(x-t.x,z-t.z)<24))continue;weights(x,z,w);if(w.frost>.4||w.ash>.4||POOLS.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+.4))continue;const y=heightAt(x,z),fen=w.mire>.5;const m=piece(root,coneG,fen?reed:[0x536f36,0x819348,0x8a9852][i%3],x,y+(fen?.45:.25),z,fen?.06:.09,fen?.9+random()*.6:.5+random()*.3,fen?.06:.14);m.rotation.z=(random()-.5)*.4;if(i%5===0&&!fen)sphere(root,[0xc6b05e,0xe0d7b0,0xa097ae][i%3],x,y+.5,z,.085);}
 function barrel(g,x,z){cylinder(g,lightwood,x,.43,z,.35,.82);for(const y of [.16,.64])cylinder(g,0x535b50,x,y,z,.365,.07);}
 function crate(g,x,z,s=.7){box(g,lightwood,x,s/2,z,s,s,s);for(const xx of [x-s*.4,x+s*.4])box(g,wood,xx,s/2,z+s*.51,.06,s,.04);}
 function table(g,x,z,w=2){box(g,lightwood,x,.95,z,w,.14,.8);for(const xx of [x-w*.39,x+w*.39])for(const zz of [z-.26,z+.26])box(g,wood,xx,.45,zz,.11,.9,.11);}
 function roof(g,w,d,color){if(!roofG){const shape=new T.Shape();shape.moveTo(-w/2,0);shape.lineTo(0,2.5);shape.lineTo(w/2,0);shape.closePath();roofG=new T.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false});}const m=piece(g,roofG,color,0,4.5,-d/2);m.castShadow=true;for(let z=-d/2;z<=d/2;z+=1.05){beam(g,0x684a32,[-w/2,4.5,z],[0,7,z],.035);beam(g,0x684a32,[0,7,z],[w/2,4.5,z],.035);} }
 const glow=new T.MeshStandardMaterial({color:0xf2c780,emissive:0xffac42,emissiveIntensity:.55,roughness:.8});
 function house(t,id,lx,lz,yaw=0,kind='home',name='Cottage'){
  const g=placed(t.x+lx,t.z+lz,yaw),w=8,d=7;
  box(g,0x8f8870,0,.06,0,w,.12,d);box(g,0xb39565,0,.13,0,w-.35,.08,d-.35);
  // Split front wall leaves a physically open doorway. Windows glow on the side walls.
  const walls=[[-4,0,.22,d],[4,0,.22,d],[0,-3.5,w,.22],[-2.48,3.5,3.04,.22],[2.48,3.5,3.04,.22]];
  for(const [x,z,ww,dd]of walls){box(g,plaster,x,2.3,z,ww,4.4,dd);localObstacle(g,x,z,ww,dd);}
  box(g,plaster,0,3.62,3.5,1.9,1.65,.23);
  for(const x of [-4,0,4]){box(g,wood,x,2.25,-3.65,.18,4.5,.18);if(x)box(g,wood,x,2.25,3.65,.18,4.5,.18);}
  for(const z of [-3.64,3.64]){box(g,wood,0,4.45,z,8.25,.23,.2);box(g,wood,0,.45,z,8.25,.2,.2);}
  for(const x of [-4.13,4.13]){box(g,wood,x,2.2,0,.16,4.5,.17);box(g,wood,x,4.4,0,.18,.22,7.4);for(const z of [-1.8,1.8]){box(g,wood,x,2.45,z,.2,1.6,1.25);box(g,glow,x*1.015,2.45,z,.12,1.3,1);box(g,wood,x*1.032,2.45,z,.12,.07,1);box(g,wood,x*1.032,2.45,z,.12,1.3,.07);}}
  for(const x of [-2.5,2.5]){box(g,wood,x,2.5,3.66,1.15,1.6,.15);box(g,glow,x,2.5,3.76,.92,1.3,.08);box(g,wood,x,2.5,3.82,.065,1.4,.06);box(g,wood,x,2.5,3.82,1,.065,.06);}
  roof(g,9.1,8,t.color);
  for(const side of [-1,1])for(let row=0;row<9;row++){const xx=side*(.2+row*.48),yy=6.94-row*.267;const tile=box(g,t.color,xx,yy,0,.52,.08,8.08);tile.rotation.z=-side*.5;}
  if(t.id==='frostwatch')for(const side of [-1,1]){const s=box(g,snow,side*2.18,5.97,0,4.6,.12,8.3);s.rotation.z=-side*.5;}
  for(const zz of [-3.6,3.6])for(let row=0;row<2;row++)for(let n=0;n<8;n++){const x=-3.55+n+(row%2)*.18;if(zz>0&&Math.abs(x)<1.1)continue;box(g,stone,x,.2+row*.24,zz,.94,.23,.24);}
  box(g,stone,2.6,6,-1.4,.7,3,.8);box(g,0x676f63,2.6,7.52,-1.4,.9,.2,1);
  const door=new T.Group();door.position.set(-.91,0,3.5);door.userData.dynamic=true;g.add(door);box(door,0x745431,.86,1.42,0,1.72,2.65,.12);for(const yy of [.45,2.2])box(door,wood,.86,yy,.08,1.72,.12,.07);sphere(door,0xcfb565,1.53,1.3,.11,.065);
  const dc=new T.Vector3(0,0,3.5).applyAxisAngle(new T.Vector3(0,1,0),yaw).add(g.position);const doorCollider={x1:dc.x-(yaw===0?.96:.13),x2:dc.x+(yaw===0?.96:.13),z1:dc.z-(yaw===0?.13:.96),z2:dc.z+(yaw===0?.13:.96)};colliders.push(doorCollider);
  const entry=new T.Vector3(0,0,5.3).applyAxisAngle(new T.Vector3(0,1,0),yaw).add(g.position);
  const h={id,name,kind,town:t.id,group:g,door,collider:doorCollider,open:false,x:dc.x,z:dc.z,entry:{x:entry.x,z:entry.z},yaw};houses.push(h);
  // Rooms are furnished at world scale and remain in the same continuous scene.
  table(g,-1,-.5,2.5);localObstacle(g,-1,-.5,2.5,.8);box(g,wood,-1,.43,1,2.3,.12,.45);
  box(g,wood,-2.65,.4,-2.25,1.4,.8,2);box(g,0x8b7650,-2.65,.86,-2.25,1.35,.18,1.9);box(g,0xdad4aa,-2.65,1,-2.9,1,.18,.45);localObstacle(g,-2.65,-2.25,1.4,2);
  box(g,0x606960,2.8,.85,-2.8,1.45,1.7,1);box(g,0x323c32,2.8,.5,-2.23,.95,.8,.08);piece(g,coneG,glow,2.8,.45,-2.15,.17,.52,.2);
  for(let k=0;k<3;k++){box(g,lightwood,3.55,1+k*.75,-.7,.55,.1,1.8);for(let j=0;j<3;j++)cylinder(g,[0x9f754e,0x697b52,0xb29b5e][j],3.55,1.2+k*.75,-1.3+j*.5,.14,.3);}
  cylinder(g,0xb49965,-1,1.12,-.5,.22,.12);sphere(g,0xa97842,-1,1.24,-.5,.21,.1,.15);
  barrel(g,3,1.4);crate(g,3,2.2);localObstacle(g,3,1.8,.8,1.4);
  // Hanging shop signs use a real in-world canvas texture for legible wayfinding.
  if(kind!=='home'){box(g,wood,3,3.5,4.35,.14,.14,1.4);const cv=document.createElement('canvas');cv.width=512;cv.height=192;const ctx=cv.getContext('2d');ctx.fillStyle='#3c4935';ctx.fillRect(0,0,512,192);ctx.strokeStyle='#cdbf87';ctx.lineWidth=5;ctx.strokeRect(9,9,494,174);ctx.fillStyle='#efdfad';ctx.font='42px Georgia';ctx.textAlign='center';ctx.fillText(name,256,111);const tex=new T.CanvasTexture(cv);tex.colorSpace=T.SRGBColorSpace;const m=new T.Mesh(new T.PlaneGeometry(2.1,.78),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}));m.position.set(3,3.05,4.8);g.add(m);}
  return h;
 }
 function person(id,name,role,town,x,z,color,room=null){const g=placed(x,z);g.userData.dynamic=true;
  box(g,color,0,1.05,0,.5,.75,.3);piece(g,coneG,color,0,.65,0,.39,.6,.31);sphere(g,0xc99870,0,1.68,0,.21,.25,.2);sphere(g,0x594334,0,1.85,-.015,.22,.13,.21);box(g,0x594334,0,1.72,-.17,.37,.29,.1);
  for(const sx of [-1,1]){box(g,0x343f32,sx*.14,.24,0,.17,.47,.2);box(g,0x463b2d,sx*.14,.045,.06,.19,.09,.32);box(g,color,sx*.34,1.1,0,.17,.66,.19);sphere(g,0xc99870,sx*.34,.72,0,.09,.12,.09);sphere(g,0x303831,sx*.077,1.72,.18,.025,.023,.02);}box(g,0x685139,0,.87,.02,.53,.11,.32);box(g,0xc8af67,.03,.87,.19,.1,.1,.035);
  const n={id,name,role,town,x,z,room,group:g,phase:random()*6};npcs.push(n);return n;
 }
 for(const t of TOWNS){const L=LAYOUTS[t.id]||LAYOUT,[innName,shopName,westName,eastName,keeper]=NAMES[t.id];
  const plaza=cylinder(root,0xa79c7c,t.x,heightAt(t.x,t.z)+.04,t.z,13,.09);plaza.castShadow=false;
  for(let i=0;i<130;i++){const theta=random()*6.28,r=2+random()*10;const x=t.x+Math.cos(theta)*r,z=t.z+Math.sin(theta)*r;const m=box(root, [0xb4a888,0xc0b490,0x9e987d][i%3],x,heightAt(x,z)+.1,z,.45+random()*.3,.06,.35+random()*.25);m.rotation.y=random()*3;}
  const h1=house(t,t.id+'-inn',...L.inn,0,'inn',innName);
  house(t,t.id+'-shop',...L.shop,0,'shop',shopName);
  house(t,t.id+'-west',...L.west,Math.PI/2,'home',westName);house(t,t.id+'-east',...L.east,-Math.PI/2,'home',eastName);
  for(const [[ax,az],[bx,bz]]of L.stubs)road([[t.x+ax,t.z+az],[t.x+bx,t.z+bz]],2.5);
  const well=placed(t.x+L.well[0],t.z+L.well[1]);cylinder(well,stone,0,.5,0,1.05,1);cylinder(well,0x425d54,0,1.02,0,.78,.015);for(const sx of [-1,1])box(well,wood,sx*1.3,1.6,0,.16,3.2,.16);box(well,lightwood,0,3.2,0,3,.2,1.5);cylinder(well,lightwood,0,1.2,0,.25,.4);obstacle(t.x+L.well[0],t.z+L.well[1],2.2,2.2);
  for(const side of [-1,1]){const s=placed(t.x+side*6,t.z+5);for(const xx of [-1.5,1.5])for(const zz of [-.8,.8])box(s,wood,xx,1.4,zz,.12,2.8,.12);for(let k=0;k<6;k++){const m=box(s,k%2===0?(t.id==='ironhold'||t.id==='frostwatch'?0x658088:0x9b563b):0xd4c698,-1.5+k*.6,2.78,0,.62,.08,2.25);m.rotation.x=.12;}box(s,lightwood,0,.9,0,3.3,.15,1.7);localObstacle(s,0,0,3.3,1.7);for(let i=0;i<18;i++)sphere(s,[0xb0a35c,0xa9673c,0x75874a][i%3],(random()-.5)*2.6,1.12,(random()-.5)*1.3,.13,.15,.13);barrel(s,2,0);crate(s,-2.2,.4);}
  // Lanterns light the road after dusk without expensive point lights.
  for(const x of [-7.8,7.8]){const g=placed(t.x+x,t.z+13);box(g,wood,0,1.7,0,.16,3.4,.16);box(g,wood,.45,3.35,0,1,.12,.12);box(g,0x424c3c,.8,2.97,0,.34,.5,.34);box(g,glow,.8,2.99,.18,.22,.33,.02);}
  person(t.id+'-innkeeper',keeper,'innkeeper',t.id,h1.group.position.x+1.5,h1.group.position.z-1,0x8b734f,h1.id);
 }
 const fw=TOWNS[3];
 person('rowan','Rowan','merchant','eldermere',-6,7,0x53694e);person('elin','Elin','herbalist','eldermere',6,7,0x697548);
 person('agnes','Agnes','farmer','mossbrook',-106,-71,0x9d7847);person('tilda','Tilda','weaver','mossbrook',-94,-71,0x82697c);
 person('gareth','Gareth','smith','ironhold',102,-98,0x6c6860);person('ida','Ida','merchant','ironhold',114,-98,0x657d85);
 person('halvard','Halvard','trapper','frostwatch',fw.x-6,fw.z+7,0x6c6860);person('brenna','Brenna','herbalist','frostwatch',fw.x+6,fw.z+7,0x697548);
 // Farms, fences, a windmill and a stone keep make each settlement distinct.
 const farm=placed(-128,-75);for(let z=-7;z<8;z+=.65)for(let x=-6;x<7;x+=.65){box(farm,0x908047,x,.05,z,.55,.08,.55);const stalk=box(farm,0xc6b05b,x,.5+random()*.15,z,.035,1,.035);piece(farm,coneG,0xd9bd69,x,1.08,z,.07,.34,.07);}
 for(const zz of [-9,9]){for(let x=-8;x<=8;x+=2)box(farm,wood,x,.6,zz,.14,1.2,.14);box(farm,lightwood,0,.8,zz,16,.13,.12);box(farm,lightwood,0,.4,zz,16,.13,.12);}
 const mill=placed(-124,-97);piece(mill,cylG,0xd6c89e,0,4,0,2.3,8,2.3);piece(mill,coneG,0x806b42,0,9,0,3,3,3);const rotor=new T.Group();rotor.position.set(0,7,2.45);rotor.userData.dynamic=true;mill.add(rotor);for(let i=0;i<4;i++){const a=new T.Group();a.rotation.z=i*Math.PI/2;rotor.add(a);box(a,wood,0,2.8,0,.15,5.6,.15);for(let j=1;j<6;j++)box(a,0xbfb38a,.52,j,0,.95,.7,.09);}animated.push({type:'mill',mesh:rotor});obstacle(-124,-97,4.6,4.6);
 for(const dx of [-7,7]){const g=placed(108+dx,-135);cylinder(g,0x92958a,0,5,0,3.3,10);for(let i=0;i<9;i++){const th=i/9*Math.PI*2;box(g,stone,Math.cos(th)*3,10.4,Math.sin(th)*3,.85,1.2,.85);}piece(g,coneG,0x4d6370,0,12,0,3.7,3.8,3.7);box(g,0x293f3c,0,7,3.25,.65,1.6,.1);obstacle(108+dx,-135,6.5,6.5);}
 box(root,stone,108,heightAt(108,-135)+7,-135,8,3,2);for(const x of [96,120]){box(root,stone,x,heightAt(x,-135)+2.5,-135,8,5,1.8);obstacle(x,-135,8,1.8);}
 // A timber watchtower keeps an eye on the northern roads; its legs leave room to walk beneath.
 {const g=placed(-38,-219);for(const sx of [-1,1])for(const sz of [-1,1]){box(g,wood,sx*1.2,4,sz*1.2,.3,8,.3);obstacle(-38+sx*1.2,-219+sz*1.2,.4,.4);}for(const y of [2.6,5.2])for(const s of [-1,1]){box(g,lightwood,0,y,s*1.2,2.6,.14,.14);box(g,lightwood,s*1.2,y,0,.14,.14,2.6);}
  box(g,lightwood,0,8,0,3.4,.22,3.4);for(const s of [-1,1]){box(g,wood,0,8.6,s*1.6,3.4,.9,.12);box(g,wood,s*1.6,8.6,0,.12,.9,3.4);}for(const sx of [-1,1])for(const sz of [-1,1])box(g,wood,sx*1.55,9.6,sz*1.55,.16,2.2,.16);
  const cap=piece(g,coneG,0x806b42,0,11.5,0,2.9,1.9,2.9);cap.rotation.y=Math.PI/4;piece(g,coneG,snowCap,0,11.9,0,2,1.25,2).rotation.y=Math.PI/4;box(g,glow,0,9.4,0,.32,.42,.32);for(const s of [-.3,.3])beam(g,lightwood,[s,0,1.9],[s,8,1.35],.05);for(let y=.6;y<8;y+=.7)box(g,lightwood,0,y,1.9-y*.07,.6,.06,.08);}
 // Small stone circle in the western woodland: the Hollow King's court.
 for(let i=0;i<9;i++){const theta=i/9*Math.PI*2,x=-64+Math.cos(theta)*5,z=-134+Math.sin(theta)*5;const m=piece(root,rockG,rock,x,heightAt(x,z)+1.6,z,.65,2,.55);m.rotation.z=(random()-.5)*.2;obstacle(x,z,1,1);}
 // North: snow-dusted boulders, a barrow mound and the Wyrm's glacier lair ringed by glowing ice.
 for(let i=0,n=0;i<260&&n<70;i++){const x=(random()-.5)*570,z=-195-random()*92;if(Math.abs(x-RIVER.x)<9||Math.hypot(x-TARN.x,z-TARN.z)<TARN.radius+5||Math.hypot(x-fw.x,z-fw.z)<30||nearRoad(x,z,-.5)||!clearOf(x,z))continue;n++;const s=.6+random()*1.8,m=piece(root,rockG,snow,x,heightAt(x,z)+s*.2,z,s,s*.6,s*.85);m.rotation.y=random()*3;if(s>1.2)obstacle(x,z,s*1.3,s*1.3);}
 {const g=placed(-100,-243);sphere(g,snow,0,-.5,0,7,2.6,5);box(g,0x323c32,0,.6,4.6,1.4,1.5,.4);for(const s of [-1,1]){piece(g,rockG,rock,s*1.2,1.1,4.8,.45,1.4,.4);piece(g,rockG,rock,s*3.6,.9,5.6,.5,1.1,.45);}box(g,rock,0,1.55,4.8,3,.4,.6);obstacle(-100,-243,11,7);}
 for(let i=0;i<44;i++){const t=i/44*Math.PI*2+random()*.05,r=FROST.arena+1+random()*3,x=FROST.x+Math.cos(t)*r,z=FROST.z+Math.sin(t)*r;if(nearRoad(x,z,-.5)||WAYSTONES.some(v=>Math.hypot(x-v.x,z-v.z)<5))continue;const s=.5+random()*.6,hh=2.4+random()*3.6,m=piece(root,octaG,crystal,x,heightAt(x,z)+hh*.42,z,s,hh,s*.8);m.rotation.set((random()-.5)*.35,random()*3,(random()-.5)*.35);if(s>.7)obstacle(x,z,s*1.2,s*1.2);if(i%3===0){const q=piece(root,octaG,crystal,x+Math.cos(t)*1.3,heightAt(x,z)+.4,z+Math.sin(t)*1.3,.3,1.2,.3);q.rotation.z=.5;}}
 {const g=placed(FROST.x+11,FROST.z+7,.7);beam(g,bone,[0,.4,-4.8],[0,1.9,3.6],.17);for(let i=0;i<7;i++){const zz=-3.2+i*1.05,hh=1.1+Math.sin(i/6*Math.PI)*.7+i*.1;for(const s of [-1,1]){beam(g,bone,[0,hh,zz],[s*1.9,hh+.6,zz+.2],.09);beam(g,bone,[s*1.9,hh+.6,zz+.2],[s*2.5,-.1,zz+.5],.08);}}sphere(g,bone,0,.7,5.1,.8,.55,1.15);for(const s of [-1,1])piece(g,coneG,bone,s*.5,1.2,4.7,.13,.95,.13).rotation.x=-.7;for(let i=0;i<6;i++){const q=piece(g,octaG,ice,(random()-.5)*5,.3,(random()-.5)*8,.35,.9+random()*.8,.3);q.rotation.z=(random()-.5)*.8;}}
 // Mire: black bog pools fringed with reeds, glowing fungus, drowned stilt huts and the witch's circle.
 for(const p of POOLS.filter(p=>p.kind==='bog')){disc(bog,p.x,p.z,p.r,.035);for(let i=0;i<9;i++){const t=random()*Math.PI*2,r=p.r+.2+random()*1,x=p.x+Math.cos(t)*r,z=p.z+Math.sin(t)*r;const m=piece(root,coneG,reed,x,heightAt(x,z)+.55,z,.06,1.1+random()*.6,.06);m.rotation.z=(random()-.5)*.35;}}
 for(let i=0,n=0;i<300&&n<46;i++){const t=random()*Math.PI*2,d=Math.sqrt(random())*70,x=MIRE.x+Math.cos(t)*d,z=MIRE.z+Math.sin(t)*d;if(nearRoad(x,z,-2)||POOLS.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+.8)||Math.hypot(x,z)>262)continue;n++;for(let j=0,k=3+Math.floor(random()*3);j<k;j++){const mx=x+(random()-.5)*1.4,mz=z+(random()-.5)*1.4,y=heightAt(mx,mz),s=.6+random()*.8;cylinder(root,bone,mx,y+.2*s,mz,.05*s,.4*s);sphere(root,teal,mx,y+.42*s,mz,.2*s,.1*s,.2*s);}}
 for(const [hx,hz,yaw]of HUTS){const g=placed(hx,hz,yaw),fy=1.7;for(const sx of [-1.8,1.8])for(const sz of [-1.6,1.6]){box(g,wood,sx,fy/2-.2,sz,.22,fy+.4,.22);localObstacle(g,sx,sz,.4,.4);}
  box(g,lightwood,0,fy,0,4.4,.18,3.9);box(g,wood,0,fy+1,-1.8,4.1,1.9,.14);box(g,wood,-2,fy+1,0,.14,1.9,3.6);const broken=box(g,wood,2,fy+.55,.4,.14,1,2.6);broken.rotation.x=.18;box(g,wood,-1.2,fy+.8,1.8,1.6,1.5,.14);
  for(const s of [-1,1]){const r=box(g,0x897744,s*1.1,fy+2.35,0,2.6,.12,4.3);r.rotation.z=-s*.55;if(s>0)r.rotation.x=.16;}for(const s of [-.3,.3])beam(g,lightwood,[s,0,2.9],[s,fy,1.95],.04);for(let y=.35;y<fy;y+=.4)box(g,lightwood,0,y,2.9-y*.55,.6,.05,.06);}
 const MW=BOSSES.mire;for(let i=0;i<11;i++){const t=i/11*Math.PI*2+.2,x=MW.x+Math.cos(t)*(MW.arena+1.6),z=MW.z+Math.sin(t)*(MW.arena+1.6);if(nearRoad(x,z,-.5))continue;const g=placed(x,z,Math.atan2(MW.x-x,MW.z-z)),lean=(random()-.5)*.2;
  cylinder(g,deadwood,0,1.9,0,.16,3.8).rotation.z=lean;beam(g,deadwood,[0,2.6,0],[.75,3.35,.1],.06);beam(g,deadwood,[0,3,0],[-.65,3.75,-.1],.05);box(g,deadwood,0,3.25,0,1.3,.1,.1);sphere(g,bone,0,3.98,.05,.22,.25,.24);for(const s of [-1,1])sphere(g,charcoal,s*.08,4,.25,.05);
  beam(g,deadwood,[.6,3.25,0],[.62,2.95,0],.015);box(g,hexLight,.62,2.8,0,.18,.26,.18);obstacle(x,z,.7,.7);}
 {const x=MW.x+5,z=MW.z-5,g=placed(x,z);sphere(g,charcoal,0,.8,0,1.1,.8,1.1);cylinder(g,charcoal,0,1.3,0,1,.14);cylinder(g,hexLight,0,1.32,0,.9,.06);for(let i=0;i<3;i++){const t=i/3*Math.PI*2;cylinder(g,charcoal,Math.cos(t)*.75,.25,Math.sin(t)*.75,.07,.5);box(g,wood,Math.cos(t)*.5,.1,Math.sin(t)*.5,.9,.14,.14).rotation.y=t;}box(g,lava,0,.12,0,.5,.1,.5);obstacle(x,z,2.4,2.4);}
 // Cinder Reach: lava pools and cracks, obsidian spires, basalt columns round the caldera, a forge-altar.
 for(const p of LAVA){disc(lava,p.x,p.z,p.r,.035);for(let i=0;i<6;i++){const t=i/6*Math.PI*2+random(),x=p.x+Math.cos(t)*(p.r+.5),z=p.z+Math.sin(t)*(p.r+.5);piece(root,rockG,basalt,x,heightAt(x,z),z,.5+random()*.5,.35,.6+random()*.4).rotation.y=random()*3;}}
 for(let i=0,n=0;i<500&&n<70;i++){const t=random()*Math.PI*2,d=Math.sqrt(random())*72,x=ASH.x+Math.cos(t)*d,z=ASH.z+Math.sin(t)*d;if(Math.hypot(x,z)>262||nearRoad(x,z,-1.5)||LAVA.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+1.5))continue;n++;let yaw=random()*Math.PI;for(let k=0,px=x,pz=z;k<2;k++){const len=(k?1.2:2)+random()*2.6,dx=Math.sin(yaw)*len/2,dz=Math.cos(yaw)*len/2,h0=heightAt(px-dx,pz-dz),h1=heightAt(px+dx,pz+dz);const m=box(root,lava,px,(h0+h1)/2+.015,pz,.1+random()*.18,.06,len);m.rotation.set(-Math.atan2(h1-h0,len),yaw,0,'YXZ');m.castShadow=false;px+=dx*1.6;pz+=dz*1.6;yaw+=.6+random()*.6;}}
 for(let i=0,n=0;i<260&&n<26;i++){const t=random()*Math.PI*2,d=Math.sqrt(random())*70,x=ASH.x+Math.cos(t)*d,z=ASH.z+Math.sin(t)*d;if(Math.hypot(x,z)>258||nearRoad(x,z)||!clearOf(x,z,2)||LAVA.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+3))continue;n++;for(let k=0;k<1+Math.floor(random()*3);k++){const s=(k?.5:1)*(.8+random()*.8),hh=(k?.55:1)*(3+random()*6),sx=x+(k?(random()-.5)*3:0),sz=z+(k?(random()-.5)*3:0),m=piece(root,coneG,obsidian,sx,heightAt(sx,sz)+hh*.45,sz,s,hh,s*.9);m.rotation.set((random()-.5)*.3,random()*3,(random()-.5)*.3);obstacle(sx,sz,s*1.1,s*1.1);}}
 for(let i=0,n=0;i<120&&n<40;i++){const t=random()*Math.PI*2,d=Math.sqrt(random())*72,x=ASH.x+Math.cos(t)*d,z=ASH.z+Math.sin(t)*d;if(Math.hypot(x,z)>262||nearRoad(x,z,-1)||LAVA.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+1))continue;n++;const s=.3+random()*.9;piece(root,rockG,basalt,x,heightAt(x,z)+s*.15,z,s,s*.55,s*.8).rotation.y=random()*3;}
 const CB=BOSSES.cinder;for(let i=0;i<30;i++){if(i%7===3)continue;const t=i/30*Math.PI*2,r0=CB.arena+1.4+random()*1.6;for(let k=0;k<3;k++){const r=r0+(k-1)*.9,tt=t+(k-1)*.035,x=CB.x+Math.cos(tt)*r,z=CB.z+Math.sin(tt)*r;if(nearRoad(x,z,-.4))continue;const rr=.5+random()*.25,hh=2+random()*4.6+(k===1?1.4:0);piece(root,hexG,basalt,x,heightAt(x,z)+hh/2-.3,z,rr,hh,rr).rotation.y=random();obstacle(x,z,rr*1.6,rr*1.6);}}
 {const x=CB.x+10,z=CB.z-11,g=placed(x,z,Math.atan2(CB.x-x,CB.z-z));box(g,stone,0,.5,0,3.2,1,2.1);box(g,0x606960,0,1.08,0,2.8,.16,1.8);box(g,lava,-.55,1.2,0,1.1,.08,1.1);box(g,0x323c32,.8,1.45,0,.9,.35,.45);box(g,0x323c32,.8,1.25,0,.35,.3,.3);for(const s of [-1,1]){piece(g,hexG,basalt,s*2.1,1.2,-.4,.4,2.4,.4);box(g,lava,s*2.1,2.45,-.4,.45,.12,.45);}obstacle(x,z,4.2,3.2);}
 // Waystones: a rune-carved standing stone behind a low dais; the travel point itself stays walkable.
 const waystones=WAYSTONES.map(v=>{const n=roadNear(v.x,v.z),yaw=n.d>.5?Math.atan2(n.x-v.x,n.z-v.z):0,g=placed(v.x,v.z,yaw);cylinder(g,stone,0,.12,-.5,1.9,.24);cylinder(g,stone,0,.34,-1.4,.95,.3);
  const st=box(g,0x606960,0,2.3,-1.4,.95,3.6,.6);st.rotation.z=.03;box(g,rune,0,2.55,-1.08,.12,1.5,.05);box(g,rune,0,2.95,-1.08,.62,.1,.05);box(g,rune,0,2.05,-1.08,.42,.08,.05);
  for(let i=0;i<3;i++){const t=i*2.2+1;piece(g,rockG,rock,Math.cos(t)*1.9,.1,-.5+Math.sin(t)*1.9,.35,.25,.3);}localObstacle(g,0,-1.4,1,1);return{id:v.id,name:v.name,x:v.x,z:v.z,group:g};});
 function gather(id,kind,x,z){const g=placed(x,z);g.userData.dynamic=true;if(kind==='herbs'){for(let i=0;i<5;i++){const a=i/5*6.28;piece(g,coneG,0x526d3d,Math.cos(a)*.22,.22,Math.sin(a)*.22,.12,.55,.1);sphere(g,0xbba7c7,Math.cos(a)*.22,.53,Math.sin(a)*.22,.085,.12,.085);}}else if(kind==='berries'){sphere(g,0x41643d,0,.45,0,.6,.6,.6);for(let i=0;i<8;i++)sphere(g,0xa3504c,(random()-.5)*.8,.7+random()*.2,(random()-.5)*.7,.08);}else{for(let i=0;i<3;i++){const x=(i-1)*.22;cylinder(g,0xd3c19a,x,.15,0,.05,.3);sphere(g,0xb87649,x,.3,0,.18,.09,.18);}}const n={id,kind,x,z,group:g};gatherables.push(n);}
 const spots=[[-10,30],[-12,27],[17,28],[20,30],[-26,-27],[-30,-28],[-45,-24],[-51,-28],[-67,-43],[-72,-51],[-88,-51],[-104,-53],[29,-30],[35,-35],[43,-41],[72,-67],[80,-78],[87,-80],[-67,-126],[-59,-125],[-59,-129],[-35,12],[34,24],[78,35],[-91,-114],[-97,-112]];
 spots.forEach(([x,z],i)=>gather('plant-'+i,['herbs','berries','mushrooms'][i%3],x,z));
 SPOTS.forEach(([kind,x,z],i)=>gather('plant-'+(spots.length+i),kind,x,z));
 // Wildlife has individual wandering and fleeing behavior, with articulated legs.
 function animal(kind,x,z,index){const g=placed(x,z);g.userData.dynamic=true;const legs=[];let speed=.6,bodyColor=0xd2cdb7;
  if(kind==='deer'){bodyColor=0xa28254;sphere(g,bodyColor,0,.85,0,.36,.46,.72);sphere(g,bodyColor,0,1.3,.55,.2,.4,.23);sphere(g,0xb79a68,0,1.65,.68,.2,.25,.28);for(const sx of [-1,1]){piece(g,coneG,bodyColor,sx*.2,1.9,.6,.09,.35,.08);beam(g,0x594c35,[sx*.12,1.84,.64],[sx*.22,2.4,.52],.025);beam(g,0x594c35,[sx*.18,2.14,.56],[sx*.4,2.3,.56],.02);}speed=.9;
  }else if(kind==='sheep'){sphere(g,bodyColor,0,.65,0,.46,.46,.65);sphere(g,0x5d6251,0,.84,.62,.21,.26,.24);sphere(g,0xe0d8bd,0,1,.48,.3,.22,.25);
  }else if(kind==='rabbit'){sphere(g,0xa89a78,0,.24,0,.16,.2,.25);sphere(g,0xa89a78,0,.42,.19,.13,.14,.14);for(const sx of [-1,1])sphere(g,0xa89a78,sx*.075,.66,.18,.045,.22,.07);sphere(g,0xd3d1b6,0,.24,-.25,.09);speed=1.1;
  }else{sphere(g,0xd5c29b,0,.32,0,.22,.28,.3);sphere(g,0xd5c29b,0,.59,.23,.13);piece(g,coneG,0xa95035,0,.74,.23,.07,.15,.05);piece(g,coneG,0xcea75d,0,.59,.4,.06,.18,.06).rotation.x=Math.PI/2;speed=.7;}
  if(kind!=='rabbit')for(const sx of [-1,1])for(const sz of [-1,1]){const leg=box(g,kind==='deer'?0x695b3e:0x615f4a,sx*(kind==='chicken'?.12:.22),kind==='deer'?.35:.2,sz*.38,.08,kind==='deer'?.72:.4,.09);legs.push(leg);}
  animals.push({kind,group:g,legs,homeX:x,homeZ:z,phase:index*1.8,speed,heading:random()*6.28,x,z});
 }
 for(let i=0;i<12;i++)animal('sheep',-116+random()*18,-58+random()*12,i);
 for(let i=0;i<13;i++)animal('deer',i<5?-38+random()*15:80+random()*35,i<5?25+random()*15:-53+random()*25,i);
 for(let i=0;i<16;i++)animal('rabbit',-45+random()*80,-35+random()*85,i);
 for(let i=0;i<9;i++)animal('chicken',-9+random()*18,10+random()*10,i);
 // Bird silhouettes orbit the valley above the rooftops.
 for(let i=0;i<12;i++){const g=new T.Group();g.userData.dynamic=true;root.add(g);const l=box(g,0x3d5146,-.32,0,0,.64,.045,.16),r=box(g,0x3d5146,.32,0,0,.64,.045,.16);animated.push({type:'bird',mesh:g,left:l,right:r,phase:i*1.8});}
 const fireflyMaterial=new T.MeshBasicMaterial({color:0xd8e9a3});for(let i=0;i<35;i++){const m=sphere(root,fireflyMaterial,-40+random()*80,1+random()*3,random()*60,.027);m.userData.dynamic=true;fireflies.push(m);}
 // Batch static geometry by material to keep a large valley within a small draw budget.
 root.updateMatrixWorld(true);const batches=new Map(),remove=[];
 root.traverse(o=>{if(!o.isMesh)return;let p=o;while(p&&p!==root){if(p.userData.dynamic)return;p=p.parent;}const key=o.geometry.uuid+':'+o.material.uuid;if(!batches.has(key))batches.set(key,{geo:o.geometry,mat:o.material,items:[],shadow:o.castShadow});batches.get(key).items.push(o.matrixWorld.clone());remove.push(o);});
 for(const o of remove)o.removeFromParent();for(const {geo,mat,items,shadow}of batches.values()){const m=new T.InstancedMesh(geo,mat,items.length);items.forEach((matrix,i)=>m.setMatrixAt(i,matrix));m.castShadow=shadow;m.receiveShadow=true;m.computeBoundingSphere();scene.add(m);}
 // Animated characters also share draw calls. Their original meshes retain transforms
 // for articulation but render through per-material instance buffers.
 const dynamicBatches=new Map();
 root.traverse(o=>{if(!o.isMesh)return;const key=o.geometry.uuid+':'+o.material.uuid;if(!dynamicBatches.has(key))dynamicBatches.set(key,{geo:o.geometry,mat:o.material,items:[]});dynamicBatches.get(key).items.push(o);o.visible=false;});
 for(const b of dynamicBatches.values()){b.mesh=new T.InstancedMesh(b.geo,b.mat,b.items.length);b.mesh.castShadow=true;b.mesh.receiveShadow=true;b.mesh.frustumCulled=false;b.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(b.mesh);}
 const hiddenMatrix=new T.Matrix4().makeScale(0,0,0);
 function updateDynamic(){root.updateMatrixWorld(true);for(const b of dynamicBatches.values()){for(let i=0;i<b.items.length;i++){const o=b.items[i];let shown=true,p=o.parent;while(p&&p!==root){if(!p.visible){shown=false;break;}p=p.parent;}if(o.userData.dynamic&&fireflies.includes(o))shown=daylightCache<.5;b.mesh.setMatrixAt(i,shown?o.matrixWorld:hiddenMatrix);}b.mesh.instanceMatrix.needsUpdate=true;}}
 let daylightCache=1;updateDynamic();
 const world={colliders,houses,npcs,animals,gatherables,animated,root,glow,fireflies,waystones,lava,regions:REGIONS,
  toggleDoor(h,player){if(h.open&&player&&player.x>h.collider.x1-.5&&player.x<h.collider.x2+.5&&player.z>h.collider.z1-.5&&player.z<h.collider.z2+.5)return false;h.open=!h.open;if(h.open){colliders.splice(colliders.indexOf(h.collider),1);}else colliders.push(h.collider);return true;},
  roomAt(x,z){for(const h of houses){const v=new T.Vector3(x-h.group.position.x,0,z-h.group.position.z).applyAxisAngle(new T.Vector3(0,1,0),-h.yaw);if(Math.abs(v.x)<3.85&&Math.abs(v.z)<3.4)return h.id;}return null;},
  update(dt,time,player,daylight){for(const h of houses)h.door.rotation.y=T.MathUtils.damp(h.door.rotation.y,h.open?-Math.PI*.54:0,10,dt);
   for(const n of npcs){const d=Math.hypot(player.x-n.x,player.z-n.z);if(d<5)n.group.rotation.y=Math.atan2(player.x-n.x,player.z-n.z);n.group.position.y=heightAt(n.x,n.z)+Math.sin(time*1.5+n.phase)*.014;}
   for(const a of animals){const g=a.group,d=Math.hypot(player.x-g.position.x,player.z-g.position.z);const flee=d<5&&['deer','rabbit'].includes(a.kind);let heading=a.heading+Math.sin(time*.17+a.phase)*.7;const homeDist=Math.hypot(g.position.x-a.homeX,g.position.z-a.homeZ);if(flee)heading=Math.atan2(g.position.x-player.x,g.position.z-player.z);else if(homeDist>10)heading=Math.atan2(a.homeX-g.position.x,a.homeZ-g.position.z);const moving=flee||Math.sin(time*.3+a.phase)>.1;const speed=flee?3.8:a.speed;let dx=Math.sin(heading)*dt*speed,dz=Math.cos(heading)*dt*speed;if(moving){moveWithCollision(g.position,dx,dz,colliders,.2);g.rotation.y=heading;}g.position.y=surfaceAt(g.position.x,g.position.z)+(a.kind==='rabbit'&&moving?Math.abs(Math.sin(time*9))* .14:0);a.legs.forEach((l,i)=>l.rotation.x=moving?Math.sin(time*speed*8+i%2*Math.PI)*.33:0);}
   for(const a of animated){if(a.type==='mill')a.mesh.rotation.z+=dt*.19;else if(a.type==='ripple'){a.mesh.scale.setScalar(.8+Math.sin(time*.5+a.phase)*.3);a.mesh.position.y=.035;}else{const th=time*.035+a.phase;a.mesh.position.set(Math.cos(th)*62,20+Math.sin(time*.2+a.phase)*3,Math.sin(th)*55-35);a.mesh.rotation.y=-th;a.left.rotation.z=Math.sin(time*6+a.phase)*.35;a.right.rotation.z=-a.left.rotation.z;}}
   for(let i=0;i<fireflies.length;i++){fireflies[i].position.y=1.7+Math.sin(time*.5+i)*.7;}
   const night=1-(Number.isFinite(daylight)?daylight:1);lava.emissiveIntensity=1.6+Math.sin(time*1.9)*.28+Math.sin(time*5.3)*.12;rune.emissiveIntensity=.9+night*.9+Math.sin(time*1.3)*.15;crystal.emissiveIntensity=.55+night*.7;teal.emissiveIntensity=.6+night*1.1;hexLight.emissiveIntensity=1.1+night*.8+Math.sin(time*3.1)*.2;
   windTime.value=time;glow.emissiveIntensity=.4+night*1.2;daylightCache=1-night;updateDynamic();
  }
 };return world;
}
