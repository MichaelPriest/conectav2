import {NextRequest,NextResponse} from 'next/server';
import {identityConfigured,identityContext,personaRequest,runtimeConfig,safePersonaLink} from '@/lib/identity-server';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function POST(request:NextRequest){
  if(!identityConfigured())return NextResponse.json(
    {error:'Verificação por câmera ainda não ativada. É necessário contratar e configurar o provedor.'},
    {status:503}
  );
  const context=await identityContext(request);
  if(!context)return NextResponse.json({error:'Entre na sua conta para continuar.'},{status:401});
  // Prevent cross-origin side effects even if a browser forwards bearer credentials.
  const origin=request.headers.get('origin');
  if(origin && origin!==new URL(request.url).origin)return NextResponse.json({error:'Origem inválida.'},{status:403});

  const {data:previous,error:readError}=await context.admin.from('identity_verifications')
    .select('status,created_at').eq('user_id',context.user.id).maybeSingle();
  if(readError)return NextResponse.json({error:'Não foi possível consultar a verificação.'},{status:503});
  if(previous?.status==='approved')return NextResponse.json({error:'Sua identidade já foi confirmada.'},{status:409});
  if(previous?.status==='pending' && Date.now()-new Date(previous.created_at).getTime()<15*60_000){
    return NextResponse.json({error:'Já existe uma verificação iniciada. Consulte o status antes de iniciar outra.'},{status:429});
  }
  try{
    const inquiry=await personaRequest('https://api.withpersona.com/api/v1/inquiries',{
      method:'POST',
      body:JSON.stringify({data:{attributes:{
        'inquiry-template-id':runtimeConfig.inquiryTemplate,
        'reference-id':context.user.id
      }}})
    });
    const id=inquiry.data?.id;
    const url=safePersonaLink(inquiry.meta?.['one-time-link']);
    if(!id?.startsWith('inq_')||!url)throw new Error('Provider did not return a valid inquiry');
    const {error:writeError}=await context.admin.from('identity_verifications').upsert({
      user_id:context.user.id,provider:'persona',provider_inquiry_id:id,
      status:'pending',age_band:'unknown',guardian_status:'pending',
      created_at:new Date().toISOString(),updated_at:new Date().toISOString(),
      verified_at:null
    },{onConflict:'user_id'});
    if(writeError)throw writeError;
    return NextResponse.json({url},{headers:{'Cache-Control':'no-store'}});
  }catch{
    return NextResponse.json({error:'Não foi possível iniciar a verificação segura. Tente mais tarde.'},{status:502});
  }
}
