/* Stadium presentation. Engines, action handlers and authenticated sessions remain in app.js. */
globalThis.HodonStadium=(()=>{
 const games={yut:['윷놀이','2–10명','함께 달리는 한 판'],badugi:['바둑이','2–4명','네 장의 승부'],gomoku:['오목','2명','한 수의 짜릿함'],seotda:['섯다','2–5명','패를 여는 순간'],poker:['7포커','2–5명','마지막 한 장까지'],alkkagi:['알까기','2명','손끝으로 골인!'],kkung:['쿵쿵따','2–10명','세 글자의 즐거움'],sichuan:['사천성','2–10명','같은 그림을 찾아요']};
 const $=id=>document.getElementById(id),safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let ctx=null,records=null,busy=null,lastFetch=0,profileError='',socketHook=null,lastRecords=null;
 const credential=()=>localStorage.getItem('hodon:profile')||localStorage.getItem('hodon:sichuan:credential')||'';
 async function ensureProfile(socket,name){
  if(busy)return busy;if(!socket?.connected)return null;
  busy=new Promise(resolve=>socket.timeout(8000).emit('player:profile',{credential:credential()||undefined,name:name||localStorage.getItem('field-yut:name')||'호돈'},(error,res)=>resolve(error?{ok:false,error:'기록 서버 연결이 지연되고 있습니다.'}:res))).then(res=>{
   if(!res?.ok){profileError=res?.error||'기록을 연결하지 못했습니다.';return null;}
   localStorage.setItem('hodon:profile',res.credential);localStorage.setItem('hodon:sichuan:credential',res.credential);records=res.records;profileError='';lastFetch=Date.now();paintRank();return res;
  }).finally(()=>busy=null);return busy;
 }
 function illustration(type){
  if(['badugi','poker'].includes(type))return '<div class="mini-felt"><span>♠</span><span>♥</span><span>♣</span><i>♦</i></div>';
  if(type==='gomoku'||type==='alkkagi')return `<div class="mini-board ${type}">${Array.from({length:7},(_,i)=>`<i style="--i:${i}">${type==='alkkagi'?(i%2?'楚':'漢'):''}</i>`).join('')}</div>`;
  if(type==='seotda')return '<div class="mini-hwatu"><img src="/hwatu/0.svg" alt=""><img src="/hwatu/2.svg" alt=""><img src="/hwatu/6.svg" alt=""></div>';
  if(type==='kkung')return '<div class="mini-word"><b>쿵</b><b>쿵</b><b>따</b></div>';
  if(type==='sichuan')return '<div class="mini-tiles">'+['🍉','🍊','🍇','🍉','🍊','🍇'].map(t=>'<i>'+t+'</i>').join('')+'</div>';
  return '<svg class="mini-yut" viewBox="0 0 180 86"><path d="M40 14H140V73H40ZM40 14L140 73M140 14L40 73" fill="#51ba85" stroke="#f7d884" stroke-width="4"/>'+[[40,14],[90,14],[140,14],[40,43],[90,43],[140,43],[40,73],[90,73],[140,73]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="6" fill="#fff2c8" stroke="#d0a046"/>`).join('')+'</svg>';
 }
 function mount(){
  const sidebar=document.querySelector('.lobby-sidebar'),browser=document.querySelector('.lobby-browser');if(!sidebar||!browser)return;
  if(!$('stadium-rank')){
   const banner=document.createElement('div');banner.className='stadium-arena-banner';banner.innerHTML='<strong id="stadium-banner-title"></strong>';document.querySelector('header').after(banner);
   const rank=document.createElement('section');rank.className='stadium-rank';rank.id='stadium-rank';rank.innerHTML='<div id="stadium-rank-content"></div><button id="stadium-rank-retry" type="button" hidden>기록 다시 연결</button>';sidebar.append(rank);$('stadium-rank-retry').onclick=()=>void ensureProfile(ctx.socket,ctx.name);
   const grid=document.createElement('section');grid.id='stadium-games';grid.className='stadium-games';grid.setAttribute('aria-label','게임 선택');
   grid.innerHTML=Object.entries(games).map(([id,[name,count,tag]])=>`<button type="button" class="stadium-game-card" data-stadium-game="${id}" aria-pressed="false"><span class="stadium-card-art">${illustration(id)}</span><span class="stadium-card-copy"><strong>${name}</strong><small>${tag}</small></span><span class="stadium-card-count">${count}</span></button>`).join('');browser.before(grid);grid.addEventListener('click',e=>{const b=e.target.closest('[data-stadium-game]');if(b)ctx?.choose(b.dataset.stadiumGame);});
   const all=document.createElement('button');all.type='button';all.className='stadium-all-rooms';all.textContent='전체 방';all.onclick=()=>ctx?.choose('all');document.querySelector('.lobby-heading>div').append(all);
   const label=document.createElement('div');label.className='stadium-welcome';label.innerHTML='<span>HODON STADIUM</span><strong>오늘도, 즐겁게 한 판!</strong><small>친구들과 함께하는 우리들의 게임 스타디움</small>';const lobby=$('public-lobby');lobby.before(label);
   const bar=document.createElement('div');bar.id='stadium-match-rank';bar.className='stadium-match-rank';bar.hidden=true;document.querySelector('main').prepend(bar);
  }
 }
 function paintRank(){
  if(!ctx||!$('stadium-rank-content'))return;const type=ctx.chosenGame||'yut',r=records?.[type],title=games[type]?.[0]||'게임';
  const progress=r?(r.nextXp?Math.max(0,Math.min(100,(r.xp-r.tierXp)/(r.nextXp-r.tierXp)*100)):100):0;
  $('stadium-rank-content').innerHTML=`<h3>${title} <span>내 기록</span></h3><div class="rank-medal" aria-hidden="true">${r?.god?'♛':'★'}</div><strong class="rank-tier">${safe(r?.tier||'초보')}</strong><div class="rank-level">Lv.${r?.level||1} <span>${r?Math.round(progress)+'%':'기록 연결 중'}</span></div><div class="rank-track" role="progressbar" aria-label="${title} 다음 계급까지 경험치" aria-valuenow="${Math.round(progress)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${progress}%"></i></div><p class="rank-xp">${r?`${r.xp.toLocaleString()} XP${r.nextXp?' / '+r.nextXp.toLocaleString()+' XP':' · 유일한 갓'}`:safe(profileError||'게임별로 경험치가 따로 쌓여요')}</p><div class="rank-stats"><span>승률<b>${r?.winRate||0}%</b></span><span>승리<b>${r?.wins||0}승</b></span><span>경기<b>${r?.played||0}전</b></span></div><div class="rank-steps"><span>초보</span><span>중수</span><span>고수</span><span>개고수</span><span>신</span><span>갓</span></div><small class="rank-note">중수부터 신까지 동 · 은 · 금<br>각 게임의 갓은 단 한 명!</small>`;
  $('stadium-rank-retry').hidden=!profileError;
 }
 function paintArena(){
  if(!ctx?.state)return;const s=ctx.state,type=s.gameType,g=s[type==='yut'?'game':type],bar=$('stadium-match-rank');
  const original=$(({yut:'start',badugi:'badugi-start',gomoku:'gom-start',seotda:'seotda-start',poker:'poker-start',alkkagi:'alk-start',kkung:'kk-start',sichuan:'sc-start'})[type]);
  if(bar&&original&&!ctx.isSpectator&&ctx.seat===s.host&&(!g||g.status==='finished')&&!bar.querySelector('.stadium-start')){const b=document.createElement('button');b.type='button';b.className='stadium-start';b.textContent=original.textContent;b.disabled=original.disabled;b.onclick=()=>original.click();bar.append(b);}
  document.querySelectorAll('.badugi-seat[data-seat],.poker-seat[data-seat],.seotda-seat[data-seat]').forEach(el=>{const i=Number(el.dataset.player??el.dataset.seat),p=s.players[i];if(!p){el.classList.add('stadium-empty-seat');return;}el.classList.remove('stadium-empty-seat');el.style.setProperty('--stadium-character',`url(/hodon-piece-${p.avatarId??0}.svg)`);el.classList.add('stadium-character-seat');});
 }
 function render(c){
  ctx=c;document.body.classList.add('stadium-theme');mount();if(!c.socket)return;
  if(socketHook!==c.socket){socketHook=c.socket;c.socket.on('connect',()=>{lastFetch=0;void ensureProfile(c.socket,ctx?.name);});}
  if(c.state?.myRecords&&lastRecords!==c.state.myRecords){records=c.state.myRecords;lastRecords=records;lastFetch=Date.now();}
  if(c.socket.connected&&!busy&&Date.now()-lastFetch>20000){lastFetch=Date.now();void ensureProfile(c.socket,c.name);}
  document.querySelectorAll('[data-stadium-game]').forEach(b=>{const active=b.dataset.stadiumGame===c.chosenGame;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
  const id=Math.max(0,Math.min(9,c.selectedAvatar||0)),profile=$('lobby-profile-avatar'),brand=document.querySelector('.brand-face');
  if(profile){let img=profile.querySelector('img');if(img){const src=`/hodon-piece-${id}.svg`;if(img.getAttribute('src')!==src)img.src=src;img.alt='내 호돈 캐릭터';}}
  if($('stadium-banner-title'))$('stadium-banner-title').textContent='호돈 '+(games[c.state?.gameType||c.chosenGame]?.[0]||'게임방');
  if(brand){const src=`/hodon-avatar-${id}.svg`;if(brand.getAttribute('src')!==src)brand.src=src;}
  globalThis.requestAnimationFrame?.(paintArena);paintRank();const bar=$('stadium-match-rank');if(bar){bar.hidden=!c.state;const type=c.state?.gameType,r=records?.[type];if(c.state)bar.textContent=c.isSpectator?'관전 중 · '+games[type]?.[0]:`${games[type]?.[0]||'윷놀이'} · ${r?.tier||'초보'} · Lv.${r?.level||1} · ${r?.xp||0} XP · 승률 ${r?.winRate||0}%`;}
 }
 return{render,ensureProfile};
})();
