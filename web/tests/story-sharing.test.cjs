const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const grant = read('supabase/migrations/20261012_conecta_stories_share_insert_privilege.sql');
const shareMigration = read('supabase/migrations/20261010_conecta_stories_share_approved_posts.sql');
const storyMigration = read('supabase/migrations/20261008_conecta_stories_24h.sql');
const postCard = read('web/src/components/post-card.tsx');
const storyRail = read('web/src/components/story-rail.tsx');

test('Story share insert privilege remains column-scoped and cannot update rows', () => {
  assert.match(
    grant,
    /grant insert\s*\(\s*author_id\s*,\s*caption\s*,\s*media_path\s*,\s*media_type\s*,\s*visibility\s*,\s*shared_post_id\s*\)\s*on public\.stories to authenticated;/is,
  );
  assert.doesNotMatch(grant, /grant insert\s+on public\.stories to authenticated/i);
  assert.doesNotMatch(grant, /grant\s+update\b/i);
});

test('Database trigger permits only already-approved public non-community post shares', () => {
  assert.match(shareMigration, /p\.visibility\s*=\s*'public'/i);
  assert.match(shareMigration, /p\.moderation_status\s*=\s*'approved'/i);
  assert.match(shareMigration, /p\.community_id\s+is\s+null/i);
  assert.match(shareMigration, /new\.moderation_status\s*:=\s*'approved'/i);
  assert.match(shareMigration, /new\.media_path\s+is\s+not\s+null/i);
  assert.match(shareMigration, /new\.media_type\s+is\s+not\s+null/i);
});

test('Story creation keeps age and youth-protection gates server-side', () => {
  assert.match(storyMigration, /enable\s+row\s+level\s+security/i);
  assert.match(storyMigration, /registration_age_declarations[\s\S]*declared_band\s*=\s*'18_plus'/i);
  assert.match(storyMigration, /teen_safety_preferences[\s\S]*mode\s*=\s*'youth_protection'/i);
});

test('Post UI offers Story sharing only for eligible public approved posts', () => {
  assert.match(postCard, /post\.visibility\s*===\s*'public'\s*&&\s*post\.moderation_status\s*===\s*'approved'\s*&&\s*!post\.community_id/);
  assert.match(postCard, /from\('stories'\)\.insert\(\s*\{\s*author_id:\s*userId,\s*shared_post_id:\s*post\.id,\s*visibility:\s*'friends'/s);
  assert.match(postCard, /conecta:stories-updated/);
  assert.match(storyRail, /addEventListener\('conecta:stories-updated'/);
});
