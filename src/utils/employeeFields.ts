import type { Employee } from '../api/types';

/** The rows of the staff detail card, in display order. */
export type EmployeeDetailField = 'designation' | 'joinDate' | 'bankAccount' | 'contactPhone';

const DETAIL_FIELDS: EmployeeDetailField[] = ['designation', 'joinDate', 'bankAccount', 'contactPhone'];

function hasValue(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Which rows the staff detail card shows. An admin sees every row, with "—" for an empty one, and
 * is the only viewer shown the bank account row. Anyone else sees a row only when it has a value:
 * the backend sends the fields a viewer may not see as null (a colleague's join date, a student's
 * view of a teacher's phone), and a row of "—" would only say something is being kept back.
 */
export function visibleEmployeeFields(
  employee: Pick<Employee, EmployeeDetailField>,
  isViewerAdmin: boolean
): EmployeeDetailField[] {
  return DETAIL_FIELDS.filter((field) => {
    if (isViewerAdmin) return true;
    return field !== 'bankAccount' && hasValue(employee[field]);
  });
}
