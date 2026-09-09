import * as T from '../vendor/three.module.js';
import {createWorld,TOWNS,heightAt,surfaceAt,blocksAt,moveWithCollision} from './world.js';
import {SAVE_KEY,GOODS,OFFERS,QUESTS,freshState,parseSave,transact,harvest,questAction,upgrade,rest,nextDay,acceptContract,completeContract,checkGoal,log} from './economy.js';
import {createControls} from './controls.js';
import {createAudio} from './audio.js';
import {createUI} from './ui.js';
import {stats,chooseArchetype,buyWeapon,equipWeapon,assignSpell,drinkPotion,buySupply,WEAPONS} from './rpg.js';
import {createCombat,isSanctuary} from './combat.js';
import {loadWorldTextures,createAtmosphere,createCombatGraphics} from './graphics.js';
import {updateRPGHUD} from './rpg-ui.js';
import {createPostProcessing} from './postprocessing.js';
const $=s=>document.querySelector(s);
let settings={sensitivity:1,sound:true,reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches,invert:false,quality:matchMedia('(pointer:coarse)').matches?'low':'high'};
try{const v=JSON.parse(localStorage.getItem('mercantile.elderwood.settings'));if(v){if(Number.isFinite(v.sensitivity))settings.sensitivity=Math.max(.3,Math.min(2,v.sensitivity));for(const k of ['sound','reducedMotion','invert'])if(typeof v[k]==='boolean')settings[k]=v[k];if(['high','low'].includes(v.quality))settings.quality=v.quality;}}catch{}
let state=freshState(),hasSave=false,storageFailed=false,corruptSave=false;
try{const raw=localStorage.getItem(SAVE_KEY);if(raw){const loaded=parseSave(raw);if(loaded){state=loaded;hasSave=true;}else corruptSave=true;}}catch{storageFailed=true;}
const renderer=new T.WebGLRenderer({canvas:$('#world'),antialias:true,powerPreference:'high-performance'});
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,settings.quality==='high'?1.65:1));renderer.shadowMap.enabled=settings.quality==='high';renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new T.Scene();scene.background=new T.Color(0xb9cbb9);scene.fog=new T.Fog(0xb9cbb9,60,235);
const camera=new T.PerspectiveCamera(66,innerWidth/innerHeight,.07,520);camera.rotation.order='YXZ';
const hemisphere=new T.HemisphereLight(0xd9e7ce,0x5e7044,2.3);scene.add(hemisphere);
const sun=new T.DirectionalLight(0xffe2ad,3.2);sun.position.set(-35,60,30);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-46,right:46,top:46,bottom:-46,near:1,far:165});sun.shadow.normalBias=.035;sun.shadow.bias=-.00035;scene.add(sun,sun.target);
const textures=loadWorldTextures(renderer),atmosphere=createAtmosphere(scene);
const environmentScene=new T.Scene();environmentScene.add(atmosphere.sky.clone());const environmentGenerator=new T.PMREMGenerator(renderer);const environmentTarget=environmentGenerator.fromScene(environmentScene,.04,.1,600);scene.environment=environmentTarget.texture;environmentGenerator.dispose();
const postProcessing=createPostProcessing(renderer,scene,camera,settings);postProcessing.resize();
const world=createWorld(scene,{textures}),audio=createAudio(settings);
const combatGraphics=createCombatGraphics(scene,camera,()=>state,settings);
const combat=createCombat({state:()=>state,world,emit:e=>combatGraphics.emit(e),notify:message=>ui?.toast(message),changed:()=>{checkGoal(state);save();},onDefeat:()=>{controls.clear();controls.yaw=0;controls.pitch=0;camera.position.set(0,stats(state.hero).eye,28);}});
let started=false,paused=true,ui,nearest=null,currentRoom=null,lastSave=0,elapsed=0,lastUI=0,lastMarker=0,walkTime=0,daylight=1,last=performance.now();
const controls=createControls(renderer.domElement,settings,()=>{if(started&&!paused)ui.open('settings');});
controls.yaw=state.position.yaw;controls.pitch=state.position.pitch;
function save(notify=false){state.position.yaw=controls.yaw;state.position.pitch=controls.pitch;try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));hasSave=true;if(notify)ui.toast('Journey saved on this browser.');return true;}catch{if(notify||!storageFailed)ui.toast('This browser cannot save your journey. Keep this tab open to continue.');storageFailed=true;return false;}}
function pause(){paused=true;combat.setHeld(false);combat.setBlocking(false);controls.disable();if(document.pointerLockElement)document.exitPointerLock();nearest=null;$('#interact').hidden=true;}
function resume(){paused=false;controls.enable();controls.lock();audio.start();}
function syncPlants(){for(const node of world.gatherables)node.group.visible=state.harvested[node.id]!==state.day;}
function action(type,{merchant,good,quantity,id}){
 const sameRoom=(world.roomAt(state.position.x,state.position.z)===merchant.room);if(!started||Math.hypot(state.position.x-merchant.x,state.position.z-merchant.z)>3.7||!sameRoom)return{ok:false,message:'Move closer to the merchant.'};
 let result;if(type==='buy'&&!OFFERS[merchant.role].includes(good))return{ok:false,message:'This merchant does not stock that good.'};
 if(type==='buy'||type==='sell')result=transact(state,merchant.town,good,quantity,type);
 if(type==='quest')result=questAction(state,merchant.id);
 if(type==='upgrade'&&merchant.id==='rowan')result=upgrade(state);
 if(type==='rest'&&merchant.role==='innkeeper'){result=rest(state);if(result.ok){controls.stamina=100;state.hero.health=stats(state.hero).health;state.hero.mana=stats(state.hero).mana;syncPlants();}}
 if(type==='accept')result=acceptContract(state,merchant.town);
 if(type==='complete')result=completeContract(state,id,merchant.town);
 if(result?.ok){audio.chime();save();}return result;
}
function title(){pause();started=false;$('#menu').hidden=false;$('#hud').hidden=true;save();$('#play').firstChild.textContent='Continue your journey ';$('#new-game').hidden=false;}
function begin(){if(!state.hero.archetype){ui.open('characters');return;}started=true;$('#menu').hidden=true;$('#hud').hidden=false;$('#marker').hidden=true;
 if(blocksAt(state.position.x,state.position.z,world.colliders)){const room=world.houses.find(h=>h.id===world.roomAt(state.position.x,state.position.z));state.position.x=room?.entry.x??0;state.position.z=room?.entry.z??28;}
 controls.yaw=state.position.yaw;controls.pitch=state.position.pitch;camera.position.set(state.position.x,surfaceAt(state.position.x,state.position.z)+stats(state.hero).eye,state.position.z);syncPlants();resume();ui.update();updateRPGHUD(state,combat);
 if(corruptSave){ui.toast('The old save could not be read. A new journey has begun.');corruptSave=false;}else if(storageFailed)ui.toast('Saving is unavailable in this browser. Your journey lasts while this tab stays open.');else ui.toast(hasSave?'Welcome back to the valley.':'Welcome to Eldermere. Speak to Rowan at the west market stall.');save();
}
function rpgAction(type,{id,slot,merchant}={}){
 let result;
 if(type==='rpg-choose'){if(started&&!isSanctuary(state.position))return{ok:false,message:'Return to a settlement to change character.'};result=chooseArchetype(state,id);if(result.ok)result.enter=true;}
 if(type==='rpg-equip')result=equipWeapon(state,id);
 if(type==='rpg-bind')result=assignSpell(state,slot,id);
 if(type==='rpg-potion')result=drinkPotion(state);
 if(type==='rpg-buy'||type==='rpg-supply'){
  if(!merchant||!['rowan','gareth'].includes(merchant.id)||Math.hypot(state.position.x-merchant.x,state.position.z-merchant.z)>3.7||world.roomAt(state.position.x,state.position.z)!==merchant.room)return{ok:false,message:'Visit Rowan or Gareth to purchase equipment.'};
  result=type==='rpg-buy'?buyWeapon(state,id):buySupply(state,id);
 }
 if(result?.ok){save();audio.chime();combatGraphics.refreshWeapon();}return result;
}
ui=createUI({state:()=>state,settings,started:()=>started,pause,resume,save,room:()=>world.houses.find(h=>h.id===currentRoom),action,title,begin,rpgAction,canChangeCharacter:()=>!started||isSanctuary(state.position),
 reset(){state=freshState();combat.reset();controls.yaw=0;controls.pitch=0;for(const h of world.houses)if(h.open)world.toggleDoor(h);save();begin();},
 settingsChanged(){renderer.setPixelRatio(Math.min(devicePixelRatio,settings.quality==='high'?1.65:1));renderer.shadowMap.enabled=settings.quality==='high';postProcessing.resize();audio.set();try{localStorage.setItem('mercantile.elderwood.settings',JSON.stringify(settings));}catch{}}
});
$('#play').disabled=false;$('#play').firstChild.textContent=hasSave?'Continue your journey ':'Enter the valley ';$('#new-game').hidden=!hasSave;$('#play').onclick=begin;$('#new-game').onclick=()=>ui.open('reset');$('#menu-settings').onclick=()=>ui.open('settings');
function findInteraction(){const p=state.position,fx=-Math.sin(controls.yaw),fz=-Math.cos(controls.yaw);currentRoom=world.roomAt(p.x,p.z);let best=null,bestScore=Infinity;
 function consider(type,o,x,z,maxDistance,label){const dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz),dot=(dx*fx+dz*fz)/Math.max(.001,d);if(d>maxDistance||(dot<.35&&d>.8))return;const score=d+(1-dot)*1.5;if(score<bestScore){bestScore=score;best={type,o,label};}}
 for(const n of world.npcs)if(n.room===currentRoom)consider('npc',n,n.x,n.z,3.35,`Speak to ${n.name} · ${n.role}`);
 for(const h of world.houses)consider('door',h,h.x,h.z,2.8,`${h.open?'Close door':'Enter'} · ${h.name}`);
 if(!currentRoom){for(const n of world.gatherables)if(state.harvested[n.id]!==state.day)consider('gather',n,n.x,n.z,2.65,'Gather '+n.kind);for(const a of world.animals)consider('animal',a,a.group.position.x,a.group.position.z,3.3,'Observe '+a.kind);}
 return best;
}
function interact(){if(!started||paused)return;nearest=findInteraction();if(!nearest)return;let result;const {type,o}=nearest;
 if(type==='npc'){ui.open('trade',o);return;}
 if(type==='door'){if(world.toggleDoor(o,state.position)){result={ok:true,message:o.open?o.name+' · door opened':'Door closed'};if(o.open)log(state,'Opened the door to '+o.name+'.');}else result={ok:false,message:'Step clear of the doorway before closing the door.'};}
 if(type==='gather'){result=harvest(state,o);if(result.ok)syncPlants();}
 if(type==='animal'){const notes={deer:'Roe deer · shy woodland wanderers. Move gently or they’ll flee.',sheep:'Valley sheep · Mossbrook’s wool begins in these pastures.',rabbit:'Brown rabbit · a quick-footed resident of the forest floor.',chicken:'Village hen · always the first to hear a market rumour.'};if(!state.discovered.includes(o.kind)){state.discovered.push(o.kind);log(state,'Observed a '+o.kind+'.');}result={ok:true,message:notes[o.kind]};}
 if(result){ui.toast(result.message);if(result.ok){audio.chime();save();}ui.update();}
}
$('#interact').onclick=interact;$('#touch-use').onclick=interact;
addEventListener('keydown',e=>{if(!started||e.repeat)return;if(e.code==='Escape'&&!ui.active&&!document.pointerLockElement){e.preventDefault();ui.open('settings');return;}if(paused||ui.active)return;if(e.code==='KeyE'){e.preventDefault();interact();}if(e.code==='Space'){e.preventDefault();combat.attack();}
 if(/^Digit[1-4]$/.test(e.code)){e.preventDefault();combat.cast(Number(e.code.slice(-1))-1);}
 if(e.code==='KeyQ'){e.preventDefault();combat.cast(state.hero.selected);}
 if(e.code==='KeyF'){e.preventDefault();usePotion();}
 if(e.code==='KeyR'){e.preventDefault();combat.setBlocking(true);}
 const keyPanel={KeyI:'inventory',KeyJ:'journal',KeyM:'map',KeyB:'spellbook',KeyC:'hero',Tab:'armory'}[e.code];if(keyPanel){e.preventDefault();ui.open(keyPanel);}});
function usePotion(){if(!started||paused)return;const r=drinkPotion(state);ui.toast(r.message);if(r.ok){combatGraphics.emit({type:'ring',x:state.position.x,z:state.position.z,color:0x94e2aa,radius:2});save();}}
$('#potion-button').onclick=usePotion;
document.querySelectorAll('[data-cast]').forEach(b=>b.onclick=()=>{if(started&&!paused)combat.cast(Number(b.dataset.cast));});
renderer.domElement.addEventListener('pointerdown',e=>{if(!started||paused)return;if(e.button===0&&document.pointerLockElement===renderer.domElement){combat.attack();combat.setHeld(true);}if(e.button===2)combat.setBlocking(true);});
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('pointerup',e=>{if(e.pointerType==='touch')return;if(e.button===0)combat.setHeld(false);if(e.button===2)combat.setBlocking(false);});
addEventListener('keyup',e=>{if(e.code==='KeyR')combat.setBlocking(false);});
renderer.domElement.addEventListener('wheel',e=>{if(!started||paused)return;e.preventDefault();const h=state.hero,i=h.weapons.indexOf(h.equipped);equipWeapon(state,h.weapons[(i+(e.deltaY>0?1:-1)+h.weapons.length)%h.weapons.length]);combatGraphics.refreshWeapon();save();},{passive:false});
for(const [id,mode]of[['touch-attack','attack'],['touch-guard','guard']]){const b=$('#'+id);b.addEventListener('pointerdown',e=>{if(!started||paused)return;e.preventDefault();b.setPointerCapture(e.pointerId);if(mode==='attack'){combat.attack();combat.setHeld(true);}else combat.setBlocking(true);});const release=()=>mode==='attack'?combat.setHeld(false):combat.setBlocking(false);b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);}
const markerVector=new T.Vector3();
function updateMarker(){let target=null,label='';const q=QUESTS[state.quest];if(state.quest===1&&state.inventory.herbs<3){target=world.gatherables.filter(n=>n.kind==='herbs'&&state.harvested[n.id]!==state.day).sort((a,b)=>Math.hypot(a.x-state.position.x,a.z-state.position.z)-Math.hypot(b.x-state.position.x,b.z-state.position.z))[0];label='Wild herbs';}else if(state.quest===2&&state.inventory.grain<6){target=world.npcs.find(n=>n.id==='rowan');label='Buy grain';}else if(state.quest===3&&state.inventory.iron<4){target=world.npcs.find(n=>n.id==='gareth');label='Buy iron';}else if(q.npc){target=world.npcs.find(n=>n.id===q.npc);label=target?.name;}
 const marker=$('#marker');if(!target||!started||ui.active){marker.hidden=true;return;}const d=Math.hypot(target.x-state.position.x,target.z-state.position.z);markerVector.set(target.x,heightAt(target.x,target.z)+(target.kind?1.2:3.3),target.z).project(camera);if(markerVector.z>1||markerVector.z<0||Math.abs(markerVector.x)>.9||Math.abs(markerVector.y)>.85||d<3.3){marker.hidden=true;return;}marker.hidden=false;marker.style.left=(markerVector.x*.5+.5)*innerWidth+'px';marker.style.top=(-markerVector.y*.5+.5)*innerHeight+'px';marker.querySelector('small').textContent=label+' · '+Math.round(d)+' m';}
let performanceReport={frames:0,drawCalls:0,triangles:0};
function frame(now){requestAnimationFrame(frame);let dt=Math.max(0,Math.min(.05,(now-last)/1000));last=now;if(document.hidden)return;elapsed+=dt;let frameMoving=false;
 if(started&&!paused){const m=controls.read(dt);frameMoving=m.moving;const speed=stats(state.hero).speed*(state.hero.effects.haste>0?1.55:1)*(combat.blocking?.55:1);moveWithCollision(state.position,m.dx*speed,m.dz*speed,world.colliders);state.position.yaw=controls.yaw;state.position.pitch=controls.pitch;
  if(m.moving)walkTime+=dt*(m.sprint?12:8);const bob=settings.reducedMotion?0:m.moving?Math.sin(walkTime)*.025:0;
  camera.position.set(state.position.x,T.MathUtils.damp(camera.position.y,surfaceAt(state.position.x,state.position.z)+stats(state.hero).eye+bob,14,dt),state.position.z);camera.rotation.set(controls.pitch,controls.yaw,0,'YXZ');
  state.time+=dt*.8;if(state.time>=1440){nextDay(state);syncPlants();ui.toast('A new day in the valley. The markets have restocked.');save();}
  for(const t of TOWNS)if(Math.hypot(state.position.x-t.x,state.position.z-t.z)<25&&!state.visits.includes(t.id)){state.visits.push(t.id);log(state,'Discovered '+t.name+'.');checkGoal(state);ui.toast('Discovered '+t.name+' · '+t.tag.toLowerCase());audio.chime();save();}
  if(elapsed-lastMarker>.1){lastMarker=elapsed;nearest=findInteraction();$('#interact').hidden=!nearest;if(nearest)$('#interact-text').textContent=nearest.label;}
  combat.update(dt);$('#stamina').style.width=controls.stamina+'%';audio.update(elapsed,m.moving,m.sprint,daylight);
 }else if(!started){const drift=settings.reducedMotion?0:Math.sin(elapsed*.055)*4;camera.position.set(34+drift,12.5,38);camera.lookAt(-3,3,-11);}
 const hour=started?state.time/60:9;daylight=Math.max(.1,Math.min(1,Math.sin((hour-5.5)/14*Math.PI)*1.35));
 const daylightColor=new T.Color(0xb9cbb9),nightColor=new T.Color(0x172e3b);scene.background.copy(nightColor).lerp(daylightColor,daylight);scene.fog.color.copy(scene.background);hemisphere.intensity=.7+daylight*1.6;sun.intensity=.22+daylight*2.9;sun.color.setHex(hour>16&&hour<20?0xffbc7a:0xffe4b6);sun.position.set(camera.position.x-35,65,camera.position.z+30);sun.target.position.set(camera.position.x,0,camera.position.z);
 if(!paused||!started)world.update(dt,elapsed,state.position,daylight);
 atmosphere.update(elapsed,daylight,camera.position);combatGraphics.update(dt,combat.clock,combat,started,paused,frameMoving);
 if(started&&elapsed-lastUI>.15){lastUI=elapsed;ui.update();updateRPGHUD(state,combat);}if(started&&!paused)updateMarker();else $('#marker').hidden=true;
 if(started&&!paused&&elapsed-lastSave>20){lastSave=elapsed;save();}
 scene.environmentIntensity=.12+daylight*.38;postProcessing.render(dt);performanceReport={frames:performanceReport.frames+1,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
}
requestAnimationFrame(frame);
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();postProcessing.resize();});addEventListener('pagehide',()=>{if(started)save();});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();$('#fatal').hidden=false;$('#fatal-message').textContent='The graphics connection was interrupted. Your latest saved journey is safe. Reload to continue.';});
// Feature-detected, small agent surface shares the actual game state and visible menus.
if(document.modelContext?.registerTool){const lifecycle=new AbortController();const tools=[
 {name:'read_merchant_journey',title:'Read journey',description:'Read the current local journey, inventory, objective and location.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(){return{coins:state.coins,inventory:{...state.inventory},day:state.day,objective:QUESTS[state.quest].text,location:{...state.position},settlements:[...state.visits]};}},
 {name:'open_merchant_journal',title:'Open journal',description:'Open the in-game journal or map and pause the journey.',inputSchema:{type:'object',properties:{view:{type:'string',enum:['journal','map','inventory']}},required:['view'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!started)throw new Error('Enter the valley first.');if(!input||!['journal','map','inventory'].includes(input.view)||Object.keys(input).length!==1)throw new Error('Choose journal, map, or inventory.');ui.open(input.view);return{opened:input.view};}}
 ];for(const tool of tools)try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
