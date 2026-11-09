import {randomInt} from 'node:crypto';
export const rank=c=>c%13+1,suit=c=>Math.floor(c/13);
export function evaluate(hand){
 let best=null;
 for(let mask=1;mask<16;mask++){
  const cards=hand.filter((_,i)=>mask>>i&1),r=cards.map(rank),s=cards.map(suit);
  if(new Set(r).size!==r.length||new Set(s).size!==s.length)continue;
  const value=[-cards.length,...r.sort((a,b)=>b-a)];
  if(!best||compare(value,best.value)<0)best={value,cards};
 }
 const size=-best.value[0],top=best.value[1],names=['','원베이스','투베이스','베이스','메이드'];
 return {...best,label:`${['','A','2','3','4','5','6','7','8','9','10','J','Q','K'][top]} ${names[size]}`};
}
export function compare(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){const d=(a[i]||0)-(b[i]||0);if(d)return d;}return 0;}
function shuffle(cards){for(let i=cards.length-1;i>0;i--){const j=randomInt(i+1);[cards[i],cards[j]]=[cards[j],cards[i]];}return cards;}
function live(g){return g.players.map((p,i)=>!p.folded?i:-1).filter(i=>i>=0);}
function movable(g){return live(g).filter(i=>g.players[i].chips>0);}
function ordered(g,ids,after=g.dealer){return [...ids].sort((a,b)=>(a-after-1+g.players.length)%g.players.length-(b-after-1+g.players.length)%g.players.length);}
function log(g,text){g.log.push(text);g.log=g.log.slice(-30);}
function touch(g){g.revision++;g.deadline=Date.now()+g.turnSeconds*1000;}
function pay(g,i,amount,round=true){const p=g.players[i];const n=Math.min(amount,p.chips);p.chips-=n;p.total+=n;if(round)p.bet+=n;g.pot+=n;return n;}
function draw(g,n){if(g.deck.length<n){g.deck.push(...shuffle(g.discard.splice(0)));}if(g.deck.length<n)throw Error('카드가 부족합니다.');return g.deck.splice(-n,n);}
export function createBadugi(names,balances,{base=100,turnSeconds=45,dealer=0,handNo=1}={}){
 const g={status:'playing',phase:'bet',round:0,base,turnSeconds,dealer,handNo,revision:0,deadline:0,turn:null,pot:0,current:0,lastRaise:base,raises:0,pending:[],raiseAllowed:[],deck:shuffle(Array.from({length:52},(_,i)=>i)),discard:[],log:[],showdown:false,payouts:[],players:names.map((name,i)=>({name,chips:balances[i],hand:[],folded:!name||balances[i]===0,bet:0,total:0,lastAction:'대기 중',draws:[],cardVersions:[0,0,0,0]}))};
 if(live(g).length<2)throw Error('칩이 있는 참가자 2명 이상이 필요합니다.');
 for(const i of live(g)){g.players[i].hand=draw(g,4);pay(g,i,base,false);}
 log(g,`${handNo}번째 판 · 기본 판돈 ${base.toLocaleString()} · 카드 배분`);beginBet(g);return g;
}
function beginBet(g){g.phase='bet';g.current=0;g.lastRaise=g.base;g.raises=0;g.players.forEach(p=>p.bet=0);g.pending=ordered(g,movable(g));g.raiseAllowed=[...g.pending];if(g.pending.length<=1){g.pending=[];finishBet(g);}else{g.turn=g.pending[0];touch(g);}}
function beginDraw(g){g.phase='draw';g.pending=ordered(g,live(g));g.turn=g.pending[0];log(g,`${['아침','점심','저녁'][g.round]} 카드 교환`);touch(g);}
function finishBet(g){if(live(g).length===1){settle(g);return;}if(g.round===3){settle(g,true);return;}beginDraw(g);}
export function settle(g,showdown=false){
 if(g.status==='finished')return;
 const alive=live(g);g.showdown=showdown;g.payouts=Array(g.players.length).fill(0);g.potBefore=g.pot;g.pots=[];
 if(alive.length===1){g.payouts[alive[0]]=g.pot;g.pots.push({amount:g.pot,winners:[alive[0]]});}
 else{
  let prev=0;const levels=[...new Set(g.players.map(p=>p.total).filter(Boolean))].sort((a,b)=>a-b);
  for(const level of levels){
   const contributors=g.players.map((p,i)=>p.total>=level?i:-1).filter(i=>i>=0),amount=(level-prev)*contributors.length;prev=level;
   const eligible=contributors.filter(i=>!g.players[i].folded);
   if(!eligible.length){for(const i of contributors)g.payouts[i]+=amount/contributors.length;continue;}
   let winners=[];for(const i of eligible){const v=evaluate(g.players[i].hand).value;if(!winners.length||compare(v,evaluate(g.players[winners[0]].hand).value)<0)winners=[i];else if(compare(v,evaluate(g.players[winners[0]].hand).value)===0)winners.push(i);}
   winners=ordered(g,winners);const each=Math.floor(amount/winners.length),extra=amount%winners.length;winners.forEach((i,j)=>g.payouts[i]+=each+(j<extra?1:0));g.pots.push({amount,winners});
  }
 }
 g.payouts.forEach((v,i)=>g.players[i].chips+=v);g.pot=0;g.status='finished';g.phase='result';g.turn=null;g.pending=[];touch(g);
 log(g,'결과 · '+g.payouts.map((v,i)=>v?`${g.players[i].name} +${v.toLocaleString()}`:'').filter(Boolean).join(' / '));
}
export function actions(g,i){
 if(g.status!=='playing'||g.phase!=='bet'||g.turn!==i)return {};
 const p=g.players[i],call=Math.max(0,g.current-p.bet),canRaise=g.raises<4&&g.raiseAllowed.includes(i);
 const half=g.current+Math.max(g.lastRaise,g.base,Math.floor((g.pot+call)/2)),double=Math.max(g.current*2,g.current+g.lastRaise,g.base);
 return {fold:true,check:call===0,call:call>0,callAmount:Math.min(call,p.chips),half:canRaise&&half-p.bet<=p.chips&&half>g.current,halfTarget:half,double:canRaise&&double-p.bet<=p.chips&&double>g.current,doubleTarget:double,allin:p.chips>0&&(p.bet+p.chips<=g.current||canRaise)};
}
export function actBadugi(g,i,data){
 if(g.status!=='playing'||g.turn!==i||g.players[i]?.folded)throw Error('현재 본인 차례가 아닙니다.');
 if(!Number.isInteger(data.revision)||data.revision!==g.revision)throw Error('화면이 갱신되었습니다. 현재 차례를 다시 확인해 주세요.');
 const p=g.players[i];
 if(g.phase==='draw'){
  const indices=data.indices;
  if(!Array.isArray(indices)||indices.length>4||new Set(indices).size!==indices.length||indices.some(n=>!Number.isInteger(n)||n<0||n>3))throw Error('교환할 카드 0~4장을 선택하세요.');
  // Draw before discarding to prevent immediately redrawing this exchange's own discards.
  const incoming=draw(g,indices.length),old=indices.map(n=>p.hand[n]);indices.forEach((n,j)=>{p.hand[n]=incoming[j];p.cardVersions[n]++;});g.discard.push(...old);p.draws.push(indices.length);p.lastAction=indices.length?`${indices.length}장 교환`:'패스';log(g,`${p.name} · ${p.lastAction}`);
  g.pending=g.pending.filter(n=>n!==i);if(g.pending.length){g.turn=g.pending[0];touch(g);}else{g.round++;beginBet(g);}return;
 }
 const allowed=actions(g,i),action=data.action;if(!['fold','check','call','half','double','allin'].includes(action)||!allowed[action])throw Error('현재 사용할 수 없는 베팅입니다.');
 g.pending=g.pending.filter(n=>n!==i);g.raiseAllowed=g.raiseAllowed.filter(n=>n!==i);
 if(action==='fold'){p.folded=true;p.lastAction='다이';}
 else{
  const target=action==='half'?allowed.halfTarget:action==='double'?allowed.doubleTarget:action==='allin'?p.bet+p.chips:action==='call'?g.current:p.bet;
  pay(g,i,Math.max(0,target-p.bet));
  if(p.bet>g.current){const increment=p.bet-g.current,full=increment>=g.lastRaise;g.current=p.bet;
   if(full){g.lastRaise=increment;g.raises++;g.pending=ordered(g,movable(g).filter(n=>n!==i),i);g.raiseAllowed=[...g.pending];}
   else{g.pending=ordered(g,[...new Set([...g.pending,...movable(g).filter(n=>n!==i&&g.players[n].bet<g.current)])],i);}
  }
  p.lastAction={check:'체크',call:'콜',half:'하프',double:'따당',allin:'올인'}[action];
 }
 log(g,`${p.name} · ${p.lastAction}${p.bet?' '+p.bet.toLocaleString():''}`);
 if(live(g).length===1){settle(g);return;}
 g.pending=g.pending.filter(n=>!g.players[n].folded&&g.players[n].chips>0);
 // A sole player with chips need not bet into already all-in opponents once matched.
 if(movable(g).length===1&&g.pending.length===1&&g.players[g.pending[0]].bet>=g.current)g.pending=[];
 if(g.pending.length){g.turn=g.pending[0];touch(g);}else finishBet(g);
}
export function foldRemoved(g,i){
 if(!g||g.status!=='playing'||g.players[i].folded)return;
 g.players[i].folded=true;g.players[i].lastAction='자리 비움';g.pending=g.pending.filter(n=>n!==i);g.raiseAllowed=g.raiseAllowed.filter(n=>n!==i);
 if(live(g).length<=1){settle(g);return;}
 if(g.turn===i){if(g.pending.length){g.turn=g.pending[0];touch(g);}else if(g.phase==='draw'){g.round++;beginBet(g);}else finishBet(g);}
}
export function timeoutBadugi(g){if(g.status!=='playing')return;actBadugi(g,g.turn,g.phase==='draw'?{indices:[],revision:g.revision}:{action:actions(g,g.turn).check?'check':'fold',revision:g.revision});}
export function publicBadugi(g,viewer=null){
 if(!g)return null;
 return {status:g.status,phase:g.phase,round:g.round,base:g.base,dealer:g.dealer,handNo:g.handNo,revision:g.revision,deadline:g.deadline,turn:g.turn,pot:g.pot,potBefore:g.potBefore||0,showdown:g.showdown,payouts:[...g.payouts],pots:g.pots||[],log:g.log.slice(-12),actions:actions(g,viewer),players:g.players.map((p,i)=>({name:p.name,chips:p.chips,folded:p.folded,bet:p.bet,total:p.total,lastAction:p.lastAction,draws:[...p.draws],cardVersions:[...p.cardVersions],hand:(viewer===i||(g.showdown&&!p.folded))?[...p.hand]:p.hand.map(()=>null),label:(viewer===i||(g.showdown&&!p.folded))&&p.hand.length?evaluate(p.hand).label:null}))};
}
