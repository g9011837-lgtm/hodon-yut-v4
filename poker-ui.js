// 7 Poker presentation, bundled into app.js for Bonto single-file client loading.
var pokerBusy=false;
function pokerCard(c,index,self){
 if(c===null)return `<div class="playing-card poker-card back" aria-label="비공개 카드">${peekBackArt('poker')}</div>`;
 const symbols=['♠','♥','♦','♣'],s=Math.floor(c/13),n=c%13+1,r=['','A','2','3','4','5','6','7','8','9','10','J','Q','K'][n];
 return `<button type="button" class="playing-card poker-card ${s===1||s===2?'red':''}" data-poker-card="${index}" data-poker-face="${c}" ${self?'':'disabled'} aria-label="${symbols[s]} ${r}"><span class="poker-face-art" aria-hidden="true" style="background-position:${(n-1)/12*100}% ${s/3*100}%"></span></button>`;
}
function pokerPotMoney(amount){
 if(!amount)return '<span class="poker-pot-empty">판돈이 이곳에 모입니다</span>';
 const stacks=amount<state.base*4?3:amount<state.base*20?5:7;
 return `<div class="poker-cash-mountain" aria-label="중앙 판돈 지폐 묶음">${Array.from({length:stacks},(_,i)=>`<div class="poker-cash-hill hill-${i}" aria-hidden="true">${moneyStack(amount,{pot:true})}</div>`).join('')}</div>`;
}
function pokerPhase(g){return !g?'친구들과 7포커 한 판':g.status==='finished'?'이번 판 종료':g.phase==='discard'?'초이스 · 버릴 패 선택':g.phase==='open'?'첫 공개패 선택':`${g.street}구 · ${g.street===7?'최종':'진행'} 베팅`;}
function renderPoker(){
 ui.landing.classList.add('hidden');ui.room.classList.add('hidden');const root=$('poker-section');root.classList.remove('hidden');
 ensureTablePresentation();const s=state,g=s.poker,own=!isSpectator&&Number.isInteger(seat),pending=g?.status==='playing',mine=own&&pending&&g.turn===seat,dealing=tableIsDealing('poker',g),busy=pokerBusy||dealing;
 if(socket.connected)showConnectionVersion(s.serverVersion);
 const pivot=own?seat:0,ids=s.players.map((_,j)=>(pivot+j)%s.playerCount),positions=s.playerCount===2?['bottom','top-center']:s.playerCount===3?['bottom','upper-left','upper-right']:s.playerCount===4?['bottom','middle-left','top-center','middle-right']:['bottom','middle-left','upper-left','upper-right','middle-right'];
 const layout=ids.map((i,j)=>{
  const person=s.players[i],p=g?.players[i],self=own&&seat===i,hand=p?.hand||[],name=person?.name||p?.name||'입장 대기',balance=p?.chips??(person?s.wallets[i]:0);
  return `<section class="poker-seat badugi-seat ${positions[j]} ${j===0?'local-seat':''} ${self?'self':''} ${pending&&g.turn===i?'turn':''} ${p?.folded?'folded':''}" data-seat="${i}" aria-label="${safe(name)} 자리">
   <div class="poker-person">${avatarHtml(person)}<strong>${safe(name)}${self?' <small>(나)</small>':''}</strong>${i===s.host&&person?'<span class="poker-host">방장</span>':''}${own&&seat===s.host&&person&&i!==seat?`<button class="poker-kick" data-poker-kick="${i}" aria-label="${safe(name)} 강퇴">×</button>`:''}</div>
   <div class="poker-hand badugi-hand" style="--poker-count:${Math.max(1,hand.length)}">${hand.map((c,n)=>pokerCard(c,n,self)).join('')}</div>
   <div class="poker-bankroll badugi-bankroll">${person?moneyStack(balance):''}<span>보유금액 <b>${chip(balance)}</b></span></div>
   <div class="poker-seat-action">${pending&&g.turn===i?'<em>진행 중</em> ':''}${safe(person&&!person.connected?'연결 대기':p?.lastAction||'입장 대기')}${p?.bet?' · '+chip(p.bet):''}</div>
   ${p?.label?`<span class="hand-grade private-grade">${safe(p.label)}</span>`:''}
  </section>`;
 }).join('');
 const a=g?.actions||{},call=a.callAmount||0,canStart=own&&seat===s.host&&!pending&&roomReady(s),needsReset=s.wallets.filter((n,i)=>s.players[i]?.connected&&n>=s.base).length<2;
 const buttons=[['fold','다이'],['check','체크'],['call','콜'],['small','삥'],['double','따당'],['quarter','쿼터'],['half','하프'],['full','풀'],['max','맥스']];
 const who=g?.players[g.turn]?.name||'',turnText=dealing?'딜러가 패를 배분 중입니다':!g?'참가자를 기다리고 있습니다':!pending?'다음 판을 준비하세요':mine?'당신의 차례입니다':who+'님의 차례';
 const choose=mine&&['open','discard'].includes(g.phase);
 const hint=choose?(g.phase==='discard'?'버릴 카드 한 장을 선택하세요':'공개할 카드 한 장을 선택하세요'):pending?'내 히든 패는 원하는 방향으로 밀어 확인하세요':!g?'접속한 참가자 2명부터 바로 시작할 수 있습니다.':'방장이 다음 판을 시작할 수 있습니다.';
 const winner=handWinnerModel(g),shownPot=g?.pot||0;
 root.innerHTML=`<div class="poker-room-bar"><span>방 ${safe(s.code)} · ${s.players.filter(Boolean).length}/${s.playerCount}명 · ${s.pokerRule==='choice'?'초이스':'일반'}</span><div><button id="poker-invite">초대</button><button id="poker-rules">족보·규칙</button><button id="poker-leave" ${leaveBusy?'disabled':''}>${roomLeaveText()}</button></div></div>
 <div class="poker-table badugi-table"><div class="poker-table-title"><small>FIELD × HODON</small><h1>♠ 호돈 7포커 ♠</h1><span>${pokerPhase(g)}</span></div>
 <div class="poker-dealer table-dealer"><span class="dealer-deck">♠</span><b>DEALER</b></div>
 <div class="poker-center"><div class="poker-pot-bank">${pokerPotMoney(shownPot)}</div><div class="poker-pot-plaque">총 판돈 <strong>${chip(shownPot)}</strong></div><div class="poker-call">콜 <b>${chip(call)}</b><small> · 기본 ${chip(s.base)}</small></div>${winner?`<p class="poker-winner-notice" role="status">${winner.winners.map(w=>safe(w.name)+'님').join(' · ')} 승리${g.showdown?' · '+winner.winners.map(w=>safe(w.label)).filter(Boolean).join(' / '):''}</p>`:''}</div>
 ${layout}
 <div class="poker-controls"><div class="poker-turn" role="status"><strong>${safe(turnText)}</strong>${pending?`<b data-table-clock="poker">${Math.max(0,Math.ceil((g.deadline-Date.now())/1000))}초</b>`:''}</div>
 ${choose?`<div class="poker-choose"><strong>${g.phase==='discard'?'버릴 패':'공개할 패'} 선택</strong><div>${g.players[seat].hand.map((_,i)=>`<button data-poker-choose="${i}" ${busy?'disabled':''}>${i+1}번</button>`).join('')}</div><small>뒷면을 밀어 확인한 뒤 선택하세요.</small></div>`:`<div class="poker-bets">${buttons.map(([key,label])=>`<button data-poker-bet="${key}" ${!mine||g?.phase!=='bet'||!a[key]||busy?'disabled':''}>${label}${key==='call'&&call?'<small>'+chip(call)+'</small>':a.targets?.[key]&&a[key]?'<small>'+chip(Math.min(a.targets[key]-(g.players[seat]?.bet||0),g.players[seat]?.chips||0))+'</small>':''}</button>`).join('')}</div>`}
 ${!pending?own&&seat===s.host?`<button id="poker-start" class="poker-start" ${!canStart||pokerBusy?'disabled':''}>${needsReset?'시작 금액으로 새 경기':g?'다음 판 시작':'게임 시작'}</button>`:'<p class="poker-host-wait">방장이 시작할 수 있습니다.</p>':''}<small class="poker-hint">${safe(hint)}</small></div>
 <aside class="poker-waiting"><h2>♟ 대기실 <span>관전 ${s.spectators.filter(w=>w.connected).length}</span></h2><p>${s.spectators.length?s.spectators.map(w=>safe(w.name)+(w.connected?'':' · 연결 대기')).join(', '):'함께할 관전자를 기다리고 있습니다.'}</p><div class="poker-log">${(g?.log||['게임 시작을 기다립니다.']).slice(-3).map(t=>'<div>'+safe(t)+'</div>').join('')}</div></aside>
 </div><dialog id="poker-help"><h2>호돈 7포커</h2><p>일반: 3장 중 1장 공개 · 초이스: 4장 중 1장 버리고 1장 공개</p><p>4·5·6구 공개패와 베팅 → 7구 히든과 최종 베팅 → 7장 중 최고 5장</p><p>레이즈 후에는 필요한 참가자에게 다시 차례가 돌아옵니다. 레이즈 횟수는 인당 4·5·6·7구 1·1·2·3회입니다.</p><p>로열 스트레이트 플러시 → 백 스트레이트 플러시 → 스트레이트 플러시 → 포카드 → 풀하우스 → 플러시 → 마운틴 → 백스트레이트 → 스트레이트 → 트리플 → 투페어 → 원페어 → 노페어</p><p>무늬: ♠ → ♦ → ♥ → ♣ · 기본 판돈 ${chip(s.base)} · 시작 ${chip(s.startingChips)} · 보유금액은 만·억·조 단위로 표시합니다.</p><button id="poker-help-close">닫기</button></dialog>`;
 root.querySelectorAll('[data-poker-bet]').forEach(b=>b.onclick=()=>sendPoker({action:b.dataset.pokerBet}));
 root.querySelectorAll('[data-poker-choose]').forEach(b=>b.onclick=()=>sendPoker({index:Number(b.dataset.pokerChoose)}));
 root.querySelectorAll('[data-poker-card]').forEach(b=>{if(choose)b.onclick=()=>sendPoker({index:Number(b.dataset.pokerCard)});});
 root.querySelectorAll('[data-poker-kick]').forEach(b=>b.onclick=()=>{if(confirm('이 참가자를 강퇴할까요?'))action('room:kick',{seat:Number(b.dataset.pokerKick)});});
 $('poker-leave').onclick=requestRoomLeave;
 $('poker-start')&&($('poker-start').onclick=()=>action('game:start',needsReset?{resetBalances:true}:{}));
 $('poker-invite').onclick=async()=>{try{await navigator.clipboard.writeText(`${location.origin}/?room=${s.code}`);notify('초대 링크를 복사했습니다.');}catch{notify('초대 코드: '+s.code);}};
 $('poker-rules').onclick=()=>{const d=$('poker-help');if(d.showModal)d.showModal();else d.setAttribute('open','');};
 $('poker-help-close').onclick=()=>{const d=$('poker-help');if(d.close)d.close();else d.removeAttribute('open');};
 enhanceTableCards('poker',g);
 root.querySelectorAll('.poker-hand').forEach(hand=>{Array.from(hand.children).forEach((card,index)=>{card.style.zIndex=String(index+1);if(card.classList.contains('card-peek'))card.dataset.pokerLayer=String(index+1);});});
 if(g){root.querySelector('.table-turn-banner')?.remove();root.querySelectorAll('.table-dealer:not(.poker-dealer)').forEach(el=>el.remove());} // dedicated fixed-size turn panel
 // Selection is available only after a private card has been peeled open.
 if(choose)root.querySelectorAll('[data-poker-choose]').forEach(b=>{const index=Number(b.dataset.pokerChoose),key=tableCardKey(s.code,'poker',g,seat,index);b.disabled=busy||(tablePeekProgress.get(key)||0)<1;});
}
async function sendPoker(data){if(pokerBusy||isSpectator||state?.gameType!=='poker'||tableIsDealing('poker',state.poker))return;const revision=state.poker.revision;pokerBusy=true;try{await action('poker:act',{...data,revision});}finally{pokerBusy=false;if(state?.gameType==='poker')renderPoker();}}

