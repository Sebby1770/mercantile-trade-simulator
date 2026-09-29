import * as T from '../vendor/three.module.js';
import {SPELLS} from './rpg.js';
import {BOSSES} from './bosses.js';

const hex=(c,d='#ffffff')=>Number.isFinite(c)?'#'+(c>>>0&0xffffff).toString(16).padStart(6,'0'):d;
const COMBOS={shatter:['SHATTER','SHATTER · Frost + fire','#ffd19e'],conduction:['CONDUCTION','CONDUCTION · Frost + lightning','#afdfff'],overload:['OVERLOAD','OVERLOAD · Fire + lightning','#ffd27a']};
const TAGS={RIPOSTE:'#ffd36b',BACKSTAB:'#ff9f6b'};
// Floating numbers, callouts (priority-gated so boss chatter never hides a parry) and the legend banner. Every element is optional.
export function createCombatFeedback(camera){
 const doc=globalThis.document,get=id=>doc?.getElementById?.(id)||null;
 const layer=get('combat-numbers'),reticle=get('crosshair'),callout=get('combat-callout'),banner=get('boss-banner'),parts=banner?['small','strong','span'].map(s=>banner.querySelector?.(s)||null):[];
 const labels=[];let hit=0,notice=0,rank=0,shown=0,bannerTime=0,bannerTotal=1,visibleNow=true;
 function label(e,text,color,{large=false,size=0,pop=false,life}={}){
  if(!layer||!doc?.createElement||!Number.isFinite(e?.x)||!Number.isFinite(e?.z))return;const node=doc.createElement('span');node.className='damage-number'+(large?' combo-number':'');node.textContent=text;node.style.color=color;if(size)node.style.fontSize=size+'px';layer.append(node);
  const total=life??(large?1.5:.9);labels.push({node,x:e.x,y:Number.isFinite(e.y)?e.y:1,z:e.z,life:total,total,pop,offset:(Math.random()-.5)*36});while(labels.length>24)labels.shift().node.remove();}
 function announce(text,color,priority=1,duration=1.8){if(!callout||!text)return;if(notice>0&&priority<rank)return;callout.textContent=text;callout.style.color=color;callout.hidden=!visibleNow;notice=duration;rank=priority;}
 function showBanner(kicker,name,sub,defeat,duration){if(!banner)return;const [a,b,c]=parts;if(a)a.textContent=kicker;if(b)b.textContent=name||'';if(c)c.textContent=sub||'';banner.classList?.toggle('defeat',!!defeat);if(banner.style){banner.style.animation='none';void banner.offsetWidth;banner.style.animation='';banner.style.opacity='1';}banner.hidden=!visibleNow;bannerTime=bannerTotal=duration;}
 function hideBanner(){bannerTime=0;if(banner){banner.hidden=true;banner.classList?.remove('defeat');}}
 function clear(){for(const l of labels)l.node.remove();labels.length=0;hit=notice=rank=shown=0;reticle?.classList.remove('hit');if(callout)callout.hidden=true;hideBanner();}
 function pulse(){hit=.16;reticle?.classList.add('hit');}
 function emit(e){
  if(!e||typeof e!=='object')return;const t=e.type,def=BOSSES[e.boss],bossColor=hex(e.color??def?.color,'#f3d58f');
  if(t==='clear'){clear();return;}
  if(t==='hit'){pulse();const amount=String(Math.max(0,Math.round(Number(e.amount)||0)));
   if(e.periodic)label(e,amount,e.resist?'#a39b90':'#eaba88',{size:e.resist?13:15});
   else{const color=e.resist?'#9aa3ad':e.crit?'#ffd36b':e.weak?'#ffb36b':'#fff4d6';label(e,e.crit?amount+'!':amount,color,{size:e.resist?14:e.crit?28:e.weak?23:0,pop:e.crit||e.weak});if(e.tag)label({...e,y:(Number(e.y)||0)+.45},e.tag,TAGS[e.tag]||'#ffd36b',{large:true,life:1.1});else if(e.weak&&!e.training&&shown<=0){label({...e,y:(Number(e.y)||0)+.4},'WEAK','#ffb36b',{large:true,size:12,life:1});shown=.6;}}
   return;}
  if(t==='combo'){const c=COMBOS[e.combo]||COMBOS.shatter;label({...e,y:(Number(e.y)||0)+.4},c[0],c[2],{large:true,pop:true});announce(c[1],e.combo==='overload'?'#ffe2a6':'#d2e6ff',2);return;}
  if(t==='parry'){pulse();announce('PARRY · riposte ready','#ffe6a0',3,1.6);return;}
  if(t==='evade'){if(e.perfect)announce('PERFECT DODGE · riposte ready','#ffe08a',3,1.6);else announce('EVADED','#b8dcff',1,.9);return;}
  if(t==='stagger'){if(e.boss){label(e,'BROKEN','#ffe27a',{large:true,size:22,pop:true,life:1.6});announce('BROKEN · strike now','#ffe27a',3,2);}else label(e,'STAGGERED','#ffe9a3',{large:true,size:13,life:1.1});return;}
  if(t==='guard-break'){announce('GUARD BROKEN · out of stamina','#ff8a6a',3,1.6);return;}
  if(t==='hurt'){if(e.unblockable)announce('UNBLOCKABLE · dodge through it','#ff4f9a',4,1.6);return;}
  if(t==='reflect'){label(e,'REFLECTED','#ffe6a0',{large:true,size:13,life:1});return;}
  if(t==='guard'){announce('GUARDED · '+(Math.round(Number(e.absorbed)||0))+' absorbed','#b8d6ee',1);return;}
  if(t==='cast'||t==='channel-start'){const n=SPELLS[e.spell]?.name;if(n)announce(n,'#d6e1f7',0,1.4);return;}
  if(t==='level'){announce('LEVEL '+e.level+' · Strength renewed','#f4d697',3,2.4);return;}
  if(t==='heal'){if(e.amount>0)announce('RESTORED · +'+e.amount+' health','#a3e8bd',1);return;}
  if(t==='boss-cast'){const who=def?.name||e.bossName;if(e.name)announce(who?who+' · '+e.name:e.name,bossColor,2,1.6);return;}
  if(t==='boss-phase'){const line=e.line||def?.lines?.[(e.phase|0)-1];if(line)announce(line,bossColor,4,3.4);return;}
  if(t==='boss-awaken'){showBanner('A LEGEND AWAKENS',e.name||def?.name,e.title||def?.title,false,4.2);return;}
  if(t==='boss-defeat'){const sub=[e.weaponName?e.weaponName+' claimed':'',e.sigil||def?.sigil||''].filter(Boolean).join(' · ');showBanner('LEGEND FELLED',e.name||def?.name,sub,true,5.6);notice=0;return;}
  if(t==='boss-reset'){if(def)announce(def.name+' withdraws to its lair','#c9c3b4',2,2.2);return;}
  if(t==='rift-open'){announce('The rift at the Old Stones tears open','#d7c4ff',3,3);return;}
 }
 const point=new T.Vector3();
 function update(dt,visible=true){
  dt=Number.isFinite(dt)&&dt>0?dt:0;visibleNow=!!visible;hit=Math.max(0,hit-dt);if(!hit)reticle?.classList.remove('hit');shown=Math.max(0,shown-dt);notice=Math.max(0,notice-dt);if(!notice)rank=0;if(callout)callout.hidden=!notice||!visible;if(layer)layer.hidden=!visible;
  if(banner&&bannerTime>0){bannerTime=Math.max(0,bannerTime-dt);if(bannerTime<=0)hideBanner();else{banner.hidden=!visible;if(banner.style)banner.style.opacity=String(Math.min(1,bannerTime/.9));}}
  const w=globalThis.innerWidth||1,h=globalThis.innerHeight||1;
  for(let i=labels.length-1;i>=0;i--){const l=labels[i];l.life-=dt;if(l.life<=0){l.node.remove();labels.splice(i,1);continue;}
   const age=1-l.life/l.total;point.set(l.x,l.y+age*.8,l.z).project(camera);const hidden=!visible||point.z<0||point.z>1||Math.abs(point.x)>1||Math.abs(point.y)>1;l.node.hidden=hidden;
   if(!hidden){l.node.style.left=(point.x*.5+.5)*w+l.offset+'px';l.node.style.top=(-point.y*.5+.5)*h+'px';l.node.style.opacity=Math.min(1,l.life*3);if(l.pop){const k=(l.total-l.life)/.14;l.node.style.transform='translate(-50%,-50%) scale('+(k<1?1.45-.45*k:1).toFixed(3)+')';if(k>=1)l.pop=false;}}}
 }
 return{emit,update,clear};
}
