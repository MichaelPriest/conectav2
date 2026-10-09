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
const frame=(timestamp,yawRadians=0,gestures=[])=>({
 timestamp,faceCount:1,faceScore:.82,liveness:.85,antiSpoof:.84,
 yawRadians,gestures
});
const feed=(state,...frames)=>frames.reduce((s,f)=>advanceChallenge(s,f),state);

test('either first turn followed by its opposite and a slow blink completes',()=>{
 let s=createChallenge(0);
 s=feed(s,frame(100),frame(320));
 assert.equal(currentChallenge(s),'turn-any');
 s=feed(s,frame(520,-.38,['facing left']),frame(740,-.36,['facing left']));
 assert.equal(currentChallenge(s),'turn-opposite');
 s=feed(s,frame(940,.38,['facing right']),frame(1160,.37,['facing right']));
 assert.equal(currentChallenge(s),'blink');
 s=feed(s,frame(1400,0,['facing center','blink right eye']),frame(1900,0,['facing center']));
 assert.equal(s.status,'completed');
 assert.equal(currentChallenge(s),'completed');
 assert.ok(!('identityVerified' in s));
 assert.ok(!('ageVerified' in s));
});
test('mirrored head direction works and gestures replace missing yaw',()=>{
 let s=createChallenge(0);
 s=feed(s,frame(100,0,['facing center']),frame(320,0,['facing center']));
 s=feed(s,frame(520,null,['facing right']),frame(740,null,['facing right']));
 assert.equal(currentChallenge(s),'turn-opposite');
 s=feed(s,frame(940,null,['facing left']),frame(1160,null,['facing left']));
 assert.equal(currentChallenge(s),'blink');
});
test('weak/missing liveness and anti-spoof NEVER progress',()=>{
 let s=createChallenge(0);
 for(let i=1;i<40;i++)s=advanceChallenge(s,{...frame(i*140),antiSpoof:i%2?null:.59,liveness:.94});
 assert.equal(s.index,0);
 assert.notEqual(s.status,'completed');
});
test('brief low-confidence frames do not erase steps',()=>{
 let s=feed(createChallenge(0),frame(100),frame(300),frame(500,.4),frame(700,.42));
 assert.equal(currentChallenge(s),'turn-opposite');
 s=feed(s,{...frame(900),faceCount:0},{...frame(1100),faceScore:.2});
 assert.equal(currentChallenge(s),'turn-opposite');
});
test('multiple faces for four valid frames restarts challenge',()=>{
 let s=feed(createChallenge(0),frame(100),frame(300),frame(500,.41),frame(700,.4));
 for(let i=1;i<=4;i++)s=advanceChallenge(s,{...frame(700+i*140),faceCount:2});
 assert.equal(currentChallenge(s),'center');
 assert.equal(s.index,0);
});
test('blink cannot complete with open eyes only',()=>{
 let s=feed(createChallenge(0),frame(100),frame(300),frame(500,.4),frame(700,.4),frame(900,-.4),frame(1100,-.4));
 s=feed(s,frame(1300),frame(1500),frame(1700),frame(1900));
 assert.equal(currentChallenge(s),'blink');
 assert.equal(s.status,'running');
});
test('time limit and stale frames do not create proof',()=>{
 let s=createChallenge(0);
 s=advanceChallenge(s,frame(90000));
 assert.equal(s.status,'running');
 s=advanceChallenge(s,frame(120001));
 assert.equal(s.status,'inconclusive');
 assert.ok(!('identityVerified' in s));
 s=advanceChallenge(s,frame(120002));
 assert.equal(s.status,'inconclusive');
});
test('zero-duration artificial duplicate frames cannot count as two frames',()=>{
 let s=createChallenge(1000);
 s=advanceChallenge(s,frame(1100));
 s=advanceChallenge(s,frame(1100));
 assert.equal(s.index,0);
});
