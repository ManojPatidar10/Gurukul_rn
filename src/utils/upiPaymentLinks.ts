import { Linking, Platform } from 'react-native';

/**
 * Android UPI apps all register for NPCI's shared `upi://pay?...` intent scheme, so one
 * generic URI works for whichever app is installed. iOS has no equivalent shared scheme -
 * each UPI app only responds to its own prefix, so the same query string has to be retried
 * against each known app's scheme in turn. Only Google Pay's iOS scheme
 * (`gpay://upi/pay?...`, documented at developers.google.com/pay/india/api/ios/in-app-payments)
 * is confirmed to accept these exact query params - PhonePe's `phonepe://` scheme is used for
 * its own SDK/navigation purposes, not a plain pay intent, so it is deliberately not guessed at
 * here until confirmed.
 */
const IOS_UPI_APP_SCHEMES = ['gpay://upi/pay'];

/**
 * Resolves the generic upi://pay?... URI returned by the backend into a URI that will
 * actually open an installed UPI app on the current platform, or null if none can handle it.
 */
export async function resolvePaymentAppUrl(genericUpiUri: string): Promise<string | null> {
  if (Platform.OS !== 'ios') {
    return (await Linking.canOpenURL(genericUpiUri)) ? genericUpiUri : null;
  }

  const queryString = genericUpiUri.split('?')[1] ?? '';
  for (const scheme of IOS_UPI_APP_SCHEMES) {
    const candidate = `${scheme}?${queryString}`;
    if (await Linking.canOpenURL(candidate)) {
      return candidate;
    }
  }
  return null;
}
