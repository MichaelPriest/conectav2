'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('catalog contains exactly 100 real achievement definitions including the unique first user', () => {
  const sql = read('../supabase/migrations/20261013200000_conecta_100_achievements.sql');
  const rows = sql.split(/\r?\n/).filter(line => /^\('(?:first-user|posts-|connections-|comments-|likes-|stories-|communities-|polls-|messages-|saved-posts-)/.test(line));
  assert.equal(rows.length, 100);
  assert.ok(sql.includes("'first-user','Primeiro usuário do Conecta'"));
  assert.ok(sql.includes("'founder',1,0"));
  assert.ok(sql.includes("order by p.created_at asc, p.id asc limit 1"));
  assert.ok(sql.includes("select p.id,'first-user' from public.profiles p"));
});

test('achievement unlocks are computed and persisted by an authenticated database function', () => {
  const sql = read('../supabase/migrations/20261013200000_conecta_100_achievements.sql');
  assert.ok(sql.includes('security definer'));
  assert.ok(sql.includes('auth.uid()'));
  assert.ok(sql.includes('public.user_achievements'));
  assert.ok(sql.includes('on conflict (user_id,achievement_id) do nothing'));
  assert.ok(sql.includes('revoke all on function public.get_my_achievements() from public, anon'));
  assert.ok(sql.includes('grant execute on function public.get_my_achievements() to authenticated'));
  assert.ok(sql.includes('using (user_id = (select auth.uid()))'));
  for (const metric of ['posts','connections','comments','likes','stories','communities','polls','messages','saved_posts']) {
    assert.ok(sql.includes("'" + metric + "'"), 'metric ' + metric);
  }
});

test('profile UI loads database achievements and offers category/search/progress filters', () => {
  const component = read('src/components/profile-achievements.tsx');
  assert.ok(component.includes("db.rpc('get_my_achievements')"));
  assert.ok(component.includes('{unlocked}/100 desbloqueadas'));
  assert.ok(component.includes('Buscar conquista'));
  assert.ok(component.includes('Apenas desbloqueadas'));
  assert.ok(component.includes('Primeiro usuário do Conecta'));
  assert.ok(!component.includes("db.from('posts').select('id'"));
});
