import test from 'node:test';import assert from 'node:assert/strict';import {Window} from 'happy-dom';import {readFileSync} from 'node:fs';import vm from 'node:vm';import {createBadugi,publicBadugi,actBadugi,actions} from './badugi.js';
test('바둑이 UI: 게임 탭/방 설정/손패 비공개/차례 권한/관전자/결과',async()=>{
 const w=new Window({url:'http://localhost/'});w.document.write(readFileSync(new URL('./index.html',import.meta.url),'utf8'));
 const events={};const socket={connected:true,on:(n,f)=>events[n]=f,timeout(){return this},emit(){}};
 const ctx=vm.createContext({document:w.document,localStorage:w.localStorage,location:w.location,history:w.history,navigator:w.navigator,URLSearchParams,console,io:()=>socket,setTimeout:()=>0,setInterval:()=>0,clearTimeout(){},clearInterval(){},confirm:()=>false});vm.runInContext(readFileSync(new URL('./app.js',import.meta.url),'utf8'),ctx);
 const d=w.document;d.querySelector('#tab-badugi').click();assert.equal(d.querySelector('#badugi-options').classList.contains('hidden'),false);assert.equal(d.querySelector('#yut-options').classList.contains('hidden'),true);
 assert.equal(d.querySelector('#badugi-base').value,'100');assert.equal(d.querySelector('#badugi-chips').value,'10000');
 const players=['호돈','<img src=x>','승부사','행운이'].map(name=>({name,connected:true})),g=createBadugi(players.map(p=>p.name),[10000,10000,10000,10000],{base:100});
 const room={code:'ABCDEF',host:0,serverVersion:'v14.0',gameType:'badugi',playerCount:4,base:100,startingChips:10000,players,spectators:[{id:'w1',name:'관전자',connected:true}],game:null};
 const render=(seat,spectator=false)=>{ctx.fixture={...room,badugi:publicBadugi(g,seat)};vm.runInContext(`state=fixture;seat=${seat};isSpectator=${spectator};render()`,ctx);};
 for(let i=0;i<4;i++){render(i);assert.equal(d.querySelectorAll('.playing-card:not(.back)').length,4);assert.equal(d.querySelectorAll('.playing-card.back').length,12);assert.equal(d.querySelectorAll('.badugi-seat.bottom .playing-card:not(.back)').length,4);assert.equal(d.querySelectorAll('.badugi-watchers>div').length,1);assert.equal(d.querySelectorAll('.seat-nameplate img').length,4);assert.equal(d.querySelectorAll('[src="x"]').length,0);assert.equal(d.querySelector('[data-bet="check"]').disabled,i!==g.turn);}
 render(null,true);assert.equal(d.querySelectorAll('.playing-card:not(.back)').length,0);assert.equal(d.querySelectorAll('.playing-card.back').length,16);assert.equal(d.querySelector('#badugi-start'),null);assert.ok([...d.querySelectorAll('[data-bet]')].every(b=>b.disabled));
 while(g.phase==='bet')actBadugi(g,g.turn,{action:'check',revision:g.revision});render(g.turn);assert.equal(d.querySelector('#badugi-draw').disabled,false);d.querySelector('[data-card="0"]').click();assert.equal(d.querySelectorAll('.playing-card.picked').length,1);assert.equal(d.querySelectorAll('.stage-track .active').length,1);
 let guard=0;while(g.status==='playing'&&guard++<100)actBadugi(g,g.turn,g.phase==='draw'?{indices:[],revision:g.revision}:{action:actions(g,g.turn).check?'check':'call',revision:g.revision});render(null,true);assert.equal(d.querySelectorAll('.playing-card:not(.back)').length,16);
 await w.happyDOM.abort();
});
