/** Hunters & Alchemists (v6.1): herbalist brews, hunters' bounties, legend echoes, the bestiary and save migration. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {GOODS,freshState,parseSave,nextDay,BOUNTY_TABLE,bountyOffer,acceptBounty,completeBounty,brew,recipeText} from '../web/realm/economy.js';
import {ENEMY_DEFS,BREWS,ECHO,stats,chooseArchetype,rewardKill,rewardBoss,rewardEcho,drinkBrew,hurtHero,tickHero,grantXP,noteSlain,validHero,migrateHero,freshHero} from '../web/realm/rpg.js';
import {BOSSES,BOSS_KEYS,echoStone,inHazard} from '../web/realm/bosses.js';
import {createCombat,ENCOUNTERS,DODGE,isSanctuary} from '../web/realm/combat.js';

const lcg=(seed=7)=>()=>(seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296;
const near=(a,b,eps=1e-6,msg='')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=eps*Math.max(1,Math.abs(b)),`${msg} ${a} ≈ ${b}`);
function advance(c,seconds,dt=.05){for(let i=0;i<Math.round(seconds/dt);i++)c.update(dt);}
const onlyBosses=c=>c.enemies.splice(0,c.enemies.length,...c.enemies.filter(e=>e.boss));
function setup({archetype='human',x=0,z=-60,yaw=0,pitch=0,stamina=null,random=lcg(),world={colliders:[]},keep=false,prepare=null}={}){const s=freshState();chooseArchetype(s,archetype);s.position={x,z,yaw,pitch};if(prepare)prepare(s);const events=[],notes=[],flags={defeats:0};const c=createCombat({state:()=>s,world,emit:e=>events.push(e),notify:m=>notes.push(m),onDefeat:()=>flags.defeats++,stamina,random});if(!keep)onlyBosses(c);return{s,h:s.hero,c,events,notes,flags,world};}
let serial=100;
function foe(kind,x,z,over={}){const d=ENEMY_DEFS[kind];return{...d,id:'hostile-'+serial++,kind,name:d.name,health:1000,maxHealth:1000,x,z,homeX:x,homeZ:z,heading:0,dead:false,freeze:100,iceLock:0,chill:0,burn:0,burnTick:0,burnDamage:0,poison:0,poisonDamage:0,bind:0,slow:0,stagger:0,windup:0,windupTotal:0,attackTime:100,flash:0,speed:0,poise:1000,maxPoise:1000,...over};}
const boss=(f,k)=>f.c.enemies.find(e=>e.boss===k);
const of=(f,type)=>f.events.filter(e=>e.type===type);
function untilEvent(f,pred,seconds=5){for(let i=0;i<seconds/.05;i++){const e=f.events.find(pred);if(e)return e;f.c.update(.05);}return f.events.find(pred);}
// Strike a foe standing just ahead of the hero with a fresh swing.
function strike(f,e){e.x=f.s.position.x;e.z=f.s.position.z-2;f.h.cooldowns.attack=0;const r=f.c.attack();assert.equal(r.ok,true,'the swing lands');return e;}
function slay(f,kind,over={}){const e=foe(kind,0,0,{health:1,...over});f.c.enemies.push(e);strike(f,e);assert.equal(e.dead,true,kind+' falls');return e;}
const snapshot=s=>JSON.stringify(s);
const offerOn=(town,day)=>{const s=freshState();s.day=day;return bountyOffer(s,town);};

// ---------------------------------------------------------------- herbalist brews
test('brewing consumes the exact recipe, coin and a proportional share of cost basis',()=>{
 const s=freshState();chooseArchetype(s,'elf');const h=s.hero;s.inventory.herbs=5;s.costBasis.herbs=50;s.inventory.berries=4;s.costBasis.berries=20;s.inventory.mushrooms=3;s.costBasis.mushrooms=24;
 assert.deepEqual(h.brews,{mana:0,ironbark:0,swiftfoot:0});assert.deepEqual(Object.keys(BREWS).sort(),['ironbark','mana','swiftfoot']);
 assert.deepEqual(BREWS.mana.recipe,{herbs:2,berries:2});assert.equal(BREWS.mana.coin,4);assert.equal(BREWS.mana.restore,60);
 assert.deepEqual(BREWS.ironbark.recipe,{mushrooms:2,herbs:1});assert.equal(BREWS.ironbark.coin,8);assert.equal(BREWS.ironbark.duration,90);
 assert.deepEqual(BREWS.swiftfoot.recipe,{berries:2,mushrooms:1});assert.equal(BREWS.swiftfoot.coin,6);assert.equal(BREWS.swiftfoot.duration,90);
 assert.equal(recipeText(BREWS.mana),'2 herbs, 2 berries');assert.equal(recipeText(BREWS.ironbark),'2 mushrooms, 1 herbs');
 const r=brew(s,'mana');assert.equal(r.ok,true);assert.ok(r.message.includes('Mana draught'));
 assert.equal(s.inventory.herbs,3);near(s.costBasis.herbs,30);assert.equal(s.inventory.berries,2);near(s.costBasis.berries,10);assert.equal(s.coins,116);assert.equal(h.brews.mana,1);
 assert.equal(brew(s,'ironbark').ok,true);assert.equal(s.inventory.mushrooms,1);near(s.costBasis.mushrooms,8);assert.equal(s.inventory.herbs,2);near(s.costBasis.herbs,20);assert.equal(s.coins,108);assert.equal(h.brews.ironbark,1);
 assert.equal(brew(s,'swiftfoot').ok,true);assert.equal(s.inventory.berries,0);assert.equal(s.costBasis.berries,0,'an emptied good keeps no cost basis');assert.equal(s.inventory.mushrooms,0);assert.equal(s.costBasis.mushrooms,0);assert.equal(s.coins,102);assert.equal(h.brews.swiftfoot,1);
 assert.ok(s.log.at(-1).includes('swiftfoot'));assert.equal(validHero(h),true);assert.deepEqual(parseSave(JSON.stringify(s)),s,'brewed pouches round trip');});

test('brewing refuses missing goods, coin, unknown recipes and a full pouch without touching state',()=>{
 const s=freshState();chooseArchetype(s,'human');const h=s.hero;s.inventory.herbs=1;s.inventory.berries=5;s.costBasis.herbs=12;s.costBasis.berries=25;
 let before=snapshot(s);let r=brew(s,'mana');assert.equal(r.ok,false);assert.ok(r.message.includes('2 herbs'));assert.equal(snapshot(s),before,'one herb short');
 s.inventory.herbs=2;s.coins=3;before=snapshot(s);r=brew(s,'mana');assert.equal(r.ok,false);assert.ok(r.message.includes('4 coin'));assert.equal(snapshot(s),before,'one coin short');
 s.coins=50;for(const bad of ['constructor','__proto__','toString','potion','hasOwnProperty','',undefined,null,7]){before=snapshot(s);assert.equal(brew(s,bad).ok,false,String(bad));assert.equal(snapshot(s),before,String(bad));}
 h.brews.mana=99;before=snapshot(s);r=brew(s,'mana');assert.equal(r.ok,false,'99 is the cap');assert.equal(snapshot(s),before);
 h.brews.mana=98;assert.equal(brew(s,'mana').ok,true);assert.equal(h.brews.mana,99);assert.equal(s.inventory.herbs,0);assert.equal(s.coins,46);assert.equal(validHero(h),true);});

test('a mana draught restores up to the cap and is refused at full mana',()=>{
 const s=freshState();chooseArchetype(s,'wizard');const h=s.hero,max=stats(h).mana;
 let before=snapshot(s);h.mana=10;before=snapshot(s);let r=drinkBrew(s,'mana');assert.equal(r.ok,false,'an empty pouch');assert.ok(r.message.includes('herbalist'));assert.equal(snapshot(s),before);
 h.brews.mana=3;h.mana=max-100;assert.equal(drinkBrew(s,'mana').ok,true);assert.equal(h.mana,max-40);assert.equal(h.brews.mana,2);
 assert.equal(drinkBrew(s,'mana').ok,true);assert.equal(h.mana,max,'restores up to the maximum only');assert.equal(h.brews.mana,1);
 before=snapshot(s);r=drinkBrew(s,'mana');assert.equal(r.ok,false);assert.ok(/full/i.test(r.message));assert.equal(snapshot(s),before,'nothing is wasted at full mana');
 for(const bad of ['constructor','__proto__','potions','',undefined]){before=snapshot(s);assert.equal(drinkBrew(s,bad).ok,false,String(bad));assert.equal(snapshot(s),before);}
 assert.deepEqual(h.effects,{},'a draught grants no lasting effect');});

test('tonics last 90 seconds, refresh rather than stack and tick down',()=>{
 const s=freshState();chooseArchetype(s,'human');const h=s.hero;h.brews.ironbark=2;h.brews.swiftfoot=1;
 assert.equal(drinkBrew(s,'ironbark').ok,true);assert.equal(h.effects.ironbark,90);assert.equal(h.brews.ironbark,1);assert.equal(validHero(h),true,'90 s tonics are valid');
 tickHero(h,30);near(h.effects.ironbark,60);assert.equal(drinkBrew(s,'ironbark').ok,true);assert.equal(h.effects.ironbark,90,'a second tonic refreshes to 90 s');assert.equal(h.brews.ironbark,0);
 const before=snapshot(s);assert.equal(drinkBrew(s,'ironbark').ok,false);assert.equal(snapshot(s),before);
 assert.equal(drinkBrew(s,'swiftfoot').ok,true);assert.equal(h.effects.swiftfoot,90);assert.equal(h.brews.swiftfoot,0);
 tickHero(h,45.5);near(h.effects.swiftfoot,44.5);near(h.effects.ironbark,44.5);tickHero(h,60);assert.equal(h.effects.swiftfoot,0);assert.equal(h.effects.ironbark,0);assert.equal(validHero(h),true);
 assert.deepEqual(parseSave(JSON.stringify(s)).hero.effects,h.effects);});

test('ironbark turns aside a quarter of every blow',()=>{
 const s=freshState();chooseArchetype(s,'ogre');const h=s.hero,armor=stats(h).armor;
 h.health=150;near(hurtHero(h,40),40*armor);near(h.health,150-40*armor);
 h.health=150;h.effects.ironbark=60;near(hurtHero(h,40),40*armor*.75);near(h.health,150-40*armor*.75);
 h.health=150;near(hurtHero(h,40,true),40*armor*.35*.75,1e-6,'stacks with a raised guard');
 h.health=150;h.effects.ironbark=0;near(hurtHero(h,40),40*armor,1e-6,'the tonic expires');
 const f=setup({x:22,z:-238,random:()=>.99,prepare:s=>{s.hero.effects.ironbark=90;}});const start=untilEvent(f,e=>e.type==='hazard'&&e.phase==='start');assert.ok(start);const hp=f.h.health;
 assert.ok(untilEvent(f,e=>e.type==='hazard'&&e.phase==='resolve'&&e.id===start.id,3));near(hp-f.h.health,28*stats(f.h).armor*.75,1e-6,'ice spikes through ironbark');});

test('swiftfoot dodges cost a third less stamina',()=>{
 const run=(pool,tonic)=>{const stamina={stamina:pool},f=setup({stamina});if(tonic)f.h.effects.swiftfoot=90;return{r:f.c.dodge({x:1,z:0}),stamina};};
 let t=run(100,false);assert.equal(t.r.ok,true);near(t.stamina.stamina,100-DODGE.stamina);
 t=run(100,true);assert.equal(t.r.ok,true);near(t.stamina.stamina,100-DODGE.stamina*.66);
 t=run(15,false);assert.equal(t.r.ok,false,'too tired without the tonic');assert.equal(t.stamina.stamina,15);
 t=run(15,true);assert.equal(t.r.ok,true,'swiftfoot finds the breath');near(t.stamina.stamina,15-DODGE.stamina*.66);});

// ---------------------------------------------------------------- hunters' bounties
test('each board rotates its bounty by day, and every bounty can be met by the camps of the valley',()=>{
 assert.deepEqual(Object.keys(BOUNTY_TABLE).sort(),['eldermere','frostwatch','ironhold','mossbrook']);
 const slots={};for(const camp of ENCOUNTERS)for(const kind of camp.kinds)slots[kind]=(slots[kind]||0)+1;
 for(const [town,table]of Object.entries(BOUNTY_TABLE)){
  for(const [kind,need]of table){assert.ok(ENEMY_DEFS[kind],kind);assert.ok(Number.isSafeInteger(need)&&need>=1,town+' '+kind);assert.ok((slots[kind]||0)>=need,`${town}: ${need} ${kind} needs ${need} spawn slots, found ${slots[kind]||0}`);}
  for(let day=1;day<=table.length*2+1;day++){const o=offerOn(town,day),[kind,need]=table[(day-1)%table.length],d=ENEMY_DEFS[kind];
   assert.deepEqual(o,{id:town+'-'+day,town,kind,need,reward:Math.round(d.coin*need*1.6+20),xp:Math.round(d.xp*need*.5)},town+' day '+day);}
  if(table.length>1)assert.notEqual(offerOn(town,1).kind,offerOn(town,2).kind,town+' rotates');}
 for(const bad of ['atlantis','whitepass','',undefined])assert.equal(bountyOffer(freshState(),bad),null,String(bad));
 assert.equal(offerOn('eldermere',1).kind,'wolf');assert.equal(offerOn('eldermere',2).kind,'goblin');assert.equal(offerOn('mossbrook',1).kind,'goblin');});

// KNOWN SOURCE BUG: bountyOffer looks the board up with BOUNTY_TABLE[town], so inherited keys such as
// 'constructor' or '__proto__' resolve to Object internals and the destructuring throws a TypeError
// (acceptBounty inherits the crash). Every other lookup in the realm guards with Object.hasOwn.
test('bounty boards ignore inherited object keys instead of throwing',()=>{
 for(const bad of ['constructor','__proto__','toString','hasOwnProperty']){const s=freshState();chooseArchetype(s,'human');const before=snapshot(s);
  assert.doesNotThrow(()=>bountyOffer(s,bad),bad);assert.equal(bountyOffer(s,bad),null,bad);
  let r;assert.doesNotThrow(()=>{r=acceptBounty(s,bad);},bad);assert.equal(r.ok,false,bad);assert.equal(snapshot(s),before,bad);}});

test('a board issues one bounty per day and a hunter holds at most three open',()=>{
 const s=freshState();chooseArchetype(s,'human');
 const r=acceptBounty(s,'eldermere');assert.equal(r.ok,true);assert.deepEqual(s.bounties,[{...offerOn('eldermere',1),have:0,complete:false}]);assert.ok(s.log.at(-1).includes('bounty'));
 let before=snapshot(s);assert.equal(acceptBounty(s,'eldermere').ok,false,'once per board per day');assert.equal(snapshot(s),before);
 for(const bad of ['atlantis','',undefined]){before=snapshot(s);assert.equal(acceptBounty(s,bad).ok,false,String(bad));assert.equal(snapshot(s),before);}
 assert.equal(acceptBounty(s,'mossbrook').ok,true);assert.equal(acceptBounty(s,'ironhold').ok,true);assert.equal(s.bounties.length,3);
 before=snapshot(s);assert.equal(acceptBounty(s,'frostwatch').ok,false,'three open bounties is the limit');assert.equal(snapshot(s),before);
 nextDay(s);before=snapshot(s);assert.equal(acceptBounty(s,'eldermere').ok,false,'a new day does not lift the limit');assert.equal(snapshot(s),before);
 const b=s.bounties[0];b.have=b.need;const c=completeBounty(s,b.id,'eldermere');assert.equal(c.ok,true);
 assert.equal(acceptBounty(s,'eldermere').ok,true,'a claimed bounty frees a slot');assert.equal(s.bounties.at(-1).id,'eldermere-2');assert.equal(s.bounties.filter(b=>!b.complete).length,3);
 assert.ok(parseSave(JSON.stringify(s)),'bounty boards round trip');});

test('kills advance one open bounty each, never through training targets, summons or repeat kills',()=>{
 const f=setup({prepare:s=>{s.coins=500;}}),s=f.s;
 assert.equal(acceptBounty(s,'mossbrook').ok,true);assert.equal(acceptBounty(s,'eldermere').ok,true);
 const second={...offerOn('eldermere',2),have:0,complete:false};s.bounties.push(second);const [moss,wolves]=s.bounties;
 assert.equal(moss.kind,'goblin');assert.equal(wolves.kind,'wolf');assert.equal(second.kind,'goblin');
 slay(f,'goblin');assert.equal(moss.have,1);assert.equal(second.have,0,'one kill advances one bounty');assert.equal(wolves.have,0);assert.ok(f.notes.at(-1).includes('bounty 1/'+moss.need),f.notes.at(-1));
 slay(f,'wolf');assert.equal(wolves.have,1);assert.equal(moss.have,1);
 for(let i=1;i<moss.need;i++)slay(f,'goblin');assert.equal(moss.have,moss.need);assert.equal(second.have,0);assert.ok(f.notes.at(-1).includes('claim it at the board'));
 slay(f,'goblin');assert.equal(moss.have,moss.need,'a full bounty stops counting');assert.equal(second.have,1,'the next open bounty takes the kill');
 const tally=()=>JSON.stringify(s.bounties);let before=tally();
 const dummy={id:'training-7',kind:'goblin',name:'Runewood training target',training:true,health:1,maxHealth:240,poise:80,maxPoise:80,homeX:0,homeZ:0,heading:0,dead:false,freeze:0,iceLock:0,chill:0,burn:0,bind:0,slow:0,stagger:0,windup:0,attackTime:0,flash:0,resetIn:0};
 f.c.enemies.push(dummy);strike(f,dummy);assert.equal(dummy.dead,true);assert.equal(tally(),before,'training targets never count');
 slay(f,'goblin',{id:'summon-77',summon:true,owner:'boss-mire'});assert.equal(tally(),before,'summons never count');
 const again=foe('goblin',0,0,{health:1});f.h.defeated[again.id]=s.day;f.c.enemies.push(again);strike(f,again);assert.equal(again.dead,true);assert.equal(tally(),before,'a foe already slain today does not count twice');
 assert.equal(rewardKill(s,{id:'hostile-900',kind:'troll',coin:1,xp:1}).bounty,null,'unmatched kinds leave bounties alone');assert.equal(tally(),before);
 const done=freshState();chooseArchetype(done,'human');done.bounties=[{...offerOn('mossbrook',1),have:3,complete:true}];assert.equal(rewardKill(done,{id:'hostile-1',kind:'goblin',coin:1,xp:1}).bounty,null,'claimed bounties stay closed');assert.equal(done.bounties[0].have,3);});

test('bounties are claimed once, at the issuing board, only when complete, and grant experience',()=>{
 const s=freshState();chooseArchetype(s,'human');acceptBounty(s,'ironhold');const b=s.bounties[0];assert.equal(b.kind,'skeleton');
 let before=snapshot(s);let r=completeBounty(s,b.id,'ironhold');assert.equal(r.ok,false);assert.ok(r.message.includes(String(b.need)));assert.equal(snapshot(s),before,'unfinished');
 b.have=b.need;before=snapshot(s);
 for(const [id,town]of [[b.id,'eldermere'],[b.id,'mossbrook'],['ironhold-2','ironhold'],['nope','ironhold'],[undefined,'ironhold'],[b.id,undefined]]){assert.equal(completeBounty(s,id,town).ok,false,id+'@'+town);assert.equal(snapshot(s),before);}
 const twin=structuredClone(s.hero),levels=grantXP(twin,b.xp),coins=s.coins;r=completeBounty(s,b.id,'ironhold');assert.equal(r.ok,true);assert.equal(r.levels,levels);assert.ok(r.message.includes(String(b.reward)));
 assert.equal(s.coins,coins+b.reward);assert.equal(b.complete,true);assert.equal(s.hero.xp,twin.xp);assert.equal(s.hero.level,twin.level);assert.equal(s.hero.points,twin.points);assert.ok(b.xp>0);
 before=snapshot(s);assert.equal(completeBounty(s,b.id,'ironhold').ok,false,'paid once');assert.equal(snapshot(s),before);
 const rich=freshState();chooseArchetype(rich,'human');acceptBounty(rich,'frostwatch');rich.bounties[0].have=rich.bounties[0].need;rich.bounties[0].xp=400;const lv=completeBounty(rich,'frostwatch-1','frostwatch');assert.ok(lv.levels>=2,'a rich bounty can raise levels');assert.equal(rich.hero.points,lv.levels);
 assert.equal(grantXP(freshHero(),-50),0);assert.equal(grantXP(freshHero(),74.4),0);const h=freshHero();assert.equal(grantXP(h,74.6),1,'xp grants round');});

// ---------------------------------------------------------------- echoes of fallen legends
test('an echo cannot be called while its legend lives; once slain it returns stronger',()=>{
 assert.deepEqual(ECHO,{health:1.35,damage:1.25,speed:1.15,coin:.4,xp:.35});
 for(const k of BOSS_KEYS){const p=echoStone(k),d=BOSSES[k];assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z),k);const off=Math.hypot(p.x-d.x,p.z-d.z);assert.ok(off>2&&off<d.arena,k+' stone sits inside the lair');assert.equal(isSanctuary(p),false,k);}
 assert.equal(echoStone('dragon'),undefined);
 const f=setup({x:22,z:-246}),b=boss(f,'frost');
 for(const k of BOSS_KEYS){const before=snapshot(f.s),r=f.c.summonEcho(k);assert.equal(r.ok,false,k);assert.ok(r.message.includes('still lives'),r.message);assert.equal(snapshot(f.s),before);}
 for(const bad of ['dragon','constructor','__proto__',undefined])assert.equal(f.c.summonEcho(bad).ok,false,String(bad));
 assert.equal(b.dead,false);assert.equal(b.echo,false);
 b.health=1;strike(f,b);b.x=BOSSES.frost.x;b.z=BOSSES.frost.z;assert.equal(b.dead,true);assert.deepEqual(f.h.bosses,['frost']);
 const r=f.c.summonEcho('frost');assert.equal(r.ok,true);assert.ok(r.message.includes('Hrimfang'));assert.equal(of(f,'echo-summon').length,1);assert.equal(of(f,'echo-summon')[0].boss,'frost');
 assert.equal(b.dead,false);assert.equal(b.echo,true);assert.equal(b.maxHealth,Math.round(BOSSES.frost.health*1.35));assert.equal(b.health,b.maxHealth);assert.equal(b.maxPoise,Math.round(BOSSES.frost.poise*1.2));assert.equal(b.phase,0);
 assert.ok(f.c.enemies.includes(b));const again=f.c.summonEcho('frost');assert.equal(again.ok,false,'one echo at a time');assert.ok(again.message.includes('already'));
 f.c.update(.05);assert.equal(b.engaged,true);const aw=of(f,'boss-awaken').at(-1);assert.equal(aw.echo,true);assert.equal(aw.name,'Echo of Hrimfang');assert.equal(f.c.boss,b);
 assert.equal(f.c.summonEcho('mire').ok,false,'other legends still live');});

test('echo hazards hit harder and wind up faster than the legend they echo',()=>{
 const run=echo=>{const f=setup({x:22,z:-238,random:()=>.99,prepare:s=>{if(echo){rewardBoss(s,'frost');}s.hero.effects.grace=0;}}),b=boss(f,'frost');if(echo){assert.equal(b.dead,true);assert.equal(f.c.summonEcho('frost').ok,true);}
  const start=untilEvent(f,e=>e.type==='hazard'&&e.phase==='start');assert.ok(start,'the wyrm attacks');const cast=of(f,'boss-cast')[0],hz=f.c.hazards.find(h=>h.id===start.id),spec=BOSSES.frost.attacks.find(a=>a.id===cast.attack);
  const hp=f.h.health;assert.ok(untilEvent(f,e=>e.type==='hazard'&&e.phase==='resolve'&&e.id===start.id,3));return{f,b,cast,hz,spec,start,lost:hp-f.h.health,total:b.attack?.total};};
 const base=run(false),echo=run(true);assert.equal(base.cast.attack,echo.cast.attack,'same opening attack');assert.ok(base.spec.damage>0);
 near(base.hz.damage,base.spec.damage);near(echo.hz.damage,base.spec.damage*ECHO.damage,1e-6,'echo hazard damage');assert.ok(echo.hz.damage>base.hz.damage);
 near(echo.start.duration,base.start.duration/ECHO.speed,1e-6,'echo windup');
 near(base.lost,base.spec.damage*stats(base.f.h).armor);near(echo.lost,base.spec.damage*ECHO.damage*stats(echo.f.h).armor,1e-6,'the hero feels the difference');
 assert.equal(of(echo.f,'boss-cast')[0].boss,'frost');});

test('besting an echo pays a share of the purse once per day, with no second weapon or sigil',()=>{
 const f=setup({x:22,z:-246}),b=boss(f,'frost'),s=f.s,h=f.h;b.health=1;strike(f,b);b.x=BOSSES.frost.x;b.z=BOSSES.frost.z;
 const weapons=[...h.weapons],coins=s.coins,kills=h.kills,twin=structuredClone(h);grantXP(twin,BOSSES.frost.xp*ECHO.xp);assert.equal(h.slain.wyrm,1);
 assert.equal(f.c.summonEcho('frost').ok,true);b.health=1;strike(f,b);b.x=BOSSES.frost.x;b.z=BOSSES.frost.z;
 assert.equal(b.dead,true);assert.equal(b.echo,false);assert.equal(b.engaged,false);assert.equal(f.c.boss,null);
 const coin=Math.round(BOSSES.frost.coin*.4);assert.equal(coin,104);assert.equal(s.coins,coins+coin);assert.equal(h.kills,kills+1);assert.equal(h.echoes.frost,s.day);
 assert.deepEqual(h.weapons,weapons,'no duplicate legendary weapon');assert.equal(h.weapons.filter(w=>w==='frostfang').length,1);assert.deepEqual(h.bosses,['frost'],'no second sigil');assert.equal(h.points,twin.points,'only level-up points, no legend bonus');assert.equal(h.xp,twin.xp);assert.equal(h.level,twin.level);
 const d=of(f,'boss-defeat');assert.equal(d.length,2);const e=d[1];assert.equal(e.echo,true);assert.equal(e.boss,'frost');assert.equal(e.name,'Echo of Hrimfang');assert.equal(e.weapon,null);assert.equal(e.weaponName,null);assert.equal(e.sigil,null);assert.ok(!d[0].echo);
 assert.ok(f.notes.some(n=>n.includes('Echo of Hrimfang')&&n.includes('+'+coin+' coin')));assert.equal(h.slain.wyrm,2,'echoes enter the bestiary');
 let before=snapshot(s);const r=f.c.summonEcho('frost');assert.equal(r.ok,false);assert.ok(r.message.includes('tomorrow'));assert.equal(snapshot(s),before);assert.equal(b.dead,true);
 before=snapshot(s);assert.equal(rewardEcho(s,'frost').rewarded,false,'paid once per day');assert.equal(snapshot(s),before);
 for(const bad of ['mire','dragon','constructor','__proto__']){before=snapshot(s);assert.equal(rewardEcho(s,bad).rewarded,false,bad);assert.equal(snapshot(s),before);}
 nextDay(s);f.c.update(.05);onlyBosses(f.c);assert.equal(f.c.summonEcho('frost').ok,true,'the echo returns the next day');b.health=1;strike(f,b);
 assert.equal(s.coins,coins+coin*2);assert.equal(h.echoes.frost,2);assert.equal(h.slain.wyrm,3);assert.equal(validHero(h),true);assert.deepEqual(parseSave(JSON.stringify(s)).hero.echoes,{frost:2});});

test('echo rewards: experience share, once per day and only for legends already slain',()=>{
 const s=freshState();chooseArchetype(s,'human');assert.equal(rewardEcho(s,'frost').rewarded,false,'an unslain legend has no echo');assert.deepEqual(s.hero.echoes,{});
 rewardBoss(s,'cinder');const twin=structuredClone(s.hero),levels=grantXP(twin,BOSSES.cinder.xp*ECHO.xp),coins=s.coins;
 const r=rewardEcho(s,'cinder');assert.deepEqual(r,{rewarded:true,coin:Math.round(BOSSES.cinder.coin*.4),levels});assert.equal(s.coins,coins+120);assert.equal(s.hero.xp,twin.xp);assert.equal(s.hero.level,twin.level);assert.deepEqual(s.hero.echoes,{cinder:1});
 assert.equal(rewardEcho(s,'cinder').rewarded,false);s.day=2;assert.equal(rewardEcho(s,'cinder').rewarded,true);assert.deepEqual(s.hero.echoes,{cinder:2});assert.equal(s.hero.slain.colossus,3);});

test('a fled echo fades back to rest and can be called again the same day',()=>{
 const f=setup({x:22,z:-246}),b=boss(f,'frost'),h=f.h;b.health=1;strike(f,b);b.x=BOSSES.frost.x;b.z=BOSSES.frost.z;const coins=f.s.coins;
 h.effects.grace=60;assert.equal(f.c.summonEcho('frost').ok,true);f.c.update(.05);assert.equal(b.engaged,true);b.health=b.maxHealth*.5;
 f.s.position={x:22+BOSSES.frost.arena*2+20,z:-250,yaw:0,pitch:0};advance(f.c,4.6);
 const reset=of(f,'boss-reset').at(-1);assert.ok(reset,'the echo fades');assert.equal(reset.echo,true);assert.equal(reset.boss,'frost');assert.ok(f.notes.some(n=>n.includes('echo of Hrimfang fades')));
 assert.equal(b.dead,true);assert.equal(b.echo,false);assert.equal(b.engaged,false);assert.equal(f.c.boss,null);assert.equal(f.s.coins,coins,'no reward for fleeing');assert.equal(h.echoes.frost,undefined);assert.equal(h.slain.wyrm,1);
 assert.equal(f.c.hazards.filter(z=>z.style==='frost').length,0);
 f.s.position={x:22,z:-246,yaw:0,pitch:0};const r=f.c.summonEcho('frost');assert.equal(r.ok,true,'the echo can be re-summoned');assert.equal(b.health,b.maxHealth);assert.equal(b.echo,true);
 f.c.update(.05);assert.equal(b.engaged,true);h.effects.grace=0;h.health=1;b.attack=null;b.cooldown=0;
 untilEvent(f,()=>f.flags.defeats>0,6);assert.equal(f.flags.defeats,1,'the hero falls to the echo');
 assert.equal(b.dead,true,'a failed echo fades');assert.equal(b.echo,false);assert.equal(of(f,'boss-reset').at(-1).echo,true);assert.equal(f.c.summonEcho('frost').ok,true,'and can be tried again');});

// ---------------------------------------------------------------- bestiary
test('the bestiary counts regular kills, summons and legends, but not training targets',()=>{
 const f=setup({x:22,z:-246}),h=f.h;assert.deepEqual(h.slain,{});
 slay(f,'goblin');slay(f,'goblin');slay(f,'wolf');assert.deepEqual(h.slain,{goblin:2,wolf:1});
 const coins=f.s.coins;slay(f,'thrall',{id:'summon-55',summon:true,owner:'boss-mire'});assert.equal(h.slain.thrall,1,'summons are recorded');assert.equal(f.s.coins,coins,'but never paid');
 const dummy={id:'training-3',kind:'dummy',name:'Runewood training target',training:true,health:1,maxHealth:240,poise:80,maxPoise:80,homeX:0,homeZ:0,heading:0,dead:false,freeze:0,iceLock:0,chill:0,burn:0,bind:0,slow:0,stagger:0,windup:0,attackTime:0,flash:0,resetIn:0};
 f.c.enemies.push(dummy);strike(f,dummy);assert.equal(dummy.dead,true);assert.equal(h.slain.dummy,undefined);
 const repeat=foe('wolf',0,0,{health:1});h.defeated[repeat.id]=f.s.day;f.c.enemies.push(repeat);strike(f,repeat);assert.equal(h.slain.wolf,1,'an unpaid repeat kill is not recounted');
 const b=boss(f,'frost');b.health=1;strike(f,b);assert.equal(h.slain.wyrm,1,'legends are recorded by kind');
 for(const k of ['mire','cinder','hollow'])rewardBoss(f.s,k);assert.deepEqual(h.slain,{goblin:2,wolf:1,thrall:1,wyrm:1,witch:1,colossus:1,hollowking:1});
 const before=JSON.stringify(h.slain);for(const bad of ['dummy','dragon','constructor','__proto__','toString',undefined])noteSlain(h,bad);assert.equal(JSON.stringify(h.slain),before,'unknown kinds are ignored');
 const bare={};noteSlain(bare,'imp');assert.deepEqual(bare.slain,{imp:1});h.slain.imp=1e9;noteSlain(h,'imp');assert.equal(h.slain.imp,1e9,'counts saturate');
 assert.equal(validHero(h),true);assert.deepEqual(parseSave(JSON.stringify(f.s)).hero.slain,h.slain);});

// ---------------------------------------------------------------- saves
test('v6.0 saves migrate: heroes gain a brew pouch, bestiary and echo record; journeys gain a bounty board',()=>{
 const s=freshState();chooseArchetype(s,'elf');rewardBoss(s,'frost');s.coins=777;s.day=12;s.inventory.herbs=4;s.costBasis.herbs=40;s.hero.effects={haste:12};
 delete s.bounties;delete s.hero.brews;delete s.hero.slain;delete s.hero.echoes;assert.equal(s.hero.version,2);
 const loaded=parseSave(JSON.stringify(s));assert.ok(loaded,'a v6.0 save still loads');
 assert.deepEqual(loaded.bounties,[]);assert.deepEqual(loaded.hero.brews,{mana:0,ironbark:0,swiftfoot:0});assert.deepEqual(loaded.hero.slain,{});assert.deepEqual(loaded.hero.echoes,{});
 assert.equal(loaded.coins,777);assert.equal(loaded.day,12);assert.deepEqual(loaded.hero.bosses,['frost']);assert.ok(loaded.hero.weapons.includes('frostfang'));assert.deepEqual(loaded.hero.effects,{haste:12});assert.equal(validHero(loaded.hero),true);
 assert.deepEqual(parseSave(JSON.stringify(loaded)),loaded,'migrated saves round trip');
 const old=freshHero();old.version=1;old.level=4;for(const k of ['points','ranks','bosses','brews','slain','echoes'])delete old[k];migrateHero(old);
 assert.equal(old.version,2);assert.equal(old.points,3);assert.deepEqual(old.brews,{mana:0,ironbark:0,swiftfoot:0});assert.deepEqual(old.slain,{});assert.deepEqual(old.echoes,{});assert.equal(validHero(old),true,'v1 heroes migrate all the way');
 const kept=freshHero();kept.brews={mana:4,ironbark:0,swiftfoot:2};kept.slain={wolf:3};migrateHero(kept);assert.deepEqual(kept.brews,{mana:4,ironbark:0,swiftfoot:2});assert.deepEqual(kept.slain,{wolf:3});
 for(const bad of [null,[],'hero',7])assert.equal(migrateHero(bad),bad);});

test('parseSave rejects malformed bounties, brews, tonics, bestiary entries and echoes',()=>{
 const make=()=>{const s=freshState();chooseArchetype(s,'human');rewardBoss(s,'frost');s.day=5;acceptBounty(s,'eldermere');acceptBounty(s,'mossbrook');s.hero.brews={mana:3,ironbark:1,swiftfoot:0};s.hero.slain={wolf:2,wyrm:1};s.hero.echoes={frost:4};return s;};
 assert.ok(parseSave(JSON.stringify(make())),'the baseline is valid');
 const cases={
  'bounties not a list':s=>s.bounties={},'bounty null':s=>s.bounties.push(null),
  'bad id town':s=>s.bounties[0].id='atlantis-5','bad id day':s=>s.bounties[0].id='eldermere-x','id without day':s=>s.bounties[0].id='eldermere','id of another board':s=>s.bounties[0].id='ironhold-5',
  'unknown board':s=>{s.bounties[0].town='whitepass';s.bounties[0].id='whitepass-5';},'have above need':s=>s.bounties[0].have=s.bounties[0].need+1,'negative have':s=>s.bounties[0].have=-1,'fractional have':s=>s.bounties[0].have=.5,
  'need zero':s=>{s.bounties[0].need=0;s.bounties[0].have=0;},'need above 20':s=>s.bounties[0].need=21,'unknown kind':s=>s.bounties[0].kind='dragon','prototype kind':s=>s.bounties[0].kind='constructor','boss kind':s=>s.bounties[0].kind='wyrm',
  'duplicate ids':s=>s.bounties.push({...s.bounties[0]}),'reward zero':s=>s.bounties[0].reward=0,'xp fractional':s=>s.bounties[0].xp=1.5,'complete not boolean':s=>s.bounties[0].complete='yes',
  'brews missing key':s=>delete s.hero.brews.swiftfoot,'brews extra key':s=>s.hero.brews.elixir=1,'brews 100':s=>s.hero.brews.mana=100,'brews fractional':s=>s.hero.brews.ironbark=1.5,'brews negative':s=>s.hero.brews.mana=-1,'brews list':s=>s.hero.brews=[3,1,0],'brews missing':s=>s.hero.brews=null,
  'ironbark above 90':s=>s.hero.effects.ironbark=90.5,'swiftfoot above 90':s=>s.hero.effects.swiftfoot=91,'ward still capped at 60':s=>s.hero.effects.ward=61,'unknown effect':s=>s.hero.effects.stoneskin=5,
  'slain unknown kind':s=>s.hero.slain.dragon=1,'slain dummy':s=>s.hero.slain.dummy=1,'slain zero':s=>s.hero.slain.wolf=0,'slain fractional':s=>s.hero.slain.wolf=2.5,'slain list':s=>s.hero.slain=[],
  'echo for an unslain legend':s=>s.hero.echoes.mire=3,'echo unknown legend':s=>s.hero.echoes.dragon=3,'echo day zero':s=>s.hero.echoes.frost=0,'echo fractional day':s=>s.hero.echoes.frost=2.5,'echoes list':s=>s.hero.echoes=['frost']};
 for(const [name,mutate]of Object.entries(cases)){const s=make();mutate(s);assert.equal(parseSave(JSON.stringify(s)),null,name);}
 const edge=make();edge.hero.brews={mana:99,ironbark:99,swiftfoot:0};edge.hero.effects={ironbark:90,swiftfoot:90,ward:60};edge.bounties[0].have=edge.bounties[0].need;assert.ok(parseSave(JSON.stringify(edge)),'limits themselves are valid');});

test('a late-game journey round trips intact through the save validator',()=>{
 const s=freshState();chooseArchetype(s,'wizard');const h=s.hero;s.coins=8400;s.day=41;s.capacity=60;s.quest=5;s.visits=['eldermere','mossbrook','ironhold','frostwatch'];
 for(const k of BOSS_KEYS)rewardBoss(s,k);h.echoes={frost:40,mire:41,cinder:12,hollow:39};h.brews={mana:99,ironbark:7,swiftfoot:3};h.effects={ironbark:88.25,swiftfoot:12.5,haste:4};
 h.slain=Object.fromEntries([...Object.keys(ENEMY_DEFS).map((k,i)=>[k,1+i*7]),['wyrm',5],['witch',3],['colossus',2],['hollowking',9]]);
 s.day=39;for(const t of ['eldermere','frostwatch'])acceptBounty(s,t);s.day=40;acceptBounty(s,'eldermere');s.bounties[0].have=s.bounties[0].need;assert.equal(completeBounty(s,s.bounties[0].id,'eldermere').ok,true);
 s.day=41;assert.equal(acceptBounty(s,'ironhold').ok,true);s.bounties[1].have=1;s.bounties[2].have=s.bounties[2].need;
 assert.equal(s.bounties.length,4);assert.equal(s.bounties.filter(b=>b.complete).length,1);assert.equal(validHero(h),true);
 const loaded=parseSave(JSON.stringify(s));assert.ok(loaded,'late-game save validates');assert.deepEqual(loaded,s);assert.deepEqual(parseSave(JSON.stringify(loaded)),s);
 assert.equal(completeBounty(loaded,loaded.bounties[2].id,'eldermere').ok,true,'loaded bounties remain claimable');});
