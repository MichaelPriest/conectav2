'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('presence is strictly opt-in and refreshes only while the page is visible',()=>{
 const s=read('src/components/chat-presence.tsx');
 assert.ok(s.includes("localStorage.getItem(preferenceKey(userId))==='1'"));
 assert.ok(s.includes('document.hidden'));
 assert.ok(s.includes("db.rpc('touch_chat_presence')"));
 assert.ok(s.includes(".delete().eq('user_id',userId)"));
 assert.ok(s.includes('WINDOW_MS=90_000'));
});
test('presence does not bypass friendship, blocks or row ownership',()=>{
 const s=read('../supabase/migrations/20261009_conecta_chat_v48_opt_in_presence.sql');
 assert.ok(s.includes("f.status='accepted'"));
 assert.ok(s.includes('public.user_blocks'));
 assert.ok(s.includes('last_seen_at>now()'));
 assert.ok(s.includes('user_id=(select auth.uid())'));
 assert.ok(s.includes('security invoker'));
 assert.ok(s.includes('enable row level security'));
 assert.ok(!s.includes('security definer'));
});
