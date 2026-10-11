import { newIdempotencyKey } from '../utils/idempotencyKey';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// What the backend accepts in an Idempotency-Key header.
const SERVER_FORMAT = /^[A-Za-z0-9_-]{8,64}$/;

describe('newIdempotencyKey', () => {
  it('is a UUID v4 the server accepts, and differs every call', () => {
    const first = newIdempotencyKey();
    const second = newIdempotencyKey();
    expect(first).toMatch(UUID_V4);
    expect(first).toMatch(SERVER_FORMAT);
    expect(second).not.toBe(first);
  });

  describe('without crypto.randomUUID (an older Hermes)', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

    beforeEach(() => {
      Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
    });

    afterEach(() => {
      if (original) Object.defineProperty(globalThis, 'crypto', original);
      else delete (globalThis as { crypto?: unknown }).crypto;
    });

    it('still makes distinct v4-format keys', () => {
      expect((globalThis as { crypto?: unknown }).crypto).toBeUndefined();
      const keys = new Set(Array.from({ length: 50 }, () => newIdempotencyKey()));
      expect(keys.size).toBe(50);
      for (const key of keys) {
        expect(key).toMatch(UUID_V4);
        expect(key).toMatch(SERVER_FORMAT);
      }
    });
  });
});
