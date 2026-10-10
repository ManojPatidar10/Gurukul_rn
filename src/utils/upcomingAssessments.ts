import type { Assessment } from '../api/types';

export interface UpcomingAssessments<T> {
  items: T[];
  /** How many more upcoming assessments there are beyond `items`. */
  moreCount: number;
}

/**
 * The assessments dated today or later, earliest first (ties by title), capped at `limit` - for a
 * parent's "Upcoming assessments" card. `today` is a local YYYY-MM-DD date passed in by the caller
 * (toIsoDate(new Date())) rather than the UTC date, which lags a day behind India for the first
 * hours after midnight.
 * Dates are ISO YYYY-MM-DD strings, so comparing them as strings orders them by date.
 */
export function upcomingAssessments<T extends Pick<Assessment, 'assessmentDate' | 'title'>>(
  list: T[],
  today: string,
  limit = 5
): UpcomingAssessments<T> {
  const upcoming = list
    .filter((a) => !!a.assessmentDate && a.assessmentDate >= today)
    .sort((a, b) =>
      a.assessmentDate === b.assessmentDate
        ? (a.title ?? '').localeCompare(b.title ?? '')
        : a.assessmentDate < b.assessmentDate
          ? -1
          : 1
    );
  const items = upcoming.slice(0, Math.max(0, limit));
  return { items, moreCount: upcoming.length - items.length };
}

export type UpcomingCardState<T> =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'empty' }
  | ({ kind: 'list' } & UpcomingAssessments<T>);

/**
 * What the parent's "Upcoming assessments" card shows. `list` is the last list that loaded (null
 * until the first one arrives), so a refresh keeps the rows on screen rather than flashing a
 * spinner; the spinner shows only before anything has loaded. `error` is the last load's failure,
 * and it wins over rows that may be out of date (no believable stale or empty state). `today` is
 * re-read by the caller on every refresh, so an assessment whose day has passed drops off.
 */
export function upcomingCardState<T extends Pick<Assessment, 'assessmentDate' | 'title'>>(
  list: T[] | null,
  error: string | null,
  today: string,
  limit = 5
): UpcomingCardState<T> {
  if (error !== null) return { kind: 'error', message: error };
  if (list === null) return { kind: 'loading' };
  const upcoming = upcomingAssessments(list, today, limit);
  return upcoming.items.length === 0 ? { kind: 'empty' } : { kind: 'list', ...upcoming };
}
