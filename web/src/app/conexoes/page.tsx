'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {UserPlus,Users,Search,UserCheck,UserX,MessageCircle} from 'lucide-react';
import {GuardedPage,useAuthProfile} from '@/components/app-shell';
import {ProfileAvatar} from '@/components/profile-avatar';
import {supabaseBrowser} from '@/lib/supabase/browser';

type Connection={id:string;requester_id:string;addressee_id:string;status:string;created_at:string};
type Person={id:string;handle:string;display_name:string;avatar_path:string|null;bio:string};
type Tab='friends'|'received'|'sent'|'discover';

export default function Connections(){
 const auth=useAuthProfile();
 const [links,setLinks]=useState<Connection[]>([]),[people,setPeople]=useState<Person[]>([]);
 const [tab,setTab]=useState<Tab>('friends'),[query,setQuery]=useState('');
 const [busy,setBusy]=useState<string|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=useCallback(async()=>{
   if(!auth.user)return;
   const db=supabaseBrowser();
   const [l,p]=await Promise.all([
    db.from('friendships').select('id,requester_id,addressee_id,status,created_at').or('requester_id.eq.'+auth.user.id+',addressee_id.eq.'+auth.user.id),
    db.from('profiles').select('id,handle,display_name,bio,avatar_path').order('created_at',{ascending:false}).limit(120)
   ]);
   if(l.error||p.error)setError(l.error?.message||p.error?.message||'Não foi possível carregar as conexões.');
   else{setLinks(l.data||[]);setPeople((p.data||[]) as Person[]);}
   setLoading(false);
 },[auth.user]);
 useEffect(()=>{void load();},[load]);
 const mine=auth.user?.id;
 const filtered=useMemo(()=>{
  const match=(p:Person)=>p.id!==mine&&
   (p.display_name+' '+p.handle+' '+(p.bio||'')).toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR').trim());
  return people.filter(p=>{
   if(!match(p))return false;
   const relation=links.find(c=>c.requester_id===p.id||c.addressee_id===p.id);
   if(tab==='friends')return relation?.status==='accepted';
   if(tab==='received')return relation?.status==='pending'&&relation.addressee_id===mine;
   if(tab==='sent')return relation?.status==='pending'&&relation.requester_id===mine;
   return !relation;
  });
 },[people,links,tab,query,mine]);
 async function act(p:Person,action:'add'|'accept'|'remove'){
  if(!mine||busy)return;setBusy(p.id);setError('');
  const db=supabaseBrowser();
  const relation=links.find(x=>x.requester_id===p.id||x.addressee_id===p.id);
  const result=action==='add'
   ?await db.from('friendships').insert({requester_id:mine,addressee_id:p.id,status:'pending'})
   :action==='accept'
   ?await db.from('friendships').update({status:'accepted'}).eq('id',relation?.id).eq('addressee_id',mine)
   :await db.from('friendships').delete().eq('id',relation?.id);
  if(result.error)setError(result.error.message);
  else await load();
  setBusy(null);
 }
 return <GuardedPage {...auth}><main className="section-page">
   <div className="page-heading"><div><span className="section-eyebrow">CONEXÕES CONECTA</span>
   <h1>Suas Conexões <span className="wave">✳</span></h1>
   <p>Encontre pessoas, aceite convites e mantenha amizades que fazem sentido.</p></div></div>
   <div className="section-toolbar"><label className="searchbox"><Search size={18}/>
    <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por nome ou @usuário" aria-label="Buscar Conexões"/></label></div>
   <div className="conecta-profile-tabs" role="group" aria-label="Lista de Conexões">
    {([['friends','Minhas Conexões'],['received','Convites recebidos'],['sent','Convites enviados'],['discover','Conhecer pessoas']] as const).map(([key,name])=>
      <button type="button" className={tab===key?'active':''} onClick={()=>setTab(key)} key={key}>{name}</button>)}
   </div>
   {error&&<p className="form-error" role="alert">{error}</p>}
   {loading?<div className="centered-loading">Carregando Conexões...</div>:filtered.length===0?
      <div className="empty-state card"><Users size={28}/><h3>Sem resultados nesta categoria</h3><p>Experimente outra busca ou conheça novas pessoas.</p></div>:
      <div className="conecta-connections-grid">{filtered.map(person=>{
        const relation=links.find(x=>x.requester_id===person.id||x.addressee_id===person.id);
        return <article className="conecta-connection-card card" key={person.id}>
          <Link href={'/p/'+person.handle}><ProfileAvatar person={person} size="large"/></Link>
          <div><h3><Link href={'/p/'+person.handle}>{person.display_name}</Link></h3><small>@{person.handle}</small><p>{person.bio||'Conheça esta pessoa e suas ideias.'}</p></div>
          <div className="row" style={{gap:8,flexWrap:'wrap'}}>
            {tab==='received'?<button className="btn btn-primary" type="button" disabled={!!busy} onClick={()=>act(person,'accept')}><UserCheck size={16}/> Aceitar</button>:
             tab==='discover'?<button className="btn btn-primary" type="button" disabled={!!busy} onClick={()=>act(person,'add')}><UserPlus size={16}/> Conectar</button>:
             tab==='friends'?<Link className="btn btn-primary" href={'/mensagens?to='+encodeURIComponent(person.handle)}><MessageCircle size={16}/> Conversar</Link>:null}
            {relation&&<button className="btn btn-outline" disabled={!!busy} onClick={()=>act(person,'remove')}><UserX size={15}/> {tab==='friends'?'Desfazer':'Cancelar'}</button>}
          </div>
        </article>;
      })}</div>}
   <p className="small-note">As Conexões são amizades aceitas pelas duas pessoas. A proteção para contas adolescentes será aplicada no banco antes da liberação pública dessa faixa etária.</p>
 </main></GuardedPage>;
}
