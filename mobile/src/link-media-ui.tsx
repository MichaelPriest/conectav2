import React,{useState} from 'react';
import {Linking,Pressable,Text,View} from 'react-native';
import {VideoView,useVideoPlayer} from 'expo-video';
import {useAudioPlayer,useAudioPlayerStatus} from 'expo-audio';
import {WebView} from 'react-native-webview';
import {Music2,ExternalLink,Play,Video} from 'lucide-react-native';
import {linksInContent,trustedMediaEmbed} from './link-media';
import type {LinkedMedia} from './link-media';
import {theme as t} from './theme';

function LinkedVideo({url}:{url:string}){
 const player=useVideoPlayer(url);
 return <VideoView player={player} nativeControls fullscreenOptions={{enable:true}}
  style={{height:205,width:'100%',borderRadius:12,marginTop:10}}/>;
}
function LinkedAudio({url}:{url:string}){
 const player=useAudioPlayer(url);
 const status=useAudioPlayerStatus(player);
 return <Pressable accessibilityRole="button"
  accessibilityLabel={status.playing?'Pausar áudio':'Reproduzir áudio'}
  onPress={()=>{if(status.playing)player.pause();else player.play();}}
  style={{marginTop:9,padding:12,borderRadius:12,backgroundColor:t.subtle}}>
  <Text style={{color:t.primary,fontWeight:'800'}}>
   {status.playing?'Ⅱ Pausar áudio':'▶ Reproduzir áudio'}
  </Text>
 </Pressable>;
}
function ProviderPlayer({embed,provider,onError}:{
 embed:string;provider:LinkedMedia['provider'];onError:()=>void
}){
 const host=new URL(embed).hostname;
 const height=provider==='YouTube'?240:provider==='SoundCloud'?190:160;
 return <WebView
  source={{uri:embed}}
  style={{height,width:'100%',borderRadius:12,marginTop:10,
   backgroundColor:'#F5F3FC'}}
  javaScriptEnabled domStorageEnabled
  mediaPlaybackRequiresUserAction
  allowsInlineMediaPlayback allowsFullscreenVideo
  sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false}
  incognito cacheEnabled={false}
  setSupportMultipleWindows={false}
  onShouldStartLoadWithRequest={request=>{
   if(request.url==='about:blank')return true;
   try{
    const url=new URL(request.url);
    return url.protocol==='https:'&&url.hostname===host;
   }catch{return false;}
  }}
  onError={onError}
  onHttpError={onError}
 />;
}
function MediaLink({media}:{media:LinkedMedia}){
 const [active,setActive]=useState(false);
 const [error,setError]=useState('');
 const embed=trustedMediaEmbed(media);
 const open=()=>{
  setError('');
  void Linking.openURL(media.url).catch(()=>
   setError('Não foi possível abrir o aplicativo ou navegador de mídia.'));
 };
 const play=()=>{
  setError('');
  setActive(true);
 };
 return <View style={{backgroundColor:t.bg,borderRadius:15,borderWidth:1,
  borderColor:t.line,padding:13,marginTop:10}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
   {media.kind==='video'||media.provider==='YouTube'?
     <Video color={t.primary} size={20}/>:<Music2 color={t.primary} size={20}/>}
   <View style={{flex:1}}>
    <Text style={{fontWeight:'800',fontSize:13,color:t.dark}}>{media.provider}</Text>
    <Text style={{fontSize:11,color:t.muted}} numberOfLines={1}>{media.url}</Text>
   </View>
   {media.kind==='external'?<ExternalLink color={t.primary} size={17}/>:
    <Play color={t.primary} size={17}/>}
  </View>
  {active&&media.kind==='video'?<LinkedVideo url={media.url}/>:
   active&&media.kind==='audio'?<LinkedAudio url={media.url}/>:
   active&&embed?<ProviderPlayer embed={embed} provider={media.provider}
    onError={()=>setError('O player não carregou. Você também pode abrir no serviço original.')}/>:
   <Pressable accessibilityRole="button"
    accessibilityLabel={media.kind==='external'?'Carregar player '+media.provider:media.title}
    onPress={play} style={{padding:11,backgroundColor:t.subtle,
     marginTop:9,borderRadius:11,alignItems:'center'}}>
    <Text style={{fontWeight:'800',color:t.primary}}>
     {media.kind==='external'?'▶ Reproduzir no feed':media.title}
    </Text>
   </Pressable>}
  {active&&<Pressable accessibilityRole="button" accessibilityLabel="Fechar player"
   onPress={()=>setActive(false)} style={{padding:8,alignItems:'center'}}>
   <Text style={{color:t.primary,fontWeight:'700'}}>Fechar player</Text>
  </Pressable>}
  {media.kind==='external'&&<Pressable accessibilityRole="link"
   accessibilityLabel={'Abrir no '+media.provider}
   onPress={open} style={{paddingVertical:8,alignItems:'center'}}>
   <Text style={{fontSize:12,color:t.primary,fontWeight:'800'}}>Abrir no {media.provider} ↗</Text>
  </Pressable>}
  {media.kind==='external'&&<Text style={{fontSize:11,color:t.muted,marginTop:6}}>
   O player externo é carregado somente após o seu toque.
  </Text>}
  {!!error&&<Text accessibilityRole="alert" style={{color:t.danger,marginTop:6}}>{error}</Text>}
 </View>;
}
export function LinkedMediaPreview({content}:{content:string}){
 const links=linksInContent(content);
 if(!links.length)return null;
 return <View>{links.map(media=><MediaLink key={media.url} media={media}/>)}</View>;
}
