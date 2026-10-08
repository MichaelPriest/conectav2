'use client';
import {useState} from 'react';
import {ExternalLink,Music2,Play} from 'lucide-react';

export type MusicInfo={provider:'Spotify'|'YouTube'|'SoundCloud'|'Apple Music';url:string;embed:string};
export function parseMusicUrl(raw:string|null|undefined):MusicInfo|null {
  if(!raw)return null;
  try{
    const url=new URL(raw);
    if(url.protocol!=='https:')return null;
    const host=url.hostname.toLowerCase();
    if(host==='open.spotify.com'){
      const match=url.pathname.match(/^\/(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]{12,64})\/?$/);
      if(!match)return null;
      return {provider:'Spotify',url:'https://open.spotify.com/'+match[1]+'/'+match[2],
        embed:'https://open.spotify.com/embed/'+match[1]+'/'+match[2]};
    }
    if(host==='soundcloud.com'||host==='www.soundcloud.com'){
      const parts=url.pathname.split('/').filter(Boolean);
      if(parts.length>=2 && parts.length<=4 && parts.every(p=>/^[A-Za-z0-9_-]{1,90}$/.test(p)) && parts[0]!=='pages'){
        const clean='https://soundcloud.com/'+parts.join('/');
        return {provider:'SoundCloud',url:clean,embed:'https://w.soundcloud.com/player/?url='+encodeURIComponent(clean)+'&auto_play=false'};
      }
    }
    if(host==='music.apple.com'){
      const parts=url.pathname.split('/').filter(Boolean);
      if(parts.length>=3&&parts.length<=4&&/^[a-z]{2}$/i.test(parts[0])&&
         ['album','playlist','song','music-video'].includes(parts[1])&&
         parts.slice(2).every(p=>/^[A-Za-z0-9._%-]{1,120}$/.test(p)&&p!=='..')){
        const clean='https://music.apple.com/'+parts.join('/');
        const item=url.searchParams.get('i');
        const suffix=item&&/^\d+$/.test(item)?'?i='+item:'';
        return {provider:'Apple Music',url:clean+suffix,embed:'https://embed.music.apple.com/'+parts.join('/')+suffix};
      }
    }
    let id:string|null=null;
    if(host==='youtu.be')id=url.pathname.slice(1);
    else if(['youtube.com','www.youtube.com','music.youtube.com'].includes(host)){
      if(url.pathname==='/watch')id=url.searchParams.get('v');
      else if(url.pathname.startsWith('/shorts/'))id=url.pathname.split('/')[2];
    }
    if(id && /^[a-zA-Z0-9_-]{11}$/.test(id)){
      return {provider:'YouTube',url:'https://www.youtube.com/watch?v='+id,
        embed:'https://www.youtube-nocookie.com/embed/'+id};
    }
    return null;
  }catch{return null;}
}

/** External players are only loaded after an explicit user click. */
export function MusicEmbed({url}:{url:string|null|undefined}){
  const music=parseMusicUrl(url);
  const [opened,setOpened]=useState(false);
  if(!music)return null;
  return <section className="conecta-music-embed">
    <div className="conecta-music-heading"><Music2 size={18}/><strong>Minha trilha sonora · {music.provider}</strong><a href={music.url} target="_blank" rel="noreferrer noopener" aria-label={'Abrir no '+music.provider}><ExternalLink size={16}/></a></div>
    {opened?<iframe title={'Reprodutor '+music.provider} src={music.embed} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="encrypted-media; autoplay; clipboard-write; picture-in-picture" allowFullScreen style={{width:'100%',height:music.provider==='YouTube'?240:music.provider==='SoundCloud'?175:155,border:0,borderRadius:12}}/>
      :<button type="button" className="conecta-music-optin" onClick={()=>setOpened(true)}><Play size={19}/> Carregar player {music.provider} <small>O serviço externo será acessado somente após seu clique.</small></button>}
  </section>;
}
