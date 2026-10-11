import type { Employee } from '../api/types';
import { visibleEmployeeFields } from '../utils/employeeFields';

type DetailValues = Pick<Employee, 'designation' | 'joinDate' | 'bankAccount' | 'contactPhone'>;

const full: DetailValues = {
  designation: 'Teacher',
  joinDate: '2024-06-01',
  bankAccount: '123456789012',
  contactPhone: '9876543210',
};

// What the backend sends a teacher looking at a colleague: join date and bank account hidden.
const colleague: DetailValues = { ...full, joinDate: null, bankAccount: null };

// What the backend sends a student or parent: only name, designation and status.
const publicView: DetailValues = { designation: 'Teacher', joinDate: null, bankAccount: null, contactPhone: null };

describe('visibleEmployeeFields', () => {
  it('shows an admin every row, including the bank account', () => {
    expect(visibleEmployeeFields(full, true)).toEqual(['designation', 'joinDate', 'bankAccount', 'contactPhone']);
  });

  it("keeps an admin's empty rows so they can see what is missing", () => {
    expect(visibleEmployeeFields(publicView, true)).toEqual(['designation', 'joinDate', 'bankAccount', 'contactPhone']);
  });

  it('hides the join date row from a teacher viewing a colleague, keeping the phone', () => {
    expect(visibleEmployeeFields(colleague, false)).toEqual(['designation', 'contactPhone']);
  });

  it('shows a student or parent only the designation', () => {
    expect(visibleEmployeeFields(publicView, false)).toEqual(['designation']);
  });

  it('never shows a non-admin the bank account row, even when the value is sent (their own record)', () => {
    expect(visibleEmployeeFields(full, false)).toEqual(['designation', 'joinDate', 'contactPhone']);
  });

  it('treats blank strings and missing fields like null for a non-admin', () => {
    const blank = { designation: '  ', joinDate: '', bankAccount: null, contactPhone: undefined } as unknown as DetailValues;
    expect(visibleEmployeeFields(blank, false)).toEqual([]);
  });
});
