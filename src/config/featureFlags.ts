/**
 * Static toggles for temporarily disabling a feature everywhere it's surfaced, without deleting
 * its code. Flip a flag back to true to fully re-enable that feature - no other changes needed.
 */
export const FEATURE_FLAGS = {
  videoCalls: false,
} as const;
