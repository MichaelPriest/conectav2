'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');

const route=fs.readFileSync(path.join(__dirname,'../src/app/api/identity/cin/inspect/route.ts'),'utf8');

test('server CIN inspection authenticates user and checks trusted request origin',()=>{
 assert.match(route,/isTrustedIdentityOrigin\(request\.headers,request\.url,process\.env\)/);
 assert.match(route,/identityUserContext\(request\)/);
 assert.match(route,/fail\('Entre na sua conta para continuar\.',401\)/);
 assert.match(route,/fail\('Origem inválida\.',403\)/);
});

test('server CIN inspection bounds token size and does not echo/store personal QR data',()=>{
 assert.match(route,/token\.length<100\|\|token\.length>8192/);
 assert.match(route,/inspectCinToken\(token\)/);
 assert.match(route,/Do not echo or persist the QR token, CPF, birth date/);
 assert.doesNotMatch(route,/\.insert\(|\.upsert\(|\.update\(|console\.(log|error)/);
 assert.doesNotMatch(route,/cpf:|dateOfBirth:|birthDate:/);
});

test('cryptographic preflight never claims official validity, holder match or grants',()=>{
 assert.match(route,/validationLevel:'local-cryptographic-preflight'/);
 assert.match(route,/officialCurrentValidityChecked:false/);
 assert.match(route,/holderMatchChecked:false/);
 assert.match(route,/identityVerified:false/);
 assert.match(route,/ageVerified:false/);
 assert.match(route,/grantsAdultPrivileges:false/);
 assert.match(route,/documentStored:false/);
});
