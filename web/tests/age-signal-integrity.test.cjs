'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const Module = require('node:module');

const root = path.join(__dirname, '..');
const helperPath = path.join(root, 'src/lib/age-signal-request.ts');
const compiled = ts.transpileModule(fs.readFileSync(helperPath, 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}
}).outputText;
const loaded = new Module(helperPath, module);
loaded.filename = helperPath;
loaded.paths = Module._nodeModulePaths(path.dirname(helperPath));
loaded._compile(compiled, helperPath);
const {canonicalAgeSignalRequest, hashAgeSignalRequest} = loaded.exports;
const routePath = path.join(root, 'src/app/api/identity/age-signal/verify/route.ts');
const route = fs.readFileSync(routePath, 'utf8');
const challengeRoute = fs.readFileSync(path.join(root, 'src/app/api/identity/age-signal/challenge/route.ts'), 'utf8');
const verifier = fs.readFileSync(path.join(root, 'src/lib/play-integrity.ts'), 'utf8');
const migration = fs.readFileSync(path.join(root, '../supabase/migrations/20261013230000_age_assurance_challenges.sql'), 'utf8');

test('canonical age payload binds the one-time challenge, bounds, source and approval date', () => {
  const payload = {ageLower: 18, ageUpper: null, ageRangeSource: 'TIER_D', significantChangeApprovalDate: null};
  assert.equal(canonicalAgeSignalRequest('a'.repeat(64), payload), 'conecta-age-v1|' + 'a'.repeat(64) + '|18|null|TIER_D|null');
  assert.match(hashAgeSignalRequest('a'.repeat(64), payload), /^[0-9a-f]{64}$/);
  assert.notEqual(hashAgeSignalRequest('a'.repeat(64), payload), hashAgeSignalRequest('b'.repeat(64), payload));
});

test('verification decodes token on the server and rejects self-declared age for trusted storage', () => {
  assert.match(route, /verifyPlayIntegrityToken\(integrityToken,requestHash\)/);
  assert.match(route, /consume_age_assurance_challenge/);
  assert.match(route, /ageRangeSource==='TIER_A'/);
  assert.match(route, /age_assurance_decisions/);
  assert.match(route, /Cache-Control/);
  assert.doesNotMatch(route, /body\.ageBand/);
  assert.doesNotMatch(route, /body\.ageAssurance/);
});

test('challenge storage is private and challenge consumption is atomic and one-time', () => {
  assert.match(challengeRoute, /randomBytes\(32\)/);
  assert.match(challengeRoute, /challenge_hash/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.age_assurance_challenges from public, anon, authenticated/i);
  assert.match(migration, /consumed_at is null/i);
  assert.match(migration, /expires_at > now\(\)/i);
  assert.match(migration, /grant execute on function public\.consume_age_assurance_challenge/);
});

test('integrity verifier requires expected package, signer digest, device integrity and fresh request hash', () => {
  assert.match(verifier, /GOOGLE_PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON/);
  assert.match(verifier, /GOOGLE_PLAY_PACKAGE_NAME/);
  assert.match(verifier, /GOOGLE_PLAY_APP_CERT_SHA256/);
  assert.match(verifier, /PLAY_RECOGNIZED/);
  assert.match(verifier, /MEETS_DEVICE_INTEGRITY/);
  assert.match(verifier, /details\?\.requestHash !== expectedRequestHash/);
  assert.match(verifier, /2 \* 60 \* 1000/);
});
