import type {SupabaseClient} from '@supabase/supabase-js';
import {validatePoll} from '@/components/poll-draft';

export async function attachPoll(db:SupabaseClient,postId:string,question:string,options:string[],days:number){
 validatePoll(question,options);
 const {error:p}=await db.from('post_polls').insert({
  post_id:postId,question:question.trim(),closes_at:new Date(Date.now()+days*86400000).toISOString()
 });
 if(p)throw p;
 const {error:o}=await db.from('post_poll_options').insert(options.map((label,position)=>({
  poll_id:postId,label:label.trim(),position
 })));
 if(o)throw o;
}
