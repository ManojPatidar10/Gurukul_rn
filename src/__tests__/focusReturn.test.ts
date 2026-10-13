import { createReturnTracker } from '../utils/focusReturn';

describe('createReturnTracker', () => {
  it("doesn't count the focus a screen gets as it opens", () => {
    const tracker = createReturnTracker();
    expect(tracker.focused()).toBe(false);
  });

  it('counts every focus that follows a blur as a return', () => {
    const tracker = createReturnTracker();
    tracker.focused();
    tracker.left();
    expect(tracker.focused()).toBe(true);
    tracker.left();
    expect(tracker.focused()).toBe(true);
  });

  it('counts a return once, however many focus events follow it', () => {
    const tracker = createReturnTracker();
    tracker.left();
    expect(tracker.focused()).toBe(true);
    expect(tracker.focused()).toBe(false);
  });

  it("still counts the first return when the screen's opening focus never came", () => {
    const tracker = createReturnTracker();
    tracker.left();
    expect(tracker.focused()).toBe(true);
  });
});
