/**
 * Conservative agreement gate for the independently captured uploaded selfie
 * and both server-detected, neutral liveness frames.
 *
 * No score, embedding, image, user identifier or detailed comparison result
 * is stored or logged. All three pairwise scores must be finite and reach the
 * established similarity threshold; the gate never relaxes it.
 */
export type FaceMatchConsistency='matched'|'capture_inconsistent'|'selfie_inconclusive'|'unavailable';
export const FACE_MATCH_MIN_SIMILARITY=0.55;

export function faceMatchConsistency(
  selfieToFirst:number,
  selfieToLast:number,
  firstToLast:number
):FaceMatchConsistency{
  const scores=[selfieToFirst,selfieToLast,firstToLast];
  if(scores.some(score=>!Number.isFinite(score)||score<0||score>1))
    return 'unavailable';
  if(firstToLast<FACE_MATCH_MIN_SIMILARITY)
    return 'capture_inconsistent';
  if(selfieToFirst>=FACE_MATCH_MIN_SIMILARITY&&selfieToLast>=FACE_MATCH_MIN_SIMILARITY)
    return 'matched';
  if(selfieToFirst>=FACE_MATCH_MIN_SIMILARITY||selfieToLast>=FACE_MATCH_MIN_SIMILARITY)
    return 'capture_inconsistent';
  return 'selfie_inconclusive';
}
