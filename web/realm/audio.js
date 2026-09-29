/** Synthesised ambience, boss music and combat voices; no external audio or microphone. */
// Every sound is built from oscillators and one shared looping noise buffer. Voices pass through a bus
// → soft limiter → master gain, are rate-limited per kind and capped globally so dense fights never clip.
const STYLES={frost:{bpm:72},mire:{bpm:62},cinder:{bpm:200}/* eighth-note steps at 100 bpm */,hollow:{bpm:66}},MAX_VOICES=64,CHOIR=[146.83,116.54,130.81,110];
export function createAudio(settings){
 let ctx=null,gain=null,sfx=null,musicBus=null,ambBus=null,noiseBuf=null,lastStep=0,lastBird=0,lastHit=-1,live=0,music=null,fading=null,amb=null,hum=null,stormUntil=0;
 const combatVoices=new Set(),musicVoices=new Set(),gates=new Map(),clamp01=v=>Number.isFinite(v)?Math.min(1,Math.max(0,v)):0;
 const can=()=>ctx&&settings.sound&&live<MAX_VOICES,gate=(k,gap)=>{const t=ctx.currentTime;if(t-(gates.get(k)??-99)<gap)return false;gates.set(k,t);return true;};
 function ensure(){if(!ctx){ctx=new AudioContext();gain=ctx.createGain();gain.gain.value=settings.sound?.25:0;gain.connect(ctx.destination);let out=gain;
   if(ctx.createDynamicsCompressor){const c=ctx.createDynamicsCompressor();c.threshold.value=-8;c.knee.value=8;c.ratio.value=10;c.attack.value=.003;c.release.value=.18;c.connect(gain);out=c;}
   const bus=v=>{const g=ctx.createGain();g.gain.value=v;g.connect(out);return g;};sfx=bus(1);musicBus=bus(.5);ambBus=bus(.8);
   const n=Math.floor(ctx.sampleRate*1.5);noiseBuf=ctx.createBuffer(1,n,ctx.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
   if(typeof document!=='undefined')document.addEventListener?.('visibilitychange',()=>{if(!ctx)return;(document.hidden?ctx.suspend?.():ctx.resume?.())?.catch?.(()=>{});});}
  if(ctx.state==='suspended')ctx.resume().catch(()=>{});}
 function voice(source,filter,duration,volume,delay=0,group=null,dest=sfx){if(!can())return false;const envelope=ctx.createGain(),t=ctx.currentTime+Math.max(0,delay),set=group===true?combatVoices:group||null;envelope.gain.setValueAtTime(.0001,t);envelope.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),t+.015);envelope.gain.exponentialRampToValueAtTime(.0001,t+duration);source.connect(filter||envelope);if(filter)filter.connect(envelope);envelope.connect(dest);set?.add(source);live++;source.onended=()=>{live--;set?.delete(source);source.disconnect();filter?.disconnect();envelope.disconnect();};if(source.buffer)source.start(t,Math.random());else source.start(t);source.stop(t+duration+.02);return true;}
 function tone(freq,duration,volume,type='sine',delay=0,end=freq,combat=false,dest=sfx){if(!can())return;const o=ctx.createOscillator(),t=ctx.currentTime+Math.max(0,delay);o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);voice(o,null,duration,volume,delay,combat,dest);}
 // Filtered sawtooth: roars, growls and choir swells without the raw buzz.
 function buzz(freq,duration,volume,end=freq,cutoff=900,delay=0,group=true,dest=sfx){if(!can())return;const o=ctx.createOscillator(),f=ctx.createBiquadFilter(),t=ctx.currentTime+Math.max(0,delay);o.type='sawtooth';o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);f.type='lowpass';f.frequency.setValueAtTime(cutoff,t);f.Q.value=1.5;voice(o,f,duration,volume,delay,group,dest);}
 function noise(duration,volume,frequency=1000,delay=0,group=true,dest=sfx,type='lowpass',end=80){if(!can())return;const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),t=ctx.currentTime+Math.max(0,delay);s.buffer=noiseBuf;s.loop=true;f.type=type;f.frequency.setValueAtTime(frequency,t);f.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);voice(s,f,duration,volume,delay,group,dest);}
 // Long-lived node groups (boss drones, ambience beds, the channel hum) torn down together by kill().
 function rig(dest,level=1,rise=.5){const t=ctx.currentTime,out=ctx.createGain(),r={out,nodes:[out],srcs:[]};out.gain.setValueAtTime(.0001,t);if(level)out.gain.setTargetAtTime(level,t,rise);out.connect(dest);
  r.gain=(v,to=out)=>{const g=ctx.createGain();g.gain.value=v;g.connect(to);r.nodes.push(g);return g;};
  r.filt=(type,f,q=1,to=out)=>{const b=ctx.createBiquadFilter();b.type=type;b.frequency.value=f;b.Q.value=q;b.connect(to);r.nodes.push(b);return b;};
  r.osc=(f,type,g,to=out,det=0)=>{const o=ctx.createOscillator();o.type=type;o.frequency.value=f;o.detune.value=det;o.connect(r.gain(g,to));o.start(t);r.srcs.push(o);return o;};
  r.lfo=(rate,depth,...params)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=rate;g.gain.value=depth;o.connect(g);for(const p of params)g.connect(p);o.start(t);r.nodes.push(g);r.srcs.push(o);return o;};
  r.noise=to=>{const s=ctx.createBufferSource();s.buffer=noiseBuf;s.loop=true;s.connect(to);s.start(t,Math.random());r.srcs.push(s);return s;};return r;}
 function kill(r,release=.03){if(!r||r.dead)return;r.dead=true;const t=ctx.currentTime,g=r.out.gain;g.cancelScheduledValues(t);g.setValueAtTime(Math.max(.0001,g.value||0),t);g.setTargetAtTime(0,t,release);let left=r.srcs.length;const done=()=>{if(--left<=0)for(const n of r.nodes)n.disconnect();};
  if(!left)for(const n of r.nodes)n.disconnect();for(const s of r.srcs){s.onended=()=>{s.disconnect();done();};try{s.stop(t+release*5);}catch{s.disconnect();done();}}}
 const fade=(r,v,tc)=>{const t=ctx.currentTime,g=r.out.gain;g.cancelScheduledValues(t);g.setValueAtTime(Math.max(.0001,g.value||0),t);g.setTargetAtTime(v,t,tc);};

 // Boss motifs: frost glassy high drones and bells, mire detuned low drones and a heartbeat,
 // cinder a war-drum pattern over a sub drone, hollow a formant choir moving in open fifths.
 function drone(style){const r=rig(musicBus,1,.8),m=Object.assign(r,{style,beat:0,next:ctx.currentTime+.3,spb:60/STYLES[style].bpm,voices:[],off:null});
  if(style==='frost'){const trem=r.gain(.7),hp=r.filt('highpass',380,.7,trem);r.lfo(.23,.3,trem.gain);for(const [f,g,d]of[[440,.05,0],[880,.06,-4],[1318.5,.04,5],[1760,.025,9]])m.voices.push(r.osc(f,f>500?'sine':'triangle',g,hp,d));r.lfo(.17,12,m.voices[3].detune,m.voices[1].detune);}
  else if(style==='mire'){const lp=r.filt('lowpass',340,5);r.lfo(.09,170,lp.frequency);for(const [f,type,g,d]of[[55,'sawtooth',.07,0],[55,'sawtooth',.07,23],[82.4,'sawtooth',.05,-17],[110,'triangle',.04,31],[27.5,'sine',.12,0]])r.osc(f,type,g,lp,d);}
  else if(style==='cinder'){const lp=r.filt('lowpass',170,3);r.lfo(.4,45,lp.frequency);r.osc(41.2,'sawtooth',.11,lp);r.osc(61.7,'sawtooth',.06,lp,8);r.osc(20.6,'sine',.14);}
  else{const ch=r.gain(1,r.filt('bandpass',700,6)),f2=r.filt('bandpass',1150,8);ch.connect(f2);const vib=[];for(const k of[1,1.5,2])for(const d of[-7,7]){const o=r.osc(CHOIR[0]*k,'sawtooth',.05,ch,d);o.k=k;m.voices.push(o);vib.push(o.detune);}r.lfo(5.2,6,...vib);m.root=r.osc(CHOIR[0]/2,'sine',.05);}
  return m;}
 function kick(t,vol,f=95){tone(f,.32,vol,'sine',t-ctx.currentTime,38,musicVoices,musicBus);}
 function beat(m,t){const b=m.beat,d=t-ctx.currentTime,G=musicVoices,B=musicBus;
  if(m.style==='frost'){if(b%4===0)kick(t,.22,80);if(Math.random()<.7){const n=[1318.5,1760,1975.5,2637,2349.3][(b*3)%5];tone(n,1.2,.035,'sine',d,n,G,B);tone(n*2.76,.4,.01,'sine',d,n*2.7,G,B);}if(b%8===4)noise(.9,.05,7000,d,G,B,'highpass',3000);}
  else if(m.style==='mire'){if(b%2===0){kick(t,.36,70);kick(t+.2,.24,62);}if(b%8===5)tone(196,.5,.03,'triangle',d,147,G,B);}
  else if(m.style==='cinder'){const s=b%8;if(s===0||s===3||s===5)kick(t,s?.4:.55,s?85:100);if(s===4){noise(.22,.26,2200,d,G,B);tone(190,.18,.14,'triangle',d,120,G,B);}if(s===6||s===7)tone(s===6?140:120,.25,.18,'sine',d,70,G,B);else if(s===2)noise(.05,.05,6000,d,G,B,'highpass',4000);if(b%32===0)noise(1.2,.22,500,d,G,B);}
  else{if(b%8===0){const root=CHOIR[(b/8|0)%CHOIR.length];for(const o of m.voices)o.frequency.setTargetAtTime(root*o.k,t,.4);m.root?.frequency.setTargetAtTime(root/2,t,.4);tone(196,2.8,.05,'sine',d,196,G,B);tone(541,1.4,.018,'sine',d,541,G,B);tone(1058,.6,.01,'sine',d,1058,G,B);}if(b%2===0)kick(t,.2,72);}}
 function bossMusic(active,style){if(!ctx)return;const t=ctx.currentTime,want=active&&settings.sound?(Object.hasOwn(STYLES,style)?style:'hollow'):null;
  if(fading&&t>fading.until){kill(fading);fading=null;}if(hum&&t>hum.until)humStop();
  if(!want){if(music){if(music.off==null){music.off=t;fade(music,0,.45);}else if(t-music.off>2.5){kill(music);music=null;}}return;}
  if(music&&music.style!==want){if(fading)kill(fading);fade(music,0,.25);music.until=t+1.5;fading=music;music=null;}
  if(!music)music=drone(want);else if(music.off!=null){music.off=null;fade(music,1,.4);}
  if(music.next<t-.1)music.next=t+.05;for(let i=0;i<16&&music.next<t+.2;i++){beat(music,music.next);music.beat++;music.next+=music.spb;}}

 // Biome beds: wind for frost, a low rumble and crackles for cinder, water hush, frogs and insects for the mire.
 function ambience(biome){if(!ctx)return;const t=ctx.currentTime,on=settings.sound&&biome&&typeof biome==='object',w=on?clamp01(biome.frost):0,a=on?clamp01(biome.ash):0,m=on?clamp01(biome.mire):0,sum=w+a+m;
  if(!amb){if(sum<.02)return;const r=rig(ambBus,1,.2),wind=r.gain(0),rumble=r.gain(0),marsh=r.gain(0),gust=r.gain(.6,wind),bp=r.filt('bandpass',650,.8,gust),hub=r.gain(1,bp);hub.connect(r.filt('lowpass',110,.7,rumble));hub.connect(r.filt('lowpass',420,.5,marsh));r.noise(hub);r.lfo(.08,.38,gust.gain);r.lfo(.05,260,bp.frequency);r.osc(34,'sine',.3,rumble);amb=Object.assign(r,{wind,rumble,marsh,w:0,a:0,m:0,idle:0,frog:t+1,crack:t+.5,ice:t+4});}
  const level=(k,g,v)=>{if(Math.abs(amb[k]-v)>.004){amb[k]=v;g.gain.setTargetAtTime(v,t,1.2);}};level('w',amb.wind,w*.32);level('a',amb.rumble,a*.5);level('m',amb.marsh,m*.07);
  if(sum<.02){if(!amb.idle)amb.idle=t;else if(t-amb.idle>6){kill(amb,.2);amb=null;}return;}amb.idle=0;const G=null,B=ambBus;
  if(m>.25&&t>amb.frog){amb.frog=t+.5+Math.random()*2.2/m;if(Math.random()<.6){const f=150+Math.random()*60,n=2+(Math.random()*2|0);for(let i=0;i<n;i++)tone(f,.09,.05*m,'triangle',i*.12,f*.65,G,B);}else{const f=3800+Math.random()*900;for(let i=0;i<3;i++)tone(f,.03,.014*m,'sine',i*.06,f*1.04,G,B);}}
  if(a>.3&&t>amb.crack){amb.crack=t+.3+Math.random()*1.1/a;noise(.06,.07*a,4200,0,G,B,'highpass',2500);if(Math.random()<.12)tone(52,1,.06*a,'sine',0,34,G,B);}
  if(w>.4&&t>amb.ice){amb.ice=t+6+Math.random()*6;const f=[2637,2349.3,3136][Math.random()*3|0];tone(f,.7,.012*w,'sine',0,f,G,B);tone(f*1.5,.5,.006*w,'sine',.09,f*1.5,G,B);}}

 function humStart(){humStop();if(!can())return;const r=rig(sfx,.07,.08),g=r.gain(1),o1=r.osc(523.25,'sine',.6,g),o2=r.osc(784,'triangle',.25,g,4);r.osc(1046.5,'sine',.12,g,-6);r.lfo(6,8,o1.detune,o2.detune);r.lfo(11,.25,g.gain);r.until=ctx.currentTime+8;hum=r;}
 function humStop(){if(hum){kill(hum,.06);hum=null;}}
 function silence(){humStop();for(const v of musicVoices)try{v.stop();}catch{}musicVoices.clear();if(music){kill(music,.05);music=null;}if(fading){kill(fading,.05);fading=null;}}

 function combat(e){if(!ctx||!settings.sound||!e)return;const t=e.type;
  if(t==='cast'){
   if(['fireball','meteor'].includes(e.spell)){noise(.45,.35,1600);tone(100,.5,.3,'sawtooth',0,42,true);}
   else if(['frost','blizzard'].includes(e.spell)){for(let i=0;i<3;i++)tone(900+i*420,.4,.09,'sine',i*.035,1500+i*400,true);noise(.22,.09,4000);}
   else if(e.spell==='lightning'){noise(.18,.3,7000);tone(180,.18,.12,'sawtooth',0,50,true);}
   else if(e.spell==='blink'){tone(180,.28,.18,'sine',0,1400,true);noise(.2,.14,2500);}
   else if(['earthshatter','thunderstorm','siphon'].includes(e.spell)){}
   else{const base=e.spell==='roots'?150:e.spell==='nova'?220:e.spell==='sunlance'?660:440;for(let i=0;i<3;i++)tone(base*[1,1.25,1.5][i],.55,.09,'sine',i*.05,base*[1.5,2,2.5][i],true);}
  }
  else if(t==='impact'){noise(.65,.55,1300);tone(60,.6,.35,'sine',0,28,true);}
  else if(t==='combo'){tone(660,.32,.15,'triangle',0,1320,true);noise(.2,.16,5000);}
  else if(t==='hit'){if(!e.periodic&&ctx.currentTime-lastHit>.065){lastHit=ctx.currentTime;tone(e.weak?200:e.resist?140:170,.1,.18,'triangle',0,65,true);if(e.crit)tone(1250,.12,.06,'triangle',0,520,true);}}
  else if(t==='guard'){tone(620,.18,.15,'triangle',0,220,true);noise(.12,.1,2000);}
  else if(t==='swing'){if(!gate('swing',.03))return;if(e.heavy){if(e.move==='draw')tone(220,.3,.12,'triangle',0,110,true);noise(e.move==='whirl'?.5:.32,.26,1100);buzz(120,.3,.12,55,400);}else noise(e.combo===2?.16:.12,e.combo===2?.14:.1,e.combo===2?900:800);}
  else if(t==='telegraph'){if(e.phase==='start')tone(95,.25,.08,'triangle',0,150,true);}
  else if(t==='impact-melee'){if(!gate(t,.05))return;const s=Number.isFinite(e.strength)?clamp01(e.strength):.45;tone(110,.14+.1*s,.14+.26*s,'sine',0,40,true);noise(.1+.1*s,.1+.22*s,1200+1400*s);}
  else if(t==='parry'){if(!gate(t,.06))return;tone(1568,.5,.14,'triangle',0,1480,true);tone(4327,.3,.05,'sine',0,4000,true);noise(.12,.2,7000);}
  else if(t==='evade'){if(!gate(t,.08))return;noise(.22,.14,2600);if(e.perfect){tone(880,.35,.07,'sine',0,1760,true);tone(1320,.35,.05,'sine',.06,2640,true);}}
  else if(t==='dodge'){if(!gate(t,.1))return;noise(.24,.16,1600);tone(260,.2,.05,'sine',0,160,true);}
  else if(t==='guard-break'){if(!gate(t,.2))return;noise(.45,.45,3200);buzz(380,.4,.2,80,1400);tone(1200,.2,.08,'triangle',0,300,true);}
  else if(t==='reflect'){if(!gate(t,.08))return;tone(1400,.25,.1,'triangle',0,700,true);tone(700,.3,.08,'sine',.04,1600,true);}
  else if(t==='stagger'){if(!gate(t,.15))return;const b=!!e.boss;tone(b?330:520,.5,.1,'triangle',0,b?160:260,true);tone(b?660:1040,.35,.05,'sine',.08,b?520:830,true);if(b){noise(.5,.3,900);tone(60,.5,.3,'sine',0,30,true);}}
  else if(t==='channel-start')humStart();
  else if(t==='channel-end')humStop();
  else if(t==='earthshatter'){if(!gate(t,.2))return;noise(.8,.5,900);tone(55,.7,.4,'sine',0,28,true);buzz(140,.5,.18,60,500);noise(.15,.25,5000,.05);}
  else if(t==='thunderstorm'){stormUntil=ctx.currentTime+(Number.isFinite(e.duration)?Math.min(12,e.duration):2.4)+.3;if(!gate(t,.5))return;noise(1.6,.3,500);tone(48,1.4,.25,'sine',0,30,true);}
  else if(t==='lightning'){if(ctx.currentTime<stormUntil&&gate('bolt',.09)){noise(.25,.26,7000);tone(120,.25,.12,'sawtooth',0,40,true);}}
  else if(t==='siphon'){if(!gate(t,.15))return;if(e.miss)tone(320,.25,.05,'sine',0,160,true);else{buzz(180,.55,.12,520,900);tone(660,.55,.06,'sine',.05,330,true);noise(.4,.1,1600);}}
  else if(t==='embers'){if(gate(t,.3))noise(.5,.16,1800);}
  else if(t==='hazard'){const st=e.style;if(e.phase==='start'){if(gate('hz-start',.12))tone(95,.25,.07,'triangle',0,150,true);}
   else if(e.phase==='resolve'&&gate('hz-'+st,.07)){
    if(st==='frost'){noise(.35,.3,6000);tone(2200,.25,.06,'triangle',0,700,true);tone(3100,.2,.04,'sine',.03,1200,true);}
    else if(st==='mire'){noise(.45,.28,700);tone(160,.35,.2,'sine',0,55,true);}
    else if(st==='cinder'){noise(.7,.45,1400);tone(70,.6,.35,'sine',0,30,true);}
    else if(st==='hollow'){buzz(620,.4,.12,150,2000);tone(880,.35,.06,'sine',0,220,true);noise(.3,.15,3000);}
    else{noise(.35,.25,1200);tone(90,.3,.2,'sine',0,40,true);}}}
  else if(t==='pool'){if(!gate(t,.25))return;if(e.style==='cinder')noise(.7,.12,5000,0,true,sfx,'highpass',2000);else for(let i=0;i<3;i++)tone(180+i*40,.08,.06,'sine',i*.11,320+i*50,true);}
  else if(t==='boss-awaken'){if(!gate(t,1))return;const k=e.boss;
   if(k==='frost'){buzz(160,1.6,.35,60,900);tone(1760,1.2,.04,'sine',.1,1320,true);noise(1.4,.25,2500);}
   else if(k==='mire'){buzz(700,1.1,.12,1100,2600);buzz(90,1.4,.25,50,500);noise(1.2,.2,1500);}
   else if(k==='cinder'){buzz(70,1.8,.45,32,400);noise(1.8,.5,500);tone(45,1.6,.4,'sine',0,28,true);}
   else{for(const f of[146.8,220,293.7])buzz(f,1.6,.1,f*.94,1200);tone(73,1.6,.3,'sine',0,55,true);}}
  else if(t==='boss-cast'){if(!gate(t,.2))return;const f={frost:880,mire:622,cinder:196,hollow:466}[e.boss]??440;tone(f,.22,.06,'triangle',0,f*.75,true);tone(f*1.5,.18,.035,'sine',.08,f*1.2,true);}
  else if(t==='boss-phase'){if(!gate(t,1))return;noise(.9,.3,900);tone(55,1.2,.3,'sine',0,45,true);for(const f of[110,165,220])buzz(f,1.2,.07,f*.97,900,.1);}
  else if(t==='boss-blink'){if(gate(t,.15)){noise(.35,.22,2400);tone(300,.3,.08,'sine',0,1200,true);}}
  else if(t==='boss-dash'){if(gate(t,.15))noise(.4,.3,900);}
  else if(t==='boss-reset'){if(gate(t,1))tone(440,.8,.06,'sine',0,220,true);}
  else if(t==='summon'){if(gate(t,.3)){buzz(110,.9,.12,220,700);noise(.6,.12,900);}}
  else if(t==='rift-open'){if(gate(t,2)){tone(220,2,.08,'sine',0,880);tone(330,2,.05,'sine',.1,1320);noise(2,.15,3000,0,null);}}
  // The fanfare is not a combat voice, so pausing or clearing the fight does not cut it short.
  else if(t==='boss-defeat'){if(!gate(t,1))return;[523.25,659.25,783.99,1046.5].forEach((f,i)=>tone(f,.6,.1,'triangle',i*.12,f));for(const f of[523.25,659.25,783.99])tone(f,1.6,.06,'triangle',.5,f);tone(110,.8,.25,'sine',0,55);noise(.6,.08,8000,0,null);}
 }
 return{start(){try{ensure();}catch{}},set(){if(!gain)return;gain.gain.value=settings.sound?.25:0;if(!settings.sound){silence();if(amb){kill(amb,.05);amb=null;}}},stopCombat(){for(const v of combatVoices)try{v.stop();}catch{}combatVoices.clear();if(ctx)silence();},combat,bossMusic,ambience,chime(){tone(660,.2,.1);tone(880,.35,.08,'sine',.13);},update(time,moving,sprint,daylight){if(!ctx)return;if(hum&&ctx.currentTime>hum.until)humStop();if(!settings.sound)return;if(moving&&time-lastStep>(sprint?.27:.4)){lastStep=time;tone(70+Math.random()*25,.08,.16,'triangle');}if(daylight>.4&&time-lastBird>7+Math.random()*4){lastBird=time;tone(1900,.1,.035);tone(2300,.09,.025,'sine',.13);tone(2100,.12,.03,'sine',.24);}}};
}
