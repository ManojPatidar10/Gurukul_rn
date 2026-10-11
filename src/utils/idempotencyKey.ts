type CryptoWithUuid = { randomUUID?: () => string };

const UUID_V4_TEMPLATE = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';

/**
 * A new UUID v4 for an `Idempotency-Key` header: one per form submission, reused when the same form
 * is sent again (a retry after a timeout), so the server returns the first result instead of
 * recording the money twice. Uses crypto.randomUUID where the runtime has it; otherwise a
 * Math.random UUID in the same format, which is plenty for a per-school duplicate guard and needs
 * no native module.
 */
export function newIdempotencyKey(): string {
  const crypto = (globalThis as { crypto?: CryptoWithUuid }).crypto;
  const uuid = crypto?.randomUUID?.();
  if (typeof uuid === 'string' && uuid.length === 36) return uuid;
  return UUID_V4_TEMPLATE.replace(/[xy]/g, (char) => {
    const nibble = Math.floor(Math.random() * 16);
    // The 'y' position carries the variant bits (8, 9, a or b).
    return (char === 'x' ? nibble : (nibble & 0x3) | 0x8).toString(16);
  });
}
