'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const tsCode=fs.readFileSync(path.join(__dirname,'../src/lib/chat-push-origin.ts'),'utf8');
const js=ts.transpileModule(tsCode,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const mod={exports:{}};
vm.runInNewContext(js,{module:mod,exports:mod.exports,URL});
const {allowedChatPushRequestOrigin:allows}=mod.exports;
const render='https://conectav2-validacao.onrender.com';
const vercel='https://conectav2-michael-raimundos-projects.vercel.app';
const proxied='http://localhost:10000/api/chat/push/subscription';
const req=(origin,fetchSite='same-origin',requestUrl=proxied,extraTrustedOrigin)=>({
 origin,fetchSite,requestUrl,extraTrustedOrigin
});

test('valid same-origin requests work behind Render localhost reverse proxy',()=>{
 assert.equal(allows(req(render)),true);
 assert.equal(allows(req(render,'same-origin','http://127.0.0.1:10000/api/chat/push/test')),true);
 assert.equal(allows(req(vercel)),true);
 assert.equal(allows(req('http://localhost:3000','same-origin',
   'http://localhost:3000/api/chat/push/dispatch')),true);
});
test('strictly deny remote websites, misleading suffixes and invalid origins',()=>{
 for(const fake of [
  'https://evil.example',
  'https://conectav2-validacao.onrender.com.evil.example',
  'https://other-service.onrender.com',
  'https://conectav2-validacao.onrender.com:8443',
  'http://conectav2-validacao.onrender.com',
  'https://user@conectav2-validacao.onrender.com',
  'https://conectav2-validacao.onrender.com/other',
  'null',
  'data:text/plain,no'
 ])assert.equal(allows(req(fake)),false,fake);
});
test('Fetch Metadata cross-site always denied, including public hosts',()=>{
 assert.equal(allows(req(render,'cross-site')),false);
 assert.equal(allows(req('https://evil.example','cross-site')),false);
});
test('custom public HTTPS host requires exact server configuration',()=>{
 const custom='https://social.example.org';
 assert.equal(allows(req(custom)),false);
 assert.equal(allows(req(custom,'same-origin',proxied,custom)),true);
 assert.equal(allows(req(custom,'same-origin',proxied,'https://evil.example/path')),false);
 assert.equal(allows(req(custom,'same-origin',proxied,'http://social.example.org')),false);
 assert.equal(allows(req(custom,'same-origin',proxied,custom+'/other')),false);
});
test('bearer-authenticated clients may omit Origin, but not a cross-site browser',()=>{
 assert.equal(allows(req(null,'none')),true);
 assert.equal(allows(req(null,'cross-site')),false);
});
