'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const ts=require('typescript');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../src/lib/cin-qr.ts'),'utf8');
const javascript=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const loadedExports={};
vm.runInNewContext(javascript,{exports:loadedExports,crypto:webcrypto,atob:globalThis.atob,TextEncoder,TextDecoder,URL,Date,Uint8Array,Number,Array,JSON},{filename:'cin-qr.ts'});
const {inspectCinWithKey}=loadedExports;
const b64=input=>Buffer.from(input).toString('base64url');
const cpf='52998224725';
const claims={iss:'MJSP',cpf,dns:'07/08/2001',dvd:'02/02/2036',url:'https://cin.mj.gov.br/cidadao/123e4567-e89b-12d3-a456-426614174000'};
async function setup(){
 const keyPair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-521'},true,['sign','verify']);
 const jwk=await webcrypto.subtle.exportKey('jwk',keyPair.publicKey);
 return {keyPair,jwk};
}
async function token(privateKey,payload=claims,header={alg:'ES512',typ:'JWT'}){
 const msg=b64(JSON.stringify(header))+'.'+b64(JSON.stringify(payload));
 const signed=new Uint8Array(await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-512'},privateKey,new TextEncoder().encode(msg)));
 return msg+'.'+b64(signed);
}
const now=new Date('2026-10-08T12:00:00Z');
test('P-521 ES512 valid test signature returns indicative, not verified adult status',async()=>{
 const {keyPair,jwk}=await setup();
 const result=await inspectCinWithKey(await token(keyPair.privateKey),jwk,now);
 assert.equal(result.status,'signature-valid-local');
 assert.equal(result.indicativeAgeBand,'18_plus');
 assert.ok(!('approved' in result));
 assert.ok(!('cpf' in result));
 assert.ok(!('dateOfBirth' in result));
});
test('tampered claims must invalidate signature',async()=>{
 const {keyPair,jwk}=await setup();
 const valid=await token(keyPair.privateKey);
 const arr=valid.split('.');
 arr[1]=b64(JSON.stringify({...claims,dns:'07/08/2012'}));
 const result=await inspectCinWithKey(arr.join('.'),jwk,now);
 assert.equal(result.status,'signature-invalid');
});
test('wrong signing key does not verify',async()=>{
 const one=await setup(),other=await setup();
 const result=await inspectCinWithKey(await token(one.keyPair.privateKey),other.jwk,now);
 assert.equal(result.status,'signature-invalid');
});
test('unsupported QR types, broken fields and expired documents are never approved',async()=>{
 const {keyPair,jwk}=await setup();
 assert.equal((await inspectCinWithKey('https://example.com',jwk,now)).status,'unsupported');
 assert.equal((await inspectCinWithKey(await token(keyPair.privateKey,{...claims,cpf:'11111111111'}),jwk,now)).status,'invalid-data');
 assert.equal((await inspectCinWithKey(await token(keyPair.privateKey,{...claims,url:'https://evil.example/uuid'}),jwk,now)).status,'invalid-data');
 assert.equal((await inspectCinWithKey(await token(keyPair.privateKey,{...claims,dvd:'01/01/2020'}),jwk,now)).status,'expired');
 assert.equal((await inspectCinWithKey(await token(keyPair.privateKey,claims,{alg:'none'}),jwk,now)).status,'unsupported');
});
test('young age output remains only indicative and never changes Supabase',async()=>{
 const {keyPair,jwk}=await setup();
 const result=await inspectCinWithKey(await token(keyPair.privateKey,{...claims,dns:'04/08/2011'}),jwk,now);
 assert.equal(result.indicativeAgeBand,'13_15');
 assert.ok(!('age_verified' in result));
 const scanner=fs.readFileSync(path.join(__dirname,'../src/components/cin-qr-scanner.tsx'),'utf8');
 assert.doesNotMatch(scanner,/identity_verifications|\.insert\(|\.upsert\(|\.update\(/);
});
