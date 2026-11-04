/**
 * Server-side presentation-attack detection with a pinned MiniFASNet-V2 ONNX
 * model. Human is used elsewhere for face landmarks / match, NOT for PAD.
 * The upstream Silent-Face-Anti-Spoofing test.py labels index 1 as REAL
 * (the community model card incorrectly lists index 0 as live).
 * This is probabilistic evidence and never establishes identity or age.
 */
import path from 'node:path';
import sharp from 'sharp';
import {InferenceSession,Tensor} from 'onnxruntime-node';

const MODEL_PATH=path.join(process.cwd(),'public','vendor','antispoof','minifasnet_v2.onnx');
const SIZE=80;
const LIVE_INDEX=1;
const MIN_LIVE_CONFIDENCE=0.72; // conservative provisional gate; requires real-device calibration
let sessionPromise:Promise<InferenceSession>|undefined;
function getSession(){
  if(!sessionPromise)sessionPromise=InferenceSession.create(MODEL_PATH,{
    executionProviders:['cpu'],intraOpNumThreads:1,interOpNumThreads:1
  }).catch(error=>{sessionPromise=undefined;throw error;});
  return sessionPromise;
}
export type AntiSpoofResult={status:'live'|'inconclusive';confidence:number|null;reason:'ok'|'model_unavailable'|'low_confidence'|'invalid_face'};
export function classifyLiveScore(values:readonly number[]):AntiSpoofResult{
  if(values.length!==3||values.some(value=>!Number.isFinite(value)))
    return {status:'inconclusive',confidence:null,reason:'model_unavailable'};
  const max=Math.max(...values);
  const probabilities=values.map(value=>Math.exp(value-max));
  const total=probabilities.reduce((sum,value)=>sum+value,0);
  const confidence=probabilities[LIVE_INDEX]/total;
  if(!Number.isFinite(confidence))
    return {status:'inconclusive',confidence:null,reason:'model_unavailable'};
  const live=confidence>=MIN_LIVE_CONFIDENCE&&
    confidence>probabilities[0]/total&&confidence>probabilities[2]/total;
  return {status:live?'live':'inconclusive',confidence,reason:live?'ok':'low_confidence'};
}
/**
 * Match upstream src/generate_patches.py CropImage._get_new_box.
 * Keep the original face aspect ratio, fit the 2.7x crop inside the image,
 * and shift it at frame edges instead of truncating one side.
 */
export function antiSpoofCropBounds(
  width:number,height:number,box:readonly number[]
):{left:number;top:number;width:number;height:number}|null{
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<80||height<80||
     box.length<4||box.some(value=>!Number.isFinite(value)))return null;
  const [x,y,w,h]=box;
  if(w<64||h<64||x<0||y<0||x+w>width+2||y+h>height+2)return null;
  const scale=Math.min((height-1)/h,(width-1)/w,2.7);
  if(!Number.isFinite(scale)||scale<=0)return null;
  const expandedW=w*scale,expandedH=h*scale;
  let left=x+w/2-expandedW/2,top=y+h/2-expandedH/2;
  let right=left+expandedW,bottom=top+expandedH;
  if(left<0){right-=left;left=0;}
  if(top<0){bottom-=top;top=0;}
  if(right>width-1){left-=right-width+1;right=width-1;}
  if(bottom>height-1){top-=bottom-height+1;bottom=height-1;}
  const l=Math.max(0,Math.trunc(left)),t=Math.max(0,Math.trunc(top));
  const r=Math.min(width-1,Math.trunc(right)),b=Math.min(height-1,Math.trunc(bottom));
  if(r-l+1<70||b-t+1<70)return null;
  return {left:l,top:t,width:r-l+1,height:b-t+1};
}
export async function inspectFacePresentation(
  rgb:Uint8Array,width:number,height:number,box:readonly number[]
):Promise<AntiSpoofResult>{
  if(rgb.length!==width*height*3)
    return {status:'inconclusive',confidence:null,reason:'invalid_face'};
  const bounds=antiSpoofCropBounds(width,height,box);
  if(!bounds)return {status:'inconclusive',confidence:null,reason:'invalid_face'};
  let crop:Buffer|undefined;
  const tensorValues=new Float32Array(3*SIZE*SIZE);
  try{
    crop=await sharp(Buffer.from(rgb),{raw:{width,height,channels:3}})
      .extract(bounds)
      .resize(SIZE,SIZE,{fit:'fill'}).raw().toBuffer();
    // The upstream model's modified ToTensor passes BGR values as float32
    // in the original 0..255 range (no /255). Normalizing here changes the
    // input distribution learned by its weights and can cause false rejects.
    for(let i=0;i<SIZE*SIZE;i++){
      tensorValues[i]=crop[i*3+2];                // B
      tensorValues[SIZE*SIZE+i]=crop[i*3+1];     // G
      tensorValues[2*SIZE*SIZE+i]=crop[i*3];     // R
    }
    const session=await getSession();
    if(session.inputNames.length!==1||session.outputNames.length!==1)
      return {status:'inconclusive',confidence:null,reason:'model_unavailable'};
    const output=await session.run({[session.inputNames[0]]:
      new Tensor('float32',tensorValues,[1,3,SIZE,SIZE])});
    const logits=output[session.outputNames[0]]?.data;
    if(!logits||logits.length!==3)
      return {status:'inconclusive',confidence:null,reason:'model_unavailable'};
    return classifyLiveScore(Array.from(logits,Number));
  }catch{
    // Missing model, native runtime errors, and inference failures never
    // become a pass or a biometric denial; callers can show service diagnostics.
    return {status:'inconclusive',confidence:null,reason:'model_unavailable'};
  }finally{
    tensorValues.fill(0);crop?.fill(0);
  }
}
