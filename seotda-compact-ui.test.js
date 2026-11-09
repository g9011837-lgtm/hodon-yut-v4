import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {Window} from 'happy-dom';import {createSeotda,publicSeotda,timeoutSeotda} from './seotda.js';
for(const width of [390,1440])for(const cards of [2,3])test(`${width}px ${cards}장: 판 아래 독립 베팅 도크·접힌 정보창·재렌더 유지·공개와 히든`,async()=>{
 const w=new Window({url:'http://localhost/'});w.happyDOM.setWindowSize({width,height:900});w.document.write(readFileSync(new URL('./index.html',import.meta.url),'utf8'));const studio=w.document.createElement('style');studio.textContent=readFileSync(new URL('./studio.css',import.meta.url),'utf8');w.document.head.append(studio);
 const events={},sent=[],socket={connected:true,on(n,f){events[n]=f},timeout(){return this},emit(n,d,cb){sent.push({n,d});cb?.(null,{ok:true})}};
 const ctx=vm.createContext({document:w.document,window:w,localStorage:w.localStorage,location:w.location,history:w.history,navigator:w.navigator,URLSearchParams,console,io:()=>socket,setTimeout:()=>0,setInterval:()=>0,clearTimeout(){},clearInterval(){},confirm:()=>true});
 try{vm.runInContext(readFileSync(new URL('./app.js',import.meta.url),'utf8'),ctx);
 for(const count of [2,3,4,5]){
  const names=Array.from({length:count},(_,i)=>'호돈'+i),g=createSeotda(names,names.map(()=>10000),{cards,base:100});
  if(cards===3)while(g.phase==='open')timeoutSeotda(g);
  else {timeoutSeotda(g);if(count>2)while(g.round===0)timeoutSeotda(g);else timeoutSeotda(g);}
  const self=count-1,room={code:'COMPACT',gameType:'seotda',seotdaCards:cards,host:0,playerCount:count,base:100,startingChips:10000,players:names.map((name,i)=>({name,avatarId:i,connected:true})),spectators:[{id:'W',name:'관전 친구',connected:true,avatarId:3}],seotda:publicSeotda(g,self)};ctx.fixture=room;ctx.self=self;
  vm.runInContext('state=fixture;seat=self;isSpectator=false;seotdaRoomPanelOpen=false;render()',ctx);
  const d=w.document,panel=d.querySelector('#seotda-room-panel'),table=d.querySelector('.seotda-table');assert.equal(panel.hidden,true);assert.equal(w.getComputedStyle(panel).display,'none');assert.equal(table.contains(d.querySelector('.seotda-controls')),false);assert.equal(table.nextElementSibling,d.querySelector('.seotda-controls'));assert.ok(d.querySelector('.seotda-controls').classList.contains('studio-controls-dock'));assert.equal(d.querySelectorAll('.seotda-seat').length,count);assert.equal(d.querySelector('.seotda-seat.self').dataset.seat,'0');assert.equal(new Set([...d.querySelectorAll('.seotda-seat')].map(el=>el.dataset.seat)).size,count);
  assert.equal(d.querySelectorAll('.seotda-seat.self .card-peek').length,1);assert.equal(d.querySelectorAll('.seotda-seat:not(.self) .card-peek').length,0);assert.equal(w.getComputedStyle(d.querySelector('.brand-word small')).display,'none');assert.equal(w.getComputedStyle(d.querySelector('.seotda-controls')).position,'relative');
  assert.equal(w.getComputedStyle(d.querySelector('.seotda-table')).borderRadius,'0px');assert.equal(w.getComputedStyle(d.querySelector('.seotda-sidebar')).display,'none');
  d.querySelector('#seotda-room-toggle').click();assert.equal(panel.hidden,false);assert.equal(d.querySelector('#seotda-room-toggle').getAttribute('aria-expanded'),'true');assert.match(panel.textContent,/관전 친구/);assert.ok(panel.querySelector('.seotda-deal-steps'));
  vm.runInContext('render()',ctx);assert.equal(d.querySelector('#seotda-room-panel').hidden,false);assert.equal(d.querySelector('#seotda-room-toggle').getAttribute('aria-expanded'),'true');d.querySelector('#seotda-room-toggle').click();assert.equal(d.querySelector('#seotda-room-panel').hidden,true);
  const allIds=[...d.querySelectorAll('[id]')].map(el=>el.id);assert.equal(new Set(allIds).size,allIds.length,'중복 ID가 없어야 메뉴와 조작이 같은 요소를 가리킨다');
  ctx.fixture={...room,seotda:publicSeotda(g,null)};vm.runInContext('state=fixture;seat=null;isSpectator=true;render()',ctx);assert.equal(d.querySelectorAll('.card-peek').length,0);assert.equal(w.getComputedStyle(d.querySelector('.seotda-bets')).display,'none');assert.ok([...d.querySelectorAll('[data-seotda-bet]')].every(el=>el.disabled));
 }
 }finally{await w.happyDOM.abort()}
});
