export const PROFILE_THEMES=['violet','aqua','pink','sunset','midnight'] as const;
export const PROFILE_LAYOUTS=['classic','myspace','minimal'] as const;
export type ProfileTheme=typeof PROFILE_THEMES[number];
export type ProfileLayout=typeof PROFILE_LAYOUTS[number];
export type ProfileDetails={
 headline:string;city:string;website:string;music_url:string;interests:string[];
 favorite_emoji:string;cover_theme:ProfileTheme;mood_text:string;
 layout_style:ProfileLayout;cover_path:string|null;
};
export const INITIAL_DETAILS:ProfileDetails={
 headline:'',city:'',website:'',music_url:'',interests:[],
 favorite_emoji:'💜',cover_theme:'violet',mood_text:'',layout_style:'classic',cover_path:null
};
const safe=(value:unknown)=>typeof value==='string'?value:'';
export function normalizeDetails(value:Record<string,unknown>|null|undefined):ProfileDetails{
 const data=value||{};
 return {
  headline:safe(data.headline),city:safe(data.city),
  website:safe(data.website),music_url:safe(data.music_url),
  interests:Array.isArray(data.interests)?
   data.interests.filter((value):value is string=>typeof value==='string').slice(0,12):[],
  favorite_emoji:typeof data.favorite_emoji==='string'&&data.favorite_emoji.length>0&&
   data.favorite_emoji.length<=16?data.favorite_emoji:'💜',
  cover_theme:PROFILE_THEMES.find(theme=>theme===data.cover_theme)||'violet',
  mood_text:safe(data.mood_text),
  layout_style:PROFILE_LAYOUTS.find(layout=>layout===data.layout_style)||'classic',
  cover_path:safe(data.cover_path)||null
 };
}
export function validateDetails(details:ProfileDetails):Omit<ProfileDetails,'cover_path'|'website'|'music_url'>&{
 website:string|null;music_url:string|null
}{
 const interests=[...new Set(details.interests.map(x=>x.trim()).filter(Boolean))];
 if(interests.length>12||interests.some(x=>x.length>32))
  throw new Error('Adicione até 12 interesses de no máximo 32 caracteres.');
 const headline=details.headline.trim(),city=details.city.trim(),mood_text=details.mood_text.trim();
 if(headline.length>140||city.length>120||mood_text.length>160)
  throw new Error('Headline, cidade ou status excedeu o limite.');
 if(details.favorite_emoji.length>16)throw new Error('Escolha um emoji de até 16 caracteres.');
 const urlOrNull=(value:string,label:string)=>{
  const address=value.trim();
  if(!address)return null;
  if(address.length>400)throw new Error(label+' precisa ter até 400 caracteres.');
  try{
   const url=new URL(address);
   if(!['https:','http:'].includes(url.protocol)||url.username||url.password)
    throw new Error('URL inválida');
   return url.toString();
  }catch{throw new Error(label+' deve ser um link http:// ou https:// válido.');}
 };
 if(!PROFILE_THEMES.includes(details.cover_theme)||!PROFILE_LAYOUTS.includes(details.layout_style))
  throw new Error('Tema ou layout inválido.');
 return {headline,city,mood_text,interests,
  favorite_emoji:details.favorite_emoji.trim()||'💜',
  cover_theme:details.cover_theme,layout_style:details.layout_style,
  website:urlOrNull(details.website,'Site'),music_url:urlOrNull(details.music_url,'Música')};
}
