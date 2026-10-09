import {File} from 'expo-file-system';
import {randomUUID} from 'expo-crypto';
import {ImageManipulator,SaveFormat} from 'expo-image-manipulator';
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
   // Re-encode still photos to strip camera metadata (including potential GPS
   // EXIF tags) and reduce bandwidth. Leave animated GIFs and videos intact.
   let uploadFile=file;
   let uploadMime=media.mimeType;
   let extension=media.extension;
   if(media.kind==='image'&&media.mimeType!=='image/gif'){
    const context=ImageManipulator.manipulate(media.uri);
    const longest=Math.max(media.width||0,media.height||0);
    if(longest>2200){
     if((media.width||0)>=(media.height||0))context.resize({width:2200,height:null});
     else context.resize({width:null,height:2200});
    }
    const outputType=media.mimeType==='image/png'||media.mimeType==='image/webp'?
     SaveFormat.PNG:SaveFormat.JPEG;
    const rendered=await context.renderAsync();
    const optimized=await rendered.saveAsync({format:outputType,compress:0.85});
    uploadFile=new File(optimized.uri);
    uploadMime=outputType===SaveFormat.PNG?'image/png':'image/jpeg';
    extension=outputType===SaveFormat.PNG?'png':'jpg';
    if(!uploadFile.exists||uploadFile.size<=0||uploadFile.size>MAX_MEDIA_BYTES)
     throw new Error('A foto convertida excede 50 MB ou está indisponível.');
   }
   const storage_path=`${userId}/${randomUUID()}.${extension}`;
   const payload=await uploadFile.arrayBuffer();
   const {error}=await supabase.storage.from('social-media').upload(storage_path,payload,{
    contentType:uploadMime,upsert:false
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
