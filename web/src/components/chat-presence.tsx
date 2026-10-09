'use client';
import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import {Eye,EyeOff} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';

const WINDOW_MS=90_000;
const REFRESH_MS=25_000;
const preferenceKey=(userId:string)=>'conecta-chat-show-online:'+userId;
type ChatPresenceValue={
 onlineIds:ReadonlySet<string>;
 enabled:boolean;
 ready:boolean;
 busy:boolean;
 error:string;
 change:()=>Promise<void>;
};
const PresenceContext=createContext<ChatPresenceValue|null>(null);

export function ChatPresenceProvider({
 userId,children
}:{userId:string;children:React.ReactNode}){
 const [ready,setReady]=useState(false);
 const [enabled,setEnabled]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [online,setOnline]=useState<string[]>([]);

 useEffect(()=>{
   setReady(false);
   try{setEnabled(localStorage.getItem(preferenceKey(userId))==='1');}
   catch{setEnabled(false);}
   setReady(true);
   const onStorage=(event:StorageEvent)=>{
     if(event.key===preferenceKey(userId))setEnabled(event.newValue==='1');
   };
   window.addEventListener('storage',onStorage);
   return()=>window.removeEventListener('storage',onStorage);
 },[userId]);

 useEffect(()=>{
   if(!ready)return;
   const db=supabaseBrowser();
   let alive=true;
   let inFlight=false;
   const refresh=async()=>{
     if(!alive||document.hidden||inFlight)return;
     inFlight=true;
     try{
       if(enabled){
         const {error:touchError}=await db.rpc('touch_chat_presence');
         if(touchError)throw touchError;
       }
       const cutoff=new Date(Date.now()-WINDOW_MS).toISOString();
       const {data,error:readError}=await db.from('chat_user_presence')
         .select('user_id,last_seen_at').gte('last_seen_at',cutoff).limit(400);
       if(readError)throw readError;
       if(alive){setOnline((data||[]).filter(p=>Date.parse(p.last_seen_at)>Date.now()-WINDOW_MS)
         .map(p=>p.user_id));setError('');}
     }catch(e){
       if(alive){setOnline([]);setError('Presença indisponível no momento.');}
     }finally{inFlight=false;}
   };
   void refresh();
   const onFocus=()=>{void refresh();};
   const timer=window.setInterval(()=>{void refresh();},REFRESH_MS);
   window.addEventListener('focus',onFocus);
   document.addEventListener('visibilitychange',onFocus);
   return()=>{
     alive=false;window.clearInterval(timer);
     window.removeEventListener('focus',onFocus);
     document.removeEventListener('visibilitychange',onFocus);
   };
 },[userId,ready,enabled]);

 async function change(){
   if(!ready||busy)return;
   setBusy(true);setError('');
   const next=!enabled;
   try{
     const db=supabaseBrowser();
     if(next){
       const {error:e}=await db.rpc('touch_chat_presence');
       if(e)throw e;
     }else{
       const {error:e}=await db.from('chat_user_presence').delete().eq('user_id',userId);
       if(e)throw e;
     }
     try{localStorage.setItem(preferenceKey(userId),next?'1':'0');}catch{}
     setEnabled(next);
   }catch{
     setError('Não foi possível alterar sua presença. Tente novamente.');
   }finally{setBusy(false);}
 }
 const value=useMemo<ChatPresenceValue>(()=>({
   onlineIds:new Set(online),enabled,ready,busy,error,change
 }),[online,enabled,ready,busy,error]);
 return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}
export function ChatOnlineStatus({userId,showText=false}:{
 userId:string|null|undefined;showText?:boolean
}){
 const ctx=useContext(PresenceContext);
 const isOnline=Boolean(userId&&ctx?.onlineIds.has(userId));
 if(!ctx||!isOnline)return null;
 return <span className="conecta-online-indicator" aria-label="Online agora" title="Online agora">
   <span className="conecta-online-dot"/>{showText&&<span>Online</span>}
 </span>;
}
export function ChatPresenceToggle(){
 const ctx=useContext(PresenceContext);
 if(!ctx)return null;
 return <span className="conecta-presence-settings">
   <button type="button" className="conecta-presence-toggle"
     disabled={!ctx.ready||ctx.busy}
     onClick={()=>void ctx.change()}
     aria-pressed={ctx.enabled}
     title={ctx.enabled?'Ocultar meu status online':'Permitir que conexões vejam quando estou online'}>
     {ctx.enabled?<Eye size={15}/>:<EyeOff size={15}/>}
     <span>{ctx.enabled?'Online visível':'Mostrar online'}</span>
   </button>
   {ctx.error&&<small className="conecta-presence-error" role="alert">{ctx.error}</small>}
 </span>;
}
