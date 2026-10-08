'use client';
import {useEffect,useRef,useState} from 'react';
import {Camera,CameraOff,FileImage,ScanQrCode,ShieldAlert,ShieldCheck,ExternalLink} from 'lucide-react';
import {inspectCinToken} from '@/lib/cin-qr';
import type {CinPreflight} from '@/lib/cin-qr';
import type {IScannerControls} from '@zxing/browser';

const officialUrl='https://www.gov.br/pt-br/servicos/verificar-validade-de-qr-code-da-carteira-de-identidade-nacional';

const bands:Record<string,string>={
 under_13:'Menor de 13 anos (indicativo local)',
 '13_15':'13 a 15 anos (indicativo local)',
 '16_17':'16 a 17 anos (indicativo local)',
 '18_plus':'18 anos ou mais (indicativo local)'
};

export function CinQrScanner(){
 const video=useRef<HTMLVideoElement>(null);
 const controls=useRef<IScannerControls|null>(null);
 const mounted=useRef(true);
 const session=useRef(0);
 const [agreed,setAgreed]=useState(false);
 const [scanning,setScanning]=useState(false);
 const [busy,setBusy]=useState(false);
 const [info,setInfo]=useState('O Conecta não envia o QR Code ou a imagem da CIN ao servidor.');
 const [outcome,setOutcome]=useState<CinPreflight|null>(null);
 const [error,setError]=useState('');

 useEffect(()=>{mounted.current=true;return()=>{
   mounted.current=false;session.current++;
   controls.current?.stop();controls.current=null;
   if(video.current){video.current.pause();video.current.srcObject=null;}
 };},[]);

 function stop(){
   session.current++;
   controls.current?.stop();controls.current=null;
   if(video.current){video.current.pause();video.current.srcObject=null;}
   setScanning(false);setBusy(false);
 }
 async function handleValue(value:string){
   if(!mounted.current)return;
   setInfo('Conferindo estrutura e assinatura da CIN no próprio navegador...');
   // No CPF, QR contents, raw dates or user images ever enter component state or logs.
   const response=await inspectCinToken(value);
   if(!mounted.current)return;
   setOutcome(response);setInfo(response.message);
 }
 async function startCamera(){
   if(busy||scanning||!agreed)return;
   if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){
     setError('É necessário usar HTTPS e permitir acesso à câmera.');return;
   }
   stop();setBusy(true);setError('');setOutcome(null);
   setInfo('Abrindo a câmera traseira para ler o código...');
   const current=++session.current;
   try{
     const {BrowserQRCodeReader}=await import('@zxing/browser');
     if(current!==session.current)return;
     const reader=new BrowserQRCodeReader(undefined,{delayBetweenScanAttempts:300});
     if(!video.current)throw new Error('Câmera não encontrada na tela.');
     const ctrls=await reader.decodeFromConstraints(
       {video:{facingMode:{ideal:'environment'},width:{ideal:900}},audio:false},
       video.current,
       (scan)=>{
         if(!scan||current!==session.current)return;
         const content=scan.getText();
         if(typeof content!=='string')return;
         stop();
         setInfo('QR Code detectado. Conferindo assinatura...');
         void handleValue(content).catch(()=>{
           if(mounted.current)setError('Não foi possível processar o QR Code.');});
       }
     );
     if(current!==session.current){ctrls.stop();return;}
     controls.current=ctrls;
     setScanning(true);setBusy(false);
     setInfo('Posicione o QR Code no centro da câmera.');
   }catch(err){
     if(current!==session.current)return;
     stop();setError(err instanceof Error?err.message:'Não foi possível abrir a câmera.');
   }
 }
 async function fromImage(file:File|null){
   if(!file||!agreed)return;
   stop();setBusy(true);setOutcome(null);setError('');
   if(file.size>12*1024*1024 || !['image/jpeg','image/png','image/webp'].includes(file.type)){
     setBusy(false);setError('Envie uma imagem JPG, PNG ou WebP de até 12 MB.');return;
   }
   const current=++session.current;
   let url='';
   try{
     const {BrowserQRCodeReader}=await import('@zxing/browser');
     if(current!==session.current)return;
     url=URL.createObjectURL(file);
     const reader=new BrowserQRCodeReader();
     const value=(await reader.decodeFromImageUrl(url)).getText();
     if(current!==session.current)return;
     await handleValue(value);
   }catch{
     if(current===session.current)setError('Não encontrei um QR Code CIN legível nessa imagem.');
   }finally{
     if(url)URL.revokeObjectURL(url);
     if(current===session.current)setBusy(false);
   }
 }
 function clear(){stop();setOutcome(null);setError('');setInfo('Nada foi armazenado.');}
 return <section className="panel conecta-cin-panel">
  <div className="feed-title"><h2><ScanQrCode size={22} color="#7655da" style={{verticalAlign:'middle'}}/> Leitor gratuito do QR Code da CIN</h2>
    <span className="small-note">ZXing + WebCrypto</span></div>
  <p className="muted">Leia o QR Code no verso da nova Carteira de Identidade Nacional (CIN).
    A assinatura ES512 é conferida localmente usando uma chave pública experimental
    documentada no projeto Digital Document Checker. <strong>Não é uma validação oficial.</strong></p>
  <label className="human-agree"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} disabled={busy||scanning}/>
    Concordo com a leitura local do QR Code. O Conecta não faz upload nem guarda o código,
    CPF, data de nascimento ou foto do documento.
  </label>
  <div className="human-video-wrap conecta-cin-video-wrap">
    <video ref={video} muted playsInline autoPlay aria-label="Câmera lendo QR Code da CIN"/>
    <div className="conecta-cin-frame" aria-hidden="true"/>
  </div>
  <div className="row conecta-cin-actions" style={{gap:10,flexWrap:'wrap'}}>
    {!scanning?<button type="button" className="btn btn-outline" disabled={!agreed||busy} onClick={()=>void startCamera()}>
      <Camera size={17}/> {busy?'Analisando...':'Ler QR Code com câmera'}</button>:
      <button type="button" className="btn btn-outline" onClick={()=>{stop();setInfo('Câmera desligada.');}}><CameraOff size={17}/> Desligar câmera</button>}
    <label className="btn btn-outline conecta-cin-file"><FileImage size={17}/> Usar imagem local
      <input aria-label="Enviar imagem do QR Code" type="file" accept="image/jpeg,image/png,image/webp"
        disabled={!agreed||busy||scanning} onChange={e=>{const file=e.target.files?.[0]||null;e.target.value='';void fromImage(file);}}/>
    </label>
    {outcome&&<button type="button" className="btn btn-outline" onClick={clear}>Limpar resultado</button>}
  </div>
  <p className="small-note" role="status">{info}</p>
  {error&&<p className="form-error" role="alert">{error}</p>}
  {outcome&&<div className={'conecta-cin-result '+(outcome.status==='signature-valid-local'?'checked':'caution')}>
    {outcome.status==='signature-valid-local'?<ShieldCheck size={20}/>:<ShieldAlert size={20}/>}
    <div><strong>{outcome.status==='signature-valid-local'?'Assinatura local compatível — análise experimental':
      'Não foi possível confirmar a assinatura local'}</strong>
      <p>{outcome.message}</p>
      {outcome.indicativeAgeBand&&<p><strong>Faixa etária extraída do QR Code: </strong>{bands[outcome.indicativeAgeBand]}.</p>}
      <p><strong>Identidade e maioridade: NÃO verificadas.</strong> A confirmação da validade atual da CIN
      requer consulta oficial, e a titularidade exige conferência independente.</p>
    </div>
  </div>}
  <p className="small-note">RG antigo e CNH/VIO não são reconhecidos por este leitor de CIN.
    A verificação completa gratuita é feita no aplicativo oficial, com gov.br.</p>
  <a href={officialUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
    <ExternalLink size={16}/> Abrir instruções do validador oficial da CIN
  </a>
 </section>;
}
