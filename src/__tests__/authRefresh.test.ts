import { setStoredSession } from '../api/authStorage';
import {
  api,
  getAuthToken,
  onSessionExpired,
  onSessionRefreshed,
  SessionExpiredError,
  setAuthSession,
} from '../api/client';
import { switchProfile } from '../api/auth';
import type { LoginResponse } from '../api/types';

// Hoisted above the imports by jest, so client.ts gets the mock.
jest.mock('../api/authStorage', () => ({ setStoredSession: jest.fn(() => Promise.resolve()) }));

const HOUR = 60 * 60 * 1000;

function session(token: string, refreshToken: string | undefined, accessExpiresInMs = HOUR): LoginResponse {
  return {
    token,
    tokenType: 'Bearer',
    ownerType: 'EMPLOYEE',
    ownerId: 'owner-1',
    role: 'ADMIN',
    schoolId: 'school-1',
    username: 'admin',
    refreshToken,
    accessTokenExpiresAt: new Date(Date.now() + accessExpiresInMs).toISOString(),
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

type Call = { url: string; auth?: string; body?: any };
let calls: Call[];
// Any request made with this token gets a 401; everything else succeeds.
let rejectedToken: string | null;
let refreshReply: () => ReturnType<typeof jsonResponse>;

beforeEach(() => {
  calls = [];
  rejectedToken = null;
  refreshReply = () => jsonResponse(200, { success: true, data: session('access-2', 'refresh-2') });
  (setStoredSession as jest.Mock).mockClear();
  globalThis.fetch = jest.fn(async (url: string, init: any) => {
    const auth = init.headers?.Authorization;
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, auth, body });
    if (url.endsWith('/api/v1/auth/refresh')) return refreshReply();
    if (url.endsWith('/api/v1/auth/logout')) return jsonResponse(200, { success: true });
    if (rejectedToken && auth === `Bearer ${rejectedToken}`) return jsonResponse(401, { success: false, message: 'Unauthorized' });
    return jsonResponse(200, { success: true, data: { ok: true } });
  }) as any;
  onSessionRefreshed(null);
  onSessionExpired(null);
  setAuthSession(null);
});

const refreshCalls = () => calls.filter((c) => c.url.endsWith('/api/v1/auth/refresh'));

describe('refresh on 401', () => {
  it('refreshes once and retries the request with the new token', async () => {
    const refreshed = jest.fn();
    onSessionRefreshed(refreshed);
    setAuthSession(session('access-1', 'refresh-1'));
    rejectedToken = 'access-1';

    await expect(api.get('/api/v1/students', 'school-1')).resolves.toEqual({ ok: true });

    expect(refreshCalls()).toHaveLength(1);
    expect(refreshCalls()[0].body).toEqual({ refreshToken: 'refresh-1' });
    expect(calls[calls.length - 1].auth).toBe('Bearer access-2');
    expect(getAuthToken()).toBe('access-2');
    expect(setStoredSession).toHaveBeenCalledWith(expect.objectContaining({ refreshToken: 'refresh-2' }));
    expect(refreshed).toHaveBeenCalledWith(expect.objectContaining({ token: 'access-2' }));
  });

  it('sends exactly one refresh when several requests 401 at once', async () => {
    setAuthSession(session('access-1', 'refresh-1'));
    rejectedToken = 'access-1';

    await Promise.all([
      api.get('/api/v1/students', 'school-1'),
      api.get('/api/v1/employees', 'school-1'),
      api.get('/api/v1/classes', 'school-1'),
    ]);

    expect(refreshCalls()).toHaveLength(1);
  });

  it('refreshes before sending when the access token is about to expire', async () => {
    setAuthSession(session('access-1', 'refresh-1', 60 * 1000));

    await api.get('/api/v1/students', 'school-1');

    expect(calls.map((c) => c.url.replace(/^.*\/api\/v1/, ''))).toEqual(['/auth/refresh', '/students']);
    expect(calls[1].auth).toBe('Bearer access-2');
  });

  it('logs out when the refresh is rejected', async () => {
    const expired = jest.fn();
    onSessionExpired(expired);
    setAuthSession(session('access-1', 'refresh-1'));
    rejectedToken = 'access-1';
    refreshReply = () => jsonResponse(401, { success: false, message: 'Refresh token reused' });

    await expect(api.get('/api/v1/students', 'school-1')).rejects.toBeInstanceOf(SessionExpiredError);
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('does not log out when the refresh fails offline', async () => {
    const expired = jest.fn();
    onSessionExpired(expired);
    setAuthSession(session('access-1', 'refresh-1'));
    rejectedToken = 'access-1';
    refreshReply = () => {
      throw new TypeError('Network request failed');
    };

    await expect(api.get('/api/v1/students', 'school-1')).rejects.toThrow('Network request failed');
    expect(expired).not.toHaveBeenCalled();
    expect(getAuthToken()).toBe('access-1');
  });

  it('sends a session saved before refresh tokens existed to login on its first 401', async () => {
    const expired = jest.fn();
    onSessionExpired(expired);
    setAuthSession(session('legacy', undefined));
    rejectedToken = 'legacy';

    await expect(api.get('/api/v1/students', 'school-1')).rejects.toBeInstanceOf(SessionExpiredError);
    expect(refreshCalls()).toHaveLength(0);
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('never refreshes on a failed login', async () => {
    setAuthSession(session('access-1', 'refresh-1'));
    rejectedToken = 'access-1';

    await expect(api.post('/api/v1/auth/login', { username: 'x', password: 'y' }, 'school-1')).rejects.toThrow(
      'Unauthorized'
    );
    expect(refreshCalls()).toHaveLength(0);
  });

  it('discards a refresh that finishes after logout, and revokes the session it created', async () => {
    const refreshed = jest.fn();
    onSessionRefreshed(refreshed);
    setAuthSession(session('access-1', 'refresh-1'));
    rejectedToken = 'access-1';
    let finishRefresh!: () => void;
    refreshReply = () => jsonResponse(200, { success: true, data: session('access-2', 'refresh-2') });
    const gate = new Promise<void>((resolve) => (finishRefresh = resolve));
    const realFetch = globalThis.fetch as jest.Mock;
    globalThis.fetch = jest.fn(async (url: string, init: any) => {
      if (url.endsWith('/api/v1/auth/refresh')) await gate;
      return realFetch(url, init);
    }) as any;

    const request = api.get('/api/v1/students', 'school-1');
    await new Promise((r) => setTimeout(r, 0));
    setAuthSession(null); // user logs out while the refresh is in flight
    finishRefresh();

    await expect(request).rejects.toBeInstanceOf(SessionExpiredError);
    expect(getAuthToken()).toBeNull();
    expect(refreshed).not.toHaveBeenCalled();
    const logout = calls.find((c) => c.url.endsWith('/api/v1/auth/logout'));
    expect(logout?.body).toEqual({ refreshToken: 'refresh-2' });
  });
});

describe('profile switch', () => {
  it('sends the refresh token that is current at send time, after any pre-send refresh', async () => {
    setAuthSession(session('access-1', 'refresh-1', 60 * 1000));

    await switchProfile('school-1', { ownerType: 'STUDENT', ownerId: 'student-2' });

    const switchCall = calls.find((c) => c.url.endsWith('/api/v1/auth/profiles/switch'));
    expect(switchCall?.body).toEqual({ ownerType: 'STUDENT', ownerId: 'student-2', refreshToken: 'refresh-2' });
  });
});
