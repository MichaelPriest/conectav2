import {NextRequest,NextResponse} from 'next/server';
import {identityContext} from '@/lib/identity-server';
import {isTrustedIdentityOrigin} from '@/lib/identity-origin';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function POST(req:NextRequest){
 if(!isTrustedIdentityOrigin(req.headers,req.url,process.env))return NextResponse.json({error:'Origem inválida.'},{status:403,headers});
 const ctx=await identityContext(req);
 if(!ctx)return NextResponse.json({error:'Faça login.'},{status:401,headers});
 const {data:role,error:roleError}=await ctx.admin.from('platform_moderators').select('role').eq('user_id',ctx.user.id).maybeSingle();
 if(roleError)return NextResponse.json({error:'Permissão indisponível.'},{status:503,headers});
 if(role?.role!=='admin')return NextResponse.json({error:'Acesso restrito.'},{status:403,headers});
 let body:unknown;
 try{body=await req.json();}catch{return NextResponse.json({error:'JSON inválido.'},{status:400,headers});}
 if(!body||typeof body!=='object')return NextResponse.json({error:'Dados inválidos.'},{status:400,headers});
 const input=body as Record<string,unknown>;
 const userId=input.user_id,status=input.status,note=input.note;
 if(typeof userId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
 ||(status!=='approved'&&status!=='rejected')||typeof note!=='string'||note.trim().length<8||note.length>1000)
  return NextResponse.json({error:'Informe usuário, decisão e justificativa de 8 a 1000 caracteres.'},{status:400,headers});
 const {data,error}=await ctx.admin.rpc('admin_decide_registration_triage',{p_user_id:userId,p_status:status,p_note:note.trim(),p_actor_id:ctx.user.id});
 if(error)return NextResponse.json({error:'Decisão não registrada. Confirme se o caso está pendente.'},{status:409,headers});
 return NextResponse.json({ok:true,status:data,notice:'Revisão registrada. Não equivale a comprovação de identidade ou idade.'},{headers});
}
