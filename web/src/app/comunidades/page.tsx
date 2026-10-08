'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Plus, Search, Users, X } from 'lucide-react';
import { GuardedPage, useAuthProfile } from '@/components/app-shell';
import { supabaseBrowser } from '@/lib/supabase/browser';

type Community={id:string;owner_id:string;slug:string;name:string;description:string;created_at:string};

export default function Comunidades() {
  const auth=useAuthProfile();
  const [items,setItems]=useState<Community[]>([]);
  const [joined,setJoined]=useState<Set<string>>(new Set());
  const [search,setSearch]=useState('');
  const [modal,setModal]=useState(false);
  const [name,setName]=useState('');
  const [slug,setSlug]=useState('');
  const [description,setDescription]=useState('');
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const load=useCallback(async()=>{
    if(!auth.user)return;
    const db=supabaseBrowser();
    const [communityResult,membershipResult]=await Promise.all([
      db.from('communities').select('id,owner_id,slug,name,description,created_at').order('created_at',{ascending:false}).limit(100),
      db.from('community_members').select('community_id').eq('user_id',auth.user.id)
    ]);
    if(communityResult.error||membershipResult.error)setError(communityResult.error?.message||membershipResult.error?.message||'Falha ao carregar.');
    else {setItems((communityResult.data||[]) as Community[]);setJoined(new Set((membershipResult.data||[]).map(x=>x.community_id)));}
    setLoading(false);
  },[auth.user]);

  useEffect(()=>{if(auth.user)void load();},[auth.user,load]);
  const filtered=useMemo(()=>items.filter(c=>(c.name+' '+c.description).toLowerCase().includes(search.toLowerCase().trim())),[items,search]);

  async function create(e:FormEvent) {
    e.preventDefault();
    if(!auth.user||busy)return;
    setBusy(true);setError('');
    const normalized=slug.toLowerCase().trim().replaceAll(' ','-');
    if(!/^[a-z0-9-]{3,60}$/.test(normalized)){setError('O endereço deve ter 3 a 60 caracteres, letras minúsculas, números ou hífens.');setBusy(false);return;}
    const db=supabaseBrowser();
    const {data,error:creationError}=await db.from('communities').insert({owner_id:auth.user.id,name:name.trim(),slug:normalized,description:description.trim()}).select('id').single();
    if(creationError){setError(creationError.message);setBusy(false);return;}
    const {error:joinError}=await db.from('community_members').insert({community_id:data.id,user_id:auth.user.id});
    if(joinError)setError('Comunidade criada, mas não foi possível entrar automaticamente: '+joinError.message);
    else {setModal(false);setName('');setSlug('');setDescription('');}
    setBusy(false);await load();
  }

  return <GuardedPage {...auth}>
    <main className="section-page">
      <div className="page-heading"><div><span className="section-eyebrow">CONEXÕES EM GRUPO</span><h1>Comunidades <span className="wave">✳</span></h1><p>Encontre sua tribo e compartilhe o que te inspira.</p></div></div>
      <div className="section-toolbar">
        <label className="searchbox"><Search size={18}/><input aria-label="Buscar comunidades" placeholder="Buscar comunidades..." value={search} onChange={e=>setSearch(e.target.value)}/></label>
        <button className="btn btn-primary" onClick={()=>setModal(true)}><Plus size={18}/> Criar comunidade</button>
      </div>
      {error&&<p className="form-error" role="alert">{error}</p>}
      {loading?<div className="centered-loading">Carregando comunidades...</div>:filtered.length>0?
        <div className="tiles-grid">{filtered.map(c=><article className="tile-card" key={c.id}>
          <div className="tile-avatar"><Users size={24}/></div>
          <h3>{c.name}</h3><p>{c.description||'Uma comunidade para trocar ideias.'}</p>
          <span className="tile-meta">{joined.has(c.id)?'✓ Você participa':c.owner_id===auth.user?.id?'Criada por você':'Aberta para participar'}</span>
          <Link href={'/comunidades/'+c.slug} className="btn btn-outline">Ver comunidade <ArrowUpRight size={16}/></Link>
        </article>)}</div>
        :<div className="empty-state card"><Users size={28}/><h3>{search?'Nenhuma comunidade encontrada':'Ainda não existem comunidades'}</h3><p>Crie uma comunidade e dê início a uma nova conversa.</p></div>}
      {modal&&<div className="modal-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(false);}}>
        <section role="dialog" aria-modal="true" aria-label="Criar comunidade" className="modal-card">
          <div className="feed-title"><h2>Nova comunidade</h2><button className="icon-btn" onClick={()=>setModal(false)} aria-label="Fechar"><X size={20}/></button></div>
          <form className="stack" onSubmit={create}>
            <label className="field-label">Nome da comunidade<input className="form-input" required minLength={3} maxLength={100} value={name} onChange={e=>{setName(e.target.value);if(!slug)setSlug(e.target.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''));}} placeholder="Ex.: Amantes de fotografia"/></label>
            <label className="field-label">Endereço (slug)<input className="form-input" required minLength={3} maxLength={60} value={slug} onChange={e=>setSlug(e.target.value)} placeholder="amantes-de-fotografia"/></label>
            <label className="field-label">Descrição<textarea className="form-input" rows={4} value={description} onChange={e=>setDescription(e.target.value)} maxLength={2000} placeholder="Conte sobre sua comunidade..."/></label>
            <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={()=>setModal(false)}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={busy}>{busy?'Criando...':'Criar comunidade'}</button></div>
          </form>
        </section>
      </div>}
    </main>
  </GuardedPage>;
}
