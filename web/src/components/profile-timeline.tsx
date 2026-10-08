'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {Bookmark,Camera,Film,LayoutList,Image as ImageIcon} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';
import {hydratePostMedia} from '@/lib/post-media';
import {PostCard} from '@/components/post-card';
import type {FeedPost} from '@/lib/types';

type Tab='posts'|'photos'|'videos'|'saved';
const POST_SELECT='id,author_id,content,visibility,media_path,media_type,created_at,profiles!posts_author_id_fkey(handle,display_name,avatar_path),post_likes(count),post_comments(count),post_media(storage_path,media_type,position)';
export function ProfileTimeline({profileId,viewerId,isSelf=false}:{profileId:string;viewerId:string;isSelf?:boolean}){
  const [tab,setTab]=useState<Tab>('posts');
  const [posts,setPosts]=useState<FeedPost[]>([]);
  const [saved,setSaved]=useState<FeedPost[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState('');
  const refresh=useCallback(async()=>{
    setLoading(true);setError('');
    const db=supabaseBrowser();
    const {data,error:e}=await db.from('posts').select(POST_SELECT).eq('author_id',profileId)
      .order('created_at',{ascending:false}).limit(60);
    if(e)setError(e.message);
    else setPosts(await hydratePostMedia(db,(data||[]) as unknown as FeedPost[]));
    if(isSelf){
      const {data:items,error:saveError}=await db.from('saved_posts').select('post_id').eq('user_id',viewerId)
        .order('created_at',{ascending:false}).limit(60);
      if(saveError)setError(saveError.message);
      else if(items?.length){
        const ids=items.map(x=>x.post_id);
        const {data:mine,error:loadError}=await db.from('posts').select(POST_SELECT).in('id',ids);
        if(loadError)setError(loadError.message);
        else{
          const hydrated=await hydratePostMedia(db,(mine||[]) as unknown as FeedPost[]);
          const ranks=new Map(ids.map((id,i)=>[id,i]));
          setSaved(hydrated.sort((a,b)=>(ranks.get(a.id)||0)-(ranks.get(b.id)||0)));
        }
      }else setSaved([]);
    }
    setLoading(false);
  },[profileId,viewerId,isSelf]);
  useEffect(()=>{void refresh();},[refresh]);
  const source=tab==='saved'?saved:posts;
  const collection=useMemo(()=>tab==='photos'?source.flatMap(p=>(p.media||[]).filter(m=>m.type==='image').map(m=>({post:p,media:m}))):
    tab==='videos'?source.flatMap(p=>(p.media||[]).filter(m=>m.type==='video').map(m=>({post:p,media:m}))):[],[source,tab]);
  return <section className="conecta-profile-wall">
    <div className="conecta-profile-tabs" role="group" aria-label="Conteúdo do perfil">
      <button type="button" className={tab==='posts'?'active':''} onClick={()=>setTab('posts')}><LayoutList size={17}/> Publicações</button>
      <button type="button" className={tab==='photos'?'active':''} onClick={()=>setTab('photos')}><Camera size={17}/> Fotos</button>
      <button type="button" className={tab==='videos'?'active':''} onClick={()=>setTab('videos')}><Film size={17}/> Vídeos</button>
      {isSelf&&<button type="button" className={tab==='saved'?'active':''} onClick={()=>setTab('saved')}><Bookmark size={17}/> Salvos</button>}
    </div>
    {error&&<p className="form-error" role="alert">{error}</p>}
    {loading?<p className="muted">Carregando publicações...</p>:tab==='photos'||tab==='videos'?
      collection.length?<div className="conecta-photo-grid">{collection.map(({post,media},i)=><Link className="conecta-photo-tile" key={post.id+'-'+i} href={'/post/'+post.id}>
        {media.type==='video'?<video src={media.url} preload="metadata" muted playsInline/>:<img src={media.url} alt={'Publicação: '+post.content.slice(0,90)} loading="lazy"/>}
        <span>{media.type==='video'?'Vídeo':'Foto'}</span>
      </Link>)}</div>:
      <div className="empty-state card"><ImageIcon size={25}/><h3>Sem {tab==='photos'?'fotos':'vídeos'} por aqui.</h3><p>Os conteúdos publicados aparecem nesta galeria.</p></div>
      :source.length?<div className="feed-list">{source.map(p=><PostCard key={p.id} post={p} userId={viewerId} refresh={refresh}/>)}</div>:
      <div className="empty-state card"><LayoutList size={25}/><h3>Nenhuma publicação ainda.</h3></div>
    }
    <p className="small-note">Exibindo até 60 publicações acessíveis, respeitando a privacidade definida por cada pessoa.</p>
  </section>;
}
