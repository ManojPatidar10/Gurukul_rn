import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

// This is the "Web application" type OAuth client, not the Android one - our backend verifies
// the ID token's audience against this client ID (see backend's Google Sign-In contract notes).
const GOOGLE_WEB_CLIENT_ID = '687463674175-p9vubnnqv57ali1friddlp85f2rgbpu0.apps.googleusercontent.com';

let configured = false;

function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, offlineAccess: false });
  configured = true;
}

export class GoogleSignInCancelledError extends Error {}

/** Runs the native Google Sign-In flow and returns the ID token our backend expects. */
export async function getGoogleIdToken(): Promise<string> {
  ensureConfigured();
  try {
    await GoogleSignin.hasPlayServices();
    const result = await GoogleSignin.signIn();
    if (result.type === 'cancelled') {
      throw new GoogleSignInCancelledError('Sign-in cancelled');
    }
    const idToken = result.data.idToken;
    if (!idToken) throw new Error('Google did not return an ID token - try again.');
    return idToken;
  } catch (e) {
    if (e instanceof GoogleSignInCancelledError) throw e;
    const code = (e as { code?: string }).code;
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Google Play Services is required for Google Sign-In on this device.');
    }
    throw e;
  }
}
