import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtempSync,copyFileSync,symlinkSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {io} from 'socket.io-client';
test('실시간 4인+관전자: 설정 검증, 손패 격리, 중복/권한 거부, 10판, 재접속, 강퇴', {timeout:30000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hodon-v14-'));for(const file of ['server.js','game.js','badugi.js','gomoku.js','seotda.js','poker.js','alkkagi.js','package.json'])copyFileSync(new URL(file,import.meta.url),join(dir,file));symlinkSync(new URL('node_modules',import.meta.url).pathname,join(dir,'node_modules'),'dir');
 const child=spawn(process.execPath,['server.js'],{cwd:dir,env:{...process.env,PORT:'3194'},stdio:['ignore','pipe','pipe']});const clients=[],sessions=[];let state,lastStates;
 try{
  await new Promise((r,j)=>{child.stdout.once('data',r);child.once('error',j);child.once('exit',c=>j(Error('server '+c)));});
  const connect=async()=>{const c=io('http://127.0.0.1:3194',{reconnection:false});await new Promise((r,j)=>{c.once('connect',r);c.once('connect_error',j);});return c;};
  const request=(c,event,data={})=>c.timeout(3000).emitWithAck(event,data);
  const ok=async(c,event,data={})=>{const reply=await request(c,event,data);assert.ok(reply.ok,reply.error);return reply;};
  for(let i=0;i<6;i++)clients.push(await connect());
  for(const params of [{base:0},{base:1.5},{base:100,startingChips:10},{startingChips:1000000000000}]){const r=await request(clients[0],'room:create',{gameType:'badugi',name:'호돈',piecesPerPlayer:4,playerCount:4,base:123,startingChips:55555,...params});assert.equal(r.ok,false);}
  sessions[0]=await ok(clients[0],'room:create',{gameType:'badugi',name:'호돈',piecesPerPlayer:4,playerCount:4,base:123,startingChips:55555,turnSeconds:45});const code=sessions[0].code;
  const waiting=clients.map(c=>new Promise(r=>{const f=s=>{if(s.spectators.length===2){c.off('room:state',f);r(s)}};c.on('room:state',f)}));
  for(let i=1;i<6;i++)sessions[i]=await ok(clients[i],'room:join',{code,name:'참가자'+i,spectator:i>=4});await Promise.all(waiting);
  assert.equal((await request(clients[4],'game:start')).ok,false);assert.equal((await request(clients[1],'game:start')).ok,false);
  let broadcasts=0;
  const check=states=>{lastStates=states;state=states[0];assert.equal(state.base,123);assert.equal(state.startingChips,55555);const b=state.badugi;
   states.forEach((s,viewer)=>{assert.equal(s.badugi.revision,b.revision);assert.equal(s.badugi.deck,undefined);assert.equal(s.badugi.discard,undefined);s.badugi.players.forEach((p,i)=>{assert.equal(p.chips,b.players[i].chips);if((viewer>=4||i!==viewer)&&(!b.showdown||p.folded))assert.ok(p.hand.every(x=>x===null));});assert.equal(s.players.some(p=>p?.token),false);assert.equal(s.spectators.some(p=>p.token),false);});
  };
  const update=async(c,event,data={})=>{
   const hand=event==='game:start'?(state?.badugi?.handNo||0)+1:state.badugi.handNo,revision=event==='game:start'?1:state.badugi.revision+1;
   const wait=clients.map(c=>new Promise(r=>{const f=s=>{if(s.badugi?.handNo===hand&&s.badugi?.revision===revision){c.off('room:state',f);r(s)}};c.on('room:state',f);}));
   await ok(c,event,data);check(await Promise.all(wait));broadcasts++;
  };
  for(let round=0;round<10;round++){
   const balances=state?.badugi?.players.map(p=>p.chips);await update(clients[0],'game:start');if(balances)state.badugi.players.forEach((p,i)=>assert.equal(p.chips,balances[i]-123));
   assert.equal((await request(clients[4],'badugi:act',{action:'check',revision:state.badugi.revision})).ok,false);
   assert.equal((await request(clients[(state.badugi.turn+1)%4],'badugi:act',{action:'check',revision:state.badugi.revision})).ok,false);
   let guard=0;while(state.badugi.status==='playing'&&guard++<150){
    const g=state.badugi,c=clients[g.turn],revision=g.revision;
    const actorState=lastStates[g.turn].badugi;
    const data=g.phase==='draw'?{indices:[0,1,2,3].filter((_,i)=>(i+guard)%2)}:{action:actorState.actions.call?'call':'check'};
    await update(c,'badugi:act',{...data,revision});assert.equal((await request(c,'badugi:act',{...data,revision})).ok,false);
   }assert.equal(state.badugi.status,'finished');assert.equal(state.badugi.players.reduce((s,p)=>s+p.chips,0),55555*4);
  }
  const oldHand=lastStates[2].badugi.players[2].hand;clients[2].disconnect();clients[2]=await connect();const rejoined=new Promise(r=>clients[2].once('room:state',r));await ok(clients[2],'room:join',{code,token:sessions[2].token});const rs=await rejoined;assert.deepEqual(rs.badugi.players[2].hand,oldHand);
  const kicked=new Promise(r=>clients[5].once('session:kicked',r));await ok(clients[0],'room:kick',{spectatorId:rs.spectators[1].id});await kicked;assert.equal((await request(clients[5],'badugi:act',{revision:rs.badugi.revision,action:'check'})).ok,false);
  await ok(clients[0],'room:leave');
  const y=await ok(clients[0],'room:create',{name:'윷방장',playerCount:2,piecesPerPlayer:1,matchMode:'solo',gameType:'yut'});
  const ready=new Promise(r=>clients[0].on('room:state',function wait(s){if(s.code===y.code&&s.players.every(Boolean)){clients[0].off('room:state',wait);r(s)}}));
  await ok(clients[5],'room:join',{name:'윷친구',code:y.code});await ready;
  const began=new Promise(r=>clients[0].once('room:state',r));await ok(clients[0],'game:start');const yg=await began;assert.equal(yg.gameType,'yut');assert.equal(yg.game.status,'playing');assert.equal(yg.badugi,null);
  const thrown=await ok(clients[0],'game:throw',{power:50});assert.ok(thrown.result.name);
  console.log('Multiplayer completed hands=10, compared broadcasts='+broadcasts+', players=4, spectators=2');
 }finally{clients.forEach(c=>c.disconnect());child.kill();await new Promise(r=>child.once('exit',r));rmSync(dir,{recursive:true,force:true});}
});
