import {File} from 'expo-file-system';
import {randomUUID} from 'expo-crypto';
import {ImageManipulator,SaveFormat} from 'expo-image-manipulator';
import {supabase} from './supabase';
import type {SelectedMedia} from './media-validation';
import type {Profile} from './models';

const PROFILE_LIMIT=8*1024*1024;
export async function loadCover(userId:string):Promise<string|null>{
 const {data,error}=await supabase.from('profile_details')
  .select('cover_path').eq('user_id',userId).maybeSingle();
 if(error)throw error;
 return data?.cover_path||null;
}
export async function changeProfilePhoto(
 userId:string,media:SelectedMedia,kind:'avatar'|'cover'
):Promise<{profile?:Profile;path:string}>{
 if(media.kind!=='image'||!['image/jpeg','image/png','image/webp'].includes(media.mimeType))
  throw new Error('Foto de perfil: utilize JPG, PNG ou WebP.');
 if(media.size!==undefined&&media.size>PROFILE_LIMIT)
  throw new Error('Fotos de perfil e capa podem ter no máximo 8 MB.');
 const {data:{session}}=await supabase.auth.getSession();
 if(!session||session.user.id!==userId)throw new Error('Faça login novamente para alterar sua foto.');
 const original=new File(media.uri);
 if(!original.exists||original.size<=0||original.size>PROFILE_LIMIT)
  throw new Error('Selecione uma foto de até 8 MB.');
 const manipulator=ImageManipulator.manipulate(media.uri);
 const maxDimension=kind==='avatar'?960:2200;
 const longest=Math.max(media.width||0,media.height||0);
 if(longest>maxDimension){
  if((media.width||0)>=(media.height||0))manipulator.resize({width:maxDimension,height:null});
  else manipulator.resize({width:null,height:maxDimension});
 }
 const format=media.mimeType==='image/png'||media.mimeType==='image/webp'?
  SaveFormat.PNG:SaveFormat.JPEG;
 const rendered=await manipulator.renderAsync();
 const optimized=await rendered.saveAsync({format,compress:0.85});
 const file=new File(optimized.uri);
 if(!file.exists||file.size<=0||file.size>PROFILE_LIMIT)
  throw new Error('A foto processada está indisponível ou excede 8 MB.');
 const path=`${userId}/${kind==='avatar'?'avatars':'covers'}/${randomUUID()}.${format===SaveFormat.PNG?'png':'jpg'}`;
 const {error:uploadError}=await supabase.storage.from('social-media').upload(
  path,await file.arrayBuffer(),{contentType:format===SaveFormat.PNG?'image/png':'image/jpeg',upsert:false});
 if(uploadError)throw uploadError;
 let previous:string|null=null;
 try{
  if(kind==='avatar'){
   const {data:current,error:fetchError}=await supabase.from('profiles')
    .select('avatar_path').eq('id',userId).single();
   if(fetchError)throw fetchError;
   previous=current.avatar_path;
   const {data,error}=await supabase.from('profiles')
    .update({avatar_path:path,updated_at:new Date().toISOString()}).eq('id',userId)
    .select('id,handle,display_name,bio,avatar_path').single();
   if(error)throw error;
   if(previous&&previous!==path)
    await supabase.storage.from('social-media').remove([previous]);
   return {profile:data as Profile,path};
  }
  previous=await loadCover(userId);
  const {error}=await supabase.from('profile_details')
   .upsert({user_id:userId,cover_path:path},{onConflict:'user_id'});
  if(error)throw error;
  if(previous&&previous!==path)
   await supabase.storage.from('social-media').remove([previous]);
  return {path};
 }catch(e){
  // If an update reached the database despite an interrupted response, do
  // not remove its live asset.
  const current=kind==='avatar'?
   await supabase.from('profiles').select('avatar_path').eq('id',userId).maybeSingle():
   null;
  const cover=kind==='cover'?await loadCover(userId).catch(()=>null):null;
  if((kind==='avatar'&&current?.data?.avatar_path!==path)||
     (kind==='cover'&&cover!==path))
   await supabase.storage.from('social-media').remove([path]);
  throw e;
 }
}
