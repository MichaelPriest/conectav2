'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');

test('Posts remain quarantined until actual server review or authorized moderator approval',()=>{
 const migration=read('../supabase/migrations/20261010_conecta_moderation_fail_closed_posts.sql');
 assert.match(migration,/alter table public\.posts alter column moderation_status set default 'pending'/i);
 assert.match(migration,/if tg_op = 'INSERT' then[\s\S]*?new\.moderation_status := 'pending'/);
 assert.match(migration,/new\.moderation_status := 'pending';[\s\S]*?new\.ai_checked_at := null/);
 assert.match(migration,/zzz_protect_post_moderation_fields/);
 assert.match(migration,/app_private\.is_platform_moderator\(\)/);
 const route=read('src/app/api/moderation/review/route.ts');
 assert.match(route,/row\.author_id!==user\.id/);
 assert.match(route,/result\.flagged\|\|result\.humanReview/);
 assert.match(route,/\.is\('ai_checked_at',null\)/);
 assert.match(route,/\{status:'pending',reason:'Serviço de IA indisponível/);
});
test('Ordinary photos do not universally require human moderation; suspicious frames do',()=>{
 const image=read('src/lib/open-source-image-moderation.ts');
 const route=read('src/app/api/moderation/review/route.ts');
 const video=read('src/lib/automatic-video-screen.ts');
 assert.match(image,/reviewRequired:flagged\|\|borderline/);
 assert.match(route,/const needsReview=result\.reviewRequired/);
 assert.match(route,/humanReview:json\.human_review/);
 assert.doesNotMatch(route,/humanReview:media\.length>0/);
 assert.match(video,/if\(result\.reviewRequired\)uncertain=true/);
});
test('Reviewers can safely load and retry protected photos and Stories without losing their decision',()=>{
 const ui=read('src/components/pending-content-panel.tsx');
 const fallback=read('src/lib/moderation-reviewer-preview.ts');
 const policy=read('../supabase/migrations/20261010_conecta_moderation_reviewer_story_preview.sql');
 assert.match(ui,/reviewerPreviewFromRls/);
 assert.match(ui,/Recarregar prévia/);
 assert.match(ui,/setPreview\(signed\)/);
 assert.match(ui,/setRationale\(''\);setError/);
 assert.match(ui,/onClick=\{\(\)=>void loadPreview\(current\)\}/);
 assert.match(ui,/\.rpc\('review_pending_public_content'/);
 assert.match(fallback,/\.auth\.getUser\(\)/);
 assert.match(fallback,/\.from\('platform_moderators'\)/);
 assert.match(fallback,/\.createSignedUrl\(item\.path,120\)/);
 assert.doesNotMatch(fallback,/service_role|SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(policy,/for select to authenticated/);
 assert.match(policy,/app_private\.is_platform_moderator\(\)/);
});
