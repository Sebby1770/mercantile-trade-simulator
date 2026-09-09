import {createRPGPanels} from './rpg-ui.js';
import {ENCOUNTERS} from './combat.js';
import {GOODS,BIASES,OFFERS,QUESTS,cargoUsed,quote,currentEvent,contractOffer} from './economy.js';
import {TOWNS,ROADS} from './world.js';
const $=s=>document.querySelector(s);
export const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const townName=id=>TOWNS.find(t=>t.id===id)?.name||id;
const goodName=id=>GOODS[id]?.name||id;
const button=(action,text,disabled=false,extra='')=>`<button data-action="${action}" ${disabled?'disabled':''} ${extra}>${text}</button>`;
const greetings={
 rowan:'A merchant is only as good as the road they’re willing to take. Welcome to Eldermere, traveller.',
 elin:'Silverleaf by the road, lavender beneath the oaks. The valley provides, if you know where to look.',
 agnes:'We’ve more barley than barn space this year. Take a sack north: a miner can’t eat iron.',
 tilda:'Every thread has a story. Mine usually begins with a sheep and ends with a long afternoon.',
 gareth:'Good iron. Honest weight. Bring me timber for the furnace and we’ll both do well.',
 ida:'The garrison has coin, and precious little patience. Grain and herbs are always welcome here.'
};
export function drawMap(canvas,state,mini=false){const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.fillStyle=mini?'#243b2c':'#263d30';ctx.fillRect(0,0,w,h);const scale=mini?w/90:Math.min(w/330,h/255);const cx=mini?state.position.x:10,cz=mini?state.position.z:-50;const px=x=>(x-cx)*scale+w/2,pz=z=>(z-cz)*scale+h/2;
 ctx.strokeStyle='#425641';ctx.lineWidth=1;const spacing=20;for(let x=-180;x<=200;x+=spacing){ctx.beginPath();ctx.moveTo(px(x),0);ctx.lineTo(px(x),h);ctx.stroke();}for(let z=-180;z<=150;z+=spacing){ctx.beginPath();ctx.moveTo(0,pz(z));ctx.lineTo(w,pz(z));ctx.stroke();}
 ctx.fillStyle='#65918b';ctx.fillRect(px(50),0,12*scale,h);ctx.strokeStyle='#bca878';ctx.lineCap='round';ctx.lineWidth=mini?2:3;for(const line of ROADS){ctx.beginPath();line.forEach(([x,z],i)=>i?ctx.lineTo(px(x),pz(z)):ctx.moveTo(px(x),pz(z)));ctx.stroke();}
 for(const z of [-55,32]){ctx.fillStyle='#cfb681';ctx.fillRect(px(48),pz(z)-3,16*scale,6);}
 for(const t of TOWNS){if(mini){ctx.fillStyle='#c7bd94';for(const [dx,dz]of[[-11,-15],[11,-15],[-20,4],[20,4]])ctx.fillRect(px(t.x+dx)-3,pz(t.z+dz)-3,6,6);}ctx.fillStyle=state.visits.includes(t.id)?'#e8cd8e':'#8e9c72';ctx.beginPath();ctx.arc(px(t.x),pz(t.z),mini?3:6,0,Math.PI*2);ctx.fill();if(!mini){ctx.font='22px Georgia';ctx.textAlign='center';ctx.fillStyle='#f1e6bb';ctx.fillText(t.name,px(t.x),pz(t.z)-16);ctx.font='12px sans-serif';ctx.fillStyle='#b4c5a3';ctx.fillText(t.id==='eldermere'?'Timber · Cloth':t.id==='mossbrook'?'Grain · Wool':'Iron · Mushrooms',px(t.x),pz(t.z)+23);}}
 if(!mini){ctx.fillStyle='#90a47f';ctx.font='italic 17px Georgia';ctx.textAlign='center';ctx.fillText('E l d e r w o o d',px(-39),pz(41));ctx.fillText('The Old Stones',px(-66),pz(-135));ctx.save();ctx.translate(px(68),pz(15));ctx.rotate(Math.PI/2);ctx.font='italic 15px Georgia';ctx.fillStyle='#9bc0b0';ctx.fillText('River Wren',0,0);ctx.restore();ctx.fillStyle='#d9c388';ctx.font='20px Georgia';ctx.fillText('N',w-28,30);ctx.beginPath();ctx.moveTo(w-28,40);ctx.lineTo(w-33,54);ctx.lineTo(w-23,54);ctx.closePath();ctx.fill();}
 for(const camp of ENCOUNTERS){ctx.fillStyle='#c98879';ctx.beginPath();ctx.moveTo(px(camp.x),pz(camp.z)-4);ctx.lineTo(px(camp.x)-4,pz(camp.z)+4);ctx.lineTo(px(camp.x)+4,pz(camp.z)+4);ctx.closePath();ctx.fill();}
 ctx.save();ctx.translate(px(state.position.x),pz(state.position.z));ctx.rotate(-state.position.yaw);ctx.fillStyle='#fff1b9';ctx.strokeStyle='#253827';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(-5,5);ctx.lineTo(0,3);ctx.lineTo(5,5);ctx.closePath();ctx.stroke();ctx.fill();ctx.restore();
}
export function createUI(api){let active=null,merchant=null,quantity=1,toastTimer;const dialog=$('#panel'),rpgPanels=createRPGPanels();
 const ui={
  get active(){return active;},
  toast(message){if(dialog.open){$('#panel-feedback').textContent=message;$('#panel-feedback').hidden=false;}$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4200);},
  open(name,npc=null){api.pause();$('#panel-feedback').hidden=true;active=name;merchant=npc;ui.render();if(!dialog.open)dialog.showModal();$('#close-panel').focus();},
  close(shouldResume=true){if(!active)return;rpgPanels.cleanup();dialog.close();active=null;merchant=null;if(shouldResume&&api.started())api.resume();},
  render(){rpgPanels.cleanup();const s=api.state(),settings=api.settings;let title='',kicker='THE ELDERWOOD ROAD',html='';const rpg=rpgPanels.render(active,s,merchant);
   if(rpg){({title,kicker,html}=rpg);}else if(active==='trade'){
    title=merchant.name;kicker=merchant.role.toUpperCase()+' · '+townName(merchant.town);
    html=`<p class="dialogue">“${greetings[merchant.id]||'A warm hearth, a bowl of something good, and a bed for the night. That’s all a traveller really needs.'}”</p>`;
    const q=QUESTS[s.quest];if(q.npc===merchant.id){html+=`<div class="journal-entry"><h3>${q.title}</h3><p>${q.text}</p><div class="dialogue-actions">${button('quest',s.quest===0?'How do I join the traders’ guild?':`Deliver ${q.qty} ${goodName(q.good)} · +${q.reward} coin`,s.quest>0&&s.inventory[q.good]<q.qty)}</div></div>`;}
    html+=`<div class="trade-head"><span><b class="trade-balance">◈ ${s.coins.toLocaleString()}</b> coin · ${cargoUsed(s)}/${s.capacity} carried</span><label>Quantity <select id="trade-qty" aria-label="Trade quantity">${[1,5,10].map(n=>`<option value="${n}" ${quantity===n?'selected':''}>${n}</option>`).join('')}</select></label></div><div class="trade-row trade-labels"><span>GOODS</span><span>STOCK</span><span>OWNED</span><span>BUY ${quantity}</span><span>SELL ${quantity}</span></div>`;
    const offers=OFFERS[merchant.role];const items=[...new Set([...offers,...Object.keys(GOODS).filter(g=>s.inventory[g]>0)])];
    for(const g of items){const buy=quote(s,merchant.town,g,'buy')*quantity,sell=quote(s,merchant.town,g,'sell')*quantity;html+=`<div class="trade-row"><span class="good-name"><i class="good-mark">${GOODS[g].mark}</i>${GOODS[g].name}</span><small>${offers.includes(g)?s.stock[merchant.town][g]:'—'}</small><span>${s.inventory[g]}</span>${button('buy',buy+' ◈',!offers.includes(g)||s.coins<buy||s.stock[merchant.town][g]<quantity||cargoUsed(s)+quantity>s.capacity,`data-good="${g}"`)}${button('sell',sell+' ◈',s.inventory[g]<quantity,`data-good="${g}"`)}</div>`;}
    html+=`<p class="merchant-note">Prices shown are totals for ${quantity}. Stock, village demand, and the day’s events affect prices.</p>`;
    if(merchant.role==='innkeeper')html+=`<div class="dialogue-actions">${button('rest','A bed until morning · 8 coin',s.coins<8)}</div><p class="merchant-note">A new day restores wild plants and brings fresh goods to the markets.</p>`;
    if(merchant.id==='rowan')html+=`<div class="dialogue-actions">${button('upgrade',s.capacity===60?'Finest pack owned':`Larger satchel · ${s.capacity===30?100:200} coin`,s.capacity===60||s.coins<(s.capacity===30?100:200))}</div>`;
    if(['rowan','gareth'].includes(merchant.id))html+=`<div class="dialogue-actions">${button('rpg-shop','Browse weapons & provisions ↗')}</div>`;
    const offer=contractOffer(s,merchant.town);html+=`<div class="journal-entry"><h3>The delivery board</h3><p>Take ${offer.qty} ${goodName(offer.good).toLowerCase()} to ${townName(offer.to)}. Reward: ${offer.reward} coin. Supply the goods yourself; there is no deadline.</p><div class="dialogue-actions">${button('accept','Accept delivery',s.contracts.some(c=>c.id===offer.id)||s.contracts.filter(c=>!c.complete).length>=3)}</div></div>`;
    for(const c of s.contracts.filter(c=>!c.complete&&c.to===merchant.town))html+=`<div class="dialogue-actions">${button('complete',`Deliver ${c.qty} ${goodName(c.good)} · +${c.reward} coin`,s.inventory[c.good]<c.qty,`data-id="${c.id}"`)}</div>`;
   }else if(active==='inventory'){
    title='Your satchel';html=`<p class="merchant-note">${cargoUsed(s)} of ${s.capacity} spaces used · <span class="trade-balance">${s.coins.toLocaleString()} coin</span></p><div class="inventory-grid">`;
    for(const [id,g]of Object.entries(GOODS))html+=`<div class="inventory-item"><span class="good-mark">${g.mark}</span><div><strong>${g.name}</strong><small>${g.description}</small></div><b>${s.inventory[id]}</b></div>`;
    html+=`</div><p class="merchant-note">Merchants buy any goods you carry. Rowan sells larger satchels in Eldermere. Wild plants cost nothing to gather.</p><p class="merchant-note">${s.trades} trades · ${Math.round(s.profit).toLocaleString()} coin earned after the cost of goods sold</p>`;
   }else if(active==='journal'){
    title='The merchant’s journal';html=`<p class="merchant-note">Day ${s.day} · ${s.visits.length}/3 settlements visited · ${s.discovered.length}/4 animal species observed</p>`;
    QUESTS.forEach((q,i)=>{if(i<=s.quest)html+=`<div class="journal-entry ${i<s.quest||s.quest===5?'complete':''}"><h3>${i<s.quest?'✓ ':''}${q.title}</h3><p>${q.text}</p></div>`;});
    if(s.contracts.length)html+='<h3>Delivery ledger</h3>';
    for(const c of s.contracts)html+=`<div class="journal-entry ${c.complete?'complete':''}"><h3>${c.complete?'✓ ':''}${c.qty} ${goodName(c.good)} → ${townName(c.to)}</h3><p>${c.complete?'Delivered':s.inventory[c.good]+'/'+c.qty+' carried'} · ${c.reward} coin reward</p></div>`;
    html+=`<div class="journal-log">${s.log.slice(-10).reverse().map(l=>`<div>${escapeHTML(l)}</div>`).join('')}</div>`;
   }else if(active==='map'){
    title='The valley of Elderwood';html='<canvas id="large-map" class="map-canvas" width="900" height="650" aria-label="Valley map: Mossbrook northwest, Eldermere south, Ironhold northeast; two river bridges connect the eastern road"></canvas><div class="map-legend"><span>▲ You</span><span>● Settlements</span><span>━ Trading roads</span><span>Blue · River Wren</span><span>Red ▲ · Hostile encounters</span></div><p class="merchant-note">Mossbrook grows grain and wool. Ironhold forges iron. Eldermere supplies timber and cloth. Walk the roads to discover new markets.</p>';
   }else if(active==='reset'){
    title='Begin a new tale?';html='<p class="dialogue">Your current journey will be replaced.</p><p class="merchant-note">Your Captain’s Chart saves are separate.</p><div class="dialogue-actions">'+button('confirm-reset','Begin again')+button('cancel-reset','Keep my journey')+'</div>';
   }else{
    title=api.started()?'Rest a moment':'Settings';
    html=`<div class="setting"><label for="sensitivity">Look sensitivity</label><input id="sensitivity" type="range" min="0.3" max="2" step="0.1" value="${settings.sensitivity}"></div><div class="setting"><label for="sound">Valley sounds<small>Birdsong, footsteps, and trading chimes</small></label><input id="sound" type="checkbox" ${settings.sound?'checked':''}></div><div class="setting"><label for="motion">Gentle camera<small>Disable head bob and scenic camera motion</small></label><input id="motion" type="checkbox" ${settings.reducedMotion?'checked':''}></div><div class="setting"><label for="invert">Invert vertical look</label><input id="invert" type="checkbox" ${settings.invert?'checked':''}></div><div class="setting"><label for="quality">Graphics quality</label><select id="quality"><option value="high" ${settings.quality==='high'?'selected':''}>High</option><option value="low" ${settings.quality==='low'?'selected':''}>Low</option></select></div><p class="merchant-note">WASD / arrows: walk · Shift: run · Mouse: look · E: interact<br>I: satchel · J: journal · M: map · Esc: pause<br>Left click / Space: attack · R: guard · F: healing draught<br>1–4: spells · Q: selected spell · B: spellbook · C: character · Tab: equipment<br>If mouse capture is unavailable, hold and drag the view to look around. Touch: left pad to walk, right side to look.</p>`;
    if(api.started())html+=`<div class="dialogue-actions">${button('resume','Continue journey')}${button('save','Save journey')}${button('title','Return to title')}</div><p class="merchant-note">Your journey saves automatically on this browser. Time stops while menus are open.</p>`;
   }
   $('#panel-title').textContent=title;$('#panel-kicker').textContent=kicker;$('#panel-body').innerHTML=html;if(active==='map')drawMap($('#large-map'),s);if(rpg)rpgPanels.afterRender(active,s);
  },
  update(){const s=api.state(),pos=s.position;$('#coins').textContent=s.coins.toLocaleString();$('#day').textContent='Day '+s.day;$('#time').textContent=`${String(Math.floor(s.time/60)).padStart(2,'0')}:${String(Math.floor(s.time%60)).padStart(2,'0')}`;$('#pack').textContent=`Satchel ${cargoUsed(s)} / ${s.capacity}`;$('#world-event').textContent=currentEvent(s).text;const t=TOWNS.find(t=>Math.hypot(pos.x-t.x,pos.z-t.z)<33),room=api.room();$('#location').textContent=room?.name||t?.name||'Elderwood';$('#region').textContent=room?'A WARM WELCOME':t?.tag||'THE OPEN ROAD';let degrees=(((-pos.yaw*180/Math.PI)%360)+360)%360;$('#bearing').textContent=['N','NE','E','SE','S','SW','W','NW'][Math.round(degrees/45)%8];const q=QUESTS[s.quest];$('#objective').textContent=q.title;$('#objective-detail').textContent=s.quest===0?'Speak to Rowan at the west stall.':s.quest===1?`${s.inventory.herbs}/3 herbs · bring them to Elin`:s.quest===2?`${s.inventory.grain}/6 grain · deliver to Agnes`:s.quest===3?`${s.inventory.iron}/4 iron · deliver to Rowan`:s.quest===4?`${s.coins}/1,000 coin · ${s.visits.length}/3 settlements`:'Guild charter earned · the road is yours.';drawMap($('#minimap'),s,true);}
 };
 $('#close-panel').onclick=()=>ui.close();dialog.addEventListener('cancel',e=>{e.preventDefault();ui.close();});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)ui.close();}});
 $('#panel-body').addEventListener('change',e=>{const t=e.target;if(t.id==='trade-qty'){quantity=Number(t.value);ui.render();return;}if(t.id==='sound')api.settings.sound=t.checked;if(t.id==='motion')api.settings.reducedMotion=t.checked;if(t.id==='invert')api.settings.invert=t.checked;if(t.id==='quality')api.settings.quality=t.value;if(t.id==='sensitivity')api.settings.sensitivity=Number(t.value);api.settingsChanged();});
 $('#panel-body').addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const action=b.dataset.action;let result;
  if(action.startsWith('rpg-')){
   if(action==='rpg-preview'){rpgPanels.select(b.dataset.id);ui.render();return;}
   if(action==='rpg-tab'){if(b.dataset.view==='characters'&&!api.canChangeCharacter()){ui.toast('Return to a settlement to change character.');return;}ui.open(b.dataset.view,merchant);return;}
   if(action==='rpg-shop'){ui.open('armory',merchant);return;}
   const result=api.rpgAction(action,{id:b.dataset.id,slot:Number(b.dataset.slot),merchant});
   if(result?.enter){ui.close(false);api.begin();return;}
   if(result){ui.render();ui.update();ui.toast(result.message);}return;
  }
  if(action==='resume'){ui.close();return;}if(action==='title'){ui.close(false);api.title();return;}if(action==='confirm-reset'){ui.close(false);api.reset();return;}if(action==='cancel-reset'){ui.close();return;}if(action==='save'){api.save(true);return;}
  if(merchant){result=api.action(action,{merchant,good:b.dataset.good,quantity,id:b.dataset.id});}
  if(result){ui.render();ui.update();ui.toast(result.message);}
 });
 document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>ui.open(b.dataset.panel));return ui;
}
