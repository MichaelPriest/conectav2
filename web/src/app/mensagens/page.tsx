'use client';
import {FormEvent,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {MessageCircle,Plus,Send,RefreshCw,Search,UserRound,Shield,Music2,Trash2,ArrowLeft} from 'lucide-react';
import {GuardedPage,useAuthProfile} from '@/components/app-shell';
import {supabaseBrowser} from '@/lib/supabase/browser';
import {EmojiButton} from '@/components/emoji-button';
import {MusicEmbed,parseMusicUrl} from '@/components/music-embed';

type Person={id:string;handle:string;display_name:string;avatar_path:string|null};
type Conversation={id:string;title:string|null;created_at:string;created_by:string};
type Message={id:string;sender_id:string;content:string;created_at:string;conversation_id:string};
type Thread=Conversation & {other:Person|null;last:Message|null};
const PER_PAGE=60;

export default function Messages(){
 const auth=useAuthProfile();
 const [threads,setThreads]=useState<Thread[]>([]);
 const [friends,setFriends]=useState<Person[]>([]);
 const [active,setActive]=useState<string|null>(null);
 const [messages,setMessages]=useState<Message[]>([]);
 const [recipient,setRecipient]=useState('');
 const [compose,setCompose]=useState('');
 const [creating,setCreating]=useState(false),[sending,setSending]=useState(false);
 const [loading,setLoading]=useState(true),[loadingMessages,setLoadingMessages]=useState(false);
 const [hasOlder,setHasOlder]=useState(false),[error,setError]=useState('');
 const [threadSearch,setThreadSearch]=useState('');
 const scrollRef=useRef<HTMLDivElement>(null);

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
     const [conversations,lastMessages]=await Promise.all([
       db.from('conversations').select('id,title,created_at,created_by').in('id',ids).order('created_at',{ascending:false}),
       db.from('messages').select('id,conversation_id,sender_id,content,created_at')
         .in('conversation_id',ids).order('created_at',{ascending:false}).limit(200)
     ]);
     if(conversations.error||lastMessages.error)setError(conversations.error?.message||lastMessages.error?.message||'Não foi possível carregar chats.');
     const mostRecent=new Map<string,Message>();
     ((lastMessages.data||[]) as Message[]).forEach(m=>{if(!mostRecent.has(m.conversation_id))mostRecent.set(m.conversation_id,m);});
     const assembled=((conversations.data||[]) as Conversation[]).map(c=>({
       ...c,
       other:byId.get(pairs.find(p=>p.conversation_id===c.id&&p.user_id!==auth.user!.id)?.user_id||'')||null,
       last:mostRecent.get(c.id)||null
     }));
     assembled.sort((a,b)=>new Date(b.last?.created_at||b.created_at).getTime()-new Date(a.last?.created_at||a.created_at).getTime());
     setThreads(assembled);
   }else setThreads([]);
   setLoading(false);
 },[auth.user]);

 const loadMessages=useCallback(async(id:string,older=false)=>{
   setLoadingMessages(true);
   const db=supabaseBrowser();
   const {data,error:e}=await db.from('messages')
     .select('id,sender_id,content,created_at,conversation_id')
     .eq('conversation_id',id).order('created_at',{ascending:false})
     .range(older?messages.length:0,older?messages.length+PER_PAGE-1:PER_PAGE-1);
   if(e)setError(e.message);
   else {
     const chronological=[...((data||[]) as Message[])].reverse();
     setMessages(current=>older?[...chronological,...current]:chronological);
     setHasOlder((data||[]).length===PER_PAGE);
   }
   setLoadingMessages(false);
 },[messages.length]);

 useEffect(()=>{void loadThreads();},[loadThreads]);
 useEffect(()=>{
   if(!active)return;
   setMessages([]);void loadMessages(active);
   const db=supabaseBrowser();
   const channel=db.channel('conecta-inbox-'+active).on('postgres_changes',
     {schema:'public',table:'messages',event:'INSERT',filter:'conversation_id=eq.'+active},
     ()=>{void loadMessages(active);void loadThreads();}
   ).subscribe();
   return()=>{void db.removeChannel(channel);};
   // loadMessages is called with latest list and via realtime, not a hook dependency to avoid resubscribing for every message.
   // eslint-disable-next-line react-hooks/exhaustive-deps
 },[active]);
 useEffect(()=>{
   if(!loadingMessages && messages.length && scrollRef.current && !hasOlder){
     scrollRef.current.scrollTop=scrollRef.current.scrollHeight;
   }
 },[loadingMessages,messages.length,hasOlder]);

 async function begin(event:FormEvent){
   event.preventDefault();
   if(!auth.user||creating)return;
   const handle=recipient.trim().replace(/^@/,'').toLowerCase();
   const other=friends.find(p=>p.handle===handle);
   if(!other){setError('Para iniciar um chat, essa pessoa precisa ser uma amizade aceita.');return;}
   if(other.id===auth.user.id){setError('Escolha uma pessoa diferente.');return;}
   setCreating(true);setError('');
   const already=threads.find(t=>t.other?.id===other.id);
   if(already){setActive(already.id);setRecipient('');setCreating(false);return;}
   const db=supabaseBrowser();
   const {data:conversation,error:e}=await db.from('conversations')
     .insert({created_by:auth.user.id,title:'Conversa privada'}).select('id').single();
   if(e){setError(e.message);setCreating(false);return;}
   const {error:membersError}=await db.from('conversation_members').insert([
     {conversation_id:conversation.id,user_id:auth.user.id},
     {conversation_id:conversation.id,user_id:other.id}
   ]);
   if(membersError){setError(membersError.message+' (não foi possível adicionar os participantes).');}
   else{setActive(conversation.id);setRecipient('');await loadThreads();}
   setCreating(false);
 }

 async function send(e:FormEvent){
   e.preventDefault();if(!active||!auth.user||!compose.trim()||sending)return;
   setSending(true);setError('');
   const value=compose.trim();
   const {error:e}=await supabaseBrowser().from('messages').insert({
     conversation_id:active,sender_id:auth.user.id,content:value
   });
   if(e)setError(e.message);
   else{setCompose('');await loadMessages(active);await loadThreads();}
   setSending(false);
 }

 async function block(){
   const person=threads.find(t=>t.id===active)?.other;
   if(!person||!auth.user||!confirm('Bloquear @'+person.handle+'? Vocês não poderão trocar novas mensagens até o desbloqueio.'))return;
   const {error:e}=await supabaseBrowser().from('user_blocks').insert({blocker_id:auth.user.id,blocked_id:person.id});
   if(e)setError(e.message);
   else{setError('Usuário bloqueado. Para desbloquear, use o perfil público.');}
 }
 const filtered=threads.filter(t=>((t.other?.display_name||'')+' '+(t.other?.handle||'')).toLowerCase().includes(threadSearch.toLowerCase()));
 const current=threads.find(t=>t.id===active);
 return <GuardedPage {...auth}><main className="section-page">
   <div className="page-heading"><div><span className="section-eyebrow">MENSAGENS REAIS · AMIZADES ACEITAS</span><h1>Conversas <span className="wave">✳</span></h1><p>Troque mensagens privadas, músicas e emojis com suas amizades.</p></div></div>
   <div className="conecta-chat-layout card">
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
       {loading?<p className="small-note">Carregando amizades e conversas...</p>:null}
       {!loading&&friends.length===0&&<p className="small-note">Adicione e aceite amizades antes de iniciar uma conversa. <Link className="rail-link" href="/explorar">Explorar pessoas</Link></p>}
       {!loading&&filtered.length===0&&<p className="small-note">Nenhuma conversa encontrada.</p>}
       <div className="conecta-chat-threads">{filtered.map(t=><button key={t.id} className={'conecta-chat-thread '+(t.id===active?'active':'')} onClick={()=>setActive(t.id)}>
         <span className="avatar avatar-gradient">{t.other?.display_name[0]?.toUpperCase()||'C'}</span>
         <span><strong>{t.other?.display_name||'Conversa privada'}</strong><small>@{t.other?.handle||'contato'} · {t.last?.content?.slice(0,55)||'Comece a conversar'}</small></span>
         <time>{new Date(t.last?.created_at||t.created_at).toLocaleDateString('pt-BR')}</time>
       </button>)}</div>
     </aside>
     <section className="conecta-chat-main">
       {active?<><header className="conecta-chat-head"><span className="avatar avatar-gradient">{current?.other?.display_name?.[0]?.toUpperCase()||'C'}</span>
         <div><strong>{current?.other?.display_name||'Conversa'}</strong><small>{current?.other?.handle?'@'+current.other.handle:'Mensagens privadas'}</small></div>
         {current?.other&&<><Link className="icon-btn" title="Ver perfil" href={'/p/'+current.other.handle}><UserRound size={19}/></Link><button className="icon-btn" type="button" title="Bloquear usuário" onClick={block}><Shield size={19}/></button></>}
       </header>
       <div className="conecta-chat-log" ref={scrollRef} aria-live="polite">
         {hasOlder&&<button className="btn btn-outline" type="button" disabled={loadingMessages} onClick={()=>void loadMessages(active,true)}>Carregar mensagens anteriores</button>}
         {messages.length===0&&!loadingMessages&&<div className="empty-state"><MessageCircle size={30}/><h3>Uma nova conversa começa aqui.</h3><p>Respeite a privacidade e a vontade de quem participa.</p></div>}
         {messages.map(m=><article key={m.id} className={'conecta-message '+(m.sender_id===auth.user?.id?'own':'other')}>
           <p>{m.content}</p>{parseMusicUrl(m.content)&&<MusicEmbed url={m.content}/>}
           <time>{new Date(m.created_at).toLocaleString('pt-BR',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})}</time>
         </article>)}
       </div>
       <form className="conecta-chat-write" onSubmit={send}>
         <EmojiButton onSelect={emoji=>setCompose(t=>(t+emoji).slice(0,4000))}/>
         <input aria-label="Escrever mensagem" value={compose} onChange={e=>setCompose(e.target.value)} maxLength={4000} placeholder="Escreva uma mensagem..."/>
         <button className="btn btn-primary" type="submit" disabled={sending||!compose.trim()}><Send size={19}/><span>Enviar</span></button>
       </form></>:<div className="conecta-chat-welcome"><MessageCircle size={37}/><h2>Boas conversas começam aqui.</h2><p>Selecione uma conversa ou escolha uma amizade para falar.</p></div>}
     </section>
   </div>
   {error&&<p className="form-error" role="alert">{error}</p>}
   <p className="small-note" style={{marginTop:15}}>Mensagens protegidas por permissões do Supabase. Ainda não há criptografia de ponta a ponta nem controles completos para menores; não compartilhe dados sensíveis.</p>
 </main></GuardedPage>;
}
