import {File} from 'expo-file-system';
import {randomUUID} from 'expo-crypto';
import {supabase} from './supabase';
import {MAX_MEDIA_BYTES} from './media-validation';

/**
 * Matches the web chat attachment contract. A voice note is a private
 * authenticated message; conversation membership is enforced by RLS.
 * HIGH_QUALITY recording uses AAC in an M4A container on Android and iOS.
 */
export async function sendVoiceMessage(
 conversationId:string,userId:string,recordingUri:string
):Promise<void>{
 if(!conversationId||!recordingUri)throw new Error('Gravação de voz indisponível.');
 const {data:{session}}=await supabase.auth.getSession();
 if(!session||session.user.id!==userId)throw new Error('Sua sessão expirou. Entre novamente.');
 const recorded=new File(recordingUri);
 if(!recorded.exists||recorded.size<=0||recorded.size>MAX_MEDIA_BYTES)
  throw new Error('Gravação vazia ou maior que 50 MB.');
 const storage_path=`${userId}/messages/${randomUUID()}.m4a`;
 const {error:uploadError}=await supabase.storage.from('social-media')
  .upload(storage_path,await recorded.arrayBuffer(),{contentType:'audio/mp4',upsert:false});
 if(uploadError)throw uploadError;
 try{
  const {error}=await supabase.from('messages').insert({
   conversation_id:conversationId,sender_id:userId,content:'',
   media_path:storage_path,media_type:'audio'
  });
  if(error)throw error;
 }catch(e){
  const {error:cleanup}=await supabase.storage.from('social-media').remove([storage_path]);
  const reason=e instanceof Error?e.message:'Não foi possível enviar o áudio.';
  throw new Error(reason+(cleanup?' O anexo exige limpeza no servidor.':''));
 }
}
