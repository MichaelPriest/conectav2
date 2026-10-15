import {createHash,randomBytes} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {identityContext} from '@/lib/identity-server';
import {isTrustedIdentityOrigin} from '@/lib/identity-origin';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization'};

export async function POST(request:NextRequest){
 if(!isTrustedIdentityOrigin(request.headers,request.url,process.env))
  return NextResponse.json({error:'Origem não autorizada.'},{status:403,headers});
 const context=await identityContext(request);
 if(!context)return NextResponse.json({error:'Entre na sua conta para continuar.'},{status:401,headers});

 const since=new Date(Date.now()-10*60*1000).toISOString();
 const {count,error:rateError}=await context.admin.from('identity_liveness_challenges')
  .select('id',{count:'exact',head:true}).eq('user_id',context.user.id).gte('created_at',since);
 if(rateError)return NextResponse.json({error:'O serviço de vivacidade está indisponível.'},{status:503,headers});
 if((count||0)>=5)return NextResponse.json({error:'Limite de 5 desafios em 10 minutos. Aguarde antes de tentar novamente.'},{status:429,headers});

 const challenge=randomBytes(32).toString('hex');
 const challengeHash=createHash('sha256').update(challenge,'utf8').digest('hex');
 const turnOrder=['left','right'];
 const createdAt=Date.now();
 const expiresAt=new Date(createdAt+90*1000).toISOString();
 const {error}=await context.admin.from('identity_liveness_challenges').insert({
  user_id:context.user.id,challenge_hash:challengeHash,turn_order:turnOrder,expires_at:expiresAt
 });
 if(error)return NextResponse.json({error:'Não foi possível iniciar o desafio de vivacidade.'},{status:503,headers});
 return NextResponse.json({
  status:'challenge_created',challenge,turnOrder,createdAt,expiresAt,
  instructions:['Olhe para a câmera de frente.',...turnOrder.map((side:string)=>side==='left'?'Vire a cabeça para a esquerda.':'Vire a cabeça para a direita.'),'Volte a olhar para a câmera.'],
  policyVersion:'identity-liveness-v1'
 },{headers});
}
