import {createHmac,timingSafeEqual} from 'node:crypto';
import {CHAT_PUSH_UUID} from '@/lib/chat-push-delivery';
type Incoming={messageId?:unknown;issuedAt?:unknown;signature?:unknown};
/** Constant-time HMAC over a 2 minute window. The secret never enters pg_net's queue. */
export function verifiedChatPushWebhook(value:Incoming|null,secret:string|undefined,
  now=Math.floor(Date.now()/1000)):value is {messageId:string;issuedAt:number;signature:string}{
 if(!secret||secret.length<32||!value||
   typeof value.messageId!=='string'||!CHAT_PUSH_UUID.test(value.messageId)||
   typeof value.issuedAt!=='number'||!Number.isSafeInteger(value.issuedAt)||
   Math.abs(now-value.issuedAt)>120||
   typeof value.signature!=='string'||!/^[a-f0-9]{64}$/.test(value.signature))return false;
 const mac=createHmac('sha256',secret)
   .update(value.messageId+'.'+value.issuedAt).digest();
 return timingSafeEqual(mac,Buffer.from(value.signature,'hex'));
}
