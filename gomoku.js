// Renju geometry and RIF classic opening. All authoritative decisions happen on the server.
export const SIZE=15,DIRECTIONS=[[1,0],[0,1],[1,1],[1,-1]];
const inside=(x,y)=>x>=0&&y>=0&&x<15&&y<15;
const xy=i=>[i%15,Math.floor(i/15)];
const step=(i,dx,dy,n)=>{const [x,y]=xy(i);return inside(x+dx*n,y+dy*n)?(y+dy*n)*15+x+dx*n:-1;};
function run(board,i,color,dx,dy){const result=[i];for(const sign of [-1,1])for(let n=1;;n++){const p=step(i,dx,dy,n*sign);if(p<0||board[p]!==color)break;result.push(p);}return result;}
export function linesAt(board,i,color){return DIRECTIONS.map(([dx,dy])=>run(board,i,color,dx,dy));}
function fours(board,i){const found=new Map();for(const [dx,dy] of DIRECTIONS){for(let offset=-4;offset<=0;offset++){
 const cells=Array.from({length:5},(_,n)=>step(i,dx,dy,offset+n));if(cells.some(p=>p<0))continue;
 const stones=cells.filter(p=>board[p]===1),empty=cells.filter(p=>board[p]===0);if(stones.length!==4||empty.length!==1||!stones.includes(i))continue;
 board[empty[0]]=1;const win=run(board,empty[0],1,dx,dy).length===5;board[empty[0]]=0;if(!win)continue;
 const key=stones.slice().sort((a,b)=>a-b).join(',');if(!found.has(key))found.set(key,{stones,ends:new Set()});found.get(key).ends.add(empty[0]);
 }}return [...found.values()];}
function straightFour(board,i,j,dx,dy){
 const found=[];for(let offset=-3;offset<=0;offset++){
  const cells=Array.from({length:4},(_,n)=>step(i,dx,dy,offset+n)),a=step(i,dx,dy,offset-1),b=step(i,dx,dy,offset+4);
  if(a<0||b<0||board[a]!==0||board[b]!==0||!cells.includes(j)||cells.some(p=>p<0||board[p]!==1))continue;
  let both=true;for(const end of [a,b]){board[end]=1;if(run(board,end,1,dx,dy).length!==5)both=false;board[end]=0;}if(both)found.push(cells);
 }return found;
}
function classifyPlaced(board,i,memo){
 const key=i+':'+board.join('');if(memo.has(key))return memo.get(key);
 const lines=linesAt(board,i,1);
 if(lines.some(l=>l.length===5)){const r={win:true,reason:null};memo.set(key,r);return r;}
 if(lines.some(l=>l.length>=6)){const r={win:false,reason:'장목'};memo.set(key,r);return r;}
 if(fours(board,i).length>=2){const r={win:false,reason:'4·4'};memo.set(key,r);return r;}
 const threes=new Set();
 // A three must be extendable to a straight four by a legal black move.
 // This recursively excludes false threes, including extensions forbidden by another double-three.
 for(const [dx,dy] of DIRECTIONS)for(let n=-3;n<=3;n++){
  const j=step(i,dx,dy,n);if(j<0||board[j]!==0)continue;
  board[j]=1;
  try{
   const open=straightFour(board,i,j,dx,dy);if(!open.length)continue;
   const extension=classifyPlaced(board,j,memo);if(extension.win||extension.reason)continue;
   for(const cells of open){threes.add(cells.filter(p=>p!==j).sort((a,b)=>a-b).join(','));}
  }finally{board[j]=0;}
  if(threes.size>=2){const r={win:false,reason:'3·3'};memo.set(key,r);return r;}
 }
 const r={win:false,reason:null};memo.set(key,r);return r;
}
export function blackMove(board,i){if(!Number.isInteger(i)||i<0||i>=225||board[i]!==0)return {win:false,reason:'착수 불가'};board[i]=1;try{return classifyPlaced(board,i,new Map());}finally{board[i]=0;}}
export function forbiddenPoints(g){
 if(g.status!=='playing'||g.phase!=='play'||g.colors[g.turn]!==1)return [];
 if(g.forbiddenRevision===g.revision)return g.forbiddenCache;
 const list=[];if(g.board.filter(c=>c===1).length>=4)for(let i=0;i<225;i++)if(g.board[i]===0){const r=blackMove(g.board,i);if(r.reason)list.push({i,reason:r.reason});}
 g.forbiddenRevision=g.revision;g.forbiddenCache=list;return list;
}
export const coord=i=>String.fromCharCode(65+i%15)+(15-Math.floor(i/15));
function addLog(g,s){g.log.push(s);g.log=g.log.slice(-60);}
function finish(g,winner,reason){g.status='finished';g.winner=winner;g.reason=reason;g.turn=null;g.pending=null;g.revision++;addLog(g,winner===null?'무승부 · '+reason:`${g.names[winner]} 승리 · ${reason}`);}
function remaining(g,seat,now){return g.clocks[seat]-(g.status==='playing'&&!g.pending&&g.turn===seat?Math.max(0,now-g.tickAt):0);}
function charge(g,now){if(g.status!=='playing'||g.pending)return;g.clocks[g.turn]=Math.max(0,remaining(g,g.turn,now));g.tickAt=now;if(g.clocks[g.turn]===0)finish(g,1-g.turn,'시간 초과');}
function update(g,now){g.revision++;g.tickAt=now;g.forbiddenRevision=-1;}
function blackSeat(g){return g.colors.indexOf(1);}function whiteSeat(g){return g.colors.indexOf(2);}
export function newGomoku(names,{minutes=5,gameNo=1,opener=0}={},now=Date.now()){
 return {names:[...names],board:Array(225).fill(0),history:[],colors:opener===0?[1,2]:[2,1],opener,turn:opener,phase:'opening3',status:'playing',revision:1,tickAt:now,clocks:[minutes*60000,minutes*60000],minutes,gameNo,winner:null,reason:'',proposals:[],passes:0,pending:null,log:['국제 렌주 · RIF 클래식 오프닝','선제안자가 중앙 흑돌부터 흑·백·흑 3수를 배치합니다.'],winLine:[],forbiddenRevision:-1,forbiddenCache:[]};
}
function symmetries(){return [(x,y)=>[x,y],(x,y)=>[-y,x],(x,y)=>[-x,-y],(x,y)=>[y,-x],(x,y)=>[-x,y],(x,y)=>[x,-y],(x,y)=>[y,x],(x,y)=>[-y,-x]];}
export function equivalentProposals(board,a,b){
 for(const f of symmetries()){
  let same=true;for(let i=0;i<225;i++){const [x,y]=xy(i),[u,v]=f(x-7,y-7);if(board[i]!==board[(v+7)*15+u+7]){same=false;break;}}
  if(same){const [x,y]=xy(a),[u,v]=f(x-7,y-7);if((v+7)*15+u+7===b)return true;}
 }return false;
}
function place(g,i,color,seat,opening=false){g.board[i]=color;g.history.push({i,color,seat,opening});addLog(g,`${color===1?'●':'○'} ${g.names[seat]} · ${coord(i)}`);}
export function tickGomoku(g,now=Date.now()){
 if(!g||g.status!=='playing')return false;
 if(g.pending){if(now>=g.pending.expires){g.pending=null;update(g,now);addLog(g,'요청 응답 시간 초과 · 대국 재개');return true;}return false;}
 const was=g.status;charge(g,now);return was!==g.status;
}
export function actGomoku(g,seat,data,now=Date.now()){
 if(!g||g.status!=='playing')throw Error('진행 중인 오목 대국이 아닙니다.');
 if(!Number.isInteger(seat)||seat<0||seat>1)throw Error('대국자만 조작할 수 있습니다.');
 if(data.revision!==g.revision)throw Error('대국이 갱신되었습니다. 현재 판을 다시 확인하세요.');
 if(tickGomoku(g,now)&&g.status==='finished')return;
 if(data.action==='resign'){charge(g,now);if(g.status==='playing')finish(g,1-seat,'기권');return;}
 if(data.action==='respond'){
  const p=g.pending;if(!p||seat===p.from)throw Error('상대의 요청이 없습니다.');
  if(typeof data.accept!=='boolean')throw Error('수락 또는 거절을 선택하세요.');
  g.pending=null;
  if(data.accept&&p.kind==='draw'){finish(g,null,'합의');return;}
  if(data.accept&&p.kind==='undo'){const removed=g.history.splice(p.target);removed.forEach(m=>g.board[m.i]=0);g.turn=p.from;g.passes=0;addLog(g,`무르기 수락 · ${removed.length}수 되돌림`);}else addLog(g,data.accept?'요청 수락':'요청 거절');
  update(g,now);return;
 }
 if(g.pending)throw Error('상대의 요청 응답을 기다리고 있습니다.');
 if(data.action==='undo'||data.action==='draw'){
  if(g.phase!=='play')throw Error('오프닝이 끝난 뒤 요청할 수 있습니다.');
  if(data.action==='draw'&&g.turn!==seat)throw Error('본인 차례에 무승부를 제안할 수 있습니다.');
  let target=-1;if(data.action==='undo'){for(let i=g.history.length-1;i>=6;i--)if(g.history[i].seat===seat){target=i;break;}if(target<0)throw Error('되돌릴 일반 착수가 없습니다.');}
  charge(g,now);if(g.status!=='playing')return;
  g.pending={kind:data.action,from:seat,target,expires:now+15000};update(g,now);addLog(g,`${g.names[seat]} · ${data.action==='undo'?'무르기':'무승부'} 요청`);return;
 }
 if(g.turn!==seat)throw Error('현재 본인 차례가 아닙니다.');
 if(data.action==='chooseColor'){
  if(g.phase!=='color'||![1,2].includes(data.color))throw Error('흑백 선택 단계가 아닙니다.');
  charge(g,now);if(g.status!=='playing')return;g.colors[seat]=data.color;g.colors[1-seat]=3-data.color;g.phase='fourth';g.turn=whiteSeat(g);addLog(g,`${g.names[seat]} · ${data.color===1?'흑':'백'} 선택`);update(g,now);return;
 }
 if(data.action==='pass'){
  if(g.phase!=='play')throw Error('오프닝 중 패스할 수 없습니다.');charge(g,now);if(g.status!=='playing')return;
  g.passes++;addLog(g,`${g.names[seat]} · 패스`);if(g.passes>=2){finish(g,null,'연속 패스');return;}g.turn=1-seat;update(g,now);return;
 }
 if(data.action==='place'&&!['opening3','fourth','proposal','select5','sixth','play'].includes(g.phase))throw Error('먼저 흑백을 선택하세요.');
 if(data.action!=='place')throw Error('올바른 조작을 선택하세요.');
 const i=data.i;if(!Number.isInteger(i)||i<0||i>=225||g.board[i])throw Error('빈 교차점에 착수하세요.');
 const [x,y]=xy(i);let color=g.colors[seat];
 if(g.phase==='opening3'){
  const n=g.history.length;if(n===0&&i!==112)throw Error('첫 흑돌은 중앙 H8에 놓아야 합니다.');if(n===1&&(Math.abs(x-7)>1||Math.abs(y-7)>1))throw Error('둘째 백돌은 중앙 3×3 안에 놓으세요.');if(n===2&&(Math.abs(x-7)>2||Math.abs(y-7)>2))throw Error('셋째 흑돌은 중앙 5×5 안에 놓으세요.');color=n===1?2:1;
 }else if(g.phase==='proposal'){
  if(g.proposals.includes(i))throw Error('서로 다른 두 후보를 제안하세요.');
  if(g.proposals.length&&equivalentProposals(g.board,g.proposals[0],i))throw Error('기존 후보와 대칭으로 같은 수는 두 번째 후보가 될 수 없습니다.');
  charge(g,now);if(g.status!=='playing')return;g.proposals.push(i);addLog(g,`5수 후보 ${g.proposals.length} · ${coord(i)}`);if(g.proposals.length===2){g.phase='select5';g.turn=whiteSeat(g);}update(g,now);return;
 }else if(g.phase==='select5'){
  if(!g.proposals.includes(i))throw Error('흑이 제안한 두 후보 중 하나를 선택하세요.');charge(g,now);if(g.status!=='playing')return;place(g,i,1,blackSeat(g),true);g.proposals=[];g.phase='sixth';g.turn=whiteSeat(g);update(g,now);return;
 }
 let blackResult=null;if(g.phase==='play'&&color===1){blackResult=blackMove(g.board,i);if(blackResult.reason)throw Error(`흑돌 ${blackResult.reason} 금수입니다. 다른 위치를 선택하세요.`);}
 charge(g,now);if(g.status!=='playing')return;
 const phase=g.phase;place(g,i,color,seat,phase!=='play');g.passes=0;
 if(phase==='opening3'&&g.history.length===3){g.phase='color';g.turn=1-g.opener;addLog(g,'상대가 흑 또는 백을 선택합니다.');}
 else if(phase==='fourth'){g.phase='proposal';g.turn=blackSeat(g);}
 else if(phase==='sixth'){g.phase='play';g.turn=blackSeat(g);addLog(g,'오프닝 종료 · 일반 대국 시작');}
 else if(phase==='play'){
  const winning=linesAt(g.board,i,color).find(l=>color===1?l.length===5:l.length>=5);
  if(winning){g.winLine=winning;finish(g,seat,color===1?'흑 정확한 5목':'백 5목 이상');return;}
  if(g.board.every(Boolean)){finish(g,null,'판이 가득 참');return;}g.turn=1-seat;
 }
 update(g,now);
}
export function publicGomoku(g,now=Date.now()){
 if(!g)return null;
 return {status:g.status,phase:g.phase,turn:g.turn,revision:g.revision,board:[...g.board],history:g.history.map(m=>({...m})),colors:[...g.colors],clocks:g.clocks.map((_,i)=>Math.max(0,remaining(g,i,now))),minutes:g.minutes,gameNo:g.gameNo,winner:g.winner,reason:g.reason,proposals:[...g.proposals],pending:g.pending?{...g.pending}:null,log:g.log.slice(-20),winLine:[...g.winLine],forbidden:forbiddenPoints(g)};
}
