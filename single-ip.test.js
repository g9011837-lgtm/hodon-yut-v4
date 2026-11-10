import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {BlockList,isIP} from 'node:net';
import {randomBytes} from 'node:crypto';
import {readFileSync,readdirSync,copyFileSync,mkdtempSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {io as clientIo} from 'socket.io-client';

const source=readFileSync(new URL('./server.js',import.meta.url),'utf8');
const policy=source.split('// BEGIN SINGLE-IP POLICY:')[1].split('// END SINGLE-IP POLICY')[0].replace(/^.*\n/,'');
const helpers=vm.runInNewContext(policy+'\n;({normalizedIp,connectionIp,enabled:SINGLE_IP_ENABLED})',{BlockList,isIP,URL,Map,Error,randomBytes,process:{env:{}},io:{use(){}}});
const request=(remote,forwarded,extra={})=>({socket:{remoteAddress:remote},headers:{...(forwarded===undefined?{}:{'x-forwarded-for':forwarded}),...extra}});
test('IP 제한은 기본 활성화, IPv4 매핑·IPv6 표기를 같은 주소로 정규화',()=>{
 assert.equal(helpers.enabled,true);
 assert.equal(helpers.normalizedIp('::ffff:192.0.2.1'),'192.0.2.1');
 assert.equal(helpers.normalizedIp('::ffff:c000:201'),'192.0.2.1');
 assert.equal(helpers.normalizedIp('2001:db8:0:0:0:0:0:7'),'2001:db8::7');
 assert.equal(helpers.normalizedIp('[2001:db8::7]:443'),'2001:db8::7');
 for(const bad of ['unknown','198.51.100.1, 203.0.113.8','fe80::1%eth0','999.0.0.1',''])assert.equal(helpers.normalizedIp(bad),null);
});
test('직접 접속자가 조작한 프록시·Cloudflare 헤더로 IP를 바꿀 수 없음',()=>{
 assert.equal(helpers.connectionIp(request('198.51.100.10','203.0.113.1',{'cf-connecting-ip':'203.0.113.2','x-real-ip':'203.0.113.3'})),'198.51.100.10');
 assert.equal(helpers.connectionIp(request('::ffff:198.51.100.10','203.0.113.1')),'198.51.100.10');
});
test('Bonto형 사설 게이트웨이·Cloudflare 체인의 가장 가까운 실제 IP 사용',()=>{
 assert.equal(helpers.connectionIp(request('172.18.0.1','198.51.100.10, 172.64.1.1')),'198.51.100.10');
 assert.equal(helpers.connectionIp(request('172.18.0.1','203.0.113.99, 198.51.100.10, 172.64.1.1')),'198.51.100.10');
 assert.equal(helpers.connectionIp(request('fd00::1','2001:db8::7, 2606:4700::1')),'2001:db8::7');
 assert.equal(helpers.connectionIp(request('172.18.0.1','172.64.1.1',{'cf-connecting-ip':'198.51.100.12'})),'198.51.100.12');
 assert.equal(helpers.connectionIp(request('172.18.0.1','172.18.0.2',{'cf-connecting-ip':'198.51.100.12'})),null);
 assert.equal(helpers.connectionIp(request('104.16.1.1',undefined,{'cf-connecting-ip':'198.51.100.10'})),'198.51.100.10');
});
test('실제 방문자 IP가 없는 중계 서버를 모든 이용자의 공통 IP로 오인하지 않음',()=>{
 for(const req of [request('172.18.0.1'),request('172.18.0.1','172.64.1.1'),request('172.18.0.1','bad-ip'),request('172.18.0.1',Array(33).fill('198.51.100.10').join(',')),request('172.18.0.1',['198.51.100.10'])])assert.equal(helpers.connectionIp(req),null);
 assert.equal(helpers.connectionIp(request('127.0.0.1')),'127.0.0.1');
});

test('실제 서버: 동일 IP 차단·서로 다른 IP 허용·새로고침·경합·연결 종료 후 해제', {timeout:30000},async t=>{
 const dir=mkdtempSync(join(tmpdir(),'hodon-single-ip-')),root=new URL('./',import.meta.url);
 for(const n of readdirSync(root))if(/\.(?:js|json)$/.test(n))copyFileSync(new URL(n,root),join(dir,n));
 symlinkSync(new URL('node_modules',root).pathname,join(dir,'node_modules'),'dir');
 const env={...process.env,PORT:'3447',HODON_DATA_DIR:dir};delete env.HODON_SINGLE_IP_LIMIT;
 const proc=spawn(process.execPath,['server.js'],{cwd:dir,env,stdio:['ignore','pipe','pipe']});
 let logs='';proc.stderr.on('data',b=>logs+=b);const clients=[];
 const connect=async(ip,auth={},options={})=>{
  const c=clientIo('http://127.0.0.1:3447',{forceNew:true,reconnection:false,autoConnect:false,timeout:3000,...options,auth,extraHeaders:{'x-forwarded-for':ip,...options.extraHeaders}});clients.push(c);
  c.on('session:ready',data=>c.resumeToken=data.ipResumeToken);
  const outcome=new Promise(resolve=>{c.once('connect',()=>resolve({c}));c.once('connect_error',error=>resolve({c,error}));});c.connect();return outcome;
 };
 const ready=async(ip,auth={},options={})=>{const r=await connect(ip,auth,options);assert.equal(r.error,undefined,r.error?.message);for(let n=0;!r.c.resumeToken&&n<100;n++)await delay(5);assert.match(r.c.resumeToken,/^[a-f0-9]{64}$/);return r.c;};
 const deny=async(ip,auth={},options={})=>{const r=await connect(ip,auth,options);assert.equal(r.error?.data?.code,'DUPLICATE_IP');assert.equal(r.c.connected,false);r.c.disconnect();return r.error;};
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server start: '+logs)),6000);proc.stdout.on('data',b=>{logs+=b;if(logs.includes('http://localhost:3447')){clearTimeout(timer);resolve();}});proc.once('error',reject);});
  await t.test('다른 프로필·다른 닉네임·관전 요청도 동일 IP에서는 차단, 기존 이용자 유지',async()=>{
   const a=await ready('198.51.100.10');
   const created=await a.timeout(3000).emitWithAck('room:create',{name:'첫 접속자',gameType:'yut',playerCount:2,piecesPerPlayer:1});assert.ok(created.ok,created.error);
   await deny('198.51.100.10',{name:'다른 프로필',spectator:true});assert.equal(a.connected,true);
   const info=await a.timeout(3000).emitWithAck('server:info',{});assert.ok(info.ok);
   const b=await ready('198.51.100.11');const joined=await b.timeout(3000).emitWithAck('room:join',{code:created.code,name:'다른 IP'});assert.ok(joined.ok,joined.error);
   a.disconnect();b.disconnect();await delay(40);
  });
  await t.test('공통 프록시를 쓰는 서로 다른 IP는 허용, 왼쪽 위조 헤더로 우회 불가',async()=>{
   const a=await ready('203.0.113.9, 198.51.100.20, 172.64.1.1');const b=await ready('198.51.100.21, 172.64.1.1');
   await deny('203.0.113.200, 198.51.100.20, 172.64.1.1');a.disconnect();b.disconnect();await delay(40);
  });
  await t.test('IPv4 매핑·압축 IPv6의 동일 주소 표기로 우회 불가',async()=>{
   const a=await ready('198.51.100.30');await deny('::ffff:198.51.100.30');a.disconnect();await delay(20);
   const b=await ready('2001:db8::7');await deny('2001:db8:0:0:0:0:0:7');b.disconnect();await delay(20);
  });
  await t.test('서버가 발급한 재접속 키만 새로고침 허용, 동시에 살아 있는 소켓은 하나',async()=>{
   const a=await ready('198.51.100.40'),token=a.resumeToken;
   await deny('198.51.100.40',{ipResumeToken:'guess'});
   const disconnected=new Promise(resolve=>a.once('disconnect',resolve));const b=await ready('198.51.100.40',{ipResumeToken:token});await disconnected;
   assert.equal(a.connected,false);assert.equal(b.connected,true);assert.notEqual(b.resumeToken,token);
   await delay(20);await deny('198.51.100.40',{ipResumeToken:token});await deny('198.51.100.40');
   assert.ok((await b.timeout(3000).emitWithAck('server:info',{})).ok);b.disconnect();await delay(40);
  });
  await t.test('먼저 열린 창 종료 후 다른 프로필 접속 가능',async()=>{
   const a=await ready('198.51.100.50');await deny('198.51.100.50');a.disconnect();await delay(40);
   const b=await ready('198.51.100.50');assert.equal(b.connected,true);b.disconnect();await delay(20);
  });
  await t.test('동시 접속 8개 경합에서도 정확히 하나만 허용',async()=>{
   const outcomes=await Promise.all(Array.from({length:8},()=>connect('198.51.100.60')));
   assert.equal(outcomes.filter(r=>r.c.connected).length,1);assert.equal(outcomes.filter(r=>r.error?.data?.code==='DUPLICATE_IP').length,7);
   outcomes.forEach(r=>r.c.disconnect());await delay(40);
  });
  await t.test('폴링에서 웹소켓으로 전환해도 중복 접속으로 오인하지 않음',async()=>{
   const a=await ready('198.51.100.70',{},{transports:['polling','websocket']});
   for(let n=0;a.io.engine.transport.name!=='websocket'&&n<100;n++)await delay(10);
   assert.equal(a.io.engine.transport.name,'websocket');assert.equal(a.connected,true);
   await deny('198.51.100.70',{},{transports:['websocket']});a.disconnect();await delay(20);
  });
  await t.test('주소 확인 실패는 중복 IP 오류와 구분하며 다른 정상 이용자를 막지 않음',async()=>{
   const r=await connect('invalid');assert.equal(r.error?.data?.code,'IP_UNAVAILABLE');r.c.disconnect();
   const a=await ready('198.51.100.80');assert.equal(a.connected,true);a.disconnect();
  });
 }finally{clients.forEach(c=>c.disconnect());proc.kill();await new Promise(resolve=>proc.once('exit',resolve));rmSync(dir,{recursive:true,force:true});}
});
