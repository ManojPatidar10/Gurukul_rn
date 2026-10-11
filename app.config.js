// Expo Go only opens an EAS Update whose runtime version is its SDK ("exposdk:57.0.0"), so the
// "EAS Update" workflow publishes with EXPO_GO_UPDATE=1 to get that runtime. Real builds keep the
// appVersion policy from app.json, so an update can never reach a build whose native code differs.
module.exports = ({ config }) =>
  process.env.EXPO_GO_UPDATE === '1' ? { ...config, runtimeVersion: { policy: 'sdkVersion' } } : config;
