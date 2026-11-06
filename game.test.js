import test from 'node:test';
import assert from 'node:assert/strict';
import {TRACKS,throwYut,throwWithPower,newGame,nodeOf,legalDestinations,legalMoves,movePiece,maybeNextTurn,discardUnplayableBackdos,publicGame} from './game.js';
const players=n=>Array.from({length:n},(_,i)=>({name:`P${i}`}));
const p=(track,idx)=>({track,idx});

test('윷 던지기: 빽도, 도, 윷, 모',()=>{
 let i=0;assert.equal(throwYut(()=>[0,1,1,1][i++]).steps,-1);
 i=0;assert.equal(throwYut(()=>[1,0,1,1][i++]).steps,1);
 assert.equal(throwYut(()=>0).steps,4);assert.equal(throwYut(()=>1).steps,5);
});
test('출발·완주 및 기본 경로',()=>{
 assert.equal(legalDestinations(null,1)[0].node,1);assert.equal(legalDestinations(null,5)[0].node,5);
 assert.equal(legalDestinations(p('outer',19),1)[0].node,0);assert.equal(legalDestinations(p('outer',19),2)[0].node,'FIN');
});
test('코너와 중앙에서 지름길 선택',()=>{
 assert.deepEqual(legalDestinations(p('outer',5),1).map(o=>o.node),[6,20]);
 assert.deepEqual(legalDestinations(p('outer',10),1).map(o=>o.node),[11,27]);
 assert.deepEqual(legalDestinations(p('a',3),1).map(o=>o.node),[25,29]);
});
test('빽도: 대기 말은 이동 불가, 판 위 말은 한 칸 후퇴',()=>{
 assert.equal(legalDestinations(null,-1).length,0);assert.equal(legalDestinations(p('outer',1),-1)[0].node,null);
 assert.equal(legalDestinations(p('a',0),-1)[0].node,4);assert.equal(legalDestinations(p('outer',8),-1)[0].node,7);
});
test('서버가 검증한 도착 옵션만 이동 허용',()=>{
 const g=newGame(players(2),2);g.moves=[1];g.pieces[0][0]=p('outer',5);
 assert.equal(legalMoves(g,0,0,0).length,2);assert.throws(()=>movePiece(g,0,0,0,'999'),/올바른 이동 위치/);
 const result=movePiece(g,0,0,0,'1');assert.equal(result.target,20);assert.equal(nodeOf(g.pieces[0][0]),20);
});
test('업힌 말은 함께 이동하고 상대 말을 잡으면 추가 던지기 1회',()=>{
 const g=newGame(players(3),3);g.moves=[1];g.rollCredits=0;
 g.pieces[0][0]=p('outer',3);g.pieces[0][1]=p('outer',3);g.pieces[1][0]=p('outer',4);
 const result=movePiece(g,0,0,0);assert.equal(result.group,2);assert.equal(result.captured,1);
 assert.equal(nodeOf(g.pieces[0][0]),4);assert.equal(nodeOf(g.pieces[0][1]),4);assert.equal(g.pieces[1][0],null);
 assert.equal(g.rollCredits,1);assert.equal(maybeNextTurn(g),false);
});
test('윷 다음 빽도 결과가 큐에 남고 순서대로 모두 이동 처리',()=>{
 const g=newGame(players(2),1);g.turn=0;g.rollCredits=0;g.moves=[4,-1];g.pieces[0][0]=p('outer',4);
 movePiece(g,0,0,0);assert.equal(nodeOf(g.pieces[0][0]),8);assert.deepEqual(g.moves,[-1]);
 assert.equal(maybeNextTurn(g),false);movePiece(g,0,0,0);assert.equal(nodeOf(g.pieces[0][0]),7);
 assert.deepEqual(g.moves,[]);assert.equal(maybeNextTurn(g),true);assert.equal(g.turn,1);
});
test('대기 말만 있어도 앞선 윷 결과가 있으면 빽도를 보존',()=>{
 const g=newGame(players(2),1);g.turn=0;g.rollCredits=0;g.moves=[4,-1];
 assert.equal(discardUnplayableBackdos(g,0),0);assert.deepEqual(g.moves,[4,-1]);
 movePiece(g,0,0,0);assert.equal(nodeOf(g.pieces[0][0]),4);assert.deepEqual(g.moves,[-1]);
 assert.equal(discardUnplayableBackdos(g,0),0);movePiece(g,0,0,0);assert.equal(nodeOf(g.pieces[0][0]),3);
});
test('빽도가 결과 대기열 맨 앞이고 판 위 말이 없을 때만 소멸',()=>{
 const g=newGame(players(2),1);g.turn=0;g.moves=[-1];
 assert.equal(discardUnplayableBackdos(g,0),1);assert.deepEqual(g.moves,[]);
});
test('빽도로 상대 말을 잡아도 추가 던지기 획득',()=>{
 const g=newGame(players(2),1);g.moves=[-1];g.rollCredits=0;g.pieces[0][0]=p('outer',5);g.pieces[1][0]=p('outer',4);
 const res=movePiece(g,0,0,0);assert.equal(res.target,4);assert.equal(res.captured,1);assert.equal(g.rollCredits,1);
});
test('팀전은 두 팀원이 동일한 공용 말 배열을 사용',()=>{
 const g=newGame(players(4),3,'team');assert.equal(g.pieces[0],g.pieces[2]);assert.equal(g.pieces[1],g.pieces[3]);
 g.turn=2;g.moves=[1];g.rollCredits=0;g.pieces[0][0]=p('outer',3);g.pieces[0][1]=p('outer',3);
 const out=movePiece(g,2,0,0);assert.equal(out.group,2);assert.equal(nodeOf(g.pieces[0][0]),4);assert.equal(nodeOf(g.pieces[2][1]),4);
});
test('팀원 말은 잡히지 않고 같은 칸에 도착하면 업힌다',()=>{
 const g=newGame(players(4),3,'team');g.turn=0;g.moves=[1];g.rollCredits=0;
 g.pieces[0][0]=p('outer',4);g.pieces[2][1]=p('outer',5);
 const choices=legalMoves(g,0,0,0);assert.equal(choices.length,1);assert.equal(choices[0].action,'carry');
 const out=movePiece(g,0,0,0,choices[0].id);assert.equal(out.captured,0);
 assert.equal(nodeOf(g.pieces[0][0]),5);assert.equal(nodeOf(g.pieces[2][1]),5);
});
test('팀원이 상대 말을 잡으면 잡힌 말은 한 번만 세고 추가 던지기',()=>{
 const g=newGame(players(4),3,'team');g.turn=0;g.moves=[1];g.rollCredits=0;
 g.pieces[0][0]=p('outer',3);g.pieces[1][0]=p('outer',4);
 const out=movePiece(g,0,0,0);assert.equal(out.captured,1);assert.equal(g.rollCredits,1);assert.equal(g.pieces[1][0],null);assert.equal(g.pieces[3][0],null);
});
test('팀 공용 말 3개를 모두 완주하면 팀 승리',()=>{
 const g=newGame(players(4),3,'team');g.turn=2;g.moves=[1];g.rollCredits=0;
 for(let i=0;i<3;i++)g.pieces[0][i]=p('outer',20);
 movePiece(g,2,0,0);assert.equal(g.status,'finished');assert.equal(g.winner,2);
});
test('다음 차례는 강퇴된 빈 자리를 건너뜀',()=>{
 const g=newGame(players(4),1);g.turn=0;g.rollCredits=0;
 assert.equal(maybeNextTurn(g,[true,false,true,true]),true);assert.equal(g.turn,2);
});
test('낙·윷 세기 유효성',()=>{
 assert.equal(throwWithPower(0).name,'낙');assert.equal(throwWithPower(95).steps,0);
 assert.equal(throwWithPower(50,()=>0).name,'윷');assert.throws(()=>throwWithPower(101),/올바르지/);
});

test('팀별 전송 상태는 두 공용 말 묶음이며 스냅샷은 서버 원본을 바꾸지 않는다',()=>{
 const g=newGame(players(4),3,'team');g.turn=2;g.moves=[2];movePiece(g,2,0,0);
 const snapshot=JSON.parse(JSON.stringify(publicGame(g)));
 assert.equal(snapshot.teamPieces.length,2);
 assert.deepEqual(snapshot.teamPieces,[snapshot.pieces[0],snapshot.pieces[1]]);
 assert.deepEqual(snapshot.pieces[0],snapshot.pieces[2]);
 snapshot.teamPieces[0][0].idx=19;
 assert.equal(nodeOf(g.pieces[0][0]),2);
});

test('포획 효과는 실제 상대 말을 잡을 때만 발생하며 업기에는 발생하지 않는다',()=>{
 const g=newGame(players(4),3,'team');g.moves=[1];g.rollCredits=0;
 g.pieces[0][0]=p('outer',3);g.pieces[1][0]=p('outer',4);g.pieces[1][1]=p('outer',4);
 movePiece(g,0,0,0);assert.equal(g.lastCapture.count,2);assert.equal(g.lastCapture.node,4);assert.equal(g.lastCapture.player,0);assert.equal(g.rollCredits,1);
 const effect=publicGame(g).lastCapture;assert.deepEqual(effect,g.lastCapture);assert.notEqual(effect,g.lastCapture);
 g.turn=2;g.moves=[1];g.pieces[0][1]=p('outer',5);movePiece(g,2,0,0);assert.equal(g.lastCapture.id,effect.id);
 g.turn=1;g.moves=[1];g.pieces[1][0]=p('outer',4);movePiece(g,1,0,0);assert.equal(g.lastCapture.id,effect.id+1);assert.equal(g.lastCapture.count,2);
});
