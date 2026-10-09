'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/lib/chat-web-push.ts'),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
vm.runInNewContext(js,{module:mod,exports:mod.exports,URL});
const {allowedChatPushEndpoint,validChatPushKey,CHAT_PUSH_PAYLOAD,CHAT_PUSH_BODY,chatPushShouldNotify,chatPushDeliveryOptions}=mod.exports;
test('strict HTTPS gateway allowlist rejects SSRF and URLs with credentials',()=>{
  assert.equal(allowedChatPushEndpoint('https://fcm.googleapis.com/fcm/send/abcdefghijklmnop'),true);
  assert.equal(allowedChatPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abcdefghijklmnop'),true);
  for(const url of ['http://127.0.0.1:3000/admin','https://evil.example/push',
    'https://fcm.googleapis.com.evil.test/fcm/send/abcdefghijk','https://user:pass@fcm.googleapis.com/fcm/send/abcdefghijklmnop',
    'https://fcm.googleapis.com:8443/fcm/send/abcdefghijklmnop',
    'https://fcm.googleapis.com/fcm/send/abcdefghijklmnop?token=a']){
    assert.equal(allowedChatPushEndpoint(url),false,url);
  }
});
test('subscription keys enforce base64url shape',()=>{
 assert.equal(validChatPushKey('ABcd0123456789_-ABCDEFG'),true);
 assert.equal(validChatPushKey('x'.repeat(500)),false);
 assert.equal(validChatPushKey('invalid key with spaces'),false);
});
test('notification payload cannot leak message IDs, names or text',()=>{
 assert.equal(CHAT_PUSH_PAYLOAD,'{"kind":"chat"}');
 assert.ok(!CHAT_PUSH_PAYLOAD.includes('sender'));
 assert.equal(CHAT_PUSH_BODY,'Você recebeu uma nova mensagem.');
});
test('push is not sent to sender, muted rooms or messages already read',()=>{
 const created='2026-10-09T12:00:00Z';
 assert.equal(chatPushShouldNotify({user_id:'sender',muted_until:null,last_read_at:null},'sender',created),false);
 assert.equal(chatPushShouldNotify({user_id:'recipient',muted_until:'2026-10-11T12:00:00Z',last_read_at:null},'sender',created,Date.parse(created)),false);
 assert.equal(chatPushShouldNotify({user_id:'recipient',muted_until:null,last_read_at:'2026-10-09T12:01:00Z'},'sender',created),false);
 assert.equal(chatPushShouldNotify({user_id:'recipient',muted_until:null,last_read_at:null},'sender',created),true);
});

test('Edge on Windows WNS push gateways with a single token are accepted',()=>{
 const wns='https://wns2-ch1p.notify.windows.com/w/?token=AQEBabcdefghijklmno%2F1234%2Btest%3D';
 assert.equal(allowedChatPushEndpoint(wns),true);
 assert.equal(allowedChatPushEndpoint('https://cloud.notify.windows.com/w/?token=AQEBabcdefghijklmno123456'),true);
 assert.equal(chatPushDeliveryOptions(wns).headers['X-WNS-Type'],'wns/raw');
 assert.equal('urgency' in chatPushDeliveryOptions(wns),false);
 const fcm=chatPushDeliveryOptions('https://fcm.googleapis.com/fcm/send/abcdefghijklmnop');
 assert.equal(fcm.urgency,'normal');
 assert.equal('headers' in fcm,false);
 for(const bad of [
  'https://wns2-ch1p.notify.windows.com.evil.test/w/?token=AQEBabcdefghijklmno',
  'https://evil.test/w/?token=AQEBabcdefghijklmno',
  'http://wns2-ch1p.notify.windows.com/w/?token=AQEBabcdefghijklmno',
  'https://wns2-ch1p.notify.windows.com:4433/w/?token=AQEBabcdefghijklmno',
  'https://wns2-ch1p.notify.windows.com/admin?token=AQEBabcdefghijklmno',
  'https://wns2-ch1p.notify.windows.com/w/?token=AQEBabcdefghijklmno&next=evil',
  'https://wns2-ch1p.notify.windows.com/w/?redirect=https://evil.test',
  'https://wns2-ch1p.notify.windows.com/w/?token=abc',
  'https://wns2-ch1p.notify.windows.com/w/?token=bad%0Aheader'
 ])assert.equal(allowedChatPushEndpoint(bad),false,bad);
});
