'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const migration=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/20261013_conecta_stories_client_privileges_repair.sql'),'utf8');

test('Story privilege repair is restricted to authenticated clients and approved columns',()=>{
  assert.match(migration,/grant select, delete on table public\.stories to authenticated/i);
  assert.match(migration,/grant insert\s*\(author_id,\s*caption,\s*media_path,\s*media_type,\s*visibility,\s*shared_post_id\)\s*on table public\.stories to authenticated/i);
  assert.doesNotMatch(migration,/grant all|to public|to anon|grant update/i);
});
