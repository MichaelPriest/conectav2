import {NextRequest,NextResponse} from 'next/server';
import {chatPushContext,chatPushEndpointHash,chatPushRequestAllowed,validateChatPushSubscription} from '@/lib/chat-push-server';
import {allowedChatPushEndpoint} from '@/lib/chat-web-push';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:NextRequest){
  if(!chatPushRequestAllowed(request))return response({error:'Origem inválida.'},403);
  const ctx=await chatPushContext(request);
  if(!ctx)return response({error:'Push indisponível ou sessão inválida.'},401);
  const endpoint=request.nextUrl.searchParams.get('endpoint');
  if(!endpoint||!allowedChatPushEndpoint(endpoint))return response({enabled:false});
  const {data,error}=await ctx.admin.from('chat_push_subscriptions')
    .select('endpoint_hash').eq('endpoint_hash',chatPushEndpointHash(endpoint))
    .eq('user_id',ctx.user.id).maybeSingle();
  if(error)return response({error:'Não foi possível consultar este dispositivo.'},503);
  return response({enabled:Boolean(data)});
}
export async function POST(request:NextRequest){
  if(!chatPushRequestAllowed(request))return response({error:'Origem inválida.'},403);
  if(Number(request.headers.get('content-length')||0)>8192)return response({error:'Payload inválido.'},413);
  const ctx=await chatPushContext(request);
  if(!ctx)return response({error:'Push indisponível ou sessão inválida.'},401);
  const body=await request.json().catch(()=>null);
  const data=validateChatPushSubscription(body);
  if(!data)return response({error:'Assinatura de push inválida ou provedor não suportado.'},400);
  const endpoint_hash=chatPushEndpointHash(data.endpoint);
  const {data:owned,error:listError}=await ctx.admin.from('chat_push_subscriptions')
    .select('endpoint_hash').eq('user_id',ctx.user.id).limit(6);
  if(listError)return response({error:'Não foi possível conferir os dispositivos.'},503);
  if((owned||[]).length>=5&&!owned?.some(v=>v.endpoint_hash===endpoint_hash))
    return response({error:'Limite de cinco dispositivos por conta.'},429);
  const {error}=await ctx.admin.from('chat_push_subscriptions').upsert({
    ...data,endpoint_hash,user_id:ctx.user.id,updated_at:new Date().toISOString()
  },{onConflict:'endpoint_hash'});
  if(error)return response({error:'Não foi possível registrar o dispositivo.'},503);
  return response({enabled:true});
}
export async function DELETE(request:NextRequest){
  if(!chatPushRequestAllowed(request))return response({error:'Origem inválida.'},403);
  const ctx=await chatPushContext(request);
  if(!ctx)return response({error:'Push indisponível ou sessão inválida.'},401);
  const body=await request.json().catch(()=>null) as {endpoint?:unknown}|null;
  if(!body||typeof body.endpoint!=='string'||!allowedChatPushEndpoint(body.endpoint))
    return response({error:'Dispositivo inválido.'},400);
  const {error}=await ctx.admin.from('chat_push_subscriptions').delete()
    .eq('endpoint_hash',chatPushEndpointHash(body.endpoint)).eq('user_id',ctx.user.id);
  if(error)return response({error:'Não foi possível desativar o dispositivo.'},503);
  return response({enabled:false});
}
