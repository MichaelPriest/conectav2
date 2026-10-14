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
const auditMigration = fs.readFileSync(path.join(root, '../supabase/migrations/20261013240000_age_assurance_audit.sql'), 'utf8');

test('canonical age payload binds the one-time challenge, bounds, SDK status and approval date', () => {
  const payload = {ageLower: 18, ageUpper: null, userStatus: 0, mostRecentApprovalDate: null};
  assert.equal(canonicalAgeSignalRequest('a'.repeat(64), payload), 'conecta-age-v1|' + 'a'.repeat(64) + '|18|null|0|null');
  assert.match(hashAgeSignalRequest('a'.repeat(64), payload), /^[0-9a-f]{64}$/);
  assert.notEqual(hashAgeSignalRequest('a'.repeat(64), payload), hashAgeSignalRequest('b'.repeat(64), payload));
});

test('verification decodes token on the server and rejects self-declared age for trusted storage', () => {
  assert.match(route, /verifyPlayIntegrityToken\(integrityToken,requestHash\)/);
  assert.match(route, /consume_age_assurance_challenge/);
  assert.match(route, /userStatus===0&&ageBand==='18_plus'/);
  assert.match(route, /userStatus===1&&ageBand!==null&&ageBand!=='18_plus'/);
  assert.match(route, /userStatus<0\|\|userStatus>5/);
  assert.match(route, /record_age_assurance_decision/);
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

test('accepted decisions are audited atomically and the audit table is private', () => {
  assert.match(auditMigration, /create table if not exists public\.age_assurance_audit_events/i);
  assert.match(auditMigration, /create or replace function public\.record_age_assurance_decision/i);
  assert.match(auditMigration, /insert into public\.age_assurance_audit_events/i);
  assert.match(auditMigration, /enable row level security/i);
  assert.match(auditMigration, /revoke all on table public\.age_assurance_audit_events from public, anon, authenticated/i);
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
