'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');

const root=path.join(__dirname,'..');
const repo=path.join(root,'..');
const source=fs.readFileSync(path.join(root,'scripts/configure-release-signing.cjs'),'utf8');
const workflow=fs.readFileSync(path.join(repo,'.github/workflows/conecta-mobile-release.yml'),'utf8');

test('Official installer refuses to sign with missing permanent secrets',()=>{
 const env={PATH:process.env.PATH||'',RUNNER_TEMP:'/tmp',CI:'1'};
 const result=spawnSync(process.execPath,['scripts/configure-release-signing.cjs'],{
  cwd:root,env,encoding:'utf8'
 });
 assert.equal(result.status,1);
 assert.match(result.stderr,/Assinatura Android permanente não configurada/);
 assert.ok(!fs.existsSync(path.join('/tmp','conecta-android-release.jks')),
  'Test must not accidentally create a keystore');
});
test('Updater-compatible releases require exact mobile tags and signed APK',()=>{
 assert.match(workflow,/tags:\s*\n\s*- 'mobile-v\*'/);
 assert.match(workflow,/contents: write/);
 assert.match(workflow,/git merge-base --is-ancestor/);
 assert.match(workflow,/package\.json e app\.json/);
 assert.match(workflow,/configure-release-signing\.cjs/);
 assert.match(workflow,/gh release create/);
 assert.match(workflow,/conecta-v2-android-.*version.*\.apk/);
 assert.match(workflow,/secrets\.CONECTA_ANDROID_KEYSTORE_BASE64/);
 assert.match(workflow,/secrets\.CONECTA_ANDROID_KEYSTORE_PASSWORD/);
 assert.match(workflow,/secrets\.CONECTA_ANDROID_KEY_ALIAS/);
 assert.match(workflow,/secrets\.CONECTA_ANDROID_KEY_PASSWORD/);
 assert.match(source,/signingConfig signingConfigs\.release/);
 assert.match(source,/GITHUB_ENV/);
 assert.match(source,/mode:0o600/);
 assert.doesNotMatch(workflow,/signingConfig signingConfigs\.debug/);
});
