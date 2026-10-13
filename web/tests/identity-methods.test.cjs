'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');

const route=fs.readFileSync(path.join(__dirname,'../src/app/api/identity/methods/route.ts'),'utf8');

test('identity methods endpoint authenticates and never claims verified identity or age',()=>{
 assert.match(route,/identityUserContext\(request\)/);
 assert.match(route,/status:401/);
 assert.match(route,/identityVerified:false/);
 assert.match(route,/ageVerified:false/);
 assert.match(route,/grantsAdultPrivileges:false/);
});

test('free local checks are clearly preflight-only and do not create approvals',()=>{
 assert.match(route,/local-document-preflight/);
 assert.match(route,/camera-liveness-preflight/);
 assert.match(route,/verifiesIdentity:false/);
 assert.match(route,/verifiesAge:false/);
 assert.doesNotMatch(route,/\.insert\(|\.upsert\(|\.update\(|identity_verifications/);
});

test('external provider cannot start charging without cost disclosure and authenticated webhook',()=>{
 assert.match(route,/provider_billed/);
 assert.match(route,/configured_requires_cost_disclosure/);
 assert.match(route,/preço real por tentativa/);
 assert.doesNotMatch(route,/personaRequest\(/);
});

test('gov.br signature integrity is not represented as gov.br login or official age verification',()=>{
 assert.match(route,/govbr-signed-document/);
 assert.match(route,/Não equivale a autenticação gov\.br/);
 assert.match(route,/Nenhum método listado concede selo oficial/);
});
