'use client';

import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,CheckCircle2,ClipboardList,RefreshCcw,ShieldCheck} from 'lucide-react';
import {GuardedPage,useAuthProfile} from '@/components/app-shell';
import {supabaseBrowser} from '@/lib/supabase/browser';

type Status='pending'|'contacted'|'closed';
type Lead={id:string;user_id:string;kind:'plus'|'business'|'sponsorship';organization_name:string|null;
 contact_email:string;note:string;status:Status;created_at:string};
const labels={plus:'Plus',business:'Negócios',sponsorship:'Patrocínio'};
const statusLabels={pending:'Novo',contacted:'Em contato',closed:'Encerrado'};
export default function MonetizationAdmin(){
 const auth=useAuthProfile();
 const [admin,setAdmin]=useState(false);
 const [checking,setChecking]=useState(true);
 const [items,setItems]=useState<Lead[]>([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [busyId,setBusyId]=useState('');
 useEffect(()=>{
  if(!auth.user)return;
  let active=true;
  void supabaseBrowser().from('platform_moderators').select('role').eq('user_id',auth.user.id)
   .maybeSingle().then(({data,error:e})=>{if(!active)return;
    if(e)setError('Não foi possível verificar a autorização.');
    setAdmin(!e&&data?.role==='admin');setChecking(false);
   });
  return()=>{active=false;};
 },[auth.user]);
 const load=useCallback(async()=>{
  if(!admin)return;
  setLoading(true);setError('');
  const {data,error:e}=await supabaseBrowser().from('monetization_interests')
   .select('id,user_id,kind,organization_name,contact_email,note,status,created_at')
   .order('created_at',{ascending:false}).limit(100);
  if(e)setError('Não foi possível consultar os interessados: '+e.message);
  else setItems((data||[]) as Lead[]);
  setLoading(false);
 },[admin]);
 useEffect(()=>{void load();},[load]);
 async function change(id:string,status:Status){
  if(!admin||busyId)return;
  setBusyId(id);setError('');
  const {data,error:e}=await supabaseBrowser().from('monetization_interests')
    .update({status}).eq('id',id).select('id,status').single();
  if(e||!data)setError('Não foi possível atualizar: '+(e?.message||'Resposta indisponível'));
  else setItems(prev=>prev.map(item=>item.id===id?{...item,status}:item));
  setBusyId('');
 }
 return <GuardedPage profile={auth.profile} loading={auth.loading} error={auth.error}>
  <main className="section-page conecta-money">
   <div className="page-heading"><div><span className="section-eyebrow">ACESSO RESTRITO</span>
    <h1><ClipboardList size={27}/> Interesse comercial</h1>
    <p>Lista real de solicitações voluntárias. Não são vendas, clientes pagantes ou faturamento.</p></div>
    <Link className="btn btn-outline" href="/apoiar"><ArrowLeft size={16}/> Voltar</Link></div>
   {checking?<section className="card conecta-money-form-card"><p>Verificando permissão...</p></section>:
    !admin?<section className="card conecta-money-form-card"><ShieldCheck size={26}/><h2>Acesso reservado aos administradores</h2></section>:
     <section className="card conecta-money-form-card">
      <div className="conecta-money-admin-top"><h2>Solicitações recentes</h2><button className="btn btn-outline" onClick={()=>void load()} type="button" disabled={loading}>
       <RefreshCcw size={15}/> Atualizar</button></div>
      <p>Até 100 registros por consulta. Contatos são privados e visíveis somente ao responsável e aos administradores autorizados.</p>
      {error&&<p className="form-error" role="alert">{error}</p>}
      <div className="conecta-money-counts">{(['plus','business','sponsorship'] as const).map(k=><span key={k}>
       <strong>{items.filter(v=>v.kind===k).length}</strong>{labels[k]}</span>)}</div>
      {loading?<p>Carregando...</p>:items.length===0?<div className="conecta-money-done"><CheckCircle2 size={20}/> Nenhum interesse registrado ainda.</div>:
       <div className="conecta-money-admin-list">{items.map(item=><article key={item.id} className="conecta-money-admin-item">
        <div><strong>{labels[item.kind]}{item.organization_name?' · '+item.organization_name:''}</strong>
        <small>{new Date(item.created_at).toLocaleString('pt-BR')}</small></div>
        <p>{item.note||'Sem observações adicionais.'}</p>
        <a href={'mailto:'+item.contact_email}>{item.contact_email}</a>
        <label>Situação<select className="form-input" value={item.status} disabled={busyId===item.id}
          onChange={e=>void change(item.id,e.target.value as Status)}>
          {(Object.keys(statusLabels) as Status[]).map(k=><option key={k} value={k}>{statusLabels[k]}</option>)}
        </select></label>
       </article>)}</div>}
      <p className="small-note">Este painel não cria assinaturas nem libera publicidade. O contato comercial é manual e depende do consentimento registrado.</p>
     </section>}
  </main>
 </GuardedPage>;
}
