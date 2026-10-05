import { revokeSession, unregisterPushToken } from '../api/client';
import { clearPushRegistration, getLastExpoPushToken } from './pushStatus';

/**
 * Logout's network side: unbinds this phone's push token, then ends the session on the server,
 * then forgets the token locally. The caller captures the tokens and clears the session right
 * away - this runs in the background and never fails. The unbind goes first because it needs the
 * access token, which the session revoke may end.
 */
export async function endSessionOnServer({
  accessToken,
  refreshToken,
  schoolId,
}: {
  accessToken: string | null;
  refreshToken: string | null;
  schoolId?: string | null;
}): Promise<void> {
  const expoPushToken = await getLastExpoPushToken();
  if (expoPushToken) await unregisterPushToken({ expoPushToken, accessToken, schoolId });
  revokeSession({ refreshToken, expoPushToken });
  clearPushRegistration();
}
