import {createAlkkagi,actAlkkagi,tickAlkkagi,resignAlkkagi,publicAlkkagi} from './alkkagi.js';
import {createPoker,actPoker,publicPoker,removePoker,timeoutPoker} from './poker.js';
import {createSeotda,updateSeotdaRelay,forfeitSeotdaRelay,actSeotda,publicSeotda,removeSeotda,timeoutSeotda} from './seotda.js';
import {newGomoku,actGomoku,publicGomoku,tickGomoku} from './gomoku.js';
import {createBadugi,actBadugi,publicBadugi,foldRemoved,timeoutBadugi} from './badugi.js';
import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, mkdirSync, openSync, fsyncSync, closeSync } from 'node:fs';
import { Server } from 'socket.io';
import { newGame, removeYutPlayer, throwYut, throwWithPower, movePiece, maybeNextTurn, publicGame, legalMoves, discardUnplayableBackdos, resetClock, COLORS } from './game.js';

const app=express();
app.disable('x-powered-by');
app.use((req,res,next)=>{if(req.path==='/'||req.path==='/welcome.mp3'||/\.(js|css|html|svg)$/.test(req.path))res.set({'Cache-Control':'no-store, no-cache, must-revalidate, max-age=0','Pragma':'no-cache','Expires':'0'});next();});
const ROOT=dirname(fileURLToPath(import.meta.url));
const PACKAGE_VERSION=JSON.parse(readFileSync(join(ROOT,'package.json'),'utf8')).version;
const SERVER_VERSION='v'+PACKAGE_VERSION.split('.').slice(0,2).join('.');
app.get('/version.json',(req,res)=>res.set({'Cache-Control':'no-store, max-age=0','Pragma':'no-cache'}).json({serverVersion:SERVER_VERSION,packageVersion:PACKAGE_VERSION}));
// Bonto: HTML/CSS/JS assets reside alongside server.js at application root.
app.get('/',(req,res)=>res.sendFile(join(ROOT,'index.html')));
app.get('/index.html',(req,res)=>res.sendFile(join(ROOT,'index.html')));
for(const name of ['stadium-banner.webp','stadium-hanja.woff2','hodon-korean.woff','stadium-ui.woff','hodon-round.woff','stadium.css','stadium-ui.js','stadium-scene.webp',...Array.from({length:10},(_,i)=>`hodon-avatar-${i}.svg`),...Array.from({length:10},(_,i)=>`hodon-piece-${i}.svg`)])app.get('/'+name,(req,res)=>res.sendFile(join(ROOT,name)));
for(const name of ["sculpted.css","sculpted-ui.js","sculpted-yut-stick.svg","sculpted-yut-stick.webp","approved.css", "approved-ui.js", "approved-busts.webp", "approved-tables.webp", "approved-food.webp", "approved-lobby.webp", "approved-lobby-chrome.svg", "approved-crest.svg","approved-yut-log.webp","approved-yut-drum.webp",...["approved-hero-yut.webp", "approved-hero-gomoku.webp", "approved-hero-poker.webp", "approved-hero-kkung.webp"],"approved-medal.svg","approved-tier-icons.svg",...Array.from({length:10},(_,i)=>`approved-bust-${i}.svg`)])app.get('/'+name,(req,res)=>res.sendFile(join(ROOT,name)));
const voiceFiles=new Set(['do','gae','geol','yut','mo','backdo']);
app.get('/voice/:clip.mp3',(req,res)=>voiceFiles.has(req.params.clip)?res.sendFile(join(ROOT,`voice-${req.params.clip}.mp3`)):res.sendStatus(404));
app.get('/hwatu/:card.svg',(req,res)=>/^(?:[0-9]|1[0-9])$/.test(req.params.card)?res.sendFile(join(ROOT,`hwatu-${req.params.card}.svg`)):res.sendStatus(404));
app.get('/HWATU-SOURCES.json',(req,res)=>res.sendFile(join(ROOT,'HWATU-SOURCES.json')));
app.get('/HWATU-LICENSE.txt',(req,res)=>res.sendFile(join(ROOT,'HWATU-LICENSE.txt')));
app.get('/app.js',(req,res)=>res.sendFile(join(ROOT,'app.js')));
app.get('/hodon-client-v58.js',(req,res)=>{const source=readFileSync(join(ROOT,'app.js'),'utf8');if(!source.startsWith("const BUILD_VERSION='v61.3'"))return res.status(503).type('text/plain').send('v61 통합본의 실행 파일과 서버를 함께 적용해 주세요.');res.type('application/javascript').send(source);});
app.get('/hodon-client-v61.js',(req,res)=>res.sendFile(join(ROOT,'hodon-client-v61.js')));
app.get('/style.css',(req,res)=>res.sendFile(join(ROOT,'style.css')));
for(const asset of ['yut-garden.webp','yut-characters-v53.webp','yut-characters.webp','yut-wood-panel.webp'])app.get('/'+asset,(req,res)=>res.sendFile(join(ROOT,asset)));
let avatarData=null;
app.get('/avatars/:avatarId.svg',(req,res)=>{
 if(!/^[0-9]$/.test(req.params.avatarId))return res.sendStatus(404);
 return res.sendFile(join(ROOT,`hodon-avatar-${req.params.avatarId}.svg`));
 const id=Number(req.params.avatarId);
 if(!avatarData)avatarData=readFileSync(join(ROOT,'avatar-sheet.jpg')).toString('base64');
 res.type('image/svg+xml').set('Cache-Control','public, max-age=86400').send(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="${id%3*512} ${Math.floor(id/3)*512} 512 512"><image width="1536" height="1024" href="data:image/jpeg;base64,${avatarData}"/></svg>`);
});
app.get('/hodon-face.png',(req,res)=>res.sendFile(join(ROOT,'hodon-face.png')));
for(const name of ['sichuan-ui.js','room-controls.js','studio.css','premium.css','kkung.css','kkung-ui.js','badugi.css','gomoku.css','seotda.css','poker.css','sound.js','stadium.svg','lounge.css'])app.get('/'+name,(req,res)=>res.sendFile(join(ROOT,name)));
app.get('/welcome.mp3',(req,res)=>res.type('audio/mpeg').sendFile(join(ROOT,'welcome.mp3')));
for(const name of ['sichuan-art.webp','sichuan-tiles.webp'])app.get('/'+name,(req,res)=>res.sendFile(join(ROOT,name)));
const server=createServer(app);
const io=new Server(server,{maxHttpBufferSize:50_000,pingInterval:20000,pingTimeout:60000,cors:{origin:false}});
const cliPortIndex=process.argv.indexOf('--port');
const PORT=Number(process.env.PORT)||(cliPortIndex>=0?Number(process.argv[cliPortIndex+1]):0)||3000;
let scEngine=null,scStore=null,scPromise=null;
async function getSichuan(){scPromise??=import('./sichuan.js');const e=await scPromise;if(!scStore)scStore=e.createProfileStore(join(process.env.HODON_DATA_DIR||ROOT,'hodon-data'));scEngine=e;return e;}
const scActive=room=>['countdown','playing'].includes(room.sichuan?.status);
const rooms=new Map();let kkEngine=null,kkEnginePromise=null;
// Server-owned recovery only: never accept room snapshots or hidden hands from clients.
const BOOT_ID=randomUUID(),BOOT_AT=Date.now();
function readSavedState(path){try{return readFileSync(path,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;return readFileSync(path.replace(/\.state$/,'.json'),'utf8');}}
const ROOM_PATH=join(process.env.HODON_DATA_DIR||ROOT,'hodon-data','rooms.state');
let recoverySaveFailed=false,recoveryTimer=null,lastRecoverySave=0;
function flushRooms(){
 clearTimeout(recoveryTimer);recoveryTimer=null;
 try{
  mkdirSync(dirname(ROOM_PATH),{recursive:true,mode:0o700});
  const bytes=JSON.stringify({version:1,savedAt:Date.now(),rooms:[...rooms.values()]},(key,value)=>key==='socketId'?null:value);
  const temp=ROOM_PATH+'.tmp',fd=openSync(temp,'w',0o600);
  try{writeFileSync(fd,bytes);fsyncSync(fd);}finally{closeSync(fd);}
  renameSync(temp,ROOM_PATH);lastRecoverySave=Date.now();
  if(recoverySaveFailed)console.info('Room recovery storage available again');recoverySaveFailed=false;
 }catch(e){if(!recoverySaveFailed)console.error('Room recovery save failed:',e.message);recoverySaveFailed=true;}
}
function checkpointRooms(immediate=false){
 if(immediate||Date.now()-lastRecoverySave>=250){flushRooms();return;}
 if(!recoveryTimer)recoveryTimer=setTimeout(flushRooms,250).unref();
}
function extendRecoveredClock(g,delta){
 if(!g||!['playing','countdown'].includes(g.status))return;
 for(const key of ['deadline','turnDeadline','startsAt','tickAt'])if(Number.isFinite(g[key]))g[key]+=delta;
 if(Number.isFinite(g.pending?.expires))g.pending.expires+=delta;
 if(Number.isFinite(g.shot?.startedAt))g.shot.startedAt+=delta;
}
async function restoreRooms(){
 let saved;try{saved=JSON.parse(readSavedState(ROOM_PATH));}catch(e){if(e.code!=='ENOENT')console.error('Room recovery read failed:',e.message);return;}
 if(saved.version!==1||!Number.isFinite(saved.savedAt)||!Array.isArray(saved.rooms)){console.error('Room recovery format invalid');return;}
 const now=Date.now(),delta=Math.max(0,now-saved.savedAt)+15000;
 for(const room of saved.rooms){
  if(!/^[A-Z2-9]{6}$/.test(room?.code)||!Array.isArray(room.players)||!Array.isArray(room.spectators))continue;
  // Match the existing expiry policy for fully disconnected rooms.
  if(now-room.createdAt>24*3600_000&&!['game','badugi','gomoku','seotda','poker','alkkagi','kkung','sichuan'].some(k=>['playing','countdown'].includes(room[k]?.status)))continue;
  try{
   if(room.sichuan)await getSichuan();if(room.kkung)await getKkungEngine();
   room.sichuanStarting=false;room.kkungStarting=false;
   for(const p of [...room.players,...room.spectators])if(p){p.socketId=null;delete p.requestedSeat;}
   for(const key of ['game','badugi','gomoku','seotda','poker','alkkagi','kkung','sichuan'])extendRecoveredClock(room[key],delta);
   if(Number.isFinite(room.seotdaRelay?.nextAt))room.seotdaRelay.nextAt+=delta;
   rooms.set(room.code,room);
  }catch(e){console.error('Room recovery engine failed:',room.code,e.message);}
 }
 if(rooms.size)console.warn('Recovered rooms:',rooms.size);
}

async function getKkungEngine(){kkEnginePromise??=import('./kkung.js');try{return kkEngine=await kkEnginePromise}catch(e){kkEnginePromise=null;throw e}}
// Local JSON leaderboard persists across ordinary restarts only when host disk persists.
// Use external database for permanent cross-deployment persistence.
const STATS_PATH=join(ROOT,'field-records.state');
let stats={};try{stats=JSON.parse(readSavedState(STATS_PATH));}catch{}
function saveStats(){try{writeFileSync(STATS_PATH+'.tmp',JSON.stringify(stats));renameSync(STATS_PATH+'.tmp',STATS_PATH);}catch(e){console.error('Leaderboard save failed:',e.message)}}
function recordWin(room){if(!room.game||room.game.recorded)return;room.game.recorded=true;
 const {game:g}=room;room.players.forEach((p,i)=>{if(!p||g.participants?.[i]===false)return;
   // Nickname-based ranks are for casual play, not trusted identity.
   const key=createHash('sha256').update(p.name).digest('hex').slice(0,24);
   const row=stats[key]||{name:p.name,played:0,wins:0};row.name=p.name;row.played++;
   if(g.mode==='team'?i%2===g.winner%2:i===g.winner)row.wins++;
   stats[key]=row;
 });saveStats();}
function rankList(){return Object.values(stats).sort((a,b)=>b.wins-a.wins||b.played-a.played).slice(0,30)}

const CODE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function code() {let s;do{s=Array.from(randomBytes(6),b=>CODE_ALPHABET[b%CODE_ALPHABET.length]).join('')}while(rooms.has(s));return s;}
function validAvatar(data){return data.avatarId===undefined||(Number.isInteger(data.avatarId)&&data.avatarId>=0&&data.avatarId<10);}
function cleanName(input) {if(typeof input!=='string') return '';return input.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,14);}
function failure(callback,reason,code) {if(typeof callback==='function')callback({ok:false,error:reason,...(code?{code}:{})});}
function reply(callback,data={}) {if(typeof callback==='function')callback({ok:true,...data});}
function seotdaStarters(room){const seats=new Set([room.host]);const g=room.seotda;if(g?.status==='finished')for(const pot of g.pots||[])if(!pot.refund)for(const i of pot.winners||[])if(room.players[i]&&room.seotdaTokens?.[i]===room.players[i].token)seats.add(i);return [...seats].filter(i=>room.players[i]);}
function seotdaHandParticipants(room){return room.players.map((p,i)=>!!p&&!!room.seotda?.players[i]?.name&&room.seotdaTokens?.[i]===p.token);}
function seotdaNeedsReset(room){return room.seotdaRelay?.status==='finished'||!!room.seotda&&room.wallets.filter((n,i)=>room.players[i]&&n>0).length<2;}
function summary(room,viewer=null) {return {myRecords:viewer!==null&&room.players[viewer]?.profileId?scStore?.records(room.players[viewer].profileId):null,serverNow:Date.now(),sichuan:scEngine?.publicSichuan(room.sichuan,viewer!==null&&room.sichuanTokens?.[viewer]===room.players[viewer]?.token?viewer:null)||null,sichuanMap:room.sichuanMap,sichuanMode:room.sichuanMode,sichuanChat:room.sichuanChat||[],sichuanProfiles:room.players.map(p=>p?.profileId?scStore?.row(p.profileId):null),sichuanGod:scStore?.leaders().find(p=>p.god)||null,sichuanSaveError:!!room.sichuan?.recordError,kkung:room.kkung?kkEngine.publicKkung(room.kkung):null,kkungChat:room.kkungChat||[],roomTitle:room.roomTitle,alkkagi:publicAlkkagi(room.alkkagi),leavePending:room.players.flatMap((p,i)=>p?.leaveRequested?[i]:[]),seatEntryBlocked:seatEntryBlocked(room),seatRequests:room.spectators.filter(w=>Number.isInteger(w.requestedSeat)).map(w=>({id:w.id,seat:w.requestedSeat,name:w.name})),seotdaRelay:room.seotdaRelay?{...room.seotdaRelay,eliminated:[...room.seotdaRelay.eliminated],retired:[...room.seotdaRelay.retired]}:null,seotdaStarters:seotdaStarters(room),seotdaParticipants:seotdaHandParticipants(room),seotdaNeedsReset:seotdaNeedsReset(room),poker:publicPoker(room.poker,viewer!==null&&room.pokerTokens?.[viewer]===room.players[viewer]?.token?viewer:null),wallets:[...room.wallets],serverVersion:SERVER_VERSION,gameType:room.gameType||'yut',pokerRule:room.pokerRule,seotdaCards:room.seotdaCards,seotda:publicSeotda(room.seotda,viewer!==null&&room.seotdaTokens?.[viewer]===room.players[viewer]?.token?viewer:null),gomoku:publicGomoku(room.gomoku),gomokuSamePlayers:!!room.gomokuTokens?.every((t,i)=>t===room.players[i]?.token),gomokuMinutes:room.gomokuMinutes,base:room.base,startingChips:room.startingChips,badugi:publicBadugi(room.badugi,viewer!==null&&room.badugiTokens?.[viewer]===room.players[viewer]?.token?viewer:null),code:room.code,host:room.host,mode:room.sichuan?.status||room.kkung?.status||room.alkkagi?.status||room.poker?.status||room.seotda?.status||room.gomoku?.status||room.badugi?.status||room.game?.status||'lobby',
  piecesPerPlayer:room.piecesPerPlayer,playerCount:room.playerCount,matchMode:room.matchMode,turnSeconds:room.turnSeconds,players:room.players.map(p=>p?({name:p.name,avatarId:p.avatarId??0,connected:!!p.socketId}):null),
  spectators:(room.spectators||[]).map(p=>({name:p.name,avatarId:p.avatarId??0,connected:!!p.socketId,id:p.id})),
  colors:COLORS,game:room.game?publicGame(room.game):null};}
function startGomokuRound(room,opener){
 const gameNo=(room.gomoku?.gameNo||0)+1;
 room.gomoku=newGomoku(room.players.map(p=>p.name),{minutes:room.gomokuMinutes,gameNo,opener});room.gomoku.avatars=room.players.map(p=>p.avatarId??0);room.gomokuTokens=room.players.map(p=>p.token);
}
function continueGomoku(room){
 const g=room.gomoku;
 if(room.gameType==='gomoku'&&g?.status==='finished'&&g.winner!==null&&Number.isInteger(g.nextBlack)&&room.gomokuTokens?.every((t,i)=>t===room.players[i]?.token)&&room.players.every(p=>p?.socketId))startGomokuRound(room,g.nextBlack);
}
function continueSeotdaRoom(room,now=Date.now()){
 const relay=room.seotdaRelay,g=room.seotda;if(!relay||!g||g.status!=='finished')return;
 updateSeotdaRelay(relay,g,now);room.wallets=g.players.map((p,i)=>seotdaHandParticipants(room)[i]?p.chips:room.wallets[i]);
 if(relay.status==='playing'&&relay.nextAt!==null&&now>=relay.nextAt){
  const bonusPot=relay.carry||0;
  const names=room.players.map((p,i)=>p&&relay.participants?.[i]!==false?p.name:'');
  room.seotda=createSeotda(names,room.wallets.map((n,i)=>names[i]?n:0),{base:room.base,turnSeconds:room.turnSeconds,dealer:(g.dealer+1)%room.playerCount,handNo:g.handNo+1,cards:room.seotdaCards,avatars:room.players.map(p=>p?.avatarId??0),bonusPot});
  room.seotdaTokens=room.players.map(p=>p?.token||null);relay.carry=0;relay.nextAt=null;
  if(room.seotda.status==='finished'){updateSeotdaRelay(relay,room.seotda,now);room.wallets=room.seotda.players.map((p,i)=>seotdaHandParticipants(room)[i]?p.chips:room.wallets[i]);}
 }
}
function seatEntryBlocked(room){return scActive(room)||room.seotdaRelay?.status==='playing'||[room.kkung,room.game,room.badugi,room.gomoku,room.seotda,room.poker,room.alkkagi].some(g=>g?.status==='playing');}
function availableSeat(room){return room.players.findIndex((p,i)=>!p&&!room.spectators.some(w=>w.requestedSeat===i));}
function promoteWatcher(room,watcher,seat){
 const client=io.sockets.sockets.get(watcher.socketId);if(!client||room.players[seat])return null;
 room.spectators.splice(room.spectators.indexOf(watcher),1);
 room.players[seat]={name:watcher.name,avatarId:watcher.avatarId,...(client.data.account||{}),token:watcher.token,socketId:client.id};
 if(['badugi','seotda','poker'].includes(room.gameType))room.wallets[seat]=room.startingChips;
 if(!room.players[room.host])room.host=seat;
 client.data={account:client.data.account,roomCode:room.code,token:watcher.token,role:'player'};
 const session={code:room.code,token:watcher.token,seat,role:'player'};client.emit('room:role',session);return session;
}
function promoteWaitingWatchers(room){if(seatEntryBlocked(room))return;for(const w of [...room.spectators])if(Number.isInteger(w.requestedSeat)&&!room.players[w.requestedSeat])promoteWatcher(room,w,w.requestedSeat);}
function syncFinishedWallets(room){
 if(room.poker?.status==='finished')room.wallets=room.poker.players.map((p,i)=>room.pokerParticipants?.[i]!==false&&room.pokerTokens?.[i]===room.players[i]?.token?p.chips:room.wallets[i]);
 if(room.seotda?.status==='finished')room.wallets=room.seotda.players.map((p,i)=>seotdaHandParticipants(room)[i]?p.chips:room.wallets[i]);
 if(room.badugi?.status==='finished')room.wallets=room.badugi.players.map((p,i)=>room.badugiParticipants?.[i]===false||room.badugiTokens?.[i]!==room.players[i]?.token?room.wallets[i]:p.chips);
}
function currentHandPlaying(room,seat){return (scActive(room)&&room.sichuan.players[seat]?.status==='playing')||(room.kkung?.status==='playing'&&room.kkung.players[seat]?.lives>0)||room.alkkagi?.status==='playing'||(room.game?.status==='playing'&&room.game.participants?.[seat]!==false&&!room.game.retired?.includes(seat)&&!room.game.placements?.some(p=>p.seat===seat))||room.poker?.status==='playing'||room.badugi?.status==='playing'||room.gomoku?.status==='playing'||(room.seotda?.status==='playing'&&!(room.seotdaRelay?.eliminated||[]).includes(seat));}
function removeRoomPlayer(room,seat,notify=false){
 const player=room.players[seat];if(!player)return;
 if(room.seotdaRelay?.status==='playing'){forfeitSeotdaRelay(room.seotdaRelay,room.seotda,seat);room.wallets[seat]=0;}
 room.players[seat]=null;
 const client=io.sockets.sockets.get(player.socketId);if(client){client.leave(room.code);client.data={account:client.data.account,};if(notify)client.emit('room:left',{code:room.code,reason:'reserved'});}
 if(room.host===seat||!room.players[room.host]){room.host=room.players.findIndex(p=>p?.socketId);if(room.host<0)room.host=room.players.findIndex(Boolean);}
 if(!room.players.some(Boolean)&&!room.spectators.length)rooms.delete(room.code);
}
function finishRetirements(room){
 const relay=room.seotdaRelay,g=room.seotda;if(relay?.status!=='playing'||g?.status!=='finished')return;
 updateSeotdaRelay(relay,g);
 if(relay.status==='playing'&&!g.players.some(p=>p.chips>0)){relay.closedPot=relay.carry||0;relay.carry=0;relay.status='finished';relay.nextAt=null;relay.champion=null;relay.abandoned=true;}
}
function processLeaveRequests(room){
 if(room.seotdaRelay&&room.seotda?.status==='finished')updateSeotdaRelay(room.seotdaRelay,room.seotda);
 for(let i=0;i<room.players.length;i++)if(room.players[i]?.leaveRequested&&!currentHandPlaying(room,i))removeRoomPlayer(room,i,true);
 finishRetirements(room);
}
const LOBBY_CHANNEL='__public_lobby__';let lastLobbySnapshot='';
const lobbyChats=[];
function publicRooms(){return [...rooms.values()].filter(r=>r.players.some(p=>p?.socketId)||r.spectators.some(p=>p.socketId)).sort((a,b)=>b.createdAt-a.createdAt||a.code.localeCompare(b.code)).slice(0,200).map(r=>{
 const playing=seatEntryBlocked(r),host=r.players[r.host],available=r.players.filter((p,i)=>!p&&!r.spectators.some(w=>w.requestedSeat===i)).length;
 return {code:r.code,gameType:r.gameType,hostName:host?.name||'함께할 친구',hostAvatarId:host?.avatarId??0,playerCount:r.playerCount,occupied:r.players.filter(Boolean).length,connectedPlayers:r.players.filter(p=>p?.socketId).length,spectators:r.spectators.filter(w=>w.socketId).length,availableSeats:available,canJoin:!playing&&available>0,status:playing?'playing':r.sichuan||r.kkung||r.game||r.badugi||r.gomoku||r.seotda||r.poker||r.alkkagi?'finished':'waiting',sichuanMap:r.sichuanMap,sichuanMode:r.sichuanMode,matchMode:r.matchMode,piecesPerPlayer:r.piecesPerPlayer,roomTitle:r.roomTitle,pokerRule:r.pokerRule,seotdaCards:r.seotdaCards,base:r.base,startingChips:r.startingChips,gomokuMinutes:r.gomokuMinutes,createdAt:r.createdAt};
 });}
function broadcastLobby(){checkpointRooms();const list=publicRooms(),snapshot=JSON.stringify(list);if(snapshot===lastLobbySnapshot)return;lastLobbySnapshot=snapshot;io.to(LOBBY_CHANNEL).emit('lobby:state',{rooms:list});}
function broadcast(room){
 const type=room.gameType||'yut',g=room[type==='yut'?'game':type];
 if(g&&type!=='sichuan'&&scStore){
  g.rankMatchId??=randomUUID();
  if(!g.rankRoster)g.rankRoster=room.players.map((p,i)=>p&&g.participants?.[i]!==false&&room[type+'Participants']?.[i]!==false&&(!g.players||g.players[i]?.name)?{profileId:p.profileId}:null);
  if(g.status==='finished'&&!g.rankAwarded){try{
   let winners=Number.isInteger(g.winner)?[g.winner]:[];
   if(type==='yut'&&g.mode==='team')winners=g.rankRoster.flatMap((p,i)=>p&&i%2===g.winner?[i]:[]);
   if(['badugi','seotda','poker'].includes(type))winners=[...new Set((g.pots||[]).filter(p=>!p.refund&&!p.replay).flatMap(p=>p.winners||[]))];
   scStore.awardGame(type,g.rankMatchId,g.rankRoster,winners);g.rankAwarded=true;
  }catch(e){console.error('Game records:',e.message);}}
 }

 if(room.sichuan?.status==='finished'&&!room.sichuan.awarded){try{scStore.award(room.sichuan);room.sichuan.recordError=false;}catch(e){room.sichuan.recordError=true;console.error('Sichuan records:',e.message);}}
 syncFinishedWallets(room);processLeaveRequests(room);
 if(!rooms.has(room.code)){broadcastLobby();return;}
 continueGomoku(room);continueSeotdaRoom(room);syncFinishedWallets(room);promoteWaitingWatchers(room);
 for(const id of io.sockets.adapter.rooms.get(room.code)||[]){const client=io.sockets.sockets.get(id),a=authorization(client);client.emit('room:state',summary(room,a?.seat??null));}
 broadcastLobby();
}
function say(room,text) {if(!room.game)return;room.game.log.push(text);if(room.game.log.length>40)room.game.log.shift();}
function identify(socket,room,token) {const seat=room.players.findIndex(p=>p?.token===token);return seat<0?null:{seat,player:room.players[seat]};}
function authorization(socket) {const {roomCode,token,role}=socket.data||{};const room=rooms.get(roomCode);if(!room||role==='spectator')return null;const identified=identify(socket,room,token);if(!identified||identified.player.socketId!==socket.id)return null;return {room,...identified};}
function spectatorAuthorization(socket) {const {roomCode,token,role}=socket.data||{};if(role!=='spectator')return null;const room=rooms.get(roomCode);if(!room)return null;const index=(room.spectators||[]).findIndex(p=>p.token===token&&p.socketId===socket.id);return index<0?null:{room,index,spectator:room.spectators[index]};}
function detach(socket) {
  const auth=authorization(socket);if(auth){const {room,seat}=auth;room.players[seat].socketId=null;say(room,`${room.players[seat].name} 님의 연결이 끊겼습니다. 재접속을 기다립니다.`);broadcast(room);return;}
  const watch=spectatorAuthorization(socket);if(watch){watch.spectator.socketId=null;delete watch.spectator.requestedSeat;broadcast(watch.room);}
}
function activeSeats(room){return room.players.map(Boolean);}
io.on('connection',socket=>{
  socket.on('player:profile',async(data={},cb)=>{
   try{await getSichuan();const name=cleanName(data.name)||'호돈',a=authorization(socket);
    const credential=data.credential||a?.player.profileCredential||socket.data.account?.profileCredential;
    if(a&&currentHandPlaying(a.room,a.seat)&&credential&&credential!==a.player.profileCredential)throw Error('경기 중에는 기록을 변경할 수 없습니다.');
    const result=scStore.ensure(credential,name);
    socket.data.account={profileId:result.profile.id,profileCredential:result.credential};
    if(a){Object.assign(a.player,socket.data.account);}
    reply(cb,{...result,records:scStore.records(result.profile.id)});
   }catch(e){failure(cb,e.message);}
  });

  socket.on('lobby:watch',(_,cb)=>{socket.join(LOBBY_CHANNEL);socket.data.lobbyWatching=true;reply(cb,{rooms:publicRooms(),chats:lobbyChats.slice(-80)});});
  socket.on('lobby:list',(_,cb)=>reply(cb,{rooms:publicRooms()}));
  socket.on('lobby:chat',(data={},cb)=>{
    if(!socket.rooms.has(LOBBY_CHANNEL)||socket.data.roomCode)return failure(cb,'대기실에서만 대화할 수 있습니다.');
    if(!data||!validAvatar(data))return failure(cb,'얼굴을 확인하세요.');
    const name=cleanName(data.name),text=typeof data.text==='string'?data.text.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,140):'';
    if(!name||!text)return failure(cb,'닉네임과 메시지를 입력하세요.');
    const now=Date.now(),recent=(socket.data.chatTimes||[]).filter(t=>now-t<5000);if(recent.length>=3)return failure(cb,'메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 보내세요.');
    recent.push(now);socket.data.chatTimes=recent;
    const row={id:randomUUID(),name,avatarId:data.avatarId??0,text,at:now};lobbyChats.push(row);if(lobbyChats.length>80)lobbyChats.shift();io.to(LOBBY_CHANNEL).emit('lobby:chat',row);reply(cb);
  });


  socket.on('server:info',(_,cb)=>reply(cb,{serverVersion:SERVER_VERSION,roomProtocol:2,bootId:BOOT_ID,uptimeMs:Date.now()-BOOT_AT,roomRecovery:!recoverySaveFailed,games:['yut','badugi','gomoku','seotda','poker','alkkagi','kkung','sichuan']}));
  socket.on('room:create',(data={},cb)=>{data=data||{};if(!validAvatar(data))return failure(cb,'캐릭터를 10종 중에서 선택해 주세요.');
    if(authorization(socket)||spectatorAuthorization(socket)) return failure(cb,'이미 방에 참가 중입니다.');
    const name=cleanName(data.name);if(!name)return failure(cb,'닉네임을 입력해 주세요.');
    const playerCount=Number(data.playerCount);
    const maxPlayers=['seotda','poker'].includes(data.gameType)?5:(!data.gameType||data.gameType==='yut'||data.gameType==='kkung'||data.gameType==='sichuan')?10:['gomoku','alkkagi'].includes(data.gameType)?2:4;
    if(!Number.isInteger(playerCount)||playerCount<2||playerCount>maxPlayers)return failure(cb,'참가 인원을 확인하세요. 윷놀이 개인전은 2~10명, 팀전 4명, 섯다 2~5명, 바둑이 2~4명, 포커 2~5명, 오목 2명입니다.');
    if(data.gameType!==undefined&&!['yut','badugi','gomoku','seotda','poker','alkkagi','kkung','sichuan'].includes(data.gameType))return failure(cb,'게임 종류를 확인해 주세요.');
    const gameType=['badugi','gomoku','seotda','poker','alkkagi','kkung','sichuan'].includes(data.gameType)?data.gameType:'yut';
    if(['gomoku','alkkagi'].includes(gameType)&&playerCount!==2)return failure(cb,'오목과 장기알까기는 대국자 2명 전용입니다.');
    const gomokuMinutes=[5,10,15].includes(Number(data.gomokuMinutes))?Number(data.gomokuMinutes):5;
    const matchMode=gameType==='yut'&&data.matchMode==='team'?'team':'solo';
    const base=Number(data.base??100),startingChips=Number(data.startingChips??10000);
    if(['badugi','seotda','poker'].includes(gameType)&&(!Number.isSafeInteger(base)||base<1||base>(gameType==='poker'?100000000000:1000000)||!Number.isSafeInteger(startingChips)||startingChips<base*2||startingChips>(gameType==='poker'?1000000000000:1000000000)))return failure(cb,'기본 판돈과 시작 금액을 확인하세요. 시작 금액은 판돈의 2배 이상이며, 포커는 최대 1조 칩입니다.');
    if(matchMode==='team'&&playerCount!==4)return failure(cb,'팀전은 4명 전용입니다.');
    const turnSeconds=15;
    const count=Number(data.piecesPerPlayer);
    if(!Number.isInteger(count)||count<1||count>4)return failure(cb,'말 개수는 1~4개입니다.');
    const id=code(), token=randomUUID();
    const seotdaCards=Number(data.seotdaCards??2);if(gameType==='seotda'&&![2,3].includes(seotdaCards))return failure(cb,'2장 또는 3장 섯다를 선택하세요.');
    const pokerRule=data.pokerRule??'normal';if(gameType==='poker'&&!['normal','choice'].includes(pokerRule))return failure(cb,'일반 또는 초이스 룰을 선택하세요.');
    const titleIn=typeof data.roomTitle==='string'?data.roomTitle.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,32):'';
    const roomTitle=titleIn||name+'의 '+({yut:'윷놀이',badugi:'바둑이',gomoku:'오목',seotda:'섯다',poker:'7포커',alkkagi:'장기알까기',kkung:'쿵쿵따',sichuan:'사천성'}[gameType])+'방';
    const sichuanMap=['butterfly','heart','diamond','bridge','square','flower','random'].includes(data.sichuanMap)?data.sichuanMap:'butterfly',sichuanMode=data.sichuanMode==='first'?'first':'relay';
    const room={sichuan:null,sichuanMap,sichuanMode,sichuanChat:[],kkung:null,kkungChat:[],roomTitle,alkkagi:null,poker:null,pokerRule,seotda:null,seotdaCards,gomoku:null,gomokuMinutes,gameType,base,startingChips,wallets:Array(playerCount).fill(startingChips),badugi:null,code:id,host:0,piecesPerPlayer:matchMode==='team'?3:count,matchMode,turnSeconds,playerCount,players:[{name,avatarId:data.avatarId??0,...(socket.data.account||{}),token,socketId:socket.id},...Array(playerCount-1).fill(null)],spectators:[],game:null,createdAt:Date.now()};
    rooms.set(id,room);checkpointRooms(true);socket.join(id);socket.data={account:socket.data.account,roomCode:id,token,role:'player'};
    reply(cb,{code:id,token,seat:0,role:'player',gameType:room.gameType,serverVersion:SERVER_VERSION});broadcast(room);
  });
  socket.on('room:join',(data={},cb)=>{data=data||{};if(!validAvatar(data))return failure(cb,'캐릭터를 10종 중에서 선택해 주세요.');
    const current=authorization(socket),watching=spectatorAuthorization(socket);
    if(current||watching){const r=current?.room||watching.room;if(r.code===String(data.code||'').trim().toUpperCase()&&socket.data.token===data.token){reply(cb,{code:r.code,token:socket.data.token,seat:current?.seat??null,role:current?'player':'spectator'});broadcast(r);return;}return failure(cb,'먼저 현재 방을 나가 주세요.');}
    const id=String(data.code||'').trim().toUpperCase();const room=rooms.get(id);
    if(!room)return failure(cb,'방을 찾지 못했습니다. 기존 참가자는 재연결을 기다려 주세요.','ROOM_NOT_FOUND');
    const tokenIn=typeof data.token==='string'?data.token:'';
    let seat=room.players.findIndex(p=>p?.token===tokenIn&&tokenIn);
    if(seat>=0){
      const former=room.players[seat].socketId;
      if(former&&former!==socket.id){const old=io.sockets.sockets.get(former);if(old){old.data={};old.leave(id);old.emit('session:replaced');}}
      room.players[seat].socketId=socket.id;socket.data={account:socket.data.account,roomCode:id,token:tokenIn,role:'player'};socket.join(id);
      reply(cb,{code:id,token:tokenIn,seat,role:'player'});broadcast(room);return;
    }
    let spectatorIndex=(room.spectators||[]).findIndex(p=>p.token===tokenIn&&tokenIn);
    const wantsWatch=scActive(room)||room.seotdaRelay?.status==='playing'||!!data.spectator||spectatorIndex>=0||(room.alkkagi?.status==='playing'||(room.game?.status==='playing'&&room.game.participants?.[seat]!==false&&!room.game.retired?.includes(seat)&&!room.game.placements?.some(p=>p.seat===seat))||room.poker?.status==='playing'||room.badugi?.status==='playing'||room.gomoku?.status==='playing'||room.seotda?.status==='playing');
    if(wantsWatch){
      if(spectatorIndex>=0){
        const watcher=room.spectators[spectatorIndex],former=watcher.socketId;
        if(former&&former!==socket.id){const old=io.sockets.sockets.get(former);if(old){old.data={};old.leave(id);old.emit('session:replaced');}}
        watcher.socketId=socket.id;
      }else{
        const name=cleanName(data.name);if(!name)return failure(cb,'관전할 닉네임을 입력해 주세요.');
        const watcher={id:randomUUID(),name,avatarId:data.avatarId??0,...(socket.data.account||{}),token:randomUUID(),socketId:socket.id};room.spectators.push(watcher);spectatorIndex=room.spectators.length-1;
      }
      const watcher=room.spectators[spectatorIndex];socket.data={account:socket.data.account,roomCode:id,token:watcher.token,role:'spectator'};socket.join(id);
      socket.emit('room:spectator-identity',{id:watcher.id});reply(cb,{code:id,token:watcher.token,seat:null,role:'spectator'});broadcast(room);return;
    }
    if(room.game?.status==='playing')return failure(cb,'게임이 진행 중입니다. 관전 입장 버튼을 이용해 주세요.');
    seat=availableSeat(room);
    if(seat<0)return failure(cb,'방이 가득 찼습니다. 관전으로 입장할 수 있습니다.');
    const name=cleanName(data.name);if(!name)return failure(cb,'닉네임을 입력해 주세요.');
    const newToken=randomUUID();room.players[seat]={name,avatarId:data.avatarId??0,...(socket.data.account||{}),token:newToken,socketId:socket.id};if(['badugi','seotda','poker'].includes(room.gameType))room.wallets[seat]=room.startingChips;
    if(!room.players[room.host])room.host=seat;socket.data={account:socket.data.account,roomCode:id,token:newToken,role:'player'};socket.join(id);
    reply(cb,{code:id,token:newToken,seat,role:'player'});broadcast(room);
  });
  socket.on('room:take-seat',(_,cb)=>{
    const a=spectatorAuthorization(socket);if(!a)return failure(cb,'현재 방의 관전자만 참가할 수 있습니다.');
    const {room,spectator}=a;
    if(Number.isInteger(spectator.requestedSeat))return failure(cb,'이미 빈자리에 참가 예약 중입니다.');
    const seat=availableSeat(room);if(seat<0)return failure(cb,'현재 참가할 빈자리가 없습니다. 연결이 끊긴 참가자의 자리는 보존됩니다.');
    if(seatEntryBlocked(room)){spectator.requestedSeat=seat;reply(cb,{pending:true,seat});}
    else reply(cb,{pending:false,...promoteWatcher(room,spectator,seat)});
    broadcast(room);
  });
  socket.on('room:cancel-seat',(_,cb)=>{
    const a=spectatorAuthorization(socket);if(!a)return failure(cb,'관전자만 예약을 취소할 수 있습니다.');
    delete a.spectator.requestedSeat;reply(cb);broadcast(a.room);
  });
  socket.on('room:leave',(_,cb)=>{
    const watch=spectatorAuthorization(socket);
    if(watch){const {room,index}=watch;room.spectators.splice(index,1);socket.leave(room.code);socket.data={account:socket.data.account,};if(!room.players.some(Boolean)&&!room.spectators.length)rooms.delete(room.code);else broadcast(room);reply(cb,{left:true});broadcastLobby();return;}
    const a=authorization(socket);if(!a)return failure(cb,'방에 참가 중이 아닙니다.');
    const {room,seat,player}=a;
    if(currentHandPlaying(room,seat)){player.leaveRequested=true;reply(cb,{pending:true});broadcast(room);return;}
    syncFinishedWallets(room);removeRoomPlayer(room,seat);finishRetirements(room);reply(cb,{left:true});if(rooms.has(room.code))broadcast(room);else broadcastLobby();
  });
  socket.on('room:cancel-leave',(_,cb)=>{
    const a=authorization(socket);if(!a)return failure(cb,'현재 방의 참가자만 예약을 취소할 수 있습니다.');
    a.player.leaveRequested=false;reply(cb,{pending:false});broadcast(a.room);
  });
  socket.on('room:kick',(data={},cb)=>{data=data||{};
    const a=authorization(socket);if(!a)return failure(cb,'방에 참가해 주세요.');
    const {room,seat}=a;if(room.host!==seat)return failure(cb,'방장만 강퇴할 수 있습니다.');
    if(data.seat!==undefined&&data.seat!==null&&Number.isInteger(Number(data.seat))){
      const target=Number(data.seat);if(target<0||target>=room.players.length||target===seat||!room.players[target])return failure(cb,'강퇴할 참가자를 확인해 주세요.');
      const kicked=room.players[target],oldSocket=kicked.socketId;room.players[target]=null;
      if(oldSocket){const client=io.sockets.sockets.get(oldSocket);if(client){client.data={account:client.data.account,};client.leave(room.code);client.emit('session:kicked');}}
      if(scActive(room)&&room.sichuan.players[target]?.status==='playing')scEngine.resignSichuan(room.sichuan,target);
      if(room.kkung?.status==='playing'&&room.kkung.players[target]?.lives)kkEngine.resignKkung(room.kkung,target);
      if(room.alkkagi?.status==='playing')resignAlkkagi(room.alkkagi,target);
      if(room.gomoku?.status==='playing'){actGomoku(room.gomoku,target,{action:'resign',revision:room.gomoku.revision});}
      if(room.seotdaRelay?.status==='playing'){forfeitSeotdaRelay(room.seotdaRelay,room.seotda,target);room.wallets[target]=0;}else if(room.seotda?.status==='playing')removeSeotda(room.seotda,target);
      if(room.badugi?.status==='playing')foldRemoved(room.badugi,target);
      if(room.poker?.status==='playing')removePoker(room.poker,target);
      if(room.game?.status==='playing'){removeYutPlayer(room.game,target);if(room.game.status==='finished')recordWin(room);}
      if(room.game?.status==='playing'&&room.game.turn===target){room.game.moves=[];room.game.rollCredits=0;maybeNextTurn(room.game,activeSeats(room));say(room,`${kicked.name} 님이 강퇴되어 차례를 넘겼습니다.`);}
      else say(room,`${kicked.name} 님이 방장에 의해 강퇴되었습니다.`);
      socket.data={account:socket.data.account,roomCode:room.code,token:a.player.token,role:'player'};reply(cb);broadcast(room);return;
    }
    const targetId=String(data.spectatorId||'');const index=room.spectators.findIndex(p=>p.id===targetId);
    if(index<0)return failure(cb,'강퇴할 관전자를 찾을 수 없습니다.');
    const [watcher]=room.spectators.splice(index,1);if(watcher.socketId){const client=io.sockets.sockets.get(watcher.socketId);if(client){client.data={account:client.data.account,};client.leave(room.code);client.emit('session:kicked');}}
    say(room,`${watcher.name} 님이 관전방에서 강퇴되었습니다.`);reply(cb);broadcast(room);
  });
  socket.on('game:start',async(data={},cb)=>{data=data||{};
    const a=authorization(socket);if(!a)return failure(cb,'방에 참가해 주세요.');
    const {room,seat}=a;
    if(room.host!==seat&&!(room.gameType==='seotda'&&seotdaStarters(room).includes(seat)))return failure(cb,room.gameType==='seotda'?'방장 또는 직전 승자만 다음 판을 시작할 수 있습니다.':'방장만 시작할 수 있습니다.');
    const connected=room.players.map((p,i)=>p?.socketId?i:-1).filter(i=>i>=0),fixed=['gomoku','alkkagi'].includes(room.gameType)||room.matchMode==='team';
    if(fixed&&connected.length!==room.playerCount)return failure(cb,`${room.playerCount}명 모두 접속해야 시작할 수 있습니다.`);
    if(!fixed&&!(room.gameType==='seotda'&&room.seotdaRelay?.status==='playing')&&connected.length<2)return failure(cb,'접속 중인 참가자 2명 이상이면 바로 시작할 수 있습니다.');
    if((scActive(room)||room.sichuanStarting||room.kkungStarting||room.kkung?.status==='playing'||room.alkkagi?.status==='playing'||(room.game?.status==='playing'&&room.game.participants?.[seat]!==false&&!room.game.retired?.includes(seat)&&!room.game.placements?.some(p=>p.seat===seat))||room.poker?.status==='playing'||room.badugi?.status==='playing'||room.gomoku?.status==='playing'||room.seotda?.status==='playing'))return failure(cb,'이미 진행 중입니다.');
    if(room.gameType==='sichuan'){
      room.sichuanStarting=true;
      try{const e=await getSichuan();if(authorization(socket)?.room!==room||room.host!==seat)throw Error('방장 연결을 확인해 주세요.');
        if(room.sichuan?.recordError)throw Error('이전 경기 기록을 저장한 뒤 시작할 수 있습니다.');
        const players=room.players.map(p=>p?.socketId?p:null);if(players.filter(Boolean).length<2)throw Error('2명부터 시작할 수 있습니다.');
        if(players.some(p=>p&&!p.profileId))throw Error('참가자 모두 사천성 기록을 연결해야 합니다. 화면을 새로고침해 주세요.');
        const ids=players.filter(Boolean).map(p=>p.profileId);if(new Set(ids).size!==ids.length)throw Error('같은 사천성 기록으로 두 자리에 참가할 수 없습니다.');
        room.sichuan=e.createSichuan(players,{map:room.sichuanMap,mode:room.sichuanMode,gameNo:(room.sichuan?.gameNo||0)+1});room.sichuanTokens=room.players.map(p=>p?.token||null);reply(cb);broadcast(room);
      }catch(e){failure(cb,e.message);}finally{room.sichuanStarting=false;}return;
    }
    if(room.gameType==='kkung'){
      room.kkungStarting=true;
      try{const engine=await getKkungEngine();if(authorization(socket)?.room!==room||room.host!==seat||room.players.filter(p=>p?.socketId).length<2)return failure(cb,'참가자 연결을 확인해 주세요.');
        room.kkung=engine.createKkung(room.players,{gameNo:(room.kkung?.gameNo||0)+1});reply(cb);broadcast(room);
      }catch(e){console.error('Kkung start:',e.message);failure(cb,'쿵쿵따 실행 파일과 사전 파일을 확인해 주세요.');}finally{room.kkungStarting=false;}return;
    }
    if(room.gameType==='alkkagi'){const previous=room.alkkagi;room.alkkagi=createAlkkagi(room.players.map(p=>p.name),{gameNo:(previous?.gameNo||0)+1,opener:previous?.winner??(previous?1-previous.turn:0)});reply(cb);broadcast(room);return;}
    if(room.gameType==='gomoku'){
      const old=room.gomoku,samePlayers=room.gomokuTokens?.every((t,i)=>t===room.players[i]?.token);
      if(old&&samePlayers&&old.winner!==null&&old.nextBlack===null)return failure(cb,'직전 승자가 먼저 다음 대국의 흑백을 선택해야 합니다.');
      const opener=old&&samePlayers?(old.winner===null?1-old.opener:old.nextBlack):room.host;
      startGomokuRound(room,opener);reply(cb);broadcast(room);return;
    }
    if(room.gameType==='seotda'){
      try{
       const previous=room.seotda,continuing=room.seotdaRelay?.status==='playing',needsReset=seotdaNeedsReset(room);
       if(needsReset&&data.resetBalances!==true)return failure(cb,'보유칩 초기화로 새 릴레이를 시작하세요.');
       if(data.resetBalances===true&&!needsReset)return failure(cb,'지금은 보유칩을 초기화할 수 없습니다.');
       const names=room.players.map((p,i)=>p&&(continuing?room.seotdaRelay.participants?.[i]!==false:!!p.socketId)?p.name:'');
       const balances=room.wallets.map((n,i)=>names[i]?(needsReset?room.startingChips:n):0);
       const next=createSeotda(names,balances,{base:room.base,turnSeconds:room.turnSeconds,dealer:previous?(previous.dealer+1)%room.playerCount:seat,handNo:(previous?.handNo||0)+1,cards:room.seotdaCards,avatars:room.players.map(p=>p?.avatarId??0),bonusPot:room.seotdaRelay?.carry||0});
       if(!room.seotdaRelay||needsReset)room.seotdaRelay={id:randomUUID(),status:'playing',total:balances.reduce((a,b)=>a+b,0),participants:names.map(Boolean),firstHand:next.handNo,processedHand:0,nextAt:null,champion:null,carry:0,eliminated:[],retired:[]};else room.seotdaRelay.nextAt=null;
       room.seotdaRelay.carry=0;room.seotda=next;room.seotdaTokens=room.players.map(p=>p?.token||null);room.wallets=room.wallets.map((n,i)=>names[i]?balances[i]:n);reply(cb);broadcast(room);
      }catch(e){failure(cb,e.message)}return;
    }
    if(room.gameType==='poker'){
      try{const previous=room.poker,names=room.players.map(p=>p?.socketId?p.name:'');
       const needsReset=room.wallets.filter((n,i)=>names[i]&&n>=room.base).length<2;
       if(needsReset&&data.resetBalances!==true)return failure(cb,'시작 금액으로 초기화하여 새 경기를 시작하세요.');
       if(data.resetBalances===true&&!needsReset)return failure(cb,'현재는 보유금액을 초기화할 수 없습니다.');
       const balances=room.wallets.map((n,i)=>names[i]?(needsReset?room.startingChips:n):0);
       const next=createPoker(names,balances,{base:room.base,turnSeconds:15,dealer:previous?(previous.dealer+1)%room.playerCount:seat,handNo:(previous?.handNo||0)+1,rule:room.pokerRule});
       room.pokerTokens=room.players.map(p=>p?.token||null);room.pokerParticipants=names.map(Boolean);room.poker=next;room.wallets=balances;reply(cb);broadcast(room);
      }catch(e){failure(cb,e.message)}return;
    }
    if(room.gameType==='badugi'){
      try{const previous=room.badugi,names=room.players.map(p=>p?.socketId?p.name:'');room.badugiTokens=room.players.map(p=>p?.token||null);room.badugiParticipants=names.map(Boolean);room.badugi=createBadugi(names,room.wallets.map((n,i)=>names[i]?n:0),{base:room.base,turnSeconds:room.turnSeconds,dealer:previous?(previous.dealer+1)%room.playerCount:seat,handNo:(previous?.handNo||0)+1});reply(cb);broadcast(room);}catch(e){failure(cb,e.message)}return;
    }
    room.game=newGame(room.players,room.piecesPerPlayer,room.matchMode,room.turnSeconds);
    say(room,`${room.game.playerNames[room.game.turn]} 님부터 시작합니다.`);
    reply(cb);broadcast(room);
  });
  socket.on('game:resign',(data={},cb)=>{
    const a=authorization(socket);if(!a||a.room.gameType!=='yut')return failure(cb,'윷놀이 참가자만 기권할 수 있습니다.');
    const {room,seat}=a,g=room.game;
    if(!g||g.status!=='playing'||data?.gameId!==g.id||g.participants?.[seat]===false||g.retired?.includes(seat)||g.placements?.some(p=>p.seat===seat))return failure(cb,'현재 진행 중인 경기를 확인해 주세요.');
    if(g.mode==='team'){g.retired=room.players.map((p,i)=>p&&i%2===seat%2?i:-1).filter(i=>i>=0);g.winner=room.players.findIndex((p,i)=>p&&i%2!==seat%2);g.status='finished';g.moves=[];g.rollCredits=0;}
    else{removeYutPlayer(g,seat);if(g.status==='playing'&&g.turn===seat){g.moves=[];g.rollCredits=0;maybeNextTurn(g,activeSeats(room));}}
    say(room,`${room.players[seat].name} 님이 기권했습니다.${g.mode==='team'?' 상대 팀 승리!':''}`);
    if(g.status==='finished')recordWin(room);
    reply(cb);broadcast(room);if(g.status==='finished')io.to(room.code).emit('game:finished',{code:room.code,gameType:'yut',game:publicGame(g)});
  });
  socket.on('game:throw',(data={},cb)=>{data=data||{};
    const a=authorization(socket);if(!a)return failure(cb,'방에 참가해 주세요.');
    const {room,seat}=a,g=room.game;
    if(!g||g.status!=='playing')return failure(cb,'게임이 진행 중이 아닙니다.');
    if(g.turn!==seat)return failure(cb,'현재 본인 차례가 아닙니다.');
    if(g.rollCredits<1)return failure(cb,'먼저 윷 결과를 사용해 말을 이동하세요.');
    let result;try{result=throwWithPower(data?.power??50)}catch(e){return failure(cb,e.message)}
    g.rollCredits--;result.id=randomUUID();g.lastThrow=result;
    // 낙은 즉시 소멸. 빽도는 앞선 결과로 말이 출발할 수 있으므로 큐 맨 앞에 도달했을 때만 유효성을 판정합니다.
    const skipNak=result.steps===0;
    if(!skipNak)g.moves.push(result.steps);
    const discardedBackdos=discardUnplayableBackdos(g,seat);
    if(result.steps>=4)g.rollCredits++;resetClock(g);
    say(room,`${room.players[seat].name}: ${result.name} (${result.steps}칸)${result.steps>=4?' · 한 번 더!':''}${skipNak?' · 낙! 차례 소모':discardedBackdos?' · 이동할 말이 없어 빽도 소멸':''}`);
    if(maybeNextTurn(g,activeSeats(room)))say(room,`➡️ ${room.players[g.turn]?.name||'다음 참가자'} 님 차례입니다.`);
    reply(cb,{result});broadcast(room);io.to(room.code).emit('game:roll-effect',result);
  });
  socket.on('game:options',(data={},cb)=>{data=data||{};
    const a=authorization(socket);if(!a)return failure(cb,'방에 참가해 주세요.');
    const g=a.room.game;
    if(!g)return failure(cb,'게임이 시작되지 않았습니다.');
    const choices=legalMoves(g,a.seat,Number(data.pieceIndex),Number(data.moveIndex));
    reply(cb,{choices:choices.map(({id,node,label,action})=>({id,node,label,action}))});
  });
  socket.on('game:move',(data={},cb)=>{data=data||{};
    const a=authorization(socket);if(!a)return failure(cb,'방에 참가해 주세요.');
    const {room,seat}=a,g=room.game;
    if(!g)return failure(cb,'게임이 시작되지 않았습니다.');
    try{
      const moveIndex=Number(data.moveIndex),pieceIndex=Number(data.pieceIndex);
      const steps=g.moves[moveIndex];
      const outcome=movePiece(g,seat,pieceIndex,moveIndex,data.choiceId??'0');
      const discardedBackdos=discardUnplayableBackdos(g,seat);
      say(room,`${room.players[seat].name}: ${steps}칸 이동${outcome.group>1?` · ${outcome.group}개 업기`:''}${outcome.captured?` · 상대 말 ${outcome.captured}개 잡기! 추가 던지기 획득`:''}${discardedBackdos?' · 이동 가능한 말이 없어 남은 빽도 소멸':''}`);
      if(outcome.rank)say(room,`🏁 ${room.players[seat].name} 님 ${outcome.rank}등 완주!`);
      if(g.status==='finished'){say(room,g.mode==='team'?`🏆 ${seat%2===0?'청팀':'홍팀'} 승리!`:`🏆 순위 결정 완료 · ${g.playerNames[g.winner]} 님 1등!`);recordWin(room);}
      else if(maybeNextTurn(g,activeSeats(room)))say(room,`➡️ ${room.players[g.turn]?.name||'다음 참가자'} 님 차례입니다.`);
      if(g.status==='playing')resetClock(g);
      reply(cb,{outcome});broadcast(room);if(g.status==='finished')io.to(room.code).emit('game:finished',{code:room.code,gameType:'yut',game:publicGame(g)});
    }catch(e){failure(cb,e.message)}
  });
  socket.on('sichuan:profile',async(data={},cb)=>{
    const a=authorization(socket);if(!a||a.room.gameType!=='sichuan')return failure(cb,'사천성 참가자만 기록을 연결할 수 있습니다.');
    try{await getSichuan();if(authorization(socket)?.player!==a.player)throw Error('입장 상태가 바뀌었습니다.');
      if(scActive(a.room))throw Error('경기 중에는 기록을 변경할 수 없습니다.');
      const credential=data?.credential||a.player.profileCredential||null;
      const res=scStore.ensure(credential,a.player.name);a.player.profileId=res.profile.id;a.player.profileCredential=res.credential;socket.data.account={profileId:res.profile.id,profileCredential:res.credential};reply(cb,res);broadcast(a.room);
    }catch(e){failure(cb,e.message);}
  });
  socket.on('sichuan:settings',(data={},cb)=>{const a=authorization(socket);if(!a||a.room.gameType!=='sichuan'||a.seat!==a.room.host||scActive(a.room)||a.room.sichuanStarting)return failure(cb,'대기 중인 방장만 설정할 수 있습니다.');
    if(!['butterfly','heart','diamond','bridge','square','flower','random'].includes(data?.map)||!['first','relay'].includes(data?.mode))return failure(cb,'맵과 모드를 확인해 주세요.');
    a.room.sichuanMap=data.map;a.room.sichuanMode=data.mode;reply(cb);broadcast(a.room);
  });
  socket.on('sichuan:act',(data={},cb)=>{const a=authorization(socket);if(!a||a.room.gameType!=='sichuan'||a.room.sichuanTokens?.[a.seat]!==a.player.token)return failure(cb,'이번 경기 참가자만 조작할 수 있습니다.');
    const times=(socket.data.scAttempts||[]).filter(t=>Date.now()-t<1000);if(times.length>=14)return failure(cb,'조작이 너무 빠릅니다.');times.push(Date.now());socket.data.scAttempts=times;
    try{const out=scEngine.actSichuan(a.room.sichuan,a.seat,data);reply(cb,out);broadcast(a.room);}catch(e){failure(cb,e.message);broadcast(a.room);}
  });
  socket.on('sichuan:resign',(data={},cb)=>{const a=authorization(socket);if(!a||a.room.gameType!=='sichuan'||data?.gameId!==a.room.sichuan?.id||a.room.sichuanTokens?.[a.seat]!==a.player.token)return failure(cb,'현재 사천성 참가자만 기권할 수 있습니다.');try{scEngine.resignSichuan(a.room.sichuan,a.seat);reply(cb);broadcast(a.room);}catch(e){failure(cb,e.message);}});
  socket.on('sichuan:chat',(data={},cb)=>{const a=authorization(socket),w=spectatorAuthorization(socket),room=a?.room||w?.room,person=a?.player||w?.spectator;if(room?.gameType!=='sichuan')return failure(cb,'사천성 방에 입장해 주세요.');const text=typeof data?.text==='string'?data.text.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,140):'';if(!text)return failure(cb,'메시지를 입력하세요.');const times=(socket.data.scChats||[]).filter(t=>Date.now()-t<5000);if(times.length>=4)return failure(cb,'잠시 후 다시 보내 주세요.');times.push(Date.now());socket.data.scChats=times;room.sichuanChat.push({id:randomUUID(),name:person.name,text});if(room.sichuanChat.length>60)room.sichuanChat.shift();reply(cb);broadcast(room);});
  socket.on('kkung:submit',(data={},cb)=>{
    const a=authorization(socket);if(!a||a.room.gameType!=='kkung'||!a.room.kkung||!kkEngine)return failure(cb,'쿵쿵따 참가자만 제출할 수 있습니다.');
    const now=Date.now(),recent=(socket.data.kkungAttempts||[]).filter(t=>now-t<1000);if(recent.length>=8)return failure(cb,'잠시 후 다시 입력해 주세요.');recent.push(now);socket.data.kkungAttempts=recent;
    if(kkEngine.timeoutKkung(a.room.kkung,now)){broadcast(a.room);return failure(cb,'제한시간이 지났습니다.');}
    try{const outcome=kkEngine.submitKkung(a.room.kkung,a.seat,data,now);reply(cb,{outcome});broadcast(a.room)}catch(e){failure(cb,e.message)}
  });
  socket.on('kkung:resign',(data={},cb)=>{
    const a=authorization(socket);if(!a||a.room.gameType!=='kkung'||data?.gameId!==a.room.kkung?.id)return failure(cb,'현재 경기 참가자만 기권할 수 있습니다.');
    try{kkEngine.resignKkung(a.room.kkung,a.seat);reply(cb);broadcast(a.room)}catch(e){failure(cb,e.message)}
  });
  socket.on('kkung:chat',(data={},cb)=>{
    const a=authorization(socket),watch=spectatorAuthorization(socket),room=a?.room||watch?.room,person=a?.player||watch?.spectator;
    if(room?.gameType!=='kkung'||!person)return failure(cb,'쿵쿵따 방에서 대화할 수 있습니다.');
    const text=typeof data?.text==='string'?data.text.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,140):'';if(!text)return failure(cb,'메시지를 입력해 주세요.');
    const now=Date.now(),times=(socket.data.kkChatTimes||[]).filter(t=>now-t<5000);if(times.length>=3)return failure(cb,'메시지는 잠시 후 다시 보내 주세요.');times.push(now);socket.data.kkChatTimes=times;
    room.kkungChat.push({id:randomUUID(),name:person.name,text,at:now,watcher:!!watch});if(room.kkungChat.length>60)room.kkungChat.shift();reply(cb);broadcast(room);
  });
  socket.on('card:resign',(data={},cb)=>{
    const a=authorization(socket);if(!a||!['badugi','seotda','poker'].includes(a.room.gameType))return failure(cb,'현재 카드 게임 참가자만 기권할 수 있습니다.');
    const {room,seat}=a,type=room.gameType,g=room[type],relay=type==='seotda'&&room.seotdaRelay?.status==='playing'?room.seotdaRelay:null;
    if(!g||data?.gameType!==type||data?.handNo!==g.handNo||data?.revision!==g.revision||(type==='seotda'&&(data.replayNo??0)!==(g.replayNo??0)))return failure(cb,'현재 경기를 확인한 뒤 다시 기권해 주세요.');
    if(room[type+'Tokens']?.[seat]!==room.players[seat]?.token||room[type+'Participants']?.[seat]===false||!g.players[seat]?.name)return failure(cb,'이번 경기 참가자만 기권할 수 있습니다.');
    if(relay){if(relay.retired.includes(seat)||relay.eliminated.includes(seat))return failure(cb,'이미 기권하거나 탈락했습니다.');}
    else if(g.status!=='playing'||g.players[seat].folded)return failure(cb,'현재 진행 중인 판에서만 기권할 수 있습니다.');
    const revision=g.revision;
    if(relay){forfeitSeotdaRelay(relay,g,seat);room.wallets[seat]=0;}
    else if(type==='badugi')foldRemoved(g,seat);
    else if(type==='poker')removePoker(g,seat);
    else removeSeotda(g,seat);
    g.players[seat].lastAction='기권';if(g.revision===revision)g.revision++;
    reply(cb);broadcast(room);
  });
  socket.on('seotda:act',(data={},cb)=>{data=data||{};const a=authorization(socket);if(!a||a.room.gameType!=='seotda')return failure(cb,'섯다 참가자만 조작할 수 있습니다.');try{actSeotda(a.room.seotda,a.seat,data);reply(cb);broadcast(a.room);}catch(e){failure(cb,e.message)}});
  socket.on('alkkagi:shot',(data={},cb)=>{const a=authorization(socket);if(!a||a.room.gameType!=='alkkagi')return failure(cb,'장기알까기 참가자만 발사할 수 있습니다.');try{actAlkkagi(a.room.alkkagi,a.seat,data||{});reply(cb);broadcast(a.room);}catch(e){failure(cb,e.message)}});
  socket.on('alkkagi:resign',(data={},cb)=>{const a=authorization(socket);if(!a||a.room.gameType!=='alkkagi')return failure(cb,'장기알까기 참가자만 기권할 수 있습니다.');const g=a.room.alkkagi;if(!g||g.status!=='playing'||data?.gameNo!==g.gameNo||data?.revision!==g.revision)return failure(cb,'현재 경기를 확인하세요.');resignAlkkagi(g,a.seat);reply(cb);broadcast(a.room);});
  socket.on('poker:act',(data={},cb)=>{const a=authorization(socket);if(!a||a.room.gameType!=='poker')return failure(cb,'포커 참가자만 조작할 수 있습니다.');try{actPoker(a.room.poker,a.seat,data||{});reply(cb);broadcast(a.room);}catch(e){failure(cb,e.message)}});
  socket.on('badugi:act',(data={},cb)=>{data=data||{};
    const a=authorization(socket);if(!a||a.room.gameType!=='badugi')return failure(cb,'바둑이 참가자만 조작할 수 있습니다.');
    try{actBadugi(a.room.badugi,a.seat,data);reply(cb);broadcast(a.room);}catch(e){failure(cb,e.message)}
  });
  socket.on('gomoku:act',(data={},cb)=>{data=data||{};const a=authorization(socket);if(!a||a.room.gameType!=='gomoku')return failure(cb,'오목 대국자만 조작할 수 있습니다.');
    try{if(data.action==='chooseNextColor'&&!a.room.gomokuTokens?.every((t,i)=>t===a.room.players[i]?.token))throw Error('대국자가 변경되어 새 대국을 시작해야 합니다.');actGomoku(a.room.gomoku,a.seat,data);reply(cb);broadcast(a.room);}catch(e){failure(cb,e.message);broadcast(a.room);}
  });
  socket.on('rank:get',(_,cb)=>reply(cb,{rankings:rankList()}));
  socket.on('disconnect',()=>detach(socket));
});
// The server resolves expired turns, so disconnected players cannot block rooms forever.
// Waiting throws and moves are handled separately; no client can choose a timeout outcome.
setInterval(()=>{for(const room of rooms.values()){
 if(scActive(room)){if(scEngine?.tickSichuan(room.sichuan))broadcast(room);continue;}
 if(room.kkung?.status==='playing'){if(kkEngine?.timeoutKkung(room.kkung))broadcast(room);continue;}
 if(room.alkkagi?.status==='playing'){if(tickAlkkagi(room.alkkagi))broadcast(room);continue;}
 if(room.seotdaRelay?.status==='playing'&&room.seotda?.status==='finished'){broadcast(room);continue;}
 if(room.seotda?.status==='playing'){if(Date.now()>=room.seotda.deadline){timeoutSeotda(room.seotda);broadcast(room);}continue;}
 if(room.gomoku?.status==='playing'){if(tickGomoku(room.gomoku))broadcast(room);continue;}
 if(room.poker?.status==='playing'){if(Date.now()>=room.poker.deadline){timeoutPoker(room.poker);broadcast(room);}continue;}
 if(room.badugi?.status==='playing'){if(Date.now()>=room.badugi.deadline){timeoutBadugi(room.badugi);broadcast(room);}continue;}
 const g=room.game;if(g?.status!=='playing'||Date.now()<g.turnDeadline)continue;
 const seat=g.turn;let activity='';
 if(!room.players[seat]){g.moves=[];g.rollCredits=0;maybeNextTurn(g,activeSeats(room));say(room,'비어 있는 자리의 차례를 자동으로 넘겼습니다.');broadcast(room);continue;}
 if(g.moves.length){
  const discardedBackdos=discardUnplayableBackdos(g,seat);if(discardedBackdos)activity='이동 가능한 말이 없어 빽도 소멸';
  // Pick a stable first legal move. An unplayable saved back-do can be discarded.
  let moved=false;
  outer:for(let m=0;m<g.moves.length;m++)for(let p=0;p<g.piecesPerPlayer;p++){
   const opts=legalMoves(g,seat,p,m);if(opts.length){movePiece(g,seat,p,m,opts[0].id);const dropped=discardUnplayableBackdos(g,seat);moved=true;activity=dropped?'자동 말 이동 · 빽도 소멸':'자동 말 이동';break outer;}
  }
  if(!moved){g.moves.shift();activity='이동할 말이 없어 결과 소멸';}
 } else if(g.rollCredits>0){
  // Automatically throw once rather than granting user-controlled outcomes.
  const result=throwYut();g.rollCredits--;result.id=randomUUID();g.lastThrow=result;
  const allowed=result.steps!==-1||g.pieces[seat].some((p,i)=>legalMoves({...g,moves:[-1]},seat,i,0).length);
  if(allowed)g.moves.push(result.steps);
  if(result.steps>=4)g.rollCredits++;
  activity=`자동 윷 던지기: ${result.name}`;io.to(room.code).emit('game:roll-effect',result);
 }
 say(room,`${room.players[seat]?.name||'플레이어'} · 시간 초과 · ${activity}`);
 if(g.status==='finished'){recordWin(room)}
 else if(maybeNextTurn(g,activeSeats(room)))say(room,`➡️ ${room.players[g.turn]?.name||'다음 참가자'} 차례`);
 resetClock(g);broadcast(room);
}},1000).unref();
// Empty lobbies and finished rooms expire after a day; active games are left intact in memory.
setInterval(()=>{const now=Date.now();for(const [id,room] of rooms){
  if(now-room.createdAt>24*3600_000 && room.players.every(p=>!p?.socketId) && (room.spectators||[]).every(p=>!p.socketId))rooms.delete(id);
}broadcastLobby();},3600_000).unref();
await restoreRooms();
// Keep a recent clock checkpoint even when nobody clicks. Private recovery files have no HTTP route.
setInterval(()=>{if(rooms.size)checkpointRooms(true);},1000).unref();
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{flushRooms();io.close();server.close();process.exit(0);});
server.listen(PORT,'0.0.0.0',()=>console.log(`HODON ${SERVER_VERSION}: http://localhost:${PORT}`));
