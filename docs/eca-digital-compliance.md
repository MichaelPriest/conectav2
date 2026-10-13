# Conecta V2 — ECA Digital implementation requirements

**Status:** engineering requirements and release checklist; not a legal opinion or a declaration of compliance.  
**Scope:** Brazilian social network with user profiles, feeds, communities, chat, calls, stories, media uploads, recommendations and potential advertising.

## Engineering work started on 2026-10-13

- Added `web/src/lib/age-assurance-policy.ts`: trusted server-decision policy with fail-closed defaults; unknown age and all minor bands remain in protected mode and cannot access adult-restricted features.
- Added `GET /api/identity/age-policy`: authenticates the user and reads only the coarse result from a service-role-only table. Missing configuration, schema or database errors return an unavailable/protected result; the endpoint does not accept age claims from request bodies.
- Added `POST /api/identity/age-signal/challenge` and `POST /api/identity/age-signal/verify`: the server creates a short-lived one-time challenge, verifies the Play Integrity token via Google, checks package/signing certificate/device integrity/request hash/freshness, atomically consumes the challenge and only then stores an accepted coarse age band. The current SDK status codes accept only VERIFIED adult status or SUPERVISED minor status; declared, unknown, pending and denied statuses never become trusted decisions.
- Added migrations `supabase/migrations/20261013210000_age_assurance_decisions.sql` and `supabase/migrations/20261013230000_age_assurance_challenges.sql`. They store coarse bands, policy/method metadata, timestamps and hashes only. Client roles have no access.
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

## Android implementation added to the mobile branch (2026-10-13)

- Added a local Expo native module at `mobile/modules/age-signals/` using Play Age Signals SDK `0.0.4` and Play Integrity SDK `1.5.0`. It requests the age-sharing state, reads the coarse age range, and can request an integrity token bound to a SHA-256 request hash. Current docs: https://developer.android.com/google/play/age-signals/request-age-signals and https://developer.android.com/google/play/integrity.
- Added an explicit user-triggered option in the mobile profile/account area. The user can decline sharing; no signal is requested silently at startup. A second confirmation is required before sending the coarse age signal and integrity token to the validation server.
- Added `POST /api/identity/age-signal/challenge` and `POST /api/identity/age-signal/verify`. The server creates a short-lived one-time challenge, decodes the opaque token through Google's API, validates package name, signing certificate, `PLAY_RECOGNIZED`, `MEETS_DEVICE_INTEGRITY`, request hash and freshness, and consumes the challenge atomically before storing an accepted coarse age band.
- Self-declared status value `DECLARED status`, ambiguous ranges, missing credentials, unrecognized app/device, invalid/stale tokens and replayed challenges never create a trusted adult decision. No document, selfie, exact birth date or Play install ID is collected by this flow.
- Added `supabase/migrations/20261013230000_age_assurance_challenges.sql` and `web/tests/age-signal-integrity.test.cjs`. These tests have not yet been executed in CI. Native Android compilation, real-device testing, Play Console/Cloud setup, secret configuration and validation deployment are still pending.
- Setup steps and required environment variables are documented in [`docs/play-integrity-setup.md`](./play-integrity-setup.md). The flow remains unavailable until those prerequisites and migrations are configured. It does not yet enforce restrictions in every individual feature API.

## Free platform age signals to prioritize

Before inventing facial age estimation, integrate the platform-provided signals where available. They reduce data collection and do not have a per-verification provider fee, but are not automatically available to every device/account and do not remove Conecta's legal responsibility.

- **Android / Google Play:** evaluate the Play Age Signals API. It returns age bands such as 0–12, 13–15, 16–17 and 18+. Google recommends using Play Integrity to help verify that the response comes from an untampered app on a certified Android device. An Expo integration will require a native module/config plugin and server-side integrity verification; a sideloaded APK or device outside Google Play may not provide a usable signal.
  - Official documentation: https://developer.android.com/google/play/age-signals/use-age-signals-api
  - Response integrity guidance: https://developer.android.com/google/play/age-signals/understand-age-signals-responses
- **iOS / Apple:** evaluate the Declared Age Range API. It can return an age range and information about the declaration method when the user or guardian consents, but requires Apple capability/entitlement, supported OS/SDK versions, and handling for declined/unavailable results. Apple explicitly says the developer remains responsible for legal compliance.
  - Official documentation: https://developer.apple.com/documentation/declaredagerange
  - Brazil guidance: https://developer.apple.com/news/?id=f5zj08ey
- **Web:** do not assume a browser can access app-store/OS age signals. Keep age-restricted access locked unless a trusted signal can be securely obtained, or a documented document/credential method has been fully validated.
- **Fallback:** do not replace a missing platform signal with self-declaration, OCR, a face-age guess, or client-side liveness. Use the protective experience and offer a review/verification path.

The platform signal is only accepted as a trusted decision after the method and provenance are verified, the result is bound to the authenticated Conecta account, and replay/spoofing protections are implemented. A raw age band sent by the app must not be inserted directly into `age_assurance_decisions`.

## Non-negotiable age and identity rules

1. A typed date of birth, OCR result, browser state, profile metadata, QR decode, liveness-only result or signed-PDF integrity check is not by itself verified age or identity.
2. Age assurance must be proportionate to the risk and use a trustworthy mechanism. A user declaration must never unlock a feature/content legally restricted to adults.
3. The age result must be server-authoritative, auditable, purpose-limited and resistant to replay and account switching. Never accept client-supplied identityVerified, ageVerified, isAdult or equivalent booleans.
4. Until a reliable age decision exists, deny access to features/content restricted to 18+ and apply the safer minor-protection profile. Do not silently classify an unverified account as adult.
5. Do not claim the government has confirmed the document or its current validity unless the integration actually performs that authorized check and its result is verified.
6. Collect only data necessary for age assurance. Do not reuse document images, biometrics or age-check data for ads, profiling, recommendations, analytics or unrelated purposes. Prefer retaining a coarse age band, method/version, timestamp, consent/policy version and decision/reason code only when justified.
7. No production launch claim of legal compliance based solely on these engineering checks. Complete a legal/privacy review and document risk assessment before enabling age-gated features.

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
