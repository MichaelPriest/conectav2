import {createClient} from '@supabase/supabase-js';
import {NextRequest,NextResponse} from 'next/server';
import {identityUserContext,runtimeConfig} from '@/lib/identity-server';
import {ageAssurancePolicy} from '@/lib/age-assurance-policy';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization'};

const unknownPolicy=()=>ageAssurancePolicy(null);

/**
 * Returns only a coarse age-assurance decision. The decision is read from a
 * service-role-only table after authenticating the caller; client profile
 * fields, self-declared age and browser-side checks are never consulted.
 */
export async function GET(request:NextRequest){
 const context=await identityUserContext(request);
 if(!context)return NextResponse.json({error:'Entre na sua conta para consultar a proteção etária.'},{status:401,headers});

 if(!runtimeConfig.supabaseUrl||!runtimeConfig.serviceKey){
  return NextResponse.json({
   ...unknownPolicy(),
   status:'unavailable',
   policyVersion:'age-assurance-v1',
   message:'A aferição confiável de idade ainda não está configurada.'
  },{status:503,headers});
 }

 const admin=createClient(runtimeConfig.supabaseUrl,runtimeConfig.serviceKey,{
  auth:{persistSession:false,autoRefreshToken:false}
 });
 const {data,error}=await admin
  .from('age_assurance_decisions')
  .select('age_band,method,policy_version,evidence_reference_hash,verified_at')
  .eq('user_id',context.user.id)
  .maybeSingle();

 if(error){
  // Missing migration, DB error or invalid schema never falls back to a client claim.
  return NextResponse.json({
   ...unknownPolicy(),
   status:'unavailable',
   policyVersion:'age-assurance-v1',
   message:'Não foi possível consultar a aferição de idade. Os recursos restritos continuam bloqueados.'
  },{status:503,headers});
 }

 const decision=data?{
  status:'verified',
  ageBand:data.age_band,
  source:data.method,
  policyVersion:data.policy_version,
  evidenceReference:data.evidence_reference_hash,
  verifiedAt:data.verified_at
 }:null;
 const policy=ageAssurancePolicy(decision);
 const currentDecision=policy.ageAssurance!=='unknown';
 return NextResponse.json({
  ...policy,
  status:currentDecision?'available':'pending',
  policyVersion:data?.policy_version??'age-assurance-v1',
  verifiedAt:data?.verified_at??null,
  message:currentDecision
   ?'A proteção etária foi consultada no servidor.'
   :'Não há aferição confiável vigente. Os recursos restritos continuam bloqueados.'
 },{headers});
}
