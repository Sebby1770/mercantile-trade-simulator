import {WEAPONS,SPELLS,ENEMY_DEFS,ECHO,stats,spendAttack,spendCast,tickHero,hurtHero,rewardKill,rewardBoss,rewardEcho,noteSlain,recover,potency,spellRank} from './rpg.js';
import {BOSSES,inHazard,bossRequirementsMet} from './bosses.js';
import {TOWNS,blocksAt,moveWithCollision,surfaceAt} from './world.js';
// The first five camps keep their order so saved hostile-N ids stay stable.
export const ENCOUNTERS=[
 {name:'Briarwood prowlers',x:-43,z:29,kinds:['wolf','wolf','wolf']},
 {name:'The broken caravan',x:-60,z:-19,kinds:['goblin','goblin','goblin']},
 {name:'Whispering stones',x:-40,z:-118,kinds:['skeleton','wraith','skeleton']},
 {name:'The eastern watch',x:104,z:26,kinds:['goblin','skeleton','wolf']},
 {name:'The fallen guardian',x:145,z:-133,kinds:['sentinel','wraith','skeleton']},
 {name:'Rimewood pack',x:-48,z:-212,kinds:['frostwolf','frostwolf','frostwolf']},
 {name:'Troll of the tarn',x:80,z:-246,kinds:['troll','frostwolf']},
 {name:'Frozen barrow',x:-100,z:-232,kinds:['skeleton','wraith','frostwolf']},
 {name:'Drowned hamlet',x:-140,z:80,kinds:['thrall','thrall','hexer']},
 {name:'Hexers’ grove',x:-218,z:108,kinds:['hexer','hexer','thrall']},
 {name:'Sunken shrine',x:-150,z:170,kinds:['thrall','wraith','hexer']},
 {name:'Ember gate',x:180,z:8,kinds:['imp','imp','goblin']},
 {name:'Cinder quarry',x:205,z:-95,kinds:['cinderbrute','imp']},
 {name:'Smoke fields',x:250,z:10,kinds:['imp','cinderbrute','imp']},
 {name:'Thornback hollow',x:40,z:130,kinds:['wolf','goblin','wolf']}
];
export const TRAINING={x:-17,z:20,focus:{x:-13,z:24},targets:[{x:-15,z:17},{x:-21,z:17}]};
export const PARRY_WINDOW=.25,DODGE={distance:4.6,time:.28,iframes:.34,stamina:22,cooldown:.45},CHARGE={min:.45,full:1.1};
export const isSanctuary=p=>TOWNS.some(t=>Math.hypot(p.x-t.x,p.z-t.z)<32);
export function segmentEntry(a,b,colliders){const dx=b.x-a.x,dz=b.z-a.z;let earliest=Infinity;for(const c of colliders){let lo=0,hi=1,hit=true;for(const [v,d,min,max]of[[a.x,dx,c.x1,c.x2],[a.z,dz,c.z1,c.z2]]){if(Math.abs(d)<1e-9){if(v<min||v>max){hit=false;break;}}else{let t1=(min-v)/d,t2=(max-v)/d;if(t1>t2)[t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi){hit=false;break;}}}if(hit&&hi>0&&lo<1)earliest=Math.min(earliest,Math.max(0,lo));}return earliest;}
export const segmentBlocked=(a,b,colliders)=>segmentEntry(a,b,colliders)!==Infinity;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const point=(p,y=1.1)=>({x:p.x,y:surfaceAt(p.x,p.z)+y,z:p.z});
const size=e=>e.size??ENEMY_DEFS[e.kind]?.size??{r:.7,y:1.1};
const affinity=(e,element)=>element?((e.affinity??ENEMY_DEFS[e.kind]?.affinity)?.[element==='ember'?'fire':element==='poison'?'nature':element]??1):1;
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const turnToward=(from,to,max)=>{const d=wrap(to-from);return from+Math.max(-max,Math.min(max,d));};
// True when p stands behind e (enemy forward is (sin heading, cos heading)).
const behind=(e,p,limit=-.35)=>{const d=distance(e,p);return d>.01&&(Math.sin(e.heading||0)*(p.x-e.x)+Math.cos(e.heading||0)*(p.z-e.z))/d<limit;};
export function sphereEntry(center,a,b,radius){const x=a.x-center.x,y=a.y-center.y,z=a.z-center.z,dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;const aa=dx*dx+dy*dy+dz*dz,bb=2*(x*dx+y*dy+z*dz),cc=x*x+y*y+z*z-radius*radius;if(cc<=0)return 0;if(aa<1e-12)return Infinity;const disc=bb*bb-4*aa*cc;if(disc<0)return Infinity;const t=(-bb-Math.sqrt(disc))/(2*aa);return t>=0&&t<=1?t:Infinity;}

export function createCombat({state,world,emit=()=>{},notify=()=>{},changed=()=>{},onDefeat=()=>{},stamina=null,random=Math.random}){
 const enemies=[],projectiles=[],zones=[],foeShots=[],hazards=[],pending=[];let bosses=[];
 let clock=0,day=state().day,held=false,blocking=false,guardStart=-9,wispTimer=0,combo=-1,comboUntil=-1,queued=0,charge=null,riposte=0,motion=null,dodgeStart=-9,dodgeReady=0,evadeUntil=-9,channel=null,serial=0,downed=false,dotShown=0,dotAcc=0;
 const tire=n=>{if(!stamina)return true;if(!(stamina.stamina>=n))return false;stamina.stamina=Math.max(0,stamina.stamina-n);return true;};
 function foe(kind,id,x,z,extra={}){const d=ENEMY_DEFS[kind];return{id,kind,...d,maxHealth:d.health,maxPoise:d.poise||40,x,z,homeX:x,homeZ:z,heading:0,dead:false,freeze:0,iceLock:0,chill:0,burn:0,burnTick:0,burnDamage:0,poison:0,poisonTick:0,poisonDamage:0,bind:0,slow:0,stagger:0,poiseRest:0,windup:0,windupTotal:0,attackTime:1,flash:0,orbit:random()<.5?1:-1,wander:0,...extra};}
 function bossEntity(b){const h=state().hero,done=!!h.bosses?.includes(b.key);return{id:b.id,boss:b.key,kind:b.kind,name:b.name,title:b.title,health:b.health,maxHealth:b.health,poise:b.poise,maxPoise:b.poise,damage:0,speed:b.speed,size:b.size,affinity:b.affinity,hover:!!b.hover,x:b.x,z:b.z,homeX:b.x,homeZ:b.z,heading:0,dead:done,echo:false,dormant:!done&&!bossRequirementsMet(b.key,h.bosses||[]),engaged:false,phase:0,attack:null,cooldown:1.5,ready:{},resetIn:0,freeze:0,iceLock:0,chill:0,burn:0,burnTick:0,burnDamage:0,poison:0,poisonTick:0,poisonDamage:0,bind:0,slow:0,stagger:0,poiseRest:0,windup:0,attackTime:0,flash:0};}
 function buildBosses(){bosses=Object.values(BOSSES).map(bossEntity);}
 function spawn(){
  enemies.length=0;let index=0;const s=state();
  for(const camp of ENCOUNTERS)camp.kinds.forEach((kind,i)=>{let x=camp.x+Math.cos(i*2.4)*3,z=camp.z+Math.sin(i*2.4)*3;for(let j=0;j<40&&blocksAt(x,z,world.colliders,.35);j++){x=camp.x+Math.cos(j*1.7)*(3+j*.22);z=camp.z+Math.sin(j*1.7)*(3+j*.22);}const id='hostile-'+index;enemies.push(foe(kind,id,x,z,{dead:s.hero.defeated[id]===day,wander:index++}));});
  TRAINING.targets.forEach((p,i)=>enemies.push({...p,id:'training-'+i,kind:'dummy',name:'Runewood training target',training:true,health:240,maxHealth:240,poise:80,maxPoise:80,homeX:p.x,homeZ:p.z,heading:0,dead:false,freeze:0,iceLock:0,chill:0,burn:0,bind:0,slow:0,stagger:0,windup:0,attackTime:0,flash:0,resetIn:0}));
  for(const b of bosses)enemies.push(b);
 }
 function stopChannel(){if(!channel)return;channel=null;emit({type:'channel-end'});}
 function clear(){stopChannel();projectiles.length=0;zones.length=0;foeShots.length=0;hazards.length=0;pending.length=0;held=blocking=false;charge=null;motion=null;evadeUntil=-9;queued=0;riposte=0;wispTimer=0;combo=-1;comboUntil=-1;for(const b of bosses)b.attack=null;emit({type:'clear'});}
 function dropHazards(match){for(let i=hazards.length-1;i>=0;i--)if(match(hazards[i])){emit({type:'hazard',phase:'cancel',id:hazards[i].id});hazards.splice(i,1);}}
 function cancelStrike(e){if(e.windup>0){e.windup=0;e.attackTime=.65;emit({type:'telegraph',phase:'cancel',targetId:e.id,...point(e,.08)});}if(e.boss&&e.attack){e.attack=null;e.cooldown=Math.max(e.cooldown||0,.8);dropHazards(h=>h.owner===e.id&&!h.active);}}
 function staggerFoe(e,seconds){if(e.dead)return;e.stagger=Math.max(e.stagger||0,seconds??(e.boss?3.2:1.6));if(!e.boss)e.freeze=Math.max(e.freeze||0,e.stagger);e.poise=e.maxPoise??e.poise;e.poiseRest=0;cancelStrike(e);emit({type:'stagger',boss:!!e.boss,targetId:e.id,...point(e,size(e).y*1.7)});}
 function damage(e,amount,color=0xffdb99,status={}){
  if(e.dead||e.health<=0||e.dormant||(!e.training&&isSanctuary(e)))return false;
  const element=status.element,mult=affinity(e,element);amount*=mult;let crit=!!status.crit;
  if((e.stagger||0)>0&&!status.periodic){amount*=1.3;crit=true;}
  const chilled=e.chill>0;let combo=null;
  if(chilled&&element==='fire'){amount*=1.65;e.chill=0;e.iceLock=0;combo='shatter';}
  else if(chilled&&element==='storm'){amount*=1.4;e.chill=0;combo='conduction';}
  else if(e.burn>0&&element==='storm'&&!status.periodic){amount*=1.35;e.burn=0;e.burnTick=0;e.burnDamage=0;combo='overload';}
  // Ice quenches burning; only ice status, not a generic stun, enables combinations.
  if(element==='ice'){e.burn=0;e.burnTick=0;e.burnDamage=0;e.chill=Math.max(e.chill||0,status.chill||4);}
  if(status.burn){e.burn=Math.max(e.burn||0,status.burn);e.burnDamage=Math.max(e.burnDamage||0,status.burnDamage||4);if(!e.burnTick)e.burnTick=0;}
  if(status.poison){e.poison=Math.max(e.poison||0,status.poison);e.poisonDamage=Math.max(e.poisonDamage||0,status.poisonDamage||5);if(!e.poisonTick)e.poisonTick=0;}
  e.health=Math.max(0,e.health-amount);e.flash=.16;
  // Legends shrug off hard control; poise breaks and parries are the way to stagger them.
  if(!e.boss){if(element==='ice')e.iceLock=Math.max(e.iceLock||0,status.freeze||0);else e.freeze=Math.max(e.freeze||0,status.freeze||0);e.bind=Math.max(e.bind||0,status.bind||0);}
  e.slow=Math.max(e.slow||0,status.slow||0);
  let broke=false;if(!status.periodic&&e.health>0){const max=e.maxPoise??ENEMY_DEFS[e.kind]?.poise??40;e.maxPoise=max;e.poise=(e.poise??max)-(status.poise??amount*.2);e.poiseRest=3;broke=e.poise<=0&&!(e.stagger>0);}
  if(e.freeze>0||e.iceLock>0||e.stagger>0||e.health<=0)cancelStrike(e);
  if(e.training)e.resetIn=5;
  const position=point(e,e.boss?size(e).y*1.4:e.kind==='sentinel'?2.6:1.4);
  emit({type:'hit',...position,targetId:e.id,color,amount:Math.round(amount),element,sourceId:status.sourceId,periodic:!!status.periodic,training:!!e.training,crit,tag:status.tag||null,weak:mult>1.05,resist:mult<.95});
  if(combo)emit({type:'combo',combo,...position,targetId:e.id,color:combo==='shatter'?0xffc38b:combo==='overload'?0xffd27a:0xb4ddff,amount:Math.round(amount)});
  if(broke)staggerFoe(e);
  if(combo==='overload')for(const o of enemies)if(o!==e&&!o.dead&&!o.dormant&&distance(o,e)<=4.5)damage(o,amount*.6,0xffd27a,{element:'arcane',sourceId:'overload',poise:15});
  if(e.health===0){
   e.dead=true;e.deadAt=clock;
   if(e.training){e.resetIn=2;emit({type:'training-down',...position,color:0xa8e7ff});return true;}
   if(e.boss){bossDown(e,position);return true;}
   if(e.summon){noteSlain(state().hero,e.kind);emit({type:'defeat',...position,color:0xb7a6d8,radius:.9});return true;}
   const result=rewardKill(state(),e);
   if(result.rewarded){const b=result.bounty,tally=b?' · bounty '+b.have+'/'+b.need+(b.have>=b.need?' · claim it at the board':''):'';notify((result.levels?'Level '+state().hero.level+' · health and mana restored · +'+result.levels+' skill point'+(result.levels>1?'s':''):e.name+' defeated · +'+e.coin+' coin · +'+e.xp+' XP')+tally);emit({type:'defeat',...position,color:0xfad58b,radius:1.3});if(result.levels)emit({type:'level',...point(state().position,0),color:0xffd68b,level:state().hero.level});changed();}
  }
  return true;
 }
 function bossDown(e,position){const s=state(),def=BOSSES[e.boss];
  if(e.echo){const r=rewardEcho(s,e.boss);e.echo=false;e.engaged=false;e.attack=null;for(const o of enemies)if(o.owner===e.id&&!o.dead){o.dead=true;o.deadAt=clock;}dropHazards(h=>h.owner===e.id||h.style===e.boss);for(let i=foeShots.length-1;i>=0;i--)if(foeShots[i].owner===e.id)foeShots.splice(i,1);emit({type:'boss-defeat',boss:e.boss,name:'Echo of '+def.name,title:def.title,color:def.color,weapon:null,weaponName:null,sigil:null,echo:true,...position});if(r.rewarded){notify('Echo of '+def.name+' dispelled · +'+r.coin+' coin');if(r.levels)emit({type:'level',...point(s.position,0),color:0xffd68b,level:s.hero.level});}changed();return;}
  const result=rewardBoss(s,e.boss);e.engaged=false;e.attack=null;
  for(const o of enemies)if(o.owner===e.id&&!o.dead){o.dead=true;o.deadAt=clock;emit({type:'defeat',...point(o,1),color:0xb7a6d8,radius:.9});}
  dropHazards(h=>h.owner===e.id||h.style===e.boss);for(let i=foeShots.length-1;i>=0;i--)if(foeShots[i].owner===e.id)foeShots.splice(i,1);
  const weapon=result.weapon?WEAPONS[result.weapon].name:null;
  emit({type:'boss-defeat',boss:e.boss,name:def.name,title:def.title,color:def.color,weapon:result.weapon||null,weaponName:weapon,sigil:def.sigil,...position});
  if(result.rewarded){notify(def.name+' defeated · '+(weapon?weapon+' claimed · ':'')+def.sigil+' · +'+def.coin+' coin · +'+def.points+' skill points');if(result.levels)emit({type:'level',...point(s.position,0),color:0xffd68b,level:s.hero.level});}
  changed();}
 function area(center,radius,amount,color,status={}){for(const e of enemies){if(e.dead||e.dormant)continue;const sz=size(e),reach=Number.isFinite(center.y)?Math.hypot(e.x-center.x,e.z-center.z,surfaceAt(e.x,e.z)+sz.y-center.y):distance(e,center);if(reach>radius+Math.max(0,sz.r-.7)||segmentBlocked(center,e,world.colliders))continue;const hit=damage(e,amount,color,status);if(hit&&status.push&&!e.training&&!e.boss&&!e.dead){const d=Math.max(.1,distance(e,center));moveWithCollision(e,(e.x-center.x)/d*status.push,(e.z-center.z)/d*status.push,world.colliders,.3);}}}
 function launch(origin,direction,data){const speed=data.speed||25;projectiles.push({...origin,dx:direction.x,dy:direction.y,dz:direction.z,speed,life:(data.range||40)/speed,...data,hitIds:data.pierce?[]:null,id:'shot-'+serial++});}
 function facingTarget(range,threshold=.7){const p=state().position,fx=-Math.sin(p.yaw),fz=-Math.cos(p.yaw);return enemies.filter(e=>!e.dead&&!e.dormant&&distance(e,p)<range+Math.max(0,size(e).r-.7)&&((e.x-p.x)*fx+(e.z-p.z)*fz)/Math.max(.01,distance(e,p))>threshold&&!segmentBlocked(p,e,world.colliders)).sort((a,b)=>distance(a,p)-distance(b,p))[0];}
 function groundTarget(range){const p=state().position,eye=stats(state().hero).eye;const d=p.pitch<-.08?Math.min(range,-eye/Math.tan(p.pitch)):range;const result={x:p.x,z:p.z};moveWithCollision(result,-Math.sin(p.yaw)*d,-Math.cos(p.yaw)*d,world.colliders,.15);return result;}
 // One melee blow: reach grows with the target's size; ripostes and backstabs are critical.
 function strike(w,{mult=1,poise=w.poise||10,push=0,arc=w.arc,range=w.range,stun=w.stun||0,heavy=false}={}){
  const s=state(),h=s.hero,p=s.position,a=stats(h),fx=-Math.sin(p.yaw),fz=-Math.cos(p.yaw),base=w.damage*a.power*a.melee*mult;let first=null,count=0;const riposting=riposte>0;
  for(const e of enemies){if(e.dead||e.dormant)continue;const d=distance(e,p);if(d>range+Math.max(0,size(e).r-.7))continue;if(arc>-1&&d>.6&&((e.x-p.x)*fx+(e.z-p.z)*fz)/Math.max(.01,d)<=arc)continue;if(segmentBlocked(p,e,world.colliders))continue;
   let amount=base,crit=false,tag=null;if(riposting){amount*=1.8;crit=true;tag='RIPOSTE';}else if(!e.training&&behind(e,p)){amount*=1.35;crit=true;tag='BACKSTAB';}
   if(damage(e,amount,w.color,{freeze:stun,sourceId:h.equipped,poise:poise*(crit?1.5:1),crit,tag,element:w.element,chill:w.chill,burn:w.burn,burnDamage:w.burn?5*a.power:0,heavy})){count++;first??=e;if(push&&!e.training&&!e.boss&&!e.dead){const n=Math.max(.1,d);moveWithCollision(e,(e.x-p.x)/n*push,(e.z-p.z)/n*push,world.colliders,.3);}}}
  if(count){if(riposting)riposte=0;emit({type:'impact-melee',strength:heavy?1:.45,count,color:w.color,...point(first,size(first).y)});}
  return count;
 }
 function attack(){
  const s=state(),h=s.hero,result=spendAttack(h);if(!result.ok){if(result.message){held=false;notify(result.message);}return result;}
  const w=result.weapon,p=s.position,a=stats(h);
  if(w.kind==='melee'){const step=clock<=comboUntil?(combo+1)%3:0,finisher=step===2;combo=step;comboUntil=clock+(h.cooldowns.attack||w.cooldown)+.6;
   emit({type:'swing',weapon:h.equipped,color:w.color,combo:step,heavy:false,...point(p,a.eye)});
   strike(w,{mult:finisher?1.45:1,poise:(w.poise||10)*(finisher?1.8:1),push:finisher?1.4:0});
   if(h.equipped==='warhammer')emit({type:'ring',...point(groundTarget(2),.13),radius:2,color:w.color,duration:.35});
  }else{const cp=Math.cos(p.pitch),element=w.element||(h.equipped==='emberstaff'?'fire':h.equipped==='froststaff'?'ice':w.kind==='magic'?'arcane':undefined);
   emit({type:'swing',weapon:h.equipped,color:w.color,combo:0,heavy:false,...point(p,a.eye)});
   launch(point(p,a.eye-.12),{x:-Math.sin(p.yaw)*cp,y:Math.sin(p.pitch),z:-Math.cos(p.yaw)*cp},{speed:w.speed,range:w.range,damage:w.damage*a.power*(w.kind==='magic'?a.magic:a.ranged),color:w.color,slow:w.slow||0,weapon:h.equipped,element,chill:element==='ice'?2:0,burn:element==='fire'?3:0,burnDamage:3*a.magic,bind:w.bind||0,poison:w.poison||0,poisonDamage:w.poison?4*a.magic:0,poise:w.poise||6});}
  changed();return{ok:true,combo:w.kind==='melee'?combo:null};
 }
 // Charged blows ignore the remaining swing cooldown: the hold itself is the cost, with stamina.
 function heavy(power01=1){
  const s=state(),h=s.hero,w=WEAPONS[h.equipped],hv=w?.heavy;if(!hv||!h.weapons.includes(h.equipped)||h.health<=0)return{ok:false,message:''};
  if(w.ammo&&h[w.ammo]<=0){notify('Out of '+w.ammo+'. Buy supplies from Rowan, Gareth or Halvard.');return{ok:false,message:'Out of '+w.ammo+'.'};}
  if(!tire(hv.stamina??24)){notify('Too winded for a heavy blow.');return attack();}
  const p=s.position,a=stats(h),k=.7+.3*Math.max(0,Math.min(1,power01)),cp=Math.cos(p.pitch);
  emit({type:'swing',weapon:h.equipped,color:w.color,heavy:true,move:hv.move,combo:2,...point(p,a.eye)});
  if(w.kind==='ranged'){h[w.ammo]--;h.cooldowns.attack=w.cooldown;launch(point(p,a.eye-.12),{x:-Math.sin(p.yaw)*cp,y:Math.sin(p.pitch),z:-Math.cos(p.yaw)*cp},{speed:w.speed*(hv.speed||1),range:w.range*1.2,damage:w.damage*a.power*a.ranged*hv.mult*k,color:w.color,weapon:h.equipped,pierce:hv.pierce||0,poise:(w.poise||10)*3,heavy:true});changed();return{ok:true,heavy:true};}
  h.cooldowns.attack=w.cooldown*1.15;combo=-1;comboUntil=-1;
  const opts={mult:hv.mult*k,poise:(w.poise||10)*3,arc:hv.arc??w.arc,range:hv.range||w.range,stun:hv.stun||w.stun||0,push:2,heavy:true};
  if(hv.move==='flurry')for(let i=0;i<(hv.hits||3);i++)pending.push({at:clock+i*.12,fn:()=>strike(w,{...opts,poise:(w.poise||10)*1.5,push:0})});
  else if(hv.move==='lunge'){motion={dx:-Math.sin(p.yaw),dz:-Math.cos(p.yaw),left:hv.lunge||4,speed:(hv.lunge||4)/.16};pending.push({at:clock+.17,fn:()=>strike(w,opts)});}
  else if(hv.move==='slam'){const c=groundTarget(2.2);emit({type:'ring',...point(c,.13),radius:hv.radius,color:hv.fire?0xff8a3d:w.color,duration:.5});area(point(c,.6),hv.radius,w.damage*a.power*a.melee*hv.mult*k,w.color,{freeze:hv.stun||w.stun||0,poise:(w.poise||10)*3,push:2.5,element:w.element,burn:hv.fire?3:w.burn||0,burnDamage:5*a.power,sourceId:h.equipped,heavy:true});emit({type:'impact-melee',strength:1,color:w.color,...point(c,.4)});}
  else strike(w,opts);
  if(hv.wave)launch(point(p,a.eye-.45),{x:-Math.sin(p.yaw),y:0,z:-Math.cos(p.yaw)},{speed:24,range:26,damage:w.damage*a.power*a.melee*hv.mult*k*.9,color:w.color,wave:hv.wave,element:hv.wave==='ice'?'ice':'arcane',chill:hv.wave==='ice'?3:0,pierce:5,poise:(w.poise||10)*1.5,weapon:h.equipped});
  changed();return{ok:true,heavy:true};
 }
 function pressAttack(){const h=state().hero,w=WEAPONS[h.equipped];if(!w||h.health<=0)return{ok:false};if(w.heavy){charge={start:clock,weapon:h.equipped};return{ok:true,charging:true};}held=true;return attack();}
 function releaseAttack(){held=false;if(!charge)return{ok:false};const c=charge;charge=null;const h=state().hero;if(h.equipped!==c.weapon)return{ok:false};const t=clock-c.start;if(t>=CHARGE.min)return heavy(Math.min(1,(t-CHARGE.min)/(CHARGE.full-CHARGE.min)));const r=attack();if(!r.ok&&(h.cooldowns.attack||0)>0&&h.cooldowns.attack<.35)queued=clock+.35;return r;}
 function dodge(dir={}){const s=state(),h=s.hero;if(h.health<=0||motion||clock<dodgeReady)return{ok:false};if(!tire(DODGE.stamina*(h.effects.swiftfoot>0?.66:1))){notify('Too tired to dodge.');return{ok:false,message:'Too tired to dodge.'};}
  let dx=Number(dir?.x)||0,dz=Number(dir?.z)||0,n=Math.hypot(dx,dz);if(n<1e-3){dx=Math.sin(s.position.yaw);dz=Math.cos(s.position.yaw);n=1;}
  motion={dx:dx/n,dz:dz/n,left:DODGE.distance,speed:DODGE.distance/DODGE.time,dodge:true};dodgeStart=clock;evadeUntil=clock+DODGE.iframes;dodgeReady=clock+DODGE.time+DODGE.cooldown;charge=null;stopChannel();
  emit({type:'dodge',...point(s.position,.2),dx:motion.dx,dz:motion.dz});return{ok:true};}
 function applyStatus(h,st){const e=h.effects;for(const [key,effect]of[['chill','chill'],['slow','chill'],['poison','poison'],['burn','burn'],['root','root']])if(st[key]>0)e[effect]=Math.min(60,Math.max(e[effect]||0,st[key]));}
 // Every blow against the hero resolves here: dodge, parry, guard and ward, then statuses.
 function hurtPlayer(raw,{source=null,parry=false,unblockable=false,status=null,dot=false,shot=false}={}){
  const s=state(),h=s.hero;if(h.health<=0||!(raw>0))return{amount:0};const at=point(s.position,1);
  if(!dot&&clock<evadeUntil){const perfect=clock-dodgeStart<.2;if(perfect)riposte=Math.max(riposte,1.6);emit({type:'evade',perfect,...at});return{evaded:true,amount:0};}
  if(h.effects.grace>0)return{amount:0};
  if(!dot&&parry&&blocking&&!unblockable&&clock-guardStart<=PARRY_WINDOW){riposte=Math.max(riposte,1.6);emit({type:'parry',...at,color:0xfff0b8});if(source&&!source.dead&&!shot){if(source.boss){source.poise=(source.poise??source.maxPoise)-source.maxPoise*.28;source.poiseRest=3;if(source.poise<=0)staggerFoe(source);}else if(!source.training)staggerFoe(source,1.4);}return{parried:true,amount:0};}
  let guarded=blocking&&!unblockable&&!dot;
  if(guarded&&stamina){const cost=raw*.55;if(stamina.stamina<cost){guarded=false;stamina.stamina=0;emit({type:'guard-break',...at});}else stamina.stamina-=cost;}
  const beforeShield=h.shield,amount=hurtHero(h,raw,guarded),absorbed=beforeShield-h.shield;
  if(dot){dotAcc+=amount;if(clock-dotShown>.5){emit({type:'hurt',amount:dotAcc,dot:true,...at});dotAcc=0;dotShown=clock;}}else emit({type:'hurt',amount,...at,unblockable:blocking&&unblockable});
  if(guarded||absorbed>0)emit({type:'guard',...at,color:absorbed>0?0xa6baff:0xf0d9a4,absorbed:Math.round(absorbed+(guarded?raw*stats(h).armor*.65:0))});
  if(absorbed>0&&source&&!source.dead&&!shot&&spellRank(h,'ward')===3)damage(source,absorbed*.4,SPELLS.ward.color,{element:'arcane',sourceId:'ward',poise:0});
  if(!guarded)applyStatus(h,{...(shot?{}:source?.onHit||{}),...(status||{})});
  if(h.health===0)defeated();return{amount};
 }
 function defeated(){if(downed)return;downed=true;const s=state(),result=recover(s);clear();for(const b of bosses)if(b.engaged)resetBoss(b,false);notify(result.message);onDefeat();changed();}
 function tickPlayer(dt,safe){const s=state(),h=s.hero,e=h.effects;if(h.health<=0)return;if(e.regen>0)h.health=Math.min(stats(h).health,h.health+6*dt);if(e.grace>0)return;let dot=0;if(e.poison>0)dot+=5*dt;if(e.burn>0)dot+=6*dt;if(!safe&&world.terrainAt?.(s.position.x,s.position.z)==='lava'){dot+=18*dt;e.burn=Math.max(e.burn||0,2);}if(dot>0){h.health=Math.max(0,h.health-dot);dotAcc+=dot;if(clock-dotShown>.5){emit({type:'hurt',amount:dotAcc,dot:true,...point(s.position,1)});dotAcc=0;dotShown=clock;}if(h.health===0)defeated();}}
 function addHazard(h){h.id='hz-'+serial++;h.remaining=h.total=h.delay;hazards.push(h);emit({type:'hazard',phase:'start',...shapeOf(h),duration:h.delay});return h;}
 const shapeOf=h=>({id:h.id,shape:h.shape,x:h.x,y:surfaceAt(h.x,h.z),z:h.z,yaw:h.yaw||0,radius:h.radius,inner:h.inner,angle:h.angle,length:h.length,width:h.width,unblockable:!!h.unblockable,style:h.style,color:h.color});
 function updateHazards(dt){const s=state(),p=s.position,safe=isSanctuary(p);
  for(let i=hazards.length-1;i>=0;i--){const h=hazards[i];if(!h)continue;
   if(h.active){h.remaining-=dt;h.tickIn-=dt;if(h.tickIn<=0){h.tickIn+=.5;if(!safe&&inHazard(h,p)){hurtPlayer(h.tick*.5,{status:h.status,unblockable:true,dot:true});if(downed)return;}}if(h.remaining<=0){const k=hazards.indexOf(h);if(k>=0)hazards.splice(k,1);emit({type:'hazard',phase:'end',id:h.id});}continue;}
   h.remaining-=dt;if(h.remaining>0)continue;
   const owner=h.owner?enemies.find(e=>e.id===h.owner&&!e.dead):null,k=hazards.indexOf(h);if(k>=0)hazards.splice(k,1);
   if(h.charge&&owner){const def=BOSSES[owner.boss],from=point(owner,1),dest={x:owner.x,z:owner.z};moveWithCollision(dest,Math.sin(h.yaw)*h.length,Math.cos(h.yaw)*h.length,world.colliders,.6);if(def){const off=distance(dest,def);if(off>def.arena-2){dest.x=def.x+(dest.x-def.x)*(def.arena-2)/off;dest.z=def.z+(dest.z-def.z)*(def.arena-2)/off;}}owner.x=dest.x;owner.z=dest.z;emit({type:'boss-dash',from,to:point(owner,1),color:h.color});}
   emit({type:'hazard',phase:'resolve',...shapeOf(h)});
   if(!safe&&h.damage>0&&inHazard(h,p)){const r=hurtPlayer(h.damage,{source:owner,parry:h.parry,unblockable:h.unblockable,status:h.status});if(downed)return;if(r.amount>0&&h.push){const d=Math.max(.1,Math.hypot(p.x-h.x,p.z-h.z));moveWithCollision(p,(p.x-h.x)/d*h.push,(p.z-h.z)/d*h.push,world.colliders);}}
   if(h.shape==='pool'&&h.duration>0){h.active=true;h.remaining=h.duration;h.tickIn=.25;hazards.push(h);emit({type:'pool',...shapeOf(h),duration:h.duration});}
  }}
 function fireFoeShot(e,target,{angle=0,speed,damage,color,status,parry=true,element,range=32}={}){const from=point(e,size(e).y+.25),to=point(target,1.1);let dx=to.x-from.x,dz=to.z-from.z;const dy=to.y-from.y,c=Math.cos(angle),sn=Math.sin(angle);[dx,dz]=[dx*c+dz*sn,-dx*sn+dz*c];const n=Math.hypot(dx,dy,dz)||1,v=speed||e.ranged?.speed||15;foeShots.push({id:'foe-'+serial++,x:from.x,y:from.y,z:from.z,dx:dx/n,dy:dy/n,dz:dz/n,speed:v,life:range/v,damage:damage??e.damage,color:color??e.ranged?.color??0x9be36b,status:status??e.ranged?.status??null,owner:e.id,parry,element:element??e.ranged?.element});}
 // A parried bolt returns to its caster at greater speed and more than double the force.
 function reflect(f,owner){const from={x:f.x,y:f.y,z:f.z};let dir={x:-f.dx,y:-f.dy,z:-f.dz};if(owner&&!owner.dead){const to=point(owner,size(owner).y),dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z,n=Math.hypot(dx,dy,dz)||1;dir={x:dx/n,y:dy/n,z:dz/n};}launch({x:from.x+dir.x*.8,y:from.y+dir.y*.8,z:from.z+dir.z*.8},dir,{speed:f.speed*1.6,range:40,damage:f.damage*2.2,color:f.color,weapon:'reflect',element:f.element||'arcane',poise:30});emit({type:'reflect',...from,color:f.color});}
 function updateFoeShots(dt){const s=state(),target=point(s.position,1.1),safe=isSanctuary(s.position);
  for(let i=foeShots.length-1;i>=0;i--){const f=foeShots[i],old={x:f.x,y:f.y,z:f.z},end={x:f.x+f.dx*f.speed*dt,y:f.y+f.dy*f.speed*dt,z:f.z+f.dz*f.speed*dt};f.life-=dt;
   const wallT=segmentEntry(old,end,world.colliders),floor=surfaceAt(end.x,end.z)+.05,groundT=end.y<floor?Math.max(0,Math.min(1,(old.y-floor)/(old.y-end.y||1))):Infinity,playerT=f.evaded||safe||s.hero.health<=0?Infinity:sphereEntry(target,old,end,.55);
   if(playerT!==Infinity&&playerT<=wallT&&playerT<=groundT){const owner=enemies.find(e=>e.id===f.owner);const r=hurtPlayer(f.damage,{source:owner,parry:f.parry,status:f.status,shot:true});if(downed)return;if(r.evaded)f.evaded=true;else{foeShots.splice(i,1);if(r.parried)reflect(f,owner);else emit({type:'burst',...target,color:f.color,radius:.4,element:f.element,foe:true});continue;}}
   const impactT=Math.min(wallT,groundT);if(impactT!==Infinity||f.life<=0){const t=impactT===Infinity?1:impactT;emit({type:'burst',x:old.x+(end.x-old.x)*t,y:Math.max(.1,old.y+(end.y-old.y)*t),z:old.z+(end.z-old.z)*t,color:f.color,radius:.35,element:f.element,foe:true});foeShots.splice(i,1);continue;}
   f.x=end.x;f.y=end.y;f.z=end.z;}}
 const shotStatus=p=>({freeze:p.freeze,slow:p.slow,element:p.element,burn:p.burn,burnDamage:p.burnDamage,chill:p.chill,bind:p.bind,poison:p.poison,poisonDamage:p.poisonDamage,poise:p.poise,sourceId:p.spell||p.weapon});
 function updateProjectiles(dt){
  for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i],old={x:p.x,y:p.y,z:p.z},step=Math.min(dt,Math.max(0,p.life));const end={x:p.x+p.dx*p.speed*step,y:p.y+p.dy*p.speed*step,z:p.z+p.dz*p.speed*step};p.life-=dt;let hit=null,hitT=Infinity;
   for(const e of enemies){if(e.dead||e.dormant||p.hitIds?.includes(e.id))continue;const sz=size(e),t=sphereEntry(point(e,sz.y),old,end,sz.r);if(t<hitT){hitT=t;hit=e;}}
   const wallT=segmentEntry(old,end,world.colliders),floor=surfaceAt(end.x,end.z)+.07,groundT=end.y<floor?Math.max(0,Math.min(1,(old.y-floor)/(old.y-end.y||1))):Infinity;
   // Piercing shots damage what they pass through and keep flying.
   if(hit&&p.pierce>0&&!p.radius&&hitT<=wallT&&hitT<=groundT){damage(hit,p.damage,p.color,shotStatus(p));p.hitIds.push(hit.id);p.pierce--;emit({type:'burst',...point(hit,size(hit).y),color:p.color,radius:.35,spell:p.spell,element:p.element,wave:p.wave});hit=null;hitT=Infinity;}
   const impactT=Math.min(hitT,wallT,groundT),fraction=impactT===Infinity?1:Math.max(0,impactT-.0005);p.x=old.x+(end.x-old.x)*fraction;p.y=old.y+(end.y-old.y)*fraction;p.z=old.z+(end.z-old.z)*fraction;
   if(impactT!==Infinity||p.life<=0){const status=shotStatus(p);if(p.radius)area(p,p.radius,p.damage,p.color,status);else if(hit&&hitT<=wallT&&hitT<=groundT)damage(hit,p.damage,p.color,status);emit({type:'burst',x:p.x,y:Math.max(.1,p.y),z:p.z,color:p.color,radius:p.radius||.45,spell:p.spell,element:p.element,wave:p.wave});
    if(p.embers&&p.y-surfaceAt(p.x,p.z)<3){zones.push({id:'embers',x:p.x,z:p.z,remaining:3,tick:0,radius:2.6,damage:p.burnDamage||6,color:0xff8b43});emit({type:'embers',...point(p,.05),radius:2.6,duration:3,color:0xff8b43});}
    projectiles.splice(i,1);}
  }
 }
 function stormStrike(zone){const alive=enemies.filter(e=>!e.dead&&!e.dormant&&distance(e,zone)<=zone.radius+Math.max(0,size(e).r-.7));const e=alive[Math.floor(random()*alive.length)];if(e){const to=point(e,size(e).y);emit({type:'lightning',from:{x:e.x+(random()-.5)*2,y:to.y+14,z:e.z+(random()-.5)*2},to,color:zone.color,storm:true});damage(e,zone.damage,zone.color,{element:'storm',freeze:.3,sourceId:'thunderstorm',poise:10});}else{const a=random()*Math.PI*2,r=Math.sqrt(random())*zone.radius,q={x:zone.x+Math.cos(a)*r,z:zone.z+Math.sin(a)*r},to=point(q,.05);emit({type:'lightning',from:{x:q.x,y:to.y+14,z:q.z},to,color:zone.color,storm:true});}}
 function updateZones(dt){for(let i=zones.length-1;i>=0;i--){const zone=zones[i];zone.remaining-=dt;
  if(zone.id==='meteor'){if(zone.remaining<=0){area(zone,zone.radius,zone.damage,zone.color,{push:1.5,element:'fire',burn:4,burnDamage:6,sourceId:'meteor',poise:50});emit({type:'impact',...point(zone,.2),color:zone.color,radius:zone.radius,spell:'meteor'});zones.splice(i,1);}}
  else if(zone.id==='blizzard'){zone.tick-=dt;if(zone.tick<=0){zone.tick=.7;area(zone,zone.radius,zone.damage,zone.color,{slow:1.2,chill:3,element:'ice',sourceId:'blizzard',periodic:true});}if(zone.remaining<=0){if(zone.freezeEnd){area(zone,zone.radius,zone.damage,zone.color,{element:'ice',freeze:1.2,chill:3,sourceId:'blizzard',poise:0});emit({type:'burst',...point(zone,.4),color:zone.color,radius:zone.radius*.6,element:'ice'});}zones.splice(i,1);}}
  else if(zone.id==='embers'){zone.tick-=dt;if(zone.tick<=0){zone.tick=.5;area(zone,zone.radius,zone.damage*.5,zone.color,{element:'fire',burn:2,burnDamage:zone.damage,sourceId:'embers',periodic:true});}if(zone.remaining<=0)zones.splice(i,1);}
  else if(zone.id==='thunderstorm'){zone.tick-=dt;while(zone.tick<=0&&zone.left>0){zone.tick+=zone.interval;zone.left--;stormStrike(zone);}if(zone.left<=0||zone.remaining<-.2)zones.splice(i,1);}
 }}
 function updateChannel(dt){if(!channel)return;const s=state(),h=s.hero,p=SPELLS[channel.id];channel.time+=dt;const drain=p.drain*dt;if(h.health<=0||channel.time>p.channel||h.mana<drain){stopChannel();return;}h.mana-=drain;
  const pos=s.position,a=stats(h),from=point(pos,a.eye-.2),cp=Math.cos(pos.pitch),dir={x:-Math.sin(pos.yaw)*cp,y:Math.sin(pos.pitch),z:-Math.cos(pos.yaw)*cp},to={x:from.x+dir.x*p.range,y:from.y+dir.y*p.range,z:from.z+dir.z*p.range};
  let t=Math.min(1,segmentEntry(from,to,world.colliders));for(let i=1;i<=24;i++){const f=i/24;if(f>=t)break;if(from.y+dir.y*p.range*f<surfaceAt(from.x+dir.x*p.range*f,from.z+dir.z*p.range*f)){t=f;break;}}
  let target=null;for(const e of enemies){if(e.dead||e.dormant)continue;const sz=size(e),hitT=sphereEntry(point(e,sz.y),from,to,sz.r+.3);if(hitT<t){t=hitT;target=e;}}
  channel.from=from;channel.end={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,z:from.z+(to.z-from.z)*t};channel.targetId=target?.id||null;
  channel.tick-=dt;if(channel.tick<=0){channel.tick+=.2;if(target){const amount=p.damage*.2*a.power*a.magic*potency(h,channel.id);damage(target,amount,p.color,{element:'radiant',sourceId:channel.id,poise:3});if(spellRank(h,channel.id)===3)h.health=Math.min(a.health,h.health+amount*.2);}}}
 function cast(slot){
  const s=state(),h=s.hero;if(!Number.isInteger(slot)||slot<0||slot>3)return{ok:false,message:'Choose a spell slot.'};const id=h.slots[slot],p=SPELLS[id];
  if(channel){const same=channel.id===id;stopChannel();if(same)return{ok:true,message:p.name+' released'};}
  const result=spendCast(h,id);if(!result.ok){notify(result.message);return result;}
  h.selected=slot;const pos=s.position,a=stats(h),k=potency(h,id),mastered=spellRank(h,id)===3,power=a.power*a.magic*k;emit({type:'cast',spell:id,color:p.color,...point(pos,a.eye),yaw:pos.yaw});
  if(id==='heal'){const restored=Math.min(a.health-h.health,p.healing*power);h.health+=restored;if(mastered)h.effects.regen=6;emit({type:'heal',...point(pos,.1),radius:2,color:p.color,duration:1.8,amount:Math.round(restored)});}
  else if(id==='ward'){h.effects.ward=p.duration;h.shield=Math.min(150,p.shield*k);}
  else if(id==='haste')h.effects.haste=p.duration;
  else if(id==='wisp'){h.effects.wisp=p.duration;wispTimer=0;}
  else if(id==='blink'){const from=point(pos,1);if(mastered)area({x:pos.x,z:pos.z},3,30*power,p.color,{push:2,element:'arcane',sourceId:id,poise:20});moveWithCollision(pos,-Math.sin(pos.yaw)*p.range,-Math.cos(pos.yaw)*p.range,world.colliders);emit({type:'blink',from,to:point(pos,1),color:p.color,yaw:pos.yaw});}
  else if(id==='fireball'||id==='frost'){const cp=Math.cos(pos.pitch);launch(point(pos,a.eye-.1),{x:-Math.sin(pos.yaw)*cp,y:Math.sin(pos.pitch),z:-Math.cos(pos.yaw)*cp},{speed:p.speed,range:p.range,damage:p.damage*power,radius:p.radius||0,freeze:p.freeze||0,color:p.color,spell:id,element:id==='frost'?'ice':'fire',burn:id==='fireball'?3:0,burnDamage:4*power,chill:4,pierce:id==='frost'&&mastered?2:0,embers:id==='fireball'&&mastered,poise:id==='fireball'?18:14});}
  else if(id==='lightning'){
   let target=facingTarget(p.range,.45),from=point(pos,a.eye);const seen=new Set();
   for(let i=0;i<(mastered?6:4)&&target;i++){seen.add(target.id);emit({type:'lightning',from,to:point(target,size(target).y),color:p.color});damage(target,p.damage*power*(1-i*.12),p.color,{freeze:.35,element:'storm',sourceId:id,poise:12});from=point(target,1);target=enemies.filter(e=>!e.dead&&!e.dormant&&!seen.has(e.id)&&distance(e,from)<7&&!segmentBlocked(from,e,world.colliders)).sort((a,b)=>distance(a,from)-distance(b,from))[0];}
   if(!seen.size)emit({type:'lightning',from,to:point(groundTarget(14),.3),color:p.color});
  }else if(id==='nova'||id==='roots'){
   const radius=p.radius+(id==='nova'&&mastered?2:0);area(pos,radius,p.damage*power,p.color,id==='roots'?{freeze:p.duration,bind:p.duration,sourceId:id,element:'nature',poison:mastered?5:0,poisonDamage:5*power,poise:6}:{push:3,sourceId:id,element:'arcane',poise:mastered?45:20});emit({type:id,...point(pos,.15),radius,color:p.color,duration:id==='roots'?2:.85});
  }else if(id==='meteor'){
   const target=groundTarget(p.range);zones.push({...target,id,remaining:1.05,radius:p.radius,damage:p.damage*power,color:p.color});emit({type:'meteor',...point(target,0),color:p.color,radius:p.radius,duration:1.05});
   if(mastered)[[1,3.2],[2,-3.2]].forEach(([n,off])=>{const q={x:target.x+Math.cos(pos.yaw)*off,z:target.z-Math.sin(pos.yaw)*off},delay=1.05+n*.25+(n-1)*.05;zones.push({...q,id,remaining:delay,radius:p.radius*.6,damage:p.damage*power*.5,color:p.color});emit({type:'meteor',...point(q,0),color:p.color,radius:p.radius*.6,duration:delay});});
  }else if(id==='blizzard'){
   const target=groundTarget(p.range);zones.push({...target,id,remaining:p.duration,tick:0,radius:p.radius,damage:p.damage*power,color:p.color,freezeEnd:mastered});emit({type:'blizzard',...point(target,0),color:p.color,radius:p.radius,duration:p.duration});
  }else if(id==='sunlance'){channel={id,slot,time:0,tick:0,from:null,end:null,targetId:null};emit({type:'channel-start',spell:id,color:p.color,...point(pos,a.eye)});updateChannel(0);
  }else if(id==='earthshatter'){
   const length=p.range*(mastered?1.3:1),yaw=Math.atan2(-Math.sin(pos.yaw),-Math.cos(pos.yaw)),ox=pos.x,oz=pos.z;
   const erupt=()=>{const line={shape:'line',x:ox,z:oz,yaw,length,width:p.width};emit({type:'earthshatter',x:ox,y:surfaceAt(ox,oz),z:oz,yaw,length,width:p.width,color:p.color});for(const e of enemies){if(e.dead||e.dormant||!inHazard(line,e,size(e).r*.6)||segmentBlocked({x:ox,z:oz},e,world.colliders))continue;if(damage(e,p.damage*power,p.color,{element:'earth',poise:p.poise,freeze:.8,sourceId:id})&&!e.boss&&!e.training&&!e.dead)moveWithCollision(e,Math.sin(yaw),Math.cos(yaw),world.colliders,.3);}};
   erupt();if(mastered)pending.push({at:clock+.5,fn:erupt});
  }else if(id==='thunderstorm'){
   const target=groundTarget(p.range),bolts=mastered?10:p.bolts;zones.push({...target,id,remaining:p.duration,tick:0,interval:p.duration/bolts,left:bolts,radius:p.radius,damage:p.damage*power,color:p.color});emit({type:'thunderstorm',...point(target,0),radius:p.radius,duration:p.duration,color:p.color});
  }else if(id==='siphon'){
   const target=facingTarget(p.range,.8);
   if(target){const before=target.health;damage(target,p.damage*power,p.color,{element:'shadow',sourceId:id,poise:12});const heal=Math.max(0,before-target.health)*p.heal,room=a.health-h.health;h.health=Math.min(a.health,h.health+heal);if(mastered&&heal>room){h.effects.ward=Math.max(h.effects.ward||0,6);h.shield=Math.min(150,h.shield+heal-room);}emit({type:'siphon',from:point(target,size(target).y),to:point(pos,1.2),color:p.color,amount:Math.round(heal)});}
   else emit({type:'siphon',from:point(groundTarget(10),.4),to:point(pos,1.2),color:p.color,miss:true});
  }
  changed();return{ok:true,message:p.name};
 }
 function arenaPoint(def,minFromPlayer=0){const p=state().position;for(let i=0;i<14;i++){const a=random()*Math.PI*2,r=Math.sqrt(random())*(def.arena-3),q={x:def.x+Math.cos(a)*r,z:def.z+Math.sin(a)*r};if(distance(q,p)>=minFromPlayer&&!blocksAt(q.x,q.z,world.colliders,.6))return q;}return{x:def.x,z:def.z};}
 function inArena(def,q,margin=2){const off=distance(q,def),max=def.arena-margin;return off<=max?q:{x:def.x+(q.x-def.x)*max/off,z:def.z+(q.z-def.z)*max/off};}
 const ownedAdds=e=>enemies.filter(o=>o.owner===e.id&&!o.dead).length;
 function startAttack(e,atk,step=0){
  const def=BOSSES[e.boss],p=state().position,spec=atk.shape==='sequence'?atk.steps[step]:atk,windup=spec.windup/(1+e.phase*.1)/(e.echo?ECHO.speed:1),might=e.echo?ECHO.damage:1;
  // Legends commit with a lunging turn of at most .9 rad, so flanking still pays.
  e.heading=turnToward(e.heading,Math.atan2(p.x-e.x,p.z-e.z),.9);
  e.attack={atk,step,spec,remaining:windup,total:windup};
  if(step===0)emit({type:'boss-cast',boss:e.boss,name:atk.name,attack:atk.id,color:def.color,...point(e,size(e).y*2)});
  const base={damage:(spec.damage||0)*might,parry:!!spec.parry,unblockable:!!spec.unblockable,status:spec.status||null,push:spec.push||0,style:e.boss,color:def.color};
  if(['cone','circle','ring','line'].includes(spec.shape)){let q={x:e.x,z:e.z};if(spec.at==='player')q=inArena(def,p,0);else if(spec.at==='front')q={x:e.x+Math.sin(e.heading)*(spec.offset||3),z:e.z+Math.cos(e.heading)*(spec.offset||3)};addHazard({...base,shape:spec.shape,...q,yaw:spec.rear?e.heading+Math.PI:e.heading,radius:spec.radius,inner:spec.inner,angle:spec.angle,length:spec.length,width:spec.width,delay:windup,owner:e.id});}
  else if(spec.shape==='charge')addHazard({...base,shape:'line',x:e.x,z:e.z,yaw:e.heading,length:spec.length,width:spec.width,delay:windup,owner:e.id,charge:true});
  else if(spec.shape==='rain')for(let i=0;i<(spec.count||5);i++){let q={x:p.x,z:p.z};if(i){const a=random()*Math.PI*2,r=1.5+random()*(spec.spread||6);q={x:p.x+Math.cos(a)*r,z:p.z+Math.sin(a)*r};}addHazard({...base,shape:'circle',...inArena(def,q,1),radius:spec.radius,delay:windup+i*.2,owner:null});}
  else if(spec.shape==='pool')for(let i=0;i<(spec.count||1);i++)addHazard({...base,damage:0,shape:'pool',...(spec.at==='arena'?arenaPoint(def):inArena(def,p,1)),radius:spec.radius,delay:windup,duration:spec.duration,tick:spec.tick,owner:null});
 }
 function finishAttack(e){const a=e.attack,spec=a.spec,def=BOSSES[e.boss],p=state().position;
  if(spec.shape==='volley'){const n=spec.countByPhase?.[e.phase]??spec.count??3;for(let i=0;i<n;i++)fireFoeShot(e,p,{angle:(i-(n-1)/2)*(spec.spread||.2),speed:spec.speed,damage:spec.damage*(e.echo?ECHO.damage:1),color:def.color,status:spec.status||null,parry:spec.parry!==false,element:spec.element,range:40});}
  else if(spec.shape==='summon'){const n=Math.max(0,Math.min(spec.count||2,4-ownedAdds(e)));for(let i=0;i<n;i++){const ang=e.heading+(i%2?1:-1)*(1.2+i*.3);let q={x:e.x+Math.sin(ang)*3.2,z:e.z+Math.cos(ang)*3.2};if(blocksAt(q.x,q.z,world.colliders,.4))q=arenaPoint(def);enemies.push(foe(spec.summon,'summon-'+serial++,q.x,q.z,{summon:true,owner:e.id,homeX:def.x,homeZ:def.z,leash:def.arena+10,attackTime:1.2}));emit({type:'summon',...point(q,.1),color:def.color});}}
  else if(spec.shape==='blink'){const from=point(e,1.5),q=arenaPoint(def,9);e.x=q.x;e.z=q.z;e.heading=Math.atan2(p.x-e.x,p.z-e.z);emit({type:'boss-blink',from,to:point(e,1.5),color:def.color});}
  if(a.atk.shape==='sequence'&&a.step+1<a.atk.steps.length){startAttack(e,a.atk,a.step+1);return;}
  e.attack=null;e.cooldown=(def.gap||1)*(1-.15*e.phase);}
 function resetBoss(e,announce){const def=BOSSES[e.boss];Object.assign(e,{health:e.maxHealth,poise:e.maxPoise,x:e.homeX,z:e.homeZ,phase:0,attack:null,engaged:false,resetIn:0,cooldown:1.5,ready:{},stagger:0,freeze:0,iceLock:0,chill:0,burn:0,burnTick:0,burnDamage:0,poison:0,poisonTick:0,poisonDamage:0,bind:0,slow:0,flash:0});
  for(const o of enemies)if(o.owner===e.id&&!o.dead){o.dead=true;o.deadAt=clock-10;}dropHazards(h=>h.owner===e.id||h.style===e.boss);for(let i=foeShots.length-1;i>=0;i--)if(foeShots[i].owner===e.id)foeShots.splice(i,1);
  const echo=e.echo;if(echo){e.echo=false;e.dead=true;}emit({type:'boss-reset',boss:e.boss,echo,...point(e,.1),color:def.color});if(announce)notify(echo?'The echo of '+def.name+' fades.':def.name+' withdraws, and its wounds close.');}
 function updateBoss(e,dt,s,safe){const def=BOSSES[e.boss],p=s.position;
  if(e.dormant){if(!bossRequirementsMet(e.boss,s.hero.bosses||[]))return;e.dormant=false;emit({type:'rift-open',boss:e.boss,...point(def,2),color:def.color});notify('The Old Stones stir. A rift has opened: '+def.name+', '+def.title+', waits within.');}
  const fromHome=distance(p,def);
  if(!e.engaged){e.health=Math.min(e.maxHealth,e.health+e.maxHealth*.08*dt);const home={x:e.homeX,z:e.homeZ},d=distance(e,home);if(d>.5){const heading=Math.atan2(home.x-e.x,home.z-e.z),step=Math.min(d,e.speed*dt);moveWithCollision(e,Math.sin(heading)*step,Math.cos(heading)*step,world.colliders,.6);e.heading=turnToward(e.heading,heading,def.turn*dt);}
   if(fromHome<def.arena&&!safe&&s.hero.health>0){e.engaged=true;e.resetIn=0;e.cooldown=1.2;e.heading=Math.atan2(p.x-e.x,p.z-e.z);emit({type:'boss-awaken',boss:e.boss,name:e.echo?'Echo of '+def.name:def.name,title:def.title,echo:!!e.echo,...point(e,.1),color:def.color,radius:def.arena});notify((e.echo?'The echo of '+def.name:def.name+', '+def.title)+', awakens!');}
   return;}
  if(fromHome>def.arena+16){e.resetIn+=dt;if(e.resetIn>4){resetBoss(e,true);return;}}else e.resetIn=0;
  while(e.phase<def.phases.length&&e.health/e.maxHealth<=def.phases[e.phase]){e.phase++;const line=def.lines?.[e.phase-1]||'';emit({type:'boss-phase',boss:e.boss,phase:e.phase,line,...point(e,size(e).y),color:def.color});if(line)notify(line);e.cooldown=Math.min(e.cooldown,.6);}
  if(e.stagger>0||e.freeze>0)return;
  if(e.attack){e.attack.remaining-=dt;if(e.attack.remaining<=0)finishAttack(e);return;}
  const dist=distance(e,p),face=Math.atan2(p.x-e.x,p.z-e.z);e.heading=turnToward(e.heading,face,def.turn*(1+.1*e.phase)*dt);
  const move=dist>def.keep+.6?1:def.hover&&dist<def.keep-3?-1:0;
  if(move){const step=e.speed*(e.slow>0?.6:1)*(1+.08*e.phase)*dt,dir=move>0?face:face+Math.PI,next={x:e.x,z:e.z};moveWithCollision(next,Math.sin(dir)*step,Math.cos(dir)*step,world.colliders,.6);const q=inArena(def,next);e.x=q.x;e.z=q.z;}
  e.cooldown-=dt;if(e.cooldown>0)return;
  const rear=behind(e,p,-.3),options=def.attacks.filter(a=>(a.phase||0)<=e.phase&&dist<=(a.max??99)&&dist>=(a.min||0)&&(a.when!=='behind'||rear)&&(a.shape!=='summon'||ownedAdds(e)<3)&&(e.ready[a.id]||0)<=clock);
  if(!options.length){e.cooldown=.25;return;}
  let roll=random()*options.reduce((t,a)=>t+(a.weight||1),0),pick=options[options.length-1];for(const a of options){roll-=a.weight||1;if(roll<=0){pick=a;break;}}
  e.ready[pick.id]=clock+(pick.cooldown||2)*(1-.12*e.phase);startAttack(e,pick);
 }
 function separate(p){const near=enemies.filter(e=>!e.dead&&!e.dormant&&!e.training&&!e.boss&&Math.abs(e.x-p.x)<40&&Math.abs(e.z-p.z)<40);for(let i=0;i<near.length;i++)for(let j=i+1;j<near.length;j++){const a=near[i],b=near[j],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);if(d<1e-4||d>=1.1)continue;const push=(1.1-d)*.5,nx=dx/d,nz=dz/d;for(const [e,sx,sz]of[[a,-nx,-nz],[b,nx,nz]])if(!e.freeze&&!e.iceLock&&!isSanctuary({x:e.x+sx*push,z:e.z+sz*push}))moveWithCollision(e,sx*push,sz*push,world.colliders,.3);}}
 function update(dt){
  if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);clock+=dt;downed=false;const s=state(),h=s.hero;if(day!==s.day){day=s.day;clear();spawn();}tickHero(h,dt);riposte=Math.max(0,riposte-dt);
  if(queued){if(clock>queued)queued=0;else if(!((h.cooldowns.attack||0)>0)){queued=0;attack();}}
  if(held)attack();
  if(motion){const step=Math.min(motion.left,motion.speed*dt);moveWithCollision(s.position,motion.dx*step,motion.dz*step,world.colliders);motion.left-=step;if(motion.left<=1e-6)motion=null;}
  for(let i=pending.length-1;i>=0;i--)if(clock>=pending[i].at){const job=pending.splice(i,1)[0];job.fn();if(downed)return;}
  const safe=isSanctuary(s.position);tickPlayer(dt,safe);if(downed)return;
  // Resolve spells before enemy strikes, so a landed freeze can interrupt a wind-up.
  updateChannel(dt);updateProjectiles(dt);updateZones(dt);updateFoeShots(dt);if(downed)return;updateHazards(dt);if(downed)return;
  if(h.effects.wisp>0){wispTimer-=dt;if(wispTimer<=0){wispTimer=spellRank(h,'wisp')===3?.62:1.25;const target=enemies.filter(e=>!e.dead&&!e.dormant&&!e.training&&distance(e,s.position)<20&&!segmentBlocked(s.position,e,world.colliders)).sort((a,b)=>distance(a,s.position)-distance(b,s.position))[0];if(target){emit({type:'lightning',from:point({x:s.position.x+Math.cos(clock*1.4),z:s.position.z+Math.sin(clock*1.4)},2.2),to:point(target,size(target).y),color:SPELLS.wisp.color,spirit:true});damage(target,SPELLS.wisp.damage*stats(h).magic*potency(h,'wisp'),SPELLS.wisp.color,{element:'arcane',sourceId:'wisp',poise:5});}}}
  for(const e of enemies){
   if(e.training&&e.resetIn>0){e.resetIn=Math.max(0,e.resetIn-dt);if(e.resetIn===0){Object.assign(e,{health:e.maxHealth,dead:false,freeze:0,iceLock:0,chill:0,burn:0,bind:0,slow:0,stagger:0,poise:e.maxPoise});emit({type:'training-reset',...point(e,.1),color:0x9ddfff});}}
   if(e.dead)continue;
   if(e.dormant){updateBoss(e,dt,s,safe);if(e.dormant)continue;}
   e.freeze=Math.max(0,(e.freeze||0)-dt);e.iceLock=Math.max(0,(e.iceLock||0)-dt);e.chill=Math.max(0,(e.chill||0)-dt);e.bind=Math.max(0,(e.bind||0)-dt);e.slow=Math.max(0,(e.slow||0)-dt);e.flash=Math.max(0,(e.flash||0)-dt);e.attackTime=Math.max(0,(e.attackTime||0)-dt);e.stagger=Math.max(0,(e.stagger||0)-dt);
   if(e.poiseRest>0)e.poiseRest=Math.max(0,e.poiseRest-dt);else if(e.maxPoise&&e.poise<e.maxPoise)e.poise=Math.min(e.maxPoise,e.poise+e.maxPoise*.35*dt);
   if(e.burn>0){const burning=Math.min(dt,e.burn);e.burn=Math.max(0,e.burn-dt);e.burnTick=(e.burnTick||0)+burning;while(e.burnTick>=1-1e-9){e.burnTick=Math.max(0,e.burnTick-1);damage(e,e.burnDamage,0xff9d57,{element:'ember',periodic:true,sourceId:'burn'});}if(e.burn===0){e.burnTick=0;e.burnDamage=0;}}
   if(e.poison>0&&!e.dead){const sick=Math.min(dt,e.poison);e.poison=Math.max(0,e.poison-dt);e.poisonTick=(e.poisonTick||0)+sick;while(e.poisonTick>=1-1e-9){e.poisonTick=Math.max(0,e.poisonTick-1);damage(e,e.poisonDamage,0x9be36b,{element:'poison',periodic:true,sourceId:'poison'});}if(e.poison===0){e.poisonTick=0;e.poisonDamage=0;}}
   if(e.training||e.dead)continue;
   if(e.boss){updateBoss(e,dt,s,safe);if(downed)return;continue;}
   const def=ENEMY_DEFS[e.kind]||{},ranged=e.ranged,d=distance(e,s.position),home={x:e.homeX,z:e.homeZ};
   const chase=!safe&&h.health>0&&d<(e.summon?40:21)&&distance(e,home)<(e.leash||32),reach=ranged?ranged.range:2.65+Math.max(0,size(e).r-.7);
   const canStrike=chase&&d<reach&&e.freeze===0&&!e.iceLock&&!(e.stagger>0)&&!segmentBlocked(e,s.position,world.colliders);
   if(e.windup>0){if(!canStrike){cancelStrike(e);continue;}e.windup=Math.max(0,e.windup-dt);if(e.windup===0){e.attackTime=def.cadence??1.1;emit({type:'telegraph',phase:'strike',targetId:e.id,...point(e,.08)});if(ranged)fireFoeShot(e,s.position,{range:ranged.range+12});else{hurtPlayer(e.damage,{source:e,parry:true});if(downed)return;}}continue;}
   if(canStrike&&e.attackTime<=0){e.windup=def.windup??(ranged?.7:.65);e.windupTotal=e.windup;e.heading=Math.atan2(s.position.x-e.x,s.position.z-e.z);emit({type:'telegraph',phase:'start',targetId:e.id,...point(e,.08),duration:e.windup,radius:ranged?.9:def.reach??1.25});continue;}
   let dest=null,stop=1.7;
   if(chase){if(ranged&&d<ranged.keep){const away=Math.atan2(e.x-s.position.x,e.z-s.position.z);dest={x:e.x+Math.sin(away)*3,z:e.z+Math.cos(away)*3};stop=.3;}else if(ranged&&d<reach*.9)dest=null;else if(!ranged&&d<2.6&&e.attackTime>.25){const ang=Math.atan2(e.x-s.position.x,e.z-s.position.z)+e.orbit*.9;dest={x:s.position.x+Math.sin(ang)*2.2,z:s.position.z+Math.cos(ang)*2.2};stop=.3;}else dest=s.position;}
   else dest={x:e.homeX+Math.cos(clock*.15+(e.wander||0))*2,z:e.homeZ+Math.sin(clock*.15+(e.wander||0))*2};
   if(dest&&e.freeze===0&&!e.iceLock&&!(e.stagger>0)&&distance(e,dest)>stop){const heading=Math.atan2(dest.x-e.x,dest.z-e.z),step=e.speed*(e.slow?.35:1)*dt,next={x:e.x,z:e.z};moveWithCollision(next,Math.sin(heading)*step,Math.cos(heading)*step,world.colliders,.34);if(!isSanctuary(next)){e.x=next.x;e.z=next.z;}e.heading=chase?Math.atan2(s.position.x-e.x,s.position.z-e.z):heading;}
   else if(chase&&!e.freeze&&!e.iceLock&&!(e.stagger>0))e.heading=Math.atan2(s.position.x-e.x,s.position.z-e.z);
  }
  separate(s.position);
  for(let i=enemies.length-1;i>=0;i--){const o=enemies[i];if(o.summon&&o.dead&&clock-(o.deadAt||0)>2)enemies.splice(i,1);}
 }
 // A fallen legend's echo can be called back to its lair once per day for a stronger rematch.
 function summonEcho(key){const s=state(),h=s.hero,def=BOSSES[key],e=bosses.find(b=>b.boss===key);if(!def||!e)return{ok:false,message:'No legend sleeps here.'};if(!h.bosses.includes(key))return{ok:false,message:def.name+' still lives.'};if(!e.dead)return{ok:false,message:'The echo already stirs.'};if(h.echoes?.[key]===s.day)return{ok:false,message:'The echo of '+def.name+' rests until tomorrow.'};
  const health=Math.round(def.health*ECHO.health),poise=Math.round(def.poise*1.2);Object.assign(e,{dead:false,echo:true,dormant:false,health,maxHealth:health,poise,maxPoise:poise,x:def.x,z:def.z,heading:0,phase:0,attack:null,engaged:false,cooldown:1.5,ready:{},resetIn:0,stagger:0,freeze:0,iceLock:0,chill:0,burn:0,burnTick:0,burnDamage:0,poison:0,poisonTick:0,poisonDamage:0,bind:0,slow:0,flash:0});
  emit({type:'echo-summon',boss:key,...point(def,.1),color:def.color});return{ok:true,message:'The echo of '+def.name+' gathers. Stand fast.'};}
 function practice(){const s=state();if(distance(s.position,TRAINING.focus)>3.2)return{ok:false,message:'Approach the blue focus stone in Eldermere.'};s.hero.mana=stats(s.hero).mana;for(const key of Object.keys(SPELLS))s.hero.cooldowns[key]=0;emit({type:'focus',...point(TRAINING.focus,.5),color:0xa9dfff,radius:2});changed();return{ok:true,message:'Focus restored · full mana and spells ready. Training targets grant no rewards.'};}
 buildBosses();spawn();
 return{enemies,projectiles,zones,foeShots,hazards,attack,heavy,pressAttack,releaseAttack,dodge,cast,stopChannel,update,clear,practice,summonEcho,
  reset(){clear();day=state().day;buildBosses();spawn();},
  setHeld(value){held=!!value;if(!value)charge=null;},setBlocking(value){if(value&&!blocking)guardStart=clock;blocking=!!value;},
  get blocking(){return blocking;},get player(){return state().position;},target(){return facingTarget(30,.96);},
  aim(){const h=state().hero,id=h.slots[h.selected],p=SPELLS[id];return ['meteor','blizzard','thunderstorm'].includes(id)?{...point(groundTarget(p.range),.08),radius:p.radius,color:p.color}:null;},
  get clock(){return clock;},get bosses(){return bosses;},get boss(){const p=state().position;let best=null;for(const b of bosses)if(b.engaged&&!b.dead&&(!best||distance(b,p)<distance(best,p)))best=b;return best;},
  get charging(){return !!charge;},get charge(){if(!charge)return 0;const t=clock-charge.start;return t<.15?0:Math.min(1,t/CHARGE.full);},get chargeReady(){return !!charge&&clock-charge.start>=CHARGE.min;},
  get combo(){return clock<=comboUntil?combo:-1;},get dodging(){return !!motion;},get evading(){return clock<evadeUntil;},get riposte(){return riposte;},get channel(){return channel;}};
}
