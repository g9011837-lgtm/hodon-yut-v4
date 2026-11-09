import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {Window} from 'happy-dom';
test('윷 시계: 모든 타이머를 함께 실행해도 초 숫자만 15→0, 같은 초에 문구 교대 없음',async()=>{
 const w=new Window({url:'http://localhost/'});w.document.write(readFileSync(new URL('./index.html',import.meta.url),'utf8'));let now=1000;const timers=[];
 const socket={connected:true,on(){},timeout(){return this},emit(){}};
 const ctx=vm.createContext({document:w.document,window:w,localStorage:w.localStorage,location:w.location,history:w.history,navigator:w.navigator,URLSearchParams,console,io:()=>socket,Date:class extends Date{static now(){return now}},setTimeout(){return 0},clearTimeout(){},setInterval(fn,period){timers.push({fn,period,next:now+period});return timers.length},clearInterval(){}});
 try{vm.runInContext(readFileSync(new URL('./app.js',import.meta.url),'utf8'),ctx);ctx.fixture={code:'CLOCK',gameType:'yut',game:{id:'one',status:'playing',turn:0,moves:[],turnDeadline:16000}};vm.runInContext('state=fixture;seat=0;isSpectator=false;updateActionCountdown()',ctx);
  const el=w.document.getElementById('turn-clock');assert.equal(el.textContent,'15초');
  let previous=15;for(now=1050;now<=16000;now+=50){for(const t of timers){if(now<t.next)continue;t.fn();t.next+=t.period;assert.match(el.textContent,/^\d+초$/,`timer ${t.period}ms at ${now}`);const n=Number(el.textContent.slice(0,-1));assert.ok(n<=previous,'countdown cannot jump upward');previous=n;}assert.equal(el.textContent,Math.max(0,Math.ceil((16000-now)/1000))+'초');}
  assert.equal(el.textContent,'0초');ctx.fixture.game.status='finished';vm.runInContext('updateActionCountdown()',ctx);assert.equal(el.textContent,'대기');assert.equal(el.classList.contains('turn-clock-critical'),false);
 }finally{await w.happyDOM.abort()}
});
