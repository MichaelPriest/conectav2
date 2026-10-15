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
    policyVersion:'identity-methods-v2',
    firstReleaseDistribution:'sideloaded-apk-and-web',
    ageDecisionStatus:'pending',
    identityVerified:false,
    ageVerified:false,
    grantsAdultPrivileges:false,
    methods:[
      {
        id:'free-document-face',
        label:'Validação gratuita do Conecta (QR + OCR + face)',
        cost:'free',
        status:'free_server_verification',
        verifiesIdentity:true,
        verifiesAge:true,
        details:'Processamento no servidor após consentimento: QR legível, leitura da data de nascimento, comparação facial e análise antifraude. Não consulta base oficial e não garante validade atual do documento; formatos RG/CNH variam por emissor.'
      },
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
        id:'cin-server-signature-preflight',
        label:'Validação criptográfica da CIN no servidor',
        cost:'free',
        status:'available',
        verifiesIdentity:false,
        verifiesAge:false,
        details:'Confere a assinatura JWS da CIN no servidor usando a chave pública experimental já incorporada ao projeto. Não consulta validade atual no MJSP e não confirma que quem apresenta o documento é seu titular.'
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
        id:'google-play-age-signals',
        label:'Sinal etário do Google Play',
        cost:'no_per_check_fee',
        status:'deferred_first_release',
        verifiesIdentity:false,
        verifiesAge:false,
        details:'Não utilizado nesta primeira versão: o APK será distribuído fora da Google Play. Não é requisito de cadastro nem substituto para a validação de idade no APK instalado diretamente ou na web.'
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
    notice:'A validação gratuita própria do Conecta pode aprovar a conta quando todos os critérios no servidor são atendidos. Ela não é uma certificação governamental e não consulta a validade atual do documento. Os outros métodos desta lista continuam sendo pré-triagens.'
  },{headers});
}
