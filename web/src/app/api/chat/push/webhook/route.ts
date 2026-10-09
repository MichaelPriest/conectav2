import {NextRequest,NextResponse} from 'next/server';
import {chatPushReady} from '@/lib/chat-push-server';
import {deliverChatPush,privilegedChatPushClient} from '@/lib/chat-push-delivery';
import {verifiedChatPushWebhook} from '@/lib/chat-push-signature';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
/** Private, signed, content-free event from Supabase after message transaction commit.
 * Caller may not select recipient or supply message text. This endpoint fails closed.
 */
export async function POST(request:NextRequest){
 if(!chatPushReady())return json({error:'Push indisponível.'},503);
 if(Number(request.headers.get('content-length')||0)>2048)
   return json({error:'Payload muito grande.'},413);
 const payload=await request.json().catch(()=>null);
 if(!verifiedChatPushWebhook(payload,process.env.CHAT_PUSH_WEBHOOK_SECRET))
   return json({error:'Assinatura inválida.'},401);
 const admin=privilegedChatPushClient();
 if(!admin)return json({error:'Push indisponível.'},503);
 const delivered=await deliverChatPush(admin,payload.messageId);
 return json(delivered.result,delivered.status);
}
