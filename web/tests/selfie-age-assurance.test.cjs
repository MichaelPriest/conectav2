'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('selfie endpoint checks authenticated one-use challenge and server-derived live frames',()=>{
  const api=read('web/src/app/api/identity/free-document/verify/route.ts');
  assert.match(api,/verifyLiveSelfieMajority\(request,context\)/);
  assert.match(api,/consume_identity_liveness_challenge/);
  assert.match(api,/assessGuidedHeadTurns\(offsets,order/);
  assert.match(api,/inspectFacePresentation\(raw\.data,raw\.width,raw\.height,box\)/);
  assert.match(api,/human\.match\.similarity\(first\.embedding,last\.embedding/);
  assert.match(api,/faceFocusVariance\(raw\.data,raw\.width,raw\.height,box\)/);
  assert.match(api,/declaration\?\.declared_band!=='18_plus'/);
  assert.match(api,/ageEstimates\.some\(age=>age<25\)/);
  assert.match(api,/Math\.abs\(ageEstimates\[0\]-ageEstimates\[1\]\)>6/);
  assert.match(api,/face\.embedding\?\.fill\(0\)/);
  assert.match(api,/buffers\[i\]\.fill\(0\)/);
  assert.match(api,/age_estimate_inconclusive/);
  assert.match(api,/identityVerified:false/);
  assert.doesNotMatch(api.slice(api.indexOf('async function verifyLiveSelfieMajority('),api.indexOf('export async function POST(request:NextRequest)')),/identity_verifications|identityVerified:true|approved:true|face\.age\s*=|ageBandFromCin/);
});

test('database records age-only decisions with service role and preserves stronger methods',()=>{
  const sql=read('supabase/migrations/20261106180000_conecta_selfie_age_estimate.sql');
  assert.match(sql,/conecta_selfie_age_estimate/);
  assert.match(sql,/complete_conecta_selfie_age_assurance/);
  assert.match(sql,/p_evidence_reference_hash !~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(sql,/where public\.age_assurance_decisions\.method='conecta_selfie_age_estimate'/);
  assert.match(sql,/grant execute on function public\.complete_conecta_selfie_age_assurance\(uuid,text,timestamptz\)\s+to service_role/);
  assert.match(sql,/from public\.registration_age_declarations r/);
  assert.match(sql,/d\.method in \('conecta_document_age_only','conecta_selfie_age_estimate'\)/);
  assert.doesNotMatch(sql,/identity_verifications/);
  assert.doesNotMatch(sql,/grant execute on function public\.complete_conecta_selfie_age_assurance\(uuid,text,timestamptz\)\s+to authenticated/);
  // Read-only social eligibility must remain callable by authenticated RLS users.
  assert.match(sql,/grant execute on function app_private\.conecta_basic_feed_allowed\(uuid\) to authenticated,service_role/);
});

test('app presents live capture first with document fallback without identity approval',()=>{
  const ui=read('web/src/components/selfie-age-verification.tsx');
  const page=read('web/src/app/conecta-id/page.tsx');
  const policy=read('web/src/lib/age-assurance-policy.ts');
  const access=read('web/src/app/api/identity/access/route.ts');
  assert.match(ui,/getUserMedia\(/);
  assert.match(ui,/inspectGuidedFace/);
  assert.match(ui,/livenessFrame'\+i/);
  assert.match(ui,/x-conecta-verification-flow':'selfie_age'/);
  assert.match(ui,/onNeedsDocument/);
  assert.match(ui,/Nenhuma selfie ou biometria será armazenada/);
  assert.match(page,/verificationMode.*'selfie'/);
  assert.match(page,/<SelfieAgeVerification /);
  assert.match(page,/<FreeDocumentVerification /);
  assert.match(policy,/conecta_selfie_age_estimate/);
  assert.match(access,/\['conecta_document_age_only','conecta_selfie_age_estimate'\]/);
  assert.match(access,/identity\.data\?\.status==='approved'/);
});
