'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('App.tsx'),data=read('src/data.ts'),config=read('src/supabase.ts');
test('Native Android/iOS app is real React Native, not a WebView',()=>{
 const json=JSON.parse(read('app.json'));
 assert.equal(json.expo.android.package,'br.com.conectav2.app');
 assert.equal(json.expo.ios.bundleIdentifier,'br.com.conectav2.app');
 assert.ok(app.includes('from \'react-native\''));
 assert.ok(!app.includes('WebView'));
 assert.ok(!app.includes('iframe'));
});
test('Same Supabase backend and real signed-in data',()=>{
 assert.ok(config.includes('opdlxxrcdsxqmlhgayfm.supabase.co'));
 assert.ok(config.includes('createClient('));
 assert.ok(config.includes('autoRefreshToken:true'));
 assert.ok(!/service_role|sb_secret_/.test(config));
 for(const name of ['loadFeed','loadThreads','loadConnections','loadCommunities','loadNotifications']){
  assert.ok(app.includes(name),name);
 }
});
test('Age declaration and onboarding restrictions cannot be skipped by mobile views',()=>{
 assert.ok(data.includes("from('registration_age_declarations')"));
 assert.ok(data.includes("declared_band!=='18_plus'"));
 assert.ok(app.includes('restricted?<Restricted'));
 assert.ok(app.includes("'/verificar-identidade'"));
 assert.ok(app.includes("'/onboarding'"));
});
test('Publishing does not bypass current server moderation',()=>{
 assert.ok(data.includes("SITE_URL+'/api/moderation/review'"));
 assert.ok(data.includes("Authorization:'Bearer '+session.access_token"));
 assert.ok(data.includes('pending moderation state'));
 assert.ok(!data.includes('moderation_status:\'approved\''));
});
test('Native chat sends real messages and uses secured membership RPC',()=>{
 assert.ok(data.includes("rpc('create_conversation_with_members'"));
 assert.ok(data.includes("from('messages').insert("));
 assert.ok(data.includes("rpc('my_conversation_unread_counts')"));
 assert.ok(app.includes("filter:'conversation_id=eq.'+active"));
});
