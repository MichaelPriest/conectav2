import {NextRequest,NextResponse} from 'next/server';
import {identityContext} from '@/lib/identity-server';
import {classifyLocalImage} from '@/lib/open-source-image-moderation';
import {screenTextAutomatically} from '@/lib/automatic-text-screen';
import {screenVideoAutomatically} from '@/lib/automatic-video-screen';

export const runtime='nodejs';
export const dynamic='force-dynamic';
type ContentKind='post'|'story';
type MediaKind='image'|'video';
type ScanResult={flagged:boolean;provider:string;humanReview?:boolean;reason?:string};
function reply(data:unknown,status=200){
 return NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
}
function validId(value:unknown){
 return typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
async function moderateWithFreeApi(text:string, images:string[]):Promise<ScanResult>{
 const key=process.env.OPENAI_API_KEY;
 if(!key)throw new Error('unconfigured');
 // No SDK dependency; the official moderation endpoint is free for API users.
 const input:[{type:'text';text:string},...{type:'image_url';image_url:{url:string}}[]]=[
  {type:'text',text:text||'Imagem compartilhada no Conecta'},
  ...images.map(url=>({type:'image_url' as const,image_url:{url}}))
 ];
 const response=await fetch('https://api.openai.com/v1/moderations',{
   method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
   body:JSON.stringify({model:'omni-moderation-latest',input}),
   signal:AbortSignal.timeout(18000),cache:'no-store'
 });
 if(!response.ok)throw new Error('provider_failure');
 const data=await response.json() as {results?:{flagged?:boolean}[]};
 if(!data.results?.length||data.results.some(r=>typeof r.flagged!=='boolean'))
   throw new Error('provider_invalid');
 return {flagged:data.results.some(result=>result.flagged),provider:'omni-moderation-latest'};
}


async function moderateWithOpenSourceWorker(
 text:string,media:{path:string;type:MediaKind}[],
 admin:NonNullable<Awaited<ReturnType<typeof identityContext>>>['admin']
):Promise<ScanResult>{
 const rawUrl=process.env.CONEXA_MODERATION_WORKER_URL;
 const token=process.env.CONEXA_MODERATION_WORKER_TOKEN;
 if(!rawUrl||!token)throw new Error('worker_unconfigured');
 const url=new URL(rawUrl);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)
  throw new Error('unsafe_worker_config');
 const form=new FormData();
 form.set('content',text);
 for(const [i,item] of media.entries()){
   const {data,error}=await admin.storage.from('social-media').download(item.path);
   if(error||!data)throw new Error('cannot_download_media');
   if(data.size>50*1024*1024)throw new Error('media_too_large');
   form.append(item.type==='video'?'video':'images',data,
     item.type==='video'?'sample-'+i+'.mp4':'sample-'+i+'.jpg');
 }
 const response=await fetch(new URL('/classify',url),{
   method:'POST',headers:{Authorization:'Bearer '+token},body:form,
   cache:'no-store',signal:AbortSignal.timeout(55000)
 });
 if(!response.ok)throw new Error('worker_unavailable');
 const json=await response.json() as {flagged?:boolean;human_review?:boolean;engine?:string};
 if(typeof json.flagged!=='boolean'||typeof json.human_review!=='boolean')
  throw new Error('worker_invalid');
 // The OSS worker detects only toxicity and nudity, not all abuse categories.
 // Until a broad safety classifier exists, clean visual material still needs review.
 return {flagged:json.flagged,provider:'opensource-'+String(json.engine||'worker').slice(0,40),
   humanReview:media.length>0||json.human_review};
}


async function moderateWithBundledModel(
 text:string,media:{path:string;type:MediaKind}[],
 admin:NonNullable<Awaited<ReturnType<typeof identityContext>>>['admin']
):Promise<ScanResult>{
 const lexical=screenTextAutomatically(text);
 if(!media.length)return {flagged:lexical.reviewRequired,
  humanReview:lexical.reviewRequired,provider:lexical.engine,
  reason:lexical.reason};
 if(media.length>5)throw new Error('too_many_media');
 let flagged=lexical.reviewRequired,reviewRequired=lexical.reviewRequired;
 let notes=[lexical.reason];
 for(const [index,item] of media.entries()){
  const {data,error}=await admin.storage.from('social-media').download(item.path);
  if(error||!data)throw new Error('unable_to_fetch_media');
  if(item.type==='video'){
   if(media.length!==1)throw new Error('mixed_video_gallery_requires_review');
   const video=await screenVideoAutomatically(new Uint8Array(await data.arrayBuffer()));
   flagged=flagged||video.flagged;
   reviewRequired=reviewRequired||video.reviewRequired;
   notes.push('Vídeo: '+video.reason);
  }else{
   if(data.size>10*1024*1024||data.size===0)throw new Error('media_size_out_of_bounds');
   const result=await classifyLocalImage(new Uint8Array(await data.arrayBuffer()));
   const cls=result.classification;
   // Strict visual screen; any borderline/sexual imagery requires a person.
   const visualRisk=cls.Porn+cls.Hentai+cls.Sexy*0.75;
   const needsReview=result.flagged||visualRisk>=0.20;
   reviewRequired=reviewRequired||needsReview;
   flagged=flagged||result.flagged;
   notes.push('Foto '+(index+1)+': '+
     (needsReview?'Sinalizada para revisão humana':'Triagem visual local concluída'));
  }
 }
 return {flagged,humanReview:reviewRequired,
  provider:'automatic-local-oss-v1',reason:notes.join(' | ').slice(0,490)};
}

export async function POST(request:NextRequest){
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return reply({error:'Origem inválida.'},403);
 const context=await identityContext(request);
 if(!context)return reply({error:'Autenticação administrativa do servidor indisponível ou sessão inválida.'},401);
 let body:{kind?:ContentKind;id?:string};
 try{body=await request.json();}catch{return reply({error:'Dados inválidos.'},400);}
 if(!validId(body.id)||(body.kind!=='post'&&body.kind!=='story'))return reply({error:'Conteúdo inválido.'},400);
 const {user,admin}=context,kind=body.kind,id=body.id!;
 const engine=process.env.CONEXA_MODERATION_ENGINE||'local';
 const {data:record,error:fetchError}=kind==='post'
  ?await admin.from('posts').select('id,author_id,content,media_path,media_type,moderation_status,ai_checked_at,community_id').eq('id',id).maybeSingle()
  :await admin.from('stories').select('id,author_id,caption,media_path,media_type,moderation_status,expires_at').eq('id',id).maybeSingle();
 if(fetchError||!record)return reply({error:'Conteúdo não encontrado.'},404);
 const row=record as {
  author_id:string;content?:string;caption?:string;expires_at?:string;
  moderation_status:string;ai_checked_at?:string|null;community_id?:string|null;media_path:string|null;media_type:MediaKind|null;
 };
 if(row.author_id!==user.id)return reply({error:'Você não pode moderar o conteúdo de terceiros.'},403);
 if(kind==='story'&&new Date(row.expires_at as string).getTime()<Date.now())
  return reply({status:'expired'},200);
 if(kind==='post'&&row.ai_checked_at)return reply({status:row.moderation_status,alreadyChecked:true});
 if(row.moderation_status==='rejected')return reply({status:'rejected'},200);
 const content=kind==='post'?String(row.content||''):String(row.caption||'');
 const media:{path:string;type:MediaKind}[]=[];
 if(kind==='post'){
  const {data:gallery,error:galleryError}=await admin.from('post_media').select('storage_path,media_type')
   .eq('post_id',id).order('position',{ascending:true}).limit(6);
  if(galleryError)return reply({status:'pending',error:'Arquivo ainda não foi verificado.'},503);
  for(const g of gallery||[])media.push({path:g.storage_path,type:g.media_type as MediaKind});
 }
 if(media.length===0&&row.media_path)
  media.push({path:row.media_path as string,type:row.media_type as MediaKind});
 if(media.length>5)return reply({status:'pending',error:'Número de mídias exige revisão manual.'},200);
 if(media.some(m=>m.type==='video')&&engine==='openai')
  return reply({status:'pending',reason:'Vídeos aguardam análise de quadros e revisão humana.'});
 if(media.some(m=>m.type!=='image'&&m.type!=='video'))return reply({status:'pending'});
 if(media.some(m=>!m.path.startsWith(user.id+'/')))
  return reply({status:'pending',error:'Caminho de mídia inválido.'},422);

 // Never send known/suspected CSAM to a generic external moderation API.
 // Escalate to trained human safeguarding instead.
 if(/(?:material\s+de\s+abuso\s+sexual\s+infantil|csam)/i.test(content))
  return reply({status:'pending',reason:'Revisão de segurança especializada necessária.'});
 // Repo-based inference runs on the existing Next.js server when no paid/API worker is configured.
 // Text-only cases stay pending unless the pre-existing database rules allowed them.
 const imageUrls:string[]=[];
 if(engine==='openai')for(const item of media){
  // A privately signed, short-lived URL is created only after verifying authorship.
  const {data,error}=await admin.storage.from('social-media').createSignedUrl(item.path,120);
  if(error||!data?.signedUrl)return reply({status:'pending',reason:'Não foi possível analisar o anexo.'});
  imageUrls.push(data.signedUrl);
 }
 try{
  const result=engine==='worker'?
    await moderateWithOpenSourceWorker(content,media,admin):
    engine==='openai'?await moderateWithFreeApi(content,imageUrls):
    await moderateWithBundledModel(content,media,admin);
  const next=(result.flagged||result.humanReview)?'pending':'approved';
  const now=new Date().toISOString();
  if(kind==='post'&&row.community_id){
    // Community review mode and moderator decision take priority.
    // This provider verdict records that a model checked the content,
    // but never bypasses the community's existing review workflow.
    const {error:e}=await admin.from('posts').update({
      ai_checked_at:now,ai_provider:result.provider
    }).eq('id',id).eq('author_id',user.id).eq('content',content)
      .is('ai_checked_at',null);
    if(e)return reply({status:'pending',reason:'Aguardando moderação da comunidade.'},200);
    return reply({status:row.moderation_status,provider:result.provider,
      reason:'Conteúdo analisado; decisão final da equipe da comunidade.'});
  }
  if(kind==='post'){
   // Optimistic concurrency: content changes/extra media uploads cannot retain prior approval.
   let update=admin.from('posts').update({
     moderation_status:next,
     moderation_reason:result.reason?.slice(0,490)||(result.flagged?'Triagem automática sinalizou revisão humana':'Triagem automática concluída'),
     moderated_at:now,moderated_by:null,ai_checked_at:now,ai_provider:result.provider
   }).eq('id',id).eq('author_id',user.id).eq('content',content).is('ai_checked_at',null);
   if(row.media_path===null)update=update.is('media_path',null);
   else update=update.eq('media_path',row.media_path);
   const {data:updated,error}=await update.select('id,moderation_status').maybeSingle();
   if(error||!updated)return reply({status:'pending',reason:'Conteúdo alterado durante análise; verifique novamente.'},409);
  }else{
   const {data:updated,error}=await admin.from('stories').update({moderation_status:next})
    .eq('id',id).eq('author_id',user.id).eq('caption',content)
    .eq('media_path',row.media_path).eq('moderation_status','pending')
    .select('id').maybeSingle();
   if(error||!updated)return reply({status:'pending',reason:'Story indisponível para revisão.'},409);
  }
  return reply({status:next,provider:result.provider,reason:result.reason||
    (result.flagged?'Conteúdo sinalizado para revisão humana.':result.humanReview?
     'Modelo gratuito executado. Revisão humana complementar necessária.':'Verificação automática concluída.')});
 }catch{
  return reply({status:'pending',reason:'Serviço de IA indisponível. O conteúdo segue em análise.'});
 }
}
