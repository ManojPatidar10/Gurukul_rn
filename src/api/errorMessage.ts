import i18n from '../i18n';
import { ApiError, NetworkError, SessionExpiredError } from './client';

// Messages the server sends that say nothing a user can act on - replaced by our own wording.
const GENERIC_SERVER_MESSAGES = new Set(['An unexpected error occurred', 'Internal Server Error', 'Forbidden', 'Access Denied']);

// Spring validation errors arrive as "field: problem, otherField: problem".
const VALIDATION_PART = /^([A-Za-z][\w.]*): (.+)$/;

function humanizeField(field: string) {
  const last = field.split('.').pop() ?? field;
  const words = last.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "password: must not be blank, username: must not be blank" -> "Password must not be blank. Username must not be blank." */
function tidyValidationMessage(message: string): string | null {
  const parts = message.split(/,\s+(?=[A-Za-z][\w.]*: )/);
  const tidied = parts.map((part) => {
    const match = VALIDATION_PART.exec(part.trim());
    return match ? `${humanizeField(match[1])} ${match[2]}` : null;
  });
  if (tidied.some((p) => p === null)) return null;
  return tidied.map((p) => (p!.endsWith('.') ? p : `${p}.`)).join(' ');
}

function isGeneric(message: string | undefined) {
  return !message || GENERIC_SERVER_MESSAGES.has(message.trim()) || /^Request failed with status \d+$/.test(message);
}

/**
 * What to tell the user when something failed. The server's own message is shown when it's written
 * for a person ("Student not found", "Invalid username or password"); crashes, outages, timeouts and
 * lost connections get clear wording of our own, in the app's language. A known `errorCode` wins
 * over both, via `errors.codes.<CODE>` in the translations.
 */
export function getErrorMessage(error: unknown): string {
  const t = i18n.t.bind(i18n);

  if (error instanceof SessionExpiredError) return t('auth.sessionExpired');
  if (error instanceof NetworkError) return t(error.reason === 'timeout' ? 'errors.timeout' : 'errors.offline');

  if (error instanceof ApiError) {
    if (error.errorCode && i18n.exists(`errors.codes.${error.errorCode}`)) return t(`errors.codes.${error.errorCode}`);
    const status = error.status ?? 0;
    if (status === 502 || status === 503 || status === 504) return t('errors.unavailable');
    if (status >= 500) return t('errors.server');
    if (status === 403 && isGeneric(error.message)) return t('errors.forbidden');
    if (status === 400 && error.message) return tidyValidationMessage(error.message) ?? error.message;
    if (!isGeneric(error.message)) return error.message;
    return t('errors.generic');
  }

  // fetch calls made outside the API client (file uploads) report a lost connection like this.
  if (error instanceof TypeError && error.message === 'Network request failed') return t('errors.offline');
  if (error instanceof Error && error.message) return error.message;
  return t('errors.generic');
}

/** True when trying the same thing again might work (no connection, timeout, server trouble). */
export function isRetryable(error: unknown): boolean {
  if (error instanceof NetworkError) return true;
  return error instanceof ApiError && (error.status ?? 0) >= 500;
}
