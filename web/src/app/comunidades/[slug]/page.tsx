'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Check, MessageCircle, Send, Users, UserPlus } from 'lucide-react';
import { GuardedPage, useAuthProfile } from '@/components/app-shell';
import { PostCard } from '@/components/post-card';
import { supabaseBrowser } from '@/lib/supabase/browser';
import type {FeedPost} from '@/lib/types';

type Community = { id:string;name:string;slug:string;description:string;owner_id:string;created_at:string };
const PAGE_SIZE=15;

export default function CommunityDetail() {
  const auth=useAuthProfile();
  const params=useParams<{slug:string}>();
  const [community,setCommunity]=useState<Community|null>(null);
  const [member,setMember]=useState(false);
  const [count,setCount]=useState(0);
  const [posts,setPosts]=useState<FeedPost[]>([]);
  const [text,setText]=useState('');
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [hasMore,setHasMore]=useState(false);
  const [offset,setOffset]=useState(0);
  const [error,setError]=useState('');

  const fetchPosts=useCallback(async(id:string,from=0,append=false)=>{
    const db=supabaseBrowser();
    const {data,error:fetchError}=await db.from('posts')
      .select('id,author_id,content,visibility,media_path,media_type,created_at,profiles!posts_author_id_fkey(handle,display_name),post_likes(count),post_comments(count)')
      .eq('community_id',id).order('created_at',{ascending:false}).range(from,from+PAGE_SIZE-1);
    if(fetchError){setError(fetchError.message);return;}
    const results=(data||[]) as unknown as FeedPost[];
    const decorated=await Promise.all(results.map(async item=>{
      if(!item.media_path)return item;
      const {data:media}=await db.storage.from('social-media').createSignedUrl(item.media_path,3600);
      return {...item,mediaUrl:media?.signedUrl||null};
    }));
    setPosts(previous=>append?[...previous,...decorated]:decorated);
    setHasMore(results.length===PAGE_SIZE);
    setOffset(from+results.length);
  },[]);

  const load=useCallback(async()=>{
    if(!auth.user||!params.slug)return;
    setLoading(true);setError('');
    const db=supabaseBrowser();
    const {data,error:lookupError}=await db.from('communities').select('id,name,slug,description,owner_id,created_at').eq('slug',params.slug).maybeSingle();
    if(lookupError){setError(lookupError.message);setLoading(false);return;}
    setCommunity(data as Community|null);
    if(data){
      const [membership,members]=await Promise.all([
        db.from('community_members').select('user_id').eq('community_id',data.id).eq('user_id',auth.user.id).maybeSingle(),
        db.from('community_members').select('user_id',{count:'exact',head:true}).eq('community_id',data.id),
      ]);
      if(membership.error||members.error)setError(membership.error?.message||members.error?.message||'Erro ao carregar membros.');
      setMember(Boolean(membership.data));
      setCount(members.count||0);
      await fetchPosts(data.id);
    }
    setLoading(false);
  },[auth.user,params.slug,fetchPosts]);

  useEffect(()=>{void load();},[load]);

  async function toggleMembership(){
    if(!community||!auth.user||busy)return;
    setBusy(true);setError('');
    const db=supabaseBrowser();
    const result=member
      ? await db.from('community_members').delete().eq('community_id',community.id).eq('user_id',auth.user.id)
      : await db.from('community_members').insert({community_id:community.id,user_id:auth.user.id});
    if(result.error)setError(result.error.message);
    else {setMember(!member);setCount(previous=>previous+(member?-1:1));}
    setBusy(false);
  }

  async function publish(event:FormEvent){
    event.preventDefault();
    if(!community||!auth.user||!member||!text.trim()||busy)return;
    setBusy(true);setError('');
    const {error:insertError}=await supabaseBrowser().from('posts')
      .insert({author_id:auth.user.id,community_id:community.id,content:text.trim(),visibility:'public'});
    if(insertError)setError(insertError.message);
    else{setText('');await fetchPosts(community.id);}
    setBusy(false);
  }

  return <GuardedPage {...auth}><main className="section-page">
    <Link href="/comunidades" className="rail-link"><ArrowLeft size={16}/> Voltar às comunidades</Link>
    {loading?<div className="centered-loading">Carregando comunidade...</div>:!community?<div className="empty-state card" style={{marginTop:24}}><h3>Comunidade não encontrada</h3><p>Ela pode ter sido removida ou ter mudado de endereço.</p></div>:<>
      <div className="detail-header" style={{marginTop:19}}>
        <div className="eyebrow"><Users size={15}/> COMUNIDADE CONECTA</div>
        <h1>{community.name}</h1><p>{community.description||'Um lugar para compartilhar interesses e experiências.'}</p>
        <div className="community-members"><Users size={17}/> {count} {count===1?'membro':'membros'} · criada em {new Date(community.created_at).toLocaleDateString('pt-BR')}</div>
        <div className="detail-buttons">
          <button type="button" className={'btn '+(member?'btn-outline':'btn-primary')} onClick={toggleMembership} disabled={busy}>
            {member?<Check size={18}/>:<UserPlus size={18}/>} {member?'Participando — sair':'Participar da comunidade'}
          </button>
        </div>
      </div>
      {error&&<p className="form-error" role="alert">{error}</p>}
      {member&&<section className="composer card" style={{maxWidth:710}}>
        <div className="composer-top"><span className="avatar avatar-gradient">{auth.profile?.display_name?.[0]?.toUpperCase()||'C'}</span><div><strong>Nova discussão</strong><span>Compartilhe algo com a comunidade</span></div></div>
        <form onSubmit={publish}><textarea rows={3} value={text} onChange={e=>setText(e.target.value)} maxLength={3000} placeholder="O que você gostaria de compartilhar?"/><div className="composer-bottom"><span className="small-note">Visível publicamente nesta comunidade</span><button type="submit" className="btn btn-primary" disabled={busy||!text.trim()}><Send size={17}/> Publicar</button></div></form>
      </section>}
      {!member&&<div className="panel" style={{maxWidth:710,marginBottom:22}}><MessageCircle size={20} color="#8564eb"/><p className="muted" style={{margin:'9px 0 0'}}>Participe da comunidade para publicar discussões.</p></div>}
      <div className="feed-title" style={{maxWidth:710}}><h2>Discussões recentes</h2><span>Mais recentes primeiro</span></div>
      <div className="feed-list">{posts.length===0&&<div className="empty-state card"><MessageCircle size={25}/><h3>Sem discussões ainda</h3><p>Compartilhe a primeira ideia.</p></div>}{posts.map(p=><PostCard key={p.id} post={p} userId={auth.user?.id||''} refresh={()=>fetchPosts(community.id)}/>)}</div>
      {hasMore&&<button className="btn btn-outline" style={{marginTop:18}} onClick={()=>fetchPosts(community.id,offset,true)}>Carregar mais</button>}
    </>}
  </main></GuardedPage>;
}
