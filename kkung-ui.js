/* Standalone view; server rules and the existing authenticated room session are authoritative. */
globalThis.HodonKkungUI=(()=>{
 const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let gameKey='',dismissed='',ctx=null,roomKey='',busy=false,composing=false,compositionSubmit=null,pendingSubmission=null,clockKey='',clockStart=0,clockLeft=0,turnKey='',seen=new Set(),effectTimers=[];
 const now=()=>globalThis.performance?.now?.()??Date.now();
 const ornament='<svg class="kk-scroll" viewBox="0 0 80 80" aria-hidden="true"><path d="M70 70Q12 75 10 32Q8 6 29 9Q47 11 39 28Q34 38 26 29Q18 20 26 18M15 42Q42 39 41 60Q38 72 29 64M45 69Q48 40 69 45" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round"/><path d="M70 65Q18 66 16 32Q12 10 29 14" fill="none" stroke="#fff1a5" stroke-width="2"/></svg>';
 function request(name,data={}){return new Promise(resolve=>{if(!ctx?.socket?.connected)return resolve({ok:false,error:'서버 연결을 확인해 주세요.'});ctx.socket.timeout(8000).emit(name,data,(error,res)=>resolve(error?{ok:false,error:'서버 응답이 지연됩니다. 연결을 확인해 주세요.'}:res||{ok:false,error:'다시 시도해 주세요.'}));});}
 function ownTurn(){const g=ctx?.state?.kkung;return !ctx?.isSpectator&&g?.status==='playing'&&g.turn===ctx.seat&&g.players[ctx.seat]?.lives>0;}
 function message(text){$('kk-feedback').textContent=text;}
 function init(root){
  root.innerHTML=`<div class="kk-heading"><div><span>FIELD × HODON</span><h1>호돈 쿵쿵따</h1></div><div class="kk-room-actions"><span id="kk-code"></span><button id="kk-invite" type="button">초대</button><button id="kk-rules-button" type="button">규칙</button><button id="kk-resign" type="button">기권</button><button id="kk-leave" type="button">나가기</button></div></div>
  <div class="kk-game-board"><aside class="kk-rules-card kk-parchment"><h2>▤ 게임 규칙</h2><p>세 글자 단어·인명·지명</p><p>♥ 목숨 3개</p><p>◷ 7초 제한</p><small>두음 허용 · 한방 허용</small></aside><section class="kk-scoreboard" aria-label="현재 단어와 제한시간">${ornament.repeat(4)}<h2>❧ 현재 단어 ❧</h2><div id="kk-word" class="kk-word"></div><p id="kk-chain-help"></p><div class="kk-time-track"><div id="kk-time-fill"></div><span id="kk-clock">게임 대기 중</span></div></section><aside class="kk-history-card kk-parchment"><h2>사용한 단어</h2><div id="kk-history"></div></aside></div>
  <div id="kk-turn-banner" class="kk-turn-banner" role="status"></div><div id="kk-player-stage" class="kk-player-stage" aria-label="참가자 무대"></div>
  <section class="kk-entry-dock"><form id="kk-word-form" autocomplete="off"><label for="kk-word-input" class="kk-sr-only">단어 입력</label><input id="kk-word-input" maxlength="12" spellcheck="false" autocomplete="off" placeholder="세 글자 단어를 입력하세요" aria-describedby="kk-feedback kk-enter-help"><span id="kk-enter-help">↵ 단어 입력 후 Enter로 전송</span><button id="kk-submit" type="submit">전송 ↵</button></form><p id="kk-feedback" role="status" aria-live="polite"></p></section>
  <div class="kk-under-stage"><div class="kk-chat-box"><h2>☏ 대화</h2><div id="kk-chat-log" role="log" aria-label="방 대화"></div><form id="kk-chat-form"><input id="kk-chat-input" maxlength="140" placeholder="대화 입력" aria-label="대화 입력"><button type="submit">보내기</button></form></div><div class="kk-watch-box"><h2 id="kk-watch-title">관전자 0명</h2><p id="kk-watchers"></p><button id="kk-start" type="button">게임 시작</button></div></div><section id="kk-results" class="kk-results" aria-live="polite"></section>
  <dialog id="kk-rules-dialog"><h2>호돈 쿵쿵따 규칙</h2><p>2~10명 개인전 · 세 글자 단어·등록 인명·지명 · 차례당 7초 · 목숨 3개</p><p>잘못 입력하면 남은 시간 안에 고칠 수 있습니다. 시간 초과 시 목숨 1개가 줄고, 0개가 되면 탈락합니다. 마지막 생존자가 우승합니다.</p><p>두음법칙은 ㄹ→ㄴ/ㅇ, ㄴ→ㅇ 방향으로 적용합니다. 이번 경기에서 이미 쓴 단어는 재사용할 수 없습니다. 한방단어도 허용하며, 이어가지 못하면 제한시간 종료 후 목숨이 1개 줄어듭니다. 제시어는 이어갈 단어가 있는 전체 후보에서 무작위로 뽑습니다.</p><p>한글 입력 후 Enter 한 번으로 전송합니다. 마지막 글자를 조합 중이면 글자 확정 후 전송합니다. 재접속해도 남은 시간은 초기화하지 않습니다.</p><p id="kk-dictionary-note"></p><p><a href="https://stdict.korean.go.kr/" target="_blank" rel="noopener">국립국어원 표준국어대사전</a> · <a href="https://krdict.korean.go.kr/" target="_blank" rel="noopener">국립국어원 한국어기초사전</a> · <a href="https://creativecommons.org/licenses/by-sa/2.0/kr/" target="_blank" rel="noopener">CC BY-SA 2.0 KR</a></p><p>표준국어대사전·한국어기초사전의 세 글자 명사류에 유명 인물 이름과 호칭·생활어를 보완했습니다. 예: 차인표, 표인봉, 소장님, 무생채, 봉수대, 비빔면, 등갈비. 등록 목록으로 판정하며 임의 문자열은 인정하지 않습니다. 넷마블 공식 단어 목록과는 다릅니다.</p><button type="button" id="kk-rules-close">닫기</button></dialog>`;
  const input=$('kk-word-input'),form=$('kk-word-form');
  // IME event order differs between browsers. Commit the final syllable first,
  // then submit once; there is no timing window in which Enter is discarded.
  function flushCompositionSubmit(){
   const job=compositionSubmit;if(!job)return;
   setTimeout(()=>{if(compositionSubmit!==job||composing)return;compositionSubmit=null;
    const g=ctx?.state?.kkung;if(roomKey===job.room&&g?.id===job.gameId&&g.revision===job.revision&&ownTurn())form.requestSubmit();
   },0);
  }
  input.addEventListener('compositionstart',()=>{composing=true;compositionSubmit=null;});
  input.addEventListener('compositionend',()=>{composing=false;flushCompositionSubmit();});
  input.addEventListener('keydown',e=>{
   if(e.key!=='Enter'&&e.code!=='NumpadEnter'&&e.code!=='Enter')return;
   if(e.repeat){e.preventDefault();return;}
   if(e.isComposing||e.keyCode===229||composing){
    // Let the IME's default Enter action commit the last syllable.
    if(!composing&&!e.isComposing)e.preventDefault();
    const g=ctx?.state?.kkung;if(!ownTurn())return;
    compositionSubmit={room:roomKey,gameId:g.id,revision:g.revision};if(!composing)flushCompositionSubmit();return;
   }
   e.preventDefault();compositionSubmit=null;form.requestSubmit();
  });
  form.addEventListener('submit',async e=>{
   e.preventDefault();if(busy||composing||compositionSubmit||!ownTurn())return;
   compositionSubmit=null;
   const value=input.value,g=ctx.state.kkung;
   if(!value.trim()){message('세 글자 단어를 입력하세요.');input.focus({preventScroll:true});return;}
   const pending={room:roomKey,gameId:g.id,revision:g.revision,word:value};pendingSubmission=pending;busy=true;updateControls();message(`${value.trim()} 전송 중…`);
   try{
    const res=await request('kkung:submit',{word:value,gameId:g.id,revision:g.revision});
    // A newer server turn/room may already be visible before this reply arrives.
    if(pendingSubmission!==pending)return;
    if(res.ok){message('전송 완료 · 결과를 반영하고 있습니다…');}
    else{pendingSubmission=null;busy=false;message(res.error||'단어를 다시 확인해 주세요.');updateControls();if(ownTurn())input.focus({preventScroll:true});}
   }catch(error){if(pendingSubmission===pending){pendingSubmission=null;busy=false;message('전송하지 못했습니다. 연결을 확인하고 다시 입력해 주세요.');updateControls();if(ownTurn())input.focus({preventScroll:true});}}
  });
  $('kk-start').onclick=async()=>{if(busy)return;busy=true;updateControls();const res=await request('game:start');busy=false;if(!res.ok)message(res.error);updateControls();};
  $('kk-leave').onclick=()=>ctx.leave();$('kk-invite').onclick=()=>ctx.invite();
  $('kk-resign').onclick=async()=>{const g=ctx.state.kkung;if(!g||!confirm('이번 쿵쿵따 경기를 기권할까요?'))return;const res=await request('kkung:resign',{gameId:g.id});if(!res.ok)message(res.error);};
  $('kk-rules-button').onclick=()=>$('kk-rules-dialog').showModal();$('kk-rules-close').onclick=()=>$('kk-rules-dialog').close();
  $('kk-chat-form').onsubmit=async e=>{e.preventDefault();const input=$('kk-chat-input'),text=input.value;if(!text.trim())return;const res=await request('kkung:chat',{text});if(res.ok&&input.value===text)input.value='';else if(!res.ok)message(res.error);};
 }
 function updateControls(){
  if(!ctx||ctx.state.gameType!=='kkung'||!$('kk-submit'))return;const g=ctx.state.kkung,playing=g?.status==='playing';
  $('kk-word-form').setAttribute('aria-busy',String(busy));$('kk-submit').disabled=busy||!ownTurn();$('kk-word-input').disabled=busy||!ownTurn();$('kk-word-input').placeholder=playing?(ownTurn()?'세 글자 단어를 입력하세요':'다른 참가자의 차례입니다'):'게임 시작 후 입력할 수 있습니다';
  $('kk-start').hidden=playing||ctx.isSpectator||ctx.seat!==ctx.state.host;$('kk-start').disabled=busy||ctx.state.players.filter(p=>p?.connected).length<2;$('kk-start').textContent=g?'다시 플레이':'게임 시작';
  $('kk-resign').hidden=!playing||ctx.isSpectator||!g.players[ctx.seat]?.lives;$('kk-leave').textContent=ctx.leaveText;
 }
 function effect(g){
  const e=g.lastEvent;if(!e||seen.has(e.id))return;seen.add(e.id);if(seen.size>120)seen.delete(seen.values().next().value);
  if(e.kind==='correct')ctx.sound('capture','kk:'+e.id);
  else if(e.kind==='win')ctx.sound('win','kk:'+e.id);
  else if(e.kind==='timeout'||e.kind==='eliminated')ctx.sound('move','kk:'+e.id);
  else if(e.kind==='start'){const code=roomKey;for(const [i,kind]of ['alk-hit','alk-hit','select'].entries())effectTimers.push(setTimeout(()=>{if(roomKey===code&&ctx?.state.gameType==='kkung'&&!$('kkung-section').classList.contains('hidden'))ctx.sound(kind,'kk:'+e.id+':'+i)},i*180));}
 }
 function render(context){
  ctx=context;const s=ctx.state,g=s.kkung,root=$('kkung-section');root.classList.remove('hidden');
  for(const id of ['landing','room-section','badugi-section','gomoku-section','seotda-section','poker-section','alkkagi-section'])$(id)?.classList.add('hidden');
  if(roomKey!==s.code||!$('kk-word-form')){roomKey=s.code;busy=false;composing=false;compositionSubmit=null;pendingSubmission=null;clockKey='';turnKey='';seen.clear();effectTimers.forEach(clearTimeout);effectTimers=[];init(root);}
  if(g?.id&&gameKey!==g.id){gameKey=g.id;busy=false;composing=false;compositionSubmit=null;pendingSubmission=null;$('kk-word-input').value='';message('');}
  if(pendingSubmission&&(g?.id!==pendingSubmission.gameId||g?.revision!==pendingSubmission.revision||g?.status!=='playing')){const pending=pendingSubmission;pendingSubmission=null;busy=false;message(g?.history?.some(h=>h.seat===ctx.seat&&h.word===pending.word.normalize('NFC').trim())?'정답! 다음 참가자 차례입니다.':'');}
  $('kk-code').textContent=s.code;$('kk-word').innerHTML=[...(g?.word||'쿵쿵따')].map((ch,i)=>`<span class="${i===2?'last':''}">${esc(ch)}</span>`).join('');
  $('kk-chain-help').innerHTML=g?.status==='playing'?`<strong>${esc((g.heads||[g.word.at(-1)]).join(' · '))}</strong>(으)로 시작하는 세 글자!`:g?`🏆 ${esc(g.players[g.winner]?.name||'경기 종료')} 우승!`:'두 명부터 바로 시작할 수 있습니다';
  $('kk-history').innerHTML=(g?.history||[]).slice(-5).map((h,i)=>`<div>${i?'<small>↓</small>':''}<span>${esc(h.word)}</span></div>`).join('')||'<span>경기 시작 후<br>단어가 쌓입니다</span>';
  const key=g?.status==='playing'?g.id+':'+g.revision+':'+g.turn:'idle:'+g?.id;
  if(key!==turnKey){turnKey=key;compositionSubmit=null;if(!ownTurn())$('kk-word-input').value='';const banner=$('kk-turn-banner');banner.textContent=g?.status==='playing'?`${g.players[g.turn].name}님 차례입니다`:g?'최종 순위가 결정되었습니다':'친구들과 함께 쿵! 쿵! 따!';banner.classList.remove('arrive');void banner.offsetWidth;banner.classList.add('arrive');if(ownTurn()&&!composing){message('');$('kk-word-input').disabled=false;$('kk-word-input').focus({preventScroll:true});}}
  const participantKey=JSON.stringify([s.players,g?.players,g?.turn,g?.status,ctx.seat,ctx.isSpectator]);const stage=$('kk-player-stage');
  if(stage.dataset.snapshot!==participantKey){stage.dataset.snapshot=participantKey;stage.style.setProperty('--kk-seats',s.players.length);stage.style.setProperty('--kk-mobile-seats',Math.min(s.players.length,5));stage.innerHTML=s.players.map((p,i)=>{
   const player=g?.players[i],active=g?.status==='playing'&&g.turn===i,mine=!ctx.isSpectator&&ctx.seat===i,dead=!!g&&player?.lives===0,character=player?.character??i;
   return `<div class="kk-seat${active?' active':''}${mine?' mine':''}${dead?' eliminated':''}${!p?' empty':''}" data-seat="${i}" aria-label="${esc(player?.name||p?.name||'빈자리')}${active?' 현재 차례':''}"><div class="kk-avatar" style="--kk-character-x:${character%5*25}%;--kk-character-y:${Math.floor(character/5)*100}%" aria-hidden="true"></div><div class="kk-plinth"><strong title="${esc(player?.name||p?.name||'입장 대기')}">${esc(player?.name||p?.name||'입장 대기')}${mine?' <small>(나)</small>':''}</strong><div class="kk-hearts" aria-label="남은 목숨 ${player?.lives??3}개">${Array.from({length:3},(_,n)=>`<span class="${n<(player?.lives??3)?'full':'lost'}">♥</span>`).join('')}</div><small class="kk-score">${dead?player.retired?'기권 · 관전':'탈락 · 관전':!p?'빈자리':g?player?`${player.score}점${p.connected?'':' · 재접속 대기'}`:'다음 경기 참여':p.connected?'준비 완료':'재접속 대기'}</small></div></div>`;
  }).join('');}
  const watchers=s.spectators||[];$('kk-watch-title').textContent=`관전자 ${watchers.length}명`;$('kk-watchers').textContent=watchers.length?watchers.map(w=>w.name+(w.connected?'':' · 오프라인')).join(', '):'관전자가 입장하면 표시됩니다.';
  const chat=$('kk-chat-log'),chatKey=JSON.stringify(s.kkungChat||[]);if(chat.dataset.snapshot!==chatKey){chat.dataset.snapshot=chatKey;chat.innerHTML=(s.kkungChat||[]).map(c=>`<p><strong>${esc(c.name)}${c.watcher?' (관전)':''}</strong> ${esc(c.text)}</p>`).join('')||'<p>친구들과 대화를 나눠 보세요.</p>';chat.scrollTop=chat.scrollHeight;}
  const dk=g?.dictionary;$('kk-dictionary-note').textContent=`확장 사전 총 ${dk?.count?.toLocaleString()||'158,408'}개 · 국어 사전 + 국가·도시·인명·생활 명사 확장`;
  const results=$('kk-results');results.hidden=g?.status!=='finished'||dismissed===g?.id;if(g?.status==='finished'){const resultKey=g.id+':'+g.revision+':'+s.host+':'+ctx.seat+':'+ctx.isSpectator;if(results.dataset.snapshot!==resultKey){results.dataset.snapshot=resultKey;results.innerHTML=`<h2>🏆 ${esc(g.players[g.winner]?.name||'최종')} 우승!</h2><ol>${g.placements.map(p=>`<li><b>${p.rank}등</b> ${esc(p.name)} <span>${p.score}점${p.retired?' · 기권':''}</span></li>`).join('')}</ol><button id="kk-result-close" type="button">게임 화면으로</button>${!ctx.isSpectator&&ctx.seat===s.host?'<button id="kk-play-again" type="button">다시 플레이</button>':''}`;$('kk-result-close').onclick=()=>{dismissed=g.id;results.hidden=true};if($('kk-play-again'))$('kk-play-again').onclick=()=>$('kk-start').click();}}
  const ck=g?.status==='playing'?g.id+':'+g.deadline:'';if(ck!==clockKey){clockKey=ck;clockStart=now();clockLeft=ck?Math.max(0,g.deadline-(s.serverNow||Date.now())):0;}
  if(g)effect(g);updateControls();tick();
 }
 function tick(){
  if(!ctx||ctx.state.gameType!=='kkung'||$('kkung-section')?.classList.contains('hidden'))return;const g=ctx.state.kkung,playing=g?.status==='playing',remaining=playing?Math.max(0,clockLeft-(now()-clockStart)):0,seconds=Math.ceil(remaining/1000),clock=$('kk-clock');if(!clock)return;
  const label=playing?`남은 시간 ${seconds}초`:g?'경기 종료':'게임 대기 중';if(clock.textContent!==label)clock.textContent=label;
  $('kk-time-fill').style.transform=`scaleX(${playing?Math.min(1,remaining/((g.turnSeconds||7)*1000)):1})`;$('kk-time-fill').classList.toggle('critical',playing&&seconds<=5);
  if(playing&&seconds>0&&seconds<=5&&ownTurn()&&!document.hidden){const key=clockKey+':'+seconds;if(!seen.has(key)){seen.add(key);ctx.sound('countdown-'+seconds,'kk:'+key);}}
 }
 function hide(){const dialog=$('kk-rules-dialog');if(dialog?.open)dialog.close();effectTimers.forEach(clearTimeout);effectTimers=[];ctx=null;roomKey='';composing=false;compositionSubmit=null;pendingSubmission=null;busy=false;}
 setInterval(tick,50);return {render,hide};
})();
