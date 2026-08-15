import type { ApiResponse, PagedResponse } from './types';

export const BASE_URL = 'http://13.126.119.171:8080';

export class ApiError extends Error {}

let currentToken: string | null = null;

export function setAuthToken(token: string | null) {
  currentToken = token;
}

// Countdowns tied to a server-issued deadline (e.g. a Battle Room's joinWindowEndsAt) must not be
// compared against the device's own Date.now() - phone clocks routinely drift by seconds to
// minutes, which shows up as different participants seeing different countdowns for the same
// deadline. Every HTTP response carries a `Date` header stamped by the server, so we use that to
// track how far off the local clock is and correct for it everywhere a countdown reads "now".
let clockOffsetMs = 0;

function syncClockOffset(response: Response) {
  const serverDateHeader = response.headers.get('date');
  if (!serverDateHeader) return;
  const serverTime = new Date(serverDateHeader).getTime();
  if (Number.isNaN(serverTime)) return;
  clockOffsetMs = serverTime - Date.now();
}

export function serverNow(): number {
  return Date.now() + clockOffsetMs;
}

async function rawRequest(
  path: string,
  options: { method?: string; schoolId?: string; body?: unknown } = {}
): Promise<any> {
  const { method = 'GET', schoolId, body } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (schoolId) headers['X-School-Id'] = schoolId;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  syncClockOffset(response);

  const json = await response.json();

  if (!response.ok || !json.success) {
    throw new ApiError(json.message ?? `Request failed with status ${response.status}`);
  }

  return json;
}

async function request<T>(
  path: string,
  options: { method?: string; schoolId?: string; body?: unknown } = {}
): Promise<T> {
  const json: ApiResponse<T> = await rawRequest(path, options);
  return json.data as T;
}

// Paginated list endpoints keep `data` as the bare row array (so old, un-updated app builds keep
// working unchanged) and carry `hasNext`/`totalElements` as siblings on the envelope rather than
// nested under `data` - deliberately reverted from a nested `data.content` shape once it was clear
// that would break every already-installed APK the moment it deployed.
async function requestPaginated<T>(path: string, schoolId?: string): Promise<PagedResponse<T>> {
  const json: ApiResponse<T[]> & { hasNext?: boolean; totalElements?: number } = await rawRequest(path, {
    method: 'GET',
    schoolId,
  });
  const content = json.data ?? [];
  return {
    content,
    hasNext: json.hasNext ?? false,
    totalElements: json.totalElements ?? content.length,
  };
}

export const api = {
  get: <T>(path: string, schoolId?: string) => request<T>(path, { method: 'GET', schoolId }),
  getPaginated: <T>(path: string, schoolId?: string) => requestPaginated<T>(path, schoolId),
  post: <T>(path: string, body: unknown, schoolId?: string) =>
    request<T>(path, { method: 'POST', body, schoolId }),
  put: <T>(path: string, body: unknown, schoolId: string) =>
    request<T>(path, { method: 'PUT', body, schoolId }),
  patch: <T>(path: string, body: unknown, schoolId: string) =>
    request<T>(path, { method: 'PATCH', body, schoolId }),
  delete: <T>(path: string, schoolId: string) => request<T>(path, { method: 'DELETE', schoolId }),
};
