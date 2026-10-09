/** Static, SSRF-safe allowlist of Web Push gateways. User input is untrusted. */
export function allowedChatPushEndpoint(raw:string):boolean{
  if(typeof raw!=='string'||raw.length>2048||raw.length<30)return false;
  try{
    const url=new URL(raw);
    if(url.protocol!=='https:'||url.username||url.password||url.hash||url.search||url.port)return false;
    const host=url.hostname.toLowerCase();
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
