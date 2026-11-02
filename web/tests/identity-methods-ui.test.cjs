'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');

const page=fs.readFileSync(path.join(__dirname,'../src/app/verificar-identidade/page.tsx'),'utf8');
const upload=fs.readFileSync(path.join(__dirname,'../src/components/free-document-verification.tsx'),'utf8');

test('legacy Conecta ID screen redirects to the new route',()=>{
 assert.ok(page.includes("redirect('/conecta-id')"));
 assert.doesNotMatch(page,/FreeDocumentVerification/);
});

test('document upload requires explicit consent and sends all evidence to the server',()=>{
 assert.match(upload,/documentFront/);
 assert.match(upload,/documentBack/);
 assert.match(upload,/selfie/);
 assert.doesNotMatch(upload,/rgDataSide|rgPhotoSide|Parte interna atrás/);
 assert.match(upload,/sem exigir leitura de QR Code/);
 assert.match(upload,/Frente e verso do documento/);
 assert.match(upload,/capture="environment"/);
 assert.match(upload,/captura cada quadro automaticamente após manter a posição estável por pelo menos 2,2 segundos/i);
 assert.match(upload,/stable>=6&&now-firstReadyAt>=2200/);
 assert.match(upload,/data-testid="conecta-face-guide-frame"/);
 assert.match(upload,/consent/);
 assert.ok(upload.includes('/api/identity/free-document/verify'));
 assert.match(upload,/não há consulta automática a uma base oficial/i);
});

test('new Conecta ID explicitly does not claim verified age or identity',()=>{
 const current=fs.readFileSync(path.join(__dirname,'../src/app/conecta-id/page.tsx'),'utf8');
 assert.match(current,/não confirma sua identidade nem maioridade/);
 assert.ok(!current.includes('href="/verificar-identidade"'));
});
