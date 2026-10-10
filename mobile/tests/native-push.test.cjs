'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('Native device tokens are opt-in and never provisioned at app launch',()=>{
 const native=read('src/native-notifications.tsx');
 const remote=read('src/remote-push.ts');
 const ui=read('src/permissions-ui.tsx');
 assert.match(native,/Notifications\.requestPermissionsAsync/);
 assert.match(native,/registerRemotePush\(userId\)/);
 assert.match(native,/unregisterRemotePush\(userId\)/);
 assert.match(remote,/getExpoPushTokenAsync\(\{projectId:PROJECT_ID\}\)/);
 assert.match(remote,/remotePushConfigured\(\)/);
 assert.match(remote,/Notifications\.getPermissionsAsync\(\)/);
 assert.doesNotMatch(remote,/requestPermissionsAsync/);
 assert.match(ui,/pushRegistered/);
 assert.match(ui,/remotePushConfigured/);
});
test('Device registration requires JWT and never trusts a client-supplied owner',()=>{
 const remote=read('src/remote-push.ts');
 const app=read('App.tsx');
 assert.match(remote,/session\?\.user\.id!==userId/);
 assert.match(remote,/Authorization:'Bearer '\+session\.access_token/);
 assert.match(remote,/JSON\.stringify\(\{token,platform:Platform\.OS\}\)/);
 assert.doesNotMatch(remote,/service_role|sb_secret_/i);
 assert.match(app,/unregisterRemotePush\(user\.id\)/);
 assert.match(app,/onOpenMessages=/);
 assert.match(nativeFromApp(),/NativeForegroundNotificationBridge/);
 function nativeFromApp(){return app;}
});
test('A missing Expo project ID does not enable background push implicitly',()=>{
 const remote=read('src/remote-push.ts');
 const env=read('.env.example');
 assert.match(remote,/EXPO_PUBLIC_EAS_PROJECT_ID/);
 assert.match(remote,/if\(!remotePushConfigured\(\)/);
 assert.doesNotMatch(remote,/EXPO_PUBLIC_SUPABASE_SERVICE_ROLE/);
 assert.match(env,/EXPO_PUBLIC_EAS_PROJECT_ID/);
});
