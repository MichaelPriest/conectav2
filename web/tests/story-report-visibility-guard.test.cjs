'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const migration=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/20261012_conecta_story_report_visibility_guard.sql'),'utf8');

test('Story report evidence trigger rejects inaccessible Stories',()=>{
  assert.match(migration,/s\.moderation_status='approved'[\s\S]*s\.expires_at>now\(\)/i);
  assert.match(migration,/registration_age_declarations[\s\S]*a\.user_id=new\.reporter_id[\s\S]*a\.declared_band='18_plus'/i);
  assert.match(migration,/teen_safety_preferences[\s\S]*y\.user_id=new\.reporter_id[\s\S]*y\.mode='youth_protection'/i);
  assert.match(migration,/user_blocks[\s\S]*b\.blocker_id=s\.author_id[\s\S]*b\.blocked_id=new\.reporter_id[\s\S]*b\.blocker_id=new\.reporter_id[\s\S]*b\.blocked_id=s\.author_id/i);
  assert.match(migration,/s\.visibility='public'[\s\S]*s\.visibility='friends'[\s\S]*friendships f[\s\S]*f\.status='accepted'/i);
  assert.match(migration,/if not found then[\s\S]*Conteúdo indisponível para denúncia/i);
});

test('Story report INSERT policy repeats visibility and protection gates',()=>{
  const policy=migration.slice(migration.indexOf('create policy "report own visible concern"'));
  assert.match(policy,/target_type='story'[\s\S]*s\.moderation_status='approved'[\s\S]*s\.expires_at>now\(\)/i);
  assert.match(policy,/registration_age_declarations[\s\S]*declared_band='18_plus'/i);
  assert.match(policy,/teen_safety_preferences[\s\S]*mode='youth_protection'/i);
  assert.match(policy,/user_blocks[\s\S]*blocker_id=s\.author_id[\s\S]*blocker_id=\(select auth\.uid\(\)\)/i);
  assert.match(policy,/visibility='public'[\s\S]*visibility='friends'[\s\S]*friendships f/i);
  assert.match(policy,/reporter_id=\(select auth\.uid\(\)\)/i);
});

test('Existing message and post report paths remain present',()=>{
  assert.match(migration,/target_type='message'[\s\S]*app_private\.is_conversation_member/i);
  assert.match(migration,/target_type='post'[\s\S]*p\.community_id is null/i);
});
