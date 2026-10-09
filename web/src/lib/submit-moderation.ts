import {supabaseBrowser} from '@/lib/supabase/browser';
export type ModerationFeedback={status:'approved'|'pending'|'rejected'|'expired';reason?:string;provider?:string};
/**
 * Optional free-model scan. Database quarantine always runs independently of the browser.
 * When a provider is unavailable, keep the database's pending moderation state intact.
 */
async function currentModerationStatus(kind:'post'|'story',id:string):Promise<ModerationFeedback>{
 try{
  const {data}=kind==='post'?
    await supabaseBrowser().from('posts').select('moderation_status').eq('id',id).maybeSingle():
    await supabaseBrowser().from('stories').select('moderation_status').eq('id',id).maybeSingle();
  if(data&&['pending','approved','rejected'].includes(data.moderation_status))
   return {status:data.moderation_status as ModerationFeedback['status']};
 }catch{/* Use conservative response when the database itself is unreachable. */}
 return {status:'pending',reason:'Análise de segurança pendente.'};
}
export async function requestContentModeration(kind:'post'|'story',id:string):Promise<ModerationFeedback>{
 try{
  const {data:{session}}=await supabaseBrowser().auth.getSession();
  if(!session?.access_token)return currentModerationStatus(kind,id);
  const response=await fetch('/api/moderation/review',{
   method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
   body:JSON.stringify({kind,id}),cache:'no-store',credentials:'same-origin'
  });
  if(!response.ok)return currentModerationStatus(kind,id);
  const body=await response.json() as ModerationFeedback;
  return ['approved','pending','rejected','expired'].includes(body.status)?body:
   {status:'pending',reason:'Análise de segurança pendente.'};
 }catch{
  return currentModerationStatus(kind,id);
 }
}
