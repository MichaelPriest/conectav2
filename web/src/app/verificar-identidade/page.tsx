'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,Camera,CheckCircle2,ExternalLink,ShieldCheck,RefreshCw,LockKeyhole,Smartphone,Info} from 'lucide-react';
import {GuardedPage,useAuthProfile} from '@/components/app-shell';
import {supabaseBrowser} from '@/lib/supabase/browser';
import {HumanCameraCheck} from '@/components/human-camera-check';
import {CinQrScanner} from '@/components/cin-qr-scanner';
import {GovBrSignatureFlow} from '@/components/govbr-signature-flow';

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
  const [declaredBand,setDeclaredBand]=useState<string|null>(null);

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

  useEffect(()=>{
    if(!auth.user)return;
    let mounted=true;
    void supabaseBrowser().from('registration_age_declarations')
      .select('declared_band').eq('user_id',auth.user.id).maybeSingle()
      .then(({data,error})=>{
        if(mounted&&!error)setDeclaredBand(data?.declared_band||null);
      });
    return ()=>{mounted=false;};
  },[auth.user]);

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
      <span className="section-eyebrow">CONECTA ID · VALIDAÇÃO DOCUMENTAL</span>
      <h1>Identidade e idade <span className="wave">✳</span></h1>
      <p>Confira sua CIN no aplicativo oficial gratuito e use as ferramentas experimentais do Conecta sem compartilhar documentos.</p>
    </div></div>
    <section className="panel" style={{marginBottom:20}}>
      <div className="feed-title"><h2>Etapas de proteção da conta</h2></div>
      <p><strong>1. Cadastro:</strong> {declaredBand
        ?declaredBand==='18_plus'?'faixa de 18 anos ou mais autodeclarada (não comprovada)':
         declaredBand==='13_15'?'faixa de 13–15 anos autodeclarada, proteção juvenil ativa':
         'faixa de 16–17 anos autodeclarada, proteção juvenil ativa'
        :'faixa etária ainda não informada'}.</p>
      <p><strong>2. Pré-triagem:</strong> QR Code da CIN e prova de vida com Human — ferramentas gratuitas e experimentais.</p>
      <p><strong>3. Assinatura:</strong> declaração individual assinada no gov.br, com conferência técnica do PDF e consulta ao VALIDAR.</p>
      <p><strong>4. Decisão:</strong> a confirmação de identidade e idade depende de verificação confiável da titularidade e situação documental.
         Para menores, também é necessário verificar o vínculo do responsável.</p>
      {declaredBand&&declaredBand!=='18_plus'&&
        <p className="form-error" role="status">A conta permanece protegida e sem publicação ou mensagens até termos um processo confiável de verificação de idade e responsável.</p>}
      <p className="small-note">Nenhum teste local, PDF com assinatura íntegra ou data declarada cria automaticamente um selo de conta verificada ou habilita recursos exclusivos para adultos.</p>
    </section>
    <section className="panel conecta-id-official" style={{marginBottom:20}}>
      <div className="feed-title"><h2><ShieldCheck size={22} color="#5e7cbd" style={{verticalAlign:'middle'}}/> Validação oficial gratuita da CIN</h2>
        <span className="small-note">Ministério da Justiça e Segurança Pública</span></div>
      <p>O governo oferece a <strong>leitura detalhada oficial</strong> da CIN no aplicativo
        Carteira de Identidade Nacional. Ele consulta a validade atual do documento
        e exige internet e autenticação gov.br.</p>
      <ol style={{paddingLeft:21,lineHeight:1.8}}>
        <li>Instale o aplicativo oficial abaixo no celular.</li>
        <li>Escolha <strong>Leitura Detalhada (completa)</strong> e entre com sua conta gov.br.</li>
        <li>Escaneie o QR Code no verso da CIN física e compare os dados apresentados.</li>
      </ol>
      <div className="row" style={{gap:10,flexWrap:'wrap',marginTop:15}}>
        <a className="btn btn-primary" href="https://play.google.com/store/apps/details?id=com.identidadenacional"
          target="_blank" rel="noopener noreferrer"><Smartphone size={17}/> Aplicativo Android <ExternalLink size={14}/></a>
        <a className="btn btn-outline" href="https://apps.apple.com/br/app/carteira-identidade-nacional/id1642584147"
          target="_blank" rel="noopener noreferrer"><Smartphone size={17}/> Aplicativo iPhone <ExternalLink size={14}/></a>
        <a className="btn btn-outline"
          href="https://www.gov.br/pt-br/servicos/verificar-validade-de-qr-code-da-carteira-de-identidade-nacional"
          target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/> Instruções oficiais</a>
      </div>
      <p className="small-note" style={{marginTop:14}}><Info size={15} style={{verticalAlign:'middle'}}/>
        A consulta é gratuita para o cidadão, mas <strong>o governo não envia o resultado ao Conecta</strong>.
        Esta etapa, mesmo concluída no aplicativo oficial, não gera selo de identidade nem
        comprovação de maioridade dentro da nossa rede. Nunca informe sua senha gov.br ao Conecta.</p>
    </section>
    <section className="panel">
      <div className="feed-title"><h2>Status da verificação integrada ao Conecta</h2><button className="btn btn-outline" type="button" onClick={refresh} disabled={busy}><RefreshCw size={16}/> Atualizar</button></div>
      <p><strong>{labels[result?.status||'']||'Consultando...'}</strong></p>
      {result?.status==='approved'&&<p className="form-success"><CheckCircle2 size={17} style={{verticalAlign:'middle'}}/> Identidade confirmada. A aferição de idade é um procedimento separado.</p>}
      {result?.age_band==='unknown'&&<p className="small-note">Faixa etária: ainda não certificada pelo provedor.</p>}
      {result?.guardian_status==='pending'&&<p className="small-note">A vinculação de responsável, se aplicável, ainda depende de verificação.</p>}
      {!available&&result&&<p className="form-error"><LockKeyhole size={15} style={{verticalAlign:'middle'}}/> O Conecta ainda não tem integração autorizada que receba uma aprovação oficial de identidade ou idade. A consulta gratuita acima é externa e não atualiza este status.</p>}
      {error&&<p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary btn-lg" type="button" disabled={busy||!available||result?.status==='approved'} onClick={begin}>
        <Camera size={18}/> {busy?'Verificando...':'Iniciar verificação pela câmera'} <ExternalLink size={16}/>
      </button>
      <p className="fineprint" style={{textAlign:'left'}}>O leitor QR Code e o Human abaixo são apenas ferramentas experimentais. Nenhuma conclusão local libera acesso adulto ou altera o cadastro de idade.</p>
    </section>
  <GovBrSignatureFlow/><CinQrScanner/><HumanCameraCheck/></main></GuardedPage>;
}
