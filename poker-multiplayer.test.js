import test from'node:test';import assert from'node:assert/strict';import{spawn}from'node:child_process';import{mkdtempSync,copyFileSync,symlinkSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{io}from'socket.io-client';
test('7포커 실제 서버: 공개 로비·5인·관전·선택/베팅 인증·재접속·예약 퇴장·다음 판 금액',{timeout:25000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hodon-poker-'));for(const f of ['server.js','game.js','badugi.js','gomoku.js','seotda.js','poker.js','alkkagi.js','package.json'])copyFileSync(new URL(f,import.meta.url),join(dir,f));symlinkSync(new URL('node_modules',import.meta.url).pathname,join(dir,'node_modules'),'dir');const child=spawn(process.execPath,['server.js'],{cwd:dir,env:{...process.env,PORT:'3261'},stdio:['ignore','pipe','pipe']}),clients=[];
 const wait=async pred=>{const end=Date.now()+2500;while(!pred()){if(Date.now()>end)throw Error('상태 동기화 실패');await new Promise(r=>setTimeout(r,4))}};
 const connect=async()=>{const c=io('http://127.0.0.1:3261',{reconnection:false});clients.push(c);c.on('room:state',s=>c.room=s);c.on('lobby:state',s=>c.lobby=s.rooms);c.on('room:left',s=>c.left=s);await new Promise((r,j)=>{c.once('connect',r);c.once('connect_error',j)});return c};const req=(c,e,d={})=>c.timeout(2000).emitWithAck(e,d),ok=async(c,e,d)=>{const r=await req(c,e,d);assert.ok(r.ok,r.error);return r};
 try{
  await new Promise((r,j)=>{child.stdout.once('data',r);child.once('error',j)});
  const lobby=await connect();await ok(lobby,'lobby:watch');let h=await connect();const r=await ok(h,'room:create',{name:'호돈',gameType:'poker',pokerRule:'choice',playerCount:5,piecesPerPlayer:4,base:1000000,startingChips:1000000000});
  await wait(()=>lobby.lobby?.some(v=>v.code===r.code&&v.gameType==='poker'));const players=[h];for(let i=1;i<5;i++){const c=await connect();await ok(c,'room:join',{code:r.code,name:'P'+i,avatarId:i});players.push(c);}
  const w=await connect();await ok(w,'room:join',{code:r.code,name:'관전',spectator:true});await ok(h,'game:start');await wait(()=>w.room?.poker?.status==='playing');assert.equal(w.room.turnSeconds,15);assert.ok(w.room.poker.players.every(p=>p.hand.every(c=>c===null)));assert.deepEqual(w.room.poker.actions,{});
  let g=w.room.poker;assert.equal((await req(w,'poker:act',{index:0,revision:g.revision})).ok,false);assert.equal((await req(players[(g.turn+1)%5],'poker:act',{index:0,revision:g.revision})).ok,false);
  await ok(h,'room:leave');await wait(()=>w.room.leavePending.includes(0));await ok(h,'room:cancel-leave');await wait(()=>w.room.leavePending.length===0);
  h.disconnect();h=await connect();await ok(h,'room:join',{code:r.code,token:r.token});players[0]=h;await wait(()=>h.room?.poker);assert.equal(h.room.poker.players[0].hand.filter(c=>c!==null).length,4);assert.ok(h.room.poker.players[1].hand.every(c=>c===null));await ok(h,'room:leave');
  let steps=0;while(w.room.poker.status==='playing'&&steps++<150){g=w.room.poker;const c=players[g.turn],before=g.revision;await wait(()=>c.room?.poker?.revision===before);const a=c.room.poker.actions;
   const data=g.phase==='open'||g.phase==='discard'?{index:0}:{action:a.half&&g.street===4?'half':a.check?'check':a.call?'call':'fold'};
   await ok(c,'poker:act',{...data,revision:before});await wait(()=>w.room.poker.revision!==before);
   g=w.room.poker;if(g.status==='playing'&&g.phase==='bet')assert.ok(g.players.every(p=>p.hand.filter(c=>c!==null).length===Math.min(g.street-2,4)));
  }
  assert.equal(w.room.poker.status,'finished');await wait(()=>h.left?.code===r.code);assert.equal(w.room.players[0],null);assert.equal(w.room.host,1);assert.equal(w.room.poker.players.reduce((n,p)=>n+p.chips,0),5000000000);
  const wallet=w.room.wallets[1];await ok(players[1],'game:start');await wait(()=>w.room.poker.handNo===2);assert.equal(w.room.poker.players[1].chips,wallet-1000000);assert.equal(w.room.poker.players[0].hand.length,0);assert.equal((await req(h,'poker:act',{action:'max',revision:w.room.poker.revision})).ok,false);
 }finally{clients.forEach(c=>c.disconnect());child.kill();await new Promise(r=>child.once('exit',r));rmSync(dir,{recursive:true,force:true})}
});
