# Play Age Signals + Play Integrity setup (Conecta V2)

This setup is required before the Android age signal can create a server-authoritative age decision. The code deliberately fails closed if any required configuration is missing or the app/device/token is not recognized.

## Google Cloud / Play Console prerequisites

1. Use a Google Cloud project linked to the Conecta app in Play Console.
2. Enable the Play Integrity API and configure the app in Play Console.
3. Create a service account with the minimum permissions required to decode Play Integrity tokens for this app. Do not use a personal account.
4. Use an app build distributed through Google Play internal testing for initial verification. A sideloaded preview APK may not receive PLAY_RECOGNIZED and should not be treated as a successful validation.
5. Retrieve the app-signing certificate SHA-256 digest used by Google Play. The API returns digest values in the format documented by Google; store the matching digest in the deployment secret/config.

Official documentation:
- Play Age Signals: https://developer.android.com/google/play/age-signals/request-age-signals
- Understanding age signal responses: https://developer.android.com/google/play/age-signals/understand-age-signals-responses
- Play Integrity: https://developer.android.com/google/play/integrity

## Render environment variables

Configure these as secrets/environment variables on the validation service only. Never commit credentials, paste private keys into issues, or put a service-account key in EXPO_PUBLIC_*.

- GOOGLE_PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON: full service-account JSON as a secret value.
- GOOGLE_PLAY_PACKAGE_NAME: br.com.conectav2.app.
- GOOGLE_PLAY_APP_CERT_SHA256: exact SHA-256 signing-certificate digest returned for the Play-distributed app, in the same representation as the API response.
- The app build also needs EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT_NUMBER: numeric Cloud project number. This number is public configuration, not a secret.

The server-side verifier checks the decoded token's package, signing certificate, PLAY_RECOGNIZED verdict, MEETS_DEVICE_INTEGRITY, request hash and timestamp freshness. Any mismatch is rejected. It does not trust a decoded payload supplied by the client.

## Database and deployment sequence

1. Review and apply these migrations to the validation Supabase project in order:
   - 20261013210000_age_assurance_decisions.sql
   - 20261013230000_age_assurance_challenges.sql
2. Deploy the current branch to the Render validation service only after CI and code review.
3. Build a new Android binary with the native module; an OTA JavaScript update cannot add native code to an already-installed APK.
4. Test via Google Play internal testing with the actual package/signing certificate. Verify that missing configuration, sideloaded/unrecognized apps, expired tokens, replayed challenges, DECLARED status (self-declared age) and declined sharing never create a trusted adult decision.
5. Confirm the GET /api/identity/age-policy result after verification. Do not enable restricted access until the individual feature APIs enforce the server-side policy.

## Free-tier / availability limitation

The Age Signals and Integrity SDK calls do not have a per-verification fee, but require a correctly configured Google Cloud/Play Console integration and a compatible distribution/device. This is not a universal fallback for the web or sideloaded builds. If Google Play does not provide a usable signal, the account remains protected and needs another documented, trustworthy age-assurance route.

## Privacy notes

- The client sends only the coarse age band, Play SDK status value, one-time challenge and Integrity token after the user explicitly confirms submission.
- Raw documents, selfies, exact birth date and Play install ID are not collected by this flow.
- Integrity tokens are decoded on the server and must never be logged or stored.
- The database retains a coarse age band and a hash reference, not the raw token or challenge.
