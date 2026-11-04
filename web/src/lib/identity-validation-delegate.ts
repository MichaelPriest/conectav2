import {NextRequest,NextResponse} from 'next/server';

// The browser talks only to its own origin. Vercel delegates confidential
// multipart verification to the user's dedicated Render service. Never pass
// cookies, never redirect biometric payloads, and never retry a one-use challenge.
const RENDER_VALIDATION_ORIGIN='https://conectav2-validacao.onrender.com';
const allowedPaths=new Set([
 '/api/identity/free-document/verify',
 '/api/identity/free-document/liveness-challenge'
]);
const noStore={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache'};
export function shouldDelegateValidation(hostname:string,env:NodeJS.ProcessEnv=process.env):boolean{
 return env.VERCEL==='1'&&hostname!=='conectav2-validacao.onrender.com'&&
   env.CONECTA_VALIDATION_DELEGATION!=='off';
}
export async function delegateIdentityValidation(request:NextRequest):Promise<NextResponse|null>{
 const url=new URL(request.url);
 if(!shouldDelegateValidation(url.hostname))return null;
 if(request.method!=='POST'||!allowedPaths.has(url.pathname))
  return NextResponse.json({ok:false,error:'Rota de validação inválida.'},{status:400,headers:noStore});
 const bearer=request.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9_.-]+$/.test(bearer))
  return NextResponse.json({ok:false,error:'Sessão não autenticada.'},{status:401,headers:noStore});
 const size=Number(request.headers.get('content-length')||0);
 if(!Number.isFinite(size)||size>4_400_000)
  return NextResponse.json({ok:false,error:'O envio excedeu 4,4 MB.'},{status:413,headers:noStore});
 let bytes:ArrayBuffer|undefined;
 try{
  bytes=await request.arrayBuffer();
  if(bytes.byteLength>4_400_000)
   return NextResponse.json({ok:false,error:'O envio excedeu 4,4 MB.'},{status:413,headers:noStore});
  const target=new URL(url.pathname,RENDER_VALIDATION_ORIGIN);
  const reply=await fetch(target,{
   method:'POST',redirect:'manual',cache:'no-store',
   headers:{
    'Authorization':bearer,
    'Origin':RENDER_VALIDATION_ORIGIN,
    ...(request.headers.get('content-type')?{'Content-Type':request.headers.get('content-type')!}:{})
   },
   body:bytes,signal:AbortSignal.timeout(260000)
  });
  if(reply.status>=300&&reply.status<400)
   return NextResponse.json({ok:false,error:'O serviço de validação respondeu com redirecionamento inesperado.'},{status:503,headers:noStore});
  const result=await reply.text();
  if(result.length>128_000)
   return NextResponse.json({ok:false,error:'Resposta de validação inválida.'},{status:503,headers:noStore});
  const type=reply.headers.get('content-type')||'';
  if(!type.includes('application/json'))
   return NextResponse.json({ok:false,error:'O serviço de validação está indisponível. Tente mais tarde.'},{status:503,headers:noStore});
  return new NextResponse(result,{status:reply.status,headers:{...noStore,'Content-Type':'application/json; charset=utf-8'}});
 }catch{
  return NextResponse.json({ok:false,error:'O serviço dedicado de validação está indisponível. Nenhum resultado foi aprovado.'},{status:503,headers:noStore});
 }finally{
  if(bytes)new Uint8Array(bytes).fill(0);
 }
}
