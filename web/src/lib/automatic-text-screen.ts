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

/**
 * A recognizable video/music link is not by itself evidence of spam.
 * Only strip canonical links from the URL-risk signal; other links and
 * surrounding threats, PII, scams and offensive words are still screened.
 */
function trustedShareLink(raw:string):boolean{
 try{
  const url=new URL(raw.replace(/[),.!?;:]+$/,''));
  if(url.protocol!=='https:'||url.username||url.password||url.port)return false;
  const host=url.hostname.toLowerCase();
  if(host==='youtu.be'||['youtube.com','www.youtube.com','music.youtube.com'].includes(host)){
   const id=host==='youtu.be'?url.pathname.slice(1):
    url.pathname==='/watch'?url.searchParams.get('v'):
    /^\/(shorts|live)\//.test(url.pathname)?url.pathname.split('/')[2]:null;
   return Boolean(id&&/^[A-Za-z0-9_-]{11}$/.test(id));
  }
  if(host==='open.spotify.com')
   return /^\/(track|album|playlist|episode|show|artist)\/[A-Za-z0-9]{12,64}\/?$/.test(url.pathname);
  if(host==='soundcloud.com'||host==='www.soundcloud.com'){
   const p=url.pathname.split('/').filter(Boolean);
   return p.length>=2&&p.length<=4&&p[0]!=='pages'&&
    p.every(x=>/^[A-Za-z0-9_-]{1,90}$/.test(x));
  }
  if(host==='music.apple.com'){
   const p=url.pathname.split('/').filter(Boolean);
   return p.length>=3&&p.length<=4&&/^[a-z]{2}$/i.test(p[0])&&
    ['album','playlist','song','music-video'].includes(p[1])&&
    p.slice(2).every(x=>/^[A-Za-z0-9._%-]{1,120}$/.test(x)&&x!=='..');
  }
  return false;
 }catch{return false;}
}

export function screenTextAutomatically(text:string):AutomaticTextVerdict{
 const value=text.trim();
 if(!value)return {reviewRequired:false,reason:'Sem texto para classificar.',engine:'profanity-br-v0.1.1'};
 if(value.length>500){
  return {reviewRequired:true,reason:'Texto longo requer avaliação contextual.',engine:'profanity-br-v0.1.1'};
 }
 const contentWithoutTrustedMediaUrls=value.replace(/https:\/\/[^\s<>"']+/gi,
  raw=>trustedShareLink(raw)?' ':raw);
 if(signalPatterns.some(re=>re.test(contentWithoutTrustedMediaUrls))){
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
