'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const read=relative=>fs.readFileSync(path.join(__dirname,'..',relative),'utf8');

test('ONNX PAD uses pinned, hash-checked weights and the upstream real-face class (index 1)',()=>{
 const prep=read('scripts/prepare-antispoof.cjs');
 const source=read('src/lib/identity-antispoof-onnx.ts');
 assert.match(prep,/MODEL_SHA256='d7b3cd9ba8a7ceb13baa8c4720902e27ca3112eff52f926c08804af6b6eecc7b'/);
 assert.match(prep,/MODEL_SIZE=1744116/);
 assert.match(prep,/checksum\/length mismatch/);
 assert.match(source,/const LIVE_INDEX=1/);
 assert.match(source,/const MIN_LIVE_CONFIDENCE=0\.72/);
 assert.match(source,/executionProviders:\['cpu'\]/);
 assert.match(source,/tensorValues\.fill\(0\)/);
});

test('ONNX scoring does not confuse high fake scores with real faces or accept malformed output',()=>{
 const source=read('src/lib/identity-antispoof-onnx.ts');
 const javascript=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const exports={};
 vm.runInNewContext(javascript,{exports,process:{cwd:()=>'/tmp/conecta'},require:(id)=>{
   if(id==='node:path')return require('node:path');
   if(id==='sharp')return ()=>({});
   if(id==='onnxruntime-node')return {};
   throw Error('Unexpected dependency '+id);
 }},{filename:'identity-antispoof-onnx.ts'});
 const score=exports.classifyLiveScore;
 assert.equal(score([0,5,0]).status,'live');
 assert.equal(score([5,0,0]).status,'inconclusive');
 assert.equal(score([0,0,5]).status,'inconclusive');
 assert.equal(score([NaN,1,0]).reason,'model_unavailable');
 assert.equal(score([1,2]).status,'inconclusive');
 assert.equal(score([1,1,1]).status,'inconclusive');
});

test('Vercel delegates only identity routes to the dedicated fixed Render origin, without browser cookies',()=>{
 const code=read('src/lib/identity-validation-delegate.ts');
 const verify=read('src/app/api/identity/free-document/verify/route.ts');
 const challenge=read('src/app/api/identity/free-document/liveness-challenge/route.ts');
 assert.match(code,/https:\/\/conectav2-validacao\.onrender\.com/);
 assert.match(code,/allowedPaths=new Set/);
 assert.match(code,/env\.VERCEL==='1'/);
 assert.match(code,/hostname!=='conectav2-validacao\.onrender\.com'/);
 assert.match(code,/redirect:'manual'/);
 assert.match(code,/authorization/);
 assert.doesNotMatch(code,/request\.headers\.get\('cookie'\)/);
 assert.match(code,/bytes\.byteLength>4_400_000/);
 assert.match(code,/new Uint8Array\(bytes\)\.fill\(0\)/);
 assert.match(verify,/const delegated=await delegateIdentityValidation\(request\)/);
 assert.match(challenge,/const delegated=await delegateIdentityValidation\(request\)/);
});

test('ONNX uncertainty never approves identity or automatically retries one-use challenges',()=>{
 const route=read('src/app/api/identity/free-document/verify/route.ts');
 const ui=read('src/components/free-document-verification.tsx');
 assert.match(route,/presentation\.status!=='live'/);
 assert.match(route,/presentation\.reason==='model_unavailable'/);
 assert.match(route,/solicite revisão manual/);
 assert.match(route,/identityVerified:false/);
 assert.match(route,/complete_conecta_document_age_assurance/);
 assert.match(ui,/setChallenge\(''\);setInstructions\(\[\]\);setFrameIndex\(0\);setFrames\(\[\]\);setStep\(3\)/);
});
