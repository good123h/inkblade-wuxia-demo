/* 墨刃 · 听雨决 — original Canvas combat prototype with bundled artwork. */
(() => {
'use strict';
const canvas = document.getElementById('game');
if (!canvas) return;
const ctx = canvas.getContext('2d');
const W = canvas.width = 1280, H = canvas.height = 640, GROUND = 509;
const ink = '#202c2b', red = '#a64032', jade = '#426963';
const motionPreference=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
const landscapeArt = new Image();
let artReady=false;
landscapeArt.onload=()=>{artReady=true;};
landscapeArt.src='assets/ink-landscape.png';
const daggerArt=new Image();
let daggerReady=false;
daggerArt.onload=()=>{daggerReady=true;};
daggerArt.src='assets/willow-dagger.png';
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
let seed=1923;
function rand(a=0,b=1){seed=(seed*16807)%2147483647;return a+(seed/2147483647)*(b-a);}
const mountains=Array.from({length:5},(_,i)=>({x:i*320-140,y:rand(160,270),w:rand(310,510),h:rand(160,300)}));
const bamboo=Array.from({length:19},(_,i)=>({x:rand(-40,1320),y:rand(330,475),h:rand(210,480),w:rand(3,9),lean:rand(-45,45),f:rand(.2,.8)}));
const leaves=Array.from({length:30},()=>({x:rand(0,W),y:rand(0,H),s:rand(2,6),v:rand(12,36),phase:rand(0,6.3)}));
const paper=document.createElement('canvas');paper.width=640;paper.height=320;
const pc=paper.getContext('2d');pc.fillStyle='#e9e7db';pc.fillRect(0,0,640,320);
for(let i=0;i<19000;i++){pc.fillStyle=`rgba(69,68,51,${rand(.01,.055)})`;pc.fillRect(rand(0,640),rand(0,320),rand(.4,1.4),rand(.4,1.4));}
let mode='challenge',status='menu',previous='playing',time=0,wave=1,kills=0,score=0,combo=0,bestCombo=0;
let player, enemies=[],particles=[],slashes=[],ghosts=[],projectiles=[],texts=[];
let shake=0,freeze=0,waveDelay=0,lastHit=-10,emitClock=0,visualTime=0,voiceClock=0;
let message='一剑入江湖',messageTimer=0,sound=true,audio=null,hold={left:false,right:false,parry:false},lastStamp=null;
let cue='静候出招',trainingRevives=0,mutedByVisibility=false;
const keyMap={KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',KeyJ:'attack',KeyK:'parry',KeyL:'dash',Space:'skill'};
const keyDown=new Set();
function hero(){return {x:320,y:GROUND,hp:100,qi:65,facing:1,attack:0,attackCD:0,attackStage:0,chainTimer:0,dash:0,dashCD:0,parry:0,parryCD:0,inv:0,hurt:0,step:0,moving:false,damageDone:false};}
player=hero();
function snapshot(){const boss=enemies.find(e=>e.boss&&e.hp>0);return {status,mode,hp:Math.ceil(player.hp),qi:Math.floor(player.qi),wave,kills,combo,score,time:Math.floor(time),message,enemyHp:boss?Math.max(0,Math.ceil(boss.hp)):0,enemyMax:boss?boss.max:0,bestCombo,enemyCount:enemies.filter(e=>e.hp>0).length,cue,assist:mode==='showcase'};}
function emit(){window.dispatchEvent(new CustomEvent('inkstate',{detail:snapshot()}));}
function say(t,duration=2.6){message=t;messageTimer=duration;emit();}
function initAudio(){try{if(!audio)audio=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch(_){sound=false;}}
function tone(freq=160,d=.08,type='triangle',gain=.04,slide=60){if(!sound||!audio||audio.state!=='running')return;const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),audio.currentTime+d);g.gain.setValueAtTime(gain,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+d);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+d);}
function start(m='challenge'){mode=['practice','showcase'].includes(m)?m:'challenge';status='playing';time=0;wave=1;kills=0;score=0;combo=0;bestCombo=0;trainingRevives=0;player=hero();enemies=[];particles=[];slashes=[];ghosts=[];projectiles=[];texts=[];waveDelay=0;freeze=0;shake=0;lastHit=-10;resetInput();spawnWave();initAudio();say(mode==='practice'?'试剑 · 先看刀光，再出手':mode==='showcase'?'自动演示 · AI 操作中':'第一折 · 竹影试锋');emit();}
function resetInput(){hold={left:false,right:false,parry:false};keyDown.clear();}
function pause(){if(status==='playing'){status='paused';previous='playing';resetInput();}else if(status==='paused'){status=previous;lastStamp=null;initAudio();}emit();}
function restart(){start(mode);}
function menu(){status='menu';resetInput();player=hero();enemies=[];particles=[];slashes=[];ghosts=[];projectiles=[];texts=[];message='一剑入江湖';messageTimer=0;emit();}
function resume(){if(status==='paused')pause();}
function enemy(x,boss=false,n=0){const hp=boss?230:wave===1?52:70;return {x,y:GROUND,hp,max:hp,boss,facing:-1,state:'approach',timer:.4+n*.7,attackCD:1.3+n*.5,stun:0,hurt:0,step:n,windup:0,swing:0,struck:false,death:0,speed:boss?108:90+wave*8,variant:n%2};}
function spawnWave(){if(mode==='practice'){enemies=[enemy(860,false)];enemies[0].hp=enemies[0].max=500;return;}enemies=wave===1?[enemy(850,false,0),enemy(1100,false,1)]:wave===2?[enemy(850,false,0),enemy(1130,false,1),enemy(180,false,2)]:[enemy(920,true,0)];}
function burst(x,y,color=ink,n=12,power=1){for(let i=0;i<n;i++)particles.push({x,y,vx:rand(-160,160)*power,vy:rand(-150,60)*power,life:rand(.2,.6),max:.6,r:rand(1,5)*power,color});}
function label(t,x,y,color=ink){texts.push({t,x,y,life:1,max:1,color});}
function attack(){if(status!=='playing'||player.attackCD>0||player.dash>0||player.hurt>.12)return;player.attackStage=player.chainTimer>0?(player.attackStage+1)%3:0;player.chainTimer=.9;player.attack=.27+(player.attackStage===2?.11:0);player.attackCD=player.attackStage===2?.48:.30;player.damageDone=false;player.parry=0;player.x=clamp(player.x+player.facing*12,50,W-50);tone(160+player.attackStage*45,.10,'triangle',.05,65);}
function parry(){if(status!=='playing'||player.parryCD>0||player.dash>0)return;player.parry=.48;player.parryCD=.62;player.attack=0;player.damageDone=true;tone(450,.10,'sine',.025,280);}
function dash(){if(status!=='playing'||player.dashCD>0)return;player.dash=.23;player.dashCD=.9;player.inv=.29;player.attack=0;player.parry=0;player.damageDone=true;burst(player.x,GROUND-10,ink,9);tone(110,.15,'sawtooth',.018,35);}
function skill(){if(status!=='playing'||player.qi<45||player.dash>0)return;player.qi-=45;player.attack=.36;player.attackCD=.5;player.damageDone=true;player.inv=Math.max(player.inv,.2);projectiles.push({x:player.x+player.facing*45,y:GROUND-54,dir:player.facing,life:1.5,hits:new Set()});say('飞刃 · 破竹',1.2);shake=5;tone(260,.4,'triangle',.065,55);}
function action(name,down=true){if(name==='left'||name==='right'){hold[name]=down;return;}if(name==='parry')hold.parry=down;if(!down)return;({attack,parry,dash,skill})[name]?.();}
function damageEnemy(e,amount,heavy=false,fromSkill=false){if(e.hp<=0)return;e.hp-=amount;e.hurt=.2;const armor=e.boss&&(e.windup>0||e.swing>0)&&!fromSkill;if(!armor){e.stun=Math.max(e.stun,heavy?.65:.23);e.windup=0;e.swing=0;e.state='approach';e.x=clamp(e.x+player.facing*(heavy?28:13),50,W-50);}else{label('蓄势不破',e.x,GROUND-173,red);}combo=time-lastHit<2.2?combo+1:1;bestCombo=Math.max(bestCombo,combo);lastHit=time;score+=Math.round(amount*10);if(!fromSkill)player.qi=Math.min(100,player.qi+6);freeze=heavy?.065:.035;shake=heavy?7:3;burst(e.x,GROUND-60,red,heavy?19:10,heavy?1.3:1);tone(heavy?70:110,.12,'triangle',.085,32);if(e.hp<=0){e.death=.65;kills++;score+=e.boss?2000:300;burst(e.x,GROUND-60,ink,25,1.5);label(e.boss?'剑心已明':'破',e.x,GROUND-110,red);}} 
function hitPlayer(e){if(player.inv>0||player.hp<=0)return;const faces=(e.x-player.x)*player.facing>=-10;if(player.parry>0&&faces){const perfect=player.parry>.24;player.qi=Math.min(100,player.qi+(perfect?22:7));if(perfect){e.stun=1.3;e.windup=0;e.swing=0;e.state='approach';player.inv=.3;score+=200;label('破 · 招',player.x,GROUND-125,jade);burst((player.x+e.x)/2,GROUND-75,jade,24,1.1);shake=7;freeze=.1;tone(740,.25,'sine',.09,220);say('弹反成功 · 趁势追击',1.5);}else{label('格挡',player.x,GROUND-100,jade);player.hp=Math.max(1,player.hp-(e.boss?5:2));tone(340,.12,'triangle',.04,200);}return;}
const damage=e.boss?18:10;player.hp=Math.max(0,player.hp-damage);player.hurt=.36;player.inv=.65;player.attack=0;player.x=clamp(player.x+e.facing*30,50,W-50);combo=0;shake=8;burst(player.x,GROUND-55,red,14);label('-'+damage,player.x,GROUND-115,red);tone(80,.2,'sawtooth',.04,30);if(player.hp<=0){status='lost';resetInput();say('胜败寻常 · 再听一回雨');emit();}}
function update(dt){visualTime+=dt;if(!motionPreference.matches)for(const l of leaves){l.x-=l.v*dt;l.y+=Math.sin(visualTime+l.phase)*dt*8+dt*9;if(l.x<-20){l.x=W+20;l.y=rand(0,H-90);}if(l.y>H)l.y=-10;}
if(status!=='playing')return;
time+=dt;emitClock+=dt;if(emitClock>.10){emit();emitClock=0;}
if(messageTimer>0)messageTimer-=dt;
if(time-lastHit>2.2)combo=0;
shake=Math.max(0,shake-dt*30);
if(freeze>0){freeze-=dt;return;}
for(const k of ['attackCD','chainTimer','dashCD','parryCD','inv','hurt'])player[k]=Math.max(0,player[k]-dt);
player.qi=Math.min(100,player.qi+dt*(mode==='practice'?5:2.8));
if(mode==='showcase')autoplay(dt);
let move=(hold.right?1:0)-(hold.left?1:0);player.moving=move!==0;
if(player.dash>0){player.dash-=dt;player.x+=player.facing*730*dt;if(Math.random()<.65)ghosts.push({x:player.x,y:player.y,dir:player.facing,life:.22});}
else if(move&&player.hurt<=0){player.facing=move;player.x+=move*(player.attack>0?95:240)*dt;player.step+=dt*12;}
else player.step+=dt*2;
player.x=clamp(player.x,55,W-55);
if(player.parry>0)player.parry-=dt;
if(player.attack>0){player.attack-=dt;if(!player.damageDone&&player.attack<.21){player.damageDone=true;const reach=player.attackStage===2?155:123;slashes.push({x:player.x,y:GROUND-58,dir:player.facing,life:.21,max:.21,heavy:player.attackStage===2,color:ink});for(const e of enemies)if(e.hp>0&&Math.abs(e.x-player.x)<reach&&(e.x-player.x)*player.facing>-18)damageEnemy(e,player.attackStage===2?26:15,player.attackStage===2);}}
for(const e of enemies){if(e.hp<=0){e.death=Math.max(0,e.death-dt);continue;}e.hurt=Math.max(0,e.hurt-dt);e.attackCD=Math.max(0,e.attackCD-dt);e.facing=player.x>e.x?1:-1;if(e.stun>0){e.stun-=dt;continue;}let distance=Math.abs(e.x-player.x);e.step+=dt*7;
if(e.windup>0){e.windup-=dt;cue=e.boss?'首领蓄势 · 格挡或闪避':'敌人蓄势 · 准备弹反';if(e.windup<=0){e.swing=.30;e.struck=false;e.state='swing';tone(150,.13,'sawtooth',.015,60);}}
else if(e.swing>0){e.swing-=dt;if(!e.struck&&e.swing<.22){e.struck=true;slashes.push({x:e.x,y:GROUND-58,dir:e.facing,life:.25,max:.25,heavy:e.boss,color:red});if(Math.abs(e.x-player.x)<(e.boss?150:116))hitPlayer(e);}if(e.swing<=0){e.state='recover';e.attackCD=e.boss?1.0:1.55;}}
else if(distance>(e.boss?115:88)){e.x+=e.facing*e.speed*dt;e.state='approach';}
else if(e.attackCD<=0){e.windup=e.boss?.72:.85;e.state='windup';}
e.x=clamp(e.x,45,W-45);
}
for(let i=0;i<enemies.length;i++)for(let j=i+1;j<enemies.length;j++){const a=enemies[i],b=enemies[j];if(a.hp>0&&b.hp>0&&Math.abs(a.x-b.x)<49){const d=a.x<b.x?-1:1;a.x+=d*24*dt;b.x-=d*24*dt;}}
for(const p of projectiles){p.x+=p.dir*680*dt;p.life-=dt;for(const e of enemies)if(e.hp>0&&!p.hits.has(e)&&Math.abs(e.x-p.x)<65){p.hits.add(e);damageEnemy(e,50,true,true);}}
projectiles=projectiles.filter(p=>p.life>0&&p.x>-100&&p.x<W+100);
if(!enemies.some(e=>e.hp>0)){waveDelay+=dt;if(waveDelay>1.6){waveDelay=0;if(mode==='practice'){trainingRevives++;spawnWave();say('试剑继续 · 木人已重置');}else if(wave<3){wave++;player.hp=Math.min(100,player.hp+20);player.qi=Math.min(100,player.qi+20);spawnWave();say(wave===2?'第二折 · 风过群竹':'终折 · 听雨问剑',3);}else{status='won';score+=Math.round(player.hp*10);resetInput();say('一念澄明 · 剑过无声');emit();}}}
if(!enemies.some(e=>e.windup>0))cue=player.dashCD>0?'轻功回气中':'看势 · 避锋 · 反击';
}
let autoCD=0;
function autoplay(dt){autoCD-=dt;const e=enemies.filter(e=>e.hp>0).sort((a,b)=>Math.abs(a.x-player.x)-Math.abs(b.x-player.x))[0];if(!e)return;const dist=e.x-player.x;hold.left=dist<-85;hold.right=dist>85;player.facing=dist<0?-1:1;if(e.windup>0&&e.windup<.18&&Math.abs(dist)<150)parry();if(e.windup<=0&&Math.abs(dist)<115&&autoCD<=0){attack();autoCD=.32;}if(player.qi>80&&Math.abs(dist)>160)skill();if(player.hp<35)player.hp+=dt*8;}
function path(points,fill,stroke,width=1){ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);if(fill){ctx.closePath();ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
function line(x1,y1,x2,y2,color,width=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function landscape(){if(artReady){ctx.drawImage(landscapeArt,0,0,W,H);atmosphere();return;}ctx.drawImage(paper,0,0,W,H);const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'rgba(206,218,209,.55)');sky.addColorStop(.65,'rgba(240,235,218,.12)');sky.addColorStop(1,'rgba(128,152,138,.14)');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
ctx.fillStyle='rgba(181,68,48,.75)';ctx.beginPath();ctx.arc(973,152,48,0,Math.PI*2);ctx.fill();
for(let layer=0;layer<3;layer++){ctx.fillStyle=`rgba(65,91,84,${.04+layer*.03})`;ctx.beginPath();ctx.moveTo(-50,410);for(let x=-50;x<=1330;x+=25){const y=310+layer*40-Math.abs(Math.sin(x*.004+layer*1.6))*110-Math.sin(x*.013+layer)*35;ctx.lineTo(x,y);}ctx.lineTo(1330,490);ctx.lineTo(-50,490);ctx.closePath();ctx.fill();}
for(const m of mountains){ctx.fillStyle='rgba(50,75,66,.055)';ctx.beginPath();ctx.moveTo(m.x-m.w/2,430);ctx.bezierCurveTo(m.x-m.w*.2,m.y,m.x-m.w*.05,m.y+35,m.x,m.y);ctx.bezierCurveTo(m.x+m.w*.12,m.y+70,m.x+m.w*.3,300,m.x+m.w/2,430);ctx.fill();}
const fog=ctx.createLinearGradient(0,280,0,465);fog.addColorStop(0,'rgba(239,237,223,0)');fog.addColorStop(.65,'rgba(239,237,223,.7)');fog.addColorStop(1,'rgba(239,237,223,0)');ctx.fillStyle=fog;ctx.fillRect(0,280,W,210);
// Distant pavilion, drawn as brush silhouettes.
ctx.globalAlpha=.22;path([[1030,365],[1054,357],[1066,343],[1080,357],[1105,364],[1070,360]],ink);line(1049,362,1049,394,ink,3);line(1087,362,1087,394,ink,3);line(1042,394,1096,394,ink,4);ctx.globalAlpha=1;
for(const b of bamboo){const alpha=b.x<155||b.x>1140?b.f*.7:b.f*.16;ctx.globalAlpha=alpha;ctx.strokeStyle=ink;ctx.lineWidth=b.w;ctx.beginPath();ctx.moveTo(b.x,b.y+70);ctx.quadraticCurveTo(b.x+b.lean*.4,b.y-b.h*.4,b.x+b.lean,b.y-b.h);ctx.stroke();for(let j=0;j<7;j++){const yy=b.y-j*b.h/7,xx=b.x+b.lean*j/7;line(xx-b.w*.8,yy,xx+b.w*.8,yy, '#deded0',1.3);if(j%2===0){const s=j%4===0?1:-1;line(xx,yy,xx+s*56,yy-26,ink,1.5);for(let z=1;z<5;z++){let lx=xx+s*z*12,ly=yy-z*5;path([[lx,ly],[lx+s*21,ly-23],[lx+s*14,ly-5]],ink);path([[lx,ly],[lx+s*25,ly+11],[lx+s*6,ly+5]],ink);}}}ctx.globalAlpha=1;}
ctx.fillStyle='rgba(93,111,94,.08)';ctx.fillRect(0,GROUND+4,W,H-GROUND);
for(let i=0;i<8;i++){line(0,GROUND+i*2,W,GROUND+i*2,'rgba(47,65,57,.025)',1);}
ctx.strokeStyle='rgba(49,65,52,.22)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,GROUND+4);ctx.bezierCurveTo(350,GROUND-5,800,GROUND+14,W,GROUND+3);ctx.stroke();
// Rocks and bamboo grass anchor the stage.
for(const [x,y,s] of [[45,522,1],[1196,520,1.3],[1100,538,.5],[200,550,.4]]){path([[x-30*s,y],[x-21*s,y-18*s],[x+4*s,y-28*s],[x+32*s,y-8*s],[x+37*s,y+3]],'rgba(49,62,52,.3)');for(let j=0;j<7;j++)line(x+j*3,y,x+j*7-16,y-20-(j%3)*8,'rgba(40,65,48,.35)',1.2);}
atmosphere();
}
function atmosphere(){for(const l of leaves){ctx.save();ctx.translate(l.x,l.y);ctx.rotate(Math.sin(visualTime*.5+l.phase));ctx.fillStyle='rgba(57,82,60,.28)';ctx.beginPath();ctx.ellipse(0,0,l.s*1.8,l.s*.4,-.6,0,Math.PI*2);ctx.fill();ctx.restore();}
// Fine rain is intentionally subtle for legibility.
if(!motionPreference.matches){ctx.strokeStyle='rgba(67,84,78,.10)';ctx.lineWidth=.6;for(let i=0;i<62;i++){const x=(i*113+visualTime*37)%W,y=(i*79+visualTime*240)%H;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-4,y+13);ctx.stroke();}}
}
function fighter(p,isHero=false,ghost=false){let scale=p.boss?1.22:1;ctx.save();ctx.translate(p.x,p.y);ctx.scale(p.facing*scale,scale);if(p.hp<=0){ctx.globalAlpha=p.death/.65;ctx.rotate(-Math.PI/3*(1-p.death/.65));}
if(ghost)ctx.globalAlpha=.13;else if(p.inv>0&&!p.dash&&Math.floor(visualTime*20)%2===0)ctx.globalAlpha=.5;
ctx.fillStyle='rgba(30,44,39,.10)';ctx.beginPath();ctx.ellipse(0,1,34,6,0,0,6.3);ctx.fill();
const step=Math.sin(p.step||0)*(p.moving||(!isHero&&p.state==='approach')?12:2),dash=isHero&&p.dash>0,atk=isHero?p.attack>0:p.swing>0,guard=isHero&&p.parry>0,wind=!isHero&&p.windup>0;const col=p.hurt>0?'#9b4638':isHero?'#233735':p.boss?'#303034':'#52594e';const accent=isHero?'#ac4936':p.boss?'#a13d31':'#918370';
ctx.translate(0,dash?10:Math.sin(visualTime*2+p.x)*1.4);
if(dash)ctx.rotate(.25);
// boots, trousers, asymmetric robe and broad sleeves
path([[-13,-39],[-19-step*.45,-4],[-29-step*.45,0],[-8-step*.45,0],[2,-32]],col);
path([[5,-38],[12+step*.55,-5],[22+step*.55,-1],[2+step*.55,0],[-5,-31]],col);
path([[-11,-85],[12,-81],[18,-55],[30,-23],[5,-29],[-4,-23],[-29,-30],[-19,-58]],col);
path([[-8,-80],[5,-76],[1,-43],[-7,-34],[-17,-31]],isHero?'#b6b9a4':'#777d6d');
path([[3,-76],[16,-64],[9,-45],[2,-46]],isHero?'#d3d3bf':'#8b8f7c');
// trailing scarf, changing shape with motion.
const flutter=Math.sin(visualTime*8+p.x)*7;
path([[-8,-78],[-25,-75],[-48-(dash?25:0),-81+flutter],[-67-(dash?20:0),-66+flutter],[-44,-73+flutter],[-20,-69],[-7,-72]],accent);
path([[-19,-50],[15,-51],[17,-44],[-20,-43]],accent);
line(-16,-46,-35,-24+flutter*.4,accent,3);
// Neck, face, hair and original conical traveling hat.
ctx.fillStyle='#b3b19a';ctx.fillRect(-5,-91,11,13);ctx.beginPath();ctx.ellipse(0,-96,10,13,0,0,6.3);ctx.fill();path([[-10,-100],[-8,-108],[3,-112],[11,-105],[9,-95],[2,-99],[-4,-95]],col);
if(isHero){path([[-25,-102],[0,-119],[25,-102],[6,-99],[-14,-100]],'#303d35');line(-24,-102,25,-102,'#889180',1);line(-5,-106,14,-103,'#798575',1);}
else if(p.boss){path([[-15,-105],[0,-116],[15,-105],[11,-99],[-14,-99]],col);line(0,-114,-23,-127,accent,3);}
else{path([[-12,-103],[12,-104],[12,-97],[-13,-97]],accent);line(-9,-100,-24,-91,accent,3);}
line(3,-94,9,-94,ink,1.5);
// weapon arm and blade, all connected to the torso.
let handX=atk?50:guard?25:wind?-24:29,handY=atk?-69:guard?-82:wind?-114:-57;
path([[9,-78],[22,-76],[handX,handY-6],[handX+2,handY+4],[18,-61],[6,-67]],col);
ctx.fillStyle='#aaa990';ctx.beginPath();ctx.arc(handX,handY,4,0,6.3);ctx.fill();
let angle=atk?-.15:guard?-1.25:wind?-.85:-.67,bladeL=p.boss?79:70;
ctx.save();ctx.translate(handX,handY);ctx.rotate(angle);line(-12,0,0,0,ink,4);line(2,-7,2,7,'#9e9071',2);path([[3,-2],[bladeL,-1],[bladeL+8,0],[bladeL,2],[3,2]],'#d5d7c7',ink,.8);line(8,0,bladeL,0,'#f4f1de',1);ctx.restore();
if(guard){ctx.strokeStyle=player.parry>.24?'#71948b':'rgba(113,148,139,.4)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(9,-64,56,-1.2,1.2);ctx.stroke();}
if(wind){ctx.fillStyle=red;ctx.font='bold 22px serif';ctx.scale(p.facing,1);ctx.fillText('!',-4,-139);ctx.strokeStyle='rgba(166,64,50,.55)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,-65,60,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-p.windup/(p.boss?.72:.85)));ctx.stroke();}
ctx.restore();
if(!isHero&&p.hp>0&&!ghost){const bw=p.boss?100:52;ctx.fillStyle='rgba(35,45,40,.17)';ctx.fillRect(p.x-bw/2,p.y-(p.boss?180:143),bw,3);ctx.fillStyle=p.boss?red:ink;ctx.fillRect(p.x-bw/2,p.y-(p.boss?180:143),bw*clamp(p.hp/p.max,0,1),3);if(p.stun>.3){ctx.fillStyle=jade;ctx.font='13px serif';ctx.textAlign='center';ctx.fillText('破绽',p.x,p.y-155);}}
}
function render(dt){ctx.save();if(shake>0&&status==='playing'&&!motionPreference.matches)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake*.7);landscape();
for(const g of ghosts){g.life-=dt;fighter({x:g.x,y:g.y,facing:g.dir,step:0,hp:1,dash:1},true,true);}ghosts=ghosts.filter(g=>g.life>0);
const figures=[...enemies.map(e=>({p:e,h:false})),{p:player,h:true}].sort((a,b)=>a.p.x-b.p.x);for(const f of figures)if(f.p.hp>0||f.p.death>0)fighter(f.p,f.h);
for(const s of slashes){s.life-=dt;ctx.save();ctx.translate(s.x,s.y);ctx.scale(s.dir,1);ctx.globalAlpha=Math.max(0,s.life/s.max);ctx.strokeStyle=s.color;ctx.lineWidth=s.heavy?9:5;ctx.lineCap='round';ctx.beginPath();ctx.ellipse(12,0,s.heavy?151:116,73,-.2,-1.25,1.05);ctx.stroke();ctx.strokeStyle='#f4efe0';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(12,0,s.heavy?146:112,69,-.2,-1.2,1);ctx.stroke();ctx.restore();}slashes=slashes.filter(s=>s.life>0);
for(const p of projectiles){ctx.save();ctx.translate(p.x,p.y);ctx.scale(p.dir,1);ctx.strokeStyle=daggerReady?'rgba(66,105,99,.32)':jade;ctx.lineWidth=daggerReady?4:9;ctx.beginPath();ctx.arc(-36,0,70,-1.1,1.1);ctx.stroke();ctx.strokeStyle='#eeeeda';ctx.lineWidth=2;ctx.stroke();for(let i=0;i<4;i++)line(-40-i*18,-45+i*26,-100-i*15,-35+i*23,`rgba(66,105,99,${.3-i*.05})`,2);if(daggerReady){ctx.save();ctx.scale(-1,1);ctx.drawImage(daggerArt,50,65,670,280,-58,-23,116,48);ctx.restore();}ctx.restore();}
for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=280*dt;ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.ellipse(p.x,p.y,p.r,p.r*.55,Math.atan2(p.vy,p.vx),0,6.3);ctx.fill();}ctx.globalAlpha=1;particles=particles.filter(p=>p.life>0);
for(const t of texts){t.life-=dt;t.y-=dt*28;ctx.globalAlpha=clamp(t.life/t.max,0,1);ctx.fillStyle=t.color;ctx.font='bold 25px "Noto Serif SC", "Songti SC", SimSun, serif';ctx.textAlign='center';ctx.fillText(t.t,t.x,t.y);}ctx.globalAlpha=1;texts=texts.filter(t=>t.life>0);
ctx.restore();
ctx.save();ctx.textAlign='center';if(messageTimer>0&&status==='playing'){ctx.globalAlpha=Math.min(1,messageTimer);ctx.fillStyle=ink;ctx.font='25px "Noto Serif SC", "Songti SC", SimSun, serif';ctx.fillText(message,W/2,118);ctx.globalAlpha=1;}if(mode==='showcase'&&status==='playing'){ctx.fillStyle=red;ctx.font='14px sans-serif';ctx.fillText('自动演示 · AI 操作 · 不计为真人试玩',W/2,151);}if(combo>=2&&status==='playing'){ctx.textAlign='left';ctx.fillStyle=red;ctx.font='italic 44px Georgia';ctx.fillText(String(combo).padStart(2,'0'),72,218);ctx.font='14px serif';ctx.fillText('连击',135,216);}ctx.restore();
}
function frame(stamp){let dt=lastStamp===null?0:Math.min(.033,(stamp-lastStamp)/1000);lastStamp=stamp;update(dt);render(status==='paused'?0:dt);window.requestAnimationFrame(frame);}
window.addEventListener('keydown',e=>{if(e.defaultPrevented||e.target&&(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable||(e.code==='Space'&&/BUTTON|A/.test(e.target.tagName))))return;if(e.code==='Escape'){e.preventDefault();if(!e.repeat)pause();return;}const a=keyMap[e.code];if(!a)return;if(status==='playing'){e.preventDefault();if(!keyDown.has(e.code)){keyDown.add(e.code);action(a,true);}}});
window.addEventListener('keyup',e=>{const a=keyMap[e.code];keyDown.delete(e.code);if(a)action(a,false);});
window.addEventListener('blur',()=>{resetInput();if(status==='playing')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){resetInput();if(status==='playing')pause();}});
window.InkGame={start,pause,resume,menu,restart,action,setSound(v){sound=!!v;if(sound)initAudio();return sound;},getState:snapshot};
window.requestAnimationFrame(frame);emit();
})();
