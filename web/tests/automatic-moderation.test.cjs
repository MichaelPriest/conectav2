const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const ts=require('typescript');
const sourceDir=path.resolve(__dirname,'../src/lib');
const temporary=[
 '.auto-text-moderation-test.mjs',
 '.auto-image-moderation-test.mjs',
 '.auto-video-moderation-test.mjs'
];
async function transpile(input,output,replacements=[]){
 let source=await fs.readFile(path.join(sourceDir,input),'utf8');
 source=source.replace(/^import 'server-only';\s*/m,'');
 for(const [a,b] of replacements){
  assert.ok(source.includes(a),'Expected import for '+input);
  source=source.replace(a,b);
 }
 const javascript=ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
 }).outputText;
 await fs.writeFile(path.join(sourceDir,output),javascript);
}
async function cleanup(){await Promise.all(temporary.map(name=>fs.unlink(path.join(sourceDir,name)).catch(()=>{})));}
test('automatic PT-BR moderation screens ordinary and risky comments on the server',async()=>{
 await transpile('automatic-text-screen.ts',temporary[0]);
 try{
  const {screenTextAutomatically}=await import(pathToFileURL(path.join(sourceDir,temporary[0])).href);
  const ordinary=screenTextAutomatically('Olá, adorei a postagem e desejo um ótimo dia.');
  assert.equal(ordinary.reviewRequired,false,'ordinary text should have an automatic path');
  const contextual=screenTextAutomatically('Entre no site https://pagamento.exemplo agora');
  assert.equal(contextual.reviewRequired,true,'external links require a check');
  const threat=screenTextAutomatically('Eu vou te matar amanhã.');
  assert.equal(threat.reviewRequired,true,'threats require moderation');
  assert.equal(screenTextAutomatically('um texto '.repeat(150)).reviewRequired,true);
 }finally{await cleanup();}
},{timeout:30000});
test('server extracts real video frames with FFmpeg and classifies with NSFWJS',async()=>{
 const ffmpeg=require('ffmpeg-static');
 assert.ok(ffmpeg,'real FFmpeg binary must be available');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'conecta-automod-ci-'));
 const file=path.join(dir,'sample.mp4');
 try{
  const generated=spawnSync(ffmpeg,[
   '-hide_banner','-nostdin','-loglevel','error',
   '-f','lavfi','-i','color=c=black:s=224x224:r=5',
   '-t','3','-c:v','mpeg4','-y',file
  ],{timeout:15000,encoding:'utf8'});
  assert.equal(generated.status,0,generated.stderr||'Could not generate synthetic video');
  await transpile('open-source-image-moderation.ts',temporary[1]);
  await transpile('automatic-video-screen.ts',temporary[2],
   [["from '@/lib/open-source-image-moderation'","from './"+temporary[1]+"'"]]);
  const {screenVideoAutomatically}=await import(pathToFileURL(path.join(sourceDir,temporary[2])).href);
  const video=await fs.readFile(file);
  const result=await screenVideoAutomatically(new Uint8Array(video));
  assert.ok(result.sampledFrames>=4);
  assert.equal(result.provider,'ffmpeg-nsfwjs-mobilenet-v2');
  assert.equal(typeof result.reviewRequired,'boolean');
  await assert.rejects(
   screenVideoAutomatically(new Uint8Array(0)),
   /exceeds automatic screening limits/
  );
 }finally{await Promise.all([fs.rm(dir,{recursive:true,force:true}),cleanup()]);}
},{timeout:90000});
