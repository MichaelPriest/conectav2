'use client';

import {useCallback,useEffect,useState} from 'react';
import {Bookmark,RefreshCw} from 'lucide-react';
import {GuardedPage,useAuthProfile} from '@/components/app-shell';
import {PostCard} from '@/components/post-card';
import {supabaseBrowser} from '@/lib/supabase/browser';
import {hydratePostMedia} from '@/lib/post-media';
import type {FeedPost} from '@/lib/types';

export default function SavedPostsPage(){
  const auth=useAuthProfile();
  const [posts,setPosts]=useState<FeedPost[]>([]);
  const [loadingPosts,setLoadingPosts]=useState(true);
  const [error,setError]=useState('');

  const loadSaved=useCallback(async()=>{
    if(!auth.user)return;
    setLoadingPosts(true);setError('');
    const db=supabaseBrowser();
    const {data:saved,error:savedError}=await db.from('saved_posts')
      .select('post_id').eq('user_id',auth.user.id);
    if(savedError){setError('Não foi possível carregar suas publicações salvas.');setLoadingPosts(false);return;}
    const ids=(saved||[]).map(item=>item.post_id as string);
    if(!ids.length){setPosts([]);setLoadingPosts(false);return;}
    // RLS on posts remains the authority for visibility; saving a post does not
    // grant access to content that its author or the platform has restricted.
    const {data,error:postsError}=await db.from('posts')
      .select('id,author_id,community_id,moderation_status,moderation_reason,content,visibility,media_path,media_type,created_at,profiles!posts_author_id_fkey(handle,display_name,avatar_path),post_likes(count),post_comments(count),post_media(storage_path,media_type,position)')
      .in('id',ids);
    if(postsError){setError('Não foi possível abrir as publicações salvas.');setLoadingPosts(false);return;}
    const byId=new Map(((posts||[]) as unknown as FeedPost[]).map(post=>[post.id,post]));
    const ordered=ids.map(id=>byId.get(id)).filter((post):post is FeedPost=>Boolean(post));
    const hydrated=await hydratePostMedia(db,ordered);
    setPosts(hydrated);setLoadingPosts(false);
  },[auth.user]);

  useEffect(()=>{void loadSaved();},[loadSaved]);

  return <GuardedPage {...auth}>
    <main className="section-page">
      <div className="page-heading">
        <div><span className="section-eyebrow">SUA COLEÇÃO PESSOAL</span>
          <h1><Bookmark size={27} aria-hidden="true"/> Publicações salvas</h1>
          <p>Guarde ideias e momentos para encontrar novamente quando quiser.</p>
        </div>
        <button type="button" className="btn btn-outline" onClick={()=>void loadSaved()} disabled={loadingPosts}>
          <RefreshCw size={16}/> Atualizar
        </button>
      </div>
      {error&&<p className="form-error" role="alert">{error}</p>}
      {loadingPosts?<p className="muted" role="status">Carregando suas publicações salvas…</p>:
        posts.length===0?
          <section className="empty-state card">
            <Bookmark size={36} aria-hidden="true"/>
            <h2>Suas próximas descobertas ficam aqui</h2>
            <p>Use “Salvar” em uma publicação do feed para guardá-la nesta coleção privada.</p>
          </section>:
          <div className="content-column">{posts.map(post=>
            <PostCard key={post.id} post={post} userId={auth.user!.id} refresh={loadSaved}
              onSavedChange={isSaved=>{if(!isSaved)setPosts(current=>current.filter(item=>item.id!==post.id));}}/>
          )}</div>
      }
    </main>
  </GuardedPage>;
}
