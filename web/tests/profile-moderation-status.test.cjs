const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const timeline = fs.readFileSync(
  path.join(__dirname, '../src/components/profile-timeline.tsx'),
  'utf8'
);

test('profile timeline selects moderation_status for public and saved posts', () => {
  assert.match(timeline, /const POST_SELECT='[^']*moderation_status[^']*'/);
  assert.match(timeline, /from\('posts'\)\.select\(POST_SELECT\)\.eq\('author_id',profileId\)/);
  assert.match(timeline, /from\('posts'\)\.select\(POST_SELECT\)\.in\('id',ids\)/);
});

test('profile card warning still depends on the actual moderation state', () => {
  const postCard = fs.readFileSync(
    path.join(__dirname, '../src/components/post-card.tsx'),
    'utf8'
  );
  assert.match(postCard, /post\.moderation_status!=='approved'/);
  assert.match(postCard, /post\.moderation_status==='pending'\?'Publicação em análise'/);
});
