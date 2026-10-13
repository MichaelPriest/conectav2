'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const Module = require('node:module');

const sourcePath = path.join(__dirname, '../src/lib/age-assurance-policy.ts');
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const loaded = new Module(sourcePath, module);
loaded.filename = sourcePath;
loaded.paths = Module._nodeModulePaths(path.dirname(sourcePath));
loaded._compile(compiled, sourcePath);
const { ageAssurancePolicy } = loaded.exports;

const adult = {
  status: 'verified',
  ageBand: '18_plus',
  source: 'verified_age_credential',
  verifiedAt: '2026-10-12T12:00:00.000Z',
  evidenceReference: 'credential:abc12345'
};

test('unknown, self-declared, OCR and browser-only signals fail closed', () => {
  for (const input of [
    null,
    { ageBand: '18_plus' },
    { ...adult, source: 'self_declaration' },
    { ...adult, source: 'cin_local_preflight' },
    { ...adult, source: 'browser_liveness' },
    { ...adult, status: 'pending' },
    { ...adult, evidenceReference: 'x' },
    { ...adult, verifiedAt: 'not-a-date' },
    { ...adult, verifiedAt: '2099-01-01T00:00:00.000Z' }
  ]) {
    const result = ageAssurancePolicy(input);
    assert.equal(result.ageAssurance, 'unknown');
    assert.equal(result.canAccessAdultRestrictedFeatures, false);
    assert.equal(result.mustApplyMinorProtections, true);
    assert.equal(result.accountSafetyMode, 'minor_protected');
  }
});

test('verified minor can use basic social features but never adult-restricted features', () => {
  const result = ageAssurancePolicy({ ...adult, ageBand: '12_15' });
  assert.equal(result.ageAssurance, 'verified_minor');
  assert.equal(result.canUseBasicSocialFeatures, true);
  assert.equal(result.canAccessAdultRestrictedFeatures, false);
  assert.equal(result.mustApplyMinorProtections, true);
  for (const ageBand of ['under_12', '16_17']) {
    const minor = ageAssurancePolicy({ ...adult, ageBand });
    assert.equal(minor.ageAssurance, 'verified_minor');
    assert.equal(minor.canAccessAdultRestrictedFeatures, false);
    assert.equal(minor.mustApplyMinorProtections, true);
  }
});

test('only a trusted server-validated adult signal can permit age-restricted access', () => {
  const result = ageAssurancePolicy(adult);
  assert.equal(result.ageAssurance, 'verified_adult');
  assert.equal(result.canAccessAdultRestrictedFeatures, true);
  assert.equal(result.mustApplyMinorProtections, false);
});

test('the helper is explicitly designed for server-side authorization, not client claims', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');
  assert.match(source, /Never construct the input from request JSON/);
  assert.match(source, /Fail closed for age-restricted features/);
});
