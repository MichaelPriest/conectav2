'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');

const page=fs.readFileSync(path.join(__dirname,'../src/app/verificar-identidade/page.tsx'),'utf8');
const upload=fs.readFileSync(path.join(__dirname,'../src/components/free-document-verification.tsx'),'utf8');

test('Conecta ID exposes one unified free document and selfie validation flow',()=>{
 assert.match(page,/Validar minha identidade/);
 assert.match(page,/Um único processo gratuito/);
 assert.match(page,/FreeDocumentVerification/);
 assert.match(page,/identity-document-type/);
 assert.doesNotMatch(page,/IdentityMethodsPanel|GovBrSignatureFlow|HumanCameraCheck|CinQrScanner|LegacyRgScanner/);
 assert.doesNotMatch(page,/Métodos do Conecta ID|Validação oficial gratuita da CIN/);
});

test('document upload requires explicit consent and sends all evidence to the server',()=>{
 assert.match(upload,/documentFront/);
 assert.match(upload,/documentBack/);
 assert.match(upload,/selfie/);
 assert.match(upload,/rgDataSide/);
 assert.match(upload,/rgPhotoSide/);
 assert.match(upload,/Quatro partes do RG antigo/);
 assert.match(upload,/capture="environment"/);
 assert.match(upload,/captura automaticamente quatro quadros/i);
 assert.match(upload,/setTimeout\(\(\)=>\{void captureFrame\(\);\},5000\)/);
 assert.match(upload,/consent/);
 assert.ok(upload.includes('/api/identity/free-document/verify'));
 assert.match(upload,/não há consulta automática a uma base oficial/i);
});

test('no local preflight can be represented as official identity or age approval',()=>{
 assert.match(page,/não é prova de idade/);
 assert.match(page,/não uma certificação governamental/);
 assert.match(page,/não equivale à confirmação oficial do emissor/);
});
