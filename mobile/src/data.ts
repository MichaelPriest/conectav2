import {SITE_URL,supabase} from './supabase';
import type {AgeAccess,ChatMessage,Community,Friendship,Notice,Post,PostComment,Profile,Thread} from './models';

// All reads and writes are executed as the signed-in user under the existing
// server RLS, anti-flood triggers, moderation gates and age protection.
export async function verifyAccess(userId:string):Promise<{
 profile:Profile|null;status:AgeAccess
}>{
 const [profileResult,ageResult]=await Promise.all([
  supabase.from('profiles').select('id,handle,display_name,bio,avatar_path')
    .eq('id',userId).maybeSingle(),
  supabase.from('registration_age_declarations').select('declared_band')
    .eq('user_id',userId).maybeSingle()
 ]);
 if(profileResult.error)throw profileResult.error;
 if(ageResult.error)throw ageResult.error;
 const profile=(profileResult.data||null) as Profile|null;
 if(!profile||!ageResult.data)return {profile,status:'onboarding'};
 if(ageResult.data.declared_band!=='18_plus')return {profile,status:'age-check'};
 return {profile,status:'ok'};
}

const signedCache=new Map<string,{url:string;expires:number}>();
export async function signedMedia(path:string|null|undefined):Promise<string|null>{
 if(!path)return null;
 const hit=signedCache.get(path);
 if(hit&&hit.expires>Date.now())return hit.url;
 const {data,error}=await supabase.storage.from('social-media').createSignedUrl(path,1800);
 if(error||!data?.signedUrl)return null;
 signedCache.set(path,{url:data.signedUrl,expires:Date.now()+25*60*1000});
 if(signedCache.size>250)signedCache.clear();
 return data.signedUrl;
}
/** Retry media whose signed URL expired or was rejected by the image loader. */
export function invalidateSignedMedia(path:string):void{signedCache.delete(path);}
export function clearMediaCache(){signedCache.clear();}

const POST_FIELDS='id,author_id,community_id,content,visibility,moderation_status,created_at,media_path,media_type,profiles!posts_author_id_fkey(handle,display_name,avatar_path),post_likes(count),post_comments(count),post_media(storage_path,media_type,position)';
export async function loadFeed(offset=0):Promise<{items:Post[];more:boolean}>{
 const {data,error}=await supabase.from('posts')
 .select(POST_FIELDS)
 .is('community_id',null).order('created_at',{ascending:false}).range(offset,offset+14);
 if(error)throw error;
 const items=(data||[]) as unknown as Post[];
 return {items,more:items.length===15};
}
/** Video posts are the same public records used by the Conecta Web Reels page. */
/** Single post follows the same Supabase RLS as Feed. Pending/rejected posts
 * are visible only to their author; other viewers get no private metadata. */
export async function loadPermittedPost(postId:string,userId:string):Promise<Post|null>{
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId))
  throw new Error('Identificador de publicação inválido.');
 const {data,error}=await supabase.from('posts').select(POST_FIELDS)
  .eq('id',postId).maybeSingle();
 if(error)throw error;
 if(!data)return null;
 const post=data as unknown as Post;
 if(post.author_id!==userId&&post.moderation_status!=='approved')return null;
 return post;
}
export async function loadOwnPosts(userId:string,offset=0):Promise<{
 items:Post[];more:boolean
}>{
 const {data:{session}}=await supabase.auth.getSession();
 if(session?.user.id!==userId)throw new Error('Sua sessão expirou.');
 const {data,error}=await supabase.from('posts').select(POST_FIELDS)
  .eq('author_id',userId).order('created_at',{ascending:false})
  .range(offset,offset+11);
 if(error)throw error;
 const items=(data||[]) as unknown as Post[];
 return {items,more:items.length===12};
}
export async function loadPublicReels():Promise<Post[]>{
 const {data,error}=await supabase.from('posts').select(POST_FIELDS)
  .eq('visibility','public').eq('media_type','video')
  .order('created_at',{ascending:false}).limit(36);
 if(error)throw error;
 return ((data||[]) as unknown as Post[]).filter(post=>
  post.post_media?.some(item=>item.media_type==='video')||
  (post.media_type==='video'&&Boolean(post.media_path))
 );
}
export async function loadSavedPosts(userId:string):Promise<Post[]>{
 const {data:saved,error:savedError}=await supabase.from('saved_posts')
  .select('post_id').eq('user_id',userId).limit(100);
 if(savedError)throw savedError;
 const ids=[...new Set((saved||[]).map(item=>item.post_id))];
 if(!ids.length)return [];
 const {data,error}=await supabase.from('posts').select(POST_FIELDS)
  .in('id',ids).order('created_at',{ascending:false});
 if(error)throw error;
 return (data||[]) as unknown as Post[];
}
export async function mySaved(userId:string,postIds:string[]):Promise<Set<string>>{
 if(!postIds.length)return new Set();
 const {data,error}=await supabase.from('saved_posts').select('post_id')
  .eq('user_id',userId).in('post_id',postIds);
 if(error)throw error;
 return new Set((data||[]).map(item=>item.post_id));
}
export async function setSavedPost(postId:string,userId:string,currentlySaved:boolean):Promise<void>{
 const {error}=currentlySaved?await supabase.from('saved_posts').delete()
  .eq('user_id',userId).eq('post_id',postId):
  await supabase.from('saved_posts').insert({user_id:userId,post_id:postId});
 if(error)throw error;
}
export async function myLikes(userId:string,postIds:string[]):Promise<Set<string>>{
 if(postIds.length===0)return new Set();
 const {data,error}=await supabase.from('post_likes').select('post_id')
  .eq('user_id',userId).in('post_id',postIds);
 if(error)throw error;
 return new Set((data||[]).map(x=>x.post_id));
}
export async function setLike(postId:string,userId:string,isLiked:boolean):Promise<void>{
 const {error}=isLiked
  ? await supabase.from('post_likes').delete().eq('post_id',postId).eq('user_id',userId)
  : await supabase.from('post_likes').insert({post_id:postId,user_id:userId});
 if(error)throw error;
}
export async function publishTextPost(userId:string,content:string,visibility:'public'|'friends'|'private'):Promise<string>{
 const trimmed=content.trim();
 if(trimmed.length<1||trimmed.length>3000)throw new Error('Escreva entre 1 e 3.000 caracteres.');
 const {data,error}=await supabase.from('posts').insert({
   author_id:userId,content:trimmed,visibility,media_path:null,media_type:null
 }).select('id').single();
 if(error)throw error;
 await requestPostModeration(data.id);
 return data.id;
}

/**
 * Invokes the same authenticated moderation route as the website.
 * Database quarantine and moderation policies remain authoritative if offline.
 */
/** Delete only a post owned by the signed-in person, then clean associated media. */
export async function deleteOwnPost(post:Post,userId:string):Promise<string|null>{
 if(post.author_id!==userId)throw new Error('Somente o autor pode excluir esta publicação.');
 const {data:{session}}=await supabase.auth.getSession();
 if(session?.user.id!==userId)throw new Error('Sua sessão expirou.');
 const paths=[...new Set([post.media_path,
  ...(post.post_media||[]).map(item=>item.storage_path)].filter(
   (path):path is string=>Boolean(path&&path.startsWith(userId+'/'))
  ))];
 const {data,error}=await supabase.from('posts').delete()
  .eq('id',post.id).eq('author_id',userId).select('id').maybeSingle();
 if(error)throw error;
 if(!data)throw new Error('Esta publicação não pode mais ser excluída.');
 if(paths.length){
  const {error:cleanup}=await supabase.storage.from('social-media').remove(paths);
  if(cleanup)return 'Publicação excluída, mas a limpeza de mídias precisa ser verificada.';
 }
 return null;
}

export type NativeModerationFeedback={
 status:'approved'|'pending'|'rejected'|'expired';reason?:string
};
function safeModerationFeedback(value:unknown):NativeModerationFeedback{
 if(value&&typeof value==='object'){
  const candidate=value as {status?:string;reason?:unknown};
  if(['approved','pending','rejected','expired'].includes(candidate.status||''))
   return {status:candidate.status as NativeModerationFeedback['status'],
    reason:typeof candidate.reason==='string'?candidate.reason.slice(0,260):undefined};
 }
 return {status:'pending',reason:'Triagem ainda não concluída. O conteúdo continua protegido.'};
}
/**
 * Return the actual moderation outcome. Provider/server errors never approve a
 * post, but the app tells the author that the content is still under review.
 */
export async function requestContentModeration(kind:'post'|'story',id:string):Promise<NativeModerationFeedback>{
 const {data:{session}}=await supabase.auth.getSession();
 if(!session?.access_token)
  return {status:'pending',reason:'Sessão de revisão indisponível. Tente novamente após entrar na conta.'};
 try{
  const response=await fetch(SITE_URL+'/api/moderation/review',{
   method:'POST',
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
   body:JSON.stringify({kind,id}),cache:'no-store'
  });
  if(!response.ok)
   return {status:'pending',reason:'Não foi possível concluir a triagem automática. Conteúdo aguardando revisão.'};
  return safeModerationFeedback(await response.json());
 }catch{
  return {status:'pending',reason:'Serviço de análise indisponível. Tente novamente mais tarde.'};
 }
}
export async function requestPostModeration(id:string):Promise<NativeModerationFeedback>{
 return requestContentModeration('post',id);
}
/** Source of truth: status is always read from the protected database row. */
export async function ownPostModerationStatus(id:string):Promise<NativeModerationFeedback>{
 const {data,error}=await supabase.from('posts')
  .select('moderation_status,moderation_reason').eq('id',id).maybeSingle();
 if(error||!data)return {status:'pending',reason:'Não foi possível confirmar a análise.'};
 return safeModerationFeedback({status:data.moderation_status,reason:data.moderation_reason});
}

/** Only rows allowed by Supabase comment RLS are returned. */
export async function reportSafety(
 userId:string,targetType:'post'|'message',targetId:string,reason:string,details:string
):Promise<void>{
 const description=details.trim().slice(0,350);
 const text=(reason.trim()+(description?' — '+description:'')).slice(0,500);
 if(!text||!targetId||!userId)throw new Error('Selecione um motivo para a denúncia.');
 const {error}=await supabase.from('safety_reports').insert({
  reporter_id:userId,target_type:targetType,target_id:targetId,reason:text
 });
 if(error)throw new Error(error.code==='23505'?'Você já denunciou esse conteúdo.':error.message);
}

export async function loadPostComments(postId:string):Promise<PostComment[]>{
 const {data,error}=await supabase.from('post_comments')
 .select('id,post_id,parent_id,author_id,body,moderation_status,created_at,profiles!post_comments_author_id_fkey(display_name,handle,avatar_path)')
 .eq('post_id',postId).order('created_at',{ascending:true}).limit(100);
 if(error)throw error;
 return (data||[]) as unknown as PostComment[];
}
export async function sendPostComment(postId:string,userId:string,body:string,parentId:string|null=null):Promise<'approved'|'pending'|'rejected'>{
 const content=body.trim();
 if(!content||content.length>1000)throw new Error('O comentário deve ter entre 1 e 1.000 caracteres.');
 const {data,error}=await supabase.from('post_comments').insert({
  post_id:postId,author_id:userId,body:content,parent_id:parentId
 }).select('id').single();
 if(error)throw error;
 // Comments remain protected while the server moderation endpoint is offline.
 const {data:{session}}=await supabase.auth.getSession();
 if(session?.access_token){
  try{
   await fetch(SITE_URL+'/api/moderation/comment',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
    body:JSON.stringify({id:data.id}),cache:'no-store'
   });
  }catch{/* The database's pending status remains authoritative. */}
 }
 const {data:latest}=await supabase.from('post_comments')
  .select('moderation_status').eq('id',data.id).maybeSingle();
 return latest?.moderation_status==='approved'?'approved':
  latest?.moderation_status==='rejected'?'rejected':'pending';
}

export async function loadConnections(userId:string):Promise<{friends:Friendship[];people:Profile[]}>{
 const [friends,people]=await Promise.all([
  supabase.from('friendships')
   .select('id,requester_id,addressee_id,status,created_at')
   .or('requester_id.eq.'+userId+',addressee_id.eq.'+userId),
  supabase.from('profiles').select('id,handle,display_name,bio,avatar_path')
   .order('created_at',{ascending:false}).limit(120)
 ]);
 if(friends.error)throw friends.error;
 if(people.error)throw people.error;
 return {friends:(friends.data||[]) as Friendship[],people:(people.data||[]) as Profile[]};
}
export async function changeConnection(userId:string,otherId:string,
 action:'add'|'accept'|'remove',relation?:Friendship):Promise<void>{
 if(userId===otherId)throw new Error('Não é possível conectar-se consigo mesmo.');
 let error: {message:string}|null=null;
 if(action==='add'){
  ({error}=await supabase.from('friendships').insert({
   requester_id:userId,addressee_id:otherId,status:'pending'
  }));
 }else if(action==='accept'){
  if(!relation||relation.addressee_id!==userId||relation.status!=='pending')
   throw new Error('Esse convite não pode ser aceito.');
  ({error}=await supabase.from('friendships').update({status:'accepted'})
   .eq('id',relation.id).eq('addressee_id',userId));
 }else{
  if(!relation)throw new Error('Conexão não encontrada.');
  ({error}=await supabase.from('friendships').delete().eq('id',relation.id)
    .or('requester_id.eq.'+userId+',addressee_id.eq.'+userId));
 }
 if(error)throw new Error(error.message);
}

/** Personal block list and block/unblock use the same Web table and RLS. */
export async function blockedUserIds(userId:string):Promise<Set<string>>{
 const {data,error}=await supabase.from('user_blocks')
  .select('blocked_id').eq('blocker_id',userId);
 if(error)throw error;
 return new Set((data||[]).map(row=>row.blocked_id));
}
export async function setUserBlocked(
 userId:string,targetId:string,blocked:boolean
):Promise<void>{
 if(!targetId||userId===targetId)throw new Error('Não é possível bloquear esta conta.');
 const {data:{session}}=await supabase.auth.getSession();
 if(session?.user.id!==userId)throw new Error('Sua sessão expirou.');
 const {error}=blocked
  ?await supabase.from('user_blocks').delete()
    .eq('blocker_id',userId).eq('blocked_id',targetId)
  :await supabase.from('user_blocks').insert({
    blocker_id:userId,blocked_id:targetId
  });
 if(error)throw error;
}

export async function loadCommunities(userId:string):Promise<{items:Community[];joined:Set<string>}>{
 const [result,membership]=await Promise.all([
   supabase.from('communities').select('id,owner_id,slug,name,description,rules,cover_path,avatar_path,is_official,created_at')
    .order('created_at',{ascending:false}).limit(100),
   supabase.from('community_members').select('community_id').eq('user_id',userId)
 ]);
 if(result.error)throw result.error;
 if(membership.error)throw membership.error;
 return {items:(result.data||[]) as Community[],
  joined:new Set((membership.data||[]).map(x=>x.community_id))};
}
export async function changeMembership(userId:string,communityId:string,joined:boolean){
 const {error}=joined?await supabase.from('community_members').delete()
   .eq('community_id',communityId).eq('user_id',userId)
  :await supabase.from('community_members').insert({user_id:userId,community_id:communityId});
 if(error)throw error;
}

export async function loadNotifications(userId:string):Promise<Notice[]>{
 const {data,error}=await supabase.from('notifications')
 .select('id,kind,created_at,read_at,entity_id,profiles!notifications_actor_id_fkey(display_name,handle)')
 .eq('recipient_id',userId).order('created_at',{ascending:false}).limit(100);
 if(error)throw error;
 return (data||[]) as unknown as Notice[];
}
export async function unreadNotificationCount(userId:string):Promise<number>{
 const {count,error}=await supabase.from('notifications')
  .select('id',{count:'exact',head:true})
  .eq('recipient_id',userId).is('read_at',null);
 if(error)throw error;
 return Math.max(0,count||0);
}
export async function markNotifications(userId:string,id?:string):Promise<void>{
 let q=supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('recipient_id',userId);
 q=id?q.eq('id',id):q.is('read_at',null);
 const {error}=await q;if(error)throw error;
}

export async function loadThreads(userId:string):Promise<Thread[]>{
 const {data:membership,error:memberError}=await supabase.from('conversation_members')
  .select('conversation_id,user_id,muted_until').eq('user_id',userId);
 if(memberError)throw memberError;
 const ids=[...new Set((membership||[]).map(m=>m.conversation_id))];
 if(!ids.length)return [];
 const [threads,members,last,unread]=await Promise.all([
  supabase.from('conversations').select('id,title,created_at,created_by,is_group').in('id',ids)
   .order('created_at',{ascending:false}),
  supabase.from('conversation_members').select('conversation_id,user_id').in('conversation_id',ids),
  supabase.rpc('my_latest_conversation_messages'),
  supabase.rpc('my_conversation_unread_counts')
 ]);
 if(threads.error)throw threads.error;
 if(members.error)throw members.error;
 if(last.error)throw last.error;
 if(unread.error)throw unread.error;
 const otherIds=[...new Set((members.data||[])
  .filter(m=>m.user_id!==userId).map(m=>m.user_id))];
 const people=otherIds.length?await supabase.from('profiles')
  .select('id,handle,display_name,bio,avatar_path').in('id',otherIds):{data:[],error:null};
 if(people.error)throw people.error;
 const byId=new Map(((people.data||[]) as Profile[]).map(p=>[p.id,p]));
 const muteById=new Map((membership||[]).map(m=>[m.conversation_id,m.muted_until]));
 const lastById=new Map<string,{content:string;created_at:string}>();
 for(const msg of (last.data||[]) as {conversation_id:string;content:string;created_at:string}[])
  if(!lastById.has(msg.conversation_id))lastById.set(msg.conversation_id,msg);
 const countById=new Map<string,number>();
 for(const row of (unread.data||[]) as {conversation_id:string;unread_count:number|string}[])
  countById.set(row.conversation_id,Number(row.unread_count||0));
 return (threads.data||[]).map(t=>{
  const otherId=(members.data||[]).find(m=>m.conversation_id===t.id&&m.user_id!==userId)?.user_id;
  const lastMsg=lastById.get(t.id);
  return {id:t.id,title:t.is_group?t.title||'Grupo':byId.get(otherId||'')?.display_name||'Conversa',
    other:byId.get(otherId||'')||null,group:t.is_group,unread:countById.get(t.id)||0,
    last:lastMsg?.content||'Nenhuma mensagem ainda',updated:lastMsg?.created_at||t.created_at,
    created_by:t.created_by||null,muted_until:muteById.get(t.id)||null};
 }).sort((a,b)=>Date.parse(b.updated)-Date.parse(a.updated));
}
export async function startChat(otherId:string):Promise<string>{
 const {data,error}=await supabase.rpc('create_conversation_with_members',{
   _title:'Conversa privada',_other_user_ids:[otherId]
 });
 if(error)throw error;
 if(typeof data!=='string')throw new Error('A conversa não foi criada.');
 return data;
}
const CHAT_MESSAGE_FIELDS='id,conversation_id,sender_id,content,created_at,media_path,media_type,deleted_at,edited_at,reply_to';
const CHAT_PAGE_SIZE=60;
export async function loadChatMessages(conversationId:string):Promise<ChatMessage[]>{
 const {data,error}=await supabase.from('messages')
 .select(CHAT_MESSAGE_FIELDS).eq('conversation_id',conversationId)
 .order('created_at',{ascending:false}).order('id',{ascending:false})
 .limit(CHAT_PAGE_SIZE);
 if(error)throw error;
 return ((data||[]) as ChatMessage[]).reverse();
}
/** Keyset pagination prevents missing earlier messages when new chat items arrive. */
export async function loadOlderChatMessages(
 conversationId:string,oldest:ChatMessage
):Promise<ChatMessage[]>{
 if(oldest.conversation_id!==conversationId)
  throw new Error('Não é possível paginar outra conversa.');
 const {data,error}=await supabase.from('messages').select(CHAT_MESSAGE_FIELDS)
  .eq('conversation_id',conversationId)
  .or('created_at.lt.'+oldest.created_at+
   ',and(created_at.eq.'+oldest.created_at+',id.lt.'+oldest.id+')')
  .order('created_at',{ascending:false}).order('id',{ascending:false})
  .limit(CHAT_PAGE_SIZE);
 if(error)throw error;
 return ((data||[]) as ChatMessage[]).reverse();
}
/** Query real conversation messages, restricted by the database's membership RLS. */
export async function searchChatMessages(conversationId:string,query:string):Promise<ChatMessage[]>{
 const needle=query.trim();
 if(needle.length<2||needle.length>100)
  throw new Error('Pesquise usando de 2 a 100 caracteres.');
 // Escape LIKE wildcards and backslashes so a user searches the literal phrase.
 const escaped=needle.replace(/[\\%_]/g,character=>'\\'+character);
 const {data,error}=await supabase.from('messages').select(CHAT_MESSAGE_FIELDS)
  .eq('conversation_id',conversationId).is('deleted_at',null)
  .ilike('content','%'+escaped+'%')
  .order('created_at',{ascending:false}).limit(25);
 if(error)throw error;
 return (data||[]) as ChatMessage[];
}
export async function sendMessage(
 conversationId:string,userId:string,content:string,replyTo:string|null=null
){
 const text=content.trim();
 if(!text||text.length>4000)throw new Error('Mensagem vazia ou muito longa.');
 const {error}=await supabase.from('messages').insert({
  conversation_id:conversationId,sender_id:userId,content:text,reply_to:replyTo
 });
 if(error)throw error;
}
export async function readConversation(conversationId:string,userId:string){
 const {error}=await supabase.from('conversation_members')
 .update({last_read_at:new Date().toISOString()}).eq('conversation_id',conversationId)
 .eq('user_id',userId);
 if(error)throw error;
}
export async function updateMyProfile(id:string,name:string,bio:string):Promise<Profile>{
 const trimmed=name.trim();
 if(trimmed.length<2||trimmed.length>80)throw new Error('O nome precisa ter entre 2 e 80 caracteres.');
 const {data,error}=await supabase.from('profiles').update({
  display_name:trimmed,bio:bio.trim().slice(0,500),
  updated_at:new Date().toISOString()
 }).eq('id',id).select('id,handle,display_name,bio,avatar_path').single();
 if(error)throw error;
 return data as Profile;
}
