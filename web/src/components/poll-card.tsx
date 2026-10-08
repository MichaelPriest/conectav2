'use client';
import {useCallback,useEffect,useState} from 'react';
import {BarChart3,CheckCircle2,Clock3} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';

type Poll={post_id:string;question:string;closes_at:string};
type Choice={id:string;poll_id:string;label:string;position:number};
export function PollCard({postId,userId}:{postId:string;userId:string}){
 const [poll,setPoll]=useState<Poll|null>(null),[choices,setChoices]=useState<Choice[]>([]);
 const [selected,setSelected]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [totals,setTotals]=useState<Record<string,number>>({});
 const [loading,setLoading]=useState(true);
 const load=useCallback(async()=>{
  const db=supabaseBrowser();
  const {data:p,error:pe}=await db.from('post_polls').select('post_id,question,closes_at').eq('post_id',postId).maybeSingle();
  if(pe){setError(pe.message);setLoading(false);return;}
  setPoll(p as Poll|null);
  if(p){
   const [opts,own,agg]=await Promise.all([
    db.from('post_poll_options').select('id,poll_id,label,position').eq('poll_id',postId).order('position',{ascending:true}),
    db.from('post_poll_votes').select('option_id').eq('poll_id',postId).eq('user_id',userId).maybeSingle(),
    db.rpc('poll_results',{target_post:postId})
   ]);
   if(opts.error||own.error||agg.error)setError(opts.error?.message||own.error?.message||agg.error?.message||'Não foi possível carregar os votos.');
   else{
     setChoices((opts.data||[]) as Choice[]);setSelected(own.data?.option_id||null);
     setTotals(Object.fromEntries((agg.data||[]).map((row:{option_id:string;votes:number})=>[row.option_id,row.votes])));
   }
  }
  setLoading(false);
 },[postId,userId]);
 useEffect(()=>{void load();},[load]);
 if(loading)return null;
 if(!poll)return null;
 const expired=new Date(poll.closes_at).getTime()<=Date.now();
 const total=choices.reduce((acc,c)=>acc+(totals[c.id]||0),0);
 async function vote(id:string){
  if(selected||expired||busy)return;
  setBusy(true);setError('');
  const {error:e}=await supabaseBrowser().from('post_poll_votes').insert({poll_id:postId,option_id:id,user_id:userId});
  if(e)setError(e.code==='23505'?'Você já votou nessa enquete.':e.message);
  await load();setBusy(false);
 }
 return <section className="conecta-poll-card" aria-label="Enquete">
   <strong className="conecta-poll-title"><BarChart3 size={18}/> {poll.question}</strong>
   <div className="conecta-poll-choices">{choices.map(choice=>{
    const votes=totals[choice.id]||0,pct=total?Math.round(votes*100/total):0;
    return <button type="button" key={choice.id} disabled={!!selected||expired||busy||choices.length<2}
      className={'conecta-poll-choice '+(selected===choice.id?'is-selected':'')}
      onClick={()=>void vote(choice.id)} aria-label={'Votar em '+choice.label}>
      {(!!selected||expired)&&<span className="conecta-poll-progress" style={{width:pct+'%'}}/>}
      <span>{choice.label}{selected===choice.id&&<CheckCircle2 size={15}/>}</span>
      {(!!selected||expired)&&<strong>{pct}%</strong>}
    </button>;
   })}</div>
   <div className="conecta-poll-foot"><span>{total} {total===1?'voto':'votos'}</span><span><Clock3 size={14}/>{expired?'Enquete encerrada':'Até '+new Date(poll.closes_at).toLocaleDateString('pt-BR')}</span></div>
   {error&&<p className="form-error" role="alert">{error}</p>}
 </section>;
}
