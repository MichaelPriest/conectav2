import {createHash} from 'node:crypto';

export type AgeSignalPayload = {
  ageLower: number;
  ageUpper: number | null;
  userStatus: number;
  mostRecentApprovalDate: number | null;
};

export function canonicalAgeSignalRequest(challenge: string, payload: AgeSignalPayload): string {
  return [
    'conecta-age-v1',
    challenge,
    String(payload.ageLower),
    payload.ageUpper === null ? 'null' : String(payload.ageUpper),
    String(payload.userStatus),
    payload.mostRecentApprovalDate === null
      ? 'null'
      : String(payload.mostRecentApprovalDate)
  ].join('|');
}

export function hashAgeSignalRequest(challenge: string, payload: AgeSignalPayload): string {
  return createHash('sha256').update(canonicalAgeSignalRequest(challenge, payload), 'utf8').digest('hex');
}
