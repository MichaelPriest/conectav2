'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.resolve(__dirname,'../../mobile/src/story-ui.tsx'),'utf8');

test('native Story images invalidate a failed signed URL and retry only once',()=>{
  assert.match(source,/import \{invalidateSignedMedia,loadPermittedPost,signedMedia\} from '\.\/data';/);
  assert.match(source,/const \[imageRetry,setImageRetry\]=useState\(0\)/);
  assert.match(source,/invalidateSignedMedia\(path\);setImageRetry\(1\)/);
  assert.match(source,/imageRetry===0/);
  assert.match(source,/Atualize e tente novamente/);
});

test('failed Story image displays recovery feedback inside the Story modal',()=>{
  assert.match(source,/const \[imageError,setImageError\]=useState\(false\)/);
  assert.match(source,/imageError\?<View[\s\S]*Não foi possível carregar esta foto protegida/);
  assert.match(source,/Fechar Story/);
});

test('signed URL rejection clears loading and exposes the modal recovery state',()=>{
  assert.match(source,/\.catch\(e=>\{if\(active\)\{setImageUrl\(null\);setImageError\(true\);setError\(describe\(e\)\);\}\}\)/);
});
