import {WEAPONS,SPELLS,ENEMY_DEFS,stats,spendAttack,spendCast,tickHero,hurtHero,rewardKill,recover} from './rpg.js';
import {TOWNS,blocksAt,moveWithCollision,surfaceAt} from './world.js';
export const ENCOUNTERS=[
 {name:'Briarwood prowlers',x:-43,z:29,kinds:['wolf','wolf','wolf']},
 {name:'The broken caravan',x:-60,z:-19,kinds:['goblin','goblin','goblin']},
 {name:'Whispering stones',x:-64,z:-132,kinds:['skeleton','wraith','skeleton']},
 {name:'The eastern watch',x:104,z:26,kinds:['goblin','skeleton','wolf']},
 {name:'The fallen guardian',x:145,z:-133,kinds:['sentinel','wraith','skeleton']}
];
export const TRAINING={x:-17,z:20,focus:{x:-13,z:24},targets:[{x:-15,z:17},{x:-21,z:17}]};
export const isSanctuary=p=>TOWNS.some(t=>Math.hypot(p.x-t.x,p.z-t.z)<32);
export function segmentEntry(a,b,colliders){const dx=b.x-a.x,dz=b.z-a.z;let earliest=Infinity;for(const c of colliders){let lo=0,hi=1,hit=true;for(const [v,d,min,max]of[[a.x,dx,c.x1,c.x2],[a.z,dz,c.z1,c.z2]]){if(Math.abs(d)<1e-9){if(v<min||v>max){hit=false;break;}}else{let t1=(min-v)/d,t2=(max-v)/d;if(t1>t2)[t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi){hit=false;break;}}}if(hit&&hi>0&&lo<1)earliest=Math.min(earliest,Math.max(0,lo));}return earliest;}
export const segmentBlocked=(a,b,colliders)=>segmentEntry(a,b,colliders)!==Infinity;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const point=(p,y=1.1)=>({x:p.x,y:surfaceAt(p.x,p.z)+y,z:p.z});
export function sphereEntry(center,a,b,radius){const x=a.x-center.x,y=a.y-center.y,z=a.z-center.z,dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;const aa=dx*dx+dy*dy+dz*dz,bb=2*(x*dx+y*dy+z*dz),cc=x*x+y*y+z*z-radius*radius;if(cc<=0)return 0;if(aa<1e-12)return Infinity;const disc=bb*bb-4*aa*cc;if(disc<0)return Infinity;const t=(-bb-Math.sqrt(disc))/(2*aa);return t>=0&&t<=1?t:Infinity;}

export function createCombat({state,world,emit=()=>{},notify=()=>{},changed=()=>{},onDefeat=()=>{}}){
 const enemies=[],projectiles=[],zones=[];let clock=0,day=state().day,held=false,blocking=false,wispTimer=0;
 function spawn(){
  enemies.length=0;let index=0;
  for(const camp of ENCOUNTERS)camp.kinds.forEach((kind,i)=>{let x=camp.x+Math.cos(i*2.4)*3,z=camp.z+Math.sin(i*2.4)*3;for(let j=0;j<40&&blocksAt(x,z,world.colliders,.35);j++){x=camp.x+Math.cos(j*1.7)*(3+j*.22);z=camp.z+Math.sin(j*1.7)*(3+j*.22);}const d=ENEMY_DEFS[kind],id='hostile-'+index++;enemies.push({id,kind,...d,maxHealth:d.health,x,z,homeX:x,homeZ:z,heading:0,dead:state().hero.defeated[id]===day,freeze:0,iceLock:0,chill:0,burn:0,burnTick:0,bind:0,slow:0,windup:0,attackTime:1,flash:0});});
  TRAINING.targets.forEach((p,i)=>enemies.push({...p,id:'training-'+i,kind:'dummy',name:'Runewood training target',training:true,health:240,maxHealth:240,homeX:p.x,homeZ:p.z,heading:0,dead:false,freeze:0,iceLock:0,chill:0,burn:0,bind:0,slow:0,windup:0,attackTime:0,flash:0,resetIn:0}));
 }
 function clear(){projectiles.length=0;zones.length=0;held=blocking=false;wispTimer=0;emit({type:'clear'});}
 function cancelStrike(e){if(e.windup>0){e.windup=0;e.attackTime=.65;emit({type:'telegraph',phase:'cancel',targetId:e.id,...point(e,.08)});}}
 function damage(e,amount,color=0xffdb99,status={}){
  if(e.dead||e.health<=0||(!e.training&&isSanctuary(e)))return false;
  const chilled=e.chill>0;let combo=null;
  if(chilled&&status.element==='fire'){amount*=1.65;e.chill=0;e.iceLock=0;combo='shatter';}
  else if(chilled&&status.element==='storm'){amount*=1.4;e.chill=0;combo='conduction';}
  // Ice quenches burning; only ice status, not a generic stun, enables combinations.
  if(status.element==='ice'){e.burn=0;e.burnTick=0;e.burnDamage=0;e.chill=Math.max(e.chill||0,status.chill||4);}
  if(status.burn){e.burn=Math.max(e.burn||0,status.burn);e.burnDamage=Math.max(e.burnDamage||0,status.burnDamage||4);if(!e.burnTick)e.burnTick=0;}
  e.health=Math.max(0,e.health-amount);e.flash=.16;if(status.element==='ice')e.iceLock=Math.max(e.iceLock||0,status.freeze||0);else e.freeze=Math.max(e.freeze||0,status.freeze||0);e.slow=Math.max(e.slow||0,status.slow||0);e.bind=Math.max(e.bind||0,status.bind||0);
  if(e.freeze>0||e.iceLock>0||e.dead||e.health<=0)cancelStrike(e);
  if(e.training)e.resetIn=5;
  const position=point(e,e.kind==='sentinel'?2.6:1.4);
  emit({type:'hit',...position,targetId:e.id,color,amount:Math.round(amount),element:status.element,sourceId:status.sourceId,periodic:!!status.periodic,training:!!e.training});
  if(combo)emit({type:'combo',combo,...position,targetId:e.id,color:combo==='shatter'?0xffc38b:0xb4ddff,amount:Math.round(amount)});
  if(e.health===0){
   e.dead=true;
   if(e.training){e.resetIn=2;emit({type:'training-down',...position,color:0xa8e7ff});return true;}
   const result=rewardKill(state(),e);
   if(result.rewarded){notify(result.levels?'Level '+state().hero.level+' · health and mana restored':e.name+' defeated · +'+e.coin+' coin · +'+e.xp+' XP');emit({type:'defeat',...position,color:0xfad58b,radius:1.3});if(result.levels)emit({type:'level',...point(state().position,0),color:0xffd68b,level:state().hero.level});changed();}
  }
  return true;
 }
 function area(center,radius,amount,color,status={}){for(const e of enemies)if(!e.dead&&(Number.isFinite(center.y)?Math.hypot(e.x-center.x,e.z-center.z,surfaceAt(e.x,e.z)+1.1-center.y):distance(e,center))<=radius&&!segmentBlocked(center,e,world.colliders)){const hit=damage(e,amount,color,status);if(hit&&status.push&&!e.training){const d=Math.max(.1,distance(e,center));moveWithCollision(e,(e.x-center.x)/d*status.push,(e.z-center.z)/d*status.push,world.colliders,.3);}}}
 function launch(origin,direction,data){projectiles.push({...origin,dx:direction.x,dy:direction.y,dz:direction.z,speed:data.speed||25,life:(data.range||40)/(data.speed||25),...data,id:Math.random()});}
 function facingTarget(range,threshold=.7){const p=state().position,fx=-Math.sin(p.yaw),fz=-Math.cos(p.yaw);return enemies.filter(e=>!e.dead&&distance(e,p)<range&&((e.x-p.x)*fx+(e.z-p.z)*fz)/Math.max(.01,distance(e,p))>threshold&&!segmentBlocked(p,e,world.colliders)).sort((a,b)=>distance(a,p)-distance(b,p))[0];}
 function groundTarget(range){const p=state().position,eye=stats(state().hero).eye;const d=p.pitch<-.08?Math.min(range,-eye/Math.tan(p.pitch)):range;const result={x:p.x,z:p.z};moveWithCollision(result,-Math.sin(p.yaw)*d,-Math.cos(p.yaw)*d,world.colliders,.15);return result;}
 function attack(){
  const s=state(),h=s.hero,result=spendAttack(h);if(!result.ok){if(result.message){held=false;notify(result.message);}return result;}
  const w=result.weapon,p=s.position,a=stats(h),damageAmount=w.damage*a.power*(w.kind==='melee'?a.melee:w.kind==='magic'?a.magic:a.ranged);
  emit({type:'swing',weapon:h.equipped,color:w.color,...point(p,a.eye)});
  if(w.kind==='melee'){
   const targets=enemies.filter(e=>!e.dead&&distance(e,p)<=w.range&&((e.x-p.x)*-Math.sin(p.yaw)+(e.z-p.z)*-Math.cos(p.yaw))/Math.max(.01,distance(e,p))>w.arc&&!segmentBlocked(p,e,world.colliders));
   for(const e of targets)damage(e,damageAmount,w.color,{freeze:w.stun||0,sourceId:h.equipped});
   if(h.equipped==='warhammer')emit({type:'ring',...point(groundTarget(2),.13),radius:2,color:w.color,duration:.35});
  }else{const cp=Math.cos(p.pitch),element=h.equipped==='emberstaff'?'fire':h.equipped==='froststaff'?'ice':'arcane';launch(point(p,a.eye-.12),{x:-Math.sin(p.yaw)*cp,y:Math.sin(p.pitch),z:-Math.cos(p.yaw)*cp},{speed:w.speed,range:w.range,damage:damageAmount,color:w.color,slow:w.slow||0,weapon:h.equipped,element,chill:element==='ice'?2:0,burn:element==='fire'?3:0,burnDamage:3*a.magic});}
  changed();return{ok:true};
 }
 function cast(slot){
  const s=state(),h=s.hero;if(!Number.isInteger(slot)||slot<0||slot>3)return{ok:false,message:'Choose a spell slot.'};const id=h.slots[slot],p=SPELLS[id],result=spendCast(h,id);if(!result.ok){notify(result.message);return result;}h.selected=slot;const pos=s.position,a=stats(h),power=a.power*a.magic;emit({type:'cast',spell:id,color:p.color,...point(pos,a.eye),yaw:pos.yaw});
  if(id==='heal'){const restored=Math.min(a.health-h.health,p.healing*power);h.health+=restored;emit({type:'heal',...point(pos,.1),radius:2,color:p.color,duration:1.8,amount:Math.round(restored)});}
  else if(id==='ward'){h.effects.ward=p.duration;h.shield=p.shield;}
  else if(id==='haste')h.effects.haste=p.duration;
  else if(id==='wisp'){h.effects.wisp=p.duration;wispTimer=0;}
  else if(id==='blink'){const from=point(pos,1);moveWithCollision(pos,-Math.sin(pos.yaw)*p.range,-Math.cos(pos.yaw)*p.range,world.colliders);emit({type:'blink',from,to:point(pos,1),color:p.color,yaw:pos.yaw});}
  else if(id==='fireball'||id==='frost'){const cp=Math.cos(pos.pitch);launch(point(pos,a.eye-.1),{x:-Math.sin(pos.yaw)*cp,y:Math.sin(pos.pitch),z:-Math.cos(pos.yaw)*cp},{speed:p.speed,range:p.range,damage:p.damage*power,radius:p.radius||0,freeze:p.freeze||0,color:p.color,spell:id,element:id==='frost'?'ice':'fire',burn:id==='fireball'?3:0,burnDamage:4*power,chill:4});}
  else if(id==='lightning'){
   let target=facingTarget(p.range,.45),from=point(pos,a.eye);const seen=new Set();
   for(let i=0;i<4&&target;i++){seen.add(target.id);emit({type:'lightning',from,to:point(target,1.1),color:p.color});damage(target,p.damage*power*(1-i*.12),p.color,{freeze:.35,element:'storm',sourceId:id});from=point(target,1);target=enemies.filter(e=>!e.dead&&!seen.has(e.id)&&distance(e,from)<7&&!segmentBlocked(from,e,world.colliders)).sort((a,b)=>distance(a,from)-distance(b,from))[0];}
   if(!seen.size)emit({type:'lightning',from,to:point(groundTarget(14),.3),color:p.color});
  }else if(id==='nova'||id==='roots'){
   area(pos,p.radius,p.damage*power,p.color,id==='roots'?{freeze:p.duration,bind:p.duration,sourceId:id}:{push:3,sourceId:id});emit({type:id,...point(pos,.15),radius:p.radius,color:p.color,duration:id==='roots'?2:.85});
  }else if(id==='meteor'){
   const target=groundTarget(p.range);zones.push({...target,id,remaining:1.05,radius:p.radius,damage:p.damage*power,color:p.color});emit({type:'meteor',...point(target,0),color:p.color,radius:p.radius,duration:1.05});
  }else if(id==='blizzard'){
   const target=groundTarget(p.range);zones.push({...target,id,remaining:p.duration,tick:0,radius:p.radius,damage:p.damage*power,color:p.color});emit({type:'blizzard',...point(target,0),color:p.color,radius:p.radius,duration:p.duration});
  }
  changed();return{ok:true,message:p.name};
 }
 function updateProjectiles(dt){
  for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i],old={x:p.x,y:p.y,z:p.z},step=Math.min(dt,Math.max(0,p.life));const end={x:p.x+p.dx*p.speed*step,y:p.y+p.dy*p.speed*step,z:p.z+p.dz*p.speed*step};p.life-=dt;let hit=null,hitT=Infinity;
   for(const e of enemies){if(e.dead)continue;const t=sphereEntry(point(e,e.kind==='wolf'?.85:e.kind==='sentinel'?1.6:1.1),old,end,e.kind==='sentinel'?1:.7);if(t<hitT){hitT=t;hit=e;}}
   const wallT=segmentEntry(old,end,world.colliders),floor=surfaceAt(end.x,end.z)+.07,groundT=end.y<floor?Math.max(0,Math.min(1,(old.y-floor)/(old.y-end.y||1))):Infinity,impactT=Math.min(hitT,wallT,groundT);
   const fraction=impactT===Infinity?1:Math.max(0,impactT-.0005);p.x=old.x+(end.x-old.x)*fraction;p.y=old.y+(end.y-old.y)*fraction;p.z=old.z+(end.z-old.z)*fraction;
   if(impactT!==Infinity||p.life<=0){const status={freeze:p.freeze,slow:p.slow,element:p.element,burn:p.burn,burnDamage:p.burnDamage,chill:p.chill,sourceId:p.spell||p.weapon};if(p.radius)area(p,p.radius,p.damage,p.color,status);else if(hit&&hitT<=wallT&&hitT<=groundT)damage(hit,p.damage,p.color,status);emit({type:'burst',x:p.x,y:Math.max(.1,p.y),z:p.z,color:p.color,radius:p.radius||.45,spell:p.spell,element:p.element});projectiles.splice(i,1);}
  }
 }
 function updateZones(dt){for(let i=zones.length-1;i>=0;i--){const zone=zones[i];zone.remaining-=dt;if(zone.id==='meteor'&&zone.remaining<=0){area(zone,zone.radius,zone.damage,zone.color,{push:1.5,element:'fire',burn:4,burnDamage:6,sourceId:'meteor'});emit({type:'impact',...point(zone,.2),color:zone.color,radius:zone.radius,spell:'meteor'});zones.splice(i,1);}else if(zone.id==='blizzard'){zone.tick-=dt;if(zone.tick<=0){zone.tick=.7;area(zone,zone.radius,zone.damage,zone.color,{slow:1.2,chill:3,element:'ice',sourceId:'blizzard',periodic:true});}if(zone.remaining<=0)zones.splice(i,1);}}}
 function update(dt){
  if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);clock+=dt;const s=state(),h=s.hero;if(day!==s.day){day=s.day;clear();spawn();}tickHero(h,dt);if(held)attack();const safe=isSanctuary(s.position);
  // Resolve spells before enemy strikes, so a landed freeze can interrupt a wind-up.
  updateProjectiles(dt);updateZones(dt);
  if(h.effects.wisp>0){wispTimer-=dt;if(wispTimer<=0){wispTimer=1.25;const target=enemies.filter(e=>!e.dead&&!e.training&&distance(e,s.position)<20&&!segmentBlocked(s.position,e,world.colliders)).sort((a,b)=>distance(a,s.position)-distance(b,s.position))[0];if(target){emit({type:'lightning',from:point({x:s.position.x+Math.cos(clock*1.4),z:s.position.z+Math.sin(clock*1.4)},2.2),to:point(target,1),color:SPELLS.wisp.color,spirit:true});damage(target,SPELLS.wisp.damage*stats(h).magic,SPELLS.wisp.color,{element:'arcane',sourceId:'wisp'});}}}
  for(const e of enemies){
   if(e.training&&e.resetIn>0){e.resetIn=Math.max(0,e.resetIn-dt);if(e.resetIn===0){Object.assign(e,{health:e.maxHealth,dead:false,freeze:0,iceLock:0,chill:0,burn:0,bind:0,slow:0});emit({type:'training-reset',...point(e,.1),color:0x9ddfff});}}
   if(e.dead)continue;
   e.freeze=Math.max(0,(e.freeze||0)-dt);e.iceLock=Math.max(0,(e.iceLock||0)-dt);e.chill=Math.max(0,(e.chill||0)-dt);e.bind=Math.max(0,(e.bind||0)-dt);e.slow=Math.max(0,(e.slow||0)-dt);e.flash=Math.max(0,(e.flash||0)-dt);e.attackTime=Math.max(0,(e.attackTime||0)-dt);
   if(e.burn>0){const burning=Math.min(dt,e.burn);e.burn=Math.max(0,e.burn-dt);e.burnTick=(e.burnTick||0)+burning;while(e.burnTick>=1-1e-9){e.burnTick=Math.max(0,e.burnTick-1);damage(e,e.burnDamage,0xff9d57,{element:'ember',periodic:true,sourceId:'burn'});}if(e.burn===0){e.burnTick=0;e.burnDamage=0;}}
   if(e.training||e.dead)continue;
   const d=distance(e,s.position),chase=!safe&&d<21&&distance(e,{x:e.homeX,z:e.homeZ})<32,canStrike=chase&&d<2.65&&e.freeze===0&&!e.iceLock&&!segmentBlocked(e,s.position,world.colliders);
   if(e.windup>0){if(!canStrike){cancelStrike(e);continue;}e.windup=Math.max(0,e.windup-dt);if(e.windup===0){e.attackTime=e.kind==='sentinel'?1.7:1.1;const beforeShield=h.shield,amount=hurtHero(h,e.damage,blocking);emit({type:'telegraph',phase:'strike',targetId:e.id,...point(e,.08)});emit({type:'hurt',amount,...point(s.position,1)});if(blocking||beforeShield>h.shield)emit({type:'guard',...point(s.position,1),color:beforeShield>h.shield?0xa6baff:0xf0d9a4,absorbed:Math.round(beforeShield-h.shield+(blocking?e.damage*stats(h).armor*.65:0))});if(h.health===0){const result=recover(s);clear();notify(result.message);onDefeat();changed();break;}}continue;}
   if(canStrike&&e.attackTime<=0){e.windup=e.kind==='sentinel'?1:.65;e.windupTotal=e.windup;e.heading=Math.atan2(s.position.x-e.x,s.position.z-e.z);emit({type:'telegraph',phase:'start',targetId:e.id,...point(e,.08),duration:e.windup,radius:e.kind==='sentinel'?2:1.25});continue;}
   const dest=chase?s.position:{x:e.homeX+Math.cos(clock*.15+Number(e.id.slice(8)))*2,z:e.homeZ+Math.sin(clock*.15+Number(e.id.slice(8)))*2};
   if(e.freeze===0&&!e.iceLock&&distance(e,dest)>1.7){const heading=Math.atan2(dest.x-e.x,dest.z-e.z),step=e.speed*(e.slow?.35:1)*dt,next={x:e.x,z:e.z};moveWithCollision(next,Math.sin(heading)*step,Math.cos(heading)*step,world.colliders,.34);if(!isSanctuary(next)){e.x=next.x;e.z=next.z;}e.heading=heading;}
  }
 }
 function practice(){const s=state();if(distance(s.position,TRAINING.focus)>3.2)return{ok:false,message:'Approach the blue focus stone in Eldermere.'};s.hero.mana=stats(s.hero).mana;for(const key of Object.keys(SPELLS))s.hero.cooldowns[key]=0;emit({type:'focus',...point(TRAINING.focus,.5),color:0xa9dfff,radius:2});changed();return{ok:true,message:'Focus restored · full mana and spells ready. Training targets grant no rewards.'};}
 spawn();return{enemies,projectiles,zones,attack,cast,update,clear,practice,reset(){clear();day=state().day;spawn();},setHeld(value){held=value;},setBlocking(value){blocking=value;},get blocking(){return blocking;},get player(){return state().position;},target(){return facingTarget(30,.96);},aim(){const p=SPELLS[state().hero.slots[state().hero.selected]];return ['meteor','blizzard'].includes(state().hero.slots[state().hero.selected])?{...point(groundTarget(p.range),.08),radius:p.radius,color:p.color}:null;},get clock(){return clock;}};
}
