import 'server-only';
import {randomBytes,createHash} from 'node:crypto';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';

export const MAX_SIGNED_PDF_BYTES=6*1024*1024;
export const SIGNATURE_CHALLENGE_HOURS=24;
export function newNonce():string{
 return randomBytes(24).toString('hex').toUpperCase();
}
export function challengeMarker(id:string,nonce:string):string{
 return 'CONECTA-ID-GOVBR:'+id+':'+nonce;
}
export async function generateStatementPdf(id:string,nonce:string,expiresAt:string):Promise<Uint8Array>{
 const pdf=await PDFDocument.create();
 pdf.setTitle('Conecta ID - Declaracao para assinatura gov.br');
 pdf.setSubject(challengeMarker(id,nonce));
 pdf.setCreator('Conecta ID');
 pdf.setProducer('Conecta ID');
 const p=pdf.addPage([595.28,841.89]);
 const normal=await pdf.embedFont(StandardFonts.Helvetica);
 const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const ink=rgb(.15,.17,.28), grey=rgb(.37,.40,.49);
 p.drawRectangle({x:0,y:772,width:595.28,height:70,color:rgb(.93,.91,1)});
 p.drawText('Conecta ID | Declaracao de controle de conta',{x:42,y:810,font:bold,size:17,color:ink});
 p.drawText('Documento individual para assinatura eletronica externa',{x:42,y:786,font:normal,size:10,color:grey});
 const lines=[
  'Esta declaracao foi gerada pelo Conecta para verificar a assinatura de um',
  'documento com desafio individual. Ao assinar, declaro que estou',
  'solicitando uma analise de autenticidade de assinatura para minha conta.',
  '',
  'O Conecta NAO solicita sua senha gov.br. A assinatura deve ser feita',
  'exclusivamente no site oficial de assinatura do governo brasileiro.',
  '',
  'Este documento nao certifica idade, identidade civil ou situacao da CIN.',
  'A integridade criptografica sera analisada separadamente da cadeia de',
  'confianca do signatario, da titularidade e da idade.',
  '',
  'Identificador da solicitacao:',
  id,
  '',
  'Codigo unico de desafio:',
  nonce,
  '',
  'Valido para envio ate (UTC):',
  expiresAt.replace('T',' ').replace('Z',' UTC')
 ];
 let y=732;
 for(const line of lines){
  p.drawText(line,{x:46,y,font:line===nonce||line===id?bold:normal,size:line===nonce?13:11,color:ink});
  y-=line===''?12:25;
 }
 p.drawLine({start:{x:46,y:200},end:{x:550,y:200},thickness:1,color:rgb(.8,.8,.87)});
 p.drawText('Assine ESTE PDF pelo https://assinador.iti.br e salve o arquivo assinado.',{x:46,y:179,font:bold,size:9,color:ink});
 p.drawText('Confira a assinatura oficial no https://validar.iti.gov.br.',{x:46,y:160,font:normal,size:9,color:grey});
 p.drawText('Retorne ao Conecta ID e envie o PDF assinado. Nenhum documento sera armazenado.',{x:46,y:143,font:normal,size:9,color:grey});
 return pdf.save({useObjectStreams:false,updateFieldAppearances:false});
}
export function pdfHash(buffer:Buffer):string{
 return createHash('sha256').update(buffer).digest('hex');
}
