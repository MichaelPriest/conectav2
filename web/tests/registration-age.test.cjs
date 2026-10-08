const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const Module=require('node:module');
const filepath=path.join(__dirname,'../src/lib/registration-age.ts');
const js=ts.transpileModule(fs.readFileSync(filepath,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod=new Module(filepath,module);mod.filename=filepath;mod._compile(js,filepath);
const {declaredBandFromDob,ageBandLabel}=mod.exports;
const today=new Date(2026,9,8);
test('age thresholds and exact birthday',()=>{
 assert.equal(declaredBandFromDob('2013-10-08',today),'13_15');
 assert.equal(declaredBandFromDob('2010-10-08',today),'16_17');
 assert.equal(declaredBandFromDob('2008-10-08',today),'18_plus');
 assert.equal(declaredBandFromDob('2013-10-09',today),'under_13');
 assert.equal(declaredBandFromDob('2010-10-09',today),'13_15');
 assert.equal(declaredBandFromDob('2008-10-09',today),'16_17');
 assert.equal(ageBandLabel('18_plus'),'18 anos ou mais');
});
test('invalid/future dates rejected, valid leap date accepted',()=>{
 for(const s of ['', '2026-02-29','2026-13-01','2099-01-01','1800-01-01','2026-99-99'])assert.equal(declaredBandFromDob(s,today),null);
 assert.equal(declaredBandFromDob('2012-02-29',today),'13_15');
});
test('signup does not store full date of birth or trust editable metadata as certified',()=>{
 const auth=fs.readFileSync(path.join(__dirname,'../src/app/auth/page.tsx'),'utf8');
 const onboard=fs.readFileSync(path.join(__dirname,'../src/app/onboarding/page.tsx'),'utf8');
 assert.match(auth,/declaredBandFromDob/);
 assert.match(onboard,/registration_age_declarations/);
 assert.doesNotMatch(onboard,/date_of_birth\s*:/);
 assert.doesNotMatch(auth,/birth_date\s*:/);
 assert.doesNotMatch(onboard,/identity_verifications|status:\s*'approved'/);
});
