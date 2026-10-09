'use client';
import {useEffect,useState} from 'react';
import {Brain,Clapperboard,Loader2,ShieldAlert} from 'lucide-react';
import type {TextTriage,VideoTriage} from '@/lib/browser-moderation';

type Result<T>={key:string;value:T};
export function LocalAIReview({itemKey,text,videoUrl}:{
 itemKey:string;text?:string;videoUrl?:string
}){
 const [running,setRunning]=useState<'text'|'video'|null>(null);
 const [textResult,setTextResult]=useState<Result<TextTriage>|null>(null);
 const [videoResult,setVideoResult]=useState<Result<VideoTriage>|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{setError('');setRunning(null);},[itemKey]);
 async function runText(){
  if(!text?.trim()||running)return;
  setRunning('text');setError('');
  try{
   const {analyzeTextInBrowser}=await import('@/lib/browser-moderation');
   const verdict=await analyzeTextInBrowser(text);
   setTextResult({key:itemKey,value:verdict});
  }catch(e){
   setError('Não foi possível iniciar a IA textual no dispositivo: '+
      (e instanceof Error?e.message:'sem detalhes')+'. Revise manualmente.');
  }finally{setRunning(null);}
 }
 async function runVideo(){
  if(!videoUrl||running)return;
  setRunning('video');setError('');
  try{
   const {analyzeVideoInBrowser}=await import('@/lib/browser-moderation');
   const verdict=await analyzeVideoInBrowser(videoUrl);
   setVideoResult({key:itemKey,value:verdict});
  }catch(e){
   setError('Não foi possível analisar os quadros do vídeo: '+
      (e instanceof Error?e.message:'arquivo indisponível')+
      '. Assista ao vídeo completo antes da decisão.');
  }finally{setRunning(null);}
 }
 const txt=textResult?.key===itemKey?textResult.value:null;
 const vid=videoResult?.key===itemKey?videoResult.value:null;
 if(!text?.trim()&&!videoUrl)return null;
 return <section className="conecta-content-review" aria-label="Apoio por IA local">
  <strong><Brain size={15}/> IA gratuita · processamento no navegador do moderador</strong>
  <div className="conecta-content-pending-actions">
   {Boolean(text?.trim())&&<button className="btn btn-outline" type="button"
    disabled={Boolean(running)} onClick={()=>void runText()}>
    {running==='text'?<Loader2 size={15} className="spin"/>:<Brain size={15}/>}
    {running==='text'?'Analisando texto...':'Analisar texto localmente'}
   </button>}
   {Boolean(videoUrl)&&<button className="btn btn-outline" type="button"
    disabled={Boolean(running)} onClick={()=>void runVideo()}>
    {running==='video'?<Loader2 size={15} className="spin"/>:<Clapperboard size={15}/>}
    {running==='video'?'Analisando quadros...':'Analisar 5 quadros do vídeo'}
   </button>}
  </div>
  {Boolean(text?.trim())&&!txt&&
   <small>O modelo multilíngue usa cerca de 268 MB de download inicial, sem cobrar API. O texto é analisado neste dispositivo.</small>}
  {running&&<small role="status">O modelo é carregado sob demanda. Não saia da tela durante a classificação.</small>}
  {error&&<small className="form-error" role="alert">{error}</small>}
  {txt&&<div className="conecta-local-ai-results" role="status">
    <strong><ShieldAlert size={14}/> {txt.flagged?'Possível risco textual':'Triagem textual concluída'}</strong>
    <span>{txt.summary}</span>
    <small>Probabilidade de toxicidade: {((txt.labels.toxicity||0)*100).toFixed(0)}%; ameaça: {((txt.labels.threat||0)*100).toFixed(0)}%; insulto: {((txt.labels.insult||0)*100).toFixed(0)}%.</small>
    <small>Modelo: {txt.model}. Pontuações aproximadas, sujeitas a erros em português e contexto de humor.</small>
   </div>}
  {vid&&<div className="conecta-local-ai-results" role="status">
    <strong><ShieldAlert size={14}/> {vid.flagged?'Possível risco no vídeo':'Triagem parcial do vídeo concluída'}</strong>
    <span>{vid.summary}</span>
    <small>{vid.framesAnalysed} quadros examinados, maior indicador sexual {Math.round(vid.maxExplicitScore*100)}%. Modelo: {vid.model}.</small>
   </div>}
  <small>Esta análise é apenas apoio ao moderador. Não publica, remove ou aprova conteúdo automaticamente e não substitui a visualização completa.</small>
 </section>;
}
