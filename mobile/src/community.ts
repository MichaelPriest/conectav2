import {supabase} from './supabase';
import {requestPostModeration} from './data';
import type {Community,Post} from './models';

const COMMUNITY_POST_PAGE_SIZE=15;
const POST_FIELDS='id,author_id,community_id,content,visibility,moderation_status,created_at,media_path,media_type,profiles!posts_author_id_fkey(handle,display_name,avatar_path),post_likes(count),post_comments(count),post_media(storage_path,media_type,position)';

export function communitySlug(value:string):string{
 return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);
}
export function validateCommunityDraft(name:string,slug:string,description:string,rules:string){
 const trimmed=name.trim(),normalized=slug.trim().toLowerCase();
 if(trimmed.length<3||trimmed.length>100)throw new Error('O nome deve ter de 3 a 100 caracteres.');
 if(!/^[a-z0-9-]{3,60}$/.test(normalized))
  throw new Error('O endereço deve ter de 3 a 60 letras minúsculas, números ou hífens.');
 if(description.trim().length>3000||rules.trim().length>5000)
  throw new Error('Reduza a descrição ou as regras da comunidade.');
 return {name:trimmed,slug:normalized,description:description.trim(),rules:rules.trim()};
}

/** Reuse real web tables; no privileged credentials or bypass of community RLS. */
export async function loadCommunityPosts(communityId:string,offset=0):Promise<{
 items:Post[];more:boolean
}>{
 const {data,error}=await supabase.from('posts').select(POST_FIELDS)
  .eq('community_id',communityId).order('created_at',{ascending:false})
  .range(offset,offset+COMMUNITY_POST_PAGE_SIZE-1);
 if(error)throw error;
 const items=(data||[]) as unknown as Post[];
 return {items,more:items.length===COMMUNITY_POST_PAGE_SIZE};
}
export async function communityMemberCount(communityId:string):Promise<number>{
 const {count,error}=await supabase.from('community_members')
  .select('user_id',{head:true,count:'exact'}).eq('community_id',communityId);
 if(error)throw error;
 return count||0;
}
export async function ensureCommunityMembership(userId:string,communityId:string):Promise<void>{
 const {data:{session}}=await supabase.auth.getSession();
 if(session?.user.id!==userId)throw new Error('Sua sessão expirou.');
 const {data,error}=await supabase.from('community_members').select('user_id')
  .eq('community_id',communityId).eq('user_id',userId).maybeSingle();
 if(error)throw error;
 if(!data)throw new Error('Participe da comunidade antes de publicar.');
}
export async function publishCommunityText(
 userId:string,communityId:string,content:string
):Promise<string>{
 const text=content.trim();
 if(!text||text.length>3000)throw new Error('Escreva de 1 a 3.000 caracteres.');
 await ensureCommunityMembership(userId,communityId);
 const {data,error}=await supabase.from('posts').insert({
  author_id:userId,community_id:communityId,content:text,visibility:'public',
  media_path:null,media_type:null
 }).select('id').single();
 if(error)throw error;
 await requestPostModeration(data.id);
 return data.id;
}
export async function createCommunity(
 userId:string,name:string,slug:string,description:string,rules:string
):Promise<{community:Community;joined:boolean;warning:string|null}>{
 const payload=validateCommunityDraft(name,slug,description,rules);
 const {data:{session}}=await supabase.auth.getSession();
 if(session?.user.id!==userId)throw new Error('Entre novamente para criar uma comunidade.');
 const {data,error}=await supabase.from('communities').insert({
  owner_id:userId,...payload
 }).select('id,owner_id,slug,name,description,rules,cover_path,avatar_path,is_official,created_at').single();
 if(error)throw error;
 const {error:joinError}=await supabase.from('community_members').insert({
  community_id:data.id,user_id:userId
 });
 return {community:data as Community,joined:!joinError,
  warning:joinError?'Comunidade criada, mas não foi possível entrar automaticamente: '+joinError.message:null};
}
