import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import '@tensorflow/tfjs-node';
import {NextRequest,NextResponse} from 'next/server';
import {createWorker,PSM} from 'tesseract.js';
import sharp from 'sharp';
import {BinaryBitmap,HybridBinarizer,QRCodeReader,RGBLuminanceSource} from '@zxing/library';
import {identityContext,runtimeConfig} from '@/lib/identity-server';
import {isTrustedIdentityOrigin} from '@/lib/identity-origin';
import {inspectCinToken} from '@/lib/cin-qr';
import {extractBirthDateFromOcr} from '@/lib/legacy-rg-ocr';
import {recognizeWithPaddleOcr} from '@/lib/identity-paddle-ocr';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;

const headers={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache'};
type VerificationFailureCode =
  | 'payload_invalid' | 'document_qr_unreadable' | 'birth_date_unreadable'
  | 'face_count_invalid' | 'face_quality_low' | 'face_match_failed'
  | 'selfie_liveness_uncertain' | 'liveness_sequence_invalid'
  | 'document_data_mismatch' | 'verification_failed';
const fail=(message:string,status:number,code:VerificationFailureCode='verification_failed')=>
  NextResponse.json({ok:false,message,code,documentStored:false},{status,headers});
const MAX_IMAGE_BYTES=8*1024*1024;
const MAX_REQUEST_BYTES=25*1024*1024;
const allowedTypes=new Set(['image/jpeg','image/png','image/webp']);

type FaceResult={face?:Array<{embedding?:number[];faceScore?:number;boxScore?:number;box?:number[];real?:number;rotation?:{angle?:{yaw?:number}};tensor?:{dispose?:()=>void}}>};
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
async function faceFocusVariance(data:Uint8Array,width:number,height:number,box:number[]):Promise<number>{
  const [x,y,w,h]=box;
  const left=Math.max(0,Math.floor(x-w*0.18));
  const top=Math.max(0,Math.floor(y-h*0.18));
  const right=Math.min(width,Math.ceil(x+w*1.18));
  const bottom=Math.min(height,Math.ceil(y+h*1.18));
  if(right-left<16||bottom-top<16)return 0;
  const gray=await sharp(Buffer.from(data),{raw:{width,height,channels:3}})
    .extract({left,top,width:right-left,height:bottom-top})
    .resize(128,128,{fit:'fill'}).greyscale().raw().toBuffer();
  try{
    // Variance of the Laplacian is a coarse focus check, not a biometric score.
    // Keep the threshold deliberately low to avoid rejecting ordinary phone photos.
    let sum=0,sumSquares=0,count=0;
    for(let row=1;row<127;row++){
      for(let col=1;col<127;col++){
        const i=row*128+col;
        const laplacian=gray[i-1]+gray[i+1]+gray[i-128]+gray[i+128]-4*gray[i];
        sum+=laplacian;sumSquares+=laplacian*laplacian;count++;
      }
    }
    const mean=sum/count;
    return Math.max(0,sumSquares/count-mean*mean);
  }finally{gray.fill(0);}
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
    if(needsQuarterTurn)prepared=prepared.rotate(270);
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
  if(!runtimeConfig.supabaseUrl||!runtimeConfig.publicKey||!runtimeConfig.serviceKey)
    return fail('O serviço Conecta ID não está configurado no servidor. A validação não pode ser concluída.',503);
  const context=await identityContext(request);
  if(!context)return fail('Entre na sua conta para continuar.',401);
  let attemptId:number|null=null;
  const completeAttempt=async(failureCode:VerificationFailureCode|null=null)=>{
    if(attemptId===null)return;
    const id=attemptId;
    try{
      const {error}=await context.admin.from('identity_free_verification_attempts')
        .update({status:'completed',failure_code:failureCode}).eq('id',id).eq('user_id',context.user.id);
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
  const failAttempt=async(message:string,status:number,code:VerificationFailureCode='verification_failed')=>{
    // Validation failures count and retain only a coarse reason code; service failures do not.
    if(attemptId!==null){
      if(status>=500)await releaseAttempt();
      else await completeAttempt(code);
    }
    return fail(message,status,code);
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
    const code:VerificationFailureCode=message.includes('QR Code')?'document_qr_unreadable':'payload_invalid';
    return await failAttempt(message,status,code);
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
    // Prepare the same high-quality images for both engines. Tesseract is the
    // free first pass; a worker failure must not prevent the private PaddleOCR
    // fallback from reading the documents.
    ocrImages.push(await prepareOcrImage(document));
    ocrImages.push(await prepareOcrImage(back));
    let detectedDates:string[]=[];
    try{
      worker=await createWorker('por',1,{
        // Pin the worker entrypoint to the external package path. Vercel's bundler
        // cannot always infer Tesseract's relative worker lookup from __dirname.
        workerPath:path.join(process.cwd(),'node_modules','tesseract.js','src','worker-script','node','index.js'),
        cacheMethod:'write'
      });
      // First pass: high-resolution, sparse text on both sides of the ID.
      await worker.setParameters({
        tessedit_pageseg_mode:PSM.SPARSE_TEXT,
        preserve_interword_spaces:'1',
        user_defined_dpi:'300'
      });
      const ocrResults=await Promise.all(ocrImages.map(image=>worker!.recognize(image)));
      const parseDates=(results:typeof ocrResults)=>
        results.map(result=>dobFromText(typeof result.data.text==='string'?result.data.text:''))
          .filter((value):value is string=>Boolean(value));
      detectedDates=parseDates(ocrResults);
      if(detectedDates.length===0){
        await worker.setParameters({
          tessedit_pageseg_mode:PSM.SINGLE_BLOCK,
          preserve_interword_spaces:'1',
          user_defined_dpi:'300'
        });
        const fallbackResults=await Promise.all(ocrImages.map(image=>worker!.recognize(image)));
        detectedDates=parseDates(fallbackResults);
      }
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
    }catch{
      // Do not approve an unreadable document; only a configured PaddleOCR
      // service can produce a fallback date from the uploaded document image.
      detectedDates=[];
    }
    // Fallback: use private PaddleOCR only if all Tesseract attempts failed.
    // No dates are inferred or accepted from client fields; both OCR engines
    // pass through the same strict Portuguese DOB parser and mismatch policy.
    if(detectedDates.length===0){
      const paddleTexts=await recognizeWithPaddleOcr(ocrImages);
      if(paddleTexts)detectedDates=paddleTexts.map(text=>dobFromText(text))
        .filter((value):value is string=>Boolean(value));
    }
    const uniqueDates=[...new Set(detectedDates)];
    if(uniqueDates.length>1)
      return await failAttempt('As datas de nascimento lidas nas partes do documento divergem. Confira a frente e o verso do documento e tente novamente.',422,'document_data_mismatch');
    const dob=uniqueDates[0]||null;
    if(!dob)return await failAttempt('Não consegui ler uma única data de nascimento na frente nem no verso do documento. Melhore a iluminação, aproxime o documento e evite reflexos.',422,'birth_date_unreadable');
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
      // Every document, selfie and challenge frame is an independent image.
      // Human caches detector/descriptors across video frames by default. Reusing
      // those cached results here can make distinct head turns look identical.
      cacheSensitivity:0,
      skipAllowed:false,
      async:false,
      face:{
        enabled:true,skipFrames:0,skipTime:0,
        detector:{rotation:true,return:false,maxDetected:4,skipFrames:0,skipTime:0},
        mesh:{enabled:true,skipFrames:0,skipTime:0},
        attention:{enabled:false},
        iris:{enabled:false},
        description:{enabled:true,skipFrames:0,skipTime:0},
        emotion:{enabled:false},
        antispoof:{enabled:true,skipFrames:0,skipTime:0},
        liveness:{enabled:true,skipFrames:0,skipTime:0},
        gear:{enabled:false}
      },
      body:{enabled:false},hand:{enabled:false},object:{enabled:false},gesture:{enabled:false}
    });
    await instance.load();
    documentTensorData=new Int32Array(docPixels.data);selfieTensorData=new Int32Array(selfiePix.data);
    documentTensor=instance.tf.tensor4d(documentTensorData,[1,docPixels.height,docPixels.width,3],'int32');
    selfieTensor=instance.tf.tensor4d(selfieTensorData,[1,selfiePix.height,selfiePix.width,3],'int32');
    // A Human instance owns mutable model and detector state: NEVER infer two
    // unrelated images concurrently on the same instance.
    const docResult=await instance.detect(documentTensor);
    const selfieResult=await instance.detect(selfieTensor);
    documentFaceResults=docResult as FaceResult;selfieFaceResults=selfieResult as FaceResult;
    const docFaces=docResult.face||[],selfieFaces=selfieResult.face||[];
    if(docFaces.length!==1||selfieFaces.length!==1)
      return await failAttempt('Precisamos detectar exatamente um rosto na foto do documento e na selfie. Tente novamente com imagens nítidas.',422,'face_count_invalid');
    const detectedDocumentFace=docFaces[0],selfieFace=selfieFaces[0];
    if(!detectedDocumentFace.embedding?.length||!selfieFace.embedding?.length)
      return await failAttempt('Não foi possível calcular a comparação facial. Tente com uma foto mais nítida.',422,'face_quality_low');
    const documentBox=detectedDocumentFace.box;
    const selfieBox=selfieFace.box;
    if(!Array.isArray(documentBox)||documentBox.length<4||!Array.isArray(selfieBox)||selfieBox.length<4||
       documentBox[2]<28||documentBox[3]<28||selfieBox[2]<64||selfieBox[3]<64)
      return await failAttempt('O rosto está pequeno na imagem. Aproxime o documento e enquadre a selfie de frente, com boa iluminação.',422,'face_quality_low');
    const [documentFocus,selfieFocus]=await Promise.all([
      faceFocusVariance(docPixels.data,docPixels.width,docPixels.height,documentBox),
      faceFocusVariance(selfiePix.data,selfiePix.width,selfiePix.height,selfieBox)
    ]);
    if(documentFocus<4||selfieFocus<4)
      return await failAttempt('A foto do documento ou a selfie está desfocada. Limpe a câmera, evite reflexos e tente novamente com mais luz.',422,'face_quality_low');

    // The portrait on an ID card may occupy only a small fraction of the full
    // document image. Re-detect it from a padded, enlarged crop so its embedding
    // is computed from portrait pixels rather than the whole card at low scale.
    // This is a preprocessing improvement only: the same single-face and match
    // thresholds remain in force, and no client-provided scores are trusted.
    const faceBox=detectedDocumentFace.box;
    if(!Array.isArray(faceBox)||faceBox.length<4||faceBox.some(value=>!Number.isFinite(value)))
      return await failAttempt('Não foi possível localizar com segurança a foto do documento. Reposicione o documento e tente novamente.',422);
    const [faceX,faceY,faceW,faceH]=faceBox;
    const padX=Math.round(faceW*0.35),padY=Math.round(faceH*0.35);
    const cropLeft=Math.max(0,Math.floor(faceX-padX));
    const cropTop=Math.max(0,Math.floor(faceY-padY));
    const cropRight=Math.min(docPixels.width,Math.ceil(faceX+faceW+padX));
    const cropBottom=Math.min(docPixels.height,Math.ceil(faceY+faceH+padY));
    if(cropRight-cropLeft<24||cropBottom-cropTop<24)
      return await failAttempt('A foto do documento está pequena ou desfocada demais para comparar. Tente uma imagem mais nítida.',422);
    let portraitPixels:Buffer|undefined;
    let portraitTensor:any=null;
    let portraitTensorData:Int32Array|undefined;
    let portraitResult:FaceResult|undefined;
    let selfiePortraitPixels:Buffer|undefined;
    let selfiePortraitTensor:any=null;
    let selfiePortraitTensorData:Int32Array|undefined;
    let selfiePortraitResult:FaceResult|undefined;
    try{
      const faceBox=detectedDocumentFace.box;
      const selfieFaceBox=selfieBox;
      if(!Array.isArray(faceBox)||faceBox.length<4||faceBox.some(value=>!Number.isFinite(value))||
         !Array.isArray(selfieFaceBox)||selfieFaceBox.length<4||selfieFaceBox.some(value=>!Number.isFinite(value)))
        return await failAttempt('Não foi possível localizar com segurança os rostos para comparar. Reposicione o documento e enquadre a selfie novamente.',422,'face_quality_low');
      const makeCropBounds=(box:number[],width:number,height:number)=>{
        const [x,y,w,h]=box;
        const padX=Math.round(w*0.35),padY=Math.round(h*0.35);
        const left=Math.max(0,Math.floor(x-padX));
        const top=Math.max(0,Math.floor(y-padY));
        const right=Math.min(width,Math.ceil(x+w+padX));
        const bottom=Math.min(height,Math.ceil(y+h+padY));
        return {left,top,width:right-left,height:bottom-top};
      };
      const docBounds=makeCropBounds(faceBox,docPixels.width,docPixels.height);
      const selfieBounds=makeCropBounds(selfieFaceBox,selfiePix.width,selfiePix.height);
      if(docBounds.width<24||docBounds.height<24||selfieBounds.width<24||selfieBounds.height<24)
        return await failAttempt('A foto do documento ou a selfie está pequena demais para comparar. Tente imagens mais nítidas e enquadre o rosto de frente.',422,'face_quality_low');
      // Normalize both sides the same way. A face embedding taken from a whole
      // document/selfie can be dominated by surrounding pixels or lose detail;
      // compare the portrait crop against a matching crop of the live selfie.
      const cropOptions={width:512,height:512,fit:'contain' as const,background:{r:255,g:255,b:255}};
      portraitPixels=await sharp(Buffer.from(docPixels.data),{
        raw:{width:docPixels.width,height:docPixels.height,channels:3}
      }).extract(docBounds).resize(cropOptions).normalize().sharpen().raw().toBuffer();
      selfiePortraitPixels=await sharp(Buffer.from(selfiePix.data),{
        raw:{width:selfiePix.width,height:selfiePix.height,channels:3}
      }).extract(selfieBounds).resize(cropOptions).normalize().sharpen().raw().toBuffer();
      const portraitData=new Uint8Array(portraitPixels);
      const selfiePortraitData=new Uint8Array(selfiePortraitPixels);
      portraitTensorData=new Int32Array(portraitData);
      selfiePortraitTensorData=new Int32Array(selfiePortraitData);
      portraitTensor=instance.tf.tensor4d(portraitTensorData,[1,512,512,3],'int32');
      selfiePortraitTensor=instance.tf.tensor4d(selfiePortraitTensorData,[1,512,512,3],'int32');
      // Independent face crops must not race within the same Human instance.
      const portraitDetection=await instance.detect(portraitTensor);
      const selfiePortraitDetection=await instance.detect(selfiePortraitTensor);
      portraitResult=portraitDetection as FaceResult;
      selfiePortraitResult=selfiePortraitDetection as FaceResult;
      const portraitFaces=portraitDetection.face||[];
      const selfiePortraitFaces=selfiePortraitDetection.face||[];
      if(portraitFaces.length!==1||selfiePortraitFaces.length!==1||
         !portraitFaces[0].embedding?.length||!selfiePortraitFaces[0].embedding?.length)
        return await failAttempt('Não foi possível extrair os rostos com qualidade suficiente nas duas imagens. Enquadre o documento inteiro e tire uma selfie nítida, de frente e sem filtros.',422,'face_quality_low');
      const matchOptions={order:2,multiplier:25,min:0.2,max:0.8};
      const originalSimilarity=instance.match.similarity(
        detectedDocumentFace.embedding,selfieFace.embedding,matchOptions
      );
      const cropSimilarity=instance.match.similarity(
        portraitFaces[0].embedding,selfiePortraitFaces[0].embedding,matchOptions
      );
      // Keep the same decision threshold; crop-to-crop matching is more
      // comparable because both descriptors were generated from equivalent crops.
      if(!Number.isFinite(originalSimilarity)||!Number.isFinite(cropSimilarity)||cropSimilarity<0.55)
        return await failAttempt('A comparação facial não atingiu o nível mínimo. Confira se a selfie corresponde à foto do documento e use imagens nítidas.',422,'face_match_failed');
    }finally{
      portraitTensor?.dispose?.();
      selfiePortraitTensor?.dispose?.();
      portraitTensorData?.fill(0);
      selfiePortraitTensorData?.fill(0);
      portraitPixels?.fill(0);
      selfiePortraitPixels?.fill(0);
      for(const result of [portraitResult,selfiePortraitResult])
        for(const face of result?.face||[]){face.embedding?.fill(0);face.tensor?.dispose?.();}
    }
    if(typeof selfieFace.real!=='number'||selfieFace.real<0.55)
      return await failAttempt('A análise antifraude da selfie ficou inconclusiva. Faça uma nova captura ao vivo, sem filtros.',422,'selfie_liveness_uncertain');

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
      // The four challenge images must always receive fresh detections rather
      // than the cached face box/rotation of a previous frame.
      const yaw=livenessResults.map(result=>{
        const faces=result.face||[];
        return faces.length===1&&typeof faces[0].rotation?.angle?.yaw==='number'
          ?faces[0].rotation!.angle!.yaw!:null;
      });
      if(yaw.some(value=>value===null))
        return await failAttempt('A captura guiada precisa mostrar exatamente um rosto em todos os quadros. Nenhum acesso foi liberado.',422);
      // The person performing the head turns must ALSO be the person in the
      // uploaded selfie that matched the document. Otherwise somebody could
      // upload a third party selfie and use their own live face for the challenge.
      // Compare neutral frames (front-facing) only; rotated faces have less
      // reliable descriptors. Preserve the calibrated 0.55 similarity gate.
      const neutralFaces=[livenessResults[0]?.face?.[0],livenessResults[3]?.face?.[0]];
      const neutralMatchOptions={order:2,multiplier:25,min:0.2,max:0.8};
      for(const neutralFace of neutralFaces){
        if(!neutralFace?.embedding?.length)
          return await failAttempt('Não foi possível identificar o rosto na captura ao vivo. Posicione-se de frente para a câmera.',422,'face_quality_low');
        const neutralSimilarity=instance.match.similarity(
          selfieFace.embedding,neutralFace.embedding,neutralMatchOptions
        );
        if(!Number.isFinite(neutralSimilarity)||neutralSimilarity<0.55)
          return await failAttempt('O rosto capturado ao vivo não corresponde à selfie do documento. Refaça a captura com a própria pessoa titular.',422,'face_match_failed');
      }
      const angles=yaw as number[];
      const baseline=Math.abs(angles[0]);
      const firstTurn=angles[1],secondTurn=angles[2],returned=Math.abs(angles[3]);
      const firstDirection=firstTurn>0?'left':'right';
      const secondDirection=secondTurn>0?'left':'right';
      if(baseline>0.28||returned>0.28||Math.abs(firstTurn)<0.18||Math.abs(secondTurn)<0.18||
         firstDirection!==challengeTurnOrder[0]||secondDirection!==challengeTurnOrder[1])
        return await failAttempt('Os movimentos não seguiram a sequência solicitada. Repita a captura guiada e vire a cabeça para cada lado indicado na tela.',422,'liveness_sequence_invalid');
      // Human reports yaw in radians. In this model's camera coordinate system,
      // positive yaw corresponds to turning left; the randomized order is checked
      // against the server-stored, single-use challenge. This is a liveness signal,
      // not proof of presentation-attack resistance or issuer authenticity.
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
