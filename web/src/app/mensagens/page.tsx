'use client';
import {FormEvent,useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {MessageCircle,Plus,Send,RefreshCw,Search,UserRound,Shield,Users,Paperclip,Mic,Square,X,Loader2,Pencil,Trash2,Check,CheckCheck,Reply,Smile,Pin,PinOff,BellOff,Bell,Settings2,UserPlus} from 'lucide-react';
import {GuardedPage,useAuthProfile} from '@/components/app-shell';
import {ProfileAvatar} from '@/components/profile-avatar';
import {notifyChatMessageSent,ChatPushControl} from '@/components/chat-push-control';
import {supabaseBrowser} from '@/lib/supabase/browser';
import {EmojiButton} from '@/components/emoji-button';
import {MusicEmbed,parseMusicUrl} from '@/components/music-embed';
import {optimizeImage} from '@/lib/media';
import {MentionInput,MentionText} from '@/components/mention-input';
import {ReportContentButton} from '@/components/report-content-button';
import {useChatTyping} from '@/lib/use-chat-typing';
import {ChatOnlineStatus,ChatPresenceToggle} from '@/components/chat-presence';
import {ChatCallButtons,ChatMissedCalls} from '@/components/chat-calls';
import {mergeChatPage,olderChatCursor} from '@/lib/chat-timeline';
import {groupAccess,canRemoveGroupTarget} from '@/lib/chat-group-roles';

type Person={id:string;handle:string;display_name:string;avatar_path:string|null};
type Conversation={id:string;title:string|null;created_at:string;created_by:string;is_group:boolean};
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
type Thread=Conversation & {other:Person|null;participants:Person[];group:boolean;last:Message|null;unread:number;mutedUntil:string|null};
type PinnedMessage={message_id:string;pinned_at:string;content:string;media_type:MediaType|null};
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
 const [connectionSearch,setConnectionSearch]=useState('');
 const [connectionsExpanded,setConnectionsExpanded]=useState(true);
 const [pins,setPins]=useState<PinnedMessage[]>([]);
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [settingsTitle,setSettingsTitle]=useState('');
 const [inviteFriend,setInviteFriend]=useState('');
 const [transferOwner,setTransferOwner]=useState('');
 const [settingsBusy,setSettingsBusy]=useState(false);
 const [groupCoadmins,setGroupCoadmins]=useState<string[]>([]);
 const [groupPermissionsFor,setGroupPermissionsFor]=useState<string|null>(null);
 const [groupAllowsInvite,setGroupAllowsInvite]=useState(true);
 const [groupAllowsRemove,setGroupAllowsRemove]=useState(false);
 const typingIds=useChatTyping(active,auth.user?.id,compose,Boolean(active));
 const scrollRef=useRef<HTMLDivElement>(null);
 const messageNodes=useRef<Record<string,HTMLElement|null>>({});
 const activeRef=useRef(active);activeRef.current=active;
 const messagesRef=useRef(messages);messagesRef.current=messages;
 const loadingOlderRef=useRef(false);
 const followLatestRef=useRef(true);
 const scrollAnchorRef=useRef<{conversationId:string;height:number;top:number}|null>(null);
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
     db.from('conversation_members').select('conversation_id,user_id,muted_until').eq('user_id',auth.user.id),
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
       db.from('conversations').select('id,title,created_at,created_by,is_group').in('id',ids).order('created_at',{ascending:false}),
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
     const myPreferences=new Map((membership.data||[]).map(m=>[m.conversation_id,m.muted_until]));
     const assembled=((conversations.data||[]) as Conversation[]).map(c=>{
       const participants=pairs.filter(p=>p.conversation_id===c.id&&p.user_id!==auth.user!.id)
         .map(p=>byId.get(p.user_id)).filter((p):p is Person=>Boolean(p));
       return {...c,other:participants[0]||null,participants,group:c.is_group,
         last:mostRecent.get(c.id)||null,unread:countByConversation.get(c.id)||0,mutedUntil:myPreferences.get(c.id)||null};
     });
     assembled.sort((a,b)=>new Date(b.last?.created_at||b.created_at).getTime()-new Date(a.last?.created_at||a.created_at).getTime());
     setThreads(assembled);
   }else setThreads([]);
   setLoading(false);
 },[auth.user]);

 const loadPins=useCallback(async(id:string)=>{
   const db=supabaseBrowser();
   const {data,error:e}=await db.from('conversation_pins')
     .select('message_id,pinned_at').eq('conversation_id',id)
     .order('pinned_at',{ascending:false}).limit(3);
   if(e){setError('Mensagens fixadas indisponíveis: '+e.message);return;}
   const rows=data||[];
   if(!rows.length){setPins([]);return;}
   const {data:messages,error:messageError}=await db.from('messages')
     .select('id,content,media_type,deleted_at').in('id',rows.map(p=>p.message_id));
   if(messageError){setError(messageError.message);return;}
   const byId=new Map((messages||[]).map(m=>[m.id,m]));
   setPins(rows.filter(p=>byId.has(p.message_id)&&!byId.get(p.message_id)?.deleted_at)
    .map(p=>({message_id:p.message_id,pinned_at:p.pinned_at,
      content:byId.get(p.message_id)?.content||'Anexo compartilhado',
      media_type:(byId.get(p.message_id)?.media_type||null) as MediaType|null})));
 },[]);
 const loadGroupPermissions=useCallback(async(id:string)=>{
   const {data,error:e}=await supabaseBrowser().rpc('get_conversation_group_permissions',{_conversation:id});
   if(activeRef.current!==id)return;
   if(e){setGroupCoadmins([]);setError('Permissões do grupo indisponíveis: '+e.message);return;}
   const value=data as {coadmins?:string[];coadmins_can_invite?:boolean;coadmins_can_remove?:boolean}|null;
   setGroupPermissionsFor(id);
   setGroupCoadmins(Array.isArray(value?.coadmins)?value.coadmins:[]);
   setGroupAllowsInvite(value?.coadmins_can_invite===true);
   setGroupAllowsRemove(value?.coadmins_can_remove===true);
 },[]);
 const loadMessages=useCallback(async(id:string,older=false)=>{
   const prior=messagesRef.current.filter(m=>m.conversation_id===id);
   const cursor=older?olderChatCursor(prior,id):null;
   if(older&&(!cursor||loadingOlderRef.current))return;
   if(older){
     loadingOlderRef.current=true;
     const node=scrollRef.current;
     scrollAnchorRef.current=node?{conversationId:id,height:node.scrollHeight,top:node.scrollTop}:null;
   }
   setLoadingMessages(true);
   try{
     const db=supabaseBrowser();
     let query=db.from('messages')
       .select('id,sender_id,content,created_at,conversation_id,media_path,media_type,edited_at,deleted_at,reply_to')
       .eq('conversation_id',id);
     if(cursor)query=query.or(cursor);
     const {data,error:e}=await query.order('created_at',{ascending:false})
       .order('id',{ascending:false}).limit(PER_PAGE);
     if(activeRef.current!==id)return;
     if(e){scrollAnchorRef.current=null;setError(e.message);return;}
     const incoming=(data||[]) as Message[];
     setMessages(current=>mergeChatPage(current,incoming,id));
     // Refreshes must not discard the pagination state or old messages.
     if(older||!prior.length)setHasOlder(incoming.length===PER_PAGE);
     const loadedIds=incoming.map(m=>m.id);
     if(loadedIds.length){
       const {data:reacted,error:reactionError}=await db.from('message_reactions')
         .select('message_id,user_id,emoji,created_at').in('message_id',loadedIds);
       if(activeRef.current!==id)return;
       if(reactionError)setError('Não foi possível carregar reações: '+reactionError.message);
       else setReactions(previous=>[
         ...previous.filter(r=>!loadedIds.includes(r.message_id)),
         ...((reacted||[]) as MessageReaction[])
       ]);
     }else if(!older&&prior.length===0)setReactions([]);
   }finally{
     if(older)loadingOlderRef.current=false;
     if(activeRef.current===id)setLoadingMessages(false);
   }
 },[]);

 useEffect(()=>{void loadThreads();},[loadThreads]);
 useEffect(()=>{
   if(!auth.user)return;
   const db=supabaseBrowser();
   const channel=db.channel('conecta-global-messages-'+auth.user.id)
     .on('postgres_changes',{schema:'public',table:'messages',event:'INSERT'},
       ()=>{void loadThreads();})
     .on('postgres_changes',{schema:'public',table:'conversation_members',event:'INSERT',
       filter:'user_id=eq.'+auth.user.id},()=>{void loadThreads();})
     .on('postgres_changes',{schema:'public',table:'conversations',event:'UPDATE'},
       ()=>{void loadThreads();}).subscribe();
   const refresh=()=>{if(!document.hidden)void loadThreads();};
   window.addEventListener('focus',refresh);
   document.addEventListener('visibilitychange',refresh);
   // DELETE events do not have row-level authorization in Postgres Changes.
   // Periodic RLS-filtered refetch is safer than subscribing to DELETE metadata.
   const membershipTimer=window.setInterval(refresh,45000);
   return()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);
     window.clearInterval(membershipTimer);void db.removeChannel(channel);};
 },[auth.user,loadThreads]);
 useEffect(()=>{const name=new URLSearchParams(window.location.search).get('to');if(name)setRecipient(name);},[]);
 useEffect(()=>{
   if(!active)return;
   loadingOlderRef.current=false;
   followLatestRef.current=true;
   scrollAnchorRef.current=null;
   setMessages([]);setReceipts([]);setReactions([]);setEditingId(null);
   setReplyTo(null);setReactionOpen(null);setSearchOpen(false);setMessageSearch('');
   setSearchHits([]);setHighlighted(null);
   setPins([]);setSettingsOpen(false);setInviteFriend('');setTransferOwner('');
   setGroupPermissionsFor(null);setGroupCoadmins([]);setGroupAllowsInvite(false);setGroupAllowsRemove(false);
   void loadGroupPermissions(active);
   void loadPins(active);void loadMessages(active);
   void loadReceipts(active);
   const db=supabaseBrowser();
   const channel=db.channel('conecta-inbox-'+active).on('postgres_changes',
     {schema:'public',table:'messages',event:'*',filter:'conversation_id=eq.'+active},
     ()=>{void loadMessages(active);}
   ).on('postgres_changes',
     {schema:'public',table:'message_reactions',event:'*'},
     ()=>{void loadMessages(active);}
   ).on('postgres_changes',
     {schema:'public',table:'conversation_pins',event:'*',filter:'conversation_id=eq.'+active},
     ()=>{void loadPins(active);}
   ).on('postgres_changes',
     {schema:'public',table:'conversation_members',event:'UPDATE',filter:'conversation_id=eq.'+active},
     ()=>{void loadReceipts(active);}
   ).subscribe();
   const sync=()=>{if(!document.hidden){void loadReceipts(active);void loadThreads();void loadGroupPermissions(active);}};
   window.addEventListener('focus',sync);
   const receiptTimer=window.setInterval(sync,15000);
   return()=>{window.removeEventListener('focus',sync);window.clearInterval(receiptTimer);void db.removeChannel(channel);};
   // loadMessages is called with latest list and via realtime, not a hook dependency to avoid resubscribing for every message.
   // eslint-disable-next-line react-hooks/exhaustive-deps
 },[active]);
 useLayoutEffect(()=>{
   const node=scrollRef.current;
   if(!active||!node)return;
   const anchor=scrollAnchorRef.current;
   if(anchor?.conversationId===active){
     node.scrollTop=anchor.top+node.scrollHeight-anchor.height;
     scrollAnchorRef.current=null;
   }else if(followLatestRef.current){
     node.scrollTop=node.scrollHeight;
   }
 },[active,messages]);

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

 async function startDirectMessage(other:Person){
   if(!auth.user||creating)return;
   if(other.id===auth.user.id||!friends.some(friend=>friend.id===other.id)){
     setError('Escolha uma conexão aceita.');return;
   }
   setCreating(true);setError('');
   try{
     const existing=threads.find(t=>!t.group&&t.other?.id===other.id);
     if(existing){setActive(existing.id);setRecipient('');return;}
     const {data:id,error:e}=await supabaseBrowser().rpc('create_conversation_with_members',{
       _title:'Conversa privada',_other_user_ids:[other.id]
     });
     if(e)throw e;
     if(!id)throw new Error('A conversa não foi criada.');
     setRecipient('');await loadThreads();setActive(id as string);
   }catch(e){
     setError(e instanceof Error?e.message:'Não foi possível iniciar a conversa.');
   }finally{setCreating(false);}
 }
 async function begin(event:FormEvent){
   event.preventDefault();
   const handle=recipient.trim().replace(/^@/,'').toLowerCase();
   const other=friends.find(p=>p.handle.toLowerCase()===handle);
   if(!other){setError('Conexão não encontrada.');return;}
   await startDirectMessage(other);
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
     const {data:sent,error:sendError}=await db.from('messages').insert({
       conversation_id:active,sender_id:auth.user.id,content:value,
       media_path:uploadedPath||null,media_type:mediaType,reply_to:replyTo?.id||null
     }).select('id').single();
     if(sendError)throw sendError;
     if(sent?.id)void notifyChatMessageSent(sent.id);
     setCompose('');setAttachment(null);setReplyTo(null);await loadMessages(active);await loadThreads();
   }catch(e){
     if(uploadedPath)await db.storage.from('social-media').remove([uploadedPath]);
     setError(e instanceof Error?e.message:'Não foi possível enviar a mensagem.');
   }finally{setSending(false);}
 }

 async function togglePin(messageId:string){
   if(!active||settingsBusy)return;
   setSettingsBusy(true);setError('');
   const {error:e}=await supabaseBrowser().rpc('toggle_conversation_pin',{
     _conversation:active,_message:messageId
   });
   if(e)setError('Não foi possível fixar a mensagem: '+e.message);
   else await loadPins(active);
   setSettingsBusy(false);
 }
 async function toggleMute(){
   if(!active||!auth.user||settingsBusy)return;
   setSettingsBusy(true);setError('');
   const entry=threads.find(t=>t.id===active);
   const muted=Boolean(entry?.mutedUntil&&Date.parse(entry.mutedUntil)>Date.now());
   const {error:e}=await supabaseBrowser().from('conversation_members')
     .update({muted_until:muted?null:new Date(Date.now()+30*86400_000).toISOString()})
     .eq('conversation_id',active).eq('user_id',auth.user.id);
   if(e)setError('Não foi possível silenciar: '+e.message);
   else await loadThreads();
   setSettingsBusy(false);
 }
 async function saveGroupSettings(event:FormEvent){
   event.preventDefault();if(!active||settingsBusy||!settingsTitle.trim())return;
   setSettingsBusy(true);setError('');
   const {error:e}=await supabaseBrowser().rpc('rename_conversation_group',{
     _conversation:active,_title:settingsTitle.trim()
   });
   if(e)setError('Falha ao renomear grupo: '+e.message);
   else{await loadThreads();setSettingsOpen(false);}
   setSettingsBusy(false);
 }
 async function inviteGroupFriend(){
   if(!active||!inviteFriend||settingsBusy)return;
   setSettingsBusy(true);setError('');
   if(!groupAccess(auth.user?.id,current?.created_by,visibleCoadmins,Boolean(current?.group),groupAllowsInvite,groupAllowsRemove).canInvite)return;
   const {error:e}=await supabaseBrowser().rpc('add_conversation_group_member',{
      _conversation:active,_friend:inviteFriend
   });
   if(e)setError('Não foi possível convidar: '+e.message);
   else{setInviteFriend('');await loadThreads();}
   setSettingsBusy(false);
 }
 async function leaveCurrentGroup(){
   if(!active||!current?.group||settingsBusy)return;
   if(!confirm('Sair deste grupo? O histórico permanecerá para os outros participantes.'))return;
   setSettingsBusy(true);setError('');
   const {error:e}=await supabaseBrowser().rpc('leave_conversation_group',{_conversation:active});
   if(e)setError('Não foi possível sair: '+e.message);
   else{setActive(null);setMessages([]);setPins([]);await loadThreads();}
   setSettingsBusy(false);
 }
 async function removeGroupMember(person:Person){
   if(!active||settingsBusy||!current?.participants.some(p=>p.id===person.id)||
      !canRemoveGroupTarget(access,person.id,current?.created_by,visibleCoadmins))return;
   if(!confirm('Remover '+person.display_name+' deste grupo? A pessoa perderá acesso às mensagens.'))return;
   setSettingsBusy(true);setError('');
   try{
     const {error:e}=await supabaseBrowser().rpc('remove_conversation_group_member',{
       _conversation:active,_member:person.id
     });
     if(e)throw e;
     await loadThreads();await loadGroupPermissions(active);
   }catch(e){setError('Não foi possível remover integrante: '+(e instanceof Error?e.message:'Tente novamente.'));}
   finally{setSettingsBusy(false);}
 }
 async function toggleGroupCoadmin(person:Person){
   if(!active||!access.canManageAdmins||settingsBusy)return;
   const enabled=!visibleCoadmins.includes(person.id);
   if(!confirm((enabled?'Promover ':'Retirar a administração de ')+person.display_name+'?'))return;
   setSettingsBusy(true);setError('');
   try{
     const {error:e}=await supabaseBrowser().rpc('set_conversation_group_moderator',{
       _conversation:active,_member:person.id,_enabled:enabled
     });
     if(e)throw e;
     await loadGroupPermissions(active);
   }catch(e){setError('Não foi possível alterar coadministrador: '+(e instanceof Error?e.message:'Tente novamente.'));}
   finally{setSettingsBusy(false);}
 }
 async function saveGroupPermissions(nextInvite:boolean,nextRemove:boolean){
   if(!active||!access.isOwner||settingsBusy)return;
   setSettingsBusy(true);setError('');
   try{
     const {error:e}=await supabaseBrowser().rpc('set_conversation_group_permissions',{
       _conversation:active,_can_invite:nextInvite,_can_remove:nextRemove
     });
     if(e)throw e;
     await loadGroupPermissions(active);
   }catch(e){setError('Não foi possível atualizar permissões: '+(e instanceof Error?e.message:'Tente novamente.'));}
   finally{setSettingsBusy(false);}
 }
 async function transferGroupOwnership(){
   if(!active||!transferOwner||!canManageGroup||settingsBusy)return;
   const chosen=current?.participants.find(p=>p.id===transferOwner);
   if(!chosen||!confirm('Transferir a administração para '+chosen.display_name+'?'))return;
   setSettingsBusy(true);setError('');
   const {error:e}=await supabaseBrowser().rpc('transfer_conversation_group_owner',{
     _conversation:active,_new_owner:chosen.id
   });
   if(e)setError('Não foi possível transferir: '+e.message);
   else{setTransferOwner('');setSettingsOpen(false);await loadThreads();await loadGroupPermissions(active);}
   setSettingsBusy(false);
 }
 async function block(){
   const person=threads.find(t=>t.id===active)?.other;
   if(!person||!auth.user||!confirm('Bloquear @'+person.handle+'? Vocês não poderão trocar novas mensagens até o desbloqueio.'))return;
   const {error:e}=await supabaseBrowser().from('user_blocks').insert({blocker_id:auth.user.id,blocked_id:person.id});
   if(e)setError(e.message);
   else{setError('Usuário bloqueado. Para desbloquear, use o perfil público.');}
 }
 const filtered=threads.filter(t=>([t.title||'',t.other?.display_name||'',t.other?.handle||'',...t.participants.map(p=>p.display_name)].join(' ')).toLowerCase().includes(threadSearch.toLowerCase()));
 const filteredConnections=friends.filter(person=>
  (person.display_name+' '+person.handle).toLocaleLowerCase('pt-BR')
   .includes(connectionSearch.trim().toLocaleLowerCase('pt-BR')))
  .sort((a,b)=>a.display_name.localeCompare(b.display_name,'pt-BR'));
 const current=threads.find(t=>t.id===active);
 const currentlyMuted=Boolean(current?.mutedUntil&&Date.parse(current.mutedUntil)>Date.now());
 const visibleCoadmins=groupPermissionsFor===active?groupCoadmins:[];
 const access=groupAccess(auth.user?.id,current?.created_by,visibleCoadmins,
   Boolean(current?.group),groupPermissionsFor===active&&groupAllowsInvite,
   groupPermissionsFor===active&&groupAllowsRemove);
 const canManageGroup=access.isOwner;
 const availableGroupFriends=friends.filter(friend=>
  friend.id!==auth.user?.id&&!current?.participants.some(member=>member.id===friend.id));
 const typingNames=typingIds.map(id=>current?.participants.find(p=>p.id===id)?.display_name||'Alguém');
 return <GuardedPage {...auth}><main className="section-page">
   <div className="page-heading"><div><span className="section-eyebrow">MENSAGENS REAIS · AMIZADES ACEITAS</span><h1>Conversas <span className="wave">✳</span></h1><p>Troque mensagens privadas, músicas e emojis com suas amizades.</p></div></div>
   <div className={'conecta-chat-layout card'+(active?' conecta-chat-has-active':'')}>
     <aside className="conecta-chat-sidebar">
       <div className="feed-title"><h2>Caixa de entrada</h2><ChatMissedCalls/><button className="icon-btn" title="Atualizar" onClick={()=>void loadThreads()}><RefreshCw size={18}/></button></div>
       <label className="searchbox"><Search size={17}/><input aria-label="Filtrar conversas" placeholder="Buscar conversa..." value={threadSearch} onChange={e=>setThreadSearch(e.target.value)}/></label>
       <section className="conecta-chat-connections" aria-label="Lista de conexões">
         <div className="conecta-chat-connections-heading">
           <button className="conecta-chat-connections-toggle" type="button"
             aria-expanded={connectionsExpanded} onClick={()=>setConnectionsExpanded(open=>!open)}>
             <Users size={16}/><strong>Minhas conexões</strong>
             <span className="conecta-chat-connections-count">{friends.length}</span>
           </button>
           <Link href="/explorar" title="Encontrar novas conexões" aria-label="Encontrar conexões"><UserPlus size={17}/></Link>
         </div>
         {connectionsExpanded&&<>
           <label className="searchbox"><Search size={15}/>
             <input aria-label="Buscar conexões por nome ou usuário" value={connectionSearch}
               placeholder="Buscar nome ou @usuário" onChange={e=>setConnectionSearch(e.target.value)}/>
           </label>
           <ChatPresenceToggle/><div className="conecta-chat-connections-list" role="list">
             {filteredConnections.map(person=><div className="conecta-chat-connection-item" role="listitem" key={person.id}>
               <button type="button" className="conecta-chat-contact-button" disabled={creating}
                 aria-label={'Conversar com '+person.display_name}
                 onClick={()=>void startDirectMessage(person)}>
                 <ProfileAvatar person={person} size="small"/>
                 <span className="conecta-chat-contact-details">
                   <strong>{person.display_name} <ChatOnlineStatus userId={person.id}/></strong><small>@{person.handle}</small>
                 </span><MessageCircle size={16}/></button>
             </div>)}
             {!loading&&filteredConnections.length===0&&<p className="small-note">
               {friends.length?'Nenhuma conexão corresponde à pesquisa.':'Você ainda não tem conexões aceitas.'}
             </p>}
           </div>
         </>}
       </section>
       {recipient&&<form className="conecta-chat-new" onSubmit={begin}>
         <label htmlFor="conecta-recipient">Conversa solicitada</label>
         <input id="conecta-recipient" className="form-input" value={recipient} readOnly/>
         <button className="btn btn-primary" type="submit" disabled={creating}>Abrir conversa</button>
       </form>}
       <button type="button" className="btn btn-outline" aria-expanded={groupOpen} onClick={()=>{setGroupOpen(open=>!open);setError('');}}><Users size={16}/> {groupOpen?'Fechar grupo':'Criar grupo'}</button>
       {groupOpen&&<form onSubmit={beginGroup} className="conecta-chat-new" style={{display:'grid',gap:10}}>
         <label htmlFor="group-title">Nome do grupo</label>
         <input id="group-title" className="form-input" value={groupTitle} onChange={e=>setGroupTitle(e.target.value)} maxLength={80} required placeholder="Ex.: Amigos da música"/>
         <fieldset style={{border:0,padding:0,margin:0,maxHeight:150,overflowY:'auto'}}>
           <legend>Selecione ao menos 2 amizades</legend>
           {friends.map(person=><label key={person.id} className="conecta-chat-group-contact">
             <input type="checkbox" checked={groupMembers.includes(person.id)}
               onChange={e=>setGroupMembers(current=>e.target.checked?[...current,person.id]:current.filter(id=>id!==person.id))}/>
             <ProfileAvatar person={person} size="small"/>
             <span><strong>{person.display_name}</strong><small>@{person.handle}</small></span>
           </label>)}
         </fieldset>
         <button className="btn btn-primary" type="submit" disabled={creating||!groupTitle.trim()||groupMembers.length<2}>Criar conversa em grupo</button>
       </form>}
       {loading?<p className="small-note">Carregando amizades e conversas...</p>:null}
       {!loading&&friends.length===0&&<p className="small-note">Adicione e aceite amizades antes de iniciar uma conversa. <Link className="rail-link" href="/explorar">Explorar pessoas</Link></p>}
       {!loading&&filtered.length===0&&<p className="small-note">Nenhuma conversa encontrada.</p>}
       <div className="conecta-chat-threads">{filtered.map(t=><button key={t.id} className={'conecta-chat-thread '+(t.id===active?'active':'')} onClick={()=>setActive(t.id)}>
         {t.group?<span className="concept-round-icon violet"><Users size={18}/></span>:<ProfileAvatar person={t.other}/>}
         <span><strong>{t.group?(t.title||'Grupo'):t.other?.display_name||'Conversa privada'} {!t.group&&<ChatOnlineStatus userId={t.other?.id}/>}</strong><small>{t.group?(t.participants.length+1)+' membros':('@'+(t.other?.handle||'contato'))} · {t.last?.content?.slice(0,55)||(t.last?.media_type==='image'?'📷 Foto':t.last?.media_type==='video'?'🎬 Vídeo':t.last?.media_type==='audio'?'🎤 Áudio':'Comece a conversar')}</small></span>
         <span className="conecta-chat-thread-meta">
           {t.mutedUntil&&Date.parse(t.mutedUntil)>Date.now()&&<BellOff size={13} aria-label="Conversa silenciada"/>}
           <time>{new Date(t.last?.created_at||t.created_at).toLocaleDateString('pt-BR')}</time>
          {t.unread>0&&<span className="conecta-chat-unread" aria-label={t.unread+' mensagens não lidas'}>
             {t.unread>99?'99+':t.unread}</span>}</span>
       </button>)}</div>
     </aside>
     <section className="conecta-chat-main">
       {active?<><header className="conecta-chat-head">
          <button type="button" className="icon-btn conecta-chat-mobile-back"
            aria-label="Voltar à lista de conversas" onClick={()=>setActive(null)}>
            <Reply size={19}/></button>{current?.group?<span className="concept-round-icon violet"><Users size={20}/></span>:<ProfileAvatar person={current?.other}/>}
         <div><strong>{current?.group?(current.title||'Grupo'):current?.other?.display_name||'Conversa'} {!current?.group&&<ChatOnlineStatus userId={current?.other?.id} showText/>}</strong>
         <small>{current?.group?current.participants.map(p=>p.display_name).join(', '):(current?.other?.handle?'@'+current.other.handle:'Mensagens privadas')}</small></div>
         {!current?.group&&<ChatCallButtons conversationId={current?.id} calleeId={current?.other?.id} calleeName={current?.other?.display_name}/>}
         <ChatPushControl/>
         <button className="icon-btn" type="button"
             title={currentlyMuted?'Reativar indicador no chat':'Silenciar indicador no chat por 30 dias'}
             aria-label={currentlyMuted?'Reativar indicador':'Silenciar conversa'} disabled={settingsBusy}
             onClick={()=>void toggleMute()}>{currentlyMuted?<BellOff size={18}/>:<Bell size={18}/>}</button>
          {current?.group&&!canManageGroup&&<button type="button"
             className="btn btn-outline conecta-chat-leave" disabled={settingsBusy}
             onClick={()=>void leaveCurrentGroup()}>Sair do grupo</button>}
          {(access.canInvite||access.canRemove||access.canManageAdmins)&&<button className="icon-btn" type="button"
             title="Configurações do grupo" aria-label="Configurações do grupo"
             aria-expanded={settingsOpen}
             onClick={()=>{setSettingsOpen(v=>!v);setSettingsTitle(current?.title||'');}}>
             <Settings2 size={18}/></button>}
          <button className="icon-btn" type="button" title={searchOpen?'Fechar busca':'Buscar nesta conversa'}
            aria-label="Buscar mensagens nesta conversa" aria-expanded={searchOpen}
            onClick={()=>{setSearchOpen(open=>!open);setMessageSearch('');setSearchHits([]);}}>
            <Search size={18}/></button>
          {current?.other&&!current.group&&<><Link className="icon-btn" title="Ver perfil" href={'/p/'+current.other.handle}><UserRound size={19}/></Link><button className="icon-btn" type="button" title="Bloquear usuário" onClick={block}><Shield size={19}/></button></>}
       </header>
       {
         settingsOpen&&(access.canInvite||access.canRemove||access.canManageAdmins)&&<section className="conecta-chat-group-settings" aria-label="Administrar grupo">
          {access.canRename&&<form onSubmit={saveGroupSettings} className="conecta-chat-manage-row">
            <label htmlFor="conecta-group-rename">Nome do grupo</label>
            <input id="conecta-group-rename" className="form-input" value={settingsTitle} maxLength={80}
               onChange={e=>setSettingsTitle(e.target.value)} required/>
            <button className="btn btn-outline" type="submit"
              disabled={settingsBusy||settingsTitle.trim().length<2}>Salvar nome</button>
          </form>}
          {access.canInvite&&<div className="conecta-chat-manage-row">
            <label htmlFor="conecta-group-invite">Adicionar uma amizade</label>
            <select id="conecta-group-invite" className="form-input" value={inviteFriend}
              onChange={e=>setInviteFriend(e.target.value)}>
              <option value="">Escolha um contato...</option>
              {availableGroupFriends.map(p=><option key={p.id} value={p.id}>{p.display_name} (@{p.handle})</option>)}
            </select>
            <button className="btn btn-outline" type="button" disabled={!inviteFriend||settingsBusy}
              onClick={()=>void inviteGroupFriend()}><UserPlus size={15}/> Convidar</button>
          </div>}
          <div className="conecta-chat-group-roster">
            <strong>Integrantes do grupo ({(current?.participants.length||0)+1})</strong>
            {current?.participants.map(person=><div className="conecta-chat-roster-member" key={person.id}>
              <ProfileAvatar person={person} size="small"/>
              <span><strong>{person.display_name}</strong><small>@{person.handle}{visibleCoadmins.includes(person.id)?' · Coadministrador':''}</small></span>
              {access.canManageAdmins&&<button className="btn btn-outline" type="button" disabled={settingsBusy}
                aria-label={(visibleCoadmins.includes(person.id)?'Revogar coadmin de ':'Promover coadmin: ')+person.display_name}
                onClick={()=>void toggleGroupCoadmin(person)}>
                {visibleCoadmins.includes(person.id)?'Revogar admin':'Tornar admin'}</button>}
              {canRemoveGroupTarget(access,person.id,current?.created_by,visibleCoadmins)&&
                <button className="btn btn-outline" type="button" disabled={settingsBusy}
                aria-label={'Remover '+person.display_name+' do grupo'}
                onClick={()=>void removeGroupMember(person)}><Trash2 size={15}/> Remover</button>}
            </div>)}
          </div>
          {access.isOwner&&<div className="conecta-chat-group-permissions">
            <strong>Permissões de coadministradores</strong>
            <label><input type="checkbox" checked={groupAllowsInvite} disabled={settingsBusy}
              onChange={event=>void saveGroupPermissions(event.target.checked,groupAllowsRemove)}/>
              Podem convidar suas conexões</label>
            <label><input type="checkbox" checked={groupAllowsRemove} disabled={settingsBusy}
              onChange={event=>void saveGroupPermissions(groupAllowsInvite,event.target.checked)}/>
              Podem remover integrantes comuns</label>
          </div>}
          {access.canTransfer&&<div className="conecta-chat-manage-row">
            <label htmlFor="conecta-group-transfer">Transferir administração</label>
            <select id="conecta-group-transfer" className="form-input" value={transferOwner}
              onChange={e=>setTransferOwner(e.target.value)}>
              <option value="">Escolha um integrante...</option>
              {current?.participants.map(person=><option key={person.id} value={person.id}>
                {person.display_name} (@{person.handle})
              </option>)}
            </select>
            <button type="button" className="btn btn-outline" disabled={!transferOwner||settingsBusy}
              onClick={()=>void transferGroupOwnership()}>Transferir</button>
          </div>}
          <small>Somente o proprietário pode mudar administradores, renomear ou transferir o grupo. Um coadministrador nunca pode remover outro administrador.</small>
         </section>}
        {current?.group&&canManageGroup&&<p className="conecta-chat-owner-note">
          Para sair do grupo, transfira primeiro a administração.
        </p>}
        {pins.length>0&&<section className="conecta-chat-pins" aria-label="Mensagens fixadas">
          {pins.map(pin=><button type="button" key={pin.message_id}
             onClick={()=>{
               const node=messageNodes.current[pin.message_id];
               if(node){setHighlighted(pin.message_id);node.scrollIntoView({behavior:'smooth',block:'center'});}
               else setError('Esta mensagem é antiga. Carregue mensagens anteriores para localizá-la.');
             }}>
             <Pin size={13}/><span>{pin.content.slice(0,130)||'Anexo fixado'}</span>
          </button>)}
        </section>}
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
        <div className="conecta-chat-log" ref={scrollRef} aria-live="polite"
         onScroll={event=>{
           const node=event.currentTarget;
           followLatestRef.current=node.scrollHeight-node.scrollTop-node.clientHeight<96;
         }}>
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
              {(!current?.group||canManageGroup)&&<button type="button" disabled={settingsBusy}
                title={pins.some(p=>p.message_id===m.id)?'Desafixar mensagem':'Fixar mensagem'}
                onClick={()=>void togglePin(m.id)}>
               {pins.some(p=>p.message_id===m.id)?<PinOff size={14}/>:<Pin size={14}/>}
               {pins.some(p=>p.message_id===m.id)?'Desafixar':'Fixar'}</button>}
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
       {typingNames.length>0&&<div className="conecta-chat-typing" role="status" aria-live="polite">
          <span className="conecta-typing-dots"><i/><i/><i/></span>
          {typingNames.slice(0,2).join(', ')} {typingNames.length>1?'estão digitando':'está digitando'}...
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
