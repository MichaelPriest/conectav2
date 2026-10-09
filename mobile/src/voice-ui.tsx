import React,{useEffect,useRef,useState} from 'react';
import {AppState,Text,View} from 'react-native';
import {
 RecordingPresets,requestRecordingPermissionsAsync,setAudioModeAsync,
 useAudioPlayer,useAudioPlayerStatus,useAudioRecorder,useAudioRecorderState
} from 'expo-audio';
import {signedMedia} from './data';
import {sendVoiceMessage} from './voice';
import {Action,styles as s} from './ui';
import {theme as t} from './theme';

const describe=(e:unknown)=>e instanceof Error?e.message:'Erro ao gravar áudio.';
const clock=(seconds:number)=>{
 const safe=Math.max(0,Math.floor(Number.isFinite(seconds)?seconds:0));
 return Math.floor(safe/60)+':'+String(safe%60).padStart(2,'0');
};
function AuthorizedAudio({url}:{url:string}){
 const player=useAudioPlayer(url);
 const status=useAudioPlayerStatus(player);
 const toggle=()=>{
  if(status.playing){player.pause();return;}
  if(status.duration>0&&status.currentTime>=status.duration-0.15)
   void player.seekTo(0);
  player.play();
 };
 return <View style={[s.row,{gap:10,marginTop:8}]}>
  <Action secondary label={status.playing?'Ⅱ Pausar':'▶ Ouvir áudio'} onPress={toggle}/>
  <Text style={s.muted}>{clock(status.currentTime)} / {clock(status.duration)}</Text>
 </View>;
}
export function AudioMessage({path}:{path:string}){
 const [url,setUrl]=useState<string|null>(null);
 useEffect(()=>{
  let active=true;setUrl(null);
  void signedMedia(path).then(value=>{if(active)setUrl(value);});
  return()=>{active=false;};
 },[path]);
 return url?<AuthorizedAudio url={url}/>:
  <Text style={s.muted}>Preparando áudio autorizado...</Text>;
}

/** Record only while the person actively holds the chat screen open. */
export function VoiceRecorder({conversationId,userId,onSent}:{
 conversationId:string;userId:string;onSent:()=>void;
}){
 const recorder=useAudioRecorder(RecordingPresets.HIGH_QUALITY);
 const status=useAudioRecorderState(recorder);
 const busy=useRef(false);
 const recordingRef=useRef(false);
 const [sending,setSending]=useState(false),[error,setError]=useState('');
 const [recording,setRecording]=useState(false);
 const stop=async(send:boolean)=>{
  if(busy.current||!recording)return;
  busy.current=true;setSending(send);setError('');
  try{
   await recorder.stop();
   const uri=recorder.uri;
   await setAudioModeAsync({allowsRecording:false,playsInSilentMode:true});
   setRecording(false);
   if(send){
    if(!uri)throw new Error('A gravação não foi salva no dispositivo.');
    await sendVoiceMessage(conversationId,userId,uri);
    onSent();
   }
  }catch(e){setError(describe(e));}
  finally{recordingRef.current=false;busy.current=false;setSending(false);setRecording(false);}
 };
 const start=async()=>{
  if(busy.current||recording||sending)return;
  busy.current=true;setError('');
  try{
   const permission=await requestRecordingPermissionsAsync();
   if(!permission.granted)throw new Error('Autorize o microfone para gravar mensagens de voz.');
   await setAudioModeAsync({allowsRecording:true,playsInSilentMode:true});
   await recorder.prepareToRecordAsync();
   recorder.record();
   recordingRef.current=true;
   setRecording(true);
  }catch(e){
   setError(describe(e));await setAudioModeAsync({allowsRecording:false}).catch(()=>{});
  }finally{busy.current=false;}
 };
 useEffect(()=>{
  if(!recording)return;
  const listener=AppState.addEventListener('change',next=>{
   if(next!=='active')void stop(false);
  });
  return()=>listener.remove();
 },[recording]);
 useEffect(()=>{
  if(recording&&status.durationMillis>=60000&&!busy.current)void stop(true);
 },[recording,status.durationMillis]);
 useEffect(()=>()=>{if(recordingRef.current)void recorder.stop().catch(()=>{});
  void setAudioModeAsync({allowsRecording:false}).catch(()=>{});
 },[recorder]);
 return <View style={{gap:5}}>
  {recording?<View style={[s.row,{gap:8,flexWrap:'wrap'}]}>
   <Text style={{color:t.danger,fontWeight:'700'}}>● Gravando {clock(status.durationMillis/1000)} / 1:00</Text>
   <Action secondary label="Descartar" onPress={()=>void stop(false)}/>
   <Action label="Enviar voz" onPress={()=>void stop(true)}/>
  </View>:
   <Action secondary disabled={sending} label={sending?'Enviando voz...':'🎙 Gravar voz'}
    onPress={()=>void start()}/>}
  {!!error&&<Text accessibilityRole="alert" style={{color:t.danger,fontSize:12}}>{error}</Text>}
 </View>;
}
