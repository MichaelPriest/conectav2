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
 const bearer=request.headers.get('authorization')?.match(/^Bearer ([\\w.-]+)$/i)?.[1];
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
   if(policy.ageAssurance!=='verified_adult'||!policy.canAccessAdultRestrictedFeatures)return blocked();

   // The user must also opt in on the client before loading any third-party ad.
   return NextResponse.json({eligible:true},{headers});
 }catch{return blocked();}
}
