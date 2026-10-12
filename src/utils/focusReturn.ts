/**
 * Tells a screen's 'focus' events apart. The one that comes as the screen opens is not a return;
 * a focus after a 'blur' is the admin coming back from another screen, where the data on show may
 * have changed (a room added, a teacher marked absent).
 *
 * Keyed on blur rather than on "skip the first focus", so it doesn't matter whether the opening
 * focus arrives, or how often the screen re-registers its listeners.
 */
export interface ReturnTracker {
  /** Call on 'blur'. */
  left(): void;
  /** Call on 'focus': true when this is a return after a blur. */
  focused(): boolean;
}

export function createReturnTracker(): ReturnTracker {
  let away = false;
  return {
    left() {
      away = true;
    },
    focused() {
      const back = away;
      away = false;
      return back;
    },
  };
}
