'use client';
import {supabaseBrowser} from '@/lib/supabase/browser';

export type ModerationPreview={url:string;type:'image'|'video'};
export type ModerationPreviewRequest={kind:'post'|'story';id:string};

/**
 * Fallback when the Next.js privileged preview endpoint is unavailable.
 * Operates ONLY under a logged-in platform reviewer's JWT and existing
 * Supabase Postgres + Storage RLS. No service credentials in the browser.
 */
export async function reviewerPreviewFromRls(input:ModerationPreviewRequest):Promise<ModerationPreview[]>{
 const db=supabaseBrowser();
 const {data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user)throw Error('Sessão expirada. Entre novamente.');
 const {data:role,error:roleError}=await db.from('platform_moderators').select('role')
  .eq('user_id',user.id).maybeSingle();
 if(roleError||!role||!['moderator','admin'].includes(role.role))
  throw Error('Somente moderadores da plataforma podem acessar mídias pendentes.');
 let owner:string;
 let media:{path:string;type:string}[]=[];
 if(input.kind==='post'){
  const {data:post,error}=await db.from('posts')
   .select('author_id,media_path,media_type,moderation_status,community_id')
   .eq('id',input.id).maybeSingle();
  if(error||!post||post.community_id!==null||post.moderation_status!=='pending')
   throw Error('Publicação indisponível para revisão.');
  owner=post.author_id;
  const {data:gallery,error:galleryError}=await db.from('post_media')
   .select('storage_path,media_type')
   .eq('post_id',input.id).order('position',{ascending:true}).limit(6);
  if(galleryError)throw Error('Galeria não pôde ser consultada.');
  if((gallery||[]).length>5)throw Error('Galeria fora dos limites permitidos.');
  media=(gallery||[]).map(g=>({path:g.storage_path,type:g.media_type}));
  if(!media.length&&post.media_path)
   media=[{path:post.media_path,type:post.media_type||''}];
 }else{
  const {data:story,error}=await db.from('stories')
   .select('author_id,media_path,media_type,moderation_status,expires_at')
   .eq('id',input.id).maybeSingle();
  if(error||!story||story.moderation_status!=='pending'||Date.parse(story.expires_at)<=Date.now())
   throw Error('Story indisponível para revisão.');
  owner=story.author_id;
  media=[{path:story.media_path,type:story.media_type||''}];
 }
 if(!media.length)throw Error('Nenhuma mídia vinculada a este conteúdo.');
 const refs:ModerationPreview[]=[];
 for(const item of media){
  if(!item.path?.startsWith(owner+'/')||!['image','video'].includes(item.type))
   throw Error('Arquivo com origem inválida.');
  const {data,error}=await db.storage.from('social-media').createSignedUrl(item.path,120);
  if(error||!data?.signedUrl)throw Error('Arquivo indisponível no armazenamento protegido.');
  refs.push({url:data.signedUrl,type:item.type as 'image'|'video'});
 }
 return refs;
}
