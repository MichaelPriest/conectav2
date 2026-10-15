'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const data=read('src/data.ts');
const app=read('App.tsx');
const models=read('src/models.ts');
const config=read('src/supabase.ts');

test('Mobile access is decided by the same server-side Conecta ID endpoint as web',()=>{
 assert.match(data,/API_SITE_URL\+'\/api\/identity\/access'/);
 assert.match(data,/Authorization:'Bearer '\+session\.access_token/);
 assert.match(data,/response\.ok&&result\.networkAccess===true/);
 assert.match(data,/status:'identity-check'/);
 assert.match(data,/verification_unavailable/);
 assert.match(data,/from\('registration_age_declarations'\)/);
 assert.doesNotMatch(data,/declared_band!=='18_plus'/);
 assert.match(models,/identity-check/);
 assert.match(config,/API_SITE_URL='https:\/\/conectav2-validacao\.onrender\.com'/);
});

test('Unverified users stay in a restricted native screen and can open the validation web flow',()=>{
 assert.match(app,/openIdentityVerification/);
 assert.match(app,/API_SITE_URL\+'\/verificar-identidade'/);
 assert.match(app,/Abrir validação do Conecta ID/);
 assert.match(app,/restricted\?<Restricted/);
 assert.match(app,/NativeCallsProvider userId=\{user&&!restricted\?user\.id:null\}/);
 assert.match(app,/user&&!restricted&&<NativeForegroundNotificationBridge/);
 assert.match(app,/message=\{identityMessage\}/);
});

test('The app never treats Play Age Signals, local declaration, or API errors as approval',()=>{
 assert.match(data,/O servidor é authoritative|server is authoritative|server is the authority/i);
 assert.match(data,/Por segurança, o acesso à rede permanece bloqueado/);
 assert.match(data,/if\(response\.ok&&result\.networkAccess===true\)/);
 assert.match(data,/catch\{/);
 assert.match(data,/if\(response\.ok&&result\.networkAccess===true\)return \{profile,status:'ok'\}/);
 assert.doesNotMatch(data,/catch\{[^}]*status:'ok'/s);
 assert.match(app,/setRestricted\('identity-check'\)/);
});
