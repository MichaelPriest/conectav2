'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('server access gate requires trusted identity and age, and accepted verified adult guardian for minors',()=>{
 const route=read('src/app/api/identity/access/route.ts');
 assert.match(route,/identity_verifications/);
 assert.match(route,/status==='approved'/);
 assert.match(route,/age_assurance_decisions/);
 assert.match(route,/verified_age_credential/);
 assert.match(route,/authorized_provider_callback/);
 assert.match(route,/recent\(/);
 assert.match(route,/conecta_guardian_links/);
 assert.match(route,/guardianAge/);
 assert.match(route,/networkAccess:true/);
 assert.match(route,/networkAccess:false/);
 assert.doesNotMatch(route,/verified_platform_age_signal/);
});

test('restrictive database policies enforce the gate beyond client-side navigation',()=>{
 const migration=read('../supabase/migrations/20261014220000_conecta_id_required_network_access.sql');
 assert.match(migration,/create or replace function app_private\.conecta_network_access_allowed/);
 assert.match(migration,/security definer/i);
 assert.match(migration,/iv\.status = 'approved'/);
 assert.match(migration,/gd\.age_band = '18_plus'/);
 assert.match(migration,/gl\.status = 'accepted'/);
 assert.match(migration,/as restrictive for all to anon, authenticated/i);
 assert.match(migration,/create policy conecta_id_verified_profile_discovery/i);
 for(const table of ['posts','messages','friendships','conversations','stories','communities','notifications']){
  assert.ok(migration.includes("'"+table+"'"),'missing RLS gate for '+table);
 }
});

test('app navigation redirects every unverified account to Conecta ID',()=>{
 const shell=read('src/components/app-shell.tsx');
 assert.match(shell,/fetch\('\/api\/identity\/access'/);
 assert.match(shell,/access\.networkAccess!==true/);
 assert.match(shell,/pathname!=='\/verificar-identidade'/);
 assert.doesNotMatch(shell,/declared_band!=='18_plus'/);
});

test('free local preflights cannot offer a link that bypasses Conecta ID',()=>{
 const page=read('src/app/verificar-identidade/page.tsx');
 const govbr=read('src/components/govbr-signature-flow.tsx');
 assert.match(page,/Acesso à rede bloqueado até concluir o Conecta ID/);
 assert.match(page,/FamilyRelationships/);
 assert.doesNotMatch(page,/href="\/feed"/);
 assert.doesNotMatch(govbr,/href="\/feed"/);
});
