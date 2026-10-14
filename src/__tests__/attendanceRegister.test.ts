import { registerStudents } from '../utils/attendanceRegister';

const pupil = (id: string, status: string) => ({ id, name: `Pupil ${id}`, status });

describe('registerStudents', () => {
  it('drops pupils who left (withdrawn or alumni) and keeps the rest in the order given', () => {
    const section = [
      pupil('3', 'ACTIVE'),
      pupil('1', 'WITHDRAWN'),
      pupil('2', 'ACTIVE'),
      pupil('4', 'ALUMNI'),
      pupil('5', 'ACTIVE'),
    ];
    expect(registerStudents(section).map((s) => s.id)).toEqual(['3', '2', '5']);
  });

  it('lists nobody when nobody in the section still attends', () => {
    expect(registerStudents([pupil('1', 'WITHDRAWN'), pupil('2', 'ALUMNI')])).toEqual([]);
  });

  it('handles an empty section', () => {
    expect(registerStudents([])).toEqual([]);
  });

  it('keeps the whole student record, unchanged', () => {
    const active = pupil('1', 'ACTIVE');
    expect(registerStudents([active])[0]).toBe(active);
  });
});
