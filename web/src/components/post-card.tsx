'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Heart, MessageCircle, Send, Share2, LockKeyhole, Users, Globe2, Trash2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { FeedPost, PostComment } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase/browser';
import {EmojiButton} from '@/components/emoji-button';
import {MusicEmbed,parseMusicUrl} from '@/components/music-embed';

function ago(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now()-new Date(value).getTime())/60000));
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes/60)} h`;
  return new Date(value).toLocaleDateString('pt-BR');
}

export function PostCard({ post, userId, refresh }: { post: FeedPost; userId: string; refresh: () => Promise<void> }) {
  const [liked, setLiked] = useState(false);
  const [pendingLike, setPendingLike] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [activeMediaIndex,setActiveMediaIndex] = useState<number|null>(null);
  const media = post.media?.length ? post.media : post.mediaUrl && post.media_type ? [{url:post.mediaUrl,type:post.media_type,path:post.media_path||''}] : [];
  useEffect(()=>{
    if(activeMediaIndex===null)return;
    function handleKey(e:KeyboardEvent){
      if(e.key==='Escape')setActiveMediaIndex(null);
      if(e.key==='ArrowLeft')setActiveMediaIndex(index => index===null?null:(index-1+media.length)%media.length);
      if(e.key==='ArrowRight')setActiveMediaIndex(index => index===null?null:(index+1)%media.length);
    }
    document.addEventListener('keydown',handleKey);
    return ()=>document.removeEventListener('keydown',handleKey);
  },[activeMediaIndex,media.length]);

  useEffect(() => {
    let live=true;
    void supabaseBrowser().from('post_likes').select('post_id').eq('post_id', post.id).eq('user_id', userId).maybeSingle()
      .then(({data}) => { if(live) setLiked(Boolean(data)); });
    return () => {live=false;};
  }, [post.id,userId]);

  async function like() {
    if (pendingLike) return;
    setPendingLike(true); setNotice('');
    const db = supabaseBrowser();
    const res = liked
      ? await db.from('post_likes').delete().eq('post_id',post.id).eq('user_id',userId)
      : await db.from('post_likes').insert({post_id:post.id,user_id:userId});
    if(res.error) setNotice('Não foi possível alterar a curtida.');
    else {setLiked(!liked);await refresh();}
    setPendingLike(false);
  }

  async function openComments() {
    if (commentsOpen) {setCommentsOpen(false);return;}
    setCommentsOpen(true);
    const { data, error } = await supabaseBrowser().from('post_comments')
      .select('id,post_id,author_id,body,created_at,profiles!post_comments_author_id_fkey(display_name,handle)')
      .eq('post_id',post.id).order('created_at',{ascending:true}).limit(100);
    if(error) setNotice('Não foi possível carregar os comentários.');
    else setComments((data||[]) as unknown as PostComment[]);
  }

  async function submitComment(e: FormEvent) {
    e.preventDefault();
    if(!comment.trim()||sending)return;
    setSending(true);setNotice('');
    const db=supabaseBrowser();
    const {error}=await db.from('post_comments').insert({post_id:post.id,author_id:userId,body:comment.trim()});
    if(error) {setNotice(error.message);setSending(false);return;}
    setComment('');setSending(false);
    const {data}=await db.from('post_comments').select('id,post_id,author_id,body,created_at,profiles!post_comments_author_id_fkey(display_name,handle)').eq('post_id',post.id).order('created_at',{ascending:true}).limit(100);
    setComments((data||[]) as unknown as PostComment[]);
    await refresh();
  }

  async function share() {
    const address = `${window.location.origin}/post/${encodeURIComponent(post.id)}`;
    if (navigator.share) { try {await navigator.share({title:'Conecta',url:address});} catch {/* usuário cancelou */} }
    else { await navigator.clipboard.writeText(address);setNotice('Link copiado!'); }
  }

  async function remove() {
    if (!window.confirm('Excluir esta publicação?')) return;
    const { error }=await supabaseBrowser().from('posts').delete().eq('id',post.id).eq('author_id',userId);
    if (error) setNotice(error.message);
    else {
      const paths=[...new Set([post.media_path,...(post.post_media||[]).map(m=>m.storage_path)].filter((p):p is string=>Boolean(p)))];
      if(paths.length) {
        const {error:cleanupError}=await supabaseBrowser().storage.from('social-media').remove(paths);
        if(cleanupError)setNotice('Publicação excluída. A limpeza das mídias será verificada.');
      }
      await refresh();
    }
  }

  const LikesIcon=Heart;
  return <article className="post-card" id={'post-'+post.id}>
    <div className="post-head"><div className="avatar avatar-coral">{post.profiles?.display_name?.charAt(0).toUpperCase()||'C'}</div><div className="post-meta"><strong>{post.profiles?.display_name||'Pessoa da comunidade'}</strong><span>@{post.profiles?.handle||'conecta'} · {ago(post.created_at)}</span></div><div className="post-privacy" title={post.visibility}>{post.visibility==='public'?<Globe2 size={16}/>:post.visibility==='friends'?<Users size={16}/>:<LockKeyhole size={16}/>}</div>{post.author_id===userId&&<button className="icon-btn subtle" onClick={remove} title="Excluir publicação" aria-label="Excluir publicação"><Trash2 size={17}/></button>}</div>
    <div className="post-body">{post.content && <p>{post.content}</p>}{media.length>0 && (media.length===1 && media[0].type==='video'
      ? <div className="post-media"><video src={media[0].url} controls preload="metadata"/></div>
      : <div className={'post-gallery '+(media.length===1?'gallery-one':media.length===2?'gallery-two':'gallery-mosaic')}>
          {media.slice(0,3).map((item,index)=><button key={item.path||index} className="post-gallery-item" type="button" onClick={()=>setActiveMediaIndex(index)} aria-label={'Abrir imagem '+(index+1)+' de '+media.length}>
            <img src={item.url} alt={'Foto '+(index+1)+' da publicação'} loading="lazy"/>
            {index===2&&media.length>3&&<span className="post-gallery-more">+{media.length-3}</span>}
          </button>)}
        </div>)}{parseMusicUrl(post.content)&&<MusicEmbed url={post.content}/>}</div>
    <div className="post-stats"><span>{post.post_likes?.[0]?.count||0} curtidas</span><span>{post.post_comments?.[0]?.count||0} comentários</span></div>
    <div className="post-actions"><button aria-pressed={liked} disabled={pendingLike} onClick={like} className={liked?'liked':''}><LikesIcon size={19} fill={liked?'currentColor':'none'}/> Curtir</button><button onClick={openComments}><MessageCircle size={19}/> Comentar</button><button onClick={share}><Share2 size={19}/> Compartilhar</button></div>
    {notice && <div className="inline-notice" role="status">{notice}</div>}
    {activeMediaIndex!==null&&media[activeMediaIndex]&&<div className="media-lightbox" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setActiveMediaIndex(null);}}>
      <div role="dialog" aria-modal="true" aria-label="Visualização de mídia" className="media-lightbox-body">
        <button className="media-lightbox-close" type="button" aria-label="Fechar" onClick={()=>setActiveMediaIndex(null)}><X size={23}/></button>
        {media[activeMediaIndex].type==='video'
          ?<video src={media[activeMediaIndex].url} controls autoPlay playsInline/>
          :<img src={media[activeMediaIndex].url} alt={'Foto '+(activeMediaIndex+1)+' de '+media.length}/>}
        {media.length>1&&<>
          <button type="button" className="media-lightbox-nav prev" aria-label="Imagem anterior" onClick={()=>setActiveMediaIndex((activeMediaIndex-1+media.length)%media.length)}><ChevronLeft size={23}/></button>
          <button type="button" className="media-lightbox-nav next" aria-label="Próxima imagem" onClick={()=>setActiveMediaIndex((activeMediaIndex+1)%media.length)}><ChevronRight size={23}/></button>
        </>}
        <span className="media-lightbox-caption">{activeMediaIndex+1} de {media.length}</span>
      </div>
    </div>}
    {commentsOpen && <section className="comments-panel"><h3>Comentários</h3>{comments.length===0&&<p className="muted">Seja a primeira pessoa a comentar.</p>}{comments.map(c=><div className="comment" key={c.id}><span className="avatar avatar-xs avatar-gradient">{c.profiles?.display_name?.[0]||'C'}</span><div><strong>{c.profiles?.display_name||'Pessoa'}</strong><p>{c.body}</p><small>{ago(c.created_at)}</small></div></div>)}<form onSubmit={submitComment} className="comment-form"><EmojiButton onSelect={emoji=>setComment(current=>(current+emoji).slice(0,1000))}/><input aria-label="Seu comentário" placeholder="Escreva um comentário..." maxLength={1000} required value={comment} onChange={e=>setComment(e.target.value)}/><button type="submit" disabled={sending||!comment.trim()} className="icon-btn primary-circle" title="Comentar"><Send size={19}/></button></form></section>}
  </article>;
}
