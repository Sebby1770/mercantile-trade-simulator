/** Legends of the Wild (v6): progression, migration, deep melee, defence, legends, new spells and the wider valley. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../web/vendor/three.module.js';
import {GOODS,freshState,parseSave,nextDay,WAYSTONE_IDS,REGION_IDS} from '../web/realm/economy.js';
import {ARCHETYPES,WEAPONS,SPELLS,ENEMY_DEFS,freshHero,migrateHero,stats,chooseArchetype,assignSpell,equipWeapon,upgradeSpell,spellRank,potency,rewardKill,rewardBoss,validHero,drinkPotion} from '../web/realm/rpg.js';
import {BOSSES,BOSS_KEYS,bossRequirementsMet,inHazard} from '../web/realm/bosses.js';
import {createCombat,ENCOUNTERS,isSanctuary,PARRY_WINDOW,DODGE,CHARGE} from '../web/realm/combat.js';
import {createWorld,TOWNS,ROADS,WAYSTONES,REGIONS,POOLS,BRIDGES,TARN,RIVER,WORLD_LIMIT,heightAt,surfaceAt,biomeAt,terrainAt,blocksAt,moveWithCollision} from '../web/realm/world.js';

const lcg=(seed=7)=>()=>(seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296;
const near=(a,b,eps=1e-6,msg='')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=eps*Math.max(1,Math.abs(b)),`${msg} ${a} ≈ ${b}`);
const nearAbs=(a,b,eps,msg='')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=eps,`${msg} ${a} ≈ ${b} ± ${eps}`);
function advance(c,seconds,dt=.05){for(let i=0;i<Math.round(seconds/dt);i++)c.update(dt);}
// Regular foes are removed so each test controls exactly who fights; legends stay (they live far from the test ground).
function setup({archetype='human',x=0,z=-60,yaw=0,pitch=0,stamina=null,random=lcg(),world={colliders:[]},keep=false}={}){const s=freshState();chooseArchetype(s,archetype);s.position={x,z,yaw,pitch};const events=[],notes=[],flags={defeats:0};const c=createCombat({state:()=>s,world,emit:e=>events.push(e),notify:m=>notes.push(m),onDefeat:()=>flags.defeats++,stamina,random});if(!keep)c.enemies.splice(0,c.enemies.length,...c.enemies.filter(e=>e.boss));return{s,h:s.hero,c,events,notes,flags,world};}
let serial=100;
function foe(kind,x,z,over={}){const d=ENEMY_DEFS[kind];return{...d,id:'hostile-'+serial++,kind,name:d.name,health:1000,maxHealth:1000,x,z,homeX:x,homeZ:z,heading:0,dead:false,freeze:100,iceLock:0,chill:0,burn:0,burnTick:0,burnDamage:0,poison:0,poisonDamage:0,bind:0,slow:0,stagger:0,windup:0,windupTotal:0,attackTime:100,flash:0,speed:0,poise:1000,maxPoise:1000,...over};}
const boss=(f,k)=>f.c.enemies.find(e=>e.boss===k);
const of=(f,type)=>f.events.filter(e=>e.type===type);
const hitsOn=(f,e)=>f.events.filter(v=>v.type==='hit'&&v.targetId===e.id);
const meleeBase=h=>{const a=stats(h);return WEAPONS[h.equipped].damage*a.power*a.melee;};
function cast(f,id,slot=0){f.h.cooldowns[id]=0;f.h.mana=stats(f.h).mana;assert.equal(assignSpell(f.s,slot,id).ok,true,id);f.h.selected=slot;const r=f.c.cast(slot);assert.equal(r.ok,true,id);return r;}
function untilEvent(f,pred,seconds=5){for(let i=0;i<seconds/.05;i++){const e=f.events.find(pred);if(e)return e;f.c.update(.05);}return f.events.find(pred);}

// ---------------------------------------------------------------- progression and saves
test('pre-legends saves migrate: v1 heroes earn skill points, Frostwatch stock and a home waystone appear',()=>{
 const s=freshState();chooseArchetype(s,'human');s.coins=432;s.stock.eldermere.grain=17;s.inventory.herbs=3;s.costBasis.herbs=30;
 const h=s.hero;h.level=5;h.xp=10;h.health=150;h.version=1;delete h.points;delete h.ranks;delete h.bosses;delete s.stock.frostwatch;delete s.waystones;delete s.regions;
 const loaded=parseSave(JSON.stringify(s));assert.ok(loaded,'an old save still loads');
 assert.deepEqual(loaded.stock.frostwatch,Object.fromEntries(Object.keys(GOODS).map((g,i)=>[g,28+i*3])));
 assert.deepEqual(loaded.waystones,['eldermere']);assert.deepEqual(loaded.regions,[]);
 assert.equal(loaded.hero.version,2);assert.equal(loaded.hero.points,4);assert.deepEqual(loaded.hero.ranks,{});assert.deepEqual(loaded.hero.bosses,[]);
 assert.equal(loaded.coins,432);assert.equal(loaded.stock.eldermere.grain,17);assert.equal(loaded.inventory.herbs,3);assert.equal(loaded.hero.level,5);assert.equal(loaded.hero.health,150);assert.equal(validHero(loaded.hero),true);
 assert.deepEqual(parseSave(JSON.stringify(loaded)),loaded,'migrated saves round trip');
 const novice=freshHero();novice.version=1;delete novice.points;delete novice.ranks;delete novice.bosses;migrateHero(novice);assert.equal(novice.points,0);assert.equal(validHero(novice),true);
 const current=freshHero();current.points=7;current.ranks={fireball:2};assert.equal(migrateHero(current).points,7);assert.deepEqual(current.ranks,{fireball:2});
 for(const mutate of [s=>s.waystones=['atlantis'],s=>s.waystones=['eldermere','eldermere'],s=>s.regions=['moon'],s=>s.regions='frost',s=>s.hero.bosses=['dragon'],s=>s.hero.bosses=['frost','frost'],s=>s.hero.ranks={fireball:4},s=>s.hero.ranks={nope:2},s=>s.hero.points=-1,s=>s.hero.points=1.5,s=>s.hero.effects.poison=61,s=>s.position.x=301]){const bad=freshState();chooseArchetype(bad,'wizard');mutate(bad);assert.equal(parseSave(JSON.stringify(bad)),null,String(mutate));}
 const frontier=freshState();frontier.waystones=[...WAYSTONE_IDS];frontier.regions=[...REGION_IDS];frontier.position={x:-290,z:290,yaw:0,pitch:0};assert.deepEqual(parseSave(JSON.stringify(frontier)),frontier);});

test('skill points buy spell ranks at rising cost up to mastery, atomically',()=>{
 const s=freshState();chooseArchetype(s,'human');const h=s.hero;assert.equal(h.points,0);assert.equal(spellRank(h,'fireball'),1);assert.equal(potency(h,'fireball'),1);
 let before=JSON.stringify(s);assert.equal(upgradeSpell(s,'fireball').ok,false);assert.equal(JSON.stringify(s),before,'no points, no change');
 h.points=3;assert.equal(upgradeSpell(s,'fireball').ok,true);assert.equal(h.points,2);assert.equal(spellRank(h,'fireball'),2);assert.equal(potency(h,'fireball'),1.25);
 const mastered=upgradeSpell(s,'fireball');assert.equal(mastered.ok,true);assert.ok(mastered.message.includes(SPELLS.fireball.mastery));assert.equal(h.points,0);assert.equal(spellRank(h,'fireball'),3);assert.equal(potency(h,'fireball'),1.5);
 h.points=5;before=JSON.stringify(s);assert.equal(upgradeSpell(s,'fireball').ok,false,'rank 3 is the cap');assert.equal(JSON.stringify(s),before);
 h.points=1;assert.equal(upgradeSpell(s,'heal').ok,true);before=JSON.stringify(s);h.points=1;before=JSON.stringify(s);assert.equal(upgradeSpell(s,'heal').ok,false,'rank 3 costs two points');assert.equal(JSON.stringify(s),before);
 for(const bad of ['meteor','constructor','__proto__','toString','missing',undefined]){h.points=9;const b=JSON.stringify(s);assert.equal(upgradeSpell(s,bad).ok,false,String(bad));assert.equal(JSON.stringify(s),b);}
 assert.equal(validHero(h),true);assert.deepEqual(parseSave(JSON.stringify(s)).hero.ranks,{fireball:3,heal:2});
 const points=h.points,r=rewardKill(s,{id:'hostile-0',coin:0,xp:75});assert.equal(r.levels,1);assert.equal(h.points,points+1,'each level earns a skill point');
 for(const id of Object.keys(ARCHETYPES))for(const spell of ARCHETYPES[id].spells){assert.ok(SPELLS[spell],spell);assert.equal(typeof SPELLS[spell].mastery,'string',spell);}});

test('legend rewards pay once, grant the legendary weapon, sigil, points and boons',()=>{
 const s=freshState();chooseArchetype(s,'human');const h=s.hero;
 const r=rewardBoss(s,'frost');assert.equal(r.rewarded,true);assert.equal(r.weapon,'frostfang');assert.equal(r.sigil,'Sigil of Winter');assert.ok(h.weapons.includes('frostfang'));assert.deepEqual(h.bosses,['frost']);assert.equal(s.coins,120+BOSSES.frost.coin);assert.equal(h.points,BOSSES.frost.points+r.levels);
 assert.equal(stats(h).health,ARCHETYPES.human.health+(h.level-1)*9+12);near(stats(h).power,1+(h.level-1)*.075+.03);assert.equal(h.health,stats(h).health);
 let before=JSON.stringify(s);assert.equal(rewardBoss(s,'frost').rewarded,false);assert.equal(JSON.stringify(s),before);
 for(const bad of ['constructor','dragon','__proto__']){before=JSON.stringify(s);assert.equal(rewardBoss(s,bad).rewarded,false);assert.equal(JSON.stringify(s),before);}
 assert.equal(bossRequirementsMet('frost',[]),true);assert.equal(bossRequirementsMet('hollow',['frost','mire']),false);assert.equal(bossRequirementsMet('hollow',['cinder','frost','mire']),true);
 for(const k of ['mire','cinder','hollow'])assert.equal(rewardBoss(s,k).weapon,BOSSES[k].weapon);assert.deepEqual([...h.bosses].sort(),[...BOSS_KEYS].sort());assert.equal(validHero(h),true);assert.deepEqual(parseSave(JSON.stringify(s)).hero,h);
 for(const k of BOSS_KEYS)assert.equal(WEAPONS[BOSSES[k].weapon].legendary,k);});

test('inHazard resolves circle, ring, cone, line and pool shapes with a body pad',()=>{
 const circle={shape:'circle',x:0,z:0,radius:3};assert.equal(inHazard(circle,{x:0,z:3.2}),true);assert.equal(inHazard(circle,{x:0,z:3.4}),false);assert.equal(inHazard(circle,{x:0,z:3.2},0),false);
 const pool={shape:'pool',x:5,z:5,radius:2};assert.equal(inHazard(pool,{x:6,z:6}),true);assert.equal(inHazard(pool,{x:8,z:5}),false);
 const ring={shape:'ring',x:0,z:0,inner:4,radius:10};for(const [d,inside]of [[2,false],[3.7,true],[6,true],[10.3,true],[11,false]])assert.equal(inHazard(ring,{x:d,z:0}),inside,'ring '+d);
 const cone={shape:'cone',x:0,z:0,yaw:0,radius:6,angle:.5};for(const [p,inside]of [[{x:0,z:5},true],[{x:0,z:-5},false],[{x:5*Math.sin(.4),z:5*Math.cos(.4)},true],[{x:5*Math.sin(.7),z:5*Math.cos(.7)},false],[{x:0,z:-1},true],[{x:0,z:6.3},true],[{x:0,z:6.5},false]])assert.equal(inHazard(cone,p),inside,'cone '+JSON.stringify(p));
 const east={...cone,yaw:Math.PI/2};assert.equal(inHazard(east,{x:5,z:0}),true);assert.equal(inHazard(east,{x:0,z:5}),false);
 const line={shape:'line',x:0,z:0,yaw:0,length:10,width:2};for(const [p,inside]of [[{x:0,z:5},true],[{x:1.2,z:5},true],[{x:1.5,z:5},false],[{x:0,z:-.3},true],[{x:0,z:-1},false],[{x:0,z:10.3},true],[{x:0,z:11},false]])assert.equal(inHazard(line,p),inside,'line '+JSON.stringify(p));
 assert.equal(inHazard({...line,yaw:Math.PI/2},{x:5,z:0}),true);assert.equal(inHazard({...line,yaw:Math.PI/2},{x:0,z:5}),false);assert.equal(inHazard({shape:'volley',x:0,z:0},{x:0,z:0}),false);
 for(const k of BOSS_KEYS)for(const a of BOSSES[k].attacks)assert.ok(['cone','circle','ring','line','rain','pool','volley','summon','blink','charge','sequence'].includes(a.shape),k+' '+a.id);});

// ---------------------------------------------------------------- roster
test('encounter ids stay stable while new camps and four legends join the roster',()=>{
 const f=setup({keep:true});assert.equal(ENCOUNTERS.length,15);assert.equal(ENCOUNTERS[2].name,'Whispering stones');assert.deepEqual([ENCOUNTERS[2].x,ENCOUNTERS[2].z],[-40,-118]);
 const hostile=f.c.enemies.filter(e=>/^hostile-\d+$/.test(e.id));assert.equal(hostile.length,ENCOUNTERS.reduce((n,c)=>n+c.kinds.length,0));
 let i=0;for(const camp of ENCOUNTERS)for(const kind of camp.kinds){assert.ok(ENEMY_DEFS[kind],kind);const id='hostile-'+i++;assert.equal(hostile.find(e=>e.id===id)?.kind,kind,id);}
 for(const k of BOSS_KEYS){const b=boss(f,k);assert.ok(b,k);assert.equal(b.id,BOSSES[k].id);assert.equal(b.kind,BOSSES[k].kind);assert.equal(b.maxHealth,BOSSES[k].health);assert.equal(b.health,b.maxHealth);assert.equal(!!b.dead,false);assert.equal(!!b.dormant,k==='hollow');assert.ok(!b.engaged);}
 for(const e of f.c.enemies)for(const key of ['x','z','health','maxHealth'])assert.ok(Number.isFinite(e[key]),e.id+' '+key);
 assert.equal(f.c.boss,null);assert.equal(f.c.combo,-1);assert.equal(f.c.charge,0);assert.equal(f.c.charging,false);assert.equal(f.c.dodging,false);assert.equal(f.c.evading,false);assert.equal(f.c.channel,null);assert.ok(!(f.c.riposte>0));
 for(const key of ['foeShots','hazards','projectiles','zones'])assert.ok(Array.isArray(f.c[key]),key);
 assert.equal(isSanctuary({x:-8,z:-200}),true);assert.equal(PARRY_WINDOW,.25);assert.deepEqual(DODGE,{distance:4.6,time:.28,iframes:.34,stamina:22,cooldown:.45});assert.deepEqual(CHARGE,{min:.45,full:1.1});});

// ---------------------------------------------------------------- melee
test('light melee chains a three-step combo whose finisher hits harder, and backstabs crit',()=>{
 const f=setup(),e=foe('goblin',0,-62);f.c.enemies.push(e);const base=meleeBase(f.h),swing=()=>of(f,'swing').at(-1);
 let hp=e.health;assert.equal(f.c.attack().ok,true);assert.equal(swing().combo,0);assert.equal(swing().heavy,false);near(hp-e.health,base);assert.equal(f.c.combo,0);assert.ok(of(f,'impact-melee').length===1);
 advance(f.c,.6);hp=e.health;f.c.attack();assert.equal(swing().combo,1);near(hp-e.health,base);assert.equal(f.c.combo,1);
 advance(f.c,.6);hp=e.health;f.c.attack();assert.equal(swing().combo,2);near(hp-e.health,base*1.45,1e-6,'finisher');assert.equal(f.c.combo,2);
 e.x=0;e.z=-62;advance(f.c,.6);f.c.attack();assert.equal(swing().combo,0,'the chain wraps after the finisher');
 advance(f.c,.6);f.c.attack();assert.equal(swing().combo,1);advance(f.c,1.4);assert.equal(f.c.combo,-1,'the window closes');f.c.attack();assert.equal(swing().combo,0);
 const g=setup(),back=foe('goblin',0,-62,{heading:Math.PI});g.c.enemies.push(back);hp=back.health;g.c.attack();near(hp-back.health,meleeBase(g.h)*1.35,1e-6,'backstab');const hit=hitsOn(g,back).at(-1);assert.equal(hit.tag,'BACKSTAB');assert.equal(hit.crit,true);
 const miss=setup();miss.c.enemies.push(foe('goblin',0,-66));miss.c.attack();assert.equal(of(miss,'impact-melee').length,0,'no impact when nothing is struck');});

test('overload: storm on a burning foe detonates once and splashes neighbours',()=>{
 const f=setup({archetype:'wizard'}),a=foe('goblin',0,-64,{burn:3,burnDamage:4,burnTick:0}),b=foe('goblin',2,-64);f.c.enemies.push(a,b);const power=stats(f.h).power*stats(f.h).magic;
 cast(f,'lightning');const overload=of(f,'combo').filter(e=>e.combo==='overload');assert.equal(overload.length,1);assert.equal(overload[0].color,0xffd27a);assert.equal(a.burn,0,'overload consumes the burn');
 near(1000-a.health,SPELLS.lightning.damage*power*1.35,1e-6,'overloaded target');assert.ok(1000-b.health>SPELLS.lightning.damage*power*.88+10,'neighbour takes chain damage plus the arcane splash');
 cast(f,'lightning');cast(f,'fireball');advance(f.c,.3);assert.equal(of(f,'combo').filter(e=>e.combo==='overload').length,1,'no burn, no second overload');assert.equal(of(f,'combo').length,1,'fire on a burning foe is not a combo');});

test('poise breaks into a stagger that amplifies damage, then regenerates',()=>{
 const f=setup(),e=foe('goblin',0,-62,{freeze:0,poise:ENEMY_DEFS.goblin.poise,maxPoise:ENEMY_DEFS.goblin.poise});f.c.enemies.push(e);let last=e.poise;
 for(let i=0;i<10&&!of(f,'stagger').length;i++){e.x=0;e.z=-62;f.c.attack();if(!of(f,'stagger').length){assert.ok(e.poise<last,'poise falls with every blow');last=e.poise;}advance(f.c,.6);}
 const st=of(f,'stagger');assert.equal(st.length,1);assert.equal(st[0].boss,false);assert.ok(e.stagger>.5&&e.stagger<=1.6);assert.ok(e.freeze>0,'staggered foes cannot act');assert.ok(e.poise>ENEMY_DEFS.goblin.poise*.5,'poise refills once broken');
 e.x=0;e.z=-62;const hp=e.health;f.c.attack();const sw=of(f,'swing').at(-1),hit=hitsOn(f,e).at(-1);assert.equal(hit.crit,true);near(hp-e.health,meleeBase(f.h)*(sw.combo===2?1.45:1)*1.3,1e-6,'staggered bonus');
 advance(f.c,7);assert.ok(!(e.stagger>0));assert.equal(e.poise,e.maxPoise,'poise regenerates after resting');});

test('heavy attacks: charge thresholds, damage scaling, stamina and cancellation',()=>{
 const run=(hold,pool=100)=>{const stamina={stamina:pool},f=setup({stamina}),e=foe('goblin',0,-62);f.c.enemies.push(e);f.c.pressAttack();assert.equal(f.c.charging,true);const t0=f.c.clock;advance(f.c,hold);const t=f.c.clock-t0,charge=f.c.charge;f.c.releaseAttack();return{f,e,t,charge,stamina,base:meleeBase(f.h)};};
 const tap=run(.1);assert.equal(tap.charge,0,'the meter appears only after .15 s');const tapSwing=of(tap.f,'swing');assert.equal(tapSwing.length,1);assert.equal(tapSwing[0].heavy,false);near(1000-tap.e.health,tap.base);assert.equal(tap.stamina.stamina,100);assert.equal(tap.f.c.charging,false);
 const low=run(.5);const lowSwing=of(low.f,'swing').at(-1);assert.equal(lowSwing.heavy,true);assert.equal(lowSwing.move,'rising');assert.ok(low.charge>0&&low.charge<1);
 near(1000-low.e.health,low.base*WEAPONS.sword.heavy.mult*(.7+.3*Math.min(1,(low.t-CHARGE.min)/(CHARGE.full-CHARGE.min))),1e-6,'minimum heavy');near(low.stamina.stamina,76);near(low.f.h.cooldowns.attack,WEAPONS.sword.cooldown*1.15);assert.equal(low.f.c.combo,-1,'heavy blows reset the combo');
 const full=run(1.3);assert.ok(full.charge>=.999);near(1000-full.e.health,full.base*WEAPONS.sword.heavy.mult,1e-6,'full heavy');
 const winded=run(.6,10);assert.ok(winded.f.notes.some(n=>/winded/i.test(n)));const ws=of(winded.f,'swing');assert.equal(ws.length,1);assert.equal(ws[0].heavy,false);near(1000-winded.e.health,winded.base);assert.equal(winded.stamina.stamina,10);
 const f=setup(),e=foe('goblin',0,-62);f.c.enemies.push(e);f.c.pressAttack();advance(f.c,.3);assert.ok(f.c.charge>0);f.c.setHeld(false);assert.equal(f.c.charging,false);assert.equal(f.c.charge,0);f.c.releaseAttack();assert.equal(of(f,'swing').length,0);assert.equal(e.health,1000);
 const g=setup();g.c.pressAttack();advance(g.c,.2);g.c.dodge({x:1,z:0});assert.equal(g.c.charging,false,'dodging cancels a charge');
 const staff=setup({archetype:'wizard'});staff.c.pressAttack();assert.equal(staff.c.charging,false,'weapons without a heavy fire at once');assert.equal(of(staff,'swing').length,1);staff.c.setHeld(false);});

test('frostfang heavy strikes loose a piercing frost wave',()=>{
 const f=setup();f.h.weapons.push('frostfang');assert.equal(equipWeapon(f.s,'frostfang').ok,true);const close=foe('goblin',0,-62),mid=foe('goblin',0,-67),far=foe('goblin',0,-71);f.c.enemies.push(close,mid,far);
 f.c.pressAttack();advance(f.c,.7);f.c.releaseAttack();const wave=f.c.projectiles.find(p=>p.wave==='ice');assert.ok(wave,'a crescent is launched');assert.equal(wave.pierce,5);
 advance(f.c,1.2);for(const e of [close,mid,far])assert.ok(e.health<1000,e.id);for(const e of [mid,far])assert.ok(hitsOn(f,e).some(h=>h.element==='ice'),e.id);assert.ok(close.chill>0||mid.chill>0);});

// ---------------------------------------------------------------- defence
test('parrying inside the window negates the blow, grants a riposte and staggers the attacker',()=>{
 const f=setup(),e=foe('goblin',0,-62,{freeze:0,attackTime:0});f.c.enemies.push(e);const hp=f.h.health;f.c.update(.05);assert.ok(e.windup>0);
 for(let i=0;i<40&&e.windup>.16;i++)f.c.update(.05);f.c.setBlocking(true);for(let i=0;i<8&&!f.events.some(v=>v.type==='parry'||v.type==='hurt');i++)f.c.update(.05);
 assert.equal(of(f,'parry').length,1);assert.equal(f.h.health,hp);assert.ok(f.c.riposte>1.2&&f.c.riposte<=1.6);assert.ok(e.stagger>0,'the attacker reels');
 f.c.setBlocking(false);const before=e.health;f.c.attack();const hit=hitsOn(f,e).at(-1);assert.equal(hit.tag,'RIPOSTE');assert.equal(hit.crit,true);assert.ok(before-e.health>=meleeBase(f.h)*1.8-1e-6);assert.ok(!(f.c.riposte>0),'the riposte is spent');});

test('guarding outside the parry window costs stamina and breaks when winded',()=>{
 for(const [pool,broken]of [[100,false],[1,true]]){const stamina={stamina:pool},f=setup({stamina}),e=foe('goblin',0,-62,{freeze:0,attackTime:0});f.c.enemies.push(e);const hp=f.h.health,armor=stats(f.h).armor;
  f.c.update(.05);f.c.setBlocking(true);advance(f.c,.8);assert.equal(of(f,'parry').length,0);const lost=hp-f.h.health;
  if(broken){assert.equal(of(f,'guard-break').length,1);assert.equal(stamina.stamina,0);near(lost,12*armor);}
  else{assert.equal(of(f,'guard-break').length,0);near(stamina.stamina,100-12*.55);near(lost,12*armor*.35);assert.ok(of(f,'guard').some(g=>g.absorbed>0));}}});

test('foe shots hurt with status, can be parried back at their owner, and dodged',()=>{
 const shot=(f,owner,d=1.5)=>{const p=f.s.position;f.c.foeShots.push({id:'foe-900',x:p.x,y:surfaceAt(p.x,p.z-d)+1.1,z:p.z-d,dx:0,dy:0,dz:1,speed:15,life:3,damage:14,color:0x9be36b,status:{slow:1.2},owner:owner.id,parry:true,element:'nature'});};
 const a=setup(),ha=foe('hexer',0,-72);a.c.enemies.push(ha);const hp=a.h.health;shot(a,ha);advance(a.c,.3);near(hp-a.h.health,14*stats(a.h).armor);assert.ok(a.h.effects.chill>0,'slowing bolts chill the hero');assert.equal(a.c.foeShots.length,0);
 const b=setup(),hb=foe('hexer',0,-72);b.c.enemies.push(hb);b.c.setBlocking(true);shot(b,hb);advance(b.c,.1);assert.equal(of(b,'parry').length,1);assert.equal(of(b,'reflect').length,1);assert.equal(b.h.health,stats(b.h).health);assert.equal(b.c.foeShots.length,0);
 const back=b.c.projectiles.find(p=>p.weapon==='reflect');assert.ok(back,'the bolt flies back');near(back.damage,14*2.2);assert.ok(b.c.riposte>0);advance(b.c,1.5);assert.ok(hb.health<1000,'the reflected bolt strikes its caster');
 const walls={colliders:[{x1:.36,x2:1,z1:-70,z2:-50},{x1:-1,x2:-.36,z1:-70,z2:-50}]},c=setup({world:walls}),hc=foe('hexer',0,-72);c.c.enemies.push(hc);shot(c,hc);c.c.dodge({x:1,z:0});advance(c.c,.6);
 const ev=of(c,'evade');assert.equal(ev.length,1,'an evaded bolt passes through without a second hit');assert.equal(ev[0].perfect,true);assert.equal(c.h.health,stats(c.h).health);assert.ok(c.c.riposte>0);});

test('dodging moves the hero, spends stamina and grants i-frames with a perfect-dodge riposte',()=>{
 const stamina={stamina:100},f=setup({stamina});f.c.dodge({x:3,z:4});assert.equal(of(f,'dodge').length,1);assert.equal(stamina.stamina,100-DODGE.stamina);assert.equal(f.c.dodging,true);assert.equal(f.c.evading,true);
 f.c.dodge({x:-1,z:0});assert.equal(of(f,'dodge').length,1,'no dodge while dodging');advance(f.c,.4);assert.equal(f.c.dodging,false);assert.equal(f.c.evading,false);nearAbs(f.s.position.x,.6*DODGE.distance,.3);nearAbs(f.s.position.z,-60+.8*DODGE.distance,.3);
 advance(f.c,1);const from={...f.s.position};f.c.dodge({x:0,z:0});advance(f.c,.4);nearAbs(f.s.position.z-from.z,DODGE.distance,.3,'no input dodges backwards');nearAbs(f.s.position.x,from.x,.05);
 const tired={stamina:10},g=setup({stamina:tired});g.c.dodge({x:1,z:0});assert.equal(of(g,'dodge').length,0);assert.equal(tired.stamina,10);assert.ok(g.notes.length>0);assert.deepEqual([g.s.position.x,g.s.position.z],[0,-60]);
 // Walls pin the hero in place so the strike lands during (or after) the dodge's invulnerability.
 for(const [lead,outcome]of [[.1,'perfect'],[.25,'late'],[.45,'hit']]){const world={colliders:[{x1:.36,x2:1,z1:-70,z2:-50},{x1:-1,x2:-.36,z1:-70,z2:-50}]},h=setup({world}),e=foe('goblin',0,-62,{freeze:0,attackTime:0});h.c.enemies.push(e);const hp=h.h.health;h.c.update(.05);
  for(let i=0;i<40&&e.windup>lead+.01;i++)h.c.update(.05);h.c.dodge({x:1,z:0});advance(h.c,.6);const ev=of(h,'evade');
  if(outcome==='hit'){assert.equal(ev.length,0);near(hp-h.h.health,12*stats(h.h).armor);}
  else{assert.equal(ev.length,1,outcome);assert.equal(ev[0].perfect,outcome==='perfect');assert.equal(h.h.health,hp);assert.equal(h.c.riposte>0,outcome==='perfect');}}});

test('player ailments tick, lava burns, grace protects and potions cleanse',()=>{
 const f=setup(),hp=f.h.health;f.h.effects.poison=3;advance(f.c,1);const lost=hp-f.h.health;assert.ok(lost>3&&lost<6,'poison 5/s through armour');
 const g=setup({world:{colliders:[],terrainAt:()=>'lava'}});const ghp=g.h.health;advance(g.c,1);assert.ok(ghp-g.h.health>12,'standing in lava hurts');assert.ok(g.h.effects.burn>0);
 const safe=setup({world:{colliders:[],terrainAt:()=>'lava'}});safe.h.effects.grace=5;safe.h.effects.poison=3;advance(safe.c,1);assert.equal(safe.h.health,stats(safe.h).health);
 const w=setup(),wolf=foe('frostwolf',0,-62,{freeze:0,attackTime:0});w.c.enemies.push(wolf);advance(w.c,1);assert.ok(w.h.health<stats(w.h).health);assert.ok(w.h.effects.chill>0,'rime wolves chill on hit');
 const s=freshState();chooseArchetype(s,'human');Object.assign(s.hero.effects,{poison:3,burn:2,chill:4,root:1});assert.equal(drinkPotion(s).ok,true,'ailments justify a draught at full health');for(const k of ['poison','burn','chill','root'])assert.ok(!(s.hero.effects[k]>0),k);assert.equal(validHero(s.hero),true);});

test('affinities make foes weak or resistant, including burn ticks',()=>{
 for(const [weapon,kind]of [['frostfang','frostwolf'],['frostfang','imp'],['frostfang','goblin'],['cindermaul','troll'],['cindermaul','cinderbrute'],['sword','wraith']]){
  const f=setup();if(!f.h.weapons.includes(weapon))f.h.weapons.push(weapon);assert.equal(equipWeapon(f.s,weapon).ok,true);const e=foe(kind,0,-62),w=WEAPONS[weapon],mult=w.element?ENEMY_DEFS[kind].affinity?.[w.element]??1:1;f.c.enemies.push(e);
  f.c.attack();near(1000-e.health,meleeBase(f.h)*mult,1e-6,weapon+' vs '+kind);const hit=hitsOn(f,e).at(-1);assert.equal(!!hit.weak,mult>1.05,kind);assert.equal(!!hit.resist,mult<.95,kind);assert.equal(hit.element,w.element);
  if(w.element==='ice')assert.ok(e.chill>0);if(w.element==='fire')assert.ok(e.burn>0);}
 for(const [kind,mult]of [['imp',.2],['frostwolf',1.4],['goblin',1]]){const f=setup(),e=foe(kind,0,-62,{burn:1,burnDamage:10,burnTick:0});f.c.enemies.push(e);advance(f.c,1.1);near(1000-e.health,10*mult,1e-6,'burn on '+kind);}
 const f=setup({archetype:'wizard',x:22,z:-240});f.h.effects.grace=60;const b=boss(f,'frost');cast(f,'frost');advance(f.c,.5);const hit=hitsOn(f,b).at(-1);assert.ok(hit,'the lance strikes the wyrm');assert.equal(hit.resist,true);assert.ok(b.chill>0,'bosses can be chilled');assert.ok(!(b.iceLock>0)&&!(b.freeze>0),'but never frozen');});

// ---------------------------------------------------------------- spells
test('sunlance channels, drains mana, burns the undead and stops cleanly',()=>{
 const eye=stats((()=>{const h=freshHero();h.archetype='human';return h;})()).eye,f=setup({pitch:-Math.atan2(eye-1.1,5)}),e=foe('skeleton',0,-65);f.c.enemies.push(e);
 cast(f,'sunlance');const mana0=f.h.mana;assert.equal(mana0,stats(f.h).mana-SPELLS.sunlance.cost);assert.equal(f.h.cooldowns.sunlance,SPELLS.sunlance.cooldown);assert.equal(f.c.channel?.id,'sunlance');assert.equal(of(f,'channel-start').length,1);
 advance(f.c,1);nearAbs(f.h.mana,mana0-(SPELLS.sunlance.drain-stats(f.h).regen),1.2,'drain minus regeneration');const lost=1000-e.health,tick=SPELLS.sunlance.damage*.2*1.5;assert.ok(lost>=tick*4-1e-6&&lost<=tick*6+1e-6,'five radiant ticks a second, weak undead: '+lost);assert.ok(hitsOn(f,e).every(h=>h.element==='radiant'));
 f.c.stopChannel();assert.equal(f.c.channel,null);assert.equal(of(f,'channel-end').length,1);const hp=e.health,m=f.h.mana;advance(f.c,.5);assert.equal(e.health,hp);assert.ok(f.h.mana>m);
 cast(f,'sunlance');advance(f.c,4.4);assert.equal(f.c.channel,null,'the channel ends after its duration');assert.equal(of(f,'channel-end').length,2);
 f.h.cooldowns.sunlance=0;f.h.mana=SPELLS.sunlance.cost+2;assert.equal(f.c.cast(0).ok,true);advance(f.c,.6);assert.equal(f.c.channel,null,'running dry ends the channel');assert.ok(f.h.mana>=0);
 cast(f,'sunlance');f.c.dodge({x:1,z:0});assert.equal(f.c.channel,null,'dodging breaks the channel');
 const g=setup({pitch:-Math.atan2(eye-1.1,5)}),t=foe('skeleton',0,-65);g.c.enemies.push(t);g.h.ranks.sunlance=3;g.h.health-=40;cast(g,'sunlance');const before=g.h.health;advance(g.c,1);assert.ok(g.h.health>before,'mastery mends the caster');assert.equal(validHero(g.h),true);});

test('earthshatter erupts in a staggering line and masters into a second wave',()=>{
 const f=setup(),a=foe('goblin',0,-65,{freeze:0,poise:34,maxPoise:34}),side=foe('goblin',5,-65);f.c.enemies.push(a,side);cast(f,'earthshatter');
 const ev=of(f,'earthshatter');assert.equal(ev.length,1);assert.equal(ev[0].length,SPELLS.earthshatter.range);assert.equal(ev[0].width,SPELLS.earthshatter.width);nearAbs(Math.cos(ev[0].yaw),-1,1e-6);nearAbs(Math.sin(ev[0].yaw),0,1e-6);
 near(1000-a.health,SPELLS.earthshatter.damage);assert.equal(side.health,1000,'only the line is struck');assert.ok(a.freeze>=.75);assert.equal(of(f,'stagger').length,1,'earthshatter breaks poise');assert.equal(hitsOn(f,a)[0].element,'earth');
 const g=setup(),far=foe('goblin',0,-78);g.c.enemies.push(far);g.h.ranks.earthshatter=3;cast(g,'earthshatter');near(of(g,'earthshatter')[0].length,SPELLS.earthshatter.range*1.3);advance(g.c,.7);
 assert.equal(of(g,'earthshatter').length,2,'a second wave follows');assert.ok(1000-far.health>=SPELLS.earthshatter.damage*1.5*2-1e-6,'mastered line reaches farther and strikes twice');});

test('thunderstorm strikes its bolts across the targeted circle',()=>{
 for(const [rank,bolts]of [[1,6],[3,10]]){const f=setup({archetype:'wizard',pitch:-.4});if(rank===3)f.h.ranks.thunderstorm=3;assignSpell(f.s,0,'thunderstorm');f.h.selected=0;const aim=f.c.aim();assert.ok(aim);assert.equal(aim.radius,SPELLS.thunderstorm.radius);
  const e=foe('goblin',aim.x,aim.z);f.c.enemies.push(e);cast(f,'thunderstorm');const ev=of(f,'thunderstorm');assert.equal(ev.length,1);assert.equal(ev[0].radius,SPELLS.thunderstorm.radius);near(ev[0].duration,SPELLS.thunderstorm.duration);nearAbs(ev[0].x,aim.x,1e-6);nearAbs(ev[0].z,aim.z,1e-6);
  advance(f.c,SPELLS.thunderstorm.duration+.3);const bolt=of(f,'lightning');assert.equal(bolt.length,bolts);assert.ok(bolt.every(b=>b.from.y>surfaceAt(b.from.x,b.from.z)+10),'bolts fall from the sky');
  assert.ok(1000-e.health>=SPELLS.thunderstorm.damage*stats(f.h).power*stats(f.h).magic-1e-6);assert.ok(hitsOn(f,e).every(h=>h.element==='storm'));}});

test('soul siphon drains the facing foe, heals, wards on mastery and still spends on a miss',()=>{
 const f=setup({archetype:'wizard'}),e=foe('goblin',0,-65);f.c.enemies.push(e);const power=stats(f.h).power*stats(f.h).magic;f.h.health-=50;const hp=f.h.health;cast(f,'siphon');
 const dealt=SPELLS.siphon.damage*power;near(1000-e.health,dealt);near(f.h.health-hp,dealt*SPELLS.siphon.heal);const ev=of(f,'siphon');assert.equal(ev.length,1);assert.ok(!ev[0].miss);assert.ok(ev[0].from&&ev[0].to);assert.equal(hitsOn(f,e)[0].element,'shadow');
 const g=setup({archetype:'wizard'});g.h.cooldowns.siphon=0;assignSpell(g.s,0,'siphon');const mana=g.h.mana;assert.equal(g.c.cast(0).ok,true);assert.equal(g.h.mana,mana-SPELLS.siphon.cost);assert.equal(of(g,'siphon')[0].miss,true);
 const m=setup({archetype:'wizard'}),t=foe('goblin',0,-65);m.c.enemies.push(t);m.h.ranks.siphon=3;cast(m,'siphon');assert.equal(m.h.health,stats(m.h).health);assert.ok(m.h.shield>0&&m.h.shield<=150,'overflow becomes a ward');assert.ok(m.h.effects.ward>=6);assert.equal(validHero(m.h),true);});

// ---------------------------------------------------------------- legends
test('bosses awaken in their arena, advance phases, and reset when the hero flees',()=>{
 const f=setup({x:22,z:-238,random:()=>.99});f.h.effects.grace=60;const b=boss(f,'frost');assert.ok(!b.engaged);f.c.update(.05);
 assert.equal(b.engaged,true);assert.equal(f.c.boss,b);const aw=of(f,'boss-awaken');assert.equal(aw.length,1);assert.equal(aw[0].boss,'frost');assert.equal(aw[0].radius,BOSSES.frost.arena);assert.ok(f.notes.some(n=>n.includes('Hrimfang')));
 b.health=b.maxHealth*.6;f.c.update(.05);assert.equal(b.phase,1);let ph=of(f,'boss-phase');assert.equal(ph.length,1);assert.equal(ph[0].phase,1);assert.equal(ph[0].line,BOSSES.frost.lines[0]);assert.ok(f.notes.includes(BOSSES.frost.lines[0]));
 b.health=b.maxHealth*.3;f.c.update(.05);assert.equal(b.phase,2);ph=of(f,'boss-phase');assert.equal(ph.length,2);assert.equal(ph[1].line,BOSSES.frost.lines[1]);
 f.s.position={x:22+BOSSES.frost.arena*2+20,z:-250,yaw:0,pitch:0};advance(f.c,4.6);const reset=of(f,'boss-reset');assert.equal(reset.length,1);assert.equal(reset[0].boss,'frost');
 assert.ok(!b.engaged);assert.equal(f.c.boss,null);assert.equal(b.health,b.maxHealth);assert.equal(b.phase,0);assert.equal(b.attack,null);nearAbs(b.x,BOSSES.frost.x,1e-6);nearAbs(b.z,BOSSES.frost.z,1e-6);assert.ok(!f.c.enemies.some(e=>e.summon&&e.owner===b.id&&!e.dead));
 f.s.position={x:22,z:-238,yaw:0,pitch:0};f.c.update(.05);assert.equal(b.engaged,true);assert.equal(of(f,'boss-awaken').length,2);});

test('boss attacks telegraph hazards on the hero and resolve through the defence pipeline',()=>{
 const f=setup({x:22,z:-238,random:()=>.99}),b=boss(f,'frost');const start=untilEvent(f,e=>e.type==='hazard'&&e.phase==='start');assert.ok(start,'the wyrm attacks');
 const castEv=of(f,'boss-cast')[0];assert.equal(castEv.boss,'frost');assert.equal(castEv.attack,'spikes');assert.equal(castEv.name,'Ice spikes');assert.equal(start.shape,'circle');near(start.radius,2.7);nearAbs(start.x,22,1e-6);nearAbs(start.z,-238,1e-6);assert.ok(f.c.hazards.some(h=>h.id===start.id));assert.ok(b.attack);
 const hp=f.h.health,resolve=untilEvent(f,e=>e.type==='hazard'&&e.phase==='resolve'&&e.id===start.id,3);assert.ok(resolve);near(hp-f.h.health,28*stats(f.h).armor,1e-6,'ice spikes');assert.ok(!f.c.hazards.some(h=>h.id===start.id));
 const g=setup({x:22,z:-238,random:()=>.99}),gb=boss(g,'frost');const gs=untilEvent(g,e=>e.type==='hazard'&&e.phase==='start');assert.ok(gs);g.h.health=1;untilEvent(g,e=>e.type==='hazard'&&e.phase==='resolve',3);
 assert.equal(g.flags.defeats,1,'the hero falls');assert.equal(isSanctuary(g.s.position),true);assert.equal(g.h.health,stats(g.h).health);assert.ok(!gb.engaged);assert.equal(gb.health,gb.maxHealth);assert.ok(of(g,'boss-reset').some(e=>e.boss==='frost'));assert.equal(g.c.hazards.filter(h=>!h.style||h.style==='frost').length,0);});

test('staggered legends break but shrug off hard control',()=>{
 const f=setup({x:22,z:-246}),b=boss(f,'frost');f.h.weapons.push('mace');equipWeapon(f.s,'mace');f.c.attack();assert.ok(b.health<b.maxHealth);assert.ok(!(b.freeze>0),'maces do not stun a legend');
 b.poise=1;f.h.cooldowns.attack=0;f.c.attack();const st=of(f,'stagger');assert.equal(st.length,1);assert.equal(st[0].boss,true);near(b.stagger,3.2);assert.ok(!(b.freeze>0));assert.equal(b.poise,b.maxPoise);assert.equal(b.attack,null);});

test('defeating a legend pays once and persists through days, resets and saves',()=>{
 const f=setup({x:22,z:-246}),b=boss(f,'frost'),coins=f.s.coins;b.health=1;assert.equal(f.c.attack().ok,true);
 assert.equal(b.dead,true);assert.deepEqual(f.h.bosses,['frost']);assert.ok(f.h.weapons.includes('frostfang'));assert.equal(f.s.coins,coins+BOSSES.frost.coin);assert.equal(f.c.boss,null);
 const d=of(f,'boss-defeat');assert.equal(d.length,1);assert.equal(d[0].boss,'frost');assert.equal(d[0].weapon,'frostfang');assert.equal(d[0].sigil,'Sigil of Winter');assert.ok(f.notes.some(n=>n.includes('Hrimfang')));
 f.c.attack();advance(f.c,.5);assert.equal(f.s.coins,coins+BOSSES.frost.coin);assert.equal(of(f,'boss-defeat').length,1);
 nextDay(f.s);f.c.update(.05);assert.equal(boss(f,'frost'),b,'legends persist across daily respawns');assert.equal(b.dead,true);assert.ok(f.c.enemies.some(e=>/^hostile-/.test(e.id)),'regular foes respawn');
 f.c.reset();assert.equal(boss(f,'frost').dead,true);const loaded=parseSave(JSON.stringify(f.s));assert.ok(loaded);assert.deepEqual(loaded.hero.bosses,['frost']);
 const g=createCombat({state:()=>loaded,world:{colliders:[]}});assert.equal(boss(g_wrap(g),'frost').dead,true);assert.equal(!!boss(g_wrap(g),'mire').dead,false);
 const before=JSON.stringify(f.s);assert.equal(rewardBoss(f.s,'frost').rewarded,false);assert.equal(JSON.stringify(f.s),before);});
function g_wrap(c){return{c};}

test('the Hollow King sleeps until the three legends fall',()=>{
 const f=setup({x:-64,z:-124,random:()=>.99});f.h.effects.grace=60;const b=boss(f,'hollow');assert.equal(b.dormant,true);advance(f.c,.5);
 assert.ok(!b.engaged);assert.equal(f.c.boss,null);assert.equal(of(f,'boss-awaken').length,0);assert.notEqual(f.c.target(),b,'a sealed king cannot be targeted');
 f.s.position={x:-64,z:-129,yaw:0,pitch:0};b.x=BOSSES.hollow.x;b.z=BOSSES.hollow.z;f.c.attack();assert.equal(b.health,b.maxHealth,'a sealed king cannot be harmed');
 f.h.bosses=['frost','mire','cinder'];advance(f.c,.2);assert.equal(b.dormant,false);assert.equal(of(f,'rift-open').length,1);advance(f.c,.5);assert.equal(of(f,'rift-open').length,1,'the rift opens once');assert.equal(b.engaged,true);assert.equal(f.c.boss,b);});

test('legend summons fight for their master but never pay out',()=>{
 const f=setup({x:-177,z:148,random:()=>.99});f.h.effects.grace=60;const b=boss(f,'mire');for(let i=0;i<120&&!f.c.enemies.some(e=>e.summon);i++)f.c.update(.05);
 const adds=f.c.enemies.filter(e=>e.summon);assert.ok(adds.length>=1&&adds.length<=2,'Morwen raises her thralls');assert.ok(of(f,'boss-cast').some(e=>e.attack==='thralls'));assert.ok(of(f,'summon').length>=1);
 for(const a of adds){assert.match(a.id,/^summon-\d+$/);assert.equal(a.kind,'thrall');assert.equal(a.owner,b.id);}
 const snapshot=()=>JSON.stringify({coins:f.s.coins,kills:f.h.kills,xp:f.h.xp,level:f.h.level,defeated:f.h.defeated}),before=snapshot(),defeats=of(f,'defeat').length,a=adds[0];
 a.health=1;a.burn=2;a.burnDamage=10;a.burnTick=0;for(let i=0;i<30&&!a.dead;i++)f.c.update(.05);assert.equal(a.dead,true);assert.equal(snapshot(),before);assert.equal(of(f,'defeat').length,defeats+1);
 advance(f.c,3);assert.equal(f.c.enemies.includes(a),false,'fallen summons are cleared away');
 const g=setup(),wolf=foe('frostwolf',0,-62,{id:'summon-99',summon:true,owner:'boss-frost',health:1});g.c.enemies.push(wolf);const coins=g.s.coins,kills=g.h.kills,xp=g.h.xp;g.c.attack();
 assert.equal(wolf.dead,true);assert.deepEqual([g.s.coins,g.h.kills,g.h.xp],[coins,kills,xp]);assert.deepEqual(g.h.defeated,{});assert.equal(of(g,'defeat').length,1);assert.equal(rewardKill(g.s,{id:'summon-3',coin:10,xp:10}).rewarded,false);});

test('clear empties shots, hazards, charge, dodge and channel',()=>{
 const f=setup({x:22,z:-238,random:()=>.99});f.h.effects.grace=60;untilEvent(f,e=>e.type==='hazard'&&e.phase==='start');assert.ok(f.c.hazards.length>0);f.c.foeShots.push({id:'foe-1',x:22,y:1,z:-230,dx:0,dy:0,dz:1,speed:10,life:2,damage:5,color:0xffffff,status:{},owner:'boss-frost',parry:true});
 f.c.pressAttack();f.c.clear();assert.equal(f.c.hazards.length,0);assert.equal(f.c.foeShots.length,0);assert.equal(f.c.charging,false);assert.equal(f.c.channel,null);assert.equal(f.c.dodging,false);
 const g=setup();cast(g,'sunlance');g.c.clear();assert.equal(g.c.channel,null);});

// ---------------------------------------------------------------- the wider valley
let built=null;
function valley(){if(built)return built;const original=globalThis.document;globalThis.document={createElement(){return{width:0,height:0,getContext(){return{fillRect(){},strokeRect(){},fillText(){}};}};},querySelector(){return null;}};try{const scene=new T.Scene();built={scene,world:createWorld(scene)};}finally{globalThis.document=original;}return built;}
function roadDistance(x,z){let best=Infinity;for(const road of ROADS)for(let i=1;i<road.length;i++){const [ax,az]=road[i-1],[bx,bz]=road[i],dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));best=Math.min(best,Math.hypot(x-ax-dx*t,z-az-dz*t));}return best;}

test('Frostwatch joins the valley with its inn, traders, houses and new forage',()=>{
 const {world}=valley(),town=TOWNS.find(t=>t.id==='frostwatch');assert.deepEqual({...town},{id:'frostwatch',name:'Frostwatch',tag:'THE NORTHERN OUTPOST',x:-8,z:-205,color:0x5b6f86});
 assert.equal(TOWNS.length,4);assert.equal(world.houses.length,16);assert.equal(world.houses.filter(h=>h.town==='frostwatch').length,4);assert.ok(world.houses.every(h=>TOWNS.some(t=>t.id===h.town)));
 assert.equal(world.npcs.length,12);assert.equal(new Set(world.npcs.map(n=>n.id)).size,12);const npc=id=>world.npcs.find(n=>n.id===id);
 assert.equal(npc('halvard')?.role,'trapper');assert.equal(npc('halvard').town,'frostwatch');assert.equal(npc('brenna')?.role,'herbalist');assert.equal(npc('brenna').town,'frostwatch');assert.ok(world.npcs.some(n=>n.name==='Sigrun'&&n.role==='innkeeper'&&n.town==='frostwatch'));
 for(const n of world.npcs)assert.equal(blocksAt(n.x,n.z,world.colliders,.1),false,n.id+' stands clear');assert.equal(isSanctuary(town),true);
 assert.ok(world.gatherables.length>=34);assert.equal(new Set(world.gatherables.map(g=>g.id)).size,world.gatherables.length);for(const [x,z]of [[-30,-222],[-60,-240],[30,-212],[-160,110],[-205,92],[-140,140],[20,110],[-35,120]])assert.ok(world.gatherables.some(g=>Math.hypot(g.x-x,g.z-z)<1.5),`forage near ${x},${z}`);
 assert.deepEqual(REGIONS.map(r=>r.id),REGION_IDS);assert.deepEqual(world.regions,REGIONS);assert.ok(world.lava?.isMaterial);for(let i=0;i<8;i++){world.update(.1,i*.37,{x:-8,z:-190},.5);assert.ok(Number.isFinite(world.lava.emissiveIntensity)&&world.lava.emissiveIntensity>=1&&world.lava.emissiveIntensity<=2.2);}});

test('waystones and legend arenas stand clear of colliders',()=>{
 const {world}=valley(),dirs=[...Array(8)].map((_,i)=>i*Math.PI/4);assert.deepEqual(WAYSTONES.map(w=>w.id),WAYSTONE_IDS);assert.deepEqual(world.waystones.map(w=>w.id),WAYSTONE_IDS);
 for(const w of world.waystones){assert.ok(w.group&&typeof w.name==='string'&&w.name.length,w.id);assert.ok(Math.abs(w.x)<WORLD_LIMIT&&Math.abs(w.z)<WORLD_LIMIT);assert.ok(dirs.filter(a=>!blocksAt(w.x+Math.cos(a)*2.4,w.z+Math.sin(a)*2.4,world.colliders)).length>=4,w.id+' is approachable');assert.equal(terrainAt(w.x,w.z),null,w.id+' is on firm ground');}
 for(const k of BOSS_KEYS){const b=BOSSES[k];assert.equal(blocksAt(b.x,b.z,world.colliders,.6),false,k+' home');assert.equal(isSanctuary(b),false,k+' is not a sanctuary');let free=0,total=0;
  for(let x=-b.arena+2;x<=b.arena-2;x+=2)for(let z=-b.arena+2;z<=b.arena-2;z+=2){if(Math.hypot(x,z)>b.arena-2)continue;total++;if(!blocksAt(b.x+x,b.z+z,world.colliders))free++;}assert.ok(free/total>=.85,`${k} arena ${free}/${total} free`);}});

test('new roads, three bridges and the frozen tarn are walkable; the river blocks elsewhere',()=>{
 const {world}=valley();assert.equal(ROADS.length,10);assert.deepEqual(ROADS[0][0],[0,35]);assert.deepEqual(ROADS[5].at(-1),[-8,-205]);
 for(const road of ROADS.slice(5)){const p={x:road[0][0],z:road[0][1]};for(const [x,z]of road.slice(1)){moveWithCollision(p,x-p.x,z-p.z,world.colliders);assert.ok(Math.hypot(p.x-x,p.z-z)<2,`Route stopped near ${p.x.toFixed(1)}, ${p.z.toFixed(1)} instead of ${x},${z}`);}}
 assert.deepEqual(BRIDGES,[-185,-55,32]);assert.equal(RIVER.x,56);assert.equal(RIVER.north,-213);
 for(const z of BRIDGES){const p={x:45,z};moveWithCollision(p,22,0,world.colliders);assert.ok(p.x>65,'bridge '+z);assert.ok(surfaceAt(56,z)>heightAt(56,z)+.5);assert.equal(blocksAt(56,z,[]),false);}
 for(const z of [-205,-150,-100,0,80,200,280]){const p={x:45,z};moveWithCollision(p,22,0,world.colliders);assert.ok(p.x<50,'river blocks at '+z);assert.equal(blocksAt(56,z,[]),true);}
 assert.deepEqual(TARN,{x:60,z:-228,radius:15});assert.equal(terrainAt(TARN.x,TARN.z),'ice');assert.equal(blocksAt(56,-225,[]),false,'no river north of the tarn');assert.equal(blocksAt(TARN.x,TARN.z,world.colliders),false);
 const ice={x:TARN.x-11,z:TARN.z};moveWithCollision(ice,22,0,world.colliders);assert.ok(ice.x>TARN.x+9,'the frozen tarn can be crossed');
 assert.equal(WORLD_LIMIT,300);assert.equal(blocksAt(290,0,[]),false);assert.equal(blocksAt(301,0,[]),true);assert.equal(blocksAt(0,-301,[]),true);});

test('terrain, biomes and pools stay finite and keep clear of roads, lairs and waystones',()=>{
 for(let x=-300;x<=300;x+=10)for(let z=-300;z<=300;z+=10){const h=heightAt(x,z),s=surfaceAt(x,z),b=biomeAt(x,z),t=terrainAt(x,z);assert.ok(Number.isFinite(h)&&Number.isFinite(s),`${x},${z}`);for(const k of ['frost','mire','ash'])assert.ok(Number.isFinite(b[k])&&b[k]>=0&&b[k]<=1,`${k} ${x},${z}`);assert.ok([null,'bog','lava','ice'].includes(t),`${t} at ${x},${z}`);}
 assert.deepEqual({...biomeAt(0,0)},{frost:0,mire:0,ash:0});assert.equal(biomeAt(0,-240).frost,1);assert.equal(biomeAt(-8,-160).frost,0);assert.equal(biomeAt(-178,120).mire,1);assert.equal(biomeAt(212,-35).ash,1);assert.equal(biomeAt(-178,210).mire,0);
 for(const t of TOWNS){let lo=Infinity,hi=-Infinity;for(let a=0;a<16;a++)for(const r of [0,8,16,22]){const h=heightAt(t.x+Math.cos(a*.39)*r,t.z+Math.sin(a*.39)*r);lo=Math.min(lo,h);hi=Math.max(hi,h);}assert.ok(hi-lo<1.2,`${t.id} stays flat (${(hi-lo).toFixed(2)})`);}
 const mire=REGIONS.find(r=>r.id==='mire'),cinder=REGIONS.find(r=>r.id==='cinder');assert.ok(POOLS.filter(p=>p.kind==='bog').length>=10);assert.ok(POOLS.filter(p=>p.kind==='lava').length>=5);
 for(const p of POOLS){assert.ok(['bog','lava'].includes(p.kind));assert.ok(p.r>=2.5&&p.r<=6,'pool radius '+p.r);const home=p.kind==='bog'?mire:cinder;assert.ok(Math.hypot(p.x-home.x,p.z-home.z)<=home.radius,`${p.kind} pool inside its region`);
  assert.ok(roadDistance(p.x,p.z)>=3,`pool at ${p.x.toFixed(1)},${p.z.toFixed(1)} is off the road`);for(const k of BOSS_KEYS)assert.ok(Math.hypot(p.x-BOSSES[k].x,p.z-BOSSES[k].z)>=BOSSES[k].arena+3,'pool outside '+k);for(const w of WAYSTONES)assert.ok(Math.hypot(p.x-w.x,p.z-w.z)>=8,'pool away from '+w.id);assert.equal(terrainAt(p.x,p.z),p.kind);}});


test('a draught cleanses roots even at full health, without wasting a second potion',()=>{
 const s=freshState();chooseArchetype(s,'human');s.hero.effects.root=3;const count=s.hero.potions;
 assert.equal(drinkPotion(s).ok,true);assert.equal(s.hero.potions,count-1);assert.equal(s.hero.effects.root,undefined);
 assert.equal(s.hero.health,stats(s.hero).health);assert.ok(parseSave(JSON.stringify(s)));
 assert.equal(drinkPotion(s).ok,false);assert.equal(s.hero.potions,count-1);
});
