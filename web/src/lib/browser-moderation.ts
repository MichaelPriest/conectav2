'use client';

/**
 * Assistive, on-device moderation for human reviewers.
 * No trust in these scores for RLS or publication: never auto-approves or writes status.
 * The browser fetches OPEN model weights, but does not send text/video to a classifier API.
 */
export type TextTriage={model:string;labels:Record<string,number>;flagged:boolean;summary:string};
export type VideoTriage={model:string;framesAnalysed:number;maxExplicitScore:number;flagged:boolean;summary:string};
type Prediction={label:string;score:number};
type NsfwPrediction={className:string;probability:number};
type LocalTextPipeline=(text:string,options?:{top_k:null})=>Promise<unknown>;
let textPipelinePromise:Promise<LocalTextPipeline>|null=null;

async function textPipeline():Promise<LocalTextPipeline>{
 if(!textPipelinePromise){
  textPipelinePromise=(async()=>{
   const {pipeline}=await import('@huggingface/transformers');
   const classifier=await pipeline('text-classification','Horizon-Labs/multilingual-toxicity-small',{
     dtype:'q8',device:'wasm'
   });
   return classifier as unknown as LocalTextPipeline;
  })().catch(err=>{textPipelinePromise=null;throw err;});
 }
 return textPipelinePromise;
}

export async function analyzeTextInBrowser(text:string):Promise<TextTriage>{
 if(!text.trim()||text.length>4000)throw new Error('O texto precisa ter de 1 a 4.000 caracteres.');
 const prediction=await (await textPipeline())(text.slice(0,4000),{top_k:null});
 const candidates=Array.isArray(prediction) && Array.isArray(prediction[0])
  ? prediction[0] as Prediction[]:prediction as Prediction[];
 if(!Array.isArray(candidates)||candidates.length<4)throw new Error('Resposta inválida do classificador local.');
 const labels:Record<string,number>={};
 for(const item of candidates){
  if(typeof item.label!=='string'||typeof item.score!=='number'||
     !Number.isFinite(item.score)||item.score<0||item.score>1)
   throw new Error('Pontuações de moderação inválidas.');
  labels[item.label]=item.score;
 }
 if(typeof labels.toxicity!=='number')throw new Error('Modelo de toxicidade sem categoria principal.');
 const flagged=(labels.toxicity>=0.40||labels.threat>=0.25||
   labels.identity_attack>=0.30||labels.sexual_explicit>=0.35);
 return {
  model:'Horizon-Labs/multilingual-toxicity-small (q8)',labels,flagged,
  summary:flagged?'O modelo encontrou sinais que merecem investigação.':
    'Sem sinais fortes nas categorias treinadas. O contexto e outras violações ainda exigem revisão.'
 };
}

type VideoModel={classify(input:HTMLCanvasElement,topk?:number):Promise<NsfwPrediction[]>};
let videoModelPromise:Promise<VideoModel>|null=null;
async function videoModel():Promise<VideoModel>{
 if(!videoModelPromise){
  videoModelPromise=(async()=>{
   const nsfw=await import('nsfwjs');
   return await nsfw.load('MobileNetV2') as VideoModel;
  })().catch(err=>{videoModelPromise=null;throw err;});
 }
 return videoModelPromise;
}

function waitForEvent(video:HTMLVideoElement,ok:string,fail:string,timeout=14000):Promise<void>{
 return new Promise((resolve,reject)=>{
  let done=false;
  const finish=(error?:Error)=>{
   if(done)return;done=true;
   clearTimeout(timer);
   video.removeEventListener(ok,success);
   video.removeEventListener(fail,failure);
   error?reject(error):resolve();
  };
  const success=()=>finish();
  const failure=()=>finish(new Error('O vídeo não pôde ser decodificado para análise local.'));
  const timer=setTimeout(()=>finish(new Error('A leitura dos quadros excedeu o tempo limite.')),timeout);
  video.addEventListener(ok,success,{once:true});
  video.addEventListener(fail,failure,{once:true});
 });
}

/**
 * Frame-based browser screening of a video already authorized by a moderator.
 * Samples FIVE frames; never asserts that an unflagged video is safe.
 * Requires CORS-enabled signed media URL for canvas capture.
 */
export async function analyzeVideoInBrowser(url:string):Promise<VideoTriage>{
 const video=document.createElement('video');
 video.preload='auto';
 video.crossOrigin='anonymous';
 video.muted=true;
 video.playsInline=true;
 try{
  const metadata=waitForEvent(video,'loadedmetadata','error',18000);
  video.src=url;
  video.load();
  await metadata;
  const duration=video.duration;
  if(!Number.isFinite(duration)||duration<=0||duration>120){
   throw new Error('Vídeo longo ou sem duração válida: encaminhe à revisão manual.');
  }
  const model=await videoModel();
  const canvas=document.createElement('canvas');
  canvas.width=224;canvas.height=224;
  const context=canvas.getContext('2d',{willReadFrequently:true});
  if(!context)throw new Error('Canvas de moderação indisponível.');
  let framesAnalysed=0,maxExplicitScore=0;
  const positions=[0.05,0.25,0.50,0.75,0.95];
  for(const fraction of positions){
   const seconds=Math.min(duration-0.01,Math.max(0,duration*fraction));
   const seek=waitForEvent(video,'seeked','error');
   video.currentTime=seconds;
   await seek;
   // Capture at browser size; pixels never leave this browser.
   context.drawImage(video,0,0,canvas.width,canvas.height);
   const prediction=await model.classify(canvas,5);
   const porn=prediction.find(p=>p.className==='Porn')?.probability;
   const hentai=prediction.find(p=>p.className==='Hentai')?.probability;
   const sexy=prediction.find(p=>p.className==='Sexy')?.probability;
   if([porn,hentai,sexy].some(s=>typeof s!=='number'||!Number.isFinite(s)))
    throw new Error('Modelo visual retornou pontuações incompletas.');
   maxExplicitScore=Math.max(maxExplicitScore,porn||0,hentai||0,(sexy||0)*0.75);
   framesAnalysed++;
  }
  return {
   model:'NSFWJS MobileNetV2 (navegador)',framesAnalysed,maxExplicitScore,
   flagged:maxExplicitScore>=0.60,
   summary:maxExplicitScore>=0.60?
     'Possível nudez ou conteúdo sexual em um dos quadros examinados.':
     'Cinco quadros não apresentaram sinais fortes de nudez; o vídeo COMPLETO ainda exige revisão.'
  };
 }finally{
  video.pause();video.removeAttribute('src');video.load();
 }
}
