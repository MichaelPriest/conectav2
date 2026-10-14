# Conecta V2 — ECA Digital implementation requirements

**Status:** engineering requirements and release checklist; not a legal opinion or a declaration of compliance.  
**Scope:** Brazilian social network with user profiles, feeds, communities, chat, calls, stories, media uploads, recommendations and potential advertising.

## Engineering work started on 2026-10-13

- Added `web/src/lib/age-assurance-policy.ts`: trusted server-decision policy with fail-closed defaults; unknown age and all minor bands remain in protected mode and cannot access adult-restricted features.
- Added `GET /api/identity/age-policy`: authenticates the user and reads only the coarse result from a service-role-only table. Decisions older than 60 days are treated as unknown and fail closed; missing configuration, schema or database errors return an unavailable/protected result.
- Added `POST /api/identity/age-signal/challenge` and `POST /api/identity/age-signal/verify`: the server creates a short-lived one-time challenge, verifies the Play Integrity token via Google, checks package/signing certificate/device integrity/request hash/freshness, atomically consumes the challenge and only then stores an accepted coarse age band. The current SDK status codes accept only VERIFIED adult status or SUPERVISED minor status; declared, unknown, pending and denied statuses never become trusted decisions.
- Added migrations `supabase/migrations/20261013210000_age_assurance_decisions.sql`, `supabase/migrations/20261013230000_age_assurance_challenges.sql` and `supabase/migrations/20261013240000_age_assurance_audit.sql`. They store coarse bands, policy/method metadata, timestamps and hashes only. Accepted decisions and their audit events are written atomically; client roles have no access.
- Added tests for policy decisions, challenge/hash binding, fail-closed behavior and verifier requirements. They have **not yet been executed in CI**.
- The migrations have **not** been applied to Supabase. Google Cloud/Play Console credentials, signer digest and Render environment are not configured or tested. Native Android compilation and real-device tests are pending. This work does not yet make the entire application ECA Digital compliant.

## Legal baseline to track

- Lei nº 15.211/2025 (ECA Digital), especially arts. 1, 3–10, 13–18.
- Lei nº 8.069/1990 (ECA), including the statutory definitions of criança and adolescente.
- Lei nº 13.709/2018 (LGPD), especially the best-interest standard and rules for children's personal data.
- Decree nº 12.880/2026 and the current ANPD guidance on reliable age assurance.
- Recheck the official ANPD guidance and any definitive regulation before each production release. The ANPD page currently describes the age-assurance guidance as preliminary and its monitoring/adaptation timetable as evolving.

Official sources:
- https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm
- https://www.gov.br/anpd/pt-br/assuntos/eca-digital/
- https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-publica-orientacoes-preliminares-e-cronograma-para-afericao-de-idade-no-ambiente-digital

## First-release distribution: sideloaded Android APK and web

- The EAS `production` build profile now targets an internal-distribution APK and sets `EXPO_PUBLIC_CONECTA_DISTRIBUTION=sideload`; despite the profile name, this is not a Google Play publishing configuration. The generated APK must still be built and tested before release.

The first release will not be published on Google Play. Play Age Signals and Play Integrity are therefore **deferred and must not be treated as available or required for first-release verification**. The native module and Google-backed API flow in this branch are optional future work only. Their setup guide is explicitly marked deferred in [`docs/play-integrity-setup.md`](./play-integrity-setup.md).

The first-release path must work with a sideloaded APK and web browser, without Play Console configuration or an app-store age signal. The current free/open-source preflight capabilities are local OCR, CIN QR/JWS inspection and liveness checks; these are not, individually or collectively without a trusted validation step, proof of identity or age. A valid document signature proves document integrity, not that the signed document belongs to the Conecta account holder.

Until an evidence method with a documented trust basis can create a server-validated, account-bound decision, the account remains `unknown` and protective restrictions remain active. Do not weaken Play Integrity checks to make an unrecognized APK pass. Do not replace a missing trusted signal with self-declaration, OCR, QR decoding, or a face-age estimate.

## Deferred platform signals

- **Android / Google Play:** Play Age Signals plus Play Integrity may be reconsidered only if a future release is distributed through Google Play and the required app/signing configuration is available. Official documentation: https://developer.android.com/google/play/age-signals/use-age-signals-api and https://developer.android.com/google/play/integrity.
- **iOS / Apple:** Declared Age Range API is not required for the first release and must not be assumed to cover web or Android. It may be assessed if a later iOS release and entitlement are in scope: https://developer.apple.com/documentation/declaredagerange.
- **Web and sideloaded Android:** no app-store signal is assumed. Use only a validated method with server-side provenance, account binding and replay protection, or retain the protected/unknown state.

Ad eligibility now reads only the service-role-only `age_assurance_decisions` table and runs the central 60-day age policy; it no longer trusts the legacy `identity_verifications` table. Ads remain off unless the feature flag is explicitly enabled and the account has a recent server-authoritative adult decision. The migration is still unapplied, so this check must fail closed in validation until the schema is installed.

The existing Play-specific routes, native module, migrations and tests are not evidence that the first-release path is complete. Native compilation, end-to-end tests, CI confirmation, migration application, and enforcement in every relevant feature API remain release gates.

## Non-negotiable age and identity rules

1. A typed date of birth, OCR result, browser state, profile metadata, QR decode, liveness-only result or signed-PDF integrity check is not by itself verified age or identity.
2. Age assurance must be proportionate to the risk and use a trustworthy mechanism. A user declaration must never unlock a feature/content legally restricted to adults.
3. The age result must be server-authoritative, auditable, purpose-limited and resistant to replay and account switching. Never accept client-supplied identityVerified, ageVerified, isAdult or equivalent booleans.
4. Until a reliable age decision exists, deny access to features/content restricted to 18+ and apply the safer minor-protection profile. Do not silently classify an unverified account as adult.
5. Do not claim the government has confirmed the document or its current validity unless the integration actually performs that authorized check and its result is verified.
6. Collect only data necessary for age assurance. Do not reuse document images, biometrics or age-check data for ads, profiling, recommendations, analytics or unrelated purposes. Prefer retaining a coarse age band, method/version, timestamp, consent/policy version and decision/reason code only when justified.
7. No production launch claim of legal compliance based solely on these engineering checks. Complete a legal/privacy review and document risk assessment before enabling age-gated features.

## Stage A audit findings — current branch review

- The central `GET /api/identity/age-policy` endpoint reads `age_assurance_decisions` with the service role and fails closed when configuration/schema/data are unavailable. This is a status endpoint, not a substitute for authorization checks at each feature boundary.
- `GET /api/identity/status` still reports the legacy `identity_verifications` provider workflow. Its `status` / `age_band` fields must not be interpreted as the authoritative age-assurance decision and must not be used to unlock adult-only content or advertising.
- The provisional database trigger migration `20261008_conecta_provisional_teen_content_server_gates.sql` is a narrow safeguard for inserts into posts, comments and messages when `teen_safety_preferences.mode='youth_protection'`. It does not establish comprehensive age enforcement for media, Stories/Reels, community membership, discovery, calls, reads of existing content or every direct-Supabase path.
- Consequently, a repository audit has identified a remaining release blocker: map the actual RLS policies and every read/write path for each age-sensitive feature, then add narrowly scoped enforcement and regression tests without locking all users out of basic social features or weakening existing moderation/RLS. Do not claim Stage A is complete yet.
- First-release web and sideloaded APK must not depend on the Play-only challenge/verification routes. Those routes remain isolated future integration work and are not a fallback for unknown age on web or sideloaded Android.

## Required product safeguards

### Privacy and account defaults for minors
- Private-by-default profile and strongest practical privacy defaults for accounts known or reasonably suspected to belong to minors.
- Restrict unsolicited contact from unknown or unauthorized users; minimize public exposure of profile details and location.
- Do not expose precise geolocation or make it public by default.
- Make parental supervision controls accessible in Portuguese, explain when controls are active, and provide age-appropriate information.
- Where applicable, provide a verifiable responsible-adult relationship and controls over account/privacy settings, purchases, contacts with adults and usage time. Do not infer guardian authorization from silence.
- Avoid dark patterns, compulsive engagement defaults, autoplay/reward mechanics and excessive notifications for minors; give users/guardians meaningful controls.
- Provide age-appropriate classification, reporting, blocking, support and escalation flows.

### Content, messaging and safety
- Enforce restrictions server-side for adult-only content and other content prohibited by law; re-check eligibility when access is attempted, not just at signup.
- Apply risk-based controls to discovery, recommendations, community membership, direct messages, audio/video calls, uploads, live features and public profiles.
- Maintain reporting and moderation workflows for grooming, sexual exploitation, harassment, bullying, threats, self-harm risks and other child-safety issues; preserve only necessary evidence under a documented access/retention policy.
- Prevent minors from creating profiles where the law expressly prohibits their account creation for a service (including pornographic-content services).
- Do not use age-check data for monetization or ad targeting.

### Security, privacy engineering and audit
- Require authenticated, same-origin requests where applicable, server-side authorization, rate limiting, anti-replay challenges and strict payload/file limits.
- Keep raw documents, QR/JWS tokens, selfies and biometric templates out of logs and general analytics. Do not store raw biometrics by default.
- Separate age-assurance records from public profile data and enforce RLS/service-role boundaries.
- Record a minimal audit trail for decisions, method/model version, policy version, time and reason codes; restrict access and define retention/deletion periods.
- Document data flows, purposes, legal bases, necessity/proportionality, false-accept/false-reject handling, appeals/manual review, incident response and a child-focused privacy impact assessment where appropriate.
- Provide accessible alternative handling for users unable to complete a biometric step; do not make a low-confidence model result an irreversible accusation.

## Implementation stages

### Stage A — safe baseline (before further feature release)
- [ ] Inventory every adult-only or age-sensitive feature and its server-side authorization path.
- [ ] Confirm minor/private defaults are enforced by database policies and server APIs, not only the UI.
- [ ] Make all age/identity status fields server-controlled; reject client attempts to mutate them.
- [ ] Ensure unknown/unverified age cannot unlock adult-only content or controls.
- [ ] Add regression tests for tampered client flags, direct API calls, cross-account access, replay, expired challenge and RLS isolation.
- [ ] Audit media upload, Stories, Reels, communities, discovery, DMs and calls for minor protections.

### Stage B — free-first age assurance
- [ ] Validate document/credential signatures only against keys whose provenance and rotation/revocation policy are documented.
- [ ] Keep experimental CIN signature verification explicitly labelled experimental until key provenance, issuer format, revocation/current-validity behavior and legal basis are verified.
- [ ] Process OCR/QR and liveness as preflight signals only.
- [ ] If face comparison is introduced, execute inference in a trusted server environment, obtain explicit informed consent, constrain uploads and processing time, assess model/data licensing and demographic error rates, and do not treat face similarity alone as proof of age or liveness.
- [ ] Use an issuer-backed or otherwise trustworthy age signal when available. Do not imply an official status check when no authorized endpoint was called.
- [ ] If the evidence is insufficient, leave the account unverified and keep age-restricted access blocked.

### Stage C — launch gate
- [ ] Security review and privacy/legal review completed.
- [ ] Current ANPD rules/guidance checked and recorded with review date.
- [ ] Threat model, risk assessment and incident response documented.
- [ ] Tests pass in homologation; no mocks, simulated approvals or relaxed RLS.
- [ ] Explicit approval before production deployment.

## Current project truth

The current identity work is a preflight foundation, not a finished compliant age-verification system. The local CIN/JWS check is experimental and does not check current official document validity or prove that the presenter is the holder. Browser liveness, OCR and PDF signature integrity are not final age decisions. No endpoint in this work should grant adult privileges until a trustworthy, server-validated age decision and the applicable safeguards are implemented.
