import { requireOptionalNativeModule } from 'expo-modules-core';

export interface DeviceChecks {
  /** Android: Developer options are on, which is where a fake GPS app is picked as mock location app. */
  developerOptionsEnabled: boolean;
  /** Rooted (Android) or jailbroken (iOS): the OS mock flag can be hidden. */
  rooted: boolean;
  /** Android: the app is running inside a cloner (Parallel Space etc.), which can feed it any location. */
  appCloned: boolean;
}

export interface NativeFix {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  mocked: boolean;
}

interface LocationIntegrityNativeModule {
  getDeviceChecks(): DeviceChecks;
  /** iOS only. */
  getCurrentFix?(): Promise<NativeFix>;
}

/** Null in Expo Go, on web and in tests, where the native module isn't built in. */
export const LocationIntegrity = requireOptionalNativeModule<LocationIntegrityNativeModule>('LocationIntegrity');
