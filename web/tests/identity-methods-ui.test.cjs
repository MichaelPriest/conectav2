'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');

const page=fs.readFileSync(path.join(__dirname,'../src/app/verificar-identidade/page.tsx'),'utf8');
const panel=fs.readFileSync(path.join(__dirname,'../src/components/identity-methods-panel.tsx'),'utf8');

test('Conecta ID shows methods and keeps the free-first distinction visible',()=>{
 assert.match(page,/IdentityMethodsPanel/);
 assert.match(panel,/Prioridade para recursos gratuitos/);
 assert.match(panel,/Gratuito/);
 assert.match(panel,/não comprova/);
 assert.match(panel,/não concede selo nem libera recursos restritos/);
});

test('paid provider cannot start until exact price disclosure is explicitly ready',()=>{
 assert.match(page,/ready_with_cost_disclosure/);
 assert.match(page,/priceDisplay/);
 assert.match(page,/paidProviderReady/);
 assert.match(page,/bloqueado até haver preço real por tentativa/i);
 assert.match(panel,/Bloqueado até o preço exato por tentativa ser confirmado e exibido/);
 assert.doesNotMatch(panel,/ready_with_cost_disclosure.*?Iniciar verificação/s);
});

test('no client-side preflight result can be represented as trusted identity or age approval',()=>{
 assert.match(panel,/method\.verifiesIdentity\?'verifica':'não comprova'/);
 assert.match(panel,/method\.verifiesAge\?'verifica':'não comprova'/);
 assert.match(page,/Nenhum teste local/);
});
