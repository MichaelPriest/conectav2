'use client';

import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,CheckCircle2,LockKeyhole,RefreshCw,ShieldCheck} from 'lucide-react';
import {GuardedPage,useAuthProfile} from '@/components/app-shell';
import {supabaseBrowser} from '@/lib/supabase/browser';
import {FreeDocumentVerification} from '@/components/free-document-verification';
import {FamilyRelationships} from '@/components/family-relationships';

type Result={configured?:boolean;status?:string;age_band?:string;guardian_status?:string;error?:string};
type AccessResult={networkAccess?:boolean;reason?:string;message?:string;steps?:{profile:boolean;ageDeclaration:boolean;identity:boolean;age:boolean;guardian:boolean}};
type DocumentMode='cin'|'old-rg'|'cnh';

const labels:Record<string,string>={
  not_started:'Ainda não iniciada',
  pending:'Em análise',
  approved:'Identidade aprovada',
  declined:'Não aprovada',
  failed:'Não foi possível concluir',
  expired:'Verificação expirada',
  unavailable:'Verificação indisponível'
};

export default function IdentityPage(){
  const auth=useAuthProfile();
  const [result,setResult]=useState<Result|null>(null);
  const [access,setAccess]=useState<AccessResult|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [declaredBand,setDeclaredBand]=useState<string|null>(null);
  const [documentMode,setDocumentMode]=useState<DocumentMode>('old-rg');

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
      const headers={Authorization:'Bearer '+jwt};
      const [statusResponse,accessResponse]=await Promise.all([
        fetch('/api/identity/status',{headers,cache:'no-store'}),
        fetch('/api/identity/access',{headers,cache:'no-store'})
      ]);
      const statusData=await statusResponse.json() as Result;
      if(!statusResponse.ok)throw new Error(statusData.error||'Não foi possível consultar a validação.');
      setResult(statusData);
      if(accessResponse.ok)setAccess(await accessResponse.json() as AccessResult);
      else setAccess({networkAccess:false,reason:'verification_unavailable',message:'Não foi possível confirmar a validação. O acesso continua bloqueado.'});
    }catch(err){setError(err instanceof Error?err.message:'Erro de conexão.');}
    finally{setBusy(false);}
  },[auth.user,token]);

  useEffect(()=>{void refresh();},[refresh]);

  useEffect(()=>{
    if(!auth.user)return;
    let mounted=true;
    void supabaseBrowser().from('registration_age_declarations')
      .select('declared_band').eq('user_id',auth.user.id).maybeSingle()
      .then(({data,error})=>{if(mounted&&!error)setDeclaredBand(data?.declared_band||null);});
    return ()=>{mounted=false;};
  },[auth.user]);

  return <GuardedPage {...auth}><main className="section-page" style={{maxWidth:850}}>
    <Link href="/" className="rail-link"><ArrowLeft size={16}/> Voltar ao site público</Link>
    <div className="page-heading" style={{marginTop:24}}>
      <div>
        <span className="section-eyebrow">CONECTA ID</span>
        <h1>Validar minha identidade <span className="wave">✳</span></h1>
        <p>Um único processo gratuito de validação: envie seu documento e uma selfie, conclua a captura guiada e receba o resultado registrado pelo Conecta. O sistema aplica OCR, comparação facial e verificações antifraude disponíveis. A leitura de QR Code é exigida para CIN e CNH, mas não para RG antigo.</p>
      </div>
    </div>

    <section className="panel" style={{marginBottom:20}}>
      <div className="feed-title">
        <h2><ShieldCheck size={21} style={{verticalAlign:'middle'}}/> Status da conta</h2>
        <button className="btn btn-outline" type="button" onClick={()=>void refresh()} disabled={busy}>
          <RefreshCw size={16}/> Atualizar
        </button>
      </div>
      <p className={access?.networkAccess?'form-success':'form-error'} role="status">
        <LockKeyhole size={16} style={{verticalAlign:'middle'}}/> <strong>{access?.networkAccess?'Conecta ID aprovado — acesso liberado':'Acesso restrito até concluir as verificações necessárias'}</strong>
      </p>
      <p>{access?.message||'Consultando no servidor o estado da conta.'}</p>
      {!access?.networkAccess&&<p className="small-note">Acesso à rede bloqueado até concluir o Conecta ID e as demais verificações obrigatórias. A tela não oferece atalhos para contornar essa proteção.</p>}
      <ol style={{paddingLeft:22,lineHeight:1.8}}>
        <li>{access?.steps?.profile?'✓':'○'} Perfil cadastrado</li>
        <li>{access?.steps?.ageDeclaration?'✓':'○'} Faixa etária declarada (não é prova de idade)</li>
        <li>{access?.steps?.identity?'✓':'○'} Identidade aprovada</li>
        <li>{access?.steps?.age?'✓':'○'} Idade confirmada quando exigida</li>
        {(declaredBand!=='18_plus'||access?.reason==='guardian_required')&&<li>{access?.steps?.guardian?'✓':'○'} Responsável verificado, quando aplicável</li>}
      </ol>
      <p><strong>Resultado da validação:</strong> {labels[result?.status||'']||'Consultando…'}</p>
      {result?.status==='approved'&&<p className="form-success"><CheckCircle2 size={17} style={{verticalAlign:'middle'}}/> Identidade aprovada. A confirmação de idade e de responsável, quando exigidas, continua sendo avaliada separadamente pelas regras de proteção.</p>}
      {result?.guardian_status==='pending'&&<p className="small-note">A vinculação do responsável ainda precisa ser verificada.</p>}
      {error&&<p className="form-error" role="alert">{error}</p>}
      <p className="small-note">Esta é uma avaliação própria do Conecta, não uma certificação governamental. QR Code e OCR podem falhar ou ser fraudulentos; casos inconclusivos não devem liberar acesso automaticamente. Não há consulta automática a uma base oficial de validade do documento.</p>
    </section>

    <section className="panel" style={{marginBottom:20}}>
      <h2>Validar identidade e rosto</h2>
      <p>Use apenas um documento seu, com foto e data de nascimento legíveis. Escolha o tipo para que o servidor aplique as verificações compatíveis; isso não muda o processo nem cria métodos diferentes.</p>
      <label className="form-label" htmlFor="identity-document-type">Tipo de documento</label>
      <select id="identity-document-type" className="form-input" value={documentMode} onChange={event=>setDocumentMode(event.target.value as DocumentMode)}>
        <option value="cin">Carteira de Identidade Nacional (CIN)</option>
        <option value="old-rg">RG antigo (frente e verso, sem QR Code)</option>
        <option value="cnh">CNH com QR Code</option>
      </select>
      <p className="small-note">Para RG antigo, envie frente e verso: não é necessário localizar QR Code. Para CIN e CNH, a leitura do QR Code continua obrigatória. Em todos os casos, os dados precisam ser compatíveis; a validação do Conecta não equivale à confirmação oficial do emissor.</p>
      <FreeDocumentVerification key={documentMode} documentType={documentMode} onComplete={refresh}/>
    </section>

    {auth.user&&<FamilyRelationships userId={auth.user.id}/>}
  </main></GuardedPage>;
}
