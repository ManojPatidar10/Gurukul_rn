import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getAiStatus, type AiStatus } from '../api/ai';
import { serverNow } from '../api/client';
import { isPaused, pauseAfterStatus, pausedUntilFromStatus, watchPauseEnd } from '../utils/aiGuard';

/**
 * The caller's AI state for the Academic Helper and the helpdesk bot: whether their AI help is
 * paused (and until when) and whether the feature is switched off.
 *
 * It reads GET /ai/status when the screen gains focus and when the app comes back to the
 * foreground; a screen also calls `refresh` when something says the state may have changed (a
 * missed frame, a "turned off" answer). A 404 (a server without the endpoint) or a lost connection
 * changes nothing, so no paused UI appears from them. Answers are applied in request order: an
 * older one arriving late is dropped, and one for a request sent before the screen entered its
 * pause can't end that pause (see pauseAfterStatus).
 *
 * `enterPaused` puts the screen in the paused state straight away - from a 429 AI_PAUSED, or a reply
 * whose notice carries `pausedUntil` (the 5th refusal itself). It returns false when that pause has
 * already ended by the server's clock, so the caller can say something instead. When the pause runs
 * out, the state clears and the status is read again.
 *
 * `enabled: false` (a human chat) makes no requests and reports nothing.
 */
export function useAiStatus(schoolId: string, enabled = true) {
  const navigation = useNavigation();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [pausedUntil, setPausedUntil] = useState<string | null>(null);
  const mountedRef = useRef(true);
  // Status requests are numbered: the newest answer seen, and the newest request already sent
  // when the current pause was entered.
  const requestSeqRef = useRef(0);
  const answeredSeqRef = useRef(0);
  const pauseEnteredAtSeqRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(() => {
    if (!enabled) return;
    requestSeqRef.current += 1;
    const mine = requestSeqRef.current;
    getAiStatus(schoolId)
      .then((next) => {
        if (!mountedRef.current || mine < answeredSeqRef.current) return;
        answeredSeqRef.current = mine;
        const startedBeforePause = mine <= pauseEnteredAtSeqRef.current;
        setStatus(next);
        setPausedUntil((current) =>
          pauseAfterStatus(current, pausedUntilFromStatus(next, serverNow()), startedBeforePause, serverNow())
        );
      })
      .catch(() => {});
  }, [schoolId, enabled]);

  const enterPaused = useCallback((until: string | null): boolean => {
    if (!until || !isPaused(until, serverNow())) return false;
    pauseEnteredAtSeqRef.current = requestSeqRef.current;
    setPausedUntil(until);
    return true;
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

  // Unlock the composer when the pause runs out (by the server's clock), then check with the server.
  useEffect(() => {
    if (!pausedUntil) return;
    return watchPauseEnd(pausedUntil, serverNow, () => {
      setPausedUntil(null);
      refresh();
    });
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
