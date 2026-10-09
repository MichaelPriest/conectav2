'use client';
import {FormEvent,useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,ExternalLink,MessageCircle,Send,X,Users,Loader2} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';
import {MentionText} from '@/components/mention-input';
type Thread={id:string;title:string;group:boolean;otherNames:string;lastAt:string};
type Msg={id:string;conversation_id:string;sender_id:string;content:string;created_at:string;media_type:string|null};
export function ChatWidget({userId}:{userId:string}){
 const [open,setOpen]=useState(false),[threads,setThreads]=useState<Thread[]>([]);
 const [active,setActive]=useState<Thread|null>(null),[messages,setMessages]=useState<Msg[]>([]);
 const [text,setText]=useState(''),[loading,setLoading]=useState(false),[sending,setSending]=useState(false);
 const [error,setError]=useState('');
 const end=useRef<HTMLDivElement>(null);
 useEffect(()=>{
   try{setOpen(localStorage.getItem('conecta-chat-widget-open')==='1');}catch{}
 },[]);
 function toggle(next:boolean){
   setOpen(next);
   try{localStorage.setItem('conecta-chat-widget-open',next?'1':'0');}catch{}
 }
 const loadThreads=useCallback(async()=>{
   const db=supabaseBrowser();
   const {data:own,error:e}=await db.from('conversation_members').select('conversation_id').eq('user_id',userId).limit(150);
   if(e){setError(e.message);return;}
   const ids=[...new Set((own||[]).map(m=>m.conversation_id))];if(!ids.length){setThreads([]);return;}
   const [conversations,members]=await Promise.all([
     db.from('conversations').select('id,title,created_at').in('id',ids).limit(150),
     db.from('conversation_members').select('conversation_id,user_id').in('conversation_id',ids).limit(600)
   ]);
   if(conversations.error||members.error){setError(conversations.error?.message||members.error?.message||'Falha ao carregar conversas.');return;}
   const otherIds=[...new Set((members.data||[]).filter(m=>m.user_id!==userId).map(m=>m.user_id))];
   const people=otherIds.length?await db.from('profiles').select('id,display_name').in('id',otherIds):{data:[],error:null};
   const names=new Map((people.data||[]).map(p=>[p.id,p.display_name]));
   const list:Thread[]=(conversations.data||[]).map(c=>{
     const participants=(members.data||[]).filter(m=>m.conversation_id===c.id&&m.user_id!==userId);
     const group=participants.length>1;
     const otherNames=participants.map(p=>names.get(p.user_id)||'Conexão').join(', ');
     return {id:c.id,title:group?(c.title||'Grupo'):(otherNames||c.title||'Conversa'),group,otherNames,lastAt:c.created_at};
   });
   setThreads(list.sort((a,b)=>b.lastAt.localeCompare(a.lastAt)));
 },[userId]);
 const loadMessages=useCallback(async(conversationId:string)=>{
   const {data,error:e}=await supabaseBrowser().from('messages')
     .select('id,conversation_id,sender_id,content,created_at,media_type')
     .eq('conversation_id',conversationId).order('created_at',{ascending:false}).limit(50);
   if(e)setError(e.message);else setMessages([...(data||[])].reverse());
 },[]);
 useEffect(()=>{if(open)void loadThreads();},[open,loadThreads]);
 useEffect(()=>{
   if(!open||!active)return;
   let live=true;setLoading(true);
   void loadMessages(active.id).finally(()=>{if(live)setLoading(false);});
   const db=supabaseBrowser();
   const channel=db.channel('conecta-widget-'+active.id)
     .on('postgres_changes',{schema:'public',table:'messages',event:'INSERT',filter:'conversation_id=eq.'+active.id},
       ()=>{void loadMessages(active.id);}).subscribe();
   return()=>{live=false;void db.removeChannel(channel);};
 },[active,open,loadMessages]);
 useEffect(()=>{if(open&&active)end.current?.scrollIntoView({block:'end'});},[open,active,messages.length]);
 async function send(e:FormEvent){
   e.preventDefault();if(!active||sending||!text.trim())return;
   const content=text.trim();setSending(true);setError('');
   const {error:e2}=await supabaseBrowser().from('messages').insert({
     conversation_id:active.id,sender_id:userId,content
   });
   if(e2)setError(e2.message);else{setText('');await loadMessages(active.id);}
   setSending(false);
 }
 return <div className="conecta-floating-chat">
   {!open?<button className="conecta-chat-fab" type="button" onClick={()=>toggle(true)} aria-label="Abrir chat flutuante" title="Abrir conversas">
     <MessageCircle size={23}/><span>Chat</span></button>:
   <section className="conecta-chat-widget" aria-label="Chat flutuante">
     <header><button type="button" className="icon-btn" aria-label="Voltar às conversas" disabled={!active} onClick={()=>{setActive(null);setMessages([]);}}>{active?<ArrowLeft size={19}/>:<MessageCircle size={19}/>}</button>
       <strong>{active?active.title:'Conversas'}</strong>
       <Link href="/mensagens" aria-label="Abrir todas as mensagens" title="Abrir mensagens"><ExternalLink size={18}/></Link>
       <button className="icon-btn" type="button" aria-label="Fechar chat" onClick={()=>toggle(false)}><X size={20}/></button>
     </header>
     {!active?<div className="conecta-chat-widget-list">
       {threads.length===0?<div className="conecta-widget-empty"><MessageCircle size={26}/><p>Suas conversas aparecem aqui.</p><Link href="/mensagens">Iniciar conversa</Link></div>:
         threads.map(t=><button key={t.id} type="button" onClick={()=>{setActive(t);setError('');}}><span className="conecta-widget-thread-icon">{t.group?<Users size={19}/>:<MessageCircle size={19}/>}</span>
           <span><strong>{t.title}</strong><small>{t.group?t.otherNames:'Abrir conversa'}</small></span></button>)}
       <Link className="conecta-widget-new" href="/mensagens">Nova conversa ou grupo <ExternalLink size={14}/></Link>
     </div>:
       <><div className="conecta-chat-widget-log" role="log" aria-live="polite">
         {loading&&<span className="small-note">Carregando...</span>}
         {!loading&&messages.length===0&&<p className="small-note">Conversa sem mensagens.</p>}
         {messages.map(m=><div key={m.id} className={'conecta-widget-message '+(m.sender_id===userId?'own':'')}>
           {m.content?<p><MentionText text={m.content}/></p>:null}
           {m.media_type&&<small>Anexo {m.media_type==='image'?'📷':m.media_type==='video'?'🎬':'🎤'} · <Link href="/mensagens">abrir no chat</Link></small>}
         </div>)}
         <div ref={end}/>
       </div>
       <form onSubmit={send} className="conecta-widget-compose"><input aria-label="Escrever no chat flutuante" maxLength={4000} value={text} onChange={e=>setText(e.target.value)} placeholder="Sua mensagem..."/>
         <button type="submit" disabled={sending||!text.trim()} aria-label="Enviar mensagem">{sending?<Loader2 size={19} className="spin"/>:<Send size={19}/>}</button></form></>}
     {error&&<p className="form-error" role="alert">{error}</p>}
   </section>}
 </div>;
}
