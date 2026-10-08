'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Compass, ImagePlus, Loader2, Plus, Send, Sparkles, Users, X } from 'lucide-react';
import { GuardedPage, useAuthProfile } from '@/components/app-shell';
import { PostCard } from '@/components/post-card';
import { supabaseBrowser } from '@/lib/supabase/browser';
import type { FeedPost } from '@/lib/types';
import { optimizeImage } from '@/lib/media';

const PAGE_SIZE=15;

export default function FeedPage() {
  const {user,profile,loading,error}=useAuthProfile();
  const [posts,setPosts]=useState<FeedPost[]>([]);
  const [loadingFeed,setLoadingFeed]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [text,setText]=useState('');
  const [privacy,setPrivacy]=useState<'public'|'friends'|'private'>('public');
  const [file,setFile]=useState<File|null>(null);
  const [hasMore,setHasMore]=useState(false);
  const [offset,setOffset]=useState(0);
  const picker=useRef<HTMLInputElement>(null);

  const fetchPosts=useCallback(async (from=0,append=false) => {
    if(!user)return;
    setLoadingFeed(true);setMessage('');
    const db=supabaseBrowser();
    const {data,error:queryError}=await db.from('posts')
      .select('id,author_id,content,visibility,media_path,media_type,created_at,profiles!posts_author_id_fkey(handle,display_name),post_likes(count),post_comments(count)')
      .is('community_id',null).order('created_at',{ascending:false})
      .range(from,from+PAGE_SIZE-1);
    if(queryError){setMessage(queryError.message);setLoadingFeed(false);return;}
    const rows=(data||[]) as unknown as FeedPost[];
    const decorated=await Promise.all(rows.map(async p=>{
      if(!p.media_path)return p;
      const {data:media,error:mediaError}=await db.storage.from('social-media').createSignedUrl(p.media_path,3600);
      return {...p,mediaUrl:mediaError?null:media?.signedUrl};
    }));
    setPosts(prev=>append?[...prev,...decorated]:decorated);
    setOffset(from+rows.length);
    setHasMore(rows.length===PAGE_SIZE);
    setLoadingFeed(false);
  },[user]);

  useEffect(()=>{if(user)void fetchPosts();},[user,fetchPosts]);

  async function publish(e: FormEvent) {
    e.preventDefault();
    if(!user || (!text.trim()&&!file)||busy)return;
    setBusy(true);setMessage('');
    const db=supabaseBrowser();
    let media_path:string|null=null,media_type:'image'|'video'|null=null;
    try {
      if(file) {
        if(file.size>50*1024*1024)throw new Error('O limite de mídia nesta fase é de 50 MB.');
        if(!['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'].includes(file.type))throw new Error('Formato de mídia não suportado.');
        const optimized = file.type.startsWith('image/') ? await optimizeImage(file) : file;
        media_type=optimized.type.startsWith('video/')?'video':'image';
        const extension=optimized.name.split('.').pop()?.toLowerCase()||'bin';
        media_path=`${user.id}/${crypto.randomUUID()}.${extension}`;
        const {error:storageError}=await db.storage.from('social-media').upload(media_path,optimized,{contentType:optimized.type,upsert:false});
        if(storageError)throw storageError;
      }
      const {error:insertError}=await db.from('posts').insert({author_id:user.id,content:text.trim(),visibility:privacy,media_path,media_type});
      if(insertError)throw insertError;
      setText('');setFile(null);
      await fetchPosts();
    }catch(err){
      if(media_path)await db.storage.from('social-media').remove([media_path]);
      setMessage(err instanceof Error?err.message:'Não foi possível publicar.');
    }finally{setBusy(false);}
  }

  return <GuardedPage profile={profile} loading={loading} error={error}>
    <div className="page-columns"><main className="content-column">
      <div className="page-heading"><div><span className="section-eyebrow">SEU ESPAÇO</span><h1>Seu feed <span className="wave">✳</span></h1><p>As conexões de hoje começam aqui.</p></div></div>
      <section className="composer card">
        <div className="composer-top"><span className="avatar avatar-gradient">{profile?.display_name?.charAt(0).toUpperCase()||'C'}</span><div><strong>Compartilhe com a comunidade</strong><span>O que você está pensando?</span></div></div>
        <form onSubmit={publish}>
          <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Conte uma novidade, compartilhe uma ideia..." maxLength={3000} rows={3}/>
          {file&&<div className="selected-file"><span>{file.name}</span><button className="icon-btn" type="button" onClick={()=>setFile(null)} aria-label="Remover arquivo"><X size={16}/></button></div>}
          <div className="composer-bottom"><div className="composer-tools"><input ref={picker} type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" onChange={e=>setFile(e.target.files?.[0]||null)}/><button className="icon-btn composer-media" type="button" title="Anexar foto ou vídeo" onClick={()=>picker.current?.click()}><ImagePlus size={21}/></button><select aria-label="Privacidade da publicação" value={privacy} onChange={e=>setPrivacy(e.target.value as typeof privacy)}><option value="public">Público</option><option value="friends">Amigos</option><option value="private">Só eu</option></select></div><button className="btn btn-primary" type="submit" disabled={busy||(!text.trim()&&!file)}>{busy?<Loader2 className="spin" size={17}/>:<Send size={17}/>} Publicar</button></div>
        </form>
        {message&&<p role="alert" className="form-error">{message}</p>}
      </section>
      <div className="feed-title"><h2>Publicações recentes</h2><span>Mais recentes primeiro</span></div>
      <div className="feed-list">{posts.length===0&&!loadingFeed&&<div className="empty-state card"><Sparkles size={27}/><h3>O feed está esperando por você</h3><p>Publique o primeiro momento da comunidade!</p></div>}{posts.map(p=><PostCard key={p.id} post={p} userId={user?.id||''} refresh={()=>fetchPosts()}/>)}</div>
      {loadingFeed&&<div className="centered-loading"><Loader2 className="spin" size={23}/> Carregando publicações...</div>}
      {!loadingFeed&&hasMore&&<button type="button" className="btn btn-outline btn-block" onClick={()=>fetchPosts(offset,true)}>Carregar mais</button>}
    </main>
    <aside className="right-rail"><div className="discover-panel"><div className="discover-icon"><Sparkles size={20}/></div><h3>Bem-vindo ao novo Conecta!</h3><p>Um lugar para trocar ideias, fazer amigos e encontrar novas comunidades.</p><Link href="/comunidades" className="rail-link">Explorar comunidades <Users size={17}/></Link></div>
    <div className="rail-card card"><h3>Descubra algo novo</h3><Link href="/explorar" className="rail-row"><Compass size={20}/> Conheça pessoas <Plus size={16}/></Link><Link href="/comunidades" className="rail-row"><Users size={20}/> Comunidades <Plus size={16}/></Link></div><p className="rail-footer">Conecta V2 · Uma rede social feita para pessoas.</p></aside></div>
  </GuardedPage>;
}
