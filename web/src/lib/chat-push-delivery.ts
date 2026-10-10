import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import webpush from 'web-push';
import {CHAT_PUSH_PAYLOAD,chatPushShouldNotify,chatPushDeliveryOptions} from '@/lib/chat-web-push';
import {nativePushDeliveryReady} from '@/lib/mobile-push-server';
import {sendMobileChatPush,type NativePushDevice} from '@/lib/mobile-push-delivery';

export const CHAT_PUSH_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function privilegedChatPushClient():SupabaseClient|null{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return null;
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export type PushDeliveryResult={status:number;result:Record<string,unknown>};

/** Both the authenticated sender and signed database webhook call this function.
 * Recipients are derived exclusively from DB memberships, not from request parameters.
 */
export async function deliverChatPush(admin:SupabaseClient,messageId:string,expectedSender?:string):Promise<PushDeliveryResult>{
 const {data:message,error:messageError}=await admin.from('messages')
   .select('id,sender_id,conversation_id,created_at,deleted_at')
   .eq('id',messageId).maybeSingle();
 if(messageError||!message||expectedSender&&message.sender_id!==expectedSender)
   return {status:404,result:{error:'Mensagem indisponível.'}};
 if(message.deleted_at||!Number.isFinite(Date.parse(message.created_at))||
   Date.now()-Date.parse(message.created_at)>5*60_000||
   Date.parse(message.created_at)>Date.now()+60_000)
   return {status:409,result:{error:'Mensagem fora do período de aviso.'}};
 const {data:members,error:memberError}=await admin.from('conversation_members')
   .select('user_id,muted_until,last_read_at').eq('conversation_id',message.conversation_id);
 if(memberError||!members?.some(m=>m.user_id===message.sender_id))
   return {status:403,result:{error:'Participação indisponível.'}};
 const eligible=members.filter(m=>chatPushShouldNotify(m,message.sender_id,message.created_at));
 if(!eligible.length)return {status:200,result:{attempted:0}};
 const ids=[message.sender_id,...eligible.map(m=>m.user_id)];
 const {data:blocks,error:blocksError}=await admin.from('user_blocks')
   .select('blocker_id,blocked_id').in('blocker_id',ids).in('blocked_id',ids);
 if(blocksError)return {status:503,result:{error:'Falha ao verificar bloqueios.'}};
 const recipients=eligible.filter(m=>!(blocks||[]).some(b=>
   b.blocker_id===message.sender_id&&b.blocked_id===m.user_id||
   b.blocked_id===message.sender_id&&b.blocker_id===m.user_id));
 if(!recipients.length)return {status:200,result:{attempted:0}};
 const {data:subscriptions,error:subscriptionError}=await admin.from('chat_push_subscriptions')
   .select('endpoint_hash,endpoint,p256dh,auth_key,user_id')
   .in('user_id',recipients.map(r=>r.user_id)).limit(110);
 if(subscriptionError)return {status:503,result:{error:'Falha ao consultar dispositivos.'}};
 const {data:mobile,error:mobileError}=await admin.from('mobile_push_devices')
  .select('token_hash,user_id,expo_push_token,platform')
  .in('user_id',recipients.map(r=>r.user_id)).limit(110);
 if(mobileError)return {status:503,result:{error:'Falha ao consultar dispositivos móveis.'}};
 if(!subscriptions?.length&&!mobile?.length)return {status:200,result:{attempted:0}};
 if(!subscriptions?.length&&mobile?.length&&!nativePushDeliveryReady())
   return {status:503,result:{error:'Envio mobile ainda não configurado.'}};
 if(subscriptions?.length){
  try{
   webpush.setVapidDetails(process.env.WEB_PUSH_VAPID_SUBJECT!,
     process.env.WEB_PUSH_VAPID_PUBLIC_KEY!,process.env.WEB_PUSH_VAPID_PRIVATE_KEY!);
  }catch{return {status:503,result:{error:'Configuração VAPID inválida.'}};}
 }
 const {error:claimError}=await admin.from('chat_push_delivery_claims').insert({message_id:message.id});
 if(claimError?.code==='23505')return {status:200,result:{attempted:0,alreadyProcessed:true}};
 if(claimError)return {status:503,result:{error:'Falha ao reservar envio.'}};
 const tasks=await Promise.allSettled((subscriptions||[]).map(async item=>{
   try{
     await webpush.sendNotification({endpoint:item.endpoint,
       keys:{p256dh:item.p256dh,auth:item.auth_key}},CHAT_PUSH_PAYLOAD,
       chatPushDeliveryOptions(item.endpoint));
     return true;
   }catch(e){
     const statusCode=(e as {statusCode?:number}).statusCode;
     if(statusCode===404||statusCode===410)await admin.from('chat_push_subscriptions')
       .delete().eq('endpoint_hash',item.endpoint_hash).eq('user_id',item.user_id);
     return false;
   }
 }));
 const native=mobile?.length&&nativePushDeliveryReady()
  ?await sendMobileChatPush(admin,mobile as NativePushDevice[])
  :{attempted:0,accepted:0};
 const webAccepted=tasks.filter(item=>item.status==='fulfilled'&&item.value).length;
 return {status:200,result:{
  attempted:(subscriptions?.length||0)+native.attempted,
  accepted:webAccepted+native.accepted,
  webAttempted:subscriptions?.length||0,
  mobileAttempted:native.attempted
 }};
}
