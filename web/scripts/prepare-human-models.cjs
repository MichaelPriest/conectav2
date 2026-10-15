'use strict';

const fs=require('node:fs');
const path=require('node:path');

const commit='bc66dc53bac03c96d35a7e6daaf717e72f3985f5';
const files=[
  ['blazeface.json',79038],
  ['blazeface.bin',538928],
  ['facemesh.json',95845],
  ['facemesh.bin',1477958],
  ['faceres.json',71432],
  ['faceres.bin',6978814],
  ['antispoof.json',8713],
  ['antispoof.bin',853098],
  ['liveness.json',17070],
  ['liveness.bin',592976]
];

async function prepareHumanModels(baseDir=path.resolve(__dirname,'..')){
  const targetDir=path.join(baseDir,'public','vendor','human-models');
  fs.mkdirSync(targetDir,{recursive:true});
  for(const [name,expectedSize] of files){
    const target=path.join(targetDir,name);
    if(fs.existsSync(target)&&fs.statSync(target).size===expectedSize)continue;
    const url='https://raw.githubusercontent.com/vladmandic/human-models/'+commit+'/models/'+name;
    const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw new Error('Could not download pinned Human model '+name+' (HTTP '+response.status+').');
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length!==expectedSize)throw new Error('Pinned Human model '+name+' had an unexpected size.');
    const temp=target+'.tmp';
    fs.writeFileSync(temp,bytes,{flag:'w'});
    fs.renameSync(temp,target);
  }
  return {targetDir,files:files.length};
}

if(require.main===module){
  prepareHumanModels().then(result=>{
    process.stdout.write('Pinned server-side Human models prepared: '+result.files+' files in '+result.targetDir+'\n');
  }).catch(error=>{
    process.stderr.write(String(error&&error.message||error)+'\n');
    process.exitCode=1;
  });
}

module.exports={prepareHumanModels};
