'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const js=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/chat-web-push.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};vm.runInNewContext(js,{module:mod,exports:mod.exports,URL});
const {validChatPushSubject}=mod.exports;
test('VAPID subjects include HTTPS contact pages and mailto contact addresses',()=>{
 assert.equal(validChatPushSubject('https://conectav2-validacao.onrender.com'),true);
 assert.equal(validChatPushSubject('mailto:suporte@example.org'),true);
 for(const invalid of ['http://conectav2-validacao.onrender.com','file:///etc/passwd','mailto:missing-at-sign',
  'https://evil.test/path?token=secret','https://user:pass@evil.test','https://evil.test:8443']){
  assert.equal(validChatPushSubject(invalid),false,invalid);
 }
});
