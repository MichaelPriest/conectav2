import {File} from 'expo-file-system';
import {randomUUID} from 'expo-crypto';
import {ImageManipulator,SaveFormat} from 'expo-image-manipulator';
import {supabase} from './supabase';
import type {SelectedMedia} from './media-validation';
import {MAX_MEDIA_BYTES} from './media-validation';

/** Real private chat attachments share the web's message schema and RLS. */
export async function sendChatMedia(
 conversationId:string,userId:string,media:SelectedMedia
):Promise<void>{
 if(!conversationId)throw new Error('Selecione uma conversa.');
 const {data:{session}}=await supabase.auth.getSession();
 if(!session||session.user.id!==userId)throw new Error('Entre novamente para compartilhar mídia.');
 let file=new File(media.uri),mime=media.mimeType,extension=media.extension;
 if(!file.exists||file.size<=0||file.size>MAX_MEDIA_BYTES)
  throw new Error('Arquivo inacessível ou maior que 50 MB.');
 if(media.kind==='image'&&mime!=='image/gif'){
  const context=ImageManipulator.manipulate(media.uri);
  const longest=Math.max(media.width||0,media.height||0);
  if(longest>2200){
   if((media.width||0)>=(media.height||0))context.resize({width:2200,height:null});
   else context.resize({width:null,height:2200});
  }
  const format=mime==='image/png'||mime==='image/webp'?SaveFormat.PNG:SaveFormat.JPEG;
  const output=await context.renderAsync();
  const optimized=await output.saveAsync({format,compress:0.85});
  file=new File(optimized.uri);
  mime=format===SaveFormat.PNG?'image/png':'image/jpeg';
  extension=format===SaveFormat.PNG?'png':'jpg';
  if(!file.exists||file.size<=0||file.size>MAX_MEDIA_BYTES)
   throw new Error('Falha ao preparar a foto ou arquivo maior que 50 MB.');
 }
 const path=`${userId}/messages/${randomUUID()}.${extension}`;
 const {error:uploadError}=await supabase.storage.from('social-media')
  .upload(path,await file.arrayBuffer(),{contentType:mime,upsert:false});
 if(uploadError)throw uploadError;
 try{
  const {error}=await supabase.from('messages').insert({
   conversation_id:conversationId,sender_id:userId,content:'',
   media_path:path,media_type:media.kind
  });
  if(error)throw error;
 }catch(e){
  const {error:cleanupError}=await supabase.storage.from('social-media').remove([path]);
  const detail=e instanceof Error?e.message:'Não foi possível enviar anexo.';
  throw new Error(detail+(cleanupError?' Anexo pendente de limpeza.':''));
 }
}
