import {supabase} from './supabase';
import type {ChatMessage,Profile} from './models';
import {validateGroupCreation} from './chat-group-validation';
export {validateGroupCreation,groupRights} from './chat-group-validation';

/** The Conecta Web owns the RPCs; mobile always uses the same RLS and membership rules. */
export async function acceptedChatFriends(userId:string):Promise<Profile[]>{
 const {data:rows,error}=await supabase.from('friendships')
  .select('requester_id,addressee_id').eq('status','accepted')
  .or('requester_id.eq.'+userId+',addressee_id.eq.'+userId);
 if(error)throw error;
 const ids=[...new Set((rows||[]).map(row=>
  row.requester_id===userId?row.addressee_id:row.requester_id))]
  .filter(id=>id!==userId);
 if(!ids.length)return [];
 const {data:people,error:peopleError}=await supabase.from('profiles')
  .select('id,handle,display_name,bio,avatar_path').in('id',ids)
  .order('display_name',{ascending:true});
 if(peopleError)throw peopleError;
 return (people||[]) as Profile[];
}
export async function createNativeGroup(userId:string,title:string,selectedIds:string[]){
 const friends=await acceptedChatFriends(userId);
 const payload=validateGroupCreation(title,selectedIds,friends);
 const {data:{session}}=await supabase.auth.getSession();
 if(session?.user.id!==userId)throw new Error('Sua sessão expirou.');
 const {data,error}=await supabase.rpc('create_conversation_with_members',{
  _title:payload.title,_other_user_ids:payload.ids
 });
 if(error)throw error;
 if(typeof data!=='string'||!data)throw new Error('O grupo não foi criado.');
 return data as string;
}
export async function setConversationMuted(
 conversationId:string,userId:string,currentlyMuted:boolean
):Promise<void>{
 const {data:{session}}=await supabase.auth.getSession();
 if(session?.user.id!==userId)throw new Error('Sua sessão expirou.');
 const {error}=await supabase.from('conversation_members')
  .update({muted_until:currentlyMuted?null:new Date(Date.now()+30*86400_000).toISOString()})
  .eq('conversation_id',conversationId).eq('user_id',userId);
 if(error)throw error;
}
export type PinnedChatMessage={message_id:string;pinned_at:string;content:string;media_type:string|null};
export async function getPinnedMessages(conversationId:string):Promise<PinnedChatMessage[]>{
 const {data:pins,error}=await supabase.from('conversation_pins')
  .select('message_id,pinned_at').eq('conversation_id',conversationId)
  .order('pinned_at',{ascending:false}).limit(3);
 if(error)throw error;
 if(!pins?.length)return [];
 const {data:messages,error:messagesError}=await supabase.from('messages')
  .select('id,content,media_type,deleted_at').in('id',pins.map(x=>x.message_id))
  .eq('conversation_id',conversationId);
 if(messagesError)throw messagesError;
 const byId=new Map((messages||[]).map(x=>[x.id,x]));
 return pins.filter(row=>byId.has(row.message_id)&&!byId.get(row.message_id)?.deleted_at)
  .map(row=>({message_id:row.message_id,pinned_at:row.pinned_at,
   content:byId.get(row.message_id)?.content||'Mídia fixada',
   media_type:byId.get(row.message_id)?.media_type||null}));
}
export async function toggleChatPin(conversationId:string,message:ChatMessage){
 if(message.conversation_id!==conversationId||message.deleted_at)
  throw new Error('A mensagem não pode ser fixada.');
 const {error}=await supabase.rpc('toggle_conversation_pin',{
  _conversation:conversationId,_message:message.id
 });
 if(error)throw error;
}
export type GroupPermissions={
 coadmins:string[];
 coadmins_can_invite:boolean;coadmins_can_remove:boolean;
};
export type GroupDetails={
 id:string;title:string;created_by:string;is_group:boolean;
 members:Profile[];permissions:GroupPermissions;
};
export async function getGroupDetails(conversationId:string,userId:string):Promise<GroupDetails>{
 const {data:own,error:memberError}=await supabase.from('conversation_members')
  .select('user_id').eq('conversation_id',conversationId).eq('user_id',userId).maybeSingle();
 if(memberError)throw memberError;
 if(!own)throw new Error('Você não faz parte deste grupo.');
 const [group,rows,rights]=await Promise.all([
  supabase.from('conversations').select('id,title,created_by,is_group')
   .eq('id',conversationId).single(),
  supabase.from('conversation_members').select('user_id').eq('conversation_id',conversationId),
  supabase.rpc('get_conversation_group_permissions',{_conversation:conversationId})
 ]);
 if(group.error||rows.error||rights.error)throw group.error||rows.error||rights.error;
 if(!group.data.is_group)throw new Error('A conversa não é um grupo.');
 const ids=(rows.data||[]).map(x=>x.user_id);
 const response=ids.length?await supabase.from('profiles')
  .select('id,handle,display_name,bio,avatar_path').in('id',ids):{data:[],error:null};
 if(response.error)throw response.error;
 const p=rights.data as Partial<GroupPermissions>|null;
 return {id:conversationId,title:group.data.title||'Grupo',created_by:group.data.created_by,
  is_group:true,members:(response.data||[]) as Profile[],
  permissions:{coadmins:Array.isArray(p?.coadmins)?p.coadmins:[],
   coadmins_can_invite:p?.coadmins_can_invite===true,
   coadmins_can_remove:p?.coadmins_can_remove===true}};
}
async function callGroupAction(name:string,args:Record<string,unknown>){
 const {error}=await supabase.rpc(name,args);
 if(error)throw error;
}
export async function inviteGroupFriend(conversationId:string,friendId:string){
 await callGroupAction('add_conversation_group_member',{
  _conversation:conversationId,_friend:friendId
 });
}
export async function renameNativeGroup(conversationId:string,title:string){
 const trimmed=title.trim();
 if(trimmed.length<2||trimmed.length>80)
  throw new Error('Informe um nome entre 2 e 80 caracteres.');
 await callGroupAction('rename_conversation_group',{_conversation:conversationId,_title:trimmed});
}
export async function leaveNativeGroup(conversationId:string){
 await callGroupAction('leave_conversation_group',{_conversation:conversationId});
}
export async function removeNativeGroupMember(conversationId:string,targetId:string){
 await callGroupAction('remove_conversation_group_member',{
  _conversation:conversationId,_member:targetId
 });
}
export async function setNativeGroupModerator(conversationId:string,targetId:string,enabled:boolean){
 await callGroupAction('set_conversation_group_moderator',{
  _conversation:conversationId,_member:targetId,_enabled:enabled
 });
}
export async function setNativeGroupPermissions(
 conversationId:string,canInvite:boolean,canRemove:boolean
){
 await callGroupAction('set_conversation_group_permissions',{
  _conversation:conversationId,_can_invite:canInvite,_can_remove:canRemove
 });
}
