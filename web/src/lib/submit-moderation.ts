import {supabaseBrowser} from '@/lib/supabase/browser';
export type ModerationFeedback={status:'approved'|'pending'|'rejected'|'expired';reason?:string;provider?:string};
/**
 * Optional free-model scan. Database quarantine always runs independently of the browser.
 * When a provider is unavailable, keep the database's pending moderation state intact.
 */
export async function requestContentModeration(kind:'post'|'story',id:string):Promise<ModerationFeedback>{
 try{
  const {data:{session}}=await supabaseBrowser().auth.getSession();
  if(!session?.access_token)return {status:'pending',reason:'Necessário entrar novamente para concluir a análise.'};
  const response=await fetch('/api/moderation/review',{
   method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
   body:JSON.stringify({kind,id}),cache:'no-store',credentials:'same-origin'
  });
  if(!response.ok)return {status:'pending',reason:'Análise de segurança pendente.'};
  const body=await response.json() as ModerationFeedback;
  return ['approved','pending','rejected','expired'].includes(body.status)?body:
   {status:'pending',reason:'Análise de segurança pendente.'};
 }catch{
  return {status:'pending',reason:'Análise de segurança pendente.'};
 }
}
