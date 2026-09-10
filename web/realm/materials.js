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
