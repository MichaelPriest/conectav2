'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import {Phone,PhoneOff,Video,Mic,MicOff,VideoOff,Check,Loader2,Volume2,VolumeX,BellRing,PhoneMissed} from 'lucide-react';
import {ChatCallTones,DEFAULT_CALL_TONES,sanitizeCallTonePreferences,type CallTonePreferences} from '@/lib/chat-call-tones';
import {supabaseBrowser} from '@/lib/supabase/browser';

type CallKind='audio'|'video';
type CallRow={id:string;conversation_id:string;caller_id:string;callee_id:string;kind:CallKind;
 status:'ringing'|'accepted'|'ended'|'declined'|'missed';offer_sdp:string|null;answer_sdp:string|null;expires_at:string};
type CallContext={busy:boolean;hasCall:boolean;error:string;
 missedCount:number;acknowledgeMissed:()=>void;
 start:(conversationId:string,recipientId:string,recipientName:string,kind:CallKind)=>Promise<void>};
const Context=createContext<CallContext|null>(null);
// Public STUN endpoints only; relaying traffic requires an authenticated TURN account.
const config:RTCConfiguration={iceServers:[{urls:[
  'stun:stun.cloudflare.com:3478',
  'stun:stun.l.google.com:19302'
]}]};
const intervalMs=1800;
const idlePollMs=12000;
const negotiationTimeoutMs=47000;
const describe=(e:unknown)=>e instanceof Error?e.message:'Não foi possível realizar a chamada.';

export function ChatCallsProvider({userId,children}:{userId:string;children:React.ReactNode}){
 const [db]=useState(()=>supabaseBrowser());
 const [current,setCurrent]=useState<CallRow|null>(null),currentRef=useRef<CallRow|null>(null);
 const [contact,setContact]=useState(''),[busy,setBusy]=useState(false),busyRef=useRef(false);
 const [error,setError]=useState(''),[status,setStatus]=useState('Chamando…');
 const [micOn,setMicOn]=useState(true),[camOn,setCamOn]=useState(false);
 const [local,setLocal]=useState<MediaStream|null>(null),[remote,setRemote]=useState<MediaStream|null>(null);
 const [audioBlocked,setAudioBlocked]=useState(false);
 const [ringtoneBlocked,setRingtoneBlocked]=useState(false);
 const [tonePreferences,setTonePreferences]=useState<CallTonePreferences>(DEFAULT_CALL_TONES);
 const tonePreferencesRef=useRef<CallTonePreferences>(DEFAULT_CALL_TONES);
 const tonesRef=useRef<ChatCallTones|null>(null);
 const connectedTonePlayed=useRef<string|null>(null);
 const settingsKey='conecta-call-sounds:'+userId;
 const getTones=useCallback(()=>{
  if(!tonesRef.current){
   tonesRef.current=new ChatCallTones(setRingtoneBlocked);
   tonesRef.current.configure(tonePreferencesRef.current);
  }
  return tonesRef.current;
 },[]);
 const updateTonePreferences=(next:CallTonePreferences)=>{
  const safe=sanitizeCallTonePreferences(next);
  tonePreferencesRef.current=safe;setTonePreferences(safe);
  tonesRef.current?.configure(safe);
  try{localStorage.setItem(settingsKey,JSON.stringify(safe));}catch{}
 };
 useEffect(()=>{
  try{
   const saved=localStorage.getItem(settingsKey);
   if(saved){
    const prefs=sanitizeCallTonePreferences(JSON.parse(saved));
    tonePreferencesRef.current=prefs;setTonePreferences(prefs);
    tonesRef.current?.configure(prefs);
   }
  }catch{/* Browsers may disable local storage. */}
  return()=>{tonesRef.current?.dispose();tonesRef.current=null;};
 },[settingsKey]);
 const pcRef=useRef<RTCPeerConnection|null>(null),streamRef=useRef<MediaStream|null>(null);
 const sentOffer=useRef(false),sentAnswer=useRef(false),negotiating=useRef(false),querying=useRef(false);
 const localVideo=useRef<HTMLVideoElement|null>(null),remoteVideo=useRef<HTMLVideoElement|null>(null);
 const ended=useRef<string|null>(null);
 const notifiedIncoming=useRef<string|null>(null);
 const failureTimer=useRef<number|null>(null);
 const connectTimer=useRef<number|null>(null);
 const lastIdlePoll=useRef(0);
 const lastRemoteCandidateId=useRef(0);
 const bufferedRemoteCandidates=useRef<RTCIceCandidateInit[]>([]);
 const remoteCandidatesFetching=useRef(false);
 const candidateFailureReported=useRef(false);
 const [iceState,setIceState]=useState<RTCIceConnectionState>('new');
 const [callPhase,setCallPhase]=useState('Aguardando atendimento');
 const [technical,setTechnical]=useState(false);
 const [missedCount,setMissedCount]=useState(0);
 const missedAckKey='conecta-call-missed-ack:'+userId;
 const refreshMissed=useCallback(async()=>{
   if(document.hidden)return;
   const since=new Date(Date.now()-7*24*60*60*1000).toISOString();
   const {data,error:e}=await db.from('chat_calls')
     .select('id,created_at,status,expires_at')
     .eq('callee_id',userId).gte('created_at',since)
     .order('created_at',{ascending:false}).limit(80);
   if(e)return;
   let acknowledged=0;
   try{acknowledged=Date.parse(localStorage.getItem(missedAckKey)||'')||0;}catch{}
   const now=Date.now();
   const count=(data||[]).filter(row=>Date.parse(row.created_at)>acknowledged&&
     (row.status==='missed'||(row.status==='ringing'&&Date.parse(row.expires_at)<=now))).length;
   setMissedCount(count);
 },[db,userId,missedAckKey]);
 const acknowledgeMissed=useCallback(()=>{
   try{localStorage.setItem(missedAckKey,new Date().toISOString());}catch{}
   setMissedCount(0);
 },[missedAckKey]);

 useEffect(()=>{if(localVideo.current)localVideo.current.srcObject=local;},[local,current?.id]);
 useEffect(()=>{
  if(!remoteVideo.current)return;
  remoteVideo.current.srcObject=remote;
  if(remote)void remoteVideo.current.play().then(()=>setAudioBlocked(false)).catch(()=>setAudioBlocked(true));
 },[remote,current?.id]);

 const release=useCallback(()=>{
  tonesRef.current?.stop();connectedTonePlayed.current=null;
  if(failureTimer.current!==null)window.clearTimeout(failureTimer.current);
  if(connectTimer.current!==null)window.clearTimeout(connectTimer.current);
  failureTimer.current=null;connectTimer.current=null;
  pcRef.current?.close();pcRef.current=null;
  streamRef.current?.getTracks().forEach(track=>track.stop());streamRef.current=null;
  setLocal(null);setRemote(null);setAudioBlocked(false);
  setMicOn(true);setCamOn(false);setStatus('Chamando…');
  setIceState('new');setCallPhase('Aguardando atendimento');setTechnical(false);
  sentOffer.current=false;sentAnswer.current=false;negotiating.current=false;
  lastRemoteCandidateId.current=0;bufferedRemoteCandidates.current=[];
  candidateFailureReported.current=false;remoteCandidatesFetching.current=false;
  currentRef.current=null;setCurrent(null);busyRef.current=false;setBusy(false);
 },[]);
 const end=useCallback(async(decline=false)=>{
  const row=currentRef.current;
  if(!row||ended.current===row.id)return;
  ended.current=row.id;release();
  tonesRef.current?.playEvent(row.callee_id===userId&&row.status==='ringing'&&!decline?'missed':'ended');
  await db.rpc('end_chat_call',{_id:row.id,_decline:decline});
 },[db,release,userId]);
 const acquire=useCallback(async(kind:CallKind)=>{
  if(!navigator.mediaDevices?.getUserMedia||!('RTCPeerConnection' in window))
   throw new Error('Este navegador não permite chamadas WebRTC.');
  const media=await navigator.mediaDevices.getUserMedia({
   audio:{echoCancellation:true,noiseSuppression:true},video:kind==='video'
  });
  streamRef.current=media;setLocal(media);setMicOn(true);setCamOn(kind==='video');
  const pc=new RTCPeerConnection(config);pcRef.current=pc;
  pc.onicecandidate=(event)=>{
   if(!event.candidate||pcRef.current!==pc)return;
   const active=currentRef.current;
   if(!active)return;
   void db.rpc('add_chat_call_ice_candidate',{
    _call_id:active.id,_candidate:event.candidate.toJSON()
   }).then(({error:e})=>{
    if(e&&pcRef.current===pc&&!candidateFailureReported.current){
     candidateFailureReported.current=true;
     setCallPhase('Falha ao sinalizar ICE: '+e.message);
    }
   });
  };
  pc.oniceconnectionstatechange=()=>{
    setIceState(pc.iceConnectionState);
    if(pc.iceConnectionState==='checking')setStatus('Verificando conexão entre navegadores…');
    if(pc.iceConnectionState==='connected'||pc.iceConnectionState==='completed'){
      setStatus('Conectada');
      if(connectTimer.current!==null)window.clearTimeout(connectTimer.current);
      connectTimer.current=null;
    }
    if(pc.iceConnectionState==='failed')setStatus('Não foi possível conectar a rede P2P.');
  };
  media.getTracks().forEach(track=>pc.addTrack(track,media));
  pc.ontrack=e=>{
   if(e.streams[0])setRemote(e.streams[0]);
   else if(e.track)setRemote(previous=>{
    const s=previous||new MediaStream();s.addTrack(e.track);return s;
   });
  };
  pc.onconnectionstatechange=()=>{
   if(pc.connectionState==='connected'){
    if(failureTimer.current!==null)window.clearTimeout(failureTimer.current);
    failureTimer.current=null;
    if(connectTimer.current!==null)window.clearTimeout(connectTimer.current);
    connectTimer.current=null;setCallPhase('Conectada');setStatus('Conectada');
    const activeId=currentRef.current?.id;
    if(activeId&&connectedTonePlayed.current!==activeId){
     connectedTonePlayed.current=activeId;
     tonesRef.current?.playEvent('connected');
    }
   }else if(pc.connectionState==='connecting')setStatus('Conectando…');
   else if(pc.connectionState==='failed'){
    setStatus('Falha na conexão P2P.');
    setError('A ligação não conectou. Tente outra rede; algumas conexões exigem TURN.');
    if(failureTimer.current!==null)window.clearTimeout(failureTimer.current);
    failureTimer.current=window.setTimeout(()=>{
      if(pcRef.current===pc)void end();
    },4500);
   }
  };
 },[end,db]);
 const start=useCallback(async(conversationId:string,recipientId:string,recipientName:string,kind:CallKind)=>{
  if(currentRef.current||busyRef.current)return;
  busyRef.current=true;setBusy(true);setError('');setContact(recipientName);
  // Prime audio while still in the user's click, before asking for media.
  getTones().unlock();
  try{
   await acquire(kind);
   const {data,error:e}=await db.rpc('start_chat_call',{
    _conversation:conversationId,_callee:recipientId,_kind:kind
   });
   if(e||!data)throw e||new Error('Não foi possível iniciar.');
   const row:CallRow={id:String(data),conversation_id:conversationId,caller_id:userId,
    callee_id:recipientId,kind,status:'ringing',offer_sdp:null,answer_sdp:null,
    expires_at:new Date(Date.now()+65000).toISOString()};
   lastRemoteCandidateId.current=0;bufferedRemoteCandidates.current=[];
   ended.current=null;currentRef.current=row;setCurrent(row);setStatus('Chamando…');
   setCallPhase('Aguardando a outra pessoa atender');
   getTones().start('outgoing');
  }catch(e){release();setError(describe(e));}
  finally{busyRef.current=false;setBusy(false);}
 },[acquire,db,release,userId,getTones]);
 const accept=useCallback(async()=>{
  const row=currentRef.current;
  if(!row||row.callee_id!==userId||busyRef.current)return;
  busyRef.current=true;setBusy(true);setError('');
  tonesRef.current?.stop();
  getTones().unlock();
  try{
   await acquire(row.kind);
   const {error:e}=await db.rpc('accept_chat_call',{_id:row.id});
   if(e)throw e;
   const changed={...row,status:'accepted' as const,
    expires_at:new Date(Date.now()+120000).toISOString()};
   currentRef.current=changed;setCurrent(changed);
   setStatus('Aguardando a oferta de conexão…');
   setCallPhase('Atendida · aguardando oferta WebRTC');
  }catch(e){setError(describe(e));void end(true);}
  finally{busyRef.current=false;setBusy(false);}
 },[acquire,db,end,userId,getTones]);
 const flushBufferedCandidates=useCallback(async(pc:RTCPeerConnection)=>{
  if(!pc.currentRemoteDescription)return;
  const buffered=bufferedRemoteCandidates.current.splice(0);
  for(const candidate of buffered){
   if(pcRef.current!==pc)return;
   try{await pc.addIceCandidate(candidate);}
   catch{setCallPhase('Candidato ICE remoto rejeitado');}
  }
 },[]);

 const receiveCandidates=useCallback(async(row:CallRow)=>{
  const pc=pcRef.current;
  if(!pc||row.status!=='accepted'||remoteCandidatesFetching.current)return;
  remoteCandidatesFetching.current=true;
  try{
   const {data,error:e}=await db.from('chat_call_ice_candidates')
     .select('id,sender_id,candidate')
     .eq('call_id',row.id).gt('id',lastRemoteCandidateId.current)
     .order('id',{ascending:true}).limit(100);
   if(e){setCallPhase('Não foi possível receber os candidatos ICE');return;}
   for(const item of data||[]){
    if(pcRef.current!==pc||currentRef.current?.id!==row.id)return;
    const candidateId=Number(item.id);
    if(Number.isFinite(candidateId))
     lastRemoteCandidateId.current=Math.max(lastRemoteCandidateId.current,candidateId);
    if(item.sender_id===userId)continue;
    const candidate=item.candidate as RTCIceCandidateInit;
    if(typeof candidate?.candidate!=='string')continue;
    if(pc.currentRemoteDescription){
     try{await pc.addIceCandidate(candidate);}
     catch{setCallPhase('Candidato ICE remoto rejeitado');}
    }else{
     bufferedRemoteCandidates.current.push(candidate);
    }
   }
  }finally{remoteCandidatesFetching.current=false;}
 },[db,userId]);

 const negotiate=useCallback(async(row:CallRow)=>{
  const pc=pcRef.current;
  if(!pc||negotiating.current||row.status!=='accepted')return;
  if(connectTimer.current===null&&pc.connectionState!=='connected'){
    connectTimer.current=window.setTimeout(()=>{
      const live=pcRef.current;
      if(live!==pc||live.connectionState==='connected')return;
      let reason='';
      if(!live.localDescription)reason='A oferta WebRTC não foi preparada.';
      else if(!live.remoteDescription)reason='A resposta WebRTC não chegou ao seu navegador.';
      else reason='A negociação foi recebida, mas esta rede não conseguiu estabelecer o caminho P2P. É necessário TURN em algumas redes.';
      setError(reason);void end();
    },negotiationTimeoutMs);
  }
  negotiating.current=true;
  try{
   if(row.caller_id===userId&&!sentOffer.current){
    sentOffer.current=true;
    setStatus('Preparando a oferta de conexão…');
    setCallPhase('Oferta WebRTC sendo preparada');
    await pc.setLocalDescription(await pc.createOffer());
    // Trickle ICE: send SDP immediately, subsequent candidates go over RPC.
    const sdp=pc.localDescription?.sdp;
    if(!sdp)throw Error('Oferta WebRTC vazia.');
    const {error:e}=await db.rpc('signal_chat_call',{_id:row.id,_kind:'offer',_sdp:sdp});
    if(e)throw e;
    setStatus('Oferta enviada · aguardando resposta…');
    setCallPhase('Oferta entregue ao Supabase');
   }else if(row.callee_id===userId&&row.offer_sdp&&!sentAnswer.current){
    sentAnswer.current=true;
    setStatus('Recebi a oferta · preparando resposta…');
    setCallPhase('Oferta recebida');
    await pc.setRemoteDescription({type:'offer',sdp:row.offer_sdp});
    await flushBufferedCandidates(pc);
    await pc.setLocalDescription(await pc.createAnswer());
    // Trickle ICE: send SDP immediately, subsequent candidates go over RPC.
    const sdp=pc.localDescription?.sdp;
    if(!sdp)throw Error('Resposta WebRTC vazia.');
    const {error:e}=await db.rpc('signal_chat_call',{_id:row.id,_kind:'answer',_sdp:sdp});
    if(e)throw e;
    setStatus('Resposta enviada · verificando rede…');
    setCallPhase('Resposta entregue ao Supabase');
   }else if(row.caller_id===userId&&row.answer_sdp&&!pc.currentRemoteDescription){
    setCallPhase('Resposta WebRTC recebida');
    await pc.setRemoteDescription({type:'answer',sdp:row.answer_sdp});
    await flushBufferedCandidates(pc);
    setStatus('Oferta e resposta recebidas · verificando rede…');
   }
  }catch(e){setError(describe(e));void end();}
  finally{negotiating.current=false;}
 },[db,end,userId,flushBufferedCandidates]);
 const check=useCallback(async()=>{
  if(querying.current||busyRef.current||negotiating.current)return;
  querying.current=true;
  try{
   const row=currentRef.current;
   if(row){
    const {data,error:e}=await db.from('chat_calls')
     .select('id,conversation_id,caller_id,callee_id,kind,status,offer_sdp,answer_sdp,expires_at')
     .eq('id',row.id).maybeSingle();
    if(e)return;
    if(!data||data.status==='ended'||data.status==='declined'||data.status==='missed'||
      Date.parse(data.expires_at)<=Date.now()){
      void end();return;
    }
    // A previous pending fetch must not revive a call that has just ended.
    if(currentRef.current?.id!==row.id)return;
    const updated=data as CallRow;
    if(row.status==='ringing'&&updated.status==='accepted'&&updated.caller_id===userId)
      tonesRef.current?.stop();
    // A different tab accepted the same incoming call. Don't hang it up.
    if(updated.status==='accepted'&&updated.callee_id===userId&&!pcRef.current){
      release();return;
    }
    currentRef.current=updated;
    if(updated.status!==row.status||updated.offer_sdp!==row.offer_sdp||
       updated.answer_sdp!==row.answer_sdp||updated.expires_at!==row.expires_at)
      setCurrent(updated);
    if(updated.status==='accepted'&&pcRef.current){
      void negotiate(updated);
      void receiveCandidates(updated);
    }
   }else{
    const {data,error:e}=await db.from('chat_calls')
     .select('id,conversation_id,caller_id,callee_id,kind,status,offer_sdp,answer_sdp,expires_at')
     .eq('callee_id',userId).eq('status','ringing')
     .gt('expires_at',new Date().toISOString())
     .order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(e||!data||currentRef.current)return;
    const {data:person}=await db.from('profiles').select('display_name')
      .eq('id',data.caller_id).maybeSingle();
    if(currentRef.current)return;
    const incoming=data as CallRow;
    lastRemoteCandidateId.current=0;bufferedRemoteCandidates.current=[];
    ended.current=null;currentRef.current=incoming;setCurrent(incoming);
    setContact(person?.display_name||'Sua conexão');
    setStatus('Chamada recebida');
    getTones().start('incoming');
    if(document.hidden&&typeof Notification!=='undefined'&&
       Notification.permission==='granted'&&notifiedIncoming.current!==incoming.id){
      notifiedIncoming.current=incoming.id;
      try{
       const alert=new Notification('Conecta · Chamada recebida',{
        body:'Uma conexão está ligando. Abra o Conecta para atender.',
        tag:'conecta-call-'+incoming.id
       });
       alert.onclick=()=>{window.focus();alert.close();};
      }catch{/* Notification access is not guaranteed. */}
    }
   }
  }finally{querying.current=false;}
 },[db,end,negotiate,receiveCandidates,userId,release,getTones]);
 useEffect(()=>{
  void check();void refreshMissed();
  // RLS protects events: each browser listens only to calls involving its user.
  const channel=db.channel('conecta-call-signals-'+userId)
    .on('postgres_changes',{schema:'public',table:'chat_calls',event:'*',
      filter:'callee_id=eq.'+userId},()=>{void check();void refreshMissed();})
    .on('postgres_changes',{schema:'public',table:'chat_calls',event:'*',
      filter:'caller_id=eq.'+userId},()=>{void check();})
    .subscribe();
  // Frequent checks only while a call is active; 12s idle fallback avoids
  // unnecessary reads for all connected users. Realtime remains primary.
  const timer=window.setInterval(()=>{
    if(currentRef.current){void check();return;}
    const now=Date.now();
    if(now-lastIdlePoll.current>=idlePollMs){
      lastIdlePoll.current=now;void check();
    }
  },intervalMs);
  const missedTimer=window.setInterval(()=>{void refreshMissed();},90000);
  const visibility=()=>{if(!document.hidden){void check();void refreshMissed();}};
  document.addEventListener('visibilitychange',visibility);
  return()=>{
   window.clearInterval(timer);window.clearInterval(missedTimer);
   document.removeEventListener('visibilitychange',visibility);
   void db.removeChannel(channel);
   const row=currentRef.current;
   // Do not terminate a ringing call merely because an unrelated tab closes.
   if(row&&(row.caller_id===userId||Boolean(pcRef.current)))
     void db.rpc('end_chat_call',{_id:row.id,_decline:false});
   if(failureTimer.current!==null)window.clearTimeout(failureTimer.current);
   if(connectTimer.current!==null)window.clearTimeout(connectTimer.current);
   tonesRef.current?.stop();
   pcRef.current?.close();streamRef.current?.getTracks().forEach(track=>track.stop());
  };
 },[db,check,refreshMissed,userId]);
 useEffect(()=>{
  if(!current||current.status!=='accepted')return;
  const timer=window.setInterval(()=>{
   if(!document.hidden)void db.rpc('keep_chat_call_alive',{_id:current.id});
  },25000);
  return()=>window.clearInterval(timer);
 },[db,current?.id,current?.status]);
 function mic(){
  const track=streamRef.current?.getAudioTracks()[0];
  if(!track)return;track.enabled=!track.enabled;setMicOn(track.enabled);
 }
 function camera(){
  const track=streamRef.current?.getVideoTracks()[0];
  if(!track)return;track.enabled=!track.enabled;setCamOn(track.enabled);
 }
 const incoming=current?.callee_id===userId&&current.status==='ringing';
 return <Context.Provider value={{busy,hasCall:Boolean(current),error,start,
   missedCount,acknowledgeMissed}}>{children}
  {current&&<div className="conecta-call-backdrop">
   <section className="conecta-call-panel" role="dialog" aria-modal="true"
    aria-label={incoming?'Chamada recebida':'Chamada de áudio ou vídeo'}>
    <small className="conecta-call-eyebrow">Conecta · {current.kind==='video'?'Vídeo':'Voz'}</small>
    <h2>{contact}</h2><p role="status">{status}</p>
    <div className="conecta-call-sound-controls" aria-label="Sons da chamada">
      <button type="button" className="conecta-call-sound-toggle"
        aria-pressed={tonePreferences.enabled}
        aria-label={tonePreferences.enabled?'Silenciar toques de chamada':'Ativar toques de chamada'}
        onClick={()=>updateTonePreferences({...tonePreferences,enabled:!tonePreferences.enabled})}>
        {tonePreferences.enabled?<BellRing size={16}/>:<VolumeX size={16}/>}
        <span>{tonePreferences.enabled?'Toques ativados':'Toques silenciados'}</span>
      </button>
      <label className="conecta-call-sound-volume" htmlFor="conecta-call-volume">
        Volume
        <input id="conecta-call-volume" aria-label="Volume dos toques"
          type="range" min="0" max="100" step="5"
          value={Math.round(tonePreferences.volume*100)}
          onChange={event=>updateTonePreferences({
            ...tonePreferences,volume:Number(event.currentTarget.value)/100
          })}/>
        <small>{Math.round(tonePreferences.volume*100)}%</small>
      </label>
      {ringtoneBlocked&&tonePreferences.enabled&&
        <button className="conecta-call-sound-unlock" type="button"
          onClick={()=>getTones().unlock()}>
          <Volume2 size={15}/> Ativar som do toque
        </button>}
    </div>
    {current.status==='accepted'&&<div className="conecta-call-diagnostic">
      <small>{callPhase}</small>
      <button type="button" className="conecta-call-diagnostic-toggle"
        aria-expanded={technical} onClick={()=>setTechnical(value=>!value)}>
        {technical?'Ocultar diagnóstico':'Ver diagnóstico de conexão'}
      </button>
      {technical&&<div className="conecta-call-debug" role="status">
        <span>Atendida: sim</span>
        <span>Oferta: {current.offer_sdp?'recebida':'aguardando'}</span>
        <span>Resposta: {current.answer_sdp?'recebida':'aguardando'}</span>
        <span>ICE: {iceState}</span>
        <span>Conexão: {pcRef.current?.connectionState||'não iniciada'}</span>
        <span>ICE remoto: {lastRemoteCandidateId.current>0?'recebido':'aguardando'}</span>
        <span>Servidor TURN: não configurado</span>
      </div>}
    </div>}
    <video ref={remoteVideo} autoPlay playsInline
     className="conecta-call-remote" style={current.kind==='video'?undefined:{display:'none'}}
     aria-label="Transmissão remota"/>
    <video ref={localVideo} autoPlay playsInline muted
     className="conecta-call-local" style={current.kind==='video'?undefined:{display:'none'}}
     aria-label="Prévia local"/>
    {audioBlocked&&<button className="btn btn-outline" type="button"
      onClick={()=>void remoteVideo.current?.play().then(()=>setAudioBlocked(false))}>
      <Volume2 size={16}/> Ativar som
    </button>}
    <div className="conecta-call-actions">
     {incoming?<button className="btn btn-primary" type="button" disabled={busy}
      onClick={()=>void accept()}>{busy?<Loader2 size={16} className="spin"/>:<Check size={16}/>} Atender</button>:<>
      <button className="btn btn-outline" type="button" disabled={!local}
       aria-label={micOn?'Silenciar microfone':'Ativar microfone'} onClick={mic}>
       {micOn?<Mic size={18}/>:<MicOff size={18}/>}</button>
      {current.kind==='video'&&<button className="btn btn-outline" type="button"
       disabled={!local} aria-label={camOn?'Desligar câmera':'Ligar câmera'} onClick={camera}>
       {camOn?<Video size={18}/>:<VideoOff size={18}/>}</button>}
     </>}
     <button type="button" className="btn conecta-call-hangup"
      onClick={()=>void end(Boolean(incoming))}><PhoneOff size={17}/>{incoming?'Recusar':'Encerrar'}</button>
    </div>
    <small>Chamada direta WebRTC; algumas redes exigem um serviço TURN.</small>
    {error&&<p className="form-error" role="alert">{error}</p>}
   </section>
  </div>}
 </Context.Provider>;
}

export function ChatCallButtons({conversationId,calleeId,calleeName}:{
 conversationId:string|null|undefined;calleeId:string|null|undefined;calleeName:string|null|undefined
}){
 const ctx=useContext(Context);
 if(!ctx||!conversationId||!calleeId)return null;
 return <span className="conecta-call-buttons">
  <button className="icon-btn" type="button" title="Ligar (voz)"
   aria-label={'Ligar para '+(calleeName||'conexão')} disabled={ctx.busy||ctx.hasCall}
   onClick={()=>void ctx.start(conversationId,calleeId,calleeName||'Conexão','audio')}><Phone size={17}/></button>
  <button className="icon-btn" type="button" title="Videochamada"
   aria-label={'Videochamada com '+(calleeName||'conexão')} disabled={ctx.busy||ctx.hasCall}
   onClick={()=>void ctx.start(conversationId,calleeId,calleeName||'Conexão','video')}><Video size={17}/></button>
  {ctx.error&&!ctx.hasCall&&<small className="conecta-call-inline-error" role="alert">{ctx.error}</small>}
 </span>;
}

/** User-controlled, local-only acknowledgement; no extra device or tracking data. */
export function ChatMissedCalls(){
 const ctx=useContext(Context);
 if(!ctx||ctx.missedCount===0)return null;
 return <button className="conecta-chat-missed" type="button"
  onClick={ctx.acknowledgeMissed}
  aria-label={ctx.missedCount+' chamadas perdidas. Dispensar aviso.'}>
  <PhoneMissed size={14}/>
  {ctx.missedCount===1?'1 chamada perdida':ctx.missedCount+' chamadas perdidas'}
  <span aria-hidden="true">×</span>
 </button>;
}
