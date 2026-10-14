# Conecta V2 — identity verification roadmap

## ECA Digital / protection of minors

The legal implementation checklist is maintained in [`docs/eca-digital-compliance.md`](./eca-digital-compliance.md). This is an engineering baseline, not a legal-compliance certification. The current identity endpoints are not yet a complete reliable age-assurance system. Until a trustworthy server-validated age decision exists, no self-declared age, OCR/QR result, browser liveness signal, or signed-document integrity result may unlock 18+ content or adult-only privileges. Minor privacy defaults, parental supervision where applicable, server-side restrictions, purpose limitation and auditability must be reviewed across the feed, communities, uploads, Stories/Reels, DMs and calls.

## Current implementation boundary

The repository already contains browser-side camera/liveness challenges, Tesseract OCR for legacy RG documents, a local CIN QR/JWS preflight, and a gov.br/ITI signed-PDF integrity flow. These are useful preflight signals, but none alone proves that the account owner is the document holder or creates an official age decision.

The `/api/identity/methods` endpoint intentionally reports capability and cost class only. It does not create verification records, upload documents, call a paid provider, change profile flags, or grant adult privileges.

## First-release distribution constraint — sideloaded Android APK and web

The first release will **not** be distributed through Google Play. Therefore, Play Age Signals and Play Integrity are **not a first-release verification path** and must not be a prerequisite for onboarding, age protection, or release. The existing native module and server verifier are retained only as an optional future integration; do not present them as working for a sideloaded APK, and do not weaken Google integrity checks to make sideloaded builds pass.

The Play-specific challenge/verify endpoint cannot establish age for the first release unless a supported, trustworthy signal is available. A missing or unavailable Play signal must never be replaced with a client-supplied age band. The associated setup remains deferred in [`docs/play-integrity-setup.md`](./play-integrity-setup.md).

The current branch has not completed native compilation, end-to-end device tests, CI confirmation, or full server-side policy enforcement. The age-assurance migrations are not applied. Do not enable adult-restricted features based on this work.

## First-release free-first age-assurance path

- **Web and sideloaded APK:** implement one account-bound flow that works without an app-store API: local CIN QR/document preflight, explicit official-verification instructions where needed, and a review path that does not treat OCR, QR decoding, or face liveness alone as proof of identity or age.
- **Privacy by design:** process images locally wherever practical, avoid uploading/storing raw documents or selfies by default, and never log CPF, exact birth date, QR/JWS payloads, or face images. If manual review requires evidence, define access controls, retention/deletion, consent and audit rules before collecting it.
- **Server decision:** only persist a trusted age/identity decision when the selected evidence can actually be validated with a documented trust basis and is bound to the authenticated account. Otherwise the result remains `unknown` and the protected experience stays active.
- **No store dependency:** do not require Play Console, Play Age Signals, Play Integrity, or Apple Declared Age Range for first-release onboarding. These may be reconsidered for a later native-store release, not used as a fallback for the current release.
- Never let the mobile app write a raw age band directly to the server-authoritative table. Enforce age policy server-side and protect replay-sensitive flows.

## Free-first architecture

1. **Local preflight (no per-check provider fee):** document OCR and CIN QR parsing stay in the browser where possible. Return only a coarse result and discard source images/tokens after processing. Never log CPF, birth date, QR/JWT, selfie, or document images.
2. **Liveness preflight:** use the existing Human camera challenge as an anti-static-capture signal. It must not be labelled identity verification or age verification.
3. **Signed-document integrity:** keep the existing challenge-bound PDF workflow and official ITI signature-checking links. A valid signature is an integrity signal, not proof that gov.br has authenticated a Conecta account.
4. **Official decision:** only a documented, authorized identity provider or an officially supported integration with a verified callback can set a server-side identity/age status. Until that exists, restricted/adult privileges stay locked.
5. **Paid provider:** disabled by default. Before activation, document actual provider pricing per attempt, retries, taxes/currency, cancellation/refund behavior, user consent, and authenticated webhook signature verification. Never estimate a fee or charge a fixed markup as if it were the provider's real cost.

## Open-source research candidates

- `@vladmandic/human` (MIT) — already in the project for browser-side face/liveness signals; not an identity database.
- `tesseract.js` (Apache-2.0) — already in the project for OCR; OCR output is user-editable and must not be trusted as a verified claim.
- `@zxing/browser` (MIT) — already in the project for QR decoding; decoding a QR is not the same as verifying issuer status.
- `helviojunior/digital-document-checker` — prior research candidate for CIN QR/JWS format. The bundled public-key provenance, revocation, and live document status are not independently verified; keep its output experimental.
- `Idswyft Community` and `DeepGuard KYC` — prior open-source research candidates only. Before adopting either, review current upstream activity, license text, supported document/biometric methods, model/data licenses, security posture, deployment requirements, and whether it actually supports Brazil's current official documents. Do not claim compliance or production readiness based on repository availability alone.

## Release gates

- Keep production and the active Supabase project unchanged until a separately approved homologation run.
- Never create mock identities, simulate successful provider callbacks, or weaken RLS/age restrictions to make tests pass.
- Add regression tests for invalid/tampered signatures, replay, expired challenges, cross-origin requests, rate limits, and webhook authenticity.
- Avoid retaining raw biometrics and identity documents. Record only the minimum status, provider reference, timestamps, consent/policy version, and auditable reason codes where legally justified.
- Any official status change must be performed server-side after validating the provider response; client state and mutable profile metadata are never authoritative.
