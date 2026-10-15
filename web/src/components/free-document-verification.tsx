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
  const [step,setStep]=useState(1);
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
    setMessage('Arquivos removidos desta tela.');setError('');setCompleted(false);setStep(1);
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
      setCompleted(data.approved===true);setStep(5);setMessage(data.message||'Validação concluída.');
      setFront(null);setBack(null);setSelfie(null);setFrames([]);setChallenge('');setInstructions([]);
      await onComplete();
    }catch(err){
      setError(err instanceof Error?err.message:'Não foi possível concluir a validação.');setMessage('');
    }finally{stopCamera();setBusy(false);}
  }

  const steps=[
    {number:1,label:'Documento',done:Boolean(front&&back)},
    {number:2,label:'Rosto',done:Boolean(selfie)},
    {number:3,label:'Captura ao vivo',done:frames.length===4},
    {number:4,label:'Validar',done:completed}
  ];
  const canContinue=step===1?Boolean(front&&back):step===2?Boolean(selfie&&consent):step===3?Boolean(challenge&&frames.length===4):true;

  return <div style={{marginTop:20}}>
    <div className="feed-title">
      <h2><ShieldCheck size={21} style={{verticalAlign:'middle'}}/> Validação gratuita de identidade e rosto</h2>
      <span className="small-note">Sem fornecedor pago</span>
    </div>
    <p>Documento selecionado: <strong>{labels[documentType]}</strong>. O Conecta lê o QR Code, confere dados legíveis, compara o rosto do documento com a selfie e analisa a captura guiada. As imagens são processadas temporariamente e não são armazenadas. Esta validação própria não equivale à confirmação oficial do emissor.</p>
    <div aria-label="Etapas da validação" style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:6,margin:'16px 0 20px'}}>
      {steps.map(item=><div key={item.number} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,textAlign:'center',padding:'9px 4px',borderRadius:12,border:'1px solid var(--border,#dedee7)',background:step===item.number?'var(--surface,#fff)':item.done?'var(--surface-success,rgba(34,197,94,.08))':'transparent',boxShadow:step===item.number?'0 0 0 2px var(--accent,#6d5dfc)':'none',minWidth:0}}>
        <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:28,height:28,borderRadius:99,fontWeight:700,background:item.done?'var(--success,#16a34a)':'var(--muted-surface,#f1f1f5)',color:item.done?'white':'inherit'}}>{item.done?'✓':item.number}</span>
        <span style={{fontSize:12,fontWeight:600,lineHeight:1.25}}>{item.label}</span>
      </div>)}
    </div>
    {step===1&&<section className="panel" aria-labelledby="identity-step-document">
      <h3 id="identity-step-document">1. Envie seu documento</h3>
      <p className="small-note">Fotografe o documento inteiro, com boa iluminação e sem reflexos. Envie a frente e o verso com QR Code.</p>
      <div style={{display:'grid',gap:14}}>
        <label className="form-label">Frente do documento com foto
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy||challengeBusy} onChange={e=>setFront(e.target.files?.[0]||null)}/>
          <span className="small-note">{front?front.name:'JPG, PNG ou WebP · até 8 MB'}</span>
        </label>
        <label className="form-label">Verso do documento com QR Code
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy||challengeBusy} onChange={e=>setBack(e.target.files?.[0]||null)}/>
          <span className="small-note">{back?back.name:'O verso é processado temporariamente, sem armazenamento.'}</span>
        </label>
      </div>
      <label className="human-agree" style={{marginTop:16}}>
        <input type="checkbox" checked={consent} disabled={busy||challengeBusy} onChange={e=>setConsent(e.target.checked)}/>
        Autorizo o processamento temporário das imagens para leitura do QR, OCR, comparação facial e captura guiada. Não autorizo armazenamento nem uso para publicidade. Entendo que não há consulta automática a uma base oficial.
      </label>
    </section>}
    {step===2&&<section className="panel" aria-labelledby="identity-step-face">
      <h3 id="identity-step-face">2. Confirme seu rosto</h3>
      <p>Agora envie uma selfie atual do titular do documento. Mantenha o rosto inteiro visível, em ambiente iluminado, sem filtros, óculos escuros ou outras pessoas na imagem.</p>
      <label className="form-label">Selfie atual
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="user" disabled={busy||challengeBusy} onChange={e=>setSelfie(e.target.files?.[0]||null)}/>
        <span className="small-note">{selfie?selfie.name:'A seleção pode permitir escolher da galeria, ou tirar uma foto agora.'}</span>
      </label>
      <p className="small-note">A comparação facial será feita no servidor após concluir as etapas. Enviar uma selfie, por si só, não aprova a identidade.</p>
    </section>}
    {step===3&&<section className="panel" aria-labelledby="identity-step-live">
      <h3 id="identity-step-live">3. Confirme que está presente</h3>
      <p className="small-note">Permita o acesso à câmera. O sistema solicitará quatro quadros e instruções aleatórias de movimento, válidas por 90 segundos.</p>
      <video ref={videoRef} autoPlay muted playsInline aria-label="Prévia da câmera para captura guiada"
        style={{display:challenge?'block':'none',width:'100%',maxWidth:420,aspectRatio:'4 / 3',objectFit:'cover',transform:'scaleX(-1)',borderRadius:12,background:'#111'}}/>
      {!challenge?<button type="button" className="btn btn-outline" onClick={()=>void startGuidedCapture()} disabled={busy||challengeBusy}>
        <Camera size={17}/>{challengeBusy?'Preparando câmera…':'Ativar câmera e iniciar'}</button>:
        <div>
          <p><strong>Etapa {Math.min(frameIndex+1,4)} de 4:</strong> {instructions[frameIndex]||'Captura concluída.'}</p>
          <progress value={frames.length} max={4} aria-label="Quadros capturados" style={{width:'100%',height:10,accentColor:'var(--accent,#6d5dfc)'}}/>
          <p className="small-note">Quadros capturados: {frames.length}/4</p>
          {frameIndex<4&&<button type="button" className="btn btn-outline" onClick={()=>void captureFrame()} disabled={busy}>
            <Camera size={17}/> Capturar esta etapa</button>}
          <button type="button" className="btn btn-outline" style={{marginLeft:8}} onClick={()=>{stopCamera();setChallenge('');setInstructions([]);setFrames([]);setFrameIndex(0);setMessage('Captura cancelada.');}} disabled={busy}>
            <CameraOff size={17}/> Reiniciar captura</button>
        </div>}
    </section>}
    {step===4&&<section className="panel" aria-labelledby="identity-step-review">
      <h3 id="identity-step-review">4. Revise e validar</h3>
      <ul style={{lineHeight:1.9,paddingLeft:22}}>
        <li>{front&&back?'✓':'○'} Frente e verso do documento</li>
        <li>{selfie?'✓':'○'} Selfie para comparação facial</li>
        <li>{consent?'✓':'○'} Consentimento para processamento temporário</li>
        <li>{frames.length===4?'✓':'○'} Captura guiada concluída</li>
      </ul>
      <p>Ao selecionar “Validar minha identidade”, o servidor verifica os arquivos e registra o resultado apenas quando todas as verificações obrigatórias passam. Não há aprovação simulada nem liberação por resultado inconclusivo.</p>
      <button type="button" className="btn btn-primary" onClick={()=>void submit()} disabled={busy||challengeBusy||!front||!back||!selfie||!consent||!challenge||frames.length!==4}>
        <ShieldCheck size={17}/>{busy?'Validando no servidor…':'Validar minha identidade'}</button>
    </section>}
    {step===5&&<section className="panel" aria-live="polite">
      <h3>{completed?'Validação concluída':'Resultado da validação'}</h3>
      <p className={completed?'form-success':'small-note'}>{message||'O resultado foi atualizado.'}</p>
      <button type="button" className="btn btn-outline" onClick={clear}><Trash2 size={16}/> Iniciar novamente</button>
    </section>}
    {step<4&&<div className="row" style={{gap:10,flexWrap:'wrap',marginTop:16}}>
      {step>1&&<button type="button" className="btn btn-outline" onClick={()=>{if(step===3){stopCamera();setChallenge('');setInstructions([]);setFrames([]);setFrameIndex(0);}setStep(step-1);}} disabled={busy||challengeBusy}>Voltar</button>}
      <button type="button" className="btn btn-primary" onClick={()=>{setError('');setStep(step+1);}} disabled={!canContinue||busy||challengeBusy}>
        Continuar <span aria-hidden="true">→</span>
      </button>
    </div>}
    {step===4&&<div style={{marginTop:12}}>
      <button type="button" className="btn btn-outline" onClick={()=>{setStep(3);}} disabled={busy||challengeBusy}>Voltar para captura</button>
      <button type="button" className="btn btn-outline" style={{marginLeft:8}} onClick={clear} disabled={busy||challengeBusy}><Trash2 size={16}/> Limpar e recomeçar</button>
    </div>}
    {message&&step!==5&&<p className="small-note" role="status">{message}</p>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    <p className="small-note">Mesmo se os movimentos forem reconhecidos, isso não comprova autenticidade oficial do documento. Não envie documentos de terceiros. Se a leitura ou a comparação ficar inconclusiva, a validação não será aprovada.</p>
  </div>;
}
