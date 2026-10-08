'use client';
import {useEffect,useState} from 'react';
import {supabaseBrowser} from '@/lib/supabase/browser';
type Person={display_name?:string|null;avatar_path?:string|null};
const cache=new Map<string,{url:string;expires:number}>();
export function ProfileAvatar({person,size='normal',className='',alt}:{person:Person|null|undefined;size?:'tiny'|'small'|'normal'|'large';className?:string;alt?:string}){
 const path=person?.avatar_path||null;const [url,setUrl]=useState<string|null>(null);
 useEffect(()=>{
   let active=true;
   if(!path){setUrl(null);return;}
   const found=cache.get(path);
   if(found&&found.expires>Date.now()){setUrl(found.url);return;}
   setUrl(null);
   void supabaseBrowser().storage.from('social-media').createSignedUrl(path,3600).then(({data,error})=>{
     if(!active)return;
     if(!error&&data?.signedUrl){cache.set(path,{url:data.signedUrl,expires:Date.now()+50*60*1000});setUrl(data.signedUrl);}
   });
   return()=>{active=false;};
 },[path]);
 return <span className={['avatar','avatar-gradient','conecta-profile-avatar','avatar-'+size,className].join(' ')}
   role="img" aria-label={alt||('Foto de '+(person?.display_name||'pessoa'))}>
   {url?<img alt="" src={url} loading="lazy" onError={()=>setUrl(null)}/>:<span>{person?.display_name?.trim()?.[0]?.toUpperCase()||'C'}</span>}
 </span>;
}
