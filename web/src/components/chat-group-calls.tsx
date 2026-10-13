'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Phone,PhoneOff,Video,Mic,MicOff,VideoOff,Users,Loader2} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';

type Kind='audio'|'video';
type Session={id:string;conversation_id:string;created_by:string;kind:Kind;status:'ringing'|'active'|'ended';expires_at:string};
type Participant={user_id:string;status:string};
type Signal={id:number;sender_id:string;signal:Record<string,unknown>};
const rtcConfig:RTCConfiguration={iceServers:[{urls:['stun:stun.cloudflare.com:3478','stun:stun.l.google.com:19302']}]};
const errText=(e:unknown)=>e instanceof Error?e.message:'Não foi possível iniciar a chamada em grupo.';

export function ChatGroupCallButtons({conversationId,userId,title}:{conversationId:string|null|undefined;userId:string;title:string}){
 const [session,setSession]=useState<Session|null>(null);
 const [participants,setParticipants]=useState<Participant[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [micOn,setMicOn]=useState(true),[cameraOn,setCameraOn]=useState(true);
 const [local,setLocal]=useState<MediaStream|null>(null);
 const [remotes,setRemotes]=useState<Record<string,MediaStream>>({});
 const dbRef=useRef(supabaseBrowser());
 const pcs=useRef(new Map<string,RTCPeerConnection>());
 const localRef=useRef<MediaStream|null>(null);
 const sessionRef=useRef<Session|null>(null);
 const lastSignal=useRef(0);
 const handled=useRef(new Set<number>());
 const candidateBuffer=useRef(new Map<string,RTCIceCandidateInit[]>());
 const busyRef=useRef(false);

 const dispose=useCallback(async(leave=true)=>{
  const active=sessionRef.current;
  if(leave&&active)await dbRef.current.rpc('leave_group_call',{_session:active.id});
  for(const pc of pcs.current.values())pc.close();
  pcs.current.clear();candidateBuffer.current.clear();localRef.current?.getTracks().forEach(t=>t.stop());localRef.current=null;
  sessionRef.current=null;setSession(null);setLocal(null);setRemotes({});setParticipants([]);
  setMicOn(true);setCameraOn(true);busyRef.current=false;setBusy(false);
 },[]);
 const refresh=useCallback(async()=>{
  const active=sessionRef.current;
  if(!conversationId)return;
  if(active){
   const {data:s}=await dbRef.current.from('group_call_sessions').select('id,conversation_id,created_by,kind,status,expires_at').eq('id',active.id).maybeSingle();
   if(!s||s.status==='ended'||Date.parse(s.expires_at)<=Date.now()){await dispose(false);return;}
   const {data:p}=await dbRef.current.from('group_call_participants').select('user_id,status').eq('session_id',active.id).eq('status','joined');
   const people=(p||[]) as Participant[];setParticipants(people);
   for(const person of people){
    if(person.user_id===userId||pcs.current.has(person.user_id))continue;
    // Only one side creates each peer connection's offer, avoiding offer glare.
    if(userId.localeCompare(person.user_id)>0)continue;
    await makePeer(person.user_id,true);
   }
   const {data:signals,error:e}=await dbRef.current.from('group_call_signals').select('id,sender_id,signal').eq('session_id',active.id).eq('recipient_id',userId).gt('id',lastSignal.current).order('id',{ascending:true}).limit(100);
   if(!e)for(const item of (signals||[]) as Signal[]){
    lastSignal.current=Math.max(lastSignal.current,item.id);
    if(handled.current.has(item.id))continue;handled.current.add(item.id);
    const signal=item.signal as {type?:string;sdp?:string;candidate?:RTCIceCandidateInit};
    let pc=pcs.current.get(item.sender_id);
    if(!pc)pc=await makePeer(item.sender_id,false);
    try{
     if(signal.type==='offer'&&signal.sdp){
      await pc.setRemoteDescription({type:'offer',sdp:signal.sdp});
      for(const candidate of candidateBuffer.current.get(item.sender_id)||[]){try{await pc.addIceCandidate(candidate);}catch{}}
      candidateBuffer.current.delete(item.sender_id);
      const answer=await pc.createAnswer();await pc.setLocalDescription(answer);
      await sendSignal(item.sender_id,{type:'answer',sdp:pc.localDescription?.sdp});
     }else if(signal.type==='answer'&&signal.sdp&&!pc.remoteDescription){
      await pc.setRemoteDescription({type:'answer',sdp:signal.sdp});
      for(const candidate of candidateBuffer.current.get(item.sender_id)||[]){try{await pc.addIceCandidate(candidate);}catch{}}
      candidateBuffer.current.delete(item.sender_id);
     }else if(signal.candidate?.candidate){
      if(pc.remoteDescription)await pc.addIceCandidate(signal.candidate);
      else candidateBuffer.current.set(item.sender_id,[...(candidateBuffer.current.get(item.sender_id)||[]),signal.candidate]);
     }
    }catch{/* Stale ICE or duplicate SDP can be safely ignored. */}
   }
   return;
  }
  const {data}=await dbRef.current.from('group_call_sessions').select('id,conversation_id,created_by,kind,status,expires_at').eq('conversation_id',conversationId).in('status',['active','ringing']).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(data)setSession(data as Session);
 },[conversationId,dispose,userId]);

 async function sendSignal(to:string,signal:Record<string,unknown>){
  const active=sessionRef.current;if(!active)return;
  const {error:e}=await dbRef.current.rpc('send_group_call_signal',{_session:active.id,_recipient:to,_signal:signal});
  if(e)throw e;
 }
 async function makePeer(peerId:string,offerer:boolean):Promise<RTCPeerConnection>{
  const existing=pcs.current.get(peerId);if(existing)return existing;
  const pc=new RTCPeerConnection(rtcConfig);pcs.current.set(peerId,pc);
  for(const track of localRef.current?.getTracks()||[])pc.addTrack(track,localRef.current!);
  pc.onicecandidate=e=>{if(e.candidate)void sendSignal(peerId,{candidate:e.candidate.toJSON()}).catch(()=>{});};
  pc.ontrack=e=>{const stream=e.streams[0];if(stream)setRemotes(prev=>({...prev,[peerId]:stream}));};
  pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed'||pc.connectionState==='closed'){pc.close();pcs.current.delete(peerId);setRemotes(prev=>{const next={...prev};delete next[peerId];return next;});}};
  if(offerer){
   const offer=await pc.createOffer();await pc.setLocalDescription(offer);
   await sendSignal(peerId,{type:'offer',sdp:pc.localDescription?.sdp});
  }
  return pc;
 }

 async function begin(kind:Kind){
  if(!conversationId||busyRef.current)return;
  busyRef.current=true;setBusy(true);setError('');
  try{
   const {data:id,error:e}=await dbRef.current.rpc('start_group_call',{_conversation:conversationId,_kind:kind});
   if(e||!id)throw e||new Error('Não foi possível criar a chamada.');
   const row:Session={id:String(id),conversation_id:conversationId,created_by:userId,kind,status:'active',expires_at:new Date(Date.now()+7200000).toISOString()};
   sessionRef.current=row;setSession(row);lastSignal.current=0;handled.current.clear();
   const media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:kind==='video'});
   localRef.current=media;setLocal(media);setMicOn(true);setCameraOn(kind==='video');
   await dbRef.current.rpc('join_group_call',{_session:row.id});
   await refresh();
  }catch(e){setError(errText(e));if(sessionRef.current)await dispose(true);}
  finally{busyRef.current=false;setBusy(false);}
 }
 async function join(){
  const target=session;if(!target||busyRef.current)return;
  busyRef.current=true;setBusy(true);setError('');
  try{
   const media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:target.kind==='video'});
   localRef.current=media;setLocal(media);setMicOn(true);setCameraOn(target.kind==='video');
   const {error:e}=await dbRef.current.rpc('join_group_call',{_session:target.id});if(e)throw e;
   sessionRef.current=target;lastSignal.current=0;handled.current.clear();
   await refresh();
  }catch(e){setError(errText(e));localRef.current?.getTracks().forEach(t=>t.stop());localRef.current=null;setLocal(null);}
  finally{busyRef.current=false;setBusy(false);}
 }
 useEffect(()=>{
  if(!conversationId)return;
  void refresh();
  const channel=dbRef.current.channel('group-call-'+conversationId+'-'+userId)
   .on('postgres_changes',{schema:'public',table:'group_call_sessions',event:'*',filter:'conversation_id=eq.'+conversationId},()=>{void refresh();})
   .on('postgres_changes',{schema:'public',table:'group_call_participants',event:'*'},()=>{void refresh();})
   .subscribe();
  const timer=window.setInterval(()=>{if(!document.hidden)void refresh();},1800);
  return()=>{window.clearInterval(timer);void dbRef.current.removeChannel(channel);};
 },[conversationId,userId,refresh]);
 const toggleMic=()=>{const t=localRef.current?.getAudioTracks()[0];if(t){t.enabled=!t.enabled;setMicOn(t.enabled);}};
 const toggleCamera=()=>{const t=localRef.current?.getVideoTracks()[0];if(t){t.enabled=!t.enabled;setCameraOn(t.enabled);}};
 if(!conversationId)return null;
 return <span className="conecta-group-call-control">
  {!session?<><button type="button" className="icon-btn" title="Iniciar chamada de áudio em grupo" aria-label="Chamada de áudio em grupo" disabled={busy} onClick={()=>void begin('audio')}><Phone size={17}/></button>
   <button type="button" className="icon-btn" title="Iniciar videochamada em grupo" aria-label="Videochamada em grupo" disabled={busy} onClick={()=>void begin('video')}><Video size={17}/></button></>:
   sessionRef.current?.id===session.id?<button type="button" className="icon-btn" title="Chamada em andamento" aria-label="Chamada em andamento"><Users size={17}/>{participants.length}</button>:
   <button type="button" className="icon-btn" title={'Entrar na chamada do grupo '+title} aria-label="Entrar na chamada em grupo" disabled={busy} onClick={()=>void join()}><Users size={17}/></button>}
  {busy&&<Loader2 size={15} className="spin"/>}
  {error&&<small className="conecta-call-inline-error" role="alert">{error}</small>}
  {sessionRef.current&&session&&sessionRef.current.id===session.id&&<div className="conecta-group-call-backdrop">
   <section className="conecta-group-call-panel" role="dialog" aria-modal="true" aria-label="Chamada em grupo">
    <small>Conecta · {session.kind==='video'?'Videochamada':'Áudio em grupo'}</small><h2>{title}</h2>
    <p><Users size={15}/> {participants.length} participante(s)</p>
    <div className="conecta-group-call-video-grid">
     {Object.entries(remotes).map(([id,stream])=><video key={id} autoPlay playsInline ref={el=>{if(el&&el.srcObject!==stream)el.srcObject=stream;}} aria-label={'Vídeo do participante '+id}/>)}
     {local&&session.kind==='video'&&<video autoPlay playsInline muted ref={el=>{if(el&&el.srcObject!==local)el.srcObject=local;}} aria-label="Prévia da sua câmera"/>}
    </div>
    <div className="conecta-call-actions">
     <button type="button" className="btn btn-outline" aria-label={micOn?'Silenciar microfone':'Ativar microfone'} onClick={toggleMic}>{micOn?<Mic size={17}/>:<MicOff size={17}/>}</button>
     {session.kind==='video'&&<button type="button" className="btn btn-outline" aria-label={cameraOn?'Desligar câmera':'Ligar câmera'} onClick={toggleCamera}>{cameraOn?<Video size={17}/>:<VideoOff size={17}/>}</button>}
     <button type="button" className="btn conecta-call-hangup" onClick={()=>void dispose(true)}><PhoneOff size={17}/> Sair da chamada</button>
    </div>
    <small>Conexão direta WebRTC. Algumas redes podem exigir TURN; a mídia não é armazenada pelo Conecta.</small>
   </section>
  </div>}
 </span>;
}
