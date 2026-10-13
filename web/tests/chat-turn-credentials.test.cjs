'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('TURN credentials require an authenticated Supabase user and stay short-lived/server-side',()=>{
 const route=read('src/app/api/chat/turn-credentials/route.ts');
 for(const expected of [
  "request.headers.get('authorization')",
  'supabase.auth.getUser(token)',
  "process.env.TURN_SHARED_SECRET",
  "createHmac('sha1',secret)",
  'Math.floor(Date.now()/1000)+600',
  "'Cache-Control':'no-store, max-age=0'",
  "NextResponse.json({enabled:false,iceServers:[]}"
 ])assert.ok(route.includes(expected),expected);
 assert.ok(!route.includes('NEXT_PUBLIC_TURN_SHARED_SECRET'));
 assert.ok(!route.includes('service_role'));
});

test('both one-to-one and group WebRTC request optional TURN configuration',()=>{
 const helper=read('src/lib/chat-rtc-config.ts');
 const direct=read('src/components/chat-calls.tsx');
 const group=read('src/components/chat-group-calls.tsx');
 assert.ok(helper.includes("fetch('/api/chat/turn-credentials'"));
 assert.ok(helper.includes('Authorization:'));
 assert.ok(helper.includes('fallbackIceServers'));
 assert.ok(direct.includes('getChatRtcConfiguration'));
 assert.ok(group.includes('getChatRtcConfiguration'));
});

test('TURN deployment documentation uses server-only environment variables',()=>{
 const env=read('.env.example');
 const docs=read('README.md');
 assert.ok(env.includes('TURN_URLS='));
 assert.ok(env.includes('TURN_SHARED_SECRET='));
 assert.ok(docs.includes('coturn/coturn'));
 assert.ok(docs.includes('10 minutos'));
});
