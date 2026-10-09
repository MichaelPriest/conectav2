'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('SDP is sent immediately and Trickle ICE candidates flow asynchronously',()=>{
 const s=read('src/components/chat-calls.tsx');
 assert.ok(!s.includes('await iceComplete(pc)'));
 for(const part of ["pc.onicecandidate=(event)=>",
   "db.rpc('add_chat_call_ice_candidate'",
   "db.rpc('signal_chat_call'",
   "await pc.addIceCandidate(candidate)",
   "bufferedRemoteCandidates.current.push(candidate)",
   "await flushBufferedCandidates(pc)"]){
  assert.ok(s.includes(part),part);
 }
});
test('candidate signaling protects participants and deletes sensitive data on end',()=>{
 const sql=read('../supabase/migrations/20261009_conecta_chat_v412_trickle_ice.sql');
 for(const part of ['enable row level security',
  "c.status='accepted'","f.status='accepted'",'public.user_blocks',
  'octet_length(candidate::text)<=4096',
  'delete from public.chat_call_ice_candidates',
  'grant execute on function public.add_chat_call_ice_candidate']){
  assert.ok(sql.includes(part),part);
 }
});
test('render-stable Supabase client avoids accidentally ending calls on rerender',()=>{
 const s=read('src/components/chat-calls.tsx');
 assert.ok(s.includes('const [db]=useState(()=>supabaseBrowser());'));
 assert.ok(s.includes('remoteCandidatesFetching.current'));
});
