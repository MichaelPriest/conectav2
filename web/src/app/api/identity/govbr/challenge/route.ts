import {NextRequest,NextResponse} from 'next/server';
import {identityUserContext} from '@/lib/identity-server';
import {generateStatementPdf,newNonce} from '@/lib/govbr-challenge';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'private, no-store, max-age=0'};
const deny=(error:string,status:number)=>NextResponse.json({error},{status,headers:noStore});

type Row={id:string;nonce:string;expires_at:string;status:string;created_at:string};

function makePdf(pdf:Uint8Array,id:string,expiresAt:string){
 return new NextResponse(Buffer.from(pdf),{
  status:200,headers:{...noStore,
   'Content-Type':'application/pdf',
   'Content-Disposition':'attachment; filename="conecta-id-declaracao.pdf"',
   'X-Content-Type-Options':'nosniff',
   'X-Challenge-Id':id,'X-Challenge-Expires':expiresAt
  }
 });
}
export async function GET(request:NextRequest){
 const ctx=await identityUserContext(request);
 if(!ctx)return deny('Sua sessao expirou. Entre novamente para baixar a declaracao.',401);
 const {data,error}=await ctx.db.from('identity_signature_challenges')
  .select('id,nonce,expires_at,status,created_at')
  .eq('user_id',ctx.user.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(error)return deny('Falha ao buscar a declaracao no Supabase. Atualize sua sessao.',503);
 const active=data&&Date.parse(data.expires_at)>Date.now()?data as Row:null;
 if(request.nextUrl.searchParams.get('download')==='1'){
  if(!active||active.status!=='issued')return deny('Nenhuma declaracao ativa. Gere uma nova.',404);
  try{return makePdf(await generateStatementPdf(active.id,active.nonce,active.expires_at),active.id,active.expires_at);}
  catch{return deny('O PDF nao pode ser reconstruido. Tente novamente.',503);}
 }
 return NextResponse.json({challenge:active?{
  id:active.id,expires_at:active.expires_at,status:active.status,created_at:active.created_at
 }:null},{headers:noStore});
}

export async function POST(request:NextRequest){
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return deny('Origem invalida.',403);
 const ctx=await identityUserContext(request);
 if(!ctx)return deny('Sua sessao expirou. Entre novamente para baixar a declaracao.',401);
 const {data,error}=await ctx.db.from('identity_signature_challenges')
  .insert({user_id:ctx.user.id,nonce:newNonce(),status:'issued'})
  .select('id,nonce,expires_at').single();
 if(error){
  if(error.code==='P0001'||/3 declaracoes/i.test(error.message))
   return deny('Limite de 3 declaracoes a cada 24 horas. Use a ultima declaracao ativa.',429);
  return deny('Nao foi possivel registrar o PDF. Atualize a pagina e tente novamente.',503);
 }
 if(!data)return deny('Nao foi possivel preparar a declaracao.',503);
 try{
  return makePdf(await generateStatementPdf(data.id,data.nonce,data.expires_at),data.id,data.expires_at);
 }catch{
  // No new challenge is needed: GET ?download=1 regenerates exactly this PDF.
  return deny('Declaracao registrada, mas o PDF nao foi entregue. Use "Reabrir ultima declaracao".',503);
 }
}
