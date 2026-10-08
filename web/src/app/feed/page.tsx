'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, Globe2, ImagePlus, Loader2, Send, Smile, Sparkles, Video, X } from 'lucide-react';
import { GuardedPage, useAuthProfile } from '@/components/app-shell';
import { PostCard } from '@/components/post-card';
import { supabaseBrowser } from '@/lib/supabase/browser';
import type { FeedPost } from '@/lib/types';
import { optimizeImage } from '@/lib/media';
import { FeaturedCommunities } from '@/components/featured-communities';

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
  const [fileMode,setFileMode]=useState<'image'|'video'>('image');
  const [preview,setPreview]=useState<string|null>(null);
  useEffect(() => {
    if (!file) {setPreview(null);return;}
    const objectUrl=URL.createObjectURL(file);
    setPreview(objectUrl);
    return ()=> URL.revokeObjectURL(objectUrl);
  },[file]);
  function chooseFile(mode:'image'|'video'){
    setFileMode(mode);
    if(picker.current){
      picker.current.accept=mode==='image'?'image/jpeg,image/png,image/webp,image/gif':'video/mp4,video/webm';
      picker.current.click();
    }
  }

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
    <div className="page-columns concept-feed-columns"><main className="content-column">
      <div className="page-heading concept-feed-heading"><div><span className="section-eyebrow">NOVAS HISTÓRIAS, NOVAS CONEXÕES</span><h1>Seu feed</h1><p>Novas histórias, pessoas e ideias para um mundo mais conectado.</p></div><span className="concept-feed-sparkle" aria-hidden="true">✦</span></div>
      <section className="composer card concept-composer" id="composer">
        <div className="composer-top"><span className="avatar avatar-gradient">{profile?.display_name?.charAt(0).toUpperCase()||'C'}</span><div className="concept-composer-heading"><strong>{profile?.display_name ? 'Compartilhe um momento, '+profile.display_name.split(' ')[0] : 'O que você está pensando hoje?'}</strong><span>Uma boa história merece ser compartilhada.</span></div></div>
        <form onSubmit={publish}>
          <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="No que você está pensando hoje?" maxLength={3000} rows={3}/>
          {file && <div className="concept-attachment">
            {preview && (file.type.startsWith('video/')?<video src={preview} controls preload="metadata"/>:<img src={preview} alt="Pré-visualização da imagem anexada"/>)}
            <div className="selected-file"><span>{file.name}</span><button className="icon-btn" type="button" onClick={()=>setFile(null)} aria-label="Remover arquivo"><X size={16}/></button></div>
          </div>}
          <div className="composer-bottom concept-composer-toolbar">
            <div className="composer-tools concept-composer-tools">
              <input ref={picker} type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>setFile(e.target.files?.[0]||null)}/>
              <button type="button" onClick={()=>chooseFile('image')}><ImagePlus size={18}/> Foto</button>
              <button type="button" onClick={()=>chooseFile('video')}><Video size={18}/> Vídeo</button>
              <button type="button" onClick={()=>setText(previous=>previous + (previous && !previous.endsWith(' ')?' ':'')+'💜')}><Smile size={18}/> Sentimento</button>
            </div>
            <div className="concept-composer-submit"><select aria-label="Privacidade da publicação" value={privacy} onChange={e=>setPrivacy(e.target.value as typeof privacy)}><option value="public">Público</option><option value="friends">Amigos</option><option value="private">Só eu</option></select><button className="btn btn-primary" type="submit" disabled={busy||(!text.trim()&&!file)}>{busy?<Loader2 className="spin" size={17}/>:<Send size={17}/>} Publicar</button></div>
          </div>
        </form>
        {message&&<p role="alert" className="form-error">{message}</p>}
      </section>
      <div className="feed-title concept-feed-title"><h2>Publicações recentes</h2><span>Mais recentes primeiro</span></div>
      <div className="feed-list">{posts.length===0&&!loadingFeed&&<div className="empty-state card concept-empty-feed"><span className="concept-empty-illustration"><Sparkles size={34}/></span><h3>Boas histórias começam aqui.</h3><p>O Conecta está esperando sua primeira publicação. Convide amigos, conte algo e faça parte desta comunidade.</p><a className="btn btn-primary" href="#composer">Criar primeira publicação</a></div>}{posts.map(p=><PostCard key={p.id} post={p} userId={user?.id||''} refresh={()=>fetchPosts()}/>)}</div>
      {loadingFeed&&<div className="centered-loading"><Loader2 className="spin" size={23}/> Carregando publicações...</div>}
      {!loadingFeed&&hasMore&&<button type="button" className="btn btn-outline btn-block" onClick={()=>fetchPosts(offset,true)}>Carregar mais</button>}
    </main>
    <FeaturedCommunities/></div>
  </GuardedPage>;
}
