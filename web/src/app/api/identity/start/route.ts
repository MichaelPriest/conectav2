import {NextRequest,NextResponse} from 'next/server';

export const runtime='nodejs';
export const dynamic='force-dynamic';

/**
 * Fail closed on the server, not only in the UI. Provider credentials do not
 * constitute price disclosure, user consent, or payment authorization. This
 * endpoint must remain disabled until a real, tested consent + billing flow
 * is implemented; it must not create provider inquiries in the meantime.
 */
export async function POST(_request:NextRequest){
  return NextResponse.json({
    error:'A verificação paga ainda não está habilitada: falta implementar e validar a divulgação do preço real, o consentimento explícito e a cobrança antes de criar uma consulta. Nenhuma cobrança ou consulta foi iniciada.',
    code:'IDENTITY_PROVIDER_BILLING_NOT_READY'
  },{status:503,headers:{'Cache-Control':'no-store'}});
}
