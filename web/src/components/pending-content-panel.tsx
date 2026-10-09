'use client';
import {useCallback,useEffect,useState} from 'react';
import {CheckCircle,Clock,Eye,Image as ImageIcon,Loader2,RefreshCcw,ShieldCheck,XCircle} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';

type Pending={
 id:string;kind:'post'|'story';author_handle:string|null;content_excerpt:string;
 media_type:'image'|'video'|null;created_at:string;ai_provider:string|null;
};
type Preview={url:string;type:'image'|'video'};
export function PendingContentPanel(){
 const [items,setItems]=useState<Pending[]>([]);
 const [selected,setSelected]=useState<string|null>(null);
 const [preview,setPreview]=useState<Preview[]>([]);
 const [aiNote,setAiNote]=useState<string|null>(null);
 const [rationale,setRationale]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [loadingPreview,setLoadingPreview]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');

 const load=useCallback(async()=>{
  setLoading(true);
  const {data,error:e}=await supabaseBrowser().rpc('get_pending_public_content',{_limit:100});
  if(e)setError('Não foi possível carregar a fila: '+e.message);
  else setItems((data||[]) as Pending[]);
  setLoading(false);
 },[]);
 useEffect(()=>{void load();},[load]);

 const current=items.find(item=>item.id===selected)||null;
 const show=useCallback(async(item:Pending)=>{
  setSelected(item.id);setPreview([]);setRationale('');setError('');setAiNote(null);
  if(item.kind==='post'){
   const {data:review}=await supabaseBrowser().from('posts')
    .select('moderation_reason,ai_provider,ai_checked_at').eq('id',item.id).maybeSingle();
   if(review?.ai_provider&&review.ai_checked_at)
    setAiNote('Modelo '+review.ai_provider+': '+(review.moderation_reason||'Triagem concluída; verificar também outras categorias.'));
  }
  if(!item.media_type)return;
  setLoadingPreview(true);
  try{
   const {data:{session}}=await supabaseBrowser().auth.getSession();
   if(!session?.access_token)throw new Error('Sua sessão expirou.');
   const params=new URLSearchParams({kind:item.kind,id:item.id});
   const response=await fetch('/api/moderation/preview?'+params,{
    headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'
   });
   if(!response.ok)throw new Error('Não foi possível visualizar a mídia autorizada.');
   const payload=await response.json() as {media?:Preview[]};
   setPreview(payload.media||[]);
  }catch(e){setError(e instanceof Error?e.message:'Falha na prévia de mídia.');}
  finally{setLoadingPreview(false);}
 },[]);

 async function decide(decision:'approve'|'reject'){
  if(!current||busy||rationale.trim().length<10)return;
  if(!window.confirm((decision==='approve'?'Aprovar':'Rejeitar')+
    ' este conteúdo? Registre a justificativa antes de confirmar.'))return;
  setBusy(true);setError('');setNotice('');
  const {error:e}=await supabaseBrowser().rpc('review_pending_public_content',{
    _kind:current.kind,_id:current.id,_decision:decision,_rationale:rationale.trim()
  });
  if(e)setError(e.message);
  else{
   setNotice(decision==='approve'?'Conteúdo aprovado com decisão auditada.':'Conteúdo rejeitado com decisão auditada.');
   setSelected(null);setPreview([]);setRationale('');await load();
  }
  setBusy(false);
 }
 return <section className="panel conecta-content-moderation">
  <div className="conecta-content-moderation-head">
   <div><span className="section-eyebrow">MODERAÇÃO DE IA + EQUIPE</span>
    <h2><ShieldCheck size={20}/> Conteúdos aguardando revisão ({items.length})</h2>
    <p>Fotos, vídeos, Stories e textos sinalizados. Quando a IA estiver indisponível, o conteúdo permanece privado até sua decisão.</p>
   </div>
   <button type="button" className="btn btn-outline" onClick={()=>void load()} disabled={loading}><RefreshCcw size={15}/> Atualizar</button>
  </div>
  {notice&&<p className="form-success" role="status">{notice}</p>}
  {error&&<p className="form-error" role="alert">{error}</p>}
  <div className="conecta-content-moderation-body">
   <div className="conecta-content-pending-list">
    {loading?<p className="small-note"><Loader2 size={17} className="spin"/> Carregando fila...</p>:
     !items.length?<div className="conecta-safety-empty"><CheckCircle size={27}/><strong>Fila vazia</strong><p>Nenhum conteúdo geral precisa de revisão neste momento.</p></div>:
     items.map(item=><button key={item.kind+item.id} type="button"
       className={'conecta-content-pending-item '+(current?.id===item.id?'active':'')}
       aria-pressed={current?.id===item.id} onClick={()=>void show(item)}>
      <span><ImageIcon size={16}/> <strong>{item.kind==='story'?'Story':'Publicação do feed'}</strong>
        <small>@{item.author_handle||'conta indisponível'}</small></span>
      <p>{item.content_excerpt||'[Conteúdo com mídia]'}</p>
      <span><Clock size={13}/> {new Date(item.created_at).toLocaleString('pt-BR')}
        {item.ai_provider&&<small> · {item.ai_provider}</small>}</span>
     </button>)}
   </div>
   <div className="conecta-content-pending-detail">
    {!current?<div className="conecta-safety-empty"><Eye size={29}/><strong>Selecione um conteúdo</strong><p>Confira texto, mídias e contexto antes de aprovar ou rejeitar.</p></div>:<>
     <div className="conecta-content-pending-heading">
       <strong>{current.kind==='story'?'Story':'Publicação'} de @{current.author_handle||'usuário'}</strong>
       <small>Enviado em {new Date(current.created_at).toLocaleString('pt-BR')}</small>
     </div>
     <div className="conecta-content-moderation-text">{current.content_excerpt||'[Sem legenda]'}</div>
     {aiNote&&<div className="conecta-content-review" role="status">
       <strong><ShieldCheck size={15}/> Triagem por modelo de repositório</strong>
       <span>{aiNote}</span>
       <small>Esta pontuação não substitui a revisão de contexto por pessoa autorizada.</small>
     </div>}
     {loadingPreview&&<p className="small-note"><Loader2 className="spin" size={16}/> Carregando prévia...</p>}
     {current.media_type&&preview.length===0&&!loadingPreview&&
       <p className="small-note">Prévia indisponível. Não aprove sem conferir a mídia.</p>}
     {preview.length>0&&<div className="conecta-content-moderation-previews">
      {preview.map((m,index)=>m.type==='image'?
        <img key={index} src={m.url} alt={'Mídia '+(index+1)+' sob revisão'}/>:
        <video key={index} src={m.url} controls playsInline preload="metadata" aria-label={'Vídeo '+(index+1)+' sob revisão'}/>)}
     </div>}
     <label className="field-label">Justificativa obrigatória
       <textarea className="form-input" rows={3} maxLength={500} value={rationale}
        onChange={e=>setRationale(e.target.value)} placeholder="Descreva os motivos da sua decisão (mínimo 10 caracteres)." disabled={busy}/>
     </label>
     <div className="conecta-content-pending-actions">
      <button className="btn btn-primary" type="button" disabled={busy||rationale.trim().length<10||loadingPreview||(Boolean(current.media_type)&&!preview.length)}
       onClick={()=>void decide('approve')}><CheckCircle size={17}/> Aprovar</button>
      <button className="btn btn-outline" type="button" disabled={busy||rationale.trim().length<10}
       onClick={()=>void decide('reject')}><XCircle size={17}/> Rejeitar</button>
     </div>
     <p className="small-note">A IA faz uma triagem de riscos conhecidos, mas não identifica todo conteúdo nocivo. A responsabilidade por esta decisão é da equipe. As prévias de mídia expiram após 90 segundos.</p>
    </>}
   </div>
  </div>
 </section>;
}
