'use client';
import {FormEvent,useCallback,useEffect,useState} from 'react';
import {MessageCircle,Plus,Send,RefreshCw,Search,ArrowLeft,UserRound} from 'lucide-react';
import {GuardedPage,useAuthProfile} from '@/components/app-shell';
import {supabaseBrowser} from '@/lib/supabase/browser';

type Conversation={id:string;title:string|null;created_at:string;created_by:string};
type Message={id:string;sender_id:string;content:string;created_at:string;conversation_id:string};
export default function Messages() {
  const auth=useAuthProfile();
  const [threads,setThreads]=useState<Conversation[]>([]);
  const [active,setActive]=useState<string|null>(null);
  const [messages,setMessages]=useState<Message[]>([]);
  const [recipient,setRecipient]=useState('');
  const [compose,setCompose]=useState('');
  const [creating,setCreating]=useState(false);
  const [sending,setSending]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const loadThreads=useCallback(async()=>{
    if(!auth.user)return;
    const db=supabaseBrowser();
    const {data:membership,error:memberError}=await db.from('conversation_members').select('conversation_id').eq('user_id',auth.user.id);
    if(memberError){setError(memberError.message);setLoading(false);return;}
    const ids=(membership||[]).map(c=>c.conversation_id);
    if(ids.length===0){setThreads([]);setLoading(false);return;}
    const {data,error:e}=await db.from('conversations').select('id,title,created_at,created_by')
      .in('id',ids).order('created_at',{ascending:false});
    if(e)setError(e.message);else setThreads((data||[]) as Conversation[]);
    setLoading(false);
  },[auth.user]);
  const loadMessages=useCallback(async(id:string)=>{
    const {data,error:e}=await supabaseBrowser().from('messages')
      .select('id,sender_id,content,created_at,conversation_id')
      .eq('conversation_id',id).order('created_at',{ascending:true}).limit(200);
    if(e)setError(e.message);else setMessages((data||[]) as Message[]);
  },[]);
  useEffect(()=>{void loadThreads();},[loadThreads]);
  useEffect(()=>{
    if(!active)return;
    void loadMessages(active);
    const db=supabaseBrowser();
    const channel=db.channel('conecta-chat-'+active).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'conversation_id=eq.'+active},()=>void loadMessages(active)).subscribe();
    return ()=>{void db.removeChannel(channel);};
  },[active,loadMessages]);
  async function begin(e:FormEvent){
    e.preventDefault();
    if(!auth.user||creating)return;
    setCreating(true);setError('');
    const db=supabaseBrowser();
    const handle=recipient.trim().replace(/^@/,'').toLowerCase();
    const {data:other,error:lookupError}=await db.from('profiles').select('id,handle,display_name').eq('handle',handle).maybeSingle();
    if(lookupError||!other){setError(lookupError?.message||'Pessoa não encontrada.');setCreating(false);return;}
    if(other.id===auth.user.id){setError('Você não pode iniciar uma conversa consigo.');setCreating(false);return;}
    const {data:conversation,error:creationError}=await db.from('conversations').insert({created_by:auth.user.id,title:'Conversa'}).select('id').single();
    if(creationError){setError(creationError.message);setCreating(false);return;}
    const {error:membersError}=await db.from('conversation_members').insert([
      {conversation_id:conversation.id,user_id:auth.user.id},
      {conversation_id:conversation.id,user_id:other.id}
    ]);
    if(membersError){setError('Não foi possível adicionar os participantes: '+membersError.message);}
    else{setActive(conversation.id);setRecipient('');await loadThreads();}
    setCreating(false);
  }
  async function send(e:FormEvent){
    e.preventDefault();
    if(!active||!auth.user||!compose.trim()||sending)return;
    setSending(true);setError('');
    const {error:e}=await supabaseBrowser().from('messages').insert({conversation_id:active,sender_id:auth.user.id,content:compose.trim()});
    if(e)setError(e.message);else{setCompose('');await loadMessages(active);}
    setSending(false);
  }
  return <GuardedPage {...auth}><main className="section-page">
    <div className="page-heading"><div><span className="section-eyebrow">CONVERSE</span><h1>Mensagens <span className="wave">✳</span></h1><p>Suas conversas, em um lugar só.</p></div></div>
    <div className="concept-messenger card">
      <aside className="concept-thread-pane">
        <h2>Conversas <button className="icon-btn" aria-label="Recarregar conversas" title="Recarregar" onClick={()=>loadThreads()}><RefreshCw size={16}/></button></h2>
        <form onSubmit={begin} className="concept-chat-create"><label className="searchbox"><Search size={16}/><input aria-label="Nome de usuário para iniciar conversa" placeholder="Conversar com @usuario" value={recipient} onChange={e=>setRecipient(e.target.value)} required/></label><button className="btn btn-primary" type="submit" disabled={creating||!recipient.trim()}><Plus size={18}/></button></form>
        {loading&&<p className="muted">Carregando...</p>}
        {threads.length===0&&!loading&&<p className="small-note">Nenhuma conversa ainda. Busque uma pessoa pelo usuário para começar.</p>}
        {threads.map(t=><button key={t.id} className={'concept-thread '+(active===t.id?'active':'')} onClick={()=>setActive(t.id)}><span className="avatar avatar-gradient"><MessageCircle size={17}/></span><span><strong>{t.title||'Conversa'}</strong><small>{new Date(t.created_at).toLocaleDateString('pt-BR')}</small></span></button>)}
      </aside>
      <section className="concept-chat-pane">
        {active?<><div className="concept-chat-header"><MessageCircle size={19}/><strong>Conversa</strong><button className="icon-btn" aria-label="Atualizar mensagens" title="Atualizar" onClick={()=>loadMessages(active)}><RefreshCw size={17}/></button></div>
          <div className="concept-chat-messages" aria-live="polite">{messages.length===0&&<p className="small-note">Envie uma mensagem para começar.</p>}{messages.map(m=><div key={m.id} className={'concept-chat-bubble '+(m.sender_id===auth.user?.id?'mine':'theirs')}><p>{m.content}</p><small>{new Date(m.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small></div>)}</div>
          <form className="concept-chat-form" onSubmit={send}><input aria-label="Digite sua mensagem" maxLength={4000} value={compose} onChange={e=>setCompose(e.target.value)} placeholder="Escreva uma mensagem..."/><button className="btn btn-primary" disabled={sending||!compose.trim()}><Send size={19}/></button></form></>:
          <div className="concept-chat-empty"><MessageCircle size={35}/><h3>Boas conversas começam aqui.</h3><p>Escolha uma conversa ou busque uma pessoa para começar.</p></div>}
      </section>
    </div>
    {error&&<p className="form-error" role="alert">{error}</p>}
  </main></GuardedPage>;
}
