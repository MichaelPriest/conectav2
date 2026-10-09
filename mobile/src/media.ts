import {File} from 'expo-file-system';
import {randomUUID} from 'expo-crypto';
import {normalizeMedia,MAX_MEDIA_BYTES} from './media-validation';
import type {SelectedMedia} from './media-validation';
export {normalizeMedia};
export type {SelectedMedia};
import {supabase} from './supabase';
import {requestPostModeration} from './data';

/**
 * Matches the web's posts + post_media contract. RLS, age gates and
 * moderation remain authoritative in Supabase; do not elevate credentials.
 */
export async function publishMediaPost(
 userId:string,caption:string,visibility:'public'|'friends'|'private',selected:SelectedMedia[]
):Promise<string>{
 const content=caption.trim();
 if(content.length>3000)throw new Error('A legenda pode ter até 3.000 caracteres.');
 if(!selected.length)throw new Error('Selecione uma mídia antes de publicar.');
 const {data:{session}}=await supabase.auth.getSession();
 if(!session||session.user.id!==userId)throw new Error('Sua sessão expirou. Entre novamente.');
 const files=selected.map(media=>{
  const file=new File(media.uri);
  if(!file.exists||file.size<=0||file.size>MAX_MEDIA_BYTES)
   throw new Error('Uma mídia não está acessível ou excede 50 MB. Escolha novamente.');
  return {media,file};
 });
 let createdId:string|null=null;
 const uploaded:{storage_path:string;media_type:'image'|'video';position:number}[]=[];
 let rollbackFailed=false;
 try{
  for(const [position,{media,file}] of files.entries()){
   const storage_path=`${userId}/${randomUUID()}.${media.extension}`;
   const payload=await file.arrayBuffer();
   const {error}=await supabase.storage.from('social-media').upload(storage_path,payload,{
    contentType:media.mimeType,upsert:false
   });
   if(error)throw error;
   uploaded.push({storage_path,media_type:media.kind,position});
  }
  const first=uploaded[0];
  const {data,error}=await supabase.from('posts').insert({
   author_id:userId,content,visibility,media_path:first.storage_path,media_type:first.media_type
  }).select('id').single();
  if(error)throw error;
  createdId=data.id;
  const {error:galleryError}=await supabase.from('post_media').insert(
   uploaded.map(media=>({post_id:data.id,owner_id:userId,...media}))
  );
  if(galleryError)throw galleryError;
  await requestPostModeration(data.id);
  return data.id;
 }catch(error){
  if(createdId){
   const {error:deleteError}=await supabase.from('posts').delete()
    .eq('id',createdId).eq('author_id',userId);
   rollbackFailed=Boolean(deleteError);
  }
  if(!rollbackFailed&&uploaded.length){
   const {error:cleanupError}=await supabase.storage.from('social-media')
    .remove(uploaded.map(item=>item.storage_path));
   if(cleanupError)rollbackFailed=true;
  }
  const detail=error instanceof Error?error.message:'Não foi possível enviar a publicação.';
  throw new Error(detail+(rollbackFailed?' Há dados pendentes de limpeza; contate o suporte.':''));
 }
}
