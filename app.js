const socket=io();
let rollEffectTimer=null, lastWinnerKey='';
const $=id=>document.getElementById(id);
const ui={landing:$('landing'),room:$('room-section')};
let state=null,seat=null,token=null,selectedMove=0,chosenCount=4,chosenPlayers=4,chosenMode='solo',turnSeconds=45,toastTimer=null;
let selectedPiece=null,moveOptions=[],selectionKey="",animating=false,lastRollSignature="";
const savedName=localStorage.getItem('field-yut:name')||'';
$('nickname').value=savedName;
const requestedCode=new URLSearchParams(location.search).get('room')?.toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6)||'';
$('joincode').value=requestedCode;
const COLORS=['#EF6461','#5E9EFF','#F3C763','#59CFA6'];
const JERSEY_TEXT=['#fff8ef','#eef7ff','#3f2b00','#073126'];
const YUT={'0':'낙','-1':'빽도',1:'도',2:'개',3:'걸',4:'윷',5:'모'};
const XY={};
for(let i=0;i<20;i++){
 let x,y;
 if(i<=5){x=530;y=530-i*92;}
 else if(i<=10){x=530-(i-5)*92;y=70;}
 else if(i<=15){x=70;y=70+(i-10)*92;}
 else {x=70+(i-15)*92;y=530;}
 XY[i]=[x,y];
}
Object.assign(XY,{20:[453,147],21:[377,223],24:[300,300],25:[223,377],26:[147,453],27:[147,147],28:[223,223],29:[377,377],30:[453,453]});
const TRACKS={outer:[...Array(20).keys(),0,'FIN'],a:[5,20,21,24,25,26,15,16,17,18,19,0,'FIN'],ac:[5,20,21,24,29,30,0,'FIN'],bc:[10,27,28,24,25,26,15,16,17,18,19,0,'FIN'],b:[10,27,28,24,29,30,0,'FIN']};
function node(p){return p===null?null:TRACKS[p.track]?.[p.idx];}
function notify(text){const t=$('toast');t.textContent=text;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3300)}
function action(name,args={}){return new Promise(resolve=>{if(!socket.connected){notify('서버 연결을 확인해 주세요.');return resolve(null);}socket.timeout(8000).emit(name,args,(err,res)=>{if(err){notify('서버 응답이 지연되고 있습니다.');return resolve(null);}if(!res?.ok){notify(res?.error||'요청을 완료하지 못했습니다.');return resolve(null);}resolve(res);});});}
function saveSession(code,newToken,newSeat){token=newToken;seat=newSeat;localStorage.setItem(`field-yut:session:${code}`,token);history.replaceState({},'',`?room=${code}`);if(state)render()}
function forgetSession(){if(state?.code)localStorage.removeItem(`field-yut:session:${state.code}`);token=null;seat=null;state=null;history.replaceState({},'','/');render();}
function validName(){const name=$('nickname').value.trim();if(!name){notify('닉네임을 입력해 주세요.');$('nickname').focus();return null;}localStorage.setItem('field-yut:name',name.slice(0,14));return name.slice(0,14)}
async function create(){const name=validName();if(!name)return;const res=await action('room:create',{name,piecesPerPlayer:chosenCount,playerCount:chosenPlayers,matchMode:chosenMode,turnSeconds});if(res)saveSession(res.code,res.token,res.seat)}
async function join(roomCode){const code=String(roomCode||'').toUpperCase().trim();if(code.length!==6){notify('6자리 초대 코드를 입력해 주세요.');return;}
  const existing=localStorage.getItem(`field-yut:session:${code}`);
  const name=existing||validName();if(!name)return;
  const res=await action('room:join',{code,name:existing?undefined:name,token:existing||undefined});
  if(res)saveSession(res.code,res.token,res.seat);
}
document.querySelectorAll('.player-limit').forEach(b=>b.addEventListener('click',()=>{
 if(chosenMode==='team')return;
 chosenPlayers=Number(b.dataset.n);document.querySelectorAll('.player-limit').forEach(x=>x.classList.toggle('selected',x===b));
}));
document.querySelectorAll('.match-mode').forEach(b=>b.addEventListener('click',()=>{
 chosenMode=b.dataset.mode;
 document.querySelectorAll('.match-mode').forEach(x=>x.classList.toggle('selected',x===b));
 const team=chosenMode==='team';if(team){chosenPlayers=4;chosenCount=3;}
 document.querySelectorAll('.player-limit').forEach(x=>{x.disabled=team;x.classList.toggle('selected',Number(x.dataset.n)===chosenPlayers)});
 document.querySelectorAll('#piece-options .count').forEach(x=>{x.disabled=team;x.classList.toggle('selected',Number(x.dataset.n)===chosenCount)});
 $('mode-explain').textContent=team?'2대2 팀전: 4명 · 1인당 말 3개 · 청팀(1·3번) / 홍팀(2·4번)':'개인전: 2~4명 · 말 1~4개';
}));
$('turn-seconds').addEventListener('change',e=>turnSeconds=Number(e.target.value));
$('create').addEventListener('click',create);
$('throw-power').addEventListener('input',e=>$('power-label').textContent=e.target.value);
$('join').addEventListener('click',()=>join($('joincode').value));
$('joincode').addEventListener('keydown',e=>{if(e.key==='Enter')join($('joincode').value)});
$('nickname').addEventListener('keydown',e=>{if(e.key==='Enter')requestedCode?join(requestedCode):create()});
document.querySelectorAll('#piece-options .count').forEach(b=>b.addEventListener('click',()=>{
 if(chosenMode==='team')return;
 chosenCount=Number(b.dataset.n);document.querySelectorAll('.count').forEach(x=>x.classList.toggle('selected',x===b));
}));
$('copy-link').addEventListener('click',async()=>{if(!state)return;const link=`${location.origin}/?room=${state.code}`;
 try{await navigator.clipboard.writeText(link);notify('초대 링크가 복사되었습니다.')}catch{prompt('초대 링크를 복사하세요',link)}
});
$('leave').addEventListener('click',async()=>{const r=await action('room:leave');if(r)forgetSession()});
$('start').addEventListener('click',async()=>{lastWinnerKey='';await action('game:start')});
$('victory-close').addEventListener('click',()=>{$('victory-overlay').classList.add('hidden')});
$('throw').addEventListener('click',async()=>{
 if(animating)return;
 animating=true;$('throw').disabled=true;const arena=$('yut-arena');arena.classList.remove('throwing');void arena.offsetWidth;arena.classList.add('throwing');
 const r=await action('game:throw',{power:Number($('throw-power').value)});if(r){selectedMove=0;clearSelection();}
 setTimeout(()=>{arena.classList.remove('throwing');animating=false;renderPlay()},920);
});
function clearSelection(){selectedPiece=null;moveOptions=[];selectionKey='';}
function chooseMove(i){selectedMove=i;clearSelection();renderPlay();drawBoard()}
async function selectPiece(pieceIndex){
 const g=state?.game;if(!g||g.turn!==seat||!g.moves.length||animating)return;
 const key=`${state.code}:${g.turn}:${g.moves.join(',')}:${pieceIndex}:${selectedMove}`;
 if(selectedPiece===pieceIndex&&selectionKey===key){clearSelection();renderPlay();drawBoard();return;}
 const r=await action('game:options',{pieceIndex,moveIndex:selectedMove});if(!r)return;
 selectedPiece=pieceIndex;selectionKey=key;moveOptions=r.choices||[];
 if(!moveOptions.length)notify('이 말은 현재 결과로 이동할 수 없습니다.');
 renderPlay();drawBoard();
}
async function confirmMove(choiceId){
 if(selectedPiece===null||animating)return;
 const pieceIndex=selectedPiece;const r=await action('game:move',{pieceIndex,moveIndex:selectedMove,choiceId});
 if(r){selectedMove=0;clearSelection();renderPlay();drawBoard()}
}

socket.on('connect',async()=>{
 $('connection').textContent='● 온라인';$('connection').classList.remove('off');
 const code=state?.code||requestedCode; if(!code)return;
 const stored=localStorage.getItem(`field-yut:session:${code}`);
 if(stored){const res=await action('room:join',{code,token:stored});if(res)saveSession(res.code,res.token,res.seat);else if(state)forgetSession();}
 else if(requestedCode && savedName){await join(requestedCode)}
});
socket.on('disconnect',()=>{$('connection').textContent='● 연결 끊김 · 재연결 중';$('connection').classList.add('off')});
socket.on('room:state',s=>{const old=state?.game;const turnChanged=old&&s.game&&(old.turn!==s.game.turn||old.moves.join(',')!==s.game.moves.join(',')||JSON.stringify(old.pieces)!==JSON.stringify(s.game.pieces));if(turnChanged)clearSelection();state=s;render();checkVictory(old,s.game);});
function showRollEffect(result){
 if(!result?.name)return;
 const el=$('roll-effect');clearTimeout(rollEffectTimer);
 el.classList.remove('active','back','nak');void el.offsetWidth;
 el.classList.toggle('back',result.steps===-1);el.classList.toggle('nak',result.steps===0);
 el.replaceChildren();const word=document.createElement('strong');word.className='roll-word';word.textContent=`${result.name}!`;el.append(word);
 el.classList.add('active');rollEffectTimer=setTimeout(()=>el.classList.remove('active'),1550);
}
function checkVictory(oldGame,newGame){
 if(!newGame||newGame.status!=='finished'||oldGame?.status==='finished')return;
 const code=state?.code||'';const key=`${code}:${newGame.winner}:${newGame.log?.at(-1)||''}`;
 if(key===lastWinnerKey)return;lastWinnerKey=key;
 const winner=newGame.mode==='team'?(newGame.winner%2===0?'청팀':'홍팀'):(state.players[newGame.winner]?.name||'플레이어');
 $('victory-name').textContent=`${winner} 우승!`;
 $('victory-overlay').classList.remove('hidden');
}
socket.on('game:roll-effect',showRollEffect);
socket.on('session:replaced',()=>{notify('다른 브라우저에서 같은 참가자 계정으로 접속했습니다.');forgetSession()});
function render(){ui.landing.classList.toggle('hidden',!!state);ui.room.classList.toggle('hidden',!state);if(!state)return;
 const g=state.game;
 $('room-code').textContent=state.code;
 $('player-count').textContent=`${state.players.filter(Boolean).length} / ${state.playerCount||state.players.length}`;
 $('room-subtitle').textContent=g?(g.status==='finished'?`🏆 ${g.mode==='team'?(g.winner%2===0?'청팀':'홍팀'):state.players[g.winner]?.name+' 님'} 승리!`:'친구들과 실시간으로 윷놀이 중입니다.'):`${state.playerCount||state.players.length}명이 모이면 게임을 시작할 수 있습니다.`;
 $('game-mode').textContent=g?(g.status==='finished'?'게임 종료':g.mode==='team'?'2대2 팀전':'개인전'):'대기 중';
 $('board-status').classList.toggle('hidden',!!g);
 $('play-panel').classList.toggle('hidden',!g);
 const players=$('players');players.replaceChildren();state.players.forEach((p,i)=>{
  const row=document.createElement('div');row.className='player-row'+(g?.turn===i&&g.status==='playing'?' active':'');
  const d=document.createElement('div');d.className='dot';d.style.background=COLORS[i];row.append(d);
  const name=document.createElement('span');name.className='name';name.textContent=p?.name||`빈자리 ${i+1}`;row.append(name);
  const role=document.createElement('small');role.textContent=(state.matchMode==='team'?(i%2===0?'🔵 청팀 ':'🔴 홍팀 '):'')+(i===state.host?'👑 방장 ':'')+(i===seat?'(나) ':'')+(p&&!p.connected?'⚠ 오프라인':'');if(p&&!p.connected)role.className='disconnected';row.append(role);players.append(row);
 });
 $('lobby-action').classList.toggle('hidden',!!g&&g.status==='playing');
 $('start').disabled=seat!==state.host||state.players.some(p=>!p?.connected);
 $('start').textContent=g?.status==='finished'?'🔄 다시 플레이하기':state.players.filter(Boolean).length===state.players.length?'🎲 게임 시작하기':`${state.players.length}명 모이면 시작`;
 $('leave').disabled=g?.status==='playing';
 renderRoster();drawBoard();renderPlay();
 const log=$('game-log');log.replaceChildren();(g?.log||[]).slice().reverse().forEach(line=>{const row=document.createElement('div');row.className='log-item';row.textContent=line;log.append(row)});
 if(!g){log.textContent='친구들이 입장하면 게임을 시작할 수 있습니다.'}
}
function renderRoster(){
 const root=$('roster');root.replaceChildren();const g=state.game;
 state.players.forEach((player,p)=>{
  const panel=document.createElement('div');panel.className='roster-player'+(g?.turn===p?' turn':'');
  const title=document.createElement('div');title.className='roster-name';title.style.color=COLORS[p];
  const pname=document.createElement('span');pname.textContent=`⚽ ${player?.name||'대기'}`;const info=document.createElement('small');
  info.textContent=g?`${g.mode==='team'?(p%2===0?'청팀 · ':'홍팀 · '):''}완주 ${g.pieces[p].filter(x=>node(x)==='FIN').length}/${g.piecesPerPlayer}`:`입장 대기`;title.append(pname,info);panel.append(title);
  const tokens=document.createElement('div');tokens.className='roster-tokens';
  for(let i=0;i<(g?.piecesPerPlayer||state.piecesPerPlayer);i++){
   const n=g?node(g.pieces[p][i]):null;const b=document.createElement('button');b.className='token-control';
   const ready=!!g&&g.turn===seat&&seat===p&&g.moves.length>0&&n!=='FIN'&&(g.moves[selectedMove]!==-1||n!==null)&&g.status==='playing';
   if(ready)b.classList.add('ready');if(selectedPiece===i&&p===seat)b.classList.add('sel');
   b.style.borderColor=COLORS[p];b.textContent=`호돈 ${i+1} ${n==='FIN'?'✓':n===null?'대기':'이동중'}`;b.title=n==='FIN'?'완주':n===null?'대기 중':`${n}번 칸`;
   b.disabled=!ready;b.addEventListener('click',()=>selectPiece(i));tokens.append(b);
  }
  panel.append(tokens);root.append(panel);
 });
}
function renderPlay(){if(!state?.game)return;const g=state.game;
 $('team-label').textContent=g.mode==='team'?'🔵 1·3번 vs 🔴 2·4번 · 팀당 6개':'';
 if(selectedMove>=g.moves.length)selectedMove=0;
 const own=g.turn===seat,active=g.status==='playing';
 $('turn-info').textContent=g.status==='finished'?`🏆 ${g.mode==='team'?(g.winner%2===0?'청팀':'홍팀'):state.players[g.winner]?.name+' 님'} 승리!`:own?`🟢 내 차례 · 남은 던지기 ${g.rollCredits}회`:`⏳ ${state.players[g.turn]?.name||'상대방'} 님 차례`;
 const els=Array.from($('sticks').children);
 els.forEach((el,i)=>{const back=!!g.lastThrow?.sticks[i];el.classList.toggle('back',back);el.classList.toggle('marked',i===0);el.style.setProperty('--face',back?'180deg':'0deg');el.style.setProperty('--angle',`${[-15,13,-8,16][i]}deg`)});
 $('throw-result').textContent=g.lastThrow?`${g.lastThrow.name} · ${g.lastThrow.steps===0?'이번 던지기 소멸':g.lastThrow.steps===-1?'뒤로 1칸':`${g.lastThrow.steps}칸`}`:'윷을 던져주세요';
 $('throw').disabled=!own||g.rollCredits===0||!active||animating;
 $('throw').textContent=g.rollCredits===0?'던지기 횟수가 없습니다':'🎲 윷 던지기';
 $('moves').replaceChildren();g.moves.forEach((step,i)=>{const b=document.createElement('button');b.className='move-chip'+(selectedMove===i?' active':'');b.textContent=`${YUT[step]} · ${step===-1?'뒤로 1칸':`${step}칸`}`;b.addEventListener('click',()=>chooseMove(i));$('moves').append(b)});
 $('destination-options').replaceChildren();
 if(selectedPiece!==null)moveOptions.forEach(opt=>{const b=document.createElement('button');b.className='move-chip';b.textContent=`${opt.label} ${opt.node==='FIN'?'🏁 완주':opt.node===null?'↩ 대기칸':`→ ${opt.node}번 칸`}`;b.addEventListener('click',()=>confirmMove(opt.id));$('destination-options').append(b)});
 $('move-hint').textContent=selectedPiece!==null&&moveOptions.length?'✨ 빛나는 도착 칸을 눌러 이동하세요. 갈림길에서는 원하는 경로를 고르세요.':g.moves.length?'① 윷 결과 선택  ② 우측 내 말 선택  ③ 빛나는 도착 칸 클릭':g.rollCredits?'윷을 던져 이동 거리를 정하세요.':'상대 차례를 기다려 주세요.';
 $('piece-buttons').replaceChildren();const myPieces=g.pieces[seat]||[];myPieces.forEach((p,i)=>{
  const b=document.createElement('button');b.className='piece-button'+(selectedPiece===i?' sel':'');const n=node(p);b.textContent=`말 ${i+1} · ${n==='FIN'?'완주':n===null?'대기':'판 위'}`;
  b.disabled=!own||!active||!g.moves.length||n==='FIN'||(g.moves[selectedMove]===-1&&n===null);b.addEventListener('click',()=>selectPiece(i));$('piece-buttons').append(b);
 });
 // Update highlighted selection in roster after changing an active result.
 document.querySelectorAll('.roster-player').forEach((panel,p)=>panel.querySelectorAll('.token-control').forEach((b,i)=>{
  b.classList.toggle('sel',p===seat&&selectedPiece===i);
  const n=g.pieces[p]?.[i]===null?null:node(g.pieces[p]?.[i]);
  const ready=p===seat&&own&&active&&g.moves.length>0&&n!=='FIN'&&(g.moves[selectedMove]!==-1||n!==null);
  b.disabled=!ready;b.classList.toggle('ready',ready);
 }));
}
const NS='http://www.w3.org/2000/svg';
function svgEl(type,attrs={},text){const el=document.createElementNS(NS,type);for(const [key,v] of Object.entries(attrs))el.setAttribute(key,String(v));if(text!==undefined)el.textContent=text;return el}
function pathD(ids){return ids.map((id,i)=>(i?'L':'M')+XY[id].join(' ')).join(' ')}
function drawHodongPiece(root,{x,y,color,index,stack=1,selected=false,clickable=false,onClick}){
 const g=svgEl('g',{transform:`translate(${x} ${y})`,class:'piece-avatar'+(selected?' selected-piece':'')});
 if(clickable&&onClick){g.style.cursor='pointer';g.addEventListener('click',onClick)}
 g.append(svgEl('circle',{cx:0,cy:0,r:22,fill:color,stroke:selected?'#a1ffca':'#2e3628','stroke-width':selected?4:2.2}));
 // The face is a real Ronaldo portrait asset. Color is the player jersey ring/body.
 g.append(svgEl('image',{href:'/hodon-face.png',x:-17,y:-19,width:34,height:34,class:'face-cutout'}));
 g.append(svgEl('rect',{x:-13,y:11,width:26,height:9,rx:4,fill:color,stroke:'rgba(0,0,0,.35)','stroke-width':1}));
 g.append(svgEl('text',{x:0,y:18,'text-anchor':'middle','font-size':8.5,'font-weight':900,fill:'#fff','pointer-events':'none'},stack>1?`×${stack}`:String(index+1)));
 root.append(g);
}
function drawBoard(){const root=$('board');root.replaceChildren();
 const defs=svgEl('defs');
 const wood=svgEl('linearGradient',{id:'hodon-wood',x1:'0%',y1:'0%',x2:'100%',y2:'100%'});
 [['0%','#f9eacf'],['48%','#f4e0b8'],['100%','#d7b77d']].forEach(([offset,color])=>wood.append(svgEl('stop',{offset,'stop-color':color})));
 const edge=svgEl('linearGradient',{id:'hodon-edge',x1:'0%',y1:'0%',x2:'100%',y2:'100%'});
 [['0%','#ffe9a1'],['50%','#9b6e2f'],['100%','#f4d380']].forEach(([offset,color])=>edge.append(svgEl('stop',{offset,'stop-color':color})));
 defs.append(wood,edge);root.append(defs);
 root.append(svgEl('rect',{x:12,y:12,width:576,height:576,rx:30,fill:'#6e4c22',stroke:'#bf9b50','stroke-width':5}));
 root.append(svgEl('rect',{x:19,y:19,width:562,height:562,rx:24,fill:'url(#hodon-wood)',stroke:'url(#hodon-edge)','stroke-width':9}));
 root.append(svgEl('rect',{x:43,y:43,width:514,height:514,rx:7,fill:'none',stroke:'#caa878','stroke-width':2}));
 root.append(svgEl('image',{href:'/hodon-face.png',x:215,y:205,width:170,height:170,opacity:.075,'pointer-events':'none'}));
 root.append(svgEl('text',{x:300,y:425,'text-anchor':'middle',fill:'#90744f',opacity:.24,'font-size':44,'font-weight':900,'pointer-events':'none'},'호돈 윷놀이'));
 const outer=[0,...Array.from({length:19},(_,i)=>i+1),0];
 [outer,[5,20,21,24,25,26,15],[10,27,28,24,29,30,0]].forEach(route=>root.append(svgEl('path',{d:pathD(route),class:'path'})));
 Object.entries(XY).forEach(([id,[x,y]])=>{const important=[0,5,10,15,24].includes(Number(id));root.append(svgEl('circle',{cx:x,cy:y,r:important?19:13,class:'spot'+(important?' big':'')}));});
 root.append(svgEl('text',{x:300,y:312,'text-anchor':'middle',fill:'#795e3c','font-size':12,'font-weight':800},'중앙'));
 root.append(svgEl('text',{x:527,y:567,'text-anchor':'middle',fill:'#795e3c','font-size':13,'font-weight':800},'출발/도착'));
 if(!state?.game){root.append(svgEl('text',{x:300,y:400,'text-anchor':'middle',fill:'#9b815e','font-size':34,'font-weight':900},'호돈 윷놀이'));return;}
 const g=state.game;const all=[];
 g.pieces.forEach((row,p)=>row.forEach((piece,i)=>{
  const n=node(piece);if(n==='FIN'||n===null)return;const center=XY[n];if(!center)return;
  all.push({p,i,n,x:center[0],y:center[1]});
 }));
 const groups=new Map();all.forEach(item=>{const key=`node-${item.n}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item)});
 for(const list of groups.values()){
  const bundles=new Map();list.forEach(item=>{if(!bundles.has(item.p))bundles.set(item.p,[]);bundles.get(item.p).push(item)});
  Array.from(bundles.entries()).forEach(([p,bundle],j)=>{
   const base=bundle[0];const positions=Array.from(bundles.keys()).length===1?[[0,0]]:[[0,-13],[13,0],[0,13],[-13,0]];
   const delta=positions[j]||[0,0];const x=base.x+delta[0],y=base.y+delta[1];
   const playable=p===seat&&g.turn===seat&&g.moves.length>0;
   const selected=playable&&selectedPiece!==null&&bundle.some(e=>e.i===selectedPiece);
   drawHodongPiece(root,{x,y,color:COLORS[p],index:base.i,stack:bundle.length,selected,clickable:playable,onClick:()=>selectPiece(base.i)});
  });
 }
 if(selectedPiece!==null&&moveOptions.length){moveOptions.forEach((opt)=>{
  const xy=opt.node===null?[530,530]:opt.node==='FIN'?[551,552]:XY[opt.node];if(!xy)return;
  const c=svgEl('circle',{cx:xy[0],cy:xy[1],r:27,class:'spot destination dest-button',tabindex:0,role:'button','aria-label':`${opt.label} ${opt.node===null?'대기':opt.node==='FIN'?'완주':opt.node+'번 칸'}`});
  const ripple=svgEl('circle',{cx:xy[0],cy:xy[1],r:31,class:'destination-pulse'});
  c.addEventListener('click',()=>confirmMove(opt.id));c.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();confirmMove(opt.id)}});root.append(ripple,c);
  root.append(svgEl('text',{x:xy[0],y:xy[1]+5,'text-anchor':'middle',class:'destination-label'},opt.node===null?'대기':opt.node==='FIN'?'완주':opt.label==='지름길'?'지름':'이동'));
 });}
}
render();

// Live countdown; server remains the source of truth when time expires.
setInterval(()=>{const g=state?.game;const el=$('turn-clock');if(!el)return;if(!g||g.status!=='playing'){el.textContent='⏱ 대기';return;}const sec=Math.max(0,Math.ceil((g.turnDeadline-Date.now())/1000));el.textContent=`⏱ ${sec}초`;el.classList.toggle('urgent',sec<=10);},250);
async function loadRank(){const r=await action('rank:get');if(!r)return;const el=$('rankings');el.replaceChildren();if(!r.rankings?.length){el.textContent='아직 완료된 게임이 없습니다.';return;}r.rankings.slice(0,10).forEach((x,i)=>{const row=document.createElement('div');row.className='rank-row';const name=document.createElement('span');name.textContent=`${i+1}위 · ${x.name}`;const stat=document.createElement('b');stat.textContent=`${x.wins}승 / ${x.played}판`;row.append(name,stat);el.append(row);});}
$('refresh-rank').addEventListener('click',loadRank);
socket.on('connect',()=>setTimeout(loadRank,400));
