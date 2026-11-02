import {NextRequest,NextResponse} from 'next/server';
import {identityContext} from '@/lib/identity-server';
import {assessRegistrationRisk} from '@/lib/registration-risk';
import {isTrustedIdentityOrigin} from '@/lib/identity-origin';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function POST(request:NextRequest){
 if(!isTrustedIdentityOrigin(request.headers,request.url,process.env))
  return NextResponse.json({error:'Origem inválida.'},{status:403,headers});
 const ctx=await identityContext(request);
 if(!ctx)return NextResponse.json({error:'Faça login.'},{status:401,headers});
 const [profile,age,existing,identity]=await Promise.all([
  ctx.admin.from('profiles').select('id').eq('id',ctx.user.id).maybeSingle(),
  ctx.admin.from('registration_age_declarations').select('declared_band').eq('user_id',ctx.user.id).maybeSingle(),
  ctx.admin.from('registration_triage').select('status,reasons').eq('user_id',ctx.user.id).maybeSingle(),
  ctx.admin.from('identity_verifications').select('status').eq('user_id',ctx.user.id).maybeSingle()
 ]);
 if(profile.error||age.error||existing.error||identity.error)return NextResponse.json({error:'Triagem indisponível.'},{status:503,headers});
 const declared=age.data?.declared_band;
 const band=declared==='under_13'||declared==='13_15'||declared==='16_17'||declared==='18_plus'?declared:null;
 const signals: Array<'age_inconsistency'|'document_mismatch'>=[];
 // Only server-owned verification outcomes are used as adverse signals.
 if(identity.data?.status==='rejected')signals.push('document_mismatch');
 const result=assessRegistrationRisk({
  contactConfirmed:Boolean(ctx.user.email_confirmed_at),
  profileComplete:Boolean(profile.data),
  declaredAgeBand:band,signals
 });
 // Never overwrite a manual outcome or a previously flagged risk.
 if(existing.data&&['approved','rejected','ineligible'].includes(existing.data.status))
  return NextResponse.json({status:existing.data.status,reasons:existing.data.reasons,preserved:true},{headers});
 const status=result.decision;
 if(existing.data){
  const {data:updated,error}=await ctx.admin.from('registration_triage')
   .update({status,reasons:result.reasons,updated_at:new Date().toISOString()})
   .eq('user_id',ctx.user.id).in('status',['pending_contact','eligible_basic','pending_review'])
   .select('status').maybeSingle();
  if(error)return NextResponse.json({error:'Não foi possível atualizar a triagem.'},{status:503,headers});
  if(!updated)return NextResponse.json({status:'pending_review',preserved:true,notice:'A classificação foi alterada por outro processo. Atualize para consultar a situação.'},{headers});
 }else{
  const {error}=await ctx.admin.from('registration_triage').insert({
   user_id:ctx.user.id,status,reasons:result.reasons,updated_at:new Date().toISOString()
  });
  if(error){
   if(error.code==='23505')return NextResponse.json({status:'pending_review',preserved:true,notice:'Triagem já registrada. Atualize para consultar a situação.'},{headers});
   return NextResponse.json({error:'Não foi possível registrar a triagem.'},{status:503,headers});
  }
 }
 return NextResponse.json({status,reasons:result.reasons,humanReviewRequired:result.humanReviewRequired,identityVerified:false,ageVerified:false},{headers});
}
