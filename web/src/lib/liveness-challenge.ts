/**
 * Browser-only, non-authoritative anti-spoof preflight.
 * The client can be forged. Never use this state to authenticate a person,
 * verify a document/age, issue a badge, unlock ads or update Supabase.
 */
export type ChallengeStep='center'|'turn-positive'|'turn-negative'|'blink'|'completed';
export type PreflightStatus='running'|'completed'|'inconclusive';
export type FaceFrame={
  timestamp:number;
  faceCount:number;
  faceScore:number|null;
  liveness:number|null;
  antiSpoof:number|null;
  yawRadians:number|null;
  gestures:readonly string[];
};
export type ChallengeState={
  order:readonly ChallengeStep[];
  index:number;
  streak:number;
  lostFrames:number;
  blinkStartedAt:number|null;
  validFrames:number;
  startedAt:number;
  status:PreflightStatus;
  reason:string;
};
const TIMEOUT_MS=90000;
const MIN_SCORE=0.60;
const MIN_LIVE=0.60;
const MIN_REAL=0.60;
const YAW_CENTER=0.16;
const YAW_SIDE=0.27;
const MIN_STREAK=2;

export function createChallenge(startedAt:number,positiveFirst:boolean):ChallengeState{
  return {
    order:positiveFirst?
      ['center','turn-positive','turn-negative','blink','completed']:
      ['center','turn-negative','turn-positive','blink','completed'],
    index:0,streak:0,lostFrames:0,blinkStartedAt:null,validFrames:0,
    startedAt,status:'running',reason:''
  };
}
export function currentChallenge(state:ChallengeState):ChallengeStep{
 return state.order[Math.min(state.index,state.order.length-1)];
}
export function challengePrompt(step:ChallengeStep):string{
 switch(step){
  case 'center':return 'Olhe de frente para a câmera por alguns instantes.';
  case 'turn-positive':return 'Vire a cabeça lentamente para um dos lados.';
  case 'turn-negative':return 'Agora vire a cabeça lentamente para o lado oposto.';
  case 'blink':return 'Volte a olhar para a câmera e pisque naturalmente.';
  case 'completed':return 'Desafios locais concluídos. Isso NÃO verifica identidade nem idade.';
 }
}
function validSignal(value:number|null,minimum:number):boolean{
 return value!==null && Number.isFinite(value)&&value>=minimum && value<=1;
}
export function advanceChallenge(state:ChallengeState,frame:FaceFrame):ChallengeState{
 if(state.status!=='running')return state;
 if(!Number.isFinite(frame.timestamp)||frame.timestamp<state.startedAt)return state;
 if(frame.timestamp-state.startedAt>TIMEOUT_MS)
   return {...state,status:'inconclusive',reason:'Tempo limite atingido. Faça outro teste em um local iluminado.'};
 const present=frame.faceCount===1;
 const enoughQuality=present && validSignal(frame.faceScore,MIN_SCORE)
   &&validSignal(frame.liveness,MIN_LIVE)&&validSignal(frame.antiSpoof,MIN_REAL)
   &&frame.yawRadians!==null&&Number.isFinite(frame.yawRadians);
 if(!enoughQuality){
   const lostFrames=state.lostFrames+1;
   if(lostFrames>=5){
     return {...createChallenge(state.startedAt,state.order[1]==='turn-positive'),
       lostFrames,reason:!present?'Mostre somente o seu rosto. O teste foi reiniciado.':
       'Iluminação ou indicadores de vivacidade insuficientes. Teste reiniciado.'};
   }
   return {...state,streak:0,blinkStartedAt:null,lostFrames,
     reason:!present?'Centralize apenas um rosto para continuar.':
       'Ajuste a iluminação e mantenha o rosto visível.'};
 }
 const frameStep=currentChallenge(state);
 const yaw=frame.yawRadians as number;
 const centered=Math.abs(yaw)<=YAW_CENTER;
 const opened=!frame.gestures.some(g=>g==='blink left eye'||g==='blink right eye');
 let streak=state.streak;
 let blinkStartedAt=state.blinkStartedAt;
 let passes=false;
 if(frameStep==='center'){
   streak=centered?streak+1:0;
   passes=streak>=3;
 }else if(frameStep==='turn-positive'||frameStep==='turn-negative'){
   const directionOk=frameStep==='turn-positive'?yaw>=YAW_SIDE:yaw<=-YAW_SIDE;
   streak=directionOk?streak+1:0;
   passes=streak>=MIN_STREAK;
 }else if(frameStep==='blink'){
   if(!centered){streak=0;blinkStartedAt=null;}
   else if(!opened){blinkStartedAt=frame.timestamp;}
   else if(blinkStartedAt!==null){
     const duration=frame.timestamp-blinkStartedAt;
     passes=duration>=50&&duration<=1500;
     blinkStartedAt=null;
   }
 }
 if(passes){
   const index=Math.min(state.index+1,state.order.length-1);
   return {...state,index,streak:0,lostFrames:0,blinkStartedAt:null,
     validFrames:state.validFrames+1,reason:'',
     status:state.order[index]==='completed'?'completed':'running'};
 }
 return {...state,streak,blinkStartedAt,lostFrames:0,validFrames:state.validFrames+1,reason:''};
}
