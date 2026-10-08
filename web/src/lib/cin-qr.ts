/**
 * Local, EXPERIMENTAL reader of CIN JWT/JWS QR values.
 * Based on the documented ES512/P-521 format in the MIT-licensed project
 * https://github.com/helviojunior/digital-document-checker
 * The PROD public key was transcribed from its experimental cin_keys.json.
 * Key provenance, revocation and live document status are NOT independently verified.
 * Do not use this code to grant identity/age privileges or store personal information.
 */
export type CinPreflightStatus='signature-valid-local'|'signature-invalid'|'unsupported'|'expired'|'invalid-data'|'unavailable';
export type CinPreflight={
 status:CinPreflightStatus;
 message:string;
 indicativeAgeBand?:'under_13'|'13_15'|'16_17'|'18_plus';
};
type Jwk=JsonWebKey;
const CIN_PROD_KEY:Jwk={
 kty:'EC',crv:'P-521',
 x:'ADmN2eus6YfvziHBVuc6cKlzWQ4w_hz1sU0c4qYxFFpNVnEw_d6PO_QVl0OQxMo7WxC0okYDqCVtEl9yoRUA3RLK',
 y:'AFc1lVJVmpLHNNnqXUmFToa6u2l9c_eOOdF6TqAj7chdGtKyqJQAFTWBzVrDQzUj7A4gWE8O3-q-sMm3EnQR3v7O',
 ext:true
};
const MAX_TOKEN=8192;
const fail=(status:CinPreflightStatus,message:string):CinPreflight=>({status,message});
function b64urlBytes(value:string):Uint8Array{
 if(!/^[A-Za-z0-9_-]+$/.test(value))throw new Error('Base64URL inválido.');
 const padded=value.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((value.length+3)%4);
 const binary=atob(padded);
 const bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return bytes;
}
function decodeJson(segment:string):Record<string,unknown>{
 if(segment.length>5000)throw new Error('Seção do código muito longa.');
 const raw=new TextDecoder().decode(b64urlBytes(segment));
 const obj=JSON.parse(raw) as unknown;
 if(!obj || typeof obj!=='object'||Array.isArray(obj))throw new Error('Estrutura do código inválida.');
 return obj as Record<string,unknown>;
}
function dateBR(value:unknown):Date|null{
 if(typeof value!=='string'||!/^\d{2}\/\d{2}\/\d{4}$/.test(value))return null;
 const [day,month,year]=value.split('/').map(Number);
 const date=new Date(Date.UTC(year,month-1,day,12));
 return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?date:null;
}
function ageAt(birth:Date,now:Date):number{
 let age=now.getUTCFullYear()-birth.getUTCFullYear();
 const m=now.getUTCMonth()-birth.getUTCMonth();
 if(m<0||(m===0&&now.getUTCDate()<birth.getUTCDate()))age--;
 return age;
}
function validCpf(cpf:unknown):boolean{
 if(typeof cpf!=='string'||!/^\d{11}$/.test(cpf)||/^(\d)\1{10}$/.test(cpf))return false;
 const digits=[...cpf].map(Number);
 for(let pos=9;pos<=10;pos++){
  const weight=pos+1;
  const sum=digits.slice(0,pos).reduce((s,d,i)=>s+d*(weight-i),0);
  const n=(sum*10)%11;
  if(digits[pos]!== (n===10?0:n))return false;
 }
 return true;
}
function uuidAtTrustedHost(text:unknown):boolean{
 if(typeof text!=='string'||text.length>300)return false;
 try{
  const u=new URL(text);
  return u.protocol==='https:'&&u.hostname==='cin.mj.gov.br' &&
   /^\/cidadao\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u.pathname)
   && !u.search && !u.hash;
 }catch{return false;}
}
/**
 * This is cryptographic inspection, NOT validation against the active government
 * registry or proof that the person holds the CIN. The input is never retained.
 */
export async function inspectCinToken(raw:string,now=new Date()):Promise<CinPreflight>{
 return inspectCinWithKey(raw,CIN_PROD_KEY,now);
}
/** Public for deterministic cryptographic regression tests with ephemeral keys only. */
export async function inspectCinWithKey(raw:string,trustedKey:Jwk,now=new Date()):Promise<CinPreflight>{
 if(typeof raw!=='string'||raw.length>MAX_TOKEN||raw.length<100)
  return fail('unsupported','QR Code não reconhecido como CIN no formato esperado.');
 const parts=raw.trim().split('.');
 if(parts.length!==3 || parts.some(p=>p.length===0))return fail('unsupported','O QR Code não é um token CIN compatível.');
 let header:Record<string,unknown>,payload:Record<string,unknown>,signature:Uint8Array;
 try{header=decodeJson(parts[0]);payload=decodeJson(parts[1]);signature=b64urlBytes(parts[2]);}
 catch{return fail('invalid-data','Não foi possível interpretar o QR Code da CIN.');}
 if(header.alg!=='ES512'||header.typ&&header.typ!=='JWT' || header.crit!==undefined)
  return fail('unsupported','Algoritmo de assinatura não suportado. Use o aplicativo oficial.');
 if(signature.length!==132)return fail('signature-invalid','Formato de assinatura inválido.');
 if(!globalThis.crypto?.subtle)
  return fail('unavailable','Este navegador não oferece verificação criptográfica. Use HTTPS e um navegador atualizado.');
 try{
  const key=await crypto.subtle.importKey('jwk',trustedKey,{name:'ECDSA',namedCurve:'P-521'},false,['verify']);
  const bytes=new TextEncoder().encode(parts[0]+'.'+parts[1]);
  const valid=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-512'},key,signature as BufferSource,bytes);
  if(!valid)return fail('signature-invalid','A assinatura não corresponde à chave pública experimental conhecida.');
 }catch{
  return fail('unavailable','Não foi possível executar a verificação criptográfica neste navegador.');
 }
 if(payload.iss!=='MJSP'||!validCpf(payload.cpf)||!uuidAtTrustedHost(payload.url))
  return fail('invalid-data','O QR Code assinado não contém os campos obrigatórios esperados.');
 const dob=dateBR(payload.dns);
 if(!dob)return fail('invalid-data','Data de nascimento ausente ou inválida no QR Code.');
 const age=ageAt(dob,now);
 if(age<0||age>125)return fail('invalid-data','Data de nascimento fora dos limites possíveis.');
 if(payload.dvd!==undefined){
  const expiry=dateBR(payload.dvd);
  if(!expiry)return fail('invalid-data','Data de validade em formato inesperado.');
  if(expiry.getTime()+12*60*60*1000<now.getTime())
   return fail('expired','A data de validade declarada no QR Code já passou. Consulte o aplicativo oficial.');
 }
 const indicativeAgeBand=age<13?'under_13':age<16?'13_15':age<18?'16_17':'18_plus';
 return {
  status:'signature-valid-local',indicativeAgeBand,
  message:'Assinatura local compatível com a chave pública experimental e dados coerentes. Ainda falta confirmar validade oficial e titularidade.'
 };
}
