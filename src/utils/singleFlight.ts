export type SingleFlight = (task: () => Promise<unknown>) => void;

/**
 * Runs tasks one at a time without dropping a request. A task given while another runs doesn't
 * start in parallel; instead it runs when the current one ends - only the newest such task, however
 * many came meanwhile. So whatever asked for a run always gets one that starts after it asked: a
 * refetch asked for after a reconnect can't be swallowed by one that read the server before the
 * reconnect. A failed task is ignored (best effort: the next request tries again).
 */
export function singleFlightWithTrailing(): SingleFlight {
  let running = false;
  let queued: (() => Promise<unknown>) | null = null;

  const run: SingleFlight = (task) => {
    if (running) {
      queued = task;
      return;
    }
    running = true;
    let result: Promise<unknown>;
    try {
      result = Promise.resolve(task());
    } catch (error) {
      result = Promise.reject(error);
    }
    result
      .catch(() => {})
      .finally(() => {
        running = false;
        const next = queued;
        queued = null;
        if (next) run(next);
      });
  };

  return run;
}
