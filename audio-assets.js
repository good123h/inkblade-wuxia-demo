// Kenney CC0 performance samples; the rain fallback is original procedural sound.
export function createAudioBank(context, destination) {
 const buffers=new Map(),groups={},voices=new Set(),last=new Map();
 let requested=0,loaded=0,failed=0,played=0,enabled=true,loading=null,rainSource=null,windSource=null;
 const bus=context.createGain();bus.gain.value=1;bus.connect(destination);
 const ambient=context.createGain();ambient.gain.value=.24;ambient.connect(bus);
 const master=context.createDynamicsCompressor();master.threshold.value=-12;master.knee.value=12;master.ratio.value=4;master.attack.value=.004;master.release.value=.16;master.connect(bus);
 const volumes={swing:.32,draw:.22,cloth:.18,step:.14,metal:.30,parry:.43,hit:.32};
 async function load(){if(loading)return loading;loading=(async()=>{
  const res=await fetch('./assets/audio/manifest.json');if(!res.ok)throw new Error('Audio manifest unavailable');const manifest=await res.json();Object.assign(groups,manifest.groups);
  const entries=Object.values(groups).flat();requested=entries.length;
  await Promise.all(entries.map(async item=>{try{const r=await fetch(item.url);if(!r.ok)throw new Error('Audio unavailable');const b=await context.decodeAudioData(await r.arrayBuffer());buffers.set(item.url,b);loaded++;}catch{failed++;}}));
  if(groups.rain?.length)startRain();return getState();
 })().catch(()=>{failed++;return getState();});return loading;}
 function play(kind,options={}){
  if(!enabled||context.state!=='running')return false;
  const now=context.currentTime,minimum=kind==='step'?.085:.035;if(now-(last.get(kind)??-100)<minimum)return false;
  const variants=(groups[kind]||[]).filter(item=>buffers.has(item.url));if(!variants.length)return false;
  if(voices.size>=24){const oldest=voices.values().next().value;try{oldest.stop();}catch{}}
  const item=variants[Math.floor(Math.random()*variants.length)],source=context.createBufferSource(),gain=context.createGain(),pan=context.createStereoPanner();
  source.buffer=buffers.get(item.url);source.playbackRate.value=Math.max(.65,Math.min(1.5,(options.pitch??1)*(.965+Math.random()*.07)));
  gain.gain.value=(volumes[kind]??.22)*(options.gain??1)*(item.normalization??1);pan.pan.value=Math.max(-.85,Math.min(.85,options.pan??0));
  source.connect(gain);gain.connect(pan);pan.connect(master);voices.add(source);source.onended=()=>{voices.delete(source);source.disconnect();gain.disconnect();pan.disconnect();};source.start();last.set(kind,now);played++;return true;
 }
 function startRain(){if(rainSource)return;const item=groups.rain?.find(x=>buffers.has(x.url));if(item){rainSource=context.createBufferSource();rainSource.buffer=buffers.get(item.url);rainSource.loop=true;rainSource.connect(ambient);rainSource.start();}const wind=groups.wind?.find(x=>buffers.has(x.url));if(wind&&!windSource){windSource=context.createBufferSource();windSource.buffer=buffers.get(wind.url);windSource.loop=true;const g=context.createGain();g.gain.value=.36;windSource.connect(g);g.connect(ambient);windSource.start();}}
 function setEnabled(value){enabled=!!value;bus.gain.setTargetAtTime(enabled?1:0,context.currentTime,.06);if(!enabled)stopEffects();}
 function stopEffects(){for(const voice of [...voices]){try{voice.stop();}catch{}}last.clear();}
 function getState(){return {requested,loaded,failed,played,voices:voices.size,enabled,rain:!!rainSource,wind:!!windSource};}
 return {load,play,setEnabled,stopEffects,getState};
}
