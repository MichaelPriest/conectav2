'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('WebRTC call uses real microphones/cameras and incremental ICE',()=>{
 const src=read('src/components/chat-calls.tsx');
 for(const expected of [
  'navigator.mediaDevices.getUserMedia','new RTCPeerConnection',
  'iceGatheringState','pc.onicecandidate','pc.addIceCandidate',
  "db.rpc('signal_chat_call'","db.rpc('end_chat_call'",
  "db.rpc('keep_chat_call_alive'",'getAudioTracks()','getVideoTracks()'
 ])assert.ok(src.includes(expected),expected);
});
test('calls require two friends, no blocks and restricted RLS',()=>{
 const sql=read('../supabase/migrations/20261009_conecta_chat_v49_webrtc_one_to_one.sql');
 for(const expected of [
  'enable row level security','revoke all on public.chat_calls',
  "c.is_group=false","f.status='accepted'",'public.user_blocks',
  "t.mode='youth_protection'",'auth.uid()',"offer_sdp=null,answer_sdp=null",
  "set search_path=''"
 ])assert.ok(sql.includes(expected),expected);
});
test('the full chat and floating widget expose audio and video controls',()=>{
 assert.ok(read('src/components/app-shell.tsx').includes('ChatCallsProvider'));
 assert.ok(read('src/app/mensagens/page.tsx').includes('<ChatCallButtons'));
 assert.ok(read('src/components/chat-widget.tsx').includes('<ChatCallButtons'));
});
