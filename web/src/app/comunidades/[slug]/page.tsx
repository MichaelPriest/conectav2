'use client';

import {FormEvent,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {ArrowLeft,BarChart3,Camera,Check,Edit3,ImagePlus,MessageCircle,Send,Users,UserPlus,Video,X,ShieldCheck} from 'lucide-react';
import {GuardedPage,useAuthProfile} from '@/components/app-shell';
import {ProfileAvatar} from '@/components/profile-avatar';
import {PostCard} from '@/components/post-card';
import {EmojiButton} from '@/components/emoji-button';
import {PollDraft,validatePoll} from '@/components/poll-draft';
import {attachPoll} from '@/lib/create-poll';
import {supabaseBrowser} from '@/lib/supabase/browser';
import {optimizeImage} from '@/lib/media';
import {communityVisual} from '@/lib/community-visuals';
import type {FeedPost} from '@/lib/types';
import {hydratePostMedia} from '@/lib/post-media';

type Community={
 id:string;name:string;slug:string;description:string;rules:string;owner_id:string|null;
 cover_path:string|null;avatar_path:string|null;created_at:string;is_official:boolean
};
type Media={storage_path:string;media_type:'image'|'video';position:number};
const PAGE_SIZE=15;

export default function CommunityDetail(){
 const auth=useAuthProfile(),params=useParams<{slug:string}>();
 const [community,setCommunity]=useState<Community|null>(null);
 const [coverUrl,setCoverUrl]=useState<string|null>(null),[avatarUrl,setAvatarUrl]=useState<string|null>(null);
 const [member,setMember]=useState(false),[count,setCount]=useState(0);
 const [posts,setPosts]=useState<FeedPost[]>([]),[text,setText]=useState('');
 const [files,setFiles]=useState<File[]>([]),[pollMode,setPollMode]=useState(false);
 const [pollOptions,setPollOptions]=useState(['','']),[pollDays,setPollDays]=useState(7);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[hasMore,setHasMore]=useState(false),[offset,setOffset]=useState(0);
 const [error,setError]=useState(''),[editing,setEditing]=useState(false),[description,setDescription]=useState(''),[rules,setRules]=useState('');
 const [coverFile,setCoverFile]=useState<File|null>(null),[avatarFile,setAvatarFile]=useState<File|null>(null);
 const [tab,setTab]=useState<'all'|'photos'|'videos'|'polls'>('all');
 const picker=useRef<HTMLInputElement>(null);
 const [mediaMode,setMediaMode]=useState<'image'|'video'>('image');
 const previews=useMemo(()=>files.map(f=>({file:f,url:URL.createObjectURL(f)})),[files]);
 useEffect(()=>()=>previews.forEach(p=>URL.revokeObjectURL(p.url)),[previews]);
 const isOwner=community?.owner_id===auth.user?.id&&Boolean(auth.user);
 const [canModerate,setCanModerate]=useState(false);

 const fetchPosts=useCallback(async(id:string,from=0,append=false)=>{
   const db=supabaseBrowser();
   const {data,error:e}=await db.from('posts')
    .select('id,author_id,content,visibility,media_path,media_type,created_at,profiles!posts_author_id_fkey(handle,display_name,avatar_path),post_likes(count),post_comments(count),post_media(storage_path,media_type,position)')
    .eq('community_id',id).order('created_at',{ascending:false}).range(from,from+PAGE_SIZE-1);
   if(e){setError(e.message);return;}
   const rows=(data||[]) as unknown as FeedPost[];
   const hydrated=await hydratePostMedia(db,rows);
   setPosts(previous=>append?[...previous,...hydrated]:hydrated);
   setOffset(from+rows.length);setHasMore(rows.length===PAGE_SIZE);
 },[]);

 const load=useCallback(async()=>{
   if(!auth.user||!params.slug)return;
   setLoading(true);setError('');
   const db=supabaseBrowser();
   const {data,error:e}=await db.from('communities')
     .select('id,name,slug,description,rules,cover_path,avatar_path,owner_id,created_at,is_official')
     .eq('slug',params.slug).maybeSingle();
   if(e){setError(e.message);setLoading(false);return;}
   setCommunity(data as Community|null);
   if(data){
     const {data:role}=await db.from('community_staff').select('role').eq('community_id',data.id).eq('user_id',auth.user.id).maybeSingle();
     setCanModerate(data.owner_id===auth.user.id||Boolean(role));
     setDescription(data.description);setRules(data.rules||'');
     const [membership,total,...urls]=await Promise.all([
       db.from('community_members').select('user_id').eq('community_id',data.id).eq('user_id',auth.user.id).maybeSingle(),
       db.from('community_members').select('user_id',{head:true,count:'exact'}).eq('community_id',data.id),
       data.cover_path?db.storage.from('social-media').createSignedUrl(data.cover_path,3600):Promise.resolve({data:null}),
       data.avatar_path?db.storage.from('social-media').createSignedUrl(data.avatar_path,3600):Promise.resolve({data:null})
     ]);
     setMember(Boolean(membership.data));setCount(total.count||0);
     setCoverUrl(urls[0]?.data?.signedUrl||null);setAvatarUrl(urls[1]?.data?.signedUrl||null);
     await fetchPosts(data.id);
   }
   setLoading(false);
 },[auth.user,params.slug,fetchPosts]);
 useEffect(()=>{void load();},[load]);

 async function toggleMembership(){
   if(!community||!auth.user||busy)return;
   setBusy(true);setError('');
   const db=supabaseBrowser();
   const {error:e}=member?
     await db.from('community_members').delete().eq('community_id',community.id).eq('user_id',auth.user.id):
     await db.from('community_members').insert({community_id:community.id,user_id:auth.user.id});
   if(e)setError(e.message);
   else {setMember(!member);setCount(v=>v+(member?-1:1));}
   setBusy(false);
 }

 function pickMedia(type:'image'|'video'){
   setMediaMode(type);setPollMode(false);
   const input=picker.current;
   if(input){input.accept=type==='image'?'image/jpeg,image/png,image/webp,image/gif':'video/mp4,video/webm';input.multiple=type==='image';input.click();}
 }
 function chooseFiles(event:React.ChangeEvent<HTMLInputElement>){
   const selected=Array.from(event.target.files||[]);
   const accepted=selected.filter(f=>mediaMode==='image'?['image/jpeg','image/png','image/webp','image/gif'].includes(f.type):['video/mp4','video/webm'].includes(f.type));
   setFiles(accepted.slice(0,mediaMode==='image'?5:1));event.target.value='';
 }
 async function publish(event:FormEvent<HTMLFormElement>){
   event.preventDefault();
   if(!community||!auth.user||!member||busy||(!text.trim()&&!files.length))return;
   if(pollMode){try{validatePoll(text,pollOptions);}catch(e){setError(e instanceof Error?e.message:'Enquete inválida.');return;}}
   setBusy(true);setError('');
   const db=supabaseBrowser();
   const uploads:Media[]=[];
   let postId:string|null=null,rollbackFailed=false;
   try{
     if(files.some(f=>f.size>50*1024*1024))throw new Error('Cada arquivo deve ter até 50 MB.');
     for(const [position,file] of files.entries()){
       const prepared=file.type.startsWith('image/')?await optimizeImage(file):file;
       const type:'image'|'video'=prepared.type.startsWith('video/')?'video':'image';
       const ext=prepared.name.split('.').pop()?.toLowerCase()||'bin';
       const storage_path=auth.user.id+'/'+crypto.randomUUID()+'.'+ext;
       const {error:e}=await db.storage.from('social-media').upload(storage_path,prepared,{contentType:prepared.type,upsert:false});
       if(e)throw e;
       uploads.push({storage_path,media_type:type,position});
     }
     const first=uploads[0];
     const {data:created,error:e}=await db.from('posts').insert({
       author_id:auth.user.id,community_id:community.id,content:text.trim(),visibility:'public',
       media_path:first?.storage_path||null,media_type:first?.media_type||null
     }).select('id').single();
     if(e)throw e;
     postId=created.id;
     if(uploads.length){
       const {error:mediaError}=await db.from('post_media').insert(uploads.map(x=>({post_id:created.id,owner_id:auth.user!.id,...x})));
       if(mediaError)throw mediaError;
     }
     if(pollMode)await attachPoll(db,created.id,text,pollOptions,pollDays);
     setFiles([]);setText('');setPollOptions(['','']);setPollMode(false);setTab('all');
     await fetchPosts(community.id);
   }catch(err){
     if(postId){const {error:e}=await db.from('posts').delete().eq('id',postId);rollbackFailed=Boolean(e);}
     if(!rollbackFailed&&uploads.length)await db.storage.from('social-media').remove(uploads.map(x=>x.storage_path));
     setError((err instanceof Error?err.message:'Erro ao publicar.')+(rollbackFailed?' Verifique a publicação parcial na lista.':''));
   }finally{setBusy(false);}
 }
 async function saveCommunity(e:FormEvent){
   e.preventDefault();if(!isOwner||!community||!auth.user||busy)return;
   setBusy(true);setError('');
   const db=supabaseBrowser();
   const added:string[]=[];
   const changes:{description:string;rules:string;cover_path?:string;avatar_path?:string}={description:description.trim(),rules:rules.trim()};
   try{
     for(const [kind,file] of [['cover_path',coverFile],['avatar_path',avatarFile]] as const){
       if(!file)continue;
       if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)throw new Error('A imagem deve ser JPG/PNG/WebP com até 8 MB.');
       const optimized=await optimizeImage(file);
       const ext=optimized.name.split('.').pop()?.toLowerCase()||'webp';
       const path=auth.user.id+'/community/'+crypto.randomUUID()+'.'+ext;
       const {error:e}=await db.storage.from('social-media').upload(path,optimized,{contentType:optimized.type});
       if(e)throw e;
       added.push(path);changes[kind]=path;
     }
     const {error:e}=await db.from('communities').update(changes).eq('id',community.id).eq('owner_id',auth.user.id);
     if(e)throw e;
     setEditing(false);setCoverFile(null);setAvatarFile(null);await load();
   }catch(err){
     if(added.length)await db.storage.from('social-media').remove(added);
     setError(err instanceof Error?err.message:'Não foi possível atualizar a comunidade.');
   }finally{setBusy(false);}
 }
 const visible=posts.filter(p=>tab==='all'||(tab==='photos'&&p.media?.some(m=>m.type==='image'))||
   (tab==='videos'&&p.media?.some(m=>m.type==='video'))||
   (tab==='polls'&&false));
 return <GuardedPage {...auth}><main className="section-page">
   <Link href="/comunidades" className="rail-link"><ArrowLeft size={16}/> Voltar às comunidades</Link>
   {loading?<div className="centered-loading">Carregando comunidade...</div>:!community?<div className="empty-state card"><h3>Comunidade não encontrada</h3></div>:<>
    <div className="conecta-community-hero">
      <div className="conecta-community-cover" style={coverUrl?{backgroundImage:'linear-gradient(0deg,#171534aa,#ffffff0c),url('+JSON.stringify(coverUrl)+')'}:{background:communityVisual(community.slug).gradient}}>
        {!coverUrl&&<span className="conecta-community-cover-emoji" aria-hidden="true">{communityVisual(community.slug).emoji}</span>}
      </div>
      <div className="conecta-community-identity"><div className="conecta-community-icon">{avatarUrl?<img src={avatarUrl} alt={'Logo de '+community.name}/>:<span className="conecta-community-emoji">{communityVisual(community.slug).emoji}</span>}</div>
        <div><span className="section-eyebrow">{community.is_official?'COMUNIDADE OFICIAL':'COMUNIDADE CONECTA'}</span><h1>{community.name}</h1><p>{community.description}</p>
        <span className="small-note">{count} {count===1?'membro':'membros'} · Desde {new Date(community.created_at).toLocaleDateString('pt-BR')}</span></div>
      </div>
      <div className="conecta-community-buttons"><button type="button" className={'btn '+(member?'btn-outline':'btn-primary')} onClick={toggleMembership} disabled={busy}>
        {member?<Check size={18}/>:<UserPlus size={18}/>} {member?'Participando · Sair':'Participar da comunidade'}</button>
        {isOwner&&<button type="button" className="btn btn-outline" onClick={()=>setEditing(v=>!v)}><Edit3 size={17}/> Editar comunidade</button>}
        {canModerate&&<Link className="btn btn-outline" href={'/comunidades/'+community.slug+'/moderar'}><ShieldCheck size={17}/> Administrar / Moderação</Link>}
      </div>
    </div>
    {error&&<p className="form-error" role="alert">{error}</p>}
    {editing&&isOwner&&<form className="panel stack" onSubmit={saveCommunity} style={{maxWidth:750,marginBottom:20}}>
      <h2>Personalizar comunidade</h2>
      <label className="field-label">Descrição<textarea maxLength={2000} rows={3} required className="form-input" value={description} onChange={e=>setDescription(e.target.value)}/></label>
      <label className="field-label">Regras da comunidade<textarea maxLength={3000} rows={4} className="form-input" value={rules} onChange={e=>setRules(e.target.value)}/></label>
      <label className="field-label">Imagem de capa<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setCoverFile(e.target.files?.[0]||null)}/></label>
      <label className="field-label">Imagem do ícone<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setAvatarFile(e.target.files?.[0]||null)}/></label>
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy?'Salvando...':'Salvar alterações'}</button>
    </form>}
    <div className="conecta-community-columns"><div>
      {member&&<section className="composer card">
        <div className="composer-top"><ProfileAvatar person={auth.profile}/><div><strong>Compartilhe com a comunidade</strong><span>Discussões, fotos, vídeos e enquetes</span></div></div>
        <form onSubmit={publish}>
          <textarea rows={3} value={text} onChange={e=>setText(e.target.value)} maxLength={3000} placeholder={pollMode?'Qual é a pergunta da enquete?':'O que você gostaria de compartilhar?'}/>
          {pollMode&&<PollDraft question={text} options={pollOptions} onOptionsChange={setPollOptions} days={pollDays} onDaysChange={setPollDays}/>}
          {previews.length>0&&<div className="composer-preview-grid">{previews.map((p,index)=><div className="composer-preview-item" key={p.url}>
            {p.file.type.startsWith('video/')?<video src={p.url} controls preload="metadata"/>:<img src={p.url} alt={'Prévia '+(index+1)}/>}
            <button type="button" aria-label="Remover" className="composer-preview-remove" onClick={()=>setFiles(v=>v.filter((_,i)=>i!==index))}><X size={16}/></button>
          </div>)}</div>}
          <div className="composer-bottom conecta-community-composer">
            <input hidden ref={picker} type="file" onChange={chooseFiles}/>
            <button type="button" className="btn btn-outline" onClick={()=>pickMedia('image')}><ImagePlus size={17}/> Foto</button>
            <button type="button" className="btn btn-outline" onClick={()=>pickMedia('video')}><Video size={17}/> Vídeo</button>
            <button type="button" className="btn btn-outline" aria-pressed={pollMode} onClick={()=>{setPollMode(v=>!v);setFiles([]);}}><BarChart3 size={17}/> Enquete</button>
            <EmojiButton onSelect={emoji=>setText(t=>(t+emoji).slice(0,3000))}/>
            <button type="submit" className="btn btn-primary" disabled={busy||(!text.trim()&&!files.length)}><Send size={17}/> Publicar</button>
          </div>
        </form>
      </section>}
      {!member&&<div className="panel"><MessageCircle size={22}/><p>Participe para compartilhar suas publicações.</p></div>}
      <div className="feed-title" style={{marginTop:22}}><h2>Publicações da comunidade</h2></div>
      <div className="conecta-profile-tabs">
        {(['all','photos','videos'] as const).map(t=><button key={t} className={tab===t?'active':''} type="button" onClick={()=>setTab(t)}>
          {t==='all'?'Tudo':t==='photos'?'Fotos':t==='videos'?'Vídeos':''}</button>)}
      </div>
      <div className="feed-list">{visible.length===0&&<div className="empty-state card"><MessageCircle size={23}/><h3>Nenhuma publicação nessa categoria</h3></div>}
      {visible.map(p=><PostCard key={p.id} post={p} userId={auth.user?.id||''} refresh={()=>fetchPosts(community.id)}/>)}</div>
      {hasMore&&<button className="btn btn-outline" type="button" onClick={()=>fetchPosts(community.id,offset,true)}>Carregar mais</button>}
    </div><aside className="conecta-community-side">
      <section className="panel"><h3>Sobre esta comunidade</h3><p>{community.description}</p><hr/><strong>Regras de convivência</strong>
        <p className="small-note" style={{whiteSpace:'pre-wrap'}}>{community.rules||'Respeite os participantes. Nada de spam, intimidação, golpes ou conteúdo ilegal.'}</p></section>
      <section className="conecta-ad-placeholder"><span>ESPAÇO RESERVADO PARA PUBLICIDADE</span><strong>Sua marca no Conecta</strong><p>Nenhum anúncio ativo. Futuramente, publicidade identificada e adequada à idade.</p></section>
    </aside></div>
   </>}
 </main></GuardedPage>;
}
