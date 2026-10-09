'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
const {createHmac}=require('node:crypto');
function transpile(filename,extra={}){
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/'+filename),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const mod={exports:{}};
 vm.runInNewContext(code,{module:mod,exports:mod.exports,
  require:(name)=>name==='@/lib/chat-push-delivery'?{CHAT_PUSH_UUID:/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i}:require(name),
  Buffer,Date,Math,...extra});
 return mod.exports;
}
const {verifiedChatPushWebhook}=transpile('chat-push-signature.ts');
const secret='abcdef0123456789abcdef0123456789abcdef0123456789';
const id='d9d53656-f755-418d-a8bd-5368f97d6692';
const now=1791560000;
function signed(issuedAt=now){
 return {messageId:id,issuedAt,signature:createHmac('sha256',secret).update(id+'.'+issuedAt).digest('hex')};
}
test('a signed, recent real message identifier is accepted',()=>{
 assert.equal(verifiedChatPushWebhook(signed(),secret,now),true);
});
test('signatures, timestamps, ids and keys are strictly verified',()=>{
 assert.equal(verifiedChatPushWebhook(signed(),secret+'wrong',now),false);
 assert.equal(verifiedChatPushWebhook(signed(now-121),secret,now),false);
 assert.equal(verifiedChatPushWebhook({...signed(),messageId:'other'},secret,now),false);
 assert.equal(verifiedChatPushWebhook({...signed(),signature:'0'.repeat(64)},secret,now),false);
 assert.equal(verifiedChatPushWebhook({...signed(),signature:'XYZ'},secret,now),false);
 assert.equal(verifiedChatPushWebhook(signed(),undefined,now),false);
});
