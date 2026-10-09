'use client';
import {useEffect,useState} from 'react';
import {BellRing} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';

type PushState='checking'|'unsupported'|'unconfigured'|'inactive'|'active'|'busy';
async function bearer(){
  const {data:{session}}=await supabaseBrowser().auth.getSession();
  if(!session?.access_token)throw new Error('Sua sessão expirou.');
  return session.access_token;
}
function vapidBytes(key:string):ArrayBuffer{
  const b64=key.replace(/-/g,'+').replace(/_/g,'/');
  const binary=atob(b64.padEnd(Math.ceil(b64.length/4)*4,'='));
  const array=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)array[i]=binary.charCodeAt(i);
  return array.buffer;
}
async function deviceRegistration(){
  return navigator.serviceWorker.register('/sw-chat-push.js',{scope:'/'});
}
/** Called before sign-out: no push from the previous account remains on this device. */
export async function disableChatPushDevice(){
  if(!('serviceWorker'in navigator)||!('PushManager'in window))return;
  const reg=await navigator.serviceWorker.getRegistration('/');
  const subscription=await reg?.pushManager.getSubscription();
  if(!subscription)return;
  try{
    await fetch('/api/chat/push/subscription',{method:'DELETE',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+await bearer()},
      body:JSON.stringify({endpoint:subscription.endpoint}),cache:'no-store'});
  }finally{await subscription.unsubscribe();}
}
/** Dispatch is best-effort and does not change success of the DB message write. */
export async function notifyChatMessageSent(messageId:string){
  try{
    await fetch('/api/chat/push/dispatch',{method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+await bearer()},
      body:JSON.stringify({messageId}),cache:'no-store'});
  }catch{/* Message delivery is independent from push delivery. */}
}
export function ChatPushControl(){
  const [state,setState]=useState<PushState>('checking');
  const [publicKey,setPublicKey]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>{
    let live=true;
    async function inspect(){
      if(!window.isSecureContext||!('serviceWorker'in navigator)||
        !('PushManager'in window)||!('Notification'in window)){
        if(live)setState('unsupported');return;
      }
      try{
        const res=await fetch('/api/chat/push/config',{cache:'no-store'});
        const config=await res.json() as {enabled?:boolean;publicKey?:string};
        if(!live)return;
        if(!res.ok||!config.enabled||!config.publicKey){setState('unconfigured');return;}
        setPublicKey(config.publicKey);
        const existing=await navigator.serviceWorker.getRegistration('/');
        const current=await existing?.pushManager.getSubscription();
        if(live)setState(current?'active':'inactive');
      }catch{if(live)setState('unconfigured');}
    }
    void inspect();
    return()=>{live=false;};
  },[]);
  async function toggle(){
    if(state!=='inactive'&&state!=='active')return;
    const deactivating=state==='active';
    setState('busy');setError('');
    try{
      if(deactivating){
        await disableChatPushDevice();
        setState('inactive');return;
      }
      if(Notification.permission==='denied')throw new Error('Notificações bloqueadas nas configurações do navegador.');
      const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
      if(permission!=='granted')throw new Error('Permissão não concedida.');
      const registration=await deviceRegistration();
      const subscription=await registration.pushManager.subscribe({
        userVisibleOnly:true,applicationServerKey:vapidBytes(publicKey)
      });
      const res=await fetch('/api/chat/push/subscription',{method:'POST',
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+await bearer()},
        body:JSON.stringify(subscription.toJSON()),cache:'no-store'});
      if(!res.ok){
        await subscription.unsubscribe();
        const response=await res.json().catch(()=>({})) as {error?:string};
        throw new Error(response.error||'Falha ao registrar o dispositivo.');
      }
      setState('active');
    }catch(e){setError(e instanceof Error?e.message:'Falha ao alterar notificações.');
      setState(deactivating?'active':'inactive');}
  }
  const labels:{[key in PushState]:string}={
    checking:'Verificando Web Push',unsupported:'Web Push indisponível neste navegador',
    unconfigured:'Web Push aguardando configuração gratuita no servidor',
    inactive:'Ativar push com navegador fechado',active:'Desativar push neste dispositivo',
    busy:'Atualizando notificações'
  };
  return <span className="conecta-chat-push-control">
    <button className="icon-btn" type="button" title={labels[state]}
      aria-label={labels[state]} disabled={state==='checking'||state==='unsupported'||state==='unconfigured'||state==='busy'}
      onClick={()=>void toggle()}><BellRing size={18} fill={state==='active'?'currentColor':'none'}/></button>
    {error&&<small className="conecta-chat-push-error" role="alert">{error}</small>}
  </span>;
}
