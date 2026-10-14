/**
 * Server-side policy decision for age-sensitive features.
 *
 * This helper accepts only a server-validated decision record. Never construct
 * the input from request JSON, user_metadata, profile fields, OCR output,
 * browser liveness results, or an unverified CIN/JWS preflight.
 */
export type TrustedAgeBand = '0_12' | '13_15' | '16_17' | '18_plus';
export type TrustedAgeSource =
  | 'verified_platform_age_signal'
  | 'verified_age_credential'
  | 'authorized_provider_callback';

export type TrustedAgeDecision = {
  status: 'verified';
  ageBand: TrustedAgeBand;
  source: TrustedAgeSource;
  verifiedAt: string;
  evidenceReference: string;
};

export type AgeAssurancePolicy = {
  ageAssurance: 'verified_minor' | 'verified_adult' | 'unknown';
  accountSafetyMode: 'minor_protected' | 'standard';
  canUseBasicSocialFeatures: true;
  canAccessAdultRestrictedFeatures: boolean;
  mustApplyMinorProtections: boolean;
  guardianFlowMayBeRequired: boolean;
  reason: 'verified_minor' | 'verified_adult' | 'missing_or_untrusted_age_signal';
};

const trustedSources = new Set<TrustedAgeSource>([
  'verified_platform_age_signal',
  'verified_age_credential',
  'authorized_provider_callback'
]);

function isTrustedDecision(value: unknown): value is TrustedAgeDecision {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TrustedAgeDecision>;
  if (candidate.status !== 'verified') return false;
  if (!candidate.ageBand || !(['0_12', '13_15', '16_17', '18_plus'] as const).includes(candidate.ageBand)) return false;
  if (!candidate.source || !trustedSources.has(candidate.source)) return false;
  if (typeof candidate.evidenceReference !== 'string' ||
      candidate.evidenceReference.trim().length < 8 ||
      candidate.evidenceReference.length > 256) return false;
  if (typeof candidate.verifiedAt !== 'string') return false;
  const timestamp = Date.parse(candidate.verifiedAt);
  const now = Date.now();
  // Re-check platform signals periodically so revoked supervision or updated
  // age status cannot remain trusted indefinitely.
  const maxDecisionAgeMs = 60 * 24 * 60 * 60 * 1000;
  if (!Number.isFinite(timestamp) || timestamp > now + 60_000 || now - timestamp > maxDecisionAgeMs) return false;
  return true;
}

/**
 * Fail closed for age-restricted features. Unknown age gets the safer privacy
 * mode, while basic social features remain available; actual route-level
 * authorization must call this helper before returning restricted content.
 */
export function ageAssurancePolicy(decision: unknown): AgeAssurancePolicy {
  if (!isTrustedDecision(decision)) {
    return {
      ageAssurance: 'unknown',
      accountSafetyMode: 'minor_protected',
      canUseBasicSocialFeatures: true,
      canAccessAdultRestrictedFeatures: false,
      mustApplyMinorProtections: true,
      guardianFlowMayBeRequired: true,
      reason: 'missing_or_untrusted_age_signal'
    };
  }

  if (decision.ageBand !== '18_plus') {
    return {
      ageAssurance: 'verified_minor',
      accountSafetyMode: 'minor_protected',
      canUseBasicSocialFeatures: true,
      canAccessAdultRestrictedFeatures: false,
      mustApplyMinorProtections: true,
      guardianFlowMayBeRequired: true,
      reason: 'verified_minor'
    };
  }

  return {
    ageAssurance: 'verified_adult',
    accountSafetyMode: 'standard',
    canUseBasicSocialFeatures: true,
    canAccessAdultRestrictedFeatures: true,
    mustApplyMinorProtections: false,
    guardianFlowMayBeRequired: false,
    reason: 'verified_adult'
  };
}
