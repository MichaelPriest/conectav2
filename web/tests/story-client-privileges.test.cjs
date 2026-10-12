'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const migration=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/20261012223000_conecta_stories_insert_privilege_repair.sql'),'utf8');

test('Story table insert privilege is paired with server-managed field guards',()=>{
  assert.match(migration,/grant select, delete on table public\\.stories to authenticated/i);
  assert.match(migration,/grant insert on table public\\.stories to authenticated/i);
  assert.match(migration,/new\\.id := gen_random_uuid\\(\\)[\\s\\S]*new\\.created_at := now\\(\\)[\\s\\S]*new\\.expires_at := now\\(\\) \\+ interval '24 hours'[\\s\\S]*new\\.moderation_status := 'pending'/i);
  assert.match(migration,/new\\.author_id is distinct from \\(select auth\\.uid\\(\\)\\)/i);
  assert.match(migration,/revoke all on function app_private\\.guard_story_post_share\\(\\)[\\s\\S]*from public, anon, authenticated/i);
  assert.doesNotMatch(migration,/grant all|to public|to anon|grant update/i);
});
