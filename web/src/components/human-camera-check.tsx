'use client';
import {useEffect,useRef,useState} from 'react';
import {Camera,CameraOff,ShieldAlert,ScanFace} from 'lucide-react';
import {advanceChallenge,challengePrompt,createChallenge,currentChallenge} from '@/lib/liveness-challenge';
import type {ChallengeState,FaceFrame} from '@/lib/liveness-challenge';

type HumanDetection={face?:Array<{live?:number;real?:number;faceScore?:number;boxScore?:number;rotation?:{angle?:{yaw?:number}}|null}>;gesture?:Array<{gesture?:string}>|Record<string,{gesture?:string}>};
type HumanInstance={load:()=>Promise<unknown>;detect:(input:HTMLVideoElement)=>Promise<HumanDetection>};
type HumanConstructor=new(config:Record<string,unknown>)=>HumanInstance;

declare global {
  interface Window {
    Human?:{Human?:HumanConstructor};
  }
}

let humanConstructorPromise:Promise<HumanConstructor>|null=null;

/**
 * Load the Human IIFE browser distribution from our own origin.
 * Next.js must NOT bundle or runtime-import Human's Node-targeted package.
 * The file is copied from the pinned npm package by scripts/prepare-human.cjs
 * as part of the build, so no third-party JavaScript URL is executed.
 */
function loadBrowserHuman():Promise<HumanConstructor>{
  if(typeof window==='undefined')return Promise.reject(new Error('Câmera disponível somente no navegador.'));
  const ready=window.Human?.Human;
  if(ready)return Promise.resolve(ready);
  if(!humanConstructorPromise){
    humanConstructorPromise=new Promise<HumanConstructor>((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='/vendor/human.js';
      script.async=true;
      script.referrerPolicy='no-referrer';
      script.dataset.conectaHuman='true';
      script.onload=()=>{
        if(window.Human?.Human)resolve(window.Human.Human);
        else reject(new Error('A biblioteca Human foi carregada, mas não inicializou.'));
      };
      script.onerror=()=>reject(new Error('Não foi possível carregar o Human local. Atualize a página e tente novamente.'));
      document.head.appendChild(script);
    }).catch(error=>{
      humanConstructorPromise=null;
      document.querySelector('script[data-conecta-human]')?.remove();
      throw error;
    });
  }
  return humanConstructorPromise;
}


export function HumanCameraCheck(){
  const videoRef=useRef<HTMLVideoElement>(null);
  const mediaRef=useRef<MediaStream|null>(null);
  const currentRun=useRef(0);
  const [agreed,setAgreed]=useState(false);
  const [active,setActive]=useState(false);
  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState('A câmera só será ligada após sua autorização.');
  const [faceCount,setFaceCount]=useState(0);
  const [frameCount,setFrameCount]=useState(0);
  const [liveScore,setLiveScore]=useState<number|null>(null);
  const [spoofScore,setSpoofScore]=useState<number|null>(null);
  const [progress,setProgress]=useState<ChallengeState|null>(null);
  const [outcome,setOutcome]=useState<'idle'|'completed'|'inconclusive'>('idle');

  function stop(){
    currentRun.current++;
    mediaRef.current?.getTracks().forEach(track=>track.stop());
    mediaRef.current=null;
    if(videoRef.current){videoRef.current.pause();videoRef.current.srcObject=null;}
    setActive(false);setBusy(false);
  }
  useEffect(()=>()=>{currentRun.current++;mediaRef.current?.getTracks().forEach(track=>track.stop());},[]);

  async function start(){
    if(!agreed||busy||active)return;
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){
      setFeedback('Câmera indisponível: abra o Conecta em HTTPS e autorize o acesso à câmera.');
      return;
    }
    setBusy(true);setOutcome('idle');setProgress(null);
    setFrameCount(0);setFaceCount(0);setLiveScore(null);setSpoofScore(null);
    setFeedback('Solicitando acesso à câmera frontal…');
    const run=++currentRun.current;
    try{
      // Show live preview immediately, before downloading/loading the AI models.
      const stream=await navigator.mediaDevices.getUserMedia({
        video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},
        audio:false
      });
      if(run!==currentRun.current){stream.getTracks().forEach(t=>t.stop());return;}
      mediaRef.current=stream;
      const video=videoRef.current;
      if(!video)throw new Error('Prévia da câmera indisponível.');
      video.srcObject=stream;
      await video.play();
      if(run!==currentRun.current)return;
      setActive(true);
      setFeedback('Câmera ativa. Carregando o detector Human no dispositivo…');
      const Human=await loadBrowserHuman();
      if(run!==currentRun.current)return;
      const human=new Human({
        backend:'webgl',
        modelBasePath:'https://vladmandic.github.io/human-models/models/',
        cacheSensitivity:0.01,
        debug:false,
        face:{
          enabled:true,
          detector:{rotation:true,return:false},
          mesh:{enabled:true},
          iris:{enabled:true},
          description:{enabled:false},
          antispoof:{enabled:true},
          liveness:{enabled:true},
          emotion:{enabled:false}
        },
        body:{enabled:false},hand:{enabled:false},object:{enabled:false},
        gesture:{enabled:true}
      });
      await human.load();
      if(run!==currentRun.current)return;
      setBusy(false);
      if(!video.videoWidth||!video.videoHeight){
        throw new Error('Vídeo ainda não está pronto. Autorize a câmera e tente novamente.');
      }
      let state=createChallenge(Date.now());
      setProgress(state);
      setFeedback(challengePrompt(currentChallenge(state)));
      let cycles=0;
      while(run===currentRun.current&&stream.active){
        if(video.paused||video.readyState<2){
          await new Promise<void>(resolve=>setTimeout(resolve,100));
          continue;
        }
        // Only transient webcam inference. Never capture, persist or upload biometrics.
        const detection=await human.detect(video);
        if(run!==currentRun.current)break;
        const faces=detection.face||[];
        const face=faces[0];
        const entries=detection.gesture||[];
        const gestures=(Array.isArray(entries)?entries:Object.values(entries)).map(g=>g.gesture||'');
        const score=typeof face?.faceScore==='number'&&face.faceScore>0?
          face.faceScore:typeof face?.boxScore==='number'?face.boxScore:null;
        const frame:FaceFrame={
          timestamp:Date.now(),
          faceCount:faces.length,
          faceScore:score,
          liveness:typeof face?.live==='number'?face.live:null,
          antiSpoof:typeof face?.real==='number'?face.real:null,
          yawRadians:typeof face?.rotation?.angle?.yaw==='number'?face.rotation.angle.yaw:null,
          gestures
        };
        state=advanceChallenge(state,frame);
        setProgress(state);setFaceCount(faces.length);
        setLiveScore(frame.liveness);setSpoofScore(frame.antiSpoof);
        setFrameCount(++cycles);
        if(state.status!=='running'){
          setOutcome(state.status);
          setFeedback(state.status==='completed'?
            'Movimentos reconhecidos nesta pré-triagem local. Isso NÃO verifica identidade nem idade.':
            state.reason);
          stop();break;
        }
        setFeedback(state.reason||challengePrompt(currentChallenge(state)));
        // Short sampling interval helps catch a blink even on slower mobile devices;
        // actual model inference controls the effective frame rate.
        await new Promise<void>(resolve=>setTimeout(resolve,70));
      }
      if(run===currentRun.current){
        setOutcome('inconclusive');stop();
        setFeedback('Câmera interrompida. Reinicie o teste para continuar.');
      }
    }catch(err){
      if(run===currentRun.current){
        setOutcome('inconclusive');
        setFeedback(err instanceof Error?err.message:
          'Não foi possível inicializar o Human. Verifique a câmera e a conexão.');
        stop();
      }
    }finally{if(run===currentRun.current)setBusy(false);}
  }
  return <section className="panel human-camera-panel" style={{marginTop:20}}>
    <div className="feed-title">
      <h2><ScanFace size={22} color="#7655da" style={{verticalAlign:'middle'}}/> Human · movimentos guiados</h2>
      <span className="small-note">Teste local · Software livre</span>
    </div>
    <p className="muted">Com uma única pessoa na imagem, olhe para a câmera, vire a cabeça
      para <strong>qualquer lado</strong>, volte pelo lado oposto e pisque devagar.
      O reconhecimento é experimental e <strong>não comprova identidade nem idade</strong>.</p>
    <label className="human-agree">
      <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}
        disabled={active||busy}/>
      Autorizo o uso da câmera apenas para este teste no navegador.
      Nenhum vídeo ou foto será salvo ou enviado ao Conecta.
    </label>
    <div className="human-video-wrap" style={{position:'relative'}}>
      <video ref={videoRef} autoPlay muted playsInline aria-label="Prévia privada da câmera"/>
      <div className="human-frame" aria-hidden="true"/>
      {busy&&<div className="human-loading-indicator" role="status">Preparando a análise facial…</div>}
    </div>
    {progress&&<div className="human-challenge-progress" aria-live="polite">
      <strong>Desafios: {Math.min(progress.index,4)} de 4</strong>
      <progress value={Math.min(progress.index,4)} max={4} aria-label="Etapas reconhecidas"/>
      <p>{challengePrompt(currentChallenge(progress))}</p>
    </div>}
    <p className={outcome==='completed'?'form-success':'small-note'} role="status">{feedback}</p>
    {(active||outcome!=='idle')&&<details className="human-diagnostics">
      <summary>Diagnóstico da câmera e da IA</summary>
      <p className="small-note">Rostos: {faceCount} · Quadros: {frameCount} ·
       Vivacidade: {liveScore===null?'indisponível':(liveScore*100).toFixed(0)+'%'} ·
       Antifraude: {spoofScore===null?'indisponível':(spoofScore*100).toFixed(0)+'%'}.</p>
      <p className="small-note">Os indicadores variam conforme luz e dispositivo e não são
       certificação biométrica. Um resultado insuficiente não identifica fraude.</p>
    </details>}
    <div className="row" style={{gap:12,flexWrap:'wrap'}}>
      {!active&&!busy?<button type="button" className="btn btn-outline"
        onClick={()=>void start()} disabled={!agreed}><Camera size={18}/>
        {outcome==='idle'?'Iniciar teste guiado':'Repetir teste guiado'}</button>:
        <button type="button" className="btn btn-outline" onClick={()=>{
          stop();setOutcome('inconclusive');setFeedback('Teste cancelado. Câmera desligada.');
        }}><CameraOff size={18}/> Cancelar / Desligar câmera</button>}
    </div>
    <p className="small-note"><ShieldAlert size={15} style={{verticalAlign:'middle'}}/>
      Se o teste não reconhecer uma piscada, pisque outra vez diante da câmera.
      Esta etapa não concede selo, não autentica RG/CIN e não altera a faixa etária.
    </p>
  </section>;
}
