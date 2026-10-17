import type { Period } from '../api/timetable';
import { buildTimeline, TIMELINE_PX_PER_MINUTE } from '../utils/timetable';

function period(n: number, startTime: string, endTime: string, breakPeriod = false): Period {
  return { periodNumber: n, startTime, endTime, breakPeriod, label: null };
}

/** A 45-minute lesson, a 15-minute break, then another lesson - the shape the screen is for. */
const SCHEDULE: Period[] = [
  period(1, '08:00', '08:45'),
  period(2, '08:45', '09:00', true),
  period(3, '09:00', '09:45'),
];

describe('buildTimeline', () => {
  it('places every period at its real clock position', () => {
    const { blocks } = buildTimeline(SCHEDULE, 2);

    expect(blocks.map((b) => [b.startTime, b.left, b.width])).toEqual([
      ['08:00', 0, 90],
      ['08:45', 90, 30],
      ['09:00', 120, 90],
    ]);
  });

  it('draws a break visibly shorter than a lesson', () => {
    // The whole reason the blocks are sized from the clock: a 15-minute break that rendered as
    // wide as a 45-minute lesson would say the day is evenly divided when it is not.
    const [lesson, gap] = buildTimeline(SCHEDULE, 2).blocks;

    expect(gap.width).toBeLessThan(lesson.width);
    expect(gap.width * 3).toBe(lesson.width);
  });

  it('leaves a hole in the day as a hole', () => {
    // Nothing is scheduled 10:00-11:00. Laying blocks end to end would quietly close that up and
    // put the 11:00 lesson at 10:00.
    const withGap = [period(1, '09:00', '10:00'), period(2, '11:00', '12:00')];

    const { blocks, width } = buildTimeline(withGap, 1);

    expect(blocks[1].left).toBe(120);
    expect(width).toBe(180);
  });

  it('sorts periods by time, not by the order they arrive', () => {
    const shuffled = [period(3, '09:00', '09:45'), period(1, '08:00', '08:45')];

    expect(buildTimeline(shuffled, 1).blocks.map((b) => b.periodNumber)).toEqual([1, 3]);
  });

  it('marks the whole hours across the top', () => {
    const { ticks } = buildTimeline([period(1, '08:30', '10:30')], 1);

    expect(ticks).toEqual([
      { time: '09:00', left: 30 },
      { time: '10:00', left: 90 },
    ]);
  });

  it('accepts an unpadded time from an older bell schedule', () => {
    expect(buildTimeline([period(1, '8:00', '8:45')], 1).blocks[0].startTime).toBe('08:00');
  });

  it('drops a period whose times are unusable rather than drawing it at zero', () => {
    // A zero-or-negative-length block would render as an invisible sliver at the wrong place,
    // which is worse than leaving it out of a view that is only about when things happen.
    const broken = [period(1, '08:00', '08:45'), period(2, '10:00', '09:00'), period(3, 'nonsense', '11:00')];

    expect(buildTimeline(broken, 1).blocks.map((b) => b.periodNumber)).toEqual([1]);
  });

  it('is empty rather than throwing when there is no bell schedule', () => {
    expect(buildTimeline([], 1)).toEqual({ blocks: [], ticks: [], width: 0 });
  });

  it('gives a 45-minute period room for a subject and a teacher at the real scale', () => {
    const [block] = buildTimeline([period(1, '08:00', '08:45')]).blocks;

    expect(block.width).toBe(45 * TIMELINE_PX_PER_MINUTE);
    expect(block.width).toBeGreaterThanOrEqual(96);
  });
});
