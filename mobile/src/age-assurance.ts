import {Platform} from 'react-native';
import {requireNativeModule} from 'expo-modules-core';

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
