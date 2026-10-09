/**
 * CSRF origin check for bearer-authenticated Chat Push routes.
 * Render can expose an internal Next.js request.url (localhost:10000) even
 * while the browser Origin is the public HTTPS hostname.
 *
 * Only the exact deployment origins below (or an explicitly configured HTTPS
 * public origin) may cross the internal proxy URL boundary. NEVER trust an
 * unvalidated X-Forwarded-Host or X-Forwarded-Proto from a request.
 */
export const CHAT_PUSH_DEPLOYMENT_ORIGINS = [
  'https://conectav2-validacao.onrender.com',
  'https://conectav2-michael-raimundos-projects.vercel.app'
] as const;
export type ChatPushOriginRequest = {
  requestUrl:string;
  origin:string|null;
  fetchSite:string|null;
  extraTrustedOrigin?:string;
};

function explicitHttpsOrigin(value:string|undefined):string|null{
  if(!value)return null;
  try{
    const url=new URL(value);
    return url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&
      !url.hash&&!url.port&&url.pathname==='/'&&value===url.origin?
      url.origin:null;
  }catch{return null;}
}

export function allowedChatPushRequestOrigin(input:ChatPushOriginRequest):boolean{
  // Browser-generated Fetch Metadata cannot claim same-origin for a cross-site
  // request, even if an attacker attempts to force a trusted Origin header.
  if(input.fetchSite==='cross-site')return false;
  // No Origin is valid for non-browser clients, but all push write endpoints
  // still require a verified user JWT (webhook uses separate HMAC auth).
  if(input.origin===null)return true;
  let actualOrigin:string;
  try{
    const parsed=new URL(input.origin);
    if(!['https:','http:'].includes(parsed.protocol)||input.origin!==parsed.origin||
      parsed.username||parsed.password||parsed.hash||parsed.search)return false;
    actualOrigin=parsed.origin;
  }catch{return false;}
  try{
    const requestOrigin=new URL(input.requestUrl).origin;
    if(actualOrigin===requestOrigin)return true;
  }catch{return false;}
  const configured=explicitHttpsOrigin(input.extraTrustedOrigin);
  return CHAT_PUSH_DEPLOYMENT_ORIGINS.some(trusted=>actualOrigin===trusted)||
    configured!==null&&actualOrigin===configured;
}
