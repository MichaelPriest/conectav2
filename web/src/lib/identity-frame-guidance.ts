/**
 * Lightweight, on-device preview guidance for MediaPipe Face Landmarker.
 * Untrusted UX hints only. Neither these landmarks nor the client-ready flag
 * can authorize a Conecta ID identity, age or liveness result.
 */
export type GuidePoint={x:number;y:number;z?:number};
export type FaceGuide={
  status:'missing'|'multiple'|'incomplete'|'distant'|'close'|'off-center'|'pose'|'ready';
  ready:boolean;
  message:string;
  turnOffset:number|null;
};

const hint=(status:FaceGuide['status'],message:string,turnOffset:number|null=null):FaceGuide=>({
  status,ready:status==='ready',message,turnOffset
});

export function inspectGuidedFace(faces:readonly (readonly GuidePoint[])[],step:number):FaceGuide{
  if(faces.length===0)return hint('missing','Posicione seu rosto dentro da moldura.');
  if(faces.length!==1)return hint('multiple','Apenas uma pessoa pode aparecer na câmera.');
  const points=faces[0];
  if(points.length<264||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))
    return hint('incomplete','Mantenha o rosto inteiro visível e melhore a iluminação.');

  const minX=Math.min(...points.map(p=>p.x));
  const maxX=Math.max(...points.map(p=>p.x));
  const minY=Math.min(...points.map(p=>p.y));
  const maxY=Math.max(...points.map(p=>p.y));
  const width=maxX-minX,height=maxY-minY;
  if(minX<0.015||maxX>0.985||minY<0.015||maxY>0.985)
    return hint('incomplete','Afaste-se um pouco: o rosto está cortado na borda.');
  if(width<0.25||height<0.30)
    return hint('distant','Aproxime o rosto da câmera até preencher a moldura.');
  if(width>0.78||height>0.90)
    return hint('close','Afaste um pouco o rosto da câmera.');
  const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
  if(Math.abs(cx-0.5)>0.16||Math.abs(cy-0.5)>0.20)
    return hint('off-center','Centralize o rosto dentro da moldura.');

  const eyeA=points[33],eyeB=points[263],nose=points[1];
  const eyeDistance=Math.abs(eyeA.x-eyeB.x);
  if(eyeDistance<0.05)return hint('incomplete','Mantenha os olhos e o nariz visíveis.');
  // Signed nose-to-eye offset is only a heuristic, not a trusted yaw measure.
  const turnOffset=(nose.x-(eyeA.x+eyeB.x)/2)/eyeDistance;
  if(!Number.isFinite(turnOffset))
    return hint('incomplete','Mantenha olhos e nariz visíveis.');
  if((step===0||step===3)&&Math.abs(turnOffset)>0.24)
    return hint('pose','Olhe diretamente para a câmera, de frente.',turnOffset);
  if((step===1||step===2)&&Math.abs(turnOffset)<0.12)
    return hint('pose','Vire um pouco mais a cabeça para o lado solicitado.',turnOffset);
  return hint('ready','Rosto bem enquadrado. Mantenha a posição por um instante.',turnOffset);
}
