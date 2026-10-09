'use client';
import {useRef,useState,useEffect} from 'react';
import {FileImage,ShieldAlert,ScanText,ExternalLink,Trash2} from 'lucide-react';
import {inspectLegacyRgOcr} from '@/lib/legacy-rg-ocr';
import type {LegacyRgPreflight,LegacyRgBand} from '@/lib/legacy-rg-ocr';

const labels:Record<LegacyRgBand,string>={
 under_13:'menor de 13 anos',
 '13_15':'13 a 15 anos','16_17':'16 a 17 anos','18_plus':'18 anos ou mais'
};
const states=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const imageTypes=['image/jpeg','image/png','image/webp'];

export function LegacyRgScanner({declaredBand}:{declaredBand:string|null}){
 const active=useRef(true),worker=useRef<{terminate:()=>Promise<unknown>}|null>(null);
 const [uf,setUf]=useState('');
 const [front,setFront]=useState<File|null>(null);
 const [back,setBack]=useState<File|null>(null);
 const [consent,setConsent]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('Envie imagens nítidas para fazer uma leitura experimental no navegador.');
 const [result,setResult]=useState<LegacyRgPreflight|null>(null);
 useEffect(()=>{active.current=true;return()=>{
  active.current=false;
  if(worker.current)void worker.current.terminate().catch(()=>{});
 };},[]);
 function clear(){
  if(busy)return;
  setFront(null);setBack(null);setResult(null);setConsent(false);
  setMessage('Imagens e resultados apagados desta tela.');
 }
 const checkFile=(file:File|null):string|null=>{
  if(!file)return null;
  if(!imageTypes.includes(file.type)||file.size>8*1024*1024||file.size<100)
   return 'Escolha JPG, PNG ou WebP, com até 8 MB por imagem.';
  return null;
 };
 async function scan(){
  if(!consent||busy)return;
  const files=[front,back].filter((f):f is File=>Boolean(f));
  if(files.length===0){setMessage('Selecione pelo menos uma imagem do RG.');return;}
  const invalid=files.map(checkFile).find(Boolean);
  if(invalid){setMessage(invalid);return;}
  setBusy(true);setResult(null);
  setMessage('Preparando o leitor OCR gratuito; componentes e idioma poderão ser baixados para o navegador.');
  let instance:Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>|null=null;
  try{
   const {createWorker}=await import('tesseract.js');
   if(!active.current)return;
   instance=await createWorker('por',1,{
    logger:event=>{
      if(active.current&&event.status==='recognizing text'&&typeof event.progress==='number'){
       setMessage('Lendo o RG localmente: '+Math.round(event.progress*100)+'%.');
      }
    },
    cacheMethod:'none'
   });
   if(!active.current)return;
   worker.current=instance;
   const texts:string[]=[];
   for(const image of files){
    const data=await instance.recognize(image);
    if(!active.current)return;
    texts.push(data.data.text||'');
   }
   const analysis=inspectLegacyRgOcr(texts.join('\n'));
   if(active.current){
    setResult(analysis);
    setMessage(analysis.message);
   }
   // OCR text and birthdates are never retained in React state or sent to APIs.
  }catch{
   if(active.current)setMessage('Não foi possível executar a leitura OCR. Verifique sua conexão e use imagens nítidas.');
  }finally{
   try{await instance?.terminate();}catch{}
   worker.current=null;
   if(active.current){
    setBusy(false);
    setFront(null);setBack(null);
   }
  }
 }
 const mismatch=result?.band&&declaredBand&&declaredBand!==result.band;
 return <section className="panel" style={{marginTop:20}}>
  <div className="feed-title">
   <h2><ScanText size={22} color="#7655da" style={{verticalAlign:'middle'}}/> RG antigo — pré-análise gratuita</h2>
   <span className="small-note">OCR no navegador · Sem envio de imagens</span>
  </div>
  <p>Para RGs estaduais antigos, com ou sem QR Code. Selecione o estado emissor e
   fotografe a frente e o verso, quando disponíveis. O OCR procura o campo
   <strong> data de nascimento</strong>, mas <strong>não valida a autenticidade do documento</strong>.</p>
  <label className="field-label">Estado emissor do RG
   <select className="form-input" value={uf} onChange={e=>setUf(e.target.value)}>
    <option value="">Selecione o estado, se souber</option>
    {states.map(s=><option key={s} value={s}>{s}</option>)}
   </select>
  </label>
  {uf==='SP'&&<div className="small-note" style={{marginBottom:14}}>
    Se seu RG de São Paulo contém QR Code (em documentos emitidos desde fevereiro de 2014),
    confira o <a href="https://play.google.com/store/apps/details?id=br.com.vidaas.sp" target="_blank" rel="noopener noreferrer">
     RG Digital SP para Android <ExternalLink size={13} style={{verticalAlign:'middle'}}/></a> ou
    <a href="https://apps.apple.com/br/app/rg-digital-sp-s%C3%A3o-paulo/id1483279653" target="_blank" rel="noopener noreferrer">
     iPhone <ExternalLink size={13} style={{verticalAlign:'middle'}}/></a>.
    A verificação ocorre no aplicativo oficial, não no Conecta.
   </div>}
  <div className="row" style={{gap:12,flexWrap:'wrap'}}>
   <label className="field-label" style={{flex:'1 1 200px'}}>Imagem da frente do RG
    <input className="form-input" type="file" accept="image/jpeg,image/png,image/webp"
      disabled={busy} onChange={e=>{setFront(e.target.files?.[0]||null);e.target.value='';setResult(null);}}/>
    {front&&<span className="small-note">Frente selecionada</span>}
   </label>
   <label className="field-label" style={{flex:'1 1 200px'}}>Imagem do verso do RG
    <input className="form-input" type="file" accept="image/jpeg,image/png,image/webp"
      disabled={busy} onChange={e=>{setBack(e.target.files?.[0]||null);e.target.value='';setResult(null);}}/>
    {back&&<span className="small-note">Verso selecionado</span>}
   </label>
  </div>
  <label className="human-agree" style={{marginTop:12}}>
   <input type="checkbox" checked={consent} disabled={busy}
     onChange={e=>setConsent(e.target.checked)}/>
   Autorizo analisar as imagens localmente. O Conecta não as envia ao servidor,
   não armazena o texto extraído e não usa essa análise para liberar idade ou identidade.
   Os modelos de idioma poderão ser baixados pela biblioteca de OCR.
  </label>
  <div className="row" style={{gap:10,flexWrap:'wrap',marginTop:12}}>
   <button type="button" className="btn btn-outline" disabled={busy||!consent||(!front&&!back)}
     onClick={()=>void scan()}><FileImage size={17}/> {busy?'Analisando RG...':'Analisar RG antigo'}</button>
   <button type="button" className="btn btn-outline" disabled={busy}
     onClick={clear}><Trash2 size={16}/> Limpar</button>
  </div>
  <p className="small-note" role="status">{message}</p>
  {result&&<div className="conecta-cin-result caution">
   <ShieldAlert size={20}/>
   <div>
    <strong>{result.status==='age-indicative'?'Possível faixa etária encontrada':'Leitura inconclusiva'}</strong>
    {result.band&&<p>Faixa sugerida pelo OCR: <strong>{labels[result.band]}</strong>.</p>}
    {mismatch&&<p>O resultado não coincide com a faixa declarada no cadastro.
     Refaça a leitura, mas não utilize OCR como prova de idade.</p>}
    <p>Identidade, titularidade e idade continuam <strong>não verificadas</strong>.
     O Human e a assinatura gov.br são etapas separadas e não autenticam este RG.</p>
   </div>
  </div>}
  <p className="small-note">Não publique nem envie imagens do RG por mensagens.
   Para confirmar a autenticidade e situação do documento, será necessária uma
   integração oficial autorizada ou revisão documental especializada.</p>
 </section>;
}
