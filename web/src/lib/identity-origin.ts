/**
 * Strict same-origin check for identity endpoints behind Render / Vercel proxies.
 *
 * request.url can be an internal Render origin (http://0.0.0.0:10000),
 * while the browser Origin is the public https URL.
 * Never disable CSRF protection to work around reverse proxies.
 */
type OriginHeaders={get:(name:string)=>string|null};

function safeOrigin(value:string):string|null {
 try {
  const url=new URL(value);
  if(url.username||url.password||url.pathname!=='/'||url.search||url.hash)return null;
  if(url.protocol!=='https:' && !(url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname)))return null;
  return url.origin;
 }catch{return null;}
}

export function isTrustedIdentityOrigin(
 headers:OriginHeaders,requestUrl:string,env:Readonly<Record<string,string|undefined>>={}
):boolean {
 const raw=headers.get('origin');
 const site=headers.get('sec-fetch-site');
 // An explicit cross-site request is never allowed (including with no Origin).
 if(site==='cross-site')return false;
 if(!raw){
  // A native browser form normally includes Origin. Allow clients only when
  // their Fetch Metadata says same-origin, or when using bearer authorization
  // (not attachable by a cross-origin HTML form).
  return site==='same-origin'||site==='none'||Boolean(headers.get('authorization')?.match(/^Bearer \S+$/i));
 }
 const origin=safeOrigin(raw);
 if(!origin)return false;
 let url:URL;
 try{url=new URL(requestUrl);}catch{return false;}
 if(origin===url.origin)return true;
 // Official public staging hostname: the reverse proxy may rewrite request.url.
 if(origin==='https://conectav2-validacao.onrender.com')return true;
 // Other owned deployments can set their canonical public origin.
 for(const value of [env.CONECTA_PUBLIC_ORIGIN,env.NEXT_PUBLIC_APP_URL,env.RENDER_EXTERNAL_URL]){
  if(value && origin===safeOrigin(value))return true;
 }
 if(env.VERCEL_URL && origin===safeOrigin('https://'+env.VERCEL_URL))return true;
 // Normal same-origin hosting when Next.js request.url was rewritten but its
 // forwarded host matches the browser's current public hostname.
 const rawHost=headers.get('host');
 const forwardedHost=headers.get('x-forwarded-host');
 const hostMatch=(candidate:string|null)=>{
  if(!candidate||candidate.includes(',')||/[\s/@]/.test(candidate))return false;
  return origin===safeOrigin('https://'+candidate) ||
         (origin.startsWith('http://localhost:') && origin===safeOrigin('http://'+candidate));
 };
 return hostMatch(rawHost) || (hostMatch(forwardedHost) && site==='same-origin');
}
