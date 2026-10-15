'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('free document verification requires consent, QR payload, OCR and server-side face matching',()=>{
 const route=read('src/app/api/identity/free-document/verify/route.ts');
 const ui=read('src/components/free-document-verification.tsx');
 assert.match(ui,/não comprova, sozinha, vivacidade/);
 assert.match(ui,/pode permitir escolher uma foto da galeria/);
 assert.match(route,/form\.get\('consent'\)!=='true'/);
 assert.match(route,/form\.get\('documentBack'\)/);
 assert.match(route,/decodeQrFromImage\(back\)/);
 assert.match(route,/QRCodeReader/);
 assert.match(route,/identity_free_verification_attempts/);
 assert.match(route,/MAX_REQUEST_BYTES=25\*1024\*1024/);
 assert.match(route,/length>=5/);
 assert.match(route,/createWorker\('por'\)/);
 assert.match(route,/dobFromText/);
 assert.match(route,/worker\.recognize\(document\)/);
 assert.match(route,/worker\.recognize\(back\)/);
 assert.match(route,/frontDob&&backDob&&frontDob!==backDob/);
 assert.match(route,/frente e no verso divergem/);
 assert.match(route,/instance\.detect\(documentTensor\)/);
 assert.match(route,/instance\.detect\(selfieTensor\)/);
 assert.match(route,/instance\.match\.similarity/);
 assert.match(route,/selfieFace\.real/);
 assert.match(route,/uma selfie estática não comprova vivacidade/);
 assert.match(route,/Nenhum selo, faixa etária ou acesso foi liberado/);
 assert.doesNotMatch(route,/status:'approved'/);
 assert.doesNotMatch(route,/from\('identity_verifications'\)\.upsert/);
 assert.doesNotMatch(route,/from\('age_assurance_decisions'\)\.upsert/);
 assert.match(route,/documentStored:false/);
 assert.match(route,/documentStored:false/);
});

test('the free path never accepts browser-supplied descriptors or writes raw document evidence',()=>{
 const route=read('src/app/api/identity/free-document/verify/route.ts');
 assert.doesNotMatch(route,/form\.get\(['"](?:embedding|descriptor|similarity|faceScore)['"]\)/);
 assert.doesNotMatch(route,/storage\.from\(/);
 assert.doesNotMatch(route,/console\.(?:log|error|warn)/);
 assert.match(route,/document\.fill\(0\)/);
 assert.match(route,/selfie\.fill\(0\)/);
});

test('free method is accepted only by the server gate and restrictive database function',()=>{
 const gate=read('src/app/api/identity/access/route.ts');
 const migration=read('../supabase/migrations/20261015015235_conecta_free_document_face_verification.sql');
 assert.match(gate,/conecta_free_document_face/);
 assert.match(migration,/conecta_free_document_face/);
 assert.match(migration,/create or replace function app_private\.conecta_network_access_allowed/);
 assert.match(migration,/iv\.status = 'approved'/);
 assert.match(migration,/gd\.age_band = '18_plus'/);
});
