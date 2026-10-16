import { ApiError, NetworkError, SessionExpiredError } from '../api/client';
import { getErrorMessage, isRetryable } from '../api/errorMessage';
import i18n from '../i18n';
import en from '../i18n/locales/en.json';
import { pausedUntilLabel } from '../utils/aiGuard';

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

  it('explains a used-up hourly AI quota by its error code', () => {
    expect(getErrorMessage(new ApiError('Request failed with status 429', 429, 'AI_RATE_LIMITED'))).toBe(
      en.errors.codes.AI_RATE_LIMITED
    );
  });

  describe('the AI guard codes', () => {
    const fill = (text: string, vars: Record<string, string | number>) =>
      text.replace(/\{\{(\w+)\}\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));

    it("says until when AI help is paused, in the phone's own time", () => {
      const pausedUntil = new Date(Date.now() + 45 * 60 * 1000).toISOString();
      const error = new ApiError(
        "Your AI help is paused until 4:15 PM because of repeated messages that weren't about school work. Your school has been informed.",
        429,
        'AI_PAUSED',
        { pausedUntil }
      );
      const message = getErrorMessage(error);
      expect(message).toBe(fill(en.errors.codes.AI_PAUSED, { time: pausedUntilLabel(pausedUntil, 'en') }));
      expect(message).not.toContain('{{');
    });

    it("keeps the server's text for a pause whose time didn't come with it", () => {
      const serverText = 'Your AI help is paused until 4:15 PM.';
      expect(getErrorMessage(new ApiError(serverText, 429, 'AI_PAUSED'))).toBe(serverText);
      expect(getErrorMessage(new ApiError(serverText, 429, 'AI_PAUSED', { pausedUntil: 'soon' }))).toBe(serverText);
    });

    it('names the length limit for a message that is too long', () => {
      const error = new ApiError('Your message is too long. Please keep it under 2000 characters.', 400, 'AI_MESSAGE_TOO_LONG', {
        maxChars: 2000,
      });
      expect(getErrorMessage(error)).toBe(fill(en.errors.codes.AI_MESSAGE_TOO_LONG, { max: 2000 }));
      expect(getErrorMessage(error)).toContain('2000');
    });

    it("keeps the server's text for a too-long message without its limit", () => {
      const serverText = 'Your message is too long. Please keep it under 6000 characters.';
      expect(getErrorMessage(new ApiError(serverText, 400, 'AI_MESSAGE_TOO_LONG'))).toBe(serverText);
    });

    it('explains both daily limits and an already-ended pause by their codes', () => {
      expect(
        getErrorMessage(new ApiError('Server wording', 429, 'AI_USER_DAILY_LIMIT', { resetsAt: '2026-10-13T18:30:00Z' }))
      ).toBe(en.errors.codes.AI_USER_DAILY_LIMIT);
      expect(
        getErrorMessage(new ApiError('Server wording', 429, 'AI_SCHOOL_DAILY_LIMIT', { resetsAt: '2026-10-13T18:30:00Z' }))
      ).toBe(en.errors.codes.AI_SCHOOL_DAILY_LIMIT);
      expect(getErrorMessage(new ApiError('This pause has already ended.', 409, 'AI_PAUSE_NOT_ACTIVE', { id: 'p1' }))).toBe(
        en.errors.codes.AI_PAUSE_NOT_ACTIVE
      );
    });

    it("shows the server's own AI_UNAVAILABLE text when it says something specific", () => {
      for (const text of [
        'The Academic Helper is turned off right now. Please try again later.',
        'The AI quiz generator is turned off right now.',
        "The AI assistant isn't set up for this school yet.",
      ]) {
        expect(getErrorMessage(new ApiError(text, 503, 'AI_UNAVAILABLE'))).toBe(text);
      }
    });

    it('uses our own words for an AI_UNAVAILABLE with a generic or empty message', () => {
      expect(getErrorMessage(new ApiError('An unexpected error occurred', 503, 'AI_UNAVAILABLE'))).toBe(
        en.errors.codes.AI_UNAVAILABLE
      );
      expect(getErrorMessage(new ApiError('', 503, 'AI_UNAVAILABLE'))).toBe(en.errors.codes.AI_UNAVAILABLE);
    });

    it('still words a plain 503 without a code as the server being unavailable', () => {
      expect(getErrorMessage(new ApiError('The Academic Helper is turned off right now.', 503))).toBe(en.errors.unavailable);
    });
  });

  it('has words for every fee bill refusal code', () => {
    const codes = [
      'FEE_BILL_CANCELLED',
      'FEE_BILL_HAS_PAYMENTS',
      'FEE_BILL_HAS_REPORTED_PAYMENT',
      'FEE_ADJUSTMENT_DUPLICATE',
      'FEE_TOTAL_BELOW_PAID',
      'FEE_CATEGORY_CODE_EXISTS',
      'FEE_STRUCTURE_EXISTS',
    ] as const;
    for (const code of codes) {
      expect(getErrorMessage(new ApiError('Server wording', 409, code))).toBe(en.errors.codes[code]);
    }
  });

  it('has words for every expense and vendor refusal code', () => {
    const codes = [
      'EXPENSE_CHANGED',
      'EXPENSE_WRONG_STATUS',
      'SELF_APPROVAL_NOT_ALLOWED',
      'AMOUNT_ABOVE_APPROVED',
      'DUPLICATE_INVOICE',
      'PAYMENT_REFERENCE_REQUIRED',
      'REVISED_AMOUNT_BELOW_BILL',
      'CATEGORY_INACTIVE',
      'CATEGORY_EXISTS',
      'EVENT_OUTFLOW_DISABLED',
      'CONCURRENT_UPDATE',
    ] as const;
    for (const code of codes) {
      expect(getErrorMessage(new ApiError('Server wording', 409, code))).toBe(en.errors.codes[code]);
    }
  });

  it('explains a school with no UPI ID set up by its error code', () => {
    expect(
      getErrorMessage(new ApiError('This school has not set up UPI payments yet.', 409, 'UPI_NOT_CONFIGURED'))
    ).toBe(en.errors.codes.UPI_NOT_CONFIGURED);
  });

  it('explains a payment result that was already recorded by its error code', () => {
    expect(
      getErrorMessage(
        new ApiError(
          "A result was already recorded for this payment, so it can't be changed.",
          409,
          'PAYMENT_ATTEMPT_ALREADY_REPORTED'
        )
      )
    ).toBe(en.errors.codes.PAYMENT_ATTEMPT_ALREADY_REPORTED);
  });

  it('explains a bare permission refusal', () => {
    expect(getErrorMessage(new ApiError('Forbidden', 403))).toBe(en.errors.forbidden);
  });

  it('explains the fee payment conflicts by their error codes', () => {
    expect(getErrorMessage(new ApiError('Reference UTR1 is already on receipt R1.', 409, 'DUPLICATE_REFERENCE'))).toBe(
      en.errors.codes.DUPLICATE_REFERENCE
    );
    expect(getErrorMessage(new ApiError('This payment was already reversed.', 409, 'ALREADY_REVERSED'))).toBe(
      en.errors.codes.ALREADY_REVERSED
    );
    expect(getErrorMessage(new ApiError('Idempotency key reused', 409, 'IDEMPOTENCY_KEY_REUSED'))).toBe(
      en.errors.codes.IDEMPOTENCY_KEY_REUSED
    );
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
