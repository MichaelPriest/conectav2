const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261010_conecta_monetization_interests.sql'),'utf8');
const withdrawal=fs.readFileSync(path.join(root,'supabase/migrations/20261010_conecta_monetization_withdrawal.sql'),'utf8');
const page=fs.readFileSync(path.join(root,'web/src/app/apoiar/page.tsx'),'utf8');
const admin=fs.readFileSync(path.join(root,'web/src/app/gestao-monetizacao/page.tsx'),'utf8');
test('Monetization interest has RLS, authenticated grants and adult-only submission',()=>{
 assert.match(migration,/enable row level security/i);
 assert.match(migration,/revoke all on table public\.monetization_interests from public,anon,authenticated/i);
 assert.match(migration,/grant insert\(user_id,kind,organization_name,contact_email,note,contact_consent\)/i);
 assert.match(migration,/grant update\(status\)/i);
 assert.match(migration,/declared_band='18_plus'/i);
 assert.match(migration,/status='pending'/i);
 assert.match(migration,/role='admin'/i);
 assert.match(migration,/unique \(user_id,kind\)/i);
});
test('Interest forms do not provide an automatic checkout or paid entitlement',()=>{
 assert.match(page,/lista de espera, sem pagamento/i);
 assert.match(page,/não disponível para contratação/i);
 assert.doesNotMatch(page,/stripe\.checkout|createPayment|window\.location\.href\s*=\s*.*checkout/i);
 assert.match(admin,/data\?\.role==='admin'/);
 assert.match(admin,/\.update\(\{status\}\)/);
});

test('User can withdraw only own interest and no one can alter contact details',()=>{
 assert.match(withdrawal,/grant delete on table public\.monetization_interests to authenticated/i);
 assert.match(withdrawal,/for delete to authenticated using \(user_id=\(select auth\.uid\(\)\)\)/i);
 assert.match(page,/\.delete\(\)\.eq\('user_id',auth\.user\.id\)\.eq\('kind',kind\)/);
 assert.match(page,/Retirar interesse/);
});
