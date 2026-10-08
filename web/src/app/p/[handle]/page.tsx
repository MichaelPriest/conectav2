'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Heart, UserPlus, Users, UserCheck, Clock } from 'lucide-react';
import { GuardedPage, useAuthProfile } from '@/components/app-shell';
import { supabaseBrowser } from '@/lib/supabase/browser';
import type {UserProfile} from '@/lib/types';

type Connection={id:string;requester_id:string;addressee_id:string;status:string};

export default function PublicProfile(){
  const auth=useAuthProfile();
  const params=useParams<{handle:string}>();
  const [person,setPerson]=useState<UserProfile|null>(null);
  const [connection,setConnection]=useState<Connection|null>(null);
  const [posts,setPosts]=useState(0);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{
    if(!auth.user||!params.handle)return;
    let active=true;
    async function load(){
      const db=supabaseBrowser();
      const {data,error:profileError}=await db.from('profiles').select('id,handle,display_name,bio,avatar_path').eq('handle',params.handle).maybeSingle();
      if(!active)return;
      if(profileError){setError(profileError.message);setLoading(false);return;}
      setPerson(data as UserProfile|null);
      if(data){
        const [p,c]=await Promise.all([
          db.from('posts').select('id',{count:'exact',head:true}).eq('author_id',data.id),
          db.from('friendships').select('id,requester_id,addressee_id,status')
            .or('and(requester_id.eq.'+auth.user!.id+',addressee_id.eq.'+data.id+'),and(requester_id.eq.'+data.id+',addressee_id.eq.'+auth.user!.id+')')
            .maybeSingle()
        ]);
        if(active){setPosts(p.count||0);setConnection(c.data as Connection|null);}
      }
      if(active)setLoading(false);
    }
    void load();
    return ()=>{active=false;};
  },[auth.user,params.handle]);

  async function connect(){
    if(!auth.user||!person||busy)return;
    setBusy(true);setError('');
    const db=supabaseBrowser();
    if(connection){
      if(connection.status==='pending'&&connection.addressee_id===auth.user.id){
        const {error:e}=await db.from('friendships').update({status:'accepted'}).eq('id',connection.id);
        if(e)setError(e.message);else setConnection({...connection,status:'accepted'});
      } else if(window.confirm('Remover solicitação ou amizade?')){
        const {error:e}=await db.from('friendships').delete().eq('id',connection.id);
        if(e)setError(e.message);else setConnection(null);
      }
    } else {
      const {data,error:e}=await db.from('friendships').insert({requester_id:auth.user.id,addressee_id:person.id}).select('id,requester_id,addressee_id,status').single();
      if(e)setError(e.message);else setConnection(data);
    }
    setBusy(false);
  }

  const isSelf=auth.user?.id===person?.id;
  const buttonText=!connection?'Adicionar amigo':connection.status==='accepted'?'Amigos':connection.status==='pending'?(connection.addressee_id===auth.user?.id?'Aceitar solicitação':'Solicitação enviada'):'Solicitar amizade';
  return <GuardedPage {...auth}><main className="section-page">
    <Link className="rail-link" href="/explorar"><ArrowLeft size={16}/> Voltar a explorar</Link>
    {error&&<p className="form-error" role="alert">{error}</p>}
    {loading?<div className="centered-loading">Carregando perfil...</div>:!person?<div className="empty-state card" style={{marginTop:24}}><h3>Perfil não encontrado</h3><p>Essa pessoa pode ter alterado o nome de usuário.</p></div>:<>
      <div className="detail-header" style={{marginTop:20}}><div className="profile-header" style={{marginBottom:0,background:'transparent',border:'none',padding:0}}>
        <span className="avatar avatar-gradient" style={{height:75,width:75,fontSize:28}}>{person.display_name[0]?.toUpperCase()}</span>
        <div><h1>{person.display_name}</h1><p>@{person.handle}</p><div className="stat-line"><span>{posts} publicações visíveis</span></div></div>
      </div><p>{person.bio||'Esta pessoa ainda não escreveu uma biografia.'}</p>
      <div className="detail-buttons">{isSelf?<Link className="btn btn-primary" href="/perfil">Editar perfil</Link>:<button type="button" className="btn btn-primary" disabled={busy} onClick={connect}>{connection?.status==='accepted'?<UserCheck size={17}/>:connection?.status==='pending'?<Clock size={17}/>:<UserPlus size={17}/>} {buttonText}</button>}</div></div>
      <p className="small-note">As publicações privadas só aparecem para quem tem permissão.</p>
    </>}
  </main></GuardedPage>;
}
