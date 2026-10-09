'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import {Phone,PhoneOff,Video,Mic,MicOff,VideoOff,Check,Loader2,Volume2} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';

type CallKind='audio'|'video';
type CallRow={id:string;conversation_id:string;caller_id:string;callee_id:string;kind:CallKind;
 status:'ringing'|'accepted'|'ended'|'declined';offer_sdp:string|null;answer_sdp:string|null;expires_at:string};
type CallContext={busy:boolean;hasCall:boolean;error:string;
 start:(conversationId:string,recipientId:string,recipientName:string,kind:CallKind)=>Promise<void>};
const Context=createContext<CallContext|null>(null);
const config:RTCConfiguration={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
const intervalMs=1900;
const describe=(e:unknown)=>e instanceof Error?e.message:'Não foi possível realizar a chamada.';

async function iceComplete(pc:RTCPeerConnection){
 if(pc.iceGatheringState==='complete')return;
 await new Promise<void>((resolve,reject)=>{
  const timeout=window.setTimeout(()=>{cleanup();reject(new Error('A rede não concluiu a negociação WebRTC.'));},14000);
  const complete=()=>{if(pc.iceGatheringState==='complete'){cleanup();resolve();}};
  const cleanup=()=>{window.clearTimeout(timeout);pc.removeEventListener('icegatheringstatechange',complete);};
  pc.addEventListener('icegatheringstatechange',complete);complete();
 });
}

export function ChatCallsProvider({userId,children}:{userId:string;children:React.ReactNode}){
 const db=supabaseBrowser();
 const [current,setCurrent]=useState<CallRow|null>(null),currentRef=useRef<CallRow|null>(null);
 const [contact,setContact]=useState(''),[busy,setBusy]=useState(false),busyRef=useRef(false);
 const [error,setError]=useState(''),[status,setStatus]=useState('Chamando…');
 const [micOn,setMicOn]=useState(true),[camOn,setCamOn]=useState(false);
 const [local,setLocal]=useState<MediaStream|null>(null),[remote,setRemote]=useState<MediaStream|null>(null);
 const [audioBlocked,setAudioBlocked]=useState(false);
 const pcRef=useRef<RTCPeerConnection|null>(null),streamRef=useRef<MediaStream|null>(null);
 const sentOffer=useRef(false),sentAnswer=useRef(false),negotiating=useRef(false),querying=useRef(false);
 const localVideo=useRef<HTMLVideoElement|null>(null),remoteVideo=useRef<HTMLVideoElement|null>(null);
 const ended=useRef<string|null>(null);

 useEffect(()=>{if(localVideo.current)localVideo.current.srcObject=local;},[local,current?.id]);
 useEffect(()=>{
  if(!remoteVideo.current)return;
  remoteVideo.current.srcObject=remote;
  if(remote)void remoteVideo.current.play().then(()=>setAudioBlocked(false)).catch(()=>setAudioBlocked(true));
 },[remote,current?.id]);

 const release=useCallback(()=>{
  pcRef.current?.close();pcRef.current=null;
  streamRef.current?.getTracks().forEach(track=>track.stop());streamRef.current=null;
  setLocal(null);setRemote(null);setAudioBlocked(false);
  setMicOn(true);setCamOn(false);setStatus('Chamando…');
  sentOffer.current=false;sentAnswer.current=false;negotiating.current=false;
  currentRef.current=null;setCurrent(null);busyRef.current=false;setBusy(false);
 },[]);
 const end=useCallback(async(decline=false)=>{
  const row=currentRef.current;
  if(!row||ended.current===row.id)return;
  ended.current=row.id;release();
  await db.rpc('end_chat_call',{_id:row.id,_decline:decline});
 },[db,release]);
 const acquire=useCallback(async(kind:CallKind)=>{
  if(!navigator.mediaDevices?.getUserMedia||!('RTCPeerConnection' in window))
   throw new Error('Este navegador não permite chamadas WebRTC.');
  const media=await navigator.mediaDevices.getUserMedia({
   audio:{echoCancellation:true,noiseSuppression:true},video:kind==='video'
  });
  streamRef.current=media;setLocal(media);setMicOn(true);setCamOn(kind==='video');
  const pc=new RTCPeerConnection(config);pcRef.current=pc;
  media.getTracks().forEach(track=>pc.addTrack(track,media));
  pc.ontrack=e=>{
   if(e.streams[0])setRemote(e.streams[0]);
   else if(e.track)setRemote(previous=>{
    const s=previous||new MediaStream();s.addTrack(e.track);return s;
   });
  };
  pc.onconnectionstatechange=()=>{
   if(pc.connectionState==='connected')setStatus('Conectada');
   else if(pc.connectionState==='connecting')setStatus('Conectando…');
   else if(pc.connectionState==='failed')setStatus('Falha na conexão P2P. Esta rede pode exigir TURN.');
  };
 },[]);
 const start=useCallback(async(conversationId:string,recipientId:string,recipientName:string,kind:CallKind)=>{
  if(currentRef.current||busyRef.current)return;
  busyRef.current=true;setBusy(true);setError('');setContact(recipientName);
  try{
   await acquire(kind);
   const {data,error:e}=await db.rpc('start_chat_call',{
    _conversation:conversationId,_callee:recipientId,_kind:kind
   });
   if(e||!data)throw e||new Error('Não foi possível iniciar.');
   const row:CallRow={id:String(data),conversation_id:conversationId,caller_id:userId,
    callee_id:recipientId,kind,status:'ringing',offer_sdp:null,answer_sdp:null,
    expires_at:new Date(Date.now()+65000).toISOString()};
   ended.current=null;currentRef.current=row;setCurrent(row);setStatus('Chamando…');
  }catch(e){release();setError(describe(e));}
  finally{busyRef.current=false;setBusy(false);}
 },[acquire,db,release,userId]);
 const accept=useCallback(async()=>{
  const row=currentRef.current;
  if(!row||row.callee_id!==userId||busyRef.current)return;
  busyRef.current=true;setBusy(true);setError('');
  try{
   await acquire(row.kind);
   const {error:e}=await db.rpc('accept_chat_call',{_id:row.id});
   if(e)throw e;
   const changed={...row,status:'accepted' as const,
    expires_at:new Date(Date.now()+120000).toISOString()};
   currentRef.current=changed;setCurrent(changed);setStatus('Conectando…');
  }catch(e){setError(describe(e));void end(true);}
  finally{busyRef.current=false;setBusy(false);}
 },[acquire,db,end,userId]);
 const negotiate=useCallback(async(row:CallRow)=>{
  const pc=pcRef.current;
  if(!pc||negotiating.current||row.status!=='accepted')return;
  negotiating.current=true;
  try{
   if(row.caller_id===userId&&!sentOffer.current){
    sentOffer.current=true;
    await pc.setLocalDescription(await pc.createOffer());
    await iceComplete(pc);
    const sdp=pc.localDescription?.sdp;
    if(!sdp)throw Error('Oferta WebRTC vazia.');
    const {error:e}=await db.rpc('signal_chat_call',{_id:row.id,_kind:'offer',_sdp:sdp});
    if(e)throw e;
   }else if(row.callee_id===userId&&row.offer_sdp&&!sentAnswer.current){
    sentAnswer.current=true;
    await pc.setRemoteDescription({type:'offer',sdp:row.offer_sdp});
    await pc.setLocalDescription(await pc.createAnswer());
    await iceComplete(pc);
    const sdp=pc.localDescription?.sdp;
    if(!sdp)throw Error('Resposta WebRTC vazia.');
    const {error:e}=await db.rpc('signal_chat_call',{_id:row.id,_kind:'answer',_sdp:sdp});
    if(e)throw e;
   }else if(row.caller_id===userId&&row.answer_sdp&&!pc.currentRemoteDescription){
    await pc.setRemoteDescription({type:'answer',sdp:row.answer_sdp});
   }
  }catch(e){setError(describe(e));void end();}
  finally{negotiating.current=false;}
 },[db,end,userId]);
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
    if(!data||data.status==='ended'||data.status==='declined'||
      Date.parse(data.expires_at)<=Date.now()){
      void end();return;
    }
    // A previous pending fetch must not revive a call that has just ended.
    if(currentRef.current?.id!==row.id)return;
    const updated=data as CallRow;
    currentRef.current=updated;setCurrent(updated);
    if(updated.status==='accepted'&&pcRef.current)void negotiate(updated);
   }else if(!document.hidden){
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
    ended.current=null;currentRef.current=incoming;setCurrent(incoming);
    setContact(person?.display_name||'Sua conexão');
    setStatus('Chamada recebida');
   }
  }finally{querying.current=false;}
 },[db,end,negotiate,userId]);
 useEffect(()=>{
  void check();
  const timer=window.setInterval(()=>{void check();},1900);
  const visibility=()=>{if(!document.hidden)void check();};
  document.addEventListener('visibilitychange',visibility);
  return()=>{
   window.clearInterval(timer);document.removeEventListener('visibilitychange',visibility);
   const row=currentRef.current;
   if(row)void db.rpc('end_chat_call',{_id:row.id,_decline:false});
   pcRef.current?.close();streamRef.current?.getTracks().forEach(track=>track.stop());
  };
 },[db,check]);
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
 return <Context.Provider value={{busy,hasCall:Boolean(current),error,start}}>{children}
  {current&&<div className="conecta-call-backdrop">
   <section className="conecta-call-panel" role="dialog" aria-modal="true"
    aria-label={incoming?'Chamada recebida':'Chamada de áudio ou vídeo'}>
    <small className="conecta-call-eyebrow">Conecta · {current.kind==='video'?'Vídeo':'Voz'}</small>
    <h2>{contact}</h2><p role="status">{status}</p>
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
