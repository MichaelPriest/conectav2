import type {SupabaseClient} from '@supabase/supabase-js';
import {nativePushDeliveryReady} from '@/lib/mobile-push-server';

export type NativePushDevice={
 token_hash:string;user_id:string;expo_push_token:string;platform:'android'|'ios'
};
export type MobilePushResult={attempted:number;accepted:number};

/** No message body, sender profile or conversation metadata leaves the backend. */
export async function sendMobileChatPush(
 admin:SupabaseClient,devices:NativePushDevice[]
):Promise<MobilePushResult>{
 if(!devices.length)return {attempted:0,accepted:0};
 if(!nativePushDeliveryReady())throw new Error('Mobile push credentials missing');
 let accepted=0;
 for(let offset=0;offset<devices.length;offset+=50){
  const batch=devices.slice(offset,offset+50);
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),6000);
  try{
   const response=await fetch('https://exp.host/--/api/v2/push/send',{
    method:'POST',signal:controller.signal,
    headers:{
     'Content-Type':'application/json',
     'Accept':'application/json',
     'Authorization':'Bearer '+process.env.EXPO_ACCESS_TOKEN!
    },
    body:JSON.stringify(batch.map(item=>({
     to:item.expo_push_token,
     title:'Conecta',
     body:'Você tem uma nova mensagem.',
     sound:null,
     channelId:'conecta-social',
     priority:'normal',
     ttl:3600,
     data:{kind:'native-chat'}
    })))
   });
   if(!response.ok)continue;
   const payload=await response.json().catch(()=>null) as {
    data?:Array<{status?:string;details?:{error?:string}}> }|null;
   if(!Array.isArray(payload?.data)||payload.data.length!==batch.length)continue;
   for(let i=0;i<batch.length;i++){
    const ticket=payload.data[i];
    if(ticket?.status==='ok'){accepted++;continue;}
    if(ticket?.details?.error==='DeviceNotRegistered'){
     await admin.from('mobile_push_devices').delete()
      .eq('token_hash',batch[i].token_hash).eq('user_id',batch[i].user_id);
    }
   }
  }catch{/* Remote service outage: no user content was sent or logged. */}
  finally{clearTimeout(timeout);}
 }
 return {attempted:devices.length,accepted};
}
