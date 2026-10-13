package expo.modules.agesignals

import com.google.android.play.agesignals.AgeSignalsManagerFactory
import com.google.android.play.agesignals.model.AgeSignalsAccessRequest
import com.google.android.play.agesignals.model.AgeSignalsRequest
import com.google.android.play.agesignals.model.AgeSignalsStatus
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class PlayAgeSignalsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ConectaPlayAgeSignals")

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
                    "ageRangeSource" to result.ageRangeSource(),
                    "significantChangeApprovalDate" to result.significantChangeApprovalDate()?.time
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
