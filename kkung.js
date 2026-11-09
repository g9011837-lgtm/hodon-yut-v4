import {readFileSync} from 'node:fs';
import {randomUUID,createHash,randomInt} from 'node:crypto';

const source=JSON.parse(readFileSync(new URL('./kkung-dictionary.json',import.meta.url),'utf8'));
const extensions=source.extensions||[];
if(!Array.isArray(extensions)||extensions.some(name=>!/^kkung-extra-[0-9]+\.json$/.test(name)))throw Error('쿵쿵따 추가 사전 목록이 올바르지 않습니다.');
const parts=[source,...extensions.map(name=>JSON.parse(readFileSync(new URL('./'+name,import.meta.url),'utf8')))];
for(const part of parts){const ws=part.words;if(!Array.isArray(ws)||!ws.length||new Set(ws).size!==ws.length||ws.some(w=>typeof w!=='string'||! /^[가-힣]{3}$/.test(w))||ws.length!==part.metadata.count||createHash('sha256').update(ws.join('\n')).digest('hex')!==part.metadata.sha256)throw Error('쿵쿵따 사전 파일이 올바르지 않습니다.');}
const words=[...new Set(parts.flatMap(part=>part.words))].sort();
export const dictionaryInfo=Object.freeze({...source.metadata,count:words.length,sha256:createHash('sha256').update(words.join('\n')).digest('hex'),baseFileCount:source.words.length});
const dictionary=new Set(words),byHead=new Map();
for(const word of words){if(!byHead.has(word[0]))byHead.set(word[0],[]);byHead.get(word[0]).push(word);}
const hasAvailableFollower=(word,used)=>acceptedHeads(word.at(-1)).some(h=>(byHead.get(h)||[]).some(next=>next!==word&&!used.has(next)));
const startingWords=words.filter(word=>hasAvailableFollower(word,new Set()));

// Forward-only Korean word-chain initial-sound convention; reverse changes are not allowed.
export function acceptedHeads(char){
 const result=[char],n=char?.charCodeAt(0)-0xac00;if(!Number.isInteger(n)||n<0||n>11171)return result;
 const first=Math.floor(n/588),vowel=Math.floor(n%588/28),tail=n%28;
 let replacement=null;
 if(first===5)replacement=[2,6,7,12,17,20].includes(vowel)?11:2;
 else if(first===2&&[6,12,17,20].includes(vowel))replacement=11;
 if(replacement!==null)result.push(String.fromCharCode(0xac00+replacement*588+vowel*28+tail));return result;
}
export function isDictionaryWord(word){return dictionary.has(word);}
export function nextWords(last,used=[],exclude=''){
 const seen=used instanceof Set?used:new Set(used);return acceptedHeads(last).flatMap(h=>byHead.get(h)||[]).filter(w=>w!==exclude&&!seen.has(w));
}
export function isPlayable(word,used=[]){return dictionary.has(word)&&!(used instanceof Set?used:new Set(used)).has(word);}
const alive=g=>g.players.map((p,i)=>p?.lives>0?i:-1).filter(i=>i>=0);
function event(g,kind,seat,word='',extra={}){g.lastEvent={id:randomUUID(),kind,seat,word,...extra};g.events.push(g.lastEvent);if(g.events.length>60)g.events.shift();}
function finish(g,reason='마지막 생존자'){
 const remaining=alive(g);g.status='finished';g.deadline=null;g.reason=reason;
 const leaders=[...remaining].sort((a,b)=>g.players[b].score-g.players[a].score||a-b);g.winner=leaders[0]??null;
 const order=[...leaders,...g.eliminated.slice().reverse()];g.placements=order.map((seat,i)=>({seat,rank:i+1,name:g.players[seat].name,score:g.players[seat].score,retired:!!g.players[seat].retired}));event(g,'win',g.winner,'',{reason});
}
function nextSeat(g,from){for(let n=1;n<=g.players.length;n++){const i=(from+n)%g.players.length;if(g.players[i]?.lives>0)return i;}return null;}
function opening(g){
 const used=new Set(g.used);let selected=null;
 // Uniform rejection sampling over the entire eligible dictionary. No preferred words.
 for(let i=0;i<64&&!selected;i++){const candidate=startingWords[randomInt(startingWords.length)];if(!used.has(candidate)&&hasAvailableFollower(candidate,used))selected=candidate;}
 if(!selected){const choices=startingWords.filter(w=>!used.has(w)&&hasAvailableFollower(w,used));if(!choices.length){finish(g,'이어갈 수 있는 제시어 소진');return false;}selected=choices[randomInt(choices.length)];}
 g.word=selected;g.used.push(g.word);g.history.push({word:g.word,seat:null,round:g.round});if(g.history.length>200)g.history.shift();return true;
}
export function createKkung(players,{gameNo=1,now=Date.now()}={}){
 if(!Array.isArray(players)||players.length<2||players.length>10||players.filter(Boolean).length<2)throw Error('쿵쿵따는 참가자 2~10명이 필요합니다.');
 const g={id:randomUUID(),gameNo,status:'playing',revision:0,turn:players.findIndex(Boolean),turnSeconds:7,deadline:now+7000,round:1,word:'',used:[],history:[],events:[],lastEvent:null,eliminated:[],placements:[],winner:null,dictionary:{name:dictionaryInfo.name,count:words.length,version:dictionaryInfo.sha256,exportDate:dictionaryInfo.exports?.[0]?.exportDate||'2019'},players:players.map((p,i)=>p?{name:p.name,avatarId:p.avatarId??0,character:i,lives:3,score:0,retired:false}:null)};
 opening(g);event(g,'start',g.turn,g.word);return g;
}
export function submitKkung(g,seat,data={},now=Date.now()){
 if(!g||g.status!=='playing'||!Number.isInteger(seat)||!g.players[seat]?.lives||g.turn!==seat)throw Error('현재 차례인 참가자만 단어를 제출할 수 있습니다.');
 if(data.gameId!==g.id||data.revision!==g.revision)throw Error('차례가 변경되었습니다. 현재 단어를 확인해 주세요.');
 if(now>=g.deadline)throw Error('제한시간이 지났습니다.');
 if(typeof data.word!=='string'||data.word.length>32)throw Error('세 글자 단어를 입력하세요.');
 const word=data.word.normalize('NFC').trim();
 if(!/^[가-힣]{3}$/.test(word))throw Error('등록된 한글 세 글자 단어를 입력하세요.');
 if(g.used.includes(word))throw Error('이번 경기에서 이미 사용한 단어입니다.');
 if(!dictionary.has(word))throw Error('현재 게임 사전에 등록되지 않은 단어입니다.');
 if(!acceptedHeads(g.word.at(-1)).includes(word[0]))throw Error(`${acceptedHeads(g.word.at(-1)).join(' 또는 ')}(으)로 시작해야 합니다.`);
 g.word=word;g.used.push(word);g.history.push({word,seat,round:g.round});if(g.history.length>200)g.history.shift();g.players[seat].score+=10;g.revision++;g.turn=nextSeat(g,seat);g.deadline=now+7000;event(g,'correct',seat,word);return {word};
}
export function timeoutKkung(g,now=Date.now()){
 if(!g||g.status!=='playing'||now<g.deadline)return false;
 const seat=g.turn,p=g.players[seat];p.lives--;g.revision++;g.round++;
 if(!p.lives)g.eliminated.push(seat);event(g,p.lives?'timeout':'eliminated',seat,'',{lives:p.lives});
 if(alive(g).length<=1){finish(g);return true;}
 g.turn=nextSeat(g,seat);g.deadline=now+7000;opening(g);return true;
}
export function resignKkung(g,seat,now=Date.now()){
 if(!g||g.status!=='playing'||!Number.isInteger(seat)||!g.players[seat]?.lives)throw Error('현재 경기 참가자만 기권할 수 있습니다.');
 g.players[seat].lives=0;g.players[seat].retired=true;g.eliminated.push(seat);g.revision++;event(g,'resign',seat);
 if(alive(g).length<=1)finish(g);
 else if(g.turn===seat){g.turn=nextSeat(g,seat);g.deadline=now+7000;}
}
export function publicKkung(g){if(!g)return null;const {used,...publicState}=g;return structuredClone({...publicState,heads:acceptedHeads(g.word.at(-1))});}
