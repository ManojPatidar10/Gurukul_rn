import { Linking, Platform } from 'react-native';

/**
 * Android UPI apps all register for NPCI's shared `upi://pay?...` intent scheme, so one
 * generic URI works for whichever app is installed. iOS has no single reliable equivalent:
 * some UPI apps do register the bare `upi://pay` scheme (tried last below, since which app
 * wins when several are registered is undocumented/non-deterministic), but the two big ones
 * have their own app-specific schemes instead. Only Google Pay's iOS scheme
 * (`gpay://upi/pay?...`, documented at developers.google.com/pay/india/api/ios/in-app-payments)
 * is confirmed to accept these exact query params. PhonePe has no equivalent public bare-URL
 * pay intent for iOS - its documented iOS integration (github.com/PhonePe/PhonePePayment) is a
 * native merchant SDK keyed to `ppemerchantsdkv1`-`ppemerchantsdkv5`, requiring a registered
 * merchant ID, not a URI any app can construct. That's a real platform gap, not a bug we can
 * silently guess around - see the manual-VPA fallback in PayFeesScreen for how callers should
 * handle resolvePaymentAppUrl returning null on iOS with PhonePe installed.
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
  return (await Linking.canOpenURL(genericUpiUri)) ? genericUpiUri : null;
}
