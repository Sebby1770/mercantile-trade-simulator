import * as T from '../vendor/three.module.js';
import {projectedMaterial} from './materials.js';
export const TOWNS = [
 {id:'eldermere',name:'Eldermere',tag:'THE MARKET TOWN',x:0,z:0,color:0xa15036},
 {id:'mossbrook',name:'Mossbrook',tag:'THE HARVEST HAMLET',x:-100,z:-78,color:0x897744},
 {id:'ironhold',name:'Ironhold',tag:'THE KING’S FRONTIER',x:108,z:-105,color:0x4c6570}
];
export const ROADS = [[[0,35],[0,0],[-6,-5],[-24,-5],[-45,-34],[-100,-52],[-100,-78]],[[0,0],[6,-5],[24,-5],[35,-35],[43,-55],[69,-55],[108,-78],[108,-105]],[[0,22],[45,32],[68,32],[113,2]],[[-100,-78],[-104,-82],[-100,-89],[-100,-108],[-116,-115]],[[108,-105],[104,-109],[108,-116],[108,-145]]];
export const WORLD_LIMIT = 192;
export function heightAt(x,z){const edge=Math.max(0,Math.hypot(x,z)-155)/30;return Math.min(13,edge*edge)+Math.sin(x*.045)*Math.cos(z*.034)*.24;}
export function surfaceAt(x,z){if(Math.abs(x-56)<7.6&&(Math.abs(z+55)<3.6||Math.abs(z-32)<3.6)){const bz=Math.abs(z+55)<3.6?-55:32;return heightAt(56,bz)+.55;}return heightAt(x,z);}
export function seeded(seed=7341){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
const random=seeded();
const boxG=new T.BoxGeometry(1,1,1),sphereG=new T.SphereGeometry(1,10,7),coneG=new T.ConeGeometry(1,1,10),cylG=new T.CylinderGeometry(1,1,1,8),rockG=new T.DodecahedronGeometry(1,0);
const mats=new Map();let worldTextures={};const windTime={value:0};
function material(color){if(!mats.has(color)){let m;
 const woodColors=[0x543b2b,0x987046,0x665038,0x745431,0xb39565,0x806b42];
 const stoneColors=[0x8b9085,0x92958a,0x606960,0x8f8870,0xa79c7c,0xb5a17a,0xb4a888,0xc0b490,0x9e987d];
 if(woodColors.includes(color)&&worldTextures.wood)m=projectedMaterial(0xe5d3b8,worldTextures.wood,.35);
 else if(stoneColors.includes(color)&&worldTextures.stone)m=projectedMaterial(0xd4d4c9,worldTextures.stone,.5);
 else m=new T.MeshStandardMaterial({color,roughness:.88});
 if([0x496437,0x658047,0x7a8c47,0x304f3d,0x416248,0x4c7050].includes(color)){m.roughness=1;m.onBeforeCompile=shader=>{shader.uniforms.realmWindTime=windTime;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float realmWindTime;');shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=sin(realmWindTime*.7+position.y*2.)*.022*max(0.,position.y+1.);');};}
 mats.set(color,m);}return mats.get(color);}
function piece(parent,geo,color,x,y,z,sx=1,sy=1,sz=1){const m=new T.Mesh(geo,typeof color==='number'?material(color):color);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
const box=(p,c,x,y,z,w,h,d)=>piece(p,boxG,c,x,y,z,w,h,d);
const sphere=(p,c,x,y,z,w,h=w,d=w)=>piece(p,sphereG,c,x,y,z,w,h,d);
const cylinder=(p,c,x,y,z,r,h)=>piece(p,cylG,c,x,y,z,r,h,r);
function beam(p,c,a,b,r=.09){const d=new T.Vector3(...b).sub(new T.Vector3(...a));const m=piece(p,cylG,c,...new T.Vector3(...a).addScaledVector(d,.5).toArray(),r,d.length(),r);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;}
const wood=0x543b2b,lightwood=0x987046,plaster=0xe1d2a5,stone=0x8b9085;
export function blocksAt(x,z,colliders,r=.32){if(Math.abs(x)>WORLD_LIMIT||Math.abs(z)>WORLD_LIMIT)return true;if(Math.abs(x-56)<5.8+r&&Math.abs(z+55)>4-r&&Math.abs(z-32)>4-r)return true;return colliders.some(c=>x>c.x1-r&&x<c.x2+r&&z>c.z1-r&&z<c.z2+r);}
export function moveWithCollision(position,dx,dz,colliders,r=.32){const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.18));for(let i=0;i<n;i++){if(!blocksAt(position.x+dx/n,position.z,colliders,r))position.x+=dx/n;if(!blocksAt(position.x,position.z+dz/n,colliders,r))position.z+=dz/n;}return position;}
export function createWorld(scene,{textures={}}={}){worldTextures=textures;mats.clear();
 const root=new T.Group();scene.add(root);const colliders=[],houses=[],npcs=[],animals=[],gatherables=[],animated=[],fireflies=[];
 function obstacle(x,z,w,d){colliders.push({x1:x-w/2,x2:x+w/2,z1:z-d/2,z2:z+d/2});}
 function placed(x,z,yaw=0){const g=new T.Group();g.position.set(x,heightAt(x,z),z);g.rotation.y=yaw;root.add(g);return g;}
 function localObstacle(g,x,z,w,d){const v=new T.Vector3(x,0,z).applyAxisAngle(new T.Vector3(0,1,0),g.rotation.y).add(g.position);const swap=Math.abs(Math.sin(g.rotation.y))>.5;obstacle(v.x,v.z,swap?d:w,swap?w:d);}
 // The ground is a real undulating mesh; paths and feet share the same height function.
 const groundG=new T.PlaneGeometry(470,470,235,94);groundG.rotateX(-Math.PI/2);const a=groundG.attributes.position,colors=[];for(let i=0;i<a.count;i++){const x=a.getX(i),z=a.getZ(i);a.setY(i,Math.abs(x-56)<6.5?-1.6:heightAt(x,z));const c=new T.Color([0x657b3e,0x6a8042,0x718849,0x62783d][Math.floor(random()*4)]);colors.push(c.r,c.g,c.b);}groundG.setAttribute('color',new T.Float32BufferAttribute(colors,3));groundG.computeVertexNormals();const ground=new T.Mesh(groundG,textures.grass?projectedMaterial(0xcad6aa,textures.grass,.28):new T.MeshStandardMaterial({vertexColors:true,roughness:1}));ground.receiveShadow=true;root.add(ground);
 function road(points,width=4.4,color=0xb5a17a){for(let i=1;i<points.length;i++){const [ax,az]=points[i-1],[bx,bz]=points[i],length=Math.hypot(bx-ax,bz-az);const steps=Math.ceil(length/2);for(let j=0;j<steps;j++){const x=ax+(bx-ax)*(j+.5)/steps,z=az+(bz-az)*(j+.5)/steps;const m=box(root,color,x,heightAt(x,z)+.015,z,width,.055,length/steps+.15);m.rotation.y=Math.atan2(bx-ax,bz-az);m.castShadow=false;}}}
 for(const r of ROADS)road(r);
 // River, banks, and two traversable bridges.
 const water=new T.Mesh(new T.PlaneGeometry(11,450,1,1),new T.MeshStandardMaterial({color:0x5c9e9b,metalness:.34,roughness:.24,transparent:true,opacity:.88}));water.rotation.x=-Math.PI/2;water.position.set(56,-.07,0);if(!textures.grass)root.add(water);
 for(let z=-200;z<205;z+=4){for(const x of [49.8,62.2])sphere(root,0x949885,x,heightAt(x,z)-.1,z,1+random(),.35,.9+random());}
 for(const bz of [-55,32]){const g=placed(56,bz);for(let x=-7;x<=7;x+=.5)box(g,lightwood,x,.4,0,.47,.3,7.5);for(const sz of [-3.65,3.65]){for(let x=-7;x<=7;x+=3.5)box(g,wood,x,1,sz,.16,1.8,.16);box(g,lightwood,0,1.6,sz,14,.15,.15);} }
 const rippleG=new T.TorusGeometry(.8,.014,3,20);for(let i=0;i<30;i++){const m=piece(root, rippleG,0xb9d3b1,52+random()*8,.015,-180+random()*360,1,1,1);m.rotation.x=-Math.PI/2;m.scale.setScalar(.6+random());m.userData.dynamic=true;animated.push({type:'ripple',mesh:m,phase:random()*6});}
 // Distant mountain silhouettes and cloud banks.
 for(let i=0;i<54;i++){const theta=i/54*Math.PI*2,r=230+random()*90,x=Math.cos(theta)*r,z=Math.sin(theta)*r;piece(root,coneG,[0x748a78,0x7d9181,0x6b8173][i%3],x,17,z,28+random()*37,45+random()*60,28+random()*37);}
 const cloudMat=new T.MeshStandardMaterial({color:0xf2f0d8,roughness:1,flatShading:true});for(let i=0;i<(textures.grass?0:18);i++){const g=placed(-200+random()*400,-200+random()*400);g.position.y=46+random()*20;for(let j=0;j<5;j++)sphere(g,cloudMat,j*6,random()*1.5,random()*3,9,2.3,5);}
 function tree(x,z,s=1,pine=false){const g=placed(x,z,random()*6);cylinder(g,0x665038,0,2*s,0,.22*s,4*s);if(pine){for(let k=0;k<3;k++)piece(g,coneG,[0x304f3d,0x416248,0x4c7050][k],0,(3+k*1.3)*s,0,(2.5-k*.45)*s,3.8*s,(2.5-k*.45)*s);}else{sphere(g,0x496437,0,4.9*s,0,2.7*s,2.8*s,2.7*s);sphere(g,0x658047,-1.6*s,4.1*s,.3*s,1.9*s,2.1*s,2*s);sphere(g,0x7a8c47,1.3*s,4.7*s,.5*s,1.8*s,2*s,1.8*s);}if(s>.6)obstacle(x,z,.5*s,.5*s);}
 function nearRoad(x,z,pad=0){for(const line of ROADS)for(let i=1;i<line.length;i++){const [ax,az]=line[i-1],[bx,bz]=line[i],t=Math.max(0,Math.min(1,((x-ax)*(bx-ax)+(z-az)*(bz-az))/((bx-ax)**2+(bz-az)**2)));if(Math.hypot(x-ax-(bx-ax)*t,z-az-(bz-az)*t)<5+pad)return true;}return false;}
 for(let i=0;i<610;i++){const x=(random()-.5)*400,z=(random()-.5)*400;if(Math.abs(x-56)<10||TOWNS.some(t=>Math.hypot(x-t.x,z-t.z)<34)||nearRoad(x,z))continue;tree(x,z,.7+random()*.8,z<-105||random()<.24);}
 for(const [x,z,s] of [[-9,22,1.2],[12,23,1.1],[-26,-3,1.4],[26,-20,1.3],[-19,30,.8],[23,35,.9],[-112,-65,1.1],[-82,-89,1.5],[88,-88,.9]])tree(x,z,s);
 // Modest grass clumps and flowers are instanced with the rest of the static world.
 for(let i=0;i<2100;i++){const x=(random()-.5)*350,z=(random()-.5)*350;if(Math.abs(x-56)<7||nearRoad(x,z,-1)||TOWNS.some(t=>Math.hypot(x-t.x,z-t.z)<24))continue;const y=heightAt(x,z);const m=piece(root,coneG,[0x536f36,0x819348,0x8a9852][i%3],x,y+.25,z,.09,.5+random()*.3,.14);m.rotation.z=(random()-.5)*.4;if(i%5===0)sphere(root,[0xc6b05e,0xe0d7b0,0xa097ae][i%3],x,y+.5,z,.085);}
 function barrel(g,x,z){cylinder(g,lightwood,x,.43,z,.35,.82);for(const y of [.16,.64])cylinder(g,0x535b50,x,y,z,.365,.07);}
 function crate(g,x,z,s=.7){box(g,lightwood,x,s/2,z,s,s,s);for(const xx of [x-s*.4,x+s*.4])box(g,wood,xx,s/2,z+s*.51,.06,s,.04);}
 function table(g,x,z,w=2){box(g,lightwood,x,.95,z,w,.14,.8);for(const xx of [x-w*.39,x+w*.39])for(const zz of [z-.26,z+.26])box(g,wood,xx,.45,zz,.11,.9,.11);}
 function roof(g,w,d,color){const shape=new T.Shape();shape.moveTo(-w/2,0);shape.lineTo(0,2.5);shape.lineTo(w/2,0);shape.closePath();const geom=new T.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false});const m=piece(g,geom,color,0,4.5,-d/2);m.castShadow=true;for(let z=-d/2;z<=d/2;z+=1.05){beam(g,0x684a32,[-w/2,4.5,z],[0,7,z],.035);beam(g,0x684a32,[0,7,z],[w/2,4.5,z],.035);} }
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
 for(const t of TOWNS){
  const plaza=cylinder(root,0xa79c7c,t.x,heightAt(t.x,t.z)+.04,t.z,13,.09);plaza.castShadow=false;
  for(let i=0;i<130;i++){const theta=random()*6.28,r=2+random()*10;const x=t.x+Math.cos(theta)*r,z=t.z+Math.sin(theta)*r;const m=box(root, [0xb4a888,0xc0b490,0x9e987d][i%3],x,heightAt(x,z)+.1,z,.45+random()*.3,.06,.35+random()*.25);m.rotation.y=random()*3;}
  const h1=house(t,t.id+'-inn',-11,-15,0,'inn',t.id==='eldermere'?'The Gilded Stag':t.id==='mossbrook'?'The Barley Rest':'The Iron Hearth');
  house(t,t.id+'-shop',11,-15,0,'shop',t.id==='eldermere'?'Willow & Root':t.id==='mossbrook'?'The Wool House':'Hammer & Tongs');
  house(t,t.id+'-west',-20,4,Math.PI/2,'home','Weaver’s cottage');house(t,t.id+'-east',20,4,-Math.PI/2,'home','Merchant’s cottage');
  for(const side of [-1,1]){road([[t.x+side*11,t.z-10],[t.x+side*7,t.z-2]],2.5);road([[t.x+side*14,t.z+4],[t.x+side*7,t.z+2]],2.5);}
  const well=placed(t.x,t.z-3);cylinder(well,stone,0,.5,0,1.05,1);cylinder(well,0x425d54,0,1.02,0,.78,.015);for(const sx of [-1,1])box(well,wood,sx*1.3,1.6,0,.16,3.2,.16);box(well,lightwood,0,3.2,0,3,.2,1.5);cylinder(well,lightwood,0,1.2,0,.25,.4);obstacle(t.x,t.z-3,2.2,2.2);
  for(const side of [-1,1]){const s=placed(t.x+side*6,t.z+5);for(const xx of [-1.5,1.5])for(const zz of [-.8,.8])box(s,wood,xx,1.4,zz,.12,2.8,.12);for(let k=0;k<6;k++){const m=box(s,k%2===0?(t.id==='ironhold'?0x658088:0x9b563b):0xd4c698,-1.5+k*.6,2.78,0,.62,.08,2.25);m.rotation.x=.12;}box(s,lightwood,0,.9,0,3.3,.15,1.7);localObstacle(s,0,0,3.3,1.7);for(let i=0;i<18;i++)sphere(s,[0xb0a35c,0xa9673c,0x75874a][i%3],(random()-.5)*2.6,1.12,(random()-.5)*1.3,.13,.15,.13);barrel(s,2,0);crate(s,-2.2,.4);}
  // Lanterns light the road after dusk without expensive point lights.
  for(const x of [-7.8,7.8]){const g=placed(t.x+x,t.z+13);box(g,wood,0,1.7,0,.16,3.4,.16);box(g,wood,.45,3.35,0,1,.12,.12);box(g,0x424c3c,.8,2.97,0,.34,.5,.34);box(g,glow,.8,2.99,.18,.22,.33,.02);}
  person(t.id+'-innkeeper',t.id==='eldermere'?'Bram':t.id==='mossbrook'?'Mara':'Oswin','innkeeper',t.id,h1.group.position.x+1.5,h1.group.position.z-1,0x8b734f,h1.id);
 }
 person('rowan','Rowan','merchant','eldermere',-6,7,0x53694e);person('elin','Elin','herbalist','eldermere',6,7,0x697548);
 person('agnes','Agnes','farmer','mossbrook',-106,-71,0x9d7847);person('tilda','Tilda','weaver','mossbrook',-94,-71,0x82697c);
 person('gareth','Gareth','smith','ironhold',102,-98,0x6c6860);person('ida','Ida','merchant','ironhold',114,-98,0x657d85);
 // Farms, fences, a windmill and a stone keep make each settlement distinct.
 const farm=placed(-128,-75);for(let z=-7;z<8;z+=.65)for(let x=-6;x<7;x+=.65){box(farm,0x908047,x,.05,z,.55,.08,.55);const stalk=box(farm,0xc6b05b,x,.5+random()*.15,z,.035,1,.035);piece(farm,coneG,0xd9bd69,x,1.08,z,.07,.34,.07);}
 for(const zz of [-9,9]){for(let x=-8;x<=8;x+=2)box(farm,wood,x,.6,zz,.14,1.2,.14);box(farm,lightwood,0,.8,zz,16,.13,.12);box(farm,lightwood,0,.4,zz,16,.13,.12);}
 const mill=placed(-124,-97);piece(mill,cylG,0xd6c89e,0,4,0,2.3,8,2.3);piece(mill,coneG,0x806b42,0,9,0,3,3,3);const rotor=new T.Group();rotor.position.set(0,7,2.45);rotor.userData.dynamic=true;mill.add(rotor);for(let i=0;i<4;i++){const a=new T.Group();a.rotation.z=i*Math.PI/2;rotor.add(a);box(a,wood,0,2.8,0,.15,5.6,.15);for(let j=1;j<6;j++)box(a,0xbfb38a,.52,j,0,.95,.7,.09);}animated.push({type:'mill',mesh:rotor});obstacle(-124,-97,4.6,4.6);
 for(const dx of [-7,7]){const g=placed(108+dx,-135);cylinder(g,0x92958a,0,5,0,3.3,10);for(let i=0;i<9;i++){const th=i/9*Math.PI*2;box(g,stone,Math.cos(th)*3,10.4,Math.sin(th)*3,.85,1.2,.85);}piece(g,coneG,0x4d6370,0,12,0,3.7,3.8,3.7);box(g,0x293f3c,0,7,3.25,.65,1.6,.1);obstacle(108+dx,-135,6.5,6.5);}
 box(root,stone,108,heightAt(108,-135)+7,-135,8,3,2);for(const x of [96,120]){box(root,stone,x,heightAt(x,-135)+2.5,-135,8,5,1.8);obstacle(x,-135,8,1.8);}
 // Small stone circle in the western woodland.
 for(let i=0;i<9;i++){const theta=i/9*Math.PI*2,x=-64+Math.cos(theta)*5,z=-134+Math.sin(theta)*5;const m=piece(root,rockG,0x869286,x,heightAt(x,z)+1.6,z,.65,2,.55);m.rotation.z=(random()-.5)*.2;obstacle(x,z,1,1);}
 function gather(id,kind,x,z){const g=placed(x,z);g.userData.dynamic=true;if(kind==='herbs'){for(let i=0;i<5;i++){const a=i/5*6.28;piece(g,coneG,0x526d3d,Math.cos(a)*.22,.22,Math.sin(a)*.22,.12,.55,.1);sphere(g,0xbba7c7,Math.cos(a)*.22,.53,Math.sin(a)*.22,.085,.12,.085);}}else if(kind==='berries'){sphere(g,0x41643d,0,.45,0,.6,.6,.6);for(let i=0;i<8;i++)sphere(g,0xa3504c,(random()-.5)*.8,.7+random()*.2,(random()-.5)*.7,.08);}else{for(let i=0;i<3;i++){const x=(i-1)*.22;cylinder(g,0xd3c19a,x,.15,0,.05,.3);sphere(g,0xb87649,x,.3,0,.18,.09,.18);}}const n={id,kind,x,z,group:g};gatherables.push(n);}
 const spots=[[-10,30],[-12,27],[17,28],[20,30],[-26,-27],[-30,-28],[-45,-24],[-51,-28],[-67,-43],[-72,-51],[-88,-51],[-104,-53],[29,-30],[35,-35],[43,-41],[72,-67],[80,-78],[87,-80],[-67,-126],[-59,-125],[-59,-129],[-35,12],[34,24],[78,35],[-91,-114],[-97,-112]];
 spots.forEach(([x,z],i)=>gather('plant-'+i,['herbs','berries','mushrooms'][i%3],x,z));
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
 const world={colliders,houses,npcs,animals,gatherables,animated,root,glow,fireflies,
  toggleDoor(h,player){if(h.open&&player&&player.x>h.collider.x1-.5&&player.x<h.collider.x2+.5&&player.z>h.collider.z1-.5&&player.z<h.collider.z2+.5)return false;h.open=!h.open;if(h.open){colliders.splice(colliders.indexOf(h.collider),1);}else colliders.push(h.collider);return true;},
  roomAt(x,z){for(const h of houses){const v=new T.Vector3(x-h.group.position.x,0,z-h.group.position.z).applyAxisAngle(new T.Vector3(0,1,0),-h.yaw);if(Math.abs(v.x)<3.85&&Math.abs(v.z)<3.4)return h.id;}return null;},
  update(dt,time,player,daylight){for(const h of houses)h.door.rotation.y=T.MathUtils.damp(h.door.rotation.y,h.open?-Math.PI*.54:0,10,dt);
   for(const n of npcs){const d=Math.hypot(player.x-n.x,player.z-n.z);if(d<5)n.group.rotation.y=Math.atan2(player.x-n.x,player.z-n.z);n.group.position.y=heightAt(n.x,n.z)+Math.sin(time*1.5+n.phase)*.014;}
   for(const a of animals){const g=a.group,d=Math.hypot(player.x-g.position.x,player.z-g.position.z);const flee=d<5&&['deer','rabbit'].includes(a.kind);let heading=a.heading+Math.sin(time*.17+a.phase)*.7;const homeDist=Math.hypot(g.position.x-a.homeX,g.position.z-a.homeZ);if(flee)heading=Math.atan2(g.position.x-player.x,g.position.z-player.z);else if(homeDist>10)heading=Math.atan2(a.homeX-g.position.x,a.homeZ-g.position.z);const moving=flee||Math.sin(time*.3+a.phase)>.1;const speed=flee?3.8:a.speed;let dx=Math.sin(heading)*dt*speed,dz=Math.cos(heading)*dt*speed;if(moving){moveWithCollision(g.position,dx,dz,colliders,.2);g.rotation.y=heading;}g.position.y=surfaceAt(g.position.x,g.position.z)+(a.kind==='rabbit'&&moving?Math.abs(Math.sin(time*9))* .14:0);a.legs.forEach((l,i)=>l.rotation.x=moving?Math.sin(time*speed*8+i%2*Math.PI)*.33:0);}
   for(const a of animated){if(a.type==='mill')a.mesh.rotation.z+=dt*.19;else if(a.type==='ripple'){a.mesh.scale.setScalar(.8+Math.sin(time*.5+a.phase)*.3);a.mesh.position.y=.035;}else{const th=time*.035+a.phase;a.mesh.position.set(Math.cos(th)*62,20+Math.sin(time*.2+a.phase)*3,Math.sin(th)*55-35);a.mesh.rotation.y=-th;a.left.rotation.z=Math.sin(time*6+a.phase)*.35;a.right.rotation.z=-a.left.rotation.z;}}
   for(let i=0;i<fireflies.length;i++){fireflies[i].position.y=1.7+Math.sin(time*.5+i)*.7;}
   windTime.value=time;glow.emissiveIntensity=.4+(1-daylight)*1.2;daylightCache=daylight;updateDynamic();
  }
 };return world;
}
