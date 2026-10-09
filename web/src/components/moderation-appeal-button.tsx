'use client';
import {useEffect,useState} from 'react';
import {Scale,Send,CheckCircle2} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';

type Kind='post'|'comment'|'story';
type Appeal={status:'pending'|'upheld'|'overturned';decision_reason:string|null};
export function ModerationAppealButton({kind,targetId}:{kind:Kind;targetId:string}){
 const [form,setForm]=useState(false),[reason,setReason]=useState('');
 const [appeal,setAppeal]=useState<Appeal|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  let alive=true;
  setLoading(true);setAppeal(null);setForm(false);setReason('');setError('');
  void supabaseBrowser().from('moderation_appeals').select('status,decision_reason')
   .eq('target_type',kind).eq('target_id',targetId).maybeSingle()
   .then(({data,error:e})=>{
    if(!alive)return;
    if(e)setError('Não foi possível consultar sua contestação.');
    else setAppeal((data||null) as Appeal|null);
    setLoading(false);
   });
  return()=>{alive=false;};
 },[kind,targetId]);
 async function submit(){
  if(reason.trim().length<20||reason.trim().length>1000||busy)return;
  setBusy(true);setError('');
  const {error:e}=await supabaseBrowser().rpc('submit_moderation_appeal',{
   _kind:kind,_target_id:targetId,_reason:reason.trim()
  });
  if(e)setError(e.message);
  else{setAppeal({status:'pending',decision_reason:null});setForm(false);setReason('');}
  setBusy(false);
 }
 return <div className="conecta-appeal">
  {loading?<span className="small-note">Consultando direito de contestação...</span>:
   appeal?<div className="conecta-appeal-state" role="status">
    <CheckCircle2 size={15}/>
    <span>{appeal.status==='pending'?'Contestação recebida; aguardando análise independente.':
      appeal.status==='overturned'?'Decisão revertida após revisão.':'Decisão mantida após revisão.'}
      {appeal.decision_reason&&<small>Motivo: {appeal.decision_reason}</small>}</span>
   </div>:
   !form?<button className="btn btn-outline" type="button" onClick={()=>setForm(true)}>
    <Scale size={15}/> Solicitar segunda análise
   </button>:
   <div className="conecta-appeal-form">
    <label className="field-label">Por que esta decisão deveria ser revista?
     <textarea className="form-input" rows={3} maxLength={1000} value={reason}
      onChange={e=>setReason(e.target.value)} disabled={busy}
      placeholder="Explique o contexto e o motivo da contestação (mínimo 20 caracteres)."/>
    </label>
    <div className="conecta-content-pending-actions">
     <button className="btn btn-primary" type="button" onClick={()=>void submit()}
      disabled={busy||reason.trim().length<20}><Send size={15}/> Enviar contestação</button>
     <button className="btn btn-outline" type="button" onClick={()=>setForm(false)} disabled={busy}>Cancelar</button>
    </div>
    <p className="small-note">Cada conteúdo permite uma contestação. O autor não altera o estado da moderação diretamente.</p>
   </div>}
  {error&&<p role="alert" className="form-error">{error}</p>}
 </div>;
}
