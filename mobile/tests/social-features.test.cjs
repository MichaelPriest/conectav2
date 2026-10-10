'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {communitySlug,validateCommunityDraft}=require('../src/community-validation.ts');
const {validatePollDraft}=require('../src/poll-validation.ts');
const {activeMention,replaceMention}=require('../src/mention-utils.ts');

test('Community slugs normalize Brazilian accents and reject unsafe characters',()=>{
 assert.equal(communitySlug('  São Paulo & Amigos  '),'sao-paulo-amigos');
 assert.equal(communitySlug('É Ótimo!'),'e-otimo');
 assert.ok(communitySlug('M'.repeat(120)).length<=60);
 assert.deepEqual(validateCommunityDraft('  Grupo Local  ','grupo-local',' Descrição ',' Regras '),{
  name:'Grupo Local',slug:'grupo-local',description:'Descrição',rules:'Regras'
 });
 for(const slug of ['../grupo','a','Duas Palavras','grupo_legal','a'.repeat(61)]){
  assert.throws(()=>validateCommunityDraft('Grupo válido',slug,'',''),/endereço/);
 }
 assert.throws(()=>validateCommunityDraft('AB','grupo','',''),/nome/);
 assert.throws(()=>validateCommunityDraft('Grupo','grupo','a'.repeat(3001),''),/descrição/);
});
test('Poll rules prevent ambiguous votes and invalid deadlines',()=>{
 assert.deepEqual(validatePollDraft(' Qual seu favorito? ',[' Café ',' Chá '],7),{
  question:'Qual seu favorito?',options:['Café','Chá'],days:7
 });
 assert.throws(()=>validatePollDraft('Qual?', ['Sim','Não'],7),/pergunta/);
 assert.throws(()=>validatePollDraft('Pergunta adequada',['Sim'],7),/2 e 6/);
 assert.throws(()=>validatePollDraft('Pergunta adequada',['Sim',' sim '],7),/diferentes/);
 assert.throws(()=>validatePollDraft('Pergunta adequada',['Café','café'],7),/diferentes/);
 assert.throws(()=>validatePollDraft('Pergunta adequada',['Sim','Não'],0),/prazo/);
 assert.throws(()=>validatePollDraft('Pergunta adequada',['Sim','Não'],30),/prazo/);
 assert.doesNotThrow(()=>validatePollDraft('Pergunta adequada',
  ['Um','Dois','Três','Quatro','Cinco','Seis'],14));
 assert.throws(()=>validatePollDraft('Pergunta adequada',
  ['Um','Dois','Três','Quatro','Cinco','Seis','Sete'],1),/2 e 6/);
});
test('Mentions appear only after an @handle, respecting the caret position',()=>{
 assert.deepEqual(activeMention('Oi @mic',7),{start:3,query:'mic'});
 assert.deepEqual(activeMention('Oi @MICH',8),{start:3,query:'mich'});
 assert.equal(activeMention('email@exemplo.com',14),null);
 assert.equal(activeMention('Olá @micha texto',16),null);
 assert.equal(activeMention('Olá @',5),null);
 assert.deepEqual(activeMention('tarefa @usu',11),{start:7,query:'usu'});
});
test('Mention replacement never changes surrounding text or allows fake handles',()=>{
 assert.equal(replaceMention('Oi @mic, tudo',7,'michaelrraimundo'),
  'Oi @michaelrraimundo , tudo');
 assert.equal(replaceMention('@mic',4,'fulano'),'@fulano ');
 assert.equal(replaceMention('Teste @mic',10,'../../invalid'),'Teste @mic');
 assert.equal(replaceMention('Teste @mic',10,'valid_name',12),'Teste @valid');
 assert.equal(replaceMention('Outro texto',11,'pessoa'),'Outro texto');
});
