'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {supabaseBrowser} from '@/lib/supabase/browser';

type Triage={status?:string;error?:string;reasons?:string[]};
type Access={networkAccess?:boolean;basicAccess?:boolean;accessLevel?:string;reason?:string;message?:string;steps?:{profile:boolean;ageDeclaration:boolean;identity:boolean;age:boolean;guardian:boolean}};
type Verification={status?:string;age_band?:string;guardian_status?:string;configured?:boolean};
const labels:Record<string,string>={
 pending_contact:'Confirme seu e-mail para continuar.',
 pending_review:'Seu cadastro está aguardando análise humana.',
 eligible_basic:'Triagem inicial concluída: baixo risco identificado.',
 approved:'Triagem humana aprovada.',rejected:'Triagem humana reprovada.',
 ineligible:'Cadastro não elegível.'
};
export default function ConectaIdPage(){
 const router=useRouter();
 const [triage,setTriage]=useState<Triage>({});
 const [access,setAccess]=useState<Access|null>(null);
 const [verification,setVerification]=useState<Verification|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const refresh=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const {data:{session}}=await supabaseBrowser().auth.getSession();
   if(!session){router.replace('/auth');return;}
   const headers={Authorization:'Bearer '+session.access_token};
   const sync=await fetch('/api/identity/triage/sync',{method:'POST',headers,cache:'no-store'});
   const synced=await sync.json();
   if(!sync.ok)throw Error(synced.error||'Não foi possível registrar a triagem.');
   setTriage(synced);
   const [a,v]=await Promise.all([
    fetch('/api/identity/access',{headers,cache:'no-store'}),
    fetch('/api/identity/status',{headers,cache:'no-store'})
   ]);
   const accessData=await a.json();
   const verificationData=await v.json();
   if(!a.ok)throw Error(accessData.error||'Não foi possível consultar as permissões.');
   if(!v.ok)throw Error(verificationData.error||'Não foi possível consultar a verificação.');
   setAccess(accessData);setVerification(verificationData);
  }catch(e){setError(e instanceof Error?e.message:'Falha ao consultar o cadastro.');}
  finally{setLoading(false);}
 },[router]);
 useEffect(()=>{void refresh();},[refresh]);
 const steps=access?.steps;
 return <main className="center-screen"><section className="onboarding-card" style={{maxWidth:650}}>
  <span className="brand"><span className="brand-mark">c.</span> conecta<span className="brand-dot">.</span></span>
  <div className="eyebrow">CONECTA ID 2.0</div>
  <h1>Situação da sua conta</h1>
  {loading?<p role="status">Consultando a triagem e as verificações…</p>:null}
  {error?<p role="alert" className="form-error">{error}</p>:null}
  {!loading&&!error&&<>
   <h2>Triagem cadastral</h2>
   <p role="status">{labels[triage.status||'']||'Triagem ainda não concluída.'}</p>
   <h2>Verificação de identidade e idade</h2>
   <p><strong>Identidade:</strong> {verification?.status==='approved'?'Aprovada':verification?.status==='pending'?'Em análise':'Não aprovada ou ainda não iniciada'}</p>
   <p><strong>Acesso:</strong> {access?.networkAccess?'Liberado':access?.basicAccess?'Básico, com restrições':'Restrito'}</p>
   <p>{access?.message||'As verificações obrigatórias ainda estão sendo avaliadas.'}</p>
   <ul style={{textAlign:'left',lineHeight:1.8}}>
    <li>{steps?.profile?'✓':'○'} Perfil cadastrado</li>
    <li>{steps?.ageDeclaration?'✓':'○'} Declaração de faixa etária</li>
    <li>{steps?.identity?'✓':'○'} Identidade verificada</li>
    <li>{steps?.age?'✓':'○'} Idade verificada</li>
    <li>{steps?.guardian?'✓':'○'} Responsável verificado, quando necessário</li>
   </ul>
   {triage.status==='pending_review'&&<p className="muted">Aguarde a decisão de um administrador. Não envie documentos por mensagens ou canais não oficiais.</p>}
   {triage.status==='pending_contact'&&<p className="muted">Confirme o endereço de e-mail utilizado no cadastro e atualize esta página.</p>}
   {!access?.networkAccess&&<p className="muted">A antiga tela de envio de documentos foi desativada. A nova captura ainda não está disponível; nenhuma verificação será aprovada automaticamente.</p>}
  </>}
  <p className="muted">A triagem de risco não confirma sua identidade nem maioridade. O acesso protegido depende das regras do servidor.</p>
  <div className="stack">
   <button className="btn btn-outline" type="button" onClick={()=>void refresh()} disabled={loading}>Atualizar situação</button>
   <Link className="btn btn-primary" href="/">Ir para o Conecta</Link>
  </div>
 </section></main>;
}
