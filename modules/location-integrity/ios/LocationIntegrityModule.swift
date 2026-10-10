import CoreLocation
import ExpoModulesCore

/**
 * Device checks for attendance self-marking. expo-location never sets `mocked` on iOS, so
 * getCurrentFix takes its own reading and reports Apple's isSimulatedBySoftware flag, which is set
 * for locations injected by Xcode and by "virtual location" desktop tools.
 */
public class LocationIntegrityModule: Module {
  private var pendingFix: FixRequest?

  public func definition() -> ModuleDefinition {
    Name("LocationIntegrity")

    Function("getDeviceChecks") { () -> [String: Bool] in
      return [
        "developerOptionsEnabled": false,
        "rooted": Self.isJailbroken(),
        "appCloned": false
      ]
    }

    AsyncFunction("getCurrentFix") { (promise: Promise) in
      if self.pendingFix != nil {
        promise.reject("ERR_FIX_IN_PROGRESS", "A location reading is already in progress")
        return
      }
      let request = FixRequest(promise: promise) { [weak self] in self?.pendingFix = nil }
      self.pendingFix = request
      request.start()
    }.runOnQueue(.main)
  }

  private static func isJailbroken() -> Bool {
    #if targetEnvironment(simulator)
    return false
    #else
    let paths = [
      "/Applications/Cydia.app", "/Applications/Sileo.app", "/var/jb", "/bin/bash", "/usr/sbin/sshd",
      "/etc/apt", "/private/var/lib/apt/", "/Library/MobileSubstrate/MobileSubstrate.dylib"
    ]
    if paths.contains(where: { FileManager.default.fileExists(atPath: $0) }) {
      return true
    }
    // A sandboxed app can't write outside its container.
    let probe = "/private/gurukul_jb_probe.txt"
    if (try? "x".write(toFile: probe, atomically: true, encoding: .utf8)) != nil {
      try? FileManager.default.removeItem(atPath: probe)
      return true
    }
    return false
    #endif
  }
}

private final class FixRequest: NSObject, CLLocationManagerDelegate {
  private let manager = CLLocationManager()
  private let promise: Promise
  private let onDone: () -> Void

  init(promise: Promise, onDone: @escaping () -> Void) {
    self.promise = promise
    self.onDone = onDone
    super.init()
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyBest
  }

  func start() {
    manager.requestLocation()
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let location = locations.last else { return }
    let source = location.sourceInformation
    promise.resolve([
      "latitude": location.coordinate.latitude,
      "longitude": location.coordinate.longitude,
      "accuracy": location.horizontalAccuracy,
      "timestamp": location.timestamp.timeIntervalSince1970 * 1000,
      "mocked": (source?.isSimulatedBySoftware ?? false) || (source?.isProducedByAccessory ?? false)
    ])
    finish()
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    promise.reject("ERR_LOCATION", error.localizedDescription)
    finish()
  }

  private func finish() {
    manager.delegate = nil
    onDone()
  }
}
