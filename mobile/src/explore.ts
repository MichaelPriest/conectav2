import {supabase} from './supabase';
import type {Profile,Post,Friendship,Community} from './models';

const FIELDS='id,author_id,community_id,content,visibility,moderation_status,created_at,media_path,media_type,profiles!posts_author_id_fkey(handle,display_name,avatar_path),post_likes(count),post_comments(count),post_media(storage_path,media_type,position)';
export type DiscoverFilter='Tudo'|'Pessoas'|'Comunidades'|'Publicações'|'Vídeos';
export type ExploreData={people:Profile[];communities:Community[];posts:Post[]};
export type PublicProfileData={
 person:Profile;details:PublicDetails|null;posts:Post[];
 relation:Friendship|null;blocked:boolean;blockedBy:boolean;
};
export type PublicDetails={
 headline:string|null;city:string|null;website:string|null;music_url:string|null;
 interests:string[]|null;favorite_emoji:string|null;cover_theme:string|null;
 mood_text:string|null;layout_style:string|null;cover_path:string|null
};
export function searchMatches(input:string,search:string){
 const normalized=search.trim().toLocaleLowerCase('pt-BR');
 return !normalized||input.toLocaleLowerCase('pt-BR').includes(normalized);
}
export function filterDiscovery(items:ExploreData,term:string,filter:DiscoverFilter,userId:string):ExploreData{
 const people=(filter==='Tudo'||filter==='Pessoas')?
  items.people.filter(p=>p.id!==userId&&searchMatches(
   p.display_name+' '+p.handle+' '+(p.bio||''),term)):[];
 const communities=(filter==='Tudo'||filter==='Comunidades')?
  items.communities.filter(c=>searchMatches(c.name+' '+(c.description||''),term)):[];
 const posts=(filter==='Tudo'||filter==='Publicações'||filter==='Vídeos')?
  items.posts.filter(p=>p.visibility==='public'&&p.moderation_status==='approved'&&
   (filter!=='Vídeos'||p.media_type==='video'||
    p.post_media?.some(media=>media.media_type==='video'))&&
   searchMatches(p.content+' '+(p.profiles?.display_name||'')+' '+(p.profiles?.handle||''),term)):[];
 return {people,communities,posts};
}
export async function loadNativeExplore(userId:string):Promise<ExploreData>{
 const [people,communities,posts,blocks]=await Promise.all([
  supabase.from('profiles').select('id,handle,display_name,bio,avatar_path')
   .order('created_at',{ascending:false}).limit(100),
  supabase.from('communities')
   .select('id,owner_id,slug,name,description,rules,cover_path,avatar_path,is_official,created_at')
   .order('created_at',{ascending:false}).limit(70),
  supabase.from('posts').select(FIELDS).eq('visibility','public')
   .eq('moderation_status','approved').is('community_id',null)
   .order('created_at',{ascending:false}).limit(70),
  supabase.from('user_blocks').select('blocker_id,blocked_id')
   .or('blocker_id.eq.'+userId+',blocked_id.eq.'+userId)
 ]);
 if(people.error||communities.error||posts.error||blocks.error)
  throw people.error||communities.error||posts.error||blocks.error;
 const hidden=new Set((blocks.data||[]).flatMap(r=>
  r.blocker_id===userId?[r.blocked_id]:r.blocked_id===userId?[r.blocker_id]:[]));
 return {
  people:((people.data||[]) as Profile[]).filter(p=>p.id!==userId&&!hidden.has(p.id)),
  communities:(communities.data||[]) as Community[],
  posts:((posts.data||[]) as unknown as Post[]).filter(p=>!hidden.has(p.author_id))
 };
}
export async function loadNativePublicProfile(userId:string,personId:string):Promise<PublicProfileData>{
 if(!personId)throw new Error('Perfil inválido.');
 const person=await supabase.from('profiles')
  .select('id,handle,display_name,bio,avatar_path').eq('id',personId).maybeSingle();
 if(person.error)throw person.error;
 if(!person.data)throw new Error('Este perfil não está mais disponível.');
 const [details,blocked,relation]=await Promise.all([
  supabase.from('profile_details')
   .select('headline,city,website,music_url,interests,favorite_emoji,cover_theme,mood_text,layout_style,cover_path')
   .eq('user_id',personId).maybeSingle(),
  supabase.from('user_blocks').select('blocker_id,blocked_id')
   .or('and(blocker_id.eq.'+userId+',blocked_id.eq.'+personId+'),and(blocker_id.eq.'+personId+',blocked_id.eq.'+userId+')'),
  supabase.from('friendships').select('id,requester_id,addressee_id,status,created_at')
   .or('and(requester_id.eq.'+userId+',addressee_id.eq.'+personId+'),and(requester_id.eq.'+personId+',addressee_id.eq.'+userId+')')
   .maybeSingle()
 ]);
 if(details.error||blocked.error||relation.error)
  throw details.error||blocked.error||relation.error;
 const isBlocked=Boolean(blocked.data?.some(x=>x.blocker_id===userId));
 const isBlockedBy=Boolean(blocked.data?.some(x=>x.blocker_id===personId));
 let posts:Post[]=[];
 if(!isBlocked&&!isBlockedBy){
  const response=await supabase.from('posts').select(FIELDS)
   .eq('author_id',personId).eq('visibility','public')
   .eq('moderation_status','approved')
   .order('created_at',{ascending:false}).limit(20);
  if(response.error)throw response.error;
  posts=(response.data||[]) as unknown as Post[];
 }
 return {
  person:person.data as Profile,details:details.data as PublicDetails|null,
  relation:(relation.data||null) as Friendship|null,
  blocked:isBlocked,blockedBy:isBlockedBy,posts
 };
}
