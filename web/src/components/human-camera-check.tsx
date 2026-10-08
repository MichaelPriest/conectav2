'use client';
import {useEffect,useRef,useState} from 'react';
import {Camera,CameraOff,ShieldAlert,ScanFace} from 'lucide-react';

type HumanDetection={face?:Array<{live?:number;real?:number}>};
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
  const [feedback,setFeedback]=useState('A câmera permanece desligada até você autorizar.');
  const [faceCount,setFaceCount]=useState(0);
  const [frameCount,setFrameCount]=useState(0);
  const [liveScore,setLiveScore]=useState<number|null>(null);
  const [spoofScore,setSpoofScore]=useState<number|null>(null);

  function stop(){
    currentRun.current++;
    mediaRef.current?.getTracks().forEach(t=>t.stop());
    mediaRef.current=null;
    if(videoRef.current){videoRef.current.pause();videoRef.current.srcObject=null;}
    setActive(false);setBusy(false);
  }
  useEffect(()=>()=>{currentRun.current++;mediaRef.current?.getTracks().forEach(t=>t.stop());},[]);
  async function start(){
    if(!agreed||busy||active)return;
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){
      setFeedback('Câmera indisponível. Utilize HTTPS e um navegador que permita acesso à câmera.');
      return;
    }
    setBusy(true);setFeedback('Carregando o Human e seus modelos antes de ativar a câmera...');
    const run=++currentRun.current;
    try{
      const Human=await loadBrowserHuman();
      if(run!==currentRun.current)return;
      const human=new Human({
        backend:'webgl',
        modelBasePath:'https://vladmandic.github.io/human-models/models/',
        cacheSensitivity:0.03,
        debug:false,
        face:{
          enabled:true,
          detector:{rotation:false,return:false},
          description:{enabled:false},
          antispoof:{enabled:true},
          liveness:{enabled:true},
          iris:{enabled:false},
          emotion:{enabled:false}
        },
        body:{enabled:false},hand:{enabled:false},object:{enabled:false},
        gesture:{enabled:false}
      });
      await human.load();
      if(run!==currentRun.current)return;
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});
      if(run!==currentRun.current){stream.getTracks().forEach(t=>t.stop());return;}
      mediaRef.current=stream;
      const video=videoRef.current;
      if(!video)throw new Error('Câmera não pronta.');
      video.srcObject=stream;
      await video.play();
      if(run!==currentRun.current)return;
      setActive(true);setBusy(false);
      setFeedback('Modelos carregados. Posicione seu rosto na moldura e olhe para a câmera.');
      // Only ephemeral browser processing; no snapshot, upload, template, ID, age or backend decision.
      let cycles=0;
      while(run===currentRun.current&&mediaRef.current?.active&&cycles<180){
        const result=await human.detect(video);
        if(run!==currentRun.current)break;
        const count=result.face?.length||0;
        setFaceCount(count);
        if(count===1){
          const face=result.face?.[0];
          setLiveScore(typeof face?.live==='number'?face.live:null);
          setSpoofScore(typeof face?.real==='number'?face.real:null);
          setFeedback('Rosto detectado. Os indicadores são experimentais e não comprovam identidade ou idade.');
        }else{
          setLiveScore(null);setSpoofScore(null);
          setFeedback(count===0?'Nenhum rosto detectado. Ajuste a iluminação.':'Mostre apenas uma pessoa diante da câmera.');
        }
        setFrameCount(++cycles);
        await new Promise<void>(resolve=>setTimeout(resolve,800));
      }
      if(run===currentRun.current){stop();setFeedback('Sessão de teste concluída. Nenhuma imagem foi armazenada.');}
    }catch(err){
      if(run===currentRun.current){
        stop();setFeedback(err instanceof Error?err.message:'Não foi possível inicializar a câmera.');
      }
    }finally{if(run===currentRun.current)setBusy(false);}
  }
  return <section className="panel human-camera-panel" style={{marginTop:20}}>
    <div className="feed-title"><h2><ScanFace size={22} color="#7655da" style={{verticalAlign:'middle'}}/> Human · captura local experimental</h2><span className="small-note">Software livre</span></div>
    <p className="muted">Faça um teste voluntário de detecção facial e indicadores de vivacidade no seu próprio navegador. Esta etapa <strong>não verifica sua identidade, idade ou documento</strong> e não concede selo nem libera acesso.</p>
    <label className="human-agree"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} disabled={active||busy}/> Entendo que minha câmera será usada somente durante o teste. Não será enviado nem salvo vídeo ou foto pelo Conecta.</label>
    <div className="human-video-wrap"><video ref={videoRef} autoPlay muted playsInline aria-label="Prévia privada da câmera"/><div className="human-frame" aria-hidden="true"/></div>
    <p className="small-note" role="status">{feedback}</p>
    {active&&<p className="small-note">Rostos: {faceCount} · Quadros avaliados: {frameCount} · Vivacidade: {liveScore===null?'não disponível':(liveScore*100).toFixed(0)+'%'} · Antifraude: {spoofScore===null?'não disponível':(spoofScore*100).toFixed(0)+'%'}</p>}
    <div className="row" style={{gap:12,flexWrap:'wrap'}}>
      {!active?<button type="button" className="btn btn-outline" onClick={()=>void start()} disabled={!agreed||busy}><Camera size={18}/>{busy?'Carregando modelos...':'Testar câmera com Human'}</button>:
        <button type="button" className="btn btn-outline" onClick={()=>{stop();setFeedback('Câmera desligada. Nenhum dado facial armazenado.');}}><CameraOff size={18}/> Desligar câmera</button>}
    </div>
    <p className="small-note"><ShieldAlert size={15} style={{verticalAlign:'middle'}}/> O Human usa modelos de IA com limitações conhecidas contra fotos e telas. A proteção de adolescentes exige aferição de idade independente.</p>
  </section>;
}
