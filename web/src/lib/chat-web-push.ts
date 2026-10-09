/** Static, SSRF-safe allowlist of Web Push gateways. User input is untrusted. */
export function allowedChatPushEndpoint(raw:string):boolean{
  if(typeof raw!=='string'||raw.length>4096||raw.length<30)return false;
  try{
    const url=new URL(raw);
    if(url.protocol!=='https:'||url.username||url.password||url.hash||url.port)return false;
    const host=url.hostname.toLowerCase();
    // Microsoft Edge on Windows uses WNS. WNS endpoints contain a token query.
    // Only a single token on the documented /w path is permitted, preventing SSRF.
    if(host==='notify.windows.com'||host.endsWith('.notify.windows.com')){
      if(url.pathname!=='/w'&&url.pathname!=='/w/')return false;
      if(url.searchParams.size!==1||!url.searchParams.has('token'))return false;
      const token=url.searchParams.get('token');
      return typeof token==='string'&&token.length>=16&&token.length<=3072&&
        [...token].every(ch=>'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_+/=-'.includes(ch));
    }
    if(url.search)return false;
    return host==='fcm.googleapis.com'||host==='fcm-xm.googleapis.com'||
      host==='android.googleapis.com'||host==='updates.push.services.mozilla.com'||
      host==='push.services.mozilla.com'||host==='web.push.apple.com'||
      host.endsWith('.push.apple.com');
  }catch{return false;}
}
export function validChatPushKey(raw:unknown):raw is string{
  return typeof raw==='string'&&raw.length>=16&&raw.length<=256&&/^[A-Za-z0-9_-]+$/.test(raw);
}
/** The payload is intentionally content-free: never place private chats or IDs here. */
export const CHAT_PUSH_BODY='Você recebeu uma nova mensagem.';
export const CHAT_PUSH_PAYLOAD=JSON.stringify({kind:'chat'});
export function chatPushShouldNotify(member:{
  user_id:string;muted_until:string|null;last_read_at:string|null
},sender:string,createdAt:string,now=Date.now()):boolean{
  return member.user_id!==sender &&
    (!member.muted_until||Date.parse(member.muted_until)<=now) &&
    (!member.last_read_at||Date.parse(member.last_read_at)<Date.parse(createdAt));
}

/** RFC 8292 VAPID requires an identifiable mailto: or HTTPS contact. */
export function validChatPushSubject(value:string|undefined):boolean{
 if(!value||value.length>512)return false;
 try{
   const url=new URL(value);
   if(url.protocol==='mailto:')return Boolean(url.pathname.includes('@')&&
     !url.search&&!url.hash);
   if(url.protocol==='https:')return Boolean(url.hostname&&!url.username&&!url.password&&
     !url.hash&&!url.search&&!url.port);
   return false;
 }catch{return false;}
}

/** WNS requires raw-notification headers, and rejects the generic Urgency header. */
export function chatPushDeliveryOptions(endpoint:string){
 const host=new URL(endpoint).hostname.toLowerCase();
 const isWns=host==='notify.windows.com'||host.endsWith('.notify.windows.com');
 return isWns?
   {TTL:300,timeout:8000,headers:{'X-WNS-Type':'wns/raw'}}:
   {TTL:300,timeout:8000,urgency:'normal' as const};
}
