'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');
const ts=require('typescript');
const src=fs.readFileSync(path.join(__dirname,'../src/lib/identity-origin.ts'),'utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exported={};
vm.runInNewContext(js,{exports:exported,URL},{filename:'identity-origin.ts'});
const ok=exported.isTrustedIdentityOrigin;
const hdr=(origin,extra={})=>{
 const values={origin,...extra};
 return {get(name){return values[name.toLowerCase()]??null;}};
};
const internal='http://0.0.0.0:10000/api/identity/govbr/challenge';
test('accepts official staging HTTPS origin behind internal Render proxy',()=>{
 assert.equal(ok(hdr('https://conectav2-validacao.onrender.com',{'sec-fetch-site':'same-origin',host:'0.0.0.0:10000'}),internal),true);
});
test('blocks cross site including forged forwarded host and fetch metadata',()=>{
 assert.equal(ok(hdr('https://evil.example',{'sec-fetch-site':'cross-site','x-forwarded-host':'evil.example'}),internal),false);
 assert.equal(ok(hdr('https://evil.example',{'sec-fetch-site':'same-origin',host:'conectav2-validacao.onrender.com'}),internal),false);
});
test('accepts regular same-origin and configured production origins',()=>{
 assert.equal(ok(hdr('https://conecta.example',{'sec-fetch-site':'same-origin'}),'https://conecta.example/api/identity/govbr/challenge'),true);
 assert.equal(ok(hdr('https://conecta.example',{'sec-fetch-site':'same-origin'}),internal,{'CONECTA_PUBLIC_ORIGIN':'https://conecta.example'}),true);
 assert.equal(ok(hdr('https://conectav2-user.vercel.app',{'sec-fetch-site':'same-origin'}),internal,{VERCEL_URL:'conectav2-user.vercel.app'}),true);
});
test('requires safe HTTPS and denies missing origin without fetch metadata or bearer',()=>{
 assert.equal(ok(hdr('http://evil.example',{'sec-fetch-site':'same-origin'}),internal),false);
 assert.equal(ok(hdr(null,{}),internal),false);
 assert.equal(ok(hdr(null,{'sec-fetch-site':'cross-site',authorization:'Bearer token'}),internal),false);
 assert.equal(ok(hdr(null,{authorization:'Bearer valid-token'}),internal),true);
});
test('same-origin native form and authenticated browser POST accepted',()=>{
 assert.equal(ok(hdr('https://conectav2-validacao.onrender.com',{'sec-fetch-site':'same-origin'}),internal),true);
});
test('govbr endpoints enforce shared origin validation',()=>{
 for(const rel of ['challenge','inspect']){
  const s=fs.readFileSync(path.join(__dirname,'../src/app/api/identity/govbr/'+rel+'/route.ts'),'utf8');
  assert.match(s,/isTrustedIdentityOrigin\(request.headers,request.url,process.env\)/);
  assert.doesNotMatch(s,/origin!==new URL\(request.url\).origin/);
 }
});
