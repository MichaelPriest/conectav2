'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('existing communities and public posts are not hidden by the identity-only gate',()=>{
 const sql=read('supabase/migrations/20261106153000_conecta_restore_standard_social_access.sql');
 assert.match(sql,/conecta_social_access_allowed/);
 assert.match(sql,/conecta_basic_feed_allowed\(p_user_id\)/);
 assert.match(sql,/from public\.platform_moderators pm/);
 for(const table of ['communities','community_members','post_comments','post_likes','post_media','stories','notifications']){
  assert.ok(sql.includes("'"+table+"'"),'missing ordinary social entitlement: '+table);
 }
 assert.match(sql,/conecta_id_posts_social_select/);
 assert.match(sql,/conecta_id_posts_social_insert/);
 assert.match(sql,/conecta_id_posts_social_update/);
 assert.match(sql,/conecta_id_posts_social_delete/);
 assert.match(sql,/as restrictive for all to authenticated/);
});
test('identity-only private messaging and teen protections remain untouched',()=>{
 const sql=read('supabase/migrations/20261106153000_conecta_restore_standard_social_access.sql');
 const included=sql.slice(sql.indexOf('social_tables text[]'),sql.indexOf('];',sql.indexOf('social_tables text[]')));
 for(const table of ['messages','conversations','conversation_members','chat_calls','chat_user_presence','teen_guardian_links','teen_safety_preferences']){
  assert.doesNotMatch(included,new RegExp("'"+table+"'"),'must not unlock '+table);
 }
 assert.doesNotMatch(sql,/update public\.identity_verifications/i);
 assert.doesNotMatch(sql,/identityVerified:true/);
 const route=read('web/src/app/api/identity/access/route.ts');
 assert.match(route,/networkAccess:false,basicAccess:true,canBrowsePublicFeed:true,canUseSocialFeatures:true/);
 assert.match(route,/accessLevel:'social'/);
 assert.match(route,/steps\.identity=identity\.data\?\.status==='approved'/);
});
test('social navigation excludes direct messages and hides chat widgets',()=>{
 const shell=read('web/src/components/app-shell.tsx');
 assert.match(shell,/access\.canUseSocialFeatures===true&&isSocialRoute\(pathname\)/);
 assert.match(shell,/if\(accessLevel==='social'\)return socialLayout/);
 assert.match(shell,/accessLevel!=='social'&&<ChatWidget/);
 assert.match(shell,/accessLevel!=='social'\|\|href!=='\/mensagens'/);
 assert.doesNotMatch(shell,/socialPaths=new Set\([^\n]*'\/mensagens'/);
});
test('feed loads ordinary posts for social adults, with Adsterra placements even with few posts',()=>{
 const feed=read('web/src/app/feed/page.tsx');
 assert.match(feed,/accessLevel==='full'\|\|accessLevel==='social'/);
 assert.match(feed,/<DiscreetAdSlot format="desktop"\/>/);
 assert.match(feed,/i===0&&<DiscreetAdSlot format="mobile"\/>/);
 const ads=read('web/src/components/discreet-ad-slot.tsx');
 assert.match(ads,/highrevenueformat\.com/);
 assert.match(ads,/Publicidade Adsterra/);
 assert.match(ads,/if\(!eligible\|\|!userId\)return null/);
 assert.match(ads,/Permitir publicidade/);
 const api=read('web/src/app/api/ads/eligibility/route.ts');
 assert.match(api,/CONECTA_ADS_ENABLED!=='true'/);
 assert.match(api,/data\.age_band==='18_plus'/);
});
