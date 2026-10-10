import type {ChatMessage,ChatReaction} from './models';

/**
 * Merge paged and realtime chat rows without losing older messages.
 * A thread change must never carry rows from the previous conversation.
 */
export function mergeChatPages(
 current:ChatMessage[],incoming:ChatMessage[],conversationId:string
):ChatMessage[]{
 const map=new Map<string,ChatMessage>();
 for(const message of current.concat(incoming)){
  if(message.conversation_id===conversationId)map.set(message.id,message);
 }
 return [...map.values()].sort((a,b)=>
  a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
}
export function mergeChatReactionPages(
 current:ChatReaction[],incoming:ChatReaction[]
):ChatReaction[]{
 const map=new Map<string,ChatReaction>();
 for(const reaction of current.concat(incoming))
  map.set([reaction.message_id,reaction.user_id,reaction.emoji].join(':'),reaction);
 return [...map.values()];
}

/** Refresh only reactions belonging to the fetched page; deletions must disappear. */
export function refreshChatReactionPage(
 current:ChatReaction[],incoming:ChatReaction[],messageIds:string[]
):ChatReaction[]{
 const scoped=new Set(messageIds);
 return mergeChatReactionPages(
  current.filter(reaction=>!scoped.has(reaction.message_id)),incoming
 );
}
