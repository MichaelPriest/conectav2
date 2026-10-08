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
 useEffect(()=>{
   if(!auth.user)return;
   let alive=true;
   async function load(){
     const db=supabaseBrowser();
     const {data,error:e}=await db.from('posts')
       .select('id,author_id,content,visibility,media_path,media_type,created_at,profiles!posts_author_id_fkey(display_name,handle),post_likes(count),post_comments(count),post_media(storage_path,media_type,position)')
       .eq('visibility','public').eq('media_type','video')
       .order('created_at',{ascending:false}).limit(36);
     if(!alive)return;
     if(e)setError(e.message);
     else{
       const loaded=await hydratePostMedia(db,(data||[]) as unknown as FeedPost[]);
       if(alive)setItems(loaded.filter(p=>(p.media||[]).some(m=>m.type==='video')));
     }
     if(alive)setLoading(false);
   }
   void load();
   return()=>{alive=false;};
 },[auth.user]);
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
         <div className="conecta-reel-video"><video src={media.url} playsInline controls preload="metadata" loop aria-label={'Vídeo de '+(p.profiles?.display_name||'usuário')}/></div>
         <div className="conecta-reel-details">
           <span className="section-eyebrow"><Clapperboard size={15}/> Vídeo público</span>
           <h3>{p.content||'Novo momento compartilhado'}</h3>
           <p><Link href={'/p/'+p.profiles?.handle}>@{p.profiles?.handle||'conecta'}</Link> · {new Date(p.created_at).toLocaleDateString('pt-BR')}</p>
           <div className="row"><span><Heart size={16}/> {p.post_likes?.[0]?.count||0}</span><span><MessageCircle size={16}/> {p.post_comments?.[0]?.count||0}</span></div>
           <Link href={'/post/'+p.id} className="btn btn-outline">Ver publicação e comentar <ArrowUpRight size={16}/></Link>
         </div>
       </article>;
     })}</div>}
   <section className="conecta-ad-placeholder" style={{maxWidth:760,margin:'26px auto'}}><span>PUBLICIDADE FUTURA · IDENTIFICADA</span><strong>Espaço reservado para campanhas</strong><p>Nenhum anúncio ativo e nenhuma segmentação de menores.</p></section>
 </main></GuardedPage>;
}
