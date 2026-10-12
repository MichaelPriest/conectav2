'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.resolve(__dirname,'../../mobile/src/story-ui.tsx'),'utf8');

test('native Story video signing errors leave loading state and show a safe message',()=>{
  const start=source.indexOf('function StoryVideo(');
  const end=source.indexOf('function PlayingStoryVideo(',start);
  assert.notEqual(start,-1);
  assert.notEqual(end,-1);
  const component=source.slice(start,end);
  assert.match(component,/signedMedia\(path\)\.then/);
  assert.match(component,/\.catch\(error\s*=>/);
  assert.match(component,/setMediaError\(describe\(error\)\)/);
  assert.match(component,/O vídeo permanece protegido pelas permissões da publicação/);
});
