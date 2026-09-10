export function createControls(canvas,settings,onPause){
 const keys=new Set();let enabled=false,drag=null,joystickId=null,lookId=null,lookLast=null,axis={x:0,y:0},running=false,joyOrigin=null;
 const c={yaw:0,pitch:0,stamina:100,active:false,
  clear(){keys.clear();axis={x:0,y:0};running=false;drag=null;lookId=null;lookLast=null;joystickId=null;const knob=document.querySelector('#joystick i');if(knob)knob.style.transform='';},
  enable(){enabled=true;c.active=true;c.clear();},
  disable(){enabled=false;c.active=false;c.clear();},
  lock(){if(matchMedia('(pointer:coarse)').matches)return;try{const p=canvas.requestPointerLock?.();p?.catch(()=>{});}catch{}},
  read(dt){let x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+axis.x;let y=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-axis.y;if(!enabled)x=y=0;const n=Math.hypot(x,y);if(n>1){x/=n;y/=n;}const sprint=enabled&&(keys.has('ShiftLeft')||keys.has('ShiftRight')||running)&&c.stamina>1&&n>0;c.stamina=Math.max(0,Math.min(100,c.stamina+(sprint?-20:16)*dt));const speed=sprint?8.2:4.5;return{dx:(-Math.sin(c.yaw)*y+Math.cos(c.yaw)*x)*speed*dt,dz:(-Math.cos(c.yaw)*y-Math.sin(c.yaw)*x)*speed*dt,moving:n>.05,sprint};},
 };
 const look=(dx,dy)=>{if(!enabled)return;c.yaw-=dx*.002*settings.sensitivity;c.pitch=Math.max(-1.35,Math.min(1.35,c.pitch-dy*.002*settings.sensitivity*(settings.invert?-1:1)));};
 addEventListener('keydown',e=>{if(!enabled)return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keys.add(e.code);});
 addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{c.clear();if(enabled)onPause();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){c.clear();if(enabled)onPause();}});
 document.addEventListener('pointerlockchange',()=>{c.clear();if(!document.pointerLockElement&&enabled)onPause();});
 document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas)look(e.movementX,e.movementY);else if(drag&&enabled){look(e.clientX-drag.x,e.clientY-drag.y);drag={x:e.clientX,y:e.clientY};}});
 canvas.addEventListener('pointerdown',e=>{if(!enabled||e.pointerType==='touch')return;if(!document.pointerLockElement)drag={x:e.clientX,y:e.clientY};});addEventListener('pointerup',()=>{drag=null;});
 const joy=document.querySelector('#joystick'),knob=joy.querySelector('i');joy.addEventListener('pointerdown',e=>{e.preventDefault();if(!enabled)return;joystickId=e.pointerId;const r=joy.getBoundingClientRect();joyOrigin={x:r.left+r.width/2,y:r.top+r.height/2};joy.setPointerCapture(e.pointerId);});joy.addEventListener('pointermove',e=>{if(e.pointerId!==joystickId)return;let x=(e.clientX-joyOrigin.x)/38,y=(e.clientY-joyOrigin.y)/38;const n=Math.hypot(x,y);if(n>1){x/=n;y/=n;}axis={x,y};knob.style.transform=`translate(${x*33}px,${y*33}px)`;});const resetJoy=()=>{axis={x:0,y:0};joystickId=null;knob.style.transform='';};joy.addEventListener('pointerup',resetJoy);joy.addEventListener('pointercancel',resetJoy);joy.addEventListener('lostpointercapture',resetJoy);
 const pad=document.querySelector('#look-pad');pad.addEventListener('pointerdown',e=>{if(!enabled)return;lookId=e.pointerId;lookLast={x:e.clientX,y:e.clientY};pad.setPointerCapture(e.pointerId);});pad.addEventListener('pointermove',e=>{if(e.pointerId!==lookId||!lookLast)return;look((e.clientX-lookLast.x)*1.5,(e.clientY-lookLast.y)*1.5);lookLast={x:e.clientX,y:e.clientY};});const resetLook=()=>{lookId=null;lookLast=null;};pad.addEventListener('pointerup',resetLook);pad.addEventListener('pointercancel',resetLook);
 const run=document.querySelector('#touch-sprint');run.addEventListener('pointerdown',e=>{running=true;run.setPointerCapture(e.pointerId);});run.addEventListener('pointerup',()=>running=false);run.addEventListener('pointercancel',()=>running=false);
 return c;
}
