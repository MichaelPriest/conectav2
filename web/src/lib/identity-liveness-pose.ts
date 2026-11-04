/**
 * Shared, camera-frame pose geometry for Conecta ID.
 * Both models return MediaPipe-compatible mesh indices: 33/263 = outer eyes,
 * 1 = nose tip. They may disagree on their Euler yaw conventions, so a
 * normalized image-space nose-to-eye offset is used consistently instead.
 *
 * This is only a pose signal. It does not establish liveness or identity.
 * The server computes its own mesh; browser-sent landmarks are never trusted.
 */
export type TurnSide='left'|'right';

export function noseEyeTurnOffset(eyeAX:number,eyeBX:number,noseX:number):number|null{
  if(![eyeAX,eyeBX,noseX].every(Number.isFinite))return null;
  const separation=Math.abs(eyeAX-eyeBX);
  if(separation<0.05)return null;
  const offset=(noseX-(eyeAX+eyeBX)/2)/separation;
  return Number.isFinite(offset)?offset:null;
}

/** Compute the same measurement from the server-owned Human mesh in pixels.
 * Image dimensions are not needed: the ratio is invariant under scaling.
 */
export function humanMeshTurnOffset(mesh:readonly (readonly number[])[]|undefined):number|null{
  if(!mesh||mesh.length<264)return null;
  const left=mesh[33],right=mesh[263],nose=mesh[1];
  if(!left||!right||!nose||left.length<2||right.length<2||nose.length<2)return null;
  // Human outputs mesh in pixel coordinates. Divide by the eye distance only
  // after ensuring the eye landmarks are separate enough to be meaningful.
  if(![left[0],left[1],right[0],right[1],nose[0],nose[1]].every(Number.isFinite))return null;
  const eyeDistance=Math.abs(left[0]-right[0]);
  if(eyeDistance<10)return null;
  return (nose[0]-(left[0]+right[0])/2)/eyeDistance;
}

export function assessGuidedHeadTurns(
  offsets:readonly (number|null)[],
  order:readonly TurnSide[]
):'valid'|'invalid_face'|'invalid_sequence'{
  if(offsets.length!==4||order.length!==2||order[0]===order[1]||
     !order.every(side=>side==='left'||side==='right')||
     offsets.some(value=>value===null||!Number.isFinite(value)))
    return 'invalid_face';
  const [neutral,first,second,returned]=offsets as number[];
  // The camera guides stronger movement (>=0.18). Use a small model-to-model
  // tolerance, not a waiver: both turns must still be substantial, oppositely
  // directed, and distinct from the initial neutral frame.
  if(Math.abs(neutral)>0.30||Math.abs(returned)>0.30||
     Math.abs(first)<0.10||Math.abs(second)<0.10)
    return 'invalid_sequence';
  const turned=(value:number,side:TurnSide)=>side==='left'?value>=0.10:value<=-0.10;
  const moved=(value:number,side:TurnSide)=>side==='left'?value-neutral>=0.10:neutral-value>=0.10;
  if(!turned(first,order[0])||!turned(second,order[1])||
     !moved(first,order[0])||!moved(second,order[1]))
    return 'invalid_sequence';
  return 'valid';
}
