import {NextRequest,NextResponse} from 'next/server';
import {identityUserContext} from '@/lib/identity-server';
import {isTrustedIdentityOrigin} from '@/lib/identity-origin';
import {completionFromRecords,completionResult} from '@/lib/identity-completion';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0'};
async function inspect(request:NextRequest){
 const context=await identityUserContext(request);
 if(!context)return NextResponse.json({error:'Sessao expirada. Entre novamente.'},{status:401,headers});
 const [profile,age]=await Promise.all([
  context.db.from('profiles').select('id').eq('id',context.user.id).maybeSingle(),
  context.db.from('registration_age_declarations').select('declared_band').eq('user_id',context.user.id).maybeSingle()
 ]);
 if(profile.error||age.error)return NextResponse.json({error:'Nao foi possivel consultar o cadastro.'},{status:503,headers});
 const state=completionFromRecords(Boolean(profile.data),age.data?.declared_band);
 return NextResponse.json(completionResult(state),{headers});
}
/** Read-only. A successful response reports an existing BASIC signup, not ID verification. */
export async function GET(request:NextRequest){return inspect(request);}
export async function POST(request:NextRequest){
 if(!isTrustedIdentityOrigin(request.headers,request.url,process.env))
  return NextResponse.json({error:'Origem invalida.'},{status:403,headers});
 return inspect(request);
}
