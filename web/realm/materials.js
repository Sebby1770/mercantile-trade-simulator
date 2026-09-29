import * as T from '../vendor/three.module.js';
export function projectedMaterial(color,texture,scale=1){const m=new T.MeshStandardMaterial({color,map:texture,roughness:.89});if(!texture)return m;m.onBeforeCompile=shader=>{shader.uniforms.realmTileScale={value:scale};shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vRealmPosition;');shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`vec4 realmPos=vec4(transformed,1.0);
#ifdef USE_INSTANCING
realmPos=instanceMatrix*realmPos;
#endif
vRealmPosition=(modelMatrix*realmPos).xyz;
#include <project_vertex>`);shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vRealmPosition;\nuniform float realmTileScale;');shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
vec3 rn=abs(normalize(cross(dFdx(vRealmPosition),dFdy(vRealmPosition))));
vec3 rb=pow(rn,vec3(5.0)); rb/=max(dot(rb,vec3(1.0)),0.001);
vec4 rx=texture2D(map,vRealmPosition.zy*realmTileScale);
vec4 ry=texture2D(map,vRealmPosition.xz*realmTileScale);
vec4 rz=texture2D(map,vRealmPosition.xy*realmTileScale);
diffuseColor*=rx*rb.x+ry*rb.y+rz*rb.z;
#endif`);};m.customProgramCacheKey=()=> 'realm-triplanar-v1';return m;}
// Terrain: the projected grass texture, blended per vertex toward snow, marsh and ash by a `biome` (frost, mire, ash) attribute.
export function terrainMaterial(texture,scale=.28){const m=projectedMaterial(0xcad6aa,texture,scale),base=m.onBeforeCompile;m.onBeforeCompile=(shader,renderer)=>{if(typeof base==='function')base(shader,renderer);shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 biome;\nvarying vec3 vRealmBiome;').replace('#include <begin_vertex>','#include <begin_vertex>\nvRealmBiome=biome;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vRealmBiome;').replace('#include <alphamap_fragment>',`vec3 rw=clamp(vRealmBiome,0.,1.);float rl=dot(diffuseColor.rgb,vec3(.299,.587,.114));
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.78,.83,.9)*(.64+rl*.5),rw.x);
diffuseColor.rgb*=mix(vec3(1.),vec3(.52,.55,.38),rw.y);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.16,.14,.13)*(.6+rl*1.4),rw.z);
#include <alphamap_fragment>`);};m.customProgramCacheKey=()=>'realm-terrain-v1';return m;}
