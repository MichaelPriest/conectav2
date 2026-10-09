'use client';
import {FormEvent,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {MessageCircle,Plus,Send,RefreshCw,Search,UserRound,Shield,Users,Paperclip,Mic,Square,X,Loader2,Pencil,Trash2,Check,CheckCheck,Reply,Smile} from 'lucide-react';
import {GuardedPage,useAuthProfile} from '@/components/app-shell';
import {ProfileAvatar} from '@/components/profile-avatar';
import {supabaseBrowser} from '@/lib/supabase/browser';
import {EmojiButton} from '@/components/emoji-button';
import {MusicEmbed,parseMusicUrl} from '@/components/music-embed';
import {optimizeImage} from '@/lib/media';
import {MentionInput,MentionText} from '@/components/mention-input';
import {ReportContentButton} from '@/components/report-content-button';

type Person={id:string;handle:string;display_name:string;avatar_path:string|null};
type Conversation={id:string;title:string|null;created_at:string;created_by:string};
type MediaType='image'|'video'|'audio';
type Message={id:string;sender_id:string;content:string;created_at:string;conversation_id:string;media_path:string|null;media_type:MediaType|null;edited_at:string|null;deleted_at:string|null;reply_to:string|null};
type MessageReaction={message_id:string;user_id:string;emoji:string;created_at:string};
type SearchHit={id:string;sender_id:string;content:string;created_at:string};
const REACTION_EMOJI=['❤️','👍','😂','😮','😢','👏'] as const;
type MemberReceipt={user_id:string;last_read_at:string|null};
const ALLOWED_MEDIA=['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/webm','audio/ogg','audio/mp4','audio/mpeg'];
const MAX_MEDIA_BYTES=50*1024*1024;
function classifyMedia(type:string):MediaType{
 if(type.startsWith('image/'))return 'image';
 if(type.startsWith('video/'))return 'video';
 return 'audio';
}
function MessageMedia({message}:{message:Message}){
 const [url,setUrl]=useState(''),[error,setError]=useState('');
 useEffect(()=>{
   if(!message.media_path)return;
   let alive=true;
   void supabaseBrowser().storage.from('social-media').createSignedUrl(message.media_path,1800)
     .then(({data,error:e})=>{if(!alive)return;if(e||!data?.signedUrl)setError('Mídia indisponível.');else setUrl(data.signedUrl);});
   return()=>{alive=false;};
 },[message.media_path]);
 if(!message.media_path)return null;
 if(error)return <small role="alert">{error}</small>;
 if(!url)return <small>Carregando anexo...</small>;
 if(message.media_type==='image')return <img className="conecta-chat-attachment" src={url} alt="Imagem compartilhada na conversa" loading="lazy"/>;
 if(message.media_type==='video')return <video className="conecta-chat-attachment" src={url} controls preload="metadata" playsInline/>;
 if(message.media_type==='audio')return <audio className="conecta-chat-audio" src={url} controls preload="metadata" aria-label="Mensagem de áudio"/>;
 return null;
}
type Thread=Conversation & {other:Person|null;participants:Person[];group:boolean;last:Message|null;unread:number};
const PER_PAGE=60;

export default function Messages(){
 const auth=useAuthProfile();
 const [threads,setThreads]=useState<Thread[]>([]);
 const [friends,setFriends]=useState<Person[]>([]);
 const [active,setActive]=useState<string|null>(null);
 const [messages,setMessages]=useState<Message[]>([]);
 const [recipient,setRecipient]=useState('');
 const [groupOpen,setGroupOpen]=useState(false),[groupTitle,setGroupTitle]=useState('');
 const [groupMembers,setGroupMembers]=useState<string[]>([]);
 const [compose,setCompose]=useState('');
 const [attachment,setAttachment]=useState<File|null>(null),[attachmentPreview,setAttachmentPreview]=useState('');
 const [recording,setRecording]=useState(false);
 const filePicker=useRef<HTMLInputElement>(null),recorder=useRef<MediaRecorder|null>(null);
 const audioStream=useRef<MediaStream|null>(null),audioChunks=useRef<Blob[]>([]);
 const recordLimit=useRef<number|null>(null);
 const [creating,setCreating]=useState(false),[sending,setSending]=useState(false);
 const [loading,setLoading]=useState(true),[loadingMessages,setLoadingMessages]=useState(false);
 const [hasOlder,setHasOlder]=useState(false),[error,setError]=useState('');
 const [receipts,setReceipts]=useState<MemberReceipt[]>([]);
 const [editingId,setEditingId]=useState<string|null>(null),[editingText,setEditingText]=useState('');
 const [messageBusy,setMessageBusy]=useState(false);
 const [replyTo,setReplyTo]=useState<Message|null>(null);
 const [reactions,setReactions]=useState<MessageReaction[]>([]);
 const [reactionOpen,setReactionOpen]=useState<string|null>(null);
 const [searchOpen,setSearchOpen]=useState(false),[messageSearch,setMessageSearch]=useState('');
 const [searchHits,setSearchHits]=useState<SearchHit[]>([]),[searchBusy,setSearchBusy]=useState(false);
 const [searchError,setSearchError]=useState('');
 const [highlighted,setHighlighted]=useState<string|null>(null);
 const [threadSearch,setThreadSearch]=useState('');
 const scrollRef=useRef<HTMLDivElement>(null);
 const messageNodes=useRef<Record<string,HTMLElement|null>>({});
 useEffect(()=>{
   if(!attachment){setAttachmentPreview('');return;}
   const url=URL.createObjectURL(attachment);setAttachmentPreview(url);
   return()=>URL.revokeObjectURL(url);
 },[attachment]);
 useEffect(()=>()=>{if(recordLimit.current!==null)window.clearTimeout(recordLimit.current);
   if(recorder.current){recorder.current.onstop=null;if(recorder.current.state==='recording')recorder.current.stop();}
   audioStream.current?.getTracks().forEach(track=>track.stop());
 },[]);
 function chooseAttachment(event:React.ChangeEvent<HTMLInputElement>){
   const selected=event.target.files?.[0];event.target.value='';
   if(!selected)return;
   if(!ALLOWED_MEDIA.includes(selected.type)){setError('Formato não permitido. Envie imagem, MP4, WebM ou áudio compatível.');return;}
   if(selected.size>MAX_MEDIA_BYTES){setError('O limite por anexo é de 50 MB.');return;}
   setAttachment(selected);setError('');
 }
 async function startRecording(){
   if(recording||sending)return;
   if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){
     setError('A gravação de voz não está disponível neste navegador.');return;
   }
   try{
     const stream=await navigator.mediaDevices.getUserMedia({audio:true});
     audioStream.current=stream;audioChunks.current=[];
     const preferred=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg']
       .find(type=>MediaRecorder.isTypeSupported(type));
     const instance=new MediaRecorder(stream,preferred?{mimeType:preferred}:undefined);
     recorder.current=instance;
     instance.ondataavailable=event=>{if(event.data.size)audioChunks.current.push(event.data);};
     instance.onstop=()=>{
       if(recordLimit.current!==null){window.clearTimeout(recordLimit.current);recordLimit.current=null;}
       stream.getTracks().forEach(track=>track.stop());audioStream.current=null;setRecording(false);
       const mime=instance.mimeType.split(';')[0]||'audio/webm';
       const ext=mime==='audio/mp4'?'m4a':mime==='audio/ogg'?'ogg':'webm';
       const recordingFile=new File(audioChunks.current,'audio-'+Date.now()+'.'+ext,{type:mime});
       if(recordingFile.size>0&&recordingFile.size<=MAX_MEDIA_BYTES&&ALLOWED_MEDIA.includes(mime))setAttachment(recordingFile);
       else setError('Não foi possível preparar o áudio gravado.');
     };
     instance.start(250);setRecording(true);setError('');
     recordLimit.current=window.setTimeout(()=>{if(instance.state==='recording')instance.stop();},60000);
   }catch(e){audioStream.current?.getTracks().forEach(track=>track.stop());audioStream.current=null;
     setError(e instanceof Error?e.message:'Sem permissão para usar o microfone.');
   }
 }
 function stopRecording(){if(recorder.current?.state==='recording')recorder.current.stop();}


 const loadThreads=useCallback(async()=>{
   if(!auth.user)return;
   const db=supabaseBrowser();
   const [membership,connections]=await Promise.all([
     db.from('conversation_members').select('conversation_id,user_id').eq('user_id',auth.user.id),
     db.from('friendships').select('requester_id,addressee_id').eq('status','accepted')
       .or('requester_id.eq.'+auth.user.id+',addressee_id.eq.'+auth.user.id)
   ]);
   if(membership.error||connections.error){
     setError(membership.error?.message||connections.error?.message||'Falha ao carregar chats.');
     setLoading(false);return;
   }
   const ids=[...new Set((membership.data||[]).map(x=>x.conversation_id))];
   const friendIds=(connections.data||[]).map(f=>f.requester_id===auth.user!.id?f.addressee_id:f.requester_id);
   const personIds=new Set(friendIds);
   let pairs:{conversation_id:string;user_id:string}[]=[];
   if(ids.length){
     const {data,error:e}=await db.from('conversation_members').select('conversation_id,user_id').in('conversation_id',ids);
     if(e)setError(e.message);
     pairs=data||[];
     pairs.forEach(pair=>personIds.add(pair.user_id));
   }
   const persons=personIds.size?await db.from('profiles').select('id,handle,display_name,avatar_path').in('id',Array.from(personIds)):{data:[],error:null};
   const people=(persons.data||[]) as Person[];
   const byId=new Map(people.map(p=>[p.id,p]));
   setFriends(friendIds.map(id=>byId.get(id)).filter((p):p is Person=>Boolean(p)));
   if(ids.length){
     const [conversations,lastMessages,unreadCounts]=await Promise.all([
       db.from('conversations').select('id,title,created_at,created_by').in('id',ids).order('created_at',{ascending:false}),
       db.rpc('my_latest_conversation_messages'),
       db.rpc('my_conversation_unread_counts')
     ]);
     if(conversations.error||lastMessages.error)setError(conversations.error?.message||lastMessages.error?.message||'Não foi possível carregar chats.');
     const mostRecent=new Map<string,Message>();
     ((lastMessages.data||[]) as Message[]).forEach(m=>{if(!mostRecent.has(m.conversation_id))mostRecent.set(m.conversation_id,m);});
     const countByConversation=new Map<string,number>();
     for(const row of (unreadCounts.data||[]) as {conversation_id:string;unread_count:number|string}[]){
       countByConversation.set(row.conversation_id,Number(row.unread_count||0));
     }
     const assembled=((conversations.data||[]) as Conversation[]).map(c=>{
       const participants=pairs.filter(p=>p.conversation_id===c.id&&p.user_id!==auth.user!.id)
         .map(p=>byId.get(p.user_id)).filter((p):p is Person=>Boolean(p));
       return {...c,other:participants[0]||null,participants,group:participants.length>1,
         last:mostRecent.get(c.id)||null,unread:countByConversation.get(c.id)||0};
     });
     assembled.sort((a,b)=>new Date(b.last?.created_at||b.created_at).getTime()-new Date(a.last?.created_at||a.created_at).getTime());
     setThreads(assembled);
   }else setThreads([]);
   setLoading(false);
 },[auth.user]);

 const loadMessages=useCallback(async(id:string,older=false)=>{
   setLoadingMessages(true);
   const db=supabaseBrowser();
   const {data,error:e}=await db.from('messages')
     .select('id,sender_id,content,created_at,conversation_id,media_path,media_type,edited_at,deleted_at,reply_to')
     .eq('conversation_id',id).order('created_at',{ascending:false})
     .range(older?messages.length:0,older?messages.length+PER_PAGE-1:PER_PAGE-1);
   if(e)setError(e.message);
   else {
     const chronological=[...((data||[]) as Message[])].reverse();
     setMessages(current=>older?[...chronological,...current]:chronological);
     setHasOlder((data||[]).length===PER_PAGE);
     const loadedIds=((data||[]) as Message[]).map(m=>m.id);
     if(loadedIds.length){
       const {data:reacted,error:reactionError}=await db.from('message_reactions')
         .select('message_id,user_id,emoji,created_at').in('message_id',loadedIds);
       if(reactionError)setError('Não foi possível carregar reações: '+reactionError.message);
       else setReactions(previous=>older?
         [...previous.filter(r=>!loadedIds.includes(r.message_id)),...((reacted||[]) as MessageReaction[])]:
         (reacted||[]) as MessageReaction[]);
     }else if(!older)setReactions([]);
   }
   setLoadingMessages(false);
 },[messages.length]);

 useEffect(()=>{void loadThreads();},[loadThreads]);
 useEffect(()=>{
   if(!auth.user)return;
   const db=supabaseBrowser();
   const channel=db.channel('conecta-global-messages-'+auth.user.id)
     .on('postgres_changes',{schema:'public',table:'messages',event:'INSERT'},
       ()=>{void loadThreads();}).subscribe();
   return()=>{void db.removeChannel(channel);};
 },[auth.user,loadThreads]);
 useEffect(()=>{const name=new URLSearchParams(window.location.search).get('to');if(name)setRecipient(name);},[]);
 useEffect(()=>{
   if(!active)return;
   setMessages([]);setReceipts([]);setReactions([]);setEditingId(null);
   setReplyTo(null);setReactionOpen(null);setSearchOpen(false);setMessageSearch('');
   setSearchHits([]);setHighlighted(null);void loadMessages(active);
   void loadReceipts(active);
   const db=supabaseBrowser();
   const channel=db.channel('conecta-inbox-'+active).on('postgres_changes',
     {schema:'public',table:'messages',event:'*',filter:'conversation_id=eq.'+active},
     ()=>{void loadMessages(active);}
   ).on('postgres_changes',
     {schema:'public',table:'message_reactions',event:'*'},
     ()=>{void loadMessages(active);}
   ).on('postgres_changes',
     {schema:'public',table:'conversation_members',event:'UPDATE',filter:'conversation_id=eq.'+active},
     ()=>{void loadReceipts(active);}
   ).subscribe();
   const sync=()=>{if(!document.hidden){void loadReceipts(active);void loadThreads();}};
   window.addEventListener('focus',sync);
   const receiptTimer=window.setInterval(sync,15000);
   return()=>{window.removeEventListener('focus',sync);window.clearInterval(receiptTimer);void db.removeChannel(channel);};
   // loadMessages is called with latest list and via realtime, not a hook dependency to avoid resubscribing for every message.
   // eslint-disable-next-line react-hooks/exhaustive-deps
 },[active]);
 useEffect(()=>{
   if(!loadingMessages && messages.length && scrollRef.current && !hasOlder){
     scrollRef.current.scrollTop=scrollRef.current.scrollHeight;
   }
 },[loadingMessages,messages.length,hasOlder]);

 const loadReceipts=useCallback(async(id:string)=>{
   const {data,error:e}=await supabaseBrowser().from('conversation_members')
     .select('user_id,last_read_at').eq('conversation_id',id);
   if(!e)setReceipts((data||[]) as MemberReceipt[]);
 },[]);

 useEffect(()=>{
   if(!active||!auth.user||!messages.length)return;
   const last=messages[messages.length-1];
   if(last.sender_id===auth.user.id||document.hidden||!document.hasFocus())return;
   let alive=true;
   const conversationId=active,userId=auth.user.id;
   async function markRead(){
     const db=supabaseBrowser();
     const {error:e}=await db.from('conversation_members')
       .update({last_read_at:new Date().toISOString()})
       .eq('conversation_id',conversationId).eq('user_id',userId);
     if(!e&&alive){void loadReceipts(conversationId);void loadThreads();}
   }
   void markRead();
   return()=>{alive=false;};
 },[active,auth.user,messages,loadReceipts]);

 async function reviseMessage(id:string){
   if(!active||!auth.user||messageBusy||!editingText.trim())return;
   setMessageBusy(true);setError('');
   const {data,error:e}=await supabaseBrowser().from('messages')
     .update({content:editingText.trim()}).eq('id',id)
     .eq('sender_id',auth.user.id).is('deleted_at',null)
     .select('id').maybeSingle();
   if(e)setError(e.message);
   else if(!data)setError('A mensagem não pode mais ser editada.');
   else{setEditingId(null);setEditingText('');await loadMessages(active);}
   setMessageBusy(false);
 }
 async function eraseMessage(message:Message){
   if(!active||!auth.user||messageBusy||message.sender_id!==auth.user.id)return;
   if(!window.confirm('Apagar esta mensagem para todos os participantes?'))return;
   setMessageBusy(true);setError('');
   const {data,error:e}=await supabaseBrowser().from('messages')
     .update({deleted_at:new Date().toISOString()}).eq('id',message.id)
     .eq('sender_id',auth.user.id).is('deleted_at',null)
     .select('id').maybeSingle();
   if(e)setError(e.message);
   else if(!data)setError('Não foi possível apagar a mensagem.');
   else{
     if(replyTo?.id===message.id)setReplyTo(null);
     if(editingId===message.id){setEditingId(null);setEditingText('');}
     await loadMessages(active);await loadThreads();
     if(message.media_path){
       const {error:storageError}=await supabaseBrowser().storage.from('social-media').remove([message.media_path]);
       if(storageError)setError('Mensagem apagada. A limpeza do anexo precisa ser verificada.');
     }
   }
   setMessageBusy(false);
 }

 async function reactToMessage(message:Message,emoji:string){
   if(!auth.user||!active||message.conversation_id!==active||message.deleted_at||messageBusy)return;
   const currentUserId=auth.user.id;
   const currentReaction=reactions.some(r=>r.message_id===message.id&&r.user_id===currentUserId&&r.emoji===emoji);
   setMessageBusy(true);setError('');
   const db=supabaseBrowser();
   const result=currentReaction?
     await db.from('message_reactions').delete().eq('message_id',message.id)
       .eq('user_id',currentUserId).eq('emoji',emoji):
     await db.from('message_reactions').insert({message_id:message.id,user_id:currentUserId,emoji});
   if(result.error)setError('Não foi possível atualizar a reação: '+result.error.message);
   else{
     setReactions(old=>currentReaction?
       old.filter(r=>!(r.message_id===message.id&&r.user_id===currentUserId&&r.emoji===emoji)):
       [...old,{message_id:message.id,user_id:currentUserId,emoji,created_at:new Date().toISOString()}]);
   }
   setReactionOpen(null);setMessageBusy(false);
 }
 useEffect(()=>{
   if(!active||!searchOpen||messageSearch.trim().length<2){
     setSearchHits([]);setSearchError('');setSearchBusy(false);return;
   }
   let alive=true;
   const timeout=window.setTimeout(async()=>{
     setSearchBusy(true);
     const {data,error:e}=await supabaseBrowser().rpc('search_my_conversation_messages',{
       _conversation:active,_term:messageSearch.trim(),_limit:40
     });
     if(!alive)return;
     if(e){setSearchError('Busca indisponível: '+e.message);setSearchHits([]);}
     else{setSearchError('');setSearchHits((data||[]) as SearchHit[]);}
     setSearchBusy(false);
   },320);
   return()=>{alive=false;window.clearTimeout(timeout);};
 },[active,searchOpen,messageSearch]);

 async function begin(event:FormEvent){
   event.preventDefault();
   if(!auth.user||creating)return;
   const handle=recipient.trim().replace(/^@/,'').toLowerCase();
   const other=friends.find(p=>p.handle===handle);
   if(!other){setError('Para iniciar um chat, essa pessoa precisa ser uma amizade aceita.');return;}
   if(other.id===auth.user.id){setError('Escolha uma pessoa diferente.');return;}
   setCreating(true);setError('');
   try{
     const already=threads.find(t=>!t.group&&t.other?.id===other.id);
     if(already){setActive(already.id);setRecipient('');return;}
     // A single database transaction creates the conversation AND all memberships.
     // If any RLS/friendship/block check rejects an invite, nothing is persisted.
     const {data:id,error:e}=await supabaseBrowser().rpc('create_conversation_with_members',{
       _title:'Conversa privada',_other_user_ids:[other.id]
     });
     if(e)throw e;
     if(!id)throw new Error('A conversa não foi criada.');
     setRecipient('');
     await loadThreads();
     setActive(id as string);
   }catch(e){
     setError(e instanceof Error?e.message:'Não foi possível criar a conversa.');
   }finally{setCreating(false);}
 }

 async function beginGroup(event:FormEvent){
   event.preventDefault();
   if(!auth.user||creating)return;
   const title=groupTitle.trim().slice(0,80);
   const participantIds=[...new Set(groupMembers)].filter(id=>friends.some(f=>f.id===id));
   if(!title||participantIds.length<2){
     setError('Informe o nome do grupo e selecione pelo menos duas amizades aceitas.');
     return;
   }
   setCreating(true);setError('');
   try{
     const {data:id,error:e}=await supabaseBrowser().rpc('create_conversation_with_members',{
       _title:title,_other_user_ids:participantIds
     });
     if(e)throw e;
     if(!id)throw new Error('Não foi possível criar o grupo.');
     setGroupTitle('');setGroupMembers([]);setGroupOpen(false);
     await loadThreads();
     setActive(id as string);
   }catch(e){
     setError('Não foi possível completar o grupo: '+(e instanceof Error?e.message:'Erro ao adicionar participantes.'));
   }finally{setCreating(false);}
 }

 async function send(e:FormEvent){
   e.preventDefault();if(!active||!auth.user||(!compose.trim()&&!attachment)||sending||recording)return;
   setSending(true);setError('');
   const value=compose.trim(),db=supabaseBrowser();let uploadedPath='';
   try{
     let mediaType:MediaType|null=null;
     if(attachment){
       if(!ALLOWED_MEDIA.includes(attachment.type)||attachment.size>MAX_MEDIA_BYTES)
         throw new Error('Arquivo inválido ou maior que 50 MB.');
       const prepared=attachment.type.startsWith('image/')?await optimizeImage(attachment):attachment;
       mediaType=classifyMedia(prepared.type);
       const extension=prepared.name.split('.').pop()?.toLowerCase()||'bin';
       uploadedPath=auth.user.id+'/messages/'+crypto.randomUUID()+'.'+extension;
       const {error:uploadError}=await db.storage.from('social-media')
         .upload(uploadedPath,prepared,{contentType:prepared.type,upsert:false});
       if(uploadError)throw uploadError;
     }
     const {error:sendError}=await db.from('messages').insert({
       conversation_id:active,sender_id:auth.user.id,content:value,
       media_path:uploadedPath||null,media_type:mediaType,reply_to:replyTo?.id||null
     });
     if(sendError)throw sendError;
     setCompose('');setAttachment(null);setReplyTo(null);await loadMessages(active);await loadThreads();
   }catch(e){
     if(uploadedPath)await db.storage.from('social-media').remove([uploadedPath]);
     setError(e instanceof Error?e.message:'Não foi possível enviar a mensagem.');
   }finally{setSending(false);}
 }

 async function block(){
   const person=threads.find(t=>t.id===active)?.other;
   if(!person||!auth.user||!confirm('Bloquear @'+person.handle+'? Vocês não poderão trocar novas mensagens até o desbloqueio.'))return;
   const {error:e}=await supabaseBrowser().from('user_blocks').insert({blocker_id:auth.user.id,blocked_id:person.id});
   if(e)setError(e.message);
   else{setError('Usuário bloqueado. Para desbloquear, use o perfil público.');}
 }
 const filtered=threads.filter(t=>([t.title||'',t.other?.display_name||'',t.other?.handle||'',...t.participants.map(p=>p.display_name)].join(' ')).toLowerCase().includes(threadSearch.toLowerCase()));
 const current=threads.find(t=>t.id===active);
 return <GuardedPage {...auth}><main className="section-page">
   <div className="page-heading"><div><span className="section-eyebrow">MENSAGENS REAIS · AMIZADES ACEITAS</span><h1>Conversas <span className="wave">✳</span></h1><p>Troque mensagens privadas, músicas e emojis com suas amizades.</p></div></div>
   <div className={'conecta-chat-layout card'+(active?' conecta-chat-has-active':'')}>
     <aside className="conecta-chat-sidebar">
       <div className="feed-title"><h2>Caixa de entrada</h2><button className="icon-btn" title="Atualizar" onClick={()=>void loadThreads()}><RefreshCw size={18}/></button></div>
       <label className="searchbox"><Search size={17}/><input aria-label="Filtrar conversas" placeholder="Buscar conversa..." value={threadSearch} onChange={e=>setThreadSearch(e.target.value)}/></label>
       <form onSubmit={begin} className="conecta-chat-new">
         <select className="form-input" aria-label="Amizade para conversar" value={recipient} onChange={e=>setRecipient(e.target.value)} required>
           <option value="">Nova conversa com...</option>
           {friends.map(f=><option key={f.id} value={f.handle}>{f.display_name} (@{f.handle})</option>)}
         </select>
         <button className="btn btn-primary" type="submit" disabled={!recipient||creating}><Plus size={19}/></button>
       </form>
       <button type="button" className="btn btn-outline" aria-expanded={groupOpen} onClick={()=>{setGroupOpen(open=>!open);setError('');}}><Users size={16}/> {groupOpen?'Fechar grupo':'Criar grupo'}</button>
       {groupOpen&&<form onSubmit={beginGroup} className="conecta-chat-new" style={{display:'grid',gap:10}}>
         <label htmlFor="group-title">Nome do grupo</label>
         <input id="group-title" className="form-input" value={groupTitle} onChange={e=>setGroupTitle(e.target.value)} maxLength={80} required placeholder="Ex.: Amigos da música"/>
         <fieldset style={{border:0,padding:0,margin:0,maxHeight:150,overflowY:'auto'}}>
           <legend>Selecione ao menos 2 amizades</legend>
           {friends.map(f=><label key={f.id} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 0'}}>
             <input type="checkbox" checked={groupMembers.includes(f.id)} onChange={e=>setGroupMembers(current=>e.target.checked?[...current,f.id]:current.filter(id=>id!==f.id))}/>
             {f.display_name} (@{f.handle})
           </label>)}
         </fieldset>
         <button className="btn btn-primary" type="submit" disabled={creating||!groupTitle.trim()||groupMembers.length<2}>Criar conversa em grupo</button>
       </form>}
       {loading?<p className="small-note">Carregando amizades e conversas...</p>:null}
       {!loading&&friends.length===0&&<p className="small-note">Adicione e aceite amizades antes de iniciar uma conversa. <Link className="rail-link" href="/explorar">Explorar pessoas</Link></p>}
       {!loading&&filtered.length===0&&<p className="small-note">Nenhuma conversa encontrada.</p>}
       <div className="conecta-chat-threads">{filtered.map(t=><button key={t.id} className={'conecta-chat-thread '+(t.id===active?'active':'')} onClick={()=>setActive(t.id)}>
         {t.group?<span className="concept-round-icon violet"><Users size={18}/></span>:<ProfileAvatar person={t.other}/>}
         <span><strong>{t.group?(t.title||'Grupo'):t.other?.display_name||'Conversa privada'}</strong><small>{t.group?(t.participants.length+1)+' membros':('@'+(t.other?.handle||'contato'))} · {t.last?.content?.slice(0,55)||(t.last?.media_type==='image'?'📷 Foto':t.last?.media_type==='video'?'🎬 Vídeo':t.last?.media_type==='audio'?'🎤 Áudio':'Comece a conversar')}</small></span>
         <span className="conecta-chat-thread-meta"><time>{new Date(t.last?.created_at||t.created_at).toLocaleDateString('pt-BR')}</time>
          {t.unread>0&&<span className="conecta-chat-unread" aria-label={t.unread+' mensagens não lidas'}>
             {t.unread>99?'99+':t.unread}</span>}</span>
       </button>)}</div>
     </aside>
     <section className="conecta-chat-main">
       {active?<><header className="conecta-chat-head">
          <button type="button" className="icon-btn conecta-chat-mobile-back"
            aria-label="Voltar à lista de conversas" onClick={()=>setActive(null)}>
            <Reply size={19}/></button>{current?.group?<span className="concept-round-icon violet"><Users size={20}/></span>:<ProfileAvatar person={current?.other}/>}
         <div><strong>{current?.group?(current.title||'Grupo'):current?.other?.display_name||'Conversa'}</strong>
         <small>{current?.group?current.participants.map(p=>p.display_name).join(', '):(current?.other?.handle?'@'+current.other.handle:'Mensagens privadas')}</small></div>
         <button className="icon-btn" type="button" title={searchOpen?'Fechar busca':'Buscar nesta conversa'}
            aria-label="Buscar mensagens nesta conversa" aria-expanded={searchOpen}
            onClick={()=>{setSearchOpen(open=>!open);setMessageSearch('');setSearchHits([]);}}>
            <Search size={18}/></button>
          {current?.other&&!current.group&&<><Link className="icon-btn" title="Ver perfil" href={'/p/'+current.other.handle}><UserRound size={19}/></Link><button className="icon-btn" type="button" title="Bloquear usuário" onClick={block}><Shield size={19}/></button></>}
       </header>
       {searchOpen&&<section className="conecta-chat-search-panel" aria-label="Buscar mensagens antigas">
          <label className="searchbox"><Search size={17}/>
            <input autoFocus value={messageSearch} maxLength={100}
              placeholder="Pesquisar mensagens nesta conversa..."
              aria-label="Texto para buscar nas mensagens privadas"
              onChange={event=>setMessageSearch(event.target.value)}/>
          </label>
          {searchBusy&&<span className="small-note">Procurando em todo o histórico...</span>}
          {searchError&&<p className="form-error" role="alert">{searchError}</p>}
          {messageSearch.trim().length>=2&&!searchBusy&&!searchError&&<div className="conecta-chat-search-results">
            {searchHits.length===0?<small>Não foram encontradas mensagens.</small>:
             searchHits.map(hit=><button type="button" key={hit.id}
               onClick={()=>{
                 setHighlighted(hit.id);
                 const node=messageNodes.current[hit.id];
                 if(node){setSearchOpen(false);node.scrollIntoView({behavior:'smooth',block:'center'});}
                 else setError('Mensagem localizada no histórico. Carregue mensagens anteriores para acessar o contexto completo.');
               }}>
               <strong>{hit.sender_id===auth.user?.id?'Você':'Participante'}</strong>
               <small>{new Date(hit.created_at).toLocaleString('pt-BR')}</small>
               <span>{hit.content.slice(0,230)}</span>
             </button>)}
          </div>}
          {messageSearch.trim().length<2&&<p className="small-note">Digite pelo menos duas letras. A busca respeita a privacidade dos participantes.</p>}
        </section>}
        <div className="conecta-chat-log" ref={scrollRef} aria-live="polite">
         {hasOlder&&<button className="btn btn-outline" type="button" disabled={loadingMessages} onClick={()=>void loadMessages(active,true)}>Carregar mensagens anteriores</button>}
         {messages.length===0&&!loadingMessages&&<div className="empty-state"><MessageCircle size={30}/><h3>Uma nova conversa começa aqui.</h3><p>Respeite a privacidade e a vontade de quem participa.</p></div>}
         {messages.map(m=>{
          const own=m.sender_id===auth.user?.id;
          const otherReceipts=receipts.filter(r=>r.user_id!==auth.user?.id);
          const readCount=otherReceipts.filter(r=>r.last_read_at&&new Date(r.last_read_at).getTime()>=new Date(m.created_at).getTime()).length;
          const quoted=messages.find(item=>item.id===m.reply_to);
           const messageReactions=reactions.filter(r=>r.message_id===m.id);
           return <article key={m.id} ref={node=>{messageNodes.current[m.id]=node;}}
            className={'conecta-message '+(own?'own':'other')+
              (m.deleted_at?' conecta-message-deleted':'')+
              (highlighted===m.id?' conecta-message-highlighted':'')}>
           {editingId===m.id?<form className="conecta-chat-edit" onSubmit={e=>{e.preventDefault();void reviseMessage(m.id);}}>
             <input className="form-input" aria-label="Editar mensagem" autoFocus maxLength={4000} required value={editingText}
               onChange={e=>setEditingText(e.target.value)}/>
             <div><button type="button" className="btn btn-outline" disabled={messageBusy} onClick={()=>setEditingId(null)}>Cancelar</button>
               <button className="btn btn-primary" type="submit" disabled={messageBusy||!editingText.trim()}><Check size={15}/> Salvar</button></div>
           </form>:<>
            {!m.deleted_at&&m.reply_to&&<button type="button"
               className="conecta-chat-quote" title="Mensagem que está sendo respondida"
               onClick={()=>{
                 const node=messageNodes.current[m.reply_to!];
                 if(node)node.scrollIntoView({behavior:'smooth',block:'center'});
               }}>
              <Reply size={13}/>
              <span>{quoted?(quoted.deleted_at?'Mensagem apagada':quoted.content?.slice(0,110)||'Anexo compartilhado'):'Mensagem anterior'}</span>
            </button>}
            {m.content&&<p>{m.deleted_at?<em>Mensagem apagada</em>:<MentionText text={m.content}/>}</p>}
            {!m.deleted_at&&m.content&&parseMusicUrl(m.content)&&<MusicEmbed url={m.content}/>}
            {!m.deleted_at&&<MessageMedia message={m}/>}
            <div className="conecta-chat-message-footer"><time>{new Date(m.created_at).toLocaleString('pt-BR',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})}</time>
             {m.edited_at&&!m.deleted_at&&<small>editada</small>}
             {own&&!m.deleted_at&&otherReceipts.length>0&&<span className="conecta-chat-receipt" title={readCount+' de '+otherReceipts.length+' participantes leram'}>{readCount===otherReceipts.length?<CheckCheck size={13}/>:<Check size={13}/>} {readCount===otherReceipts.length?'Lida':readCount>0?readCount+' leram':'Enviada'}</span>}
            </div>
            {!m.deleted_at&&<div className="conecta-chat-social-actions">
              <button type="button" disabled={messageBusy} title="Responder a esta mensagem"
                onClick={()=>{setReplyTo(m);setEditingId(null);}}><Reply size={14}/> Responder</button>
              <button type="button" disabled={messageBusy} title="Reagir com emoji"
                aria-expanded={reactionOpen===m.id}
                onClick={()=>setReactionOpen(x=>x===m.id?null:m.id)}><Smile size={14}/> Reagir</button>
            </div>}
            {!m.deleted_at&&reactionOpen===m.id&&<div className="conecta-chat-emoji-reactions" aria-label="Selecione uma reação">
              {REACTION_EMOJI.map(emoji=><button type="button" key={emoji}
                title={'Reagir com '+emoji} disabled={messageBusy}
                onClick={()=>void reactToMessage(m,emoji)}>{emoji}</button>)}
            </div>}
            {!m.deleted_at&&messageReactions.length>0&&<div className="conecta-chat-reaction-chips" aria-label="Reações">
              {REACTION_EMOJI.filter(emoji=>messageReactions.some(r=>r.emoji===emoji)).map(emoji=>
               <button type="button" key={emoji} disabled={messageBusy}
                 className={messageReactions.some(r=>r.user_id===auth.user?.id&&r.emoji===emoji)?'mine':''}
                 onClick={()=>void reactToMessage(m,emoji)}
                 aria-label={'Reação '+emoji+', '+messageReactions.filter(r=>r.emoji===emoji).length+' participantes'}>
                 {emoji} {messageReactions.filter(r=>r.emoji===emoji).length}</button>)}
            </div>}
            {!own&&!m.deleted_at&&auth.user&&<ReportContentButton targetType="message" targetId={m.id} reporterId={auth.user.id}/>}
            {own&&!m.deleted_at&&<div className="conecta-chat-message-actions">
              {m.content&&<button type="button" disabled={messageBusy} title="Editar mensagem" aria-label="Editar mensagem" onClick={()=>{setEditingId(m.id);setEditingText(m.content);}}><Pencil size={13}/></button>}
              <button type="button" disabled={messageBusy} title="Apagar para todos" aria-label="Apagar mensagem" onClick={()=>void eraseMessage(m)}><Trash2 size={13}/></button>
            </div>}
           </>}
         </article>;
         })}
       </div>
       {attachment&&<div className="conecta-chat-attachment-draft">
         {attachmentPreview&&(attachment.type.startsWith('image/')?<img src={attachmentPreview} alt="Prévia do anexo"/>:
           attachment.type.startsWith('video/')?<video src={attachmentPreview} controls preload="metadata"/>:
           <audio src={attachmentPreview} controls preload="metadata"/>)}
         <span>{attachment.name}</span><button type="button" className="icon-btn" aria-label="Remover anexo" onClick={()=>setAttachment(null)}><X size={17}/></button>
       </div>}
       {replyTo&&<div className="conecta-chat-reply-draft" role="status">
          <Reply size={16}/><span><strong>Respondendo a uma mensagem</strong>
            <small>{replyTo.deleted_at?'Mensagem apagada':replyTo.content?.slice(0,130)||'Anexo compartilhado'}</small>
          </span><button type="button" className="icon-btn" title="Cancelar resposta" onClick={()=>setReplyTo(null)}><X size={17}/></button>
        </div>}
        <form className="conecta-chat-write" onSubmit={send}>
         <input type="file" ref={filePicker} hidden accept={ALLOWED_MEDIA.join(',')} onChange={chooseAttachment} aria-label="Anexar arquivo"/>
         <button type="button" className="icon-btn" aria-label="Anexar imagem, vídeo ou áudio" title="Anexar arquivo" disabled={sending||recording} onClick={()=>filePicker.current?.click()}><Paperclip size={19}/></button>
         <button type="button" className={'icon-btn '+(recording?'recording':'')} aria-label={recording?'Parar gravação':'Gravar áudio'} title={recording?'Parar gravação':'Gravar recado de voz'} disabled={sending}
           onClick={()=>{if(recording)stopRecording();else void startRecording();}}>{recording?<Square size={19}/>:<Mic size={19}/>}</button>
         <EmojiButton onSelect={emoji=>setCompose(t=>(t+emoji).slice(0,4000))}/>
         <MentionInput as="input" label="Escrever mensagem" value={compose} onChange={setCompose} maxLength={4000} placeholder={recording?'Gravando áudio...':'Escreva uma mensagem ou marque @usuário...'}/>
         <button className="btn btn-primary" type="submit" disabled={sending||recording||(!compose.trim()&&!attachment)}>{sending?<Loader2 size={19} className="spin"/>:<Send size={19}/>}<span>Enviar</span></button>
       </form></>:<div className="conecta-chat-welcome"><MessageCircle size={37}/><h2>Boas conversas começam aqui.</h2><p>Selecione uma conversa ou escolha uma amizade para falar.</p></div>}
     </section>
   </div>
   {error&&<p className="form-error" role="alert">{error}</p>}
   <p className="small-note" style={{marginTop:15}}>Mensagens protegidas por permissões do Supabase. Ainda não há criptografia de ponta a ponta nem controles completos para menores; não compartilhe dados sensíveis.</p>
 </main></GuardedPage>;
}
