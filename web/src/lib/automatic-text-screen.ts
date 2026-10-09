import 'server-only';
import {analisar} from 'profanity-br';

/**
 * Fast fail-closed PT-BR server check, MIT open-source profanity-br.
 * This is a deterministic complement to the larger multilingual neural model,
 * not a substitute for contextual/child safety classification.
 * Never forward private chats or user content to an external AI endpoint.
 */
export type AutomaticTextVerdict={
  reviewRequired:boolean;
  reason:string;
  engine:'profanity-br-v0.1.1';
};
const signalPatterns=[
  /(?:\b(?:pix|transfer[eê]ncia)\s+(?:urgente|agora)\b)/i,
  /\b(?:renda|lucro)\s+garantid[oa]s?\b/i,
  /\b(?:vou|vamos)\s+(?:te|lhe|voc[eê])\s+(?:matar|espancar|agredir)\b/i,
  /\b(?:me\s+mata|vou\s+me\s+matar|tirar\s+minha\s+vida)\b/i,
  /\b(?:material\s+de\s+abuso\s+sexual\s+infantil|csam)\b/i,
  /\b(?:nudes?|porn[oô])\s+(?:de|com)\s+(?:menor|crian[çc]a|adolescente)\b/i,
  /(?:https?:\/\/|www\.)/i,
  /(?:\+?55\s*)?\(?\d{2}\)?\s*9?\d{4}[\s.-]?\d{4}/
];

export function screenTextAutomatically(text:string):AutomaticTextVerdict{
 const value=text.trim();
 if(!value)return {reviewRequired:false,reason:'Sem texto para classificar.',engine:'profanity-br-v0.1.1'};
 if(value.length>500){
  return {reviewRequired:true,reason:'Texto longo requer avaliação contextual.',engine:'profanity-br-v0.1.1'};
 }
 if(signalPatterns.some(re=>re.test(value))){
  return {reviewRequired:true,reason:'Possível risco contextual, dados pessoais ou conteúdo sensível.',engine:'profanity-br-v0.1.1'};
 }
 // Strong personal insults or heavy vulgarity need context. Mild profanity can
 // appear in discussions; ordinary Portuguese is not blocked by word alone.
 const analysis=analisar(value,{
  locale:'pt-BR',
  limites:{vulgaridadeMax:2,alvoSeveridadeMax:1}
 });
 if(analysis.excedeuLimites ||
   analysis.hits.some(hit=>hit.confianca==='ambigua')){
  return {reviewRequired:true,reason:'Linguagem ofensiva ou ambígua para análise humana.',engine:'profanity-br-v0.1.1'};
 }
 return {reviewRequired:false,reason:'Triagem lexical PT-BR concluída sem alerta conhecido.',engine:'profanity-br-v0.1.1'};
}
