'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Plus, Search, Users, X } from 'lucide-react';
import { GuardedPage, useAuthProfile } from '@/components/app-shell';
import { supabaseBrowser } from '@/lib/supabase/browser';
import {optimizeImage} from '@/lib/media';

type Community={id:string;owner_id:string|null;slug:string;name:string;description:string;created_at:string;cover_path:string|null;avatar_path:string|null;is_official:boolean};

export default function Comunidades() {
  const auth=useAuthProfile();
  const [items,setItems]=useState<Community[]>([]);
  const [joined,setJoined]=useState<Set<string>>(new Set());
  const [covers,setCovers]=useState<Record<string,string>>({});
  const [avatars,setAvatars]=useState<Record<string,string>>({});
  const [search,setSearch]=useState('');
  const [onlyMine,setOnlyMine]=useState(false);
  const [modal,setModal]=useState(false);
  const [name,setName]=useState('');
  const [slug,setSlug]=useState('');
  const [description,setDescription]=useState('');
  const [rules,setRules]=useState('');
  const [coverFile,setCoverFile]=useState<File|null>(null);
  const [avatarFile,setAvatarFile]=useState<File|null>(null);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const load=useCallback(async()=>{
    if(!auth.user)return;
    const db=supabaseBrowser();
    const [communityResult,membershipResult]=await Promise.all([
      db.from('communities').select('id,owner_id,slug,name,description,created_at,cover_path,avatar_path,is_official').order('created_at',{ascending:false}).limit(100),
      db.from('community_members').select('community_id').eq('user_id',auth.user.id)
    ]);
    if(communityResult.error||membershipResult.error)setError(communityResult.error?.message||membershipResult.error?.message||'Falha ao carregar.');
    else {setItems((communityResult.data||[]) as Community[]);setJoined(new Set((membershipResult.data||[]).map(x=>x.community_id)));}
    const rows=(communityResult.data||[]) as Community[];
    const db=supabaseBrowser();
    const assets=rows.flatMap(item=>[item.cover_path?{id:item.id,kind:'cover',path:item.cover_path}:null,
      item.avatar_path?{id:item.id,kind:'avatar',path:item.avatar_path}:null].filter((asset):asset is {id:string;kind:string;path:string}=>!!asset));
    if(assets.length){
      const urls=await Promise.all(assets.map(asset=>db.storage.from('social-media').createSignedUrl(asset.path,1800)));
      const cv:Record<string,string>={}, av:Record<string,string>={};
      assets.forEach((asset,i)=>{const url=urls[i].data?.signedUrl;if(url)(asset.kind==='cover'?cv:av)[asset.id]=url;});
      setCovers(cv);setAvatars(av);
    }
    setLoading(false);
  },[auth.user]);

  useEffect(()=>{if(auth.user)void load();},[auth.user,load]);
  const filtered=useMemo(()=>items.filter(c=>(c.name+' '+c.description).toLowerCase().includes(search.toLowerCase().trim())&&(!onlyMine||joined.has(c.id))),[items,search,onlyMine,joined]);

  async function create(e:FormEvent) {
    e.preventDefault();
    if(!auth.user||busy)return;
    setBusy(true);setError('');
    const normalized=slug.toLowerCase().trim().replaceAll(' ','-');
    if(!/^[a-z0-9-]{3,60}$/.test(normalized)){setError('O endereço deve ter 3 a 60 caracteres, letras minúsculas, números ou hífens.');setBusy(false);return;}
    const db=supabaseBrowser();
    const uploaded:string[]=[];
    try{
      const payload:{owner_id:string;name:string;slug:string;description:string;rules:string;cover_path?:string;avatar_path?:string}={
        owner_id:auth.user.id,name:name.trim(),slug:normalized,description:description.trim(),rules:rules.trim()
      };
      for(const [kind,file] of [['cover_path',coverFile],['avatar_path',avatarFile]] as const){
        if(!file)continue;
        if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)throw new Error('Use JPG/PNG/WebP de até 8 MB para imagens da comunidade.');
        const optimized=await optimizeImage(file);
        const path=auth.user.id+'/community/'+crypto.randomUUID()+'.'+(optimized.name.split('.').pop()||'webp');
        const {error:e}=await db.storage.from('social-media').upload(path,optimized,{contentType:optimized.type});
        if(e)throw e;
        uploaded.push(path);payload[kind]=path;
      }
      const {data,error:creationError}=await db.from('communities').insert(payload).select('id').single();
      if(creationError)throw creationError;
      const {error:joinError}=await db.from('community_members').insert({community_id:data.id,user_id:auth.user.id});
      if(joinError)setError('Comunidade criada, mas não foi possível entrar automaticamente: '+joinError.message);
      else {setModal(false);setName('');setSlug('');setDescription('');setRules('');setCoverFile(null);setAvatarFile(null);}
    }catch(err){
      if(uploaded.length)await db.storage.from('social-media').remove(uploaded);
      setError(err instanceof Error?err.message:'Erro ao criar a comunidade.');
    }
    setBusy(false);await load();
  }

  return <GuardedPage {...auth}>
    <main className="section-page">
      <div className="page-heading"><div><span className="section-eyebrow">CONEXÕES EM GRUPO</span><h1>Comunidades <span className="wave">✳</span></h1><p>Encontre sua tribo e compartilhe o que te inspira.</p></div></div>
      <div className="section-toolbar">
        <label className="searchbox"><Search size={18}/><input aria-label="Buscar comunidades" placeholder="Buscar comunidades..." value={search} onChange={e=>setSearch(e.target.value)}/></label>
        <button className="btn btn-primary" onClick={()=>setModal(true)}><Plus size={18}/> Criar comunidade</button>
      </div>
      <div className="filter-pills concept-directory-filters" role="group" aria-label="Filtrar comunidades"><button type="button" className={'filter-pill '+(!onlyMine?'active':'')} onClick={()=>setOnlyMine(false)}>Todas</button><button type="button" className={'filter-pill '+(onlyMine?'active':'')} onClick={()=>setOnlyMine(true)}>Minhas comunidades</button></div>
      {error&&<p className="form-error" role="alert">{error}</p>}
      {loading?<div className="centered-loading">Carregando comunidades...</div>:filtered.length>0?
        <div className="tiles-grid concept-directory-grid">{filtered.map(c=><article className="tile-card concept-directory-card" key={c.id}>
          <div className="concept-group-cover conecta-directory-cover" style={covers[c.id]?{backgroundImage:'linear-gradient(0deg,#10173b4a,#ffffff16),url('+JSON.stringify(covers[c.id])+')',backgroundSize:'cover',backgroundPosition:'center'}:undefined}><span className="tile-avatar">{avatars[c.id]?<img src={avatars[c.id]} alt="" className="conecta-directory-avatar"/>:<Users size={24}/>}</span></div>
          <h3>{c.name} {c.is_official&&<span className="conecta-official-mark" title="Comunidade inicial do Conecta">✦</span>}</h3><p>{c.description||'Uma comunidade para trocar ideias.'}</p>
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
            <label className="field-label">Regras da comunidade<textarea className="form-input" rows={3} value={rules} onChange={e=>setRules(e.target.value)} maxLength={3000} placeholder="Como as pessoas devem participar?"/></label>
            <label className="field-label">Capa da comunidade<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setCoverFile(e.target.files?.[0]||null)}/></label>
            <label className="field-label">Ícone da comunidade<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setAvatarFile(e.target.files?.[0]||null)}/></label>
            <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={()=>setModal(false)}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={busy}>{busy?'Criando...':'Criar comunidade'}</button></div>
          </form>
        </section>
      </div>}
    </main>
  </GuardedPage>;
}
