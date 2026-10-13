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


test('profile achievements load the 100 real server-calculated awards',()=>{
 const component=read('components/profile-achievements.tsx');
 const migration=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/20261013200000_conecta_100_achievements.sql'),'utf8');
 const page=read('app/perfil/page.tsx');
 assert.match(component,/rpc\('get_my_achievements'\)/);
 assert.match(component,/\{unlocked\}\/100 desbloqueadas/);
 assert.match(component,/Primeiro usuário do Conecta/);
 assert.match(component,/Buscar conquista/);
 assert.match(component,/Apenas desbloqueadas/);
 assert.match(migration,/create table if not exists public\.achievement_catalog/);
 assert.match(migration,/create table if not exists public\.user_achievements/);
 assert.match(migration,/order by p\.created_at asc, p\.id asc limit 1/);
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
 assert.match(migration,/values \(p_profile_id, v_viewer_id, now\(\), 1\)/);
 assert.match(migration,/profile_views_enabled = true/);
 assert.match(migration,/auth\.uid\(\)/);
 assert.match(migration,/user_blocks/);
 assert.match(migration,/revoke all on function public\.record_profile_visit\(uuid\) from public, anon/);
 assert.match(component,/Histórico ativado/);
 assert.match(component,/featureUnavailable/);
 assert.match(component,/migração necessária precisa ser aplicada/);
 assert.match(component,/disabled=\{busy \|\| loading \|\| featureUnavailable\}/);
 assert.match(component,/profile_visits/);
 assert.match(component,/delete\(\)\.eq\('profile_id', profileId\)/);
 assert.match(publicPage,/record_profile_visit/);
 assert.match(publicPage,/!viewerBlocked && !ownerBlocked/);
});


test('feed filters query real posts and restart pagination when changed',()=>{
 const page=read('app/feed/page.tsx');
 assert.match(page,/useState<'all'\|'mine'\|'media'>\('all'\)/);
 assert.match(page,/feedFilter==='mine'\)query=query\.eq\('author_id',user\.id\)/);
 assert.match(page,/feedFilter==='media'\)query=query\.or\('media_type\.not\.is\.null,media_path\.not\.is\.null'\)/);
 assert.match(page,/aria-label="Filtrar publicações"/);
 assert.match(page,/Minhas publicações/);
 assert.match(page,/Fotos e vídeos/);
 assert.match(page,/\},\[user,feedFilter\]\)/);
});


test('explore search normalizes accents and optional @ or # prefixes',()=>{
 const page=read('app/explorar/page.tsx');
 assert.ok(page.includes('matchAll(/#[\\wÀ-ÿ]{2,40}/g)'));
 assert.ok(page.includes("const normalizeDiscoveryText = (value: string) => value.normalize('NFD')"));
 assert.ok(page.includes("replace(/^[@#]+/,'')"));
 assert.ok(page.includes('normalizeDiscoveryText(tag).includes(needle)'));
 assert.ok(page.includes('normalizeDiscoveryText(p.display_name'));
});


test('community poll filter uses actual poll records and includes a visible Enquetes tab',()=>{
 const page=read('app/comunidades/[slug]/page.tsx');
 assert.ok(page.includes("db.from('post_polls').select('post_id').in('post_id',rows.map(row=>row.id))"));
 assert.ok(page.includes("tab==='polls'&&pollPostIds.includes(p.id)"));
 assert.ok(page.includes("['all','photos','videos','polls'] as const"));
 assert.ok(page.includes("'Enquetes'"));
 assert.doesNotMatch(page,/tab==='polls'&&false/);
});
