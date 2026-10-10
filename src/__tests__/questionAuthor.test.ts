import type { QuizQuestionResponse, TeacherSubjectAssignment } from '../api/types';
import hi from '../i18n/locales/hi.json';
import {
  draftFromQuestion,
  emptyQuestionDraft,
  questionSaveHint,
  reportWarning,
  teachableClassNames,
  teachableSubjects,
  toCreateQuestionRequest,
  toUpdateQuestionRequest,
} from '../utils/questionAuthor';
import { validateBankDraft } from '../utils/quizBank';
import { fill, tEn, tHi } from './i18nFixture';

function assignment(subjectId: string, subjectName: string, className: string, section = 'A'): TeacherSubjectAssignment {
  return {
    sectionId: `${className}-${section}`,
    className,
    section,
    academicYear: '2026-27',
    subjectId,
    subjectName,
    subjectCode: subjectName.slice(0, 3).toUpperCase(),
  };
}

const ASSIGNMENTS = [
  assignment('sci', 'Science', 'Grade 8', 'A'),
  assignment('math', 'Maths', 'Grade 10', 'A'),
  assignment('sci', 'Science', 'Grade 8', 'B'),
  assignment('math', 'Maths', 'Grade 9', 'B'),
  assignment('math', 'Maths', ' Grade 9 ', 'C'),
  assignment('eng', 'English', 'Grade 8', 'A'),
];

describe('teachableSubjects / teachableClassNames', () => {
  it('lists each subject a teacher teaches once, sorted by name', () => {
    expect(teachableSubjects(ASSIGNMENTS)).toEqual([
      { id: 'eng', name: 'English' },
      { id: 'math', name: 'Maths' },
      { id: 'sci', name: 'Science' },
    ]);
    expect(teachableSubjects([])).toEqual([]);
  });

  it("lists each grade once for the chosen subject, trimmed and in number order", () => {
    expect(teachableClassNames(ASSIGNMENTS, 'math')).toEqual(['Grade 9', 'Grade 10']);
    expect(teachableClassNames(ASSIGNMENTS, 'sci')).toEqual(['Grade 8']);
    expect(teachableClassNames(ASSIGNMENTS, 'art')).toEqual([]);
    expect(teachableClassNames(ASSIGNMENTS, null)).toEqual([]);
  });
});

function savedQuestion(partial: Partial<QuizQuestionResponse>): QuizQuestionResponse {
  return {
    id: 'q1',
    className: 'Grade 8',
    questionText: 'What is 2 + 2?',
    optionA: '3',
    optionB: '4',
    optionC: '5',
    optionD: '6',
    correctOption: 'B',
    createdByEmployeeId: 'e1',
    createdByEmployeeName: 'Ms Rao',
    ...partial,
  };
}

describe('question form', () => {
  it('starts with no answer chosen, and Save waits for one', () => {
    const draft = emptyQuestionDraft();
    expect(draft.correctOption).toBeNull();
    expect(questionSaveHint(draft, false, tEn)).toBe('Pick a subject and a class');
    expect(questionSaveHint(draft, true, tEn)).toBe('Tap the correct answer');
    expect(questionSaveHint({ ...draft, correctOption: 'C' }, true, tEn)).toBeNull();
    // Typed-answer questions (edit only) have no option to tap.
    expect(questionSaveHint({ ...draft, questionType: 'NUMERIC' }, true, tEn)).toBeNull();
    expect(questionSaveHint(draft, true, tHi)).toBe(hi.questionBank.author.saveHint.tapCorrect);
  });

  it('catches duplicate options and a missing answer before sending', () => {
    const draft = {
      ...emptyQuestionDraft(),
      questionText: 'Capital of India?',
      options: ['Delhi', 'Mumbai', ' delhi ', 'Pune'] as [string, string, string, string],
    };
    expect(validateBankDraft(draft)).toBe('optionsDuplicate');
    expect(validateBankDraft({ ...draft, options: ['Delhi', 'Mumbai', 'Chennai', 'Pune'] })).toBe('correctOption');
  });

  it('builds the create request, trimmed, with the explanation only when there is one', () => {
    const draft = {
      ...emptyQuestionDraft(),
      questionText: '  Capital of India? ',
      options: [' Delhi', 'Mumbai ', 'Chennai', 'Pune'] as [string, string, string, string],
      correctOption: 'A' as const,
    };
    expect(toCreateQuestionRequest('geo', ' Grade 8 ', draft)).toEqual({
      subjectId: 'geo',
      className: 'Grade 8',
      questionText: 'Capital of India?',
      optionA: 'Delhi',
      optionB: 'Mumbai',
      optionC: 'Chennai',
      optionD: 'Pune',
      correctOption: 'A',
    });
    expect(toCreateQuestionRequest('geo', 'Grade 8', { ...draft, explanation: ' It is the capital. ' }).explanation).toBe(
      'It is the capital.'
    );
    expect(() => toCreateQuestionRequest('geo', 'Grade 8', { ...draft, correctOption: null })).toThrow();
  });

  it('loads a saved MCQ for editing and sends a full replacement, clearing a blank explanation', () => {
    const draft = draftFromQuestion(savedQuestion({ explanation: '2 + 2 = 4' }));
    expect(draft).toMatchObject({ questionType: 'MCQ', correctOption: 'B', explanation: '2 + 2 = 4' });
    expect(toUpdateQuestionRequest(draft)).toEqual({
      questionText: 'What is 2 + 2?',
      optionA: '3',
      optionB: '4',
      optionC: '5',
      optionD: '6',
      correctOption: 'B',
      explanation: '2 + 2 = 4',
    });
    expect(toUpdateQuestionRequest({ ...draft, explanation: '   ' }).explanation).toBeNull();
  });

  it('edits a typed-answer question through its answer only', () => {
    const draft = draftFromQuestion(
      savedQuestion({
        questionType: 'SHORT_WORD',
        optionA: null,
        optionB: null,
        optionC: null,
        optionD: null,
        correctOption: null,
        answerText: 'Oxygen',
      })
    );
    expect(draft.questionType).toBe('SHORT_WORD');
    expect(toUpdateQuestionRequest({ ...draft, answerText: ' New   Delhi ' })).toEqual({
      questionText: 'What is 2 + 2?',
      answerText: 'New Delhi',
      explanation: null,
    });
  });

  it('treats a question from an older server (no type) as MCQ', () => {
    expect(draftFromQuestion(savedQuestion({})).questionType).toBe('MCQ');
  });
});

describe('reportWarning', () => {
  it('counts the students who reported a wrong answer', () => {
    expect(reportWarning(1, tEn)).toBe('1 student reported a wrong answer');
    expect(reportWarning(3, tEn)).toBe('3 students reported a wrong answer');
    expect(reportWarning(0, tEn)).toBeNull();
    expect(reportWarning(undefined, tEn)).toBeNull();
  });

  it('picks the singular for 1 and the plural for more, in Hindi too', () => {
    expect(reportWarning(1, tHi)).toBe(fill(hi.questionBank.myQuestions.reportWarning_one, { count: 1 }));
    expect(reportWarning(3, tHi)).toBe(fill(hi.questionBank.myQuestions.reportWarning_other, { count: 3 }));
  });
});
