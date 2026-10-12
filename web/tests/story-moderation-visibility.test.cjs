const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const migration = read('supabase/migrations/20261012_conecta_hide_unapproved_stories.sql');

test('ordinary Story timeline only exposes approved content to other users', () => {
  assert.match(migration, /drop policy if exists "view permitted active stories" on public\.stories/i);
  assert.match(migration, /create policy "view permitted active stories"[\s\S]*for select to authenticated/i);
  assert.match(migration, /author_id\s*=\s*\(select auth\.uid\(\)\)[\s\S]*or\s*\([\s\S]*moderation_status\s*=\s*'approved'/i);
  assert.match(migration, /expires_at\s*>\s*now\(\)/i);
});

test('Story visibility keeps age and youth-protection server-side gates', () => {
  assert.match(migration, /registration_age_declarations[\s\S]*declared_band\s*=\s*'18_plus'/i);
  assert.match(migration, /teen_safety_preferences[\s\S]*mode\s*=\s*'youth_protection'/i);
});

test('approved Stories still respect blocks and friend/public visibility', () => {
  assert.match(migration, /user_blocks[\s\S]*blocker_id\s*=\s*author_id[\s\S]*blocked_id\s*=\s*\(select auth\.uid\(\)\)/i);
  assert.match(migration, /visibility\s*=\s*'public'/i);
  assert.match(migration, /visibility\s*=\s*'friends'[\s\S]*friendships f[\s\S]*f\.status\s*=\s*'accepted'/i);
});
