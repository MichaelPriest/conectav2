'use client';
import {useParams} from 'next/navigation';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,Clock,ExternalLink,MapPin,MessageCircle,Shield,UserCheck,UserPlus} from 'lucide-react';
import {GuardedPage,useAuthProfile} from '@/components/app-shell';
import {MusicEmbed} from '@/components/music-embed';
import {ProfileTimeline} from '@/components/profile-timeline';
import {supabaseBrowser} from '@/lib/supabase/browser';
import type {UserProfile} from '@/lib/types';

type Connection={id:string;requester_id:string;addressee_id:string;status:string};
type Details={headline:string;city:string;website:string|null;music_url:string|null;interests:string[];favorite_emoji:string;cover_theme:string};

export default function PublicProfile(){
 const auth=useAuthProfile();
 const params=useParams<{handle:string}>();
 const [person,setPerson]=useState<UserProfile|null>(null);
 const [details,setDetails]=useState<Details|null>(null);
 const [avatarUrl,setAvatarUrl]=useState<string|null>(null);
 const [connection,setConnection]=useState<Connection|null>(null);
 const [blocked,setBlocked]=useState(false),[blockedBy,setBlockedBy]=useState(false);
 const [posts,setPosts]=useState(0),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
   if(!auth.user||!params.handle)return;let alive=true;
   async function load(){
     const db=supabaseBrowser();
     const {data:p,error:e}=await db.from('profiles').select('id,handle,display_name,bio,avatar_path').eq('handle',params.handle).maybeSingle();
     if(!alive)return;
     if(e){setError(e.message);setLoading(false);return;}
     setPerson(p as UserProfile|null);
     if(p){
       const [d,n,relation,block]=await Promise.all([
         db.from('profile_details').select('headline,city,website,music_url,interests,favorite_emoji,cover_theme').eq('user_id',p.id).maybeSingle(),
         db.from('posts').select('id',{count:'exact',head:true}).eq('author_id',p.id),
         db.from('friendships').select('id,requester_id,addressee_id,status')
           .or('and(requester_id.eq.'+auth.user!.id+',addressee_id.eq.'+p.id+'),and(requester_id.eq.'+p.id+',addressee_id.eq.'+auth.user!.id+')').maybeSingle(),
         db.from('user_blocks').select('blocker_id,blocked_id')
           .or('and(blocker_id.eq.'+auth.user!.id+',blocked_id.eq.'+p.id+'),and(blocker_id.eq.'+p.id+',blocked_id.eq.'+auth.user!.id+')')
       ]);
       if(alive){
         if(!d.error)setDetails(d.data as Details|null);
         setPosts(n.count||0);
         setConnection(relation.data as Connection|null);
         setBlocked(Boolean(block.data?.some(b=>b.blocker_id===auth.user!.id)));
         setBlockedBy(Boolean(block.data?.some(b=>b.blocker_id===p.id)));
       }
       if(p.avatar_path){
         const {data:media}=await db.storage.from('social-media').createSignedUrl(p.avatar_path,3600);
         if(alive)setAvatarUrl(media?.signedUrl||null);
       }
     }
     if(alive)setLoading(false);
   }
   void load();return()=>{alive=false;};
 },[auth.user,params.handle]);

 async function toggleBlock(){
   if(!auth.user||!person||busy)return;
   setBusy(true);setError('');
   const db=supabaseBrowser();
   const payload={blocker_id:auth.user.id,blocked_id:person.id};
   const {error:e}=blocked
     ?await db.from('user_blocks').delete().eq('blocker_id',auth.user.id).eq('blocked_id',person.id)
     :await db.from('user_blocks').insert(payload);
   if(e)setError(e.message);
   else setBlocked(v=>!v);
   setBusy(false);
 }
 async function connect(){
   if(!auth.user||!person||busy||blocked||blockedBy)return;
   setBusy(true);setError('');
   const db=supabaseBrowser();
   if(connection){
     if(connection.status==='pending'&&connection.addressee_id===auth.user.id){
       const {error:e}=await db.from('friendships').update({status:'accepted'}).eq('id',connection.id);
       if(e)setError(e.message);else setConnection({...connection,status:'accepted'});
     }else if(window.confirm('Remover solicitação ou amizade?')){
       const {error:e}=await db.from('friendships').delete().eq('id',connection.id);
       if(e)setError(e.message);else setConnection(null);
     }
   }else{
     const {data,error:e}=await db.from('friendships').insert({requester_id:auth.user.id,addressee_id:person.id})
       .select('id,requester_id,addressee_id,status').single();
     if(e)setError(e.message);else setConnection(data);
   }
   setBusy(false);
 }
 const own=auth.user?.id===person?.id;
 const buttonText=!connection?'Adicionar amizade':connection.status==='accepted'?'Amigos':connection.status==='pending'
   ?(connection.addressee_id===auth.user?.id?'Aceitar amizade':'Solicitação enviada'):'Solicitar amizade';
 const website=(()=>{
   try{
     if(!details?.website)return null;
     const link=new URL(details.website);
     return link.protocol==='https:'?link:null;
   }catch{return null;}
 })();
 return <GuardedPage {...auth}><main className="section-page conecta-profile-page">
   <Link className="rail-link" href="/explorar"><ArrowLeft size={16}/> Voltar a explorar</Link>
   {error&&<p className="form-error" role="alert">{error}</p>}
   {loading?<div className="centered-loading">Carregando perfil...</div>:!person?
     <div className="empty-state card"><h2>Perfil não encontrado</h2><p>Essa pessoa pode ter alterado o nome de usuário.</p></div>:<>
       <div className={'conecta-profile-cover cover-'+(details?.cover_theme||'violet')} style={{marginTop:18}}>
         <div className="conecta-profile-bio">
           <div className="conecta-profile-picture">{avatarUrl?<img src={avatarUrl} alt={'Foto de '+person.display_name}/>:<span>{person.display_name[0]?.toUpperCase()}</span>}</div>
           <div><h1>{person.display_name} {details?.favorite_emoji}</h1><p>@{person.handle}{details?.headline?' · '+details.headline:''}</p><div className="stat-line"><span>{posts} publicações visíveis</span></div></div>
         </div>
       </div>
       {blocked||blockedBy?<section className="panel"><h2>Conexão bloqueada</h2><p>Não é possível iniciar amizades ou novas mensagens enquanto existir bloqueio entre vocês.</p>
         {blocked&&<button className="btn btn-outline" type="button" disabled={busy} onClick={toggleBlock}>Desbloquear usuário</button>}</section>:
         <section className="conecta-public-profile-panel panel">
           <p>{person.bio||'Esta pessoa ainda não escreveu uma biografia.'}</p>
           {details?.city&&<p className="small-note"><MapPin size={15} style={{verticalAlign:'middle'}}/> {details.city}</p>}
           {website&&<a href={website.toString()} rel="noreferrer noopener" target="_blank" className="rail-link">{website.hostname} <ExternalLink size={15}/></a>}
           {details?.interests?.length? <div className="conecta-profile-tags">{details.interests.map(i=><span key={i}>{i}</span>)}</div>:null}
           <div className="detail-buttons" style={{marginTop:18}}>
             {own?<Link href="/perfil" className="btn btn-primary">Editar perfil</Link>:
               <><button className="btn btn-primary" disabled={busy} onClick={connect} type="button">
                 {connection?.status==='accepted'?<UserCheck size={17}/>:connection?.status==='pending'?<Clock size={17}/>:<UserPlus size={17}/>} {buttonText}
               </button>
               {connection?.status==='accepted'&&<Link href={'/mensagens?to='+encodeURIComponent(person.handle)} className="btn btn-outline"><MessageCircle size={17}/> Conversar</Link>}
               <button type="button" className="btn btn-outline" onClick={toggleBlock} disabled={busy}><Shield size={16}/> Bloquear</button>
               </>}
           </div>
         </section>
       }
       {!blocked&&!blockedBy&&details?.music_url&&<section className="panel" style={{marginTop:18}}><MusicEmbed url={details.music_url}/></section>}
       {!blocked&&!blockedBy&&auth.user&&<ProfileTimeline profileId={person.id} viewerId={auth.user.id} isSelf={own}/>}
       <p className="small-note" style={{marginTop:18}}>O Conecta exibe somente informações adicionadas voluntariamente. Dados pessoais sensíveis não devem aparecer no perfil.</p>
     </>}
 </main></GuardedPage>;
}
