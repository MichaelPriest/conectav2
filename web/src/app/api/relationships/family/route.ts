import {createClient} from '@supabase/supabase-js';
import {NextRequest,NextResponse} from 'next/server';
import {identityUserContext,runtimeConfig} from '@/lib/identity-server';
import {isTrustedIdentityOrigin} from '@/lib/identity-origin';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization'};
const familyTypes=new Set(['mother','father','parent','child','guardian','sibling','grandparent','grandchild','spouse','partner','aunt_uncle','niece_nephew','cousin','other']);
const guardianTypes=new Set(['parent','legal_guardian','foster_guardian','caregiver']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function responseError(message:string,status=400){return NextResponse.json({error:message},{status,headers});}
function adminClient(){return createClient(runtimeConfig.supabaseUrl!,runtimeConfig.serviceKey!,{auth:{persistSession:false,autoRefreshToken:false}});}

async function trustedAdult(admin:ReturnType<typeof adminClient>,userId:string){
 const {data,error}=await admin.from('age_assurance_decisions')
  .select('age_band,method,verified_at')
  .eq('user_id',userId).maybeSingle();
 if(error||!data||data.age_band!=='18_plus'||
    !['verified_age_credential','authorized_provider_callback'].includes(data.method))return false;
 const verifiedAt=Date.parse(data.verified_at);
 const age=Date.now()-verifiedAt;
 return Number.isFinite(verifiedAt)&&age>=-60_000&&age<=60*24*60*60*1000;
}

/** Private family graph and consent-based guardian associations. This endpoint never verifies legal kinship by itself. */
export async function GET(request:NextRequest){
 const context=await identityUserContext(request);
 if(!context)return responseError('Entre na sua conta para consultar os relacionamentos.',401);
 if(!runtimeConfig.serviceKey)return responseError('Serviço de relacionamentos indisponível.',503);
 const admin=adminClient(),id=context.user.id;
 const [family,guardians]=await Promise.all([
  admin.from('conecta_family_relationships').select('id,requester_id,addressee_id,relationship_type,status,requested_by,created_at,responded_at')
   .or('requester_id.eq.'+id+',addressee_id.eq.'+id).order('created_at',{ascending:false}).limit(100),
  admin.from('conecta_guardian_links').select('id,child_user_id,guardian_user_id,relationship_type,status,requested_by,created_at,responded_at')
   .or('child_user_id.eq.'+id+',guardian_user_id.eq.'+id).order('created_at',{ascending:false}).limit(100)
 ]);
 if(family.error||guardians.error)return responseError('Não foi possível carregar os relacionamentos.',503);
 return NextResponse.json({family:family.data??[],guardians:guardians.data??[],publicByDefault:false},{headers});
}

export async function POST(request:NextRequest){
 if(!isTrustedIdentityOrigin(request.headers,request.url,process.env))return responseError('Origem inválida.',403);
 const context=await identityUserContext(request);
 if(!context)return responseError('Entre na sua conta para continuar.',401);
 if(!runtimeConfig.supabaseUrl||!runtimeConfig.serviceKey)return responseError('Serviço de relacionamentos indisponível.',503);
 let body:Record<string,unknown>;
 try{const parsed=await request.json();if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return responseError('Solicitação inválida.');body=parsed;}
 catch{return responseError('Solicitação inválida.');}
 const action=body.action;
 const admin=adminClient(),me=context.user.id;
 if(action==='family_invite'){
  const target=body.targetUserId,kind=body.relationshipType;
  if(typeof target!=='string'||!uuid.test(target)||target===me||typeof kind!=='string'||!familyTypes.has(kind))
   return responseError('Informe uma conta e um tipo de parentesco válidos.');
  const {data:existing,error:lookupError}=await admin.from('conecta_family_relationships')
   .select('id,status').or('and(requester_id.eq.'+me+',addressee_id.eq.'+target+'),and(requester_id.eq.'+target+',addressee_id.eq.'+me+')').limit(1).maybeSingle();
  if(lookupError)return responseError('Não foi possível conferir o convite.',503);
  if(existing?.status==='accepted')return responseError('Esse vínculo já foi confirmado.',409);
  if(existing?.status==='pending')return responseError('Já existe um convite pendente entre essas contas.',409);
  const {data,error}=await admin.from('conecta_family_relationships').insert({
   requester_id:me,addressee_id:target,relationship_type:kind,status:'pending',requested_by:me
  }).select('id,requester_id,addressee_id,relationship_type,status,created_at').single();
  if(error)return responseError('Não foi possível enviar o convite.',409);
  return NextResponse.json({relationship:data,message:'Convite enviado. O parentesco só aparece como confirmado após aceitação da outra conta.'},{status:201,headers});
 }
 if(action==='family_respond'){
  const id=body.relationshipId,decision=body.decision;
  if(typeof id!=='string'||!uuid.test(id)||!['accept','reject'].includes(String(decision)))return responseError('Resposta ao convite inválida.');
  const {data:row,error:lookupError}=await admin.from('conecta_family_relationships')
   .select('id,requester_id,addressee_id,status,requested_by').eq('id',id).maybeSingle();
  if(lookupError||!row)return responseError('Convite não encontrado.',404);
  if(row.addressee_id!==me||row.requested_by===me)return responseError('Somente a conta convidada pode responder a esse convite.',403);
  if(row.status!=='pending')return responseError('Esse convite não está mais pendente.',409);
  const {data,error}=await admin.from('conecta_family_relationships').update({
   status:decision==='accept'?'accepted':'rejected',responded_at:new Date().toISOString()
  }).eq('id',id).eq('status','pending').select('id,status,relationship_type').maybeSingle();
  if(error||!data)return responseError('Não foi possível atualizar o convite.',409);
  return NextResponse.json({relationship:data},{headers});
 }
 if(action==='family_revoke'){
  const id=body.relationshipId;
  if(typeof id!=='string'||!uuid.test(id))return responseError('Relacionamento inválido.');
  const {data,error}=await admin.from('conecta_family_relationships').update({status:'revoked',responded_at:new Date().toISOString()})
   .eq('id',id).or('requester_id.eq.'+me+',addressee_id.eq.'+me).in('status',['pending','accepted'])
   .select('id,status').maybeSingle();
  if(error||!data)return responseError('Não foi possível remover o vínculo.',404);
  return NextResponse.json({relationship:data},{headers});
 }
 if(action==='guardian_invite'){
  const child=body.childUserId,guardian=body.guardianUserId,kind=body.relationshipType;
  if(typeof child!=='string'||!uuid.test(child)||typeof guardian!=='string'||!uuid.test(guardian)||
     child===guardian||![child,guardian].includes(me)||typeof kind!=='string'||!guardianTypes.has(kind))
   return responseError('Informe a conta da criança, a conta responsável e o tipo de vínculo.');
  const {data:existing,error:lookupError}=await admin.from('conecta_guardian_links')
   .select('id,status').eq('child_user_id',child).eq('guardian_user_id',guardian).maybeSingle();
  if(lookupError)return responseError('Não foi possível conferir o vínculo.',503);
  if(existing?.status==='accepted')return responseError('Esse vínculo de responsável já está confirmado.',409);
  if(existing?.status==='pending')return responseError('Já existe um convite pendente para essas contas.',409);
  const {data,error}=await admin.from('conecta_guardian_links').insert({
   child_user_id:child,guardian_user_id:guardian,relationship_type:kind,status:'pending',requested_by:me
  }).select('id,child_user_id,guardian_user_id,relationship_type,status,requested_by,created_at').single();
  if(error)return responseError('Não foi possível enviar o convite de responsável.',409);
  return NextResponse.json({relationship:data,message:'A associação depende da aceitação da outra conta e da validação etária confiável do responsável.'},{status:201,headers});
 }
 if(action==='guardian_respond'){
  const id=body.relationshipId,decision=body.decision;
  if(typeof id!=='string'||!uuid.test(id)||!['accept','reject'].includes(String(decision)))return responseError('Resposta ao convite de responsável inválida.');
  const {data:row,error:lookupError}=await admin.from('conecta_guardian_links')
   .select('id,child_user_id,guardian_user_id,status,requested_by').eq('id',id).maybeSingle();
  if(lookupError||!row)return responseError('Convite de responsável não encontrado.',404);
  const otherParty=me===row.child_user_id?row.guardian_user_id:me===row.guardian_user_id?row.child_user_id:null;
  if(!otherParty||row.requested_by===me)return responseError('Somente a outra conta envolvida pode responder a esse convite.',403);
  if(row.status!=='pending')return responseError('Esse convite não está mais pendente.',409);
  // Regardless of who sent the invitation, the proposed guardian must have a current, trusted 18+ decision.
  if(decision==='accept'&&!await trustedAdult(admin,row.guardian_user_id))
   return responseError('O responsável precisa ter maioridade confirmada por uma evidência confiável antes de aceitar a associação.',403);
  const {data,error}=await admin.from('conecta_guardian_links').update({
   status:decision==='accept'?'accepted':'rejected',responded_at:new Date().toISOString()
  }).eq('id',id).eq('status','pending').select('id,status,child_user_id,guardian_user_id,relationship_type').maybeSingle();
  if(error||!data)return responseError('Não foi possível atualizar o vínculo de responsável.',409);
  return NextResponse.json({relationship:data,guardianAgeVerified:decision==='accept'},{headers});
 }
 if(action==='guardian_revoke'){
  const id=body.relationshipId;
  if(typeof id!=='string'||!uuid.test(id))return responseError('Vínculo de responsável inválido.');
  const {data,error}=await admin.from('conecta_guardian_links').update({status:'revoked',responded_at:new Date().toISOString()})
   .eq('id',id).or('child_user_id.eq.'+me+',guardian_user_id.eq.'+me).eq('status','accepted')
   .select('id,status').maybeSingle();
  if(error||!data)return responseError('Não foi possível revogar o vínculo.',404);
  return NextResponse.json({relationship:data},{headers});
 }
 return responseError('Ação de relacionamento não reconhecida.');
}
