// Public lobby: table browser, profile/create/join dialogs, and server-backed chat.
function lobbyGameName(type){return {yut:'윷놀이',badugi:'바둑이',gomoku:'오목',seotda:'섯다',poker:'7포커',alkkagi:'장기알까기'}[type]||'게임';}
function lobbyRoomTitle(r){return r.roomTitle||`${r.hostName||'친구'}의 ${lobbyGameName(r.gameType)}방`;}
function renderLobbyControls(){
 if(state){for(const id of ['create-dialog','profile-dialog','join-dialog'])closeLobbyDialog(id,false,true);return;}
 const person={avatarId:selectedAvatar},avatar=$('lobby-profile-avatar');if(avatar){const key=String(selectedAvatar);if(avatar.dataset.profileAvatar!==key){avatar.innerHTML=avatarHtml(person);avatar.dataset.profileAvatar=key;}}
 const name=$('nickname').value.trim()||'닉네임 설정';$('lobby-profile-name').textContent=name;
 $('lobby-current-game').textContent=lobbyGameName(chosenGame);$('create-game').value=chosenGame;
 $('create-dialog-title').textContent='방 만들기';$('create').textContent='방 만들고 입장';
 $('tab-all').classList.toggle('selected',lobbyFilter==='all');
 for(const type of ['yut','badugi','gomoku','seotda','poker','alkkagi'])$('tab-'+type).classList.toggle('selected',lobbyFilter===type);
 const input=$('room-title'),automatic=($('nickname').value.trim()||'호돈')+'의 '+lobbyGameName(chosenGame)+'방';if(!input.value||input.value===input.dataset.autoTitle){input.value=automatic;input.dataset.autoTitle=automatic;}
}
function showLobbyDialog(id,focusId){
 if(state)return;const dialog=$(id);if(!dialog||dialog.open)return;
 for(const other of ['create-dialog','profile-dialog','join-dialog'])if(other!==id)closeLobbyDialog(other,false,true);
 lobbyDialogFocus=document.activeElement;
 try{if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');}catch{dialog.setAttribute('open','');}
 if(focusId)$(focusId)?.focus();
}
function closeLobbyDialog(id,cancelled=true,force=false){
 const dialog=$(id);if(!dialog?.open)return;
 if(id==='create-dialog'&&createBusy&&!force){notify('방을 만들고 있습니다. 잠시 기다려 주세요.');return;}
 if(id==='profile-dialog'&&cancelled&&lobbyProfileSnapshot){$('nickname').value=lobbyProfileSnapshot.name;selectedAvatar=lobbyProfileSnapshot.avatar;localStorage.setItem('hodon:avatar',String(selectedAvatar));renderAvatarPicker();lobbyAfterProfile=null;}
 try{if(dialog.close)dialog.close();else dialog.removeAttribute('open');}catch{dialog.removeAttribute('open');}
 if(!force){renderLobbyControls();if(lobbyDialogFocus?.isConnected)lobbyDialogFocus.focus();}
}
function openLobbyProfile(next=null){
 if(state)return;const name=$('nickname').value;lobbyProfileSnapshot={name,avatar:selectedAvatar};lobbyAfterProfile=next;showLobbyDialog('profile-dialog','nickname');
}
function withLobbyProfile(next){if(!$('nickname').value.trim()){openLobbyProfile(next);return;}next();}
function openLobbyCreate(){withLobbyProfile(()=>{renderGameHub();showLobbyDialog('create-dialog','room-title');});}
function openLobbyCode(){withLobbyProfile(()=>showLobbyDialog('join-dialog','joincode'));}
function lobbyMode(r){return r.gameType==='alkkagi'?'2인 대전 · 드래그 발사 · 고정 장애물':r.gameType==='yut'?(r.matchMode==='team'?'2대2 팀전 · 공용 말 3개':'개인전 · 말 '+r.piecesPerPlayer+'개'):r.gameType==='seotda'?r.seotdaCards+'장 · 릴레이':r.gameType==='gomoku'?'국제 렌주 · '+r.gomokuMinutes+'분':r.gameType==='poker'?'7포커 · '+(r.pokerRule==='choice'?'초이스':'일반'):'4장 바둑이';}
function renderPublicLobby(){
 const root=$('public-lobby');if(!root)return;root.hidden=!!state;document.body.classList.toggle('public-lobby-open',!state);if(state)return;
 renderLobbyControls();
 const query=($('lobby-search')?.value||'').trim().toLocaleLowerCase(),only=$('lobby-open-only')?.checked;
 const list=lobbyRooms.filter(r=>['yut','badugi','gomoku','seotda','poker','alkkagi'].includes(r.gameType)&&(lobbyFilter==='all'||r.gameType===lobbyFilter)&&(!only||r.canJoin)&&(!query||(lobbyRoomTitle(r)+' '+r.hostName+' '+lobbyGameName(r.gameType)).toLocaleLowerCase().includes(query)));
 document.querySelectorAll('[data-lobby-filter]').forEach(b=>{const selected=b.dataset.lobbyFilter===lobbyFilter;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
 $('lobby-status').textContent=!socket.connected?'서버 연결을 확인하고 있습니다.':!lobbyLoaded?'방 목록을 불러오고 있습니다.':'열린 방 '+list.length+'개';
 const pages=Math.max(1,Math.ceil(list.length/8));lobbyPage=Math.max(1,Math.min(lobbyPage,pages));const visible=list.slice((lobbyPage-1)*8,lobbyPage*8);
 const rows=$('lobby-room-list');rows.replaceChildren();
 if(!visible.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.className='lobby-empty';td.textContent=!lobbyLoaded?'열린 방을 확인하고 있습니다.':query||only?'조건에 맞는 방이 없습니다. 검색이나 필터를 바꿔 보세요.':'아직 열린 방이 없습니다. 방 만들기로 첫 방을 열어 보세요.';tr.append(td);rows.append(tr);}
 for(const r of visible){
  const tr=document.createElement('tr');tr.className='lobby-room-card';tr.dataset.roomCode=r.code;tr.dataset.gameType=r.gameType;
  const status=r.status==='playing'?'진행 중':r.canJoin?'대기 중':r.status==='waiting'?'정원 마감':'경기 종료',money=['seotda','badugi','poker'].includes(r.gameType)?chip(r.base):'—';
  const blocked=lobbyJoinBusy||!socket.connected;
  tr.innerHTML=`<td>${lobbyGameName(r.gameType)}</td><td><h2>${lobbyEscape(lobbyRoomTitle(r))}</h2><span class="lobby-room-detail">${lobbyEscape(lobbyMode(r))} · 방장 ${lobbyEscape(r.hostName)} · 관전 ${r.spectators||0}명</span></td><td class="lobby-room-people">${r.occupied} / ${r.playerCount}명</td><td>${lobbyEscape(money)}</td><td><span class="lobby-room-state ${r.canJoin?'open':''}">${status}</span></td><td><div class="lobby-room-actions"><button type="button" data-lobby-enter="${lobbyEscape(r.code)}" ${r.canJoin&&!blocked?'':'disabled'}>${r.canJoin?'입장':r.status==='playing'?'진행 중':'정원 마감'}</button><button type="button" data-lobby-watch="${lobbyEscape(r.code)}" ${blocked?'disabled':''}>관전</button></div></td>`;
  tr.querySelector('[data-lobby-enter]').onclick=()=>enterLobbyRoom(r.code,false);tr.querySelector('[data-lobby-watch]').onclick=()=>enterLobbyRoom(r.code,true);tr.ondblclick=e=>{if(e.target.closest('button'))return;if(r.canJoin)enterLobbyRoom(r.code,false);};rows.append(tr);
 }
 $('lobby-room-summary').textContent=list.length?`${(lobbyPage-1)*8+1}–${Math.min(lobbyPage*8,list.length)} / ${list.length}개 방`:'방을 만들거나 새로고침하세요';
 const pagination=$('lobby-pages');pagination.replaceChildren();const addPage=(label,target,disabled=false,current=false)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled;b.setAttribute('aria-label',current?target+'페이지':label==='‹'?'이전 페이지':label==='›'?'다음 페이지':target+'페이지');if(current)b.setAttribute('aria-current','page');b.onclick=()=>{lobbyPage=target;renderPublicLobby();};pagination.append(b);};
 addPage('‹',lobbyPage-1,lobbyPage===1);const first=Math.max(1,Math.min(lobbyPage-2,pages-4));for(let p=first;p<=Math.min(pages,first+4);p++)addPage(String(p),p,false,p===lobbyPage);addPage('›',lobbyPage+1,lobbyPage===pages);
 $('lobby-network').textContent=socket.connected?'● 서버 연결됨':'● 재연결 중';$('lobby-network').classList.toggle('off',!socket.connected);$('lobby-chat-input').disabled=!socket.connected;$('lobby-chat-send').disabled=!socket.connected||lobbyChatBusy;
}
async function enterLobbyRoom(code,watch){
 if(lobbyJoinBusy||state)return;if(!$('nickname').value.trim()){openLobbyProfile(()=>enterLobbyRoom(code,watch));return;}
 lobbyJoinBusy=true;renderPublicLobby();try{await join(code,watch)}finally{lobbyJoinBusy=false;renderPublicLobby();}
}
function renderLobbyChat(){
 const root=$('lobby-chat-log');if(!root)return;const atBottom=root.scrollHeight-root.scrollTop-root.clientHeight<35;root.replaceChildren();
 if(!lobbyChats.length){const p=document.createElement('p');p.className='lobby-chat-empty';p.textContent='대기실에 오신 것을 환영합니다. 친구들과 이야기를 나눠 보세요.';root.append(p);}
 for(const row of lobbyChats.slice(-80)){
  const p=document.createElement('p'),time=document.createElement('time'),name=document.createElement('strong'),message=document.createTextNode(' : '+row.text);time.textContent='['+new Date(row.at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})+'] ';name.textContent=row.name;time.dateTime=new Date(row.at).toISOString();p.append(time,name,message);root.append(p);
 }
 if(atBottom||lobbyChats.at(-1)?.name===$('nickname').value.trim())root.scrollTop=root.scrollHeight;
}
async function sendLobbyChat(){
 if(lobbyChatBusy||state)return;const input=$('lobby-chat-input'),text=input.value.trim();if(!text)return;if(!$('nickname').value.trim()){openLobbyProfile(sendLobbyChat);return;}
 lobbyChatBusy=true;$('lobby-chat-send').disabled=true;try{const res=await action('lobby:chat',{name:$('nickname').value.trim(),avatarId:selectedAvatar,text});if(res&&input.value.trim()===text)input.value='';}finally{lobbyChatBusy=false;$('lobby-chat-send').disabled=!socket.connected;}
}
function initializeLobby(){
 $('lobby-create').onclick=openLobbyCreate;$('lobby-profile-edit').onclick=()=>openLobbyProfile();$('lobby-code').onclick=openLobbyCode;
 $('lobby-refresh').onclick=async()=>{const res=await action('lobby:watch');if(res){lobbyRooms=res.rooms||[];lobbyChats=res.chats||lobbyChats;lobbyLoaded=true;renderPublicLobby();renderLobbyChat();}};
 for(const b of document.querySelectorAll('[data-lobby-filter]'))b.onclick=()=>{lobbyFilter=b.dataset.lobbyFilter;lobbyPage=1;if(lobbyFilter!=='all')chosenGame=lobbyFilter;renderGameHub();};
 $('tab-all').onclick=()=>{if(state){notify('현재 방에서 나간 뒤 대기실로 이동해 주세요.');return;}lobbyFilter='all';lobbyPage=1;renderGameHub();};
 $('lobby-search').addEventListener('input',()=>{lobbyPage=1;renderPublicLobby();});$('lobby-open-only').addEventListener('change',()=>{lobbyPage=1;renderPublicLobby();});
 $('create-game').onchange=e=>{if(createBusy)return;chosenGame=e.target.value;localStorage.setItem('hodon:last-game',chosenGame);renderGameHub();};
 $('room-title').addEventListener('input',()=>delete $('room-title').dataset.autoTitle);
 $('profile-save').onclick=()=>{const name=$('nickname').value.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,14);if(!name){notify('닉네임을 입력해 주세요.');$('nickname').focus();return;}$('nickname').value=name;localStorage.setItem('field-yut:name',name);localStorage.setItem('hodon:avatar',String(selectedAvatar));const next=lobbyAfterProfile;lobbyAfterProfile=null;lobbyProfileSnapshot=null;closeLobbyDialog('profile-dialog',false);renderPublicLobby();if(next)next();};
 for(const b of document.querySelectorAll('[data-dialog-close]'))b.onclick=()=>closeLobbyDialog(b.dataset.dialogClose);
 for(const id of ['create-dialog','profile-dialog','join-dialog']){const dialog=$(id);dialog.addEventListener('cancel',e=>{e.preventDefault();closeLobbyDialog(id);});dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeLobbyDialog(id);});}
 $('lobby-chat-form').onsubmit=e=>{e.preventDefault();sendLobbyChat();};
 renderPublicLobby();renderLobbyChat();
}
