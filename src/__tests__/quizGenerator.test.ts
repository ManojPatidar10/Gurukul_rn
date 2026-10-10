import AsyncStorage from '@react-native-async-storage/async-storage';

import { ApiError, NetworkError } from '../api/client';
import { discardQuizDraft, loadQuizDraft, markQuizDraftSaved, quizDraftKey, saveQuizDraft } from '../api/quizDraftStore';
import type { AiQuizGenerationResponse, GeneratedQuizQuestion, TeacherSubjectAssignment } from '../api/types';
import i18n from '../i18n';
import en from '../i18n/locales/en.json';
import {
  assignmentKeyOf,
  bankSelectableNumbers,
  effectiveAssignmentKey,
  markSavedOnDraft,
  mergeSavedNumbers,
  parseStoredQuizDraft,
  questionsForBank,
  quizGenErrorMessage,
  shouldDiscardStoredDraft,
  shouldRestoreDraft,
  type StoredQuizDraft,
} from '../utils/quizGenerator';

jest.mock('../api/authStorage', () => ({ setStoredSession: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.init({ lng: 'en', resources: { en: { translation: en } }, interpolation: { escapeValue: false } });
  }
  await i18n.changeLanguage('en');
});

function question(partial: Partial<GeneratedQuizQuestion>): GeneratedQuizQuestion {
  return { number: 1, questionType: 'MCQ', question: 'Q?', options: ['a', 'b', 'c', 'd'], answer: 'a', explanation: '', marks: 1, ...partial };
}

const questions = [
  question({ number: 1 }),
  question({ number: 2, questionType: 'SHORT_ANSWER', options: [], answer: 'Mitochondria' }),
  question({ number: 3 }),
  question({ number: 4, questionType: 'TRUE_FALSE', options: ['True', 'False'], answer: 'True' }),
  question({ number: 5 }),
];

function draft(partial: Partial<StoredQuizDraft> = {}): StoredQuizDraft {
  const response: AiQuizGenerationResponse = {
    schoolId: 's1',
    teacherId: 't1',
    teacherName: 'Asha',
    classSectionId: 'cs1',
    classSectionLabel: 'Grade 8 - A',
    className: 'Grade 8',
    subjectId: 'sub1',
    subjectName: 'Science',
    assessmentType: 'QUIZ',
    title: 'Cells',
    syllabus: 'Cells',
    difficulty: 'EASY',
    maxMarks: 5,
    questionCount: 5,
    generatorMode: 'AI',
    reviewNote: '',
    questions,
  };
  return {
    v: 1,
    savedAt: '2026-10-10T09:30:00.000Z',
    teacherId: 't1',
    classSectionId: 'cs1',
    request: {
      classSectionId: 'cs1',
      subjectId: 'sub1',
      subjectName: 'Science',
      assessmentType: 'QUIZ',
      title: 'Cells',
      syllabus: 'Cells',
      difficulty: 'EASY',
      questionCount: 5,
      maxMarks: 5,
    },
    response,
    savedToBank: [],
    ...partial,
  };
}

describe('quizGenErrorMessage', () => {
  it('says how long to wait when the hourly quota is used up', () => {
    const error = new ApiError('You have used all 40 AI requests...', 429, 'AI_RATE_LIMITED', { retryAfterSeconds: 125, limitPerHour: 40 });
    expect(quizGenErrorMessage(error)).toBe("You've used this hour's AI requests. Try again in about 3 min.");
  });

  it('never says less than a minute', () => {
    const error = new ApiError('x', 429, 'AI_RATE_LIMITED', { retryAfterSeconds: 5, limitPerHour: 40 });
    expect(quizGenErrorMessage(error)).toContain('about 1 min');
  });

  it('uses the server message for a 429 without details', () => {
    const message = "You've used all 40 AI requests for this hour. Please try again in about 13 minutes.";
    expect(quizGenErrorMessage(new ApiError(message, 429, 'AI_RATE_LIMITED'))).toBe(message);
  });

  it('shows the generator 503 message verbatim', () => {
    const message = 'This quiz was too long for the generator to finish in one go. Try fewer questions, or fewer long-answer questions.';
    expect(quizGenErrorMessage(new ApiError(message, 503, 'AI_UNAVAILABLE'))).toBe(message);
  });

  it('falls back to the generic wording for other failures', () => {
    expect(quizGenErrorMessage(new ApiError('Service Unavailable', 503))).toBe(en.errors.unavailable);
    expect(quizGenErrorMessage(new ApiError('', 503, 'AI_UNAVAILABLE'))).toBe(en.errors.unavailable);
    expect(quizGenErrorMessage(new NetworkError('timeout'))).toBe(en.errors.timeout);
    expect(quizGenErrorMessage(new ApiError('Too much writing for one go: at most 19 questions.', 400))).toBe(
      'Too much writing for one go: at most 19 questions.'
    );
  });
});

describe('parseStoredQuizDraft', () => {
  it('round-trips a stored draft', () => {
    const stored = draft({ savedToBank: [1, 3] });
    expect(parseStoredQuizDraft(JSON.stringify(stored))).toEqual(stored);
  });

  it('rejects anything else', () => {
    expect(parseStoredQuizDraft(null)).toBeNull();
    expect(parseStoredQuizDraft('{not json')).toBeNull();
    expect(parseStoredQuizDraft('"text"')).toBeNull();
    expect(parseStoredQuizDraft(JSON.stringify({ ...draft(), v: 2 }))).toBeNull();
    const noQuestions: Record<string, unknown> = { ...draft().response };
    delete noQuestions.questions;
    expect(parseStoredQuizDraft(JSON.stringify({ ...draft(), response: noQuestions }))).toBeNull();
    expect(parseStoredQuizDraft(JSON.stringify({ ...draft(), savedToBank: ['1'] }))).toBeNull();
    expect(parseStoredQuizDraft(JSON.stringify({ ...draft(), teacherId: 7 }))).toBeNull();
  });
});

describe('draft restore and bank selection', () => {
  const assignments: TeacherSubjectAssignment[] = [
    { sectionId: 'cs1', className: 'Grade 8', section: 'A', academicYear: '2026-27', subjectId: 'sub1', subjectName: 'Science', subjectCode: 'SCI' },
  ];

  it('restores in self mode always, and in principal mode only for the same section', () => {
    expect(shouldRestoreDraft(draft(), null)).toBe(true);
    expect(shouldRestoreDraft(draft(), 'cs1')).toBe(true);
    expect(shouldRestoreDraft(draft(), 'cs2')).toBe(false);
  });

  it("reselects the draft's class + subject only while it is still assigned, and the teacher's own pick wins", () => {
    const key = assignmentKeyOf({ sectionId: 'cs1', subjectId: 'sub1' });
    expect(key).toBe('cs1|sub1');
    expect(effectiveAssignmentKey('', key, assignments)).toBe(key);
    expect(effectiveAssignmentKey('', 'cs9|sub9', assignments)).toBe('');
    expect(effectiveAssignmentKey('', key, [])).toBe('');
    expect(effectiveAssignmentKey('cs2|sub2', key, assignments)).toBe('cs2|sub2');
  });

  it('selects the multiple-choice questions not yet saved', () => {
    expect(bankSelectableNumbers(questions, [])).toEqual([1, 3, 5]);
    expect(bankSelectableNumbers(questions, [3])).toEqual([1, 5]);
  });

  it('sends only ticked, eligible, unsaved questions to the bank review', () => {
    expect(questionsForBank(questions, [1, 2, 3, 4], [3]).map((q) => q.number)).toEqual([1]);
  });

  it('merges saved numbers without duplicates', () => {
    expect(mergeSavedNumbers([1, 3], [3, 5])).toEqual([1, 3, 5]);
  });
});

describe('writes tied to the draft on screen', () => {
  const older = draft({ savedAt: '2026-10-10T09:30:00.000Z', savedToBank: [1] });
  const newer = draft({ savedAt: '2026-10-10T09:34:00.000Z' });

  it('marks saved questions only on the draft they came from', () => {
    expect(markSavedOnDraft(older, older.savedAt, [3, 1])?.savedToBank).toEqual([1, 3]);
    expect(markSavedOnDraft(newer, older.savedAt, [3])).toBeNull();
    expect(markSavedOnDraft(null, older.savedAt, [3])).toBeNull();
  });

  it('discards the draft on screen, or an older one when the one on screen was never stored, never a newer one', () => {
    expect(shouldDiscardStoredDraft(older, older.savedAt)).toBe(true);
    expect(shouldDiscardStoredDraft(older, null)).toBe(true);
    expect(shouldDiscardStoredDraft(null, older.savedAt)).toBe(true);
    expect(shouldDiscardStoredDraft(newer, older.savedAt)).toBe(false);
  });
});

describe('quizDraftStore', () => {
  const key = quizDraftKey('school1', 'owner1', 'teacher1');

  beforeEach(() => AsyncStorage.clear());

  it('keys drafts per school, signed-in user and teacher', () => {
    expect(key).toBe('gurukul.aiQuizDraft.v1.school1.owner1.teacher1');
  });

  it('saves, loads, marks saved questions, and discards', async () => {
    expect(await saveQuizDraft(key, draft())).toBe(true);
    expect(await loadQuizDraft(key)).toEqual(draft());

    const { savedAt } = draft();
    await markQuizDraftSaved(key, savedAt, [1, 3]);
    await markQuizDraftSaved(key, savedAt, [3, 5]);
    expect((await loadQuizDraft(key))?.savedToBank).toEqual([1, 3, 5]);

    await discardQuizDraft(key, savedAt);
    expect(await loadQuizDraft(key)).toBeNull();
  });

  it('marking saved questions without a stored draft does nothing', async () => {
    await markQuizDraftSaved(key, draft().savedAt, [1]);
    expect(await AsyncStorage.getItem(key)).toBeNull();
  });

  it('a generation that finished while the old draft was being reviewed keeps its own flags and is not discarded', async () => {
    const d0 = draft({ savedAt: '2026-10-10T09:30:00.000Z' });
    const d2 = draft({ savedAt: '2026-10-10T09:34:00.000Z' });
    await saveQuizDraft(key, d0);
    await saveQuizDraft(key, d2);

    // Questions from D0 saved on the review screen after D2 replaced it.
    await markQuizDraftSaved(key, d0.savedAt, [1, 3, 5]);
    expect(await loadQuizDraft(key)).toEqual(d2);

    // "Discard draft" on a screen still showing D0 leaves D2, which the teacher hasn't seen.
    await discardQuizDraft(key, d0.savedAt);
    expect(await loadQuizDraft(key)).toEqual(d2);

    await discardQuizDraft(key, d2.savedAt);
    expect(await loadQuizDraft(key)).toBeNull();
  });

  it('discarding a draft that could not be stored removes the older one it replaced', async () => {
    await saveQuizDraft(key, draft());
    await discardQuizDraft(key, null);
    expect(await AsyncStorage.getItem(key)).toBeNull();
  });

  it('removes a corrupt value', async () => {
    await AsyncStorage.setItem(key, '{broken');
    expect(await loadQuizDraft(key)).toBeNull();
    expect(await AsyncStorage.getItem(key)).toBeNull();
  });
});
