'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const route=read('src/app/api/mobile/push/devices/route.ts');
const server=read('src/lib/mobile-push-server.ts');
const delivery=read('src/lib/mobile-push-delivery.ts');
const bridge=read('src/lib/chat-push-delivery.ts');
const sql=read('../supabase/migrations/20261010033000_conecta_mobile_push_devices.sql');

test('Only bearer-authenticated, age-verified users can register a native device',()=>{
 assert.match(route,/nativePushContext\(request\)/);
 assert.match(route,/nativePushRequestAllowed\(request\)/);
 assert.match(server,/auth\.getUser\(bearer\)/);
 assert.match(server,/user\.is_anonymous/);
 assert.match(server,/declaration\?\.declared_band!=='18_plus'/);
 assert.match(server,/from\('profiles'\)/);
 assert.match(server,/EXPO_PUSH_TOKEN=/);
 assert.match(route,/nativePushTokenHash\(device\.token\)/);
 assert.match(route,/\.eq\('user_id',ctx\.user\.id\)/);
 assert.match(route,/length>=5/);
 assert.doesNotMatch(route,/body\.user_id|body\.recipient_id/);
});

test('Push token registry is private, with no authenticated SELECT/INSERT grants',()=>{
 assert.match(sql,/alter table public\.mobile_push_devices enable row level security/i);
 assert.match(sql,/revoke all on public\.mobile_push_devices from public, anon, authenticated/i);
 assert.match(sql,/grant select, insert, update, delete on public\.mobile_push_devices to service_role/i);
 assert.match(sql,/references auth\.users\(id\) on delete cascade/i);
});

test('Signed chat dispatch retains recipient authorization and sends only generic alerts',()=>{
 assert.match(bridge,/conversation_members/);
 assert.match(bridge,/user_blocks/);
 assert.match(bridge,/chatPushShouldNotify/);
 assert.match(bridge,/sendMobileChatPush\(admin,mobile/);
 assert.match(delivery,/exp\.host\/--\/api\/v2\/push\/send/);
 assert.match(delivery,/EXPO_ACCESS_TOKEN/);
 assert.match(delivery,/DeviceNotRegistered/);
 assert.match(delivery,/data:\{kind:'native-chat'\}/);
 assert.doesNotMatch(delivery,/message\.content|message\.sender|conversationId/);
 assert.match(sql,/app_private\.chat_push_webhook_config/);
 assert.match(sql,/vault\.decrypted_secrets/);
 assert.match(sql,/extensions\.hmac/);
});
