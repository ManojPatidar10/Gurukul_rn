import { askAi, getAiStatus, getMyAiMisuse, type AiChatMessage } from '../api/ai';
import { liftAiPause, listAiDataAccess, listAiMisuse, listAiPauses } from '../api/aiMisuse';
import { api, ApiError, NetworkError } from '../api/client';

jest.mock('../api/authStorage', () => ({ setStoredSession: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../api/client', () => {
  const actual = jest.requireActual('../api/client');
  return { ...actual, api: { ...actual.api, get: jest.fn(), getPaginated: jest.fn(), post: jest.fn() } };
});

const get = api.get as jest.Mock;
const getPaginated = api.getPaginated as jest.Mock;
const post = api.post as jest.Mock;

const OWNER_ID = '3f0b8c52-6d1e-4c57-9a43-1d2e3f4a5b6c';

/** The path and its query parameters, so the assertions don't depend on parameter order. */
function split(url: string): { path: string; params: Record<string, string> } {
  const [path, query = ''] = url.split('?');
  return { path, params: Object.fromEntries(new URLSearchParams(query)) };
}

beforeEach(() => {
  get.mockReset();
  getPaginated.mockReset();
  post.mockReset();
  getPaginated.mockResolvedValue({ content: [], hasNext: false, totalElements: 0 });
});

describe('listAiMisuse', () => {
  it('asks for one page of refused messages in a date range', async () => {
    await listAiMisuse('school-1', { from: '2026-10-07', to: '2026-10-13' });
    expect(getPaginated).toHaveBeenCalledTimes(1);
    const [url, schoolId] = getPaginated.mock.calls[0];
    expect(schoolId).toBe('school-1');
    expect(split(url)).toEqual({
      path: '/api/v1/ai/misuse',
      params: { from: '2026-10-07', to: '2026-10-13', page: '0', size: '50' },
    });
  });

  it('filters by one person, a feature and a verdict', async () => {
    await listAiMisuse('school-1', {
      from: '2026-10-13',
      to: '2026-10-13',
      ownerType: 'STUDENT',
      ownerId: OWNER_ID,
      feature: 'BOT',
      verdict: 'OFF_TOPIC',
      page: 2,
      size: 20,
    });
    expect(split(getPaginated.mock.calls[0][0]).params).toEqual({
      from: '2026-10-13',
      to: '2026-10-13',
      ownerType: 'STUDENT',
      ownerId: OWNER_ID,
      feature: 'BOT',
      verdict: 'OFF_TOPIC',
      page: '2',
      size: '20',
    });
  });

  it('sends the owner filter only with both halves (one alone is a 400 on the server)', async () => {
    await listAiMisuse('school-1', { from: '2026-10-07', to: '2026-10-13', ownerType: 'STUDENT' });
    await listAiMisuse('school-1', { from: '2026-10-07', to: '2026-10-13', ownerId: OWNER_ID });
    for (const [url] of getPaginated.mock.calls) {
      const { params } = split(url);
      expect(params).not.toHaveProperty('ownerType');
      expect(params).not.toHaveProperty('ownerId');
    }
  });
});

describe('listAiPauses', () => {
  it('lists who is paused now by default', async () => {
    get.mockResolvedValue([]);
    await listAiPauses('school-1');
    expect(get).toHaveBeenCalledWith('/api/v1/ai/pauses?active=true', 'school-1');
  });

  it('lists ended and lifted pauses in a range', async () => {
    get.mockResolvedValue([]);
    await listAiPauses('school-1', { active: false, from: '2026-09-14', to: '2026-10-13' });
    const [url] = get.mock.calls[0];
    expect(split(url)).toEqual({
      path: '/api/v1/ai/pauses',
      params: { active: 'false', from: '2026-09-14', to: '2026-10-13' },
    });
  });

  it('leaves dates off the list of active pauses', async () => {
    get.mockResolvedValue([]);
    await listAiPauses('school-1', { active: true, from: '2026-09-14', to: '2026-10-13' });
    expect(get).toHaveBeenCalledWith('/api/v1/ai/pauses?active=true', 'school-1');
  });
});

describe('liftAiPause', () => {
  it('posts to the pause lift path with no body', async () => {
    const lifted = { id: 'p1', active: false, liftedAt: '2026-10-13T10:00:00Z', liftedByName: 'Principal' };
    post.mockResolvedValue(lifted);
    await expect(liftAiPause('school-1', 'p1')).resolves.toBe(lifted);
    expect(post).toHaveBeenCalledWith('/api/v1/ai/pauses/p1/lift', undefined, 'school-1');
  });

  it('passes on a 409 AI_PAUSE_NOT_ACTIVE with the pause as it is now', async () => {
    const current = { id: 'p1', active: false, liftedAt: null };
    post.mockRejectedValue(new ApiError('This pause has already ended.', 409, 'AI_PAUSE_NOT_ACTIVE', current));
    await expect(liftAiPause('school-1', 'p1')).rejects.toMatchObject({
      status: 409,
      errorCode: 'AI_PAUSE_NOT_ACTIVE',
      data: current,
    });
  });
});

describe('listAiDataAccess', () => {
  it('asks for one page of lookups, optionally for one person and one tool', async () => {
    await listAiDataAccess('school-1', { from: '2025-10-14', to: '2026-10-13' });
    await listAiDataAccess('school-1', {
      from: '2026-10-07',
      to: '2026-10-13',
      ownerType: 'EMPLOYEE',
      ownerId: OWNER_ID,
      tool: 'get_class_attendance',
      page: 1,
    });
    expect(split(getPaginated.mock.calls[0][0])).toEqual({
      path: '/api/v1/ai/data-access',
      params: { from: '2025-10-14', to: '2026-10-13', page: '0', size: '50' },
    });
    expect(split(getPaginated.mock.calls[1][0]).params).toEqual({
      from: '2026-10-07',
      to: '2026-10-13',
      ownerType: 'EMPLOYEE',
      ownerId: OWNER_ID,
      tool: 'get_class_attendance',
      page: '1',
      size: '50',
    });
  });

  it('sends the owner filter only with both halves', async () => {
    await listAiDataAccess('school-1', { from: '2026-10-07', to: '2026-10-13', ownerId: OWNER_ID });
    expect(split(getPaginated.mock.calls[0][0]).params).not.toHaveProperty('ownerId');
  });
});

describe("the caller's own AI endpoints", () => {
  it('reads the AI status', async () => {
    get.mockResolvedValue({ paused: false, pausedUntil: null });
    await getAiStatus('school-1');
    expect(get).toHaveBeenCalledWith('/api/v1/ai/status', 'school-1');
  });

  it('reads what was recorded about the caller', async () => {
    const rows = [
      {
        feature: 'ASSISTANT',
        verdict: 'OFF_TOPIC',
        category: 'entertainment',
        excerpt: 'Tell me a joke about cricket',
        counted: true,
        createdAt: '2026-10-13T09:12:00Z',
      },
    ];
    get.mockResolvedValue(rows);
    await expect(getMyAiMisuse('school-1')).resolves.toEqual(rows);
    expect(get).toHaveBeenCalledWith('/api/v1/ai/misuse/mine', 'school-1');
  });

  it('shows nothing recorded on a server without the endpoint (404)', async () => {
    get.mockRejectedValue(new ApiError('Not Found', 404));
    await expect(getMyAiMisuse('school-1')).resolves.toEqual([]);
  });

  it('treats an empty answer as nothing recorded', async () => {
    get.mockResolvedValue(null);
    await expect(getMyAiMisuse('school-1')).resolves.toEqual([]);
  });

  it('passes on other failures so the sheet can say what went wrong', async () => {
    get.mockRejectedValue(new NetworkError('offline'));
    await expect(getMyAiMisuse('school-1')).rejects.toBeInstanceOf(NetworkError);
    get.mockRejectedValue(new ApiError('Forbidden', 403));
    await expect(getMyAiMisuse('school-1')).rejects.toMatchObject({ status: 403 });
  });

  it('sends the Academic Helper only the messages, never a model or a prompt', async () => {
    post.mockResolvedValue({ reply: 'ok', model: 'claude-haiku-5-5', refused: false, notice: null });
    await askAi('school-1', [{ role: 'user', content: 'What is a fraction?' }]);
    expect(post).toHaveBeenCalledWith(
      '/api/v1/ai/chat',
      { messages: [{ role: 'user', content: 'What is a fraction?' }] },
      'school-1',
      expect.objectContaining({ timeoutMs: expect.any(Number) })
    );
  });

  // The server recognises an earlier exchange only by the question and reply exactly as first sent
  // (spec helper-server-history), so askAi must not trim or normalise any content on the way out.
  it('posts every message content unchanged: no trimming or line-ending normalisation', async () => {
    post.mockResolvedValue({ reply: 'ok', model: 'claude-haiku-5-5', refused: false, notice: null });
    const messages: AiChatMessage[] = [
      { role: 'user', content: 'Q' },
      { role: 'assistant', content: '  A\r\n\n\n\n' },
      { role: 'user', content: ' Next ' },
    ];
    await askAi('school-1', messages);
    expect(post.mock.calls[0][0]).toBe('/api/v1/ai/chat');
    const body = post.mock.calls[0][1] as { messages: AiChatMessage[] };
    expect(body.messages).toEqual(messages);
    expect(body.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(body.messages[0].content).toBe('Q');
    expect(body.messages[1].content).toBe('  A\r\n\n\n\n');
    expect(body.messages[2].content).toBe(' Next ');
  });
});
