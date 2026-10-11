import type { ReportCardPublishCheck, TermSummary } from '../api/types';
import en from '../i18n/locales/en.json';
import hi from '../i18n/locales/hi.json';
import { fill, tEn, tHi } from '../testUtils/i18nFixture';
import { canonicalTerm, defaultSectionTerm, findExistingTerm } from '../utils/assessmentTerms';
import { formatOverallGrade, formatOverallPercentage, missingMarksCount } from '../utils/reportCardDisplay';
import {
  canPublish,
  nothingToPublishMessage,
  publishConfirmation,
  publishWarnings,
  unpublishReasonError,
} from '../utils/reportCardPublish';

const check = (overrides: Partial<ReportCardPublishCheck> = {}): ReportCardPublishCheck => ({
  term: 'Term 1',
  assessmentCount: 8,
  untermedAssessmentCount: 0,
  studentCount: 30,
  studentsWithMissingMarks: 0,
  missingMarksCount: 0,
  alreadyPublished: false,
  publishedAt: null,
  ...overrides,
});

const formatDate = (iso: string) => `<${iso}>`;

describe('term canonicalisation', () => {
  const existing = ['Annual', 'Term 1', 'Term 2'];

  it('snaps a different case or stray spaces to the spelling the section already uses', () => {
    expect(findExistingTerm(' term 1 ', existing)).toBe('Term 1');
    expect(canonicalTerm('TERM 2', existing)).toBe('Term 2');
    expect(canonicalTerm('annual', existing)).toBe('Annual');
  });

  it('prefers an exact match over a case variant, like the server', () => {
    // Old data can hold both spellings; the server keeps an exact match, so the app must too.
    for (const variants of [
      ['Term 1', 'term 1'],
      ['term 1', 'Term 1'],
    ]) {
      expect(findExistingTerm('term 1', variants)).toBe('term 1');
      expect(findExistingTerm('Term 1', variants)).toBe('Term 1');
      expect(findExistingTerm(' term 1 ', variants)).toBe('term 1');
    }
    // No exact match: the first case variant in the server's order, as the server picks.
    expect(canonicalTerm('TERM 1', ['Term 1', 'term 1'])).toBe('Term 1');
    expect(canonicalTerm('TERM 1', ['term 1', 'Term 1'])).toBe('term 1');
  });

  it('keeps a new term as typed, trimmed', () => {
    expect(findExistingTerm('Term1', existing)).toBeNull();
    expect(canonicalTerm('  Half yearly ', existing)).toBe('Half yearly');
    expect(canonicalTerm('   ', existing)).toBe('');
    expect(findExistingTerm('', existing)).toBeNull();
  });
});

describe('defaultSectionTerm', () => {
  const terms = (...list: [string, boolean][]): TermSummary[] => list.map(([term, published]) => ({ term, published }));

  it('opens on the latest published term', () => {
    expect(defaultSectionTerm(terms(['Term 1', true], ['Term 2', true], ['Term 3', false]))).toBe('Term 2');
  });

  it('falls back to the first term when none is published', () => {
    expect(defaultSectionTerm(terms(['Term 1', false], ['Term 2', false]))).toBe('Term 1');
  });

  it('is null when the section has no terms - never a guessed "Term 1"', () => {
    expect(defaultSectionTerm([])).toBeNull();
  });
});

describe('report card display', () => {
  it('shows a dash, not 0% or F, when there is no overall result', () => {
    expect(formatOverallPercentage(null)).toBe('—');
    expect(formatOverallPercentage(undefined)).toBe('—');
    expect(formatOverallGrade(null)).toBe('—');
    expect(formatOverallGrade('')).toBe('—');
  });

  it('shows real values as they are, including a real 0%', () => {
    expect(formatOverallPercentage(0)).toBe('0%');
    expect(formatOverallPercentage(72.5)).toBe('72.5%');
    expect(formatOverallGrade('F')).toBe('F');
  });

  it('reads a missing or bad missingMarksCount as none', () => {
    expect(missingMarksCount(3)).toBe(3);
    expect(missingMarksCount(0)).toBe(0);
    expect(missingMarksCount(undefined)).toBe(0);
    expect(missingMarksCount(null)).toBe(0);
    expect(missingMarksCount(-1)).toBe(0);
  });
});

describe('publish check', () => {
  it('refuses a term no assessment uses', () => {
    expect(canPublish(check({ assessmentCount: 0 }))).toBe(false);
    expect(canPublish(check())).toBe(true);
    expect(nothingToPublishMessage(check({ assessmentCount: 0 }), tEn)).toBe(
      'No assessment in this section has the term "Term 1", so every report card would be empty.'
    );
    expect(nothingToPublishMessage(check({ assessmentCount: 0 }), tHi)).toBe(
      fill(hi.reportCardPublish.nothingMessage, { term: 'Term 1' })
    );
  });

  it('has no warnings for a complete, first-time publish', () => {
    expect(publishWarnings(check())).toEqual([]);
  });

  it('warns about missing marks, un-termed assessments, an empty section and a re-publish', () => {
    expect(
      publishWarnings(
        check({
          studentCount: 0,
          studentsWithMissingMarks: 3,
          missingMarksCount: 5,
          untermedAssessmentCount: 2,
          alreadyPublished: true,
          publishedAt: '2026-10-01T10:00:00Z',
        })
      )
    ).toEqual([
      { code: 'noStudents' },
      { code: 'missingMarks', students: 3, marks: 5 },
      { code: 'untermedAssessments', count: 2 },
      { code: 'alreadyPublished', publishedAt: '2026-10-01T10:00:00Z' },
    ]);
  });
});

describe('publishConfirmation', () => {
  it('gives the counts and says families are notified, marks lock and an admin can unpublish', () => {
    const { title, message } = publishConfirmation(check(), formatDate, tEn);
    expect(title).toBe('Publish "Term 1" report cards?');
    expect(message).toContain('30 students · 8 assessments in "Term 1".');
    expect(message).toContain('Every student and parent in this section will be notified.');
    expect(message).toContain('Marks for every assessment in "Term 1" will be locked.');
    expect(message).toContain("An admin can unpublish these later with a reason. Families aren't told when that happens.");
    expect(message).not.toContain('no undo');
    expect(message).not.toContain('•');
  });

  it('says when the term was unpublished before, by whom and why, and that families are notified again', () => {
    const unpublished = check({
      lastUnpublishedAt: '2026-10-05T09:30:00Z',
      lastUnpublishedByName: 'Meera Joshi',
      lastUnpublishReason: 'Maths marks for roll 12 were wrong',
    });
    expect(publishWarnings(unpublished)).toEqual([
      {
        code: 'previouslyUnpublished',
        unpublishedAt: '2026-10-05T09:30:00Z',
        byName: 'Meera Joshi',
        reason: 'Maths marks for roll 12 were wrong',
      },
    ]);
    const { message } = publishConfirmation(unpublished, formatDate, tEn);
    expect(message).toContain(
      '• "Term 1" was unpublished on <2026-10-05T09:30:00Z> by Meera Joshi: Maths marks for roll 12 were wrong. ' +
        'Publishing it again notifies every family again.'
    );
    expect(message).toContain('Every student and parent in this section will be notified.');
  });

  it('leaves the unpublish warning out for a server without it, and copes with a missing name or reason', () => {
    expect(publishWarnings(check({ lastUnpublishedAt: null }))).toEqual([]);
    const { message } = publishConfirmation(check({ lastUnpublishedAt: '2026-10-05T09:30:00Z' }), formatDate, tEn);
    expect(message).toContain('• "Term 1" was unpublished on <2026-10-05T09:30:00Z>. Publishing it again notifies every family again.');
  });

  it('on a re-publish after an earlier unpublish, keeps to "not notified again"', () => {
    // The server sends the last unpublish even while the term is published again.
    const republish = check({
      alreadyPublished: true,
      publishedAt: '2026-10-07T10:00:00Z',
      lastUnpublishedAt: '2026-10-05T09:30:00Z',
      lastUnpublishedByName: 'Meera Joshi',
      lastUnpublishReason: 'Maths marks for roll 12 were wrong',
    });
    expect(publishWarnings(republish)).toEqual([{ code: 'alreadyPublished', publishedAt: '2026-10-07T10:00:00Z' }]);
    const { message } = publishConfirmation(republish, formatDate, tEn);
    expect(message).toContain('Students and parents are not notified again.');
    expect(message).not.toContain('notifies every family again');
    expect(message).not.toContain('was unpublished');
    expect(message).not.toContain('will be notified');
  });

  it('spells out each warning', () => {
    const { message } = publishConfirmation(
      check({ studentsWithMissingMarks: 1, missingMarksCount: 1, untermedAssessmentCount: 2 }),
      formatDate,
      tEn
    );
    expect(message).toContain('• 1 student has marks missing (1 mark in all).');
    expect(message).toContain('• 2 assessments in this section have no term');
    expect(message).toContain('use "Fix assessments missing a term" first');
  });

  it('says a re-publish notifies nobody and gives the first publish date', () => {
    const { message } = publishConfirmation(
      check({ alreadyPublished: true, publishedAt: '2026-10-01T10:00:00Z' }),
      formatDate,
      tEn
    );
    expect(message).toContain('"Term 1" was already published on <2026-10-01T10:00:00Z>.');
    expect(message).toContain('Students and parents are not notified again.');
    expect(message).not.toContain('will be notified');
    expect(message).toContain('stay locked');
  });

  it('on a re-publish, does not send the admin to a term fix that is refused for this term', () => {
    const { message } = publishConfirmation(
      check({ alreadyPublished: true, publishedAt: '2026-10-01T10:00:00Z', untermedAssessmentCount: 2 }),
      formatDate,
      tEn
    );
    expect(message).toContain('• 2 assessments in this section have no term, so their marks');
    expect(message).toContain(`"Term 1" is already published, so they can't be added to it.`);
    expect(message).toContain('Give them another term');
    expect(message).not.toContain('first: after publishing');
  });

  it('uses singular wording for one of each', () => {
    const { message } = publishConfirmation(check({ studentCount: 1, assessmentCount: 1, untermedAssessmentCount: 1 }), formatDate, tEn);
    expect(message).toContain('1 student · 1 assessment in "Term 1".');
    expect(message).toContain('1 assessment in this section has no term, so its marks');
  });

  it('builds the whole message, line by line, exactly as before', () => {
    const { message } = publishConfirmation(
      check({ studentsWithMissingMarks: 3, missingMarksCount: 5, untermedAssessmentCount: 1 }),
      formatDate,
      tEn
    );
    expect(message).toBe(
      [
        '30 students · 8 assessments in "Term 1".',
        '',
        '• 3 students have marks missing (5 marks in all). Their report cards will say marks are missing.',
        "• 1 assessment in this section has no term, so its marks won't be on any report card. " +
          'If it belongs to "Term 1", use "Fix assessments missing a term" first: after publishing, nothing can be added to "Term 1".',
        '',
        'Every student and parent in this section will be notified.',
        'Marks for every assessment in "Term 1" will be locked.',
        "An admin can unpublish these later with a reason. Families aren't told when that happens.",
      ].join('\n')
    );
  });

  it('words an earlier unpublish with only a name, or only a reason', () => {
    const at = '2026-10-05T09:30:00Z';
    expect(publishConfirmation(check({ lastUnpublishedAt: at, lastUnpublishedByName: 'Meera Joshi' }), formatDate, tEn).message).toContain(
      '• "Term 1" was unpublished on <2026-10-05T09:30:00Z> by Meera Joshi. Publishing it again notifies every family again.'
    );
    expect(publishConfirmation(check({ lastUnpublishedAt: at, lastUnpublishReason: 'Wrong marks' }), formatDate, tEn).message).toContain(
      '• "Term 1" was unpublished on <2026-10-05T09:30:00Z>: Wrong marks. Publishing it again notifies every family again.'
    );
  });

  it('words a re-publish without a date, an empty section, and one locked un-termed assessment', () => {
    const { message } = publishConfirmation(
      check({ alreadyPublished: true, publishedAt: null, studentCount: 0, untermedAssessmentCount: 1 }),
      formatDate,
      tEn
    );
    expect(message).toContain('• This section has no students, so no report cards will be published.');
    expect(message).toContain(
      '• "Term 1" was already published. Publishing again only updates the published date. ' +
        'Students and parents are not notified again.'
    );
    expect(message).toContain(
      `"Term 1" is already published, so it can't be added to it. ` +
        'Give it another term with "Fix assessments missing a term", or edit it.'
    );
  });
});

describe('publishConfirmation in Hindi', () => {
  const c = hi.reportCardPublish.confirm;

  it('translates the title and the counts', () => {
    const { title, message } = publishConfirmation(check(), formatDate, tHi);
    expect(title).toBe(fill(c.title, { term: 'Term 1' }));
    expect(message.split('\n')[0]).toBe(
      fill(c.counts, {
        students: fill(c.students_other, { count: 30 }),
        assessments: fill(c.assessments_other, { count: 8 }),
        term: 'Term 1',
      })
    );
    expect(message).toContain(c.unpublishLater);
  });

  it('uses the singular for 1 student with 1 missing mark', () => {
    const { message } = publishConfirmation(check({ studentsWithMissingMarks: 1, missingMarksCount: 1 }), formatDate, tHi);
    expect(message).toContain(`• ${fill(c.missingMarks_one, { count: 1, marks: fill(c.marks_one, { count: 1 }) })}`);
  });

  it("names the fix button by its Hindi label on a re-publish with un-termed assessments", () => {
    const { message } = publishConfirmation(
      check({ alreadyPublished: true, publishedAt: '2026-10-01T10:00:00Z', untermedAssessmentCount: 2 }),
      formatDate,
      tHi
    );
    expect(message).toContain(
      `• ${fill(c.untermed_other, { count: 2 })} ${fill(c.untermedLocked_other, {
        term: 'Term 1',
        fix: hi.reportCardPublish.fixButton,
      })}`
    );
    expect(message).toContain(fill(c.stayLocked, { term: 'Term 1' }));
  });

  it('keeps the name and reason of an earlier unpublish as typed, quotes and all', () => {
    const reason = 'Marks for "Maths" were <wrong> & late';
    const { message } = publishConfirmation(
      check({ lastUnpublishedAt: '2026-10-05T09:30:00Z', lastUnpublishedByName: "Meera D'Souza", lastUnpublishReason: reason }),
      formatDate,
      tHi
    );
    expect(message).toContain(
      `• ${fill(c.unpublishedByWhy, { term: 'Term 1', date: '<2026-10-05T09:30:00Z>', name: "Meera D'Souza", reason })}`
    );
  });
});

describe('backfill toast', () => {
  it('says "assessment" for one and "assessments" for more', () => {
    expect(tEn('reportCardPublish.backfillDone', { count: 1, term: 'Term 1' })).toBe(
      'Tagged 1 assessment that had no term with "Term 1".'
    );
    expect(tEn('reportCardPublish.backfillDone', { count: 3, term: 'Term 1' })).toBe(
      'Tagged 3 assessments that had no term with "Term 1".'
    );
    expect(en.reportCardPublish.backfillNone).toBe('Every assessment in this section already has a term set.');
    expect(tHi('reportCardPublish.backfillDone', { count: 1, term: 'Term 1' })).toBe(
      fill(hi.reportCardPublish.backfillDone_one, { count: 1, term: 'Term 1' })
    );
  });
});

describe('unpublishReasonError', () => {
  it('wants 5 to 500 characters once trimmed', () => {
    expect(unpublishReasonError('abcd')).toBe('reportCardUnpublish.reasonLength');
    expect(unpublishReasonError('abcde')).toBeNull();
    expect(unpublishReasonError('x'.repeat(500))).toBeNull();
    expect(unpublishReasonError('x'.repeat(501))).toBe('reportCardUnpublish.reasonLength');
    expect(unpublishReasonError('   abcd   ')).toBe('reportCardUnpublish.reasonLength');
    expect(unpublishReasonError('')).toBe('reportCardUnpublish.reasonLength');
  });
});
