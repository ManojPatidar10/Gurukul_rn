import type { ClassSection } from '../api/types';
import { currentAcademicYear, planClassSections } from '../utils/classSetup';

const existing = (className: string, section: string, academicYear = '2026-27'): ClassSection => ({
  id: `${className}${section}`,
  schoolId: 's',
  className,
  section,
  academicYear,
  displayLabel: `${className}-${section}`,
  classTeacherId: null,
  classTeacherName: null,
});

describe('currentAcademicYear', () => {
  it('runs April to March', () => {
    expect(currentAcademicYear(new Date(2026, 9, 15))).toBe('2026-27');
    expect(currentAcademicYear(new Date(2027, 2, 31))).toBe('2026-27');
    expect(currentAcademicYear(new Date(2027, 3, 1))).toBe('2027-28');
    expect(currentAcademicYear(new Date(2099, 5, 1))).toBe('2099-00');
  });
});

describe('planClassSections', () => {
  it('creates every chosen pair the school does not have this year', () => {
    expect(planClassSections(['1', '2'], ['A', 'B'], [existing('1', 'A')], '2026-27')).toEqual([
      { className: '1', section: 'B', academicYear: '2026-27' },
      { className: '2', section: 'A', academicYear: '2026-27' },
      { className: '2', section: 'B', academicYear: '2026-27' },
    ]);
  });

  it('ignores case when deciding what already exists, but not the year', () => {
    expect(planClassSections(['LKG'], ['A'], [existing('lkg', 'a')], '2026-27')).toEqual([]);
    expect(planClassSections(['LKG'], ['A'], [existing('LKG', 'A', '2025-26')], '2026-27')).toHaveLength(1);
  });
});
