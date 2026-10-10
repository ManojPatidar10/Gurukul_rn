package expo.modules.locationintegrity

import android.content.Context
import android.os.Build
import android.provider.Settings
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.IntegrityServiceException
import com.google.android.play.core.integrity.IntegrityTokenRequest
import com.google.android.play.core.integrity.model.IntegrityErrorCode
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Device checks for attendance self-marking. Android's per-fix mock flag (expo-location's `mocked`)
 * only catches fake GPS apps that use the standard mock-location provider. These checks close the
 * usual ways around it:
 * - developerOptionsEnabled: a fake GPS app can only be picked as the "mock location app" from
 *   Developer options, so with them off no non-root fake GPS app can feed locations.
 * - rooted: root lets modules hide the mock flag entirely.
 * - appCloned: cloner apps (Parallel Space, VirtualXposed, ...) run this app inside their own
 *   process and hand it whatever location they like, without root and without a mock flag.
 */
class LocationIntegrityModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("LocationIntegrity")

    Function("getDeviceChecks") {
      mapOf(
        "developerOptionsEnabled" to isDeveloperOptionsEnabled(),
        "rooted" to isRooted(),
        "appCloned" to isAppCloned()
      )
    }

    // A Play Integrity token bound to the server's single-use nonce. The server decodes it with
    // Google and checks the app came from Play and the phone passes device integrity.
    AsyncFunction("requestIntegrityToken") { nonce: String, cloudProjectNumber: String, promise: Promise ->
      val projectNumber = cloudProjectNumber.trim().toLongOrNull()
      if (projectNumber == null) {
        promise.reject("ERR_INTEGRITY_CONFIG", "Play Integrity cloud project number is not a number", null)
      } else {
        val request = IntegrityTokenRequest.builder()
          .setNonce(nonce)
          .setCloudProjectNumber(projectNumber)
          .build()
        IntegrityManagerFactory.create(context.applicationContext)
          .requestIntegrityToken(request)
          .addOnSuccessListener { response -> promise.resolve(response.token()) }
          .addOnFailureListener { e ->
            if (e is IntegrityServiceException) {
              promise.reject(integrityErrorCode(e.errorCode), "Play Integrity error ${e.errorCode}", e)
            } else {
              promise.reject("ERR_INTEGRITY_UNKNOWN", "Play Integrity error ${e.javaClass.simpleName}", e)
            }
          }
      }
    }
  }

  /** Groups Play's error codes by what the user can do about them; the app words each group. */
  private fun integrityErrorCode(code: Int): String = when (code) {
    IntegrityErrorCode.PLAY_STORE_VERSION_OUTDATED,
    IntegrityErrorCode.PLAY_SERVICES_VERSION_OUTDATED -> "ERR_INTEGRITY_PLAY_OUTDATED"
    IntegrityErrorCode.API_NOT_AVAILABLE,
    IntegrityErrorCode.PLAY_STORE_NOT_FOUND,
    IntegrityErrorCode.PLAY_SERVICES_NOT_FOUND,
    IntegrityErrorCode.PLAY_STORE_ACCOUNT_NOT_FOUND -> "ERR_INTEGRITY_PLAY_MISSING"
    IntegrityErrorCode.NETWORK_ERROR -> "ERR_INTEGRITY_NETWORK"
    IntegrityErrorCode.TOO_MANY_REQUESTS,
    IntegrityErrorCode.GOOGLE_SERVER_UNAVAILABLE,
    IntegrityErrorCode.CLIENT_TRANSIENT_ERROR,
    IntegrityErrorCode.CANNOT_BIND_TO_SERVICE,
    IntegrityErrorCode.INTERNAL_ERROR -> "ERR_INTEGRITY_TRANSIENT"
    IntegrityErrorCode.APP_NOT_INSTALLED,
    IntegrityErrorCode.APP_UID_MISMATCH -> "ERR_INTEGRITY_APP_NOT_INSTALLED"
    IntegrityErrorCode.NONCE_TOO_SHORT,
    IntegrityErrorCode.NONCE_TOO_LONG,
    IntegrityErrorCode.NONCE_IS_NOT_BASE64,
    IntegrityErrorCode.CLOUD_PROJECT_NUMBER_IS_INVALID -> "ERR_INTEGRITY_CONFIG"
    else -> "ERR_INTEGRITY_UNKNOWN"
  }

  private fun isDeveloperOptionsEnabled(): Boolean {
    val resolver = context.contentResolver
    return Settings.Global.getInt(resolver, Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, 0) != 0 ||
      // Android 5 era phones kept a separate "allow mock locations" switch.
      Settings.Secure.getString(resolver, "mock_location") == "1"
  }

  private fun isRooted(): Boolean {
    if (Build.TAGS?.contains("test-keys") == true) return true
    val suPaths = listOf(
      "/system/bin/su", "/system/xbin/su", "/sbin/su", "/su/bin/su", "/system/su",
      "/system/bin/.ext/su", "/system/usr/we-need-root/su", "/data/local/su", "/data/local/bin/su",
      "/data/local/xbin/su", "/cache/su", "/system/app/Superuser.apk", "/system/app/SuperSU.apk",
      "/data/adb/magisk", "/sbin/.magisk"
    )
    if (suPaths.any { File(it).exists() }) return true
    return try {
      val process = Runtime.getRuntime().exec(arrayOf("which", "su"))
      val found = process.inputStream.bufferedReader().use { it.readLine() } != null
      process.destroy()
      found
    } catch (e: Exception) {
      false
    }
  }

  /**
   * An app installed normally keeps its files under /data/data/<pkg>, /data/user/<n>/<pkg> (work
   * profiles and OEM "dual apps" are separate Android users, which is fine), or the adoptable-storage
   * equivalent. A cloner nests our files inside its own data folder instead.
   */
  private fun isAppCloned(): Boolean {
    val pkg = Regex.escape(context.packageName)
    val dataDir = context.filesDir.parentFile?.absolutePath ?: return true
    val expected = Regex("^(/data/data/$pkg|/data/user/\\d+/$pkg|/mnt/expand/[^/]+/user/\\d+/$pkg)$")
    return !expected.matches(dataDir)
  }
}
