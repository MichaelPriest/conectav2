import {File} from 'expo-file-system';
import {randomUUID} from 'expo-crypto';
import type {ImagePickerAsset} from 'expo-image-picker';
import {supabase} from './supabase';
import {requestPostModeration} from './data';

export type SelectedMedia={
 uri:string;mimeType:string;extension:string;kind:'image'|'video';size?:number;
};
const MAX_BYTES=50*1024*1024;
const MIME_EXT:Record<string,string>={
 'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif',
 'image/heic':'heic','image/heif':'heif',
 'video/mp4':'mp4','video/quicktime':'mov','video/webm':'webm','video/x-m4v':'m4v'
};
const EXT_MIME:Record<string,string>=Object.fromEntries(
 Object.entries(MIME_EXT).map(([mime,ext])=>[ext,mime])
);
EXT_MIME.jpeg='image/jpeg';

export function normalizeMedia(assets:ImagePickerAsset[]):SelectedMedia[]{
 if(assets.length===0)throw new Error('Selecione pelo menos uma foto ou vídeo.');
 if(assets.length>5)throw new Error('Você pode adicionar até cinco fotos.');
 const files=assets.map(asset=>{
  const ext=asset.fileName?.split('.').pop()?.toLowerCase()||'';
  const suppliedMime=asset.mimeType?.toLowerCase();
  const mimeType=(suppliedMime==='image/jpg'?'image/jpeg':suppliedMime)||
   EXT_MIME[ext];
  const extension=mimeType?MIME_EXT[mimeType]:undefined;
  if(!extension||!(asset.type==='image'||asset.type==='video')||
    (asset.type==='image')!==mimeType.startsWith('image/'))
   throw new Error('Formato de mídia não aceito. Use JPG, PNG, WEBP, GIF, HEIC, MP4 ou MOV.');
  if(asset.fileSize!==undefined&&(asset.fileSize<=0||asset.fileSize>MAX_BYTES))
   throw new Error('Cada mídia precisa ter no máximo 50 MB.');
  return {uri:asset.uri,mimeType,extension,kind:asset.type,size:asset.fileSize} as SelectedMedia;
 });
 if(files.some(x=>x.kind==='video')&&files.length!==1)
  throw new Error('Publique um vídeo por vez, sem misturar com fotos.');
 return files;
}

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
  if(!file.exists||file.size<=0||file.size>MAX_BYTES)
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
