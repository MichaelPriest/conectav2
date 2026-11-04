'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('Render start binds Next.js directly without a network-dependent preflight',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(__dirname,'../package.json'),'utf8'));
  assert.equal(pkg.scripts.start,'next start');
  assert.equal(pkg.scripts['diagnose:chat-push'],'node scripts/check-chat-push-startup.cjs');
  assert.doesNotMatch(pkg.scripts.start,/check-chat-push|supabase|fetch|curl|&&/i);
});
