'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const ts=require('typescript');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const helperFile=path.join(root,'src/lib/identity-frame-guidance.ts');
const output=ts.transpileModule(fs.readFileSync(helperFile,'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const mod={};
vm.runInNewContext(output,{exports:mod},{filename:helperFile});
const {inspectGuidedFace}=mod;

function face({cx=.5,cy=.5,width=.42,height=.54,offset=0}={}){
 const points=Array.from({length:478},(_,i)=>{
  const angle=2*Math.PI*i/478;
  return {x:cx+Math.cos(angle)*width/2,y:cy+Math.sin(angle)*height/2,z:0};
 });
 points[33]={x:cx-.07,y:cy-.08,z:0};
 points[263]={x:cx+.07,y:cy-.08,z:0};
 points[1]={x:cx+offset,y:cy,z:0};
 return points;
}
test('only one well framed, centered face is ready for neutral frames',()=>{
 const ready=inspectGuidedFace([face()],0);
 assert.equal(ready.ready,true);
 assert.equal(ready.status,'ready');
 assert.equal(inspectGuidedFace([],0).status,'missing');
 assert.equal(inspectGuidedFace([face(),face()],0).status,'multiple');
 assert.equal(inspectGuidedFace([face({cx:.76})],0).status,'off-center');
 assert.equal(inspectGuidedFace([face({width:.2,height:.25})],0).status,'distant');
 assert.equal(inspectGuidedFace([face({width:.85,height:.9})],0).status,'close');
});
test('the four guided steps require neutral, turn, turn, neutral positions',()=>{
 const center=face(),turned=face({offset:.046});
 assert.equal(inspectGuidedFace([center],0).ready,true);
 assert.equal(inspectGuidedFace([center],1).status,'pose');
 assert.equal(inspectGuidedFace([turned],1).ready,true);
 assert.equal(inspectGuidedFace([turned],2).ready,true);
 assert.equal(inspectGuidedFace([turned],3).status,'pose');
 assert.equal(inspectGuidedFace([center],3).ready,true);
});
test('invalid and cut-off landmarks are never considered ready',()=>{
 assert.equal(inspectGuidedFace([[{x:0,y:0}]],0).ready,false);
 assert.equal(inspectGuidedFace([face({cx:.93})],0).ready,false);
 const invalid=face();
 invalid[99]={x:NaN,y:.5,z:0};
 assert.equal(inspectGuidedFace([invalid],0).ready,false);
});
test('the real Conecta ID camera uses automatic stable detection, a visible frame and safe manual fallback',()=>{
 const ui=fs.readFileSync(path.join(root,'src/components/free-document-verification.tsx'),'utf8');
 assert.match(ui,/inspectGuidedFace\(engine\.detect\(video\)\.faceLandmarks\|\|\[\],frameIndex\)/);
 assert.match(ui,/stable>=3&&now-firstReadyAt>=650/);
 assert.match(ui,/void captureFrame\(\)/);
 assert.match(ui,/data-testid="conecta-face-guide-frame"/);
 assert.match(ui,/guideColor/);
 assert.match(ui,/guideStableCount/);
 assert.match(ui,/Capturar agora \(opcional\)/);
 assert.match(ui,/setStep\(4\)/);
 assert.doesNotMatch(ui,/setInterval\(\(\)=>\{void captureFrame\(\);\},5000\)/);
 // Client-side landmarks never authorize verification: the server remains in charge.
 const server=fs.readFileSync(path.join(root,'src/app/api/identity/free-document/verify/route.ts'),'utf8');
 assert.match(server,/instance\.match\.similarity/);
 assert.match(server,/liveness_sequence_invalid/);
 assert.doesNotMatch(server,/form\.get\(['"](?:landmarks|frameReady|faceScore)['"]\)/);
});
