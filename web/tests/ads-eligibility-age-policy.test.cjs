'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');

const route=fs.readFileSync(path.join(__dirname,'../src/app/api/ads/eligibility/route.ts'),'utf8');

test('ad eligibility uses the service-role-only age assurance decision',()=>{
 assert.match(route,/runtimeConfig\.serviceKey/);
 assert.match(route,/from\('age_assurance_decisions'\)/);
 assert.match(route,/ageAssurancePolicy\(/);
 assert.match(route,/policy\.ageAssurance!=='verified_adult'/);
 assert.doesNotMatch(route,/from\('identity_verifications'\)/);
});

test('ads fail closed on feature flag, missing credentials, auth or database errors',()=>{
 assert.match(route,/CONECTA_ADS_ENABLED!=='true'/);
 assert.match(route,/if\(!url\|\|!publicKey\|\|!serviceKey\|\|!bearer\)return blocked\(\)/);
 assert.match(route,/if\(authError\|\|!user\)return blocked\(\)/);
 assert.match(route,/if\(error\|\|!data\)return blocked\(\)/);
 assert.match(route,/catch\{return blocked\(\);\}/);
});
