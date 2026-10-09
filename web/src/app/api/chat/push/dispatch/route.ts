import {NextRequest,NextResponse} from 'next/server';
import {chatPushContext,chatPushRequestAllowed} from '@/lib/chat-push-server';
import {CHAT_PUSH_UUID,deliverChatPush} from '@/lib/chat-push-delivery';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
/** Authenticated sender fallback; primary DB webhook sends without sender browser. */
export async function POST(request:NextRequest){
 if(!chatPushRequestAllowed(request))return json({error:'Origem inválida.'},403);
 const ctx=await chatPushContext(request);
 if(!ctx)return json({error:'Push indisponível ou sessão inválida.'},401);
 const body=await request.json().catch(()=>null) as {messageId?:unknown}|null;
 if(!body||typeof body.messageId!=='string'||!CHAT_PUSH_UUID.test(body.messageId))
   return json({error:'Mensagem inválida.'},400);
 const delivered=await deliverChatPush(ctx.admin,body.messageId,ctx.user.id);
 return json(delivered.result,delivered.status);
}
