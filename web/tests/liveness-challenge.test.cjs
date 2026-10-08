'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const ts=require('typescript');
const vm=require('node:vm');
const file=path.join(__dirname,'../src/lib/liveness-challenge.ts');
const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const mod={};vm.runInNewContext(output,{exports:mod},{filename:file});
const {createChallenge,currentChallenge,advanceChallenge}=mod;
const frame=(time,yaw=0,gestures=[])=>({
 timestamp:time,faceCount:1,faceScore:0.86,liveness:0.84,antiSpoof:0.86,
 yawRadians:yaw,gestures
});
test('multi-frame challenge completes only after alternating head turns and blink',()=>{
 let s=createChallenge(0,true);
 for(const t of [100,300,500])s=advanceChallenge(s,frame(t));
 assert.equal(currentChallenge(s),'turn-positive');
 for(const t of [700,900])s=advanceChallenge(s,frame(t,0.39));
 assert.equal(currentChallenge(s),'turn-negative');
 for(const t of [1100,1300])s=advanceChallenge(s,frame(t,-0.38));
 assert.equal(currentChallenge(s),'blink');
 s=advanceChallenge(s,frame(1450,0,['blink left eye']));
 assert.equal(s.status,'running');
 s=advanceChallenge(s,frame(1730));
 assert.equal(s.status,'completed');
 assert.equal(currentChallenge(s),'completed');
});
test('spoofing and missing antispoof scores cannot pass',()=>{
 let s=createChallenge(0,false);
 for(let i=1;i<=12;i++)s=advanceChallenge(s,{...frame(i*220),antiSpoof:null});
 assert.notEqual(s.status,'completed');
 assert.equal(s.index,0);
});
test('second face resets the motion challenge after repeated frames',()=>{
 let s=createChallenge(0,true);
 for(const t of [100,200,300])s=advanceChallenge(s,frame(t));
 assert.equal(s.index,1);
 for(const t of [400,500,600,700,800])s=advanceChallenge(s,{...frame(t),faceCount:2});
 assert.equal(s.index,0);
});
test('a blank gesture stream never fakes a blink',()=>{
 let s=createChallenge(0,true);
 for(const t of [100,200,300])s=advanceChallenge(s,frame(t));
 for(const t of [400,500])s=advanceChallenge(s,frame(t,.4));
 for(const t of [600,700])s=advanceChallenge(s,frame(t,-.4));
 for(const t of [800,900,1000,1200])s=advanceChallenge(s,frame(t));
 assert.equal(s.status,'running');
});
test('the preflight is inconclusive at timeout and cannot issue any proof',()=>{
 let s=createChallenge(0,true);
 s=advanceChallenge(s,frame(90001));
 assert.equal(s.status,'inconclusive');
 assert.ok(!('identity_verified' in s));
 assert.ok(!('age_verified' in s));
});
