import 'server-only';

import {spawn} from 'node:child_process';
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import {classifyLocalImage} from '@/lib/open-source-image-moderation';

export type VideoScreenVerdict={
  reviewRequired:boolean;
  flagged:boolean;
  reason:string;
  sampledFrames:number;
  provider:'ffmpeg-nsfwjs-mobilenet-v2';
};
// Keep within the available CPU, temp filesystem and memory on free hosts.
const MAX_SIZE=24*1024*1024;
const MAX_DURATION=45;
const MAX_FRAMES=5;
function runFfmpeg(executable:string,args:string[],timeout=18000):Promise<string>{
 return new Promise((resolve,reject)=>{
  const child=spawn(executable,args,{stdio:['ignore','ignore','pipe'],windowsHide:true});
  let stderr='',done=false;
  const finish=(error?:Error)=>{
   if(done)return;
   done=true;clearTimeout(timer);
   error?reject(error):resolve(stderr);
  };
  const timer=setTimeout(()=>{
   child.kill('SIGKILL');
   finish(new Error('FFmpeg timeout'));
  },timeout);
  child.stderr.on('data',(chunk:Buffer)=>{
   stderr+=chunk.toString().slice(0,5000);
   if(stderr.length>12000){
    child.kill('SIGKILL');finish(new Error('FFmpeg output too long'));
   }
  });
  child.on('error',err=>finish(err));
  child.on('close',code=>{
   // FFmpeg -i without an output intentionally exits 1.
   if(args.at(-1)==='-i')finish();
   else if(code===0)finish();
   else finish(new Error('FFmpeg could not decode this file'));
  });
 });
}
/**
 * Extracts independent video frames on the SERVER from the actual Supabase
 * object; never trusts screenshot data or an approval from the uploader.
 * Unsupported/malformed/long media => pending for a human, NOT approved.
 */
export async function screenVideoAutomatically(bytes:Uint8Array):Promise<VideoScreenVerdict>{
 if(!ffmpegPath||!bytes.length||bytes.byteLength>MAX_SIZE)
  throw new Error('Video exceeds automatic screening limits');
 const dir=await mkdtemp(join(tmpdir(),'conecta-auto-video-'));
 const file=join(dir,'source.video');
 try{
  await writeFile(file,Buffer.from(bytes));
  // Probe duration without ffprobe: ffmpeg -i prints metadata on stderr.
  const probe=await runFfmpeg(ffmpegPath,['-hide_banner','-nostdin','-i',file],7000);
  const match=probe.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if(!match)throw new Error('Video duration unknown');
  const duration=Number(match[1])*3600+Number(match[2])*60+Number(match[3]);
  if(!Number.isFinite(duration)||duration<=0||duration>MAX_DURATION)
   throw new Error('Video duration exceeds automatic screening limit');
  const fps=(MAX_FRAMES/duration).toFixed(5);
  await runFfmpeg(ffmpegPath,[
   '-hide_banner','-nostdin','-loglevel','error','-threads','1','-i',file,
   '-an','-vf',`fps=${fps},scale=224:224`,'-frames:v',String(MAX_FRAMES),
   '-q:v','5',join(dir,'frame-%02d.jpg')
  ],24000);
  const frames=(await readdir(dir)).filter(name=>/^frame-\d{2}\.jpg$/.test(name)).sort();
  if(frames.length<4||frames.length>MAX_FRAMES)
   throw new Error('Incomplete video frame sample');
  let flagged=false,uncertain=false;
  for(const name of frames){
   const jpg=new Uint8Array(await readFile(join(dir,name)));
   const result=await classifyLocalImage(jpg);
   flagged=flagged||result.flagged;
   const cls=result.classification;
   if(cls.Porn+cls.Hentai+cls.Sexy*0.75>=0.22)uncertain=true;
  }
  return {
   reviewRequired:flagged||uncertain,
   flagged,provider:'ffmpeg-nsfwjs-mobilenet-v2',sampledFrames:frames.length,
   reason:flagged?'Quadros do vídeo sinalizados por IA: revisão humana.':
    uncertain?'Indícios visuais inconclusivos: revisão humana.':
    'Amostragem automática de quadros concluída; permanecem os recursos de denúncia e revisão.'
  };
 }finally{
  await rm(dir,{recursive:true,force:true}).catch(()=>{});
 }
}
