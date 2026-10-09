/** Lightweight Conecta call ringtones. Generated locally with Web Audio.
 * No third-party media, recordings, network requests or external audio files.
 * Browsers can block unsolicited audio: unlock() must be called from a click. */
export type CallToneMode='incoming'|'outgoing';
export type CallToneEvent='connected'|'ended'|'missed';
export type CallTonePreferences={enabled:boolean;volume:number};
export const DEFAULT_CALL_TONES:CallTonePreferences={enabled:true,volume:0.42};

export function sanitizeCallTonePreferences(value:unknown):CallTonePreferences{
 if(!value||typeof value!=='object')return {...DEFAULT_CALL_TONES};
 const item=value as {enabled?:unknown;volume?:unknown};
 const volume=typeof item.volume==='number'&&Number.isFinite(item.volume)?
   Math.min(1,Math.max(0,item.volume)):DEFAULT_CALL_TONES.volume;
 return {enabled:typeof item.enabled==='boolean'?item.enabled:DEFAULT_CALL_TONES.enabled,volume};
}
type Note={frequency:number;offset:number;duration:number};
const RING_INCOMING:Note[]=[
 {frequency:740,offset:0,duration:0.27},
 {frequency:880,offset:0.32,duration:0.27},
 {frequency:740,offset:0.69,duration:0.27}
];
const RING_OUTGOING:Note[]=[
 {frequency:440,offset:0,duration:0.85},
 {frequency:480,offset:0,duration:0.85}
];
const CONNECTED:Note[]=[
 {frequency:630,offset:0,duration:0.12},
 {frequency:840,offset:0.15,duration:0.23}
];
const ENDED:Note[]=[
 {frequency:600,offset:0,duration:0.18},
 {frequency:410,offset:0.20,duration:0.28}
];
const MISSED:Note[]=[
 {frequency:400,offset:0,duration:0.15},
 {frequency:400,offset:0.24,duration:0.15},
 {frequency:350,offset:0.47,duration:0.28}
];
export class ChatCallTones{
 private context:AudioContext|null=null;
 private interval:number|null=null;
 private activeMode:CallToneMode|null=null;
 private nodes=new Set<OscillatorNode>();
 private preferences:CallTonePreferences={...DEFAULT_CALL_TONES};
 constructor(private onBlocked:(blocked:boolean)=>void){}
 private ensureContext():AudioContext|null{
  if(typeof window==='undefined'||typeof window.AudioContext==='undefined')return null;
  if(!this.context||this.context.state==='closed')this.context=new window.AudioContext();
  return this.context;
 }
 private note(note:Note,at:number){
  const ctx=this.context;
  if(!ctx||ctx.state!=='running'||!this.preferences.enabled||this.preferences.volume<=0)return;
  const osc=ctx.createOscillator(),gain=ctx.createGain();
  const begin=at+note.offset,finish=begin+note.duration;
  osc.type='sine';
  osc.frequency.setValueAtTime(note.frequency,begin);
  // Keep audible but quiet enough to avoid speaker feedback into the microphone.
  const level=Math.min(0.11,0.10*this.preferences.volume);
  gain.gain.setValueAtTime(0.0001,begin);
  gain.gain.linearRampToValueAtTime(level,begin+0.025);
  gain.gain.setValueAtTime(level,Math.max(begin+0.025,finish-0.04));
  gain.gain.linearRampToValueAtTime(0.0001,finish);
  osc.connect(gain);gain.connect(ctx.destination);
  this.nodes.add(osc);
  osc.onended=()=>{
   this.nodes.delete(osc);try{osc.disconnect();gain.disconnect();}catch{}
  };
  osc.start(begin);osc.stop(finish+0.04);
 }
 private play(notes:Note[]){
  if(this.context?.state!=='running')return;
  const start=this.context.currentTime+0.035;
  for(const note of notes)this.note(note,start);
 }
 private stopAudio(){
  if(this.interval!==null){window.clearInterval(this.interval);this.interval=null;}
  for(const oscillator of this.nodes){
   try{oscillator.stop();}catch{}
   try{oscillator.disconnect();}catch{}
  }
  this.nodes.clear();
 }
 private beginIfReady(){
  if(!this.activeMode||!this.preferences.enabled||this.preferences.volume<=0)return;
  if(this.context?.state!=='running'){this.onBlocked(true);return;}
  this.onBlocked(false);
  if(this.interval!==null)return;
  const pattern=this.activeMode==='incoming'?RING_INCOMING:RING_OUTGOING;
  this.play(pattern);
  this.interval=window.setInterval(()=>{
   if(this.context?.state==='running'&&this.activeMode)this.play(pattern);
  },this.activeMode==='incoming'?2900:2600);
 }
 /** Invoke during a user click before async microphone permission steps. */
 unlock(){
  if(!this.preferences.enabled||this.preferences.volume<=0)return;
  const ctx=this.ensureContext();
  if(!ctx){this.onBlocked(true);return;}
  if(ctx.state==='running'){this.onBlocked(false);this.beginIfReady();return;}
  void ctx.resume().then(()=>{
   this.onBlocked(ctx.state!=='running');
   if(ctx.state==='running')this.beginIfReady();
  }).catch(()=>this.onBlocked(true));
 }
 configure(preferences:CallTonePreferences){
  const updated=sanitizeCallTonePreferences(preferences);
  const changed=this.preferences.enabled!==updated.enabled||this.preferences.volume!==updated.volume;
  this.preferences=updated;
  if(!changed)return;
  const mode=this.activeMode;
  this.stopAudio();
  if(!updated.enabled||updated.volume<=0){this.onBlocked(false);return;}
  if(mode)this.unlock();
 }
 start(mode:CallToneMode){
  this.stopAudio();this.activeMode=mode;
  if(this.preferences.enabled&&this.preferences.volume>0)this.unlock();
  else this.onBlocked(false);
 }
 stop(){
  this.activeMode=null;this.stopAudio();this.onBlocked(false);
 }
 playEvent(kind:CallToneEvent){
  this.stop();
  if(!this.preferences.enabled||this.preferences.volume<=0||this.context?.state!=='running')return;
  this.play(kind==='connected'?CONNECTED:kind==='missed'?MISSED:ENDED);
 }
 dispose(){
  this.stop();
  const ctx=this.context;this.context=null;
  if(ctx)void ctx.close().catch(()=>{});
 }
}
