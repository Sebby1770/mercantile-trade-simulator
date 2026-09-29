/** Legendary foes: arenas, affinities and data-driven attack patterns. Pure data and geometry. */
// Attack shapes: cone, circle, ring and line resolve as telegraphed hazards; rain and pool place
// several delayed circles; volley, summon and blink resolve at the end of the boss's windup;
// charge dashes along a line; sequence chains its steps, re-aiming at the player before each.
export const BOSSES={
 frost:{key:'frost',id:'boss-frost',kind:'wyrm',name:'Hrimfang',title:'Wyrm of the White Pass',region:'Frostfang Highlands',sigil:'Sigil of Winter',x:22,z:-250,arena:23,level:7,
  health:1900,poise:420,speed:2.6,turn:1.8,keep:4.2,gap:.9,size:{r:2.3,y:2.1},xp:520,coin:260,points:2,weapon:'frostfang',color:0x9fdcff,
  affinity:{ice:.3,fire:1.4,storm:1.1},phases:[.66,.33],
  lines:['Hrimfang rises, frost howling from its wings!','The White Pass freezes. Hrimfang calls down the hail!'],
  attacks:[
   {id:'bite',name:'Crushing bite',shape:'cone',radius:5.6,angle:.62,windup:.75,damage:30,parry:true,cooldown:2.2,max:6.5},
   {id:'tail',name:'Tail sweep',shape:'cone',rear:true,radius:7,angle:1.05,windup:.8,damage:26,push:5,cooldown:3,max:8,when:'behind',weight:3},
   {id:'breath',name:'Frost breath',shape:'cone',radius:14,angle:.46,windup:1.25,damage:22,status:{chill:5},cooldown:6,min:3.5,max:15},
   {id:'spikes',name:'Ice spikes',shape:'circle',at:'player',radius:2.7,windup:1.1,damage:28,cooldown:4.5,max:24},
   {id:'nova',name:'Glacial nova',shape:'ring',inner:3.6,radius:13,windup:1.6,damage:36,unblockable:true,cooldown:10,phase:1,max:14},
   {id:'wolves',name:'Call of the pack',shape:'summon',summon:'frostwolf',count:2,windup:1.2,cooldown:18,phase:1},
   {id:'hail',name:'Icicle rain',shape:'rain',radius:2.3,count:7,spread:7,windup:1.1,damage:24,cooldown:9,phase:2}
  ]},
 mire:{key:'mire',id:'boss-mire',kind:'witch',name:'Morwen',title:'the Mire Witch',region:'Mirefen Marsh',sigil:'Sigil of the Mire',x:-192,z:148,arena:22,level:9,
  health:1500,poise:300,speed:2.4,turn:3,keep:10,gap:.8,hover:true,size:{r:1.1,y:1.8},xp:560,coin:260,points:2,weapon:'thornstaff',color:0x9be36b,
  affinity:{nature:.35,fire:1.25,storm:1.4,radiant:1.2},phases:[.6,.3],
  lines:['Morwen shrieks and the bog boils with thorns!','The mire itself answers Morwen’s wailing hex!'],
  attacks:[
   {id:'hex',name:'Hex bolts',shape:'volley',count:3,countByPhase:[3,4,5],spread:.22,speed:15,windup:.7,damage:16,status:{slow:1.5},parry:true,element:'nature',cooldown:2.6,max:30},
   {id:'pool',name:'Bog pool',shape:'pool',at:'player',radius:3.4,windup:1,duration:6,tick:9,status:{poison:3},cooldown:6.5,max:24},
   {id:'blink',name:'Mire step',shape:'blink',windup:.35,cooldown:5,max:5.5,weight:3},
   {id:'thralls',name:'Rise, drowned ones',shape:'summon',summon:'thrall',count:2,windup:1.2,cooldown:16},
   {id:'thorns',name:'Thorn lash',shape:'line',length:20,width:2.4,windup:1.1,damage:30,status:{root:1.2},cooldown:5.5,phase:1,max:20},
   {id:'wail',name:'Wailing hex',shape:'circle',radius:7.5,windup:1.4,damage:36,unblockable:true,cooldown:8,phase:2,max:7}
  ]},
 cinder:{key:'cinder',id:'boss-cinder',kind:'colossus',name:'Pyrrhus',title:'the Cinder Colossus',region:'Cinder Reach',sigil:'Sigil of Cinder',x:230,z:-55,arena:25,level:11,
  health:2300,poise:560,speed:1.8,turn:1.15,keep:4.6,gap:1,size:{r:2.2,y:3},xp:620,coin:300,points:2,weapon:'cindermaul',color:0xff8a3d,
  affinity:{fire:.1,ice:1.5,earth:.7,storm:.9},phases:[.66,.33],
  lines:['Pyrrhus roars. Cinders rain across the caldera!','The Colossus cracks open. The ground erupts!'],
  attacks:[
   {id:'slam',name:'Molten slam',shape:'circle',at:'front',offset:4,radius:3.8,windup:1.05,damage:44,cooldown:2.6,max:8},
   {id:'sweep',name:'Magma sweep',shape:'cone',radius:7.2,angle:1.05,windup:.95,damage:34,parry:true,cooldown:2.6,max:7.5},
   {id:'stomp',name:'Quake stomp',shape:'circle',radius:8.5,windup:1.5,damage:38,unblockable:true,push:4,cooldown:8,max:9},
   {id:'wave',name:'Fire wave',shape:'line',length:24,width:3.2,windup:1.2,damage:30,status:{burn:3},cooldown:5.5,min:5,max:24},
   {id:'meteors',name:'Cinderfall',shape:'rain',radius:3,count:5,spread:8,windup:1.3,damage:34,status:{burn:3},cooldown:9,phase:1},
   {id:'imps',name:'Kindle the imps',shape:'summon',summon:'imp',count:2,windup:1.2,cooldown:18,phase:1},
   {id:'eruption',name:'Eruption',shape:'pool',at:'arena',count:3,radius:3.2,windup:1.2,duration:8,tick:12,status:{burn:2},cooldown:11,phase:2}
  ]},
 hollow:{key:'hollow',id:'boss-hollow',kind:'hollowking',name:'Aurelian',title:'the Hollow King',region:'The Old Stones',sigil:'Crown of the Valley',x:-64,z:-132,arena:21,level:14,requires:['frost','mire','cinder'],
  health:3000,poise:480,speed:2.9,turn:2.6,keep:3.4,gap:.8,size:{r:1.3,y:2.1},xp:900,coin:600,points:3,weapon:'riftblade',color:0xc6a4ff,
  affinity:{radiant:1.6,arcane:.6,shadow:.5},phases:[.66,.33],
  lines:['Aurelian calls his hollow court to the stones!','The eclipse deepens. The Hollow King’s wrath awakens!'],
  attacks:[
   {id:'combo',name:'Hollow edge',shape:'sequence',steps:[{shape:'cone',radius:4.8,angle:.8,windup:.7,damage:28,parry:true},{shape:'cone',radius:4.8,angle:.8,windup:.45,damage:28,parry:true},{shape:'cone',radius:5.4,angle:.5,windup:.65,damage:42,parry:true}],cooldown:3,max:6},
   {id:'lunge',name:'Sovereign’s lunge',shape:'charge',length:13,width:2.4,windup:.85,damage:36,cooldown:4.5,min:5,max:16},
   {id:'orbs',name:'Rift orbs',shape:'volley',count:5,spread:.35,speed:11,windup:.8,damage:18,parry:true,element:'arcane',cooldown:4.5,max:30},
   {id:'eclipse',name:'Eclipse',shape:'ring',inner:4.5,radius:19,windup:1.7,damage:40,unblockable:true,cooldown:10,phase:1},
   {id:'court',name:'Summon the hollow court',shape:'summon',summon:'wraith',count:2,windup:1.3,cooldown:18,phase:1},
   {id:'crowns',name:'Falling crowns',shape:'rain',radius:2.6,count:7,spread:8,windup:1.1,damage:30,cooldown:8,phase:2},
   {id:'wrath',name:'Hollow wrath',shape:'circle',radius:9,windup:1.3,damage:44,unblockable:true,cooldown:10,phase:2,max:9}
  ]}
};
export const BOSS_KEYS=Object.keys(BOSSES);
export const bossRequirementsMet=(key,defeated=[])=>(BOSSES[key]?.requires||[]).every(k=>defeated.includes(k));
// Forward is (sin yaw, cos yaw), matching enemy headings. pad is the player's body radius.
export function inHazard(h,p,pad=.35){const dx=p.x-h.x,dz=p.z-h.z,d=Math.hypot(dx,dz);
 if(h.shape==='circle'||h.shape==='pool')return d<=h.radius+pad;
 if(h.shape==='ring')return d>=h.inner-pad&&d<=h.radius+pad;
 const fx=Math.sin(h.yaw),fz=Math.cos(h.yaw),along=dx*fx+dz*fz,side=dx*fz-dz*fx;
 if(h.shape==='cone')return d<=h.radius+pad&&(d<1.2||along/Math.max(d,1e-6)>=Math.cos(h.angle));
 if(h.shape==='line')return along>=-pad&&along<=h.length+pad&&Math.abs(side)<=h.width/2+pad;
 return false;}
