'use client';
import {useCallback,useEffect,useState} from 'react';
import {RefreshCcw,Scale,ShieldAlert,Check,RotateCcw} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';

type Appeal={
 id:string;target_type:'post'|'comment'|'story';target_id:string;
 appellant_handle:string|null;appeal_reason:string;original_reason:string;
 content_excerpt:string|null;status:'pending'|'upheld'|'overturned';
 decision_reason:string|null;created_at:string;reviewed_at:string|null;
};
const labels={post:'Publicação',comment:'Comentário',story:'Story'};
export function ModerationAppealsPanel(){
 const [appeals,setAppeals]=useState<Appeal[]>([]),[filter,setFilter]=useState<'pending'|'all'>('pending');
 const [selected,setSelected]=useState<string|null>(null),[reason,setReason]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);
  const {data,error:e}=await supabaseBrowser().rpc('get_moderation_appeals',{_status:filter,_limit:100});
  if(e)setError(e.message);else{setAppeals((data||[]) as Appeal[]);setError('');}
  setLoading(false);
 },[filter]);
 useEffect(()=>{void load();},[load]);
 const current=appeals.find(item=>item.id===selected)||null;
 async function decide(decision:'uphold'|'overturn'){
  if(!current||busy||reason.trim().length<20)return;
  if(!window.confirm(decision==='overturn'
   ?'Restaurar o conteúdo rejeitado após a segunda análise?'
   :'Confirmar a manutenção da rejeição?'))return;
  setBusy(true);setError('');setNotice('');
  const {error:e}=await supabaseBrowser().rpc('review_moderation_appeal',{
   _appeal_id:current.id,_decision:decision,_reason:reason.trim()
  });
  if(e)setError(e.message);
  else{setNotice(decision==='overturn'?'Contestação aceita e conteúdo restaurado.':'Rejeição mantida com justificativa.');
   setSelected(null);setReason('');await load();}
  setBusy(false);
 }
 return <section className="panel conecta-content-moderation">
  <div className="conecta-content-moderation-head">
   <div><span className="section-eyebrow">DIREITO À CONTESTAÇÃO</span>
    <h2><Scale size={21}/> Segunda análise de decisões ({appeals.filter(x=>x.status==='pending').length})</h2>
    <p>Avalie os pedidos com independência. Quem rejeitou o conteúdo originalmente não pode julgar seu recurso.</p>
   </div>
   <div className="conecta-content-pending-actions">
    <select className="form-input" aria-label="Filtro de contestações" value={filter}
     onChange={e=>{setFilter(e.target.value as 'pending'|'all');setSelected(null);setReason('');}}>
      <option value="pending">Pendentes</option><option value="all">Todas</option>
    </select>
    <button type="button" className="btn btn-outline" disabled={loading}
     onClick={()=>void load()}><RefreshCcw size={15}/> Atualizar</button>
   </div>
  </div>
  {error&&<p className="form-error" role="alert">{error}</p>}
  {notice&&<p className="form-success" role="status">{notice}</p>}
  <div className="conecta-content-moderation-body">
   <div className="conecta-content-pending-list">
    {loading?<p className="small-note">Carregando contestações...</p>:
     appeals.length===0?<div className="conecta-safety-empty"><Scale size={27}/><strong>Sem contestações neste filtro</strong></div>:
     appeals.map(a=><button type="button" key={a.id}
      className={'conecta-content-pending-item '+(selected===a.id?'active':'')}
      aria-pressed={selected===a.id} onClick={()=>{setSelected(a.id);setReason('');setNotice('');}}>
      <span><Scale size={15}/><strong>{labels[a.target_type]}</strong><small>@{a.appellant_handle||'usuário'}</small></span>
      <p>{a.appeal_reason}</p>
      <span>{a.status==='pending'?'Aguardando segunda análise':
       a.status==='upheld'?'Rejeição mantida':'Decisão revertida'}</span>
     </button>)}
   </div>
   <div className="conecta-content-pending-detail">
    {!current?<div className="conecta-safety-empty"><ShieldAlert size={29}/><strong>Selecione um pedido</strong><p>Confira a decisão anterior, o conteúdo e a justificativa do autor.</p></div>:<>
     <strong>{labels[current.target_type]} de @{current.appellant_handle||'usuário'}</strong>
     <small>Decisão original: {current.original_reason||'Não informada'}</small>
     <div className="conecta-content-moderation-text">{current.content_excerpt||'[Conteúdo indisponível ou sem legenda]'}</div>
     <div className="conecta-content-moderation-text"><strong>Contestação do autor</strong><p>{current.appeal_reason}</p></div>
     {current.status!=='pending'?<p className="small-note">
       Resultado: {current.status==='overturned'?'Decisão revertida':'Rejeição mantida'}.
       {current.decision_reason&&' '+current.decision_reason}
     </p>:<>
      <label className="field-label">Fundamentação da segunda análise
       <textarea className="form-input" value={reason} maxLength={500} rows={3}
        disabled={busy} onChange={e=>setReason(e.target.value)}
        placeholder="Informe a fundamentação da decisão (mínimo de 20 caracteres)."/>
      </label>
      <div className="conecta-content-pending-actions">
       <button type="button" className="btn btn-primary" disabled={busy||reason.trim().length<20}
        onClick={()=>void decide('overturn')}><RotateCcw size={16}/> Aceitar e restaurar</button>
       <button type="button" className="btn btn-outline" disabled={busy||reason.trim().length<20}
        onClick={()=>void decide('uphold')}><Check size={16}/> Manter rejeição</button>
      </div>
      <p className="small-note">A decisão fica auditada e é visível ao autor. Caso você tenha feito a primeira rejeição, outra pessoa da equipe deverá decidir.</p>
     </>}
    </>}
   </div>
  </div>
 </section>;
}
