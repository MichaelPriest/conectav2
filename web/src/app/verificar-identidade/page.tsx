'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,Camera,CheckCircle2,ExternalLink,FileCheck2,ShieldCheck,Users,RefreshCw,LockKeyhole} from 'lucide-react';
import {GuardedPage,useAuthProfile} from '@/components/app-shell';
import {supabaseBrowser} from '@/lib/supabase/browser';
import {HumanCameraCheck} from '@/components/human-camera-check';
import {CinQrScanner} from '@/components/cin-qr-scanner';

type Result={
  configured?:boolean;
  status?:string;
  age_band?:string;
  guardian_status?:string;
  error?:string;
  url?:string;
};

const labels:Record<string,string>={
  not_started:'Ainda não iniciada',
  pending:'Em andamento ou aguardando análise',
  approved:'Identidade aprovada pelo provedor',
  declined:'Não aprovada',
  failed:'Não foi possível concluir',
  expired:'Verificação expirada',
  unavailable:'Provedor ainda não ativado'
};

export default function IdentityPage(){
  const auth=useAuthProfile();
  const [result,setResult]=useState<Result|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  const token=useCallback(async()=>{
    const {data:{session}}=await supabaseBrowser().auth.getSession();
    return session?.access_token;
  },[]);

  const refresh=useCallback(async()=>{
    if(!auth.user)return;
    setBusy(true);setError('');
    try{
      const jwt=await token();
      if(!jwt)throw new Error('Sua sessão expirou. Faça login novamente.');
      const response=await fetch('/api/identity/status',{
        headers:{Authorization:'Bearer '+jwt},cache:'no-store'
      });
      const data=(await response.json()) as Result;
      if(!response.ok)throw new Error(data.error||'Não foi possível consultar a verificação.');
      setResult(data);
    }catch(err){setError(err instanceof Error?err.message:'Erro de conexão.');}
    finally{setBusy(false);}
  },[auth.user,token]);

  useEffect(()=>{void refresh();},[refresh]);

  async function begin(){
    setBusy(true);setError('');
    try{
      const jwt=await token();
      if(!jwt)throw new Error('Sua sessão expirou.');
      // Open the tab synchronously so popup blockers do not prevent camera verification.
      const tab=window.open('about:blank','_blank','noopener');
      const response=await fetch('/api/identity/start',{
        method:'POST',headers:{Authorization:'Bearer '+jwt}
      });
      const data=(await response.json()) as Result;
      if(!response.ok||!data.url)throw new Error(data.error||'Provedor indisponível.');
      // Open only HTTPS links checked by the server.
      if(tab)tab.location.href=data.url;
      else window.location.href=data.url;
      await refresh();
    }catch(err){
      setError(err instanceof Error?err.message:'Não foi possível iniciar.');
    }finally{setBusy(false);}
  }

  const available=result?.configured===true;
  return <GuardedPage {...auth}><main className="section-page" style={{maxWidth:850}}>
    <Link href="/perfil" className="rail-link"><ArrowLeft size={16}/> Voltar ao perfil</Link>
    <div className="page-heading" style={{marginTop:24}}><div>
      <span className="section-eyebrow">CONECTA ID · IDENTIDADE SEGURA</span>
      <h1>Confirme sua identidade <span className="wave">✳</span></h1>
      <p>Verificação facial com prova de vida, como nos serviços financeiros.</p>
    </div></div>
    <section className="panel" style={{marginBottom:20}}>
      <div className="row"><ShieldCheck size={29} color="#8057f6"/><div>
        <h2 style={{marginBottom:5}}>Seu rosto e seus documentos ficam com o provedor especializado.</h2>
        <p className="muted">O Conecta não salva selfies, imagens de documentos ou dados biométricos no Supabase. A verificação é iniciada em uma página segura do fornecedor.</p>
      </div></div>
      <div className="tiles-grid" style={{marginTop:23}}>
        <article className="tile-card"><Camera size={23} color="#845cef"/><h3>1. Câmera e prova de vida</h3><p>O provedor verifica que uma pessoa está presente, conforme a modalidade contratada.</p></article>
        <article className="tile-card"><FileCheck2 size={23} color="#845cef"/><h3>2. Documento, se necessário</h3><p>Documento oficial e comparação facial quando exigidos para identidade e idade.</p></article>
        <article className="tile-card"><Users size={23} color="#845cef"/><h3>3. Proteção de adolescentes</h3><p>Para usuários de até 16 anos, o vínculo com responsável precisa ser confirmado separadamente.</p></article>
      </div>
    </section>
    <section className="panel">
      <div className="feed-title"><h2>Status da verificação</h2><button className="btn btn-outline" type="button" onClick={refresh} disabled={busy}><RefreshCw size={16}/> Atualizar</button></div>
      <p><strong>{labels[result?.status||'']||'Consultando...'}</strong></p>
      {result?.status==='approved'&&<p className="form-success"><CheckCircle2 size={17} style={{verticalAlign:'middle'}}/> Identidade confirmada. A aferição de idade é um procedimento separado.</p>}
      {result?.age_band==='unknown'&&<p className="small-note">Faixa etária: ainda não certificada pelo provedor.</p>}
      {result?.guardian_status==='pending'&&<p className="small-note">A vinculação de responsável, se aplicável, ainda depende de verificação.</p>}
      {!available&&result&&<p className="form-error"><LockKeyhole size={15} style={{verticalAlign:'middle'}}/> O serviço biométrico ainda não está contratado e configurado. Nenhuma verificação será simulada.</p>}
      {error&&<p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary btn-lg" type="button" disabled={busy||!available||result?.status==='approved'} onClick={begin}>
        <Camera size={18}/> {busy?'Verificando...':'Iniciar verificação pela câmera'} <ExternalLink size={16}/>
      </button>
      <p className="fineprint" style={{textAlign:'left'}}>Aprovar uma selfie não libera automaticamente recursos restritos por idade. As validações e autorizações legais precisam estar concluídas.</p>
    </section>
  <CinQrScanner/><HumanCameraCheck/></main></GuardedPage>;
}
