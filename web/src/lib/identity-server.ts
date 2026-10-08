import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import type {NextRequest} from 'next/server';

export const runtimeConfig = {
  get supabaseUrl(){return process.env.NEXT_PUBLIC_SUPABASE_URL;},
  get publicKey(){return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;},
  get serviceKey(){return process.env.SUPABASE_SERVICE_ROLE_KEY;},
  get providerApiKey(){return process.env.PERSONA_API_KEY;},
  get inquiryTemplate(){return process.env.PERSONA_TEMPLATE_ID;}
};

export function identityConfigured():boolean {
  return Boolean(runtimeConfig.supabaseUrl && runtimeConfig.publicKey &&
    runtimeConfig.serviceKey && runtimeConfig.providerApiKey && runtimeConfig.inquiryTemplate);
}

/** Authenticate the user's bearer token with Supabase Auth (never via mutable user_metadata). */
export async function identityContext(request:NextRequest){
  const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if(!token||!runtimeConfig.supabaseUrl||!runtimeConfig.publicKey||
     !runtimeConfig.serviceKey)return null;
  const authClient=createClient(runtimeConfig.supabaseUrl,runtimeConfig.publicKey,{
    auth:{persistSession:false,autoRefreshToken:false}
  });
  const {data,error}=await authClient.auth.getUser(token);
  if(error||!data.user)return null;
  const admin=createClient(runtimeConfig.supabaseUrl,runtimeConfig.serviceKey,{
    auth:{persistSession:false,autoRefreshToken:false}
  });
  return {user:data.user,admin};
}

export type PersonaInquiry = {
  data?:{id?:string;attributes?:{
    status?:string;
    'reference-id'?:string;
  }};
  meta?:{'one-time-link'?:string};
};

export async function personaRequest(url:string,init:RequestInit={}):Promise<PersonaInquiry>{
  if(!runtimeConfig.providerApiKey)throw new Error('Provider is not configured');
  const response=await fetch(url,{
    ...init,
    headers:{
      Authorization:'Bearer '+runtimeConfig.providerApiKey,
      Accept:'application/json',
      'Content-Type':'application/json',
      'Persona-Version':'2025-12-08',
      ...(init.headers||{})
    },
    cache:'no-store',
    signal:AbortSignal.timeout(15000)
  });
  if(!response.ok)throw new Error('Biometric provider temporarily unavailable');
  return (await response.json()) as PersonaInquiry;
}

export function safePersonaLink(raw:string|undefined):string|null{
  if(!raw)return null;
  try{
    const url=new URL(raw);
    return url.protocol==='https:' &&
      (url.hostname==='withpersona.com' || url.hostname.endsWith('.withpersona.com') ||
       url.hostname==='go.perso.na')?url.toString():null;
  }catch{return null;}
}

/**
 * Scoped identity access: uses the signed-in user's own JWT and table RLS,
 * never an administrative service role. Required by free gov.br PDF flow.
 */
export async function identityUserContext(request:NextRequest){
 if(!runtimeConfig.supabaseUrl||!runtimeConfig.publicKey)return null;
 const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
 if(token){
   const client=createClient(runtimeConfig.supabaseUrl,runtimeConfig.publicKey,{
     auth:{persistSession:false,autoRefreshToken:false},
     global:{headers:{Authorization:'Bearer '+token}}
   });
   const {data,error}=await client.auth.getUser(token);
   if(error||!data.user)return null;
   return {user:data.user,db:client};
 }
 // Native browser navigation and regular HTML forms cannot attach a Bearer
 // header. The same @supabase/ssr browser client keeps a session in cookies.
 // Always validate it with getUser(), NEVER trust unvalidated cookie claims.
 const client=createServerClient(runtimeConfig.supabaseUrl,runtimeConfig.publicKey,{
   cookies:{
     getAll(){return request.cookies.getAll();},
     setAll(){/* Read-only route: browser client manages refreshing its cookies. */}
   }
 });
 const {data,error}=await client.auth.getUser();
 if(error||!data.user)return null;
 return {user:data.user,db:client};
}
