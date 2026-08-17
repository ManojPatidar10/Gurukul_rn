const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Android 11+ hides other apps from Linking.canOpenURL/openURL unless declared in <queries>.
 * Fee payment opens a upi:// deep link (PhonePe, GPay, etc.) - without this, canOpenURL can
 * wrongly report false even when a UPI app is installed.
 */
module.exports = function withUpiIntentQueries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest.queries) {
      manifest.queries = [{}];
    }
    const queries = manifest.queries[0];
    if (!queries.intent) {
      queries.intent = [];
    }
    queries.intent.push({
      action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
      data: [{ $: { 'android:scheme': 'upi' } }],
    });
    return config;
  });
};
