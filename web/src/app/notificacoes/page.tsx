'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {Bell, CheckCheck, Heart, MessageCircle, UserPlus, Users, Sparkles} from 'lucide-react';
import {GuardedPage,useAuthProfile} from '@/components/app-shell';
import {supabaseBrowser} from '@/lib/supabase/browser';

type Notice = {
  id:string; kind:string; created_at:string; read_at:string|null; entity_id:string|null;
  profiles:{display_name:string;handle:string}|null;
};
const labels:Record<string,string>={
  like:'curtiu sua publicação',comment:'comentou sua publicação',
  friend_request:'enviou uma solicitação de amizade',friend_accept:'aceitou sua amizade',
  community:'interagiu em uma comunidade'
};
const icons:Record<string,typeof Bell>={like:Heart,comment:MessageCircle,friend_request:UserPlus,friend_accept:Users,community:Users};

export default function Notifications() {
  const auth=useAuthProfile();
  const [items,setItems]=useState<Notice[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{
    if(!auth.user)return;
    const {data,error:queryError}=await supabaseBrowser().from('notifications')
      .select('id,kind,created_at,read_at,entity_id,profiles!notifications_actor_id_fkey(display_name,handle)')
      .eq('recipient_id',auth.user.id).order('created_at',{ascending:false}).limit(100);
    if(queryError)setError(queryError.message);else setItems((data||[]) as unknown as Notice[]);
    setLoading(false);
  },[auth.user]);
  useEffect(()=>{void load();},[load]);
  async function markRead(id?:string) {
    if(!auth.user||busy)return;
    setBusy(true);setError('');
    const client=supabaseBrowser();
    const query=client.from('notifications').update({read_at:new Date().toISOString()}).eq('recipient_id',auth.user.id);
    const {error:e}=id?await query.eq('id',id):await query.is('read_at',null);
    if(e)setError(e.message);else await load();
    setBusy(false);
  }
  const unread=items.filter(item=>!item.read_at).length;
  return <GuardedPage {...auth}><main className="section-page">
    <div className="page-heading"><div><span className="section-eyebrow">FIQUE POR DENTRO</span><h1>Notificações <span className="wave">✳</span></h1><p>As interações importantes aparecem aqui.</p></div></div>
    <div className="section-toolbar"><div className="filter-pills"><span className="filter-pill active">Todas {items.length}</span><span className="filter-pill">Não lidas {unread}</span></div><button className="btn btn-outline" disabled={unread===0||busy} onClick={()=>markRead()}><CheckCheck size={17}/> Marcar como lidas</button></div>
    {error&&<p role="alert" className="form-error">{error}</p>}
    {loading?<div className="centered-loading">Carregando notificações...</div>:items.length===0?
      <section className="empty-state card"><span className="concept-empty-illustration"><Bell size={34}/></span><h3>Tudo em dia!</h3><p>Quando alguém interagir com você, as notificações aparecerão aqui.</p><Link href="/explorar" className="btn btn-primary">Descobrir pessoas</Link></section>:
      <div className="notification-list">{items.map(item=>{
        const Icon=icons[item.kind]||Bell;
        return <article key={item.id} className={'notification-row card '+(!item.read_at?'unread':'')}>
          <span className="concept-round-icon violet"><Icon size={21}/></span>
          <div><p><strong>{item.profiles?.display_name||'Alguém'}</strong> {labels[item.kind]||'interagiu com você'}</p><time>{new Date(item.created_at).toLocaleString('pt-BR')}</time></div>
          {!item.read_at&&<button className="btn btn-outline" disabled={busy} onClick={()=>markRead(item.id)}>Marcar como lida</button>}
        </article>
      })}</div>}
  </main></GuardedPage>;
}
