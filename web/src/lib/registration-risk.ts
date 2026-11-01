/**
 * Conecta ID 2.0 — deterministic risk triage.
 *
 * This is NOT proof of identity or age, and must never be used alone to
 * authorize age-restricted features. Only server-observed signals belong here.
 * Human review is required for inconsistent or suspicious registrations.
 */
export type TriageSignal =
  | 'contact_unconfirmed'
  | 'registration_incomplete'
  | 'age_inconsistency'
  | 'suspected_duplicate'
  | 'automated_abuse'
  | 'document_mismatch'
  | 'liveness_inconclusive'
  | 'manual_report';

export type TriageDecision = 'pending_contact' | 'pending_review' | 'eligible_basic' | 'ineligible';

export interface TriageInput {
  contactConfirmed: boolean;
  profileComplete: boolean;
  declaredAgeBand: 'under_13' | '13_15' | '16_17' | '18_plus' | null;
  signals: readonly TriageSignal[];
}

export interface TriageResult {
  decision: TriageDecision;
  reasons: TriageSignal[];
  humanReviewRequired: boolean;
  identityVerified: false;
  ageVerified: false;
}

export function assessRegistrationRisk(input: TriageInput): TriageResult {
  const reasons = [...new Set(input.signals)];
  const result = (decision: TriageDecision, humanReviewRequired: boolean): TriageResult => ({
    decision, reasons, humanReviewRequired, identityVerified: false, ageVerified: false
  });
  if (input.declaredAgeBand === 'under_13') return result('ineligible', false);
  if (!input.contactConfirmed) {
    if (!reasons.includes('contact_unconfirmed')) reasons.push('contact_unconfirmed');
    return result('pending_contact', false);
  }
  if (!input.profileComplete || !input.declaredAgeBand) {
    if (!reasons.includes('registration_incomplete')) reasons.push('registration_incomplete');
    return result('pending_review', true);
  }
  if (reasons.length > 0) return result('pending_review', true);
  // Only ordinary, non-age-restricted basic access may use this outcome.
  return result('eligible_basic', false);
}
