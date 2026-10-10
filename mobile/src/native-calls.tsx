import React,{createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import {AppState,Modal,Pressable,Text,View,Vibration} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
 mediaDevices,RTCPeerConnection,RTCIceCandidate,RTCView
} from 'react-native-webrtc';
import type {MediaStream} from 'react-native-webrtc';
import {Phone,PhoneOff,Video,Mic,MicOff,VideoOff} from 'lucide-react-native';
import {supabase} from './supabase';
import {theme as t} from './theme';

type CallKind='audio'|'video';
type CallRow={
 id:string;conversation_id:string;caller_id:string;callee_id:string;kind:CallKind;
 status:'ringing'|'accepted'|'ended'|'declined'|'missed';
 offer_sdp:string|null;answer_sdp:string|null;expires_at:string
};
type CallsContext={
 start:(conversationId:string,recipientId:string,name:string,kind:CallKind)=>Promise<void>;
 busy:boolean;error:string;hasCall:boolean;
};
const Context=createContext<CallsContext|null>(null);
const FIELDS='id,conversation_id,caller_id,callee_id,kind,status,offer_sdp,answer_sdp,expires_at';
const RTC_CONFIG={iceServers:[{urls:[
 'stun:stun.cloudflare.com:3478','stun:stun.l.google.com:19302'
]}]};
const describe=(e:unknown)=>e instanceof Error?e.message:'Não foi possível realizar a chamada.';
export function useNativeCalls():CallsContext{
 const context=useContext(Context);
 if(!context)throw new Error('Chamadas nativas não foram inicializadas.');
 return context;
}
/** Real P2P media, using the same protected RPC/SDP/ICE schema as Conecta Web.
 * No fake success or temporary public access to calls, and no TURN credentials in the APK.
 * STUN alone may fail on restricted mobile/carrier networks pending ephemeral TURN.
 */
export function NativeCallsProvider({userId,children}:{
 userId:string|null;children:React.ReactNode
}){
 const [current,setCurrent]=useState<CallRow|null>(null);
 const [name,setName]=useState(''),[status,setStatus]=useState('');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [local,setLocal]=useState<MediaStream|null>(null);
 const [remote,setRemote]=useState<MediaStream|null>(null);
 const [micOn,setMicOn]=useState(true),[camOn,setCamOn]=useState(true);
 const pc=useRef<RTCPeerConnection|null>(null);
 const stream=useRef<MediaStream|null>(null);
 const rowRef=useRef<CallRow|null>(null);
 const acting=useRef(false),polling=useRef(false),negotiating=useRef(false);
 const offered=useRef(false),answered=useRef(false);
 const lastCandidateId=useRef(0);
 const pendingCandidates=useRef<unknown[]>([]);
 const refreshRef=useRef<()=>Promise<void>>(async()=>{});
 const latestUser=useRef(userId);latestUser.current=userId;
 const release=useCallback(()=>{
  pc.current?.close();pc.current=null;
  stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;
  rowRef.current=null;setCurrent(null);setLocal(null);setRemote(null);
  offered.current=false;answered.current=false;negotiating.current=false;
  pendingCandidates.current=[];lastCandidateId.current=0;
  setMicOn(true);setCamOn(true);setBusy(false);acting.current=false;
  Vibration.cancel();
 },[]);
 const hangup=useCallback(async(decline=false)=>{
  const row=rowRef.current;
  if(!row)return;
  release();
  const {error:e}=await supabase.rpc('end_chat_call',{_id:row.id,_decline:decline});
  if(e)setError(e.message);
 },[release]);
 const acquire=async(kind:CallKind)=>{
  // This is called exclusively by a user's Start / Answer press.
  const media=await mediaDevices.getUserMedia({
   audio:true,video:kind==='video'?{facingMode:'user'}:false
  });
  stream.current=media;setLocal(media);
  const conn=new RTCPeerConnection(RTC_CONFIG);
  pc.current=conn;
  media.getTracks().forEach(track=>conn.addTrack(track,media));
  conn.ontrack=event=>{
   if(pc.current!==conn)return;
   const incoming=event.streams?.[0];
   if(incoming)setRemote(incoming);
  };
  conn.onconnectionstatechange=()=>{
   if(pc.current!==conn)return;
   if(conn.connectionState==='connected')setStatus('Conectada · áudio e vídeo ativos');
   else if(conn.connectionState==='failed')
    setError('A rede não conseguiu estabelecer a ligação P2P. Algumas redes precisam de TURN.');
   else if(conn.connectionState==='connecting')setStatus('Conectando mídia...');
  };
  conn.onicecandidate=event=>{
   const row=rowRef.current;
   if(pc.current!==conn||!row||!event.candidate)return;
   void supabase.rpc('add_chat_call_ice_candidate',{
    _call_id:row.id,_candidate:event.candidate.toJSON()
   }).then(({error:e})=>{if(e&&pc.current===conn)setError('Falha no ICE: '+e.message);});
  };
 };
 const start=async(conversationId:string,recipientId:string,recipientName:string,kind:CallKind)=>{
  const me=latestUser.current;
  if(!me||rowRef.current||acting.current||me===recipientId)return;
  acting.current=true;setBusy(true);setError('');setName(recipientName);
  try{
   await acquire(kind);
   const {data,error:e}=await supabase.rpc('start_chat_call',{
    _conversation:conversationId,_callee:recipientId,_kind:kind
   });
   if(e||!data)throw e||new Error('Chamada não autorizada.');
   const next:CallRow={
    id:String(data),conversation_id:conversationId,caller_id:me,callee_id:recipientId,
    kind,status:'ringing',offer_sdp:null,answer_sdp:null,
    expires_at:new Date(Date.now()+65000).toISOString()
   };
   rowRef.current=next;setCurrent(next);setStatus('Chamando...');
  }catch(e){release();setError(describe(e));}
  finally{acting.current=false;setBusy(false);}
 };
 const accept=async()=>{
  const row=rowRef.current,me=latestUser.current;
  if(!row||!me||row.callee_id!==me||row.status!=='ringing'||acting.current)return;
  acting.current=true;setBusy(true);setError('');
  try{
   await acquire(row.kind);
   const {error:e}=await supabase.rpc('accept_chat_call',{_id:row.id});
   if(e)throw e;
   const next={...row,status:'accepted' as const};
   rowRef.current=next;setCurrent(next);setStatus('Aguardando negociação segura...');
  }catch(e){setError(describe(e));await hangup(true);}
  finally{acting.current=false;setBusy(false);}
 };
 const flushCandidates=async(conn:RTCPeerConnection)=>{
  if(!conn.remoteDescription)return;
  const candidates=pendingCandidates.current.splice(0);
  for(const candidate of candidates){
   if(pc.current!==conn)return;
   try{await conn.addIceCandidate(new RTCIceCandidate(candidate as any));}
   catch{/* Candidate from an old network may be invalid. */}
  }
 };
 const receiveCandidates=async(row:CallRow)=>{
  const conn=pc.current,me=latestUser.current;
  if(!conn||!me)return;
  const {data,error:e}=await supabase.from('chat_call_ice_candidates')
   .select('id,sender_id,candidate').eq('call_id',row.id)
   .gt('id',lastCandidateId.current).order('id',{ascending:true}).limit(100);
  if(e){setError('Não foi possível receber candidatos ICE.');return;}
  for(const item of data||[]){
   if(pc.current!==conn||rowRef.current?.id!==row.id)return;
   const numeric=Number(item.id);
   if(Number.isSafeInteger(numeric))
    lastCandidateId.current=Math.max(lastCandidateId.current,numeric);
   if(item.sender_id===me)continue;
   const candidate=item.candidate as {candidate?:unknown};
   if(typeof candidate?.candidate!=='string')continue;
   if(conn.remoteDescription){
    try{await conn.addIceCandidate(new RTCIceCandidate(item.candidate as any));}
    catch{/* ICE can be retried by the peer. */}
   }else pendingCandidates.current.push(item.candidate);
  }
 };
 const negotiate=async(row:CallRow)=>{
  const conn=pc.current,me=latestUser.current;
  if(!conn||!me||negotiating.current||row.status!=='accepted')return;
  negotiating.current=true;
  try{
   if(row.caller_id===me&&!offered.current){
    offered.current=true;
    await conn.setLocalDescription(await conn.createOffer());
    const sdp=conn.localDescription?.sdp;
    if(!sdp)throw Error('Oferta WebRTC vazia.');
    const {error:e}=await supabase.rpc('signal_chat_call',{
     _id:row.id,_kind:'offer',_sdp:sdp
    });
    if(e)throw e;
    setStatus('Oferta enviada · aguardando resposta...');
   }else if(row.callee_id===me&&row.offer_sdp&&!answered.current){
    answered.current=true;
    await conn.setRemoteDescription({type:'offer',sdp:row.offer_sdp});
    await flushCandidates(conn);
    await conn.setLocalDescription(await conn.createAnswer());
    const sdp=conn.localDescription?.sdp;
    if(!sdp)throw Error('Resposta WebRTC vazia.');
    const {error:e}=await supabase.rpc('signal_chat_call',{
     _id:row.id,_kind:'answer',_sdp:sdp
    });
    if(e)throw e;
    setStatus('Resposta enviada · verificando rede...');
   }else if(row.caller_id===me&&row.answer_sdp&&!conn.remoteDescription){
    await conn.setRemoteDescription({type:'answer',sdp:row.answer_sdp});
    await flushCandidates(conn);
    setStatus('Verificando ligação P2P...');
   }
  }catch(e){setError(describe(e));void hangup();}
  finally{negotiating.current=false;}
 };
 const refresh=async()=>{
  const me=latestUser.current;
  if(!me||polling.current||acting.current)return;
  polling.current=true;
  try{
   const row=rowRef.current;
   if(row){
    const {data,error:e}=await supabase.from('chat_calls').select(FIELDS)
     .eq('id',row.id).maybeSingle();
    if(e)return;
    if(!data||['ended','declined','missed'].includes(data.status)||
       Date.parse(data.expires_at)<=Date.now()){
     release();return;
    }
    if(rowRef.current?.id!==row.id)return;
    const next=data as CallRow;
    // A browser or second device may have answered this call already.
    if(next.status==='accepted'&&next.callee_id===me&&!pc.current){
     release();return;
    }
    rowRef.current=next;setCurrent(next);
    if(next.status==='accepted'&&pc.current){
     await negotiate(next);await receiveCandidates(next);
    }
   }else{
    const {data,error:e}=await supabase.from('chat_calls').select(FIELDS)
     .eq('callee_id',me).eq('status','ringing')
     .gt('expires_at',new Date().toISOString())
     .order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(e||!data||rowRef.current||!latestUser.current)return;
    const incoming=data as CallRow;
    const {data:person}=await supabase.from('profiles')
     .select('display_name').eq('id',incoming.caller_id).maybeSingle();
    if(rowRef.current)return;
    rowRef.current=incoming;setCurrent(incoming);
    setName(person?.display_name||'Sua conexão');setStatus('Chamada recebida');
    Vibration.vibrate([0,250,220,250]);
   }
  }finally{polling.current=false;}
 };
 refreshRef.current=refresh;
 useEffect(()=>{
  if(!userId){release();return;}
  void refreshRef.current();
  const channel=supabase.channel('conecta-mobile-call-'+userId)
   .on('postgres_changes',{event:'*',schema:'public',table:'chat_calls',
    filter:'callee_id=eq.'+userId},()=>{void refreshRef.current();})
   .on('postgres_changes',{event:'*',schema:'public',table:'chat_calls',
    filter:'caller_id=eq.'+userId},()=>{void refreshRef.current();})
   .subscribe();
  let lastIdle=0;
  const timer=setInterval(()=>{
   const now=Date.now();
   if(AppState.currentState!=='active')return;
   if(rowRef.current||now-lastIdle>=12000){
    lastIdle=now;void refreshRef.current();
   }
  },1800);
  return()=>{clearInterval(timer);void supabase.removeChannel(channel);release();};
 },[userId,release]);
 useEffect(()=>{
  if(!current||current.status!=='accepted'||!pc.current)return;
  const keep=setInterval(()=>{
   if(AppState.currentState==='active')
    void supabase.rpc('keep_chat_call_alive',{_id:current.id});
  },25000);
  return()=>clearInterval(keep);
 },[current?.id,current?.status]);
 const toggleMic=()=>{
  const audio=stream.current?.getAudioTracks()[0];
  if(audio){audio.enabled=!audio.enabled;setMicOn(audio.enabled);}
 };
 const toggleCamera=()=>{
  const video=stream.current?.getVideoTracks()[0];
  if(video){video.enabled=!video.enabled;setCamOn(video.enabled);}
 };
 const incoming=Boolean(current?.callee_id===userId&&current?.status==='ringing');
 const isVideo=current?.kind==='video';
 return <Context.Provider value={{start,busy,error,hasCall:Boolean(current)}}>
  {children}
  <Modal visible={Boolean(current)} animationType="slide" onRequestClose={()=>void hangup(incoming)}>
   <SafeAreaView style={{flex:1,backgroundColor:'#171322',padding:17,
    justifyContent:'space-between'}}>
    <View style={{alignItems:'center',paddingTop:30}}>
     {isVideo?<Video color="#F3EEFF" size={30}/>:<Phone color="#F3EEFF" size={30}/>}
     <Text style={{fontSize:24,color:'#FFF',fontWeight:'900',marginTop:17}}>{name}</Text>
     <Text style={{color:'#D5C9E8',fontSize:13,marginTop:8}}>{status}</Text>
     {!!error&&<Text accessibilityRole="alert" style={{color:'#FFABBA',marginTop:12}}>{error}</Text>}
    </View>
    {isVideo&&current?.status==='accepted'?<View style={{flex:1,marginTop:20,gap:9}}>
     {remote?<RTCView streamURL={remote.toURL()} objectFit="contain"
      style={{flex:1,borderRadius:16}}/>:
      <View style={{flex:1,backgroundColor:'#241C35',borderRadius:16,
       justifyContent:'center',alignItems:'center'}}>
       <Text style={{color:'#D3CAE4'}}>Aguardando vídeo da outra pessoa</Text>
      </View>}
     {local&&<RTCView streamURL={local.toURL()} mirror objectFit="cover"
      style={{width:110,height:150,borderRadius:15,alignSelf:'flex-end'}}/>}
    </View>:<View style={{flex:1,justifyContent:'center',alignItems:'center'}}>
     <Phone color="#A689F5" size={72}/>
     <Text style={{color:'#B9AECB',marginTop:18}}>Ligação protegida entre conexões</Text>
    </View>}
    <View style={{flexDirection:'row',justifyContent:'center',gap:16,
     alignItems:'center',paddingBottom:25}}>
     {incoming?<Pressable accessibilityRole="button" accessibilityLabel="Atender ligação"
      disabled={busy} onPress={()=>void accept()}
      style={{backgroundColor:'#2B9C68',padding:18,borderRadius:50}}>
      <Phone color="#FFF" size={27}/>
     </Pressable>:null}
     {!incoming&&current?.status==='accepted'&&<>
      <Pressable accessibilityRole="button" accessibilityLabel={micOn?'Silenciar microfone':'Ativar microfone'}
       onPress={toggleMic} style={{padding:17,backgroundColor:'#423654',borderRadius:50}}>
       {micOn?<Mic color="#FFF" size={24}/>:<MicOff color="#FFF" size={24}/>}
      </Pressable>
      {isVideo&&<Pressable accessibilityRole="button"
       accessibilityLabel={camOn?'Desligar câmera':'Ligar câmera'}
       onPress={toggleCamera} style={{padding:17,backgroundColor:'#423654',borderRadius:50}}>
       {camOn?<Video color="#FFF" size={24}/>:<VideoOff color="#FFF" size={24}/>}
      </Pressable>}
     </>}
     <Pressable accessibilityRole="button" accessibilityLabel={incoming?'Recusar ligação':'Encerrar ligação'}
      onPress={()=>void hangup(incoming)} style={{backgroundColor:'#D8425C',
       padding:18,borderRadius:50}}>
      <PhoneOff color="#FFF" size={27}/>
     </Pressable>
    </View>
    <Text style={{color:'#AA9CB8',textAlign:'center',fontSize:11,paddingBottom:10}}>
     Conexão direta WebRTC · algumas redes móveis exigem servidor TURN.
    </Text>
   </SafeAreaView>
  </Modal>
 </Context.Provider>;
}
