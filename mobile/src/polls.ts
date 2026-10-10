import {supabase} from './supabase';
import {requestPostModeration} from './data';
import {ensureCommunityMembership} from './community';

export type PostPoll={
 post_id:string;question:string;closes_at:string;
};
export type PollOption={id:string;poll_id:string;label:string;position:number};
export type PollData={
 poll:PostPoll;options:PollOption[];selected:string|null;
 totals:Record<string,number>
};

export function validatePollDraft(question:string,options:string[],days:number){
 const text=question.trim();
 const choices=options.map(x=>x.trim());
 if(text.length<5||text.length>250)
  throw new Error('A pergunta deve ter entre 5 e 250 caracteres.');
 if(choices.length<2||choices.length>6||choices.some(x=>!x||x.length>120))
  throw new Error('Informe entre 2 e 6 opções válidas de até 120 caracteres.');
 if(new Set(choices.map(x=>x.toLocaleLowerCase('pt-BR'))).size!==choices.length)
  throw new Error('As opções da enquete devem ser diferentes.');
 if(![1,3,7,14].includes(days))throw new Error('Escolha um prazo válido para a enquete.');
 return {question:text,options:choices,days};
}
export async function publishPollPost(
 userId:string,content:string,visibility:'public'|'friends'|'private',
 options:string[],days:number,communityId:string|null=null
):Promise<string>{
 const draft=validatePollDraft(content,options,days);
 const {data:{session}}=await supabase.auth.getSession();
 if(session?.user.id!==userId)throw new Error('Sua sessão expirou.');
 if(communityId){
  if(visibility!=='public')throw new Error('Enquetes da comunidade devem ser públicas.');
  await ensureCommunityMembership(userId,communityId);
 }
 let postId:string|null=null;
 try{
  const {data,error}=await supabase.from('posts').insert({
   author_id:userId,community_id:communityId,
   content:draft.question,visibility,
   media_path:null,media_type:null
  }).select('id').single();
  if(error)throw error;
  postId=data.id;
  const {error:pollError}=await supabase.from('post_polls').insert({
   post_id:data.id,question:draft.question,
   closes_at:new Date(Date.now()+days*86400000).toISOString()
  });
  if(pollError)throw pollError;
  const {error:choicesError}=await supabase.from('post_poll_options').insert(
   draft.options.map((label,position)=>({
    poll_id:data.id,label,position
   }))
  );
  if(choicesError)throw choicesError;
  await requestPostModeration(data.id);
  return data.id;
 }catch(e){
  let failed=false;
  if(postId){
   const {error}=await supabase.from('posts').delete().eq('id',postId)
    .eq('author_id',userId);
   failed=Boolean(error);
  }
  const message=e instanceof Error?e.message:'Não foi possível publicar a enquete.';
  throw new Error(message+(failed?' A publicação incompleta precisa de limpeza.':''));
 }
}
export async function loadPoll(postId:string,userId:string):Promise<PollData|null>{
 const {data:poll,error}=await supabase.from('post_polls')
  .select('post_id,question,closes_at').eq('post_id',postId).maybeSingle();
 if(error)throw error;
 if(!poll)return null;
 const [choices,own,results]=await Promise.all([
  supabase.from('post_poll_options').select('id,poll_id,label,position')
   .eq('poll_id',postId).order('position',{ascending:true}),
  supabase.from('post_poll_votes').select('option_id')
   .eq('poll_id',postId).eq('user_id',userId).maybeSingle(),
  supabase.rpc('poll_results',{target_post:postId})
 ]);
 if(choices.error||own.error||results.error)
  throw new Error(choices.error?.message||own.error?.message||results.error?.message);
 const totals:Record<string,number>={};
 for(const row of results.data||[])totals[row.option_id]=Number(row.votes)||0;
 return {poll:poll as PostPoll,options:(choices.data||[]) as PollOption[],
  selected:own.data?.option_id||null,totals};
}
export async function castPollVote(postId:string,userId:string,optionId:string){
 const {data:{session}}=await supabase.auth.getSession();
 if(session?.user.id!==userId)throw new Error('Sua sessão expirou.');
 const {error}=await supabase.from('post_poll_votes').insert({
  poll_id:postId,option_id:optionId,user_id:userId
 });
 if(error)throw new Error(error.code==='23505'?'Você já votou nesta enquete.':error.message);
}
