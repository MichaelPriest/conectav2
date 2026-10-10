const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const ts=require('typescript');

const sourcePath=path.resolve(__dirname,'../src/lib/open-source-image-moderation.ts');
const temporaryPath=path.resolve(__dirname,'../src/lib/.oss-moderation-real-model-test.mjs');

test('real MIT NSFWJS model reviews only photos with material explicit-content risk',async()=>{
 const source=(await fs.readFile(sourcePath,'utf8')).replace(/^import 'server-only';\s*/m,'');
 assert.equal(source.includes("modelPromise"),true,'Model must be process-cached');
 assert.match(source,/reviewRequired:flagged\|\|borderline/,'ordinary photos must not always await a human');
 const js=ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
 }).outputText;
 await fs.writeFile(temporaryPath,js,'utf8');
 try{
  const {classifyLocalImage}=await import(pathToFileURL(temporaryPath).href);
  const sharp=require('sharp');
  const input=await sharp({
   create:{width:240,height:240,channels:3,background:{r:242,g:242,b:242}}
  }).jpeg().toBuffer();
  const verdict=await classifyLocalImage(new Uint8Array(input));
  assert.equal(verdict.provider,'nsfwjs-mobilenet-v2');
  const scores=verdict.classification;
  const risk=scores.Porn+scores.Hentai+scores.Sexy*0.75;
  assert.equal(verdict.reviewRequired,verdict.flagged||risk>=0.36,
   'only flagged or borderline image classifications trigger mandatory review');
  assert.equal(typeof verdict.flagged,'boolean');
  assert.ok(Object.values(verdict.classification).every(n=>n>=0&&n<=1));
  await assert.rejects(()=>classifyLocalImage(new Uint8Array([])),/exceeds 10MB/);
 }finally{
  await fs.unlink(temporaryPath).catch(()=>{});
 }
},{timeout:90000});
