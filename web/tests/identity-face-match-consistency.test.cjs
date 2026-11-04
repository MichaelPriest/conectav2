'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const ts=require('typescript');
const vm=require('node:vm');

const src=fs.readFileSync(path.join(__dirname,'../src/lib/identity-face-match-consistency.ts'),'utf8');
const compiled=ts.transpileModule(src,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const mod={};
vm.runInNewContext(compiled,{exports:mod},{filename:'identity-face-match-consistency.ts'});
const {faceMatchConsistency:assess,FACE_MATCH_MIN_SIMILARITY:min}=mod;

test('all three independent facial comparisons must meet the unchanged threshold',()=>{
 assert.equal(min,0.55);
 assert.equal(assess(.55,.55,.55),'matched');
 assert.equal(assess(.76,.78,.81),'matched');
 assert.equal(assess(.54,.9,.9),'capture_inconsistent');
 assert.equal(assess(.9,.54,.9),'capture_inconsistent');
 assert.equal(assess(.8,.8,.54),'capture_inconsistent');
 assert.equal(assess(.3,.4,.85),'selfie_inconclusive');
 assert.equal(assess(.54,.54,.9),'selfie_inconclusive');
});

test('invalid scores are not considered matches and cannot bypass the safety gate',()=>{
 for(const value of [NaN,Infinity,-Infinity,-.01,1.1,undefined]){
  assert.equal(assess(value,.99,.99),'unavailable');
  assert.equal(assess(.99,value,.99),'unavailable');
  assert.equal(assess(.99,.99,value),'unavailable');
 }
 assert.equal(assess(.99,.99,.20),'capture_inconsistent');
});
