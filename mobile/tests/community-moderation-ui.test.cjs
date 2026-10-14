'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('Community owners and staff can open native moderation without bypassing server permissions',()=>{
 const app=read('App.tsx'),ui=read('src/community-moderation-ui.tsx');
 assert.match(app,/import \{CommunityModerationScreen\} from '\.\/src\/community-moderation-ui'/);
 assert.match(app,/community_staff/);
 assert.match(app,/canManage&&<Action secondary label="Administrar"/);
 assert.match(app,/CommunityModerationScreen community=\{community\} userId=\{userId\}/);
 for(const rpc of ['review_community_post','set_community_moderation','manage_community_staff','moderate_community_member']){
  assert.ok(ui.includes("rpc('"+rpc+"'"),'Expected protected RPC '+rpc);
 }
 assert.match(ui,/\.eq\('community_id',community\.id\)/);
 assert.match(ui,/community_settings/);
 assert.match(ui,/community_reports/);
 assert.match(ui,/if\(!isMod\)/);
 assert.doesNotMatch(ui,/service_role|SUPABASE_SECRET_KEY|admin\.from/);
});

test('Community owners can edit description and rules under the existing owner RLS policy',()=>{
 const app=read('App.tsx');
 assert.match(app,/community\.owner_id===userId&&<Action secondary label="Editar comunidade"/);
 assert.match(app,/from\('communities'\)\.update\(\{/);
 assert.match(app,/\.eq\('id',community\.id\)\.eq\('owner_id',userId\)/);
 assert.match(app,/onCommunityUpdated\(next\)/);
});
