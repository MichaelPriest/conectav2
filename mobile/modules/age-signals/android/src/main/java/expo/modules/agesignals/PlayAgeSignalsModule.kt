package expo.modules.agesignals

import com.google.android.play.agesignals.AgeSignalsManagerFactory
import com.google.android.play.agesignals.AgeSignalsAccessRequest
import com.google.android.play.agesignals.AgeSignalsRequest
import com.google.android.play.agesignals.AgeSignalsStatus
import com.google.android.play.core.integrity.StandardIntegrityManager
import com.google.android.play.core.integrity.StandardIntegrityManagerFactory
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class PlayAgeSignalsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ConectaPlayAgeSignals")

    AsyncFunction("requestIntegrityToken") { requestHash: String, cloudProjectNumber: Double, promise: Promise ->
      if (!requestHash.matches(Regex("^[0-9a-fA-F]{64}$")) || cloudProjectNumber <= 0) {
        promise.resolve(mapOf("status" to "invalid_request"))
        return@AsyncFunction
      }
      val applicationContext = appContext.reactContext?.applicationContext
      if (applicationContext == null) {
        promise.resolve(mapOf("status" to "unavailable", "reason" to "context_unavailable"))
        return@AsyncFunction
      }
      val manager = StandardIntegrityManagerFactory.create(applicationContext)
      val prepareRequest = StandardIntegrityManager.PrepareIntegrityTokenRequest.builder()
        .setCloudProjectNumber(cloudProjectNumber.toLong())
        .build()
      manager.prepareIntegrityToken(prepareRequest)
        .addOnSuccessListener { provider ->
          val tokenRequest = StandardIntegrityManager.StandardIntegrityTokenRequest.builder()
            .setRequestHash(requestHash)
            .build()
          provider.request(tokenRequest)
            .addOnSuccessListener { response ->
              // Token is returned only to the caller; never log or persist it.
              promise.resolve(mapOf("status" to "ok", "integrityToken" to response.token()))
            }
            .addOnFailureListener {
              promise.resolve(mapOf("status" to "error", "reason" to "integrity_token_failed"))
            }
        }
        .addOnFailureListener {
          promise.resolve(mapOf("status" to "error", "reason" to "integrity_prepare_failed"))
        }
    }

    AsyncFunction("requestAgeSignals") { promise: Promise ->
      val activity = appContext.currentActivity
      val applicationContext = appContext.reactContext?.applicationContext
      if (activity == null || applicationContext == null) {
        promise.resolve(mapOf("status" to "unavailable", "reason" to "activity_unavailable"))
        return@AsyncFunction
      }

      val manager = AgeSignalsManagerFactory.create(applicationContext)
      val accessRequest = AgeSignalsAccessRequest.builder()
        .setActivity(activity)
        .build()

      manager.requestAgeSignalsAccess(accessRequest)
        .addOnSuccessListener { accessResult ->
          when (accessResult.ageSignalsStatus()) {
            AgeSignalsStatus.SHARED -> {
              manager.checkAgeSignals(AgeSignalsRequest.builder().build())
                .addOnSuccessListener { result ->
                  promise.resolve(mapOf(
                    "status" to "shared",
                    "ageLower" to result.ageLower(),
                    "ageUpper" to result.ageUpper(),
                    "userStatus" to result.userStatus(),
                    "mostRecentApprovalDate" to result.mostRecentApprovalDate()?.time
                  ))
                }
                .addOnFailureListener {
                  promise.resolve(mapOf("status" to "error", "reason" to "signal_query_failed"))
                }
            }
            AgeSignalsStatus.NOT_SHARED ->
              promise.resolve(mapOf("status" to "not_shared"))
            AgeSignalsStatus.VERIFICATION_REQUIRED ->
              promise.resolve(mapOf("status" to "verification_required"))
            else ->
              promise.resolve(mapOf("status" to "unknown"))
          }
        }
        .addOnFailureListener {
          promise.resolve(mapOf("status" to "error", "reason" to "access_request_failed"))
        }
    }
  }
}
