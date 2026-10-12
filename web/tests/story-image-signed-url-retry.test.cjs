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
