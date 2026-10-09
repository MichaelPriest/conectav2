'use client';

import {ChangeEvent,FormEvent,useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Camera,Clock3,ImagePlus,Loader2,Plus,RefreshCw,Trash2,X} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';
import {optimizeImage} from '@/lib/media';
import {ProfileAvatar} from '@/components/profile-avatar';
import type {UserProfile} from '@/lib/types';

type Story={
  id:string;author_id:string;caption:string;media_path:string;media_type:'image'|'video';
  visibility:'public'|'friends'|'private';created_at:string;expires_at:string;
  profiles:{display_name:string;handle:string;avatar_path:string|null}|null;
};
const VALID_TYPES=['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'];
const MAX_FILE_BYTES=50*1024*1024;

export function StoryRail({userId,profile}:{userId:string;profile:UserProfile|null}){
 const [stories,setStories]=useState<Story[]>([]);
 const [selected,setSelected]=useState<Story|null>(null),[signedUrl,setSignedUrl]=useState('');
 const [caption,setCaption]=useState(''),[visibility,setVisibility]=useState<'public'|'friends'|'private'>('friends');
 const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState('');
 const [creating,setCreating]=useState(false),[loading,setLoading]=useState(true),[deleting,setDeleting]=useState(false);
 const [error,setError]=useState('');
 const picker=useRef<HTMLInputElement>(null);
 const refresh=useCallback(async()=>{
   const {data,error:e}=await supabaseBrowser().from('stories')
     .select('id,author_id,caption,media_path,media_type,visibility,created_at,expires_at,profiles!stories_author_id_fkey(display_name,handle,avatar_path)')
     .gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(80);
   if(e)setError('Não foi possível carregar os Stories: '+e.message);
   else{setStories((data||[]) as unknown as Story[]);setError('');}
   setLoading(false);
 },[]);
 useEffect(()=>{
   void refresh();
   const onFocus=()=>{void refresh();};
   window.addEventListener('focus',onFocus);
   const tick=window.setInterval(()=>{if(!document.hidden)void refresh();},60000);
   return()=>{window.removeEventListener('focus',onFocus);window.clearInterval(tick);};
 },[refresh]);
 useEffect(()=>{
   if(!file){setPreview('');return;}
   const url=URL.createObjectURL(file);setPreview(url);
   return()=>URL.revokeObjectURL(url);
 },[file]);

 async function open(story:Story){
   if(new Date(story.expires_at).getTime()<=Date.now()){void refresh();return;}
   setSelected(story);setSignedUrl('');setError('');
   const {data,error:e}=await supabaseBrowser().storage.from('social-media').createSignedUrl(story.media_path,120);
   if(e||!data?.signedUrl){setError('Não foi possível abrir este Story.');setSelected(null);return;}
   setSignedUrl(data.signedUrl);
 }
 function chooseFile(event:ChangeEvent<HTMLInputElement>){
   const selectedFile=event.target.files?.[0]||null;event.target.value='';
   if(!selectedFile)return;
   if(!VALID_TYPES.includes(selectedFile.type)){setError('Use JPG, PNG, WebP, GIF, MP4 ou WebM.');return;}
   if(selectedFile.size>MAX_FILE_BYTES){setError('Cada Story pode ter até 50 MB.');return;}
   setFile(selectedFile);setError('');
 }
 async function publish(event:FormEvent){
   event.preventDefault();if(!file||!userId||creating)return;
   setCreating(true);setError('');
   const db=supabaseBrowser();let uploadedPath='';
   try{
     const optimized=file.type.startsWith('image/')?await optimizeImage(file):file;
     const extension=optimized.name.split('.').pop()?.toLowerCase()||'bin';
     uploadedPath=userId+'/stories/'+crypto.randomUUID()+'.'+extension;
     const {error:uploadError}=await db.storage.from('social-media')
       .upload(uploadedPath,optimized,{contentType:optimized.type,upsert:false});
     if(uploadError)throw uploadError;
     const {error:insertError}=await db.from('stories').insert({
       author_id:userId,caption:caption.trim(),media_path:uploadedPath,
       media_type:optimized.type.startsWith('video/')?'video':'image',visibility
     });
     if(insertError)throw insertError;
     setFile(null);setCaption('');setVisibility('friends');await refresh();
   }catch(e){
     if(uploadedPath)await db.storage.from('social-media').remove([uploadedPath]);
     setError(e instanceof Error?e.message:'Não foi possível publicar o Story.');
   }finally{setCreating(false);}
 }
 async function removeStory(){
   if(!selected||selected.author_id!==userId||deleting)return;
   if(!window.confirm('Excluir este Story?'))return;
   setDeleting(true);setError('');
   const story=selected,db=supabaseBrowser();
   const {error:e}=await db.from('stories').delete().eq('id',story.id).eq('author_id',userId);
   if(e)setError(e.message);
   else{
     const {error:storageError}=await db.storage.from('social-media').remove([story.media_path]);
     if(storageError)setError('Story excluído, mas a mídia ainda precisa ser removida: '+storageError.message);
     setSelected(null);setSignedUrl('');await refresh();
   }
   setDeleting(false);
 }
 return <section className="conecta-stories card" aria-label="Stories das suas conexões">
   <div className="conecta-stories-header"><div><span className="section-eyebrow">MOMENTOS QUE PASSAM</span><h2>Stories <small>24 horas</small></h2></div>
     <button type="button" className="icon-btn" onClick={()=>void refresh()} title="Atualizar Stories" aria-label="Atualizar Stories"><RefreshCw size={18}/></button>
   </div>
   <div className="conecta-story-strip">
     <button type="button" className="conecta-story-bubble own" onClick={()=>picker.current?.click()}>
       <span className="conecta-story-avatar"><ProfileAvatar person={profile} size="large"/><span className="conecta-story-plus"><Plus size={13}/></span></span>
       <span>Seu Story</span>
     </button>
     {stories.map(story=><button key={story.id} type="button" className="conecta-story-bubble" onClick={()=>void open(story)}
       title={'Story de '+(story.profiles?.display_name||'usuário')}>
       <span className="conecta-story-avatar"><ProfileAvatar person={story.profiles} size="large"/></span>
       <span>{story.author_id===userId?'Você':story.profiles?.display_name||'Usuário'}</span>
     </button>)}
     {!loading&&stories.length===0&&<p className="small-note conecta-stories-empty">Nenhum Story ativo ainda. Compartilhe um momento.</p>}
   </div>
   <form className="conecta-story-form" onSubmit={publish}>
     <input ref={picker} type="file" accept={VALID_TYPES.join(',')} onChange={chooseFile} hidden aria-label="Arquivo do Story"/>
     {file&&<div className="conecta-story-draft">
       <div className="conecta-story-draft-preview">{preview&&(file.type.startsWith('video/')?<video src={preview} controls preload="metadata"/>:<img src={preview} alt="Prévia do Story"/>)}</div>
       <div className="conecta-story-draft-fields">
         <strong>{file.name}</strong>
         <input className="form-input" value={caption} maxLength={300} onChange={e=>setCaption(e.target.value)} placeholder="Legenda opcional" aria-label="Legenda do Story"/>
         <select className="form-input" value={visibility} onChange={e=>setVisibility(e.target.value as typeof visibility)} aria-label="Quem pode ver o Story">
           <option value="friends">Amigos</option><option value="public">Público</option><option value="private">Somente eu</option>
         </select>
         <div className="row"><button type="submit" className="btn btn-primary" disabled={creating}>{creating?<Loader2 size={17} className="spin"/>:<ImagePlus size={17}/>} Publicar Story</button>
           <button type="button" className="btn btn-outline" disabled={creating} onClick={()=>setFile(null)}>Cancelar</button></div>
       </div>
     </div>}
   </form>
   {error&&<p role="alert" className="form-error">{error}</p>}
   {selected&&<div className="conecta-story-overlay" role="presentation">
     <section className="conecta-story-viewer" role="dialog" aria-modal="true" aria-label={'Story de '+(selected.profiles?.display_name||'usuário')}>
       <header><ProfileAvatar person={selected.profiles} size="small"/><div><strong>{selected.profiles?.display_name||'Story'}</strong>
         <small><Clock3 size={12}/> até {new Date(selected.expires_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small></div>
         <button type="button" className="icon-btn" aria-label="Fechar Story" onClick={()=>{setSelected(null);setSignedUrl('');}}><X size={22}/></button>
       </header>
       <div className="conecta-story-media">{!signedUrl?<Loader2 className="spin" size={30}/>:selected.media_type==='video'
         ?<video key={selected.id} src={signedUrl} autoPlay controls playsInline preload="metadata"/>
         :<img src={signedUrl} alt={selected.caption||'Story em foto'}/>}</div>
       {selected.caption&&<p className="conecta-story-caption">{selected.caption}</p>}
       <footer>{selected.profiles?.handle&&<Link href={'/p/'+selected.profiles.handle}>Ver perfil</Link>}
         {selected.author_id===userId&&<button type="button" disabled={deleting} onClick={()=>void removeStory()}><Trash2 size={16}/> Excluir</button>}
       </footer>
     </section>
   </div>}
 </section>;
}
