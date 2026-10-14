import { randomUUID } from 'node:crypto';

/**
 * Minimal internal Conecta ID verdict.
 *
 * Call only from a server-side verification pipeline after evidence has actually
 * been validated. Client claims, CPF checksum validity, OCR output, face-age
 * estimates, and liveness alone are not trusted evidence.
 */
export type ConectaIdAgeBand = '0-12' | '13-15' | '16-17' | '18+';
export type ConectaIdMethod =
  | 'api_governamental'
  | 'biometria_facial'
  | 'cartao_credito'
  | 'cin_criptografica'
  | 'documento_assinado'
  | 'nenhum';

export type ConectaIdVerdict = {
  transacao_id: string;
  status_validacao: 'sucesso' | 'falha' | 'pendente_responsavel';
  resultado: {
    maior_de_idade: boolean;
    faixa_etaria: ConectaIdAgeBand | 'indeterminada';
    metodo_utilizado: ConectaIdMethod;
  };
  politica_dados: {
    dados_originais_deletados: boolean;
    rastreamento_comercial_permitido: false;
    publicidade_comportamental_permitida: false;
    protecoes_menor_obrigatorias: boolean;
    vinculo_responsavel_obrigatorio: boolean;
    conta_pode_ser_ativada: boolean;
  };
};

export type ConectaIdVerdictInput = {
  /** True only after a trusted server-side source cryptographically/officially confirms the result. */
  evidenceVerified: boolean;
  ageBand: ConectaIdAgeBand | null;
  method: ConectaIdMethod;
  /** True only after transient source files and biometric buffers are actually disposed. */
  originalsDeleted: boolean;
  /** True only after the guardian account is authenticated and the relationship is verified. */
  guardianAuthenticated: boolean;
};

/**
 * Produces the privacy-minimal decision payload. It never accepts or returns
 * CPF, date of birth, document claims, images, video, or biometric templates.
 * No client-provided age claim should ever be passed as evidenceVerified.
 */
export function buildConectaIdVerdict(input: ConectaIdVerdictInput): ConectaIdVerdict {
  const hasTrustedResult = input.evidenceVerified && input.ageBand !== null &&
    input.method !== 'nenhum';
  const under16 = input.ageBand === '0-12' || input.ageBand === '13-15';
  const guardianRequired = hasTrustedResult && under16;
  const guardianSatisfied = !guardianRequired || input.guardianAuthenticated;
  const privacySatisfied = input.originalsDeleted;

  let status: ConectaIdVerdict['status_validacao'] = 'falha';
  if (hasTrustedResult && privacySatisfied && guardianSatisfied) {
    status = 'sucesso';
  } else if (hasTrustedResult && privacySatisfied && guardianRequired && !input.guardianAuthenticated) {
    status = 'pendente_responsavel';
  }

  const canActivate = status === 'sucesso';
  const verified = hasTrustedResult && privacySatisfied;
  return {
    transacao_id: randomUUID(),
    status_validacao: status,
    resultado: {
      maior_de_idade: verified && input.ageBand === '18+',
      faixa_etaria: verified && input.ageBand ? input.ageBand : 'indeterminada',
      metodo_utilizado: hasTrustedResult ? input.method : 'nenhum'
    },
    politica_dados: {
      dados_originais_deletados: input.originalsDeleted,
      rastreamento_comercial_permitido: false,
      publicidade_comportamental_permitida: false,
      protecoes_menor_obrigatorias: !verified || input.ageBand !== '18+',
      vinculo_responsavel_obrigatorio: guardianRequired && !input.guardianAuthenticated,
      conta_pode_ser_ativada: canActivate
    }
  };
}
