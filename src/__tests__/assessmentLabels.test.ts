import { ApiError } from '../api/client';
import type { AssessmentType } from '../api/types';
import hi from '../i18n/locales/hi.json';
import { assessmentTypeLabel, hasMarksMessage } from '../utils/assessmentLabels';
import { fill, tEn, tHi } from './i18nFixture';

jest.mock('../api/authStorage', () => ({ setStoredSession: jest.fn(() => Promise.resolve()) }));

const SERVER_MESSAGE = '3 students have marks, Absent or a remark saved for this assessment.';

function refused(data: unknown): ApiError {
  return new ApiError(SERVER_MESSAGE, 409, 'ASSESSMENT_HAS_MARKS', data);
}

describe('assessmentTypeLabel', () => {
  it('names each type in words, not the raw value', () => {
    expect(assessmentTypeLabel('ASSIGNMENT', tEn)).toBe('Assignment');
    expect(assessmentTypeLabel('QUIZ', tEn)).toBe('Quiz');
    expect(assessmentTypeLabel('TEST', tEn)).toBe('Test');
    expect(assessmentTypeLabel('EXAM', tEn)).toBe('Exam');
    expect(assessmentTypeLabel('EXAM', tHi)).toBe(hi.assessments.types.EXAM);
  });

  it('shows a type a newer server adds as sent', () => {
    expect(assessmentTypeLabel('PROJECT' as AssessmentType, tEn)).toBe('PROJECT');
  });
});

describe('hasMarksMessage', () => {
  it('says how many students have something saved, and how many of them moved class', () => {
    const one =
      "1 student has marks, an absence or a remark saved for this assessment, so it can't be deleted. Clear it on the Enter results screen first.";
    const three =
      "3 students have marks, absences or remarks saved for this assessment, so it can't be deleted. Clear them on the Enter results screen first.";
    expect(hasMarksMessage(refused({ studentsWithMarks: 1, movedStudentsWithMarks: 0 }), tEn)).toBe(one);
    expect(hasMarksMessage(refused({ studentsWithMarks: 1, movedStudentsWithMarks: 1 }), tEn)).toBe(
      `${one} 1 of them has since moved to another class.`
    );
    expect(hasMarksMessage(refused({ studentsWithMarks: 1, movedStudentsWithMarks: 2 }), tEn)).toBe(
      `${one} 2 of them have since moved to another class.`
    );
    expect(hasMarksMessage(refused({ studentsWithMarks: 3, movedStudentsWithMarks: 0 }), tEn)).toBe(three);
    expect(hasMarksMessage(refused({ studentsWithMarks: 3, movedStudentsWithMarks: 1 }), tEn)).toBe(
      `${three} 1 of them has since moved to another class.`
    );
    expect(hasMarksMessage(refused({ studentsWithMarks: 3, movedStudentsWithMarks: 2 }), tEn)).toBe(
      `${three} 2 of them have since moved to another class.`
    );
    // No moved count at all (a server that only sends the first) is the same as none moved.
    expect(hasMarksMessage(refused({ studentsWithMarks: 3 }), tEn)).toBe(three);
  });

  it('says it in Hindi', () => {
    expect(hasMarksMessage(refused({ studentsWithMarks: 3, movedStudentsWithMarks: 1 }), tHi)).toBe(
      `${fill(hi.assessments.detail.hasMarks_other, { count: 3 })} ${fill(hi.assessments.detail.movedStudents_one, { count: 1 })}`
    );
  });

  it("falls back to the server's message when the counts are missing or make no sense", () => {
    // An older server sends no data.
    expect(hasMarksMessage(new ApiError(SERVER_MESSAGE, 409, 'ASSESSMENT_HAS_MARKS'), tEn)).toBe(SERVER_MESSAGE);
    expect(hasMarksMessage(refused(null), tEn)).toBe(SERVER_MESSAGE);
    expect(hasMarksMessage(refused('3'), tEn)).toBe(SERVER_MESSAGE);
    expect(hasMarksMessage(refused({ studentsWithMarks: '3' }), tEn)).toBe(SERVER_MESSAGE);
    expect(hasMarksMessage(refused({ studentsWithMarks: 0, movedStudentsWithMarks: 0 }), tEn)).toBe(SERVER_MESSAGE);
    expect(hasMarksMessage(refused({ studentsWithMarks: 2.5 }), tEn)).toBe(SERVER_MESSAGE);
    expect(hasMarksMessage(refused({ studentsWithMarks: Number.NaN }), tEn)).toBe(SERVER_MESSAGE);
    expect(hasMarksMessage(refused({ studentsWithMarks: Number.POSITIVE_INFINITY }), tEn)).toBe(SERVER_MESSAGE);
  });

  it('leaves out a moved count that is not a whole number', () => {
    const three = hasMarksMessage(refused({ studentsWithMarks: 3 }), tEn);
    expect(hasMarksMessage(refused({ studentsWithMarks: 3, movedStudentsWithMarks: '1' }), tEn)).toBe(three);
    expect(hasMarksMessage(refused({ studentsWithMarks: 3, movedStudentsWithMarks: -1 }), tEn)).toBe(three);
  });
});
