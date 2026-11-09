import {randomInt} from 'node:crypto';
export const month=c=>Math.floor(c/2)+1;
export const isGwang=c=>c%2===0&&[1,3,8].includes(month(c));
export const isAnimal=c=>c%2===0&&[2,4,5,6,7,9,10].includes(month(c));
export function evaluatePair(cards){
 if(!Array.isArray(cards)||cards.length!==2||new Set(cards).size!==2||cards.some(c=>!Number.isInteger(c)||c<0||c>19))throw Error('서로 다른 화투 2장이 필요합니다.');
 const [a,b]=cards.slice().sort((x,y)=>month(x)-month(y)),x=month(a),y=month(b),key=x+','+y;
 let value=600+(x+y)%10,label=(x+y)%10?`${(x+y)%10}끗`:'망통',special=null;
 if(isGwang(a)&&isGwang(b)){value=key==='3,8'?1000:900;label=key==='3,8'?'삼팔광땡':`${x}${y}광땡`;}
 else if(x===y){value=800+x;label=x===10?'장땡':`${x}땡`;}
 else {const named={'1,2':['알리',700],'1,4':['독사',690],'1,9':['구삥',680],'1,10':['장삥',670],'4,10':['장사',660],'4,6':['세륙',650]};if(named[key])[label,value]=named[key];else if((x+y)%10===9)label='갑오';}
 if(key==='3,7'&&isGwang(a)&&isAnimal(b))special='땡잡이';
 if(key==='4,7'&&isAnimal(a)&&isAnimal(b))special='암행어사';
 if(key==='4,9')special=isAnimal(a)&&isAnimal(b)?'멍텅구리 구사':'구사';
 return {cards:[...cards],value,label,special};
}
export function resolveHands(hands){
 const ranks=hands.map(evaluatePair),hasDdang=ranks.some(r=>r.value>=801&&r.value<=809),hasGwang=ranks.some(r=>r.value===900);
 const values=ranks.map(r=>r.special==='땡잡이'&&hasDdang?809.5:r.special==='암행어사'&&hasGwang?950:r.value);
 const reasons=[];
 ranks.forEach((r,i)=>{const otherMax=Math.max(...values.filter((_,j)=>j!==i));if(r.special==='구사'&&otherMax<=700)reasons.push('구사');if(r.special==='멍텅구리 구사'&&otherMax<=809)reasons.push('멍텅구리 구사');});
 if(reasons.length)return {replay:true,reason:[...new Set(reasons)].join(' · '),winners:ranks.map((_,i)=>i),ranks,values};
 const best=Math.max(...values),winners=values.map((v,i)=>v===best?i:-1).filter(i=>i>=0);
 const reason=winners.length>1?'동점 재경기':ranks[winners[0]].special&&values[winners[0]]!==ranks[winners[0]].value?ranks[winners[0]].special:ranks[winners[0]].label;
 return {replay:winners.length>1,reason,winners,ranks,values};
}
function shuffled(){const d=Array.from({length:20},(_,i)=>i);for(let i=19;i>0;i--){const j=randomInt(i+1);[d[i],d[j]]=[d[j],d[i]];}return d;}
const live=g=>g.players.map((p,i)=>!p.folded?i:-1).filter(i=>i>=0);
const movable=g=>live(g).filter(i=>g.players[i].chips>0);
const ordered=(g,ids,after=g.dealer)=>[...ids].sort((a,b)=>(a-after-1+g.players.length)%g.players.length-(b-after-1+g.players.length)%g.players.length);
function log(g,s){g.log.push(s);g.log=g.log.slice(-45);}
function touch(g){g.revision++;g.deadline=Date.now()+g.turnSeconds*1000;}
function pay(g,i,n,round=true){const p=g.players[i],amount=Math.min(p.chips,Math.max(0,n));p.chips-=amount;p.total+=amount;if(round)p.bet+=amount;g.pot+=amount;}
function draw(g,n){if(g.deck.length<n)throw Error('남은 패가 부족합니다.');return g.deck.splice(-n,n);}
export function createSeotda(names,balances,{base=100,turnSeconds=45,dealer=0,handNo=1,cards=2,avatars=[],bonusPot=0}={}){
 if(names.length<2||names.length>5||![2,3].includes(cards))throw Error('섯다는 2~5명, 2장 또는 3장입니다.');
 const g={status:'playing',phase:'bet',round:0,base,turnSeconds,dealer,handNo,cards,avatars:[...avatars],revision:0,deadline:0,turn:null,pot:0,potBefore:0,current:0,lastRaise:base,raises:0,pending:[],raiseAllowed:[],deck:shuffled(),log:[],showdown:false,payouts:Array(names.length).fill(0),pots:[],escrow:[],replayNo:0,lastShowdown:null,players:names.map((name,i)=>({name,chips:balances[i],hand:[],chosen:null,open:null,folded:!name||balances[i]===0,bet:0,total:0,lastAction:'대기'}))};
 if(live(g).length<2)throw Error('칩이 있는 참가자 2명 이상이 필요합니다.');
 if(bonusPot>0){g.pot=bonusPot;g.escrow=[{amount:bonusPot,eligible:live(g)}];}
 for(const i of live(g)){g.players[i].hand=draw(g,cards===3?2:1);if(cards===2)g.players[i].open=0;pay(g,i,base,false);}
 log(g,`${cards}장 섯다 · ${handNo}번째 판 · 기본 판돈 ${base.toLocaleString()}`);log(g,cards===3?'첫 패 2장 배분 · 공개패 1장 선택':'첫 공개패 1장 배분 · 1구 베팅');if(cards===3)beginPick(g,'open');else beginBet(g);return g;
}
function beginPick(g,phase){g.phase=phase;g.pending=ordered(g,live(g));g.turn=g.pending[0];touch(g);}
function beginBet(g){
 g.phase='bet';g.current=0;g.lastRaise=g.base;g.raises=0;g.players.forEach(p=>p.bet=0);
 g.pending=ordered(g,movable(g));g.raiseAllowed=[...g.pending];g.boss=g.pending[0]??null;g.openingActed=false;g.raiseLocked=g.players.map(()=>false);g.raiseCounts=g.players.map(()=>0);g.betLimit=Math.max(...live(g).map(i=>g.players[i].hand.length))>=g.cards?5:2;g.lastRaiser=null;g.lastBetEvent=null;
 if(g.pending.length<=1){g.pending=[];finishBet(g);}else{g.turn=g.pending[0];touch(g);}
}

function finishBet(g){
 if(live(g).length<=1){settleSeotda(g);return;}
 const dealt=Math.max(...live(g).map(i=>g.players[i].hand.length));
 if(dealt<g.cards){
  for(const i of live(g)){g.players[i].hand.push(...draw(g,1));}g.round++;
  log(g,`추가 패 1장 배분 · ${dealt+1}/${g.cards}장 · ${g.round+1}구 베팅`);
  if(g.cards===2)log(g,'추가 패는 히든 · 첫 공개패만 상대와 관전자에게 공개');beginBet(g);
 }else if(g.cards===3)beginPick(g,'select');else settleSeotda(g,true);
}

export function seotdaActions(g,i){
 if(g.status!=='playing'||g.phase!=='bet'||g.turn!==i)return {};
 const p=g.players[i],call=Math.max(0,g.current-p.bet),limit=g.betLimit||2,locked=!!g.raiseLocked?.[i],canRaise=!locked&&(g.raiseCounts?.[i]||0)<limit&&g.raiseAllowed.includes(i)&&movable(g).some(n=>n!==i);
 const boss=g.boss===i&&!g.openingActed&&g.current===0;
 const targets={half:g.current+Math.floor((g.pot+call)/2),quarter:g.current+Math.floor((g.pot+call)/4),double:p.bet+call*2,small:g.base};
 const a={fold:true,check:boss,call:call>0||(!boss&&g.openingActed&&g.current===0),callAmount:Math.min(call,p.chips),allin:p.chips>0&&(p.bet+p.chips<=g.current||canRaise),raiseLocked:locked,raiseLimit:limit,raisesUsed:g.raiseCounts?.[i]||0};
 for(const [key,n]of Object.entries(targets)){a[key]=canRaise&&(key!=='small'||boss)&&(key!=='double'||call>0)&&n-p.bet<=p.chips&&n>g.current;a[key+'Target']=n;a[key+'Amount']=Math.max(0,n-p.bet);}
 return a;
}

function pots(g){let prev=0;const list=g.escrow.map(p=>({...p,eligible:[...p.eligible]}));for(const level of [...new Set(g.players.map(p=>p.total).filter(Boolean))].sort((a,b)=>a-b)){const contributors=g.players.map((p,i)=>p.total>=level?i:-1).filter(i=>i>=0);list.push({amount:(level-prev)*contributors.length,eligible:contributors.filter(i=>!g.players[i].folded),contributors});prev=level;}return list;}
export function settleSeotda(g,showdown=false){
 if(g.status==='finished')return;
 const all=live(g),pending=[],awards=Array(g.players.length).fill(0);g.showdown=showdown;g.potBefore=g.pot;g.pots=[];
 for(const pot of pots(g)){
  const eligible=pot.eligible.filter(i=>!g.players[i].folded);
  if(!eligible.length){const ids=pot.contributors||pot.eligible,each=Math.floor(pot.amount/ids.length),extra=pot.amount%ids.length;ordered(g,ids).forEach((i,j)=>awards[i]+=each+(j<extra?1:0));g.pots.push({amount:pot.amount,winners:ids,reason:'미성립 금액 반환',refund:true});continue;}
  if(eligible.length===1){awards[eligible[0]]+=pot.amount;g.pots.push({amount:pot.amount,winners:eligible,reason:'단독 대상'});continue;}
  const result=resolveHands(eligible.map(i=>{const p=g.players[i];return p.chosen?p.chosen.map(n=>p.hand[n]):p.hand.slice(0,2)})),winners=result.winners.map(n=>eligible[n]);
  if(result.replay){pending.push({amount:pot.amount,eligible:winners,reason:result.reason});g.pots.push({amount:pot.amount,winners:[],eligible:winners,reason:result.reason,replay:true});}
  else{awards[winners[0]]+=pot.amount;g.pots.push({amount:pot.amount,winners,reason:result.reason});}
 }
 awards.forEach((n,i)=>{g.players[i].chips+=n;g.payouts[i]+=n});g.pot=pending.reduce((a,p)=>a+p.amount,0);
 if(pending.length){g.escrow=pending;g.lastShowdown=g.players.map(p=>({name:p.name,hand:p.folded?[]:p.hand.map((c,n)=>g.cards===2||p.chosen?.includes(n)||p.open===n?c:null),chosen:p.chosen?[...p.chosen]:null,folded:p.folded}));const ids=[...new Set(pending.flatMap(p=>p.eligible))];g.players.forEach((p,i)=>{p.folded=!ids.includes(i);p.total=0;p.bet=0;});g.current=0;g.status='playing';g.phase='replay';g.turn=ordered(g,ids)[0];g.pending=[g.turn];log(g,`재경기 · ${[...new Set(pending.map(p=>p.reason))].join(' / ')} · ${g.pot.toLocaleString()}칩 이월`);touch(g);return;}
 g.status='finished';g.phase='result';g.turn=null;g.pending=[];g.escrow=[];touch(g);log(g,'결과 · '+g.payouts.map((n,i)=>n?`${g.players[i].name} +${n.toLocaleString()}`:'').filter(Boolean).join(' / '));
}
function replay(g){g.replayNo++;g.deck=shuffled();g.round=0;g.showdown=false;for(const p of g.players){p.bet=0;p.total=0;p.chosen=null;p.open=null;p.hand=p.folded?[]:draw(g,g.cards===3?2:1);if(g.cards===2&&!p.folded)p.open=0;p.lastAction=p.folded?'재경기 제외':'재경기';}log(g,`재경기 ${g.replayNo}회 · 판돈 유지 · 새 패 배분`);if(g.cards===3)beginPick(g,'open');else beginBet(g);}
export function actSeotda(g,i,data){
 if(!g||g.status!=='playing'||g.turn!==i||g.players[i]?.folded)throw Error('현재 본인 차례가 아닙니다.');
 if(data.revision!==g.revision||(data.handNo!==undefined&&data.handNo!==g.handNo)||(data.replayNo!==undefined&&data.replayNo!==g.replayNo))throw Error('이미 갱신된 판입니다. 현재 화면을 확인하세요.');
 const p=g.players[i];
 if(g.phase==='replay'){if(data.action!=='replay')throw Error('재경기 시작을 선택하세요.');replay(g);return;}
 if(g.phase==='open'||g.phase==='select'){
  const indices=data.indices,len=g.phase==='open'?1:2;
  if(!Array.isArray(indices)||indices.length!==len||new Set(indices).size!==len||indices.some(n=>!Number.isInteger(n)||n<0||n>=p.hand.length))throw Error(`${len}장의 패를 선택하세요.`);
  if(g.phase==='open'){p.open=indices[0];p.lastAction='공개패 선택';}else{p.chosen=[...indices];p.lastAction='최종패 선택';}log(g,`${p.name} · ${p.lastAction}`);g.pending=g.pending.filter(n=>n!==i);if(g.pending.length){g.turn=g.pending[0];if(g.phase==='bet'&&!g.openingActed)g.boss=g.turn;touch(g);}else if(g.phase==='open')beginBet(g);else settleSeotda(g,true);return;
 }
 const a=seotdaActions(g,i),action=data.action;if(!['fold','check','call','small','quarter','half','double','allin'].includes(action)||!a[action])throw Error('현재 사용할 수 없는 베팅입니다.');
 const before=p.chips;g.pending=g.pending.filter(n=>n!==i);g.raiseAllowed=g.raiseAllowed.filter(n=>n!==i);
 if(action==='fold'){p.folded=true;p.lastAction='다이';}else{
  if(action==='check'||action==='call')g.raiseLocked[i]=true;
  g.openingActed=true;
  const target=['half','quarter','double','small'].includes(action)?a[action+'Target']:action==='allin'?p.bet+p.chips:action==='call'?g.current:p.bet;
  pay(g,i,Math.max(0,target-p.bet));
  if(p.bet>g.current){
   const increment=p.bet-g.current,full=action!=='allin'||increment>=g.lastRaise;g.current=p.bet;g.lastRaiser=i;g.raiseCounts[i]++;
   if(full){g.lastRaise=increment;g.raises++;g.pending=ordered(g,movable(g).filter(n=>n!==i),i);g.raiseAllowed=g.pending.filter(n=>!g.raiseLocked[n]&&g.raiseCounts[n]<g.betLimit);}
   else g.pending=ordered(g,[...new Set([...g.pending,...movable(g).filter(n=>n!==i&&g.players[n].bet<g.current)])],i);
  }
  p.lastAction=action==='call'&&a.callAmount===0?'콜(체크)':{check:'체크',call:'콜',small:'삥',quarter:'쿼터',half:'하프',double:'따당',allin:'올인'}[action];
 }
 const paid=before-p.chips;g.lastBetEvent={seat:i,action,paid,target:g.current,round:g.round};
 log(g,`${p.name} · ${p.lastAction}${paid?' +'+paid.toLocaleString():''} · 이번 구 누적 ${p.bet.toLocaleString()}`);
 if(live(g).length<=1){settleSeotda(g);return;}
 g.pending=g.pending.filter(n=>!g.players[n].folded&&g.players[n].chips>0);
 if(!g.pending.length)g.pending=ordered(g,movable(g).filter(n=>g.players[n].bet<g.current),i);
 if(movable(g).length===1&&g.pending.length===1&&g.players[g.pending[0]].bet>=g.current)g.pending=[];
 if(g.pending.length){g.turn=g.pending[0];if(!g.openingActed)g.boss=g.turn;touch(g);}else finishBet(g);
}

export function removeSeotda(g,i){if(!g||g.status!=='playing'||g.players[i].folded)return;g.players[i].folded=true;g.players[i].lastAction='자리 비움';g.pending=g.pending.filter(n=>n!==i);g.raiseAllowed=g.raiseAllowed.filter(n=>n!==i);if(live(g).length<=1){settleSeotda(g);return;}if(g.turn===i){if(g.pending.length){g.turn=g.pending[0];touch(g);}else if(g.phase==='open')beginBet(g);else if(g.phase==='select')settleSeotda(g,true);else if(g.phase==='replay'){g.turn=ordered(g,live(g))[0];g.pending=[g.turn];touch(g);}else finishBet(g);}}
export function timeoutSeotda(g){if(!g||g.status!=='playing')return;const p=g.players[g.turn];let d;if(g.phase==='replay')d={action:'replay'};else if(g.phase==='open')d={indices:[0]};else if(g.phase==='select'){const pairs=[[0,1],[0,2],[1,2]].filter(pair=>pair[1]<p.hand.length);pairs.sort((a,b)=>evaluatePair(b.map(n=>p.hand[n])).value-evaluatePair(a.map(n=>p.hand[n])).value);d={indices:pairs[0]};}else{const a=seotdaActions(g,g.turn);d={action:a.check?'check':a.call&&a.callAmount===0?'call':'fold'};}actSeotda(g,g.turn,{...d,revision:g.revision});}
export function publicSeotda(g,viewer=null){if(!g)return null;return {status:g.status,phase:g.phase,round:g.round,betting:g.phase==='bet'?{boss:g.boss,target:g.current,lastRaiser:g.lastRaiser,waiting:[...g.pending],raiseLimit:g.betLimit,raiseCounts:[...g.raiseCounts],raiseLocked:[...g.raiseLocked],lastEvent:g.lastBetEvent?{...g.lastBetEvent}:null}:null,dealCount:Math.max(0,...g.players.map(p=>p.hand.length)),cards:g.cards,base:g.base,dealer:g.dealer,handNo:g.handNo,replayNo:g.replayNo,revision:g.revision,deadline:g.deadline,turn:g.turn,pot:g.pot,potBefore:g.potBefore,showdown:g.showdown,avatars:[...g.avatars],payouts:[...g.payouts],pots:g.pots.map(p=>({...p})),log:g.log.slice(-16),actions:seotdaActions(g,viewer),lastShowdown:g.lastShowdown,players:g.players.map((p,i)=>{const visible=viewer===i||(g.showdown&&!p.folded)||g.phase==='replay'&&!p.folded;const selected=p.chosen?p.chosen.map(n=>p.hand[n]):p.hand.slice(0,2);const r=visible&&selected.length===2?evaluatePair(selected):null;return {name:p.name,chips:p.chips,folded:p.folded,bet:p.bet,total:p.total,lastAction:p.lastAction,open:p.open,chosen:visible&&p.chosen?[...p.chosen]:null,hand:p.hand.map((c,n)=>viewer===i||(visible&&!p.folded&&(g.cards===2||p.chosen?.includes(n)))||(!p.folded&&p.open===n)?c:null),label:r?(r.special||r.label):null};})};}

// A relay preserves all balances. No chips are replenished between hands.
export function updateSeotdaRelay(relay,g,now=Date.now()){
 if(!relay||relay.status==='finished'||g?.status!=='finished')return;
 const funded=g.players.map((p,i)=>p.chips>0?i:-1).filter(i=>i>=0);
 relay.eliminated=g.players.flatMap((p,i)=>p.chips===0&&relay.participants?.[i]!==false?[i]:[]);
 if(funded.length<=1){const winner=funded[0]??g.players.findIndex((p,i)=>p.name&&relay.participants?.[i]!==false&&!relay.retired?.includes(i));if(winner>=0){g.players[winner].chips+=relay.carry||0;relay.carry=0;relay.champion=winner;relay.status='finished';relay.nextAt=null;relay.eliminated=g.players.flatMap((p,i)=>p.chips===0&&relay.participants?.[i]!==false?[i]:[]);}return;}
 if(relay.processedHand!==g.handNo){relay.processedHand=g.handNo;relay.nextAt=now+5000;}
}
export function forfeitSeotdaRelay(relay,g,i){
 if(!relay||relay.status!=='playing'||!g?.players[i]||relay.retired.includes(i))return;
 relay.retired.push(i);const p=g.players[i],amount=p.chips;p.chips=0;
 if(g.status==='playing'){const eligible=g.players.flatMap((p,j)=>j!==i&&!p.folded?[j]:[]);if(amount>0){g.escrow.push({amount,eligible});g.pot+=amount;}removeSeotda(g,i);p.lastAction='기권';}
 else relay.carry+=amount;
}
