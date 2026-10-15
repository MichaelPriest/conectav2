'use client';

import {useState} from 'react';
import {Camera,ShieldCheck,Trash2} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';

type DocumentKind='cin'|'old-rg'|'cnh';
type Props={documentType:DocumentKind;onComplete:()=>Promise<void>|void};

const labels:Record<DocumentKind,string>={cin:'CIN (Carteira de Identidade Nacional)', 'old-rg':'RG antigo com QR Code',cnh:'CNH com QR Code'};

export function FreeDocumentVerification({documentType,onComplete}:Props){
  const [front,setFront]=useState<File|null>(null);
  const [back,setBack]=useState<File|null>(null);
  const [selfie,setSelfie]=useState<File|null>(null);
  const [consent,setConsent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');

  function clear(){
    setFront(null);setBack(null);setSelfie(null);setConsent(false);
    setMessage('Arquivos removidos desta tela.');setError('');
  }

  async function submit(){
    if(!front||!back||!selfie||!consent){
      setError('Envie frente, verso com QR Code e uma selfie ao vivo, e marque o consentimento.');
      return;
    }
    setBusy(true);setError('');setMessage('Lendo o QR Code no seu dispositivo…');
    try{
      const {BrowserQRCodeReader}=await import('@zxing/browser');
      const reader=new BrowserQRCodeReader();
      const backUrl=URL.createObjectURL(back);
      let qrPayload='';
      try{qrPayload=(await reader.decodeFromImageUrl(backUrl)).getText();}
      finally{URL.revokeObjectURL(backUrl);}
      if(!qrPayload||qrPayload.length<8)throw new Error('Não encontrei um QR Code legível no verso. Use uma foto nítida e sem reflexo.');
      const {data:{session}}=await supabaseBrowser().auth.getSession();
      if(!session?.access_token)throw new Error('Sua sessão expirou. Entre novamente.');
      const form=new FormData();
      form.set('documentType',documentType);
      form.set('documentFront',front);
      form.set('selfie',selfie);
      form.set('qrPayload',qrPayload);
      form.set('consent','true');
      setMessage('Processando temporariamente as imagens no servidor seguro do Conecta…');
      const response=await fetch('/api/identity/free-document/verify',{
        method:'POST',headers:{Authorization:'Bearer '+session.access_token},body:form,cache:'no-store'
      });
      const data=await response.json() as {ok?:boolean;message?:string;error?:string;ageBand?:string;imagesDiscarded?:boolean};
      if(!response.ok||data.ok!==true)throw new Error(data.message||data.error||'A validação não foi concluída.');
      setMessage(data.message||'Verificação concluída.');
      setFront(null);setBack(null);setSelfie(null);
      await onComplete();
    }catch(err){
      setError(err instanceof Error?err.message:'Não foi possível concluir a verificação.');
      setMessage('');
    }finally{setBusy(false);}
  }

  return <section className="panel" style={{marginTop:20}}>
    <div className="feed-title">
      <h2><ShieldCheck size={21} style={{verticalAlign:'middle'}}/> Validação gratuita do documento + selfie</h2>
      <span className="small-note">Sem fornecedor pago</span>
    </div>
    <p>Documento selecionado: <strong>{labels[documentType]}</strong>. O Conecta lê o QR Code no seu dispositivo e envia temporariamente a frente do documento e a selfie para análise no servidor. As imagens originais não são salvas no banco nem no armazenamento de arquivos.</p>
    <div className="form-grid" style={{display:'grid',gap:14}}>
      <label className="form-label">Frente do documento com foto
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy}
          onChange={e=>setFront(e.target.files?.[0]||null)}/>
        <span className="small-note">{front?front.name:'JPG, PNG ou WebP · até 8 MB'}</span>
      </label>
      <label className="form-label">Verso com QR Code
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy}
          onChange={e=>setBack(e.target.files?.[0]||null)}/>
        <span className="small-note">{back?back.name:'O QR Code será lido localmente; o arquivo do verso não é enviado.'}</span>
      </label>
      <label className="form-label">Selfie atual do titular
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="user" disabled={busy}
          onChange={e=>setSelfie(e.target.files?.[0]||null)}/>
        <span className="small-note">{selfie?selfie.name:'Olhe diretamente para a câmera, sem filtros e com boa iluminação.'}</span>
      </label>
    </div>
    <label className="human-agree" style={{marginTop:16}}>
      <input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>
      Autorizo o envio temporário da frente do documento, do conteúdo lido do QR Code e da selfie ao servidor do Conecta para OCR, comparação facial e análise antifraude. Não autorizo armazenamento das imagens ou uso para publicidade. Entendo que a análise automática pode errar e não consulta uma base oficial de validade.
    </label>
    <div className="row" style={{gap:10,flexWrap:'wrap',marginTop:16}}>
      <button type="button" className="btn btn-primary" onClick={()=>void submit()} disabled={busy||!front||!back||!selfie||!consent}>
        <Camera size={17}/>{busy?'Analisando…':'Validar gratuitamente'}
      </button>
      <button type="button" className="btn btn-outline" onClick={clear} disabled={busy}>
        <Trash2 size={16}/> Limpar arquivos
      </button>
    </div>
    {message&&<p className="small-note" role="status">{message}</p>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    <p className="small-note">Limitação importante: o RG antigo e a CNH podem ter formatos de QR diferentes. Quando o formato não permitir conferir assinatura ou comparar dados do QR, o Conecta não afirma que o documento foi validado oficialmente. Não envie imagens de terceiros.</p>
  </section>;
}
