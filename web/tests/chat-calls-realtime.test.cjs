'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('real calls listen to scoped Supabase Realtime events with polling fallback',()=>{
 const s=read('src/components/chat-calls.tsx');
 assert.ok(s.includes("filter:'callee_id=eq.'+userId"));
 assert.ok(s.includes("filter:'caller_id=eq.'+userId"));
 assert.ok(s.includes('idlePollMs=12000'));
 assert.ok(s.includes('intervalMs=1800'));
 assert.ok(s.includes('if(currentRef.current){void check();return;}'));
 assert.ok(s.includes('db.removeChannel(channel)'));
 assert.ok(s.includes("Notification.permission==='granted'"));
});
test('calls terminate on failed network and keep microphone cleanup',()=>{
 const s=read('src/components/chat-calls.tsx');
 assert.ok(s.includes("pc.connectionState==='failed'"));
 assert.ok(s.includes("if(pcRef.current===pc)void end()"));
 assert.ok(s.includes('streamRef.current?.getTracks().forEach(track=>track.stop())'));
 assert.ok(s.includes("updated.callee_id===userId&&!pcRef.current"));
});
test('missed calls are visible only to the recipient and can be dismissed locally',()=>{
 const s=read('src/components/chat-calls.tsx');
 const sql=read('../supabase/migrations/20261009_conecta_chat_v410_realtime_missed_calls.sql');
 assert.ok(s.includes(".eq('callee_id',userId)"));
 assert.ok(s.includes("localStorage.setItem(missedAckKey"));
 assert.ok(s.includes("row.status==='missed'"));
 assert.ok(sql.includes("status in ('ringing','accepted','declined','ended','missed')"));
 assert.ok(sql.includes('pg_advisory_xact_lock'));
 assert.ok(sql.includes('alter publication supabase_realtime add table public.chat_calls'));
});
