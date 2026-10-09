'use client';

import {FormEvent,useState} from 'react';
import {Flag,ShieldAlert,Check,X} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';

const reasons=[
 'Assédio ou intimidação',
 'Discriminação ou capacitismo',
 'Exposição de informações pessoais',
 'Conteúdo sexual inadequado',
 'Golpe, spam ou fraude',
 'Outro risco à segurança'
] as const;

type ReportProps={
 targetType:'message'|'post';
 targetId:string;
 reporterId:string;
 communityId?:string|null;
};

export function ReportContentButton({targetType,targetId,reporterId,communityId}:ReportProps){
 const [open,setOpen]=useState(false);
 const [reason,setReason]=useState<string>(reasons[0]);
 const [details,setDetails]=useState('');
 const [busy,setBusy]=useState(false);
 const [sent,setSent]=useState(false);
 const [error,setError]=useState('');
 async function submit(event:FormEvent){
  event.preventDefault();
  if(busy||sent||!reporterId)return;
  setBusy(true);setError('');
  try{
   const explanation=details.trim().slice(0,350);
   const text=(reason+(explanation?' — '+explanation:'')).slice(0,500);
   const db=supabaseBrowser();
   const response=targetType==='post'&&communityId?
    await db.from('community_reports').insert({
     reporter_id:reporterId,community_id:communityId,post_id:targetId,reason:text
    }):
    await db.from('safety_reports').insert({
     reporter_id:reporterId,target_type:targetType,target_id:targetId,reason:text
    });
   if(response.error)throw response.error;
   setSent(true);setOpen(false);setDetails('');
  }catch(e){
   const code=(e as {code?:string})?.code;
   setError(code==='23505'?'Você já denunciou esse conteúdo.':
    e instanceof Error?e.message:'Não foi possível enviar a denúncia.');
  }finally{setBusy(false);}
 }
 if(sent)return <small className="conecta-report-sent" role="status"><Check size={13}/> Denúncia recebida</small>;
 return <div className="conecta-report-area">
  <button type="button" className="conecta-report-toggle" aria-expanded={open}
   aria-label={targetType==='message'?'Denunciar mensagem':'Denunciar publicação'}
   onClick={()=>{setOpen(v=>!v);setError('');}}>
   <Flag size={14}/> Denunciar
  </button>
  {open&&<form className="conecta-report-form" onSubmit={submit}>
    <div className="conecta-report-header"><strong><ShieldAlert size={16}/> Denunciar {targetType==='message'?'mensagem':'publicação'}</strong>
     <button type="button" aria-label="Fechar denúncia" onClick={()=>setOpen(false)}><X size={16}/></button></div>
    <p>O conteúdo será encaminhado para análise. A denúncia não avisa a pessoa denunciada.</p>
    <label>Motivo
     <select className="form-input" value={reason} onChange={event=>setReason(event.target.value)} required>
      {reasons.map(item=><option key={item} value={item}>{item}</option>)}
     </select>
    </label>
    <label>Informações adicionais (opcional)
     <textarea className="form-input" rows={3} maxLength={350} value={details}
       onChange={event=>setDetails(event.target.value)}
       placeholder="Descreva o ocorrido, sem incluir dados pessoais de crianças."/>
    </label>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <button type="submit" className="btn btn-primary" disabled={busy}>{busy?'Enviando...':'Enviar denúncia'}</button>
  </form>}
 </div>;
}
