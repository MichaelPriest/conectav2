'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const adapter = fs.readFileSync(path.join(root, 'src/age-assurance.ts'), 'utf8');
const app = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
const native = fs.readFileSync(path.join(root, 'modules/age-signals/android/src/main/java/expo/modules/agesignals/PlayAgeSignalsModule.kt'), 'utf8');
const gradle = fs.readFileSync(path.join(root, 'modules/age-signals/android/build.gradle'), 'utf8');

test('Play Age Signals bridge handles unavailable and declined states without granting privileges', () => {
  assert.match(adapter, /Platform\.OS !== 'android'/);
  assert.match(adapter, /'not_shared'/);
  assert.match(adapter, /status: 'verification_required'/);
  assert.match(adapter, /never upload it as a trusted decision/);
  assert.match(adapter, /never.*unlock adult-only features/s);
  assert.match(adapter, /requestPlayIntegrityToken/);
  assert.match(adapter, /userStatus/);
  assert.match(adapter, /normalizedAgeLower/);
  assert.match(adapter, /userStatus === 0 \? 18 : null/);
  assert.doesNotMatch(adapter, /ageRangeSource/);
  assert.doesNotMatch(adapter, /significantChangeApprovalDate/);
  assert.match(adapter, /google_cloud_project_not_configured/);
});

test('first sideloaded release does not expose a Play-only age flow in the profile UI', () => {
  assert.doesNotMatch(app, /Consultar faixa etária do Google Play/);
  assert.doesNotMatch(app, /requestPlayAgeSignals|submitPlayAgeSignal/);
  assert.match(app, /Abrir verificação protegida/);
  assert.match(app, /proteção por idade/);
  // Keep the Play SDK isolated as a future integration: it must never grant
  // privileges locally, and the first release does not depend on Play Store.
  assert.match(adapter, /never upload it as a trusted decision/);
  assert.match(adapter, /never.*unlock adult-only features/s);
});

test('native bridge uses the current two-step access and signal request flow', () => {
  assert.match(native, /requestAgeSignalsAccess/);
  assert.match(native, /AgeSignalsStatus\.SHARED/);
  assert.match(native, /AgeSignalsStatus\.NOT_SHARED/);
  assert.match(native, /AgeSignalsStatus\.VERIFICATION_REQUIRED/);
  assert.match(native, /checkAgeSignals/);
  assert.match(native, /userStatus\(\)/);
  assert.match(native, /mostRecentApprovalDate\(\)/);
  assert.match(native, /requestIntegrityToken/);
  assert.match(native, /setRequestHash\(requestHash\)/);
  assert.match(gradle, /com\.google\.android\.play:integrity:1\.5\.0/);
  assert.match(gradle, /com\.google\.android\.play:age-signals:0\.0\.4/);
  assert.doesNotMatch(native, /installId\(\)/);
});
