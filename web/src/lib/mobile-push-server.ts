import {createClient} from '@supabase/supabase-js';
import {createHash} from 'node:crypto';
import type {NextRequest} from 'next/server';
import {allowedChatPushRequestOrigin} from '@/lib/chat-push-origin';

/** Never expose device tokens through the Data API; only this authenticated backend may see them. */
export const EXPO_PUSH_TOKEN=/^(?:Expo|Exponent)PushToken\[[A-Za-z0-9_-]{12,180}\]$/;
export const NATIVE_PUSH_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const nativePushTokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export function validNativeDevice(input:unknown):{token:string;platform:'android'|'ios'}|null{
 if(!input||typeof input!=='object')return null;
 const data=input as {token?:unknown;platform?:unknown};
 if(typeof data.token!=='string'||!EXPO_PUSH_TOKEN.test(data.token)||
   (data.platform!=='ios'&&data.platform!=='android'))return null;
 return {token:data.token,platform:data.platform};
}
export function nativePushRequestAllowed(request:NextRequest):boolean{
 return allowedChatPushRequestOrigin({
  requestUrl:request.url,origin:request.headers.get('origin'),
  fetchSite:request.headers.get('sec-fetch-site'),
  extraTrustedOrigin:process.env.CHAT_PUSH_PUBLIC_ORIGIN
 });
}
/** Only the server may use the secret key. The identity comes from getUser(JWT), not JSON. */
export async function nativePushContext(request:NextRequest){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const publicKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 const bearer=request.headers.get('authorization')?.match(/^Bearer ([\w.-]+)$/i)?.[1];
 if(!url||!publicKey||!secret||!bearer)return null;
 const auth=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await auth.auth.getUser(bearer);
 if(error||!user||user.is_anonymous)return null;
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:declaration,error:ageError}=await admin.from('registration_age_declarations')
  .select('declared_band').eq('user_id',user.id).maybeSingle();
 if(ageError||declaration?.declared_band!=='18_plus')return null;
 const {data:profile,error:profileError}=await admin.from('profiles')
  .select('id').eq('id',user.id).maybeSingle();
 if(profileError||!profile)return null;
 return {admin,user};
}
export function nativePushDeliveryReady():boolean{
 return Boolean(process.env.EXPO_ACCESS_TOKEN&&
  (process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY));
}
