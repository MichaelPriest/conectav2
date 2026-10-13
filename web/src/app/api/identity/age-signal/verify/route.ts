import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {NextRequest,NextResponse} from 'next/server';
import {identityUserContext,runtimeConfig} from '@/lib/identity-server';
import {isTrustedIdentityOrigin} from '@/lib/identity-origin';
import {hashAgeSignalRequest,type AgeSignalPayload} from '@/lib/age-signal-request';
import {PlayIntegrityVerificationError,verifyPlayIntegrityToken} from '@/lib/play-integrity';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization'};

type AgeBand='0_12'|'13_15'|'16_17'|'18_plus';

function classifyAgeBand(lower:number,upper:number|null):AgeBand|null{
 if(lower>=18&&upper===null)return '18_plus';
 if(upper!==null&&upper<=12)return '0_12';
 if(lower>=13&&upper!==null&&upper<=15)return '13_15';
 if(lower>=16&&upper!==null&&upper<=17)return '16_17';
 return null;
}

export async function POST(request:NextRequest){
 const declaredLength=Number(request.headers.get('content-length')||0);
 if(declaredLength>30_000){
  return NextResponse.json({error:'Solicitação muito grande.'},{status:413,headers});
 }
 if(!isTrustedIdentityOrigin(request.headers,request.url,process.env)){
  return NextResponse.json({error:'Origem não autorizada.'},{status:403,headers});
 }
 const context=await identityUserContext(request);
 if(!context)return NextResponse.json({error:'Entre na sua conta para continuar.'},{status:401,headers});
 if(!runtimeConfig.supabaseUrl||!runtimeConfig.serviceKey){
  return NextResponse.json({status:'unavailable',error:'A validação segura não está configurada.'},{status:503,headers});
 }

 let body:Record<string,unknown>;
 try{
  body=await request.json() as Record<string,unknown>;
 }catch{
  return NextResponse.json({error:'Corpo da solicitação inválido.'},{status:400,headers});
 }

 const challenge=body.challenge;
 const integrityToken=body.integrityToken;
 const ageLower=body.ageLower;
 const ageUpper=body.ageUpper;
 const ageRangeSource=body.ageRangeSource;
 const approval=body.significantChangeApprovalDate;
 if(typeof challenge!=='string'||!/^[0-9a-f]{64}$/.test(challenge)||
    typeof integrityToken!=='string'||integrityToken.length<100||integrityToken.length>20000||
    !Number.isInteger(ageLower)||typeof ageLower!=='number'||ageLower<0||ageLower>18||
    !(ageUpper===null||(typeof ageUpper==='number'&&Number.isInteger(ageUpper)&&ageUpper>=0&&ageUpper<=18))||
    typeof ageRangeSource!=='string'||!['TIER_A','TIER_B','TIER_C','TIER_D'].includes(ageRangeSource)||
    !(approval===null||(typeof approval==='number'&&Number.isSafeInteger(approval)&&approval>0&&approval<=Date.now()+30_000))){
  return NextResponse.json({error:'Os dados de faixa etária são inválidos.'},{status:400,headers});
 }

 const signal:AgeSignalPayload={
  ageLower,
  ageUpper:ageUpper as number|null,
  ageRangeSource,
  significantChangeApprovalDate:approval as number|null
 };
 const requestHash=hashAgeSignalRequest(challenge,signal);
 let integrity:{timestampMillis:number;packageName:string};
 try{
  integrity=await verifyPlayIntegrityToken(integrityToken,requestHash);
 }catch(error){
  if(error instanceof PlayIntegrityVerificationError){
   const status=error.code==='not_configured'?503:
    error.code==='untrusted_app'||error.code==='untrusted_device'?403:400;
   return NextResponse.json({
    status:error.code==='not_configured'?'unavailable':'rejected',
    error:error.code==='not_configured'
      ?'A verificação do Google Play ainda não está configurada no servidor.'
      :'Não foi possível validar a integridade do aplicativo e da solicitação.'
   },{status,headers});
  }
  return NextResponse.json({status:'unavailable',error:'O serviço de integridade está temporariamente indisponível.'},{status:503,headers});
 }

 const admin=createClient(runtimeConfig.supabaseUrl,runtimeConfig.serviceKey,{
  auth:{persistSession:false,autoRefreshToken:false}
 });
 const challengeHash=createHash('sha256').update(challenge,'utf8').digest('hex');
 const {data:consumed,error:consumeError}=await admin.rpc('consume_age_assurance_challenge',{
  p_user_id:context.user.id,
  p_challenge_hash:challengeHash
 });
 if(consumeError){
  return NextResponse.json({status:'unavailable',error:'Não foi possível consumir o desafio de segurança.'},{status:503,headers});
 }
 if(consumed!==true){
  return NextResponse.json({status:'rejected',error:'O desafio expirou ou já foi utilizado. Inicie novamente.'},{status:409,headers});
 }

 const ageBand=classifyAgeBand(ageLower,signal.ageUpper);
 // Self-declared age is not sufficient to persist a trusted decision. It may
 // still trigger the protective experience, but it never becomes verified.
 if(ageRangeSource==='TIER_A'||!ageBand||(ageRangeSource==='TIER_B'&&ageBand==='18_plus')){
  return NextResponse.json({
   status:'preflight_only',
   ageAssurance:'unknown',
   accountSafetyMode:'minor_protected',
   canAccessAdultRestrictedFeatures:false,
   message:'O sinal recebido não atende ao nível necessário para registrar uma decisão confiável. As proteções permanecem ativas.'
  },{headers});
 }

 const verifiedAt=new Date(integrity.timestampMillis).toISOString();
 const evidenceReferenceHash=createHash('sha256')
  .update([context.user.id,challengeHash,requestHash,String(integrity.timestampMillis)].join('|'),'utf8')
  .digest('hex');
 const {error:saveError}=await admin.from('age_assurance_decisions').upsert({
  user_id:context.user.id,
  age_band:ageBand,
  method:'verified_platform_age_signal',
  policy_version:'play-age-signals-v1',
  evidence_reference_hash:evidenceReferenceHash,
  verified_at:verifiedAt,
  updated_at:new Date().toISOString()
 },{onConflict:'user_id'});
 if(saveError){
  return NextResponse.json({status:'unavailable',error:'Não foi possível salvar a decisão de idade.'},{status:503,headers});
 }

 return NextResponse.json({
  status:'verified',
  ageBand,
  ageAssurance:ageBand==='18_plus'?'verified_adult':'verified_minor',
  accountSafetyMode:ageBand==='18_plus'?'standard':'minor_protected',
  canAccessAdultRestrictedFeatures:ageBand==='18_plus',
  mustApplyMinorProtections:ageBand!=='18_plus',
  verifiedAt,
  policyVersion:'play-age-signals-v1',
  message:'O sinal foi validado pelo servidor. As permissões ainda devem ser aplicadas em cada recurso.'
 },{headers});
}
