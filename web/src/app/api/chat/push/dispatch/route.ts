import {NextRequest,NextResponse} from 'next/server';
import webpush from 'web-push';
import {chatPushContext,chatPushRequestAllowed} from '@/lib/chat-push-server';
import {CHAT_PUSH_PAYLOAD,chatPushShouldNotify} from '@/lib/chat-web-push';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Called only by an authenticated sender after a successful message INSERT.
 * The receiver's browser may be closed. Message content is never sent to a push provider.
 * No public endpoint can send arbitrary notifications or choose the recipient.
 */
export async function POST(request:NextRequest){
  if(!chatPushRequestAllowed(request))return json({error:'Origem inválida.'},403);
  const ctx=await chatPushContext(request);
  if(!ctx)return json({error:'Push indisponível ou sessão inválida.'},401);
  const body=await request.json().catch(()=>null) as {messageId?:unknown}|null;
  if(!body||typeof body.messageId!=='string'||!UUID.test(body.messageId))
    return json({error:'Mensagem inválida.'},400);
  const {data:message,error:messageError}=await ctx.admin.from('messages')
    .select('id,sender_id,conversation_id,created_at,deleted_at')
    .eq('id',body.messageId).eq('sender_id',ctx.user.id).maybeSingle();
  if(messageError||!message)return json({error:'Mensagem indisponível.'},404);
  if(message.deleted_at||!Number.isFinite(Date.parse(message.created_at))||
    Date.now()-Date.parse(message.created_at)>5*60_000 ||
    Date.parse(message.created_at)>Date.now()+60_000)return json({error:'Mensagem fora do período de aviso.'},409);
  const {data:members,error:memberError}=await ctx.admin.from('conversation_members')
    .select('user_id,muted_until,last_read_at').eq('conversation_id',message.conversation_id);
  if(memberError||!members?.some(m=>m.user_id===ctx.user.id))
    return json({error:'Sem acesso à conversa.'},403);
  const eligible=members.filter(m=>chatPushShouldNotify(m,ctx.user.id,message.created_at));
  if(!eligible.length)return json({queued:0});
  const ids=[ctx.user.id,...eligible.map(m=>m.user_id)];
  const {data:blocks,error:blocksError}=await ctx.admin.from('user_blocks')
    .select('blocker_id,blocked_id').in('blocker_id',ids).in('blocked_id',ids);
  if(blocksError)return json({error:'Não foi possível verificar bloqueios.'},503);
  const recipients=eligible.filter(m=>!(blocks||[]).some(b=>
    (b.blocker_id===ctx.user.id&&b.blocked_id===m.user_id)||
    (b.blocked_id===ctx.user.id&&b.blocker_id===m.user_id)));
  if(!recipients.length)return json({queued:0});
  const {data:subscriptions,error:subscriptionError}=await ctx.admin
    .from('chat_push_subscriptions').select('endpoint_hash,endpoint,p256dh,auth_key,user_id')
    .in('user_id',recipients.map(r=>r.user_id)).limit(110);
  if(subscriptionError)return json({error:'Assinaturas indisponíveis.'},503);
  if(!subscriptions?.length)return json({queued:0});
  // DB primary key makes replaying a message idempotent even with concurrent tabs.
  const {error:claimError}=await ctx.admin.from('chat_push_delivery_claims')
    .insert({message_id:message.id});
  if(claimError?.code==='23505')return json({queued:0,alreadyProcessed:true});
  if(claimError)return json({error:'Não foi possível registrar o envio.'},503);
  try{
    webpush.setVapidDetails(process.env.WEB_PUSH_VAPID_SUBJECT!,
      process.env.WEB_PUSH_VAPID_PUBLIC_KEY!,process.env.WEB_PUSH_VAPID_PRIVATE_KEY!);
  }catch{return json({error:'Configuração VAPID inválida.'},503);}
  const tasks=await Promise.allSettled(subscriptions.map(async item=>{
    try{
      await webpush.sendNotification({endpoint:item.endpoint,
        keys:{p256dh:item.p256dh,auth:item.auth_key}},CHAT_PUSH_PAYLOAD,
        {TTL:300,urgency:'normal',timeout:4500});
      return true;
    }catch(e){
      const code=(e as {statusCode?:number}).statusCode;
      if(code===404||code===410)await ctx.admin.from('chat_push_subscriptions')
        .delete().eq('endpoint_hash',item.endpoint_hash).eq('user_id',item.user_id);
      return false;
    }
  }));
  return json({attempted:subscriptions.length,
    accepted:tasks.filter(t=>t.status==='fulfilled'&&t.value===true).length});
}
