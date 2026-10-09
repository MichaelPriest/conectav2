'use client';
import {useEffect,useState} from 'react';
import {BellRing} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';

type PushState='checking'|'unsupported'|'unconfigured'|'inactive'|'active'|'busy'|'error';
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
  const registration=await navigator.serviceWorker.register('/sw-chat-push.js',{scope:'/'});
  if(!registration.active)await navigator.serviceWorker.ready;
  return registration;
}
function friendlyPushError(value:unknown):string{
 const fallback=value instanceof Error?value.message:'Não foi possível ativar notificações.';
 if(/NotAllowedError|permission denied|blocked/i.test(fallback))
   return 'O navegador bloqueou as notificações. Abra o cadeado ao lado do endereço do Conecta, permita notificações e tente novamente.';
 if(/AbortError|NetworkError|Failed to fetch|network/i.test(fallback))
   return 'Falha na comunicação com o navegador ou servidor Push. Verifique a conexão e tente novamente.';
 return fallback;
}
function matchesVapidKey(subscription:PushSubscription,key:string):boolean{
 const actual=subscription.options.applicationServerKey;
 if(!actual)return true;
 const expected=new Uint8Array(vapidBytes(key));
 const present=new Uint8Array(actual);
 return expected.length===present.length&&expected.every((v,i)=>v===present[i]);
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
      body:JSON.stringify({messageId}),cache:'no-store',keepalive:true});
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
        if(!res.ok||!config.enabled||!config.publicKey){
          setError('O servidor ainda não liberou o Web Push neste domínio.');
          setState('unconfigured');return;
        }
        setPublicKey(config.publicKey);
        const existing=await navigator.serviceWorker.getRegistration('/');
        const current=await existing?.pushManager.getSubscription();
        if(!current){if(live)setState('inactive');return;}
        const token=await bearer();
        const status=await fetch('/api/chat/push/subscription?endpoint='+encodeURIComponent(current.endpoint),{
          headers:{Authorization:'Bearer '+token},cache:'no-store'
        });
        if(!status.ok)throw new Error('Não foi possível verificar este dispositivo.');
        const result=await status.json() as {enabled?:boolean};
        if(live)setState(result.enabled?'active':'inactive');
      }catch(e){if(live){setError(friendlyPushError(e));setState('error');}}
    }
    void inspect();
    return()=>{live=false;};
  },[]);
  async function toggle(){
    if(state!=='inactive'&&state!=='active'&&state!=='error')return;
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
      let existing=await registration.pushManager.getSubscription();
      if(existing&&!matchesVapidKey(existing,publicKey)){
        await existing.unsubscribe();existing=null;
      }
      const subscription=existing||await registration.pushManager.subscribe({
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
    }catch(e){setError(friendlyPushError(e));
      setState(deactivating?'active':'inactive');}
  }
  const [testBusy,setTestBusy]=useState(false);
  const [info,setInfo]=useState('');
  async function testPush(){
    if(state!=='active'||testBusy)return;
    setTestBusy(true);setError('');setInfo('');
    try{
      const registration=await navigator.serviceWorker.getRegistration('/');
      const subscription=await registration?.pushManager.getSubscription();
      if(!subscription)throw new Error('Não existe inscrição Push neste dispositivo.');
      const res=await fetch('/api/chat/push/test',{method:'POST',
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+await bearer()},
        body:JSON.stringify({endpoint:subscription.endpoint}),cache:'no-store'});
      const result=await res.json().catch(()=>({})) as {accepted?:boolean;error?:string};
      if(!res.ok||!result.accepted)throw new Error(result.error||'O gateway rejeitou o aviso de teste.');
      setInfo('Teste enviado ao seu navegador. Verifique as notificações do sistema.');
    }catch(e){setError(friendlyPushError(e));}
    finally{setTestBusy(false);}
  }
  const labels:{[key in PushState]:string}={
    checking:'Verificando Web Push',unsupported:'Push indisponível neste navegador',
    unconfigured:'Push indisponível no servidor',error:'Tentar ativar Push',
    inactive:'Ativar Push',active:'Push ativado',busy:'Atualizando Push'
  };
  return <span className="conecta-chat-push-control">
    <button className="conecta-chat-push-trigger" type="button" title={labels[state]}
      aria-label={state==='active'?'Desativar notificações Push':labels[state]}
      disabled={state==='checking'||state==='unsupported'||state==='unconfigured'||state==='busy'}
      onClick={()=>void toggle()}>
      <BellRing size={17} fill={state==='active'?'currentColor':'none'}/>
      <span>{labels[state]}</span>
    </button>
    {state==='active'&&<button className="conecta-chat-push-test" type="button"
      disabled={testBusy} onClick={()=>void testPush()}
      aria-label="Enviar notificação de teste a este dispositivo">{testBusy?'Enviando…':'Testar'}</button>}
    {(error||info||state==='unsupported')&&<small className="conecta-chat-push-feedback"
      role={error?'alert':'status'}>{error||info||(window.isSecureContext?
      'Este navegador não suporta Push.':'Use o Conecta por HTTPS.')}</small>}
  </span>;
}
