import { nextSetupStep, setupComplete, setupSteps } from '../utils/setupChecklist';

const teacher = { employeeType: 'TEACHING' as const, status: 'ACTIVE' };
const leftTeacher = { employeeType: 'TEACHING' as const, status: 'INACTIVE' };
const clerk = { employeeType: 'NON_TEACHING' as const, status: 'ACTIVE' };

describe('setupSteps', () => {
  it('starts with everything open for a school that just registered', () => {
    const steps = setupSteps({ classSectionCount: 0, studentCount: 0, latitude: null }, [clerk], false);
    expect(steps.map((s) => s.done)).toEqual([false, false, false, false, false]);
    expect(nextSetupStep(steps)?.id).toBe('classes');
    expect(setupComplete(steps)).toBe(false);
  });

  it('treats nothing as done while the data has not loaded', () => {
    expect(setupSteps(null, null, false).every((s) => !s.done)).toBe(true);
  });

  it('counts only a current teaching employee as a teacher', () => {
    const school = { classSectionCount: 1, studentCount: 1, latitude: 23.1 };
    expect(setupSteps(school, [clerk, leftTeacher], true).find((s) => s.id === 'teachers')?.done).toBe(false);
    const steps = setupSteps(school, [clerk, teacher], true);
    expect(setupComplete(steps)).toBe(true);
    expect(nextSetupStep(steps)).toBeUndefined();
  });
});
