import {NextRequest,NextResponse} from 'next/server';
import webpush from 'web-push';
import {chatPushContext,chatPushEndpointHash,chatPushRequestAllowed} from '@/lib/chat-push-server';
import {allowedChatPushEndpoint,CHAT_PUSH_PAYLOAD,chatPushDeliveryOptions} from '@/lib/chat-web-push';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
// Single Render instance: throttle user-triggered notification tests independently
// from real messages. Tests only a subscribed endpoint owned by the caller.
const lastTestByUser=new Map<string,number>();
export async function POST(request:NextRequest){
 if(!chatPushRequestAllowed(request))return json({error:'Origem inválida.'},403);
 const ctx=await chatPushContext(request);
 if(!ctx)return json({error:'Sessão inválida ou Push indisponível.'},401);
 if(Number(request.headers.get('content-length')||0)>8192)return json({error:'Pedido muito grande.'},413);
 const body=await request.json().catch(()=>null) as {endpoint?:unknown}|null;
 if(!body||typeof body.endpoint!=='string'||!allowedChatPushEndpoint(body.endpoint))
   return json({error:'Assinatura inválida. Ative as notificações novamente.'},400);
 const {data:item,error:lookupError}=await ctx.admin.from('chat_push_subscriptions')
   .select('endpoint,p256dh,auth_key').eq('endpoint_hash',chatPushEndpointHash(body.endpoint))
   .eq('user_id',ctx.user.id).maybeSingle();
 if(lookupError)return json({error:'Não foi possível conferir o dispositivo.'},503);
 if(!item)return json({error:'Este dispositivo ainda não está cadastrado. Clique em Ativar Push.'},404);
 const now=Date.now();
 if(now-(lastTestByUser.get(ctx.user.id)||0)<60000)
   return json({error:'Aguarde um minuto para repetir o teste.'},429);
 if(lastTestByUser.size>1000){
   for(const [id,at] of lastTestByUser)if(now-at>60000)lastTestByUser.delete(id);
 }
 lastTestByUser.set(ctx.user.id,now);
 try{
   webpush.setVapidDetails(process.env.WEB_PUSH_VAPID_SUBJECT!,
     process.env.WEB_PUSH_VAPID_PUBLIC_KEY!,process.env.WEB_PUSH_VAPID_PRIVATE_KEY!);
   await webpush.sendNotification({endpoint:item.endpoint,
     keys:{p256dh:item.p256dh,auth:item.auth_key}},CHAT_PUSH_PAYLOAD,
     chatPushDeliveryOptions(item.endpoint));
   return json({accepted:true});
 }catch(e){
   const statusCode=(e as {statusCode?:number}).statusCode;
   if(statusCode===404||statusCode===410){
     await ctx.admin.from('chat_push_subscriptions').delete()
       .eq('endpoint_hash',chatPushEndpointHash(item.endpoint)).eq('user_id',ctx.user.id);
     return json({error:'O dispositivo perdeu a inscrição. Desative e ative novamente o Push.'},410);
   }
   const providerStatus=typeof statusCode==='number'&&statusCode>=400&&statusCode<600?
     ' (HTTP '+statusCode+')':'';
   return json({error:'O serviço de notificações rejeitou o teste'+providerStatus+'.'},502);
 }
}
