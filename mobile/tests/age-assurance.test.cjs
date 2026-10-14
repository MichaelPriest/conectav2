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
const moduleGradle = gradle;

test('Play Age Signals bridge handles unavailable and declined states without granting privileges', () => {
  assert.match(adapter, /Platform\.OS !== 'android'/);
  assert.match(adapter, /'not_shared'/);
  assert.match(adapter, /'verification_required'/);
  assert.match(adapter, /never upload it as a trusted decision/);
  assert.match(adapter, /never.*unlock adult-only features/s);
  assert.match(adapter, /requestPlayIntegrityToken/);
  assert.match(adapter, /userStatus/);
  assert.match(adapter, /normalizedAgeLower/);
  assert.match(adapter, /userStatus === 0 \? 18 : null/);
  assert.doesNotMatch(adapter, /ageRangeSource/);
  assert.doesNotMatch(adapter, /significantChangeApprovalDate/);
  assert.match(adapter, /google_cloud_project_not_configured/);
  assert.match(adapter, /does not independently.*attest the age-result fields/s);
  assert.doesNotMatch(adapter, /status: 'verified'/);
  assert.doesNotMatch(adapter, /verifyBody\.status === 'verified'/);
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

test('native bridge explicitly defers Play-only APIs for the sideload first release', () => {
  assert.match(native, /deferred_first_release/);
  assert.match(native, /google_play_services_not_used_for_sideload/);
  assert.match(native, /google_play_age_signals_not_used_for_sideload/);
  assert.match(native, /AsyncFunction\("requestIntegrityToken"\)/);
  assert.match(native, /AsyncFunction\("requestAgeSignals"\)/);
  assert.doesNotMatch(native, /AgeSignalsManagerFactory|StandardIntegrityManagerFactory/);
  assert.doesNotMatch(native, /integrityToken" to response\.token/);
  assert.ok(moduleGradle.includes('versionName "1.0.0"'),
    'Expo Android module must define versionName so the sideload APK can build');
  assert.doesNotMatch(native, /installId\(\)/);
});
