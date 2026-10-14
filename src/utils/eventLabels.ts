import type { TFunction } from 'i18next';

import type {
  EventCategory,
  EventParticipationStatus,
  EventParticipationType,
  EventRsvpStatus,
  EventScope,
  SchoolEvent,
} from '../api/types';

// The words for a school event's codes. Full keys, so tsc checks every value has one and the parity
// test checks every key exists. A value a newer server adds shows as sent (see `label`).

/** "Sports", "Cultural", "Academic", "Other". */
export const EVENT_CATEGORY_KEYS: Record<EventCategory, string> = {
  SPORTS: 'events.category.SPORTS',
  CULTURAL: 'events.category.CULTURAL',
  ACADEMIC: 'events.category.ACADEMIC',
  OTHER: 'events.category.OTHER',
};

/** The "Who is this for?" chips on the create form: "School", "Class", "Grade". */
export const EVENT_SCOPE_KEYS: Record<EventScope, string> = {
  SCHOOL: 'events.scope.SCHOOL',
  CLASS: 'events.scope.CLASS',
  GRADE: 'events.scope.GRADE',
};

/** "Upcoming", "Ongoing", "Completed", "Cancelled". */
export const EVENT_STATUS_KEYS: Record<EventParticipationStatus, string> = {
  UPCOMING: 'events.status.UPCOMING',
  ONGOING: 'events.status.ONGOING',
  COMPLETED: 'events.status.COMPLETED',
  CANCELLED: 'events.status.CANCELLED',
};

/** The create form's participation chips: "Just an announcement", "RSVP (attending?)", ... */
export const EVENT_PARTICIPATION_KEYS: Record<EventParticipationType, string> = {
  NONE: 'events.participation.NONE',
  RSVP: 'events.participation.RSVP',
  REGISTRATION: 'events.participation.REGISTRATION',
  POLL: 'events.participation.POLL',
};

/** The answers a student or parent picks: "I'm attending", "Maybe", "Can't make it". */
export const EVENT_RSVP_KEYS: Record<EventRsvpStatus, string> = {
  ACCEPTED: 'events.detail.rsvp.ACCEPTED',
  MAYBE: 'events.detail.rsvp.MAYBE',
  DECLINED: 'events.detail.rsvp.DECLINED',
};

/** The same answers in the organiser's list of responses: "Accepted", "Maybe", "Declined". */
export const EVENT_RESPONSE_KEYS: Record<EventRsvpStatus, string> = {
  ACCEPTED: 'events.detail.response.ACCEPTED',
  DECLINED: 'events.detail.response.DECLINED',
  MAYBE: 'events.detail.response.MAYBE',
};

function label<T extends string>(keys: Record<T, string>, value: T, t: TFunction): string {
  const key = keys[value] as string | undefined;
  return key ? t(key) : value;
}

export const eventCategoryLabel = (category: EventCategory, t: TFunction) => label(EVENT_CATEGORY_KEYS, category, t);
export const eventScopeLabel = (scope: EventScope, t: TFunction) => label(EVENT_SCOPE_KEYS, scope, t);
export const eventStatusLabel = (status: EventParticipationStatus, t: TFunction) => label(EVENT_STATUS_KEYS, status, t);
export const eventParticipationLabel = (type: EventParticipationType, t: TFunction) =>
  label(EVENT_PARTICIPATION_KEYS, type, t);
export const eventRsvpLabel = (status: EventRsvpStatus, t: TFunction) => label(EVENT_RSVP_KEYS, status, t);
export const eventResponseLabel = (status: EventRsvpStatus, t: TFunction) => label(EVENT_RESPONSE_KEYS, status, t);

/**
 * Who an event is for, as its tag on the list and detail screens: "School-wide", "Grade 5" (every
 * section of class 5), or the class-section's own label ("5 - A") when the screen has loaded it and
 * "Class" until then. An event without a scope has no tag (''), and a scope a newer server adds shows
 * as sent.
 */
export function eventScopeTag(
  event: Pick<SchoolEvent, 'scope' | 'className'>,
  classSectionLabel: string | null,
  t: TFunction
): string {
  switch (event.scope) {
    case null:
      return '';
    case 'SCHOOL':
      return t('events.scopeTag.school');
    case 'GRADE':
      return event.className
        ? t('events.scopeTag.gradeNamed', { className: event.className })
        : t('events.scopeTag.grade');
    case 'CLASS':
      return classSectionLabel || t('events.scopeTag.class');
    default:
      return String(event.scope);
  }
}
