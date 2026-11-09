import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,copyFileSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {io} from 'socket.io-client';

test('실제 서버: 전 게임 관전자 참가·예약·경합·취소·재접속·진행판 격리', {timeout:30000},async t=>{
 const dir=mkdtempSync(join(tmpdir(),'hodon-seat-'));
 for(const f of ['server.js','game.js','badugi.js','gomoku.js','seotda.js','poker.js','alkkagi.js','package.json'])copyFileSync(new URL(f,import.meta.url),join(dir,f));
 symlinkSync(new URL('node_modules',import.meta.url).pathname,join(dir,'node_modules'),'dir');
 const child=spawn(process.execPath,['server.js'],{cwd:dir,env:{...process.env,PORT:'3235'},stdio:['ignore','pipe','pipe']});
 const all=[];
 const wait=async pred=>{const end=Date.now()+8500;while(!pred()){if(Date.now()>end)throw Error('동기화 시간 초과');await new Promise(r=>setTimeout(r,5));}};
 const connect=async()=>{const c=io('http://127.0.0.1:3235',{reconnection:false});all.push(c);c.on('room:state',s=>c.room=s);c.on('room:role',r=>c.role=r);await new Promise((r,j)=>{c.once('connect',r);c.once('connect_error',j)});return c;};
 const req=(c,event,data={})=>c.timeout(2500).emitWithAck(event,data);
 const ok=async(c,e,d)=>{const r=await req(c,e,d);assert.ok(r.ok,r.error);return r;};
 try{
  await new Promise((r,j)=>{child.stdout.once('data',r);child.once('error',j)});
  for(const kind of ['yut','badugi','gomoku','seotda'])await t.test(kind+' 대기실: 즉시 참가·닉네임/얼굴 보존·중복 방지·새로고침',async()=>{
   const host=await connect(),a=await connect(),b=await connect();
   const room=await ok(host,'room:create',{name:'방장',gameType:kind,playerCount:2,piecesPerPlayer:1,base:10,startingChips:100});
   const watcher=await ok(a,'room:join',{code:room.code,name:'같은별명',avatarId:4,spectator:true});
   await ok(b,'room:join',{code:room.code,name:'같은별명',avatarId:1,spectator:true});
   const result=await Promise.all([req(a,'room:take-seat'),req(b,'room:take-seat')]);
   assert.equal(result.filter(r=>r.ok).length,1);
   const winner=result[0].ok?a:b,loser=winner===a?b:a,identity=result.find(r=>r.ok);
   await wait(()=>winner.role&&host.room.players[1]);assert.equal(identity.pending,false);assert.equal(winner.role.seat,1);assert.equal(winner.role.token,identity.token);
   assert.equal(host.room.players[1].avatarId,winner===a?4:1);assert.equal(host.room.spectators.length,1);
   assert.equal((await req(winner,'room:take-seat')).ok,false);assert.equal((await req(loser,'room:take-seat')).ok,false);
   const token=winner.role.token;winner.disconnect();await wait(()=>host.room.players[1]?.connected===false);
   assert.equal((await req(loser,'room:take-seat')).ok,false,'오프라인 자리는 빈자리가 아니다');
   const reconnected=await connect();const session=await ok(reconnected,'room:join',{code:room.code,token});assert.equal(session.role,'player');assert.equal(session.seat,1);
   if(winner===a)assert.equal(token,watcher.token);
   [host,a,b,reconnected].forEach(c=>c.disconnect());
  });
  for(const kind of ['yut','badugi','seotda'])await t.test(kind+' 경기 중: 참가 예약·취소·단절 해제·종료 후 자동 참가',async()=>{
   const host=await connect(),p1=await connect(),p2=await connect(),w=await connect(),other=await connect();
   const created=await ok(host,'room:create',{name:'방장',gameType:kind,playerCount:3,piecesPerPlayer:1,base:10,startingChips:100});
   await ok(p1,'room:join',{code:created.code,name:'P1'});await ok(p2,'room:join',{code:created.code,name:'P2'});
   const session=await ok(w,'room:join',{code:created.code,name:'예약자',avatarId:3,spectator:true});await ok(other,'room:join',{code:created.code,name:'다른관전',spectator:true});
   await ok(host,'game:start');await ok(host,'room:kick',{seat:1});await wait(()=>w.room?.players[1]===null&&w.room.seatEntryBlocked);
   const gameKey=kind==='yut'?'game':kind,initial=JSON.stringify(w.room[gameKey]);
   assert.equal((await ok(w,'room:take-seat')).pending,true);await wait(()=>w.room.seatRequests.length===1);
   assert.equal(w.room.players[1],null);assert.equal(JSON.stringify(w.room[gameKey]),initial,'예약이 현재 경기 상태를 바꾸지 않는다');
   assert.equal((await req(other,'room:take-seat')).ok,false);assert.equal((await req(w,kind==='yut'?'game:throw':kind+':act',{action:'call'})).ok,false);
   await ok(w,'room:cancel-seat');await wait(()=>w.room.seatRequests.length===0);await ok(w,'room:take-seat');
   w.disconnect();await wait(()=>host.room.seatRequests.length===0);
   const back=await connect();await ok(back,'room:join',{code:created.code,token:session.token});await ok(back,'room:take-seat');
   if(kind==='seotda'){
    await wait(()=>back.room.seatRequests.length===1);const g=back.room.seotda,total=back.room.seotdaRelay.total,actor=g.turn===0?host:p2;
    await ok(actor,'seotda:act',{action:'fold',revision:g.revision,handNo:g.handNo,replayNo:g.replayNo});
    await wait(()=>back.room.seotda.handNo>g.handNo);
    assert.equal(back.room.seotdaRelay.total,total);assert.equal(back.room.players[1],null);assert.equal(back.room.seotda.players[1].hand.length,0);assert.equal(back.role,undefined);assert.equal(back.room.seatRequests.length,1);
   }
   await ok(host,'room:kick',{seat:2});await wait(()=>back.role?.role==='player'&&back.room.players[1]?.name==='예약자');
   assert.equal(back.role.token,session.token);assert.equal(back.room.spectators.some(p=>p.name==='예약자'),false);assert.equal(back.room.seatRequests.length,0);
   if(kind==='seotda'){assert.equal(back.room.seotdaRelay.status,'finished');await ok(host,'game:start',{resetBalances:true});await wait(()=>back.room.seotdaRelay.status==='playing');assert.equal(back.room.seotdaRelay.total,200);assert.equal(back.room.seotda.players[1].hand.filter(Number.isInteger).length,1);}
   else {await ok(host,'game:start');await wait(()=>back.room[gameKey].status==='playing');if(kind==='yut')assert.equal(back.room.game.participants[1],true);else assert.equal(back.room.badugi.players[1].hand.filter(Number.isInteger).length,4);}
   [host,p1,p2,w,other,back].forEach(c=>c.disconnect());
  });
 }finally{all.forEach(c=>c.disconnect());child.kill();await new Promise(r=>child.once('exit',r));rmSync(dir,{recursive:true,force:true});}
});
