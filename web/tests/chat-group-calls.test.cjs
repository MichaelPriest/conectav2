'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('group calls have member-scoped database access and server-authorized signaling',()=>{
 const sql=read('../supabase/migrations/20261013180000_conecta_group_audio_video_calls.sql');
 for(const expected of [
  'enable row level security','group_call_sessions_member_read',
  'group_call_participants_member_read','group_call_signals_involved_read',
  'public.start_group_call','public.join_group_call','public.send_group_call_signal',
  'public.leave_group_call',"c.is_group=true",'conversation_members',
  "t.mode='youth_protection'",'revoke all on function public.send_group_call_signal',
  'octet_length(_signal::text)>65536','recipient_id','status='joined'',
  "alter publication supabase_realtime add table public.group_call_signals"
 ])assert.ok(sql.includes(expected),expected);
 assert.ok(!sql.includes('grant insert on public.group_call_signals'));
});

test('group audio/video controls use real browser media and peer connections',()=>{
 const src=read('src/components/chat-group-calls.tsx');
 for(const expected of [
  'navigator.mediaDevices.getUserMedia','new RTCPeerConnection',
  "dbRef.current.rpc('start_group_call'","dbRef.current.rpc('join_group_call'",
  "dbRef.current.rpc('send_group_call_signal'","dbRef.current.rpc('leave_group_call'",
  'getAudioTracks()','getVideoTracks()','pc.onicecandidate','pc.ontrack',
  'Conexão direta WebRTC'
 ])assert.ok(src.includes(expected),expected);
});

test('both messenger surfaces expose group-call controls without replacing one-to-one calls',()=>{
 const widget=read('src/components/chat-widget.tsx');
 const page=read('src/app/mensagens/page.tsx');
 assert.ok(widget.includes('<ChatGroupCallButtons'));
 assert.ok(page.includes('<ChatGroupCallButtons'));
 assert.ok(widget.includes('<ChatCallButtons'));
 assert.ok(page.includes('<ChatCallButtons'));
});
