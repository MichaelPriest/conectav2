'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');

// Pinned upstream Apache-2.0 model, not a mutable branch or latest release.
// Source: garciafido/minifasnet-v2-anti-spoofing-onnx at d29c875...
const MODEL_SHA256='d7b3cd9ba8a7ceb13baa8c4720902e27ca3112eff52f926c08804af6b6eecc7b';
const MODEL_SIZE=1744116;
const MODEL_URL='https://huggingface.co/garciafido/minifasnet-v2-anti-spoofing-onnx/resolve/d29c87568ca9b5662da803b10f217c4db20b142b/minifasnet_v2.onnx';
async function prepareAntiSpoof(baseDir=path.resolve(__dirname,'..')){
 const targetDir=path.join(baseDir,'public','vendor','antispoof');
 const filename=path.join(targetDir,'minifasnet_v2.onnx');
 const matches=bytes=>bytes.length===MODEL_SIZE&&
  createHash('sha256').update(bytes).digest('hex')===MODEL_SHA256;
 fs.mkdirSync(targetDir,{recursive:true});
 if(fs.existsSync(filename)&&matches(fs.readFileSync(filename)))return filename;
 const response=await fetch(MODEL_URL,{signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw new Error('Could not fetch pinned MiniFASNet model (HTTP '+response.status+').');
 const bytes=Buffer.from(await response.arrayBuffer());
 if(!matches(bytes))throw new Error('MiniFASNet model checksum/length mismatch; refusing untrusted weights.');
 const temp=filename+'.tmp';
 try{fs.writeFileSync(temp,bytes,{flag:'w'});fs.renameSync(temp,filename);}
 finally{if(fs.existsSync(temp))fs.unlinkSync(temp);bytes.fill(0);}
 return filename;
}
if(require.main===module)prepareAntiSpoof().then(file=>{
 process.stdout.write('Pinned MiniFASNet ONNX model ready: '+file+'\n');
}).catch(error=>{process.stderr.write(String(error.message||error)+'\n');process.exitCode=1;});
module.exports={prepareAntiSpoof,MODEL_SHA256,MODEL_SIZE};
