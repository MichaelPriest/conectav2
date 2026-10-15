import {createClient} from '@supabase/supabase-js';
import {NextRequest,NextResponse} from 'next/server';
import {identityUserContext,runtimeConfig} from '@/lib/identity-server';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization'};
const fail=(status:number,error:string)=>NextResponse.json({networkAccess:false,reason:'verification_unavailable',error},{status,headers});

function recent(value:string|null|undefined){
 if(!value)return false;
 const time=Date.parse(value),now=Date.now();
 return Number.isFinite(time)&&time<=now+60_000&&now-time<=60*24*60*60*1000;
}
function trustedMethod(value:string|null|undefined){
 return value==='verified_age_credential'||value==='authorized_provider_callback'||value==='conecta_free_document_face';
}

/** Server-authoritative gate used by app navigation; the database migration enforces the same rule on social tables. */
export async function GET(request:NextRequest){
 const context=await identityUserContext(request);
 if(!context)return NextResponse.json({networkAccess:false,reason:'session_required'},{status:401,headers});
 if(!runtimeConfig.supabaseUrl||!runtimeConfig.serviceKey)return fail(503,'O Conecta ID não está configurado no servidor. O acesso à rede continua bloqueado.');
 const admin=createClient(runtimeConfig.supabaseUrl,runtimeConfig.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const [profile,age,identity,decision]=await Promise.all([
  context.db.from('profiles').select('id').eq('id',context.user.id).maybeSingle(),
  context.db.from('registration_age_declarations').select('declared_band').eq('user_id',context.user.id).maybeSingle(),
  admin.from('identity_verifications').select('status,verified_at').eq('user_id',context.user.id).maybeSingle(),
  admin.from('age_assurance_decisions').select('age_band,method,verified_at').eq('user_id',context.user.id).maybeSingle()
 ]);
 if(profile.error||age.error||identity.error||decision.error)return fail(503,'Não foi possível consultar as verificações com segurança. Nenhum acesso foi liberado.');
 const steps={profile:Boolean(profile.data),ageDeclaration:Boolean(age.data),identity:false,age:false,guardian:false};
 if(!profile.data)return NextResponse.json({networkAccess:false,reason:'profile_required',steps,message:'Complete seu perfil para iniciar o Conecta ID.'},{headers});
 if(!age.data)return NextResponse.json({networkAccess:false,reason:'age_declaration_required',steps,message:'Informe sua faixa etária para iniciar a verificação.'},{headers});
 steps.identity=identity.data?.status==='approved'&&recent(identity.data.verified_at);
 steps.age=Boolean(decision.data&&trustedMethod(decision.data.method)&&recent(decision.data.verified_at)&&['13_15','16_17','18_plus'].includes(decision.data.age_band));
 if(!steps.identity)return NextResponse.json({networkAccess:false,reason:identity.data?.status==='approved'?'verification_expired':'identity_required',steps,message:'A identidade ainda não foi confirmada por uma fonte confiável. A validação gratuita integrada exige QR legível, OCR, comparação facial e análise antifraude no servidor.'},{headers});
 if(!steps.age)return NextResponse.json({networkAccess:false,reason:decision.data?'verification_expired':'age_verification_required',steps,message:'A faixa etária ainda não foi confirmada por uma credencial confiável. A autodeclaração e as pré-triagens locais não são suficientes.'},{headers});
 if(age.data.declared_band!=='18_plus'||decision.data?.age_band!=='18_plus'){
  const {data:links,error:linksError}=await admin.from('conecta_guardian_links')
   .select('guardian_user_id').eq('child_user_id',context.user.id).eq('status','accepted');
  if(linksError)return fail(503,'Não foi possível confirmar o responsável. A conta continua bloqueada.');
  const ids=(links||[]).map(link=>link.guardian_user_id);
  if(!ids.length)return NextResponse.json({networkAccess:false,reason:'guardian_required',steps,message:'Para liberar o acesso, associe um pai, mãe ou responsável cuja identidade e maioridade já estejam verificadas.'},{headers});
  const [guardians,guardianAge]=await Promise.all([
   admin.from('identity_verifications').select('user_id,status,verified_at').in('user_id',ids).eq('status','approved'),
   admin.from('age_assurance_decisions').select('user_id,age_band,method,verified_at').in('user_id',ids).eq('age_band','18_plus')
  ]);
  if(guardians.error||guardianAge.error)return fail(503,'Não foi possível validar o responsável. A conta continua bloqueada.');
  steps.guardian=(guardians.data||[]).some(g=>recent(g.verified_at)&&(guardianAge.data||[]).some(a=>a.user_id===g.user_id&&trustedMethod(a.method)&&recent(a.verified_at)));
  if(!steps.guardian)return NextResponse.json({networkAccess:false,reason:'guardian_required',steps,message:'O responsável precisa aceitar o vínculo e concluir a verificação confiável de identidade e maioridade.'},{headers});
 }
 return NextResponse.json({networkAccess:true,reason:'verified',steps,message:'Conecta ID concluído. Acesso à rede liberado conforme as proteções da faixa etária.'},{headers});
}
