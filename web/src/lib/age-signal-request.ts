import {createHash} from 'node:crypto';

export type AgeSignalPayload = {
  ageLower: number;
  ageUpper: number | null;
  ageRangeSource: string;
  significantChangeApprovalDate: number | null;
};

export function canonicalAgeSignalRequest(challenge: string, payload: AgeSignalPayload): string {
  return [
    'conecta-age-v1',
    challenge,
    String(payload.ageLower),
    payload.ageUpper === null ? 'null' : String(payload.ageUpper),
    payload.ageRangeSource,
    payload.significantChangeApprovalDate === null
      ? 'null'
      : String(payload.significantChangeApprovalDate)
  ].join('|');
}

export function hashAgeSignalRequest(challenge: string, payload: AgeSignalPayload): string {
  return createHash('sha256').update(canonicalAgeSignalRequest(challenge, payload), 'utf8').digest('hex');
}
