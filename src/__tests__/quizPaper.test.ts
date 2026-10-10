import type { TFunction } from 'i18next';

import type { AiQuizGenerationResponse, GeneratedQuizQuestion } from '../api/types';
import i18n from '../i18n';
import en from '../i18n/locales/en.json';
import { answerKeyText, answerLineCount, buildQuizPaperHtml, escapeHtml, quizPaperFileName } from '../utils/quizPaper';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.init({ lng: 'en', resources: { en: { translation: en } }, interpolation: { escapeValue: false } });
  }
  await i18n.changeLanguage('en');
});

const t: TFunction = i18n.t.bind(i18n);

function question(partial: Partial<GeneratedQuizQuestion>): GeneratedQuizQuestion {
  return { number: 1, questionType: 'MCQ', question: 'What is 2 + 2?', options: [], answer: '', explanation: '', marks: 1, ...partial };
}

function paper(questions: GeneratedQuizQuestion[], partial: Partial<AiQuizGenerationResponse> = {}): AiQuizGenerationResponse {
  return {
    schoolId: 's1',
    teacherId: 't1',
    teacherName: 'Asha',
    classSectionId: 'cs1',
    classSectionLabel: 'Grade 8 - A (2026-27)',
    className: 'Grade 8',
    subjectId: 'sub1',
    subjectName: 'Maths',
    assessmentType: 'QUIZ',
    title: 'Addition quiz',
    syllabus: 'Addition',
    difficulty: 'EASY',
    maxMarks: questions.reduce((sum, q) => sum + q.marks, 0),
    questionCount: questions.length,
    generatorMode: 'AI',
    reviewNote: '',
    questions,
    ...partial,
  };
}

const mcq = question({ number: 1, options: ['3', '4', '5', '6'], answer: '4', explanation: 'Two and two make four.', marks: 2 });
const trueFalse = question({ number: 2, questionType: 'TRUE_FALSE', question: 'The sun is a star.', options: ['True', 'False'], answer: 'True' });

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('escapeHtml', () => {
  it('escapes markup, ampersands and quotes', () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe('&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(5)).toBe('5');
  });
});

describe('buildQuizPaperHtml', () => {
  it('escapes everything that came from the generator', () => {
    const html = buildQuizPaperHtml(
      paper(
        [
          question({
            question: 'Is 1 < 2 & "true"?',
            options: ['<script>alert(1)</script>', "it's 'yes'", 'no', 'maybe'],
            answer: '<script>alert(1)</script>',
            explanation: '<img src=x onerror=alert(1)>',
          }),
        ],
        { title: '<script>alert("t")</script> & quiz', subjectName: 'A & B', classSectionLabel: '<i>8</i>' }
      ),
      { includeAnswerKey: true },
      t
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<i>8</i>');
    expect(html).toContain('&lt;script&gt;alert(&quot;t&quot;)&lt;/script&gt; &amp; quiz');
    expect(html).toContain('Is 1 &lt; 2 &amp; &quot;true&quot;?');
    expect(html).toContain('it&#39;s &#39;yes&#39;');
    expect(html).toContain('A &amp; B');
  });

  it('letters MCQ options (a)-(d) and shows both true/false options', () => {
    const html = buildQuizPaperHtml(paper([mcq, trueFalse]), { includeAnswerKey: false }, t);
    expect(html).toContain('(a) <span class="pre">3</span>');
    expect(html).toContain('(d) <span class="pre">6</span>');
    expect(html).toContain('(a) <span class="pre">True</span>');
    expect(html).toContain('(b) <span class="pre">False</span>');
  });

  it('leaves 1, 3 or 8 answer lines by type, none for choice questions', () => {
    expect(answerLineCount('NUMERIC')).toBe(1);
    expect(answerLineCount('SHORT_WORD')).toBe(1);
    expect(answerLineCount('SHORT_ANSWER')).toBe(3);
    expect(answerLineCount('LONG_ANSWER')).toBe(8);
    expect(answerLineCount('MCQ')).toBe(0);
    expect(answerLineCount('TRUE_FALSE')).toBe(0);

    const html = buildQuizPaperHtml(
      paper([
        question({ number: 1, questionType: 'NUMERIC', answer: '8' }),
        question({ number: 2, questionType: 'SHORT_WORD', answer: 'Oxygen' }),
        question({ number: 3, questionType: 'SHORT_ANSWER', answer: 'Because...' }),
        question({ number: 4, questionType: 'LONG_ANSWER', answer: 'Essay' }),
        mcq,
      ]),
      { includeAnswerKey: false },
      t
    );
    expect(count(html, '<div class="line"></div>')).toBe(1 + 1 + 3 + 8);
  });

  it('prints the header with marks, question count and blank student lines', () => {
    const html = buildQuizPaperHtml(paper([mcq, trueFalse]), { includeAnswerKey: false }, t);
    expect(html).toContain('<h1 class="pre">Addition quiz</h1>');
    expect(html).toContain('Maths · Grade 8 - A (2026-27) · Quiz');
    expect(html).toContain('Total marks: 3 · Questions: 2');
    expect(html).toContain('<span>Name:</span>');
    expect(html).toContain('<span>Roll no.:</span>');
    expect(html).toContain('<span>Date:</span>');
    expect(html).toContain('(2 marks)');
  });

  it('has no answer key and no AI note on the question paper only', () => {
    const html = buildQuizPaperHtml(paper([mcq, trueFalse]), { includeAnswerKey: false }, t);
    expect(html).not.toContain('<section class="answer-key"');
    expect(html).not.toContain(en.teacherTools.paper.answerKey);
    expect(html).not.toContain(en.teacherTools.paper.aiNote);
    expect(html).not.toContain('Two and two make four.');
  });

  it('adds the answer key on a new page, with lettered answers, explanations and the AI note', () => {
    const html = buildQuizPaperHtml(paper([mcq, trueFalse]), { includeAnswerKey: true }, t);
    expect(html).toContain('<section class="answer-key">');
    expect(html).toMatch(/\.answer-key \{[^}]*break-before: page;[^}]*page-break-before: always;/);
    expect(html).toContain('Answer key — Addition quiz');
    expect(html).toContain('(b) 4');
    expect(html).toContain('(a) True');
    expect(html).toContain('Two and two make four.');
    expect(count(html, en.teacherTools.paper.aiNote)).toBe(1);
    // The note sits inside the key section, after the questions.
    expect(html.indexOf(en.teacherTools.paper.aiNote)).toBeGreaterThan(html.indexOf('<section class="answer-key">'));
  });

  it('keeps Hindi text and declares UTF-8', () => {
    const html = buildQuizPaperHtml(
      paper([question({ questionType: 'SHORT_ANSWER', question: 'प्रकाश संश्लेषण क्या है?', answer: 'पौधे भोजन बनाते हैं।' })], {
        title: 'विज्ञान क्विज़',
      }),
      { includeAnswerKey: true },
      t
    );
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain("'Noto Sans Devanagari'");
    expect(html).toContain('प्रकाश संश्लेषण क्या है?');
    expect(html).toContain('पौधे भोजन बनाते हैं।');
    expect(html).toContain('विज्ञान क्विज़');
    expect(html).toContain('@page { size: A4; margin: 16mm; }');
  });
});

describe('answerKeyText', () => {
  it('matches the answer to its option, ignoring case and spacing', () => {
    expect(answerKeyText(question({ options: ['Red', 'Blue', 'Green', 'Yellow'], answer: '  green ' }))).toBe('(c) Green');
  });

  it('falls back to the answer text when no option matches, and for typed answers', () => {
    expect(answerKeyText(question({ options: ['3', '4', '5', '6'], answer: 'B' }))).toBe('B');
    expect(answerKeyText(question({ questionType: 'NUMERIC', answer: '12.5' }))).toBe('12.5');
  });
});

describe('quizPaperFileName', () => {
  it('slugifies the title and class', () => {
    expect(quizPaperFileName('Photosynthesis: Unit 2', 'Grade 8', false)).toBe('quiz-photosynthesis-unit-2-grade-8.pdf');
  });

  it('falls back to "quiz" for a Hindi-only title', () => {
    expect(quizPaperFileName('विज्ञान क्विज़', 'Grade 8', false)).toBe('quiz-quiz-grade-8.pdf');
    expect(quizPaperFileName('Test', '', false)).toBe('quiz-test-class.pdf');
  });

  it('marks the copy with the answer key', () => {
    expect(quizPaperFileName('Addition', 'Grade 3', true)).toBe('quiz-addition-grade-3-answer-key.pdf');
  });
});
