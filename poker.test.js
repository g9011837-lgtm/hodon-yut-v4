import test from 'node:test';import assert from 'node:assert/strict';
import {createPoker,actPoker,pokerActions,publicPoker,evaluatePoker,comparePoker,timeoutPoker,removePoker,settlePoker} from './poker.js';
const c=(r,s=0)=>s*13+(r===14?0:r-1);
const value=cards=>evaluatePoker(cards).value;
function select(g){while(['open','discard'].includes(g.phase))actPoker(g,g.turn,{index:0,revision:g.revision});}
function passive(g){const a=pokerActions(g,g.turn);actPoker(g,g.turn,{action:a.check?'check':a.call?'call':'max',revision:g.revision});}
test('7포커 한국식 족보 순서: 로티플·백스티플·마운틴·백스트레이트·무늬',()=>{
 const hands=[ [10,11,12,13,14].map(r=>c(r,0)),[14,2,3,4,5].map(r=>c(r,1)),[9,10,11,12,13].map(r=>c(r,0)),[c(9,0),c(9,1),c(9,2),c(9,3),c(5)], [c(9),c(9,1),c(9,2),c(5),c(5,2)], [2,5,7,9,13].map(r=>c(r,0)), [c(10),c(11,1),c(12),c(13,2),c(14)], [c(14),c(2,1),c(3),c(4,2),c(5)], [c(9),c(10,1),c(11),c(12,2),c(13)], [c(9),c(9,1),c(9,2),c(5),c(2)], [c(9),c(9,1),c(5),c(5,1),c(2)], [c(9),c(9,1),c(5),c(3,1),c(2)], [c(9),c(7,1),c(5),c(3,1),c(2)] ];
 for(let i=1;i<hands.length;i++)assert.ok(comparePoker(value(hands[i-1]),value(hands[i]))>0,`${i}: ${evaluatePoker(hands[i-1]).label}`);
 assert.ok(comparePoker(value([10,11,12,13,14].map(r=>c(r,0))),value([10,11,12,13,14].map(r=>c(r,2))))>0);
 assert.equal(evaluatePoker([...hands[0],c(2,1),c(3,2)]).cards.length,5);assert.throws(()=>evaluatePoker([0,0,1,2,3]));
});
test('일반/초이스: 첫 패·버리기·공개 선택·4/5/6구 공개·7구 히든, 관전 비공개',()=>{
 for(const rule of ['normal','choice']){
  const g=createPoker(['A','B'],[10000,10000],{rule});assert.equal(g.players[0].hand.length,rule==='normal'?3:4);assert.ok(publicPoker(g).players.every(p=>p.hand.every(c=>c===null)));
  select(g);assert.equal(g.street,4);assert.ok(g.players.every(p=>p.hand.length===4&&p.open.length===2));assert.ok(publicPoker(g).players.every(p=>p.hand.filter(c=>c!==null).length===2));
  for(let street=4;street<=7;street++){
   assert.equal(g.street,street);assert.equal(g.players[0].open.length,Math.min(street-2,4));
   assert.equal(publicPoker(g,0).players[1].hand.filter(c=>c===null).length,street===7?3:2);
   while(g.status==='playing'&&g.street===street)passive(g);
  }
  assert.equal(g.status,'finished');assert.ok(publicPoker(g).players.every(p=>p.hand.every(c=>c!==null)));assert.equal(g.players.reduce((n,p)=>n+p.chips,0),20000);
 }
});
test('레이즈 후 전원 대응 차례 재생성, 중복/구버전/상대/불법 베팅 차단',()=>{
 const g=createPoker(['A','B','C'],[10000,10000,10000]);select(g);const first=g.turn;actPoker(g,first,{action:'half',revision:g.revision});const second=g.turn,rev=g.revision;actPoker(g,second,{action:'double',revision:rev});assert.ok(g.pending.includes(first));assert.equal(g.street,4);assert.throws(()=>actPoker(g,g.turn,{action:'call',revision:rev}));assert.throws(()=>actPoker(g,second,{action:'call',revision:g.revision}));while(g.street===4)passive(g);assert.equal(g.street,5);
});
test('4·5·6·7구 인당 레이즈 한도 1·1·2·3, 체크·삥 선만 허용',()=>{
 const g=createPoker(['A','B','C'],[100000000,100000000,100000000]);select(g);assert.equal(g.turn,g.boss);assert.ok(pokerActions(g,g.boss).check);assert.ok(pokerActions(g,g.boss).small);
 const first=g.turn;actPoker(g,first,{action:'half',revision:g.revision});actPoker(g,g.turn,{action:'half',revision:g.revision});actPoker(g,g.turn,{action:'half',revision:g.revision});assert.equal(g.turn,first);assert.equal(pokerActions(g,first).half,false);assert.equal(pokerActions(g,first).check,false);assert.equal(pokerActions(g,first).small,false);
});
test('올인과 사이드팟·초과 베팅 반환: 칩 총액 보존 및 팟별 자격',()=>{
 const g=createPoker(['A','B','C'],[100,200,500],{base:10});select(g);
 g.street=7;g.phase='bet';g.players.forEach((p,i)=>{p.hand=[[c(14),c(14,1),c(14,2),c(13),c(13,1),c(2),c(3,1)],[c(12),c(12,1),c(12,2),c(9),c(9,1),c(4),c(6,1)],[c(11),c(11,1),c(8),c(7),c(5),c(2,2),c(3,2)]][i];p.chips=0;p.total=[100,200,500][i];});g.pot=800;settlePoker(g,true);
 assert.deepEqual(g.payouts,[300,200,300]);assert.equal(g.pots.at(-1).refund,true);assert.equal(g.players.reduce((n,p)=>n+p.chips,0),800);
});
test('다이 승리 시 히든 노출 없음, 강퇴/선택/베팅 타임아웃 교착 없음',()=>{
 const g=createPoker(['A','B'],[1000,1000]);timeoutPoker(g);timeoutPoker(g);assert.equal(g.phase,'bet');removePoker(g,g.turn);assert.equal(g.status,'finished');assert.equal(g.showdown,false);assert.ok(publicPoker(g).players.every(p=>p.hand.filter(c=>c===null).length===2));
 const h=createPoker(['A','B','C'],[1000,1000,1000],{rule:'choice'});for(let n=0;h.status==='playing'&&n<100;n++)timeoutPoker(h);assert.equal(h.status,'finished');
});
test('2~5인 일반/초이스 160판: 카드 중복·교착·마이너스 칩·정산 손실 없음',()=>{
 for(const rule of ['normal','choice'])for(let n=2;n<=5;n++)for(let k=0;k<20;k++){
  const balances=Array.from({length:n},(_,i)=>1000+i*300),g=createPoker(balances.map((_,i)=>'P'+i),balances,{rule,base:10});let steps=0;
  while(g.status==='playing'&&steps++<300){const all=[...g.deck,...g.discard,...g.players.flatMap(p=>p.hand)];assert.equal(new Set(all).size,52);assert.equal(all.length,52);assert.ok(g.players.every(p=>p.chips>=0));
   if(g.phase==='open'||g.phase==='discard')actPoker(g,g.turn,{index:0,revision:g.revision});else{const a=pokerActions(g,g.turn),pick=k%3===0&&a.half?'half':k%5===0&&a.max?'max':a.check?'check':a.call?'call':'fold';actPoker(g,g.turn,{action:pick,revision:g.revision});}
  }
  assert.equal(g.status,'finished');assert.equal(g.players.reduce((a,p)=>a+p.chips,0),balances.reduce((a,b)=>a+b,0));
 }
});
