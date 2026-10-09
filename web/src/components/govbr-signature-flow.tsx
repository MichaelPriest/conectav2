'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Download,FileSignature,Upload,ShieldAlert,ExternalLink,RefreshCw} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';

type Challenge={id:string;expires_at:string;status:'issued'|'integrity_checked';created_at:string;attempt_count?:number};
type Inspection={status:string;detail:string;identityVerified:false;ageVerified:false;officialVerificationRequired:true};
const ASSINADOR='https://assinador.iti.br/';
const VALIDAR='https://validar.iti.gov.br/';

export function GovBrSignatureFlow({declaredBand}:{declaredBand:string|null}){
 const [challenge,setChallenge]=useState<Challenge|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [info,setInfo]=useState('');
 const [result,setResult]=useState<Inspection|null>(null);
 const [file,setFile]=useState<File|null>(null);
 const [downloadUrl,setDownloadUrl]=useState<string|null>(null);
 const urlRef=useRef<string|null>(null);
 const clearUrl=useCallback(()=>{
  if(urlRef.current){URL.revokeObjectURL(urlRef.current);urlRef.current=null;}
  setDownloadUrl(null);
 },[]);
 useEffect(()=>()=>{if(urlRef.current)URL.revokeObjectURL(urlRef.current);},[]);
 const getToken=useCallback(async()=>{
  const {data}=await supabaseBrowser().auth.getSession();
  return data.session?.access_token||null;
 },[]);
 const reload=useCallback(async()=>{
  try{
   const token=await getToken();if(!token)return;
   const response=await fetch('/api/identity/govbr/challenge',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
   const data=await response.json() as {challenge?:Challenge|null;error?:string};
   if(response.ok)setChallenge(data.challenge||null);
   else if(data.error)setError(data.error);
  }catch{setError('Falha ao consultar a declaracao.');}
 },[getToken]);
 useEffect(()=>{void reload();},[reload]);

 async function requestPdf(method:'POST'|'GET'){
  if(busy)return;
  setBusy(true);setError('');setInfo('Preparando sua declaracao individual...');
  clearUrl();
  try{
   const token=await getToken();
   if(!token)throw new Error('Sessao expirada. Entre na sua conta novamente.');
   const endpoint='/api/identity/govbr/challenge'+(method==='GET'?'?download=1':'');
   const response=await fetch(endpoint,{
    method,headers:{Authorization:'Bearer '+token},cache:'no-store'
   });
   if(!response.ok){
    const data=await response.json().catch(()=>({error:''})) as {error?:string};
    throw new Error(data.error||'O servidor nao conseguiu preparar o PDF (HTTP '+response.status+').');
   }
   if(!response.headers.get('content-type')?.includes('application/pdf'))
    throw new Error('O servidor nao retornou um PDF valido.');
   const blob=await response.blob();
   if(blob.size<100||blob.size>1024*1024*2||!blob.type.includes('pdf'))
    throw new Error('O arquivo recebido nao parece ser um PDF valido.');
   const header=await blob.slice(0,5).text();
   if(header!=='%PDF-')throw new Error('O arquivo retornado nao possui assinatura de formato PDF.');
   const href=URL.createObjectURL(blob);
   urlRef.current=href;setDownloadUrl(href);
   setInfo('PDF preparado. Toque em "Salvar PDF" ou "Abrir PDF" abaixo. O arquivo nao foi enviado ao gov.br.');
   await reload();
  }catch(err){
   setInfo('');
   setError(err instanceof Error?err.message:'Nao foi possivel gerar o PDF.');
  }finally{setBusy(false);}
 }
 async function inspect(){
  if(!challenge||!file||busy)return;
  if(file.size>6*1024*1024 || file.type&&file.type!=='application/pdf'){
   setError('Escolha um arquivo PDF de ate 6 MB.');return;
  }
  setBusy(true);setResult(null);setError('');setInfo('Conferindo a integridade do PDF...');
  try{
   const token=await getToken();if(!token)throw new Error('Entre na sua conta novamente.');
   const form=new FormData();
   form.append('challenge_id',challenge.id);form.append('pdf',file);
   const response=await fetch('/api/identity/govbr/inspect',{
    method:'POST',headers:{Authorization:'Bearer '+token},body:form
   });
   const data=await response.json() as Inspection & {error?:string};
   if(!response.ok)throw new Error(data.error||'Analise nao concluida.');
   setResult(data);setFile(null);setInfo('');
   await reload();
  }catch(err){setError(err instanceof Error?err.message:'Falha na analise do PDF.');}
  finally{setBusy(false);}
 }
 const attempts=challenge?.attempt_count??0;
 const exhausted=attempts>=5;
 const isActive=challenge?.status==='issued'&&Date.parse(challenge.expires_at)>Date.now()&&!exhausted;
 const completed=result?.status==='integrity_checked';

 return <section className="panel" style={{marginTop:20}}>
  <div className="feed-title"><h2><FileSignature size={22} color="#7655da" style={{verticalAlign:'middle'}}/> Declaracao assinada pelo gov.br</h2>
   <span className="small-note">Opcao gratuita · Homologacao</span></div>
  <p className="muted">Podemos analisar um PDF assinado eletronicamente por voce. A assinatura acontece
   <strong> exclusivamente no portal oficial gov.br</strong>; o Conecta nao recebe senha, selfie
   ou acesso a sua conta governamental.</p>
  <div className="stack" style={{gap:15,marginTop:18}}>
   <div><strong>1. Gere uma declaracao individual com codigo unico</strong>
    <p className="small-note">O codigo vale por 24 horas. Por seguranca, ha limite de 3 declaracoes por dia.</p>
    <div className="row" style={{gap:10,flexWrap:'wrap'}}>
      <button className="btn btn-outline" type="button" onClick={()=>void requestPdf('POST')} disabled={busy}>
       <Download size={17}/> {busy?'Gerando PDF...':'Gerar declaracao em PDF'}</button>
      {challenge?.status==='issued'&&Date.parse(challenge.expires_at)>Date.now()&&
       <button className="btn btn-outline" type="button" onClick={()=>void requestPdf('GET')} disabled={busy}>
        <RefreshCw size={17}/> Recuperar ultima declaracao</button>}
    </div>
    {downloadUrl&&<div className="row" role="group" aria-label="Opcoes para baixar a declaracao"
      style={{gap:10,flexWrap:'wrap',marginTop:12}}>
      <a className="btn btn-primary" href={downloadUrl} download="conecta-id-declaracao.pdf">
       <Download size={17}/> Salvar PDF</a>
      <a className="btn btn-outline" href={downloadUrl} target="_blank" rel="noopener noreferrer">
       <ExternalLink size={17}/> Abrir PDF</a>
    </div>}
    <div className="row" style={{gap:10,flexWrap:'wrap',marginTop:9}}>
      <form action="/api/identity/govbr/challenge" method="POST">
        <button type="submit" className="btn btn-outline" disabled={busy}>
          <Download size={17}/> Baixar direto pelo navegador
        </button>
      </form>
      {challenge?.status==='issued'&&isActive&&
        <a className="btn btn-outline" href="/api/identity/govbr/challenge?download=1"
          download="conecta-id-declaracao.pdf">
          <Download size={17}/> Baixar declaracao existente diretamente
        </a>}
    </div>
    {challenge?.status==='issued'&&<p className={exhausted?'form-error':'small-note'} role="status">
      Análises registradas nesta declaração: <strong>{Math.min(attempts,5)} de 5</strong>.
      {exhausted?' Limite desta declaração alcançado. Gere uma nova declaração e assine o novo PDF.':
        ' Se o envio falhar, verifique o resultado antes de tentar de novo.'}
    </p>}
    <p className="small-note">Se "Gerar declaracao" nao baixar no seu celular, use
      "Baixar direto pelo navegador". Esta opcao usa um download HTTP tradicional.
      Caso a declaracao ja exista, a opcao de baixar novamente evita consumir outra tentativa.</p>
   </div>
   <div><strong>2. Assine o PDF no servico oficial</strong>
    <p className="small-note">Entre no gov.br Prata ou Ouro e assine o arquivo baixado.
     Salve o <strong>PDF assinado original</strong>; imprimir ou exportar como imagem perde a assinatura.</p>
    <a className="btn btn-outline" href={ASSINADOR} target="_blank" rel="noopener noreferrer">
     <ExternalLink size={17}/> Abrir assinador oficial gov.br</a>
   </div>
   <div><strong>3. Envie o PDF assinado para inspecao criptografica</strong>
    <p className="small-note">{challenge?
     'Declaracao '+(challenge.status==='issued'?'pendente de assinatura':'ja analisada')+
      '. Validade: '+new Date(challenge.expires_at).toLocaleString('pt-BR'):
     'Gere uma declaracao antes de enviar o arquivo.'}</p>
    <label className="field-label">Arquivo PDF assinado (maximo 6 MB)
     <input className="form-input" type="file" accept="application/pdf,.pdf"
      disabled={!isActive||busy} onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
    <button type="button" className="btn btn-outline" disabled={!file||!isActive||busy}
     onClick={()=>void inspect()}><Upload size={17}/> Conferir assinatura criptografica</button>
   </div>
  </div>
  {info&&<p className="small-note" role="status">{info}</p>}
  {error&&<p className="form-error" role="alert">{error}</p>}
  {result&&<section className={completed?'form-success':'small-note'} role="status" style={{marginTop:14}}>
    <strong>{completed?'Etapa técnica: integridade da assinatura conferida':'Pré-análise ainda não concluída'}</strong>
    <p>{result.detail}</p>
    <p><strong>Atenção: autoria gov.br, identidade civil e idade continuam não verificadas.</strong></p>
    {completed&&<div style={{marginTop:12}}>
      <p>Próximo passo: confira a autoria e a validade da assinatura no VALIDAR oficial.
      A conferência no portal não é transmitida automaticamente ao Conecta.</p>
      <a className="btn btn-outline" href={VALIDAR} target="_blank" rel="noopener noreferrer">
       <ExternalLink size={17}/> Prosseguir para o VALIDAR</a>
      {declaredBand==='18_plus'&&<a className="btn btn-primary" href="/feed" style={{marginLeft:8}}>
        Continuar para o Conecta sem selo verificado</a>}
      {declaredBand!=='18_plus'&&<p>Para contas adolescentes, as funções sociais permanecem restritas
       até existir verificação independente da idade e, quando exigido, do responsável.</p>}
    </div>}
  </section>}
  {declaredBand==='18_plus'&&<div style={{marginTop:16,display:'flex',flexWrap:'wrap',gap:12,alignItems:'center'}}>
     <a className="btn btn-primary" href="/feed">Acessar Conecta sem identidade verificada</a>
     <p className="small-note" style={{margin:0}}>O acesso básico não equivale à comprovação de maioridade,
      não ativa anúncios e não gera selo de identidade.</p>
   </div>}
  <div style={{marginTop:16}}>
   <p className="small-note"><ShieldAlert size={15} style={{verticalAlign:'middle'}}/>
    O PDF sera enviado temporariamente ao servidor para analise, mas nao sera armazenado.
    O resultado local nao confirma autoria gov.br, cadeia de certificados ou situacao do documento.
    Nao enviamos o arquivo para o governo em seu nome.</p>
   <a className="btn btn-outline" href={VALIDAR} target="_blank" rel="noopener noreferrer">
    <ExternalLink size={16}/> Conferir no VALIDAR oficial do ITI</a>
   <button type="button" className="btn btn-outline" onClick={()=>void reload()} disabled={busy} style={{marginLeft:8}}>
    <RefreshCw size={16}/> Atualizar situacao</button>
  </div>
 </section>;
}
