'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, Globe2, ImagePlus, Loader2, Send, Smile, Sparkles, Video, X } from 'lucide-react';
import { GuardedPage, useAuthProfile } from '@/components/app-shell';
import { PostCard } from '@/components/post-card';
import { supabaseBrowser } from '@/lib/supabase/browser';
import type { FeedPost } from '@/lib/types';
import { optimizeImage } from '@/lib/media';
import { hydratePostMedia } from '@/lib/post-media';
import { FeaturedCommunities } from '@/components/featured-communities';
import {EmojiButton} from '@/components/emoji-button';
import {PollDraft,validatePoll} from '@/components/poll-draft';
import {attachPoll} from '@/lib/create-poll';
import {BarChart3} from 'lucide-react';

const PAGE_SIZE=15;

export default function FeedPage() {
  const {user,profile,loading,error}=useAuthProfile();
  const [posts,setPosts]=useState<FeedPost[]>([]);
  const [loadingFeed,setLoadingFeed]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [text,setText]=useState('');
  const [privacy,setPrivacy]=useState<'public'|'friends'|'private'>('public');
  const [files,setFiles]=useState<File[]>([]);
  const [pollMode,setPollMode]=useState(false);
  const [pollOptions,setPollOptions]=useState(['','']);
  const [pollDays,setPollDays]=useState(7);
  const [hasMore,setHasMore]=useState(false);
  const [offset,setOffset]=useState(0);
  const picker=useRef<HTMLInputElement>(null);
  const [fileMode,setFileMode]=useState<'image'|'video'>('image');
  const [previews,setPreviews]=useState<string[]>([]);
  useEffect(() => {
    const urls=files.map(file=>URL.createObjectURL(file));
    setPreviews(urls);
    return ()=>urls.forEach(url=>URL.revokeObjectURL(url));
  },[files]);
  function chooseFile(mode:'image'|'video'){
    setFileMode(mode);
    if(picker.current){
      picker.current.accept=mode==='image'?'image/jpeg,image/png,image/webp,image/gif':'video/mp4,video/webm';
      picker.current.multiple=mode==='image';
      picker.current.click();
    }
  }
  function selectFiles(event:React.ChangeEvent<HTMLInputElement>) {
    const selected=Array.from(event.target.files||[]);
    const isImage=fileMode==='image';
    const eligible=selected.filter(item => isImage
      ? ['image/jpeg','image/png','image/webp','image/gif'].includes(item.type)
      : ['video/mp4','video/webm'].includes(item.type));
    setPollMode(false);setFiles(eligible.slice(0,isImage?5:1));
    if(selected.length>5)setMessage('Você pode selecionar até cinco fotos por publicação.');
    event.target.value='';
  }

  const fetchPosts=useCallback(async (from=0,append=false) => {
    if(!user)return;
    setLoadingFeed(true);setMessage('');
    const db=supabaseBrowser();
    const {data,error:queryError}=await db.from('posts')
      .select('id,author_id,content,visibility,media_path,media_type,created_at,profiles!posts_author_id_fkey(handle,display_name),post_likes(count),post_comments(count),post_media(storage_path,media_type,position)')
      .is('community_id',null).order('created_at',{ascending:false})
      .range(from,from+PAGE_SIZE-1);
    if(queryError){setMessage(queryError.message);setLoadingFeed(false);return;}
    const rows=(data||[]) as unknown as FeedPost[];
    const decorated=await hydratePostMedia(db,rows);
    setPosts(prev=>append?[...prev,...decorated]:decorated);
    setOffset(from+rows.length);
    setHasMore(rows.length===PAGE_SIZE);
    setLoadingFeed(false);
  },[user]);

  useEffect(()=>{if(user)void fetchPosts();},[user,fetchPosts]);

  async function publish(e: FormEvent) {
    e.preventDefault();
    if(!user || (!text.trim()&&files.length===0)||busy)return;
    if(pollMode){try{validatePoll(text,pollOptions);}catch(e){setMessage(e instanceof Error?e.message:'Enquete inválida.');return;}}
    setBusy(true);setMessage('');
    const db=supabaseBrowser();
    const uploaded:{storage_path:string;media_type:'image'|'video';position:number}[]=[];
    let createdPostId:string|null=null;
    let rollbackFailed=false;
    try {
      if(files.some(file=>file.size>50*1024*1024))throw new Error('Cada arquivo pode ter no máximo 50 MB.');
      if(files.length>5)throw new Error('Limite de cinco mídias por publicação.');
      if(files.some(file=>file.type.startsWith('video/'))&&files.length>1)throw new Error('Publique um vídeo por vez.');
      for(const [position,file] of files.entries()){
        const optimized=file.type.startsWith('image/')?await optimizeImage(file):file;
        const media_type:'image'|'video'=optimized.type.startsWith('video/')?'video':'image';
        const extension=optimized.name.split('.').pop()?.toLowerCase()||'bin';
        const storage_path=`${user.id}/${crypto.randomUUID()}.${extension}`;
        const {error:storageError}=await db.storage.from('social-media')
          .upload(storage_path,optimized,{contentType:optimized.type,upsert:false});
        if(storageError)throw storageError;
        uploaded.push({storage_path,media_type,position});
      }
      const first=uploaded[0];
      const {data:created,error:insertError}=await db.from('posts')
        .insert({author_id:user.id,content:text.trim(),visibility:privacy,
          media_path:first?.storage_path??null,media_type:first?.media_type??null})
        .select('id').single();
      if(insertError)throw insertError;
      createdPostId=created.id;
      if(pollMode)await attachPoll(db,created.id,text,pollOptions,pollDays);
      if(uploaded.length){
        const {error:galleryError}=await db.from('post_media').insert(uploaded.map(asset=>({
          post_id:created.id,owner_id:user.id,...asset
        })));
        if(galleryError)throw galleryError;
      }
      setText('');setFiles([]);setPollMode(false);setPollOptions(['','']);
      await fetchPosts();
    }catch(err){
      if(createdPostId){
        const {error:deleteError}=await db.from('posts').delete().eq('id',createdPostId);
        rollbackFailed=Boolean(deleteError);
      }
      if(!rollbackFailed&&uploaded.length)await db.storage.from('social-media')
        .remove(uploaded.map(item=>item.storage_path));
      setMessage((err instanceof Error?err.message:'Não foi possível publicar.') +
        (rollbackFailed?' A publicação parcial precisa ser removida manualmente.':''));
    }finally{setBusy(false);}
  }

  return <GuardedPage profile={profile} loading={loading} error={error}>
    <div className="page-columns concept-feed-columns"><main className="content-column">
      <div className="page-heading concept-feed-heading"><div><span className="section-eyebrow">NOVAS HISTÓRIAS, NOVAS CONEXÕES</span><h1>Seu feed</h1><p>Novas histórias, pessoas e ideias para um mundo mais conectado.</p></div><span className="concept-feed-sparkle" aria-hidden="true">✦</span></div>
      <section className="composer card concept-composer" id="composer">
        <div className="composer-top"><span className="avatar avatar-gradient">{profile?.display_name?.charAt(0).toUpperCase()||'C'}</span><div className="concept-composer-heading"><strong>{profile?.display_name ? 'Compartilhe um momento, '+profile.display_name.split(' ')[0] : 'O que você está pensando hoje?'}</strong><span>Uma boa história merece ser compartilhada.</span></div></div>
        <form onSubmit={publish}>
          <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="No que você está pensando hoje?" maxLength={3000} rows={3}/>
          {pollMode&&<PollDraft question={text} options={pollOptions} onOptionsChange={setPollOptions} days={pollDays} onDaysChange={setPollDays}/>}
          {files.length>0&&<div className="concept-attachment">
            <div className={'composer-preview-grid '+(files.length>1?'multiple':'')}>
              {files.map((file,index)=><div className="composer-preview-item" key={file.name+index}>
                {previews[index]&&(file.type.startsWith('video/')
                  ?<video src={previews[index]} controls preload="metadata"/>
                  :<img src={previews[index]} alt={'Prévia '+(index+1)}/>)}
                <button className="composer-preview-remove" type="button" onClick={()=>setFiles(previous=>previous.filter((_,i)=>i!==index))} aria-label={'Remover mídia '+(index+1)}><X size={15}/></button>
              </div>)}
            </div>
            <p className="small-note">{files.length} {files.length===1?'arquivo selecionado':'arquivos selecionados'} · até 5 fotos por publicação</p>
          </div>}
          <div className="composer-bottom concept-composer-toolbar">
            <div className="composer-tools concept-composer-tools">
              <input ref={picker} type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif" onChange={selectFiles}/>
              <button type="button" onClick={()=>chooseFile('image')}><ImagePlus size={18}/> Foto</button>
              <button type="button" onClick={()=>chooseFile('video')}><Video size={18}/> Vídeo</button>
              <EmojiButton onSelect={emoji=>setText(previous=>(previous+emoji).slice(0,3000))}/>
              <button type="button" onClick={()=>{setPollMode(v=>!v);setFiles([]);}} aria-pressed={pollMode}><BarChart3 size={18}/> Enquete</button>
            </div>
            <div className="concept-composer-submit"><select aria-label="Privacidade da publicação" value={privacy} onChange={e=>setPrivacy(e.target.value as typeof privacy)}><option value="public">Público</option><option value="friends">Amigos</option><option value="private">Só eu</option></select><button className="btn btn-primary" type="submit" disabled={busy||(!text.trim()&&files.length===0)}>{busy?<Loader2 className="spin" size={17}/>:<Send size={17}/>} Publicar</button></div>
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
