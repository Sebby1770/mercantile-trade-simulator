// Synthesised ambience and spell voices; no external audio or microphone.
export function createAudio(settings){
 let ctx=null,gain=null,lastStep=0,lastBird=0,lastHit=-1;const combatVoices=new Set();
 function ensure(){if(!ctx){ctx=new AudioContext();gain=ctx.createGain();gain.gain.value=settings.sound?.25:0;gain.connect(ctx.destination);}if(ctx.state==='suspended')ctx.resume().catch(()=>{});}
 function voice(source,filter,duration,volume,delay=0,combat=false){if(!ctx||!settings.sound)return;const envelope=ctx.createGain(),t=ctx.currentTime+delay;envelope.gain.setValueAtTime(.0001,t);envelope.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),t+.015);envelope.gain.exponentialRampToValueAtTime(.0001,t+duration);source.connect(filter||envelope);if(filter)filter.connect(envelope);envelope.connect(gain);if(combat)combatVoices.add(source);source.onended=()=>{combatVoices.delete(source);source.disconnect();filter?.disconnect();envelope.disconnect();};source.start(t);source.stop(t+duration+.02);}
 function tone(freq,duration,volume,type='sine',delay=0,end=freq,combat=false){if(!ctx||!settings.sound)return;const o=ctx.createOscillator();o.type=type;o.frequency.setValueAtTime(freq,ctx.currentTime+delay);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),ctx.currentTime+delay+duration);voice(o,null,duration,volume,delay,combat);}
 function noise(duration,volume,frequency=1000){if(!ctx||!settings.sound)return;const count=Math.ceil(ctx.sampleRate*duration),buffer=ctx.createBuffer(1,count,ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<count;i++)data[i]=(Math.random()*2-1);const source=ctx.createBufferSource();source.buffer=buffer;const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.setValueAtTime(frequency,ctx.currentTime);filter.frequency.exponentialRampToValueAtTime(80,ctx.currentTime+duration);voice(source,filter,duration,volume,0,true);}
 function combat(e){if(!ctx||!settings.sound)return;
  if(e.type==='cast'){
   if(['fireball','meteor'].includes(e.spell)){noise(.45,.35,1600);tone(100,.5,.3,'sawtooth',0,42,true);}
   else if(['frost','blizzard'].includes(e.spell)){for(let i=0;i<3;i++)tone(900+i*420,.4,.09,'sine',i*.035,1500+i*400,true);noise(.22,.09,4000);}
   else if(e.spell==='lightning'){noise(.18,.3,7000);tone(180,.18,.12,'sawtooth',0,50,true);}
   else if(e.spell==='blink'){tone(180,.28,.18,'sine',0,1400,true);noise(.2,.14,2500);}
   else{const base=e.spell==='roots'?150:e.spell==='nova'?220:440;for(let i=0;i<3;i++)tone(base*[1,1.25,1.5][i],.55,.09,'sine',i*.05,base*[1.5,2,2.5][i],true);}
  }
  if(e.type==='impact'){noise(.65,.55,1300);tone(60,.6,.35,'sine',0,28,true);}
  if(e.type==='combo'){tone(660,.32,.15,'triangle',0,1320,true);noise(.2,.16,5000);}
  if(e.type==='hit'&&!e.periodic&&ctx.currentTime-lastHit>.065){lastHit=ctx.currentTime;tone(170,.1,.18,'triangle',0,65,true);}
  if(e.type==='guard'){tone(620,.18,.15,'triangle',0,220,true);noise(.12,.1,2000);}
  if(e.type==='swing'){noise(.12,.1,800);}
  if(e.type==='telegraph'&&e.phase==='start')tone(95,.25,.08,'triangle',0,150,true);
 }
 return{start(){try{ensure();}catch{}},set(){if(gain)gain.gain.value=settings.sound?.25:0;},stopCombat(){for(const v of combatVoices)try{v.stop();}catch{}combatVoices.clear();},combat,chime(){tone(660,.2,.1);tone(880,.35,.08,'sine',.13);},update(time,moving,sprint,daylight){if(!ctx||!settings.sound)return;if(moving&&time-lastStep>(sprint?.27:.4)){lastStep=time;tone(70+Math.random()*25,.08,.16,'triangle');}if(daylight>.4&&time-lastBird>7+Math.random()*4){lastBird=time;tone(1900,.1,.035);tone(2300,.09,.025,'sine',.13);tone(2100,.12,.03,'sine',.24);}}};
}
