import test from 'node:test';
import assert from 'node:assert/strict';
import {TRACKS,throwYut,throwWithPower,newGame,nodeOf,legalDestinations,legalMoves,movePiece,maybeNextTurn} from './game.js';
const players=n=>Array.from({length:n},(_,i)=>({name:`P${i}`}));
const p=(track,idx)=>({track,idx});
test('윷 던지기: 빽도, 도, 윷, 모',()=>{
 let i=0;assert.equal(throwYut(()=>[0,1,1,1][i++]).steps,-1);
 i=0;assert.equal(throwYut(()=>[1,0,1,1][i++]).steps,1);
 assert.equal(throwYut(()=>0).steps,4);
 assert.equal(throwYut(()=>1).steps,5);
});
test('출발 한 칸은 오른쪽 아래에서 위로, 출발 중 즉시 완주 안 함',()=>{
 assert.equal(legalDestinations(null,1)[0].node,1);
 assert.equal(legalDestinations(null,5)[0].node,5);
 assert.equal(legalDestinations(p('outer',19),1)[0].node,0);
 assert.equal(legalDestinations(p('outer',19),2)[0].node,'FIN');
});
test('코너 도착 시 다음 이동에서만 기본길/지름길 선택 가능',()=>{
 assert.deepEqual(legalDestinations(p('outer',5),1).map(o=>o.node),[6,20]);
 assert.deepEqual(legalDestinations(p('outer',10),1).map(o=>o.node),[11,27]);
 assert.deepEqual(legalDestinations(p('outer',4),2).map(o=>o.node),[6]);
});
test('중앙에서 경로 선택할 수 있고 화면 좌표 노드와 일치',()=>{
 assert.deepEqual(legalDestinations(p('a',3),1).map(o=>o.node),[25,29]);
 assert.deepEqual(legalDestinations(p('b',3),1).map(o=>o.node),[29,25]);
 for(const track of Object.values(TRACKS))for(const n of track)assert.ok(n==='FIN'||(Number.isInteger(n)&&n>=0&&n<=30));
});
test('빽도: 한 칸 후퇴/대기 복귀, 지름길 시작점에서도 이전 물리칸으로',()=>{
 assert.equal(legalDestinations(null,-1).length,0);
 assert.equal(legalDestinations(p('outer',1),-1)[0].node,null);
 assert.equal(legalDestinations(p('a',0),-1)[0].node,4);
 assert.equal(legalDestinations(p('b',0),-1)[0].node,9);
 assert.equal(legalDestinations(p('outer',8),-1)[0].node,7);
});
test('서버가 검증한 도착 옵션만 이동 허용',()=>{
 const g=newGame(players(2),2);g.moves=[1];g.pieces[0][0]=p('outer',5);
 assert.equal(legalMoves(g,0,0,0).length,2);
 assert.throws(()=>movePiece(g,0,0,0,'999'),/올바른 이동 위치/);
 assert.equal(nodeOf(g.pieces[0][0]),5);
 const result=movePiece(g,0,0,0,'1');assert.equal(result.target,20);
 assert.equal(nodeOf(g.pieces[0][0]),20);
});
test('같은 위치 업힌 말은 함께 이동하고, 상대 말 잡으면 추가 투척',()=>{
 const g=newGame(players(3),3);g.moves=[1];g.rollCredits=0;
 g.pieces[0][0]=p('outer',3);g.pieces[0][1]=p('outer',3);g.pieces[1][0]=p('outer',4);
 const result=movePiece(g,0,0,0);assert.equal(result.group,2);assert.equal(result.captured,1);
 assert.equal(nodeOf(g.pieces[0][0]),4);assert.equal(nodeOf(g.pieces[0][1]),4);
 assert.equal(g.pieces[1][0],null);assert.equal(g.rollCredits,1);
});
test('전진 경로 끝에서 완주 판정과 2~4인 차례 순환',()=>{
 const g=newGame(players(2),1);g.rollCredits=0;g.moves=[1];g.pieces[0][0]=p('outer',20);
 movePiece(g,0,0,0);assert.equal(g.status,'finished');assert.equal(g.winner,0);
 for(const n of [2,3,4]){const r=newGame(players(n),1);r.rollCredits=0;assert.equal(maybeNextTurn(r),true);assert.equal(r.turn,1);r.turn=n-1;r.rollCredits=0;assert.equal(maybeNextTurn(r),true);assert.equal(r.turn,0);}
});
test('빽도로 상대 말을 잡으면 재투척 가능',()=>{
 const g=newGame(players(2),1);g.moves=[-1];g.rollCredits=0;g.pieces[0][0]=p('outer',5);g.pieces[1][0]=p('outer',4);
 const res=movePiece(g,0,0,0);assert.equal(res.target,4);assert.equal(res.captured,1);assert.equal(g.rollCredits,1);
});
test('팀전: 팀원 한 명이 말 세 개를 완주하면 승리',()=>{
 const g=newGame(players(4),3,'team');g.turn=2;g.moves=[1];g.rollCredits=0;
 for(let i=0;i<3;i++)g.pieces[2][i]=p('outer',20);
 const opt=legalMoves(g,2,0,0)[0];const out=movePiece(g,2,0,0,opt.id);
 assert.equal(out.group,3);assert.equal(g.status,'finished');assert.equal(g.winner,2);
});
test('팀전: 팀 동료 말 업기 및 선택적으로 팀 동료 잡기',()=>{
 const g=newGame(players(4),3,'team');g.moves=[1];g.turn=0;
 g.pieces[0][0]=p('outer',3);g.pieces[2][0]=p('outer',4);
 const opts=legalMoves(g,0,0,0);assert.equal(opts.length,2);
 assert(opts.some(o=>o.action==='carry'));assert(opts.some(o=>o.action==='catch'));
 movePiece(g,0,0,0,opts.find(o=>o.action==='carry').id);
 assert.equal(nodeOf(g.pieces[2][0]),4);
 g.moves=[1];g.turn=0;g.pieces[0][0]=p('outer',3);
 const choice=legalMoves(g,0,0,0).find(o=>o.action==='catch');movePiece(g,0,0,0,choice.id);
 assert.equal(g.pieces[2][0],null);
});
test('팀전: 같은 팀이 같은 칸에서 함께 이동',()=>{
 const g=newGame(players(4),3,'team');g.moves=[1];g.pieces[0][0]=p('outer',3);g.pieces[2][0]=p('outer',3);
 const o=legalMoves(g,0,0,0)[0];const r=movePiece(g,0,0,0,o.id);
 assert.equal(r.group,2);assert.equal(nodeOf(g.pieces[2][0]),4);
});

test('윷 세기: 너무 약하거나 강하면 낙, 중앙 범위는 정상',()=>{
 assert.equal(throwWithPower(0).name,'낙');assert.equal(throwWithPower(95).steps,0);
 assert.equal(throwWithPower(50,()=>0).name,'윷');
 assert.throws(()=>throwWithPower(101),/올바르지/);
});
