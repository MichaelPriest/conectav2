'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {GuardedPage,useAuthProfile} from '@/components/app-shell';
import {supabaseBrowser} from '@/lib/supabase/browser';
type User={id:string;email?:string;display_name:string|null;handle:string|null;role:string;created_at:string;last_sign_in_at?:string};
export default function AdminUsers(){
 const auth=useAuthProfile();
 const [users,setUsers]=useState<User[]>([]),[page,setPage]=useState(1),[search,setSearch]=useState(''),[term,setTerm]=useState(''),[total,setTotal]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=useCallback(async()=>{
  if(!auth.user)return;
  setLoading(true);setError('');
  try{
   const {data:{session}}=await supabaseBrowser().auth.getSession();
   if(!session)throw Error('Faça login.');
   const qs=new URLSearchParams({page:String(page),search:term});
   const res=await fetch('/api/admin/users?'+qs,{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});
   const json=await res.json();
   if(!res.ok)throw Error(json.error||'Falha ao consultar usuários.');
   setUsers(json.users);setTotal(json.total);
  }catch(e){setError(e instanceof Error?e.message:'Erro inesperado.');setUsers([]);}
  finally{setLoading(false);}
 },[auth.user,page,term]);
 useEffect(()=>{void load();},[load]);
 const date=(v?:string)=>v?new Date(v).toLocaleString('pt-BR'):'Nunca';
 return <GuardedPage {...auth}><main className="section-page">
 <div className="page-heading"><div><span className="section-eyebrow">ADMINISTRAÇÃO</span><h1>Usuários do Conecta</h1><p>Consulta exclusiva para administradores.</p></div><Link className="btn btn-outline" href="/moderacao">Voltar</Link></div>
 <section className="panel" style={{padding:20}}>
 <form onSubmit={e=>{e.preventDefault();setPage(1);setTerm(search.trim());}} style={{display:'flex',gap:10,flexWrap:'wrap'}}>
 <input aria-label="Pesquisar e-mail" placeholder="Pesquisar por e-mail" value={search} onChange={e=>setSearch(e.target.value)} style={{flex:'1 1 240px',padding:10}}/>
 <button className="btn btn-primary" type="submit">Pesquisar</button><button className="btn btn-outline" type="button" onClick={()=>void load()}>Atualizar</button></form>
 {error&&<p className="form-error" role="alert">{error}</p>}
 {loading?<p>Carregando...</p>:<><p>{total} usuário(s) encontrado(s)</p><div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left'}}>
 <thead><tr><th>Nome</th><th>E-mail</th><th>Usuário</th><th>Permissão</th><th>Cadastro</th><th>Último acesso</th></tr></thead>
 <tbody>{users.map(u=><tr key={u.id}>{[u.display_name||'—',u.email||'—',u.handle?'@'+u.handle:'—',u.role==='admin'?'Administrador':u.role==='moderator'?'Moderador':'Usuário',date(u.created_at),date(u.last_sign_in_at)].map((v,i)=><td key={i} style={{padding:'12px 8px',borderTop:'1px solid #8884'}}>{v}</td>)}</tr>)}</tbody></table></div>
 {!users.length&&<p>Nenhum usuário encontrado.</p>}
 <div style={{display:'flex',gap:12,alignItems:'center',marginTop:16}}><button className="btn btn-outline" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>Página {page} de {Math.max(1,Math.ceil(total/25))}</span><button className="btn btn-outline" disabled={page*25>=total} onClick={()=>setPage(p=>p+1)}>Próxima</button></div></>}
 </section></main></GuardedPage>;
}
