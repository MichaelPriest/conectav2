'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../src/components/chat-calls.tsx'),'utf8');

test('accepted calls poll promptly while idle polling stays light',()=>{
 assert.match(code,/const intervalMs=1800/);
 assert.match(code,/const idlePollMs=12000/);
 assert.match(code,/if\(currentRef.current\)\{void check\(\);return;\}/);
});
test('RTC reports negotiation stages and terminates stalled attempts',()=>{
 assert.match(code,/iceConnectionState/);
 assert.match(code,/const negotiationTimeoutMs=47000/);
 assert.match(code,/Resposta WebRTC não chegou/);
 assert.match(code,/necessário TURN/);
 assert.match(code,/if\(connectTimer.current!==null\)window.clearTimeout/);
});
test('WebRTC uses public secondary STUN without leaking credentials',()=>{
 assert.match(code,/stun:stun.cloudflare.com:3478/);
 assert.match(code,/stun:stun.l.google.com:19302/);
 assert.ok(!code.includes('turn:turn.cloudflare.com'));
});
test('offer and answer still go through authorized database functions',()=>{
 assert.match(code,/db.rpc\('signal_chat_call'/);
 assert.match(code,/db.rpc\('accept_chat_call'/);
 assert.match(code,/db.rpc\('end_chat_call'/);
});
