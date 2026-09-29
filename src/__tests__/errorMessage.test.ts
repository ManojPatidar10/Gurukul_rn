import { ApiError, NetworkError, SessionExpiredError } from '../api/client';
import { getErrorMessage, isRetryable } from '../api/errorMessage';
import i18n from '../i18n';
import en from '../i18n/locales/en.json';

jest.mock('../api/authStorage', () => ({ setStoredSession: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

beforeAll(async () => {
  if (!i18n.isInitialized) await i18n.init({ lng: 'en', resources: { en: { translation: en } } });
  await i18n.changeLanguage('en');
});

describe('getErrorMessage', () => {
  it('shows a readable server message as-is', () => {
    expect(getErrorMessage(new ApiError('Invalid username or password', 401))).toBe('Invalid username or password');
    expect(getErrorMessage(new ApiError('Student not found', 404))).toBe('Student not found');
  });

  it('turns Spring validation output into sentences', () => {
    expect(getErrorMessage(new ApiError('password: must not be blank, username: must not be blank', 400))).toBe(
      'Password must not be blank. Username must not be blank.'
    );
    expect(getErrorMessage(new ApiError('parentContact: must match "\\d{10}"', 400))).toBe('Parent contact must match "\\d{10}".');
  });

  it('keeps a 400 that is already a sentence', () => {
    expect(getErrorMessage(new ApiError('Section already has a class teacher', 400))).toBe('Section already has a class teacher');
  });

  it('replaces server crashes with our own wording', () => {
    expect(getErrorMessage(new ApiError('An unexpected error occurred', 500))).toBe(en.errors.server);
  });

  it('explains an outage or gateway failure', () => {
    expect(getErrorMessage(new ApiError('Request failed with status 502', 502))).toBe(en.errors.unavailable);
    expect(getErrorMessage(new ApiError('', 504))).toBe(en.errors.unavailable);
  });

  it('explains no connection and timeouts', () => {
    expect(getErrorMessage(new NetworkError('offline'))).toBe(en.errors.offline);
    expect(getErrorMessage(new NetworkError('timeout'))).toBe(en.errors.timeout);
    expect(getErrorMessage(new TypeError('Network request failed'))).toBe(en.errors.offline);
  });

  it('explains a bare permission refusal', () => {
    expect(getErrorMessage(new ApiError('Forbidden', 403))).toBe(en.errors.forbidden);
  });

  it('uses the session-expired message', () => {
    expect(getErrorMessage(new SessionExpiredError())).toBe(en.auth.sessionExpired);
  });

  it('falls back to a generic message for anything unrecognised', () => {
    expect(getErrorMessage(undefined)).toBe(en.errors.generic);
    expect(getErrorMessage(new ApiError('', 418))).toBe(en.errors.generic);
  });

  it('keeps messages the app throws itself', () => {
    expect(getErrorMessage(new Error('Attachment upload failed'))).toBe('Attachment upload failed');
  });
});

describe('isRetryable', () => {
  it('is true for connection trouble and server errors, false for rejections', () => {
    expect(isRetryable(new NetworkError('offline'))).toBe(true);
    expect(isRetryable(new ApiError('x', 503))).toBe(true);
    expect(isRetryable(new ApiError('Student not found', 404))).toBe(false);
  });
});
