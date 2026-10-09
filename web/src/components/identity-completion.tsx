'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,RefreshCw,ShieldAlert,CheckCircle2} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';
import {useRouter} from 'next/navigation';
import type {RegistrationCompletion} from '@/lib/identity-completion';

type Outcome={
 state:RegistrationCompletion;
 message:string;
 canFinishBasic:boolean;
 next:'/feed'|'/onboarding'|null;
 identityVerified:false;
 ageVerified:false;
 grantsAdultPrivileges:false;
 adsAllowed:false;
 error?:string;
};
export function IdentityCompletion(){
 const router=useRouter();
 const [status,setStatus]=useState<Outcome|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const getToken=useCallback(async()=>{
  const {data}=await supabaseBrowser().auth.getSession();
  return data.session?.access_token;
 },[]);
 const load=useCallback(async()=>{
  setBusy(true);setError('');
  try{
   const token=await getToken();
   if(!token)throw new Error('Sua sessao expirou. Entre novamente.');
   const response=await fetch('/api/identity/complete-registration',{
    headers:{Authorization:'Bearer '+token},cache:'no-store'
   });
   const data=await response.json() as Outcome;
   if(!response.ok)throw new Error(data.error||'Nao foi possivel consultar o cadastro.');
   setStatus(data);
  }catch(e){setError(e instanceof Error?e.message:'Falha ao verificar cadastro.');}
  finally{setBusy(false);}
 },[getToken]);
 useEffect(()=>{void load();},[load]);
 async function finish(){
  if(busy)return;
  setBusy(true);setError('');
  try{
   const token=await getToken();if(!token)throw new Error('Entre novamente no Conecta.');
   const response=await fetch('/api/identity/complete-registration',{
    method:'POST',headers:{Authorization:'Bearer '+token},cache:'no-store'
   });
   const data=await response.json() as Outcome;
   if(!response.ok)throw new Error(data.error||'O cadastro nao pode ser concluido.');
   setStatus(data);
   if(data.canFinishBasic&&data.next==='/feed'){router.push(data.next);router.refresh();}
   else setError('Ainda falta uma etapa de cadastro ou verificacao de seguranca.');
  }catch(e){setError(e instanceof Error?e.message:'Falha ao finalizar cadastro.');}
  finally{setBusy(false);}
 }
 return <section className="panel" style={{marginTop:20,marginBottom:24}}>
  <div className="feed-title"><h2><CheckCircle2 size={22} style={{verticalAlign:'middle'}}/> Finalizar cadastro</h2>
   <button type="button" className="btn btn-outline" onClick={()=>void load()} disabled={busy}>
    <RefreshCw size={16}/> Atualizar situacao</button></div>
  {!status&&!error&&<p className="small-note">Consultando seu cadastro...</p>}
  {status&&<div style={{marginTop:14}}>
   <p><strong>{status.message}</strong></p>
   <p className="small-note">Resultado consultado no servidor. A assinatura gov.br, a leitura da CIN
    e o teste Human nao substituem uma integracao oficial que comprove titularidade e idade.</p>
   {status.canFinishBasic?
    <button type="button" className="btn btn-primary btn-lg" onClick={()=>void finish()} disabled={busy}>
     <ArrowRight size={18}/> {busy?'Verificando...':'Finalizar cadastro basico e entrar'}</button>:
    status.next==='/onboarding'?
    <Link href="/onboarding" className="btn btn-outline">Completar dados do cadastro <ArrowRight size={18}/></Link>:
    <p className="small-note"><ShieldAlert size={16} style={{verticalAlign:'middle'}}/>
     A conta adolescente nao pode finalizar a liberacao das funcoes sociais sem afericao
     de idade suficiente e, quando exigido, autorizacao de responsavel.</p>}
  </div>}
  <p className="small-note" style={{marginTop:12}}>
   <strong>Sem comprovacao oficial:</strong> nenhuma etapa desta tela concede selo,
   acesso adulto, anuncios ou muda a faixa etaria verificada.
  </p>
  {error&&<p role="alert" className="form-error">{error}</p>}
 </section>;
}
