export type LinkedMedia={
 url:string;title:string;kind:'external'|'audio'|'video';
 provider:'YouTube'|'Spotify'|'SoundCloud'|'Apple Music'|'Vídeo'|'Áudio'
};
const HTTPS=/https:\/\/[^\s<>"'\u0000-\u001f]+/gi;
function valid(url:URL):boolean{
 const host=url.hostname.toLowerCase();
 return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&
   url.href.length<=1600&&host.includes('.')&&!host.startsWith('[')&&
   host!=='localhost'&&!host.endsWith('.localhost')&&!host.endsWith('.local')&&
   !/^(?:\\d{1,3}\\.){3}\\d{1,3}$/.test(host);
}
/** Only permitted audio/video URLs are offered. Nothing loads from third parties
 * until the person explicitly opens/plays a link. No arbitrary iframe HTML. */
export function classifyMediaLink(value:string):LinkedMedia|null{
 try{
  const url=new URL(value);
  if(!valid(url))return null;
  const host=url.hostname.toLowerCase();
  if(host==='youtu.be'||host==='youtube.com'||host==='www.youtube.com'||
     host==='music.youtube.com'){
   const id=host==='youtu.be'?url.pathname.slice(1):
     url.pathname==='/watch'?url.searchParams.get('v'):
     /^\/(?:shorts|live|embed)\//.test(url.pathname)?url.pathname.split('/')[2]:null;
   if(id&&/^[a-zA-Z0-9_-]{11}$/.test(id))
    return {kind:'external',provider:'YouTube',
     url:'https://www.youtube.com/watch?v='+id,title:'Assistir no YouTube'};
   return null;
  }
  if(host==='open.spotify.com'){
   const m=/^\/(track|album|playlist|episode|show|artist)\/([a-zA-Z0-9]{12,64})\/?$/.exec(url.pathname);
   if(!m)return null;
   return {kind:'external',provider:'Spotify',
    url:'https://open.spotify.com/'+m[1]+'/'+m[2],title:'Ouvir no Spotify'};
  }
  if(host==='soundcloud.com'||host==='www.soundcloud.com'){
   const parts=url.pathname.split('/').filter(Boolean);
   if(parts.length<2||parts.length>4||!parts.every(p=>/^[a-zA-Z0-9_-]{1,90}$/.test(p))||
      parts[0]==='pages')return null;
   return {kind:'external',provider:'SoundCloud',
    url:'https://soundcloud.com/'+parts.join('/'),title:'Ouvir no SoundCloud'};
  }
  if(host==='music.apple.com'){
   const parts=url.pathname.split('/').filter(Boolean);
   if(parts.length<3||parts.length>4||!/^[a-z]{2}$/i.test(parts[0])||
     !['album','playlist','song','music-video'].includes(parts[1])||
     !parts.slice(2).every(p=>/^[a-zA-Z0-9._%-]{1,120}$/.test(p)&&p!=='..'))return null;
   const item=url.searchParams.get('i');
   return {kind:'external',provider:'Apple Music',
    url:'https://music.apple.com/'+parts.join('/')+(item&&/^\d+$/.test(item)?'?i='+item:''),
    title:'Ouvir no Apple Music'};
  }
  // Direct media may be played in-app only by explicit tap, never automatically.
  if(/\.(mp4|m4v|webm)$/i.test(url.pathname))
   return {kind:'video',provider:'Vídeo',url:url.toString(),title:'Reproduzir vídeo'};
  if(/\.(mp3|m4a|aac|ogg|wav)$/i.test(url.pathname))
   return {kind:'audio',provider:'Áudio',url:url.toString(),title:'Reproduzir áudio'};
  return null;
 }catch{return null;}
}
export function linksInContent(content:string):LinkedMedia[]{
 const results:LinkedMedia[]=[],seen=new Set<string>();
 for(const match of content.matchAll(HTTPS)){
  const raw=match[0].replace(/[),.!?;:\]]+$/g,'');
  const parsed=classifyMediaLink(raw);
  if(!parsed||seen.has(parsed.url))continue;
  seen.add(parsed.url);results.push(parsed);
  if(results.length>=3)break;
 }
 return results;
}

/** Canonical in-app embeds reuse the same providers as the Conecta Web.
 * Never use an untrusted post URL as an iframe source. */
export function trustedMediaEmbed(media:LinkedMedia):string|null{
 if(media.kind!=='external')return null;
 try{
  const parsed=classifyMediaLink(media.url);
  if(!parsed||parsed.kind!=='external'||parsed.provider!==media.provider||
     parsed.url!==media.url)return null;
  const url=new URL(parsed.url);
  if(parsed.provider==='YouTube'){
   const id=url.searchParams.get('v');
   return id&&/^[a-zA-Z0-9_-]{11}$/.test(id)?
    'https://www.youtube-nocookie.com/embed/'+id+'?rel=0':null;
  }
  if(parsed.provider==='Spotify')
   return 'https://open.spotify.com/embed'+url.pathname;
  if(parsed.provider==='SoundCloud')
   return 'https://w.soundcloud.com/player/?url='+encodeURIComponent(parsed.url)+
    '&auto_play=false';
  if(parsed.provider==='Apple Music')
   return 'https://embed.music.apple.com'+url.pathname+url.search;
  return null;
 }catch{return null;}
}
