import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getAiStatus, type AiStatus } from '../api/ai';
import { serverNow } from '../api/client';
import { isPaused, msUntilUnpaused, pausedUntilFromStatus } from '../utils/aiGuard';

// setTimeout misbehaves past ~24.8 days; a pause is an hour, so this only guards odd data.
const MAX_TIMER_MS = 24 * 60 * 60 * 1000;

/**
 * The caller's AI state for the Academic Helper and the helpdesk bot: whether their AI help is
 * paused (and until when) and whether the feature is switched off.
 *
 * It reads GET /ai/status when the screen gains focus and when the app comes back to the
 * foreground. A 404 (a server without the endpoint) or a lost connection changes nothing, so no
 * paused UI appears from them. `enterPaused` puts the screen in the paused state straight away -
 * from a 429 AI_PAUSED, or a reply whose notice carries `pausedUntil` (the 5th refusal itself).
 * When the pause runs out, the state clears and the status is read again.
 *
 * `enabled: false` (a human chat) makes no requests and reports nothing.
 */
export function useAiStatus(schoolId: string, enabled = true) {
  const navigation = useNavigation();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [pausedUntil, setPausedUntil] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(() => {
    if (!enabled) return;
    getAiStatus(schoolId)
      .then((next) => {
        if (!mountedRef.current) return;
        setStatus(next);
        setPausedUntil(pausedUntilFromStatus(next, serverNow()));
      })
      .catch(() => {});
  }, [schoolId, enabled]);

  const enterPaused = useCallback((until: string | null) => {
    if (until && isPaused(until, serverNow())) setPausedUntil(until);
  }, []);

  // On focus (which includes first showing) and on returning to the app.
  useEffect(() => {
    if (!enabled) return;
    refresh();
    const offFocus = navigation.addListener('focus', refresh);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      offFocus();
      appState.remove();
    };
  }, [enabled, navigation, refresh]);

  // Unlock the composer when the pause runs out, then check with the server.
  useEffect(() => {
    if (!pausedUntil) return;
    const left = msUntilUnpaused(pausedUntil, serverNow());
    const timer = setTimeout(
      () => {
        // Woke early (only for a pause longer than the timer allows): leave it locked until the
        // next focus or return to the app reads the status again.
        if (msUntilUnpaused(pausedUntil, serverNow()) > 0) return;
        setPausedUntil(null);
        refresh();
      },
      Math.min(left, MAX_TIMER_MS)
    );
    return () => clearTimeout(timer);
  }, [pausedUntil, refresh]);

  return {
    /** null until the server answered (or for an older server): treat as "nothing known". */
    status,
    /** Set while the user's AI help is paused. */
    pausedUntil: enabled && isPaused(pausedUntil, serverNow()) ? pausedUntil : null,
    assistantEnabled: status?.assistantEnabled ?? true,
    botEnabled: status?.botEnabled ?? true,
    enterPaused,
    refresh,
  };
}
