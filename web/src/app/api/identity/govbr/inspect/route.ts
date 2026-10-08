import {NextRequest,NextResponse} from 'next/server';
import {identityUserContext} from '@/lib/identity-server';
import {isTrustedIdentityOrigin} from '@/lib/identity-origin';
import {challengeMarker,MAX_SIGNED_PDF_BYTES} from '@/lib/govbr-challenge';
import {inspectSignedStatement} from '@/lib/govbr-pdf-inspect';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0'};
const fail=(message:string,status:number)=>NextResponse.json({error:message},{status,headers});
export async function POST(request:NextRequest){
 if(!isTrustedIdentityOrigin(request.headers,request.url,process.env))return fail('Origem invalida.',403);
 const length=Number(request.headers.get('content-length')||0);
 if(length>MAX_SIGNED_PDF_BYTES+32768)return fail('Arquivo excede 6 MB.',413);
 const ctx=await identityUserContext(request);
 if(!ctx)return fail('Entre na sua conta para continuar.',401);
 let form:FormData;
 try{form=await request.formData();}catch{return fail('Formulario invalido.',400);}
 const id=form.get('challenge_id');
 const pdfFile=form.get('pdf');
 if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id)||!(pdfFile instanceof File))
  return fail('Selecione um PDF e uma declaracao valida.',400);
 if(pdfFile.size<100||pdfFile.size>MAX_SIGNED_PDF_BYTES)return fail('Envie um PDF de ate 6 MB.',413);
 const {data,error}=await ctx.db.from('identity_signature_challenges')
   .select('id,nonce,expires_at,status,attempt_count').eq('user_id',ctx.user.id).eq('id',id).maybeSingle();
 if(error||!data)return fail('Declaracao nao encontrada.',404);
 if(data.status!=='issued'||Date.parse(data.expires_at)<=Date.now())
  return fail('Declaracao ja analisada ou expirada. Gere outra se necessario.',409);
 if(data.attempt_count>=5)return fail('Limite de 5 tentativas esgotado.',429);
 const {data:attempt,error:attemptError}=await ctx.db.from('identity_signature_challenges')
   .update({attempt_count:data.attempt_count+1})
   .eq('id',id).eq('user_id',ctx.user.id).eq('status','issued')
   .eq('attempt_count',data.attempt_count).select('attempt_count').maybeSingle();
 if(attemptError||!attempt)return fail('Limite de tentativas ou concorrencia. Recarregue a pagina.',429);
 const pdf=Buffer.from(await pdfFile.arrayBuffer());
 const result=await inspectSignedStatement(pdf,challengeMarker(id,data.nonce));
 // Integrity is reported only for this request. A client-visible JWT cannot
 // grant an identity status or change the table's protected verification fields.
 // No uploaded PDF, signature or digest is retained.
 return NextResponse.json({
   status:result.status,detail:result.detail,
   officialVerificationRequired:true,identityVerified:false,ageVerified:false,
   documentStored:false
 },{headers});
}
