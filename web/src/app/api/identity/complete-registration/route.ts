import {createClient} from '@supabase/supabase-js';
import {NextRequest,NextResponse} from 'next/server';
import {identityUserContext} from '@/lib/identity-server';
import {isTrustedIdentityOrigin} from '@/lib/identity-origin';
import {completionFromRecords,completionResult} from '@/lib/identity-completion';
import {runtimeConfig} from '@/lib/identity-server';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0'};
async function inspect(request:NextRequest){
 const context=await identityUserContext(request);
 if(!context)return NextResponse.json({error:'Sessao expirada. Entre novamente.'},{status:401,headers});
 const [profile,age]=await Promise.all([
  context.db.from('profiles').select('id').eq('id',context.user.id).maybeSingle(),
  context.db.from('registration_age_declarations').select('declared_band').eq('user_id',context.user.id).maybeSingle()
 ]);
 if(profile.error||age.error)return NextResponse.json({error:'Nao foi possivel consultar o cadastro.'},{status:503,headers});
 let hasVerifiedGuardianAssociation=false;
 const isMinorDeclaration=age.data?.declared_band==='13_15'||age.data?.declared_band==='16_17';
 if(isMinorDeclaration){
  // A declared age is untrusted, but it must still trigger the safer guardian gate.
  // Only the server-role client can read guardian links and trusted age decisions.
  if(!runtimeConfig.supabaseUrl||!runtimeConfig.serviceKey)
   return NextResponse.json({error:'Não foi possível confirmar a associação de responsável. O cadastro de menor continua pendente.'},{status:503,headers});
  const admin=createClient(runtimeConfig.supabaseUrl,runtimeConfig.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:links,error:linkError}=await admin.from('conecta_guardian_links')
   .select('guardian_user_id').eq('child_user_id',context.user.id).eq('status','accepted');
  if(linkError)return NextResponse.json({error:'Não foi possível confirmar a associação de responsável. O cadastro de menor continua pendente.'},{status:503,headers});
  const guardianIds=(links||[]).map(row=>row.guardian_user_id);
  if(guardianIds.length){
   const {data:decisions,error:decisionError}=await admin.from('age_assurance_decisions')
    .select('user_id,age_band,method,verified_at').in('user_id',guardianIds).eq('age_band','18_plus');
   if(decisionError)return NextResponse.json({error:'Não foi possível confirmar a maioridade do responsável. O cadastro de menor continua pendente.'},{status:503,headers});
   const now=Date.now();
   hasVerifiedGuardianAssociation=(decisions||[]).some(row=>{
    const timestamp=Date.parse(row.verified_at);
    return ['verified_age_credential','authorized_provider_callback'].includes(row.method)&&
      Number.isFinite(timestamp)&&timestamp<=now+60_000&&now-timestamp<=60*24*60*60*1000;
   });
  }
 }
 const state=completionFromRecords(Boolean(profile.data),age.data?.declared_band,hasVerifiedGuardianAssociation);
 return NextResponse.json(completionResult(state),{headers});
}
/** Read-only. A successful response reports an existing BASIC signup, not ID verification. */
export async function GET(request:NextRequest){return inspect(request);}
export async function POST(request:NextRequest){
 if(!isTrustedIdentityOrigin(request.headers,request.url,process.env))
  return NextResponse.json({error:'Origem invalida.'},{status:403,headers});
 return inspect(request);
}
