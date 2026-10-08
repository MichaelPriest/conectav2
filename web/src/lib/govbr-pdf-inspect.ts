import 'server-only';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {PDFDocument} from 'pdf-lib';

const execAsync=promisify(execFile);
export type PdfInspection={
 status:'integrity_checked'|'unsigned'|'invalid_signature'|'incomplete_coverage'|'unavailable'|'challenge_mismatch'|'unreadable';
 detail:string;
};
/**
 * Verify detached CMS signing cryptographically with system OpenSSL.
 * "-noverify" deliberately DOES NOT verify certificate chain, gov.br issuer,
 * revocation or age. A valid self-signed signature has equal crypto integrity.
 * It is NEVER a government authentication or identity/age grant.
 */
export async function inspectSignedStatement(pdf:Buffer,subject:string):Promise<PdfInspection>{
 if(pdf.length<100||pdf.length>6*1024*1024||pdf.subarray(0,5).toString('ascii')!=='%PDF-')
  return {status:'unreadable',detail:'Arquivo PDF invalido ou acima de 6 MB.'};
 const raw=pdf.toString('latin1');
 const regex=/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
 const ranges=[...raw.matchAll(regex)];
 if(ranges.length===0)return {status:'unsigned',detail:'Nenhuma assinatura PDF com ByteRange encontrada.'};
 if(ranges.length!==1)return {status:'unavailable',detail:'Documento com varias assinaturas: confira no VALIDAR oficial.'};
 const [a,b,c,d]=ranges[0].slice(1).map(Number);
 if(![a,b,c,d].every(Number.isSafeInteger)||a!==0||b<100||c<=b||d<0||c+d>pdf.length)
  return {status:'invalid_signature',detail:'Intervalos de assinatura digital invalidos.'};
 if(c+d!==pdf.length)
  return {status:'incomplete_coverage',detail:'Existem alteracoes ou revisoes apos a assinatura. Valide oficialmente.'};
 const gap=pdf.subarray(b,c).toString('latin1').trim();
 const contents=gap.match(/^<([0-9a-fA-F\s]+)>$/);
 if(!contents)return {status:'invalid_signature',detail:'Conteudo CMS da assinatura nao encontrado.'};
 const hex=contents[1].replace(/\s/g,'');
 if(hex.length===0||hex.length%2!==0)return {status:'invalid_signature',detail:'Assinatura CMS malformada.'};
 const full=Buffer.from(hex,'hex');
 const der=derLength(full);
 if(!der)return {status:'invalid_signature',detail:'Assinatura ASN.1 malformada.'};
 const cms=full.subarray(0,der);
 const signed=Buffer.concat([pdf.subarray(a,a+b),pdf.subarray(c,c+d)]);
 let meta:PDFDocument;
 try{
  meta=await PDFDocument.load(pdf,{updateMetadata:false,ignoreEncryption:false});
 }catch{return {status:'unreadable',detail:'Nao foi possivel ler os metadados do PDF assinado.'};}
 if(meta.getSubject()!==subject)return {status:'challenge_mismatch',detail:'Codigo de desafio nao corresponde ao PDF emitido pelo Conecta.'};
 const temp=await mkdtemp(path.join(tmpdir(),'conecta-id-'));
 try{
  await writeFile(path.join(temp,'cms.der'),cms,{mode:0o600});
  await writeFile(path.join(temp,'signed.bin'),signed,{mode:0o600});
  try{
   await execAsync('openssl',[
     'cms','-verify','-inform','DER','-binary','-noverify',
     '-in',path.join(temp,'cms.der'),'-content',path.join(temp,'signed.bin'),
     '-out',path.join(temp,'verified.bin')
   ],{timeout:12000,maxBuffer:65536,windowsHide:true});
   return {status:'integrity_checked',
    detail:'A assinatura CMS confere com os bytes assinados. A autoria gov.br, a cadeia de certificados, a revogacao e a idade NAO foram confirmadas. Confira no VALIDAR oficial.'};
  }catch(err){
   if(err instanceof Error && /ENOENT|ETIMEDOUT|killed/i.test(err.message))
    return {status:'unavailable',detail:'Verificador OpenSSL nao disponivel. Confira o documento pelo VALIDAR.'};
   return {status:'invalid_signature',detail:'A verificacao criptografica nao confirmou a integridade. Confira no VALIDAR.'};
  }
 }finally{await rm(temp,{recursive:true,force:true});}
}
function derLength(data:Buffer):number|null{
 if(data.length<3||data[0]!==0x30)return null;
 const lead=data[1];let length=0,start=2;
 if(lead<128)length=lead;
 else{
  const size=lead&127;
  if(size<1||size>4||2+size>data.length)return null;
  for(let i=0;i<size;i++)length=length*256+data[2+i];
  start+=size;
 }
 const total=start+length;
 return total>start&&total<=data.length?total:null;
}
