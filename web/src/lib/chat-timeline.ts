/**
 * Stable, conversation-scoped timeline merge. Postgres Realtime refreshes the
 * newest page; older history must survive and edited/deleted rows must update.
 */
export type ChatTimelineRow={id:string;conversation_id:string;created_at:string};
export function mergeChatPage<T extends ChatTimelineRow>(
  current:readonly T[],incoming:readonly T[],conversationId:string
):T[]{
  const byId=new Map<string,T>();
  for(const row of current)if(row.conversation_id===conversationId)byId.set(row.id,row);
  for(const row of incoming)if(row.conversation_id===conversationId)byId.set(row.id,row);
  return [...byId.values()].sort((a,b)=>
    a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
}

/** PostgREST OR expression for an exclusive, deterministic (created_at,id) cursor. */
export function olderChatCursor<T extends ChatTimelineRow>(
  current:readonly T[],conversationId:string
):string|null{
  const oldest=current.filter(m=>m.conversation_id===conversationId)
    .reduce<T|null>((min,row)=>
      !min||row.created_at<min.created_at||
      (row.created_at===min.created_at&&row.id<min.id)?row:min,null);
  if(!oldest)return null;
  return 'created_at.lt.'+oldest.created_at+',and(created_at.eq.'+
    oldest.created_at+',id.lt.'+oldest.id+')';
}
