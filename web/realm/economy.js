import {freshHero,validHero} from './rpg.js';
export const SAVE_KEY='mercantile.elderwood.v3';
export const GOODS={
 grain:{name:'Grain',mark:'G',base:8,description:'Sacks of golden barley'},
 wool:{name:'Wool',mark:'W',base:18,description:'Fleece from the Mossbrook pastures'},
 iron:{name:'Iron',mark:'Fe',base:24,description:'Ingots from the northern mines'},
 timber:{name:'Timber',mark:'T',base:14,description:'Seasoned Elderwood oak'},
 cloth:{name:'Cloth',mark:'C',base:36,description:'Handwoven travelling cloth'},
 herbs:{name:'Herbs',mark:'H',base:12,description:'Wild lavender and silverleaf'},
 berries:{name:'Berries',mark:'B',base:5,description:'Sweet woodland berries'},
 mushrooms:{name:'Mushrooms',mark:'M',base:8,description:'Fresh chestnut mushrooms'}
};
export const BIASES={
 eldermere:{grain:1,wool:1.2,iron:1.3,timber:.68,cloth:.82,herbs:1.2,berries:1,mushrooms:1.1},
 mossbrook:{grain:.58,wool:.62,iron:1.55,timber:1.1,cloth:1.4,herbs:.8,berries:.7,mushrooms:1.1},
 ironhold:{grain:1.65,wool:1.3,iron:.55,timber:1.55,cloth:1.4,herbs:1.7,berries:1.4,mushrooms:.72}
};
export const OFFERS={merchant:['grain','timber','cloth','wool'],herbalist:['herbs','berries','mushrooms'],farmer:['grain','wool','berries'],weaver:['wool','cloth','herbs'],smith:['iron','timber','cloth'],innkeeper:['grain','berries','mushrooms']};
export const EVENTS=[
 {name:'Fair skies',text:'The roads are clear. A fair day for trading.',good:null,town:null,mult:1},
 {name:'The harvest fair',text:'Mossbrook’s grain harvest has filled the barns.',good:'grain',town:'mossbrook',mult:.78},
 {name:'A northern chill',text:'Ironhold is paying well for herbs.',good:'herbs',town:'ironhold',mult:1.3},
 {name:'A royal commission',text:'The king’s weavers need wool in Eldermere.',good:'wool',town:'eldermere',mult:1.3},
 {name:'Fresh timber',text:'Elderwood lumberjacks have brought in extra timber.',good:'timber',town:'eldermere',mult:.8},
 {name:'Market day',text:'Travellers are buying cloth in Mossbrook.',good:'cloth',town:'mossbrook',mult:1.25}
];
export function freshState(){return{version:3,hero:freshHero(),coins:120,inventory:Object.fromEntries(Object.keys(GOODS).map(k=>[k,0])),costBasis:Object.fromEntries(Object.keys(GOODS).map(k=>[k,0])),capacity:30,day:1,time:8*60,quest:0,visits:['eldermere'],harvested:{},stock:Object.fromEntries(Object.keys(BIASES).map(t=>[t,Object.fromEntries(Object.keys(GOODS).map((g,i)=>[g,28+i*3]))])),position:{x:0,z:28,yaw:0,pitch:0},profit:0,trades:0,contracts:[],contractSerial:0,discovered:[],log:['Day 1 · Your tale begins at the gates of Eldermere.']};}
export const cargoUsed=s=>Object.values(s.inventory).reduce((a,b)=>a+b,0);
export const currentEvent=s=>EVENTS[(s.day-1)%EVENTS.length];
export function quote(s,town,good,side){if(!BIASES[town]||!GOODS[good]||!['buy','sell'].includes(side))return 0;const ev=currentEvent(s),event=ev.good===good&&ev.town===town?ev.mult:1;const stock=s.stock[town][good];const scarcity=Math.max(.94,Math.min(1.08,1+(32-stock)*.002));const movement=1+Math.sin(s.day*1.37+Object.keys(GOODS).indexOf(good))*.04;return Math.max(1,Math.round(GOODS[good].base*BIASES[town][good]*event*scarcity*movement*(side==='buy'?1.12:.78)));}
export function log(s,message){s.log.push('Day '+s.day+' · '+message);s.log=s.log.slice(-45);}
export function transact(s,town,good,qty,side){
 if(!BIASES[town]||!GOODS[good]||!['buy','sell'].includes(side)||!Number.isSafeInteger(qty)||qty<1||qty>999)return{ok:false,message:'Choose a whole quantity between 1 and 999.'};
 const unit=quote(s,town,good,side),total=unit*qty;
 if(side==='buy'){
  if(s.stock[town][good]<qty)return{ok:false,message:'The merchant does not have that much in stock.'};
  if(cargoUsed(s)+qty>s.capacity)return{ok:false,message:'Your satchel is full. Sell goods or buy a larger pack.'};
  if(s.coins<total)return{ok:false,message:'You need '+total+' coin for that purchase.'};
  s.coins-=total;s.costBasis[good]+=total;s.inventory[good]+=qty;s.stock[town][good]-=qty;
 }else{
  if(s.inventory[good]<qty)return{ok:false,message:'You do not have enough '+GOODS[good].name.toLowerCase()+'.'};
  const cost=s.costBasis[good]*qty/s.inventory[good];s.inventory[good]-=qty;s.costBasis[good]=s.inventory[good]?s.costBasis[good]-cost:0;s.coins+=total;s.profit+=total-cost;s.stock[town][good]+=qty;
 }
 s.trades++;log(s,(side==='buy'?'Bought ':'Sold ')+qty+' '+GOODS[good].name.toLowerCase()+' for '+total+' coin.');checkGoal(s);return{ok:true,message:(side==='buy'?'Bought ':'Sold ')+qty+' '+GOODS[good].name.toLowerCase()+' · '+total+' coin',unit,total};
}
export function harvest(s,node){if(!node||!['herbs','berries','mushrooms'].includes(node.kind))return{ok:false,message:'Nothing to gather here.'};if(s.harvested[node.id]===s.day)return{ok:false,message:'This patch will grow back tomorrow.'};const qty=Math.min(2,s.capacity-cargoUsed(s));if(qty<1)return{ok:false,message:'Your satchel is full.'};s.inventory[node.kind]+=qty;s.harvested[node.id]=s.day;log(s,'Gathered '+qty+' '+node.kind+'.');return{ok:true,message:'Gathered '+qty+' '+node.kind+' · added to satchel'};}
function take(s,good,qty){const owned=s.inventory[good];s.costBasis[good]*=(owned-qty)/owned;s.inventory[good]-=qty;}
export const QUESTS=[
 {title:'A merchant’s beginning',text:'Speak to Rowan at the western market stall in Eldermere.',npc:'rowan'},
 {title:'The woods provide',text:'Gather 3 herbs from the purple flowers beside the southern road. Bring them to Elin at Eldermere’s eastern stall.',npc:'elin',good:'herbs',qty:3,reward:45},
 {title:'A kindness for Mossbrook',text:'Deliver 6 grain to Agnes in Mossbrook. Buy grain from Rowan, then follow the road northwest.',npc:'agnes',good:'grain',qty:6,reward:85},
 {title:'Iron on the road',text:'Buy 4 iron from Gareth in Ironhold and deliver it to Rowan in Eldermere. Cross the northern river bridge.',npc:'rowan',good:'iron',qty:4,reward:145},
 {title:'A name in the valley',text:'Visit all three settlements and build your purse to 1,000 coin. Trade village exports, gather wild plants, and complete deliveries.',npc:null},
 {title:'Master of the Elderwood Road',text:'The valley knows your name. Your guild charter is earned. Keep exploring and trading for as long as you like.',npc:null}
];
export function questAction(s,npc){const q=QUESTS[s.quest];if(q.npc!==npc)return{ok:false,message:'Seek out the person named in your journal.'};if(s.quest===0){s.quest=1;log(s,'Rowan introduced you to the traders’ guild.');return{ok:true,message:'A new beginning · gather 3 herbs for Elin'};}if(!q.good)return{ok:false,message:'Your journey continues.'};if(s.inventory[q.good]<q.qty)return{ok:false,message:'Bring '+q.qty+' '+q.good+' to complete this delivery.'};take(s,q.good,q.qty);s.coins+=q.reward;s.quest++;log(s,q.title+' complete. Earned '+q.reward+' coin.');checkGoal(s);return{ok:true,message:'Delivery complete · +'+q.reward+' coin'};}
export function checkGoal(s){if(s.quest===4&&s.visits.length===3&&s.coins>=1000){s.quest=5;log(s,'The guild named you Master of the Elderwood Road.');return true;}return false;}
export function upgrade(s){const cost=s.capacity===30?100:s.capacity===45?200:0;if(!cost)return{ok:false,message:'You already own the finest pack.'};if(s.coins<cost)return{ok:false,message:'A larger pack costs '+cost+' coin.'};s.coins-=cost;s.capacity+=15;log(s,'Upgraded to a '+s.capacity+'-slot merchant’s pack.');return{ok:true,message:'Satchel expanded · '+s.capacity+' spaces'};}
export function nextDay(s){s.day++;s.time=8*60;for(const town of Object.keys(BIASES))for(const good of Object.keys(GOODS))s.stock[town][good]=Math.min(65,s.stock[town][good]+12);s.harvested={};log(s,currentEvent(s).text);}
export function rest(s){if(s.coins<8)return{ok:false,message:'A room and breakfast cost 8 coin.'};s.coins-=8;nextDay(s);return{ok:true,message:'A good night’s rest · Day '+s.day+'. '+currentEvent(s).text};}
export function contractOffer(s,town){const routes={eldermere:{to:'mossbrook',good:'timber',qty:5},mossbrook:{to:'ironhold',good:'grain',qty:8},ironhold:{to:'eldermere',good:'iron',qty:5}};const r=routes[town];return{...r,from:town,reward:Math.ceil(GOODS[r.good].base*BIASES[r.to][r.good]*r.qty*1.25),id:town+'-'+s.day};}
export function acceptContract(s,town){const offer=contractOffer(s,town);if(s.contracts.some(c=>c.id===offer.id))return{ok:false,message:'You already took today’s delivery.'};if(s.contracts.filter(c=>!c.complete).length>=3)return{ok:false,message:'Finish a delivery before accepting another.'};s.contracts.push({...offer,complete:false});log(s,'Accepted a delivery of '+offer.qty+' '+offer.good+' to '+offer.to+'.');return{ok:true,message:'Delivery added to your journal'};}
export function completeContract(s,id,town){const c=s.contracts.find(c=>c.id===id);if(!c||c.complete||c.to!==town)return{ok:false,message:'This delivery cannot be completed here.'};if(s.inventory[c.good]<c.qty)return{ok:false,message:'You still need '+c.qty+' '+c.good+'.'};take(s,c.good,c.qty);s.coins+=c.reward;c.complete=true;log(s,'Delivered '+c.qty+' '+c.good+' to '+town+' for '+c.reward+' coin.');checkGoal(s);return{ok:true,message:'Delivery complete · +'+c.reward+' coin'};}
// Saved data is validated as a whole: malformed or incompatible saves never silently mint goods or reset quest rewards.
export function parseSave(raw){try{const s=JSON.parse(raw);const num=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;if(s.version!==3||!integer(s.coins,0,1e9)||!integer(s.day,1,1e7)||!num(s.time,0,1440)||!integer(s.quest,0,5)||![30,45,60].includes(s.capacity)||!num(s.profit,-1e10,1e10)||!integer(s.trades,0,1e9))return null;for(const g of Object.keys(GOODS))if(!integer(s.inventory?.[g],0,60)||!num(s.costBasis?.[g],0,1e10))return null;if(Object.keys(s.inventory).length!==8||cargoUsed(s)>s.capacity)return null;for(const t of Object.keys(BIASES))for(const g of Object.keys(GOODS))if(!integer(s.stock?.[t]?.[g],0,1e9))return null;const p=s.position;if(!p||!num(p.x,-192,192)||!num(p.z,-192,192)||!num(p.yaw,-1e7,1e7)||!num(p.pitch,-1.4,1.4))return null;if(!Array.isArray(s.visits)||!s.visits.every(t=>Object.hasOwn(BIASES,t))||new Set(s.visits).size!==s.visits.length)return null;if(!s.harvested||typeof s.harvested!=='object'||!Object.entries(s.harvested).every(([k,v])=>/^plant-\d+$/.test(k)&&integer(v,1,s.day)))return null;if(!Array.isArray(s.contracts)||s.contracts.length>10000||!s.contracts.every(c=>typeof c.id==='string'&&/^(eldermere|mossbrook|ironhold)-\d+$/.test(c.id)&&Object.hasOwn(BIASES,c.from)&&Object.hasOwn(BIASES,c.to)&&Object.hasOwn(GOODS,c.good)&&integer(c.qty,1,60)&&integer(c.reward,1,10000)&&typeof c.complete==='boolean'))return null;if(new Set(s.contracts.map(c=>c.id)).size!==s.contracts.length)return null;if(!Array.isArray(s.log)||!s.log.every(l=>typeof l==='string'&&l.length<500)||!Array.isArray(s.discovered)||!s.discovered.every(d=>typeof d==='string'))return null;if(s.hero===undefined)s.hero=freshHero();if(!validHero(s.hero))return null;return s;}catch{return null;}}
