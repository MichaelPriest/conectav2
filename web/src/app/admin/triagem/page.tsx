'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {GuardedPage,useAuthProfile} from '@/components/app-shell';
import {supabaseBrowser} from '@/lib/supabase/browser';
type Case={user_id:string;status:string;reasons:string[];display_name:string|null;handle:string|null;updated_at:string};
const options=['pending_review','pending_contact','eligible_basic','approved','rejected','ineligible','all'];
export default function TriageAdminPage(){
 const auth=useAuthProfile();
 const [status,setStatus]=useState('pending_review');
 const [cases,setCases]=useState<Case[]>([]);
 const [total,setTotal]=useState(0);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 const [working,setWorking]=useState<string|null>(null);
 const load=useCallback(async()=>{
  if(!auth.user)return;
  setLoading(true);setError('');
  try{
   const {data:{session}}=await supabaseBrowser().auth.getSession();
   if(!session)throw Error('Sessão necessária.');
   const res=await fetch('/api/admin/triage?status='+encodeURIComponent(status),{cache:'no-store',headers:{Authorization:'Bearer '+session.access_token}});
   const data=await res.json();
   if(!res.ok)throw Error(data.error||'Falha ao consultar triagens.');
   setCases(data.cases);setTotal(data.total);
  }catch(e){setCases([]);setError(e instanceof Error?e.message:'Erro inesperado.');}
  finally{setLoading(false);}
 },[auth.user,status]);
 useEffect(()=>{void load();},[load]);
 async function decide(userId:string,status:'approved'|'rejected'){
  const note=window.prompt('Justificativa da decisão (mínimo 8 caracteres):');
  if(note===null)return;
  if(note.trim().length<8||note.length>1000){setError('Informe justificativa entre 8 e 1000 caracteres.');return;}
  if(!window.confirm('Confirma esta decisão administrativa?'))return;
  setWorking(userId);setError('');
  try{
   const {data:{session}}=await supabaseBrowser().auth.getSession();
   if(!session)throw Error('Faça login.');
   const res=await fetch('/api/admin/triage/decision',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({user_id:userId,status,note})});
   const json=await res.json();
   if(!res.ok)throw Error(json.error||'Falha ao registrar decisão.');
   await load();
  }catch(e){setError(e instanceof Error?e.message:'Erro inesperado.');}
  finally{setWorking(null);}
 }
 return <GuardedPage {...auth}><main className="section-page">
  <div className="page-heading"><div><span className="section-eyebrow">CONECTA ID 2.0</span><h1>Central de triagem</h1><p>Consulta administrativa de casos registrados. Aprovações e rejeições são registradas com justificativa e auditoria.</p></div><Link className="btn btn-outline" href="/admin/usuarios">Usuários</Link></div>
  <section className="panel" style={{padding:20}}>
   <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
    <label htmlFor="triage-status">Situação</label>
    <select id="triage-status" value={status} onChange={e=>setStatus(e.target.value)}>{options.map(s=><option key={s} value={s}>{s}</option>)}</select>
    <button className="btn btn-outline" type="button" onClick={()=>void load()}>Atualizar</button>
   </div>
   {error&&<p className="form-error" role="alert">{error}</p>}
   {loading?<p>Carregando...</p>:<><p>{total} caso(s) encontrado(s)</p>
    <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left'}}><thead><tr><th>Perfil</th><th>Status</th><th>Sinais</th><th>Atualização</th><th>Ações</th></tr></thead><tbody>
     {cases.map(c=><tr key={c.user_id}><td>{c.display_name||c.handle||c.user_id}</td><td>{c.status}</td><td>{c.reasons.join(', ')||'Nenhum informado'}</td><td>{new Date(c.updated_at).toLocaleString('pt-BR')}</td><td>{c.status==='pending_review'?<div style={{display:'flex',gap:8}}><button type='button' className='btn btn-outline' disabled={working!==null} onClick={()=>void decide(c.user_id,'approved')}>Aprovar</button><button type='button' className='btn btn-outline' disabled={working!==null} onClick={()=>void decide(c.user_id,'rejected')}>Rejeitar</button></div>:'—'}</td></tr>)}
    </tbody></table></div>
    {!cases.length&&<p>Nenhum caso registrado neste filtro.</p>}
   </>}
  </section>
 </main></GuardedPage>;
}
