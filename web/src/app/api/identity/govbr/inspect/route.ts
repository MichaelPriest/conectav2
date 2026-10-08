import {NextRequest,NextResponse} from 'next/server';
import {identityContext} from '@/lib/identity-server';
import {challengeMarker,MAX_SIGNED_PDF_BYTES,pdfHash} from '@/lib/govbr-challenge';
import {inspectSignedStatement} from '@/lib/govbr-pdf-inspect';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0'};
const fail=(message:string,status:number)=>NextResponse.json({error:message},{status,headers});
export async function POST(request:NextRequest){
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return fail('Origem invalida.',403);
 const length=Number(request.headers.get('content-length')||0);
 if(length>MAX_SIGNED_PDF_BYTES+32768)return fail('Arquivo excede 6 MB.',413);
 const ctx=await identityContext(request);
 if(!ctx)return fail('Entre na sua conta para continuar.',401);
 let form:FormData;
 try{form=await request.formData();}catch{return fail('Formulario invalido.',400);}
 const id=form.get('challenge_id');
 const pdfFile=form.get('pdf');
 if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id)||!(pdfFile instanceof File))
  return fail('Selecione um PDF e uma declaracao valida.',400);
 if(pdfFile.size<100||pdfFile.size>MAX_SIGNED_PDF_BYTES)return fail('Envie um PDF de ate 6 MB.',413);
 const {data,error}=await ctx.admin.from('identity_signature_challenges')
   .select('id,nonce,expires_at,status,attempt_count').eq('user_id',ctx.user.id).eq('id',id).maybeSingle();
 if(error||!data)return fail('Declaracao nao encontrada.',404);
 if(data.status!=='issued'||Date.parse(data.expires_at)<=Date.now())
  return fail('Declaracao ja analisada ou expirada. Gere outra se necessario.',409);
 if(data.attempt_count>=5)return fail('Limite de 5 tentativas esgotado.',429);
 const {error:attemptError}=await ctx.admin.from('identity_signature_challenges')
   .update({attempt_count:data.attempt_count+1}).eq('id',id).eq('status','issued').eq('attempt_count',data.attempt_count);
 if(attemptError)return fail('Nao foi possivel registrar tentativa.',503);
 const pdf=Buffer.from(await pdfFile.arrayBuffer());
 const result=await inspectSignedStatement(pdf,challengeMarker(id,data.nonce));
 if(result.status==='integrity_checked'){
  const {error:markError}=await ctx.admin.from('identity_signature_challenges')
   .update({status:'integrity_checked',inspected_at:new Date().toISOString(),document_digest:pdfHash(pdf)})
   .eq('id',id).eq('user_id',ctx.user.id).eq('status','issued');
  if(markError)return fail('Verificacao inconclusiva. Tente novamente.',503);
 }
 return NextResponse.json({
   status:result.status,detail:result.detail,
   officialVerificationRequired:true,identityVerified:false,ageVerified:false,
   documentStored:false
 },{headers});
}
