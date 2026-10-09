import {createClient} from '@supabase/supabase-js';
import type {NextRequest} from 'next/server';
import {createHash} from 'node:crypto';
import {allowedChatPushEndpoint,validChatPushKey,validChatPushSubject} from '@/lib/chat-web-push';

export function chatPushReady():boolean{
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    (process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY &&
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY &&
    validChatPushSubject(process.env.WEB_PUSH_VAPID_SUBJECT));
}
export function chatPushPublicKey(){return chatPushReady()?process.env.WEB_PUSH_VAPID_PUBLIC_KEY!:null;}
export function chatPushEndpointHash(endpoint:string){
  return createHash('sha256').update(endpoint).digest('hex');
}
export function chatPushRequestAllowed(request:NextRequest):boolean{
  const origin=request.headers.get('origin');
  return !origin||origin===new URL(request.url).origin;
}
export async function chatPushContext(request:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token=request.headers.get('authorization')?.match(/^Bearer ([\w.-]+)$/i)?.[1];
  if(!chatPushReady()||!url||!publicKey||!secret||!token)return null;
  const auth=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error}=await auth.auth.getUser(token);
  if(error||!user||user.is_anonymous)return null;
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  return {admin,user};
}
export function validateChatPushSubscription(body:unknown){
  if(!body||typeof body!=='object')return null;
  const value=body as {endpoint?:unknown;keys?:{p256dh?:unknown;auth?:unknown}};
  if(typeof value.endpoint!=='string'||!allowedChatPushEndpoint(value.endpoint)||
     !validChatPushKey(value.keys?.p256dh)||!validChatPushKey(value.keys?.auth))return null;
  return {endpoint:value.endpoint,p256dh:value.keys.p256dh,auth_key:value.keys.auth};
}
