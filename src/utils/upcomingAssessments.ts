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
