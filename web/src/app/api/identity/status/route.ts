import {NextRequest,NextResponse} from 'next/server';
import {identityConfigured,identityContext,personaRequest} from '@/lib/identity-server';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request:NextRequest){
  if(!identityConfigured())return NextResponse.json(
    {configured:false,status:'unavailable',age_band:'unknown',guardian_status:'pending'},
    {headers:{'Cache-Control':'no-store'}}
  );
  const context=await identityContext(request);
  if(!context)return NextResponse.json({error:'Autenticação necessária.'},{status:401});
  const {data:record,error}=await context.admin.from('identity_verifications')
    .select('provider_inquiry_id,status,age_band,guardian_status,updated_at')
    .eq('user_id',context.user.id).maybeSingle();
  if(error)return NextResponse.json({error:'Não foi possível verificar o status.'},{status:503});
  if(!record)return NextResponse.json({configured:true,status:'not_started',age_band:'unknown',guardian_status:'pending'},{headers:{'Cache-Control':'no-store'}});

  // Never trust the browser callback as identity approval. Recheck Persona server-to-server.
  if(record.status==='pending' && record.provider_inquiry_id?.startsWith('inq_')){
    try{
      const inquiry=await personaRequest(
        'https://api.withpersona.com/api/v1/inquiries/'+encodeURIComponent(record.provider_inquiry_id)
      );
      const attrs=inquiry.data?.attributes;
      if(inquiry.data?.id===record.provider_inquiry_id && attrs?.['reference-id']===context.user.id){
        const newStatus=attrs.status;
        // 'completed' is NOT 'approved'; only a provider-approved workflow counts.
        if(newStatus==='approved'||newStatus==='declined'||newStatus==='failed'||newStatus==='expired'){
          const {data:changed}=await context.admin.from('identity_verifications')
            .update({status:newStatus,updated_at:new Date().toISOString(),
              verified_at:newStatus==='approved'?new Date().toISOString():null})
            .eq('user_id',context.user.id).eq('provider_inquiry_id',record.provider_inquiry_id)
            .eq('status','pending')
            .select('status,age_band,guardian_status').maybeSingle();
          if(changed){
            record.status=changed.status;
            record.age_band=changed.age_band;
            record.guardian_status=changed.guardian_status;
          }
        }
      }
    }catch{/* Keep the pending result; don't grant access on provider failure. */}
  }
  return NextResponse.json({
    configured:true,status:record.status,age_band:record.age_band,
    guardian_status:record.guardian_status
  },{headers:{'Cache-Control':'no-store'}});
}
