# Play Age Signals + Play Integrity setup (Conecta V2)

> **Status for the first release: DEFERRED.** Conecta V2 will initially distribute Android builds outside Google Play. Therefore, do not make Play Age Signals or Play Integrity a launch requirement, do not configure Play Console as a prerequisite for the first release, and do not present this path as available for sideloaded APKs. The existing code is an optional future integration and must fail closed when its signals are unavailable. This document is retained only for a possible later Play Store release.

This setup is required only if Conecta later chooses to use Google Play's age signal as a server-authoritative input. It is not the first-release age-assurance strategy.

## Google Cloud / Play Console prerequisites for a future release

1. Use a Google Cloud project linked to the Conecta app in Play Console.
2. Enable the Play Integrity API and configure the app in Play Console.
3. Create a service account with the minimum permissions required to decode Play Integrity tokens for this app. Do not use a personal account.
4. Use an app build distributed through Google Play internal testing for initial verification. A sideloaded preview APK may not receive PLAY_RECOGNIZED and must not be treated as a successful validation.
5. Retrieve the app-signing certificate SHA-256 digest used by Google Play. Store the matching digest in deployment secrets/configuration.

Official documentation:
- Play Age Signals: https://developer.android.com/google/play/age-signals/request-age-signals
- Understanding age signal responses: https://developer.android.com/google/play/age-signals/understand-age-signals-responses
- Play Integrity: https://developer.android.com/google/play/integrity

## Render environment variables for a future Play-distributed build

Do not configure these as a launch dependency while the app is sideloaded. If this integration is enabled later, keep all service credentials in Render secrets; never commit credentials, paste private keys into issues, or put a service-account key in EXPO_PUBLIC_*.

- GOOGLE_PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON: full service-account JSON as a secret value.
- GOOGLE_PLAY_PACKAGE_NAME: br.com.conectav2.app.
- GOOGLE_PLAY_APP_CERT_SHA256: exact SHA-256 signing-certificate digest returned for the Play-distributed app, in the same representation as the API response.
- EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT_NUMBER: numeric Cloud project number; public configuration, not a secret.

The server-side verifier checks the decoded token's package, signing certificate, PLAY_RECOGNIZED, MEETS_DEVICE_INTEGRITY, request hash and timestamp freshness. Any mismatch is rejected. Do not weaken these checks to make a sideloaded APK pass.

## Future-only database and deployment sequence

1. Review the age-assurance migrations before applying them to the validation Supabase project:
   - 20261013210000_age_assurance_decisions.sql
   - 20261013230000_age_assurance_challenges.sql
   - 20261013240000_age_assurance_audit.sql
2. Run CI and code review before any Render validation deployment.
3. Build a new Android binary with the native module; an OTA JavaScript update cannot add native code to an installed APK.
4. If Play distribution is adopted later, test via Google Play internal testing using the actual package and signing certificate. Missing configuration, sideloaded/unrecognized apps, expired tokens, replayed challenges, DECLARED status and declined sharing must never create a trusted adult decision.
5. Do not enable restricted access until individual feature APIs enforce the server-side policy.

## Availability limitation

Age Signals and Integrity SDK calls do not have a per-verification fee, but require correctly configured Google Cloud/Play Console integration and compatible distribution/device conditions. They are not a universal fallback for the web or sideloaded builds. For the first release, the team must implement and validate a separate age-assurance path that works with an APK installed outside the Play Store. If that path cannot establish a trustworthy decision, the account stays in protected mode; do not silently fall back to self-declaration or a client-side result.

## Privacy notes

- The current Play path sends only the coarse age band, Play SDK status value, one-time challenge and Integrity token after explicit user confirmation.
- Raw documents, selfies, exact birth date and Play install ID are not collected by this flow.
- Integrity tokens must be decoded on the server and must never be logged or stored.
- The database retains a coarse age band and hash reference, not the raw token or challenge.
