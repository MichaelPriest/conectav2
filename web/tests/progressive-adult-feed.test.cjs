'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('verified-adult age band gives public-read entitlement, not identity approval',()=>{
 const route=read('web/src/app/api/identity/access/route.ts');
 assert.match(route,/adultReadOnly/);
 assert.match(route,/decision\.data\?\.age_band==='18_plus'/);
 assert.match(route,/age\.data\.declared_band==='18_plus'/);
 assert.match(route,/networkAccess:false,basicAccess:true,canBrowsePublicFeed:true/);
 assert.match(route,/steps\.identity=identity\.data\?\.status==='approved'/);
 assert.match(route,/networkAccess:true,basicAccess:true,accessLevel:'full'/);
});
test('navigation exposes public feed, not other social features, to basic users',()=>{
 const shell=read('web/src/components/app-shell.tsx');
 const feed=read('web/src/app/feed/page.tsx');
 assert.match(shell,/pathname==='\/feed'&&access\.canBrowsePublicFeed===true/);
 assert.match(shell,/if\(accessLevel==='basic'\)return/);
 assert.match(feed,/if\(accessLevel==='basic'\)return <GuardedPage/);
 assert.match(feed,/<BasicAdultFeed\/>/);
});
test('basic feed shows only approved public non-community content without mutations',()=>{
 const feed=read('web/src/components/basic-adult-feed.tsx');
 assert.match(feed,/eq\('visibility','public'\)/);
 assert.match(feed,/eq\('moderation_status','approved'\)/);
 assert.match(feed,/is\('community_id',null\)/);
 assert.match(feed,/<DiscreetAdSlot format="desktop"\/>/);
 assert.doesNotMatch(feed,/\.insert\(|\.update\(|\.delete\(|<PostCard/);
});
test('third-party ad eligibility requires adult age and explicit per-user permission',()=>{
 const ad=read('web/src/app/api/ads/eligibility/route.ts');
 const slot=read('web/src/components/discreet-ad-slot.tsx');
 assert.match(ad,/data\.age_band==='18_plus'/);
 assert.match(ad,/declaration\?\.declared_band!=='18_plus'/);
 assert.match(ad,/CONECTA_ADS_ENABLED!=='true'/);
 assert.match(slot,/if\(!eligible\|\|!userId\)return null/);
 assert.match(slot,/if\(allow\)localStorage\.setItem\(key,'yes'\)/);
});
test('RLS basic read rule never grants write privileges',()=>{
 const sql=read('supabase/migrations/20261106_conecta_progressive_adult_feed.sql');
 assert.match(sql,/conecta_basic_feed_allowed/);
 assert.match(sql,/create policy conecta_id_posts_basic_select/);
 assert.match(sql,/visibility = 'public'/);
 assert.match(sql,/moderation_status = 'approved'/);
 assert.match(sql,/create policy conecta_id_posts_full_insert/);
 assert.match(sql,/with check \(app_private\.conecta_network_access_allowed/);
 assert.doesNotMatch(sql,/grant .*service_role.* to authenticated/i);
});
