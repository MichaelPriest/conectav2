import {createHash,randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createWorker} from 'tesseract.js';
import sharp from 'sharp';
import {identityContext} from '@/lib/identity-server';
import {isTrustedIdentityOrigin} from '@/lib/identity-origin';
import {inspectCinToken} from '@/lib/cin-qr';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

const headers={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache'};
const fail=(message:string,status:number)=>NextResponse.json({ok:false,message,documentStored:false},{status,headers});
const MAX_IMAGE_BYTES=8*1024*1024;
const allowedTypes=new Set(['image/jpeg','image/png','image/webp']);

type FaceResult={face?:Array<{embedding?:number[];faceScore?:number;boxScore?:number;real?:number}>};
async function imageBuffer(value:FormDataEntryValue|null,label:string):Promise<Buffer>{
  if(!(value instanceof File))throw new Error('Envie '+label+'.');
  if(!allowedTypes.has(value.type)||value.size<1||value.size>MAX_IMAGE_BYTES)
    throw new Error(label+' deve ser JPG, PNG ou WebP de até 8 MB.');
  return Buffer.from(await value.arrayBuffer());
}
async function pixels(buffer:Buffer){
  const result=await sharp(buffer,{limitInputPixels:20_000_000})
    .rotate().resize({width:1200,height:1200,fit:'inside',withoutEnlargement:true})
    .removeAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
  if(result.info.channels!==3)throw new Error('Não foi possível normalizar uma das imagens.');
  return {data:new Uint8Array(result.data),width:result.info.width,height:result.info.height};
}
function dobFromText(raw:string):string|null{
  const normalized=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  const label=/(?:NASCIMENTO|DATA\s+NASC|DT\.?\s*NASC)/g;
  const matches:string[]=[];
  for(const match of normalized.matchAll(label)){
    const index=(match.index||0)+match[0].length;
    const region=normalized.slice(index,index+90).split(/(?:EXPEDICAO|EMISSAO|VALIDADE|REGISTRO|CATEGORIA)/)[0];
    const dates=[...region.matchAll(/(?:^|[^\d])(\d{2}[./-]\d{2}[./-]\d{4})(?!\d)/g)];
    if(dates.length===1)matches.push(dates[0][1].replace(/[./]/g,'-'));
  }
  const unique=[...new Set(matches)];
  if(unique.length!==1)return null;
  const [day,month,year]=unique[0].split('-').map(Number);
  const date=new Date(Date.UTC(year,month-1,day));
  if(date.getUTCFullYear()!==year||date.getUTCMonth()+1!==month||date.getUTCDate()!==day||year<1900)return null;
  return [String(year),String(month).padStart(2,'0'),String(day).padStart(2,'0')].join('-');
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

  let document:Buffer|undefined,selfie:Buffer|undefined,qr:string,documentType:string;
  try{
    const form=await request.formData();
    if(form.get('consent')!=='true')return fail('É necessário consentir com o processamento temporário das imagens.',400);
    documentType=String(form.get('documentType')||'');
    if(!['cin','old-rg','cnh'].includes(documentType))return fail('Selecione CIN, RG antigo ou CNH.',400);
    document=await imageBuffer(form.get('documentFront'),'a frente do documento');
    selfie=await imageBuffer(form.get('selfie'),'a selfie');
    qr=String(form.get('qrPayload')||'');
    if(qr.length<8||qr.length>12000)return fail('Não foi possível ler um QR Code válido. Reposicione o verso do documento e tente novamente.',422);
  }catch(error){
    return fail(error instanceof Error?error.message:'Não foi possível ler os arquivos enviados.',400);
  }

  let worker:Awaited<ReturnType<typeof createWorker>>|null=null;
  let documentTensor:any=null,selfieTensor:any=null;
  let documentPixels:Uint8Array|undefined,selfiePixels:Uint8Array|undefined;
  try{
    const [docPixels,selfiePix]=await Promise.all([pixels(document),pixels(selfie)]);
    documentPixels=docPixels.data;selfiePixels=selfiePix.data;
    worker=await createWorker('por');
    const ocr=await worker.recognize(document);
    const ocrText=typeof ocr.data.text==='string'?ocr.data.text:'';
    const dob=dobFromText(ocrText);
    if(!dob)return fail('Não consegui ler uma única data de nascimento no documento. Melhore a iluminação e tente novamente.',422);
    const ageBand=bandForDate(dob);
    if(!ageBand)return fail('A data de nascimento lida não é válida.',422);
    if(ageBand==='0_12')return fail('Esta faixa etária precisa de um fluxo de responsável específico. A validação não foi concluída.',422);

    let qrAgeBand:string|null=null;
    if(documentType==='cin'){
      const cin=await inspectCinToken(qr);
      if(cin.status!=='signature-valid-local')
        return fail('A assinatura do QR Code da CIN não passou na verificação criptográfica disponível. Nenhum acesso foi liberado.',422);
      qrAgeBand=cin.indicativeAgeBand||ageBandFromCin(qr);
      if(qrAgeBand&&qrAgeBand!==ageBand)
        return fail('A faixa etária lida no QR Code diverge da data no documento.',422);
    }else{
      // RG/CNH formats vary by issuer. The server requires a decoded QR payload,
      // OCR-readable birth date, and matching holder face; it does not claim an
      // official or cryptographic issuer validation for these formats.
      const qrDob=qrDate(qr);
      if(qrDob&&qrDob!==dob)return fail('A data de nascimento do QR Code diverge da data impressa.',422);
    }

    // Human is executed on the server; browser-supplied face scores/descriptors
    // are never accepted. Uploaded originals stay in memory and are never logged.
    const module:any=await import('@vladmandic/human');
    const HumanClass=module.Human||module.default?.Human||module.default;
    if(typeof HumanClass!=='function')throw new Error('O mecanismo de comparação facial não está disponível no servidor.');
    const instance:any=new HumanClass({
      modelBasePath:'https://vladmandic.github.io/human-models/models/',
      debug:false,
      face:{enabled:true,detector:{rotation:true,return:true,maxDetected:4},mesh:{enabled:true},description:{enabled:true},antispoof:{enabled:true},liveness:{enabled:true}},
      body:{enabled:false},hand:{enabled:false},object:{enabled:false},gesture:{enabled:false}
    });
    await instance.load();
    documentTensor=instance.tf.tensor3d(docPixels.data,[docPixels.height,docPixels.width,3],'int32').expandDims(0);
    selfieTensor=instance.tf.tensor3d(selfiePix.data,[selfiePix.height,selfiePix.width,3],'int32').expandDims(0);
    const [docResult,selfieResult]=await Promise.all([instance.detect(documentTensor),instance.detect(selfieTensor)]);
    const docFaces=docResult.face||[],selfieFaces=selfieResult.face||[];
    if(docFaces.length!==1||selfieFaces.length!==1)
      return fail('Precisamos detectar exatamente um rosto na foto do documento e na selfie. Tente novamente com imagens nítidas.',422);
    const docFace=docFaces[0],selfieFace=selfieFaces[0];
    if(!docFace.embedding?.length||!selfieFace.embedding?.length)
      return fail('Não foi possível calcular a comparação facial. Tente com uma foto mais nítida.',422);
    const similarity=instance.match.similarity(docFace.embedding,selfieFace.embedding);
    if(!Number.isFinite(similarity)||similarity<0.62)
      return fail('A comparação facial não atingiu o nível mínimo. Confira se a selfie corresponde à foto do documento.',422);
    if(typeof selfieFace.real!=='number'||selfieFace.real<0.55)
      return fail('A análise antifraude da selfie ficou inconclusiva. Faça uma nova captura ao vivo, sem filtros.',422);

    const transactionId=randomUUID();
    const evidenceHash=createHash('sha256').update(context.user.id+':'+transactionId).digest('hex');
    const now=new Date().toISOString();
    const ageWrite=await context.admin.from('age_assurance_decisions').upsert({
      user_id:context.user.id,age_band:ageBand,method:'conecta_free_document_face',
      policy_version:'conecta-id-free-v1',evidence_reference_hash:evidenceHash,
      verified_at:now,updated_at:now
    },{onConflict:'user_id'});
    if(ageWrite.error)throw new Error('Não foi possível registrar a decisão de idade com segurança.');
    const identityWrite=await context.admin.from('identity_verifications').upsert({
      user_id:context.user.id,provider:'conecta_free',provider_inquiry_id:'conecta_'+transactionId,
      status:'approved',age_band:ageBand==='18_plus'?'18_plus':ageBand==='16_17'?'17':'13_to_16',
      guardian_status:ageBand==='18_plus'?'not_required':'pending',updated_at:now,verified_at:now
    },{onConflict:'user_id'});
    if(identityWrite.error){
      await context.admin.from('age_assurance_decisions').delete().eq('user_id',context.user.id).eq('evidence_reference_hash',evidenceHash);
      throw new Error('Não foi possível registrar a aprovação de identidade com segurança.');
    }
    // Explicitly release references to source bytes before responding. Nothing is
    // written to storage; only a coarse age band and opaque evidence hash persist.
    document.fill(0);selfie.fill(0);
    return NextResponse.json({
      ok:true,status:'approved',ageBand,documentType,faceMatch:true,
      qrChecked:true,ocrChecked:true,documentStored:false,imagesDiscarded:true,
      issuerSignatureChecked:documentType==='cin',officialValidityChecked:false,
      message:ageBand==='18_plus'
        ?'Verificação gratuita concluída. O acesso será atualizado pelo servidor.'
        :'Verificação concluída com proteção para menores. Associe um responsável verificado para liberar o acesso.'
    },{headers});
  }catch(error){
    return fail(error instanceof Error?error.message:'Não foi possível concluir a análise. Nenhum acesso foi liberado.',503);
  }finally{
    documentTensor?.dispose?.();selfieTensor?.dispose?.();
    if(worker)await worker.terminate().catch(()=>undefined);
    // Best-effort release of in-memory references; no raw image is persisted.
    document?.fill(0);selfie?.fill(0);documentPixels?.fill(0);selfiePixels?.fill(0);qr='';
  }
}
