import {NextRequest,NextResponse} from 'next/server';
import {identityContext} from '@/lib/identity-server';

export const runtime='nodejs';
export const dynamic='force-dynamic';
type ContentKind='post'|'story';
type MediaKind='image'|'video';
type ScanResult={flagged:boolean;provider:string};
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

export async function POST(request:NextRequest){
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return reply({error:'Origem inválida.'},403);
 const context=await identityContext(request);
 if(!context)return reply({error:'Autenticação administrativa do servidor indisponível ou sessão inválida.'},401);
 let body:{kind?:ContentKind;id?:string};
 try{body=await request.json();}catch{return reply({error:'Dados inválidos.'},400);}
 if(!validId(body.id)||(body.kind!=='post'&&body.kind!=='story'))return reply({error:'Conteúdo inválido.'},400);
 const {user,admin}=context,kind=body.kind,id=body.id!;
 const table=kind==='post'?'posts':'stories';
 const {data:record,error:fetchError}=await admin.from(table)
  .select(kind==='post'?'id,author_id,content,media_path,media_type,moderation_status,ai_checked_at,community_id':'id,author_id,caption,media_path,media_type,moderation_status,expires_at')
  .eq('id',id).maybeSingle();
 if(fetchError||!record)return reply({error:'Conteúdo não encontrado.'},404);
 if(record.author_id!==user.id)return reply({error:'Você não pode moderar o conteúdo de terceiros.'},403);
 if(kind==='story'&&new Date(record.expires_at as string).getTime()<Date.now())
  return reply({status:'expired'},200);
 if(kind==='post'&&record.ai_checked_at)return reply({status:record.moderation_status,alreadyChecked:true});
 if(record.moderation_status==='rejected')return reply({status:'rejected'},200);
 const content=kind==='post'?String(record.content||''):String(record.caption||'');
 const media:{path:string;type:MediaKind}[]=[];
 if(kind==='post'){
  const {data:gallery,error:galleryError}=await admin.from('post_media').select('storage_path,media_type')
   .eq('post_id',id).order('position',{ascending:true}).limit(6);
  if(galleryError)return reply({status:'pending',error:'Arquivo ainda não foi verificado.'},503);
  for(const g of gallery||[])media.push({path:g.storage_path,type:g.media_type as MediaKind});
 }
 if(media.length===0&&record.media_path)
  media.push({path:record.media_path as string,type:record.media_type as MediaKind});
 if(media.length>5)return reply({status:'pending',error:'Número de mídias exige revisão manual.'},200);
 if(media.some(m=>m.type==='video'))
  return reply({status:'pending',reason:'Vídeos aguardam análise de quadros e revisão humana.'});
 if(media.some(m=>m.type!=='image'))return reply({status:'pending'});
 if(media.some(m=>!m.path.startsWith(user.id+'/')))
  return reply({status:'pending',error:'Caminho de mídia inválido.'},422);

 // Never send known/suspected CSAM to a generic external moderation API.
 // Escalate to trained human safeguarding instead.
 if(/(?:material\s+de\s+abuso\s+sexual\s+infantil|csam)/i.test(content))
  return reply({status:'pending',reason:'Revisão de segurança especializada necessária.'});
 if(!process.env.OPENAI_API_KEY)
  return reply({status:record.moderation_status,provider:'unconfigured',
    reason:'IA externa não configurada. Arquivos permanecem em revisão.'});
 const imageUrls:string[]=[];
 for(const item of media){
  // A privately signed, short-lived URL is created only after verifying authorship.
  const {data,error}=await admin.storage.from('social-media').createSignedUrl(item.path,120);
  if(error||!data?.signedUrl)return reply({status:'pending',reason:'Não foi possível analisar o anexo.'});
  imageUrls.push(data.signedUrl);
 }
 try{
  const result=await moderateWithFreeApi(content,imageUrls);
  const next=result.flagged?'pending':'approved';
  const now=new Date().toISOString();
  if(kind==='post'){
   // Optimistic concurrency: content changes/extra media uploads cannot retain prior approval.
   let update=admin.from('posts').update({
     moderation_status:next,
     moderation_reason:result.flagged?'IA sinalizou conteúdo para revisão humana':'',
     moderated_at:now,moderated_by:null,ai_checked_at:now,ai_provider:result.provider
   }).eq('id',id).eq('author_id',user.id).eq('content',content).is('ai_checked_at',null);
   if(record.media_path===null)update=update.is('media_path',null);
   else update=update.eq('media_path',record.media_path);
   const {data:updated,error}=await update.select('id,moderation_status').maybeSingle();
   if(error||!updated)return reply({status:'pending',reason:'Conteúdo alterado durante análise; verifique novamente.'},409);
  }else{
   const {data:updated,error}=await admin.from('stories').update({moderation_status:next})
    .eq('id',id).eq('author_id',user.id).eq('caption',content)
    .eq('media_path',record.media_path).eq('moderation_status','pending')
    .select('id').maybeSingle();
   if(error||!updated)return reply({status:'pending',reason:'Story indisponível para revisão.'},409);
  }
  return reply({status:next,provider:result.provider,reason:result.flagged?
    'Conteúdo encaminhado à revisão humana.':'Verificação automática concluída.'});
 }catch{
  return reply({status:'pending',reason:'Serviço de IA indisponível. O conteúdo segue em análise.'});
 }
}
