# Conecta V2 — identity verification roadmap

## ECA Digital / protection of minors

The legal implementation checklist is maintained in [`docs/eca-digital-compliance.md`](./eca-digital-compliance.md). This is an engineering baseline, not a legal-compliance certification. The current identity endpoints are not yet a complete reliable age-assurance system. Until a trustworthy server-validated age decision exists, no self-declared age, OCR/QR result, browser liveness signal, or signed-document integrity result may unlock 18+ content or adult-only privileges. Minor privacy defaults, parental supervision where applicable, server-side restrictions, purpose limitation and auditability must be reviewed across the feed, communities, uploads, Stories/Reels, DMs and calls.

## Current implementation boundary

The repository already contains browser-side camera/liveness challenges, Tesseract OCR for legacy RG documents, a local CIN QR/JWS preflight, and a gov.br/ITI signed-PDF integrity flow. These are useful preflight signals, but none alone proves that the account owner is the document holder or creates an official age decision.

The `/api/identity/methods` endpoint intentionally reports capability and cost class only. It does not create verification records, upload documents, call a paid provider, change profile flags, or grant adult privileges.

## Android bridge progress — 2026-10-13

The mobile branch now includes a local Expo module for Play Age Signals SDK `0.0.4` and a user-initiated account action. It handles shared/not-shared/verification-required states and displays the age band only as a preflight signal. The app does not upload this result or unlock age-restricted features. Next required step is a server-side Play Integrity verification flow bound to the exact signal payload and authenticated Conecta account; this requires configuring the Google Cloud/Play Console project and credentials in the deployment environment. Native build and real-device testing remain pending.

## Free platform age signals (priority over face-age estimation)

- Android: assess Google Play Age Signals API and bind the returned age band to a verified Play Integrity result before accepting it. It may not be available for sideloaded builds or every device/account. Official docs: https://developer.android.com/google/play/age-signals/use-age-signals-api
- iOS: assess Apple's Declared Age Range API; it needs the entitlement/capability, supported SDK/OS, and consent/guardian handling. It is a useful signal, not a blanket compliance guarantee. Official docs: https://developer.apple.com/documentation/declaredagerange
- Web: no automatic assumption of access to OS/store signals; use a trusted validated method or keep adult-only access locked.
- Never let the mobile app write a raw age band directly to the server-authoritative table. Verify signal provenance, account binding, integrity and replay protections server-side.

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
