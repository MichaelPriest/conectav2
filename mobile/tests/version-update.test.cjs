'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {versionParts,compareVersions,trustedAndroidApk,chooseAndroidUpdate,
 chooseIosUpdate,MOBILE_RELEASES_API,APP_STORE_LOOKUP_API}=
 require('../src/version-utils.ts');

const apk=(tag,assetName='conecta-v2-android-0.6.0.apk',url)=>({
 tag_name:tag,draft:false,prerelease:true,assets:[{
  name:assetName,size:37000000,
  browser_download_url:url||'https://github.com/MichaelPriest/conectav2/releases/download/'+tag+'/'+assetName
 }]
});
test('App version comparison handles 0.10 > 0.9 and stable > prerelease',()=>{
 assert.deepEqual(versionParts('v0.5.1'),{major:0,minor:5,patch:1,pre:null});
 assert.ok(compareVersions('0.10.0','0.9.9')>0);
 assert.ok(compareVersions('1.0.0','1.0.0-alpha.9')>0);
 assert.ok(compareVersions('1.0.0-alpha.10','1.0.0-alpha.9')>0);
 assert.ok(compareVersions('1.0.0-alpha.2','1.0.0-alpha.10')<0);
 assert.equal(compareVersions('0.5.1','0.5.1'),0);
 assert.ok(compareVersions('0.4.0','0.5.1')<0);
 assert.equal(versionParts('not-a-version'),null);
});
test('APK updates are only offered from our published official repository',()=>{
 const url='https://github.com/MichaelPriest/conectav2/releases/download/mobile-v0.6.0/conecta-v2-android-0.6.0.apk';
 assert.equal(trustedAndroidApk(url),true);
 for(const bad of [
  'http://github.com/MichaelPriest/conectav2/releases/download/x/app.apk',
  'https://github.com.attacker.net/MichaelPriest/conectav2/releases/download/x/app.apk',
  'https://github.com/another/repo/releases/download/x/app.apk',
  'https://github.com/MichaelPriest/conectav2/releases/download/x/app.exe',
  'https://github.com@evil.com/MichaelPriest/conectav2/releases/download/x/app.apk',
  'https://github.com/MichaelPriest/conectav2/releases/download/x/app.apk?redirect=evil'
 ])assert.equal(trustedAndroidApk(bad),false,bad);
});
test('No published stable APK means no misleading update warning',()=>{
 assert.equal(chooseAndroidUpdate([], '0.5.1'),null);
 assert.equal(chooseAndroidUpdate([apk('mobile-v0.5.0')],'0.5.1'),null);
 assert.equal(chooseAndroidUpdate([apk('web-v2.0.0')],'0.5.1'),null);
 const missing={...apk('mobile-v0.6.0'),assets:[]};
 assert.equal(chooseAndroidUpdate([missing],'0.5.1'),null);
 const draft={...apk('mobile-v0.6.0'),draft:true};
 assert.equal(chooseAndroidUpdate([draft],'0.5.1'),null);
 const tiny={...apk('mobile-v0.6.0'),assets:[{
  ...apk('mobile-v0.6.0').assets[0],size:100
 }]};
 assert.equal(chooseAndroidUpdate([tiny],'0.5.1'),null);
});
test('Choose newest Alpha version with a real Android binary download link',()=>{
 const releases=[apk('mobile-v0.6.0'),apk('mobile-v0.8.0','conecta-v2-android-0.8.0.apk'),
  apk('mobile-v0.7.0','conecta-v2-android-0.7.0.apk')];
 const current=chooseAndroidUpdate(releases,'0.5.1');
 assert.equal(current?.version,'0.8.0');
 assert.match(current?.url||'',/0\.8\.0\.apk$/);
 assert.equal(chooseAndroidUpdate(releases,'0.8.0'),null);
 assert.match(MOBILE_RELEASES_API,/\/releases\?per_page=/);
});

test('iOS version checks reject unapproved app listings and phishing URLs',()=>{
 const valid={results:[{
  bundleId:'br.com.conectav2.app',version:'0.7.0',
  trackViewUrl:'https://apps.apple.com/br/app/conecta/id1234567890'
 }]};
 assert.equal(chooseIosUpdate(valid,'0.5.1')?.version,'0.7.0');
 assert.equal(chooseIosUpdate(valid,'0.7.0'),null);
 assert.equal(chooseIosUpdate({results:[]},'0.5.1'),null);
 assert.equal(chooseIosUpdate({results:[{
  ...valid.results[0],bundleId:'com.other.app'
 }]},'0.5.1'),null);
 assert.equal(chooseIosUpdate({results:[{
  ...valid.results[0],trackViewUrl:'https://apps.apple.com.attacker.net/br/app/id1234567890'
 }]},'0.5.1'),null);
 assert.match(APP_STORE_LOOKUP_API,/itunes\.apple\.com\/lookup\?/);
});
test('Version monitor is installed at root, checks foreground and requires user approval',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const app=fs.readFileSync(path.join(__dirname,'../App.tsx'),'utf8');
 const update=fs.readFileSync(path.join(__dirname,'../src/update-ui.tsx'),'utf8');
 assert.match(app,/NativeVersionMonitor\/\>/);
 assert.match(app,/checkVersionManually\(\)/);
 assert.match(update,/Application\.nativeApplicationVersion/);
 assert.match(update,/AppState\.addEventListener\('change'/);
 assert.match(update,/checkForNativeUpdate\(\)/);
 assert.match(update,/Nova versão do Conecta/);
 assert.match(update,/Linking\.openURL\(update\.url\)/);\n assert.match(update,/beginAndroidApkDownload\(update,/);\n assert.match(update,/requestAndroidInstall\(downloaded\)/);
 assert.match(update,/chooseAndroidUpdate\(records,installed\)/);
 assert.match(update,/chooseIosUpdate\(records,installed\)/);
});
