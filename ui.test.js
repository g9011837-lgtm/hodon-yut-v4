import {Window} from 'happy-dom';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {newGame,publicGame,nodeOf,throwYut,legalMoves,movePiece,maybeNextTurn,discardUnplayableBackdos} from './game.js';
import test from 'node:test';
test('팀전 말 표시, 비동기 응답, 중복 클릭과 20판 회귀 시뮬레이션',async()=>{
const base=new URL('./',import.meta.url);
const window=new Window({url:'http://localhost/'});window.document.write(readFileSync(new URL('index.html',base),'utf8'));
let pendingOptions,pendingMove,moveRequests=0;
const socket={connected:true,on(){},timeout(){return this},emit(name,args,cb){if(name==='game:options')pendingOptions=cb;if(name==='game:move'){moveRequests++;pendingMove=cb;}}};
const ctx=vm.createContext({document:window.document,localStorage:window.localStorage,location:window.location,history:window.history,navigator:window.navigator,URLSearchParams,console,io:()=>socket,setTimeout:()=>0,setInterval:()=>0,clearTimeout(){},clearInterval(){},confirm:()=>false});
vm.runInContext(readFileSync(new URL('app.js',base),'utf8'),ctx);
const d=window.document,players=['청1','홍1','청2','홍2'].map(name=>({name,connected:true}));
const room={code:'ABCDEF',host:0,matchMode:'team',playerCount:4,piecesPerPlayer:3,players,spectators:[],game:null};
function render(g){room.game=JSON.parse(JSON.stringify(publicGame(g)));ctx.fixture=room;vm.runInContext('state=fixture;seat=state.game.turn;isSpectator=false;selectedMove=0;selectedPiece=null;render()',ctx);}
function visible(){return [...d.querySelectorAll('#board-pieces .piece-avatar')].filter(e=>e.getAttribute('display')!=='none');}
function verify(g){
 const expected=new Map();for(let p=0;p<2;p++)for(let i=0;i<3;i++){const n=nodeOf(g.pieces[p][i]);if(n===null||n==='FIN')continue;const key=`${p}:${n}`;expected.set(key,(expected.get(key)||0)+1);}
 const actual=new Map();for(const el of visible()){const p=el.dataset.pieceKey.split(':')[0],key=`${p}:${el.dataset.node}`;assert.ok(!actual.has(key),'no duplicate ghost bundle');actual.set(key,Number(el.dataset.stack));}
 assert.deepEqual(actual,expected);assert.deepEqual(room.game.teamPieces,[room.game.pieces[0],room.game.pieces[1]]);
 assert.deepEqual(room.game.pieces[0],room.game.pieces[2]);assert.deepEqual(room.game.pieces[1],room.game.pieces[3]);
}
let g=newGame(players,3,'team');g.moves=[1];g.pieces[0][0]={track:'outer',idx:3};render(g);verify(g);
const original=visible()[0],portrait=original.querySelector('image');
original.querySelector('.piece-hit-target').dispatchEvent(new window.MouseEvent('click',{bubbles:true}));assert.equal(typeof pendingOptions,'function');pendingOptions(null,{ok:true,choices:[{id:'0',node:4,label:'기본 경로'}]});await Promise.resolve();await Promise.resolve();assert.equal(vm.runInContext('selectedPiece',ctx),0);assert.equal(d.querySelectorAll('.destination').length,1);render(g);

for(let i=0;i<30;i++){g.turn=i%4;render(g);assert.ok(visible()[0]===original);assert.ok(original.querySelector('image')===portrait);verify(g);}
console.log('PASS: team turns and 30 repeated snapshots preserve the same SVG portrait');
g.turn=2;g.moves=[1];movePiece(g,2,0,0);render(g);verify(g);assert.ok(visible()[0]===original);assert.equal(original.dataset.node,'4');
g.pieces[0][1]={track:'outer',idx:4};render(g);verify(g);assert.equal(visible().length,1);assert.equal(original.dataset.stack,'2');
g.turn=1;g.moves=[1];g.pieces[1][0]={track:'outer',idx:3};movePiece(g,1,0,0);render(g);verify(g);assert.equal(original.getAttribute('display'),'none');
g.turn=0;g.moves=[2];movePiece(g,0,0,0);render(g);verify(g);assert.ok(visible().includes(original));
g.pieces[0][0]={track:'outer',idx:20};g.moves=[1];movePiece(g,0,0,0);render(g);verify(g);assert.equal(original.getAttribute('display'),'none');
console.log('PASS: teammate move, stacking, capture, re-entry and finish have exact visible counts');
// A dedicated team snapshot is authoritative even if legacy seat copies differ.
const beforeConflict=visible().map(e=>[e.dataset.pieceKey,e.dataset.node,e.dataset.stack]);room.game.pieces[0][1]={track:'outer',idx:9};vm.runInContext('render()',ctx);assert.deepEqual(visible().map(e=>[e.dataset.pieceKey,e.dataset.node,e.dataset.stack]),beforeConflict);render(g);verify(g);
console.log('PASS: legacy seat copies cannot introduce ghost team pieces');
g=newGame(players,3,'team');g.moves=[1];render(g);
const request=vm.runInContext('selectPiece(0)',ctx);vm.runInContext('clearSelection()',ctx);pendingOptions(null,{ok:true,choices:[{id:'0',node:1,label:'기본 경로'}]});await request;
assert.equal(vm.runInContext('selectedPiece',ctx),null);assert.equal(d.querySelectorAll('.destination').length,0);
console.log('PASS: late option response cannot resurrect a cleared selection');
vm.runInContext('selectedPiece=0;moveOptions=[{id:"0",node:1,label:"기본 경로"}]',ctx);
const one=vm.runInContext('confirmMove("0")',ctx);const two=vm.runInContext('confirmMove("0")',ctx);assert.equal(moveRequests,1);pendingMove(null,{ok:true});await Promise.all([one,two]);
console.log('PASS: double destination click sends exactly one move');
let seed=12345;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
let moves=0,captures=0,stacks=0,snapshots=0,completed=0;
for(let game=0;game<20;game++){
 g=newGame(players,3,'team');let guard=0;
 while(g.status==='playing'&&guard++<3000){
  if(g.rollCredits){const result=throwYut(rand);g.rollCredits--;g.moves.push(result.steps);if(result.steps>=4)g.rollCredits++;discardUnplayableBackdos(g,g.turn);}
  else if(g.moves.length){
   const options=[];for(let m=0;m<g.moves.length;m++)for(let p=0;p<3;p++)for(const c of legalMoves(g,g.turn,p,m))options.push({m,p,c});
   if(options.length){const {m,p,c}=options[Math.floor(rand()*options.length)];const r=movePiece(g,g.turn,p,m,c.id);moves++;captures+=r.captured;stacks+=r.group>1?1:0;}else discardUnplayableBackdos(g,g.turn);
  }
  maybeNextTurn(g);
  if(game<4){render(g);verify(g);snapshots++;}
  assert.equal(g.pieces[0],g.pieces[2]);assert.equal(g.pieces[1],g.pieces[3]);
 }
 assert.equal(g.status,'finished');completed++;
}
console.log(JSON.stringify({completed,moves,captures,stackedMoves:stacks,verifiedSnapshots:snapshots}));
g=newGame(players,3,'team');g.moves=[1];g.pieces[0][0]={track:'outer',idx:4};g.pieces[1][0]={track:'outer',idx:5};movePiece(g,0,0,0);render(g);
ctx.capture=publicGame(g).lastCapture;vm.runInContext('showCaptureEffect(capture)',ctx);
assert.match(d.querySelector('#capture-effect').textContent,/잡았다!/);assert.match(d.querySelector('#capture-effect').textContent,/상대 말 1개/);
assert.equal(d.querySelector('#capture-effect').style.pointerEvents,'');
const effectCard=d.querySelector('.capture-card');vm.runInContext('showCaptureEffect(capture)',ctx);assert.ok(d.querySelector('.capture-card')===effectCard);
const token=d.querySelector('#board-pieces .piece-avatar:not([display="none"])');vm.runInContext('drawBoard()',ctx);assert.ok(token===d.querySelector('#board-pieces .piece-avatar:not([display="none"])'));assert.ok(d.querySelector('.capture-card')===effectCard);
const rosterImage=d.querySelector('#roster img');vm.runInContext('render()',ctx);assert.ok(d.querySelector('#roster img')===rosterImage);
console.log('PASS: capture effect displays once without replacing board/roster portraits');
await window.happyDOM.abort();

});
