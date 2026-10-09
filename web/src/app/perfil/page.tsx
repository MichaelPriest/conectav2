'use client';
import {FormEvent,useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {Camera,ExternalLink,ImagePlus,MapPin,Save,ShieldCheck,Sparkles,Trash2} from 'lucide-react';
import {GuardedPage,useAuthProfile} from '@/components/app-shell';
import {supabaseBrowser} from '@/lib/supabase/browser';
import {optimizeImage} from '@/lib/media';
import {EmojiButton} from '@/components/emoji-button';
import {MusicEmbed,parseMusicUrl} from '@/components/music-embed';
import {ProfileTimeline} from '@/components/profile-timeline';
import {MySpacePanel} from '@/components/myspace-panel';
import {LanguageSelect} from '@/lib/i18n';
import {normalizeProfileDetails,prepareProfileDetails,DEFAULT_PROFILE_DETAILS} from '@/lib/profile-details';
import type {ProfileDetails} from '@/lib/profile-details';

type Details=ProfileDetails;
const empty=DEFAULT_PROFILE_DETAILS;
const themes:Details['cover_theme'][]=['violet','aqua','pink','sunset','midnight'];

export default function Profile(){
 const auth=useAuthProfile();
 const [name,setName]=useState(''),[handle,setHandle]=useState(''),[bio,setBio]=useState('');
 const [details,setDetails]=useState<Details>(empty);
 const [interestsInput,setInterestsInput]=useState('');
 const [avatarUrl,setAvatarUrl]=useState<string|null>(null);
 const [avatarFile,setAvatarFile]=useState<File|null>(null);
 const [coverPath,setCoverPath]=useState<string|null>(null);
 const [coverUrl,setCoverUrl]=useState<string|null>(null);
 const [coverSaving,setCoverSaving]=useState(false);
 const [posts,setPosts]=useState(0),[friends,setFriends]=useState(0);
 const [saving,setSaving]=useState(false),[ready,setReady]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{
   if(!auth.user)return;
   const db=supabaseBrowser();
   const [p,f,d]=await Promise.all([
     db.from('posts').select('id',{count:'exact',head:true}).eq('author_id',auth.user.id),
     db.from('friendships').select('id',{count:'exact',head:true}).eq('status','accepted').or('requester_id.eq.'+auth.user.id+',addressee_id.eq.'+auth.user.id),
     db.from('profile_details').select('headline,city,website,music_url,interests,favorite_emoji,cover_theme,mood_text,layout_style,cover_path').eq('user_id',auth.user.id).maybeSingle()
   ]);
   if(!p.error)setPosts(p.count||0);
   if(!f.error)setFriends(f.count||0);
   if(d.error)setError(d.error.message);
   else if(d.data){
     const v=normalizeProfileDetails(d.data);
     setDetails(v);setInterestsInput(v.interests.join(', '));
     setCoverPath(d.data.cover_path||null);
     if(d.data.cover_path){
       const {data:cover}=await db.storage.from('social-media').createSignedUrl(d.data.cover_path,3600);
       setCoverUrl(cover?.signedUrl||null);
     }else setCoverUrl(null);
   }
   if(auth.profile?.avatar_path){
     const {data}=await db.storage.from('social-media').createSignedUrl(auth.profile.avatar_path,3600);
     setAvatarUrl(data?.signedUrl||null);
   }
   setReady(true);
 },[auth.user,auth.profile?.avatar_path]);

 useEffect(()=>{
   if(auth.profile){setName(auth.profile.display_name);setHandle(auth.profile.handle);setBio(auth.profile.bio||'');}
 },[auth.profile]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{
   if(!avatarFile)return;
   const url=URL.createObjectURL(avatarFile);setAvatarUrl(url);
   return()=>URL.revokeObjectURL(url);
 },[avatarFile]);

 async function uploadCover(file:File|null){
   if(!file||!auth.user||coverSaving)return;
   setError('');setNotice('');setCoverSaving(true);
   const db=supabaseBrowser();let uploaded='';
   try{
     if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)
       throw new Error('A capa deve ser JPG, PNG ou WebP, até 8 MB.');
     const prepared=await optimizeImage(file);
     const ext=prepared.name.split('.').pop()?.toLowerCase()||'webp';
     uploaded=auth.user.id+'/covers/'+crypto.randomUUID()+'.'+ext;
     const {error:uploadError}=await db.storage.from('social-media').upload(uploaded,prepared,{contentType:prepared.type,upsert:false});
     if(uploadError)throw uploadError;
     const {error:saveError}=await db.from('profile_details').upsert({user_id:auth.user.id,cover_path:uploaded},{onConflict:'user_id'});
     if(saveError)throw saveError;
     const previous=coverPath;setCoverPath(uploaded);
     const {data:signed}=await db.storage.from('social-media').createSignedUrl(uploaded,3600);
     setCoverUrl(signed?.signedUrl||null);
     if(previous)await db.storage.from('social-media').remove([previous]);
     setNotice('Imagem de capa atualizada.');
   }catch(e){
     if(uploaded)await db.storage.from('social-media').remove([uploaded]);
     setError(e instanceof Error?e.message:'Não foi possível salvar a capa.');
   }finally{setCoverSaving(false);}
 }
 async function removeCover(){
   if(!auth.user||!coverPath||coverSaving)return;
   setCoverSaving(true);setError('');
   const old=coverPath;
   const db=supabaseBrowser();
   const {error:e}=await db.from('profile_details').update({cover_path:null}).eq('user_id',auth.user.id);
   if(e)setError(e.message);
   else{setCoverPath(null);setCoverUrl(null);await db.storage.from('social-media').remove([old]);setNotice('Capa personalizada removida.');}
   setCoverSaving(false);
 }
 async function submit(event:FormEvent){
   event.preventDefault();if(!auth.user||saving)return;
   setSaving(true);setError('');setNotice('');
   const db=supabaseBrowser();let uploaded:string|null=null;
   let detailsSaved=false;
   try {
     const username=(handle||'').trim().toLowerCase().replace(/^@/,'');
     if(!/^[a-z0-9_]{3,30}$/.test(username))throw new Error('Usuário inválido. Use de 3 a 30 letras, números ou _.');
     const payload=prepareProfileDetails(details,interestsInput);
     if(payload.music_url&&!parseMusicUrl(payload.music_url)){
       throw new Error('Use um link de Spotify, YouTube, SoundCloud ou Apple Music.');
     }
     if(payload.website){
       try{
         const url=new URL(payload.website);
         if(url.protocol!=='https:')throw new Error('Protocolo inválido');
       }catch{throw new Error('Seu site precisa ser uma URL HTTPS válida.');}
     }
     if(avatarFile){
       if(!['image/jpeg','image/png','image/webp'].includes(avatarFile.type)||avatarFile.size>8*1024*1024)throw new Error('Foto de perfil: JPG, PNG ou WebP, até 8 MB.');
       const optimized=await optimizeImage(avatarFile);
       const ext=optimized.name.split('.').pop()?.toLowerCase()||'webp';
       uploaded=auth.user.id+'/avatars/'+crypto.randomUUID()+'.'+ext;
       const {error:e}=await db.storage.from('social-media').upload(uploaded,optimized,{contentType:optimized.type});
       if(e)throw e;
     }
     // Validate the complete form first and save optional settings before changing
     // the visible profile. This prevents the original partial-save error.
     const {error:detailError}=await db.from('profile_details').upsert({
       user_id:auth.user.id,...payload,updated_at:new Date().toISOString()
     },{onConflict:'user_id'});
     if(detailError)throw detailError;
     detailsSaved=true;
     const {data:updated,error:profileError}=await db.from('profiles').update({
       display_name:(name||'').trim(),handle:username,bio:(bio||'').trim(),updated_at:new Date().toISOString(),
       ...(uploaded?{avatar_path:uploaded}:{})
     }).eq('id',auth.user.id).select('id,display_name,handle,bio,avatar_path').single();
     if(profileError)throw profileError;
     auth.setProfile(updated);
     if(uploaded&&auth.profile?.avatar_path){
       await db.storage.from('social-media').remove([auth.profile.avatar_path]);
     }
     setAvatarFile(null);
     setDetails(normalizeProfileDetails(payload));
     setInterestsInput(payload.interests.join(', '));
     setNotice('Perfil atualizado com sucesso.');
   } catch(err){
     if(uploaded){
       const {data:existing}=await db.from('profiles').select('avatar_path').eq('id',auth.user.id).single();
       if(existing?.avatar_path!==uploaded)await db.storage.from('social-media').remove([uploaded]);
     }
     setError((err instanceof Error?err.message:'Erro ao salvar.')+
       (detailsSaved?' As preferências foram salvas, mas o perfil principal não. Atualize a página antes de tentar novamente.':''));
   }finally{setSaving(false);}
 }
 return <GuardedPage {...auth}><main className={"section-page conecta-profile-page profile-layout-"+details.layout_style}>
   <div className="page-heading"><div><span className="section-eyebrow">SEU ESPAÇO NO CONECTA</span><h1>Meu perfil <span className="wave">✳</span></h1><p>Personalize a sua história e escolha o que compartilhar.</p></div></div>
   <div className={'conecta-profile-cover cover-'+details.cover_theme} style={coverUrl?{backgroundImage:'linear-gradient(0deg,#17153498,#35226255),url('+JSON.stringify(coverUrl)+')'}:undefined}>
     {coverUrl&&<span className="conecta-profile-cover-label">Capa personalizada</span>}
     <div className="conecta-profile-bio">
       <div className="conecta-profile-picture">
         {avatarUrl?<img src={avatarUrl} alt="Minha foto de perfil"/>:<span>{name[0]?.toUpperCase()||'C'}</span>}
         <label className="conecta-avatar-upload" title="Alterar foto"><Camera size={17}/><input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setAvatarFile(e.target.files?.[0]||null)}/></label>
       </div>
       <div><h2>{name||'Seu nome'} {details.favorite_emoji}</h2><p>@{handle} {details.headline&&'· '+details.headline}</p><div className="stat-line"><span><strong>{posts}</strong> publicações</span><span><strong>{friends}</strong> amizades</span></div></div>
     </div>
   </div>
   <div className="conecta-profile-grid">
     <form className="panel stack" onSubmit={submit}>
       <div className="feed-title"><h2>Editar perfil</h2><Link className="rail-link" href={'/p/'+(auth.profile?.handle||'')}>Ver perfil público <ExternalLink size={15}/></Link></div>
       <div className="grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14}}>
        <label className="field-label">Nome<input className="form-input" value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={80} required/></label>
        <label className="field-label">Usuário<input className="form-input" value={handle} onChange={e=>setHandle(e.target.value)} minLength={3} maxLength={30} required/></label>
       </div>
       <label className="field-label">Apresentação curta<input className="form-input" maxLength={120} placeholder="Criador, estudante, músico..." value={details.headline} onChange={e=>setDetails(v=>({...v,headline:e.target.value}))}/></label>
       <label className="field-label">Sobre mim<textarea className="form-input" rows={4} maxLength={300} value={bio} onChange={e=>setBio(e.target.value)} placeholder="Sua história em poucas palavras..."/></label>
       <div className="grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14}}>
        <label className="field-label">Cidade (opcional)<input className="form-input" maxLength={80} value={details.city} onChange={e=>setDetails(v=>({...v,city:e.target.value}))} placeholder="Ex.: São Paulo"/></label>
        <label className="field-label">Site pessoal HTTPS<input className="form-input" value={details.website||''} onChange={e=>setDetails(v=>({...v,website:e.target.value}))} placeholder="https://meusite.com" maxLength={512}/></label>
       </div>
       <label className="field-label">Interesses (até 12, separados por vírgula)<input className="form-input" maxLength={480} value={interestsInput} onChange={e=>setInterestsInput(e.target.value)} placeholder="Música, fotografia, games..."/></label>
       <label className="field-label">Sua música ou playlist (Spotify, YouTube, SoundCloud ou Apple Music)<input className="form-input" maxLength={512} value={details.music_url||''} onChange={e=>setDetails(v=>({...v,music_url:e.target.value}))} placeholder="https://open.spotify.com/track/..."/></label>
       <label className="field-label">Status do momento<input className="form-input" maxLength={140} value={details.mood_text}
         onChange={e=>setDetails(v=>({...v,mood_text:e.target.value}))} placeholder="🎵 Ouvindo minha música favorita..."/></label>
       <label className="field-label">Estilo do meu espaço<select className="form-input" value={details.layout_style}
         onChange={e=>setDetails(v=>({...v,layout_style:e.target.value as Details['layout_style']}))}>
         <option value="classic">Clássico</option><option value="myspace">MySpace retrô</option><option value="minimal">Minimalista</option>
       </select></label>
       <LanguageSelect/>
       <label className="field-label">Imagem de capa do perfil (JPG, PNG ou WebP, até 8 MB)
         <input type="file" className="form-input" accept="image/jpeg,image/png,image/webp" disabled={coverSaving}
           onChange={e=>{void uploadCover(e.target.files?.[0]||null);e.target.value='';}}/>
       </label>
       {coverPath&&<button type="button" className="btn btn-outline" disabled={coverSaving} onClick={()=>void removeCover()}><Trash2 size={16}/> Remover imagem da capa</button>}
       <span className="small-note">{coverSaving?'Atualizando imagem de capa...':'Use uma foto ou imagem autoral; evite expor dados pessoais na capa.'}</span>
       <label className="field-label">Cor da capa<select className="form-input" value={details.cover_theme} onChange={e=>setDetails(v=>({...v,cover_theme:e.target.value as Details['cover_theme']}))}>{themes.map(t=><option key={t} value={t}>{t==='violet'?'Violeta':t==='aqua'?'Água':t==='pink'?'Rosa':t==='sunset'?'Pôr do sol':'Noite'}</option>)}</select></label>
       <div className="conecta-profile-emoji"><span>Emoji de assinatura: <strong>{details.favorite_emoji}</strong></span><EmojiButton label="Escolher emoji de assinatura" onSelect={emoji=>setDetails(v=>({...v,favorite_emoji:emoji}))}/></div>
       {error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="form-success" role="status">{notice}</p>}
       <button className="btn btn-primary" type="submit" disabled={saving||!ready}><Save size={18}/> {saving?'Salvando...':'Salvar meu perfil'}</button>
     </form>
     <div className="stack">
       <section className="panel"><h2><ShieldCheck size={20} color="#825bec" style={{verticalAlign:'middle'}}/> Conecta ID</h2>
         <p className="muted">Verificação opcional por um fornecedor especializado, com prova de vida e documentos quando exigidos.</p>
         <Link href="/verificar-identidade" className="btn btn-outline"><Camera size={17}/> Verificar identidade</Link></section>
       <section className="panel"><h2><Sparkles size={19}/> Prévia da sua música</h2>{details.music_url&&parseMusicUrl(details.music_url)
          ?<MusicEmbed url={details.music_url}/>:<p className="small-note">Adicione um link de Spotify, YouTube, SoundCloud ou Apple Music para exibir um player no seu perfil. O visitante escolhe quando carregá-lo.</p>}</section>
       <section className="panel"><h2>Seu espaço, sua privacidade</h2><p className="small-note">Cidade, interesses e música, quando preenchidos, serão visíveis para outros usuários. Não informe endereço residencial ou dados pessoais sensíveis.</p></section>
     </div>
   </div>
   {details.mood_text&&<section className="panel conecta-myspace-status"><strong>Meu status ✦</strong><p>{details.mood_text}</p></section>}
   {auth.user&&<MySpacePanel profileId={auth.user.id} viewerId={auth.user.id} isSelf/>}
   {auth.user&&<ProfileTimeline profileId={auth.user.id} viewerId={auth.user.id} isSelf/>}
 </main></GuardedPage>;
}
