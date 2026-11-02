'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {supabaseBrowser} from '@/lib/supabase/browser';
type State={status?:string;error?:string;reasons?:string[]};
export default function ConectaIdPage(){
 const router=useRouter();
 const [state,setState]=useState<State>({});
 useEffect(()=>{
  let active=true;
  async function check(){
   try{
    const {data:{session}}=await supabaseBrowser().auth.getSession();
    if(!session){router.replace('/auth');return;}
    const sync=await fetch('/api/identity/triage/sync',{method:'POST',headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});
    const data=await sync.json();
    if(!sync.ok)throw Error(data.error||'Não foi possível registrar a triagem.');
    if(active)setState(data);
   }catch(e){if(active)setState({error:e instanceof Error?e.message:'Erro inesperado.'});}
  }
  void check();return()=>{active=false;};
 },[router]);
 const labels:Record<string,string>={
  pending_contact:'Confirme seu e-mail para continuar.',
  pending_review:'Seu cadastro precisa de análise humana.',
  eligible_basic:'Triagem inicial concluída: baixo risco identificado.',
  approved:'Análise humana aprovada.',
  rejected:'Cadastro reprovado pela análise.',
  ineligible:'Cadastro não elegível.'
 };
 return <main className="center-screen"><section className="onboarding-card">
  <span className="brand"><span className="brand-mark">c.</span> conecta<span className="brand-dot">.</span></span>
  <div className="eyebrow">CONECTA ID 2.0</div><h1>Segurança proporcional ao risco</h1>
  {state.error?<p role="alert" className="form-error">{state.error}</p>:
   <p>{state.status?labels[state.status]||'Triagem em processamento.':'Verificando seu cadastro...'}</p>}
  <p className="muted">A triagem inicial não confirma sua identidade nem maioridade. Recursos restritos continuam sujeitos às regras de segurança e proteção de adolescentes.</p>
  <div className="stack">
   <Link className="btn btn-primary" href="/">Ir para o Conecta</Link>
   <Link className="btn btn-outline" href="/verificar-identidade">Verificação adicional de identidade e idade</Link>
  </div>
 </section></main>;
}
