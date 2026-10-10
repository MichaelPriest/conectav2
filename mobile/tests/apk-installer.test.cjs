'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const {chooseAndroidUpdate}=require('../src/version-utils.ts');
const {verifiedInAppDownload,safeApkFilename,bytesToHex,formatSize,
 progressFraction,MAX_APK_BYTES}=require('../src/apk-installer-policy.ts');
const sha='0123456789abcdef'.repeat(4);
const release=(version,asset={})=>({
 tag_name:'mobile-v'+version,draft:false,prerelease:true,
 body:'Atualização do Conecta V2: desempenho, privacidade e conversas.',
 assets:[{
  name:'conecta-v2-android-'+version+'.apk',
  browser_download_url:'https://github.com/MichaelPriest/conectav2/releases/download/mobile-v'+version+'/conecta-v2-android-'+version+'.apk',
  digest:'sha256:'+sha,size:40000000,...asset
 }]
});
test('Android updater resolves verified SHA-256 directly from public GitHub Release',()=>{
 const update=chooseAndroidUpdate([release('0.6.1')],'0.6.0');
 assert.ok(update);
 assert.equal(update.version,'0.6.1');
 assert.equal(update.sha256,sha);
 assert.equal(update.size,40000000);
 assert.equal(update.channel,'android');
 assert.equal(verifiedInAppDownload(update),true);
 assert.equal(safeApkFilename(update),'conecta-v2-android-0.6.1.apk');
 assert.match(update.notes,/desempenho/);
});
test('Unverifiable releases may be opened on GitHub but never installed from a local download',()=>{
 const missing=chooseAndroidUpdate([release('0.7.0',{digest:null})],'0.6.0');
 assert.ok(missing);
 assert.equal(missing.sha256,null);
 assert.equal(verifiedInAppDownload(missing),false);
 assert.throws(()=>safeApkFilename(missing),/verificável/);
 const bad=chooseAndroidUpdate([release('0.7.0',{digest:'sha256:bad'})],'0.6.0');
 assert.equal(bad.sha256,null);
 assert.equal(verifiedInAppDownload(bad),false);
});
test('Releases reject version-mismatched and foreign APKs',()=>{
 assert.equal(chooseAndroidUpdate([release('0.6.1',{
  name:'conecta-v2-android-0.9.0.apk'
 })],'0.6.0'),null);
 assert.equal(chooseAndroidUpdate([release('0.6.1',{
  browser_download_url:'https://github.com/MichaelPriest/conectav2/releases/download/mobile-v0.9.0/conecta-v2-android-0.6.1.apk'
 })],'0.6.0'),null);
 assert.equal(chooseAndroidUpdate([release('0.6.1',{size:MAX_APK_BYTES+1})],'0.6.0'),null);
 assert.equal(chooseAndroidUpdate([release('0.6.1',{size:100})],'0.6.0'),null);
});
test('Download progress and binary integrity helpers have bounded behavior',()=>{
 assert.equal(bytesToHex(new Uint8Array([0,2,15,255])),'00020fff');
 assert.equal(progressFraction(20,100),0.2);
 assert.equal(progressFraction(400,100),1);
 assert.equal(progressFraction(-10,100),0);
 assert.equal(progressFraction(40,0),0);
 assert.equal(progressFraction(NaN,100),0);
 assert.equal(formatSize(10485760),'10.0 MB');
});
test('Native installer uses a content URI, user confirmation, and downloaded data checksum',()=>{
 const installer=read('src/apk-installer.ts');
 const ui=read('src/update-ui.tsx');
 const config=require('../app.config.js').expo;
 assert.match(installer,/File\.createDownloadTask\(update\.url,file,/);
 assert.match(installer,/onProgress:\(\{bytesWritten,totalBytes\}\)/);
 assert.match(installer,/Crypto\.digest\(Crypto\.CryptoDigestAlgorithm\.SHA256/);
 assert.match(installer,/downloaded\.size!==expectedSize/);
 assert.match(installer,/actual!==update\.sha256/);
 assert.match(installer,/file\.contentUri/);
 assert.match(installer,/IntentLauncher\.startActivityAsync\('android\.intent\.action\.VIEW'/);
 assert.match(installer,/type:APK_MIME,flags:1/);
 assert.match(ui,/Instalar com o Android/);
 assert.match(ui,/Tamanho e SHA-256 conferidos/);
 assert.match(ui,/Verificando versões/);
 assert.match(ui,/Linking\.openURL\(update\.url\)/);
 assert.match(ui,/checkForNativeUpdate\(\)/);
 assert.ok(config.android.permissions.includes('android.permission.REQUEST_INSTALL_PACKAGES'));
});

test('Google Play builds never request restricted APK install permission',()=>{
 const child=require('node:child_process');
 const root=path.join(__dirname,'..');
 for(const [channel,expectPermission] of [['play',false],['sideload',true]]){
  const result=child.spawnSync(process.execPath,['-e',
   "process.stdout.write(JSON.stringify(require('./app.config.js').expo.android.permissions))"
  ],{cwd:root,env:{...process.env,EXPO_PUBLIC_CONECTA_DISTRIBUTION:channel},
   encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const permissions=JSON.parse(result.stdout);
  assert.equal(permissions.includes('android.permission.REQUEST_INSTALL_PACKAGES'),expectPermission);
 }
 const neutral=JSON.parse(read('app.json')).expo;
 assert.ok(!neutral.android.permissions?.includes('android.permission.REQUEST_INSTALL_PACKAGES'));
 const eas=JSON.parse(read('eas.json'));
 assert.equal(eas.build.production.env.EXPO_PUBLIC_CONECTA_DISTRIBUTION,'play');
 assert.equal(eas.build.preview.env.EXPO_PUBLIC_CONECTA_DISTRIBUTION,'sideload');
});

test('Public Alpha release notes unlock checksum-protected in-app upgrades even without API digest',()=>{
 const notes=release('0.7.2',{digest:null});
 notes.body='Conecta Alpha 0.7.2\nAPK-SHA256: '+sha+'\nAPK-SIZE: 40000000';
 const update=chooseAndroidUpdate([notes],'0.7.1');
 assert.ok(update);
 assert.equal(update.sha256,sha);
 assert.equal(verifiedInAppDownload(update),true);
 assert.equal(update.url,
  'https://github.com/MichaelPriest/conectav2/releases/download/mobile-v0.7.2/conecta-v2-android-0.7.2.apk');
 notes.assets[0].digest='sha256:'+'f'.repeat(64);
 assert.equal(chooseAndroidUpdate([notes],'0.7.1').sha256,null,
  'Do not trust contradictory GitHub asset digest and release notes');
 notes.assets[0].digest=null;
 notes.body='APK-SHA256: '+sha+'\nAPK-SIZE: 12345678';
 assert.equal(chooseAndroidUpdate([notes],'0.7.1').sha256,null,
  'Do not trust a size mismatch in release metadata');
});
test('CI publishes semver prereleases only after pinning the existing Alpha signer',()=>{
 const workflow=read('../.github/workflows/conecta-android-apk.yml');
 assert.match(workflow,/contents: write/);
 assert.match(workflow,/Validar continuidade da assinatura dos APKs Alpha/);
 assert.match(workflow,/fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c/);
 assert.match(workflow,/gh release create "\$tag"/);
 assert.match(workflow,/APK-SHA256: \$digest/);
 assert.match(workflow,/--prerelease/);
 assert.match(workflow,/upload-artifact@v4/);
 const ui=read('src/update-ui.tsx');
 assert.match(ui,/Os APKs de Actions não aparecem no atualizador/);
});
