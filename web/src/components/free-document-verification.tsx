'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {Camera,ShieldCheck,Trash2,CameraOff} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';
import {inspectGuidedFace} from '@/lib/identity-frame-guidance';
import type {FaceGuide} from '@/lib/identity-frame-guidance';

type DocumentKind='cin'|'old-rg'|'cnh';
type Props={documentType:DocumentKind;onComplete:()=>Promise<void>|void};
type FacePoint={x:number;y:number;z:number};
type LocalFaceLandmarker={
 detect:(video:HTMLVideoElement)=>{faceLandmarks?:FacePoint[][]};
 close:()=>void;
};
type LocalMediaPipe={
 FaceLandmarker:{createFromOptions:(vision:unknown,options:Record<string,unknown>)=>Promise<LocalFaceLandmarker>};
 FilesetResolver:{forVisionTasks:(path:string)=>Promise<unknown>};
};
declare global{interface Window{ConectaMediaPipe?:LocalMediaPipe;}}
let mediaPipeLoader:Promise<LocalMediaPipe>|null=null;
function loadLocalMediaPipe():Promise<LocalMediaPipe>{
 if(window.ConectaMediaPipe)return Promise.resolve(window.ConectaMediaPipe);
 if(!mediaPipeLoader){
  mediaPipeLoader=new Promise<LocalMediaPipe>((resolve,reject)=>{
   const script=document.createElement('script');
   script.type='module';script.src='/vendor/mediapipe/identity-guide.mjs';
   script.referrerPolicy='no-referrer';script.dataset.conectaMediaPipe='true';
   script.onload=()=>{
    if(window.ConectaMediaPipe)resolve(window.ConectaMediaPipe);
    else reject(new Error('O MediaPipe não foi inicializado.'));
   };
   script.onerror=()=>reject(new Error('O MediaPipe local está indisponível.'));
   document.head.appendChild(script);
  }).catch(error=>{
   mediaPipeLoader=null;
   document.querySelector('script[data-conecta-media-pipe]')?.remove();
   throw error;
  });
 }
 return mediaPipeLoader;
}

const labels:Record<DocumentKind,string>={cin:'CIN (Carteira de Identidade Nacional)', 'old-rg':'RG antigo (frente e verso)',cnh:'CNH com QR Code'};

async function renderCnhPdf(file:File):Promise<{front:File;back:File}>{
  if(file.type!=='application/pdf'||file.size<1||file.size>12*1024*1024)
    throw new Error('O PDF da CNH deve ter até 12 MB.');
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdf.worker.min.mjs';
  const pdfDocument=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
  try{
    if(pdfDocument.numPages<1||pdfDocument.numPages>10)throw new Error('O PDF da CNH precisa ter entre 1 e 10 páginas.');
    const renderPage=async(pageNumber:number)=> {
      const page=await pdfDocument.getPage(pageNumber);
      const base=page.getViewport({scale:1});
      const scale=Math.min(2,1800/Math.max(base.width,base.height));
      const viewport=page.getViewport({scale});
      const canvas=window.document.createElement('canvas');
      canvas.width=Math.max(1,Math.floor(viewport.width));
      canvas.height=Math.max(1,Math.floor(viewport.height));
      const context=canvas.getContext('2d');
      if(!context)throw new Error('Não foi possível converter o PDF da CNH.');
      await page.render({canvas,canvasContext:context,viewport}).promise;
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>
        value?resolve(value):reject(new Error('Não foi possível converter uma página da CNH.')),'image/jpeg',0.9));
      canvas.width=0;canvas.height=0;page.cleanup();
      return new File([blob],file.name.replace(/\.pdf$/i,'')+'-pagina-'+pageNumber+'.jpg',{type:'image/jpeg',lastModified:Date.now()});
    };
    const front=await renderPage(1);
    const back=pdfDocument.numPages>1?await renderPage(2):new File([await front.arrayBuffer()],file.name.replace(/\.pdf$/i,'')+'-verso.jpg',{type:'image/jpeg',lastModified:Date.now()});
    return {front,back};
  }finally{await pdfDocument.destroy();}
}

async function readJsonResponse<T>(response:Response):Promise<T>{
  const body=await response.text();
  try{
    return JSON.parse(body) as T;
  }catch{
    // Platform failures may return plain text/HTML instead of JSON.
    if(!response.ok)throw new Error(`O servidor de validação falhou (HTTP ${response.status}). Tente novamente em alguns minutos.`);
    throw new Error('O servidor de validação retornou uma resposta inválida. Tente novamente.');
  }
}

const MAX_IDENTITY_REQUEST_BYTES=4_000_000; // Vercel Function request-body limit is 4.5 MB including multipart overhead.

async function compressForUpload(file:File,maxDimension=1600,quality=0.86):Promise<File>{
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
      'image/jpeg',quality
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
  const [challengeExpiresAt,setChallengeExpiresAt]=useState(0);
  const [secondsRemaining,setSecondsRemaining]=useState(0);
  const [captureBusy,setCaptureBusy]=useState(false);
  const [mediaPipeStatus,setMediaPipeStatus]=useState<'loading'|'active'|'fallback'>('loading');
  const [faceGuide,setFaceGuide]=useState<FaceGuide>({
    status:'missing',ready:false,message:'Centralize o rosto dentro da moldura.',turnOffset:null
  });
  const [guideStableCount,setGuideStableCount]=useState(0);
  const [instructions,setInstructions]=useState<string[]>([]);
  const [frameIndex,setFrameIndex]=useState(0);
  const [frames,setFrames]=useState<File[]>([]);
  const [message,setMessage]=useState('');
  const [completed,setCompleted]=useState(false);
  const [step,setStep]=useState(1);
  const [error,setError]=useState('');
  const videoRef=useRef<HTMLVideoElement>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const mediaPipeRef=useRef<LocalFaceLandmarker|null>(null);
  const captureBusyRef=useRef(false);
  const cameraSessionRef=useRef(0);

  function stopCamera(){
    cameraSessionRef.current++;
    mediaPipeRef.current?.close();mediaPipeRef.current=null;
    streamRef.current?.getTracks().forEach(track=>track.stop());
    streamRef.current=null;
    if(videoRef.current){videoRef.current.pause();videoRef.current.srcObject=null;}
  }
  useEffect(()=>()=>{mediaPipeRef.current?.close();streamRef.current?.getTracks().forEach(track=>track.stop());},[]);

  function clear(){
    stopCamera();setFront(null);setBack(null);setSelfie(null);setConsent(false);
    setChallenge('');setChallengeExpiresAt(0);setSecondsRemaining(0);
    setInstructions([]);setFrameIndex(0);setFrames([]);
    setMessage('Arquivos removidos desta tela.');setError('');setCompleted(false);setStep(1);
  }

  // Server challenges are single-use and expire after 90s. Track the remaining
  // capture window locally; expiration never changes the server's verdict.
  useEffect(()=>{
    if(!challenge||!challengeExpiresAt)return;
    const tick=()=>{
      // The server may still be processing an already-submitted valid request.
      if(busy)return;
      const seconds=Math.max(0,Math.ceil((challengeExpiresAt-Date.now())/1000));
      setSecondsRemaining(seconds);
      if(seconds===0){
        stopCamera();
        setChallenge('');setChallengeExpiresAt(0);
        setInstructions([]);setFrameIndex(0);setFrames([]);
        setError('O desafio de 90 segundos expirou. Inicie uma nova captura ao vivo.');
        setMessage('');
      }
    };
    tick();
    const timer=window.setInterval(tick,1000);
    return ()=>window.clearInterval(timer);
  },[challenge,challengeExpiresAt,busy]);

  async function startGuidedCapture(){
    if(challengeBusy||busy)return;
    setChallengeBusy(true);setError('');setMessage('Solicitando acesso à câmera…');
    try{
      if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)
        throw new Error('A câmera exige HTTPS e permissão do navegador.');
      // Refresh/validate the browser session before opening the protected challenge.
      // A stale access token otherwise makes the server report a misleading sign-in error.
      const auth=supabaseBrowser();
      let {data:{session}}=await auth.auth.getSession();
      if(!session?.access_token){
        const refreshed=await auth.auth.refreshSession();
        session=refreshed.data.session;
      }
      if(!session?.access_token){
        const checked=await auth.auth.getUser();
        if(!checked.data.user)throw new Error('Sua sessão não está ativa. Entre novamente e tente a captura guiada.');
        const refreshed=await auth.auth.refreshSession();
        session=refreshed.data.session;
      }
      if(!session?.access_token)throw new Error('Não foi possível renovar sua sessão. Atualize a página e entre novamente.');
      const stream=await navigator.mediaDevices.getUserMedia({
        video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false
      });
      streamRef.current=stream;
      const video=videoRef.current;
      if(!video)throw new Error('Prévia da câmera indisponível.');
      video.srcObject=stream;await video.play();
      setMediaPipeStatus('loading');
      try{
        const mp=await loadLocalMediaPipe();
        const vision=await mp.FilesetResolver.forVisionTasks('/vendor/mediapipe/wasm');
        mediaPipeRef.current=await mp.FaceLandmarker.createFromOptions(vision,{
          baseOptions:{modelAssetPath:'/vendor/mediapipe/face_landmarker.task',delegate:'CPU'},
          runningMode:'IMAGE',
          numFaces:2,
          minFaceDetectionConfidence:0.5,
          minFacePresenceConfidence:0.5
        });
        setMediaPipeStatus('active');
      }catch{
        // Client-side MediaPipe guides image quality; it never grants identity.
        // If this optional check fails, server-side Human still gates approval.
        setMediaPipeStatus('fallback');
      }
      const requestChallenge=(accessToken:string)=>fetch('/api/identity/free-document/liveness-challenge',{
        method:'POST',headers:{Authorization:'Bearer '+accessToken},
        credentials:'same-origin',cache:'no-store'
      });
      let response=await requestChallenge(session.access_token);
      if(response.status===401){
        const refreshed=await auth.auth.refreshSession();
        if(refreshed.data.session?.access_token)
          response=await requestChallenge(refreshed.data.session.access_token);
      }
      const data=await readJsonResponse<{challenge?:string;instructions?:string[];error?:string;createdAt?:number;expiresAt?:string}>(response);
      if(!response.ok||!data.challenge||!Array.isArray(data.instructions)||data.instructions.length!==4)
        throw new Error(data.error||(response.status===401?'Sua sessão não foi reconhecida pelo servidor. Saia da conta, entre novamente e tente outra vez.':'Não foi possível iniciar o desafio guiado.'));
      const validFor=Date.parse(data.expiresAt||'')-Number(data.createdAt);
      if(!Number.isFinite(validFor)||validFor<15000||validFor>90000)
        throw new Error('O desafio de câmera chegou com validade inválida. Reinicie a captura.');
      // Use server-provided TTL rather than comparing clocks from different devices.
      const expiresAt=Date.now()+validFor-3000;
      setChallengeExpiresAt(expiresAt);setSecondsRemaining(Math.ceil((expiresAt-Date.now())/1000));
      setChallenge(data.challenge);setInstructions(data.instructions);setFrames([]);setFrameIndex(0);
      setGuideStableCount(0);
      setMessage('Câmera ativa. Os quadros serão capturados automaticamente após posicionamento estável.');
    }catch(err){
      stopCamera();setChallenge('');setChallengeExpiresAt(0);setSecondsRemaining(0);setInstructions([]);
      setError(err instanceof Error?err.message:'Não foi possível iniciar a captura guiada.');
      setMessage('');
    }finally{setChallengeBusy(false);}
  }

  const captureFrame=useCallback(async()=>{
    const video=videoRef.current;
    if(!video||!challenge||!video.videoWidth||!video.videoHeight||frameIndex>=4||
       challengeExpiresAt<=Date.now()||captureBusyRef.current)return;
    captureBusyRef.current=true;
    setCaptureBusy(true);setError('');
    const sessionId=cameraSessionRef.current;
    try{
      if(mediaPipeRef.current){
        const guide=inspectGuidedFace(mediaPipeRef.current.detect(video).faceLandmarks||[],frameIndex);
        setFaceGuide(guide);
        if(!guide.ready)throw new Error(guide.message);
      }
      const canvas=document.createElement('canvas');
      canvas.width=video.videoWidth;canvas.height=video.videoHeight;
      const context=canvas.getContext('2d');
      if(!context)throw new Error('Não foi possível capturar o quadro da câmera.');
      context.drawImage(video,0,0,canvas.width,canvas.height);
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(
        value=>value?resolve(value):reject(new Error('Falha ao capturar imagem da câmera.')),
        'image/jpeg',0.88
      ));
      if(sessionId!==cameraSessionRef.current||challengeExpiresAt<=Date.now())return;
      const file=new File([blob],'liveness-'+frameIndex+'.jpg',{type:'image/jpeg'});
      setFrames(previous=>[...previous,file]);
      setFrameIndex(previous=>previous+1);setGuideStableCount(0);
      setMessage(frameIndex===3?'Captura automática concluída. Envie os documentos para validação no servidor.':'Quadro registrado. Siga a próxima instrução.');
      if(frameIndex===3)stopCamera();
    }catch(err){setError(err instanceof Error?err.message:'Falha na captura.');}
    finally{captureBusyRef.current=false;setCaptureBusy(false);}
  },[challenge,challengeExpiresAt,frameIndex]);

  // MediaPipe continuously checks framing and stability. No blind auto-timer.
  // Only the server can validate identity, head-turn order and anti-spoof.
  useEffect(()=>{
    if(!challenge||frameIndex>=4||!streamRef.current||mediaPipeStatus!=='active')return;
    const video=videoRef.current;
    if(!video)return;
    let cancelled=false,timer:number|undefined;
    let stable=0,firstReadyAt=0,lastSeenAt=0,lastTurn:number|null=null;
    const inspect=()=>{
      if(cancelled)return;
      try{
        if(busy||captureBusyRef.current||challengeExpiresAt<=Date.now()||video.readyState<2)return;
        const engine=mediaPipeRef.current;
        if(!engine)return;
        const guide=inspectGuidedFace(engine.detect(video).faceLandmarks||[],frameIndex);
        setFaceGuide(guide);
        const now=Date.now();
        if(!guide.ready){
          stable=0;firstReadyAt=0;lastTurn=null;setGuideStableCount(0);
          return;
        }
        const moved=(frameIndex===1||frameIndex===2)&&lastTurn!==null&&
          guide.turnOffset!==null&&Math.abs(guide.turnOffset-lastTurn)>0.16;
        if(stable===0||now-lastSeenAt>900||moved){
          stable=1;firstReadyAt=now;
        }else stable++;
        lastSeenAt=now;lastTurn=guide.turnOffset;
        setGuideStableCount(Math.min(stable,3));
        if(stable>=3&&now-firstReadyAt>=650){
          stable=0;setGuideStableCount(0);
          void captureFrame();
        }
      }catch{
        stable=0;firstReadyAt=0;lastTurn=null;setGuideStableCount(0);
        setFaceGuide({status:'incomplete',ready:false,
          message:'Não foi possível analisar o rosto. Ajuste a iluminação ou capture manualmente.',turnOffset:null});
      }finally{
        if(!cancelled)timer=window.setTimeout(inspect,360);
      }
    };
    timer=window.setTimeout(inspect,250);
    return ()=>{cancelled=true;if(timer!==undefined)window.clearTimeout(timer);};
  },[challenge,frameIndex,captureFrame,busy,challengeExpiresAt,mediaPipeStatus]);

  async function submit(){
    if(!front||!back||!selfie||!consent){
      setError('Envie frente, verso e selfie, e marque o consentimento.');return;
    }
    if(!challenge||frames.length!==4){
      setError('Conclua os quatro quadros da captura guiada antes de enviar.');return;
    }
    if(challengeExpiresAt<=Date.now()+5000){
      stopCamera();setChallenge('');setChallengeExpiresAt(0);
      setInstructions([]);setFrameIndex(0);setFrames([]);setStep(3);
      setError('O desafio expirou ou está próximo de expirar. Refaça a captura ao vivo antes de validar.');return;
    }
    setBusy(true);setError('');setMessage('Preparando o envio seguro para validação…');
    try{
      const auth=supabaseBrowser();
      let {data:{session}}=await auth.auth.getSession();
      if(!session?.access_token){
        const refreshed=await auth.auth.refreshSession();
        session=refreshed.data.session;
      }
      if(!session?.access_token)throw new Error('Sua sessão expirou. Entre novamente antes de validar a identidade.');
      // Keep uploads below Vercel's 4.5 MB body limit without storing images.
      // Retain full document detail when possible for OCR, and reduce JPEG
      // quality before reducing resolution.
      const originals=[front,back,selfie];
      const frameBytes=frames.reduce((total,frame)=>total+frame.size,0);
      let images:File[]=[];
      for(const [size,quality] of [[1600,0.86],[1600,0.76],[1400,0.78],[1200,0.74]]){
        images=await Promise.all(originals.map(file=>compressForUpload(file,size,quality)));
        const estimatedBytes=images.reduce((total,file)=>total+file.size,frameBytes)+32_768;
        if(estimatedBytes<=MAX_IDENTITY_REQUEST_BYTES)break;
      }
      if(images.reduce((total,file)=>total+file.size,frameBytes)+32_768>MAX_IDENTITY_REQUEST_BYTES)
        throw new Error('As fotos ultrapassam o limite de envio seguro (4 MB). Use imagens mais leves, bem enquadradas e nítidas, e tente novamente.');
      const [optimizedFront,optimizedBack,optimizedSelfie]=images;
      const form=new FormData();
      form.set('documentType',documentType);form.set('documentFront',optimizedFront);form.set('documentBack',optimizedBack);
      form.set('selfie',optimizedSelfie);form.set('consent','true');form.set('livenessChallenge',challenge);
      frames.forEach((frame,index)=>form.set('livenessFrame'+index,frame));
      setMessage('Validando documento, rosto e captura ao vivo no servidor…');
      const requestVerification=(accessToken:string)=>fetch('/api/identity/free-document/verify',{
        method:'POST',headers:{Authorization:'Bearer '+accessToken},credentials:'same-origin',body:form,cache:'no-store'
      });
      let response=await requestVerification(session.access_token);
      if(response.status===401){
        const refreshed=await auth.auth.refreshSession();
        if(refreshed.data.session?.access_token)
          response=await requestVerification(refreshed.data.session.access_token);
      }
      const data=await readJsonResponse<{ok?:boolean;approved?:boolean;message?:string;error?:string;code?:string}>(response);
      if(!response.ok||data.ok!==true){
        const message=data.message||data.error||'A validação não foi concluída.';
        throw new Error(data.code?message+' (código: '+data.code+')':message);
      }
      setCompleted(data.approved===true);setStep(5);setMessage(data.message||'Validação concluída.');
      setFront(null);setBack(null);setSelfie(null);setFrames([]);setChallenge('');setChallengeExpiresAt(0);setInstructions([]);
      await onComplete();
    }catch(err){
      // The server consumes a challenge on the first well-formed submission.
      // Never silently re-send the same liveness frames after a failed attempt.
      setChallenge('');setInstructions([]);setFrameIndex(0);setFrames([]);setStep(3);
      setChallengeExpiresAt(0);setSecondsRemaining(0);
      setError((err instanceof Error?err.message:'Não foi possível concluir a validação.')+
        ' Para uma nova tentativa, inicie outra captura guiada.');setMessage('');
    }finally{stopCamera();setBusy(false);}
  }

  const steps=[
    {number:1,label:'Documento',done:Boolean(front&&back)},
    {number:2,label:'Rosto',done:Boolean(selfie)},
    {number:3,label:'Captura ao vivo',done:frames.length===4},
    {number:4,label:'Validar',done:completed}
  ];
  const canContinue=step===1?Boolean(front&&back):step===2?Boolean(selfie&&consent):step===3?Boolean(challenge&&frames.length===4&&secondsRemaining>5):true;
  const guideColor=mediaPipeStatus!=='active'?'#60a5fa':faceGuide.ready?'#34d399':'#fbbf24';

  return <div style={{marginTop:20}}>
    <div className="feed-title">
      <h2><ShieldCheck size={21} style={{verticalAlign:'middle'}}/> Validação gratuita de identidade e rosto</h2>
      <span className="small-note">Sem fornecedor pago</span>
    </div>
    <p>Documento selecionado: <strong>{labels[documentType]}</strong>. Para RG antigo, o Conecta usa OCR da frente e do verso, comparação facial com a selfie e captura guiada, sem exigir leitura de QR Code. CIN e CNH continuam exigindo QR Code. As imagens são processadas temporariamente e não são armazenadas. Esta validação própria não equivale à confirmação oficial do emissor.</p>
    <div aria-label="Etapas da validação" style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:6,margin:'16px 0 20px'}}>
      {steps.map(item=><div key={item.number} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,textAlign:'center',padding:'9px 4px',borderRadius:12,border:'1px solid var(--border,#dedee7)',background:step===item.number?'var(--surface,#fff)':item.done?'var(--surface-success,rgba(34,197,94,.08))':'transparent',boxShadow:step===item.number?'0 0 0 2px var(--accent,#6d5dfc)':'none',minWidth:0}}>
        <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:28,height:28,borderRadius:99,fontWeight:700,background:item.done?'var(--success,#16a34a)':'var(--muted-surface,#f1f1f5)',color:item.done?'white':'inherit'}}>{item.done?'✓':item.number}</span>
        <span style={{fontSize:12,fontWeight:600,lineHeight:1.25}}>{item.label}</span>
      </div>)}
    </div>
    {step===1&&<section className="panel" aria-labelledby="identity-step-document">
      <h3 id="identity-step-document">1. Envie seu documento</h3>
      <p className="small-note">Selecione imagens do armazenamento, tire fotos com a câmera do dispositivo ou anexe arquivos compatíveis. Para CNH, também pode selecionar o PDF digital; ele será convertido em imagens temporárias no navegador. Envie frente e verso legíveis. No RG antigo, não é necessário enviar as partes internas nem localizar QR Codes.</p>
      <div style={{display:'grid',gap:14}}>
        <label className="form-label">Frente do documento com foto
          <input type="file" capture="environment" accept={documentType==='cnh'?'image/jpeg,image/png,image/webp,application/pdf':'image/jpeg,image/png,image/webp'} disabled={busy||challengeBusy} onChange={async e=>{
            const file=e.target.files?.[0]||null;
            if(!file){setFront(null);return;}
            setError('');
            try{
              if(file.type==='application/pdf'){
                if(documentType!=='cnh')throw new Error('PDF é aceito somente para CNH. Para RG/CIN, envie imagens da frente e do verso.');
                setMessage('Convertendo o PDF da CNH para imagens temporárias…');
                const pages=await renderCnhPdf(file);setFront(pages.front);setBack(pages.back);
                setMessage('PDF da CNH convertido. Confira se as páginas exibem todos os dados e, para CNH, o QR Code.');
              }else{setFront(file);setBack(null);setMessage('');}
            }catch(err){setFront(null);setError(err instanceof Error?err.message:'Não foi possível abrir o arquivo.');setMessage('');}
          }}/>
          <span className="small-note">{front?front.name:(documentType==='cnh'?'JPG, PNG ou WebP · até 8 MB · PDF da CNH até 12 MB':'JPG, PNG ou WebP · até 8 MB')}</span>
        </label>
        <label className="form-label">Verso do documento
          <input type="file" capture="environment" accept="image/jpeg,image/png,image/webp" disabled={busy||challengeBusy} onChange={e=>setBack(e.target.files?.[0]||null)}/>
          <span className="small-note">{back?back.name:'Envie o verso com todas as informações legíveis. Para CIN e CNH, o QR Code deve estar na frente ou no verso; para RG antigo, não é exigido.'}</span>
        </label>
        </div>
      <label className="human-agree" style={{marginTop:16}}>
        <input type="checkbox" checked={consent} disabled={busy||challengeBusy} onChange={e=>setConsent(e.target.checked)}/>
        Autorizo o processamento temporário das imagens enviadas, para OCR, comparação facial e captura guiada; a leitura de QR é exigida somente para CIN e CNH. Não autorizo armazenamento nem uso para publicidade. Entendo que não há consulta automática a uma base oficial.
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
      <p className="small-note">Posicione seu rosto na moldura e siga as quatro orientações. O MediaPipe acompanha o enquadramento e captura cada quadro automaticamente quando a posição estiver estável. Esquerda e direita indicam os lados do seu próprio corpo, mesmo com a prévia espelhada.</p>
      {challenge&&<p className="small-note" role="status">{mediaPipeStatus==='active'?
        'MediaPipe ativo: enquadramento e posição do rosto são conferidos no aparelho. O Human valida no servidor.':
        mediaPipeStatus==='fallback'?'Orientação MediaPipe indisponível neste dispositivo. A validação obrigatória pelo Human permanece ativa.':
        'Inicializando análise de posição facial…'}</p>}
      {challenge&&<p role="timer" aria-live="off" className="small-note"><strong>Tempo restante: {secondsRemaining}s</strong>. Envie a validação antes de terminar o prazo de 90 segundos.</p>}
      {/* Visual guidance is never burned into the biometric frames. */}
      <div style={{position:'relative',display:challenge?'block':'none',width:'100%',maxWidth:480,
        aspectRatio:'4 / 3',overflow:'hidden',borderRadius:18,background:'#101625',
        border:'1px solid rgba(148,163,184,.5)'}}>
        <video ref={videoRef} autoPlay muted playsInline aria-label="Prévia da câmera para captura guiada"
          style={{width:'100%',height:'100%',objectFit:'cover',transform:'scaleX(-1)',display:'block'}}/>
        <div aria-hidden="true" data-testid="conecta-face-guide-frame" style={{
          position:'absolute',left:'22%',top:'8%',width:'56%',height:'82%',
          border:'3px solid '+guideColor,borderRadius:'48% / 48%',
          boxShadow:'0 0 0 100vmax rgba(8,15,30,.17), 0 0 24px '+guideColor,
          transition:'border-color 180ms ease, box-shadow 180ms ease',pointerEvents:'none'
        }}/>
        <div aria-hidden="true" style={{position:'absolute',top:10,left:10,right:10,display:'flex',
          justifyContent:'space-between',alignItems:'center',gap:8,color:'white',pointerEvents:'none',
          fontSize:12,fontWeight:700,textShadow:'0 1px 4px rgba(0,0,0,.85)'}}>
          <span style={{background:'rgba(3,10,24,.65)',padding:'5px 9px',borderRadius:20}}>
            Etapa {Math.min(frameIndex+1,4)}/4
          </span>
          <span style={{background:'rgba(3,10,24,.65)',padding:'5px 9px',borderRadius:20}}>
            {mediaPipeStatus==='active'?faceGuide.ready?'● Bem enquadrado':'● Ajustar posição':'● Câmera ativa'}
          </span>
        </div>
        <div aria-hidden="true" style={{position:'absolute',left:12,right:12,bottom:12,
          background:'rgba(3,10,24,.78)',borderRadius:12,padding:'9px 11px',
          color:'white',fontSize:13,textAlign:'center',pointerEvents:'none'}}>
          {mediaPipeStatus==='active'?faceGuide.message:
            mediaPipeStatus==='loading'?'Inicializando reconhecimento do rosto…':
            'MediaPipe indisponível: use a captura manual.'}
          {mediaPipeStatus==='active'&&faceGuide.ready&&
            <div style={{height:4,marginTop:7,background:'rgba(255,255,255,.3)',
              borderRadius:4,overflow:'hidden'}}>
              <div style={{height:'100%',width:(guideStableCount/3*100)+'%',background:'#34d399',
                transition:'width 200ms ease'}}/>
            </div>}
        </div>
      </div>
      {challenge&&<p role="status" aria-live="polite" style={{
        fontSize:13,marginTop:8,color:faceGuide.ready?'#059669':'inherit'
      }}>{mediaPipeStatus==='active'?faceGuide.message:
        mediaPipeStatus==='fallback'?'Não foi possível iniciar o enquadramento automático; use Capturar agora.':
        'Preparando enquadramento automático…'}</p>
      {!challenge?<button type="button" className="btn btn-outline" onClick={()=>void startGuidedCapture()} disabled={busy||challengeBusy}>
        <Camera size={17}/>{challengeBusy?'Preparando câmera…':'Iniciar captura guiada'}</button>:
        <div>
          <p><strong>Etapa {Math.min(frameIndex+1,4)} de 4:</strong> {instructions[frameIndex]||'Captura concluída.'}</p>
          <progress value={frames.length} max={4} aria-label="Quadros capturados" style={{width:'100%',height:10,accentColor:'var(--accent,#6d5dfc)'}}/>
          <p className="small-note">Quadros capturados: {frames.length}/4</p>
          {frameIndex<4&&<button type="button" className="btn btn-outline" onClick={()=>void captureFrame()} disabled={busy||captureBusy||secondsRemaining===0}>
            <Camera size={17}/> Capturar agora (opcional)</button>}
          <button type="button" className="btn btn-outline" style={{marginLeft:8}} onClick={()=>{stopCamera();setChallenge('');setChallengeExpiresAt(0);setInstructions([]);setFrames([]);setFrameIndex(0);setMessage('Captura cancelada.');}} disabled={busy}>
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
      <button type="button" className="btn btn-primary" onClick={()=>void submit()} disabled={busy||challengeBusy||!front||!back||!selfie||!consent||!challenge||frames.length!==4||secondsRemaining<=5}>
        <ShieldCheck size={17}/>{busy?'Validando no servidor…':'Validar minha identidade'}</button>
    </section>}
    {step===5&&<section className="panel" aria-live="polite">
      <h3>{completed?'Validação concluída':'Resultado da validação'}</h3>
      <p className={completed?'form-success':'small-note'}>{message||'O resultado foi atualizado.'}</p>
      <button type="button" className="btn btn-outline" onClick={clear}><Trash2 size={16}/> Iniciar novamente</button>
    </section>}
    {step<4&&<div className="row" style={{gap:10,flexWrap:'wrap',marginTop:16}}>
      {step>1&&<button type="button" className="btn btn-outline" onClick={()=>{if(step===3){stopCamera();setChallenge('');setChallengeExpiresAt(0);setInstructions([]);setFrames([]);setFrameIndex(0);}setStep(step-1);}} disabled={busy||challengeBusy}>Voltar</button>}
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
