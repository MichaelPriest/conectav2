import {createHash,randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {NextRequest,NextResponse} from 'next/server';
import {identityUserContext,runtimeConfig} from '@/lib/identity-server';
import {isTrustedIdentityOrigin} from '@/lib/identity-origin';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization'};

export async function POST(request:NextRequest){
 if(!isTrustedIdentityOrigin(request.headers,request.url,process.env)){
  return NextResponse.json({error:'Origem não autorizada.'},{status:403,headers});
 }
 const context=await identityUserContext(request);
 if(!context)return NextResponse.json({error:'Entre na sua conta para continuar.'},{status:401,headers});
 if(!runtimeConfig.supabaseUrl||!runtimeConfig.serviceKey){
  return NextResponse.json({status:'unavailable',error:'A verificação segura não está configurada.'},{status:503,headers});
 }

 const admin=createClient(runtimeConfig.supabaseUrl,runtimeConfig.serviceKey,{
  auth:{persistSession:false,autoRefreshToken:false}
 });
 const since=new Date(Date.now()-10*60*1000).toISOString();
 const {count, error:rateError}=await admin.from('age_assurance_challenges')
  .select('id',{count:'exact',head:true})
  .eq('user_id',context.user.id)
  .gte('created_at',since);
 if(!rateError&&(count||0)>=10){
  return NextResponse.json({status:'rate_limited',error:'Muitas tentativas. Aguarde alguns minutos.'},{status:429,headers});
 }

 const challenge=randomBytes(32).toString('hex');
 const challengeHash=createHash('sha256').update(challenge,'utf8').digest('hex');
 const expiresAt=new Date(Date.now()+3*60*1000).toISOString();
 const {error}=await admin.from('age_assurance_challenges').insert({
  user_id:context.user.id,
  challenge_hash:challengeHash,
  expires_at:expiresAt
 });
 if(error){
  return NextResponse.json({status:'unavailable',error:'Não foi possível iniciar a validação segura.'},{status:503,headers});
 }
 return NextResponse.json({
  status:'challenge_created',
  challenge,
  expiresAt,
  policyVersion:'play-age-signals-v1'
 },{headers});
}
