'use strict';
// Startup-only diagnostic: reports boolean states, never secret values or message data.
const {createECDH}=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');

function validVapidPair(publicKey,privateKey){
  try{
    if(!publicKey||!privateKey)return false;
    const decode=value=>Buffer.from(value.replace(/-/g,'+').replace(/_/g,'/'),'base64');
    const ecdh=createECDH('prime256v1');
    ecdh.setPrivateKey(decode(privateKey));
    return ecdh.getPublicKey().equals(decode(publicKey));
  }catch{return false;}
}
async function inspect(){
  const env=process.env;
  const key=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;
  const pairValid=validVapidPair(env.WEB_PUSH_VAPID_PUBLIC_KEY,env.WEB_PUSH_VAPID_PRIVATE_KEY);
  const subjectValid=Boolean(env.WEB_PUSH_VAPID_SUBJECT&&
    (env.WEB_PUSH_VAPID_SUBJECT.startsWith('mailto:')||env.WEB_PUSH_VAPID_SUBJECT.startsWith('https://')));
  let databaseAccess='not_configured';
  if(env.NEXT_PUBLIC_SUPABASE_URL&&key){
    databaseAccess='unverified';
    try{
      const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,key,{
        auth:{persistSession:false,autoRefreshToken:false}
      });
      // Bounded API probe; cancel the timer so it never delays Next.js startup.
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),5000);
      try{
        const result=await db.from('chat_push_subscriptions')
          .select('endpoint_hash',{count:'exact',head:true})
          .abortSignal(controller.signal);
        databaseAccess=result.error?'unavailable':'verified';
      }finally{clearTimeout(timer);}
    }catch{databaseAccess='unavailable';}
  }
  console.info('[conecta-chat-push] '+JSON.stringify({
    vapidPairValid:pairValid,
    subjectConfigured:subjectValid,
    adminCredentialConfigured:Boolean(key),
    adminDatabaseAccess:databaseAccess,
    webhookSecretConfigured:Boolean(env.CHAT_PUSH_WEBHOOK_SECRET&&env.CHAT_PUSH_WEBHOOK_SECRET.length>=32)
  }));
}
inspect().catch(()=>console.info('[conecta-chat-push] diagnostic_unavailable'));
