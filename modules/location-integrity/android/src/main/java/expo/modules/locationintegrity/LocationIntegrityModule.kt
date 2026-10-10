package expo.modules.locationintegrity

import android.content.Context
import android.os.Build
import android.provider.Settings
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
