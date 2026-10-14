import type {
  EventCategory,
  EventParticipationStatus,
  EventParticipationType,
  EventRsvpStatus,
  EventScope,
} from '../api/types';
import en from '../i18n/locales/en.json';
import hi from '../i18n/locales/hi.json';
import { fill, tEn, tHi } from '../testUtils/i18nFixture';
import {
  EVENT_CATEGORY_KEYS,
  EVENT_PARTICIPATION_KEYS,
  EVENT_RESPONSE_KEYS,
  EVENT_RSVP_KEYS,
  EVENT_SCOPE_KEYS,
  EVENT_STATUS_KEYS,
  eventCategoryLabel,
  eventParticipationLabel,
  eventResponseLabel,
  eventRsvpLabel,
  eventScopeLabel,
  eventScopeTag,
  eventStatusLabel,
} from '../utils/eventLabels';

const CATEGORIES: EventCategory[] = ['SPORTS', 'CULTURAL', 'ACADEMIC', 'OTHER'];
const SCOPES: EventScope[] = ['SCHOOL', 'CLASS', 'GRADE'];
const STATUSES: EventParticipationStatus[] = ['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'];
const TYPES: EventParticipationType[] = ['RSVP', 'REGISTRATION', 'POLL', 'NONE'];
const ANSWERS: EventRsvpStatus[] = ['ACCEPTED', 'DECLINED', 'MAYBE'];

describe('event label maps', () => {
  it('map every value the app knows to its own key', () => {
    expect(Object.keys(EVENT_CATEGORY_KEYS).sort()).toEqual([...CATEGORIES].sort());
    expect(Object.keys(EVENT_SCOPE_KEYS).sort()).toEqual([...SCOPES].sort());
    expect(Object.keys(EVENT_STATUS_KEYS).sort()).toEqual([...STATUSES].sort());
    expect(Object.keys(EVENT_PARTICIPATION_KEYS).sort()).toEqual([...TYPES].sort());
    expect(Object.keys(EVENT_RSVP_KEYS).sort()).toEqual([...ANSWERS].sort());
    expect(Object.keys(EVENT_RESPONSE_KEYS).sort()).toEqual([...ANSWERS].sort());
  });

  it('use words, not the raw codes, in English', () => {
    expect(CATEGORIES.map((c) => eventCategoryLabel(c, tEn))).toEqual(['Sports', 'Cultural', 'Academic', 'Other']);
    expect(SCOPES.map((s) => eventScopeLabel(s, tEn))).toEqual(['School', 'Class', 'Grade']);
    expect(STATUSES.map((s) => eventStatusLabel(s, tEn))).toEqual(['Upcoming', 'Ongoing', 'Completed', 'Cancelled']);
    expect(TYPES.map((p) => eventParticipationLabel(p, tEn))).toEqual([
      'RSVP (attending?)',
      'Registration form',
      'Poll / vote',
      'Just an announcement',
    ]);
    expect(ANSWERS.map((a) => eventRsvpLabel(a, tEn))).toEqual(["I'm attending", "Can't make it", 'Maybe']);
    expect(ANSWERS.map((a) => eventResponseLabel(a, tEn))).toEqual(['Accepted', 'Declined', 'Maybe']);
  });

  it('use the Hindi words in Hindi', () => {
    expect(eventCategoryLabel('SPORTS', tHi)).toBe(hi.events.category.SPORTS);
    expect(eventScopeLabel('GRADE', tHi)).toBe(hi.events.scope.GRADE);
    expect(eventStatusLabel('CANCELLED', tHi)).toBe(hi.events.status.CANCELLED);
    expect(eventParticipationLabel('POLL', tHi)).toBe(hi.events.participation.POLL);
    expect(eventRsvpLabel('DECLINED', tHi)).toBe(hi.events.detail.rsvp.DECLINED);
    expect(eventResponseLabel('ACCEPTED', tHi)).toBe(hi.events.detail.response.ACCEPTED);
    for (const s of STATUSES) expect(eventStatusLabel(s, tHi)).not.toBe(eventStatusLabel(s, tEn));
  });

  it('show a value a newer server adds as sent, never a raw key', () => {
    expect(eventCategoryLabel('ARTS' as EventCategory, tEn)).toBe('ARTS');
    expect(eventScopeLabel('HOUSE' as EventScope, tHi)).toBe('HOUSE');
    expect(eventStatusLabel('POSTPONED' as EventParticipationStatus, tHi)).toBe('POSTPONED');
    expect(eventParticipationLabel('QUIZ' as EventParticipationType, tEn)).toBe('QUIZ');
    expect(eventRsvpLabel('WAITLIST' as EventRsvpStatus, tEn)).toBe('WAITLIST');
    expect(eventResponseLabel('WAITLIST' as EventRsvpStatus, tHi)).toBe('WAITLIST');
  });
});

describe('eventScopeTag', () => {
  it('says who the event is for, in English as before', () => {
    expect(eventScopeTag({ scope: 'SCHOOL', className: null }, null, tEn)).toBe('School-wide');
    expect(eventScopeTag({ scope: 'GRADE', className: null }, null, tEn)).toBe('Grade');
    expect(eventScopeTag({ scope: 'GRADE', className: '5' }, null, tEn)).toBe('Grade 5');
    expect(eventScopeTag({ scope: 'CLASS', className: null }, null, tEn)).toBe('Class');
    expect(eventScopeTag({ scope: 'CLASS', className: null }, '5 - A', tEn)).toBe('5 - A');
    // A grade event names its grade even when the screen has a class-section label loaded.
    expect(eventScopeTag({ scope: 'GRADE', className: '5' }, '5 - A', tEn)).toBe('Grade 5');
  });

  it('says it in Hindi, keeping the class name and the class-section label as data', () => {
    expect(eventScopeTag({ scope: 'SCHOOL', className: null }, null, tHi)).toBe(hi.events.scopeTag.school);
    expect(eventScopeTag({ scope: 'GRADE', className: null }, null, tHi)).toBe(hi.events.scopeTag.grade);
    expect(eventScopeTag({ scope: 'GRADE', className: '5' }, null, tHi)).toBe(
      fill(hi.events.scopeTag.gradeNamed, { className: '5' })
    );
    expect(eventScopeTag({ scope: 'CLASS', className: null }, null, tHi)).toBe(hi.events.scopeTag.class);
    expect(eventScopeTag({ scope: 'CLASS', className: null }, '5 - A', tHi)).toBe('5 - A');
  });

  it('has no tag without a scope, and shows a new scope as sent', () => {
    expect(eventScopeTag({ scope: null, className: null }, null, tEn)).toBe('');
    expect(eventScopeTag({ scope: 'HOUSE' as EventScope, className: null }, null, tHi)).toBe('HOUSE');
  });

  it('matches en.json, so a reworded key shows up here', () => {
    expect(eventScopeTag({ scope: 'GRADE', className: '7' }, null, tEn)).toBe(
      fill(en.events.scopeTag.gradeNamed, { className: '7' })
    );
  });
});
