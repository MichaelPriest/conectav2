import {File} from 'expo-file-system';
import {randomUUID} from 'expo-crypto';
import {ImageManipulator,SaveFormat} from 'expo-image-manipulator';
import {supabase} from './supabase';
import {requestContentModeration} from './data';
import type {SelectedMedia} from './media-validation';
import {MAX_MEDIA_BYTES} from './media-validation';
import type {Story} from './models';

/** Visibility, expiration and moderation are enforced by the same server RLS as web. */
export async function loadActiveStories():Promise<Story[]>{
 const {data,error}=await supabase.from('stories')
  .select('id,author_id,caption,media_path,media_type,visibility,moderation_status,created_at,expires_at,profiles!stories_author_id_fkey(display_name,handle,avatar_path)')
  .gt('expires_at',new Date().toISOString())
  .order('created_at',{ascending:false}).limit(80);
 if(error)throw error;
 return (data||[]) as unknown as Story[];
}

export async function publishStory(
 userId:string,media:SelectedMedia,caption:string,
 visibility:'public'|'friends'|'private'
):Promise<string>{
 const text=caption.trim();
 if(text.length>300)throw new Error('A legenda do Story deve ter até 300 caracteres.');
 const {data:{session}}=await supabase.auth.getSession();
 if(!session||session.user.id!==userId)throw new Error('Entre novamente para publicar um Story.');
 const original=new File(media.uri);
 if(!original.exists||original.size<=0||original.size>MAX_MEDIA_BYTES)
  throw new Error('A mídia do Story está indisponível ou excede 50 MB.');
 let file=original,mime=media.mimeType,extension=media.extension;
 if(media.kind==='image'&&mime!=='image/gif'){
  const context=ImageManipulator.manipulate(media.uri);
  const longest=Math.max(media.width||0,media.height||0);
  if(longest>2200){
   if((media.width||0)>=(media.height||0))context.resize({width:2200,height:null});
   else context.resize({width:null,height:2200});
  }
  const outputType=mime==='image/png'||mime==='image/webp'?
   SaveFormat.PNG:SaveFormat.JPEG;
  const rendered=await context.renderAsync();
  const optimized=await rendered.saveAsync({format:outputType,compress:0.85});
  file=new File(optimized.uri);
  mime=outputType===SaveFormat.PNG?'image/png':'image/jpeg';
  extension=outputType===SaveFormat.PNG?'png':'jpg';
  if(!file.exists||file.size<=0||file.size>MAX_MEDIA_BYTES)
   throw new Error('Não foi possível preparar a imagem do Story.');
 }
 const path=`${userId}/stories/${randomUUID()}.${extension}`;
 const {error:uploadError}=await supabase.storage.from('social-media').upload(
  path,await file.arrayBuffer(),{contentType:mime,upsert:false}
 );
 if(uploadError)throw uploadError;
 let createdId:string|null=null;
 try{
  const {data,error}=await supabase.from('stories').insert({
   author_id:userId,caption:text,media_path:path,
   media_type:media.kind,visibility
  }).select('id').single();
  if(error)throw error;
  createdId=data.id;
  await requestContentModeration('story',createdId);
  return createdId;
 }catch(err){
  // Never delete uploaded media while a committed story still refers to it.
  let rollbackFailed=false;
  if(createdId){
   const {error}=await supabase.from('stories').delete()
    .eq('id',createdId).eq('author_id',userId);
   rollbackFailed=Boolean(error);
  }
  if(!rollbackFailed){
   const {error}=await supabase.storage.from('social-media').remove([path]);
   rollbackFailed=Boolean(error);
  }
  const message=err instanceof Error?err.message:'Não foi possível publicar o Story.';
  throw new Error(message+(rollbackFailed?' Restou conteúdo pendente de limpeza.':''));
 }
}

export async function removeStory(userId:string,story:Story):Promise<void>{
 if(story.author_id!==userId)throw new Error('Somente o autor pode excluir o próprio Story.');
 const {error}=await supabase.from('stories').delete().eq('id',story.id).eq('author_id',userId);
 if(error)throw error;
 const {error:cleanup}=await supabase.storage.from('social-media').remove([story.media_path]);
 if(cleanup)throw new Error('Story excluído, porém o arquivo precisa de limpeza: '+cleanup.message);
}
