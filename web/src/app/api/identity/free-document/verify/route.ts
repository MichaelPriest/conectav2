import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import '@tensorflow/tfjs-node';
import {NextRequest,NextResponse} from 'next/server';
import {createWorker,PSM} from 'tesseract.js';
import sharp from 'sharp';
import {BinaryBitmap,HybridBinarizer,QRCodeReader,RGBLuminanceSource} from '@zxing/library';
import {identityContext} from '@/lib/identity-server';
import {isTrustedIdentityOrigin} from '@/lib/identity-origin';
import {inspectCinToken} from '@/lib/cin-qr';
import {extractBirthDateFromOcr} from '@/lib/legacy-rg-ocr';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

const headers={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache'};
const fail=(message:string,status:number)=>NextResponse.json({ok:false,message,documentStored:false},{status,headers});
const MAX_IMAGE_BYTES=8*1024*1024;
const MAX_REQUEST_BYTES=25*1024*1024;
const allowedTypes=new Set(['image/jpeg','image/png','image/webp']);

type FaceResult={face?:Array<{embedding?:number[];faceScore?:number;boxScore?:number;real?:number;rotation?:{angle?:{yaw?:number}};tensor?:{dispose?:()=>void}}>};
async function imageBuffer(value:FormDataEntryValue|null,label:string):Promise<Buffer>{
  if(!(value instanceof File))throw new Error('Envie '+label+'.');
  if(!allowedTypes.has(value.type)||value.size<1||value.size>MAX_IMAGE_BYTES)
    throw new Error(label+' deve ser JPG, PNG ou WebP de até 8 MB.');
  return Buffer.from(await value.arrayBuffer());
}
async function decodeQrFromImage(buffer:Buffer):Promise<string|null>{
  const image=await sharp(buffer,{limitInputPixels:20_000_000}).rotate()
    .resize({width:1800,height:1800,fit:'inside',withoutEnlargement:true})
    .greyscale().raw().toBuffer({resolveWithObject:true});
  const luminance=new Uint8ClampedArray(image.data);
  try{
    const source=new RGBLuminanceSource(luminance,image.info.width,image.info.height);
    const reader=new QRCodeReader();
    try{return reader.decode(new BinaryBitmap(new HybridBinarizer(source))).getText();}
    finally{reader.reset();}
  }catch{
    // QR placement differs by document model; absence on one side is not a rejection.
    return null;
  }finally{luminance.fill(0);image.data.fill(0);}
}
async function pixels(buffer:Buffer){
  const result=await sharp(buffer,{limitInputPixels:20_000_000})
    .rotate().resize({width:1200,height:1200,fit:'inside',withoutEnlargement:true})
    .removeAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
  if(result.info.channels!==3)throw new Error('Não foi possível normalizar uma das imagens.');
  return {data:new Uint8Array(result.data),width:result.info.width,height:result.info.height};
}
async function prepareOcrImage(buffer:Buffer):Promise<Buffer>{
  // Phone photos of older RG cards are often framed vertically while the card
  // itself is sideways. Crop away the tabletop first, then orient the cropped
  // card by its aspect ratio instead of trusting EXIF orientation alone.
  const cropped=await sharp(buffer,{limitInputPixels:20_000_000})
    .rotate()
    .trim({threshold:25})
    .png()
    .toBuffer();
  try{
    const metadata=await sharp(cropped).metadata();
    const needsQuarterTurn=Boolean(metadata.width&&metadata.height&&metadata.height>metadata.width*1.12);
    let prepared=sharp(cropped,{limitInputPixels:20_000_000});
    if(needsQuarterTurn)prepared=prepared.rotate(90);
    return await prepared
      .flatten({background:'#fff'})
      .resize({width:2000,height:2000,fit:'inside'})
      .greyscale()
      .normalize()
      .sharpen()
      .png()
      .toBuffer();
  }finally{
    cropped.fill(0);
  }
}
async function rotateOcrImage180(buffer:Buffer):Promise<Buffer>{
  // When a sideways phone capture could be turned clockwise or counterclockwise,
  // the alternate landscape direction differs by 180 degrees.
  return sharp(buffer,{limitInputPixels:20_000_000}).rotate(180).png().toBuffer();
}
function dobFromText(raw:string):string|null{
  return extractBirthDateFromOcr(raw);
}
function bandForDate(iso:string):'13_15'|'16_17'|'18_plus'|'0_12'|null{
  const [year,month,day]=iso.split('-').map(Number);
  const now=new Date();
  let age=now.getFullYear()-year;
  if(now.getMonth()+1<month||(now.getMonth()+1===month&&now.getDate()<day))age--;
  if(age<0||age>120)return null;
  return age<13?'0_12':age<16?'13_15':age<18?'16_17':'18_plus';
}
function qrDate(qr:string):string|null{
  const direct=qr.match(/(?:birth|birthDate|dateOfBirth|dataNascimento|data_nascimento|nascimento)["'\s:=,-]*["']?(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/i);
  if(!direct)return null;
  const raw=direct[1];
  if(/^\d{4}-/.test(raw))return raw;
  const [day,month,year]=raw.split('/').map(Number);
  return [String(year),String(month).padStart(2,'0'),String(day).padStart(2,'0')].join('-');
}
function ageBandFromCin(value:string):string|null{
  const match=value.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if(!match)return null;
  return bandForDate(match[1]);
}

export async function POST(request:NextRequest){
  if(!isTrustedIdentityOrigin(request.headers,request.url,process.env))return fail('Origem inválida.',403);
  const context=await identityContext(request);
  if(!context)return fail('Entre na sua conta para continuar.',401);
  let attemptId:number|null=null;
  const completeAttempt=async()=>{
    if(attemptId===null)return;
    const id=attemptId;
    try{
      const {error}=await context.admin.from('identity_free_verification_attempts')
        .update({status:'completed'}).eq('id',id).eq('user_id',context.user.id);
      if(!error)attemptId=null;
    }catch{
      // An abandoned pending reservation expires from rate-limit counting after two minutes.
    }
  };
  const releaseAttempt=async()=>{
    if(attemptId===null)return;
    const id=attemptId;
    try{
      const {error}=await context.admin.from('identity_free_verification_attempts')
        .delete().eq('id',id).eq('user_id',context.user.id);
      if(!error)attemptId=null;
    }catch{
      // A failed release remains pending and is ignored by the rate limiter after two minutes.
    }
  };
  const failAttempt=async(message:string,status:number)=>{
    // Validation failures count; service/infrastructure failures do not.
    if(attemptId!==null){
      if(status>=500)await releaseAttempt();
      else await completeAttempt();
    }
    return fail(message,status);
  };
  const contentLength=Number(request.headers.get('content-length')||0);
  if(Number.isFinite(contentLength)&&contentLength>MAX_REQUEST_BYTES)return fail('O envio total excede o limite de 25 MB.',413);
  const retentionCutoff=new Date(Date.now()-90*24*60*60*1000).toISOString();
  const {error:cleanupError}=await context.admin.from('identity_free_verification_attempts').delete()
    .eq('user_id',context.user.id).lt('attempted_at',retentionCutoff);
  if(cleanupError)return fail('Não foi possível atualizar o controle de tentativas com segurança.',503);
  // Attempts are reserved only after a well-formed multipart payload and all
  // required images have been validated. The database RPC makes reservation atomic.

  let document:Buffer=Buffer.alloc(0),back:Buffer=Buffer.alloc(0),rgDataSide:Buffer=Buffer.alloc(0),rgPhotoSide:Buffer=Buffer.alloc(0),selfie:Buffer=Buffer.alloc(0),qr='',documentType='',livenessChallenge='';
  const livenessFrames:Buffer[]=[];
  let challengeTurnOrder:string[]=[];
  try{
    const form=await request.formData();
    if(form.get('consent')!=='true')return fail('É necessário consentir com o processamento temporário das imagens.',400);
    documentType=String(form.get('documentType')||'');
    if(!['cin','old-rg','cnh'].includes(documentType))return fail('Selecione CIN, RG antigo ou CNH.',400);
    document=await imageBuffer(form.get('documentFront'),'a frente do documento');
    back=await imageBuffer(form.get('documentBack'),'o verso do documento');
    selfie=await imageBuffer(form.get('selfie'),'a selfie');
    livenessChallenge=String(form.get('livenessChallenge')||'');
    if(!/^[0-9a-f]{64}$/.test(livenessChallenge))throw new Error('Inicie a captura guiada de vivacidade antes de enviar os documentos.');
    for(let i=0;i<4;i++)livenessFrames.push(await imageBuffer(form.get('livenessFrame'+i),'o quadro guiado '+(i+1)));
    const {data:reservationData,error:reservationError}=await context.admin.rpc(
      'start_conecta_identity_verification_attempt',{p_user_id:context.user.id}
    );
    if(reservationError||!reservationData||typeof reservationData!=='object')
      throw new Error('O controle de tentativas está indisponível. Tente novamente mais tarde.');
    const reservation=reservationData as {allowed?:boolean;attempt_id?:number|null};
    if(reservation.allowed!==true){
      document.fill(0);back.fill(0);selfie.fill(0);
      for(const frame of livenessFrames)frame.fill(0);
      return fail('Limite de 5 tentativas em 30 minutos atingido. Aguarde antes de tentar novamente.',429);
    }
    const reservedId=Number(reservation.attempt_id);
    if(!Number.isSafeInteger(reservedId)||reservedId<1)
      throw new Error('O controle de tentativas está indisponível. Tente novamente mais tarde.');
    attemptId=reservedId;
    // Consume on first well-formed submission, before OCR/model work, so a
    // failed attempt cannot keep reusing the same challenge.
    const challengeHash=createHash('sha256').update(livenessChallenge,'utf8').digest('hex');
    const {data:challengeData,error:challengeError}=await context.admin.rpc('consume_identity_liveness_challenge',{
      p_user_id:context.user.id,p_challenge_hash:challengeHash
    });
    if(challengeError)throw new Error('O serviço de vivacidade está indisponível.');
    if(!challengeData||!Array.isArray(challengeData.turn_order)||challengeData.turn_order.length!==2)
      throw new Error('O desafio de vivacidade expirou ou já foi utilizado. Inicie uma nova captura.');
    challengeTurnOrder=challengeData.turn_order as string[];
    if(!((challengeTurnOrder[0]==='left'&&challengeTurnOrder[1]==='right')||
         (challengeTurnOrder[0]==='right'&&challengeTurnOrder[1]==='left')))
      throw new Error('A sequência do desafio não corresponde à política ativa. Inicie novamente.');
    // RG antigo passa por OCR da frente/verso e comparação facial; não depende dos
    // QR Codes internos, que variam por emissão e frequentemente não são legíveis.
    // CIN e CNH continuam exigindo QR Code na frente ou no verso.
    if(documentType!=='old-rg'){
      const frontQr=await decodeQrFromImage(document);
      const backQr=await decodeQrFromImage(back);
      qr=frontQr||backQr||'';
      if(!qr)throw new Error('Não foi possível localizar o QR Code na frente nem no verso. Confira foco, iluminação e reflexos e tente novamente.');
      if(qr.length<8||qr.length>12000)throw new Error('O QR Code encontrado no documento não tem um conteúdo válido para esta verificação.');
    }else{
      qr='';
    }
  }catch(error){
    document.fill(0);back.fill(0);rgDataSide.fill(0);rgPhotoSide.fill(0);selfie.fill(0);for(const frame of livenessFrames)frame.fill(0);qr='';
    const message=error instanceof Error?error.message:'Não foi possível ler os arquivos enviados.';
    const status=message==='O serviço de vivacidade está indisponível.'||
      message==='O controle de tentativas está indisponível. Tente novamente mais tarde.'?503:400;
    return await failAttempt(message,status);
  }

  let worker:Awaited<ReturnType<typeof createWorker>>|null=null;
  let ocrImages:Buffer[]=[];
  let documentTensor:any=null,selfieTensor:any=null;
  let documentFaceResults:FaceResult|undefined,selfieFaceResults:FaceResult|undefined;
  let documentPixels:Uint8Array|undefined,selfiePixels:Uint8Array|undefined;
  let documentTensorData:Int32Array|undefined,selfieTensorData:Int32Array|undefined;
  try{
    const [docPixels,selfiePix]=await Promise.all([pixels(document),pixels(selfie)]);
    documentPixels=docPixels.data;selfiePixels=selfiePix.data;
    worker=await createWorker('por',1,{
      // Pin the worker entrypoint to the external package path. Vercel's bundler
      // cannot always infer Tesseract's relative worker lookup from __dirname.
      workerPath:path.join(process.cwd(),'node_modules','tesseract.js','src','worker-script','node','index.js'),
      cacheMethod:'write'
    });
    // First pass: high-resolution contrast-normalized images with sparse-text
    // segmentation, suitable for labels distributed across an older ID card.
    const documentImages=[document,back];
    ocrImages.push(await prepareOcrImage(document));
    ocrImages.push(await prepareOcrImage(back));
    await worker.setParameters({
      tessedit_pageseg_mode:PSM.SPARSE_TEXT,
      preserve_interword_spaces:'1',
      user_defined_dpi:'300'
    });
    const ocrResults=await Promise.all(ocrImages.map(image=>worker!.recognize(image)));
    const parseDates=(results:typeof ocrResults)=>
      results.map(result=>dobFromText(typeof result.data.text==='string'?result.data.text:''))
        .filter((value):value is string=>Boolean(value));
    let detectedDates=parseDates(ocrResults);
    // Run a second segmentation pass on the cropped, deskewed/enlarged document
    // rather than on the full tabletop photo.
    if(detectedDates.length===0){
      await worker.setParameters({
        tessedit_pageseg_mode:PSM.SINGLE_BLOCK,
        preserve_interword_spaces:'1',
        user_defined_dpi:'300'
      });
      const fallbackResults=await Promise.all(ocrImages.map(image=>worker!.recognize(image)));
      detectedDates=parseDates(fallbackResults);
    }
    // If still unreadable, test the opposite landscape orientation. This covers
    // cards physically rotated 90 degrees in phone photos.
    if(detectedDates.length===0){
      const reversedImages:Buffer[]=[];
      try{
        for(const image of ocrImages)reversedImages.push(await rotateOcrImage180(image));
        await worker.setParameters({
          tessedit_pageseg_mode:PSM.SPARSE_TEXT,
          preserve_interword_spaces:'1',
          user_defined_dpi:'300'
        });
        const reversedResults=await Promise.all(reversedImages.map(image=>worker!.recognize(image)));
        detectedDates=parseDates(reversedResults);
      }finally{
        for(const image of reversedImages)image.fill(0);
      }
    }
    const uniqueDates=[...new Set(detectedDates)];
    if(uniqueDates.length>1)
      return await failAttempt('As datas de nascimento lidas nas partes do documento divergem. Confira a frente e o verso do documento e tente novamente.',422);
    const dob=uniqueDates[0]||null;
    if(!dob)return await failAttempt('Não consegui ler uma única data de nascimento na frente nem no verso do documento. Melhore a iluminação e tente novamente.',422);
    const ageBand=bandForDate(dob);
    if(!ageBand)return await failAttempt('A data de nascimento lida não é válida.',422);
    if(ageBand==='0_12')return await failAttempt('Esta faixa etária precisa de um fluxo de responsável específico. A validação não foi concluída.',422);

    let qrAgeBand:string|null=null;
    if(documentType==='cin'){
      const cin=await inspectCinToken(qr);
      if(cin.status!=='signature-valid-local')
        return await failAttempt('A assinatura do QR Code da CIN não passou na verificação criptográfica disponível. Nenhum acesso foi liberado.',422);
      qrAgeBand=cin.indicativeAgeBand||ageBandFromCin(qr);
      if(qrAgeBand&&qrAgeBand!==ageBand)
        return await failAttempt('A faixa etária lida no QR Code diverge da data no documento.',422);
    }else if(documentType==='cnh'){
      // CNH QR payload is required, but issuer formats vary and no official
      // authenticity claim is made by this local automated check.
      const qrDob=qrDate(qr);
      if(qrDob&&qrDob!==dob)return await failAttempt('A data de nascimento do QR Code diverge da data impressa.',422);
    }

    // Human is executed on the server; browser-supplied face scores/descriptors
    // are never accepted. Uploaded originals stay in memory and are never logged.
    const module:any=await import('@vladmandic/human');
    const HumanClass=module.Human||module.default?.Human||module.default;
    if(typeof HumanClass!=='function')throw new Error('O mecanismo de comparação facial não está disponível no servidor.');
    const instance:any=new HumanClass({
      modelBasePath:pathToFileURL(path.join(process.cwd(),'public','vendor','human-models')+path.sep).href,
      debug:false,
      face:{enabled:true,detector:{rotation:true,return:true,maxDetected:4},mesh:{enabled:true},description:{enabled:true},antispoof:{enabled:true},liveness:{enabled:true}},
      body:{enabled:false},hand:{enabled:false},object:{enabled:false},gesture:{enabled:false}
    });
    await instance.load();
    documentTensorData=new Int32Array(docPixels.data);selfieTensorData=new Int32Array(selfiePix.data);
    documentTensor=instance.tf.tensor4d(documentTensorData,[1,docPixels.height,docPixels.width,3],'int32');
    selfieTensor=instance.tf.tensor4d(selfieTensorData,[1,selfiePix.height,selfiePix.width,3],'int32');
    const [docResult,selfieResult]=await Promise.all([instance.detect(documentTensor),instance.detect(selfieTensor)]);
    documentFaceResults=docResult as FaceResult;selfieFaceResults=selfieResult as FaceResult;
    const docFaces=docResult.face||[],selfieFaces=selfieResult.face||[];
    if(docFaces.length!==1||selfieFaces.length!==1)
      return await failAttempt('Precisamos detectar exatamente um rosto na foto do documento e na selfie. Tente novamente com imagens nítidas.',422);
    const docFace=docFaces[0],selfieFace=selfieFaces[0];
    if(!docFace.embedding?.length||!selfieFace.embedding?.length)
      return await failAttempt('Não foi possível calcular a comparação facial. Tente com uma foto mais nítida.',422);
    const similarity=instance.match.similarity(docFace.embedding,selfieFace.embedding);
    if(!Number.isFinite(similarity)||similarity<0.62)
      return await failAttempt('A comparação facial não atingiu o nível mínimo. Confira se a selfie corresponde à foto do documento.',422);
    if(typeof selfieFace.real!=='number'||selfieFace.real<0.55)
      return await failAttempt('A análise antifraude da selfie ficou inconclusiva. Faça uma nova captura ao vivo, sem filtros.',422);

    // Challenge was consumed before OCR/model work; client booleans and scores are ignored.
    const livenessPixels=await Promise.all(livenessFrames.map(frame=>pixels(frame)));
    const livenessTensors:any[]=[];
    const livenessResults:FaceResult[]=[];
    try{
      for(const frame of livenessPixels){
        const tensorData=new Int32Array(frame.data);
        const tensor=instance.tf.tensor4d(tensorData,[1,frame.height,frame.width,3],'int32');
        livenessTensors.push({tensor,data:tensorData,pixels:frame.data});
        const detected=await instance.detect(tensor);
        livenessResults.push(detected as FaceResult);
      }
      const yaw=livenessResults.map(result=>{
        const faces=result.face||[];
        return faces.length===1&&typeof faces[0].rotation?.angle?.yaw==='number'
          ?faces[0].rotation!.angle!.yaw!:null;
      });
      if(yaw.some(value=>value===null))
        return await failAttempt('A captura guiada precisa mostrar exatamente um rosto em todos os quadros. Nenhum acesso foi liberado.',422);
      const angles=yaw as number[];
      const baseline=Math.abs(angles[0]);
      const firstTurn=angles[1],secondTurn=angles[2],returned=Math.abs(angles[3]);
      if(baseline>0.28||returned>0.28||Math.abs(firstTurn)<0.18||Math.abs(secondTurn)<0.18||Math.sign(firstTurn)===Math.sign(secondTurn))
        return await failAttempt('Os movimentos não foram confirmados em sequência pelo servidor. Repita a captura guiada com boa iluminação e vire a cabeça para os dois lados.',422);
      // The requested order is randomly selected and single-use. This validation
      // checks opposite head turns, front-facing start/end, and the same account;
      // it is not proof of presentation attack resistance or issuer authenticity.
      // This is a liveness signal, not issuer-level document authenticity.
    }finally{
      for(const item of livenessTensors){item.tensor?.dispose?.();item.data?.fill(0);item.pixels?.fill(0);}
      for(const result of livenessResults)for(const face of result.face||[]){face.embedding?.fill(0);face.tensor?.dispose?.();}
      for(const frame of livenessPixels)frame.data.fill(0);
    }
    // Persist only the platform's final verdict and a coarse age band. Never
    // persist the date of birth, source images, QR payload, face embeddings, or OCR.
    // This is Conecta's own automated validation, not issuer/government certification.
    const verifiedAt=new Date().toISOString();
    const evidenceReferenceHash=createHash('sha256')
      .update(context.user.id,'utf8').update(':','utf8')
      .update(livenessChallenge,'utf8').update(':','utf8')
      .update(ageBand,'utf8').update(':','utf8')
      .update(verifiedAt,'utf8').digest('hex');
    const {error:verdictError}=await context.admin.rpc('complete_conecta_free_identity_verification',{
      p_user_id:context.user.id,
      p_age_band:ageBand,
      p_evidence_reference_hash:evidenceReferenceHash,
      p_verified_at:verifiedAt
    });
    if(verdictError)
      return await failAttempt('As verificações passaram, mas não foi possível registrar o resultado com segurança. A validação não foi concluída; tente novamente.',503);
    await completeAttempt();
    return NextResponse.json({
      ok:true,
      status:'approved',
      approved:true,
      ageBand,
      verifiedAt,
      documentStored:false,
      officialIssuerVerified:false,
      message:'Validação Conecta ID concluída. Documento, comparação facial e captura guiada passaram nas verificações automáticas disponíveis. O Conecta registrou a identidade e apenas a faixa etária; não armazenou as imagens nem a data de nascimento. Isto não é uma certificação oficial do emissor. As regras de responsável e proteção da faixa etária continuam valendo.'
    },{status:200,headers});
  }catch(error){
    return await failAttempt(error instanceof Error?error.message:'Não foi possível concluir a análise. Nenhum acesso foi liberado.',503);
  }finally{
    documentTensor?.dispose?.();selfieTensor?.dispose?.();
    for(const result of [documentFaceResults,selfieFaceResults])for(const face of result?.face||[]){face.embedding?.fill(0);face.tensor?.dispose?.();}
    for(const image of ocrImages)image.fill(0);
    if(worker)await worker.terminate().catch(()=>undefined);
    // Best-effort release of in-memory references; no raw image is persisted.
    document.fill(0);back.fill(0);rgDataSide.fill(0);rgPhotoSide.fill(0);selfie.fill(0);for(const frame of livenessFrames)frame.fill(0);documentPixels?.fill(0);selfiePixels?.fill(0);documentTensorData?.fill(0);selfieTensorData?.fill(0);qr='';
  }
}
