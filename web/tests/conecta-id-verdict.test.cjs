'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const sourcePath = path.join(__dirname, '../src/lib/conecta-id-verdict.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const loaded = new Module(sourcePath, module);
loaded.filename = sourcePath;
loaded.paths = Module._nodeModulePaths(path.dirname(sourcePath));
loaded._compile(compiled, sourcePath);
const { buildConectaIdVerdict } = loaded.exports;

test('never grants adult access from self-declared/untrusted age or missing method', () => {
  const result = buildConectaIdVerdict({
    evidenceVerified: false,
    ageBand: '18+',
    method: 'nenhum',
    originalsDeleted: true,
    guardianAuthenticated: false
  });
  assert.equal(result.status_validacao, 'falha');
  assert.equal(result.resultado.maior_de_idade, false);
  assert.equal(result.resultado.faixa_etaria, 'indeterminada');
  assert.equal(result.resultado.metodo_utilizado, 'nenhum');
  assert.equal(result.politica_dados.conta_pode_ser_ativada, false);
});

test('requires an authenticated guardian for verified users under 16', () => {
  const result = buildConectaIdVerdict({
    evidenceVerified: true,
    ageBand: '13-15',
    method: 'documento_assinado',
    originalsDeleted: true,
    guardianAuthenticated: false
  });
  assert.equal(result.status_validacao, 'pendente_responsavel');
  assert.equal(result.politica_dados.vinculo_responsavel_obrigatorio, true);
  assert.equal(result.politica_dados.conta_pode_ser_ativada, false);
  assert.equal(result.politica_dados.protecoes_menor_obrigatorias, true);
});

test('adult verdict only follows trusted evidence and completed source-data deletion', () => {
  const input = {
    evidenceVerified: true,
    ageBand: '18+',
    method: 'api_governamental',
    originalsDeleted: true,
    guardianAuthenticated: false
  };
  const result = buildConectaIdVerdict(input);
  assert.equal(result.status_validacao, 'sucesso');
  assert.equal(result.resultado.maior_de_idade, true);
  assert.equal(result.resultado.faixa_etaria, '18+');
  assert.equal(result.politica_dados.rastreamento_comercial_permitido, false);
  assert.equal(result.politica_dados.publicidade_comportamental_permitida, false);
  assert.equal(result.politica_dados.conta_pode_ser_ativada, true);
  assert.match(result.transacao_id, /^[0-9a-f-]{36}$/i);
});

test('fails closed when the verification pipeline has not deleted original data', () => {
  const result = buildConectaIdVerdict({
    evidenceVerified: true,
    ageBand: '18+',
    method: 'api_governamental',
    originalsDeleted: false,
    guardianAuthenticated: false
  });
  assert.equal(result.status_validacao, 'falha');
  assert.equal(result.politica_dados.dados_originais_deletados, false);
  assert.equal(result.resultado.maior_de_idade, false);
  assert.equal(result.politica_dados.conta_pode_ser_ativada, false);
});

test('does not emit CPF, birth date, raw document, or biometric payload fields', () => {
  const result = buildConectaIdVerdict({
    evidenceVerified: true,
    ageBand: '16-17',
    method: 'cin_criptografica',
    originalsDeleted: true,
    guardianAuthenticated: false
  });
  const forbiddenKeys = new Set(['cpf', 'data_nascimento', 'documento_original', 'selfie', 'biometria', 'imagem', 'video', 'vetor_biometrico']);
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert.equal(forbiddenKeys.has(key.toLowerCase()), false, `unexpected sensitive field: ${key}`);
      visit(child);
    }
  }
  visit(result);
});
