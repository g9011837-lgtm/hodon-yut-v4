import test from 'node:test';import assert from 'node:assert/strict';
import {createSeotda,actSeotda,seotdaActions,publicSeotda} from './seotda.js';
function invariant(g){const all=[...g.deck,...g.players.flatMap(p=>p.hand)];assert.equal(all.length,20);assert.equal(new Set(all).size,20);assert.ok(all.every(c=>Number.isInteger(c)&&c>=0&&c<20));assert.equal(g.players.reduce((n,p)=>n+p.chips,0)+g.pot,g.players.length*10000);}
function advance(g){const i=g.turn,revision=g.revision;if(g.phase==='open')actSeotda(g,i,{indices:[0],revision});else if(g.phase==='select')actSeotda(g,i,{indices:[0,1],revision});else if(g.phase==='replay')actSeotda(g,i,{action:'replay',revision});else{const a=seotdaActions(g,i);actSeotda(g,i,{action:a.check?'check':'call',revision});}}
test('2장 10인: 300판에서 최초 패·히든·재경기·정산까지 동일 패 중복 없음',()=>{
 for(let n=0;n<300;n++){const g=createSeotda(Array.from({length:10},(_,i)=>'참가자'+i),Array(10).fill(10000),{cards:2,base:10});invariant(g);let guard=0,sawFullDeal=false;while(g.status==='playing'&&guard++<500){advance(g);invariant(g);if(g.players.every(p=>p.hand.length===2)){sawFullDeal=true;assert.equal(g.deck.length,0);}}assert.ok(sawFullDeal);assert.equal(g.status,'finished');}
});
test('3장 6인: 100판에서 18장만 배분하며 선택·재경기·정산과 비공개 패 유지',()=>{
 for(let n=0;n<100;n++){const g=createSeotda(Array.from({length:6},(_,i)=>'참가자'+i),Array(6).fill(10000),{cards:3,base:10});let guard=0,sawFullDeal=false;invariant(g);while(g.status==='playing'&&guard++<500){advance(g);invariant(g);if(g.players.every(p=>p.hand.length===3)){sawFullDeal=true;assert.equal(g.deck.length,2);if(g.phase!=='replay'){const viewer=publicSeotda(g,0);for(let i=1;i<6;i++)if(!g.showdown){assert.equal(viewer.players[i].hand.filter(c=>c!==null).length,1);}}}}assert.ok(sawFullDeal);assert.equal(g.status,'finished');}
});
test('패 부족 인원은 시작 전에 거부하고 덱을 늘리거나 동일 패를 복제하지 않음',()=>{
 for(const[n,cards]of[[11,2],[7,3],[10,3]])assert.throws(()=>createSeotda(Array(n).fill('참가자'),Array(n).fill(10000),{cards}),/2장.*10명.*3장.*6명/);
});
