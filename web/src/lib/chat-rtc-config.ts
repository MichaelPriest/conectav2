import {supabaseBrowser} from '@/lib/supabase/browser';

const fallbackIceServers:RTCIceServer[]=[
 {urls:['stun:stun.cloudflare.com:3478','stun:stun.l.google.com:19302']}
];

/** Fetches expiring TURN credentials from the authenticated server endpoint.
 * If TURN is not configured, calls continue with STUN only.
 */
export async function getChatRtcConfiguration():Promise<RTCConfiguration>{
 try{
  const db=supabaseBrowser();
  const {data:{session}}=await db.auth.getSession();
  if(!session?.access_token)return {iceServers:fallbackIceServers};
  const response=await fetch('/api/chat/turn-credentials',{
   method:'GET',
   headers:{Authorization:'Bearer '+session.access_token},
   cache:'no-store',
   credentials:'same-origin'
  });
  if(!response.ok)return {iceServers:fallbackIceServers};
  const payload=await response.json() as {iceServers?:RTCIceServer[]};
  const turn=(payload.iceServers||[]).filter(server=>{
   const urls=Array.isArray(server.urls)?server.urls:[server.urls];
   return urls.some(url=>typeof url==='string'&&/^turns?:/i.test(url));
  });
  return {iceServers:[...fallbackIceServers,...turn]};
 }catch{
  return {iceServers:fallbackIceServers};
 }
}
