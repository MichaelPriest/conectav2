import {NextRequest,NextResponse} from 'next/server';
import {identityContext} from '@/lib/identity-server';
import {generateStatementPdf,newNonce} from '@/lib/govbr-challenge';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'private, no-store, max-age=0'};
const deny=(error:string,status:number)=>NextResponse.json({error},{status,headers:noStore});

export async function GET(request:NextRequest){
 const ctx=await identityContext(request);
 if(!ctx)return deny('Sessao invalida ou servidor de verificacao nao configurado.',401);
 const {data,error}=await ctx.admin.from('identity_signature_challenges')
   .select('id,expires_at,status,created_at')
   .eq('user_id',ctx.user.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(error)return deny('Nao foi possivel consultar sua declaracao.',503);
 const active=data&&Date.parse(data.expires_at)>Date.now()?data:null;
 return NextResponse.json({challenge:active},{headers:noStore});
}
export async function POST(request:NextRequest){
 const ctx=await identityContext(request);
 if(!ctx)return deny('Sessao invalida ou servidor de verificacao nao configurado.',401);
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return deny('Origem invalida.',403);
 const since=new Date(Date.now()-24*60*60*1000).toISOString();
 const {count,error:limitError}=await ctx.admin.from('identity_signature_challenges')
   .select('id',{count:'exact',head:true}).eq('user_id',ctx.user.id).gte('created_at',since);
 if(limitError)return deny('Servico temporariamente indisponivel.',503);
 if((count||0)>=3)return deny('Limite de 3 declaracoes a cada 24 horas. Utilize a ultima declaracao gerada.',429);
 const nonce=newNonce();
 const expiry=new Date(Date.now()+24*60*60*1000).toISOString();
 const {data,error}=await ctx.admin.from('identity_signature_challenges')
   .insert({user_id:ctx.user.id,nonce,expires_at:expiry,status:'issued'})
   .select('id,expires_at').single();
 if(error||!data)return deny('Nao foi possivel gerar a declaracao.',503);
 try{
  const pdf=await generateStatementPdf(data.id,nonce,data.expires_at);
  return new NextResponse(Buffer.from(pdf),{
    status:200,
    headers:{...noStore,'Content-Type':'application/pdf',
     'Content-Disposition':'attachment; filename="conecta-id-declaracao.pdf"',
     'X-Challenge-Id':data.id,'X-Challenge-Expires':data.expires_at}
  });
 }catch{return deny('Nao foi possivel preparar o PDF.',503);}
}
