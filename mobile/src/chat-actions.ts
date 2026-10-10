import {supabase} from './supabase';
import type {ChatMessage,ChatReaction} from './models';

export const CHAT_EMOJIS=['❤️','👍','😂','😮','😢','👏'] as const;

/** Reactions are visible only when the signed-in user can read the message. */
export async function loadChatReactions(messages:ChatMessage[]):Promise<ChatReaction[]>{
 const ids=[...new Set(messages.filter(m=>!m.deleted_at).map(m=>m.id))];
 if(!ids.length)return [];
 const {data,error}=await supabase.from('message_reactions')
  .select('message_id,user_id,emoji,created_at').in('message_id',ids);
 if(error)throw error;
 return (data||[]) as ChatReaction[];
}
export async function setChatReaction(
 message:ChatMessage,userId:string,emoji:string,currentlyReacted:boolean
):Promise<void>{
 if(message.deleted_at)throw new Error('Não é possível reagir a uma mensagem apagada.');
 if(!CHAT_EMOJIS.includes(emoji as typeof CHAT_EMOJIS[number]))
  throw new Error('Reação não suportada.');
 const {error}=currentlyReacted?
  await supabase.from('message_reactions').delete()
   .eq('message_id',message.id).eq('user_id',userId).eq('emoji',emoji):
  await supabase.from('message_reactions').insert({
   message_id:message.id,user_id:userId,emoji
  });
 if(error)throw error;
}

/** Match web ownership checks, including the protected tombstone semantics. */
export async function editChatMessage(
 message:ChatMessage,userId:string,nextContent:string
):Promise<void>{
 const text=nextContent.trim();
 if(!text||text.length>4000)throw new Error('Escreva até 4.000 caracteres.');
 if(message.sender_id!==userId||message.deleted_at||!message.content)
  throw new Error('Você não pode editar esta mensagem.');
 const {data,error}=await supabase.from('messages').update({content:text})
  .eq('id',message.id).eq('conversation_id',message.conversation_id)
  .eq('sender_id',userId).is('deleted_at',null).select('id').maybeSingle();
 if(error)throw error;
 if(!data)throw new Error('Esta mensagem não pode mais ser editada.');
}
export async function deleteChatMessage(message:ChatMessage,userId:string):Promise<void>{
 if(message.sender_id!==userId||message.deleted_at)
  throw new Error('Você só pode apagar suas mensagens.');
 const {data,error}=await supabase.from('messages')
  .update({deleted_at:new Date().toISOString()})
  .eq('id',message.id).eq('conversation_id',message.conversation_id)
  .eq('sender_id',userId).is('deleted_at',null).select('id').maybeSingle();
 if(error)throw error;
 if(!data)throw new Error('Não foi possível apagar a mensagem.');
 if(message.media_path){
  const {error:cleanup}=await supabase.storage.from('social-media').remove([message.media_path]);
  if(cleanup)throw new Error('Mensagem apagada; a limpeza do anexo precisa ser verificada.');
 }
}
