const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const typescript = require('typescript');
const vm = require('node:vm');

const filename = path.join(__dirname, '../src/lib/profile-details.ts');
const source = fs.readFileSync(filename, 'utf8');
const transpiled = typescript.transpileModule(source, {
  compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 }
}).outputText;
const loadedExports = {};
vm.runInNewContext(transpiled, { exports: loadedExports }, { filename });
const { normalizeProfileDetails, prepareProfileDetails } = loadedExports;

test('profile loaded with nullable DB fields is safe and shows empty inputs', () => {
  const normalized = normalizeProfileDetails({
    headline: null, city: null, website: null, music_url: null,
    mood_text: null, interests: null, cover_theme: null, layout_style: null,
    favorite_emoji: null
  });
  assert.equal(normalized.music_url, '');
  assert.equal(normalized.website, '');
  assert.equal(normalized.headline, '');
  assert.equal(normalized.city, '');
  assert.equal(normalized.mood_text, '');
  assert.equal(normalized.cover_theme, 'violet');
  assert.equal(normalized.layout_style, 'classic');
  assert.deepEqual(Array.from(normalized.interests), []);
});

test('saving null website and music does not throw and keeps SQL nulls', () => {
  const result = prepareProfileDetails(
    { website: null, music_url: null, headline: '  teste ', city: null }, 'arte, música, arte'
  );
  assert.equal(result.website, null);
  assert.equal(result.music_url, null);
  assert.equal(result.headline, 'teste');
  assert.deepEqual(Array.from(result.interests), ['arte', 'música']);
});

test('optional URL whitespace becomes SQL NULL, valid links stay intact', () => {
  assert.equal(prepareProfileDetails({ website: ' ', music_url: '\t' }, '').website, null);
  const result = prepareProfileDetails({
    website: ' https://conecta.example ', music_url: ' https://open.spotify.com/track/abc '
  }, '');
  assert.equal(result.website, 'https://conecta.example');
  assert.equal(result.music_url, 'https://open.spotify.com/track/abc');
});

test('missing or invalid older fields cannot crash profile save', () => {
  const values = [null, undefined, {}, { website: 3, music_url: false, interests: [null, 'games', 3] }];
  for (const value of values) {
    const details = prepareProfileDetails(value, '');
    assert.equal(typeof details.headline, 'string');
    assert.equal(details.website, null);
    assert.equal(details.music_url, null);
  }
});

test('interest values longer than database policy are rejected', () => {
  assert.throws(() => prepareProfileDetails(null, 'x'.repeat(33)), /até 32 caracteres/);
});
