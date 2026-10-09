'use client';
import {FormEvent,useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,ExternalLink,MessageCircle,Send,X,Users,Loader2,BellOff,Bell} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';
import {MentionText} from '@/components/mention-input';
import {ReportContentButton} from '@/components/report-content-button';
import {useChatTyping} from '@/lib/use-chat-typing';
import {ProfileAvatar} from '@/components/profile-avatar';
type Thread={id:string;title:string;group:boolean;otherNames:string;otherId:string|null;other:Contact|null;lastAt:string;unread:number;preview:string;mutedUntil:string|null};
type Contact={id:string;handle:string;display_name:string;avatar_path:string|null};
type Msg={id:string;conversation_id:string;sender_id:string;content:string;created_at:string;media_type:string|null;edited_at:string|null;deleted_at:string|null};
export function ChatWidget({userId}:{userId:string}){
 const [open,setOpen]=useState(false),[threads,setThreads]=useState<Thread[]>([]);
 const [active,setActive]=useState<Thread|null>(null),[messages,setMessages]=useState<Msg[]>([]);
 const [text,setText]=useState(''),[loading,setLoading]=useState(false),[sending,setSending]=useState(false);
 const [error,setError]=useState('');
 const [totalUnread,setTotalUnread]=useState(0);
 const [contacts,setContacts]=useState<Contact[]>([]);
 const [contactSearch,setContactSearch]=useState('');
 const [starting,setStarting]=useState<string|null>(null);
 const [alertsEnabled,setAlertsEnabled]=useState(false);
 const alertsEnabledRef=useRef(false);
 const mutedRoomsRef=useRef<Set<string>>(new Set());
 const lastAlertedRef=useRef<string|null>(null);
 const end=useRef<HTMLDivElement>(null);
 const typingIds=useChatTyping(open&&active?active.id:null,userId,text,open&&Boolean(active));
 useEffect(()=>{
   try{
     setOpen(localStorage.getItem('conecta-chat-widget-open')==='1');
     const permitted=typeof Notification!=='undefined'&&Notification.permission==='granted';
     const enabled=permitted&&localStorage.getItem('conecta-chat-browser-alerts')==='1';
     setAlertsEnabled(enabled);alertsEnabledRef.current=enabled;
   }catch{}
 },[]);
 async function toggleBrowserAlerts(){
   if(alertsEnabled){
     alertsEnabledRef.current=false;setAlertsEnabled(false);
     try{localStorage.setItem('conecta-chat-browser-alerts','0');}catch{}
     return;
   }
   if(typeof Notification==='undefined'){
     setError('Este navegador não suporta notificações locais.');return;
   }
   const permission=Notification.permission==='granted'?'granted':
     await Notification.requestPermission();
   if(permission!=='granted'){
     setError('Permissão de notificações não concedida.');return;
   }
   alertsEnabledRef.current=true;setAlertsEnabled(true);
   try{localStorage.setItem('conecta-chat-browser-alerts','1');}catch{}
 }
 function toggle(next:boolean){
   setOpen(next);
   try{localStorage.setItem('conecta-chat-widget-open',next?'1':'0');}catch{}
 }
 const loadContacts=useCallback(async()=>{
   const db=supabaseBrowser();
   const {data:links,error:e}=await db.from('friendships').select('requester_id,addressee_id')
     .eq('status','accepted')
     .or('requester_id.eq.'+userId+',addressee_id.eq.'+userId);
   if(e){setError(e.message);return;}
   const ids=[...new Set((links||[]).map(link=>
     link.requester_id===userId?link.addressee_id:link.requester_id))];
   if(!ids.length){setContacts([]);return;}
   const {data,error:profilesError}=await db.from('profiles')
     .select('id,handle,display_name,avatar_path').in('id',ids);
   if(profilesError){setError(profilesError.message);return;}
   setContacts(((data||[]) as Contact[]).sort((a,b)=>
     a.display_name.localeCompare(b.display_name,'pt-BR')));
 },[userId]);
 const loadThreads=useCallback(async()=>{
   const db=supabaseBrowser();
   const {data:own,error:e}=await db.from('conversation_members').select('conversation_id,muted_until').eq('user_id',userId).limit(150);
   if(e){setError(e.message);return;}
   const ids=[...new Set((own||[]).map(m=>m.conversation_id))];if(!ids.length){setThreads([]);setTotalUnread(0);return;}
   const [conversations,members,unread,lastMessages]=await Promise.all([
     db.from('conversations').select('id,title,created_at,is_group').in('id',ids).limit(150),
     db.from('conversation_members').select('conversation_id,user_id').in('conversation_id',ids).limit(600),
     db.rpc('my_conversation_unread_counts'),
     db.rpc('my_latest_conversation_messages')
   ]);
   if(conversations.error||members.error){setError(conversations.error?.message||members.error?.message||'Falha ao carregar conversas.');return;}
   const otherIds=[...new Set((members.data||[]).filter(m=>m.user_id!==userId).map(m=>m.user_id))];
   const people=otherIds.length?await db.from('profiles')
     .select('id,handle,display_name,avatar_path').in('id',otherIds):{data:[],error:null};
   const peopleById=new Map(((people.data||[]) as Contact[]).map(p=>[p.id,p]));
   const names=new Map(((people.data||[]) as Contact[]).map(p=>[p.id,p.display_name]));
   const unreadById=new Map<string,number>();
   for(const row of (unread.data||[]) as {conversation_id:string;unread_count:number|string}[]){
     unreadById.set(row.conversation_id,Number(row.unread_count||0));
   }
   const latestById=new Map<string,{content:string;created_at:string;media_type:string|null;deleted_at:string|null}>();
   for(const msg of lastMessages.data||[]){
     if(!latestById.has(msg.conversation_id))latestById.set(msg.conversation_id,msg);
   }
   const mutedById=new Map((own||[]).map(m=>[m.conversation_id,m.muted_until]));
   mutedRoomsRef.current=new Set([...mutedById.entries()]
     .filter(([,until])=>until&&Date.parse(until)>Date.now()).map(([id])=>id));
   setTotalUnread([...unreadById.entries()].reduce((sum,[id,n])=>{
     const mutedUntil=mutedById.get(id);
     return sum+(mutedUntil&&Date.parse(mutedUntil)>Date.now()?0:n);
   },0));
   const list:Thread[]=(conversations.data||[]).map(c=>{
     const participants=(members.data||[]).filter(m=>m.conversation_id===c.id&&m.user_id!==userId);
     const group=c.is_group;
     const otherNames=participants.map(p=>names.get(p.user_id)||'Conexão').join(', ');
     const recent=latestById.get(c.id);
     const preview=recent?(recent.deleted_at?'Mensagem apagada':
       recent.content?.trim()||(
         recent.media_type==='image'?'📷 Foto':recent.media_type==='video'?'🎬 Vídeo':
         recent.media_type==='audio'?'🎤 Áudio':'Mensagem')):'Comece a conversar';
     return {id:c.id,title:group?(c.title||'Grupo'):(otherNames||c.title||'Conversa'),
       group,otherNames,otherId:group?null:participants[0]?.user_id||null,
       other:group?null:peopleById.get(participants[0]?.user_id)||null,
       lastAt:recent?.created_at||c.created_at,
       unread:unreadById.get(c.id)||0,preview,mutedUntil:mutedById.get(c.id)||null};
   });
   setThreads(list.sort((a,b)=>b.lastAt.localeCompare(a.lastAt)));
 },[userId]);
 const loadMessages=useCallback(async(conversationId:string)=>{
   const {data,error:e}=await supabaseBrowser().from('messages')
     .select('id,conversation_id,sender_id,content,created_at,media_type,edited_at,deleted_at')
     .eq('conversation_id',conversationId).order('created_at',{ascending:false}).limit(50);
   if(e)setError(e.message);else setMessages([...(data||[])].reverse());
 },[]);
 useEffect(()=>{void loadThreads();void loadContacts();},[loadThreads,loadContacts]);
 async function openContact(person:Contact){
   if(starting)return;
   setStarting(person.id);setError('');
   try{
     const db=supabaseBrowser();
     const existing=threads.find(t=>!t.group&&t.otherId===person.id);
     let foundId:string|null=existing?.id||null;
     if(!foundId){
       const {data:id,error:e}=await db.rpc('create_conversation_with_members',{
          _title:'Conversa privada',_other_user_ids:[person.id]
       });
       if(e)throw e;
       foundId=id as string;
     }
     await loadThreads();
     setActive({id:foundId,title:person.display_name,group:false,
       otherNames:person.display_name,lastAt:new Date().toISOString(),
       unread:0,preview:'',mutedUntil:null,otherId:person.id,other:person});
   }catch(e){setError(e instanceof Error?e.message:'Não foi possível abrir a conversa.');}
   finally{setStarting(null);}
 }
 useEffect(()=>{
   const db=supabaseBrowser();
   // RLS on messages means events are delivered only for joined conversations.
   const channel=db.channel('conecta-widget-inbox-'+userId)
     .on('postgres_changes',{schema:'public',table:'messages',event:'*'},
       payload=>{
         void loadThreads();
         if(payload.eventType!=='INSERT'||!alertsEnabledRef.current||
           typeof Notification==='undefined'||Notification.permission!=='granted'||
           !document.hidden)return;
         const row=payload.new as {id?:string;sender_id?:string;conversation_id?:string};
         if(!row.id||row.sender_id===userId||!row.conversation_id||
           mutedRoomsRef.current.has(row.conversation_id)||lastAlertedRef.current===row.id)return;
         lastAlertedRef.current=row.id;
         // Privacy: no DM text or sender identity in browser notifications.
         try{new Notification('Conecta · Nova mensagem',{body:'Você recebeu uma mensagem.'});}
         catch{/* OS notifications may be restricted in this browser */}
       })
     .on('postgres_changes',{schema:'public',table:'conversation_members',event:'INSERT',
       filter:'user_id=eq.'+userId},()=>{void loadThreads();})
     .on('postgres_changes',{schema:'public',table:'conversation_members',event:'DELETE'},
       ()=>{void loadThreads();})
     .on('postgres_changes',{schema:'public',table:'conversations',event:'UPDATE'},
       ()=>{void loadThreads();})
     .subscribe();
   const refresh=()=>{if(!document.hidden){void loadThreads();void loadContacts();}};
   window.addEventListener('focus',refresh);
   document.addEventListener('visibilitychange',refresh);
   return()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);
     void db.removeChannel(channel);};
 },[loadThreads,loadContacts,userId]);
 useEffect(()=>{
   if(!open||!active)return;
   let live=true;setLoading(true);
   void loadMessages(active.id).finally(()=>{if(live)setLoading(false);});
   const db=supabaseBrowser();
   const channel=db.channel('conecta-widget-'+active.id)
     .on('postgres_changes',{schema:'public',table:'messages',event:'*',filter:'conversation_id=eq.'+active.id},
       ()=>{void loadMessages(active.id);}).subscribe();
   return()=>{live=false;void db.removeChannel(channel);};
 },[active,open,loadMessages]);
 useEffect(()=>{if(open&&active)end.current?.scrollIntoView({block:'end'});},[open,active,messages.length]);
 useEffect(()=>{
   if(!open||!active||!messages.length||document.hidden||!document.hasFocus())return;
   const last=messages[messages.length-1];
   if(last.sender_id===userId)return;
   let alive=true;
   void supabaseBrowser().from('conversation_members')
     .update({last_read_at:new Date().toISOString()})
     .eq('conversation_id',active.id).eq('user_id',userId)
     .then(({error:e})=>{if(alive&&!e)void loadThreads();});
   return()=>{alive=false;};
 },[open,active,messages,userId,loadThreads]);
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
     <MessageCircle size={23}/><span>Chat</span>{totalUnread>0&&<span className="conecta-widget-unread"
      aria-label={totalUnread+' mensagens não lidas'}>{totalUnread>99?'99+':totalUnread}</span>}</button>:
   <section className="conecta-chat-widget" aria-label="Chat flutuante">
     <header><button type="button" className="icon-btn" aria-label="Voltar às conversas" disabled={!active} onClick={()=>{setActive(null);setMessages([]);}}>{active?<ArrowLeft size={19}/>:<MessageCircle size={19}/>}</button>
       <strong>{active?active.title:'Conversas'}</strong>
       <button className="icon-btn" type="button"
         title={alertsEnabled?'Desativar avisos neste navegador':'Ativar avisos neste navegador'}
         aria-label={alertsEnabled?'Desativar notificações':'Ativar notificações'} onClick={()=>void toggleBrowserAlerts()}>
         {alertsEnabled?<Bell size={18}/>:<BellOff size={18}/>}</button>
       <Link href="/mensagens" aria-label="Abrir todas as mensagens" title="Abrir mensagens"><ExternalLink size={18}/></Link>
       <button className="icon-btn" type="button" aria-label="Fechar chat" onClick={()=>toggle(false)}><X size={20}/></button>
     </header>
     {!active?<div className="conecta-chat-widget-list">
       {threads.length===0?<div className="conecta-widget-empty"><MessageCircle size={26}/><p>Suas conversas aparecem aqui.</p></div>:
         threads.map(t=><button key={t.id} type="button" onClick={()=>{setActive(t);setError('');}}>{t.group?<span className="conecta-widget-thread-icon"><Users size={19}/></span>:
            <ProfileAvatar person={t.other} size="small"/>}
           <span><strong>{t.title}</strong><small>{t.preview.slice(0,75)}</small></span>
           {t.mutedUntil&&Date.parse(t.mutedUntil)>Date.now()&&<BellOff size={13} aria-label="Conversa silenciada"/>}
           {t.unread>0&&<span className="conecta-chat-unread" aria-label={t.unread+' mensagens não lidas'}>{t.unread>99?'99+':t.unread}</span>}</button>)}
       <section className="conecta-widget-contacts" aria-label="Minhas conexões">
         <strong className="conecta-widget-contacts-title">Conexões ({contacts.length})</strong>
         <input className="form-input" aria-label="Buscar conexões no chat" value={contactSearch}
           placeholder="Pesquisar nome ou @usuário" onChange={e=>setContactSearch(e.target.value)}/>
         {contacts.filter(person=>(person.display_name+' '+person.handle)
           .toLocaleLowerCase('pt-BR').includes(contactSearch.toLocaleLowerCase('pt-BR')))
           .map(person=><button type="button" key={person.id}
             disabled={Boolean(starting)} onClick={()=>void openContact(person)}>
             <ProfileAvatar person={person} size="small"/>
             <span><strong>{person.display_name}</strong><small>@{person.handle}</small></span>
             {starting===person.id?<Loader2 size={15} className="spin"/>:<MessageCircle size={15}/>}
           </button>)}
         {!contacts.length&&<small>Aceite conexões para conversar.</small>}
       </section>
       <Link className="conecta-widget-new" href="/mensagens">Abrir mensageiro completo <ExternalLink size={14}/></Link>
     </div>:
       <><div className="conecta-chat-widget-log" role="log" aria-live="polite">
         {loading&&<span className="small-note">Carregando...</span>}
         {!loading&&messages.length===0&&<p className="small-note">Conversa sem mensagens.</p>}
         {messages.map(m=><div key={m.id} className={'conecta-widget-message '+(m.sender_id===userId?'own':'')}>
           {m.content?<p>{m.deleted_at?<em>Mensagem apagada</em>:<MentionText text={m.content}/>}</p>:null}
           {m.edited_at&&!m.deleted_at&&<small>editada</small>}
           {!m.deleted_at&&m.media_type&&<small>Anexo {m.media_type==='image'?'📷':m.media_type==='video'?'🎬':'🎤'} · <Link href="/mensagens">abrir no chat</Link></small>}
           {m.sender_id!==userId&&!m.deleted_at&&<ReportContentButton targetType="message" targetId={m.id} reporterId={userId}/>}
         </div>)}
         <div ref={end}/>
       </div>
       {typingIds.length>0&&<small className="conecta-chat-typing" role="status">
         <span className="conecta-typing-dots"><i/><i/><i/></span>
         {typingIds.length>1?'Pessoas estão digitando':'Alguém está digitando'}...
        </small>}
       <form onSubmit={send} className="conecta-widget-compose"><input aria-label="Escrever no chat flutuante" maxLength={4000} value={text} onChange={e=>setText(e.target.value)} placeholder="Sua mensagem..."/>
         <button type="submit" disabled={sending||!text.trim()} aria-label="Enviar mensagem">{sending?<Loader2 size={19} className="spin"/>:<Send size={19}/>}</button></form></>}
     {error&&<p className="form-error" role="alert">{error}</p>}
   </section>}
 </div>;
}
