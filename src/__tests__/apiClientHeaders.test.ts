import { api, setAuthSession } from '../api/client';
import type { LoginResponse } from '../api/types';

// Hoisted above the imports by jest, so client.ts gets the mock.
jest.mock('../api/authStorage', () => ({ setStoredSession: jest.fn(() => Promise.resolve()) }));

const HOUR = 60 * 60 * 1000;

function session(token: string, refreshToken: string): LoginResponse {
  return {
    token,
    tokenType: 'Bearer',
    ownerType: 'EMPLOYEE',
    ownerId: 'owner-1',
    role: 'ADMIN',
    schoolId: 'school-1',
    username: 'admin',
    refreshToken,
    accessTokenExpiresAt: new Date(Date.now() + HOUR).toISOString(),
    refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * HOUR).toISOString(),
  } as LoginResponse;
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: () => Promise.resolve(body),
  };
}

type Call = { url: string; headers: Record<string, string>; body?: unknown };
let calls: Call[];
// Requests made with this token get a 401; everything else succeeds.
let rejectedToken: string | null;

beforeEach(() => {
  calls = [];
  rejectedToken = null;
  globalThis.fetch = jest.fn(async (url: string, init: any) => {
    const headers = { ...(init.headers ?? {}) } as Record<string, string>;
    calls.push({ url, headers, body: init.body ? JSON.parse(init.body) : undefined });
    if (url.endsWith('/api/v1/auth/refresh')) {
      return jsonResponse(200, { success: true, data: session('access-2', 'refresh-2') });
    }
    if (rejectedToken && headers.Authorization === `Bearer ${rejectedToken}`) {
      return jsonResponse(401, { success: false, message: 'Unauthorized' });
    }
    return jsonResponse(200, { success: true, data: { id: 'payment-1' } });
  }) as any;
  setAuthSession(null);
});

const paymentCalls = () => calls.filter((c) => c.url.endsWith('/api/v1/fee-payments'));

describe('extra request headers', () => {
  it('sends an Idempotency-Key alongside the usual headers', async () => {
    setAuthSession(session('access-1', 'refresh-1'));

    await api.post('/api/v1/fee-payments', { amount: 100 }, 'school-1', { headers: { 'Idempotency-Key': 'key-123456' } });

    expect(paymentCalls()).toHaveLength(1);
    expect(paymentCalls()[0].headers).toEqual(
      expect.objectContaining({
        'Idempotency-Key': 'key-123456',
        'X-School-Id': 'school-1',
        Authorization: 'Bearer access-1',
        'Content-Type': 'application/json',
      })
    );
  });

  it('re-sends the same key, unchanged, on the retry after a 401 refresh', async () => {
    setAuthSession(session('access-1', 'refresh-1'));
    rejectedToken = 'access-1';

    await expect(
      api.post('/api/v1/fee-payments', { amount: 100 }, 'school-1', { headers: { 'Idempotency-Key': 'key-123456' } })
    ).resolves.toEqual({ id: 'payment-1' });

    const sent = paymentCalls();
    expect(sent).toHaveLength(2);
    expect(sent.map((c) => c.headers.Authorization)).toEqual(['Bearer access-1', 'Bearer access-2']);
    expect(sent.map((c) => c.headers['Idempotency-Key'])).toEqual(['key-123456', 'key-123456']);
    expect(sent[1].body).toEqual(sent[0].body);
    // The refresh call itself carries no key.
    const refresh = calls.find((c) => c.url.endsWith('/api/v1/auth/refresh'));
    expect(refresh?.headers['Idempotency-Key']).toBeUndefined();
  });

  it('sends no key when none is given (every other request)', async () => {
    setAuthSession(session('access-1', 'refresh-1'));

    await api.post('/api/v1/fee-payments', { amount: 100 }, 'school-1');

    expect(paymentCalls()[0].headers['Idempotency-Key']).toBeUndefined();
  });
});
