const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=relative=>fs.readFileSync(path.resolve(__dirname,'../src',relative),'utf8');

test('publication drafts are scoped to the signed-in user and bounded',()=>{
 const component=read('components/post-drafts.tsx');
 assert.match(component,/STORAGE_PREFIX = 'conecta:post-drafts:v1:'/);
 assert.ok(component.includes('getItem(STORAGE_PREFIX + userId)'));
 assert.match(component,/const MAX_DRAFTS = 20/);
 assert.match(component,/slice\(0, MAX_DRAFTS\)/);
 assert.match(component,/drafts\.filter\(draft => draft\.id !== id\)/);
});

test('drafts preserve privacy and poll settings but do not serialize uploaded media',()=>{
 const component=read('components/post-drafts.tsx');
 assert.match(component,/privacy: 'public' \| 'friends' \| 'private'/);
 assert.match(component,/pollOptions: string\[\]/);
 assert.match(component,/pollDays: number/);
 assert.match(component,/Fotos e vídeos anexados não são salvos/);
 assert.doesNotMatch(component,/FileReader|arrayBuffer\(\)|data:image/);
});

test('feed integrates restore and save without bypassing normal publish moderation',()=>{
 const page=read('app/feed/page.tsx');
 assert.match(page,/PostDrafts userId=\{user\.id\}/);
 assert.match(page,/setPrivacy\(draft\.privacy\)/);
 assert.match(page,/setPollOptions\(draft\.pollOptions\)/);
 assert.match(page,/requestContentModeration\('post',created\.id\)/);
});

test('explore derives hashtags only from the public discovery result and supports hashtag search',()=>{
 const page=read('app/explorar/page.tsx');
 assert.match(page,/\.eq\('visibility','public'\)/);
 assert.match(page,/post\.content\.matchAll\(\/#/);
 assert.match(page,/Hashtags em destaque/);
 assert.match(page,/setSearch\(tag\);setFilter\('Publicações'\)/);
});


test('profile achievements are derived from real Supabase counts and profile fields',()=>{
 const component=read('components/profile-achievements.tsx');
 const page=read('app/perfil/page.tsx');
 assert.match(component,/from\('posts'\)\.select\('id', \{ count: 'exact', head: true \}\)/);
 assert.match(component,/from\('friendships'\)/);
 assert.match(component,/from\('profile_details'\)/);
 assert.match(component,/first-post/);
 assert.match(component,/ten-friends/);
 assert.match(component,/profile-custom/);
 assert.match(component,/interests/);
 assert.match(component,/music/);
 assert.match(page,/ProfileAchievements profileId=\{auth\.user\.id\}/);
 assert.doesNotMatch(component,/insert\(|upsert\(|update\(/);
});


test('profile visit history requires opt-in and enforces authenticated non-blocked visits',()=>{
 const migration=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/20261013160000_conecta_profile_visit_history.sql'),'utf8');
 const component=read('components/profile-visits.tsx');
 const publicPage=read('app/p/[handle]/page.tsx');
 assert.match(migration,/profile_views_enabled boolean not null default false/);
 assert.match(migration,/profile_id = \(select auth\.uid\(\)\)/);
 assert.match(migration,/viewer_id uuid not null/);
 assert.match(migration,/viewer_id = v_viewer_id/);
 assert.match(migration,/profile_views_enabled = true/);
 assert.match(migration,/auth\.uid\(\)/);
 assert.match(migration,/user_blocks/);
 assert.match(migration,/revoke all on function public\.record_profile_visit\(uuid\) from public, anon/);
 assert.match(component,/Histórico ativado/);
 assert.match(component,/profile_visits/);
 assert.match(component,/delete\(\)\.eq\('profile_id', profileId\)/);
 assert.match(publicPage,/record_profile_visit/);
 assert.match(publicPage,/!viewerBlocked && !ownerBlocked/);
});
