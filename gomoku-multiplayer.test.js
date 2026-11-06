import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtempSync,copyFileSync,symlinkSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {io} from 'socket.io-client';
test('실시간 렌주: 2명+관전자 2명, 오프닝, 색상교환, 착수 동기화, 무르기 동의, 재접속', {timeout:30000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hodon-gomoku-'));for(const n of ['server.js','game.js','badugi.js','gomoku.js','package.json'])copyFileSync(new URL(n,import.meta.url),join(dir,n));symlinkSync(new URL('node_modules',import.meta.url).pathname,join(dir,'node_modules'),'dir');const proc=spawn(process.execPath,['server.js'],{cwd:dir,env:{...process.env,PORT:'3198'},stdio:['ignore','pipe','pipe']});const clients=[],sessions=[];let states,code;
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
  await action({action:'place',i:112});await action({action:'place',i:97});await action({action:'place',i:128});await action({action:'chooseColor',color:1});assert.deepEqual(states[0].gomoku.colors,[2,1]);
  await action({action:'place',i:98});await action({action:'place',i:126});await action({action:'place',i:141});await action({action:'place',i:126});await action({action:'place',i:144});assert.equal(states[0].gomoku.phase,'play');assert.equal(states[0].gomoku.turn,1);
  const previous=states[0].gomoku.revision;await action({action:'place',i:0});assert.equal((await request(clients[1],'gomoku:act',{action:'place',i:1,revision:previous})).ok,false);
  await update(clients[1],'gomoku:act',{action:'undo',revision:states[0].gomoku.revision});assert.equal(states[0].gomoku.board[0],1);await update(clients[0],'gomoku:act',{action:'respond',accept:true,revision:states[0].gomoku.revision});assert.equal(states[0].gomoku.board[0],0);assert.equal(states[0].gomoku.turn,1);
  const before=states[0].gomoku.board;clients[1].disconnect();clients[1]=await connect();const rejoined=new Promise(r=>clients[1].once('room:state',r));await ok(clients[1],'room:join',{code,token:sessions[1].token});const rs=await rejoined;assert.deepEqual(rs.gomoku.board,before);assert.equal(rs.gomoku.turn,1);
  await update(clients[1],'gomoku:act',{action:'resign',revision:states[0].gomoku.revision});assert.equal(states[0].gomoku.winner,0);assert.equal(states[0].gomoku.reason,'기권');
  console.log('Renju clients=4: classic opening + swap + consent undo + reconnect passed');
 }finally{clients.forEach(c=>c.disconnect());proc.kill();await new Promise(r=>proc.once('exit',r));rmSync(dir,{recursive:true,force:true});}
});
