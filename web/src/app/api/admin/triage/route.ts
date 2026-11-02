import {NextRequest,NextResponse} from 'next/server';
import {identityContext} from '@/lib/identity-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
async function adminContext(req:NextRequest){
 const ctx=await identityContext(req);
 if(!ctx)return {error:NextResponse.json({error:'Faça login.'},{status:401,headers})};
 const {data,error}=await ctx.admin.from('platform_moderators').select('role').eq('user_id',ctx.user.id).maybeSingle();
 if(error)return {error:NextResponse.json({error:'Permissão indisponível.'},{status:503,headers})};
 if(data?.role!=='admin')return {error:NextResponse.json({error:'Acesso restrito.'},{status:403,headers})};
 return {ctx};
}
export async function GET(req:NextRequest){
 const auth=await adminContext(req);
 if(auth.error)return auth.error;
 const ctx=auth.ctx!;
 const status=req.nextUrl.searchParams.get('status')||'pending_review';
 if(!['pending_review','pending_contact','eligible_basic','ineligible','approved','rejected','all'].includes(status))
  return NextResponse.json({error:'Filtro inválido.'},{status:400,headers});
 let query=ctx.admin.from('registration_triage').select('user_id,status,reasons,reviewed_at,review_note,updated_at',{count:'exact'}).order('updated_at',{ascending:false}).limit(100);
 if(status!=='all')query=query.eq('status',status);
 const {data,error,count}=await query;
 if(error)return NextResponse.json({error:'Não foi possível consultar a fila.'},{status:503,headers});
 const ids=(data||[]).map(row=>row.user_id);
 const {data:profiles,error:profileError}=ids.length
  ?await ctx.admin.from('profiles').select('id,display_name,handle').in('id',ids)
  :{data:[],error:null};
 if(profileError)return NextResponse.json({error:'Falha ao consultar perfis.'},{status:503,headers});
 const names=new Map((profiles||[]).map(p=>[p.id,p]));
 return NextResponse.json({cases:(data||[]).map(row=>({...row,display_name:names.get(row.user_id)?.display_name||null,handle:names.get(row.user_id)?.handle||null})),total:count||0},{headers});
}
