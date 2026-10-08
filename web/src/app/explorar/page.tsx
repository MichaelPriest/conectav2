'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Compass, Search, UserRound, Users, Heart, ArrowUpRight, Sparkles } from 'lucide-react';
import { GuardedPage, useAuthProfile } from '@/components/app-shell';
import { supabaseBrowser } from '@/lib/supabase/browser';
import type { UserProfile } from '@/lib/types';

type Community = {id:string;slug:string;name:string;description:string;owner_id:string};
type DiscoveryPost = {id:string;content:string;created_at:string;author_id:string;profiles:{display_name:string;handle:string}|null};
type Filter = 'Tudo'|'Pessoas'|'Comunidades'|'Publicações';

export default function Explorar() {
  const auth=useAuthProfile();
  const [people,setPeople]=useState<UserProfile[]>([]);
  const [communities,setCommunities]=useState<Community[]>([]);
  const [posts,setPosts]=useState<DiscoveryPost[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState<Filter>('Tudo');

  useEffect(()=>{
    if(!auth.user)return;
    let active=true;
    async function load() {
      const db=supabaseBrowser();
      const [p,c,post]=await Promise.all([
        db.from('profiles').select('id,handle,display_name,bio,avatar_path').order('created_at',{ascending:false}).limit(60),
        db.from('communities').select('id,slug,name,description,owner_id').order('created_at',{ascending:false}).limit(50),
        db.from('posts').select('id,content,created_at,author_id,profiles!posts_author_id_fkey(display_name,handle)').eq('visibility','public').is('community_id',null).order('created_at',{ascending:false}).limit(20)
      ]);
      if(!active)return;
      const failure=p.error||c.error||post.error;
      if(failure)setError(failure.message);
      else {
        setPeople((p.data||[]) as UserProfile[]);
        setCommunities((c.data||[]) as Community[]);
        setPosts((post.data||[]) as unknown as DiscoveryPost[]);
      }
      setLoading(false);
    }
    void load();
    return ()=>{active=false;};
  },[auth.user]);

  const needle=search.toLocaleLowerCase('pt-BR').trim();
  const visiblePeople=useMemo(()=>people.filter(p=>p.id!==auth.user?.id&&(!needle||(p.display_name+' '+p.handle+' '+p.bio).toLowerCase().includes(needle))),[people,needle,auth.user]);
  const visibleCommunities=useMemo(()=>communities.filter(c=>!needle||(c.name+' '+c.description).toLowerCase().includes(needle)),[communities,needle]);
  const visiblePosts=useMemo(()=>posts.filter(p=>!needle||(p.content+' '+(p.profiles?.display_name||'')).toLowerCase().includes(needle)),[posts,needle]);
  const showPeople=filter==='Tudo'||filter==='Pessoas',showCommunities=filter==='Tudo'||filter==='Comunidades',showPosts=filter==='Tudo'||filter==='Publicações';
  const hasContent=(showPeople&&visiblePeople.length>0)||(showCommunities&&visibleCommunities.length>0)||(showPosts&&visiblePosts.length>0);

  return <GuardedPage {...auth}>
    <main className="section-page">
      <div className="page-heading"><div><span className="section-eyebrow">DESCUBRA</span><h1>Explorar <span className="wave">✳</span></h1><p>Pessoas, conversas e comunidades para inspirar você.</p></div></div>
      <div className="section-toolbar">
        <label className="searchbox"><Search size={18}/><input aria-label="Buscar no explorar" placeholder="Buscar pessoas, comunidades, publicações..." value={search} onChange={e=>setSearch(e.target.value)}/></label>
      </div>
      <div className="filter-pills" role="group" aria-label="Tipo de conteúdo">
        {(['Tudo','Pessoas','Comunidades','Publicações'] as Filter[]).map(f=><button className={'filter-pill '+(filter===f?'active':'')} type="button" key={f} onClick={()=>setFilter(f)}>{f}</button>)}
      </div>
      {error&&<p className="form-error" role="alert">{error}</p>}
      {loading&&<div className="centered-loading">Carregando descoberta...</div>}
      {!loading&&<>
        {showPeople&&visiblePeople.length>0&&<section><div className="feed-title" style={{margin:'30px 0 16px'}}><h2>Pessoas para conhecer</h2><span>{visiblePeople.length} resultados</span></div><div className="tiles-grid">{visiblePeople.map(p=><article className="tile-card" key={p.id}><div className="tile-avatar"><UserRound size={25}/></div><h3>{p.display_name}</h3><span className="tile-meta">@{p.handle}</span><p>{p.bio||'Conheça mais sobre essa pessoa.'}</p><Link className="btn btn-outline" href={'/p/'+p.handle}>Ver perfil <ArrowUpRight size={16}/></Link></article>)}</div></section>}
        {showCommunities&&visibleCommunities.length>0&&<section><div className="feed-title" style={{margin:'30px 0 16px'}}><h2>Comunidades</h2><Link href="/comunidades">Ver todas</Link></div><div className="tiles-grid">{visibleCommunities.map(c=><article className="tile-card" key={c.id}><div className="tile-avatar"><Users size={25}/></div><h3>{c.name}</h3><p>{c.description||'Encontre pessoas com o mesmo interesse.'}</p><Link className="btn btn-outline" href={'/comunidades/'+c.slug}>Conhecer <ArrowUpRight size={16}/></Link></article>)}</div></section>}
        {showPosts&&visiblePosts.length>0&&<section><div className="feed-title" style={{margin:'30px 0 16px'}}><h2>Publicações públicas</h2><span>Conversas recentes</span></div><div className="tiles-grid">{visiblePosts.map(p=><article className="tile-card" key={p.id}><span className="tile-meta">Por {p.profiles?.display_name||'Pessoa'} · {new Date(p.created_at).toLocaleDateString('pt-BR')}</span><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{p.content||'Publicação com mídia'}</p><Link className="btn btn-outline" href={'/feed?post='+p.id}>Ver publicação <ArrowUpRight size={16}/></Link></article>)}</div></section>}
        {!hasContent&&<div className="empty-state card" style={{marginTop:24}}><Compass size={28}/><h3>Nada por aqui ainda</h3><p>{needle?'Tente outra busca.':'Seja um dos primeiros a participar do Conecta.'}</p></div>}
      </>}
    </main>
  </GuardedPage>;
}
