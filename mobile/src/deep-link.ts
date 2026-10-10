export type ConectaDestination={type:'post';id:string}|{type:'notifications'}|null;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseConectaLink(value:string):ConectaDestination{
 try{
  const url=new URL(value);
  if(url.search||url.hash||url.username||url.password)return null;
  let route='';
  if(url.protocol==='conecta:'){
   if(!['','post','notifications'].includes(url.host))return null;
   route=url.host?'/'+url.host+url.pathname:url.pathname;
  }else if(url.protocol==='https:'&&url.host==='conectav2-validacao.onrender.com'){
   route=url.pathname;
  }else return null;
  if(route==='/notifications'||route==='/notificacoes')return {type:'notifications'};
  const match=/^\/post\/([^/]+)\/?$/.exec(route);
  if(match&&UUID.test(match[1]))return {type:'post',id:match[1].toLowerCase()};
  return null;
 }catch{return null;}
}
