/**
 * Zero-API-fee image triage using infinitered/nsfwjs (MIT).
 * Runs on the server with TensorFlow.js CPU. No image is sent to an AI provider.
 * These five model classes ONLY assess sexual-content likelihood; other risks
 * (violence, grooming, harassment, minors, scams) require separate safeguards.
 */
import 'server-only';

type Triage = {
 flagged:boolean;
 reviewRequired:boolean;
 provider:'nsfwjs-mobilenet-v2';
 reason:string;
 classification:Record<'Porn'|'Hentai'|'Sexy'|'Neutral'|'Drawing',number>;
};

type Model = Awaited<ReturnType<typeof import('nsfwjs').load>>;
let modelPromise:Promise<Model>|null=null;

async function localModel():Promise<Model>{
 if(!modelPromise){
  modelPromise=(async()=>{
   const tf=await import('@tensorflow/tfjs');
   await tf.setBackend('cpu');
   await tf.ready();
   tf.enableProdMode();
   const nsfw=await import('nsfwjs');
   // NSFWJS MobileNetV2 weights are packaged in npm, not fetched remotely.
   return nsfw.load('MobileNetV2');
  })().catch(error=>{modelPromise=null;throw error;});
 }
 return modelPromise;
}

export async function classifyLocalImage(bytes:Uint8Array):Promise<Triage>{
 if(bytes.byteLength===0||bytes.byteLength>10*1024*1024)
  throw new Error('Image is empty or exceeds 10MB');
 const sharp=(await import('sharp')).default;
 const {width,height}=await sharp(Buffer.from(bytes),{
  failOn:'error',limitInputPixels:20_000_000,
 }).metadata();
 if(!width||!height||width*height>20_000_000)throw new Error('Unsupported image');
 // Strip EXIF and alpha; normalize to a stable [224,224,3] tensor.
 const prepared=await sharp(Buffer.from(bytes),{failOn:'error',limitInputPixels:20_000_000})
  .rotate().resize(224,224,{fit:'fill'}).flatten({background:'#ffffff'})
  .removeAlpha().raw().toBuffer({resolveWithObject:true});
 if(prepared.info.channels!==3||prepared.data.length!==224*224*3)
  throw new Error('Invalid RGB image');
 const tf=await import('@tensorflow/tfjs');
 const tensor=tf.tensor3d(Uint8Array.from(prepared.data),[224,224,3],'int32');
 let predictions:{className:string;probability:number}[];
 try{predictions=await (await localModel()).classify(tensor,5);}
 finally{tensor.dispose();}
 const classes={Porn:0,Hentai:0,Sexy:0,Neutral:0,Drawing:0};
 if(predictions.length!==5)throw new Error('Incomplete model output');
 for(const p of predictions){
  if(!(p.className in classes)||!Number.isFinite(p.probability)||
    p.probability<0||p.probability>1)throw new Error('Invalid model scores');
  classes[p.className as keyof typeof classes]=p.probability;
 }
 const scores=Object.values(classes).reduce((a,b)=>a+b,0);
 if(scores<0.95||scores>1.05)throw new Error('Malformed model probabilities');
 const flagged=classes.Porn>=0.60||classes.Hentai>=0.60||classes.Sexy>=0.85;
 const borderline=classes.Porn+classes.Hentai+classes.Sexy>=0.40;
 return {
  flagged,reviewRequired:true,provider:'nsfwjs-mobilenet-v2',
  reason:flagged?'Possível nudez ou conteúdo sexual explícito; revisão especializada':
    borderline?'Classificação visual inconclusiva; revisão humana':
    'Triagem visual sem indicação clara de nudez; outras categorias ainda precisam de revisão',
  classification:classes
 };
}
