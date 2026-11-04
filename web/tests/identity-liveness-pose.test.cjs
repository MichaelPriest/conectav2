'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const ts=require('typescript');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const helper=fs.readFileSync(path.join(root,'src/lib/identity-liveness-pose.ts'),'utf8');
const compiled=ts.transpileModule(helper,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const pose={};
vm.runInNewContext(compiled,{exports:pose},{filename:'identity-liveness-pose.ts'});

function mesh(noseX){
 const points=Array.from({length:468},()=>[0,0,0]);
 points[33]=[100,100,0];
 points[263]=[200,100,0];
 points[1]=[noseX,130,0];
 return points;
}

test('Human mesh and MediaPipe points produce exactly the same normalized offset',()=>{
 for(const noseX of [125,140,150,160,175]){
   const normalized=pose.noseEyeTurnOffset(.3,.5,noseX/500+.1);
   const human=pose.humanMeshTurnOffset(mesh(noseX));
   // Normalized image is the 500px full image: eye 100,200 = .2,.4.
   const mediaPipe=pose.noseEyeTurnOffset(.2,.4,noseX/500);
   assert.ok(Math.abs(human-mediaPipe)<1e-12);
   assert.equal(Number.isFinite(normalized),true);
 }
 assert.equal(pose.humanMeshTurnOffset(undefined),null);
 assert.equal(pose.humanMeshTurnOffset(mesh(NaN)),null);
 assert.equal(pose.noseEyeTurnOffset(0,0,1),null);
});

test('server checks both randomized directions with independently measured, substantial turns',()=>{
 const assess=pose.assessGuidedHeadTurns;
 assert.equal(assess([0,0.24,-0.23,0.02],['left','right']),'valid');
 assert.equal(assess([0,-0.23,0.24,-0.02],['right','left']),'valid');
 assert.equal(assess([0,0.24,-0.23,0.02],['right','left']),'invalid_sequence');
 assert.equal(assess([0,0,0,0],['left','right']),'invalid_sequence');
 assert.equal(assess([0,0.25,0.25,0],['left','right']),'invalid_sequence');
 assert.equal(assess([0.24,0.26,-0.24,0],['left','right']),'invalid_sequence');
 assert.equal(assess([0.35,0.25,-0.25,0],['left','right']),'invalid_sequence');
 assert.equal(assess([0,0.25,-0.25,0.4],['left','right']),'invalid_sequence');
 assert.equal(assess([0,null,-0.2,0],['left','right']),'invalid_face');
 assert.equal(assess([0,0.3,-0.3,0],['left','left']),'invalid_face');
});
