const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const source=fs.readFileSync(path.resolve(__dirname,'../src/lib/app-downloads.ts'),'utf8');
const transpiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,
 target:ts.ScriptTarget.ES2022}}).outputText;
const runtime={exports:{},URL,fetch:undefined};
vm.runInNewContext(transpiled,runtime,{filename:'app-downloads.compiled.cjs'});
const {selectLatestAndroidRelease}=runtime.exports;
function release(version,opts={}){
 const name='conecta-v2-android-'+version+'.apk';
 return {
  tag_name:'mobile-v'+version,draft:false,
  assets:[{name,size:128409312, browser_download_url:
    'https://github.com/MichaelPriest/conectav2/releases/download/mobile-v'+version+'/'+name,
   digest:'sha256:'+'a'.repeat(64)}],
  body:'APK-SHA256: '+'a'.repeat(64)+'\nAPK-SIZE: 128409312',
  ...opts
 };
}
test('download page selects newest correct release semver, not Actions zip',()=>{
 const picked=selectLatestAndroidRelease([release('0.7.3'),release('0.8.0'),
  release('0.7.12'),release('0.9.0',{draft:true})]);
 assert.equal(picked?.version,'0.8.0');
 assert.equal(picked?.size,128409312);
 assert.equal(picked?.sha256,'a'.repeat(64));
});
test('download link can only target the versioned APK of this official GitHub repo',()=>{
 const bad=[
  release('0.9.0',{assets:[{name:'conecta-v2-android-0.9.0.apk',size:128409312,
   browser_download_url:'https://evil.example/apk'}]}),
  release('0.9.0',{assets:[{name:'conecta-v2-android-0.9.0.apk',size:128409312,
   browser_download_url:'https://github.com/MichaelPriest/conectav2/releases/download/mobile-v0.9.0/untrusted.apk'}]})
 ];
 assert.equal(selectLatestAndroidRelease(bad),null);
});
test('checksum disagreement or recorded byte count mismatch skips an unsafe download',()=>{
 assert.equal(selectLatestAndroidRelease([release('0.9.0',{body:'APK-SHA256: '+'b'.repeat(64)})]),null);
 assert.equal(selectLatestAndroidRelease([release('0.9.0',{body:'APK-SIZE: 1'})]),null);
});
test('missing or unreachable release data never fabricates APK',()=>{
 assert.equal(selectLatestAndroidRelease(null),null);
 assert.equal(selectLatestAndroidRelease([]),null);
});
test('apps page is reachable from public homepage and authenticated sidebar',()=>{
 const home=fs.readFileSync(path.resolve(__dirname,'../src/app/page.tsx'),'utf8');
 const shell=fs.readFileSync(path.resolve(__dirname,'../src/components/app-shell.tsx'),'utf8');
 const page=fs.readFileSync(path.resolve(__dirname,'../src/app/apps/page.tsx'),'utf8');
 assert.match(home,/href="\/apps"/);
 assert.match(shell,/href="\/apps"/);
 assert.match(page,/latestAndroidRelease\(\)/);
 assert.match(page,/Download|Baixar APK Android/);
 assert.match(page,/Ainda não há instalador público para iPhones físicos/);
});
