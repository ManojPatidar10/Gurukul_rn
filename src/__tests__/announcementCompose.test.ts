import type { AnnouncementAudiences, AnnouncementAudienceSection } from '../api/types';
import {
  NOTICE_LIMITS,
  audienceKinds,
  canSend,
  chosenAudience,
  confirmKey,
  hasAudience,
  mayPostNotices,
  normaliseBody,
  normaliseTitle,
  sectionLabel,
  showYears,
  sortGrades,
  sortSections,
  toCreateRequest,
  type NoticeAudience,
} from '../utils/announcementCompose';

function section(className: string, name: string, academicYear = '2026-27'): AnnouncementAudienceSection {
  return {
    sectionId: `${className}-${name}-${academicYear}`,
    className,
    section: name,
    academicYear,
    displayLabel: `${className} - ${name} (${academicYear})`,
  };
}

const ADMIN: AnnouncementAudiences = {
  canPost: true,
  school: true,
  sections: [section('Grade 8', 'A'), section('Grade 8', 'B')],
  grades: ['Grade 8'],
};
const TEACHER: AnnouncementAudiences = { canPost: true, school: false, sections: [section('Grade 8', 'A')], grades: ['Grade 8'] };
const NONE: AnnouncementAudiences = { canPost: false, school: false, sections: [], grades: [] };

const SCHOOL: NoticeAudience = { kind: 'SCHOOL' };
const CLASS: NoticeAudience = { kind: 'CLASS', sectionId: 's1' };
const GRADE: NoticeAudience = { kind: 'GRADE', className: 'Grade 8' };

describe('mayPostNotices', () => {
  it('asks the server only for admins and teachers', () => {
    expect(mayPostNotices('ADMIN')).toBe(true);
    expect(mayPostNotices('TEACHER')).toBe(true);
    for (const role of ['STUDENT', 'PARENT', 'DRIVER', null, undefined] as const) {
      expect(mayPostNotices(role)).toBe(false);
    }
  });
});

describe('audienceKinds / hasAudience', () => {
  it('offers an admin the whole school, a section and a class, in that order', () => {
    expect(audienceKinds(ADMIN)).toEqual(['SCHOOL', 'CLASS', 'GRADE']);
    expect(hasAudience(ADMIN)).toBe(true);
  });

  it('offers a class teacher their section and its class, never the whole school', () => {
    expect(audienceKinds(TEACHER)).toEqual(['CLASS', 'GRADE']);
    expect(hasAudience(TEACHER)).toBe(true);
  });

  it('offers nothing to someone who may not post', () => {
    expect(audienceKinds(NONE)).toEqual([]);
    expect(hasAudience(NONE)).toBe(false);
    expect(hasAudience(null)).toBe(false);
    expect(hasAudience(undefined)).toBe(false);
  });

  it('shows no form when canPost is true but there is nothing to offer, or canPost is false', () => {
    expect(hasAudience({ ...NONE, canPost: true })).toBe(false);
    expect(hasAudience({ ...TEACHER, canPost: false })).toBe(false);
  });
});

describe('sortSections / sortGrades', () => {
  it('puts Grade 2 before Grade 10 (numeric, not plain string order)', () => {
    const sorted = sortSections([section('Grade 10', 'A'), section('Grade 2', 'B'), section('Grade 2', 'A')]);
    expect(sorted.map((s) => `${s.className}/${s.section}`)).toEqual(['Grade 2/A', 'Grade 2/B', 'Grade 10/A']);
    expect(sortGrades(['Grade 10', 'Grade 2', 'Grade 1'])).toEqual(['Grade 1', 'Grade 2', 'Grade 10']);
  });

  it('lists the latest academic year first for the same section', () => {
    const sorted = sortSections([section('Grade 8', 'A', '2025-26'), section('Grade 8', 'A', '2026-27')]);
    expect(sorted.map((s) => s.academicYear)).toEqual(['2026-27', '2025-26']);
  });

  it('does not change the lists it is given, and lists each class once', () => {
    const sections = [section('Grade 10', 'A'), section('Grade 2', 'A')];
    const grades = ['Grade 10', 'Grade 2', 'Grade 10'];
    sortSections(sections);
    expect(sortGrades(grades)).toEqual(['Grade 2', 'Grade 10']);
    expect(sections[0].className).toBe('Grade 10');
    expect(grades).toEqual(['Grade 10', 'Grade 2', 'Grade 10']);
  });
});

describe('sectionLabel / showYears', () => {
  it('names the class and section, with the year only when asked', () => {
    expect(sectionLabel(section('Grade 8', 'A'), false)).toBe('Grade 8 - A');
    expect(sectionLabel(section('Grade 8', 'A'), true)).toBe('Grade 8 - A (2026-27)');
  });

  it('needs the year only when the sections span more than one academic year', () => {
    expect(showYears([section('Grade 8', 'A'), section('Grade 9', 'A')])).toBe(false);
    expect(showYears([section('Grade 8', 'A', '2025-26'), section('Grade 8', 'A', '2026-27')])).toBe(true);
    expect(showYears([])).toBe(false);
  });
});

describe('normaliseTitle / normaliseBody (the server rules)', () => {
  it('makes the title one line with single spaces', () => {
    expect(normaliseTitle('  Holiday \n tomorrow ')).toBe('Holiday tomorrow');
    expect(normaliseTitle('a\t\tb\r\nc')).toBe('a b c');
    expect(normaliseTitle(' \n\t ')).toBe('');
  });

  it('keeps the body line breaks, as \\n, and trims its ends', () => {
    expect(normaliseBody('\r\n Line 1\r\nLine 2\rLine 3 \n')).toBe('Line 1\nLine 2\nLine 3');
    expect(normaliseBody('Para 1\n\n  Para 2')).toBe('Para 1\n\n  Para 2');
    expect(normaliseBody('  \r\n ')).toBe('');
  });
});

describe('chosenAudience', () => {
  it('is complete only once the section or class is picked', () => {
    expect(chosenAudience(null, null, null)).toBeNull();
    expect(chosenAudience('SCHOOL', null, null)).toEqual({ kind: 'SCHOOL' });
    expect(chosenAudience('CLASS', null, 'Grade 8')).toBeNull();
    expect(chosenAudience('CLASS', 's1', null)).toEqual({ kind: 'CLASS', sectionId: 's1' });
    expect(chosenAudience('GRADE', 's1', null)).toBeNull();
    expect(chosenAudience('GRADE', null, 'Grade 8')).toEqual({ kind: 'GRADE', className: 'Grade 8' });
  });
});

describe('canSend', () => {
  const text = (n: number) => 'x'.repeat(n);

  it('needs a title of 1 to 200 characters', () => {
    expect(canSend(SCHOOL, text(0), 'Body')).toBe(false);
    expect(canSend(SCHOOL, text(1), 'Body')).toBe(true);
    expect(canSend(SCHOOL, text(NOTICE_LIMITS.title), 'Body')).toBe(true);
    expect(canSend(SCHOOL, text(NOTICE_LIMITS.title + 1), 'Body')).toBe(false);
  });

  it('needs a message of 1 to 4000 characters', () => {
    expect(canSend(SCHOOL, 'Title', text(0))).toBe(false);
    expect(canSend(SCHOOL, 'Title', text(1))).toBe(true);
    expect(canSend(SCHOOL, 'Title', text(NOTICE_LIMITS.body))).toBe(true);
    expect(canSend(SCHOOL, 'Title', text(NOTICE_LIMITS.body + 1))).toBe(false);
  });

  it('measures the text as the server will store it', () => {
    expect(canSend(SCHOOL, '   \n ', 'Body')).toBe(false);
    expect(canSend(SCHOOL, 'Title', ' \r\n ')).toBe(false);
    // 201 typed characters that normalise to 200 are fine.
    expect(canSend(SCHOOL, ` ${text(NOTICE_LIMITS.title)}`, 'Body')).toBe(true);
  });

  it('needs the audience fully chosen', () => {
    expect(canSend(null, 'Title', 'Body')).toBe(false);
    expect(canSend(chosenAudience('CLASS', null, null), 'Title', 'Body')).toBe(false);
    expect(canSend({ kind: 'CLASS', sectionId: '' }, 'Title', 'Body')).toBe(false);
    expect(canSend({ kind: 'GRADE', className: '' }, 'Title', 'Body')).toBe(false);
    expect(canSend(CLASS, 'Title', 'Body')).toBe(true);
    expect(canSend(GRADE, 'Title', 'Body')).toBe(true);
  });
});

describe('toCreateRequest', () => {
  it('sends only the scope’s own target field, with the normalised text', () => {
    expect(toCreateRequest(SCHOOL, ' School \n closed ', ' Body\r\n ')).toEqual({
      scope: 'SCHOOL',
      title: 'School closed',
      body: 'Body',
    });
    expect(toCreateRequest(CLASS, 'T', 'B')).toEqual({ scope: 'CLASS', sectionId: 's1', title: 'T', body: 'B' });
    expect(toCreateRequest(GRADE, 'T', 'B')).toEqual({ scope: 'GRADE', className: 'Grade 8', title: 'T', body: 'B' });
  });
});

describe('confirmKey', () => {
  it('names who is notified for each audience', () => {
    expect(confirmKey(SCHOOL)).toBe('confirmSchool');
    expect(confirmKey(CLASS)).toBe('confirmSection');
    expect(confirmKey(GRADE)).toBe('confirmGrade');
  });
});
