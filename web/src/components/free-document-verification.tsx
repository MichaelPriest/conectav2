'use client';

import {useEffect,useRef,useState} from 'react';
import {Camera,ShieldCheck,Trash2,CameraOff} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';

type DocumentKind='cin'|'old-rg'|'cnh';
type Props={documentType:DocumentKind;onComplete:()=>Promise<void>|void};
const labels:Record<DocumentKind,string>={cin:'CIN (Carteira de Identidade Nacional)', 'old-rg':'RG antigo com QR Code',cnh:'CNH com QR Code'};

async function compressForUpload(file:File,maxDimension=1600):Promise<File>{
  const bitmap=await createImageBitmap(file);
  try{
    const scale=Math.min(1,maxDimension/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));
    canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d');
    if(!context)throw new Error('Não foi possível otimizar uma imagem.');
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(
      value=>value?resolve(value):reject(new Error('Não foi possível comprimir uma imagem.')),
      'image/jpeg',0.86
    ));
    return new File([blob],file.name.replace(/\.[^.]+$/,'')+'-otimizada.jpg',{type:'image/jpeg',lastModified:Date.now()});
  }finally{bitmap.close();}
}

export function FreeDocumentVerification({documentType,onComplete}:Props){
  const [front,setFront]=useState<File|null>(null);
  const [back,setBack]=useState<File|null>(null);
  const [selfie,setSelfie]=useState<File|null>(null);
  const [consent,setConsent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [challengeBusy,setChallengeBusy]=useState(false);
  const [challenge,setChallenge]=useState('');
  const [instructions,setInstructions]=useState<string[]>([]);
  const [frameIndex,setFrameIndex]=useState(0);
  const [frames,setFrames]=useState<File[]>([]);
  const [message,setMessage]=useState('');
  const [completed,setCompleted]=useState(false);
  const [error,setError]=useState('');
  const videoRef=useRef<HTMLVideoElement>(null);
  const streamRef=useRef<MediaStream|null>(null);

  function stopCamera(){
    streamRef.current?.getTracks().forEach(track=>track.stop());
    streamRef.current=null;
    if(videoRef.current){videoRef.current.pause();videoRef.current.srcObject=null;}
  }
  useEffect(()=>()=>{streamRef.current?.getTracks().forEach(track=>track.stop());},[]);

  function clear(){
    stopCamera();setFront(null);setBack(null);setSelfie(null);setConsent(false);
    setChallenge('');setInstructions([]);setFrameIndex(0);setFrames([]);
    setMessage('Arquivos removidos desta tela.');setError('');setCompleted(false);
  }

  async function startGuidedCapture(){
    if(challengeBusy||busy)return;
    setChallengeBusy(true);setError('');setMessage('Solicitando acesso à câmera…');
    try{
      if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)
        throw new Error('A câmera exige HTTPS e permissão do navegador.');
      const stream=await navigator.mediaDevices.getUserMedia({
        video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false
      });
      streamRef.current=stream;
      const video=videoRef.current;
      if(!video)throw new Error('Prévia da câmera indisponível.');
      video.srcObject=stream;await video.play();
      const {data:{session}}=await supabaseBrowser().auth.getSession();
      if(!session?.access_token)throw new Error('Sua sessão expirou. Entre novamente.');
      const response=await fetch('/api/identity/free-document/liveness-challenge',{
        method:'POST',headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'
      });
      const data=await response.json() as {challenge?:string;instructions?:string[];error?:string};
      if(!response.ok||!data.challenge||!Array.isArray(data.instructions)||data.instructions.length!==4)
        throw new Error(data.error||'Não foi possível iniciar o desafio guiado.');
      setChallenge(data.challenge);setInstructions(data.instructions);setFrames([]);setFrameIndex(0);
      setMessage('Câmera ativa. Siga cada instrução e capture um quadro por etapa.');
    }catch(err){
      stopCamera();setChallenge('');setInstructions([]);
      setError(err instanceof Error?err.message:'Não foi possível iniciar a captura guiada.');
      setMessage('');
    }finally{setChallengeBusy(false);}
  }

  async function captureFrame(){
    const video=videoRef.current;
    if(!video||!challenge||!video.videoWidth||!video.videoHeight||frameIndex>=4)return;
    setError('');
    try{
      const canvas=document.createElement('canvas');
      canvas.width=video.videoWidth;canvas.height=video.videoHeight;
      const context=canvas.getContext('2d');
      if(!context)throw new Error('Não foi possível capturar o quadro da câmera.');
      context.drawImage(video,0,0,canvas.width,canvas.height);
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(
        value=>value?resolve(value):reject(new Error('Falha ao capturar imagem da câmera.')),
        'image/jpeg',0.88
      ));
      const file=new File([blob],'liveness-'+frameIndex+'.jpg',{type:'image/jpeg'});
      setFrames(previous=>[...previous,file]);
      setFrameIndex(previous=>previous+1);
      setMessage(frameIndex===3?'Captura guiada concluída. Envie os documentos para validação no servidor.':'Quadro capturado. Continue seguindo a próxima instrução.');
      if(frameIndex===3)stopCamera();
    }catch(err){setError(err instanceof Error?err.message:'Falha na captura.');}
  }

  async function submit(){
    if(!front||!back||!selfie||!consent){
      setError('Envie frente, verso com QR Code e selfie, e marque o consentimento.');return;
    }
    if(!challenge||frames.length!==4){
      setError('Conclua os quatro quadros da captura guiada antes de enviar.');return;
    }
    setBusy(true);setError('');setMessage('Preparando o envio seguro para validação…');
    try{
      const {data:{session}}=await supabaseBrowser().auth.getSession();
      if(!session?.access_token)throw new Error('Sua sessão expirou. Entre novamente.');
      const [optimizedFront,optimizedBack,optimizedSelfie]=await Promise.all([
        compressForUpload(front),compressForUpload(back),compressForUpload(selfie)
      ]);
      const form=new FormData();
      form.set('documentType',documentType);form.set('documentFront',optimizedFront);form.set('documentBack',optimizedBack);
      form.set('selfie',optimizedSelfie);form.set('consent','true');form.set('livenessChallenge',challenge);
      frames.forEach((frame,index)=>form.set('livenessFrame'+index,frame));
      setMessage('Validando documento, rosto e captura ao vivo no servidor…');
      const response=await fetch('/api/identity/free-document/verify',{
        method:'POST',headers:{Authorization:'Bearer '+session.access_token},body:form,cache:'no-store'
      });
      const data=await response.json() as {ok?:boolean;approved?:boolean;message?:string;error?:string};
      if(!response.ok||data.ok!==true)throw new Error(data.message||data.error||'A validação não foi concluída.');
      setCompleted(data.approved===true);setMessage(data.message||'Validação concluída.');
      setFront(null);setBack(null);setSelfie(null);setFrames([]);setChallenge('');setInstructions([]);
      await onComplete();
    }catch(err){
      setError(err instanceof Error?err.message:'Não foi possível concluir a validação.');setMessage('');
    }finally{stopCamera();setBusy(false);}
  }

  return <div style={{marginTop:20}}>
    <div className="feed-title">
      <h2><ShieldCheck size={21} style={{verticalAlign:'middle'}}/> Validação gratuita de identidade e rosto</h2>
      <span className="small-note">Sem fornecedor pago</span>
    </div>
    <p>Documento selecionado: <strong>{labels[documentType]}</strong>. O servidor verifica o QR Code, compara dados legíveis, compara o rosto do documento com a selfie e analisa quatro quadros da captura guiada. Quando todas as verificações passam, o Conecta registra a validação e somente a faixa etária. Isso não equivale à confirmação oficial do emissor. As imagens não são armazenadas.</p>
    <div aria-label="Etapas da validação" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(125px,1fr))',gap:8,margin:'16px 0 20px'}}>
      {[
        {number:1,label:'Documento',done:Boolean(front&&back)},
        {number:2,label:'Selfie',done:Boolean(selfie)},
        {number:3,label:'Captura ao vivo',done:frames.length===4},
        {number:4,label:'Validação',done:completed}
      ].map(step=><div key={step.number} style={{display:'flex',alignItems:'center',gap:9,padding:'10px 12px',borderRadius:12,border:'1px solid var(--border,#dedee7)',background:step.done?'var(--surface-success,rgba(34,197,94,.08))':'var(--surface,#fff)',minHeight:48}}>
        <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:27,height:27,borderRadius:99,fontWeight:700,flexShrink:0,background:step.done?'var(--success,#16a34a)':'var(--muted-surface,#f1f1f5)',color:step.done?'white':'inherit'}}>{step.done?'✓':step.number}</span>
        <span style={{fontSize:13,fontWeight:600}}>{step.label}</span>
      </div>)}
    </div>
    <div className="form-grid" style={{display:'grid',gap:14}}>
      <label className="form-label">Frente do documento com foto
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy||challengeBusy} onChange={e=>setFront(e.target.files?.[0]||null)}/>
        <span className="small-note">{front?front.name:'JPG, PNG ou WebP · até 8 MB'}</span>
      </label>
      <label className="form-label">Verso com QR Code
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy||challengeBusy} onChange={e=>setBack(e.target.files?.[0]||null)}/>
        <span className="small-note">{back?back.name:'O verso é enviado temporariamente para leitura; não é armazenado.'}</span>
      </label>
      <label className="form-label">Selfie atual do titular
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="user" disabled={busy||challengeBusy} onChange={e=>setSelfie(e.target.files?.[0]||null)}/>
        <span className="small-note">{selfie?selfie.name:'Use uma foto nítida, sem filtros. A seleção pode permitir escolher da galeria.'}</span>
      </label>
    </div>
    <label className="human-agree" style={{marginTop:16}}>
      <input type="checkbox" checked={consent} disabled={busy||challengeBusy} onChange={e=>setConsent(e.target.checked)}/>
      Autorizo o envio temporário das imagens para OCR, leitura do QR, comparação facial e análise guiada de movimentos. Não autorizo armazenamento das imagens nem uso para publicidade. Entendo que isso não consulta uma base oficial de validade.
    </label>
    <section className="panel" style={{marginTop:16}}>
      <h3>Captura guiada de vivacidade</h3>
      <p className="small-note">O servidor emite um desafio aleatório válido por 90 segundos e aceita seu uso uma única vez. Permita a câmera e siga as etapas na ordem apresentada.</p>
      <video ref={videoRef} autoPlay muted playsInline aria-label="Prévia da câmera para captura guiada"
        style={{display:challenge?'block':'none',width:'100%',maxWidth:420,aspectRatio:'4 / 3',objectFit:'cover',transform:'scaleX(-1)',borderRadius:12,background:'#111'}}/>
      {!challenge?<button type="button" className="btn btn-outline" onClick={()=>void startGuidedCapture()} disabled={busy||challengeBusy}>
        <Camera size={17}/>{challengeBusy?'Preparando câmera…':'Iniciar captura guiada'}</button>:
        <div>
          <p><strong>Etapa {Math.min(frameIndex+1,4)} de 4:</strong> {instructions[frameIndex]||'Captura concluída.'}</p>
          <progress value={frames.length} max={4} aria-label="Quadros capturados" style={{width:'100%',height:10,accentColor:'var(--accent,#6d5dfc)'}}/>
          <p className="small-note">Quadros capturados: {frames.length}/4</p>
          {frameIndex<4&&<button type="button" className="btn btn-outline" onClick={()=>void captureFrame()} disabled={busy}>
            <Camera size={17}/> Capturar esta etapa</button>}
          <button type="button" className="btn btn-outline" style={{marginLeft:8}} onClick={()=>{stopCamera();setChallenge('');setInstructions([]);setFrames([]);setFrameIndex(0);setMessage('Captura cancelada.');}} disabled={busy}>
            <CameraOff size={17}/> Cancelar captura</button>
        </div>}
    </section>
    <div className="row" style={{gap:10,flexWrap:'wrap',marginTop:16}}>
      <button type="button" className="btn btn-primary" onClick={()=>void submit()} disabled={busy||challengeBusy||!front||!back||!selfie||!consent||!challenge||frames.length!==4}>
        <ShieldCheck size={17}/>{busy?'Analisando…':'Validar minha identidade'}</button>
      <button type="button" className="btn btn-outline" onClick={clear} disabled={busy||challengeBusy}>
        <Trash2 size={16}/> Limpar arquivos</button>
    </div>
    {message&&<p className={completed?'form-success':'small-note'} role="status">{message}</p>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    <p className="small-note">Mesmo se os movimentos forem reconhecidos, esta etapa não libera selo, faixa etária ou acesso automaticamente. A análise gratuita é experimental e não substitui a confirmação oficial de autenticidade do emissor. Não envie documentos de terceiros.</p>
  </div>;
}
