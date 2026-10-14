'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');

const route=fs.readFileSync(path.join(__dirname,'../src/app/api/identity/start/route.ts'),'utf8');

test('server-side start route fails closed before creating a provider inquiry',()=>{
  assert.match(route,/IDENTITY_PROVIDER_BILLING_NOT_READY/);
  assert.match(route,/status:503/);
  assert.match(route,/preço real/);
  assert.match(route,/consentimento explícito/);
  assert.match(route,/cobrança/);
  assert.doesNotMatch(route,/personaRequest\s*\(/);
  assert.doesNotMatch(route,/identity_verifications/);
});
