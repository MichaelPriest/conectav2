'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const routePath = path.join(__dirname, '../src/app/api/identity/age-policy/route.ts');
const route = fs.readFileSync(routePath, 'utf8');
const migrationPath = path.join(__dirname, '../../supabase/migrations/20261013210000_age_assurance_decisions.sql');
const migration = fs.readFileSync(migrationPath, 'utf8');

test('age policy endpoint authenticates and reads server-side authoritative storage', () => {
  assert.match(route, /identityUserContext\(request\)/);
  assert.match(route, /createClient\(runtimeConfig\.supabaseUrl,runtimeConfig\.serviceKey/);
  assert.match(route, /from\('age_assurance_decisions'\)/);
  assert.match(route, /\.eq\('user_id',context\.user\.id\)/);
  assert.match(route, /Cache-Control/);
});

test('missing configuration or database errors fail closed', () => {
  assert.match(route, /unknownPolicy\(\)/);
  assert.match(route, /status:'unavailable'/);
  assert.match(route, /recursos restritos continuam bloqueados/);
  assert.doesNotMatch(route, /request\.json\(\)/);
  assert.doesNotMatch(route, /request\.nextUrl\.searchParams\.get\(['"]age/);
});

test('age decision table stores coarse bands only and denies client table access', () => {
  assert.match(migration, /age_band in \('under_12', '12_15', '16_17', '18_plus'\)/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.age_assurance_decisions from public, anon, authenticated/i);
  assert.match(migration, /grant select, insert, update, delete on table public\.age_assurance_decisions to service_role/i);
  assert.doesNotMatch(migration, /date_of_birth|document_image|selfie|biometric_template/i);
});
