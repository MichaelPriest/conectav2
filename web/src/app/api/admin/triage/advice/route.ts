import {NextRequest,NextResponse} from 'next/server';
import {identityContext} from '@/lib/identity-server';
import {adviseRegistrationRisk} from '@/lib/registration-risk-advisor';
import type {TriageSignal} from '@/lib/registration-risk';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const signals=new Set<TriageSignal>(['contact_unconfirmed','registration_incomplete','age_inconsistency','suspected_duplicate','automated_abuse','document_mismatch','liveness_inconclusive','manual_report']);
export async function GET(request:NextRequest){
 const ctx=await identityContext(request);
 if(!ctx)return NextResponse.json({error:'Faça login.'},{status:401,headers});
 const {data:role,error:roleError}=await ctx.admin.from('platform_moderators').select('role').eq('user_id',ctx.user.id).maybeSingle();
 if(roleError)return NextResponse.json({error:'Permissão indisponível.'},{status:503,headers});
 if(role?.role!=='admin')return NextResponse.json({error:'Acesso restrito.'},{status:403,headers});
 const userId=request.nextUrl.searchParams.get('user_id')||'';
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId))
  return NextResponse.json({error:'Usuário inválido.'},{status:400,headers});
 const {data,error}=await ctx.admin.from('registration_triage').select('status,reasons').eq('user_id',userId).maybeSingle();
 if(error)return NextResponse.json({error:'Triagem indisponível.'},{status:503,headers});
 if(!data)return NextResponse.json({error:'Triagem não encontrada.'},{status:404,headers});
 const reasons=(data.reasons||[]).filter((x:string):x is TriageSignal=>signals.has(x as TriageSignal));
 const advice=adviseRegistrationRisk(reasons,!reasons.includes('contact_unconfirmed'));
 return NextResponse.json({status:data.status,advice,notice:'Recomendação explicável baseada em regras; não é modelo treinado. Não concede acesso nem substitui revisão humana.'},{headers});
}
