import type { ClassSection } from '../api/types';

/** The classes an Indian K-12 school can pick from, in school order. */
export const CLASS_CHOICES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
export const SECTION_CHOICES = ['A', 'B', 'C', 'D'];

/**
 * The school year as the app labels it: April to March, so "2026-27" from April 2026 up to
 * March 2027 (the same rule as the Jan-Mar guard in the admissions flow).
 */
export function currentAcademicYear(now: Date = new Date()): string {
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

export interface ClassSectionPlan {
  className: string;
  section: string;
  academicYear: string;
}

/**
 * Every (class, section) pair from the chosen chips that the school does not have yet for the
 * given year. Comparison ignores case, so an existing "lkg A" is not created again as "LKG A".
 */
export function planClassSections(
  classes: string[],
  sections: string[],
  existing: ClassSection[],
  academicYear: string
): ClassSectionPlan[] {
  const have = new Set(
    existing
      .filter((cs) => cs.academicYear === academicYear)
      .map((cs) => `${cs.className.toLowerCase()}|${cs.section.toLowerCase()}`)
  );
  const plan: ClassSectionPlan[] = [];
  for (const className of classes) {
    for (const section of sections) {
      if (!have.has(`${className.toLowerCase()}|${section.toLowerCase()}`)) plan.push({ className, section, academicYear });
    }
  }
  return plan;
}
