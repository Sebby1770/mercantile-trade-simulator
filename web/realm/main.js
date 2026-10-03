import * as T from '../vendor/three.module.js';
import {createWorld,TOWNS,WAYSTONES,REGIONS,heightAt,surfaceAt,blocksAt,moveWithCollision,biomeAt,terrainAt} from './world.js';
import {SAVE_KEY,GOODS,OFFERS,QUESTS,WAYSTONE_IDS,REGION_IDS,freshState,parseSave,transact,harvest,questAction,upgrade,rest,nextDay,acceptContract,completeContract,acceptBounty,completeBounty,brew,checkGoal,log} from './economy.js';
import {createControls} from './controls.js';
import {createAudio} from './audio.js';
import {createUI} from './ui.js';
import {stats,chooseArchetype,buyWeapon,equipWeapon,assignSpell,upgradeSpell,drinkPotion,drinkBrew,buySupply,WEAPONS,DEALERS} from './rpg.js';
import {BOSSES,BOSS_KEYS,echoStone} from './bosses.js';
import {createCombat,isSanctuary,TRAINING,DODGE} from './combat.js';
import {loadWorldTextures,createAtmosphere,createCombatGraphics} from './graphics.js';
import {createWeather} from './weather.js';
import {updateRPGHUD} from './rpg-ui.js';
import {createPostProcessing} from './postprocessing.js';
import {createCombatFeedback} from './combat-feedback.js';
const $=s=>document.querySelector(s);
let settings={sensitivity:1,sound:true,shake:true,reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches,invert:false,quality:matchMedia('(pointer:coarse)').matches?'low':'high'};
try{const v=JSON.parse(localStorage.getItem('mercantile.elderwood.settings'));if(v){if(Number.isFinite(v.sensitivity))settings.sensitivity=Math.max(.3,Math.min(2,v.sensitivity));for(const k of ['sound','shake','reducedMotion','invert'])if(typeof v[k]==='boolean')settings[k]=v[k];if(['high','low'].includes(v.quality))settings.quality=v.quality;}}catch{}
let state=freshState(),hasSave=false,storageFailed=false,corruptSave=false;
try{const raw=localStorage.getItem(SAVE_KEY);if(raw){const loaded=parseSave(raw);if(loaded){state=loaded;hasSave=true;}else corruptSave=true;}}catch{storageFailed=true;}
const renderer=new T.WebGLRenderer({canvas:$('#world'),antialias:true,powerPreference:'high-performance'});
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,settings.quality==='high'?1.65:1));renderer.shadowMap.enabled=settings.quality==='high';renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new T.Scene();scene.background=new T.Color(0xb9cbb9);scene.fog=new T.Fog(0xb9cbb9,70,300);
const BASE_FOV=66,camera=new T.PerspectiveCamera(BASE_FOV,innerWidth/innerHeight,.07,520);camera.rotation.order='YXZ';
const hemisphere=new T.HemisphereLight(0xd9e7ce,0x5e7044,2.3);scene.add(hemisphere);
const sun=new T.DirectionalLight(0xffe2ad,3.2);sun.position.set(-35,60,30);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-46,right:46,top:46,bottom:-46,near:1,far:165});sun.shadow.normalBias=.035;sun.shadow.bias=-.00035;scene.add(sun,sun.target);
const textures=loadWorldTextures(renderer),atmosphere=createAtmosphere(scene);
const environmentScene=new T.Scene();environmentScene.add(atmosphere.sky.clone());const environmentGenerator=new T.PMREMGenerator(renderer);const environmentTarget=environmentGenerator.fromScene(environmentScene,.04,.1,600);scene.environment=environmentTarget.texture;environmentGenerator.dispose();
const postProcessing=createPostProcessing(renderer,scene,camera,settings);postProcessing.resize();
const world=createWorld(scene,{textures}),audio=createAudio(settings),weather=createWeather(scene,settings);
// Combat reads lava/bog through the world object.
if(!world.terrainAt)world.terrainAt=terrainAt;
const combatGraphics=createCombatGraphics(scene,camera,()=>state,settings),combatFeedback=createCombatFeedback(camera);
let started=false,paused=true,ui,nearest=null,currentRoom=null,lastSave=0,elapsed=0,lastUI=0,lastHUD=0,lastMarker=0,walkTime=0,daylight=1,last=performance.now(),shake=0,hitStop=0,qSlot=0;
const moveDir={x:0,z:0},TRAVEL_COST=12,REGION_BIOME={frost:'frost',mire:'mire',cinder:'ash'};
const controls=createControls(renderer.domElement,settings,()=>{if(started&&!paused)ui.open('settings');});
controls.yaw=state.position.yaw;controls.pitch=state.position.pitch;
const sinks=[e=>combatGraphics.emit(e),e=>combatFeedback.emit(e),e=>audio.combat(e),react];
function emit(e){for(const f of sinks)try{f(e);}catch(error){console.error(error);}}
const combat=createCombat({state:()=>state,world,stamina:controls,emit,notify:message=>ui?.toast(message),changed:()=>{checkGoal(state);save();},onDefeat:()=>{controls.clear();controls.yaw=0;controls.pitch=0;shake=hitStop=0;camera.position.set(0,stats(state.hero).eye,28);}});
const near=(e,range=28)=>Number.isFinite(e.x)&&Number.isFinite(e.z)?Math.max(0,1-Math.hypot(e.x-state.position.x,e.z-state.position.z)/range):0;
function kick(k){if(!settings.reducedMotion&&settings.shake!==false&&k>0)shake=Math.min(1,shake+k);}
// Main's own reactions to combat: camera feel, hit-stop, and the moments worth saving and telling.
function react(e){const t=e.type;
 if(t==='impact-melee'){kick(.08+.2*(e.strength||.45));if((e.strength||0)>=1)hitStop=.06;}
 else if(t==='hurt'){if(e.amount>=6)kick(Math.min(.45,.06+e.amount/70));}
 else if(t==='parry')kick(.2);
 else if(t==='impact')kick(.42*near(e));
 else if(t==='hazard'&&e.phase==='resolve')kick(.34*near(e));
 else if(t==='boss-phase')kick(.6);
 else if(t==='boss-awaken'){kick(.55);const b=BOSSES[e.boss];if(b)ui?.toast(`${b.name}, ${b.title}, awakens! Dodge with V when the ground turns red.`);}
 else if(t==='boss-defeat'){kick(.4);const b=BOSSES[e.boss];if(b)log(state,`${b.name}, ${b.title}, has fallen. ${b.sigil} claimed.`);checkGoal(state);save();}
 else if(t==='rift-open'){kick(.3);ui?.toast('A rift tears open at the Old Stones. The Hollow King stirs.');log(state,'A rift opened at the Old Stones. The Hollow King awaits.');save();}
}
function save(notify=false){state.position.yaw=controls.yaw;state.position.pitch=controls.pitch;try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));hasSave=true;if(notify)ui.toast('Journey saved on this browser.');return true;}catch{if(notify||!storageFailed)ui.toast('This browser cannot save your journey. Keep this tab open to continue.');storageFailed=true;return false;}}
function release(){combat.setHeld(false);combat.stopChannel();combat.setBlocking(false);}
function pause(){paused=true;audio.stopCombat();release();shake=hitStop=0;controls.disable();if(document.pointerLockElement)document.exitPointerLock();nearest=null;$('#interact').hidden=true;}
function resume(){paused=false;controls.enable();controls.lock();audio.start();}
function syncPlants(){for(const node of world.gatherables)node.group.visible=state.harvested[node.id]!==state.day;}
function placeCamera(){const p=state.position;controls.yaw=p.yaw;controls.pitch=p.pitch;camera.position.set(p.x,surfaceAt(p.x,p.z)+stats(state.hero).eye,p.z);camera.rotation.set(p.pitch,p.yaw,0,'YXZ');currentRoom=world.roomAt(p.x,p.z);nearest=null;$('#interact').hidden=true;}
// Nearest walkable point, trying the preferred bearing first and fanning out ring by ring.
function freeSpot(x,z,radius=0,base=0,pad=.45){for(let r=radius;r<radius+36;r+=r<1?.75:1)for(let i=0;i<(r?24:1);i++){const a=base+(i%2?-1:1)*Math.ceil(i/2)*Math.PI/12,px=x+Math.sin(a)*r,pz=z+Math.cos(a)*r;if(Math.abs(px)<296&&Math.abs(pz)<296&&!blocksAt(px,pz,world.colliders,pad)){const ground=terrainAt(px,pz);if(ground!=='lava'&&ground!=='bog')return{x:px,z:pz};}}return null;}
function waystoneHere(){const p=state.position;let best=null,bestD=4;for(const w of WAYSTONES){const d=Math.hypot(p.x-w.x,p.z-w.z);if(d<=bestD){bestD=d;best=w.id;}}return best;}
function attune(w){if(state.waystones.includes(w.id)||!WAYSTONE_IDS.includes(w.id))return;state.waystones.push(w.id);log(state,'Attuned the waystone at '+w.name+'.');ui.toast(`Waystone attuned · ${w.name}. Travel between attuned stones for ${TRAVEL_COST} coin.`);combatGraphics.emit({type:'ring',x:w.x,y:surfaceAt(w.x,w.z)+.13,z:w.z,radius:2.6,color:0x9fd8ff,duration:1});audio.chime();save();}
function travel(id){const w=WAYSTONES.find(w=>w.id===id);
 if(!started)return{ok:false,message:'Enter the valley first.'};
 if(!w||!state.waystones.includes(id))return{ok:false,message:'Attune that waystone before travelling to it.'};
 if(waystoneHere()===id)return{ok:false,message:'You are already standing at '+w.name+'.'};
 if(combat.boss)return{ok:false,message:'The waystones fall silent while a legend hunts you.'};
 if(state.coins<TRAVEL_COST)return{ok:false,message:'Waystone travel costs '+TRAVEL_COST+' coin.'};
 const stone=world.waystones?.find(s=>s.id===id),spot=freeSpot(w.x,w.z,2.5,stone?.group?.rotation?.y||0);if(!spot)return{ok:false,message:'The far stone is blocked. Try another.'};
 combat.clear();state.coins-=TRAVEL_COST;Object.assign(state.position,{x:spot.x,z:spot.z,yaw:Math.atan2(w.x-spot.x,w.z-spot.z),pitch:0});placeCamera();
 state.time+=60;let dawn=false;if(state.time>=1440){nextDay(state);syncPlants();dawn=true;}
 log(state,'Travelled by waystone to '+w.name+'.');checkGoal(state);save();audio.chime();combatGraphics.emit({type:'ring',x:spot.x,y:surfaceAt(spot.x,spot.z)+.13,z:spot.z,radius:2.2,color:0x9fd8ff,duration:1});
 return{ok:true,message:'Travelled to '+w.name+' · '+TRAVEL_COST+' coin · an hour passes'+(dawn?'. A new day dawns.':'')};}
function action(type,{merchant,good,quantity,id}){
 const sameRoom=(world.roomAt(state.position.x,state.position.z)===merchant.room);if(!started||Math.hypot(state.position.x-merchant.x,state.position.z-merchant.z)>3.7||!sameRoom)return{ok:false,message:'Move closer to the merchant.'};
 let result;if(type==='buy'&&!OFFERS[merchant.role].includes(good))return{ok:false,message:'This merchant does not stock that good.'};
 if(type==='buy'||type==='sell')result=transact(state,merchant.town,good,quantity,type);
 if(type==='quest')result=questAction(state,merchant.id);
 if(type==='upgrade'&&merchant.id==='rowan')result=upgrade(state);
 if(type==='rest'&&merchant.role==='innkeeper'){result=rest(state);if(result.ok){controls.stamina=100;state.hero.health=stats(state.hero).health;state.hero.mana=stats(state.hero).mana;syncPlants();}}
 if(type==='accept')result=acceptContract(state,merchant.town);
 if(type==='complete')result=completeContract(state,id,merchant.town);
 if(type==='brew'&&merchant.role==='herbalist')result=brew(state,id);
 if(type==='bounty-accept'&&merchant.role==='innkeeper')result=acceptBounty(state,merchant.town);
 if(type==='bounty-claim'&&merchant.role==='innkeeper'){result=completeBounty(state,id,merchant.town);if(result.levels)combatGraphics.emit({type:'level',x:state.position.x,y:surfaceAt(state.position.x,state.position.z),z:state.position.z,color:0xffd68b,level:state.hero.level});}
 if(result?.ok){audio.chime();save();}return result;
}
function title(){pause();started=false;$('#menu').hidden=false;$('#hud').hidden=true;save();$('#play').firstChild.textContent='Continue your journey ';$('#new-game').hidden=false;}
function begin(){if(!state.hero.archetype){ui.open('characters');return;}started=true;$('#menu').hidden=true;$('#hud').hidden=false;$('#marker').hidden=true;
 if(blocksAt(state.position.x,state.position.z,world.colliders)){const room=world.houses.find(h=>h.id===world.roomAt(state.position.x,state.position.z));state.position.x=room?.entry.x??0;state.position.z=room?.entry.z??28;}
 placeCamera();syncPlants();resume();ui.update();updateRPGHUD(state,combat);
 if(corruptSave){ui.toast('The old save could not be read. A new journey has begun.');corruptSave=false;}else if(storageFailed)ui.toast('Saving is unavailable in this browser. Your journey lasts while this tab stays open.');else ui.toast(hasSave?'Welcome back to the valley.':'Welcome to Eldermere. The blue practice focus is to your left; Rowan trades at the west stall.');save();
}
function rpgAction(type,{id,slot,merchant}={}){
 let result;
 if(type==='rpg-choose'){if(started&&!isSanctuary(state.position))return{ok:false,message:'Return to a settlement to change character.'};result=chooseArchetype(state,id);if(result.ok)result.enter=true;}
 if(type==='rpg-equip')result=equipWeapon(state,id);
 if(type==='rpg-bind')result=assignSpell(state,slot,id);
 if(type==='rpg-upgrade')result=upgradeSpell(state,id);
 if(type==='rpg-potion')result=drinkPotion(state);
 if(type==='rpg-brew')result=drinkBrew(state,id);
 if(type==='rpg-buy'||type==='rpg-supply'){
  if(!merchant||!DEALERS.includes(merchant.id)||Math.hypot(state.position.x-merchant.x,state.position.z-merchant.z)>3.7||world.roomAt(state.position.x,state.position.z)!==merchant.room)return{ok:false,message:'Visit Rowan, Gareth or Halvard to purchase equipment.'};
  result=type==='rpg-buy'?buyWeapon(state,id):buySupply(state,id);
 }
 if(result?.ok){save();audio.chime();combatGraphics.refreshWeapon();}return result;
}
ui=createUI({state:()=>state,settings,started:()=>started,pause,resume,save,room:()=>world.houses.find(h=>h.id===currentRoom),action,title,begin,rpgAction,canChangeCharacter:()=>!started||isSanctuary(state.position),
 travel,waystoneHere,bossActive:()=>!!combat.boss,
 reset(){state=freshState();combat.reset();controls.yaw=0;controls.pitch=0;for(const h of world.houses)if(h.open)world.toggleDoor(h);save();begin();},
 settingsChanged(){renderer.setPixelRatio(Math.min(devicePixelRatio,settings.quality==='high'?1.65:1));renderer.shadowMap.enabled=settings.quality==='high';postProcessing.resize();audio.set();try{localStorage.setItem('mercantile.elderwood.settings',JSON.stringify(settings));}catch{}}
});
$('#play').disabled=false;$('#play').firstChild.textContent=hasSave?'Continue your journey ':'Enter the valley ';$('#new-game').hidden=!hasSave;$('#play').onclick=begin;$('#new-game').onclick=()=>ui.open('reset');$('#menu-settings').onclick=()=>ui.open('settings');
function findInteraction(){const p=state.position,fx=-Math.sin(controls.yaw),fz=-Math.cos(controls.yaw);currentRoom=world.roomAt(p.x,p.z);let best=null,bestScore=Infinity;
 function consider(type,o,x,z,maxDistance,label){const dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz),dot=(dx*fx+dz*fz)/Math.max(.001,d);if(d>maxDistance||(dot<.35&&d>.8))return;const score=d+(1-dot)*1.5;if(score<bestScore){bestScore=score;best={type,o,label};}}
 if(!currentRoom)consider('practice',TRAINING.focus,TRAINING.focus.x,TRAINING.focus.z,3.1,'Restore mana & ready spells · practice focus');
 for(const n of world.npcs)if(n.room===currentRoom)consider('npc',n,n.x,n.z,3.35,`Speak to ${n.name} · ${n.role}`);
 for(const h of world.houses)consider('door',h,h.x,h.z,2.8,`${h.open?'Close door':'Enter'} · ${h.name}`);
 if(!currentRoom){for(const n of world.gatherables)if(state.harvested[n.id]!==state.day)consider('gather',n,n.x,n.z,2.65,'Gather '+n.kind);for(const a of world.animals)consider('animal',a,a.group.position.x,a.group.position.z,3.3,'Observe '+a.kind);
  for(const w of WAYSTONES)consider('waystone',w,w.x,w.z,3.3,(state.waystones.includes(w.id)?'Travel · ':'Attune · ')+w.name);
  for(const k of BOSS_KEYS){const e=combat.bosses?.find(b=>b.boss===k);if(state.hero.bosses.includes(k)&&e?.dead&&state.hero.echoes?.[k]!==state.day){const p=echoStone(k);consider('echo',k,p.x,p.z,3.2,'Summon the echo of '+BOSSES[k].name+' · once a day');}}}
 return best;
}
function interact(){if(!started||paused)return;nearest=findInteraction();if(!nearest)return;let result;const {type,o}=nearest;
 if(type==='npc'){ui.open('trade',o);return;}
 if(type==='waystone'){attune(o);ui.open('travel');return;}
 if(type==='practice')result=combat.practice();
 if(type==='echo')result=combat.summonEcho(o);
 if(type==='door'){if(world.toggleDoor(o,state.position)){result={ok:true,message:o.open?o.name+' · door opened':'Door closed'};if(o.open)log(state,'Opened the door to '+o.name+'.');}else result={ok:false,message:'Step clear of the doorway before closing the door.'};}
 if(type==='gather'){result=harvest(state,o);if(result.ok)syncPlants();}
 if(type==='animal'){const notes={deer:'Roe deer · shy woodland wanderers. Move gently or they’ll flee.',sheep:'Valley sheep · Mossbrook’s wool begins in these pastures.',rabbit:'Brown rabbit · a quick-footed resident of the forest floor.',chicken:'Village hen · always the first to hear a market rumour.'};if(!state.discovered.includes(o.kind)){state.discovered.push(o.kind);log(state,'Observed a '+o.kind+'.');}result={ok:true,message:notes[o.kind]};}
 if(result){ui.toast(result.message);if(result.ok){audio.chime();save();}ui.update();}
}
// Dodge along the current movement input; standing still steps backwards.
function dodge(){if(!started||paused)return;const n=Math.hypot(moveDir.x,moveDir.z);combat.dodge(n>1e-5?{x:moveDir.x/n,z:moveDir.z/n}:{x:Math.sin(controls.yaw),z:Math.cos(controls.yaw)});}
const endChannel=slot=>{if(slot>=0&&combat.channel?.slot===slot)combat.stopChannel();};
$('#interact').onclick=interact;$('#touch-use').onclick=interact;
addEventListener('keydown',e=>{if(!started||e.repeat)return;if(e.code==='Escape'&&!ui.active&&!document.pointerLockElement){e.preventDefault();ui.open('settings');return;}if(paused||ui.active)return;if(e.code==='KeyE'){e.preventDefault();interact();}if(e.code==='Space'){e.preventDefault();combat.pressAttack();}
 if(e.code==='KeyV'||e.code==='ControlLeft'){e.preventDefault();dodge();}
 if(/^Digit[1-4]$/.test(e.code)){e.preventDefault();combat.cast(Number(e.code.slice(-1))-1);}
 if(e.code==='KeyZ'){e.preventDefault();state.hero.selected=(state.hero.selected+1)%4;updateRPGHUD(state,combat);}
 if(e.code==='KeyQ'){e.preventDefault();qSlot=state.hero.selected;combat.cast(qSlot);}
 if(e.code==='KeyF'){e.preventDefault();usePotion();}
 if(e.code==='KeyG'){e.preventDefault();useMana();}
 if(e.code==='KeyR'){e.preventDefault();combat.setBlocking(true);}
 const keyPanel={KeyI:'inventory',KeyJ:'journal',KeyM:'map',KeyB:'spellbook',KeyC:'hero',Tab:'armory'}[e.code];if(keyPanel){e.preventDefault();ui.open(keyPanel);}});
addEventListener('keyup',e=>{if(e.code==='KeyR')combat.setBlocking(false);if(e.code==='Space'){if(started&&!paused)combat.releaseAttack();else combat.setHeld(false);}endChannel(/^Digit[1-4]$/.test(e.code)?Number(e.code.slice(-1))-1:e.code==='KeyQ'?qSlot:-1);});
addEventListener('blur',()=>{combat.setHeld(false);combat.stopChannel();});
function usePotion(){if(!started||paused)return;const r=drinkPotion(state);ui.toast(r.message);if(r.ok){combatGraphics.emit({type:'ring',x:state.position.x,y:surfaceAt(state.position.x,state.position.z)+.13,z:state.position.z,color:0x94e2aa,radius:2});save();}}
function useMana(){if(!started||paused)return;const r=drinkBrew(state,'mana');ui.toast(r.message);if(r.ok){combatGraphics.emit({type:'ring',x:state.position.x,y:surfaceAt(state.position.x,state.position.z)+.13,z:state.position.z,color:0x8fb4ff,radius:2});save();updateRPGHUD(state,combat);}}
$('#potion-button').onclick=usePotion;$('#mana-button')?.addEventListener('click',useMana);
$('#cycle-spell').onclick=()=>{if(started&&!paused){state.hero.selected=(state.hero.selected+1)%4;updateRPGHUD(state,combat);}};
// Hotbar casts on press so channelled spells last exactly as long as the button is held; keyboard activation still casts.
document.querySelectorAll('[data-cast]').forEach(b=>{const slot=Number(b.dataset.cast),stop=()=>endChannel(slot);
 b.addEventListener('pointerdown',e=>{if(!started||paused||e.button>0)return;e.preventDefault();try{b.setPointerCapture(e.pointerId);}catch{}combat.cast(slot);});
 b.addEventListener('pointerup',stop);b.addEventListener('pointercancel',stop);b.addEventListener('lostpointercapture',stop);
 b.addEventListener('click',e=>{if(e.detail===0&&started&&!paused)combat.cast(slot);});});
renderer.domElement.addEventListener('pointerdown',e=>{if(!started||paused)return;if(e.button===0&&document.pointerLockElement===renderer.domElement)combat.pressAttack();if(e.button===2)combat.setBlocking(true);});
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('pointerup',e=>{if(e.pointerType==='touch')return;if(e.button===0){if(started&&!paused)combat.releaseAttack();else combat.setHeld(false);}if(e.button===2)combat.setBlocking(false);});
renderer.domElement.addEventListener('wheel',e=>{if(!started||paused)return;e.preventDefault();const h=state.hero,i=h.weapons.indexOf(h.equipped);equipWeapon(state,h.weapons[(i+(e.deltaY>0?1:-1)+h.weapons.length)%h.weapons.length]);combatGraphics.refreshWeapon();save();},{passive:false});
for(const [id,mode]of[['touch-attack','attack'],['touch-guard','guard']]){const b=$('#'+id);if(!b)continue;b.addEventListener('pointerdown',e=>{if(!started||paused)return;e.preventDefault();b.setPointerCapture(e.pointerId);if(mode==='attack')combat.pressAttack();else combat.setBlocking(true);});
 if(mode==='attack'){b.addEventListener('pointerup',()=>{if(started&&!paused)combat.releaseAttack();else combat.setHeld(false);});for(const t of ['pointercancel','lostpointercapture'])b.addEventListener(t,()=>combat.setHeld(false));}
 else for(const t of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(t,()=>combat.setBlocking(false));}
$('#touch-dodge')?.addEventListener('pointerdown',e=>{e.preventDefault();dodge();});
const markerVector=new T.Vector3();
function updateMarker(){let target=null,label='';const q=QUESTS[state.quest];if(state.quest===1&&state.inventory.herbs<3){target=world.gatherables.filter(n=>n.kind==='herbs'&&state.harvested[n.id]!==state.day).sort((a,b)=>Math.hypot(a.x-state.position.x,a.z-state.position.z)-Math.hypot(b.x-state.position.x,b.z-state.position.z))[0];label='Wild herbs';}else if(state.quest===2&&state.inventory.grain<6){target=world.npcs.find(n=>n.id==='rowan');label='Buy grain';}else if(state.quest===3&&state.inventory.iron<4){target=world.npcs.find(n=>n.id==='gareth');label='Buy iron';}else if(q.npc){target=world.npcs.find(n=>n.id===q.npc);label=target?.name;}
 const marker=$('#marker');if(!target||!started||ui.active){marker.hidden=true;return;}const d=Math.hypot(target.x-state.position.x,target.z-state.position.z);markerVector.set(target.x,heightAt(target.x,target.z)+(target.kind?1.2:3.3),target.z).project(camera);if(markerVector.z>1||markerVector.z<0||Math.abs(markerVector.x)>.9||Math.abs(markerVector.y)>.85||d<3.3){marker.hidden=true;return;}marker.hidden=false;marker.style.left=(markerVector.x*.5+.5)*innerWidth+'px';marker.style.top=(-markerVector.y*.5+.5)*innerHeight+'px';marker.querySelector('small').textContent=label+' · '+Math.round(d)+' m';}
// Settlements, regions and waystones reveal themselves as the traveller arrives.
function discover(here){const p=state.position;
 for(const t of TOWNS)if(Math.hypot(p.x-t.x,p.z-t.z)<25&&!state.visits.includes(t.id)){state.visits.push(t.id);log(state,'Discovered '+t.name+'.');checkGoal(state);ui.toast('Discovered '+t.name+' · '+t.tag.toLowerCase());audio.chime();save();}
 for(const r of REGIONS){const k=REGION_BIOME[r.id];if(k&&REGION_IDS.includes(r.id)&&!state.regions.includes(r.id)&&here[k]>.6){state.regions.push(r.id);log(state,'Discovered '+r.name+'.');ui.toast('Discovered '+r.name+' · '+r.tag.toLowerCase());audio.chime();save();}}
 for(const w of WAYSTONES)if(!state.waystones.includes(w.id)&&Math.hypot(p.x-w.x,p.z-w.z)<5)attune(w);
}
const BIOMES=['frost','mire','ash'],FOG={frost:[new T.Color(0xbccbd8),60,240],mire:[new T.Color(0x6f7d62),28,150],ash:[new T.Color(0x8a6a55),40,190]};
const DAY_SKY=new T.Color(0xb9cbb9),NIGHT_SKY=new T.Color(0x172e3b),skyDay=new T.Color(),skyNight=new T.Color(),tint=new T.Color(),mood={frost:0,mire:0,ash:0},QUIET={frost:0,mire:0,ash:0};
const staminaBar=$('#stamina');let staminaLow=null;
let performanceReport={frames:0,drawCalls:0,triangles:0};
function frame(now){requestAnimationFrame(frame);let dt=Math.max(0,Math.min(.05,(now-last)/1000));last=now;if(document.hidden)return;elapsed+=dt;let frameMoving=false;const running=started&&!paused;
 const bp=started?state.position:camera.position,here=biomeAt(bp.x,bp.z)||QUIET;for(const k of BIOMES){const v=Number.isFinite(here[k])?Math.max(0,Math.min(1,here[k])):0;mood[k]=T.MathUtils.damp(mood[k],v,1.1,dt);}
 if(running){const h=state.hero,m=controls.read(dt);moveDir.x=m.moving?m.dx:0;moveDir.z=m.moving?m.dz:0;
  // The dodge itself carries the player; otherwise ailments, guarding, charging and bog all slow the stride.
  const e=h.effects,bog=terrainAt(state.position.x,state.position.z)==='bog',mult=combat.dodging||e.root>0?0:stats(h).speed*(e.haste>0?1.55:1)*(combat.blocking?.55:1)*(combat.charging?.6:1)*(e.chill>0?.7:1)*(bog?.6:1);
  frameMoving=m.moving&&mult>0;if(mult>0)moveWithCollision(state.position,m.dx*mult,m.dz*mult,world.colliders);state.position.yaw=controls.yaw;state.position.pitch=controls.pitch;
  if(frameMoving)walkTime+=dt*(m.sprint?12:8);
  state.time+=dt*.8;if(state.time>=1440){nextDay(state);syncPlants();ui.toast('A new day in the valley. The markets have restocked.');save();}
  discover(here);
  if(elapsed-lastMarker>.1){lastMarker=elapsed;nearest=findInteraction();$('#interact').hidden=!nearest;if(nearest)$('#interact-text').textContent=nearest.label;}
  const combatDt=hitStop>0?dt*.15:dt;hitStop=Math.max(0,hitStop-dt);combat.update(combatDt);
  // Camera follows after combat so dodges, lunges and knockback land on the same frame.
  const bob=settings.reducedMotion?0:frameMoving?Math.sin(walkTime)*.025:0;
  camera.position.set(state.position.x,T.MathUtils.damp(camera.position.y,surfaceAt(state.position.x,state.position.z)+stats(h).eye+bob,14,dt),state.position.z);camera.rotation.set(controls.pitch,controls.yaw,0,'YXZ');
  shake=Math.max(0,shake-dt*1.9);if(settings.reducedMotion)shake=0;if(shake>0){const s=shake*shake,t=elapsed*37;camera.rotation.x+=Math.sin(t*1.31)*.02*s;camera.rotation.y+=Math.sin(t*1.07+1.7)*.02*s;camera.rotation.z=Math.sin(t*.93+.6)*.026*s;}
  const fovTarget=settings.reducedMotion?BASE_FOV:BASE_FOV+(combat.dodging?6:0)+(e.haste>0?4:0)-(combat.charging?3:0),fov=settings.reducedMotion?BASE_FOV:T.MathUtils.damp(camera.fov,fovTarget,combat.dodging?16:6,dt);if(Math.abs(fov-camera.fov)>.005){camera.fov=fov;camera.updateProjectionMatrix();}
  if(e.swiftfoot>0)controls.stamina=Math.min(100,controls.stamina+9.6*dt);
  const low=controls.stamina<(DODGE?.stamina??22);staminaBar.style.width=controls.stamina+'%';if(low!==staminaLow){staminaLow=low;staminaBar.classList.toggle('exhausted',low);staminaBar.style.background=low?'linear-gradient(90deg,#8f2f24,#d0563f)':'';}
  audio.update(elapsed,frameMoving,m.sprint,daylight);
 }else if(!started){const drift=settings.reducedMotion?0:Math.sin(elapsed*.055)*4;camera.position.set(34+drift,12.5,38);camera.lookAt(-3,3,-11);if(camera.fov!==BASE_FOV){camera.fov=BASE_FOV;camera.updateProjectionMatrix();}}
 const hour=started?state.time/60:9;daylight=Math.max(.1,Math.min(1,Math.sin((hour-5.5)/14*Math.PI)*1.35));
 // Each region tints the sky and pulls the fog in: pale frost haze, low marsh murk, ash-brown smoke.
 skyDay.copy(DAY_SKY);skyNight.copy(NIGHT_SKY);let fogNear=70,fogFar=300;for(const k of BIOMES){const w=mood[k];if(w<=.001)continue;const [c,n,f]=FOG[k];skyDay.lerp(c,w);skyNight.lerp(tint.copy(c).multiplyScalar(.2),w*.5);fogNear+=(n-70)*w;fogFar+=(f-300)*w;}
 scene.background.copy(skyNight).lerp(skyDay,daylight);scene.fog.color.copy(scene.background);scene.fog.near=Math.max(12,fogNear);scene.fog.far=Math.max(scene.fog.near+40,fogFar);
 hemisphere.intensity=.7+daylight*1.6;sun.intensity=.22+daylight*2.9;sun.color.setHex(hour>16&&hour<20?0xffbc7a:0xffe4b6);sun.position.set(camera.position.x-35,65,camera.position.z+30);sun.target.position.set(camera.position.x,0,camera.position.z);
 if(!paused||!started)world.update(dt,elapsed,state.position,daylight);
 const fxDt=running&&hitStop>0?dt*.15:dt;
 atmosphere.update(elapsed,daylight,camera.position);weather.update(started&&paused?0:dt,camera.position,mood,daylight,true);combatGraphics.update(fxDt,combat.clock,combat,started,paused,frameMoving);combatFeedback.update(running?dt:0,running);
 audio.bossMusic?.(running&&!!combat.boss,combat.boss?.boss);audio.ambience?.(running?mood:QUIET);
 if(started&&(elapsed-lastUI>.15)){lastUI=elapsed;ui.update();}
 if(started&&(elapsed-lastHUD>.15||(running&&(combat.charging||combat.channel||combat.boss)&&elapsed-lastHUD>.04))){lastHUD=elapsed;updateRPGHUD(state,combat);}
 if(running)updateMarker();else $('#marker').hidden=true;
 if(running&&elapsed-lastSave>20){lastSave=elapsed;save();}
 scene.environmentIntensity=.12+daylight*.38;postProcessing.render(dt);performanceReport={frames:performanceReport.frames+1,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
}
requestAnimationFrame(frame);
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();postProcessing.resize();});addEventListener('pagehide',()=>{if(started)save();});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();$('#fatal').hidden=false;$('#fatal-message').textContent='The graphics connection was interrupted. Your latest saved journey is safe. Reload to continue.';});
// Verification aid, only with ?debug in the address: nothing is exposed otherwise.
if(location.search.includes('debug'))window.realmDebug={state:()=>state,combat,world,
 teleport(x,z){const spot=freeSpot(Math.max(-295,Math.min(295,Number(x)||0)),Math.max(-295,Math.min(295,Number(z)||0)));if(!spot)return null;combat.clear();Object.assign(state.position,spot,{yaw:controls.yaw,pitch:controls.pitch});placeCamera();save();return{...state.position};},
 setLevel(n){const h=state.hero,level=Math.max(1,Math.min(20,Math.round(Number(n))||1));h.points=Math.min(500,h.points+Math.max(0,level-h.level));h.level=level;h.xp=0;const a=stats(h);h.health=a.health;h.mana=a.mana;save();ui.update();updateRPGHUD(state,combat);return level;},
 give(key,value){const h=state.hero,whole=v=>Math.max(0,Math.round(Number(v))||0);
  if(Object.hasOwn(WEAPONS,key)){if(!h.weapons.includes(key))h.weapons.push(key);h.equipped=key;combatGraphics.refreshWeapon();}
  else if(Object.hasOwn(GOODS,key))state.inventory[key]=Math.min(60,whole(value));
  else if(key==='coins')state.coins=whole(value);
  else if(key==='bosses'){for(const k of [].concat(value))if(BOSS_KEYS.includes(k)&&!h.bosses.includes(k))h.bosses.push(k);combat.reset();}
  else if(key==='waystones'||key==='regions'){const allowed=key==='waystones'?WAYSTONE_IDS:REGION_IDS;for(const v of [].concat(value))if(allowed.includes(v)&&!state[key].includes(v))state[key].push(v);}
  else if(['potions','arrows','bolts','points'].includes(key))h[key]=Math.min(key==='points'?500:9999,whole(value));
  else return undefined;
  save();ui.update();updateRPGHUD(state,combat);return value;}};
// Feature-detected, small agent surface shares the actual game state and visible menus.
if(document.modelContext?.registerTool){const lifecycle=new AbortController();const tools=[
 {name:'read_merchant_journey',title:'Read journey',description:'Read the current local journey, inventory, objective and location.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(){return{coins:state.coins,inventory:{...state.inventory},day:state.day,objective:QUESTS[state.quest].text,location:{...state.position},settlements:[...state.visits],heroLevel:state.hero.level,legendsSlain:state.hero.bosses.map(k=>BOSSES[k]?.name||k)};}},
 {name:'open_merchant_journal',title:'Open journal',description:'Open the in-game journal or map and pause the journey.',inputSchema:{type:'object',properties:{view:{type:'string',enum:['journal','map','inventory']}},required:['view'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!started)throw new Error('Enter the valley first.');if(!input||!['journal','map','inventory'].includes(input.view)||Object.keys(input).length!==1)throw new Error('Choose journal, map, or inventory.');ui.open(input.view);return{opened:input.view};}}
 ];for(const tool of tools)try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
