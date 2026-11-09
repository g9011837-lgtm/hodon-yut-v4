import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtempSync,copyFileSync,symlinkSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {io} from 'socket.io-client';
test('10인: 6명 일시 단절 후 재접속·10명 모두 차례·기권/관전자/중복/지난 경기 차단·팀 기권',{timeout:20000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'yut54-'));for(const f of ['server.js','game.js','badugi.js','gomoku.js','seotda.js','poker.js','alkkagi.js','package.json'])copyFileSync(new URL(f,import.meta.url),join(dir,f));symlinkSync(new URL('node_modules',import.meta.url).pathname,join(dir,'node_modules'),'dir');const child=spawn(process.execPath,['server.js'],{cwd:dir,env:{...process.env,PORT:'3254'},stdio:['ignore','pipe','pipe']});const cs=[],tokens=[];let state;
 try{await new Promise((r,j)=>{child.stdout.once('data',r);child.once('error',j)});async function connect(){const c=io('http://127.0.0.1:3254',{reconnection:false});await new Promise((r,j)=>{c.once('connect',r);c.once('connect_error',j)});return c}for(let i=0;i<11;i++)cs.push(await connect());cs[0].on('room:state',s=>state=s);
 const req=(i,n,d={})=>cs[i].timeout(2500).emitWithAck(n,d);async function act(i,n,d={}){const update=new Promise(r=>cs[0].once('room:state',r));const out=await req(i,n,d);assert.ok(out.ok,out.error);state=await update;return out}
 const made=await act(0,'room:create',{gameType:'yut',name:'P0',playerCount:10,piecesPerPlayer:2});tokens[0]=made.token;
 for(let i=1;i<11;i++){const j=await act(i,'room:join',{code:made.code,name:'P'+i,spectator:i===10});tokens[i]=j.token}
 for(let i=4;i<10;i++){const updated=new Promise(r=>{const f=s=>{if(!s.players[i].connected){cs[0].off('room:state',f);r()}};cs[0].on('room:state',f)});cs[i].disconnect();await updated}
 await act(0,'game:start');assert.equal(state.game.participants.filter(Boolean).length,10);
 for(let i=4;i<10;i++){cs[i]=await connect();await act(i,'room:join',{code:made.code,token:tokens[i]})}
 for(let i=0;i<10;i++){assert.equal(state.game.turn,i);await act(i,'game:throw',{power:0})}assert.equal(state.game.turn,0);
 const id=state.game.id;assert.equal((await req(10,'game:resign',{gameId:id})).ok,false);assert.equal((await req(0,'game:resign',{gameId:'old'})).ok,false);
 await act(0,'game:resign',{gameId:id});assert.equal(state.game.turn,1);assert.ok(state.game.retired.includes(0));assert.ok(state.game.pieces[0].every(p=>p===null));assert.equal(state.game.status,'playing');assert.equal((await req(0,'game:resign',{gameId:id})).ok,false);assert.equal((await req(0,'game:throw',{power:50})).ok,false);
 await act(4,'game:resign',{gameId:id});assert.equal(state.game.turn,1);
 for(const i of [1,2,3,5,6,7,8])await act(i,'game:resign',{gameId:id});assert.equal(state.game.status,'finished');assert.equal(state.game.winner,9);assert.equal(state.game.placements.length,10);
 for(let i=0;i<11;i++)assert.ok((await req(i,'room:leave')).ok);
 const team=await act(0,'room:create',{gameType:'yut',name:'T0',playerCount:4,matchMode:'team',piecesPerPlayer:3});for(let i=1;i<4;i++)await act(i,'room:join',{code:team.code,name:'T'+i});await act(0,'game:start');await act(2,'game:resign',{gameId:state.game.id});assert.equal(state.game.status,'finished');assert.equal(state.game.winner%2,1);assert.deepEqual(state.game.retired,[0,2]);
 }finally{cs.forEach(c=>c.disconnect());child.kill();await new Promise(r=>child.once('exit',r));rmSync(dir,{recursive:true,force:true})}
});
