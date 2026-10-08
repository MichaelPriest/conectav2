import type {FeedPost} from '@/lib/types';
import {supabaseBrowser} from '@/lib/supabase/browser';

/** Only produces signed URLs for assets already permitted by Supabase RLS. */
export async function hydratePostMedia(db:ReturnType<typeof supabaseBrowser>, rows:FeedPost[]):Promise<FeedPost[]> {
  return Promise.all(rows.map(async post=>{
    const allMedia=post.post_media?.length
      ? [...post.post_media].sort((a,b)=>a.position-b.position).map(item=>({
          path:item.storage_path,type:item.media_type
        }))
      : post.media_path && post.media_type
        ? [{path:post.media_path,type:post.media_type}]
        : [];
    const signed=await Promise.all(allMedia.map(async item=>{
      const {data,error}=await db.storage.from('social-media').createSignedUrl(item.path,3600);
      return !error&&data?.signedUrl?{...item,url:data.signedUrl}:null;
    }));
    const media=signed.filter((item):item is NonNullable<typeof item>=>item!==null);
    return {...post,media,mediaUrl:media[0]?.url||null};
  }));
}
