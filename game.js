import {randomUUID} from 'node:crypto';
/** FIELD YUT v4 — server-authoritative rules, shared team pieces and queued results. */
export const TRACKS={
 outer:[...Array(20).keys(),0,'FIN'],
 a:[5,20,21,24,25,26,15,16,17,18,19,0,'FIN'],
 b:[10,27,28,24,29,30,0,'FIN'],
 ac:[5,20,21,24,29,30,0,'FIN'],
 bc:[10,27,28,24,25,26,15,16,17,18,19,0,'FIN']
};
export const COLORS=['#EF6461','#5E9EFF','#F3C763','#59CFA6','#C084FC','#FF9A52','#56D9E8','#F78BC6','#BBDB65','#C6CDD8'];
export const NAMES={'-1':'빽도',1:'도',2:'개',3:'걸',4:'윷',5:'모'};
export function throwYut(rand=Math.random){
 const sticks=Array.from({length:4},()=>rand()<.5?1:0);
 const sum=sticks.reduce((a,b)=>a+b,0);
 const steps=sum===1&&sticks[0]===1?-1:sum===0?5:sum;
 return {sticks,steps,name:NAMES[steps]};
}
export function throwWithPower(power,rand=Math.random){
 const value=Number(power);
 if(!Number.isFinite(value)||value<0||value>100)throw Error('윷 던지기 세기가 올바르지 않습니다.');
 if(value<10||value>90)return {sticks:[],steps:0,name:'낙'};
 return throwYut(rand);
}
export const teamOf=seat=>seat%2;
export const onSameTeam=(g,a,b)=>g.mode==='team'&&teamOf(a)===teamOf(b);
export function newGame(players,piecesPerPlayer,mode='solo',turnSeconds=45){
 const pools=mode==='team'?[Array.from({length:piecesPerPlayer},()=>null),Array.from({length:piecesPerPlayer},()=>null)]:null;
 const pieces=players.map((_,seat)=>mode==='team'?pools[teamOf(seat)]:Array.from({length:piecesPerPlayer},()=>null));
 return {id:randomUUID(),playerAvatars:players.map(p=>p?.avatarId??0),playerNames:players.map(p=>p?.name||'플레이어'),status:'playing',participants:players.map(Boolean),mode,turnSeconds,turnDeadline:Date.now()+turnSeconds*1000,turn:Math.max(0,players.findIndex(Boolean)),rollCredits:1,moves:[],lastThrow:null,piecesPerPlayer,pieces,winner:null,placements:[],retired:[],log:['게임 시작! 차례대로 윷을 던져 주세요.']};
}
export function resetClock(game){game.turnDeadline=Date.now()+game.turnSeconds*1000;}
export function nodeOf(piece){return piece===null?null:TRACKS[piece.track]?.[piece.idx]??null;}
const pos=(track,idx)=>({track,idx});
export function legalDestinations(piece,steps){
 if(!Number.isInteger(steps)||steps===0||steps < -1||steps>5)return [];
 if(steps===-1){
  if(!piece||nodeOf(piece)==='FIN')return [];
  if(piece.track==='outer'&&piece.idx===1)return [{id:'0',piece:null,node:null,label:'한 칸 뒤로 · 대기칸'}];
  if(piece.idx>0)return [{id:'0',piece:pos(piece.track,piece.idx-1),node:TRACKS[piece.track][piece.idx-1],label:'한 칸 뒤로'}];
  if(['a','ac'].includes(piece.track))return [{id:'0',piece:pos('outer',4),node:4,label:'한 칸 뒤로'}];
  if(['b','bc'].includes(piece.track))return [{id:'0',piece:pos('outer',9),node:9,label:'한 칸 뒤로'}];
  return [{id:'0',piece:pos('outer',19),node:19,label:'한 칸 뒤로'}];
 }
 const start=piece??pos('outer',0),n=nodeOf(start);
 if(n==='FIN')return [];
 const routes=[start];
 if(n===5&&start.track==='outer')routes.push(pos('a',0));
 if(n===10&&start.track==='outer')routes.push(pos('b',0));
 if(n===24){
  if(start.track==='a')routes.push(pos('ac',3));
  if(start.track==='ac')routes.push(pos('a',3));
  if(start.track==='b')routes.push(pos('bc',3));
  if(start.track==='bc')routes.push(pos('b',3));
 }
 const result=[],seen=new Set();
 for(const route of routes){
  const target=pos(route.track,Math.min(route.idx+steps,TRACKS[route.track].length-1));
  const node=nodeOf(target),key=`${target.track}:${target.idx}`;
  if(!seen.has(key)){seen.add(key);result.push({piece:target,node,label:node==='FIN'?'완주':route.track===start.track?'기본 경로':'지름길'});}
 }
 return result.map((o,i)=>({...o,id:String(i)}));
}
export function legalMoves(game,player,pieceIndex,moveIndex){
 if(game.status!=='playing'||game.participants?.[player]===false||game.turn!==player||!Number.isInteger(pieceIndex)||pieceIndex<0||pieceIndex>=game.piecesPerPlayer||!Number.isInteger(moveIndex)||moveIndex<0||moveIndex>=game.moves.length)return [];
 const piece=game.pieces[player][pieceIndex];if(nodeOf(piece)==='FIN')return [];
 // Team pieces are a single shared pool. Teammates always carry together; they can never capture each other.
 return legalDestinations(piece,game.moves[moveIndex]).map(o=>({...o,action:'carry'}));
}
export function publicGame(g){return {id:g.id,playerAvatars:g.playerAvatars?[...g.playerAvatars]:null,playerNames:g.playerNames?[...g.playerNames]:null,status:g.status,participants:g.participants?[...g.participants]:g.pieces.map(()=>true),mode:g.mode,turnSeconds:g.turnSeconds,turnDeadline:g.turnDeadline,turn:g.turn,rollCredits:g.rollCredits,moves:[...g.moves],lastThrow:g.lastThrow,lastCapture:g.lastCapture?{...g.lastCapture}:null,piecesPerPlayer:g.piecesPerPlayer,pieces:g.pieces.map(row=>row.map(p=>p?{...p}:null)),teamPieces:g.mode==='team'?g.pieces.slice(0,2).map(row=>row.map(p=>p?{...p}:null)):null,winner:g.winner,placements:(g.placements||[]).map(p=>({...p})),retired:[...(g.retired||[])],log:g.log.slice(-12)};}
export function discardUnplayableBackdos(game,player){
 let discarded=0;
 // Only inspect a back-do when it reaches the front of the result queue. Earlier moves may put a piece onto the board.
 while(game.moves[0]===-1){
  const hasPiece=game.pieces[player].some(piece=>legalDestinations(piece,-1).length>0);
  if(hasPiece)break;
  game.moves.shift();discarded++;
 }
 return discarded;
}
export function movePiece(game,player,pieceIndex,moveIndex,choiceId='0'){
 if(game.status!=='playing')throw Error('진행 중인 게임이 아닙니다.');
 if(game.turn!==player)throw Error('본인 차례가 아닙니다.');
 const options=legalMoves(game,player,pieceIndex,moveIndex);
 if(!options.length)throw Error('선택한 말은 이동할 수 없습니다. 먼저 판 위의 말을 선택하거나 다른 윷 결과를 사용해 주세요.');
 const choice=options.find(o=>o.id===String(choiceId));if(!choice)throw Error('올바른 이동 위치를 선택해 주세요.');
 const current=game.pieces[player][pieceIndex],source=nodeOf(current),dest=choice.piece,target=choice.node;
 const teamPool=game.pieces[player];
 const group=[];
 if(source===null)group.push([player,pieceIndex]);
 else {
  // All pieces in the active side's pool at the same node move together.
  for(let i=0;i<teamPool.length;i++)if(nodeOf(teamPool[i])===source)group.push([player,i]);
 }
 for(const [,i] of group)teamPool[i]=dest?{...dest}:null;
 game.moves.splice(moveIndex,1);
 let captured=0;
 // Count each opposing side's pool once (team rows intentionally share array references).
 const seenPools=new Set();
 for(let op=0;op<game.pieces.length;op++){
  if(op===player||onSameTeam(game,player,op))continue;
  const pool=game.pieces[op];if(seenPools.has(pool))continue;seenPools.add(pool);
  if(target===null||target==='FIN')continue;
  for(let i=0;i<pool.length;i++)if(nodeOf(pool[i])===target){pool[i]=null;captured++;}
 }
 if(captured){game.rollCredits+=1;game.captureSerial=(game.captureSerial||0)+1;game.lastCapture={id:game.captureSerial,at:Date.now(),node:target,count:captured,player};}
 let rank=null;
 if(game.pieces[player].every(p=>nodeOf(p)==='FIN')){game.moves=[];game.rollCredits=0;
  if(game.mode==='team'){game.status='finished';game.winner=player;}
  else{game.placements??=[];if(!game.placements.some(p=>p.seat===player)){rank=game.placements.length+1;game.placements.push({seat:player,rank,completed:true});game.winner=game.placements[0].seat;}settleYutRace(game);}
 }
 return {rank,group:group.length,target,captured,route:choice.label,action:'carry',bonusThrows:captured};
}
export function maybeNextTurn(game,activeSeats=null){
 if(game.status!=='playing'||game.moves.length||game.rollCredits)return false;
 const active=activeSeats||game.pieces.map(()=>true);
 for(let offset=1;offset<=game.pieces.length;offset++){
  const next=(game.turn+offset)%game.pieces.length;
  if(active[next]&&game.participants?.[next]!==false&&!game.placements?.some(p=>p.seat===next)&&!game.retired?.includes(next)){game.turn=next;break;}
 }
 game.rollCredits=1;game.lastThrow=null;resetClock(game);return true;
}

export function settleYutRace(game){
 if(game.mode==='team'||game.status!=='playing')return false;
 game.placements??=[];game.retired??=[];
 const remaining=game.pieces.map((_,i)=>i).filter(i=>game.participants?.[i]!==false&&!game.placements.some(p=>p.seat===i)&&!game.retired.includes(i));
 if(remaining.length>1)return false;
 if(remaining.length)game.placements.push({seat:remaining[0],rank:game.placements.length+1,completed:false,automatic:true});
 for(const seat of [...game.retired].reverse())if(!game.placements.some(p=>p.seat===seat))game.placements.push({seat,rank:game.placements.length+1,completed:false,retired:true});
 game.winner=game.placements.find(p=>!p.retired)?.seat??null;game.status='finished';game.moves=[];game.rollCredits=0;return true;
}
export function removeYutPlayer(game,seat){
 if(!game||game.status!=='playing'||game.mode==='team'||game.participants?.[seat]===false)return;
 game.retired??=[];if(game.placements?.some(p=>p.seat===seat)||game.retired.includes(seat))return;
 game.retired.push(seat);game.pieces[seat].fill(null);settleYutRace(game);
}
