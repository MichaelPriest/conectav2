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

test('profile card warning depends on approval state, not a missing status', () => {
  const postCard = fs.readFileSync(
    path.join(__dirname, '../src/components/post-card.tsx'),
    'utf8'
  );
  assert.match(postCard, /post\.moderation_status!=='approved'/);
  assert.match(postCard, /Publicação em análise/);
  assert.match(postCard, /post\.moderation_status==='rejected'/);
});
