import {supabase} from './supabase';
import {normalizeDetails,validateDetails} from './profile-details-validation';
import type {ProfileDetails} from './profile-details-validation';
export type {ProfileDetails};
export {PROFILE_THEMES,PROFILE_LAYOUTS,normalizeDetails,validateDetails} from './profile-details-validation';
export async function loadOwnProfileDetails(userId:string):Promise<ProfileDetails>{
 const {data:{session}}=await supabase.auth.getSession();
 if(session?.user.id!==userId)throw new Error('Entre novamente para editar seu perfil.');
 const {data,error}=await supabase.from('profile_details')
  .select('headline,city,website,music_url,interests,favorite_emoji,cover_theme,mood_text,layout_style,cover_path')
  .eq('user_id',userId).maybeSingle();
 if(error)throw error;
 return normalizeDetails(data);
}
export async function saveOwnProfileDetails(userId:string,draft:ProfileDetails):Promise<void>{
 const payload=validateDetails(draft);
 const {data:{session}}=await supabase.auth.getSession();
 if(session?.user.id!==userId)throw new Error('Entre novamente para editar seu perfil.');
 // Partial upsert does not replace cover_path or protected verification fields.
 const {error}=await supabase.from('profile_details')
  .upsert({user_id:userId,...payload},{onConflict:'user_id'});
 if(error)throw error;
}
