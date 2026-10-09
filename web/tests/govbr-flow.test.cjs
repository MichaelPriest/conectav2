'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const ts=require('typescript');
const Module=require('node:module');
const src=fs.readFileSync(path.join(__dirname,'../src/lib/govbr-challenge.ts'),'utf8');
test('generated PDF stores challenge in its subject, not personal data',async()=>{
 const {PDFDocument}=require('pdf-lib');
 const source=src.replace(/^import 'server-only';\s*/m,'');
 const transpiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const filename=path.join(__dirname,'../src/lib/govbr-challenge.ts');
 const loader=new Module(filename,module);
 loader.filename=filename;
 loader.paths=Module._nodeModulePaths(path.dirname(filename));
 loader._compile(transpiled,filename);
 const exported=loader.exports;
 const id='123e4567-e89b-12d3-a456-426614174000';
 const nonce=exported.newNonce();
 assert.match(nonce,/^[0-9A-F]{48}$/);
 const bytes=await exported.generateStatementPdf(id,nonce,'2026-10-09T22:00:00Z');
 const doc=await PDFDocument.load(bytes,{updateMetadata:false});
 assert.equal(doc.getSubject(),exported.challengeMarker(id,nonce));
 assert.equal(doc.getPageCount(),1);
 assert.equal(typeof doc.getTitle(),'string');
 assert.ok(bytes.length<100000);
});
test('inspection never writes identity approval fields or persists uploaded PDF',()=>{
 const upload=fs.readFileSync(path.join(__dirname,'../src/app/api/identity/govbr/inspect/route.ts'),'utf8');
 assert.doesNotMatch(upload,/identity_verifications|age_band|guardian_status|\.storage\.from\(/);
 assert.match(upload,/identityVerified:false,ageVerified:false/);
 const app=fs.readFileSync(path.join(__dirname,'../src/components/govbr-signature-flow.tsx'),'utf8');
 assert.match(app,/https:\/\/assinador.iti.br/);
 assert.match(app,/https:\/\/validar.iti.gov.br/);
});
test('signature parser checks signed ranges, CMS and refuses missing signature',()=>{
 const parser=fs.readFileSync(path.join(__dirname,'../src/lib/govbr-pdf-inspect.ts'),'utf8');
 assert.match(parser,/openssl/);
 assert.match(parser,/-noverify/);
 assert.match(parser,/c\+d!==pdf.length/);
 assert.match(parser,/challenge_mismatch/);
});

test('native browser download uses SSR cookie auth with server-side getUser validation',()=>{
 const server=fs.readFileSync(path.join(__dirname,'../src/lib/identity-server.ts'),'utf8');
 assert.match(server,/createServerClient/);
 assert.match(server,/request\.cookies\.getAll/);
 assert.match(server,/client\.auth\.getUser\(\)/);
 const route=fs.readFileSync(path.join(__dirname,'../src/app/api/identity/govbr/challenge/route.ts'),'utf8');
 assert.match(route,/request\.nextUrl\.searchParams\.get\('download'\)/);
 assert.match(route,/Content-Disposition/);
 const comp=fs.readFileSync(path.join(__dirname,'../src/components/govbr-signature-flow.tsx'),'utf8');
 assert.match(comp,/method="POST"/);
 assert.match(comp,/download=1/);
});

test('attempt counter migration rejects identity changes and uses valid SQL syntax',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'../../supabase/migrations/20261008_fix_conecta_identity_challenge_attempt_counter.sql'),'utf8');
 assert.doesNotMatch(sql,/pg_catalog\.current_user/);
 assert.match(sql,/NEW\.attempt_count\s*:=\s*OLD\.attempt_count\s*\+\s*1/);
 assert.match(sql,/OLD\.user_id IS DISTINCT FROM auth\.uid\(\)/);
 assert.match(sql,/OLD\.attempt_count >= 5/);
 assert.match(sql,/SECURITY DEFINER/);
 assert.match(sql,/to_jsonb\(NEW\).*attempt_count/);
 const route=fs.readFileSync(path.join(__dirname,'../src/app/api/identity/govbr/inspect/route.ts'),'utf8');
 assert.match(route,/if\(attemptError\)/);
 assert.match(route,/if\(!attempt\)/);
 assert.doesNotMatch(route,/Limite de tentativas ou concorrencia/);
});

test('PDF inspection quota is visible and unsigned files do not spend attempts',()=>{
 const route=fs.readFileSync(path.join(__dirname,'../src/app/api/identity/govbr/inspect/route.ts'),'utf8');
 const counter=route.indexOf(".update({attempt_count:");
 const unsigned=route.indexOf("if(!pdf.includes(Buffer.from('/ByteRange')))");
 assert.ok(unsigned>0 && counter>unsigned);
 const get=fs.readFileSync(path.join(__dirname,'../src/app/api/identity/govbr/challenge/route.ts'),'utf8');
 assert.match(get,/attempt_count:active\.attempt_count/);
 const component=fs.readFileSync(path.join(__dirname,'../src/components/govbr-signature-flow.tsx'),'utf8');
 assert.match(component,/Limite desta declaração alcançado/);
 assert.match(component,/Próximo passo:/);
 assert.match(component,/Continuar para o Conecta sem selo verificado/);
 assert.doesNotMatch(route,/identity_verifications/);
});
