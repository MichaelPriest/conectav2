'use strict';

const fs=require('node:fs');
const path=require('node:path');

/** Copy the pinned Human browser bundle to first-party static assets. */
function prepareHumanBundle(baseDir=path.resolve(__dirname,'..')){
  const source=path.join(baseDir,'node_modules','@vladmandic','human','dist','human.js');
  const target=path.join(baseDir,'public','vendor','human.js');
  if(!fs.existsSync(source)){
    throw new Error(
      'Human browser bundle is missing: '+source+
      '. Run npm install in web/ and ensure @vladmandic/human@3.3.6 ships dist/human.js.'
    );
  }
  const sourceStat=fs.statSync(source);
  if(!sourceStat.isFile()||sourceStat.size<100000){
    throw new Error('Invalid Human browser bundle: '+source);
  }
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.copyFileSync(source,target);
  const copied=fs.statSync(target);
  if(copied.size!==sourceStat.size)throw new Error('Human bundle copy did not finish correctly.');
  return {target,bytes:copied.size};
}

if(require.main===module){
  const result=prepareHumanBundle();
  process.stdout.write('Human browser library prepared: '+result.bytes+' bytes in '+result.target+'\n');
}

module.exports={prepareHumanBundle};
