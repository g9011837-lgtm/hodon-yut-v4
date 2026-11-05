import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { Server } from 'socket.io';
import { newGame, throwYut, throwWithPower, movePiece, maybeNextTurn, publicGame, legalMoves, resetClock, COLORS } from './game.js';

const app=express();
app.disable('x-powered-by');
const ROOT=dirname(fileURLToPath(import.meta.url));
// Bonto: HTML/CSS/JS assets reside alongside server.js at application root.
app.get('/',(req,res)=>res.sendFile(join(ROOT,'index.html')));
app.get('/index.html',(req,res)=>res.sendFile(join(ROOT,'index.html')));
app.get('/app.js',(req,res)=>res.sendFile(join(ROOT,'app.js')));
app.get('/style.css',(req,res)=>res.sendFile(join(ROOT,'style.css')));
const server=createServer(app);
const io=new Server(server,{maxHttpBufferSize:50_000,cors:{origin:false}});
const PORT=Number(process.env.PORT)||3000;
const rooms=new Map();
// Local JSON leaderboard persists across ordinary restarts only when host disk persists.
// Use external database for permanent cross-deployment persistence.
const STATS_PATH=join(ROOT,'field-records.json');
let stats={};try{stats=JSON.parse(readFileSync(STATS_PATH,'utf8'));}catch{}
function saveStats(){try{writeFileSync(STATS_PATH+'.tmp',JSON.stringify(stats));renameSync(STATS_PATH+'.tmp',STATS_PATH);}catch(e){console.error('Leaderboard save failed:',e.message)}}
function recordWin(room){if(!room.game||room.game.recorded)return;room.game.recorded=true;
 const {game:g}=room;room.players.forEach((p,i)=>{
   // Nickname-based ranks are for casual play, not trusted identity.
   const key=createHash('sha256').update(p.name).digest('hex').slice(0,24);
   const row=stats[key]||{name:p.name,played:0,wins:0};row.name=p.name;row.played++;
   if(g.mode==='team'?i%2===g.winner%2:i===g.winner)row.wins++;
   stats[key]=row;
 });saveStats();}
function rankList(){return Object.values(stats).sort((a,b)=>b.wins-a.wins||b.played-a.played).slice(0,30)}

const CODE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function code() {let s;do{s=Array.from(randomBytes(6),b=>CODE_ALPHABET[b%CODE_ALPHABET.length]).join('')}while(rooms.has(s));return s;}
function cleanName(input) {if(typeof input!=='string') return '';return input.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,14);}
function failure(callback,reason) {callback?.({ok:false,error:reason});}
function reply(callback,data={}) {callback?.({ok:true,...data});}
function summary(room) {return {code:room.code,host:room.host,mode:room.game?.status||'lobby',
  piecesPerPlayer:room.piecesPerPlayer,playerCount:room.playerCount,matchMode:room.matchMode,turnSeconds:room.turnSeconds,players:room.players.map(p=>p?({name:p.name,connected:!!p.socketId}):null),
  colors:COLORS,game:room.game?publicGame(room.game):null};}
function broadcast(room) {io.to(room.code).emit('room:state',summary(room));}
function say(room,text) {if(!room.game)return;room.game.log.push(text);if(room.game.log.length>40)room.game.log.shift();}
function identify(socket,room,token) {const seat=room.players.findIndex(p=>p?.token===token);return seat<0?null:{seat,player:room.players[seat]};}
function authorization(socket) {const {roomCode,token}=socket.data||{};const room=rooms.get(roomCode);if(!room)return null;const identified=identify(socket,room,token);if(!identified||identified.player.socketId!==socket.id)return null;return {room,...identified};}
function detach(socket) {
  const auth=authorization(socket);if(!auth)return;
  const {room,seat}=auth;room.players[seat].socketId=null;
  say(room,`${room.players[seat].name} 님의 연결이 끊겼습니다. 재접속을 기다립니다.`);
  broadcast(room);
}
io.on('connection',socket=>{
  socket.on('room:create',(data={},cb)=>{
    if(authorization(socket)) return failure(cb,'이미 방에 참가 중입니다.');
    const name=cleanName(data.name);if(!name)return failure(cb,'닉네임을 입력해 주세요.');
    const playerCount=Number(data.playerCount);
    if(!Number.isInteger(playerCount)||playerCount<2||playerCount>4)return failure(cb,'참가 인원은 2~4명입니다.');
    const matchMode=data.matchMode==='team'?'team':'solo';
    if(matchMode==='team'&&playerCount!==4)return failure(cb,'팀전은 4명 전용입니다.');
    const turnSeconds=[20,30,45,60,90].includes(Number(data.turnSeconds))?Number(data.turnSeconds):45;
    const count=Number(data.piecesPerPlayer);
    if(!Number.isInteger(count)||count<1||count>4)return failure(cb,'말 개수는 1~4개입니다.');
    const id=code(), token=randomUUID();
    const room={code:id,host:0,piecesPerPlayer:matchMode==='team'?3:count,matchMode,turnSeconds,playerCount,players:[{name,token,socketId:socket.id},...Array(playerCount-1).fill(null)],game:null,createdAt:Date.now()};
    rooms.set(id,room);socket.join(id);socket.data={roomCode:id,token};
    reply(cb,{code:id,token,seat:0});broadcast(room);
  });
  socket.on('room:join',(data={},cb)=>{
    if(authorization(socket))return failure(cb,'먼저 현재 방을 나가 주세요.');
    const id=String(data.code||'').trim().toUpperCase();const room=rooms.get(id);
    if(!room)return failure(cb,'존재하지 않는 방입니다. 방 코드를 확인해 주세요.');
    let token=typeof data.token==='string'?data.token:'';
    let seat=room.players.findIndex(p=>p?.token===token&&token);
    if(seat<0){
      if(room.game)return failure(cb,'이미 시작된 게임에는 새 플레이어가 참가할 수 없습니다.');
      seat=room.players.findIndex(p=>!p);
      if(seat<0)return failure(cb,'방이 가득 찼습니다.');
      const name=cleanName(data.name);if(!name)return failure(cb,'닉네임을 입력해 주세요.');
      token=randomUUID();room.players[seat]={name,token,socketId:socket.id};
    } else {
      const former=room.players[seat].socketId;
      if(former&&former!==socket.id){const old=io.sockets.sockets.get(former);if(old){old.data={};old.leave(id);old.emit('session:replaced');}}
      room.players[seat].socketId=socket.id;
    }
    socket.data={roomCode:id,token};socket.join(id);
    reply(cb,{code:id,token,seat});broadcast(room);
  });
  socket.on('room:leave',(_,cb)=>{
    const a=authorization(socket);if(!a)return failure(cb,'방에 참가 중이 아닙니다.');
    const {room,seat}=a;
    if(room.game?.status==='playing')return failure(cb,'진행 중에는 나갈 수 없습니다. 연결이 끊겨도 다시 입장할 수 있습니다.');
    room.players[seat]=null;socket.leave(room.code);socket.data={};
    if(!room.players.some(Boolean)) rooms.delete(room.code);
    else {if(room.host===seat)room.host=room.players.findIndex(Boolean);broadcast(room);}
    reply(cb);
  });
  socket.on('game:start',(_,cb)=>{
    const a=authorization(socket);if(!a)return failure(cb,'방에 참가해 주세요.');
    const {room,seat}=a;
    if(room.host!==seat)return failure(cb,'방장만 시작할 수 있습니다.');
    if(room.players.filter(Boolean).length!==room.playerCount||room.players.some(p=>!p?.socketId))return failure(cb,`${room.playerCount}명 모두 접속해야 시작할 수 있습니다.`);
    if(room.game?.status==='playing')return failure(cb,'이미 진행 중입니다.');
    room.game=newGame(room.players,room.piecesPerPlayer,room.matchMode,room.turnSeconds);
    say(room,`${room.players[0].name} 님부터 시작합니다.`);
    reply(cb);broadcast(room);
  });
  socket.on('game:throw',(data={},cb)=>{
    const a=authorization(socket);if(!a)return failure(cb,'방에 참가해 주세요.');
    const {room,seat}=a,g=room.game;
    if(!g||g.status!=='playing')return failure(cb,'게임이 진행 중이 아닙니다.');
    if(g.turn!==seat)return failure(cb,'현재 본인 차례가 아닙니다.');
    if(g.rollCredits<1)return failure(cb,'먼저 윷 결과를 사용해 말을 이동하세요.');
    let result;try{result=throwWithPower(data?.power??50)}catch(e){return failure(cb,e.message)}
    g.rollCredits--;g.lastThrow=result;
    // 빽도만 나왔고 판 위에 움직일 내 말이 없다면 결과를 자동 소멸하여 게임이 멈추지 않게 합니다.
    const canBack= g.pieces[seat].some((piece,i)=>legalMoves({...g,moves:[-1]},seat,i,0).length>0);
    const skipBack=result.steps===0||(result.steps===-1&&!canBack);
    if(!skipBack)g.moves.push(result.steps);
    if(result.steps>=4)g.rollCredits++;resetClock(g);
    say(room,`${room.players[seat].name}: ${result.name} (${result.steps}칸)${result.steps>=4?' · 한 번 더!':''}${result.steps===0?' · 낙! 차례 소모':skipBack?' · 이동 가능한 말이 없어 빽도 소멸':''}`);
    if(maybeNextTurn(g))say(room,`➡️ ${room.players[g.turn].name} 님 차례입니다.`);
    reply(cb,{result});broadcast(room);
  });
  socket.on('game:options',(data={},cb)=>{
    const a=authorization(socket);if(!a)return failure(cb,'방에 참가해 주세요.');
    const g=a.room.game;
    if(!g)return failure(cb,'게임이 시작되지 않았습니다.');
    const choices=legalMoves(g,a.seat,Number(data.pieceIndex),Number(data.moveIndex));
    reply(cb,{choices:choices.map(({id,node,label,action})=>({id,node,label,action}))});
  });
  socket.on('game:move',(data={},cb)=>{
    const a=authorization(socket);if(!a)return failure(cb,'방에 참가해 주세요.');
    const {room,seat}=a,g=room.game;
    if(!g)return failure(cb,'게임이 시작되지 않았습니다.');
    try{
      const moveIndex=Number(data.moveIndex),pieceIndex=Number(data.pieceIndex);
      const steps=g.moves[moveIndex];
      const outcome=movePiece(g,seat,pieceIndex,moveIndex,data.choiceId??'0');
      say(room,`${room.players[seat].name}: ${steps}칸 이동${outcome.group>1?` · ${outcome.group}개 업기`:''}${outcome.captured?` · 상대 말 ${outcome.captured}개 잡기! 추가 던지기 획득`:''}`);
      if(g.status==='finished'){say(room,g.mode==='team'?`🏆 ${seat%2===0?'청팀':'홍팀'} 승리!`:`🏆 ${room.players[seat].name} 님이 승리했습니다!`);recordWin(room);}
      else if(maybeNextTurn(g))say(room,`➡️ ${room.players[g.turn].name} 님 차례입니다.`);
      if(g.status==='playing')resetClock(g);
      reply(cb,{outcome});broadcast(room);
    }catch(e){failure(cb,e.message)}
  });
  socket.on('rank:get',(_,cb)=>reply(cb,{rankings:rankList()}));
  socket.on('disconnect',()=>detach(socket));
});
// The server resolves expired turns, so disconnected players cannot block rooms forever.
// Waiting throws and moves are handled separately; no client can choose a timeout outcome.
setInterval(()=>{for(const room of rooms.values()){
 const g=room.game;if(g?.status!=='playing'||Date.now()<g.turnDeadline)continue;
 const seat=g.turn;let activity='';
 if(g.moves.length){
  // Pick a stable first legal move. An unplayable saved back-do can be discarded.
  let moved=false;
  outer:for(let m=0;m<g.moves.length;m++)for(let p=0;p<g.piecesPerPlayer;p++){
   const opts=legalMoves(g,seat,p,m);if(opts.length){movePiece(g,seat,p,m,opts[0].id);moved=true;activity='자동 말 이동';break outer;}
  }
  if(!moved){g.moves.shift();activity='이동할 말이 없어 결과 소멸';}
 } else if(g.rollCredits>0){
  // Automatically throw once rather than granting user-controlled outcomes.
  const result=throwYut();g.rollCredits--;g.lastThrow=result;
  const allowed=result.steps!==-1||g.pieces[seat].some((p,i)=>legalMoves({...g,moves:[-1]},seat,i,0).length);
  if(allowed)g.moves.push(result.steps);
  if(result.steps>=4)g.rollCredits++;
  activity=`자동 윷 던지기: ${result.name}`;
 }
 say(room,`${room.players[seat]?.name||'플레이어'} · 시간 초과 · ${activity}`);
 if(g.status==='finished'){recordWin(room)}
 else if(maybeNextTurn(g))say(room,`➡️ ${room.players[g.turn]?.name} 차례`);
 resetClock(g);broadcast(room);
}},1000).unref();
// Empty lobbies and finished rooms expire after a day; active games are left intact in memory.
setInterval(()=>{const now=Date.now();for(const [id,room] of rooms){
  if(now-room.createdAt>24*3600_000 && room.players.every(p=>!p?.socketId))rooms.delete(id);
}},3600_000).unref();
server.listen(PORT,'0.0.0.0',()=>console.log(`FIELD 윷놀이: http://localhost:${PORT}`));
