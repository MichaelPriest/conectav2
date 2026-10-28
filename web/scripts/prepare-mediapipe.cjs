'use strict';
// Download pinned MediaPipe browser assets at build time. The browser loads
// all scripts/models/wasm from our own domain, not a mutable external CDN.
const fs=require('node:fs');
const path=require('node:path');
const bundleVersion='1.1.1';
const urls=[
 ['vision_bundle.mjs','https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@'+bundleVersion+'/vision_bundle.mjs',100000],
 ['wasm/vision_wasm_internal.js','https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@'+bundleVersion+'/wasm/vision_wasm_internal.js',1000],
 ['wasm/vision_wasm_internal.wasm','https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@'+bundleVersion+'/wasm/vision_wasm_internal.wasm',100000],
 ['wasm/vision_wasm_nosimd_internal.js','https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@'+bundleVersion+'/wasm/vision_wasm_nosimd_internal.js',1000],
 ['wasm/vision_wasm_nosimd_internal.wasm','https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@'+bundleVersion+'/wasm/vision_wasm_nosimd_internal.wasm',100000],
 ['face_landmarker.task','https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',100000]
];
async function prepareMediaPipe(baseDir=path.resolve(__dirname,'..')){
 const targetDir=path.join(baseDir,'public','vendor','mediapipe');
 for(const [file,url,minSize] of urls){
  const target=path.join(targetDir,file);
  if(fs.existsSync(target)&&fs.statSync(target).size>=minSize)continue;
  fs.mkdirSync(path.dirname(target),{recursive:true});
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error('Pinned MediaPipe asset unavailable: '+file+' HTTP '+response.status);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length<minSize||bytes.length>20*1024*1024)throw new Error('MediaPipe asset size invalid: '+file);
  const temp=target+'.tmp';fs.writeFileSync(temp,bytes);fs.renameSync(temp,target);
 }
 return {count:urls.length,targetDir};
}
if(require.main===module)prepareMediaPipe().then(result=>process.stdout.write('Prepared '+result.count+' local MediaPipe assets\n')).catch(error=>{
 process.stderr.write(String(error.message||error)+'\n');process.exitCode=1;
});
module.exports={prepareMediaPipe};
