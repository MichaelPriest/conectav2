import {NextRequest,NextResponse} from 'next/server';
import {identityUserContext} from '@/lib/identity-server';
import {isTrustedIdentityOrigin} from '@/lib/identity-origin';
import {inspectCinToken} from '@/lib/cin-qr';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0'};
const fail=(message:string,status:number)=>NextResponse.json({error:message},{status,headers});

/**
 * Server-side cryptographic preflight for a CIN QR/JWS.
 * This does not call the government's online validation service, prove the
 * presenter is the document holder, or grant identity/age privileges.
 * The token is processed in memory only and must never be logged or stored.
 */
export async function POST(request:NextRequest){
 if(!isTrustedIdentityOrigin(request.headers,request.url,process.env))return fail('Origem inválida.',403);
 const context=await identityUserContext(request);
 if(!context)return fail('Entre na sua conta para continuar.',401);

 let body:unknown;
 try{body=await request.json();}catch{return fail('Envie um JSON válido.',400);}
 if(!body||typeof body!=='object'||Array.isArray(body))return fail('Formato inválido.',400);
 const token=(body as {token?:unknown}).token;
 if(typeof token!=='string'||token.length<100||token.length>8192)return fail('QR Code ausente ou fora do limite permitido.',400);

 const result=await inspectCinToken(token);
 // Do not echo or persist the QR token, CPF, birth date, or raw claims.
 return NextResponse.json({
   status:result.status,
   message:result.message,
   indicativeAgeBand:result.indicativeAgeBand??null,
   validationLevel:'local-cryptographic-preflight',
   issuerSignatureChecked:result.status==='signature-valid-local',
   officialCurrentValidityChecked:false,
   holderMatchChecked:false,
   identityVerified:false,
   ageVerified:false,
   grantsAdultPrivileges:false,
   documentStored:false
 },{headers});
}
