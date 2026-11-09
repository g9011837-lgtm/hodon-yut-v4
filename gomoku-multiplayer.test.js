import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtempSync,copyFileSync,symlinkSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {io} from 'socket.io-client';
test('실시간 렌주: 2명+관전자 2명, 흑백 교대, 승자 흑백 선택, 착수 동기화, 무르기 동의, 재접속', {timeout:30000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hodon-gomoku-'));for(const n of ['server.js','game.js','badugi.js','gomoku.js','seotda.js','poker.js','alkkagi.js','package.json'])copyFileSync(new URL(n,import.meta.url),join(dir,n));symlinkSync(new URL('node_modules',import.meta.url).pathname,join(dir,'node_modules'),'dir');const proc=spawn(process.execPath,['server.js'],{cwd:dir,env:{...process.env,PORT:'3198'},stdio:['ignore','pipe','pipe']});const clients=[],sessions=[];let states,code;
 try{
  await new Promise((r,j)=>{proc.stdout.once('data',r);proc.once('error',j)});const connect=async()=>{const c=io('http://127.0.0.1:3198',{reconnection:false});await new Promise((r,j)=>{c.once('connect',r);c.once('connect_error',j)});return c;};for(let i=0;i<4;i++)clients.push(await connect());
  const request=(c,event,data={})=>c.timeout(3000).emitWithAck(event,data);const ok=async(c,event,data={})=>{const r=await request(c,event,data);assert.ok(r.ok,r.error);return r;};
  assert.equal((await request(clients[0],'room:create',{name:'호돈',gameType:'gomoku',playerCount:4,piecesPerPlayer:4})).ok,false);
  sessions[0]=await ok(clients[0],'room:create',{name:'호돈',gameType:'gomoku',playerCount:2,piecesPerPlayer:4,gomokuMinutes:5});code=sessions[0].code;assert.equal(sessions[0].gameType,'gomoku');
  const waits=clients.map(c=>new Promise(r=>{const f=s=>{if(s.code===code&&s.spectators.length===2){c.off('room:state',f);r(s)}};c.on('room:state',f)}));for(let i=1;i<4;i++)sessions[i]=await ok(clients[i],'room:join',{code,name:'참가'+i,spectator:i>=2});states=await Promise.all(waits);
  const update=async(c,event,data={},first=false)=>{const gameNo=first?(states[0].gomoku?.gameNo||0)+1:states[0].gomoku.gameNo,rev=first?1:states[0].gomoku.revision+1;const ps=clients.map(c=>new Promise(r=>{const f=s=>{if(s.gomoku?.revision===rev&&s.gomoku.gameNo===gameNo){c.off('room:state',f);r(s)}};c.on('room:state',f);}));await ok(c,event,data);states=await Promise.all(ps);states.forEach(s=>{assert.deepEqual(s.gomoku.board,states[0].gomoku.board);assert.deepEqual(s.gomoku.history,states[0].gomoku.history);assert.equal(s.gomoku.turn,states[0].gomoku.turn)});};
  await update(clients[0],'game:start',{},true);
  const action=async(data)=>{const g=states[0].gomoku;await update(clients[g.turn],'gomoku:act',{...data,revision:g.revision});};
  assert.equal((await request(clients[2],'gomoku:act',{action:'place',i:112,revision:1})).ok,false);
  assert.equal((await request(clients[1],'gomoku:act',{action:'place',i:112,revision:1})).ok,false);
  await action({action:'place',i:0});assert.equal(states[0].gomoku.board[0],1);assert.equal(states[0].gomoku.turn,1);
  assert.equal((await request(clients[0],'gomoku:act',{action:'place',i:97,revision:states[0].gomoku.revision})).ok,false);
  await action({action:'place',i:97});assert.equal(states[0].gomoku.board[97],2);assert.equal(states[0].gomoku.history[1].seat,1);
  await action({action:'place',i:128});await action({action:'place',i:98});await action({action:'place',i:126});await action({action:'place',i:144});assert.deepEqual(states[0].gomoku.colors,[1,2]);
  const previous=states[0].gomoku.revision;await action({action:'place',i:2});assert.equal((await request(clients[0],'gomoku:act',{action:'place',i:1,revision:previous})).ok,false);
  await update(clients[0],'gomoku:act',{action:'undo',revision:states[0].gomoku.revision});assert.equal(states[0].gomoku.board[2],1);await update(clients[1],'gomoku:act',{action:'respond',accept:true,revision:states[0].gomoku.revision});assert.equal(states[0].gomoku.board[2],0);assert.equal(states[0].gomoku.turn,0);
  const before=states[0].gomoku.board;clients[1].disconnect();clients[1]=await connect();const rejoined=new Promise(r=>clients[1].once('room:state',r));await ok(clients[1],'room:join',{code,token:sessions[1].token});const rs=await rejoined;assert.deepEqual(rs.gomoku.board,before);assert.equal(rs.gomoku.turn,0);
  await update(clients[1],'gomoku:act',{action:'resign',revision:states[0].gomoku.revision});assert.equal(states[0].gomoku.winner,0);assert.equal(states[0].gomoku.reason,'기권');
  assert.equal((await request(clients[0],'game:start')).ok,false);
  assert.equal((await request(clients[1],'gomoku:act',{action:'chooseNextColor',color:1,revision:states[0].gomoku.revision})).ok,false);
  assert.equal((await request(clients[2],'gomoku:act',{action:'chooseNextColor',color:1,revision:states[0].gomoku.revision})).ok,false);
  await update(clients[0],'gomoku:act',{action:'chooseNextColor',color:2,revision:states[0].gomoku.revision},true);assert.deepEqual(states[0].gomoku.colors,[2,1]);assert.equal(states[0].gomoku.turn,1);
  await action({action:'place',i:112});await action({action:'place',i:97});assert.equal(states[0].gomoku.board[112],1);assert.equal(states[0].gomoku.history[0].seat,1);assert.equal(states[0].gomoku.board[97],2);assert.equal(states[0].gomoku.history[1].seat,0);
  await update(clients[0],'gomoku:act',{action:'resign',revision:states[0].gomoku.revision});assert.equal(states[0].gomoku.winner,1);
  await update(clients[1],'gomoku:act',{action:'chooseNextColor',color:2,revision:states[0].gomoku.revision},true);assert.deepEqual(states[0].gomoku.colors,[1,2]);
  await action({action:'pass'});await action({action:'pass'});assert.equal(states[0].gomoku.winner,null);
  await update(clients[0],'game:start',{},true);assert.deepEqual(states[0].gomoku.colors,[2,1]);
  await update(clients[0],'gomoku:act',{action:'resign',revision:states[0].gomoku.revision});
  // Color selection while the opponent is offline must not start their clock.
  const left=new Promise(r=>{const f=s=>{if(!s.players[0]?.connected){clients[1].off('room:state',f);r(s)}};clients[1].on('room:state',f)});clients[0].disconnect();const offline=await left;
  const selected=new Promise(r=>{const f=s=>{if(s.gomoku?.nextBlack===1){clients[1].off('room:state',f);r(s)}};clients[1].on('room:state',f)});
  await ok(clients[1],'gomoku:act',{action:'chooseNextColor',color:1,revision:offline.gomoku.revision,gameNo:offline.gomoku.gameNo});const waiting=await selected;assert.equal(waiting.gomoku.status,'finished');assert.equal(waiting.gomoku.gameNo,offline.gomoku.gameNo);
  clients[0]=await connect();const continued=clients.map(c=>new Promise(r=>{const f=s=>{if(s.gomoku?.gameNo===waiting.gomoku.gameNo+1){c.off('room:state',f);r(s)}};c.on('room:state',f)}));await ok(clients[0],'room:join',{code,token:sessions[0].token});states=await Promise.all(continued);assert.equal(states[0].gomoku.status,'playing');assert.deepEqual(states[0].gomoku.colors,[2,1]);assert.equal(states[0].gomoku.turn,1);
  await update(clients[0],'gomoku:act',{action:'resign',revision:states[0].gomoku.revision});
  // A replacement player must not inherit the departed winner's right to choose.
  await ok(clients[1],'room:leave');clients[1].disconnect();clients[1]=await connect();
  const replacementState=new Promise(r=>clients[1].once('room:state',r));await ok(clients[1],'room:join',{code,name:'새 참가자'});const replacement=await replacementState;
  assert.equal(replacement.gomokuSamePlayers,false);
  assert.equal((await request(clients[1],'gomoku:act',{action:'chooseNextColor',color:1,revision:replacement.gomoku.revision})).ok,false);
  await update(clients[0],'game:start',{},true);assert.deepEqual(states[0].gomoku.colors,[1,2]);
  console.log('Renju clients=4: owner-only alternating stones + winner black/white choice + draw swap + consent undo + reconnect passed');
 }finally{clients.forEach(c=>c.disconnect());proc.kill();await new Promise(r=>proc.once('exit',r));rmSync(dir,{recursive:true,force:true});}
});
