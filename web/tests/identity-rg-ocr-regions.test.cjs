'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const test=require('node:test');
const ts=require('typescript');
const sharp=require('sharp');

const root=path.join(__dirname,'..');
const helperPath=path.join(root,'src/lib/identity-rg-ocr-regions.ts');
const js=ts.transpileModule(fs.readFileSync(helperPath,'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}
}).outputText;
const localExports={};
vm.runInNewContext(js,{exports:localExports,require,Buffer,Math,Error},{filename:helperPath});
const {prepareBirthDateOcrRegions}=localExports;

test('RG data-side OCR regions are real overlapping crops, with upscaling for small printed text',async()=>{
 const source=await sharp({create:{width:1100,height:700,channels:3,background:{r:120,g:140,b:160}}})
   .png().toBuffer();
 const crops=await prepareBirthDateOcrRegions(source);
 assert.equal(crops.length,2);
 for(const crop of crops){
  const info=await sharp(crop).metadata();
  assert.equal(info.format,'png');
  assert.ok(info.width>=700);
  assert.ok(info.height>=700);
  crop.fill(0);
 }
 const original=await sharp(source).metadata();
 assert.equal(original.width,1100);
 source.fill(0);
});

test('regions are not generated from malformed/small documents',async()=>{
 const small=await sharp({create:{width:80,height:100,channels:3,background:'#fff'}}).png().toBuffer();
 assert.equal((await prepareBirthDateOcrRegions(small)).length,0);
 small.fill(0);
});

test('server attempts 180-degree + alternative segmentation and region OCR only for legacy RG',()=>{
 const route=fs.readFileSync(path.join(root,'src/app/api/identity/free-document/verify/route.ts'),'utf8');
 assert.match(route,/reversedBlockResults=await Promise\.all\(reversedImages\.map/);
 assert.match(route,/detectedDates\.length===0&&documentType==='old-rg'/);
 assert.match(route,/prepareBirthDateOcrRegions\(ocrImages\[1\]\)/);
 assert.match(route,/oppositeRegions\.push\(await rotateOcrImage180\(image\)\)/);
 assert.match(route,/regionalResults=await Promise\.all\(candidates\.map/);
 assert.match(route,/blockResults=await Promise\.all\(candidates\.map/);
 assert.match(route,/for\(const image of regionImages\)image\.fill\(0\)/);
 assert.match(route,/for\(const image of oppositeRegions\)image\.fill\(0\)/);
 assert.match(route,/const uniqueDates=\[\.\.\.new Set\(detectedDates\)\]/);
 assert.match(route,/uniqueDates\.length>1/);
 assert.match(route,/if\(!dob\)return await failAttempt/);
 assert.doesNotMatch(route,/PaddleOCR|recognizeWithPaddleOcr/i);
});
