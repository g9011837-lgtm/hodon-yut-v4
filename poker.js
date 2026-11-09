import {randomInt} from 'node:crypto';
export const pokerRank=c=>c%13===0?14:c%13+1;
export const pokerSuit=c=>[3,1,2,0][Math.floor(c/13)]; // spade > diamond > heart > club
export function comparePoker(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){const d=(a[i]??0)-(b[i]??0);if(d)return d;}return 0;}
function five(cards){
 const sorted=[...cards].sort((a,b)=>pokerRank(b)-pokerRank(a)||pokerSuit(b)-pokerSuit(a));
 const ranks=sorted.map(pokerRank),unique=[...new Set(ranks)],flush=new Set(cards.map(c=>Math.floor(c/13))).size===1;
 const wheel=unique.join(',')==='14,5,4,3,2',straight=unique.length===5&&(ranks[0]-ranks[4]===4||wheel);
 const groups=[...new Set(ranks)].map(r=>({r,n:ranks.filter(v=>v===r).length,s:Math.max(...cards.filter(c=>pokerRank(c)===r).map(pokerSuit))})).sort((a,b)=>b.n-a.n||b.r-a.r);
 const high=wheel?14:ranks[0],topSuit=Math.max(...cards.filter(c=>pokerRank(c)===high).map(pokerSuit));
 let cat,label,tie;
 if(straight&&flush){cat=wheel?10:ranks[0]===14?11:9;label=wheel?'백 스트레이트 플러시':cat===11?'로열 스트레이트 플러시':'스트레이트 플러시';tie=[high,topSuit];}
 else if(groups[0].n===4){cat=8;label='포카드';tie=[groups[0].r,groups[1].r];}
 else if(groups[0].n===3&&groups[1].n===2){cat=7;label='풀하우스';tie=[groups[0].r,groups[1].r];}
 else if(flush){cat=6;label='플러시';tie=[...ranks,pokerSuit(sorted[0])];}
 else if(straight){cat=wheel?4:ranks[0]===14?5:3;label=wheel?'백스트레이트':cat===5?'마운틴':'스트레이트';tie=[high,topSuit];}
 else if(groups[0].n===3){cat=2;label='트리플';tie=[groups[0].r,...groups.slice(1).map(g=>g.r),groups[0].s];}
 else if(groups[0].n===2&&groups[1].n===2){cat=1;label='투페어';tie=[groups[0].r,groups[1].r,groups[2].r,groups[0].s];}
 else if(groups[0].n===2){cat=0;label='원페어';tie=[groups[0].r,...groups.slice(1).map(g=>g.r),groups[0].s];}
 else{cat=-1;label='노페어';tie=[...ranks,pokerSuit(sorted[0])];}
 return {value:[cat,...tie],label,cards:sorted};
}
export function evaluatePoker(cards){
 if(!Array.isArray(cards)||cards.length<5||cards.length>7||new Set(cards).size!==cards.length||cards.some(c=>!Number.isInteger(c)||c<0||c>51))throw Error('유효한 카드 5~7장이 필요합니다.');
 let best=null;
 for(let a=0;a<cards.length-4;a++)for(let b=a+1;b<cards.length-3;b++)for(let c=b+1;c<cards.length-2;c++)for(let d=c+1;d<cards.length-1;d++)for(let e=d+1;e<cards.length;e++){
  const v=five([cards[a],cards[b],cards[c],cards[d],cards[e]]);if(!best||comparePoker(v.value,best.value)>0)best=v;
 }return best;
}
function shuffle(deck){for(let i=deck.length-1;i>0;i--){const j=randomInt(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}return deck;}
const alive=g=>g.players.flatMap((p,i)=>p.hand.length&&!p.folded?[i]:[]);
const movable=g=>alive(g).filter(i=>g.players[i].chips>0);
function ordered(g,ids,after=g.dealer){return [...ids].sort((a,b)=>(a-after-1+g.players.length)%g.players.length-(b-after-1+g.players.length)%g.players.length);}
function note(g,text){g.log.push(text);g.log=g.log.slice(-30);}
function touch(g){g.revision++;g.deadline=Date.now()+g.turnSeconds*1000;}
function pay(g,i,n,round=true){const p=g.players[i],amount=Math.min(Math.max(0,n),p.chips);p.chips-=amount;p.total+=amount;if(round)p.bet+=amount;g.pot+=amount;return amount;}
function take(g,n){if(g.deck.length<n)throw Error('카드가 부족합니다.');return g.deck.splice(-n,n);}
function openValue(p){const cards=p.open.map(i=>p.hand[i]),groups=[...new Set(cards.map(pokerRank))].map(r=>[cards.filter(c=>pokerRank(c)===r).length,r]).sort((a,b)=>b[0]-a[0]||b[1]-a[1]);return [...groups.flat(),...cards.sort((a,b)=>pokerRank(b)-pokerRank(a)||pokerSuit(b)-pokerSuit(a)).map(pokerSuit)];}
function boss(g){return alive(g).reduce((best,i)=>best===null||comparePoker(openValue(g.players[i]),openValue(g.players[best]))>0?i:best,null);}
export function createPoker(names,balances,{base=100,turnSeconds=15,dealer=0,handNo=1,rule='normal'}={}){
 if(names.length<2||names.length>5||!['normal','choice'].includes(rule)||!Number.isSafeInteger(base)||base<1||names.length!==balances.length||balances.some(n=>!Number.isSafeInteger(n)||n<0))throw Error('포커 방 설정이 올바르지 않습니다.');
 const g={status:'playing',phase:rule==='choice'?'discard':'open',rule,street:3,base,turnSeconds,dealer,handNo,revision:0,deadline:0,turn:null,pot:0,potBefore:0,current:0,lastRaise:base,pending:[],raiseAllowed:[],deck:shuffle(Array.from({length:52},(_,i)=>i)),discard:[],log:[],showdown:false,payouts:[],pots:[],boss:null,players:names.map((name,i)=>({name,chips:balances[i],hand:[],open:[],folded:!name||balances[i]<base,bet:0,total:0,lastAction:'대기',raises:0,cardVersions:[]}))};
 const ids=g.players.flatMap((p,i)=>!p.folded?[i]:[]);if(ids.length<2)throw Error('기본 판돈을 보유한 접속자 2명 이상이 필요합니다.');
 for(const i of ids){const p=g.players[i];p.hand=take(g,rule==='choice'?4:3);p.cardVersions=p.hand.map(()=>0);pay(g,i,base,false);}
 g.pending=ordered(g,ids);g.turn=g.pending[0];note(g,`${handNo}번째 판 · ${rule==='choice'?'초이스':'일반'} · 첫 패 배분`);touch(g);return g;
}
function beginBet(g){
 g.phase='bet';g.current=0;g.lastRaise=g.base;g.players.forEach(p=>{p.bet=0;p.raises=0;});g.boss=boss(g);
 const ids=movable(g);g.pending=ordered(g,ids,(g.boss-1+g.players.length)%g.players.length);g.raiseAllowed=[...ids];
 if(ids.length<=1){advance(g);return;}g.turn=g.pending[0];note(g,`${g.street}구 베팅 · 선 ${g.players[g.boss].name}`);touch(g);
}
function advance(g){
 if(alive(g).length<=1){settlePoker(g);return;}
 if(g.street===7){settlePoker(g,true);return;}
 g.street++;
 for(const i of alive(g)){const p=g.players[i],index=p.hand.length;p.hand.push(take(g,1)[0]);p.cardVersions.push(0);if(g.street<7)p.open.push(index);}
 note(g,g.street===7?'마지막 히든 카드 배분':`${g.street}구 공개 카드 배분`);beginBet(g);
}
export function pokerActions(g,i){
 if(!g||g.status!=='playing'||g.phase!=='bet'||g.turn!==i)return {};
 const p=g.players[i],call=Math.max(0,g.current-p.bet),limit=[1,1,2,3][g.street-4];
 const canRaise=g.raiseAllowed.includes(i)&&p.raises<limit&&movable(g).some(n=>n!==i);
 const targets={small:g.base,double:Math.max(g.current*2,g.current+g.lastRaise,g.base),quarter:g.current+Math.max(g.lastRaise,g.base,Math.floor((g.pot+call)/4)),half:g.current+Math.max(g.lastRaise,g.base,Math.floor((g.pot+call)/2)),full:g.current+Math.max(g.lastRaise,g.base,g.pot+call),max:p.bet+p.chips};
 const a={fold:true,check:call===0&&g.current===0&&i===g.boss,call:call>0||g.current===0&&i!==g.boss,callAmount:Math.min(call,p.chips),targets};
 for(const [k,target]of Object.entries(targets))a[k]=k==='max'?p.chips>0&&(target<=g.current||canRaise):canRaise&&target>g.current&&target-p.bet<=p.chips&&(k!=='small'||i===g.boss&&g.current===0);
 return a;
}
export function settlePoker(g,showdown=false){
 if(g.status==='finished')return;const ids=alive(g);g.showdown=showdown;g.payouts=g.players.map(()=>0);g.pots=[];g.potBefore=g.pot;
 if(ids.length===1){g.payouts[ids[0]]=g.pot;g.pots.push({amount:g.pot,winners:ids});}
 else{
  const levels=[...new Set(g.players.map(p=>p.total).filter(Boolean))].sort((a,b)=>a-b);let prev=0;
  for(const level of levels){const contributors=g.players.flatMap((p,i)=>p.total>=level?[i]:[]),amount=(level-prev)*contributors.length;prev=level;const eligible=contributors.filter(i=>!g.players[i].folded&&g.players[i].hand.length===7);
   if(contributors.length===1||!eligible.length){for(const i of contributors)g.payouts[i]+=amount/contributors.length;g.pots.push({amount,winners:contributors,refund:true});continue;}
   let winners=[];for(const i of eligible){const value=evaluatePoker(g.players[i].hand).value,cmp=winners.length?comparePoker(value,evaluatePoker(g.players[winners[0]].hand).value):1;if(cmp>0)winners=[i];else if(cmp===0)winners.push(i);}
   winners=ordered(g,winners);const each=Math.floor(amount/winners.length),extra=amount%winners.length;winners.forEach((i,j)=>g.payouts[i]+=each+(j<extra?1:0));g.pots.push({amount,winners});
  }
 }
 g.payouts.forEach((n,i)=>g.players[i].chips+=n);g.pot=0;g.status='finished';g.phase='result';g.turn=null;g.pending=[];touch(g);note(g,'결과 · '+g.payouts.flatMap((n,i)=>n?[`${g.players[i].name} +${n.toLocaleString()}`]:[]).join(' / '));
}
export function actPoker(g,i,data={}){
 if(!g||g.status!=='playing'||g.turn!==i||g.players[i]?.folded)throw Error('현재 본인 차례가 아닙니다.');
 if(!Number.isInteger(data.revision)||data.revision!==g.revision)throw Error('화면이 갱신되었습니다. 현재 차례를 다시 확인해 주세요.');
 const p=g.players[i];
 if(g.phase==='discard'||g.phase==='open'){
  const index=data.index;if(!Number.isInteger(index)||index<0||index>=p.hand.length)throw Error('카드를 선택하세요.');
  if(g.phase==='discard'){g.discard.push(p.hand.splice(index,1)[0]);p.cardVersions=p.hand.map(()=>1);p.lastAction='1장 버림';}
  else{p.open=[index];p.lastAction='1장 공개';}
  note(g,`${p.name} · ${p.lastAction}`);g.pending=g.pending.filter(n=>n!==i);
  if(!g.pending.length){if(g.phase==='discard'){g.phase='open';g.pending=ordered(g,alive(g));g.turn=g.pending[0];touch(g);}else advance(g);}
  else{g.turn=g.pending[0];touch(g);}return;
 }
 const a=pokerActions(g,i),action=data.action;if(!['fold','check','call','small','double','quarter','half','full','max'].includes(action)||!a[action])throw Error('현재 사용할 수 없는 베팅입니다.');
 g.pending=g.pending.filter(n=>n!==i);g.raiseAllowed=g.raiseAllowed.filter(n=>n!==i);
 if(action==='fold'){p.folded=true;p.lastAction='다이';}
 else{
  const target=action==='check'?p.bet:action==='call'?g.current:a.targets[action];pay(g,i,target-p.bet);
  if(p.bet>g.current){const increment=p.bet-g.current,full=increment>=g.lastRaise;g.current=p.bet;p.raises++;
   if(full){g.lastRaise=increment;g.pending=ordered(g,movable(g).filter(n=>n!==i),i);g.raiseAllowed=[...g.pending];}
   else g.pending=ordered(g,[...new Set([...g.pending,...movable(g).filter(n=>n!==i&&g.players[n].bet<g.current)])],i);
  }
  p.lastAction={check:'체크',call:'콜',small:'삥',double:'따당',quarter:'쿼터',half:'하프',full:'풀',max:'맥스'}[action];
 }
 note(g,`${p.name} · ${p.lastAction}${p.bet?' '+p.bet.toLocaleString():''}`);
 if(alive(g).length<=1){settlePoker(g);return;}
 g.pending=g.pending.filter(n=>!g.players[n].folded&&g.players[n].chips>0);
 if(movable(g).length===1&&g.pending.length===1&&g.players[g.pending[0]].bet>=g.current)g.pending=[];
 if(g.pending.length){g.turn=g.pending[0];touch(g);}else advance(g);
}
export function removePoker(g,i){
 if(!g||g.status!=='playing'||g.players[i]?.folded)return;
 g.players[i].folded=true;g.players[i].lastAction='자리 비움';g.pending=g.pending.filter(n=>n!==i);g.raiseAllowed=g.raiseAllowed.filter(n=>n!==i);
 if(alive(g).length<=1){settlePoker(g);return;}
 if(g.turn===i){if(g.pending.length){g.turn=g.pending[0];touch(g);}else if(g.phase==='discard'){g.phase='open';g.pending=ordered(g,alive(g));g.turn=g.pending[0];touch(g);}else advance(g);}
}
export function timeoutPoker(g){if(g?.status!=='playing')return;const a=pokerActions(g,g.turn);actPoker(g,g.turn,g.phase==='open'||g.phase==='discard'?{index:0,revision:g.revision}:{action:a.check?'check':a.call&&a.callAmount===0?'call':'fold',revision:g.revision});}
export function publicPoker(g,viewer=null){
 if(!g)return null;
 return {status:g.status,phase:g.phase,rule:g.rule,street:g.street,base:g.base,dealer:g.dealer,handNo:g.handNo,revision:g.revision,deadline:g.deadline,turn:g.turn,boss:g.boss,pot:g.pot,potBefore:g.potBefore,showdown:g.showdown,payouts:[...g.payouts],pots:g.pots.map(p=>({...p,winners:[...p.winners]})),log:g.log.slice(-12),actions:pokerActions(g,viewer),players:g.players.map((p,i)=>{
  const visible=viewer===i||g.showdown&&!p.folded,hand=p.hand.map((c,n)=>visible||p.open.includes(n)?c:null),label=visible&&p.hand.length>=5?evaluatePoker(p.hand).label:null;
  return {name:p.name,chips:p.chips,hand,open:[...p.open],folded:p.folded,bet:p.bet,total:p.total,lastAction:p.lastAction,cardVersions:[...p.cardVersions],label};
 })};
}
