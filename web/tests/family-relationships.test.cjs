'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const route = fs.readFileSync(path.join(__dirname, '../src/app/api/relationships/family/route.ts'), 'utf8');
const ui = fs.readFileSync(path.join(__dirname, '../src/components/family-relationships.tsx'), 'utf8');
const migration = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20261014170000_conecta_family_relationships_and_guardians.sql'), 'utf8');
const verdict = fs.readFileSync(path.join(__dirname, '../src/lib/conecta-id-verdict.ts'), 'utf8');

test('family and guardian relationships are private and require authenticated same-origin requests', () => {
  assert.match(route, /identityUserContext\(request\)/);
  assert.match(route, /isTrustedIdentityOrigin\(request\.headers,request\.url/);
  assert.match(route, /Cache-Control/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.conecta_family_relationships from public, anon, authenticated/i);
  assert.match(migration, /revoke all on table public\.conecta_guardian_links from public, anon, authenticated/i);
});

test('family relationships require the invited account to consent', () => {
  assert.match(route, /row\.addressee_id!==me/);
  assert.match(route, /row\.requested_by===me/);
  assert.match(route, /status:'accepted'/);
  assert.match(ui, /Convite enviado/);
  assert.match(ui, /Aceitar/);
  assert.match(migration, /both users must consent/i);
});

test('guardian acceptance requires a current trusted adult age decision', () => {
  assert.match(route, /async function trustedAdult/);
  assert.match(route, /data\.age_band!=='18_plus'/);
  assert.match(route, /verified_age_credential/);
  assert.match(route, /authorized_provider_callback/);
  assert.match(route, /must have a current, trusted 18\+/i);
});

test('all verified minors require an accepted guardian association and trusted adult', () => {
  assert.match(verdict, /const isMinor = input\.ageBand !== null && input\.ageBand !== '18\+'/);
  assert.match(verdict, /input\.guardianAssociationAccepted && input\.guardianAgeVerified/);
  assert.match(verdict, /vinculo_responsavel_obrigatorio: guardianRequired && !guardianSatisfied/);
  assert.match(ui, /Para menores, a conta precisa ser associada/);
});

test('family labels and guardian associations are not presented as legal proof', () => {
  assert.match(ui, /não comprova parentesco legal/i);
  assert.match(migration, /not proof of legal kinship/i);
  assert.match(migration, /not legal proof/i);
});
