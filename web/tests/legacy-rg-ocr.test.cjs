'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const test=require('node:test');
const ts=require('typescript');
const s=fs.readFileSync(path.join(__dirname,'../src/lib/legacy-rg-ocr.ts'),'utf8');
const js=ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const outputs={};vm.runInNewContext(js,{exports:outputs,Date,Number,String,Set,JSON},{filename:'legacy-rg-ocr.ts'});
const {inspectLegacyRgOcr}=outputs;
const now=new Date(2026,9,8);
test('extracts age category after explicit birth label (not issue date)',()=>{
 const x=inspectLegacyRgOcr('REGISTRO GERAL\nNASCIMENTO 05/06/2000\nDATA DE EXPEDICAO 02/03/2020',now);
 assert.equal(x.status,'age-indicative');assert.equal(x.band,'18_plus');
 assert.equal('dob' in x,false);
});
test('cannot infer DOB from document emission or validity alone',()=>{
 const x=inspectLegacyRgOcr('DATA DE EXPEDICAO 13/10/2010\nVALIDADE 13/10/2030',now);
 assert.equal(x.status,'date-uncertain');assert.equal(x.band,undefined);
});
test('ambiguous conflicting birth dates do not grant a band',()=>{
 const x=inspectLegacyRgOcr('NASCIMENTO 02/06/2010\nNASCIMENTO 02/06/1980',now);
 assert.equal(x.status,'date-uncertain');
});
test('invalid date, future age and excessive age do not create a band',()=>{
 for(const value of ['31/02/2005','09/10/2029','09/10/1800']){
  const x=inspectLegacyRgOcr('NASCIMENTO '+value,now);
  assert.notEqual(x.status,'age-indicative');
 }
});
test('minor labels remain age indicative only',()=>{
 const x=inspectLegacyRgOcr('Data de nascimento:\n13.10.2011',now);
 assert.equal(x.band,'13_15');assert.ok(!('ageVerified' in x));assert.ok(!('identityVerified' in x));
});
test('no document photo, CPF, RG or extracted text persisted as output',()=>{
 const input='Nome MARIA SILVA RG 55.555.555-5 CPF 529.982.247-25 NASCIMENTO 04/12/1984';
 const result=inspectLegacyRgOcr(input,now);
 assert.equal(result.status,'age-indicative');
 assert.equal(JSON.stringify(result).includes('MARIA'),false);
 assert.equal(JSON.stringify(result).includes('529'),false);
 assert.equal(JSON.stringify(result).includes('1984'),false);
});
