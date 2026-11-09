import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {Window} from 'happy-dom';
test('전 게임 공통 관전 참가 UI·예약 취소·본인 식별·자동 역할 전환',async()=>{
 const w=new Window({url:'http://localhost/'});w.document.write(readFileSync(new URL('./index.html',import.meta.url),'utf8'));const sent=[],handlers={};
 const socket={connected:true,on(n,fn){handlers[n]=fn},timeout(){return this},emit(n,d,cb){sent.push(n);cb?.(null,{ok:true})}};
 const ctx=vm.createContext({document:w.document,localStorage:w.localStorage,location:w.location,history:w.history,navigator:w.navigator,URLSearchParams,console,io:()=>socket,setTimeout:()=>0,setInterval:()=>0,clearTimeout(){},clearInterval(){},confirm:()=>false});
 try{vm.runInContext(readFileSync(new URL('./app.js',import.meta.url),'utf8'),ctx);
 const base={code:'SEATXX',host:0,players:[{name:'A',connected:true},null],spectators:[{id:'me',name:'동일',connected:true},{id:'other',name:'동일',connected:true}],playerCount:2,matchMode:'solo',piecesPerPlayer:1,base:10,startingChips:100,seotdaCards:2,seatRequests:[]};
 const draw=(kind,extra={})=>{ctx.fixture={...base,gameType:kind,...extra};vm.runInContext('state=fixture;seat=null;isSpectator=true;render()',ctx)};
 for(const kind of ['yut','badugi','gomoku','seotda']){draw(kind);assert.equal(w.document.querySelector('#seat-entry').hidden,false);assert.match(w.document.querySelector('#take-seat').textContent,/빈자리로 참가/);w.document.querySelector('#take-seat').click();await Promise.resolve();assert.equal(sent.at(-1),'room:take-seat');}
 handlers['room:spectator-identity']({id:'me'});draw('seotda',{seatEntryBlocked:true,seotdaRelay:{status:'playing',participants:[true,true],eliminated:[],total:200},seatRequests:[{id:'other',seat:1,name:'동일'}]});assert.equal(w.document.querySelector('#cancel-seat'),null);assert.equal(w.document.querySelector('#take-seat').disabled,true);
 draw('seotda',{seatEntryBlocked:true,seotdaRelay:{status:'playing',participants:[true,true],eliminated:[],total:200},seatRequests:[{id:'me',seat:1,name:'동일'}]});assert.match(w.document.querySelector('#seat-entry').textContent,/릴레이 종료 후/);w.document.querySelector('#cancel-seat').click();await Promise.resolve();assert.equal(sent.at(-1),'room:cancel-seat');
 handlers['room:role']({code:'SEATXX',token:'same-token',seat:1,role:'player'});assert.equal(w.document.querySelector('#seat-entry').hidden,true);assert.equal(w.localStorage.getItem('field-yut:session:SEATXX'),'same-token');assert.equal(vm.runInContext('seat',ctx),1);
 }finally{await w.happyDOM.abort()}
});
