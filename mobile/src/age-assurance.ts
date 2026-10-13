import {Platform} from 'react-native';
import {requireNativeModule} from 'expo-modules-core';
import {CryptoDigestAlgorithm,CryptoEncoding,digestStringAsync} from 'expo-crypto';
import {API_SITE_URL,supabase} from './supabase';

export type PlayAgeSignalResult = {
  status: 'shared' | 'not_shared' | 'verification_required' | 'unavailable' | 'unknown' | 'error';
  ageLower?: number | null;
  ageUpper?: number | null;
  ageRangeSource?: string | number | null;
  significantChangeApprovalDate?: number | null;
  reason?: string;
};

type NativeAgeSignalsModule = {
  requestAgeSignals(): Promise<PlayAgeSignalResult>;
  requestIntegrityToken(requestHash: string, cloudProjectNumber: number): Promise<{
    status: 'ok' | 'unavailable' | 'invalid_request' | 'error';
    integrityToken?: string;
    reason?: string;
  }>;
};

/**
 * Reads the OS/store-provided age band on Android only.
 * This is a local preflight signal: never upload it as a trusted decision or
 * unlock adult-only features until a server-side integrity/attestation flow
 * validates its provenance and binds it to the authenticated account.
 */
export async function requestPlayAgeSignals(): Promise<PlayAgeSignalResult> {
  if (Platform.OS !== 'android') return {status: 'unavailable', reason: 'android_only'};
  try {
    const nativeModule = requireNativeModule<NativeAgeSignalsModule>('ConectaPlayAgeSignals');
    return await nativeModule.requestAgeSignals();
  } catch {
    // Expo Go, an older installed binary, or a build without the native module.
    return {status: 'unavailable', reason: 'native_module_unavailable'};
  }
}


export type AgeSignalSubmissionResult = {
  status: 'verified' | 'preflight_only' | 'unavailable' | 'rejected' | 'unauthorized';
  message: string;
  ageBand?: string;
};

/**
 * Explicitly submits a shared Play age signal together with a request-hash-bound
 * Integrity token. Only the server may persist a decision; failures never fall
 * back to client-side approval.
 */
export async function submitPlayAgeSignal(signal: PlayAgeSignalResult): Promise<AgeSignalSubmissionResult> {
  if (signal.status !== 'shared' || typeof signal.ageLower !== 'number' ||
      typeof signal.ageRangeSource !== 'string') {
    return {status: 'preflight_only', message: 'Não há um sinal compartilhado utilizável. As proteções padrão permanecem ativas.'};
  }
  if (!['TIER_B', 'TIER_C', 'TIER_D'].includes(signal.ageRangeSource)) {
    return {status: 'preflight_only', message: 'A origem do sinal não é suficiente para registrar uma decisão confiável. As proteções padrão permanecem ativas.'};
  }

  const {data:{session}} = await supabase.auth.getSession();
  if (!session?.access_token) return {status: 'unauthorized', message: 'Entre novamente na sua conta para continuar.'};

  const payload = {
    ageLower: signal.ageLower,
    ageUpper: typeof signal.ageUpper === 'number' ? signal.ageUpper : null,
    ageRangeSource: signal.ageRangeSource,
    significantChangeApprovalDate: typeof signal.significantChangeApprovalDate === 'number'
      ? signal.significantChangeApprovalDate
      : null
  };
  const headers = {
    Authorization: 'Bearer ' + session.access_token,
    'Content-Type': 'application/json'
  };

  try {
    const challengeResponse = await fetch(API_SITE_URL + '/api/identity/age-signal/challenge', {
      method: 'POST', headers
    });
    if (!challengeResponse.ok) {
      return {status: 'unavailable', message: 'O servidor não conseguiu iniciar a validação segura. As proteções padrão permanecem ativas.'};
    }
    const challengeBody = await challengeResponse.json() as {challenge?: string};
    if (!challengeBody.challenge || !/^[0-9a-f]{64}$/.test(challengeBody.challenge)) {
      return {status: 'unavailable', message: 'O servidor retornou um desafio inválido. As proteções padrão permanecem ativas.'};
    }

    const canonical = [
      'conecta-age-v1',
      challengeBody.challenge,
      String(payload.ageLower),
      payload.ageUpper === null ? 'null' : String(payload.ageUpper),
      payload.ageRangeSource,
      payload.significantChangeApprovalDate === null
        ? 'null'
        : String(payload.significantChangeApprovalDate)
    ].join('|');
    const requestHash = await digestStringAsync(CryptoDigestAlgorithm.SHA256, canonical, {encoding: CryptoEncoding.HEX});
    const integrity = await requestPlayIntegrityToken(requestHash);
    if (integrity.status !== 'ok' || !integrity.integrityToken) {
      return {status: 'unavailable', message: 'A integridade do aplicativo não pôde ser confirmada. As proteções padrão permanecem ativas.'};
    }

    const verifyResponse = await fetch(API_SITE_URL + '/api/identity/age-signal/verify', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        challenge: challengeBody.challenge,
        integrityToken: integrity.integrityToken,
        ...payload
      })
    });
    const verifyBody = await verifyResponse.json() as {
      status?: string;
      message?: string;
      error?: string;
      ageBand?: string;
    };
    if (verifyResponse.ok && verifyBody.status === 'verified') {
      return {status: 'verified', message: verifyBody.message || 'Sinal validado no servidor.', ageBand: verifyBody.ageBand};
    }
    if (verifyBody.status === 'preflight_only') {
      return {status: 'preflight_only', message: verifyBody.message || 'O sinal não pôde ser aceito como decisão confiável.'};
    }
    return {
      status: verifyResponse.status === 401 ? 'unauthorized' :
        verifyResponse.status >= 500 ? 'unavailable' : 'rejected',
      message: verifyBody.error || 'A validação não foi concluída. As proteções padrão permanecem ativas.'
    };
  } catch {
    return {status: 'unavailable', message: 'A validação segura está temporariamente indisponível. As proteções padrão permanecem ativas.'};
  }
}

function describeSource(source: PlayAgeSignalResult['ageRangeSource']): string {
  switch (source) {
    case 'TIER_A': return 'origem declarada pelo próprio usuário (não comprova maioridade)';
    case 'TIER_B': return 'faixa gerenciada por responsável no Google';
    case 'TIER_C': return 'idade avaliada por método do Google Play';
    case 'TIER_D': return 'documento oficial com selfie ou identidade digital, segundo o Google Play';
    default: return 'origem não identificada';
  }
}


/**
 * Requests a Play Integrity token bound to a SHA-256 request hash. The token
 * must be decoded and checked on the server; never treat this client result as
 * verification and never log/store the token.
 */
export async function requestPlayIntegrityToken(requestHash: string): Promise<{
  status: 'ok' | 'unavailable' | 'invalid_request' | 'error';
  integrityToken?: string;
  reason?: string;
}> {
  if (Platform.OS !== 'android') return {status: 'unavailable', reason: 'android_only'};
  if (!/^[0-9a-f]{64}$/i.test(requestHash)) return {status: 'invalid_request'};
  const projectNumber = Number(process.env.EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT_NUMBER);
  if (!Number.isSafeInteger(projectNumber) || projectNumber <= 0) {
    return {status: 'unavailable', reason: 'google_cloud_project_not_configured'};
  }
  try {
    const nativeModule = requireNativeModule<NativeAgeSignalsModule>('ConectaPlayAgeSignals');
    return await nativeModule.requestIntegrityToken(requestHash, projectNumber);
  } catch {
    return {status: 'unavailable', reason: 'native_module_unavailable'};
  }
}

export function describePlayAgeSignal(result: PlayAgeSignalResult): string {
  switch (result.status) {
    case 'shared': {
      if (typeof result.ageLower !== 'number') {
        return 'O Google Play não forneceu uma faixa etária utilizável. Nenhuma permissão foi alterada.';
      }
      const band = typeof result.ageUpper === 'number'
        ? 'Faixa informada pelo Google Play: ' + result.ageLower + '–' + result.ageUpper + ' anos.'
        : 'Faixa informada pelo Google Play: ' + result.ageLower + '+ anos.';
      return band + '\nOrigem: ' + describeSource(result.ageRangeSource) + '.';
    }
    case 'not_shared':
      return 'A faixa etária não foi compartilhada. As proteções padrão permanecem ativas.';
    case 'verification_required':
      return 'O Google Play informa que é necessário resolver a situação de idade na Play Store. As proteções padrão permanecem ativas.';
    case 'unavailable':
      return 'A aferição do Google Play não está disponível nesta instalação. As proteções padrão permanecem ativas.';
    case 'error':
      return 'Não foi possível consultar o Google Play agora. As proteções padrão permanecem ativas.';
    default:
      return 'Não foi possível confirmar uma faixa etária. As proteções padrão permanecem ativas.';
  }
}
