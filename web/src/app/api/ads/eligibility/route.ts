import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';

export const runtime='nodejs';
export const dynamic='force-dynamic';

/**
 * Fail closed. Ad scripts from third parties must never load on accounts without
 * trustworthy adult age assurance, even if the user declared themselves adult.
 * A selfie/liveness test from Human DOES NOT qualify as an age attestation.
 */
export async function GET(request:NextRequest){
 const headers={'Cache-Control':'private, no-store, max-age=0'};
 const blocked=()=>NextResponse.json({eligible:false},{headers});
 if(process.env.CONECTA_ADS_ENABLED!=='true')return blocked();
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 const bearer=request.headers.get('authorization')?.match(/^Bearer ([\w.-]+)$/i)?.[1];
 if(!url||!key||!bearer)return blocked();
 try{
   const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
   const {data:{user},error:authError}=await auth.auth.getUser(bearer);
   if(authError||!user)return blocked();
   const db=createClient(url,key,{
     auth:{persistSession:false,autoRefreshToken:false},
     global:{headers:{Authorization:'Bearer '+bearer}}
   });
   const {data,error}=await db.from('identity_verifications')
     .select('status,age_band,verified_at')
     .eq('user_id',user.id).maybeSingle();
   if(error||!data)return blocked();
   const adult=data.status==='approved' && data.age_band==='18_plus' && Boolean(data.verified_at);
   if(!adult)return blocked();
   // A verified 18+ attestation, issued by a real provider, is required.
   // The user must also opt-in on the client before loading a third-party frame.
   return NextResponse.json({eligible:true},{headers});
 }catch{return blocked();}
}
