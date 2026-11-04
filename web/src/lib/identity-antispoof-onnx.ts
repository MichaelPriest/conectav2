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
export async function inspectFacePresentation(
  rgb:Uint8Array,width:number,height:number,box:readonly number[]
):Promise<AntiSpoofResult>{
  if(rgb.length!==width*height*3||width<80||height<80||box.length<4||
     box.some(value=>!Number.isFinite(value)))
    return {status:'inconclusive',confidence:null,reason:'invalid_face'};
  const [x,y,w,h]=box;
  if(w<64||h<64||x<0||y<0||x+w>width+2||y+h>height+2)
    return {status:'inconclusive',confidence:null,reason:'invalid_face'};
  // Upstream 2.7_80x80 model expects BGR face with surrounding image context.
  // The 2.7x crop is centered on the detected face and clamped to image bounds.
  const side=Math.max(w,h)*2.7;
  const left=Math.max(0,Math.floor(x+w/2-side/2));
  const top=Math.max(0,Math.floor(y+h/2-side/2));
  const right=Math.min(width,Math.ceil(x+w/2+side/2));
  const bottom=Math.min(height,Math.ceil(y+h/2+side/2));
  if(right-left<70||bottom-top<70)
    return {status:'inconclusive',confidence:null,reason:'invalid_face'};
  let crop:Buffer|undefined;
  const tensorValues=new Float32Array(3*SIZE*SIZE);
  try{
    crop=await sharp(Buffer.from(rgb),{raw:{width,height,channels:3}})
      .extract({left,top,width:right-left,height:bottom-top})
      .resize(SIZE,SIZE,{fit:'fill'}).raw().toBuffer();
    for(let i=0;i<SIZE*SIZE;i++){
      tensorValues[i]=crop[i*3+2]/255;                // B
      tensorValues[SIZE*SIZE+i]=crop[i*3+1]/255;     // G
      tensorValues[2*SIZE*SIZE+i]=crop[i*3]/255;     // R
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
