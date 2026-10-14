'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const ts=require('typescript');
const Module=require('node:module');
const sourcePath=path.join(__dirname,'../src/lib/identity-completion.ts');
const compiled=ts.transpileModule(fs.readFileSync(sourcePath,'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const m=new Module(sourcePath,module);
m.filename=sourcePath;m.paths=Module._nodeModulePaths(path.dirname(sourcePath));
m._compile(compiled,sourcePath);
const {completionFromRecords,completionResult}=m.exports;
test('No profile or age declaration never unlocks a completed signup',()=>{
 assert.equal(completionFromRecords(false,'18_plus'),'profile_required');
 assert.equal(completionFromRecords(true,null),'age_declaration_required');
});
test('Adult self-declaration completes BASIC registration only',()=>{
 const x=completionResult(completionFromRecords(true,'18_plus'));
 assert.equal(x.canFinishBasic,true);
 assert.equal(x.next,'/feed');
 assert.equal(x.identityVerified,false);
 assert.equal(x.ageVerified,false);
 assert.equal(x.ageAssurance,'unknown');
 assert.equal(x.ageDeclarationTrusted,false);
 assert.equal(x.adultRestrictedAccess,false);
 assert.equal(x.minorProtectionsRequired,true);
 assert.equal(x.grantsAdultPrivileges,false);
 assert.equal(x.adsAllowed,false);
});
test('Teen statements and unexpected values fail closed',()=>{
 for(const band of ['13_15','16_17','under_13','unknown','invalid']){
  const x=completionResult(completionFromRecords(true,band));
  assert.equal(x.canFinishBasic,false);
  assert.equal(x.next,'/conexoes');
  assert.equal(x.state,'teen_guardian_pending');
  assert.equal(x.identityVerified,false);
 }
});
test('Registration completion endpoint is read-only and server checked',()=>{
 const route=fs.readFileSync(path.join(__dirname,'../src/app/api/identity/complete-registration/route.ts'),'utf8');
 assert.match(route,/identityUserContext/);
 assert.match(route,/isTrustedIdentityOrigin/);
 assert.match(route,/registration_age_declarations/);
 assert.match(route,/conecta_guardian_links/);
 assert.match(route,/age_assurance_decisions/);
 assert.match(route,/hasVerifiedGuardianAssociation/);
 assert.match(route,/profiles/);
 assert.doesNotMatch(route,/\.update\(|\.upsert\(|identity_verifications|\.insert\(/);
});

test('A minor with an accepted age-verified guardian remains protected until age assurance',()=>{
 const x=completionResult(completionFromRecords(true,'13_15',true));
 assert.equal(x.state,'teen_protection_pending');
 assert.equal(x.canFinishBasic,false);
 assert.equal(x.next,null);
 assert.equal(x.identityVerified,false);
 assert.equal(x.ageVerified,false);
 assert.equal(x.grantsAdultPrivileges,false);
});
