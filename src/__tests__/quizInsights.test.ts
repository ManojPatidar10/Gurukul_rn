import type { QuestionStat, SectionQuizTotals, StudentQuizSummary, SubjectOption } from '../api/quizInsights';
import type { ClassSection, LoginResponse, QuizQuestionResponse, TeacherSubjectAssignment } from '../api/types';
import {
  DEFAULT_RANGE_DAYS,
  MIN_ANSWERS_FOR_FLAG,
  RANGE_PRESETS,
  accuracyBand,
  bandChipVariant,
  canSeeQuizResults,
  formatIstDay,
  formatPercent,
  formatRange,
  gameBreakdown,
  istToday,
  noQuestionsMessage,
  optionCountsLine,
  questionAnswersLine,
  questionFlags,
  questionGameSplit,
  questionScopeLine,
  quizResultsNeedsAssignments,
  rangeForDays,
  sortStudents,
  summaryEmptyMessage,
  totalsSummary,
} from '../utils/quizInsights';

describe('istToday / rangeForDays', () => {
  it('rolls over to the next day at IST midnight', () => {
    expect(istToday(new Date('2026-10-09T18:29:59Z'))).toBe('2026-10-09');
    expect(istToday(new Date('2026-10-09T18:30:00Z'))).toBe('2026-10-10');
  });

  it('spans the given number of days, today included', () => {
    const now = new Date('2026-10-10T06:00:00Z');
    expect(rangeForDays(30, now)).toEqual({ from: '2026-09-11', to: '2026-10-10' });
    expect(rangeForDays(7, now)).toEqual({ from: '2026-10-04', to: '2026-10-10' });
    expect(rangeForDays(1, now)).toEqual({ from: '2026-10-10', to: '2026-10-10' });
  });

  it('crosses month and year ends', () => {
    expect(rangeForDays(30, new Date('2026-03-01T00:00:00Z'))).toEqual({ from: '2026-01-31', to: '2026-03-01' });
    expect(rangeForDays(7, new Date('2027-01-02T12:00:00Z'))).toEqual({ from: '2026-12-27', to: '2027-01-02' });
    // 20:00Z on 31 Dec is already 1 Jan in IST.
    expect(rangeForDays(30, new Date('2026-12-31T20:00:00Z'))).toEqual({ from: '2026-12-03', to: '2027-01-01' });
  });

  it('offers 7, 30 and 90 days, 30 by default', () => {
    expect([...RANGE_PRESETS]).toEqual([7, 30, 90]);
    expect(DEFAULT_RANGE_DAYS).toBe(30);
  });
});

describe('formatRange / formatIstDay', () => {
  it('shows the year once when both ends share it', () => {
    expect(formatRange('2026-09-11', '2026-10-10')).toBe('11 Sep – 10 Oct 2026');
    expect(formatRange('2026-10-10', '2026-10-10')).toBe('10 Oct – 10 Oct 2026');
  });

  it('shows both years across a year end', () => {
    expect(formatRange('2026-12-27', '2027-01-02')).toBe('27 Dec 2026 – 2 Jan 2027');
  });

  it('gives the IST day of an instant', () => {
    expect(formatIstDay('2026-10-08T10:02:11Z')).toBe('8 Oct 2026');
    expect(formatIstDay('2026-10-08T18:30:00Z')).toBe('9 Oct 2026');
    expect(formatIstDay('not a date')).toBe('');
  });
});

describe('formatPercent / accuracyBand', () => {
  it('formats a whole percentage, or a dash for no answers', () => {
    expect(formatPercent(68)).toBe('68%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(null)).toBe('–');
  });

  it('bands at 40 and 70', () => {
    expect(accuracyBand(null)).toBe('none');
    expect(accuracyBand(0)).toBe('low');
    expect(accuracyBand(39)).toBe('low');
    expect(accuracyBand(40)).toBe('mid');
    expect(accuracyBand(69)).toBe('mid');
    expect(accuracyBand(70)).toBe('high');
    expect(accuracyBand(100)).toBe('high');
  });

  it('maps bands to chip variants', () => {
    expect(bandChipVariant('none')).toBe('neutral');
    expect(bandChipVariant('low')).toBe('error');
    expect(bandChipVariant('mid')).toBe('warning');
    expect(bandChipVariant('high')).toBe('success');
  });
});

function student(name: string, answered: number, percentCorrect: number | null, extra: Partial<StudentQuizSummary> = {}) {
  const row: StudentQuizSummary = {
    studentId: name.toLowerCase(),
    name,
    rollNumber: null,
    answered,
    correct: percentCorrect === null ? 0 : Math.round((answered * percentCorrect) / 100),
    percentCorrect,
    practice: { answered, correct: 0, sessions: answered > 0 ? 1 : 0 },
    arena: { answered: 0, correct: 0, played: 0, won: 0 },
    battle: { answered: 0, correct: 0, played: 0, won: 0 },
    lastActiveAt: null,
    ...extra,
  };
  return row;
}

describe('sortStudents', () => {
  const rows = [
    student('Meera', 10, 80),
    student('arjun', 4, 50),
    student('Zoya', 0, null),
    student('Bina', 4, 50),
    student('Chetan', 0, null),
    student('Dev', 20, 30),
  ];

  it('sorts by name ignoring case, then roll number', () => {
    expect(sortStudents(rows, 'name').map((s) => s.name)).toEqual(['arjun', 'Bina', 'Chetan', 'Dev', 'Meera', 'Zoya']);
    const twins = [
      student('Asha', 1, 100, { studentId: 'x', rollNumber: '12' }),
      student('asha', 1, 100, { studentId: 'y', rollNumber: '2' }),
    ];
    expect(sortStudents(twins, 'name').map((s) => s.rollNumber)).toEqual(['2', '12']);
  });

  it('puts the fewest answers first, ties by name', () => {
    expect(sortStudents(rows, 'leastActive').map((s) => s.name)).toEqual([
      'Chetan',
      'Zoya',
      'arjun',
      'Bina',
      'Meera',
      'Dev',
    ]);
  });

  it('puts the lowest accuracy first and students with no answers last', () => {
    expect(sortStudents(rows, 'lowestAccuracy').map((s) => s.name)).toEqual([
      'Dev',
      'arjun',
      'Bina',
      'Meera',
      'Chetan',
      'Zoya',
    ]);
  });

  it('leaves its input alone', () => {
    const before = rows.map((s) => s.name);
    sortStudents(rows, 'lowestAccuracy');
    sortStudents(rows, 'leastActive');
    expect(rows.map((s) => s.name)).toEqual(before);
  });
});

describe('gameBreakdown / totalsSummary / summaryEmptyMessage', () => {
  it('says so when there was no activity', () => {
    expect(gameBreakdown(student('Asha', 0, null))).toBe('No quiz activity in this period');
  });

  it('counts a student with no answers in the period as inactive, even if a game finished in it', () => {
    // A challenge answered before the period that completed (and was won) inside it: the totals
    // don't count this student as having played, so neither does the card.
    const finishedLater = student('Asha', 0, null, {
      practice: { answered: 0, correct: 0, sessions: 0 },
      arena: { answered: 0, correct: 0, played: 1, won: 1 },
    });
    expect(gameBreakdown(finishedLater)).toBe('No quiz activity in this period');
    const battleFinishedLater = student('Asha', 0, null, {
      practice: { answered: 0, correct: 0, sessions: 0 },
      battle: { answered: 0, correct: 0, played: 1, won: 0 },
    });
    expect(gameBreakdown(battleFinishedLater)).toBe('No quiz activity in this period');
  });

  it("still shows a finished game with no answers in the period for a student who answered something else", () => {
    const active = student('Asha', 4, 50, {
      practice: { answered: 4, correct: 2, sessions: 1 },
      arena: { answered: 0, correct: 0, played: 1, won: 1 },
    });
    expect(gameBreakdown(active)).toBe('Practice 4 · Arena 0 (won 1 of 1)');
  });

  it('lists only the games with something in them', () => {
    const mixed = student('Asha', 31, 71, {
      practice: { answered: 12, correct: 9, sessions: 2 },
      arena: { answered: 10, correct: 7, played: 2, won: 1 },
      battle: { answered: 9, correct: 6, played: 1, won: 0 },
    });
    expect(gameBreakdown(mixed)).toBe('Practice 12 · Arena 10 (won 1 of 2) · Battle 9 (won 0 of 1)');

    const battleOnly = student('Asha', 5, 60, {
      practice: { answered: 0, correct: 0, sessions: 0 },
      battle: { answered: 5, correct: 3, played: 1, won: 1 },
    });
    expect(gameBreakdown(battleOnly)).toBe('Battle 5 (won 1 of 1)');

    // Answers in a challenge that expired: answered, but never "played".
    const expired = student('Asha', 3, 33, {
      practice: { answered: 0, correct: 0, sessions: 0 },
      arena: { answered: 3, correct: 1, played: 0, won: 0 },
    });
    expect(gameBreakdown(expired)).toBe('Arena 3');
  });

  it('sums up the class', () => {
    expect(totalsSummary({ students: 40, activeStudents: 18, answered: 412, correct: 280, percentCorrect: 68 })).toBe(
      '18 of 40 students played · 412 answers · 68% correct'
    );
    expect(totalsSummary({ students: 1, activeStudents: 0, answered: 0, correct: 0, percentCorrect: null })).toBe(
      '0 of 1 student played · 0 answers'
    );
  });

  const science: SubjectOption[] = [{ id: 'sci', name: 'Science' }];
  const summary = (totals: SectionQuizTotals, subjects: SubjectOption[] = science, subjectId: string | null = null) => ({
    subjectId,
    subjects,
    totals,
  });
  const none: SectionQuizTotals = { students: 0, activeStudents: 0, answered: 0, correct: 0, percentCorrect: null };

  it('picks the empty-state line', () => {
    expect(summaryEmptyMessage(summary(none))).toBe('No students in this class yet.');
    expect(summaryEmptyMessage(summary({ ...none, students: 5 }))).toBe(
      'No one in this class played Practice, Arena or Battle in this period.'
    );
    expect(
      summaryEmptyMessage(summary({ students: 5, activeStudents: 1, answered: 2, correct: 1, percentCorrect: 50 }))
    ).toBeNull();
    // A subject filter with nobody playing.
    expect(summaryEmptyMessage(summary({ ...none, students: 5 }, science, 'sci'))).toBe(
      'No one in this class played Practice, Arena or Battle in this period.'
    );
  });

  it('says the school has no subjects rather than no students when there is nothing to filter by', () => {
    // The server lists no students when there are no subjects, even for a class that has some.
    expect(summaryEmptyMessage(summary(none, []))).toBe('No subjects are set up for this school yet.');
  });
});

function question(partial: Partial<QuizQuestionResponse> = {}): QuizQuestionResponse {
  return {
    id: 'q1',
    className: 'Grade 8',
    questionText: 'Which gas do plants take in?',
    optionA: 'Oxygen',
    optionB: 'Carbon dioxide',
    optionC: 'Nitrogen',
    optionD: 'Helium',
    correctOption: 'B',
    createdByEmployeeId: 'e1',
    createdByEmployeeName: 'Ravi',
    questionType: 'MCQ',
    openReportCount: 0,
    ...partial,
  };
}

function stat(
  counts: { A: number; B: number; C: number; D: number },
  partial: Partial<QuestionStat> = {},
  q: Partial<QuizQuestionResponse> = {}
): QuestionStat {
  const base = question(q);
  const answered = counts.A + counts.B + counts.C + counts.D;
  const correct = base.correctOption ? counts[base.correctOption] : 0;
  return {
    question: base,
    answered,
    correct,
    percentCorrect: answered === 0 ? null : Math.round((100 * correct) / answered),
    optionCounts: counts,
    practice: { answered, correct },
    arena: { answered: 0, correct: 0 },
    battle: { answered: 0, correct: 0 },
    ...partial,
  };
}

describe('questionFlags', () => {
  it('needs at least 5 answers before judging a question', () => {
    expect(MIN_ANSWERS_FOR_FLAG).toBe(5);
    expect(questionFlags(stat({ A: 0, B: 0, C: 4, D: 0 }))).toEqual([]);
    expect(questionFlags(stat({ A: 0, B: 0, C: 0, D: 0 }))).toEqual([]);
  });

  it('flags a wrong option picked more than the right one', () => {
    // 15 of 50 right = 30%, and C beats B.
    expect(questionFlags(stat({ A: 5, B: 15, C: 28, D: 2 }))).toEqual([
      'More students chose C than the right answer',
      'Only 30% got this right',
    ]);
    // A tie with the right answer isn't flagged; only the most-picked wrong option is named.
    expect(questionFlags(stat({ A: 2, B: 4, C: 4, D: 0 }))).toEqual([]);
    expect(questionFlags(stat({ A: 6, B: 5, C: 7, D: 0 }))).toEqual([
      'More students chose C than the right answer',
      'Only 28% got this right',
    ]);
  });

  it('flags a low % correct on its own', () => {
    // 3 of 10 right, but no single wrong option beats B.
    expect(questionFlags(stat({ A: 3, B: 3, C: 2, D: 2 }))).toEqual(['Only 30% got this right']);
    expect(questionFlags(stat({ A: 2, B: 4, C: 2, D: 2 }))).toEqual([]);
  });

  it('shows open reports whatever the answer count', () => {
    expect(questionFlags(stat({ A: 0, B: 1, C: 0, D: 0 }, {}, { openReportCount: 2 }))).toEqual([
      '2 students reported a wrong answer',
    ]);
    expect(questionFlags(stat({ A: 5, B: 15, C: 28, D: 2 }, {}, { openReportCount: 1 }))[0]).toBe(
      '1 student reported a wrong answer'
    );
  });
});

describe('question card lines', () => {
  it('marks the correct option in the counts', () => {
    expect(optionCountsLine(stat({ A: 5, B: 15, C: 28, D: 2 }))).toBe('A 5 · B 15 ✓ · C 28 · D 2');
  });

  it('summarises answers, or says nobody answered', () => {
    expect(questionAnswersLine(stat({ A: 5, B: 15, C: 28, D: 2 }))).toBe('50 answers · 30% correct');
    expect(questionAnswersLine(stat({ A: 0, B: 1, C: 0, D: 0 }))).toBe('1 answer · 100% correct');
    expect(questionAnswersLine(stat({ A: 0, B: 0, C: 0, D: 0 }))).toBe('Not answered in this period');
  });

  it('splits by game, leaving out games with no answers', () => {
    const item = stat(
      { A: 5, B: 15, C: 28, D: 2 },
      {
        practice: { answered: 20, correct: 6 },
        arena: { answered: 0, correct: 0 },
        battle: { answered: 12, correct: 4 },
      }
    );
    expect(questionGameSplit(item)).toBe('Practice 20 (6 right) · Battle 12 (4 right)');
  });

  it('describes whose answers count', () => {
    expect(questionScopeLine({ sectionLabel: 'Grade 8 - A', className: 'Grade 8' })).toBe(
      'Answers from students in Grade 8 - A'
    );
    expect(questionScopeLine({ sectionLabel: null, className: 'Grade 8' })).toBe('Answers from all Grade 8 students');
  });

  it('words the empty state for a teacher and an admin', () => {
    expect(noQuestionsMessage(true, 'Science', 'Grade 8')).toBe(
      "You haven't added any multiple-choice questions for Science in Grade 8 yet."
    );
    expect(noQuestionsMessage(false, 'Science', 'Grade 8')).toBe(
      'No multiple-choice questions for Science in Grade 8 yet.'
    );
  });
});

describe('canSeeQuizResults', () => {
  const section: ClassSection = {
    id: 'sec-8a',
    schoolId: 's1',
    className: 'Grade 8',
    section: 'A',
    academicYear: '2026-27',
    displayLabel: 'Grade 8 - A',
    classTeacherId: 'ct',
    classTeacherName: 'Class Teacher',
  };
  const session = (role: LoginResponse['role'], ownerType: LoginResponse['ownerType'], ownerId: string) => ({
    role,
    ownerType,
    ownerId,
  });
  const assignment = (sectionId: string): TeacherSubjectAssignment => ({
    sectionId,
    className: 'Grade 8',
    section: 'A',
    academicYear: '2026-27',
    subjectId: 'sci',
    subjectName: 'Science',
    subjectCode: 'SCI',
  });

  it('lets an admin in at once', () => {
    expect(canSeeQuizResults(session('ADMIN', 'EMPLOYEE', 'adm'), section, null)).toBe(true);
  });

  it('lets the class teacher in without assignments', () => {
    expect(canSeeQuizResults(session('TEACHER', 'EMPLOYEE', 'ct'), section, null)).toBe(true);
  });

  it('lets a subject teacher of this section in once assignments load', () => {
    const teacher = session('TEACHER', 'EMPLOYEE', 't1');
    expect(canSeeQuizResults(teacher, section, null)).toBe(false);
    expect(canSeeQuizResults(teacher, section, [])).toBe(false);
    expect(canSeeQuizResults(teacher, section, [assignment('sec-9b')])).toBe(false);
    expect(canSeeQuizResults(teacher, section, [assignment('sec-9b'), assignment('sec-8a')])).toBe(true);
  });

  it('keeps students and parents out', () => {
    expect(canSeeQuizResults(session('STUDENT', 'STUDENT', 'ct'), section, [assignment('sec-8a')])).toBe(false);
    expect(canSeeQuizResults(session('PARENT', 'PARENT', 'ct'), section, [assignment('sec-8a')])).toBe(false);
  });

  describe('quizResultsNeedsAssignments', () => {
    it('loads assignments only for a staff teacher who is not the class teacher', () => {
      expect(quizResultsNeedsAssignments(session('TEACHER', 'EMPLOYEE', 't1'), section)).toBe(true);
      expect(quizResultsNeedsAssignments(session('TEACHER', 'EMPLOYEE', 't1'), { classTeacherId: null })).toBe(true);
    });

    it('skips the call for the admin and the class teacher', () => {
      expect(quizResultsNeedsAssignments(session('ADMIN', 'EMPLOYEE', 'adm'), section)).toBe(false);
      expect(quizResultsNeedsAssignments(session('TEACHER', 'EMPLOYEE', 'ct'), section)).toBe(false);
    });

    it('never makes the call for students, parents or drivers', () => {
      expect(quizResultsNeedsAssignments(session('STUDENT', 'STUDENT', 's1'), section)).toBe(false);
      expect(quizResultsNeedsAssignments(session('PARENT', 'PARENT', 'p1'), section)).toBe(false);
      expect(quizResultsNeedsAssignments(session('DRIVER', 'EMPLOYEE', 'd1'), section)).toBe(false);
    });
  });
});
