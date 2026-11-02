import {NextRequest,NextResponse} from 'next/server';
import {identityContext} from '@/lib/identity-server';
import {assessRegistrationRisk} from '@/lib/registration-risk';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};

/** Advisory risk triage; this endpoint never grants identity or age verification. */
export async function GET(request:NextRequest){
 const ctx=await identityContext(request);
 if(!ctx)return NextResponse.json({error:'Faça login.'},{status:401,headers});
 const [profile,age]=await Promise.all([
  ctx.admin.from('profiles').select('id').eq('id',ctx.user.id).maybeSingle(),
  ctx.admin.from('registration_age_declarations').select('declared_band').eq('user_id',ctx.user.id).maybeSingle()
 ]);
 if(profile.error||age.error)return NextResponse.json({error:'Triagem indisponível.'},{status:503,headers});
 const declared=age.data?.declared_band;
 const band=declared==='under_13'||declared==='13_15'||declared==='16_17'||declared==='18_plus'?declared:null;
 const result=assessRegistrationRisk({
  contactConfirmed:Boolean(ctx.user.email_confirmed_at),
  profileComplete:Boolean(profile.data),
  declaredAgeBand:band,
  signals:[]
 });
 return NextResponse.json({...result,notice:'Triagem preliminar. Não comprova identidade ou idade e não autoriza recursos sociais restritos.'},{headers});
}
