import {randomInt,randomUUID,randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
export const ROWS=10,COLS=16,ROUND_MS=180000;
export const MAPS=Object.freeze([{id:'butterfly',name:'나비 정원'},{id:'heart',name:'하트 정원'},{id:'diamond',name:'다이아'},{id:'bridge',name:'구름 다리'},{id:'square',name:'사각 정원'},{id:'flower',name:'꽃잎 정원'}]);
export const TIERS=Object.freeze([{xp:0,name:'초보'},{xp:40,name:'중수 동'},{xp:100,name:'중수 은'},{xp:180,name:'중수 금'},{xp:280,name:'고수 동'},{xp:400,name:'고수 은'},{xp:540,name:'고수 금'},{xp:700,name:'개고수 동'},{xp:880,name:'개고수 은'},{xp:1080,name:'개고수 금'},{xp:1300,name:'신 동'},{xp:1540,name:'신 은'},{xp:1800,name:'신 금'}]);
const mix=(arr,rand=randomInt)=>{for(let i=arr.length-1;i>0;i--){const j=rand(i+1);[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;};
export function maskFor(map='butterfly'){
 if(!MAPS.some(m=>m.id===map))throw Error('맵을 확인해 주세요.');
 const cells=[];const wing=[[1,4,11,14],[0,5,10,15],[0,6,9,15],[1,6,9,14],[2,5,10,13],[2,5,10,13],[1,6,9,14],[0,6,9,15],[0,5,10,15],[1,4,11,14]];
 for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
 let yes=false;
 if(map==='butterfly'){const [a,b,c,d]=wing[y];yes=x>=a&&x<=b||x>=c&&x<=d;}
 if(map==='heart'){const widths=[4,6,8,8,7,6,5,4,3,1],half=widths[y];yes=Math.abs(x-7.5)<half;if(y<2&&x>=6&&x<=9)yes=false;}
 if(map==='diamond')yes=Math.abs(x-7.5)/1.6+Math.abs(y-4.5)<5;
 if(map==='square')yes=x>=1&&x<=14&&y>=1&&y<=8;
 if(map==='bridge')yes=(x<=4||x>=11)&&y>=1&&y<=8||(y===4||y===5)&&x>=5&&x<=10;
 if(map==='flower')yes=((x-4)**2+(y-2)**2<13)||((x-11)**2+(y-2)**2<13)||((x-4)**2+(y-7)**2<13)||((x-11)**2+(y-7)**2<13);
 if(yes)cells.push(y*COLS+x);
 }
 if(cells.length%2)cells.pop();return cells;
}
const point=i=>({x:i%COLS+1,y:Math.floor(i/COLS)+1});
// Search a one-cell outside border as well as the board, with at most two bends.
export function connection(board,a,b){
 if(!Array.isArray(board)||board.length!==ROWS*COLS||!Number.isInteger(a)||!Number.isInteger(b)||a===b||a<0||b<0||a>=board.length||b>=board.length||board[a]==null||board[b]==null)return null;
 const A=point(a),B=point(b),dirs=[[1,0],[0,1],[-1,0],[0,-1]],q=[],seen=new Map();
 const empty=(x,y)=>x>=0&&x<=COLS+1&&y>=0&&y<=ROWS+1&&(x===B.x&&y===B.y||x===0||y===0||x===COLS+1||y===ROWS+1||board[(y-1)*COLS+x-1]==null);
 for(let d=0;d<4;d++)q.push({x:A.x,y:A.y,d,turns:0,path:[A]});
 for(let n=0;n<q.length;n++){
 const cur=q[n];for(let d=0;d<4;d++){
 const turns=cur.turns+(d!==cur.d?1:0);if(turns>2)continue;
 const x=cur.x+dirs[d][0],y=cur.y+dirs[d][1];if(!empty(x,y)||x===A.x&&y===A.y)continue;
 const path=d===cur.d?[...cur.path.slice(0,-1),{x,y}]:[...cur.path,{x,y}];
 // Preserve the initial point when extending the first segment.
 const full=cur.path.length===1?[A,{x,y}]:path;
 if(x===B.x&&y===B.y)return full;
 const key=x+','+y+','+d;if((seen.get(key)??3)<=turns)continue;seen.set(key,turns);q.push({x,y,d,turns,path:full});
 }}return null;
}
export function availablePairs(board,limit=Infinity){const groups=new Map(),out=[];board.forEach((v,i)=>{if(v!=null){if(!groups.has(v))groups.set(v,[]);groups.get(v).push(i);}});for(const ids of groups.values())for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++){const path=connection(board,ids[a],ids[b]);if(path){out.push({a:ids[a],b:ids[b],path});if(out.length>=limit)return out;}}return out;}
export function shuffleBoard(board,rand=randomInt){
 const ids=board.flatMap((v,i)=>v==null?[]:[i]),values=ids.map(i=>board[i]);if(ids.length<2)return board;
 for(let trial=0;trial<12;trial++){mix(values,rand);ids.forEach((id,i)=>board[id]=values[i]);if(availablePairs(board,1).length)return board;}
 // A random shuffle may still be dead. Force an existing pair into connectable positions.
 let pair=null;for(let a=0;a<ids.length&&!pair;a++)for(let b=a+1;b<ids.length;b++)if(connection(board,ids[a],ids[b])){pair=[ids[a],ids[b]];break;}
 if(!pair)throw Error('연결 가능한 배치를 만들 수 없습니다.');
 const [a,b]=pair,duplicate=ids.find(i=>i!==a&&board[i]===board[a]);if(duplicate===undefined)throw Error('짝이 맞지 않는 판입니다.');[board[b],board[duplicate]]=[board[duplicate],board[b]];return board;
}
export function createBoard(map,rand=randomInt){const board=Array(ROWS*COLS).fill(null),ids=maskFor(map),values=[];for(let i=0;i<ids.length/2;i++)values.push(i%16,i%16);mix(values,rand);ids.forEach((id,i)=>board[id]=values[i]);if(!availablePairs(board,1).length)shuffleBoard(board,rand);return board;}
const remain=p=>p.board.reduce((n,v)=>n+(v!=null),0);
function event(g,type,seat,details={}){const e={seq:++g.seq,type,seat,at:Date.now(),...details};g.events.push(e);if(g.events.length>32)g.events.shift();return e;}
export function createSichuan(players,{map='butterfly',mode='relay',now=Date.now(),gameNo=1}={}){
 if(!Array.isArray(players)||players.length<2||players.length>10||players.filter(Boolean).length<2)throw Error('사천성은 2~10명이 필요합니다.');
 if(!['first','relay'].includes(mode))throw Error('경기 방식을 확인해 주세요.');if(map==='random')map=MAPS[randomInt(MAPS.length)].id;
 const board=createBoard(map),total=board.filter(v=>v!=null).length;
 const g={id:randomUUID(),gameNo,status:'countdown',map,mode,total,startsAt:now+3000,deadline:now+3000+ROUND_MS,turnSeconds:180,seq:0,events:[],winner:null,placements:[],awarded:false,players:players.map(p=>p?{name:p.name,avatarId:p.avatarId??0,profileId:p.profileId||null,board:[...board],revision:0,items:{hint:2,shuffle:2},cleared:0,combo:0,lastMatch:0,score:0,status:'playing',rank:null,remaining:total}:null)};event(g,'countdown',null);return g;
}
function closeRace(g,reason,now){
 const active=g.players.flatMap((p,i)=>p&&p.rank===null?[i]:[]).sort((a,b)=>(g.players[a].status==='retired')-(g.players[b].status==='retired')||(g.players[a].status==='retired'?(g.players[b].retiredOrder||0)-(g.players[a].retiredOrder||0):0)||remain(g.players[a])-remain(g.players[b])||g.players[b].score-g.players[a].score||a-b);
 for(const seat of active){const p=g.players[seat];p.rank=g.placements.length+1;g.placements.push({seat,rank:p.rank,remaining:remain(p),completed:false,retired:p.status==='retired'});if(p.status!=='retired')p.status='ranked';}
 if(g.winner===null)g.winner=g.placements.find(p=>!p.retired)?.seat??null;
 g.status='finished';g.reason=reason;g.finishedAt=now;event(g,'finish',g.winner,{reason});
}
export function tickSichuan(g,now=Date.now()){
 if(!g||g.status==='finished')return false;
 if(now>=g.deadline){closeRace(g,'제한시간 종료',now);return true;}
 if(g.status==='countdown'&&now>=g.startsAt){g.status='playing';event(g,'start',null);return true;}return false;
}
export function actSichuan(g,seat,data={},now=Date.now(),rand=randomInt){
 tickSichuan(g,now);const p=g?.players?.[seat];
 if(!g||data.gameId!==g.id||!Number.isInteger(seat)||!p||g.status!=='playing'||p.status!=='playing'||p.rank!==null)throw Error('진행 중인 경기 참가자만 조작할 수 있습니다.');
 if(data.revision!==p.revision)throw Error('판이 바뀌었습니다. 현재 패를 다시 선택해 주세요.');
 const type=data.action;if(!['match','hint','shuffle'].includes(type))throw Error('조작을 확인해 주세요.');
 if(type==='hint'){if(p.items.hint<=0)throw Error('힌트 아이템이 없습니다.');const pair=availablePairs(p.board,1)[0];if(!pair)throw Error('자동 섞기 후 다시 시도해 주세요.');p.items.hint--;p.revision++;event(g,'hint',seat,{pair,revision:p.revision});return {pair};}
 if(type==='shuffle'){if(p.items.shuffle<=0)throw Error('섞기 아이템이 없습니다.');shuffleBoard(p.board,rand);p.items.shuffle--;p.combo=0;p.revision++;event(g,'shuffle',seat,{revision:p.revision});return {};}
 const {a,b}=data;if(!Number.isInteger(a)||!Number.isInteger(b)||p.board[a]==null||p.board[a]!==p.board[b])throw Error('같은 그림의 패 두 개를 선택해 주세요.');
 const path=connection(p.board,a,b);if(!path)throw Error('두 번 이하로 꺾어서 연결할 수 없습니다.');
 const picture=p.board[a];p.board[a]=p.board[b]=null;p.cleared+=2;p.remaining-=2;p.combo=now-p.lastMatch<=4000?p.combo+1:1;p.lastMatch=now;p.score+=100+Math.min(10,p.combo)*20;p.revision++;
 let drop=null;if(rand(100)<14){drop=rand(2)===0?'hint':'shuffle';if(p.items[drop]<99)p.items[drop]++;else drop=null;}
 event(g,'match',seat,{a,b,path,picture,combo:p.combo,drop,revision:p.revision});
 if(!p.remaining){p.status='finished';p.rank=g.placements.length+1;g.placements.push({seat,rank:p.rank,remaining:0,completed:true,retired:false});if(g.winner===null)g.winner=seat;event(g,'complete',seat,{rank:p.rank});
 if(g.mode==='first'){closeRace(g,'첫 완주자 탄생',now);return {};}
 const active=g.players.filter(q=>q&&q.status==='playing');if(active.length<=1){closeRace(g,'최종 순위 확정',now);return {};}
 }else if(!availablePairs(p.board,1).length){shuffleBoard(p.board,rand);event(g,'autoShuffle',seat,{revision:p.revision});}
 return {};
}
export function resignSichuan(g,seat,now=Date.now()){
 if(!g||!['countdown','playing'].includes(g.status)||!Number.isInteger(seat)||!g.players[seat]||g.players[seat].rank!==null||g.players[seat].status!=='playing')throw Error('현재 경기 참가자만 기권할 수 있습니다.');
 const p=g.players[seat];p.status='retired';p.retiredOrder=g.seq+1;p.revision++;event(g,'resign',seat);
 const active=g.players.flatMap((q,i)=>q&&q.status==='playing'?[i]:[]);
 if(active.length<=1){if(g.winner===null&&active.length){g.winner=active[0];const win=g.players[g.winner];win.status='ranked';win.rank=g.placements.length+1;g.placements.push({seat:g.winner,rank:win.rank,remaining:remain(win),completed:false,retired:false});}closeRace(g,'기권으로 경기 종료',now);}
}
export function publicSichuan(g,viewer=null){
 if(!g)return null;const current=Number.isInteger(viewer)&&g.players[viewer]?viewer:g.players.findIndex(p=>p&&p.status==='playing');
 return {id:g.id,gameNo:g.gameNo,status:g.status,map:g.map,mode:g.mode,total:g.total,startsAt:g.startsAt,deadline:g.deadline,turnSeconds:g.turnSeconds,seq:g.seq,winner:g.winner,placements:g.placements.map(p=>({...p})),reason:g.reason,rewards:g.rewards||{},events:g.events.map(e=>({...e})),boardSeat:current,players:g.players.map((p,i)=>p?{name:p.name,avatarId:p.avatarId,revision:p.revision,items:i===viewer?{...p.items}:null,cleared:p.cleared,combo:p.combo,score:p.score,status:p.status,rank:p.rank,remaining:p.remaining,board:i===current?[...p.board]:null}:null)};
}
// Profiles use an unguessable recovery credential; room nicknames are not account identifiers.
const hash=s=>createHash('sha256').update(s).digest('hex');
export function createProfileStore(directory){
 mkdirSync(directory,{recursive:true});const file=join(directory,'sichuan-profiles.state');let data={version:1,profiles:{}};
 try{let source;try{source=readFileSync(file,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;source=readFileSync(join(directory,'sichuan-profiles.json'),'utf8');}data=JSON.parse(source);if(data.version!==1||!data.profiles)throw Error('unsupported profile schema');}catch(e){if(e.code!=='ENOENT')throw Error('사천성 기록 파일을 읽지 못했습니다: '+e.message);}
 const checkpoint=()=>{writeFileSync(file+'.tmp',JSON.stringify(data),{mode:0o600});renameSync(file+'.tmp',file);};
 const gameTypes=['yut','badugi','gomoku','seotda','poker','alkkagi','kkung','sichuan','tetris'];
 const stats=(p,type)=>type==='sichuan'?p:{...p,xp:0,played:0,wins:0,...p.byGame?.[type]};
 const leader=()=>Object.values(data.profiles).filter(p=>p.xp>=2200).sort((a,b)=>b.xp-a.xp||a.createdAt-b.createdAt||a.id.localeCompare(b.id))[0]?.id??null;
 const publicRow=(p,type='sichuan')=>{
  const row=stats(p,type),best=Object.values(data.profiles).filter(q=>stats(q,type).xp>=2200).sort((a,b)=>stats(b,type).xp-stats(a,type).xp||a.createdAt-b.createdAt||a.id.localeCompare(b.id))[0];
  let tier=TIERS[0],next=TIERS[1];for(let i=0;i<TIERS.length;i++)if(row.xp>=TIERS[i].xp){tier=TIERS[i];next=TIERS[i+1]||{xp:2200};}
  const god=best?.id===p.id;return{id:p.id,name:p.name,gameType:type,xp:row.xp,level:1+Math.floor(row.xp/80),played:row.played,wins:row.wins,winRate:row.played?Math.round(row.wins/row.played*100):0,tier:god?'갓':tier.name,god,nextXp:god?null:Math.max(next.xp,tier.name==='신 금'?Math.max(2200,(best?stats(best,type).xp:0)+1):0),tierXp:tier.xp};
 };
 const authenticate=credential=>{if(typeof credential!=='string'||!/^sc_[a-f0-9]{24}\.[a-f0-9]{48}$/.test(credential))throw Error('복구 코드를 확인해 주세요.');const [id,secret]=credential.split('.'),p=data.profiles[id],provided=hash(secret);if(!p||!timingSafeEqual(Buffer.from(p.secretHash,'hex'),Buffer.from(provided,'hex')))throw Error('일치하는 게임 기록이 없습니다.');return p;};
 return {ensure(credential,name){let p,created=false;if(credential)p=authenticate(credential);else{created=true;const id='sc_'+randomBytes(12).toString('hex'),secret=randomBytes(24).toString('hex');credential=id+'.'+secret;p={id,secretHash:hash(secret),name,xp:0,played:0,wins:0,createdAt:Date.now(),games:[]};data.profiles[id]=p;}p.name=String(name||p.name).slice(0,14);checkpoint();return {credential,created,profile:publicRow(p)};},records(id){const p=data.profiles[id];return p?Object.fromEntries(gameTypes.map(t=>[t,publicRow(p,t)])):null;},awardGame(type,id,roster,winners){if(!gameTypes.includes(type)||type==='sichuan')throw Error('invalid game');const count=roster.filter(Boolean).length,seen=new Set();for(const [seat,r]of roster.entries()){const p=data.profiles[r?.profileId];if(!p||seen.has(p.id))continue;seen.add(p.id);p.byGame??={};const row=p.byGame[type]??={xp:0,played:0,wins:0,games:[]};if(row.games.includes(id))continue;row.played++;const won=roster.some((q,i)=>q?.profileId===p.id&&winners.includes(i));if(won)row.wins++;row.xp+=30+count*15+(won?count*12:0);row.games.push(id);if(row.games.length>1000)row.games.shift();}checkpoint();},row(id,type='sichuan'){return data.profiles[id]?publicRow(data.profiles[id],type):null;},leaders(){return Object.values(data.profiles).sort((a,b)=>b.xp-a.xp||a.createdAt-b.createdAt||a.id.localeCompare(b.id)).slice(0,50).map(p=>publicRow(p));},award(g){if(g.status!=='finished'||g.awarded)return;const count=g.players.filter(Boolean).length;g.rewards??={};for(const [seat,p]of g.players.entries()){if(!p?.profileId)continue;const row=data.profiles[p.profileId];if(!row||row.games.includes(g.id))continue;const place=g.placements.find(q=>q.seat===seat);const gain=p.status==='retired'?Math.min(20,p.cleared):30+count*15+Math.max(0,count-(place?.rank||count))*12+Math.min(80,Math.floor(p.cleared/2));g.rewards[seat]=gain;row.xp+=gain;row.played++;if(seat===g.winner)row.wins++;row.games.push(g.id);if(row.games.length>1000)row.games.shift();}checkpoint();g.awarded=true;},file};
}
