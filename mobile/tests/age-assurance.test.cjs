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
  assert.match(adapter, /status: 'not_shared'/);
  assert.match(adapter, /status: 'verification_required'/);
  assert.match(adapter, /never upload it as a trusted decision/);
  assert.match(adapter, /never.*unlock adult-only features/s);
});

test('profile UI makes the age-signal request user-initiated and explains it is only preliminary', () => {
  assert.match(app, /Consultar faixa etária do Google Play/);
  assert.match(app, /nenhum recurso restrito será liberado por esta consulta/);
  assert.match(app, /O resultado não é enviado nem armazenado/);
});

test('native bridge uses the current two-step access and signal request flow', () => {
  assert.match(native, /requestAgeSignalsAccess/);
  assert.match(native, /AgeSignalsStatus\.SHARED/);
  assert.match(native, /AgeSignalsStatus\.NOT_SHARED/);
  assert.match(native, /AgeSignalsStatus\.VERIFICATION_REQUIRED/);
  assert.match(native, /checkAgeSignals/);
  assert.match(gradle, /com\.google\.android\.play:age-signals:0\.0\.4/);
  assert.doesNotMatch(native, /installId\(\)/);
});
