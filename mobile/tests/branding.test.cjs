'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');

function decodePng(filepath){
 const bytes=fs.readFileSync(path.join(__dirname,'..',filepath));
 assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
 const idat=[];let cursor=8,width=0,height=0,palette=null,alpha=null,ended=false;
 while(cursor<bytes.length){
  assert.ok(cursor+12<=bytes.length,'PNG chunk header');
  const length=bytes.readUInt32BE(cursor);
  const type=bytes.toString('ascii',cursor+4,cursor+8);
  assert.ok(cursor+12+length<=bytes.length,'PNG chunk bounds');
  const data=bytes.subarray(cursor+8,cursor+8+length);
  let check=0xFFFFFFFF;
  for(const byte of bytes.subarray(cursor+4,cursor+8+length)){
   check^=byte;
   for(let i=0;i<8;i++)check=check&1?(check>>>1)^0xEDB88320:check>>>1;
  }
  assert.equal(((check^0xFFFFFFFF)>>>0),bytes.readUInt32BE(cursor+8+length),
   'PNG CRC for '+type);
  if(type==='IHDR'){
   width=data.readUInt32BE(0);height=data.readUInt32BE(4);
   assert.equal(data[8],8,'8-bit depth');
   assert.equal(data[9],3,'palette PNG color type');
  }
  if(type==='PLTE')palette=data;
  if(type==='tRNS')alpha=data;
  if(type==='IDAT')idat.push(data);
  cursor+=length+12;
  if(type==='IEND'){ended=true;break;}
 }
 assert.ok(ended&&palette&&alpha&&idat.length,'well-formed PNG');
 const pixels=zlib.inflateSync(Buffer.concat(idat));
 assert.equal(pixels.length,height*(width+1),'decoded complete image pixels');
 for(let y=0;y<height;y++)assert.equal(pixels[y*(width+1)],0,'unfiltered row '+y);
 return {width,height,pixels,alpha};
}
test('Conecta branded app icon decodes as full-size, nonempty colored PNG',()=>{
 const icon=decodePng('assets/icon.png');
 assert.equal(icon.width,512);assert.equal(icon.height,512);
 assert.equal(icon.alpha[0],255,'main icon is opaque');
 assert.ok(icon.pixels.includes(225),'pink Conecta accent is present');
 assert.ok(icon.pixels.includes(1)||icon.pixels.includes(80)||icon.pixels.includes(130),
  'gradient Conecta emblem is present');
});
test('Android adaptive icon and splash preserve real transparency',()=>{
 for(const file of ['assets/adaptive-icon.png','assets/splash-icon.png']){
  const png=decodePng(file);
  assert.equal(png.width,512);assert.equal(png.height,512);
  assert.equal(png.alpha[0],0,'background must be transparent');
  assert.ok(png.pixels.includes(225),'pink accent is visible');
 }
});
