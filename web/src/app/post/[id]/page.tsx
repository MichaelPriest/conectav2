'use client';

import {useCallback,useEffect,useState} from 'react';
import {useParams,useRouter} from 'next/navigation';
import Link from 'next/link';
import {ArrowLeft,FileQuestion,Loader2} from 'lucide-react';
import {GuardedPage,useAuthProfile} from '@/components/app-shell';
import {PostCard} from '@/components/post-card';
import {hydratePostMedia} from '@/lib/post-media';
import {supabaseBrowser} from '@/lib/supabase/browser';
import type {FeedPost} from '@/lib/types';

export default function PostDetail(){
  const auth=useAuthProfile();
  const params=useParams<{id:string}>();
  const [post,setPost]=useState<FeedPost|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const router=useRouter();
  const load=useCallback(async()=>{
    if(!auth.user||!params.id)return;
    setLoading(true);setError('');
    const db=supabaseBrowser();
    const {data,error:queryError}=await db.from('posts')
      .select('id,author_id,community_id,content,visibility,media_path,media_type,created_at,profiles!posts_author_id_fkey(handle,display_name,avatar_path),post_likes(count),post_comments(count),post_media(storage_path,media_type,position)')
      .eq('id',params.id).maybeSingle();
    if(queryError){setError(queryError.message);setLoading(false);return;}
    if(!data){setPost(null);setLoading(false);return;}
    const hydrated=await hydratePostMedia(db,[data as unknown as FeedPost]);
    setPost(hydrated[0]);setLoading(false);
  },[auth.user,params.id]);
  useEffect(()=>{void load();},[load]);
  return <GuardedPage {...auth}><main className="section-page" style={{maxWidth:780}}>
    <Link href="/feed" className="rail-link"><ArrowLeft size={16}/> Voltar ao feed</Link>
    <div className="page-heading" style={{marginTop:20}}><div><span className="section-eyebrow">CONVERSAS</span><h1>Publicação</h1><p>Compartilhe esta história ou participe da conversa.</p></div></div>
    {error&&<p className="form-error" role="alert">{error}</p>}
    {loading?<div className="centered-loading"><Loader2 className="spin" size={22}/> Carregando publicação...</div>
      :post?<PostCard post={post} userId={auth.user?.id||''} refresh={load}/>
      :<div className="empty-state card"><FileQuestion size={28}/><h3>Publicação indisponível</h3><p>Ela pode ter sido excluída ou você não tem permissão para visualizá-la.</p><Link className="btn btn-primary" href="/feed">Voltar ao feed</Link></div>}
  </main></GuardedPage>;
}
