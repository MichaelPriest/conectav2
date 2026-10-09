'use client';

import {FormEvent,useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {AlertTriangle,ArrowLeft,Check,Clock,FileText,Flag,Inbox,Loader2,RefreshCw,ShieldCheck,UserRound,X} from 'lucide-react';
import {GuardedPage,useAuthProfile} from '@/components/app-shell';
import {supabaseBrowser} from '@/lib/supabase/browser';

type QueueItem={
 report_id:string;
 target_type:'post'|'message';
 target_id:string;
 reason:string;
 evidence_excerpt:string;
 evidence_media_type:string|null;
 status:'pending'|'reviewing'|'resolved'|'dismissed';
 created_at:string;
 reviewed_at:string|null;
 reported_author_id:string|null;
 reported_author_handle:string|null;
 reports_against_author:number;
};
type HistoryItem={
 id:string;old_status:string;new_status:string;rationale:string;
 reviewer_handle:string|null;created_at:string;
};
type Filter='open'|'all'|'pending'|'reviewing'|'resolved'|'dismissed';
const filters:{id:Filter;name:string}[]=[
 {id:'open',name:'Em aberto'},
 {id:'pending',name:'Pendentes'},
 {id:'reviewing',name:'Em análise'},
 {id:'resolved',name:'Resolvidas'},
 {id:'dismissed',name:'Arquivadas'},
 {id:'all',name:'Todas'}
];
const labels:Record<QueueItem['status'],string>={
 pending:'Aguardando triagem',reviewing:'Em análise',
 resolved:'Resolvida',dismissed:'Arquivada'
};
export default function PlatformModeration(){
 const auth=useAuthProfile();
 const [role,setRole]=useState<'moderator'|'admin'|null>(null);
 const [checking,setChecking]=useState(true);
 const [filter,setFilter]=useState<Filter>('open');
 const [queue,setQueue]=useState<QueueItem[]>([]);
 const [selected,setSelected]=useState<string|null>(null);
 const [history,setHistory]=useState<HistoryItem[]>([]);
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false);
 const [historyLoading,setHistoryLoading]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [rationale,setRationale]=useState('');

 useEffect(()=>{
  if(!auth.user)return;
  let live=true;
  void supabaseBrowser().from('platform_moderators').select('role')
   .eq('user_id',auth.user.id).maybeSingle()
   .then(({data,error:e})=>{
     if(!live)return;
     if(e)setError('Não foi possível verificar sua autorização: '+e.message);
     setRole((data?.role==='admin'||data?.role==='moderator')?data.role:null);
     setChecking(false);
   });
  return()=>{live=false;};
 },[auth.user]);

 const load=useCallback(async()=>{
  if(!role)return;
  setLoading(true);setError('');
  const {data,error:e}=await supabaseBrowser().rpc('get_safety_moderation_queue',{
    _status:filter,_limit:100
  });
  if(e)setError(e.message);
  else setQueue((data||[]) as QueueItem[]);
  setLoading(false);
 },[filter,role]);

 useEffect(()=>{void load();},[load]);

 const loadHistory=useCallback(async(id:string)=>{
  setHistoryLoading(true);
  const {data,error:e}=await supabaseBrowser()
   .rpc('get_safety_moderation_history',{_report_id:id});
  if(e)setError(e.message);
  else setHistory((data||[]) as HistoryItem[]);
  setHistoryLoading(false);
 },[]);

 useEffect(()=>{
  setHistory([]);setRationale('');
  if(selected&&role)void loadHistory(selected);
 },[selected,role,loadHistory]);

 useEffect(()=>{
  if(!role)return;
  const reload=()=>{if(!document.hidden)void load();};
  window.addEventListener('focus',reload);
  const timer=window.setInterval(reload,60000);
  return()=>{window.removeEventListener('focus',reload);window.clearInterval(timer);};
 },[role,load]);

 async function decide(event:FormEvent,decision:'start_review'|'resolve'|'dismiss'){
   event.preventDefault();
   if(!selected||!role||busy)return;
   if(decision!=='start_review'&&rationale.trim().length<10){
     setError('Registre uma justificativa com pelo menos 10 caracteres.');
     return;
   }
   if(decision!=='start_review'&&!window.confirm('Registrar decisão definitiva sobre esta denúncia? Esta ação não apaga automaticamente o conteúdo.'))return;
   setBusy(true);setError('');setNotice('');
   const {error:e}=await supabaseBrowser().rpc('review_safety_report',{
    _report_id:selected,_decision:decision,
    _rationale:rationale.trim()
   });
   if(e)setError(e.message);
   else{
     setNotice(decision==='start_review'?'Análise iniciada e registrada.':
       decision==='resolve'?'Denúncia marcada como resolvida.':'Denúncia arquivada com justificativa.');
     await load();
     await loadHistory(selected);
     setRationale('');
   }
   setBusy(false);
 }

 const item=queue.find(r=>r.report_id===selected)||null;
 return <GuardedPage {...auth}><main className="section-page conecta-safety-center">
   <div className="page-heading">
    <div><span className="section-eyebrow">EQUIPE AUTORIZADA · SEGURANÇA</span>
      <h1><ShieldCheck size={29}/> Central de moderação</h1>
      <p>Triagem de denúncias gerais, decisões justificadas e histórico auditável.</p>
    </div>
    <Link href="/feed" className="btn btn-outline"><ArrowLeft size={17}/> Voltar à rede</Link>
   </div>
   {error&&<p className="form-error" role="alert">{error}</p>}
   {notice&&<p className="form-success" role="status">{notice}</p>}
   {checking?<div className="panel conecta-safety-loading"><Loader2 size={21} className="spin"/> Verificando autorização...</div>:
    !role?<section className="panel conecta-safety-unauthorized">
     <ShieldCheck size={31}/><h2>Acesso exclusivo da equipe de confiança</h2>
     <p>Somente moderadores gerais autorizados pelo responsável pelo Conecta têm acesso às denúncias e às evidências. Administradores de comunidades possuem permissões separadas.</p>
     <Link className="btn btn-outline" href="/feed">Voltar ao feed</Link>
    </section>:
    <>
     <div className="conecta-safety-overview">
      <div className="panel"><ShieldCheck size={21}/><div><strong>{role==='admin'?'Administrador':'Moderador'}</strong><small>Permissão confirmada no servidor</small></div></div>
      <div className="panel"><Inbox size={21}/><div><strong>{queue.length}</strong><small>Denúncias neste filtro · até 100 por consulta</small></div></div>
      <div className="panel"><AlertTriangle size={21}/><div><strong>Revisão humana</strong><small>Não há remoção ou aprovação automática nesta central</small></div></div>
     </div>
     <div className="conecta-safety-filters" aria-label="Filtrar denúncias">
      {filters.map(f=><button key={f.id} type="button"
        aria-pressed={filter===f.id} className={filter===f.id?'active':''}
        onClick={()=>{setFilter(f.id);setSelected(null);}}>{f.name}</button>)}
      <button type="button" onClick={()=>void load()} disabled={loading} title="Recarregar denúncias"><RefreshCw size={16}/>{loading?'Carregando...':'Atualizar'}</button>
     </div>
     <div className="conecta-safety-layout">
      <section className="panel conecta-safety-inbox" aria-label="Fila de denúncias">
       <h2>Fila de moderação</h2>
       {loading?<p className="small-note"><Loader2 size={17} className="spin"/> Carregando registros autorizados...</p>:
        queue.length===0?<div className="conecta-safety-empty"><Inbox size={30}/><strong>Sem denúncias neste filtro</strong><p>Os registros aparecerão aqui conforme forem enviados à rede.</p></div>:
        queue.map(report=><button type="button" key={report.report_id}
          className={'conecta-safety-list-item '+(selected===report.report_id?'selected':'')}
          onClick={()=>setSelected(report.report_id)}>
         <span className="conecta-safety-list-heading">
          <strong><Flag size={15}/> {report.target_type==='message'?'Mensagem privada':'Publicação do feed'}</strong>
          <span className={'conecta-safety-status '+report.status}>{labels[report.status]}</span>
         </span>
         <span className="conecta-safety-reason">{report.reason}</span>
         <span className="conecta-safety-meta">
          <Clock size={13}/> {new Date(report.created_at).toLocaleString('pt-BR')}
          {Number(report.reports_against_author)>1&&<span>· {report.reports_against_author} denúncias vinculadas ao autor</span>}
         </span>
        </button>)}
      </section>
      <section className="panel conecta-safety-details">
       {!item?<div className="conecta-safety-empty"><FileText size={31}/><h2>Selecione uma denúncia</h2><p>Veja a evidência enviada, o histórico e as ações permitidas à equipe.</p></div>:
        <div className="conecta-safety-detail-content">
         <div className="conecta-safety-detail-heading"><span className={'conecta-safety-status '+item.status}>{labels[item.status]}</span>
          <small>{new Date(item.created_at).toLocaleString('pt-BR')}</small></div>
         <h2>{item.target_type==='message'?'Denúncia de mensagem privada':'Denúncia de publicação'}</h2>
         <div className="conecta-safety-facts">
          <div><span>Conta denunciada</span><strong><UserRound size={14}/> {item.reported_author_handle?'@'+item.reported_author_handle:'Conta não disponível'}</strong></div>
          <div><span>Histórico no Conecta</span><strong>{item.reports_against_author} denúncia(s) sobre esta conta</strong></div>
          <div><span>Tipo de conteúdo</span><strong>{item.evidence_media_type||'Texto'}</strong></div>
         </div>
         <div className="conecta-safety-evidence">
          <strong>Motivo informado</strong><p>{item.reason}</p>
          <strong>Trecho de evidência protegido</strong>
          <blockquote>{item.evidence_excerpt||'[Sem texto; pode conter conteúdo multimídia]'}</blockquote>
          <small>Visualização restrita e limitada ao material denunciado. Não abre histórico completo do chat nem concede acesso a outras conversas.</small>
         </div>
         {item.target_type==='post'&&<Link className="rail-link" href={'/post/'+item.target_id}>Abrir publicação, se ainda estiver disponível <ArrowLeft size={15}/></Link>}
         <form className="conecta-safety-decision" onSubmit={e=>{void decide(e,item.status==='pending'?'start_review':'resolve');}}>
          <h3>Registrar decisão</h3>
          <label className="field-label">Justificativa para encerramento
           <textarea className="form-input" value={rationale} rows={3} maxLength={500}
            placeholder="Descreva a análise, evidências e motivo da decisão (10–500 caracteres)."
            onChange={e=>setRationale(e.target.value)} disabled={busy||item.status==='resolved'||item.status==='dismissed'}/>
          </label>
          {item.status==='pending'&&<button className="btn btn-outline" type="button" disabled={busy}
            onClick={e=>{void decide(e as unknown as FormEvent,'start_review');}}>
            <Clock size={16}/> Iniciar análise
          </button>}
          {(item.status==='pending'||item.status==='reviewing')&&<div className="conecta-safety-decision-buttons">
           <button type="button" className="btn btn-primary" disabled={busy||rationale.trim().length<10} onClick={e=>{void decide(e as unknown as FormEvent,'resolve');}}><Check size={16}/> Resolver</button>
           <button type="button" className="btn btn-outline" disabled={busy||rationale.trim().length<10} onClick={e=>{void decide(e as unknown as FormEvent,'dismiss');}}><X size={16}/> Arquivar</button>
          </div>}
          {['resolved','dismissed'].includes(item.status)&&<p className="small-note">Este caso foi encerrado. O histórico permanece para auditoria.</p>}
          <small>Resolver ou arquivar uma denúncia registra a decisão; não oculta nem exclui automaticamente a publicação ou mensagem.</small>
         </form>
         <div className="conecta-safety-history"><h3>Histórico de decisões</h3>
          {historyLoading?<p className="small-note">Carregando histórico...</p>:history.length===0?<p className="small-note">Nenhuma decisão registrada neste caso.</p>:
           history.map(record=><article key={record.id}>
            <span>{record.old_status} → {record.new_status}</span>
            <small>{new Date(record.created_at).toLocaleString('pt-BR')} · {record.reviewer_handle?'@'+record.reviewer_handle:'Equipe de moderação'}</small>
            <p>{record.rationale}</p>
           </article>)}
         </div>
        </div>}
      </section>
     </div>
     <p className="small-note">Evidências são dados sensíveis de moderação. O compartilhamento, a retenção e a eliminação devem seguir os procedimentos de privacidade do Conecta. Este painel não substitui revisão especializada em emergências.</p>
    </>}
  </main></GuardedPage>;
}
