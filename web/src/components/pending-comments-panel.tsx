'use client';

import {useCallback,useEffect,useState} from 'react';
import {Check,Clock3,MessageCircle,RefreshCw,ShieldCheck,X} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';
import {LocalAIReview} from '@/components/local-ai-review';

type Comment={
 comment_id:string;post_id:string;community_id:string|null;author_handle:string|null;
 body:string;created_at:string;
};
export function PendingCommentsPanel({communityId}:{communityId?:string}){
 const [comments,setComments]=useState<Comment[]>([]);
 const [selected,setSelected]=useState<string|null>(null);
 const [reason,setReason]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [notice,setNotice]=useState(''),[error,setError]=useState('');
 const load=useCallback(async()=>{
   setLoading(true);setError('');
   const {data,error:e}=await supabaseBrowser().rpc('get_pending_comments',{_limit:100});
   if(e)setError(e.message);
   else setComments(((data||[]) as Comment[]).filter(item=>!communityId||item.community_id===communityId));
   setLoading(false);
 },[communityId]);
 useEffect(()=>{void load();},[load]);
 const chosen=comments.find(item=>item.comment_id===selected);
 async function review(decision:'approve'|'reject'){
  if(busy||!chosen||reason.trim().length<10)return;
  if(!window.confirm((decision==='approve'?'Aprovar':'Rejeitar')+' este comentário?'))return;
  setBusy(true);setError('');setNotice('');
  const {error:e}=await supabaseBrowser().rpc('review_pending_comment',{
   _comment_id:chosen.comment_id,_decision:decision,_reason:reason.trim()
  });
  if(e)setError(e.message);
  else{
   setNotice(decision==='approve'?'Comentário aprovado e liberado.':'Comentário rejeitado e oculto de outras pessoas.');
   setSelected(null);setReason('');await load();
  }
  setBusy(false);
 }
 return <section className="panel conecta-content-moderation">
  <div className="conecta-content-moderation-head">
   <div><span className="section-eyebrow">COMENTÁRIOS E RESPOSTAS</span>
    <h2><ShieldCheck size={20}/> Comentários aguardando análise ({comments.length})</h2>
    <p>Textos recém-enviados ficam visíveis apenas para quem escreveu e para a moderação até serem aprovados.</p>
   </div>
   <button type="button" className="btn btn-outline" disabled={loading} onClick={()=>void load()}><RefreshCw size={15}/> Atualizar</button>
  </div>
  {error&&<p className="form-error" role="alert">{error}</p>}
  {notice&&<p className="form-success" role="status">{notice}</p>}
  <div className="conecta-content-moderation-body">
   <div className="conecta-content-pending-list">
    {loading?<p className="small-note">Carregando comentários...</p>:
     comments.length===0?<div className="conecta-safety-empty"><MessageCircle size={27}/><strong>Nenhum comentário pendente</strong></div>:
     comments.map(item=><button type="button" key={item.comment_id}
       className={'conecta-content-pending-item '+(selected===item.comment_id?'active':'')}
       aria-pressed={selected===item.comment_id}
       onClick={()=>{setSelected(item.comment_id);setReason('');}}>
       <span><MessageCircle size={15}/><strong>@{item.author_handle||'Conta indisponível'}</strong>
        <small>{item.community_id?'Comunidade':'Feed'}</small></span>
       <p>{item.body}</p>
       <span><Clock3 size={13}/>{new Date(item.created_at).toLocaleString('pt-BR')}</span>
     </button>)}
   </div>
   <div className="conecta-content-pending-detail">
    {!chosen?<div className="conecta-safety-empty"><MessageCircle size={29}/><strong>Selecione um comentário</strong><p>Leia o texto e registre a decisão.</p></div>:<>
     <strong>Comentário de @{chosen.author_handle||'usuário'}</strong>
     <div className="conecta-content-moderation-text">{chosen.body}</div>
     <LocalAIReview itemKey={chosen.comment_id} text={chosen.body}/>
     <label className="field-label">Justificativa para decisão
      <textarea className="form-input" rows={3} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}
       disabled={busy} placeholder="Descreva o motivo da decisão (mínimo 10 caracteres)."/>
     </label>
     <div className="conecta-content-pending-actions">
      <button type="button" className="btn btn-primary" disabled={busy||reason.trim().length<10}
       onClick={()=>void review('approve')}><Check size={16}/> Aprovar</button>
      <button type="button" className="btn btn-outline" disabled={busy||reason.trim().length<10}
       onClick={()=>void review('reject')}><X size={16}/> Rejeitar</button>
     </div>
     <p className="small-note">Aprovar um comentário libera a leitura e envia notificações permitidas. O histórico fica registrado para auditoria.</p>
    </>}
   </div>
  </div>
 </section>;
}
