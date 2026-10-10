'use client';

import {ChangeEvent,FormEvent,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {Camera,ChevronLeft,ChevronRight,Clock3,ImagePlus,Loader2,Plus,RefreshCw,Trash2,X} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';
import {optimizeImage} from '@/lib/media';
import {requestContentModeration} from '@/lib/submit-moderation';
import {ProfileAvatar} from '@/components/profile-avatar';
import {ModerationAppealButton} from '@/components/moderation-appeal-button';
import type {UserProfile} from '@/lib/types';

type Story={
  id:string;author_id:string;caption:string;media_path:string|null;media_type:'image'|'video'|null;
  shared_post_id:string|null;
  visibility:'public'|'friends'|'private';moderation_status:'approved'|'pending'|'rejected';created_at:string;expires_at:string;
  profiles:{display_name:string;handle:string;avatar_path:string|null}|null;
};
const VALID_TYPES=['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'];
const MAX_FILE_BYTES=50*1024*1024;

export function StoryRail({userId,profile}:{userId:string;profile:UserProfile|null}){
 const [stories,setStories]=useState<Story[]>([]);
 const [selected,setSelected]=useState<Story|null>(null),[signedUrl,setSignedUrl]=useState('');
 const [sharedPost,setSharedPost]=useState<{id:string;content:string;name:string}|null>(null);
 const [sharedLoaded,setSharedLoaded]=useState(false);
 const [mediaLoaded,setMediaLoaded]=useState(false);
 const [progress,setProgress]=useState(0);
 const [paused,setPaused]=useState(false);
 const [seen,setSeen]=useState<Set<string>>(new Set());
 const videoRef=useRef<HTMLVideoElement|null>(null);
 const openRequest=useRef(0);
 const [caption,setCaption]=useState(''),[visibility,setVisibility]=useState<'public'|'friends'|'private'>('friends');
 const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState('');
 const [creating,setCreating]=useState(false),[loading,setLoading]=useState(true),[deleting,setDeleting]=useState(false);
 const [error,setError]=useState('');
 const picker=useRef<HTMLInputElement>(null);
 const refresh=useCallback(async()=>{
   const {data,error:e}=await supabaseBrowser().from('stories')
     .select('id,author_id,caption,media_path,media_type,shared_post_id,visibility,moderation_status,created_at,expires_at,profiles!stories_author_id_fkey(display_name,handle,avatar_path)')
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

 const timeline=useMemo(()=>{
  const groups=new Map<string,Story[]>();
  for(const story of stories){
   if(Date.parse(story.expires_at)<=Date.now())continue;
   const list=groups.get(story.author_id)||[];
   list.push(story);groups.set(story.author_id,list);
  }
  const owners=[...groups.keys()];
  if(owners.includes(userId)){owners.splice(owners.indexOf(userId),1);owners.unshift(userId);}
  return owners.flatMap(owner=>(groups.get(owner)||[]).sort((a,b)=>
   a.created_at.localeCompare(b.created_at)));
 },[stories,userId]);
 const bubbles=useMemo(()=>{
  const byOwner=new Map<string,Story>();
  for(const story of timeline)if(!byOwner.has(story.author_id))
   byOwner.set(story.author_id,story);
  return [...byOwner.values()];
 },[timeline]);
 const selectedIndex=selected?timeline.findIndex(s=>s.id===selected.id):-1;
 const groupStories=selected?timeline.filter(s=>s.author_id===selected.author_id):[];
 const groupIndex=selected?groupStories.findIndex(s=>s.id===selected.id):-1;
 const close=useCallback(()=>{openRequest.current++;setSelected(null);setSignedUrl('');setSharedPost(null);},[]);
 const open=useCallback(async(story:Story)=>{
   if(Date.parse(story.expires_at)<=Date.now()){void refresh();return;}
   const requestId=++openRequest.current;
   setSelected(story);setSignedUrl('');setError('');setSharedPost(null);
   setSharedLoaded(false);setMediaLoaded(false);setProgress(0);setPaused(false);
   setSeen(previous=>new Set(previous).add(story.id));
   const db=supabaseBrowser();
   if(story.shared_post_id){
    const {data,error:e}=await db.from('posts')
      .select('id,content,visibility,moderation_status,community_id,profiles!posts_author_id_fkey(display_name)')
      .eq('id',story.shared_post_id).maybeSingle();
    if(openRequest.current!==requestId)return;
    if(!e&&data&&data.visibility==='public'&&data.moderation_status==='approved'&&!data.community_id){
     const person=data.profiles as unknown as {display_name:string}|null;
     setSharedPost({id:data.id,content:data.content,name:person?.display_name||'Pessoa do Conecta'});
    }
    setSharedLoaded(true);
    return;
   }
   if(!story.media_path){setError('Story sem mídia válida.');setMediaLoaded(true);return;}
   const {data,error:e}=await db.storage.from('social-media').createSignedUrl(story.media_path,120);
   if(openRequest.current!==requestId)return;
   if(e||!data?.signedUrl){setError('Não foi possível abrir este Story.');setMediaLoaded(true);return;}
   setSignedUrl(data.signedUrl);
 },[refresh]);
 const advance=useCallback((step:1|-1)=>{
  const target=timeline[selectedIndex+step];
  if(target)void open(target);else close();
 },[timeline,selectedIndex,open,close]);
 const next=useCallback(()=>advance(1),[advance]);
 useEffect(()=>{
  if(!selected||paused||selected.media_type==='video')return;
  if(selected.shared_post_id?!sharedLoaded:!mediaLoaded)return;
  const started=Date.now()-progress*6500;
  const timer=window.setInterval(()=>{
   const p=Math.min(1,(Date.now()-started)/6500);
   setProgress(p);
   if(p>=1)next();
  },125);
  return()=>window.clearInterval(timer);
  // Each new Story resets its progress to zero in open.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[selected?.id,paused,sharedLoaded,mediaLoaded,next]);
 useEffect(()=>{
  if(!videoRef.current)return;
  if(paused)videoRef.current.pause();
  else void videoRef.current.play().catch(()=>{});
 },[paused,selected?.id,signedUrl]);
 function openBubble(story:Story){
  const nextUnread=timeline.find(s=>s.author_id===story.author_id&&!seen.has(s.id))||story;
  void open(nextUnread);
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
     const {data:created,error:insertError}=await db.from('stories').insert({
       author_id:userId,caption:caption.trim(),media_path:uploadedPath,
       media_type:optimized.type.startsWith('video/')?'video':'image',visibility
     }).select('id').single();
     if(insertError)throw insertError;
     const moderation=await requestContentModeration('story',created.id);
     if(moderation.status==='pending')setError('Story recebido, aguardando revisão da mídia antes de ser exibido a outras pessoas.');
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
     const {error:storageError}=story.media_path?
      await db.storage.from('social-media').remove([story.media_path]):{error:null};
     if(storageError)setError('Story excluído, mas a mídia ainda precisa ser removida: '+storageError.message);
     close();await refresh();
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
     {bubbles.map(story=><button key={story.id} type="button" className="conecta-story-bubble" onClick={()=>openBubble(story)}
       title={'Story de '+(story.profiles?.display_name||'usuário')}>
       <span className="conecta-story-avatar" style={{opacity:timeline.filter(x=>x.author_id===story.author_id).every(x=>seen.has(x.id))?0.65:1}}>
         <ProfileAvatar person={story.profiles} size="large"/></span>
       <span>{story.author_id===userId?'Você':story.profiles?.display_name||'Usuário'}{story.moderation_status!=='approved'?' · Em revisão':''}</span>
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
   <p className="small-note conecta-moderation-disclosure">Stories com fotos e vídeos ficam pendentes até verificação. Com IA externa habilitada, a mídia poderá ser analisada pelo provedor; vídeos continuam sujeitos a revisão humana.</p>
   {error&&<p role="alert" className="form-error">{error}</p>}
   {selected&&<div className="conecta-story-overlay" role="presentation">
     <section className="conecta-story-viewer" role="dialog" aria-modal="true"
      aria-label={'Stories de '+(selected.profiles?.display_name||'usuário')}>
       <div style={{display:'flex',gap:4,padding:'8px 12px'}}>
        {groupStories.map((item,i)=><div key={item.id} style={{flex:1,height:3,
         borderRadius:6,background:'rgba(255,255,255,.32)',overflow:'hidden'}}>
         <div style={{width:i<groupIndex?'100%':i===groupIndex?Math.round(progress*100)+'%':'0%',
          height:'100%',background:'#fff'}}/>
        </div>)}
       </div>
       <header><ProfileAvatar person={selected.profiles} size="small"/>
        <div><strong>{selected.profiles?.display_name||'Story'}</strong>
         <small><Clock3 size={12}/> {groupIndex+1} de {groupStories.length} · 24h</small>
        </div>
        <button type="button" className="icon-btn" onClick={()=>setPaused(p=>!p)}
         aria-label={paused?'Retomar Story':'Pausar Story'}>
         {paused?'▶':'Ⅱ'}
        </button>
        <button type="button" className="icon-btn" aria-label="Fechar Story"
         onClick={close}><X size={22}/></button>
       </header>
       <div className="conecta-story-media">
        {selected.shared_post_id?
         !sharedLoaded?<Loader2 className="spin" size={30}/>:
         sharedPost?<div style={{padding:26,textAlign:'center',color:'white'}}>
          <small>PUBLICAÇÃO COMPARTILHADA</small>
          <h3>{sharedPost.name}</h3>
          <p style={{fontSize:18,lineHeight:1.5,whiteSpace:'pre-wrap'}}>
           {sharedPost.content||'Veja a publicação no Conecta.'}
          </p>
          <Link className="btn btn-primary" href={'/post/'+sharedPost.id}
           onClick={close}>Abrir publicação original</Link>
         </div>:
         <p style={{padding:20}}>A publicação não está mais disponível ao público.</p>:
         !signedUrl?<Loader2 className="spin" size={30}/>:
         selected.media_type==='video'
         ?<video key={selected.id} ref={videoRef} src={signedUrl} autoPlay controls
           playsInline preload="metadata" onEnded={next}
           onTimeUpdate={e=>{
            const target=e.currentTarget;
            if(target.duration>0)setProgress(Math.min(1,target.currentTime/target.duration));
           }}
           onLoadedData={()=>setMediaLoaded(true)}/>
         :<img src={signedUrl} alt={selected.caption||'Story em foto'}
           onLoad={()=>setMediaLoaded(true)} onError={()=>setError('A foto não pôde ser exibida.')}/>}
       </div>
       {selected.caption&&<p className="conecta-story-caption">{selected.caption}</p>}
       {selected.author_id===userId&&selected.moderation_status==='rejected'&&
        <ModerationAppealButton kind="story" targetId={selected.id}/>}
       <footer>
        <button type="button" className="btn btn-outline" aria-label="Story anterior"
         onClick={()=>advance(-1)}><ChevronLeft size={19}/> Anterior</button>
        {selected.profiles?.handle&&<Link href={'/p/'+selected.profiles.handle}>
         Ver perfil
        </Link>}
        <button type="button" className="btn btn-outline" aria-label="Próximo Story"
         onClick={next}>Próximo <ChevronRight size={19}/></button>
        {selected.author_id===userId&&<button type="button" disabled={deleting}
         onClick={()=>void removeStory()}><Trash2 size={16}/> Excluir</button>}
       </footer>
     </section>
   </div>}
 </section>;
}
