import {NextRequest,NextResponse} from 'next/server';
import {identityContext} from '@/lib/identity-server';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function reply(value:unknown,status=200){
 return NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
}
export async function GET(request:NextRequest){
 const context=await identityContext(request);
 if(!context)return reply({error:'Não autenticado'},401);
 const {user,admin}=context;
 const role=await admin.from('platform_moderators').select('role')
  .eq('user_id',user.id).maybeSingle();
 if(role.error||!role.data||!['admin','moderator'].includes(role.data.role))
  return reply({error:'Acesso restrito'},403);
 const kind=request.nextUrl.searchParams.get('kind');
 const id=request.nextUrl.searchParams.get('id');
 if((kind!=='post'&&kind!=='story')||!id||!uuidPattern.test(id))
  return reply({error:'Conteúdo inválido'},400);
 let media:{path:string;type:'image'|'video'}[]=[];
 if(kind==='post'){
  const {data:post,error}=await admin.from('posts')
    .select('id,community_id,moderation_status,media_path,media_type')
    .eq('id',id).maybeSingle();
  if(error||!post||post.community_id||post.moderation_status!=='pending')
   return reply({error:'Publicação indisponível'},404);
  const {data:gallery,error:gError}=await admin.from('post_media')
    .select('storage_path,media_type').eq('post_id',id).order('position',{ascending:true}).limit(5);
  if(gError)return reply({error:'Galeria indisponível'},503);
  media=(gallery||[]).map(m=>({path:m.storage_path,type:m.media_type as 'image'|'video'}));
  if(!media.length&&post.media_path)
   media=[{path:post.media_path,type:post.media_type as 'image'|'video'}];
 }else{
  const {data:story,error}=await admin.from('stories')
   .select('id,moderation_status,media_path,media_type,expires_at')
   .eq('id',id).maybeSingle();
  if(error||!story||story.moderation_status!=='pending'||
    new Date(story.expires_at).getTime()<=Date.now())
   return reply({error:'Story indisponível'},404);
  media=[{path:story.media_path,type:story.media_type as 'image'|'video'}];
 }
 const signed=[];
 for(const item of media){
  if(!item.path||!['image','video'].includes(item.type))return reply({error:'Mídia inválida'},422);
  const {data,error}=await admin.storage.from('social-media').createSignedUrl(item.path,90);
  if(error||!data?.signedUrl)return reply({error:'Mídia indisponível'},503);
  signed.push({type:item.type,url:data.signedUrl});
 }
 return reply({media:signed});
}
