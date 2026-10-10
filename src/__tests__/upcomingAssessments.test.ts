import { upcomingAssessments, upcomingCardState } from '../utils/upcomingAssessments';

const a = (title: string, assessmentDate: string) => ({ title, assessmentDate });

describe('upcomingAssessments', () => {
  const today = '2026-10-10';

  it('keeps today and later, dropping past assessments', () => {
    const result = upcomingAssessments([a('Old', '2026-10-09'), a('Today', '2026-10-10'), a('Next', '2026-10-11')], today);
    expect(result.items.map((x) => x.title)).toEqual(['Today', 'Next']);
    expect(result.moreCount).toBe(0);
  });

  it('sorts earliest first, breaking same-day ties by title', () => {
    const result = upcomingAssessments(
      [a('Science test', '2026-11-02'), a('Maths quiz', '2026-10-20'), a('English exam', '2026-11-02'), a('Art', '2026-10-12')],
      today
    );
    expect(result.items.map((x) => x.title)).toEqual(['Art', 'Maths quiz', 'English exam', 'Science test']);
  });

  it('caps at the limit and counts the rest', () => {
    const list = Array.from({ length: 8 }, (_, i) => a(`T${i}`, `2026-10-${String(11 + i).padStart(2, '0')}`));
    const result = upcomingAssessments(list, today);
    expect(result.items).toHaveLength(5);
    expect(result.items[0].title).toBe('T0');
    expect(result.moreCount).toBe(3);

    const two = upcomingAssessments(list, today, 2);
    expect(two.items.map((x) => x.title)).toEqual(['T0', 'T1']);
    expect(two.moreCount).toBe(6);
  });

  it('does not count past assessments in moreCount', () => {
    const list = [a('Past', '2026-01-01'), ...Array.from({ length: 6 }, (_, i) => a(`T${i}`, `2026-12-0${i + 1}`))];
    expect(upcomingAssessments(list, today).moreCount).toBe(1);
  });

  it('returns nothing for an empty list', () => {
    expect(upcomingAssessments([], today)).toEqual({ items: [], moreCount: 0 });
  });

  it('leaves the input list in its original order', () => {
    const list = [a('B', '2026-10-20'), a('A', '2026-10-15')];
    upcomingAssessments(list, today);
    expect(list.map((x) => x.title)).toEqual(['B', 'A']);
  });
});

describe('upcomingCardState', () => {
  const today = '2026-10-10';

  it('is loading only before the first list arrives', () => {
    expect(upcomingCardState(null, null, today)).toEqual({ kind: 'loading' });
  });

  it('shows the error, even over rows from an earlier load', () => {
    expect(upcomingCardState(null, 'Network error', today)).toEqual({ kind: 'error', message: 'Network error' });
    expect(upcomingCardState([a('Maths quiz', '2026-10-12')], 'Network error', today)).toEqual({
      kind: 'error',
      message: 'Network error',
    });
  });

  it('is empty when nothing is dated today or later', () => {
    expect(upcomingCardState([], null, today)).toEqual({ kind: 'empty' });
    expect(upcomingCardState([a('Old', '2026-10-09')], null, today)).toEqual({ kind: 'empty' });
  });

  it('lists the upcoming rows with the overflow count', () => {
    const list = Array.from({ length: 7 }, (_, i) => a(`T${i}`, `2026-10-${String(11 + i).padStart(2, '0')}`));
    const state = upcomingCardState(list, null, today);
    expect(state.kind).toBe('list');
    if (state.kind !== 'list') return;
    expect(state.items.map((x) => x.title)).toEqual(['T0', 'T1', 'T2', 'T3', 'T4']);
    expect(state.moreCount).toBe(2);
  });

  it('drops a loaded assessment once its day has passed', () => {
    const list = [a('Maths quiz', '2026-10-10'), a('Science test', '2026-10-11')];
    const titles = (day: string) => {
      const state = upcomingCardState(list, null, day);
      return state.kind === 'list' ? state.items.map((x) => x.title) : [];
    };
    expect(titles('2026-10-10')).toEqual(['Maths quiz', 'Science test']);
    expect(titles('2026-10-11')).toEqual(['Science test']);
    expect(upcomingCardState(list, null, '2026-10-12')).toEqual({ kind: 'empty' });
  });
});
