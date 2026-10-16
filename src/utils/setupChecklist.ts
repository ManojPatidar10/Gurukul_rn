import type { Employee, School } from '../api/types';

export type SetupStepId = 'classes' | 'students' | 'teachers' | 'location' | 'parents';

export const SETUP_STEP_ORDER: SetupStepId[] = ['classes', 'students', 'teachers', 'location', 'parents'];

export interface SetupStep {
  id: SetupStepId;
  done: boolean;
}

/**
 * What a newly registered school still has to do before it runs day to day, worked out from the
 * data the principal home already loads. "Tell the parents" has no server-side trace (parents sign
 * in with the phone on the register), so the app remembers it locally once the share sheet opened.
 */
export function setupSteps(
  school: Pick<School, 'classSectionCount' | 'studentCount' | 'latitude'> | null,
  employees: Pick<Employee, 'employeeType' | 'status'>[] | null,
  parentsTold: boolean
): SetupStep[] {
  const hasTeacher = (employees ?? []).some((e) => e.employeeType === 'TEACHING' && e.status !== 'INACTIVE');
  return [
    { id: 'classes', done: (school?.classSectionCount ?? 0) > 0 },
    { id: 'students', done: (school?.studentCount ?? 0) > 0 },
    { id: 'teachers', done: hasTeacher },
    { id: 'location', done: school?.latitude != null },
    { id: 'parents', done: parentsTold },
  ];
}

export function setupComplete(steps: SetupStep[]): boolean {
  return steps.every((s) => s.done);
}

/** The first step still open - the one the card's main button goes to. */
export function nextSetupStep(steps: SetupStep[]): SetupStep | undefined {
  return steps.find((s) => !s.done);
}
