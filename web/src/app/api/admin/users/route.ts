import {NextRequest,NextResponse} from 'next/server';
import {identityContext} from '@/lib/identity-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const headers={'Cache-Control':'private, no-store'};
 const ctx=await identityContext(req);
 if(!ctx)return NextResponse.json({error:'Faça login.'},{status:401,headers});
 const {data:role,error:roleError}=await ctx.admin.from('platform_moderators').select('role').eq('user_id',ctx.user.id).maybeSingle();
 if(roleError)return NextResponse.json({error:'Permissão indisponível.'},{status:503,headers});
 if(role?.role!=='admin')return NextResponse.json({error:'Acesso restrito a administradores.'},{status:403,headers});
 const page=Math.max(1,Math.min(100000,Number(req.nextUrl.searchParams.get('page'))||1));
 const search=(req.nextUrl.searchParams.get('search')||'').trim().toLowerCase().slice(0,100);
 try{
  const all:Array<{id:string;email?:string;created_at:string;last_sign_in_at?:string}>=[],perPage=1000;
  for(let index=1;index<=100;index++){
   const {data,error}=await ctx.admin.auth.admin.listUsers({page:index,perPage});
   if(error)throw error;
   all.push(...data.users.map(u=>({id:u.id,email:u.email,created_at:u.created_at,last_sign_in_at:u.last_sign_in_at})));
   if(data.users.length<perPage)break;
   if(index===100)throw Error('Limite de paginação atingido.');
  }
  const matched=search?all.filter(u=>u.email?.toLowerCase().includes(search)):all;
  const total=matched.length,subset=matched.slice((page-1)*25,page*25),ids=subset.map(u=>u.id);
  if(!ids.length)return NextResponse.json({users:[],total,page},{headers});
  const [profiles,roles]=await Promise.all([
   ctx.admin.from('profiles').select('id,display_name,handle').in('id',ids),
   ctx.admin.from('platform_moderators').select('user_id,role').in('user_id',ids)
  ]);
  if(profiles.error||roles.error)throw Error('Falha ao consultar perfis.');
  const names=new Map((profiles.data||[]).map(p=>[p.id,p]));
  const permissions=new Map((roles.data||[]).map(r=>[r.user_id,r.role]));
  return NextResponse.json({users:subset.map(u=>({...u,display_name:names.get(u.id)?.display_name||null,handle:names.get(u.id)?.handle||null,role:permissions.get(u.id)||'user'})),total,page},{headers});
 }catch{return NextResponse.json({error:'Falha ao consultar usuários.'},{status:503,headers});}
}
