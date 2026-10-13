import {NextRequest,NextResponse} from 'next/server';
import {identityUserContext,runtimeConfig} from '@/lib/identity-server';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const headers={'Cache-Control':'private, no-store, max-age=0'};

/**
 * Reports implementation readiness, not identity approval.
 * Local OCR, QR preflight and camera liveness are signals only; none grants
 * verified identity, verified age, or adult privileges. gov.br is not a
 * general-purpose login API for private social networks.
 */
export async function GET(request:NextRequest){
  const context=await identityUserContext(request);
  if(!context)return NextResponse.json({error:'Entre na sua conta para consultar os métodos.'},{status:401,headers});

  const supabaseReady=Boolean(runtimeConfig.supabaseUrl&&runtimeConfig.publicKey);
  const govbrIntegrityFlowReady=supabaseReady;
  const personaConfigured=Boolean(runtimeConfig.providerApiKey&&runtimeConfig.inquiryTemplate&&runtimeConfig.serviceKey);

  return NextResponse.json({
    policyVersion:'identity-methods-v1',
    identityVerified:false,
    ageVerified:false,
    grantsAdultPrivileges:false,
    methods:[
      {
        id:'local-document-preflight',
        label:'Leitura local do documento',
        cost:'free',
        status:'available',
        verifiesIdentity:false,
        verifiesAge:false,
        details:'OCR/QR local identifica inconsistências preliminares; não comprova autenticidade nem titularidade.'
      },
      {
        id:'camera-liveness-preflight',
        label:'Verificação de presença pela câmera',
        cost:'free',
        status:'available',
        verifiesIdentity:false,
        verifiesAge:false,
        details:'Desafio de movimento ajuda a detectar captura estática, mas não é prova oficial de identidade.'
      },
      {
        id:'govbr-signed-document',
        label:'Conferência de documento assinado',
        cost:'free',
        status:govbrIntegrityFlowReady?'available':'configuration_required',
        verifiesIdentity:false,
        verifiesAge:false,
        details:'Confere integridade/assinatura e vínculo com o desafio do Conecta quando aplicável. Não equivale a autenticação gov.br nem a validação oficial de idade.'
      },
      {
        id:'external-identity-provider',
        label:'Prestador externo de verificação',
        cost:'provider_billed',
        status:personaConfigured?'configured_requires_cost_disclosure':'not_configured',
        verifiesIdentity:false,
        verifiesAge:false,
        details:'Não inicia cobrança nem aprova a conta por este endpoint. Só deve ser habilitado após contrato, preço real por tentativa, consentimento e webhook autenticado.'
      }
    ],
    notice:'Nenhum método listado concede selo oficial ou libera recursos restritos. A decisão permanece pendente até existir verificação oficial adequada e validada.'
  },{headers});
}
