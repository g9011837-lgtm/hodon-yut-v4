/** FIELD YUT v3 — Server-authoritative paths and move options.
 * Entry node 0 is START/FINISH, clockwise perimeter 0→1→…→19→0→FIN.
 * Turn points only open shortcuts if the previous move STOPPED on that node.
 */
export const TRACKS={
  outer:[...Array(20).keys(),0,'FIN'],
  a:[5,20,21,24,25,26,15,16,17,18,19,0,'FIN'],
  b:[10,27,28,24,29,30,0,'FIN'],
  ac:[5,20,21,24,29,30,0,'FIN'],
  bc:[10,27,28,24,25,26,15,16,17,18,19,0,'FIN']
};
export const COLORS=['#EF6461','#5E9EFF','#F3C763','#59CFA6'];
export const NAMES={'-1':'빽도',1:'도',2:'개',3:'걸',4:'윷',5:'모'};
export function throwYut(rand=Math.random){
 const sticks=Array.from({length:4},()=>rand()<.5?1:0);
 const sum=sticks.reduce((a,b)=>a+b,0);
 return {sticks,steps:sum===1&&sticks[0]===1?-1:sum===0?5:sum,name:NAMES[sum===1&&sticks[0]===1?-1:sum===0?5:sum]};
}
// A separate strength meter emulates the traditional '낙' rule: out-of-range throws lose a turn.
export function throwWithPower(power,rand=Math.random){
 const value=Number(power);
 if(!Number.isFinite(value)||value<0||value>100)throw Error('윷 던지기 세기가 올바르지 않습니다.');
 if(value<10||value>90)return {sticks:[],steps:0,name:'낙'};
 return throwYut(rand);
}
export function newGame(players,piecesPerPlayer,mode='solo',turnSeconds=45){return {status:'playing',mode,turnSeconds,turnDeadline:Date.now()+turnSeconds*1000,turn:0,rollCredits:1,moves:[],lastThrow:null,piecesPerPlayer,pieces:players.map(()=>Array.from({length:piecesPerPlayer},()=>null)),winner:null,log:['게임 시작! 차례대로 윷을 던져 주세요.']};}
export const teamOf=(seat)=>seat%2;
export const onSameTeam=(g,a,b)=>g.mode==='team'&&teamOf(a)===teamOf(b);
export function resetClock(game){game.turnDeadline=Date.now()+game.turnSeconds*1000;}

export function nodeOf(piece){return piece===null?null:TRACKS[piece.track]?.[piece.idx]??null;}
const pos=(track,idx)=>({track,idx});
export function advance(piece,steps){
 const choices=legalDestinations(piece,steps);if(!choices.length)throw Error('해당 말은 이동할 수 없습니다.');return choices[0].piece;
}
// The source's exact stopping square determines which shortcuts are available.
export function legalDestinations(piece,steps){
 if(!Number.isInteger(steps)||steps===0||steps < -1||steps>5)return [];
 if(steps===-1){
  if(!piece||nodeOf(piece)==='FIN')return [];
  if(piece.track==='outer'&&piece.idx===1)return [{id:'0',piece:null,node:null,label:'대기칸으로 후퇴'}];
  if(piece.idx>0)return [{id:'0',piece:pos(piece.track,piece.idx-1),node:TRACKS[piece.track][piece.idx-1],label:'한 칸 뒤로'}];
  if(['a','ac'].includes(piece.track))return [{id:'0',piece:pos('outer',4),node:4,label:'한 칸 뒤로'}];
  if(['b','bc'].includes(piece.track))return [{id:'0',piece:pos('outer',9),node:9,label:'한 칸 뒤로'}];
  return [{id:'0',piece:pos('outer',19),node:19,label:'한 칸 뒤로'}];
 }
 const start=piece??pos('outer',0);
 const n=nodeOf(start);
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
 const result=[];const seen=new Set();
 for(const r of routes){
  const target=pos(r.track,Math.min(r.idx+steps,TRACKS[r.track].length-1));
  const node=nodeOf(target),key=`${target.track}:${target.idx}`;
  if(!seen.has(key)){seen.add(key);result.push({piece:target,node,label:node==='FIN'?'완주':r.track===start.track?'기본 경로':'지름길'});}
 }
 return result.map((o,i)=>({...o,id:String(i)}));
}
export function legalMoves(game,player,pieceIndex,moveIndex){
 if(game.status!=='playing'||game.turn!==player||!Number.isInteger(pieceIndex)||pieceIndex<0||pieceIndex>=game.piecesPerPlayer||!Number.isInteger(moveIndex)||moveIndex<0||moveIndex>=game.moves.length)return [];
 const p=game.pieces[player][pieceIndex];if(nodeOf(p)==='FIN')return [];
 const choices=legalDestinations(p,game.moves[moveIndex]);
 if(game.mode!=='team')return choices;
 // Team match: explicitly choose between carrying and catching a teammate's pieces.
 const extended=[];
 for(const o of choices){
   extended.push({...o,id:`${o.id}:carry`,action:'carry',label:o.label});
   if(o.node!==null&&o.node!=='FIN'&&game.pieces.some((row,op)=>op!==player&&onSameTeam(game,op,player)&&row.some(q=>nodeOf(q)===o.node)))
     extended.push({...o,id:`${o.id}:catch`,action:'catch',label:'우리 팀 말 잡기'});
 }
 return extended;
}
export function publicGame(g){return {status:g.status,mode:g.mode,turnSeconds:g.turnSeconds,turnDeadline:g.turnDeadline,turn:g.turn,rollCredits:g.rollCredits,moves:[...g.moves],lastThrow:g.lastThrow,piecesPerPlayer:g.piecesPerPlayer,pieces:g.pieces.map(row=>row.map(p=>p?{...p}:null)),winner:g.winner,log:g.log.slice(-12)};}
export function movePiece(game,player,pieceIndex,moveIndex,choiceId='0'){
 if(game.status!=='playing')throw Error('진행 중인 게임이 아닙니다.');
 if(game.turn!==player)throw Error('본인 차례가 아닙니다.');
 const options=legalMoves(game,player,pieceIndex,moveIndex);
 if(!options.length)throw Error('선택한 말은 이동할 수 없습니다.');
 const choice=options.find(o=>o.id===String(choiceId));if(!choice)throw Error('올바른 이동 위치를 선택해 주세요.');
 const current=game.pieces[player][pieceIndex],source=nodeOf(current),dest=choice.piece,target=choice.node;
 const group=[];
 if(source===null)group.push([player,pieceIndex]);
 else for(let op=0;op<game.pieces.length;op++){
  if(op!==player&&!onSameTeam(game,player,op))continue;
  for(let i=0;i<game.piecesPerPlayer;i++)if(nodeOf(game.pieces[op][i])===source)group.push([op,i]);
 }
 for(const [op,i] of group)game.pieces[op][i]=dest?{...dest}:null;
 game.moves.splice(moveIndex,1);
 let captured=0;
 if(target!==null&&target!=='FIN')for(let op=0;op<game.pieces.length;op++){
  if(op===player)continue;
  if(onSameTeam(game,player,op)&&choice.action!=='catch')continue;
  for(let i=0;i<game.piecesPerPlayer;i++)if(nodeOf(game.pieces[op][i])===target){game.pieces[op][i]=null;if(!onSameTeam(game,player,op))captured++;}
 }
 if(captured)game.rollCredits++;
 if(game.pieces[player].every(p=>nodeOf(p)==='FIN')){game.status='finished';game.winner=player;game.moves=[];game.rollCredits=0;}
 return {group:group.length,target,captured,route:choice.label,action:choice.action||'carry'};
}
export function maybeNextTurn(game){if(game.status!=='playing'||game.moves.length||game.rollCredits)return false;game.turn=(game.turn+1)%game.pieces.length;game.rollCredits=1;game.lastThrow=null;resetClock(game);return true;}
