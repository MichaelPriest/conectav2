import {NextRequest,NextResponse} from 'next/server';
import {identityContext} from '@/lib/identity-server';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(value:unknown,status=200)=>NextResponse.json(value,{
 status,headers:{'Cache-Control':'no-store'}
});

/** Checks only a comment owned by the verified session. No private DMs are sent. */
export async function POST(request:NextRequest){
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return json({error:'Origem inválida.'},403);
 const ctx=await identityContext(request);
 if(!ctx)return json({error:'Sessão de moderação indisponível.'},401);
 let input:{id?:string};
 try{input=await request.json();}catch{return json({error:'Dados inválidos.'},400);}
 if(!input.id||!uuid.test(input.id))return json({error:'ID inválido.'},400);

 const {data:comment,error}=await ctx.admin.from('post_comments')
   .select('id,post_id,author_id,body,moderation_status,checked_at')
   .eq('id',input.id).maybeSingle();
 if(error||!comment)return json({error:'Comentário indisponível.'},404);
 if(comment.author_id!==ctx.user.id)return json({error:'Sem permissão.'},403);
 if(comment.moderation_status!=='pending'||comment.checked_at)
   return json({status:comment.moderation_status,reason:'Estado já registrado.'});
 const content=comment.body.trim();
 if(!content)return json({status:'pending',reason:'Texto não analisável.'});

 // Dedicated child safety workflows are required; do not forward identified
 // suspected CSAM to generic external classifiers.
 if(/(?:material\s+de\s+abuso\s+sexual\s+infantil|csam)/i.test(content))
   return json({status:'pending',reason:'Necessária revisão humana especializada.'});

 const openaiKey=process.env.OPENAI_API_KEY;
 const workerUrl=process.env.CONEXA_MODERATION_WORKER_URL;
 const workerToken=process.env.CONEXA_MODERATION_WORKER_TOKEN;
 if(!openaiKey&&!workerUrl)return json({
   status:'pending',reason:'Moderação humana necessária até a configuração de um provedor gratuito.'
 });
 try{
   let flagged:boolean,provider:string;
   let allowAutomaticApproval=false;
   if(workerUrl){
     if(!workerToken)throw Error('worker_missing_secret');
     const endpoint=new URL(workerUrl);
     if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash)
       throw Error('invalid_worker_url');
     const form=new FormData();form.set('content',content);
     const res=await fetch(new URL('/classify',endpoint),{
       method:'POST',headers:{Authorization:'Bearer '+workerToken},body:form,
       signal:AbortSignal.timeout(25000),cache:'no-store'
     });
     if(!res.ok)throw Error('worker_unavailable');
     const verdict=await res.json() as {flagged?:boolean;engine?:string};
     if(typeof verdict.flagged!=='boolean')throw Error('worker_invalid');
     flagged=verdict.flagged;provider='opensource-text';
     // A toxicity-only model cannot clear other categories of risk by itself.
     allowAutomaticApproval=false;
   }else{
     const res=await fetch('https://api.openai.com/v1/moderations',{
       method:'POST',
       headers:{'Content-Type':'application/json',Authorization:'Bearer '+openaiKey},
       body:JSON.stringify({model:'omni-moderation-latest',input:content}),
       signal:AbortSignal.timeout(15000),cache:'no-store'
     });
     if(!res.ok)throw Error('moderation_provider_unavailable');
     const verdict=await res.json() as {results?:{flagged?:boolean}[]};
     if(!verdict.results?.length||typeof verdict.results[0].flagged!=='boolean')
       throw Error('moderation_invalid');
     flagged=verdict.results.some(item=>item.flagged===true);
     provider='omni-moderation-latest';
     allowAutomaticApproval=!flagged;
   }
   const next=allowAutomaticApproval?'approved':'pending';
   const {data:updated,error:updateError}=await ctx.admin.from('post_comments').update({
     moderation_status:next,moderation_reason:flagged?'Conteúdo sinalizado para análise humana':allowAutomaticApproval?'':'Revisão humana complementar obrigatória',
     ai_provider:provider,checked_at:new Date().toISOString()
   }).eq('id',comment.id).eq('author_id',ctx.user.id)
     .eq('moderation_status','pending').is('checked_at',null).eq('body',comment.body)
     .select('id,moderation_status').maybeSingle();
   if(updateError||!updated)return json({status:'pending',reason:'Alteração detectada: análise manual necessária.'});
   return json({
    status:next,
    reason:next==='approved'?'Comentário verificado e publicado.':'Comentário encaminhado à revisão humana.'
   });
 }catch{
   return json({status:'pending',reason:'Verificador indisponível. Comentário permanece em revisão.'});
 }
}
