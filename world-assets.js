/* V4 real 3D rain bamboo valley. The concept image is documentation only.
   Long Wind source MIT; Poly Haven scanned ground/rocks CC0; generated gate separate. */
import {createDuelBamboo,mulberry32} from './assets/world/long-wind-bamboo.js?v=5';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';
export async function enhanceWorld(T,scene,loader){
 if(scene.getObjectByName('inkblade-bamboo-world'))return scene.userData.valleyReceipt;
 const group=new T.Group();group.name='inkblade-bamboo-world';
 const rng=mulberry32(204411),r=(a,b)=>a+(b-a)*rng(),clock={value:0},loaded=[],failed=[],texLoader=new T.TextureLoader();
 const asset=new URL('./assets/world/',import.meta.url),dummy=new T.Object3D();
 async function texture(path,repeat=1,srgb=false){try{const t=await texLoader.loadAsync(new URL(path,asset).href);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.setScalar(repeat);t.anisotropy=4;if(srgb)t.colorSpace=T.SRGBColorSpace;loaded.push(path);return t;}catch(e){failed.push({asset:path,reason:String(e.message||e)});return null;}}
 const [soil,soilNormal,soilRough,pathMap,pathNormal,pathARM]=await Promise.all([
 texture('textures/forest_ground_04_diff.webp',42,true),texture('textures/forest_ground_04_nor_gl.webp',42),texture('textures/forest_ground_04_rough.webp',42),
 texture('polyhaven/grass_path_3/diffuse_1k.webp',1,true),texture('polyhaven/grass_path_3/nor_gl_1k.webp'),texture('polyhaven/grass_path_3/arm_1k.webp')]);
 const colliders=[];
 const clear=(x,z)=>Math.abs(x)<7&&Math.abs(z)<5.5;
 const inWorld=(x,z)=>Math.abs(x)<=18&&z>=-28&&z<=14;
 const roadX=z=>z<-8?3.5*Math.sin(Math.min(1,(-z-8)/22)*Math.PI*.5):Math.sin(z*.12)*1.6;
 const creekX=z=>23+Math.sin(z*.12)*.65;
 const height=(x,z)=>{
  if(Math.abs(x)<=20&&z>=-30&&z<=16)return 0;
  const edge=T.MathUtils.smoothstep(Math.hypot(Math.max(0,Math.abs(x)-20),Math.max(0,-30-z,z-16)),0,7);
  const bank=edge*(.6+.4*Math.sin(x*.21+z*.16)+.24*Math.cos(z*.36-x*.12));
  const gateRise=Math.exp(-((x-3.5)**2/90+(z+44)**2/75))*3.3*edge;
  // The side creek lies outside the playable clearing.
  const creek=(x>11||z<-8.5)?Math.exp(-((x-creekX(z))**2)/9)*.8:0;
  return bank+gateRise-creek;
 };
 // One continuous terrain; center remains a mathematically flat play surface.
 const terrain=new T.PlaneGeometry(134,134,112,112);terrain.rotateX(-Math.PI/2);const tp=terrain.attributes.position;
 for(let i=0;i<tp.count;i++){const x=tp.getX(i),z=tp.getZ(i);tp.setY(i,height(x,z));}terrain.computeVertexNormals();
 const groundMat=new T.MeshStandardMaterial({map:soil,normalMap:soilNormal,roughnessMap:soilRough,color:'#505345',roughness:.84,metalness:0,normalScale:new T.Vector2(.40,.40),envMapIntensity:.20});
 groundMat.onBeforeCompile=sh=>{
  if(!soil||!pathMap)return;
  sh.uniforms.uPath={value:pathMap||soil};sh.uniforms.uPathARM={value:pathARM||soilRough};sh.uniforms.uPathNormal={value:pathNormal||soilNormal};
  sh.vertexShader='varying vec2 vGroundXZ;\n'+sh.vertexShader;
  sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vGroundXZ=(modelMatrix*vec4(position,1.)).xz;');
  sh.fragmentShader='varying vec2 vGroundXZ; uniform sampler2D uPath; uniform sampler2D uPathARM; uniform sampler2D uPathNormal;\nfloat groundHash(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));q+=dot(q,q.yxz+33.33);return fract((q.x+q.y)*q.z);}\nfloat groundNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(groundHash(i),groundHash(i+vec2(1,0)),f.x),mix(groundHash(i+vec2(0,1)),groundHash(i+vec2(1,1)),f.x),f.y);}\n'+sh.fragmentShader;
  sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float pathX=vGroundXZ.y < -8. ? 3.5*sin(min(1.,(-vGroundXZ.y-8.)/22.)*1.570796) : sin(vGroundXZ.y*.12)*1.6;
   float pathMask=1.-smoothstep(2.5,7.3,abs(vGroundXZ.x-pathX)+(groundNoise(vGroundXZ*.43)-.5)*1.7);
   vec3 pathAlbedo=texture2D(uPath,vGroundXZ*.73).rgb*diffuseColor.rgb/max(texture2D(map,vMapUv).rgb,vec3(.02));
   diffuseColor.rgb=mix(diffuseColor.rgb,pathAlbedo,pathMask*.82);
   float mottling=groundNoise(vGroundXZ*.28)*.55+groundNoise(vGroundXZ*.065)*.45;
   diffuseColor.rgb*=mix(.48,1.16,mottling)*mix(1.,.78+.22*texture2D(uPathARM,vGroundXZ*.73).r,pathMask);
  `).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   float wet=groundNoise(vGroundXZ*.25+vec2(7,3));
   roughnessFactor=mix(.72,.90,wet)*mix(1.,.94+.06*texture2D(uPathARM,vGroundXZ*.73).g,pathMask);
  `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   #ifdef USE_NORMALMAP_TANGENTSPACE
    vec3 pathN=texture2D(uPathNormal,vGroundXZ*.73).xyz*2.-1.;pathN.xy*=.4;normal=normalize(mix(normal,normalize(tbn*pathN),pathMask*.72));
   #endif
  `);
 };groundMat.customProgramCacheKey=()=> 'v5-layered-wet-earth-3';
 const ground=new T.Mesh(terrain,groundMat);ground.name='layered-photographic-wet-earth';ground.receiveShadow=true;group.add(ground);
 // Clustered groves frame an opening toward the distant gate. Avoid uniform random wallpaper.
 const near=[],far=[],clusters=[[-14,6,3.6],[-13,-6,3.4],[-13,-18,3.4],[11,-13,2.4],[14,6,3.6],[15,-23,2.2],[-6,-25,2.7],[-8,-12,2.4]];
 function stem(x,z,h,lean=0){return{x,y:height(x,z)-.03,z,yaw:r(0,6.283),h,r:r(.058,.105)*(lean?1.35:1),leanX:lean||r(-1.3,1.3),leanZ:r(-1.6,1.6),phase:r(0,6.283),age:r(.12,.65),spacing:r(.32,.47),crown:r(.85,1.16)};}
 for(const [cx,cz,radius] of clusters){colliders.push({x:cx,z:cz,radius:radius+.15,kind:"dense-bamboo"});for(let i=0;i<15;i++){const a=r(0,6.28),rad=r(.2,radius-.25),x=cx+Math.cos(a)*rad,z=cz+Math.sin(a)*rad;if(clear(x,z))continue;if(z<-10&&Math.abs(x-roadX(z))<4.4)continue;near.push(stem(x,z,r(9.5,16.5)));}}
 // Six individual larger arches serve the foreground silhouette, with roots outside the clear area.
 for(const [x,z,lean] of [[-13,6,4],[-14.2,7.5,3.7],[-15,4.8,4.6],[14,7,-3.2],[16,8,-3.8],[-14,-3,3.4]])near.push(stem(x,z,r(10.5,14.5),lean));
 for(let i=0;i<230;i++){const a=r(0,6.283),radius=r(28,69),x=Math.cos(a)*radius,z=Math.sin(a)*radius;if(inWorld(x,z)||(z<-12&&Math.abs(x-roadX(z))<5))continue;far.push(stem(x,z,r(11,21)));}
 const nBamboo=createDuelBamboo(near,clock,{radial:7,rings:18,sprays:16,castShadow:true}),fBamboo=createDuelBamboo(far,clock,{radial:5,rings:10,sprays:8,castShadow:false});group.add(nBamboo.group,fBamboo.group);fBamboo.group.name='distant-bamboo-lower-detail';loaded.push('long-wind-bamboo.js (MIT-derived near/far batches)');
 // Actual photographed moss rocks. Select three real stone meshes and instance them sparingly.
 let rockTriangles=0,rockInstances=0;
 try{
  const path='polyhaven/rock_moss_set_01/rock_moss_set_01_1k.gltf',gltf=await loader.loadAsync(new URL(path,asset).href);gltf.scene.updateMatrixWorld(true);
  const sources=[];gltf.scene.traverse(o=>{if(o.isMesh)sources.push(o);});sources.sort((a,b)=>(a.geometry.index?.count||a.geometry.attributes.position.count)-(b.geometry.index?.count||b.geometry.attributes.position.count));
  const placements=[[-13.2,5.8,2.4],[-15.2,2.3,1.8],[-12.8,-6.8,1.2],[-16.7,-12,2.2],[12.7,6.5,1.8],[15.5,4.2,1.2],[13.8,-9.8,.85],[19,-8.7,1.4],[19,-16,2.0],[-9,-15,.95],[-5,-18,.65],[11,-25,1.35],[-17,-25,2.5]];
  for(let k=0;k<3;k++){const src=sources[k],geo=src.geometry.clone();geo.applyMatrix4(src.matrixWorld);geo.computeBoundingBox();const box=geo.boundingBox,size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());geo.translate(-center.x,-box.min.y,-center.z);geo.scale(1/size.y,1/size.y,1/size.y);geo.computeBoundingSphere();
   const material=src.material.clone();material.color.multiply(new T.Color('#a4ada1'));material.roughness=.64;material.metalness=.05;material.envMapIntensity=.55;if(material.normalScale)material.normalScale.multiplyScalar(.65);
   const set=placements.filter((v,i)=>i%3===k),mesh=new T.InstancedMesh(geo,material,set.length);mesh.name='CC0-moss-rock-type-'+k;mesh.receiveShadow=true;mesh.castShadow=true;
   set.forEach((v,i)=>{const radius=.5*Math.hypot(size.x/size.y,size.z/size.y)*v[2]+.2;let px=v[0];if(Math.abs(v[1])<4.7+radius&&Math.abs(px)<6.7+radius)px=Math.sign(px)*(6.7+radius);colliders.push({x:px,z:v[1],radius,kind:"moss-rock"});dummy.position.set(px,height(px,v[1])-.10,v[1]);dummy.rotation.set(r(-.14,.14),r(0,6.28),r(-.12,.12));dummy.scale.setScalar(v[2]);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.computeBoundingSphere();group.add(mesh);rockInstances+=set.length;rockTriangles+=(geo.index?.count||geo.attributes.position.count)/3*set.length;
  }loaded.push(path);
 }catch(e){failed.push({asset:'rock_moss_set_01',reason:String(e.message||e)});}
 // Fine fern fronds: blade geometry, not triangle-shaped tree crowns.
 function fernGeometry(grass=false){const P=[],C=[],I=[];function leaf(a,b,width,col){const base=P.length/3,axis=b.clone().sub(a),side=new T.Vector3(-axis.z,.14,axis.x).normalize().multiplyScalar(width);const mid=a.clone().lerp(b,.42).add(new T.Vector3(0,.025,0));for(const v of [a,mid.clone().add(side),b,mid.clone().sub(side)]){P.push(v.x,v.y,v.z);C.push(...col);}I.push(base,base+1,base+2,base,base+2,base+3);}
  if(grass){for(let i=0;i<9;i++){const a=i*2.399,h=.22+r(0,.5),o=new T.Vector3(Math.cos(a)*.07,0,Math.sin(a)*.07),tip=new T.Vector3(Math.cos(a)*h*.6,h,Math.sin(a)*h*.6);leaf(o,tip,.018,[.32,.45,.23]);}}
  else for(let f=0;f<5;f++){const az=f*2.399,L=.75+r(0,.45),axis=new T.Vector3(Math.cos(az),0,Math.sin(az));for(let j=1;j<10;j++){const t=j/10,at=axis.clone().multiplyScalar(t*L);at.y=Math.sin(t*Math.PI*.8)*.5;const width=(1-t)*.26;for(const side of [-1,1]){const tip=at.clone().add(new T.Vector3(-axis.z*side,0,axis.x*side).multiplyScalar(width));tip.addScaledVector(axis,.10);tip.y-=.025;leaf(at,tip,.025,[.22+.08*t,.36+.10*t,.20]);}}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('color',new T.Float32BufferAttribute(C,3));g.setIndex(I);g.computeVertexNormals();return g;}
 const foliageMat=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.44,metalness:.04,envMapIntensity:.65});
 foliageMat.onBeforeCompile=sh=>{sh.uniforms.uLeafTime=clock;sh.vertexShader='uniform float uLeafTime;\n'+sh.vertexShader;sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.x+=sin(uLeafTime*1.35+instanceMatrix[3].x*.8+instanceMatrix[3].z)*position.y*position.y*.11;');};foliageMat.customProgramCacheKey=()=> 'v4-fern-wind';
 for(const [grass,count] of [[false,105],[true,280]]){const g=fernGeometry(grass),inst=new T.InstancedMesh(g,foliageMat,count);inst.name=grass?'fine-grass-fringe':'fern-fronds';inst.receiveShadow=true;
  for(let i=0;i<count;i++){let x,z;do{x=r(-26,26);z=r(-28,14);}while(clear(x,z)||Math.abs(x-roadX(z))<3.6);dummy.position.set(x,height(x,z)+.018,z);dummy.rotation.set(0,r(0,6.28),0);dummy.scale.setScalar(grass?r(.6,1.1):r(.7,1.6));dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);}inst.computeBoundingSphere();group.add(inst);}
 // Damp fallen bamboo leaves, a single inexpensive batch.
 const litterGeo=new T.BufferGeometry();litterGeo.setAttribute('position',new T.Float32BufferAttribute([0,0,-.12,.024,.008,-.02,0,.006,.15,-.024,.008,-.02],3));litterGeo.setIndex([0,1,2,0,2,3]);litterGeo.computeVertexNormals();
 const litter=new T.InstancedMesh(litterGeo,new T.MeshStandardMaterial({color:'#6e6845',roughness:.68,side:T.DoubleSide}),850);for(let i=0;i<850;i++){const x=r(-22,22),z=r(-25,16);dummy.position.set(x,height(x,z)+.016,z);dummy.rotation.set(0,r(0,6.28),0);dummy.scale.setScalar(r(.6,1.6));dummy.updateMatrix();litter.setMatrixAt(i,dummy.matrix);}litter.receiveShadow=true;group.add(litter);
 function irregularPool(){const shape=new T.Shape();for(let i=0;i<=36;i++){const a=i/36*6.283,rr=1+.12*Math.sin(a*3)+.08*Math.sin(a*7);if(i)shape.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);else shape.moveTo(rr,0);}const geo=new T.ShapeGeometry(shape);geo.rotateX(-Math.PI/2);return geo;}
 const waterMat=new T.MeshStandardMaterial({color:'#132426',roughness:.22,metalness:0,envMapIntensity:.65,transparent:true,opacity:.70,depthWrite:false});
 const pools=new T.InstancedMesh(irregularPool(),waterMat,12);for(let i=0;i<12;i++){const z=r(-25,12),x=roadX(z)+r(-3.2,3.2);dummy.position.set(x,.008,z);dummy.rotation.set(0,r(0,6.28),0);dummy.scale.set(r(.55,1.8),1,r(.18,.45));dummy.updateMatrix();pools.setMatrixAt(i,dummy.matrix);}pools.name='shallow-reflective-rain-pools';group.add(pools);
 // Side creek follows the natural bank, beyond the playable rectangle.
 const wp=[],wi=[];for(let i=0;i<=45;i++){const z=10-i*1.18,x=creekX(z);wp.push(x-1.8,-.29,z,x+1.8,-.29,z);if(i){const a=(i-1)*2;wi.push(a,a+1,a+2,a+1,a+3,a+2);}}const waterGeo=new T.BufferGeometry();waterGeo.setAttribute('position',new T.Float32BufferAttribute(wp,3));waterGeo.setIndex(wi);waterGeo.computeVertexNormals();const creek=new T.Mesh(waterGeo,waterMat);creek.name='side-creek';group.add(creek);
 const streak=new T.InstancedMesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({color:'#abc6c8',transparent:true,opacity:.12,depthWrite:false}),65);for(let i=0;i<65;i++){const z=r(-40,10),x=creekX(z)+r(-1.4,1.4);dummy.position.set(x,-.275,z);dummy.rotation.set(-Math.PI/2,0,r(-.3,.3));dummy.scale.set(r(.2,.9),r(.015,.04),1);dummy.updateMatrix();streak.setMatrixAt(i,dummy.matrix);}group.add(streak);
 function merge(parts,material,name){const g=mergeGeometries(parts.map(a=>a.index?a.toNonIndexed():a),false);const m=new T.Mesh(g,material);m.name=name;m.receiveShadow=true;m.castShadow=true;group.add(m);return m;}
 const stoneMat=new T.MeshStandardMaterial({color:'#5e6b60',map:pathMap,roughness:.66,metalness:.04,envMapIntensity:.45});
 const bridgeParts=[],bridgeX=20,bridgeZ=-32,arch=x=>.20+1.35*Math.sin((x+4)/8*Math.PI);
 function boxPart(parts,x,y,z,sx,sy,sz,rz=0){const g=new T.BoxGeometry(sx,sy,sz);g.rotateZ(rz);g.translate(x,y,z);parts.push(g);}
 // Closely fitted individual voussoirs form an actual arched deck and stone parapet.
 for(let i=0;i<23;i++){const x=-3.85+i*.35,y=arch(x),slope=(arch(x+.03)-arch(x-.03))/.06,angle=Math.atan(slope);boxPart(bridgeParts,bridgeX+x,y-.18,bridgeZ,.37,.40,2.85,angle);for(const side of [-1,1]){boxPart(bridgeParts,bridgeX+x,y+.16,bridgeZ+side*1.42,.36,.36,.38,angle);boxPart(bridgeParts,bridgeX+x,y+.90,bridgeZ+side*1.42,.36,.16,.22,angle);}if(i%4===0)for(const side of [-1,1])boxPart(bridgeParts,bridgeX+x,y+.54,bridgeZ+side*1.42,.15,.85,.17);}
 merge(bridgeParts,stoneMat,'curved-stone-bridge');
 const stairs=[];for(let i=0;i<20;i++){const z=-31-i*.56;boxPart(stairs,3.5,.10+i*.17,z,3.2,.24,.60);}merge(stairs,stoneMat,'distant-gate-stairway');
 let gateTriangles=0;try{const path='mountain-gate.glb',gltf=await loader.loadAsync(new URL(path,asset).href),g=gltf.scene;g.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(g),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());g.position.set(-center.x,-bounds.min.y,-center.z);const placement=new T.Group();placement.name='distant-original-mountain-gate';placement.add(g);placement.scale.setScalar(7.8/size.y);placement.position.set(3.5,3.3,-44);g.traverse(o=>{if(!o.isMesh)return;gateTriangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;o.castShadow=false;o.receiveShadow=true;const m=o.material.clone();if(m.color)m.color.multiply(new T.Color('#c5c7bd'));m.roughness=.8;m.envMapIntensity=.35;if(m.emissive){m.emissive.set('#34494e');m.emissiveIntensity=.22;}o.material=m;});group.add(placement);loaded.push(path);}catch(e){failed.push({asset:'mountain-gate.glb',reason:String(e.message||e)});}
 // Mountains are continuous ridges with broad peaks; the gate is kept in a valley between them.
 for(let layer=0;layer<2;layer++){const geo=new T.PlaneGeometry(170,46,96,12);geo.rotateX(-Math.PI/2);const pp=geo.attributes.position;for(let i=0;i<pp.count;i++){const x=pp.getX(i),z=pp.getZ(i),ridge=Math.pow(Math.max(0,Math.cos(z/46*Math.PI)),1.9),peak=11+5*Math.sin(x*.075+layer*2)+3*Math.sin(x*.18+.7);pp.setY(i,ridge*peak-1);}geo.computeVertexNormals();const m=new T.Mesh(geo,new T.MeshLambertMaterial({color:layer?'#29414b':'#1b313a'}));m.position.set(0,0,-62-layer*23);group.add(m);}
 // Warm practical lanterns: slender supports, opaque paper cores and restrained pools of light.
 const lampPlaces=[[6.8,-9.0,2.5],[16,-28,2.7],[3.4,-41,6.0]],supports=[],cores=new T.InstancedMesh(new T.SphereGeometry(1,12,10),new T.MeshBasicMaterial({color:'#ffc37b'}),lampPlaces.length);
 lampPlaces.forEach(([x,z,y],i)=>{dummy.position.set(x,y,z);dummy.rotation.set(0,0,0);dummy.scale.set(.24,.38,.24);dummy.updateMatrix();cores.setMatrixAt(i,dummy.matrix);if(inWorld(x,z))colliders.push({x:x-.45,z,radius:.16,kind:'lantern-post'});boxPart(supports,x-.45,(y+.45)/2,z,.075,y+.45,.075);boxPart(supports,x-.15,y+.40,z,.75,.065,.065);boxPart(supports,x,y+.29,z,.32,.055,.32);boxPart(supports,x,y-.29,z,.32,.055,.32);if(i<2){const l=new T.PointLight('#ffc47b',i?8:14,i?8:10,2);l.position.set(x,y,z);group.add(l);}});group.add(cores);merge(supports,new T.MeshStandardMaterial({color:'#302a20',roughness:.6}),'lantern-wood-and-caps');
 const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=64;const gx=glowCanvas.getContext('2d'),gg=gx.createRadialGradient(32,32,0,32,32,32);gg.addColorStop(0,'rgba(255,255,255,.65)');gg.addColorStop(.18,'rgba(255,255,255,.24)');gg.addColorStop(.5,'rgba(255,255,255,.06)');gg.addColorStop(1,'rgba(255,255,255,0)');gx.fillStyle=gg;gx.fillRect(0,0,64,64);const glowGeo=new T.BufferGeometry();glowGeo.setAttribute('position',new T.Float32BufferAttribute(lampPlaces.flatMap(([x,z,y])=>[x,y,z]),3));const lampGlow=new T.Points(glowGeo,new T.PointsMaterial({color:'#ffbb75',size:1.6,map:new T.CanvasTexture(glowCanvas),transparent:true,opacity:.38,depthWrite:false,blending:T.AdditiveBlending,fog:false}));lampGlow.name='restrained-lantern-halo';group.add(lampGlow);
 const fogCanvas=document.createElement('canvas');fogCanvas.width=fogCanvas.height=128;const q=fogCanvas.getContext('2d'),gr=q.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(135,174,185,.4)');gr.addColorStop(.45,'rgba(110,153,167,.18)');gr.addColorStop(1,'rgba(110,153,167,0)');q.fillStyle=gr;q.fillRect(0,0,128,128);q.globalCompositeOperation="destination-out";for(let i=0;i<40;i++){const x=r(0,128),y=r(0,128),radius=r(7,22),g=q.createRadialGradient(x,y,0,x,y,radius);g.addColorStop(0,"rgba(0,0,0,.7)");g.addColorStop(1,"rgba(0,0,0,0)");q.fillStyle=g;q.fillRect(x-radius,y-radius,radius*2,radius*2);}q.globalCompositeOperation="source-over";const fogTex=new T.CanvasTexture(fogCanvas),mistMat=new T.MeshBasicMaterial({map:fogTex,transparent:true,opacity:.08,depthWrite:false,side:T.DoubleSide});
 const mists=[];for(const [x,y,z,w,h] of [[-12,3,-36,32,5],[12,5,-51,42,6]]){const m=new T.Mesh(new T.PlaneGeometry(w,h),mistMat);m.position.set(x,y,z);m.userData.baseX=x;m.renderOrder=2;group.add(m);mists.push(m);}

 scene.background=new T.Color('#0d1822');scene.fog=new T.FogExp2('#1a3038',.019);
 scene.traverse(o=>{if(o.isHemisphereLight)o.intensity=.60;if(o.isDirectionalLight){if(o.castShadow){o.shadow.mapSize.set(1536,1536);o.intensity=2.75;Object.assign(o.shadow.camera,{left:-23,right:23,top:23,bottom:-23,far:58});o.shadow.camera.updateProjectionMatrix();}else o.intensity=o.position.z>0?1.05:1.35;}});
 scene.add(group);const fallback=scene.getObjectByName('fallback-ground');if(fallback)fallback.visible=false;
 let last=performance.now(),paused=false;window.addEventListener('inkstate',e=>{paused=e.detail?.status==='paused';});ground.onBeforeRender=(renderer,s,camera)=>{const now=performance.now(),dt=Math.min(.08,(now-last)/1000);last=now;if(!paused)clock.value+=dt;for(let i=0;i<mists.length;i++){const m=mists[i];m.rotation.y=Math.atan2(camera.position.x-m.position.x,camera.position.z-m.position.z);m.position.x=m.userData.baseX+Math.sin(clock.value*.08+i)*1.4;}};
 let drawCalls=0,triangles=0;group.traverse(o=>{if(o.isPoints){drawCalls++;}if(o.isMesh){drawCalls+=Array.isArray(o.material)?o.material.length:1;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:o.geometry.isInstancedBufferGeometry?o.geometry.instanceCount:1);}});
 const receipt={loaded,failed,theme:'V5-rain-bamboo-mountain-path',renderPolicy:{shadowMap:1536,farBamboo:'Lambert, no shadow sampling',sharedLeafAtlas:true,groundNoise:'polynomial hash'},source:'Long Wind MIT / Poly Haven CC0 / original Hunyuan gate',bambooStems:near.length+far.length,nearBamboo:near.length,farBamboo:far.length,rockInstances,drawCalls,estimatedTriangles:Math.round(triangles),terrain:{centerY:0,world:{minX:-18,maxX:18,minZ:-28,maxZ:14},flatVertexMargin:{minX:-20,maxX:20,minZ:-30,maxZ:16},coreClearHalfWidth:6,coreClearHalfDepth:4.5},colliders,composition:'Foreground bent bamboo, moss rocks and fern; side stream and arched bridge; warm lanterns; misty distant gate and ridges.',conceptIsBackground:false,scope:'Explore the bounded bamboo paths inside x +/-18 and z -28..14; distant raised gate and stream bridge remain perimeter scenery.'};scene.userData.valleyReceipt=receipt;group.userData.receipt=receipt;window.dispatchEvent(new CustomEvent('inkworld',{detail:receipt}));return receipt;
}
