import React,{useState} from 'react';
import {Linking,Pressable,Text,View} from 'react-native';
import {VideoView,useVideoPlayer} from 'expo-video';
import {useAudioPlayer,useAudioPlayerStatus} from 'expo-audio';
import {Music2,ExternalLink,Play,Pause,Video} from 'lucide-react-native';
import {linksInContent} from './link-media';
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
function MediaLink({media}:{media:LinkedMedia}){
 const [active,setActive]=useState(false);
 const [error,setError]=useState('');
 const play=()=>{
  setError('');
  if(media.kind==='external'){
   void Linking.openURL(media.url).catch(()=>
    setError('Não foi possível abrir o aplicativo ou navegador de mídia.'));
  }else setActive(true);
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
   <Pressable accessibilityRole="button" accessibilityLabel={media.title}
    onPress={play} style={{padding:11,backgroundColor:t.subtle,
     marginTop:9,borderRadius:11,alignItems:'center'}}>
    <Text style={{fontWeight:'800',color:t.primary}}>{media.title}</Text>
   </Pressable>}
  {media.kind==='external'&&<Text style={{fontSize:11,color:t.muted,marginTop:6}}>
   O serviço externo abre somente após o seu toque.
  </Text>}
  {!!error&&<Text accessibilityRole="alert" style={{color:t.danger,marginTop:6}}>{error}</Text>}
 </View>;
}
export function LinkedMediaPreview({content}:{content:string}){
 const links=linksInContent(content);
 if(!links.length)return null;
 return <View>{links.map(media=><MediaLink key={media.url} media={media}/>)}</View>;
}
