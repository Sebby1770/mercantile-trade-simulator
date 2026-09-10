import * as T from '../vendor/three.module.js';
import {EffectComposer} from '../vendor/addons/postprocessing/EffectComposer.js';
import {RenderPass} from '../vendor/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from '../vendor/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from '../vendor/addons/postprocessing/OutputPass.js';
export function createPostProcessing(renderer,scene,camera,settings){const target=new T.WebGLRenderTarget(innerWidth,innerHeight,{type:T.HalfFloatType,samples:Math.min(4,renderer.capabilities.maxSamples)});const composer=new EffectComposer(renderer,target);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new T.Vector2(innerWidth,innerHeight),.28,.45,1.05);composer.addPass(bloom);composer.addPass(new OutputPass());return{render(dt){if(settings.quality==='high')composer.render(dt);else renderer.render(scene,camera);},resize(){composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(innerWidth,innerHeight);}};}
