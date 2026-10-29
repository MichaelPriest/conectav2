'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');
const ts=require('typescript');
const sharp=require('sharp');

const root=path.join(__dirname,'..');
const file=path.join(root,'src/lib/identity-face-crop.ts');
const source=fs.readFileSync(file,'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
 esModuleInterop:true
}}).outputText;
const localExports={};
vm.runInNewContext(compiled,{exports:localExports,require,Buffer,Error,Number,Math},{filename:file});
const {originalFaceCropBounds,cropFaceAtOriginalResolution}=localExports;

test('RG face coordinates map from 1200px detector preview to native 2048px upload',()=>{
 const box=[205,360,90,125];
 const bounds=originalFaceCropBounds(box,{width:540,height:1200},{width:921,height:2048});
 assert.equal(bounds.left,Math.floor((205-90*.35)*921/540));
 assert.equal(bounds.top,Math.floor((360-125*.35)*2048/1200));
 assert.ok(bounds.width>90&&bounds.height>125);
});

test('source bounds are clipped, and invalid detector coordinates are rejected',()=>{
 const dim={width:500,height:1000};
 const bounds=originalFaceCropBounds([0,5,80,140],dim,dim);
 assert.equal(bounds.left,0);
 assert.equal(bounds.top,0);
 assert.throws(()=>originalFaceCropBounds([NaN,5,70,120],dim,dim));
 assert.throws(()=>originalFaceCropBounds([2,5,-10,120],dim,dim));
 assert.throws(()=>originalFaceCropBounds([2,5,70,120],{width:0,height:1000},dim));
});

test('face is cropped from the original upload and returned as a 512px RGB tensor source',async()=>{
 const sourceImage=await sharp({create:{
  width:921,height:2048,channels:3,background:{r:130,g:120,b:115}
 }}).png().toBuffer();
 const native=await cropFaceAtOriginalResolution(
  sourceImage,[230,400,95,115],{width:540,height:1200}
 );
 assert.equal(native.nativeFaceWidth,Math.round(95*921/540));
 assert.equal(native.nativeFaceHeight,Math.round(115*2048/1200));
 assert.equal(native.pixels.length,512*512*3);
 native.pixels.fill(0);
 sourceImage.fill(0);
});

test('age-only flow does not claim document ownership or unlock identity-gated access',()=>{
 const route=fs.readFileSync(path.join(root,'src/app/api/identity/free-document/verify/route.ts'),'utf8');
 const access=fs.readFileSync(path.join(root,'src/app/api/identity/access/route.ts'),'utf8');
 assert.doesNotMatch(route,/cropSimilarity<0\\.55/);
 assert.doesNotMatch(route,/cropFaceAtOriginalResolution\\(\\s*document,faceBox/);
 assert.match(route,/complete_conecta_document_age_assurance/);
 assert.match(route,/identityVerified:false/);
 assert.match(route,/ageAssured:true/);
 assert.match(route,/liveness_sequence_invalid/);
 assert.match(route,/neutralSimilarity<0\\.55/);
 assert.match(access,/basicAccess:true,accessLevel:'basic'/);
 assert.match(access,/networkAccess:false,basicAccess:true/);
});
