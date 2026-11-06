'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {Camera,CameraOff,ShieldCheck} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';
import {inspectGuidedFace} from '@/lib/identity-frame-guidance';
import type {FaceGuide} from '@/lib/identity-frame-guidance';

type FacePoint={x:number;y:number;z:number};
type FaceLandmarker={detect:(video:HTMLVideoElement)=>{faceLandmarks?:FacePoint[][]};close:()=>void};
type MediaPipeLibrary={
  FaceLandmarker:{createFromOptions:(resolver:unknown,settings:Record<string,unknown>)=>Promise<FaceLandmarker>};
  FilesetResolver:{forVisionTasks:(url:string)=>Promise<unknown>};
};
type Props={onComplete:()=>Promise<void>|void;onNeedsDocument:()=>void};

async function loadFaceGuide():Promise<MediaPipeLibrary>{
  const scope=window as Window & {ConectaMediaPipe?:MediaPipeLibrary};
  if(scope.ConectaMediaPipe)return scope.ConectaMediaPipe;
  await new Promise<void>((resolve,reject)=>{
    const script=document.createElement('script');
    script.type='module';script.src='/vendor/mediapipe/identity-guide.mjs';
    script.onload=()=>resolve();
    script.onerror=()=>reject(new Error('O guia facial não pôde ser inicializado.'));
    document.head.appendChild(script);
  });
  if(!scope.ConectaMediaPipe)throw new Error('O guia facial está indisponível.');
  return scope.ConectaMediaPipe;
}
async function getAccessToken():Promise<string>{
  const auth=supabaseBrowser();
  let {data:{session}}=await auth.auth.getSession();
  if(!session?.access_token)session=(await auth.auth.refreshSession()).data.session;
  if(!session?.access_token)throw new Error('Sua sessão expirou. Entre novamente.');
  return session.access_token;
}
async function readResult(response:Response):Promise<Record<string,unknown>>{
  try{return await response.json() as Record<string,unknown>;}
  catch{throw new Error('O serviço de verificação não retornou uma resposta válida (HTTP '+response.status+').');}
}

export function SelfieAgeVerification({onComplete,onNeedsDocument}:Props){
  const videoRef=useRef<HTMLVideoElement>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const guideRef=useRef<FaceLandmarker|null>(null);
  const captureBusyRef=useRef(false);
  const sessionRef=useRef(0);
  const [cameraOpen,setCameraOpen]=useState(false);
  const [consent,setConsent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [challengeBusy,setChallengeBusy]=useState(false);
  const [challenge,setChallenge]=useState('');
  const [expiresAt,setExpiresAt]=useState(0);
  const [secondsRemaining,setSecondsRemaining]=useState(0);
  const [instructions,setInstructions]=useState<string[]>([]);
  const [turnOrder,setTurnOrder]=useState<Array<'left'|'right'>>([]);
  const [frames,setFrames]=useState<File[]>([]);
  const [frameIndex,setFrameIndex]=useState(0);
  const [guideStatus,setGuideStatus]=useState<'loading'|'active'|'fallback'>('loading');
  const [faceGuide,setFaceGuide]=useState<FaceGuide>({
    status:'missing',ready:false,message:'Centralize o rosto na câmera.',turnOffset:null
  });
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [completed,setCompleted]=useState(false);
  const [documentRequired,setDocumentRequired]=useState(false);
  const [stableCount,setStableCount]=useState(0);

  const stopCamera=useCallback(()=>{
    sessionRef.current+=1;
    guideRef.current?.close();guideRef.current=null;
    streamRef.current?.getTracks().forEach(track=>track.stop());
    streamRef.current=null;
    if(videoRef.current){videoRef.current.pause();videoRef.current.srcObject=null;}
    setCameraOpen(false);
  },[]);
  useEffect(()=>()=>{guideRef.current?.close();streamRef.current?.getTracks().forEach(track=>track.stop());},[]);

  useEffect(()=>{
    if(!challenge||!expiresAt||busy)return;
    const tick=()=>{
      const seconds=Math.max(0,Math.ceil((expiresAt-Date.now())/1000));
      setSecondsRemaining(seconds);
      if(seconds===0){
        stopCamera();setChallenge('');setFrames([]);setFrameIndex(0);
        setError('O desafio expirou. Inicie uma nova captura.');
      }
    };
    tick();
    const timer=window.setInterval(tick,1000);
    return ()=>window.clearInterval(timer);
  },[challenge,expiresAt,busy,stopCamera]);

  const start=async()=>{
    if(!consent){setError('Marque o consentimento antes de abrir a câmera.');return;}
    if(challengeBusy||busy)return;
    setChallengeBusy(true);setDocumentRequired(false);setCompleted(false);
    setError('');setMessage('Preparando a câmera e o desafio seguro…');
    stopCamera();setChallenge('');setFrames([]);setFrameIndex(0);
    try{
      if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)
        throw new Error('A captura requer HTTPS e permissão para usar a câmera.');
      const token=await getAccessToken();
      const stream=await navigator.mediaDevices.getUserMedia({
        video:{facingMode:'user',width:{ideal:720},height:{ideal:960}},audio:false
      });
      streamRef.current=stream;
      setCameraOpen(true);
      const video=videoRef.current;
      if(!video)throw new Error('Não foi possível abrir a prévia da câmera.');
      video.srcObject=stream;
      await video.play();
      setGuideStatus('loading');
      try{
        const mp=await loadFaceGuide();
        const vision=await mp.FilesetResolver.forVisionTasks('/vendor/mediapipe/wasm');
        guideRef.current=await mp.FaceLandmarker.createFromOptions(vision,{
          baseOptions:{modelAssetPath:'/vendor/mediapipe/face_landmarker.task',delegate:'CPU'},
          runningMode:'IMAGE',numFaces:2,minFaceDetectionConfidence:0.5,minFacePresenceConfidence:0.5
        });
        setGuideStatus('active');
      }catch{
        // Guidance is optional; independent server anti-spoof and pose checks
        // remain mandatory even if the local MediaPipe module cannot load.
        setGuideStatus('fallback');
      }
      const request=async(t:string)=>fetch('/api/identity/free-document/liveness-challenge',{
        method:'POST',headers:{Authorization:'Bearer '+t},credentials:'same-origin',cache:'no-store'
      });
      let response=await request(token);
      if(response.status===401)response=await request(await getAccessToken());
      const data=await readResult(response);
      if(!response.ok||typeof data.challenge!=='string'||
         !Array.isArray(data.instructions)||data.instructions.length!==4)
        throw new Error(String(data.error||'O desafio de câmera não foi autorizado.'));
      const ttl=Date.parse(String(data.expiresAt))-Number(data.createdAt);
      if(!Number.isFinite(ttl)||ttl<15000||ttl>90000)
        throw new Error('O desafio retornou prazo inválido.');
      setExpiresAt(Date.now()+ttl-3000);
      setSecondsRemaining(Math.ceil((ttl-3000)/1000));
      setInstructions(data.instructions.map(String));
      setTurnOrder(Array.isArray(data.turnOrder)?data.turnOrder as Array<'left'|'right'>:[]);
      setChallenge(data.challenge);
      setMessage('Siga as instruções. Cada posição será capturada automaticamente quando estiver estável.');
    }catch(err){
      stopCamera();setChallenge('');setMessage('');
      setError(err instanceof Error?err.message:'A câmera não pôde ser iniciada.');
    }finally{setChallengeBusy(false);}
  };

  const captureFrame=useCallback(async()=>{
    const video=videoRef.current;
    if(!video||!challenge||!video.videoWidth||!video.videoHeight||
       frameIndex>=4||expiresAt<=Date.now()||captureBusyRef.current)return;
    captureBusyRef.current=true;
    const sessionId=sessionRef.current;
    try{
      if(guideRef.current){
        const guide=inspectGuidedFace(guideRef.current.detect(video).faceLandmarks||[],frameIndex,turnOrder);
        setFaceGuide(guide);
        if(!guide.ready)throw new Error(guide.message);
      }
      const canvas=document.createElement('canvas');
      const scale=Math.min(1,960/Math.max(video.videoWidth,video.videoHeight));
      canvas.width=Math.max(1,Math.round(video.videoWidth*scale));
      canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
      const ctx=canvas.getContext('2d');
      if(!ctx)throw new Error('Falha ao obter a imagem da câmera.');
      ctx.drawImage(video,0,0,canvas.width,canvas.height);
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(
        value=>value?resolve(value):reject(new Error('Falha na captura da imagem.')),'image/jpeg',0.8
      ));
      canvas.width=0;canvas.height=0;
      if(sessionId!==sessionRef.current||expiresAt<=Date.now())return;
      setFrames(previous=>[...previous,new File([blob],'quadro-'+frameIndex+'.jpg',{type:'image/jpeg'})]);
      setFrameIndex(previous=>previous+1);setStableCount(0);setError('');
      if(frameIndex===3){
        stopCamera();setMessage('Captura concluída. Confirme o envio para estimar a maioridade.');
      }
    }catch(err){setError(err instanceof Error?err.message:'Falha ao capturar a imagem.');}
    finally{captureBusyRef.current=false;}
  },[challenge,frameIndex,expiresAt,turnOrder,stopCamera]);

  useEffect(()=>{
    if(!challenge||frameIndex>=4||guideStatus!=='active'||!cameraOpen)return;
    let cancelled=false,timer:number|undefined;
    let stable=0,firstReady=0,lastSeen=0,lastTurn:number|null=null;
    const inspect=()=>{
      if(cancelled)return;
      try{
        const video=videoRef.current,engine=guideRef.current;
        if(!video||!engine||!video.videoWidth||captureBusyRef.current||expiresAt<=Date.now())return;
        const guide=inspectGuidedFace(engine.detect(video).faceLandmarks||[],frameIndex,turnOrder);
        setFaceGuide(guide);
        const now=Date.now();
        if(!guide.ready){stable=0;firstReady=0;lastTurn=null;setStableCount(0);return;}
        const moved=(frameIndex===1||frameIndex===2)&&lastTurn!==null&&
          guide.turnOffset!==null&&Math.abs(guide.turnOffset-lastTurn)>0.16;
        if(stable===0||now-lastSeen>900||moved){stable=1;firstReady=now;}
        else stable++;
        lastSeen=now;lastTurn=guide.turnOffset;setStableCount(Math.min(6,stable));
        if(stable>=6&&now-firstReady>=2200){stable=0;void captureFrame();}
      }catch{setGuideStatus('fallback');}
      finally{if(!cancelled)timer=window.setTimeout(inspect,360);}
    };
    timer=window.setTimeout(inspect,300);
    return ()=>{cancelled=true;if(timer!==undefined)window.clearTimeout(timer);};
  },[challenge,frameIndex,guideStatus,cameraOpen,expiresAt,turnOrder,captureFrame]);

  const submit=async()=>{
    if(busy||frames.length!==4||!challenge||!consent)return;
    if(expiresAt<=Date.now()+5000){
      setError('O desafio expirou. Refaça a captura.');setChallenge('');setFrames([]);return;
    }
    const submittedFrames=frames;
    setBusy(true);setError('');setMessage('Verificando prova de vida e maioridade no servidor…');
    try{
      const total=submittedFrames.reduce((sum,frame)=>sum+frame.size,0)+16384;
      if(total>4_000_000)throw new Error('As imagens excederam 4 MB. Refaça a captura com resolução menor.');
      const form=new FormData();
      form.set('consent','true');form.set('livenessChallenge',challenge);
      submittedFrames.forEach((frame,i)=>form.set('livenessFrame'+i,frame));
      const request=async(token:string)=>fetch('/api/identity/free-document/verify',{
        method:'POST',headers:{Authorization:'Bearer '+token,'x-conecta-verification-flow':'selfie_age'},
        body:form,credentials:'same-origin',cache:'no-store'
      });
      let response=await request(await getAccessToken());
      if(response.status===401)response=await request(await getAccessToken());
      const data=await readResult(response);
      if(!response.ok||data.ok!==true){
        if(data.code==='age_estimate_inconclusive')setDocumentRequired(true);
        throw new Error(String(data.message||data.error||'A verificação ficou inconclusiva.'));
      }
      setCompleted(true);
      setMessage(String(data.message||'Maioridade estimada pelo servidor.'));
      await onComplete();
    }catch(err){
      setError(err instanceof Error?err.message:'Não foi possível concluir a verificação.');
      setMessage('');
    }finally{
      stopCamera();setChallenge('');setFrames([]);setFrameIndex(0);setBusy(false);
    }
  };

  return <div className="panel" aria-busy={busy} style={{marginTop:16}}>
    <h3><ShieldCheck size={20} style={{verticalAlign:'middle'}}/> Maioridade por selfie em tempo real</h3>
    <p>Sem enviar documentos na primeira tentativa. A câmera solicita quatro posições e o servidor realiza a análise antifraude, a prova de vida e a estimativa de maioridade. Não confirma a identidade nem a data de nascimento.</p>
    <label className="human-agree">
      <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} disabled={busy||challengeBusy}/>
      Autorizo o processamento temporário dos quadros da câmera exclusivamente para verificação etária. Nenhuma selfie ou biometria será armazenada ou usada para publicidade.
    </label>
    {!challenge&&!completed&&<button className="btn btn-primary" type="button" disabled={!consent||challengeBusy||busy} onClick={()=>void start()}>
      <Camera size={17}/>{challengeBusy?'Preparando…':'Iniciar selfie ao vivo'}
    </button>}
    <div style={{display:cameraOpen?'block':'none',position:'relative',margin:'14px auto',maxWidth:460,aspectRatio:'3 / 4',borderRadius:18,overflow:'hidden',background:'#0b1220'}}>
      <video ref={videoRef} autoPlay muted playsInline aria-label="Prévia da câmera de selfie" style={{width:'100%',height:'100%',objectFit:'cover',transform:'scaleX(-1)'}}/>
      <div aria-hidden="true" style={{
        position:'absolute',left:'12%',top:'9%',width:'76%',height:'78%',borderRadius:'48%',
        border:'3px solid '+(faceGuide.ready?'#34d399':'#fbbf24'),pointerEvents:'none'
      }}/>
      <div style={{position:'absolute',bottom:10,left:10,right:10,background:'rgba(0,0,0,.72)',padding:12,borderRadius:12,color:'#fff',textAlign:'center',fontWeight:700}}>
        {guideStatus==='active'?faceGuide.message:guideStatus==='loading'?'Inicializando reconhecimento facial…':'Siga as orientações e capture manualmente.'}
        {guideStatus==='active'&&faceGuide.ready&&<progress value={stableCount} max={6} style={{width:'100%',display:'block',marginTop:8}}/>}
      </div>
    </div>
    {challenge&&<div style={{display:'grid',gap:9}}>
      <p role="timer">Tempo restante: <strong>{secondsRemaining}s</strong></p>
      <p><strong>Etapa {Math.min(frameIndex+1,4)} de 4:</strong> {instructions[frameIndex]||'Captura concluída.'}</p>
      <progress value={frames.length} max={4} aria-label="Quadros da selfie capturados" style={{width:'100%'}}/>
      {frameIndex<4?
        <button type="button" className="btn btn-outline" disabled={busy||secondsRemaining<=0} onClick={()=>void captureFrame()}><Camera size={17}/> Capturar agora</button>:
        <button type="button" className="btn btn-primary" disabled={busy||secondsRemaining<=5} onClick={()=>void submit()}><ShieldCheck size={17}/>{busy?'Validando…':'Confirmar maioridade'}</button>}
      <button type="button" className="btn btn-outline" disabled={busy} onClick={()=>{stopCamera();setChallenge('');setFrames([]);setFrameIndex(0);}}>
        <CameraOff size={17}/> Cancelar captura
      </button>
    </div>}
    {busy&&<p role="status">Processando os quadros com segurança. A decisão será registrada apenas se os critérios do servidor forem atendidos.</p>}
    {completed&&<p className="form-success" role="status">{message}</p>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    {documentRequired&&<button type="button" className="btn btn-primary" onClick={onNeedsDocument}>Continuar com documento</button>}
    <p className="small-note">A estimativa facial pode errar, especialmente perto dos 18 anos. Resultado inconclusivo não é reprovação nem classificação como menor. Recursos que exigem confirmação de identidade continuam protegidos.</p>
  </div>;
}
