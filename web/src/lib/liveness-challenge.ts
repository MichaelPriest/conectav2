/**
 * On-device Human facial-movement preflight. Browser state is untrusted:
 * never issue identity/age credentials, badges or access from this module.
 *
 * Robust to mirrored front cameras, yaw sign differences and brief missing
 * detections. The anti-spoof/liveness scores are still mandatory.
 */
export type ChallengeStep='center'|'turn-any'|'turn-opposite'|'blink'|'completed';
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
 multiFaceFrames:number;
 blinkStartedAt:number|null;
 firstDirection:-1|0|1;
 neutralYaw:number;
 validFrames:number;
 startedAt:number;
 lastFrameAt:number;
 status:PreflightStatus;
 reason:string;
};
const TIMEOUT_MS=120000;
const MIN_FACE=0.55;
const MIN_LIVE=0.60;
const MIN_REAL=0.60;
const CENTER_YAW=0.25;
const TURN_DELTA=0.20;
const MIN_SEPARATION_MS=65;
const MIN_STREAK=2;
function good(value:number|null,threshold:number):boolean{
 return value!==null&&Number.isFinite(value)&&value>=threshold&&value<=1;
}
function side(frame:FaceFrame,neutral:number): -1|0|1 {
 const angle=frame.yawRadians;
 if(angle!==null&&Number.isFinite(angle)){
  if(angle-neutral>=TURN_DELTA)return 1;
  if(angle-neutral<=-TURN_DELTA)return -1;
 }
 if(frame.gestures.includes('facing left'))return -1;
 if(frame.gestures.includes('facing right'))return 1;
 return 0;
}
function centered(frame:FaceFrame,neutral:number):boolean{
 return frame.gestures.includes('facing center')||
   (frame.yawRadians!==null&&Number.isFinite(frame.yawRadians)&&
     Math.abs(frame.yawRadians-neutral)<=CENTER_YAW);
}
export function createChallenge(startedAt:number,_positiveFirst=true):ChallengeState{
 return {order:['center','turn-any','turn-opposite','blink','completed'],
  index:0,streak:0,lostFrames:0,multiFaceFrames:0,
  blinkStartedAt:null,firstDirection:0,neutralYaw:0,validFrames:0,
  startedAt,lastFrameAt:startedAt-100,status:'running',reason:''};
}
export function currentChallenge(state:ChallengeState):ChallengeStep{
 return state.order[Math.min(state.index,state.order.length-1)];
}
export function challengePrompt(step:ChallengeStep):string{
 switch(step){
 case 'center':return 'Centralize o rosto e olhe de frente para a câmera.';
 case 'turn-any':return 'Vire a cabeça lentamente para um dos lados (qualquer lado).';
 case 'turn-opposite':return 'Agora vire para o lado OPOSTO ao anterior.';
 case 'blink':return 'Volte ao centro e pisque devagar. Se não detectar, repita a piscada.';
 case 'completed':return 'Movimentos reconhecidos. Isso não comprova identidade ou idade.';
 }
}
export function advanceChallenge(state:ChallengeState,frame:FaceFrame):ChallengeState{
 if(state.status!=='running')return state;
 if(!Number.isFinite(frame.timestamp)||frame.timestamp<state.startedAt)return state;
 if(frame.timestamp-state.startedAt>TIMEOUT_MS){
  return {...state,status:'inconclusive',reason:'Tempo esgotado. Reinicie o teste com boa iluminação.'};
 }
 if(frame.timestamp-state.lastFrameAt<MIN_SEPARATION_MS)return state;
 const base={...state,lastFrameAt:frame.timestamp};
 if(frame.faceCount!==1){
  const lostFrames=state.lostFrames+1;
  const multiFaceFrames=frame.faceCount>1?state.multiFaceFrames+1:0;
  if(multiFaceFrames>=4)return {
   ...createChallenge(state.startedAt),lastFrameAt:frame.timestamp,
   reason:'Mais de um rosto detectado. Reiniciamos os movimentos por segurança.'
  };
  return {...base,lostFrames,multiFaceFrames,streak:0,blinkStartedAt:null,
   reason:frame.faceCount>1?'Deixe apenas uma pessoa diante da câmera.':
    'Posicione o rosto inteiro na moldura e evite contraluz.'};
 }
 if(!good(frame.faceScore,MIN_FACE)||!good(frame.liveness,MIN_LIVE)||
     !good(frame.antiSpoof,MIN_REAL)){
   return {...base,lostFrames:state.lostFrames+1,multiFaceFrames:0,
    streak:0,blinkStartedAt:null,
    reason:!good(frame.faceScore,MIN_FACE)?
      'Aproxime o rosto, melhore a luz e mantenha a câmera estável.':
      !good(frame.liveness,MIN_LIVE)?
      'Vivacidade insuficiente. Ajuste a iluminação e evite fotos ou telas.':
      'Antifraude inconclusiva. Não use fotos, vídeos nem outra tela.'};
 }
 const step=currentChallenge(state);
 const isCenter=centered(frame,state.neutralYaw);
 let streak=state.streak;
 let firstDirection=state.firstDirection;
 let blinkStartedAt=state.blinkStartedAt;
 let neutralYaw=state.neutralYaw;
 let pass=false;
 let reason='';
 if(step==='center'){
  const center=frame.gestures.includes('facing center') ||
   (frame.yawRadians!==null&&Math.abs(frame.yawRadians)<=CENTER_YAW);
  streak=center?streak+1:0;
  if(center&&frame.yawRadians!==null&&Number.isFinite(frame.yawRadians)){
   neutralYaw=streak===1?frame.yawRadians:(neutralYaw*(streak-1)+frame.yawRadians)/streak;
  }
  pass=streak>=2;
  if(!center)reason='Olhe diretamente para a câmera para iniciar.';
 }else if(step==='turn-any'){
  const direction=side(frame,neutralYaw);
  streak=direction!==0&&(firstDirection===0||firstDirection===direction)?streak+1:0;
  if(direction!==0)firstDirection=direction;
  pass=streak>=MIN_STREAK;
  if(direction===0)reason='Vire o rosto para qualquer lado, sem mover o celular.';
 }else if(step==='turn-opposite'){
  const direction=side(frame,neutralYaw);
  streak=direction!==0&&direction===-firstDirection?streak+1:0;
  pass=streak>=MIN_STREAK;
  if(direction!==-firstDirection)reason='Vire para o outro lado, ultrapassando a posição central.';
 }else if(step==='blink'){
  const isBlink=frame.gestures.includes('blink left eye')||
    frame.gestures.includes('blink right eye');
  if(!isCenter){
   blinkStartedAt=null;
   reason='Volte a olhar de frente antes de piscar.';
  }else if(isBlink){
   if(blinkStartedAt===null)blinkStartedAt=frame.timestamp;
  }else if(blinkStartedAt!==null){
   const elapsed=frame.timestamp-blinkStartedAt;
   pass=elapsed>=65&&elapsed<=2500;
   blinkStartedAt=null;
  }else reason='Pisque suavemente e abra os olhos. Pode repetir.';
 }
 if(pass){
  const index=Math.min(state.index+1,state.order.length-1);
  return {...base,index,streak:0,lostFrames:0,multiFaceFrames:0,
    blinkStartedAt:null,firstDirection,neutralYaw,
    validFrames:state.validFrames+1,reason:'',
    status:state.order[index]==='completed'?'completed':'running'};
 }
 return {...base,streak,lostFrames:0,multiFaceFrames:0,
  blinkStartedAt,firstDirection,neutralYaw,
  validFrames:state.validFrames+1,reason};
}
