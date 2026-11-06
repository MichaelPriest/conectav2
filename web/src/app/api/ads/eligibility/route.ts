import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {runtimeConfig} from '@/lib/identity-server';
import {ageAssurancePolicy} from '@/lib/age-assurance-policy';

export const runtime='nodejs';
export const dynamic='force-dynamic';

/**
 * Ads are denied unless a recent, server-authoritative age decision confirms
 * adulthood. Never trust client profile fields or the legacy verification
 * table for ad eligibility. The feature flag is an additional kill switch.
 */
export async function GET(request:NextRequest){
 const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Authorization'};
 const blocked=()=>NextResponse.json({eligible:false},{headers});
 if(process.env.CONECTA_ADS_ENABLED!=='true')return blocked();

 const url=runtimeConfig.supabaseUrl;
 const publicKey=runtimeConfig.publicKey;
 const serviceKey=runtimeConfig.serviceKey;
 const bearer=request.headers.get('authorization')?.match(/^Bearer ([\w.-]+)$/i)?.[1];
 if(!url||!publicKey||!serviceKey||!bearer)return blocked();

 try{
   const auth=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
   const {data:{user},error:authError}=await auth.auth.getUser(bearer);
   if(authError||!user)return blocked();

   // This table is service-role-only. A public client cannot manufacture or
   // edit a trusted age decision, and missing migrations/config fail closed.
   const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
   const {data,error}=await admin.from('age_assurance_decisions')
     .select('age_band,method,policy_version,evidence_reference_hash,verified_at')
     .eq('user_id',user.id).maybeSingle();
   if(error||!data)return blocked();

   const policy=ageAssurancePolicy({
     status:'verified',
     ageBand:data.age_band,
     source:data.method,
     verifiedAt:data.verified_at,
     evidenceReference:data.evidence_reference_hash
   });
   // Document-derived adulthood is adequate for opt-in advertising but does
   // not verify document ownership or enable identity-protected social actions.
   const trustedAdult=policy.ageAssurance==='verified_adult'&&policy.canAccessAdultRestrictedFeatures;
   const ageOnlyAdult=data.method==='conecta_document_age_only'
     &&data.age_band==='18_plus'
     &&typeof data.evidence_reference_hash==='string'
     &&/^[a-f0-9]{64}$/.test(data.evidence_reference_hash)
     &&typeof data.verified_at==='string'
     &&Number.isFinite(Date.parse(data.verified_at))
     &&Date.parse(data.verified_at)<=Date.now()+60_000
     &&Date.now()-Date.parse(data.verified_at)<=60*24*60*60*1000;
   if(!trustedAdult&&!ageOnlyAdult)return blocked();
   const {data:declaration,error:declarationError}=await admin
     .from('registration_age_declarations').select('declared_band').eq('user_id',user.id).maybeSingle();
   if(declarationError||declaration?.declared_band!=='18_plus')return blocked();

   // The user must also opt in on the client before loading any third-party ad.
   return NextResponse.json({eligible:true},{headers});
 }catch{return blocked();}
}
