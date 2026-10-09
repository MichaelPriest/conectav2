'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizeMedia,MAX_MEDIA_BYTES}=require('../src/media-validation.ts');
const photo=(overrides={})=>({
 uri:'file:///photo.jpg',fileName:'photo.jpg',fileSize:1234,
 mimeType:'image/jpeg',type:'image',...overrides
});
const video=(overrides={})=>({
 uri:'file:///movie.mp4',fileName:'movie.mp4',fileSize:1000,
 mimeType:'video/mp4',type:'video',...overrides
});
test('Accepts 1 to 5 photos, preserves order and normalizes safe extensions',()=>{
 const photos=Array.from({length:5},(_,i)=>photo({uri:'file:///photo'+i+'.jpg'}));
 const result=normalizeMedia(photos);
 assert.equal(result.length,5);
 assert.deepEqual(result.map(x=>x.uri),photos.map(x=>x.uri));
 assert.equal(normalizeMedia([photo({fileName:'../../unsafe.exe',mimeType:'image/jpeg'})])[0].extension,'jpg');
 assert.equal(normalizeMedia([photo({mimeType:null,fileName:'x.png'})])[0].mimeType,'image/png');
 assert.equal(normalizeMedia([photo({mimeType:'image/jpg'})])[0].mimeType,'image/jpeg');
});
test('Rejects empty, oversized batches and unsupported content types',()=>{
 assert.throws(()=>normalizeMedia([]),/Selecione/);
 assert.throws(()=>normalizeMedia(Array.from({length:6},()=>photo())),/cinco/);
 assert.throws(()=>normalizeMedia([photo({mimeType:'application/x-msdownload'})]),/Formato/);
 assert.throws(()=>normalizeMedia([photo({type:'video'})]),/Formato/);
});
test('Allows exactly one video and prevents mixed galleries',()=>{
 assert.equal(normalizeMedia([video()])[0].kind,'video');
 assert.equal(normalizeMedia([video({mimeType:'video/quicktime',fileName:'a.mov'})])[0].extension,'mov');
 assert.throws(()=>normalizeMedia([video(),photo()]),/vídeo por vez/);
 assert.throws(()=>normalizeMedia([video(),video()]),/vídeo por vez/);
});
test('Enforces a real 50MB size ceiling, including zero-size files',()=>{
 assert.equal(MAX_MEDIA_BYTES,50*1024*1024);
 assert.doesNotThrow(()=>normalizeMedia([photo({fileSize:MAX_MEDIA_BYTES})]));
 assert.throws(()=>normalizeMedia([photo({fileSize:MAX_MEDIA_BYTES+1})]),/50 MB/);
 assert.throws(()=>normalizeMedia([photo({fileSize:0})]),/50 MB/);
});
