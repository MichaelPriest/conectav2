'use strict';
/**
 * Runs only inside the protected release workflow, AFTER Expo prebuild.
 * Hard fails if the permanent release keystore is unavailable. Never
 * distribute debug-signed binaries as in-place updates.
 */
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');

const names=[
 'CONECTA_ANDROID_KEYSTORE_BASE64',
 'CONECTA_ANDROID_KEYSTORE_PASSWORD',
 'CONECTA_ANDROID_KEY_ALIAS',
 'CONECTA_ANDROID_KEY_PASSWORD'
];
const absent=names.filter(name=>!process.env[name]?.trim());
if(absent.length){
 console.error('Assinatura Android permanente não configurada. Configure todos os secrets CONECTA_ANDROID_*.');
 process.exit(1);
}
const encoded=process.env.CONECTA_ANDROID_KEYSTORE_BASE64.replace(/\s/g,'');
if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)){
 console.error('Keystore em base64 inválido.');
 process.exit(1);
}
const key=Buffer.from(encoded,'base64');
if(key.length<1024){
 console.error('Keystore muito pequeno ou inválido.');
 process.exit(1);
}
const destination=path.join(process.env.RUNNER_TEMP||os.tmpdir(),'conecta-android-release.jks');
fs.writeFileSync(destination,key,{mode:0o600});
const gradlePath=path.resolve(__dirname,'../android/app/build.gradle');
const source=fs.readFileSync(gradlePath,'utf8');
if(!/signingConfigs\s*\{/.test(source)||!/buildTypes\s*\{/.test(source)){
 console.error('Estrutura de assinatura do Expo Android não reconhecida.');
 process.exit(1);
}
const config=`
        release {
            storeFile file(System.getenv('CONECTA_ANDROID_KEYSTORE_PATH'))
            storePassword System.getenv('CONECTA_ANDROID_KEYSTORE_PASSWORD')
            keyAlias System.getenv('CONECTA_ANDROID_KEY_ALIAS')
            keyPassword System.getenv('CONECTA_ANDROID_KEY_PASSWORD')
        }
`;
const changed=source.replace(/(signingConfigs\s*\{)/,'$1'+config);
const buildStart=changed.indexOf('buildTypes {');
const releaseStart=changed.indexOf('release {',buildStart);
if(buildStart<0||releaseStart<0){
 console.error('Bloco Gradle release não encontrado.');
 process.exit(1);
}
const oldSigning=changed.indexOf('signingConfig signingConfigs.debug',releaseStart);
if(oldSigning<0||oldSigning-releaseStart>1800){
 console.error('Build Gradle release mudou: assinatura de testes não foi localizada.');
 process.exit(1);
}
const signed=changed.slice(0,oldSigning)+'signingConfig signingConfigs.release'+
 changed.slice(oldSigning+'signingConfig signingConfigs.debug'.length);
if(!signed.includes('signingConfig signingConfigs.release')){
 console.error('Assinatura permanente não aplicada.');
 process.exit(1);
}
fs.writeFileSync(gradlePath,signed);
if(process.env.GITHUB_ENV)
 fs.appendFileSync(process.env.GITHUB_ENV,'CONECTA_ANDROID_KEYSTORE_PATH='+destination+'\n');
console.log('Android release configurado para assinatura permanente (sem exibir credenciais).');
