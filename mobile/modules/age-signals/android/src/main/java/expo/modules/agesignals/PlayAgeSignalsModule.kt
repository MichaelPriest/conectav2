package expo.modules.agesignals

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Sideload-first release deliberately does not invoke Google Play-only APIs.
 * Server-side age assurance remains authoritative; this module is a safe,
 * explicit deferred response until a Play-distributed build is supported.
 */
class PlayAgeSignalsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ConectaPlayAgeSignals")

    AsyncFunction("requestIntegrityToken") { requestHash: String, cloudProjectNumber: Double, promise: Promise ->
      // Keep the JS contract stable without requiring Play Integrity SDK calls
      // in the sideload APK. Never fabricate an integrity token.
      promise.resolve(mapOf(
        "status" to "deferred_first_release",
        "reason" to "google_play_services_not_used_for_sideload"
      ))
    }

    AsyncFunction("requestAgeSignals") { promise: Promise ->
      // Age Signals are not available to the first sideload distribution.
      // This is not an age decision; server-side assurance remains required.
      promise.resolve(mapOf(
        "status" to "deferred_first_release",
        "reason" to "google_play_age_signals_not_used_for_sideload"
      ))
    }
  }
}
