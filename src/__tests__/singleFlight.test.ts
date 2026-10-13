import { singleFlightWithTrailing } from '../utils/singleFlight';

/** A task whose runs finish only when the test says so. */
function controlledTask() {
  const runs: { resolve: () => void; reject: (e: Error) => void }[] = [];
  const task = jest.fn(
    () =>
      new Promise<void>((resolve, reject) => {
        runs.push({ resolve, reject });
      })
  );
  return { task, runs };
}

/** Lets the promise callbacks queued so far run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('singleFlightWithTrailing', () => {
  it('runs once when nothing else asks meanwhile', async () => {
    const { task, runs } = controlledTask();
    const run = singleFlightWithTrailing();
    run(task);
    expect(task).toHaveBeenCalledTimes(1);
    runs[0].resolve();
    await settle();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('runs once more after the current run when asked during it, never two at once', async () => {
    const { task, runs } = controlledTask();
    const run = singleFlightWithTrailing();
    // Resume starts a refetch; the socket reconnects (and the typing timeout fires) while it runs.
    run(task);
    run(task);
    run(task);
    expect(task).toHaveBeenCalledTimes(1);

    runs[0].resolve();
    await settle();
    // The calls during the first run are answered by one run that starts after them.
    expect(task).toHaveBeenCalledTimes(2);

    runs[1].resolve();
    await settle();
    expect(task).toHaveBeenCalledTimes(2);

    // Idle again: the next call runs straight away.
    run(task);
    expect(task).toHaveBeenCalledTimes(3);
  });

  it('runs the newest of the tasks queued meanwhile', async () => {
    const { task, runs } = controlledTask();
    const older = jest.fn(() => Promise.resolve());
    const newest = jest.fn(() => Promise.resolve());
    const run = singleFlightWithTrailing();
    run(task);
    run(older);
    run(newest);
    runs[0].resolve();
    await settle();
    expect(older).not.toHaveBeenCalled();
    expect(newest).toHaveBeenCalledTimes(1);
  });

  it('still runs the queued task when the current one fails, and swallows the failure', async () => {
    const { task, runs } = controlledTask();
    const run = singleFlightWithTrailing();
    run(task);
    run(task);
    runs[0].reject(new Error('offline'));
    await settle();
    expect(task).toHaveBeenCalledTimes(2);
    runs[1].resolve();
    await settle();
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('copes with a task that throws before returning a promise', async () => {
    let calls = 0;
    const throwing = () => {
      calls += 1;
      throw new Error('boom');
    };
    const run = singleFlightWithTrailing();
    expect(() => run(throwing)).not.toThrow();
    await settle();
    run(throwing);
    expect(calls).toBe(2);
  });
});
