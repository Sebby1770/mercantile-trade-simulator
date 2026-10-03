import {createRPGPanels,SIGIL_GLYPHS,ELEMENTS} from './rpg-ui.js';
import {ENCOUNTERS,TRAINING} from './combat.js';
import {GOODS,BIASES,OFFERS,QUESTS,MARKET_TOWNS,cargoUsed,quote,currentEvent,contractOffer,bountyOffer,recipeText} from './economy.js';
import * as W from './world.js';
import {BOSSES,BOSS_KEYS,bossRequirementsMet,echoStone} from './bosses.js';
import {WEAPONS,DEALERS,ENEMY_DEFS,BREWS} from './rpg.js';
// Optional world data is read defensively so the interface survives a partially built world.
const {TOWNS,ROADS}=W,REGIONS=W.REGIONS||[],WAYSTONES=W.WAYSTONES||[],BRIDGES=W.BRIDGES||[-55,32],RIVER=W.RIVER||{x:56,north:-300},TARN=W.TARN||null,POOLS=W.POOLS||[],biomeAt=typeof W.biomeAt==='function'?W.biomeAt:null;
const $=s=>document.querySelector(s);
export const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const townName=id=>TOWNS.find(t=>t.id===id)?.name||id;
const goodName=id=>GOODS[id]?.name||id;
const hex=c=>'#'+(c>>>0).toString(16).padStart(6,'0').slice(-6);
const button=(action,text,disabled=false,extra='')=>`<button data-action="${action}" ${disabled?'disabled':''} ${extra}>${text}</button>`;
export const TRAVEL_COST=12;
// Hunters' board and bestiary helpers: names, haunts (camps sorted nearest-first) and elemental notes.
const kindName=k=>ENEMY_DEFS[k]?.name||Object.values(BOSSES).find(b=>b.kind===k)?.name||k;
const haunts=(k,from)=>ENCOUNTERS.filter(c=>c.kinds.includes(k)).sort((a,b)=>from?Math.hypot(a.x-from.x,a.z-from.z)-Math.hypot(b.x-from.x,b.z-from.z):0).map(c=>c.name);
const affinityText=aff=>{const e=Object.entries(aff||{}).filter(([,v])=>Number.isFinite(v)),el=k=>(ELEMENTS[k]||k).toLowerCase(),weak=e.filter(([,v])=>v>1).sort((a,b)=>b[1]-a[1]).map(([k])=>el(k)),strong=e.filter(([,v])=>v<1).sort((a,b)=>a[1]-b[1]).map(([k])=>el(k));return[weak.length?'Weak to '+weak.join(', '):'',strong.length?'Resists '+strong.join(', '):''].filter(Boolean).join(' · ')||'No elemental weakness';};
const canBrew=(s,b)=>Object.entries(b.recipe).every(([g,q])=>s.inventory[g]>=q)&&s.coins>=b.coin;
const plural=(n,w)=>n+' '+w+(n===1?'':'s');
const greetings={
 rowan:'A merchant is only as good as the road they’re willing to take. Welcome to Eldermere, traveller.',
 elin:'Silverleaf by the road, lavender beneath the oaks. The valley provides, if you know where to look.',
 agnes:'We’ve more barley than barn space this year. Take a sack north: a miner can’t eat iron.',
 tilda:'Every thread has a story. Mine usually begins with a sheep and ends with a long afternoon.',
 gareth:'Good iron. Honest weight. Bring me timber for the furnace and we’ll both do well.',
 ida:'The garrison has coin, and precious little patience. Grain and herbs are always welcome here.',
 halvard:'Furs for the cold, steel for what lives in it. I’ve skinned rime wolves and sold blades to the fools who hunt the wyrm. Some of them came back.',
 brenna:'Frostbloom, snowcap moss, a pinch of rimeleaf. Up here the herbs grow slow and strong. Mind the wyrm’s breath: no tea of mine thaws that.',
 sigrun:'Shake the snow off, traveller. There’s mulled wine by the fire and a warm bed above the Antler.'
};
const LAIRS={frost:'The White Pass',mire:'The Witch’s Circle',cinder:'The Caldera',hollow:'The Old Stones'};
const HINTS={
 frost:'Follow the north road past Frostwatch and up the White Pass. Hrimfang shrugs off ice but fire scorches its scales. Roll through the glacial nova: no shield can hold it.',
 mire:'Cross the Mirefen causeway into the drowned fen. Morwen scorns nature magic; fire and lightning undo her. Parry her hex bolts straight back at her.',
 cinder:'Take the eastern road through the Cinder gate. The Colossus drinks fire, but ice cracks its molten hide. Keep off the lava and dodge the quake stomp.',
 hollow:'Radiant light burns the Hollow King. Parry the last blow of his three-strike edge and punish him while he reels.'
};
const REGION_LABELS={frost:[-112,-266],mire:[-178,202],cinder:[222,42]};
const BIOME_KEY={frost:'frost',mire:'mire',cinder:'ash'};
const exportsOf=t=>Object.entries(BIASES[t]||{}).sort((a,b)=>a[1]-b[1]).slice(0,2).map(([g])=>goodName(g)).join(' · ');
// The whole-world terrain shading is baked once (2 m per pixel) and reused by both maps.
let layer=null;
function terrainLayer(){if(layer!==null)return layer;layer=false;try{const n=300,c=document.createElement('canvas');c.width=c.height=n;const ctx=c.getContext('2d'),img=ctx.createImageData(n,n),d=img.data;
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const x=-300+(i+.5)*2,z=-300+(j+.5)*2,b=biomeAt?biomeAt(x,z):null;let r=38,g=61,bl=48;const mix=(w,c)=>{if(!(w>0))return;w=Math.min(1,w);r+=(c[0]-r)*w;g+=(c[1]-g)*w;bl+=(c[2]-bl)*w;};
  if(b){mix(b.frost*.9,[146,162,168]);mix(b.mire*.85,[54,66,41]);mix(b.ash*.9,[60,49,44]);}mix(Math.max(Math.hypot(x,z)-262,Math.max(Math.abs(x),Math.abs(z))-280,0)/22,[22,32,28]);
  const k=(j*n+i)*4;d[k]=r;d[k+1]=g;d[k+2]=bl;d[k+3]=255;}
 ctx.putImageData(img,0,0);const p=v=>(v+300)/2;
 for(const q of POOLS){if(!Number.isFinite(q?.x)||!Number.isFinite(q?.z))continue;ctx.fillStyle=q.kind==='lava'?'#d9652b':'#1d2a21';ctx.beginPath();ctx.arc(p(q.x),p(q.z),Math.max(1,(q.r||3)/2),0,Math.PI*2);ctx.fill();}
 if(TARN){ctx.fillStyle='#b9d5df';ctx.beginPath();ctx.arc(p(TARN.x),p(TARN.z),TARN.radius/2,0,Math.PI*2);ctx.fill();}
 layer=c;}catch{layer=false;}return layer;}
function diamond(ctx,x,y,r){ctx.beginPath();ctx.moveTo(x,y-r*1.4);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r*1.4);ctx.lineTo(x-r,y);ctx.closePath();}
export function drawMap(canvas,state,mini=false){const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,TAU=Math.PI*2,slain=Array.isArray(state.hero?.bosses)?state.hero.bosses:[],attuned=Array.isArray(state.waystones)?state.waystones:[];
 const scale=mini?w/90:Math.min(w/560,h/520),cx=mini?state.position.x:10,cz=mini?state.position.z:-35,px=x=>(x-cx)*scale+w/2,pz=z=>(z-cz)*scale+h/2;
 ctx.save();ctx.clearRect(0,0,w,h);ctx.fillStyle='#16241d';ctx.fillRect(0,0,w,h);const L=terrainLayer();if(L){ctx.imageSmoothingEnabled=true;ctx.drawImage(L,px(-300),pz(-300),600*scale,600*scale);}else{ctx.fillStyle='#263d30';ctx.fillRect(px(-300),pz(-300),600*scale,600*scale);}
 ctx.strokeStyle='#9bb08a22';ctx.lineWidth=1;const x0=cx-w/2/scale,x1=cx+w/2/scale,z0=cz-h/2/scale,z1=cz+h/2/scale;for(let x=Math.ceil(Math.max(-300,x0)/20)*20;x<=Math.min(300,x1);x+=20){ctx.beginPath();ctx.moveTo(px(x),0);ctx.lineTo(px(x),h);ctx.stroke();}for(let z=Math.ceil(Math.max(-300,z0)/20)*20;z<=Math.min(300,z1);z+=20){ctx.beginPath();ctx.moveTo(0,pz(z));ctx.lineTo(w,pz(z));ctx.stroke();}
 ctx.fillStyle='#5f8f8c';ctx.fillRect(px(RIVER.x-6),pz(Math.max(-300,RIVER.north)),12*scale,pz(300)-pz(Math.max(-300,RIVER.north)));
 ctx.strokeStyle='#bca878';ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=mini?2:3;for(const line of ROADS){ctx.beginPath();line.forEach(([x,z],i)=>i?ctx.lineTo(px(x),pz(z)):ctx.moveTo(px(x),pz(z)));ctx.stroke();}
 ctx.fillStyle='#cfb681';for(const z of BRIDGES)ctx.fillRect(px(RIVER.x-8),pz(z)-3,16*scale,6);
 const label=(text,x,y,font,color)=>{ctx.font=font;ctx.fillStyle=color;ctx.fillText(text,x,y);};ctx.textAlign='center';if(!mini){ctx.shadowColor='#000b';ctx.shadowBlur=4;}
 for(const t of TOWNS){if(mini){ctx.fillStyle='#c7bd94';for(const [dx,dz]of[[-11,-15],[11,-15],[-20,4],[20,4]])ctx.fillRect(px(t.x+dx)-3,pz(t.z+dz)-3,6,6);}ctx.fillStyle=state.visits.includes(t.id)?'#e8cd8e':'#8e9c72';ctx.beginPath();ctx.arc(px(t.x),pz(t.z),mini?3:6,0,TAU);ctx.fill();if(!mini){label(t.name,px(t.x),pz(t.z)-14,'22px Georgia','#f6ecc4');label(exportsOf(t.id),px(t.x),pz(t.z)+22,'13px sans-serif','#c9d6b6');}}
 if(!mini){for(const r of REGIONS){const [x,z]=REGION_LABELS[r.id]||[r.x,r.z],found=(state.regions||[]).includes(r.id);label(r.name,px(x),pz(z),'italic 21px Georgia',found?'#eadfbd':'#c3c9b0aa');label(r.tag,px(x),pz(z)+17,'10px sans-serif','#c8c2a4aa');}
  label('E l d e r w o o d',px(-39),pz(41),'italic 17px Georgia','#a6b894');ctx.save();ctx.translate(px(RIVER.x+12),pz(15));ctx.rotate(Math.PI/2);label('River Wren',0,0,'italic 15px Georgia','#a8cdbd');ctx.restore();if(TARN)label('Frozen tarn',px(TARN.x),pz(TARN.z)+TARN.radius*scale+14,'italic 12px Georgia','#d6e6ec');
  ctx.fillStyle='#d9c388';ctx.font='20px Georgia';ctx.fillText('N',w-28,30);ctx.beginPath();ctx.moveTo(w-28,40);ctx.lineTo(w-33,54);ctx.lineTo(w-23,54);ctx.closePath();ctx.fill();}
 ctx.fillStyle='#a7dfff';ctx.beginPath();ctx.arc(px(TRAINING.x),pz(TRAINING.z),mini?3:5,0,TAU);ctx.fill();if(!mini)label('Arcane practice',px(TRAINING.x),pz(TRAINING.z)+18,'12px sans-serif','#a7dfff');
 ctx.fillStyle='#c98879';for(const camp of ENCOUNTERS){ctx.beginPath();ctx.moveTo(px(camp.x),pz(camp.z)-4);ctx.lineTo(px(camp.x)-4,pz(camp.z)+4);ctx.lineTo(px(camp.x)+4,pz(camp.z)+4);ctx.closePath();ctx.fill();}
 for(const st of WAYSTONES){const on=attuned.includes(st.id),x=px(st.x),y=pz(st.z);if(on&&!mini){ctx.shadowColor='#7fe9ff';ctx.shadowBlur=10;}ctx.fillStyle=on?'#a8f2ff':'#62797b';diamond(ctx,x,y,mini?2.6:5);ctx.fill();if(!mini){ctx.shadowColor='#000b';ctx.shadowBlur=4;if(!TOWNS.some(t=>t.id===st.id))label(st.name,x,y+19,'12px sans-serif',on?'#bff4ff':'#9fb2b2');}}
 for(const k of BOSS_KEYS){const b=BOSSES[k],dead=slain.includes(k),sealed=!dead&&!bossRequirementsMet(k,slain),x=px(b.x),y=pz(b.z),c=dead?'#7b837e':sealed?'#5d5178':hex(b.color);
  if(!mini){ctx.setLineDash([5,6]);ctx.strokeStyle=c;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,b.arena*scale,0,TAU);ctx.stroke();ctx.setLineDash([]);}
  ctx.fillStyle=c;ctx.strokeStyle='#10181a';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,mini?4:10,0,TAU);ctx.fill();ctx.stroke();
  if(!mini){label(dead?'✓':sealed?'◌':SIGIL_GLYPHS[k]||'✦',x,y+5,'bold 13px Georgia','#10181a');label(b.name,x,y-16,'17px Georgia',dead?'#aab2ab':'#f6e7c8');const spent=state.hero?.echoes?.[k]===state.day;label((k==='hollow'?LAIRS.hollow+' · ':'')+(dead?'slain · '+(spent?'echo bested':'echo waits'):sealed?'sealed':'level '+b.level),x,y+(dead?38:26),'11px sans-serif',dead?'#9aa39c':sealed?'#b7a8dc':'#f0c9a0');
   // A fallen legend's echo stone: bright while its echo can be fought today, dim once bested.
   const st=dead&&echoStone(k);if(st){const ex=px(st.x),ey=Math.max(pz(st.z),y+17);ctx.save();ctx.shadowColor=hex(b.color);ctx.shadowBlur=spent?0:9;ctx.fillStyle=spent?'#5b6461':'#e9ddff';ctx.strokeStyle=hex(b.color);ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(ex,ey-6);ctx.lineTo(ex+4,ey);ctx.lineTo(ex,ey+6);ctx.lineTo(ex-4,ey);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}}}
 ctx.shadowBlur=0;ctx.translate(px(state.position.x),pz(state.position.z));ctx.rotate(-state.position.yaw);ctx.fillStyle='#fff1b9';ctx.strokeStyle='#253827';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(-5,5);ctx.lineTo(0,3);ctx.lineTo(5,5);ctx.closePath();ctx.stroke();ctx.fill();ctx.restore();
}
// Location naming: rooms, towns, lairs, waystones, then the biome region, then the open road.
export function placeName(s,room){const p=s.position,slain=s.hero?.bosses||[];if(room)return[room.name,'A WARM WELCOME'];const t=TOWNS.find(t=>Math.hypot(p.x-t.x,p.z-t.z)<33);if(t)return[t.name,t.tag];
 for(const k of BOSS_KEYS){const b=BOSSES[k];if(Math.hypot(p.x-b.x,p.z-b.z)<b.arena+6)return[LAIRS[k]||b.region,slain.includes(k)?'A FALLEN LEGEND’S LAIR':bossRequirementsMet(k,slain)?b.name.toUpperCase()+'’S LAIR':'A SEALED RIFT'];}
 const st=WAYSTONES.find(w=>Math.hypot(p.x-w.x,p.z-w.z)<7);if(st)return[st.name,(s.waystones||[]).includes(st.id)?'AN ATTUNED WAYSTONE':'A SILENT WAYSTONE'];
 if(biomeAt){const b=biomeAt(p.x,p.z)||{};let best=null,bw=.45;for(const r of REGIONS){const v=b[BIOME_KEY[r.id]||r.id];if(v>bw){bw=v;best=r;}}if(best)return[best.name,best.tag];}
 return['Elderwood',p.z<-150?'THE NORTHERN ROAD':'THE OPEN ROAD'];}
export function createUI(api){let active=null,merchant=null,quantity=1,toastTimer;const dialog=$('#panel'),rpgPanels=createRPGPanels();
 const ui={
  get active(){return active;},
  toast(message){if(dialog.open){$('#panel-feedback').textContent=message;$('#panel-feedback').hidden=false;}$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4200);},
  open(name,npc=null){api.pause();$('#panel-feedback').hidden=true;active=name;merchant=npc;ui.render();if(!dialog.open)dialog.showModal();$('#close-panel').focus();},
  close(shouldResume=true){if(!active)return;rpgPanels.cleanup();dialog.close();active=null;merchant=null;if(shouldResume&&api.started())api.resume();},
  render(){rpgPanels.cleanup();const s=api.state(),settings=api.settings;let title='',kicker='THE ELDERWOOD ROAD',html='';const rpg=rpgPanels.render(active,s,merchant),slain=Array.isArray(s.hero.bosses)?s.hero.bosses:[];
   if(rpg){({title,kicker,html}=rpg);}else if(active==='trade'){
    title=merchant.name;kicker=merchant.role.toUpperCase()+' · '+townName(merchant.town);
    html=`<p class="dialogue">“${greetings[merchant.id]||'A warm hearth, a bowl of something good, and a bed for the night. That’s all a traveller really needs.'}”</p>`;
    const q=QUESTS[s.quest];if(q.npc===merchant.id){html+=`<div class="journal-entry"><h3>${q.title}</h3><p>${q.text}</p><div class="dialogue-actions">${button('quest',s.quest===0?'How do I join the traders’ guild?':`Deliver ${q.qty} ${goodName(q.good)} · +${q.reward} coin`,s.quest>0&&s.inventory[q.good]<q.qty)}</div></div>`;}
    html+=`<div class="trade-head"><span><b class="trade-balance">◈ ${s.coins.toLocaleString()}</b> coin · ${cargoUsed(s)}/${s.capacity} carried</span><label>Quantity <select id="trade-qty" aria-label="Trade quantity">${[1,5,10].map(n=>`<option value="${n}" ${quantity===n?'selected':''}>${n}</option>`).join('')}</select></label></div><div class="trade-row trade-labels"><span>GOODS</span><span>STOCK</span><span>OWNED</span><span>BUY ${quantity}</span><span>SELL ${quantity}</span></div>`;
    const offers=OFFERS[merchant.role]||[];const items=[...new Set([...offers,...Object.keys(GOODS).filter(g=>s.inventory[g]>0)])];
    for(const g of items){const buy=quote(s,merchant.town,g,'buy')*quantity,sell=quote(s,merchant.town,g,'sell')*quantity,stock=s.stock[merchant.town]?.[g]??0;html+=`<div class="trade-row"><span class="good-name"><i class="good-mark">${GOODS[g].mark}</i>${GOODS[g].name}</span><small>${offers.includes(g)?stock:'—'}</small><span>${s.inventory[g]}</span>${button('buy',buy+' ◈',!offers.includes(g)||s.coins<buy||stock<quantity||cargoUsed(s)+quantity>s.capacity,`data-good="${g}"`)}${button('sell',sell+' ◈',s.inventory[g]<quantity,`data-good="${g}"`)}</div>`;}
    html+=`<p class="merchant-note">Prices shown are totals for ${quantity}. Stock, village demand, and the day’s events affect prices.</p>`;
    if(merchant.role==='innkeeper')html+=`<div class="dialogue-actions">${button('rest','A bed until morning · 8 coin',s.coins<8)}</div><p class="merchant-note">A new day restores wild plants and brings fresh goods to the markets.</p>`;
    if(merchant.role==='innkeeper'){const bo=bountyOffer(s,merchant.town),bs=Array.isArray(s.bounties)?s.bounties:[],mine=bs.filter(b=>!b.complete&&b.town===merchant.town),town=TOWNS.find(t=>t.id===merchant.town);
     if(bo){const taken=bs.some(b=>b.id===bo.id),full=bs.filter(b=>!b.complete).length>=3,where=haunts(bo.kind,town)[0],slain=s.hero.slain?.[bo.kind]||0;
      html+=`<div class="journal-entry bounty-board"><h3>The hunters’ board</h3><p class="bounty-offer"><b>Slay ${bo.need} × ${escapeHTML(kindName(bo.kind))}</b><span>◈ ${bo.reward} coin · ${bo.xp} XP</span></p><p>${where?'Seen near '+escapeHTML(where)+'. ':''}Every one you fell after accepting counts. Return to this inn to claim the purse.${slain?' You have slain '+slain+' before.':''}</p><div class="dialogue-actions">${button('bounty-accept',taken?'Today’s bounty taken':full?'Three bounties already open':'Accept bounty',taken||full)}</div>${full&&!taken?'<p class="merchant-note">Claim an open bounty before taking another.</p>':''}</div>`;}
     for(const b of mine){const done=b.have>=b.need;html+=`<div class="bounty-row ${done?'ready':''}"><span class="bounty-name"><b>${escapeHTML(kindName(b.kind))}</b><small>${Math.min(b.have,b.need)}/${b.need} slain · ${b.reward} coin · ${b.xp} XP</small><i class="bounty-track"><i style="width:${Math.min(100,b.have/b.need*100)}%"></i></i></span>${button('bounty-claim',done?'Claim bounty':(b.need-b.have)+' to go',!done,`data-id="${b.id}"`)}</div>`;}}
    if(merchant.role==='herbalist'){html+=`<h3 class="journal-heading">Brewing</h3><p class="merchant-note">Bring satchel goods and a few coins; ${escapeHTML(merchant.name)} brews them while you wait. Draughts and tonics weigh nothing in your satchel.</p><div class="brew-grid">`;
     for(const [id,b]of Object.entries(BREWS)){const have=s.hero.brews?.[id]||0,ok=canBrew(s,b)&&have<99,missing=Object.entries(b.recipe).filter(([g,q])=>s.inventory[g]<q).map(([g,q])=>(q-s.inventory[g])+' '+goodName(g).toLowerCase());
      html+=`<article class="weapon-card brew-card brew-${id}"><div class="weapon-card-top"><span>${id==='mana'?'Draught':'Tonic'}</span><small>${have} CARRIED</small></div><h3>${b.name}</h3><p>${b.description}</p><div class="weapon-stats"><span>${recipeText(b)}</span><span>${b.coin} coin</span></div><small class="brew-missing">${have>=99?'Your pouch is full.':missing.length?'Missing '+missing.join(', '):s.coins<b.coin?'Not enough coin':'Ingredients ready'}</small>${button('brew','Brew · '+b.coin+' ◈',!ok,`data-id="${id}"`)}</article>`;}
     html+='</div>';}
    if(merchant.id==='rowan')html+=`<div class="dialogue-actions">${button('upgrade',s.capacity===60?'Finest pack owned':`Larger satchel · ${s.capacity===30?100:200} coin`,s.capacity===60||s.coins<(s.capacity===30?100:200))}</div>`;
    if(DEALERS.includes(merchant.id))html+=`<div class="dialogue-actions">${button('rpg-shop','Browse weapons & provisions ↗')}</div>`;
    const offer=contractOffer(s,merchant.town);if(offer?.to)html+=`<div class="journal-entry"><h3>The delivery board</h3><p>Take ${offer.qty} ${goodName(offer.good).toLowerCase()} to ${townName(offer.to)}. Reward: ${offer.reward} coin. Supply the goods yourself; there is no deadline.</p><div class="dialogue-actions">${button('accept','Accept delivery',s.contracts.some(c=>c.id===offer.id)||s.contracts.filter(c=>!c.complete).length>=3)}</div></div>`;
    for(const c of s.contracts.filter(c=>!c.complete&&c.to===merchant.town))html+=`<div class="dialogue-actions">${button('complete',`Deliver ${c.qty} ${goodName(c.good)} · +${c.reward} coin`,s.inventory[c.good]<c.qty,`data-id="${c.id}"`)}</div>`;
   }else if(active==='inventory'){
    title='Your satchel';html=`<p class="merchant-note">${cargoUsed(s)} of ${s.capacity} spaces used · <span class="trade-balance">${s.coins.toLocaleString()} coin</span></p><div class="inventory-grid">`;
    for(const [id,g]of Object.entries(GOODS))html+=`<div class="inventory-item"><span class="good-mark">${g.mark}</span><div><strong>${g.name}</strong><small>${g.description}</small></div><b>${s.inventory[id]}</b></div>`;
    const brews=Object.entries(BREWS),carried=brews.reduce((n,[id])=>n+(s.hero.brews?.[id]||0),0),fx=s.hero.effects||{};
    html+=`</div><h3 class="journal-heading">Brews & tonics</h3><p class="merchant-note">${carried?plural(carried,'flask')+' in your pouch. G drinks a mana draught at any time.':'Your pouch is empty. Elin in Eldermere and Brenna in Frostwatch brew draughts and tonics from herbs, berries and mushrooms.'}</p><div class="brew-list">${brews.map(([id,b])=>{const have=s.hero.brews?.[id]||0,active=fx[id]>0;return`<div class="brew-row brew-${id} ${have?'':'empty'}"><span class="brew-flask" aria-hidden="true">${id==='mana'?'◆':id==='ironbark'?'⬢':'➶'}</span><div><strong>${b.name} <b>× ${have}</b></strong><small>${active?'Active · '+Math.ceil(fx[id])+'s left · ':''}${b.description}</small></div>${button('rpg-brew',active&&id!=='mana'?'Drink · renew':'Drink',have<1,`data-id="${id}" aria-label="Drink ${b.name}"`)}</div>`;}).join('')}</div>`;
    html+=`<p class="merchant-note">Merchants buy any goods you carry. Rowan sells larger satchels in Eldermere. Wild plants cost nothing to gather.</p><p class="merchant-note">${s.trades} trades · ${Math.round(s.profit).toLocaleString()} coin earned after the cost of goods sold</p>`;
   }else if(active==='journal'){
    const regions=REGIONS.filter(r=>(s.regions||[]).includes(r.id)).map(r=>r.name);
    title='The merchant’s journal';html=`<p class="merchant-note">Day ${s.day} · ${s.visits.length}/${TOWNS.length} settlements visited · ${s.discovered.length}/4 animal species observed · ${(s.waystones||[]).length}/${WAYSTONES.length||8} waystones attuned · ${(s.regions||[]).length}/${REGIONS.length||3} wild regions charted${regions.length?' ('+regions.join(', ')+')':''}</p>`;
    QUESTS.forEach((q,i)=>{if(i<=s.quest)html+=`<div class="journal-entry ${i<s.quest||s.quest===5?'complete':''}"><h3>${i<s.quest?'✓ ':''}${q.title}</h3><p>${q.text}</p></div>`;});
    html+=`<h3 class="journal-heading">Legends of the valley</h3><p class="merchant-note">${slain.length}/${BOSS_KEYS.length} sigils claimed. Each fallen legend yields its legendary weapon, skill points and a lasting boon of +12 health and +10 mana.</p>`;
    for(const k of BOSS_KEYS){const b=BOSSES[k],dead=slain.includes(k),sealed=!dead&&!bossRequirementsMet(k,slain),status=dead?'slain':sealed?'sealed':'awaits',weapon=WEAPONS[b.weapon]?.name||b.weapon;
     html+=`<div class="journal-entry legend-entry ${status}" style="--legend:${hex(b.color)}"><h3>${dead?'✓ ':''}${b.name}, ${b.title}</h3><p><span class="legend-status">${dead?'SLAIN':sealed?'SEALED':'AWAITS'}</span>${b.region} · recommended level ${b.level}${dead?` · ${b.sigil} · ${weapon} claimed`:` · guards ${weapon}`}</p><p class="legend-hint">${dead?'Its lair lies quiet. The '+b.sigil.replace(/^Sigil/,'sigil')+' hums in your pack. Its echo stirs at a stone within the lair: press E there to face it again, once a day.':sealed?'A rift sleeps within the Old Stones. It will not open until '+(b.requires||[]).filter(r=>!slain.includes(r)).map(r=>BOSSES[r].name).join(', ').replace(/, ([^,]*)$/,' and $1')+' '+((b.requires||[]).filter(r=>!slain.includes(r)).length>1?'have':'has')+' fallen.':HINTS[k]||''}</p></div>`;}
    if(s.contracts.length)html+='<h3>Delivery ledger</h3>';
    for(const c of s.contracts)html+=`<div class="journal-entry ${c.complete?'complete':''}"><h3>${c.complete?'✓ ':''}${c.qty} ${goodName(c.good)} → ${townName(c.to)}</h3><p>${c.complete?'Delivered':s.inventory[c.good]+'/'+c.qty+' carried'} · ${c.reward} coin reward</p></div>`;
    const bounties=Array.isArray(s.bounties)?[...s.bounties.filter(b=>!b.complete),...s.bounties.filter(b=>b.complete).reverse()]:[];
    if(bounties.length){html+=`<h3 class="journal-heading">Hunters’ bounties</h3><p class="merchant-note">${s.bounties.filter(b=>!b.complete).length}/3 open · ${s.bounties.filter(b=>b.complete).length} claimed. Innkeepers post a new bounty each day.</p>`;
     for(const b of bounties.slice(0,12)){const done=b.have>=b.need;html+=`<div class="journal-entry bounty-entry ${b.complete?'complete':done?'ready':''}"><h3>${b.complete?'✓ ':''}${b.need} × ${escapeHTML(kindName(b.kind))}</h3><p>${b.complete?'Claimed':done?'Ready to claim':Math.min(b.have,b.need)+'/'+b.need+' slain'} at ${townName(b.town)}’s inn · ${b.reward} coin · ${b.xp} XP</p>${b.complete?'':`<i class="bounty-track"><i style="width:${Math.min(100,b.have/b.need*100)}%"></i></i>`}</div>`;}}
    const slainBy=s.hero.slain&&typeof s.hero.slain==='object'?s.hero.slain:{},foes=Object.keys(ENEMY_DEFS).filter(k=>k!=='dummy'),known=foes.filter(k=>slainBy[k]>0).length;
    html+=`<h3 class="journal-heading">Bestiary</h3><p class="merchant-note">${known}/${foes.length} creatures recorded · ${Object.values(slainBy).reduce((a,b)=>a+(Number(b)||0),0).toLocaleString()} foes felled. Weaknesses are noted once you have slain one.</p><div class="bestiary">`;
    for(const k of foes){const d=ENEMY_DEFS[k],n=slainBy[k]||0,where=haunts(k);html+=`<div class="beast ${n?'':'unknown'}"><strong>${escapeHTML(d.name)}</strong><b>${n?'× '+n.toLocaleString():''}</b><small>${n?affinityText(d.affinity):'Not yet slain'}${where.length?' · '+escapeHTML(where.slice(0,2).join(', ')):''}</small></div>`;}
    for(const k of BOSS_KEYS){const b=BOSSES[k],n=slainBy[b.kind]||0,fallen=slain.includes(k),echo=s.hero.echoes?.[k]===s.day;html+=`<div class="beast legend ${n||fallen?'':'unknown'}" style="--legend:${hex(b.color)}"><strong>${escapeHTML(b.name)}<em>${escapeHTML(b.title)}</em></strong><b>${n?'× '+n.toLocaleString():''}</b><small>${n||fallen?affinityText(b.affinity):'Not yet slain'}</small>${fallen?`<span class="echo-status ${echo?'bested':''}">${echo?'Echo bested today':'Echo ready · E at the echo stone in '+escapeHTML(LAIRS[k]||b.region)}</span>`:''}</div>`;}
    html+='</div>';
    html+=`<div class="journal-log">${s.log.slice(-10).reverse().map(l=>`<div>${escapeHTML(l)}</div>`).join('')}</div>`;
   }else if(active==='map'){
    title='Elderwood & the wilds';html='<canvas id="large-map" class="map-canvas" width="900" height="720" aria-label="World map: Eldermere at the centre, Mossbrook northwest, Ironhold northeast, Frostwatch and the White Pass far north, Mirefen Marsh southwest, Cinder Reach east"></canvas><div class="map-legend"><span>▲ You</span><span>● Settlements</span><span class="lg-way">◆ Waystones · bright when attuned</span><span class="lg-legend">◉ Legends · dashed ring marks the arena</span><span class="lg-echo">◆ Echo stones · call back a fallen legend once a day</span><span>━ Roads</span><span class="lg-red">▲ Hostile encounters</span><span class="lg-blue">● Arcane practice</span><span class="lg-lava">● Lava</span></div><p class="merchant-note">Frostwatch guards the northern road; beyond it the White Pass climbs to Hrimfang’s glacier. Mirefen Marsh drowns the southwest and Cinder Reach smoulders in the east. The Old Stones hold a sealed rift. Attune waystones by walking up to them, then travel between them for 12 coin.</p>';
   }else if(active==='travel'){
    const here=api.waystoneHere?.()??null,fight=!!api.bossActive?.(),poor=s.coins<TRAVEL_COST,p=s.position,owned=Array.isArray(s.waystones)?s.waystones:[];
    title='The waystones';kicker='RUNESTONES OF THE OLD ROADS';
    html=`<p class="merchant-note">Lay a hand on the rune and step through to any attuned stone. Each journey costs ${TRAVEL_COST} coin and an hour on the road. <b class="trade-balance">◈ ${s.coins.toLocaleString()} coin</b> · ${owned.length}/${WAYSTONES.length||owned.length} attuned</p>`;
    if(fight)html+='<p class="travel-warning">The stones fall silent while a legend hunts you. Win the fight, or flee its lair.</p>';else if(poor)html+=`<p class="travel-warning">You need ${TRAVEL_COST} coin to travel.</p>`;
    html+='<div class="waystone-list">'+WAYSTONES.map(st=>{const on=owned.includes(st.id),at=here===st.id,d=Math.round(Math.hypot(st.x-p.x,st.z-p.z)),[,tag]=placeName({...s,position:{x:st.x,z:st.z}},null);
     return`<div class="waystone-row ${at?'here':on?'':'dormant'}"><span class="waystone-rune" aria-hidden="true">ᛟ</span><div><strong>${st.name}</strong><small>${on?(at?'You stand here':d+' m away')+' · '+tag.toLowerCase():'Not yet attuned · walk up to the stone to wake it'}</small></div>${on?button('travel',at?'You are here':`Travel · ${TRAVEL_COST} ◈`,at||poor||fight,`data-id="${st.id}"`):''}</div>`;}).join('')+'</div>';
    if(!WAYSTONES.length)html+='<p class="merchant-note">No waystones stand in this valley.</p>';
   }else if(active==='reset'){
    title='Begin a new tale?';html='<p class="dialogue">Your current journey will be replaced.</p><p class="merchant-note">Your Captain’s Chart saves are separate.</p><div class="dialogue-actions">'+button('confirm-reset','Begin again')+button('cancel-reset','Keep my journey')+'</div>';
   }else{
    title=api.started()?'Rest a moment':'Settings';
    html=`<div class="setting"><label for="sensitivity">Look sensitivity</label><input id="sensitivity" type="range" min="0.3" max="2" step="0.1" value="${settings.sensitivity}"></div><div class="setting"><label for="sound">Valley sounds<small>Birdsong, wind and fen, footsteps, spells, impacts, battle drums and trading chimes</small></label><input id="sound" type="checkbox" ${settings.sound?'checked':''}></div><div class="setting"><label for="motion">Gentle camera<small>Disable head bob, all camera shake and scenic camera motion</small></label><input id="motion" type="checkbox" ${settings.reducedMotion?'checked':''}></div><div class="setting"><label for="shake">Screen shake<small>Jolt the camera on heavy blows, stomps and impacts</small></label><input id="shake" type="checkbox" ${settings.shake!==false?'checked':''}></div><div class="setting"><label for="invert">Invert vertical look</label><input id="invert" type="checkbox" ${settings.invert?'checked':''}></div><div class="setting"><label for="quality">Graphics quality</label><select id="quality"><option value="high" ${settings.quality==='high'?'selected':''}>High</option><option value="low" ${settings.quality==='low'?'selected':''}>Low</option></select></div><p class="merchant-note">WASD / arrows: walk · Shift: run · Mouse: look · E: interact / use a waystone<br>I: satchel · J: journal · M: map · Esc: pause<br>Left click / Space: attack, keep swinging for a combo · Hold attack: heavy blow<br>R / right mouse: guard · Guard just before a hit: parry · V / Ctrl: dodge roll · F: healing draught · G: mana draught<br>1–4: spells (hold Sunlance to channel) · Z: select / aim · Q: cast selected · B: spellbook · C: character · Tab: equipment<br>If mouse capture is unavailable, hold and drag the view to look around. Touch: left pad to walk, right side to look; hold Attack for a heavy blow.</p>`;
    if(api.started())html+=`<div class="dialogue-actions">${button('resume','Continue journey')}${button('save','Save journey')}${button('title','Return to title')}</div><p class="merchant-note">Your journey saves automatically on this browser. Time stops while menus are open.</p>`;
   }
   $('#panel-title').textContent=title;$('#panel-kicker').textContent=kicker;$('#panel-body').innerHTML=html;if(active==='map')drawMap($('#large-map'),s);if(rpg)rpgPanels.afterRender(active,s);
  },
  update(){const s=api.state(),pos=s.position,slain=s.hero?.bosses?.length||0;$('#coins').textContent=s.coins.toLocaleString();$('#day').textContent='Day '+s.day;$('#time').textContent=`${String(Math.floor(s.time/60)).padStart(2,'0')}:${String(Math.floor(s.time%60)).padStart(2,'0')}`;$('#pack').textContent=`Satchel ${cargoUsed(s)} / ${s.capacity}`;$('#world-event').textContent=currentEvent(s).text;const [place,tag]=placeName(s,api.room());$('#location').textContent=place;$('#region').textContent=tag;let degrees=(((-pos.yaw*180/Math.PI)%360)+360)%360;$('#bearing').textContent=['N','NE','E','SE','S','SW','W','NW'][Math.round(degrees/45)%8];const q=QUESTS[s.quest];$('#objective').textContent=q.title;$('#objective-detail').textContent=s.quest===0?'Speak to Rowan at the west stall.':s.quest===1?`${s.inventory.herbs}/3 herbs · bring them to Elin`:s.quest===2?`${s.inventory.grain}/6 grain · deliver to Agnes`:s.quest===3?`${s.inventory.iron}/4 iron · deliver to Rowan`:s.quest===4?`${s.coins}/1,000 coin · ${MARKET_TOWNS.filter(t=>s.visits.includes(t)).length}/${MARKET_TOWNS.length} market towns`:slain<BOSS_KEYS.length?`Guild charter earned · legends slain ${slain}/${BOSS_KEYS.length}`:'Guild charter earned · every legend has fallen.';drawMap($('#minimap'),s,true);}
 };
 $('#close-panel').onclick=()=>ui.close();dialog.addEventListener('cancel',e=>{e.preventDefault();ui.close();});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)ui.close();}});
 $('#panel-body').addEventListener('change',e=>{const t=e.target;if(t.id==='trade-qty'){quantity=Number(t.value);ui.render();return;}if(t.id==='sound')api.settings.sound=t.checked;if(t.id==='motion')api.settings.reducedMotion=t.checked;if(t.id==='shake')api.settings.shake=t.checked;if(t.id==='invert')api.settings.invert=t.checked;if(t.id==='quality')api.settings.quality=t.value;if(t.id==='sensitivity')api.settings.sensitivity=Number(t.value);api.settingsChanged();});
 $('#panel-body').addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const action=b.dataset.action;let result;
  if(action.startsWith('rpg-')){
   if(action==='rpg-preview'){rpgPanels.select(b.dataset.id);ui.render();return;}
   if(action==='rpg-tab'){if(b.dataset.view==='characters'&&!api.canChangeCharacter()){ui.toast('Return to a settlement to change character.');return;}ui.open(b.dataset.view,merchant);return;}
   if(action==='rpg-shop'){ui.open('armory',merchant);return;}
   const result=api.rpgAction(action,{id:b.dataset.id,slot:Number(b.dataset.slot),merchant});
   if(result?.enter){ui.close(false);api.begin();return;}
   if(result){ui.render();ui.update();ui.toast(result.message);}return;
  }
  if(action==='travel'){result=api.travel?.(b.dataset.id)||{ok:false,message:'The waystones are silent.'};if(result.ok){ui.close();ui.update();}else ui.render();if(result.message)ui.toast(result.message);return;}
  if(action==='resume'){ui.close();return;}if(action==='title'){ui.close(false);api.title();return;}if(action==='confirm-reset'){ui.close(false);api.reset();return;}if(action==='cancel-reset'){ui.close();return;}if(action==='save'){api.save(true);return;}
  if(merchant){result=api.action(action,{merchant,good:b.dataset.good,quantity,id:b.dataset.id});}
  if(result){ui.render();ui.update();ui.toast(result.message);}
 });
 document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>ui.open(b.dataset.panel));return ui;
}
