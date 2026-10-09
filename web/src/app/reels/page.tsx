'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Clapperboard,Heart,MessageCircle,Volume2,ArrowUpRight} from 'lucide-react';
import {GuardedPage,useAuthProfile} from '@/components/app-shell';
import {supabaseBrowser} from '@/lib/supabase/browser';
import {hydratePostMedia} from '@/lib/post-media';
import type {FeedPost} from '@/lib/types';

export default function ReelsPage(){
 const auth=useAuthProfile();
 const [items,setItems]=useState<FeedPost[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState('');
 const [liked,setLiked]=useState<Set<string>>(()=>new Set()),[liking,setLiking]=useState<string|null>(null);
 useEffect(()=>{
   if(!auth.user)return;
   let alive=true;
   async function load(){
     const db=supabaseBrowser();
     const {data,error:e}=await db.from('posts')
       .select('id,author_id,community_id,moderation_status,content,visibility,media_path,media_type,created_at,profiles!posts_author_id_fkey(display_name,handle,avatar_path),post_likes(count),post_comments(count),post_media(storage_path,media_type,position)')
       .eq('visibility','public').eq('media_type','video')
       .order('created_at',{ascending:false}).limit(36);
     if(!alive)return;
     if(e)setError(e.message);
     else{
       const loaded=await hydratePostMedia(db,(data||[]) as unknown as FeedPost[]);
       const videos=loaded.filter(p=>(p.media||[]).some(m=>m.type==='video'));
       if(alive)setItems(videos);
       if(videos.length){
         const {data:ownLikes,error:likesError}=await db.from('post_likes').select('post_id')
           .eq('user_id',auth.user!.id).in('post_id',videos.map(p=>p.id));
         if(alive){
           if(likesError)setError(likesError.message);
           else setLiked(new Set((ownLikes||[]).map(l=>l.post_id)));
         }
       }
     }
     if(alive)setLoading(false);
   }
   void load();
   return()=>{alive=false;};
 },[auth.user]);
 async function toggleLike(post:FeedPost){
   if(!auth.user||liking)return;
   setLiking(post.id);setError('');
   const db=supabaseBrowser(),already=liked.has(post.id);
   const {error:e}=already
     ?await db.from('post_likes').delete().eq('post_id',post.id).eq('user_id',auth.user.id)
     :await db.from('post_likes').insert({post_id:post.id,user_id:auth.user.id});
   if(e)setError(e.message);
   else{
     setLiked(current=>{
       const next=new Set(current);
       if(already)next.delete(post.id);else next.add(post.id);
       return next;
     });
     setItems(current=>current.map(item=>item.id===post.id
       ?{...item,post_likes:[{count:Math.max(0,(item.post_likes?.[0]?.count||0)+(already?-1:1))}]}
       :item));
   }
   setLiking(null);
 }
 return <GuardedPage {...auth}><main className="section-page conecta-reels-page">
   <div className="page-heading"><div><span className="section-eyebrow">MOMENTOS EM VÍDEO</span>
     <h1>Reels <span className="wave">✳</span></h1><p>Vídeos da comunidade, com reprodução sob seu controle.</p></div></div>
   {error&&<p className="form-error" role="alert">{error}</p>}
   {loading?<p className="muted">Carregando vídeos...</p>:items.length===0?
     <section className="empty-state card"><Clapperboard size={34}/><h2>Ainda não há vídeos públicos.</h2><p>Compartilhe o primeiro vídeo no feed.</p><Link className="btn btn-primary" href="/feed#composer">Publicar vídeo</Link></section>:
     <div className="conecta-reels-list">{items.map(p=>{
       const media=(p.media||[]).find(m=>m.type==='video');
       if(!media)return null;
       return <article key={p.id} className="conecta-reel">
         <div className="conecta-reel-video"><video src={media.url} playsInline controls preload="metadata" loop aria-label={'Vídeo de '+(p.profiles?.display_name||'usuário')} onPlay={event=>{
           document.querySelectorAll<HTMLVideoElement>('.conecta-reel-video video').forEach(v=>{if(v!==event.currentTarget)v.pause();});
         }}/></div>
         <div className="conecta-reel-details">
           <span className="section-eyebrow"><Clapperboard size={15}/> Vídeo público</span>
           <h3>{p.content||'Novo momento compartilhado'}</h3>
           <p><Link href={'/p/'+p.profiles?.handle}>@{p.profiles?.handle||'conecta'}</Link> · {new Date(p.created_at).toLocaleDateString('pt-BR')}</p>
           <div className="row"><button type="button" className="btn btn-outline" aria-label={liked.has(p.id)?'Remover curtida':'Curtir vídeo'} aria-pressed={liked.has(p.id)}
             onClick={()=>void toggleLike(p)} disabled={liking===p.id}><Heart size={16} fill={liked.has(p.id)?'currentColor':'none'}/> {p.post_likes?.[0]?.count||0}</button><span><MessageCircle size={16}/> {p.post_comments?.[0]?.count||0}</span></div>
           <Link href={'/post/'+p.id} className="btn btn-outline">Ver publicação e comentar <ArrowUpRight size={16}/></Link>
         </div>
       </article>;
     })}</div>}
 </main></GuardedPage>;
}
