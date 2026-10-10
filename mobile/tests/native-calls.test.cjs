'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('Native voice/video calls use real RTC media and same protected Web RPC',()=>{
 const src=read('src/native-calls.tsx'),app=read('App.tsx');
 const pkg=JSON.parse(read('package.json'));
 assert.equal(pkg.dependencies['react-native-webrtc'],'124.0.8');
 for(const rpc of [
  'start_chat_call','accept_chat_call','signal_chat_call',
  'add_chat_call_ice_candidate','end_chat_call','keep_chat_call_alive'
 ])assert.ok(src.includes("'"+rpc+"'"),'Must use '+rpc);
 assert.match(src,/mediaDevices\.getUserMedia/);
 assert.match(src,/new RTCPeerConnection\(/);
 assert.match(src,/\.createOffer\(\)/);
 assert.match(src,/\.createAnswer\(\)/);
 assert.match(src,/\.addIceCandidate\(/);
 assert.match(src,/RTCView streamURL/);
 assert.match(app,/NativeCallsProvider userId=/);
 assert.match(app,/calls\.start\(active,selected\.other!\.id,selected\.title,'audio'\)/);
 assert.match(app,/calls\.start\(active,selected\.other!\.id,selected\.title,'video'\)/);
});
test('Call state is read through participant RLS and never trusts client identity',()=>{
 const src=read('src/native-calls.tsx');
 assert.match(src,/\.eq\('callee_id',me\)/);
 assert.match(src,/\.eq\('id',row\.id\)/);
 assert.match(src,/rowRef\.current\?\.id!==row\.id/);
 assert.match(src,/stream\.current\?\.getTracks\(\)\.forEach\(track=>track\.stop\(\)\)/);
 assert.match(src,/AppState\.currentState!=='active'/);
 assert.match(src,/Vibration\.cancel\(\)/);
 assert.doesNotMatch(src,/service_role|SUPABASE_SECRET_KEY|admin\.from/);
});
test('RTC permissions are declared but requested only by native getUserMedia tap',()=>{
 const app=JSON.parse(read('app.json')).expo;
 const src=read('src/native-calls.tsx');
 assert.ok(app.ios.infoPlist.NSCameraUsageDescription);
 assert.ok(app.ios.infoPlist.NSMicrophoneUsageDescription);
 assert.ok(!app.android.blockedPermissions.includes('android.permission.RECORD_AUDIO'));
 assert.match(src,/getUserMedia\(/);
 assert.match(src,/onPress=\{\(\)=>void accept\(\)\}/);
 assert.match(src,/onPress=\{\(\)=>void hangup\(incoming\)\}/);
 assert.match(src,/STUN alone may fail/);
});
