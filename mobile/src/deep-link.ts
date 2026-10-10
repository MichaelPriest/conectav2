/** Allowlisted native destinations. Authorization remains server-side in Supabase RLS. */
export type ConectaDestination=
 |{type:'post';id:string}
 |{type:'profile';handle:string}
 |{type:'community';slug:string}
 |{type:'messages'}
 |{type:'notifications'}
 |null;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HANDLE=/^[a-z0-9][a-z0-9._-]{0,39}$/i;
const SLUG=/^[a-z0-9][a-z0-9-]{1,59}$/;
const OFFICIAL_HOST='conectav2-validacao.onrender.com';
const SCHEME_HOSTS=new Set(['','post','p','profile','comunidades','community',
 'communities','notifications','notificacoes','mensagens','messages']);

export function parseConectaLink(value:string):ConectaDestination{
 try{
  const url=new URL(value);
  if(url.search||url.hash||url.username||url.password||url.port)return null;
  let route='';
  if(url.protocol==='conecta:'){
   if(!SCHEME_HOSTS.has(url.hostname))return null;
   route=url.hostname?'/'+url.hostname+url.pathname:url.pathname;
  }else if(url.protocol==='https:'&&url.hostname===OFFICIAL_HOST){
   route=url.pathname;
  }else return null;
  if(route==='/notifications'||route==='/notificacoes'||
     route==='/notifications/'||route==='/notificacoes/')
    return {type:'notifications'};
  if(route==='/mensagens'||route==='/messages'||
     route==='/mensagens/'||route==='/messages/')
    return {type:'messages'};
  let match=/^\/post\/([^/]+)\/?$/.exec(route);
  if(match&&UUID.test(match[1]))return {type:'post',id:match[1].toLowerCase()};
  match=/^\/(?:p|profile)\/([^/]+)\/?$/.exec(route);
  if(match&&HANDLE.test(match[1]))return {type:'profile',handle:match[1].toLowerCase()};
  match=/^\/(?:comunidades|communities|community)\/([^/]+)\/?$/.exec(route);
  if(match&&SLUG.test(match[1]))return {type:'community',slug:match[1]};
  return null;
 }catch{return null;}
}
