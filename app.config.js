// Runtime version per kind of build. An EAS Update only reaches builds with the same runtime version,
// so this decides which updates each build can receive.
// - EXPO_GO_UPDATE=1 ("EAS Update (Expo Go)" workflow): Expo Go only opens an update whose runtime is
//   its SDK ("exposdk:57.0.0"), so those updates use the sdkVersion policy.
// - APP_VARIANT=preview (the "preview" profile in eas.json and the "EAS preview APK" workflow): the
//   installable preview APK uses the fingerprint policy. The runtime changes whenever native code
//   changes, so an update never reaches an APK it would crash; the workflow builds a new APK then.
// - Everything else (production/Play Store builds) keeps the appVersion policy from app.json.
module.exports = ({ config }) => {
  if (process.env.EXPO_GO_UPDATE === '1') {
    return { ...config, runtimeVersion: { policy: 'sdkVersion' } };
  }
  if (process.env.APP_VARIANT === 'preview') {
    return { ...config, runtimeVersion: { policy: 'fingerprint' } };
  }
  return config;
};
