import { useMemo, useRef } from 'react';
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import type { RazorpayOrder } from '../api/types';
import { colors } from '../theme/colors';

export type RazorpayCheckoutResult =
  | { kind: 'success'; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }
  | { kind: 'failed'; reason: string | null }
  | { kind: 'dismissed' };

type Props = {
  order: RazorpayOrder;
  onResult: (result: RazorpayCheckoutResult) => void;
};

/**
 * Razorpay Checkout, hosted in a WebView.
 *
 * <p>This is Razorpay's own hosted checkout - card numbers, UPI PINs and bank credentials are
 * entered inside it and never touch this app, which is what keeps card data out of scope here.
 * Only the publishable keyId and the server-created orderId are passed in; the key secret stays on
 * the backend.
 *
 * <p>Chosen over the react-native-razorpay native SDK because react-native-webview is already a
 * dependency, so this needs no prebuild and no new native build of the app.
 *
 * <p>Nothing this component reports is believed on its own. Every outcome - including "success" -
 * is re-verified server-side against Razorpay before a fee is marked paid, because everything
 * running in this WebView is client-side and therefore forgeable.
 */
export function RazorpayCheckoutModal({ order, onResult }: Props) {
  // Guards against a double report: Razorpay fires ondismiss after payment.failed, and again after
  // the handler on some flows, which would otherwise overwrite a success with a "dismissed".
  const reportedRef = useRef(false);

  const report = (result: RazorpayCheckoutResult) => {
    if (reportedRef.current) return;
    reportedRef.current = true;
    onResult(result);
  };

  // Built once per order. JSON.stringify on every interpolated value is deliberate: a student's
  // name legitimately can contain a quote or backslash, which would otherwise break out of the
  // string literal and leave a blank checkout screen.
  const html = useMemo(() => buildCheckoutHtml(order), [order]);

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    let payload: any;
    try {
      payload = JSON.parse(event.nativeEvent.data);
    } catch {
      report({ kind: 'failed', reason: null });
      return;
    }
    if (payload.type === 'success') {
      report({
        kind: 'success',
        razorpayOrderId: payload.razorpay_order_id,
        razorpayPaymentId: payload.razorpay_payment_id,
        razorpaySignature: payload.razorpay_signature,
      });
    } else if (payload.type === 'failed') {
      report({ kind: 'failed', reason: payload.description ?? null });
    } else {
      report({ kind: 'dismissed' });
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={() => report({ kind: 'dismissed' })}>
      <View style={styles.root}>
        <WebView
          source={{ html, baseUrl: 'https://checkout.razorpay.com' }}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          // Checkout hands off to UPI apps and bank pages via new windows/redirects; without this
          // those open into a blank view and the payment dead-ends.
          setSupportMultipleWindows={false}
          originWhitelist={['*']}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
          // A WebView-level failure (no network, script blocked) is indistinguishable from a
          // cancelled payment from here, so it is reported as a failure rather than silently hanging.
          onError={() => report({ kind: 'failed', reason: null })}
          onHttpError={() => report({ kind: 'failed', reason: null })}
        />
      </View>
    </Modal>
  );
}

function buildCheckoutHtml(order: RazorpayOrder): string {
  const options = {
    key: order.keyId,
    order_id: order.orderId,
    amount: order.amountPaise,
    currency: order.currency,
    name: order.name,
    description: order.description,
    prefill: {
      name: order.prefillName ?? '',
      email: order.prefillEmail ?? '',
      contact: order.prefillContact ?? '',
    },
    // Re-opening a closed sheet inside a WebView leaves it in a broken half-state; the app's own
    // "Try Again" button starts a clean attempt instead.
    retry: { enabled: false },
    theme: { color: '#2563EB' },
  };

  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <style>html,body{margin:0;padding:0;height:100%;background:#ffffff;}</style>
  </head>
  <body>
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
    <script>
      var post = function (payload) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      };
      try {
        var options = ${JSON.stringify(options)};
        options.handler = function (response) {
          post({
            type: 'success',
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature
          });
        };
        options.modal = {
          escape: false,
          ondismiss: function () { post({ type: 'dismissed' }); }
        };
        var rzp = new Razorpay(options);
        rzp.on('payment.failed', function (response) {
          post({
            type: 'failed',
            description: response && response.error ? response.error.description : null
          });
        });
        rzp.open();
      } catch (e) {
        post({ type: 'failed', description: null });
      }
    </script>
  </body>
</html>`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
