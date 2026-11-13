/* v57: persistent room actions and original Korean welcome narration. */
(()=>{
 'use strict';
 const names={yut:'윷놀이',badugi:'바둑이',gomoku:'오목',seotda:'섯다',poker:'7포커',alkkagi:'알까기',kkung:'쿵쿵따',sichuan:'사천성',tetris:'테트리스'};
 let context=null,busy=false,bar=null;
 const style=document.createElement('style');style.textContent=`
 #room-actions{display:flex;align-items:center;gap:10px;padding:9px 15px;margin:8px 0;background:linear-gradient(#513923,#251b13);border:1px solid #b18a46;border-radius:10px;box-shadow:inset 0 1px #e5c78a44,0 3px 8px #0005;color:#f6e4b7}
 #room-actions[hidden]{display:none}#room-actions-label{margin-right:auto;font-weight:700}#room-actions button{min-width:96px;min-height:40px;border:1px solid #c1a16a;border-radius:7px;color:#fff1d1;background:linear-gradient(#79603b,#3d2c1b);font:inherit;font-weight:700;cursor:pointer}#room-actions #room-resign{background:linear-gradient(#884639,#4c241f)}#room-actions button:disabled{opacity:.45;cursor:default}#room-actions button:focus-visible{outline:3px solid #ffe291;outline-offset:2px}
 body.room-actions-visible :is(#yut-resign,#leave,#gom-resign,#gom-leave,#alk-resign,#alk-leave,#badugi-leave,#kk-resign,#kk-leave,#poker-leave,#seotda-leave,.studio-room-bar [data-studio-action='leave']){display:none!important}
 @media(max-width:540px){#room-actions{padding:8px;gap:7px}#room-actions-label{font-size:13px}#room-actions button{min-width:80px;font-size:13px}}
 `;document.head.append(style);
 function eligible(c){const s=c?.state,i=c?.seat;if(!s||!c.connected||c.isSpectator||!Number.isInteger(i)||!s.players?.[i])return false;const t=s.gameType,g=t==='yut'?s.game:s[t];if(!g)return false;
 if(t==='yut')return g.status==='playing'&&g.participants?.[i]!==false&&!g.retired?.includes(i)&&!g.placements?.some(p=>p.seat===i);
 if(t==='sichuan')return ['countdown','playing'].includes(g.status)&&g.players?.[i]?.status==='playing'&&g.players[i].rank===null;
 if(t==='tetris')return g.status==='playing'&&g.players?.[i]?.alive;
 if(t==='kkung')return g.status==='playing'&&g.players?.[i]?.lives>0;
 if(t==='gomoku'||t==='alkkagi')return g.status==='playing';
 if(!g.players?.[i]?.name||s[t+'Participants']?.[i]===false)return false;
 if(t==='seotda'&&s.seotdaRelay?.status==='playing')return !s.seotdaRelay.retired?.includes(i)&&!s.seotdaRelay.eliminated?.includes(i);
 return g.status==='playing'&&!g.players[i].folded;
 }
 function request(c){const s=c.state,t=s.gameType,g=t==='yut'?s.game:s[t];if(t==='yut')return ['game:resign',{gameId:g.id}];if(t==='sichuan')return ['sichuan:resign',{gameId:g.id}];if(t==='tetris')return ['tetris:resign',{gameId:g.id}];if(t==='kkung')return ['kkung:resign',{gameId:g.id}];if(t==='gomoku')return ['gomoku:act',{action:'resign',revision:g.revision}];if(t==='alkkagi')return ['alkkagi:resign',{gameNo:g.gameNo,revision:g.revision}];return ['card:resign',{gameType:t,handNo:g.handNo,revision:g.revision,replayNo:g.replayNo??0}];}
 function message(c){const s=c.state,t=s.gameType;if(t==='yut'&&s.game.mode==='team')return '기권하면 우리 팀 전체가 패배합니다. 기권하시겠습니까?';if(t==='seotda'&&s.seotdaRelay?.status==='playing')return '섯다 릴레이를 기권하면 남은 칩 전부가 공동 판돈으로 넘어가며 이번 릴레이에 다시 참가할 수 없습니다. 기권하시겠습니까?';if(['badugi','poker','seotda'].includes(t))return '현재 판을 기권합니다. 남은 보유 칩은 유지되며 이미 낸 판돈은 돌려받지 못합니다. 기권하시겠습니까?';return '이번 경기를 기권하시겠습니까?';}
 function mount(){if(bar)return;bar=document.createElement('nav');bar.id='room-actions';bar.setAttribute('aria-label','게임방 메뉴');bar.hidden=true;const label=document.createElement('span');label.id='room-actions-label';const resign=document.createElement('button');resign.id='room-resign';resign.type='button';resign.textContent='기권';const leave=document.createElement('button');leave.id='room-leave';leave.type='button';bar.append(label,resign,leave);const header=document.querySelector('.app header')||document.querySelector('header');if(header)header.after(bar);else document.body.prepend(bar);
 resign.addEventListener('click',async()=>{const c=context;if(busy||!eligible(c))return;const payload=request(c);if(!globalThis.confirm(message(c)))return;busy=true;render(context);try{await c.action(...payload);}finally{busy=false;render(context);}});
 leave.addEventListener('click',async()=>{const c=context;if(busy||!c?.state||!c.connected)return;busy=true;render(context);try{await c.leave();}finally{busy=false;render(context);}});
 }
 function render(c){context=c;mount();const s=c?.state;bar.hidden=!s;document.body.classList.toggle('room-actions-visible',!!s);if(!s)return;bar.querySelector('#room-actions-label').textContent=(names[s.gameType]||'게임')+' · 게임방 메뉴';const resign=bar.querySelector('#room-resign');resign.disabled=busy||!eligible(c);resign.title=eligible(c)?'현재 경기 기권':'진행 중인 경기 참가자만 기권할 수 있습니다';const leave=bar.querySelector('#room-leave');leave.textContent=c.leaveText||'나가기';leave.disabled=busy||!c.connected;}
 globalThis.HodonRoomControls={render};
 let audio=null,attempting=false,played=false;
 const key='hodon:welcome-played:v1';try{played=sessionStorage.getItem(key)==='1';}catch{}
 function settings(){let volume=Number(localStorage.getItem('hodon:sound-volume')??40);if(!Number.isFinite(volume))volume=40;return {muted:localStorage.getItem('hodon:sound-muted')==='1',volume:Math.min(1,Math.max(0,volume/100))*.8};}
 function sync(){const s=settings();if(audio){audio.volume=s.volume;if(s.muted||!s.volume){audio.pause();audio.currentTime=0;}}return s;}
 async function welcome(){if(played||attempting||document.visibilityState==='hidden')return;const s=sync();if(s.muted||!s.volume)return;attempting=true;try{audio??=new Audio('/welcome.mp3?v=58.0');audio.volume=s.volume;await audio.play();played=true;try{sessionStorage.setItem(key,'1');}catch{}}catch{/* Browser gesture restrictions: retry only on the next user action. */}finally{attempting=false;}}
 document.addEventListener('pointerdown',welcome);document.addEventListener('keydown',welcome);document.addEventListener('click',()=>{sync();void welcome();});document.getElementById('sound-volume')?.addEventListener('input',sync);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')audio?.pause();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',welcome,{once:true});else void welcome();
})();
