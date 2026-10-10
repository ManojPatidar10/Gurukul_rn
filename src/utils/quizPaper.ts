import type { TFunction } from 'i18next';

import type { AiQuizGenerationResponse, GeneratedQuizQuestion, QuestionType } from '../api/types';
import { normalizeWords } from './quizBank';
import { fileSlug } from './reportCardPdfName';

/**
 * The AI quiz generator's paper as printable HTML (rendered to PDF on the phone by expo-print, so it
 * works offline): the questions with their options, marks and answer space, and - only when asked
 * for - the answer key starting on a new page, so a key isn't sent to students by mistake.
 */

export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** "quiz-photosynthesis-grade-8.pdf", or "...-answer-key.pdf" for the copy with the key. */
export function quizPaperFileName(title: string, className: string | null | undefined, withAnswerKey: boolean): string {
  return `quiz-${fileSlug(title, 'quiz')}-${fileSlug(className, 'class')}${withAnswerKey ? '-answer-key' : ''}.pdf`;
}

const ANSWER_LINES: Partial<Record<QuestionType, number>> = { NUMERIC: 1, SHORT_WORD: 1, SHORT_ANSWER: 3, LONG_ANSWER: 8 };

/** Ruled lines left for the student's answer; choice questions get none. */
export function answerLineCount(type: QuestionType): number {
  return ANSWER_LINES[type] ?? 0;
}

function hasChoices(q: GeneratedQuizQuestion): boolean {
  return (q.questionType === 'MCQ' || q.questionType === 'TRUE_FALSE') && q.options.length > 0;
}

/** (a), (b), (c), (d)... */
function optionLetter(index: number): string {
  return String.fromCharCode(97 + index);
}

/** The answer as the key prints it: "(b) 4" for a choice question, the answer text otherwise. */
export function answerKeyText(q: GeneratedQuizQuestion): string {
  if (hasChoices(q)) {
    const answer = normalizeWords(q.answer);
    const index = q.options.findIndex((o) => normalizeWords(o) === answer);
    if (index >= 0) return `(${optionLetter(index)}) ${q.options[index]}`;
  }
  return q.answer;
}

const STYLES = `
@page { size: A4; margin: 16mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #201A2B; font-size: 12pt; line-height: 1.45;
  font-family: -apple-system, Roboto, 'Noto Sans', 'Noto Sans Devanagari', 'Segoe UI', Helvetica, Arial, sans-serif; }
.pre { white-space: pre-wrap; }
h1 { font-size: 18pt; margin: 0 0 4pt; }
h2 { font-size: 15pt; margin: 0 0 10pt; }
.meta { color: #5B5468; margin: 0 0 2pt; }
.student { display: flex; gap: 14pt; margin: 14pt 0 6pt; }
.student > div { flex: 1; display: flex; gap: 4pt; }
.fill { flex: 1; border-bottom: 1px solid #201A2B; }
hr { border: 0; border-top: 1px solid #C9C4D3; margin: 10pt 0 14pt; }
.question, .key-item { break-inside: avoid; page-break-inside: avoid; margin: 0 0 12pt; }
.q-head { display: flex; justify-content: space-between; gap: 12pt; }
.q-text { flex: 1; }
.q-marks { white-space: nowrap; color: #5B5468; }
.options { list-style: none; margin: 4pt 0 0 18pt; padding: 0; }
.options li { margin: 2pt 0; }
.line { border-bottom: 1px solid #9A94A6; height: 22pt; }
.explanation, .key-marks { color: #5B5468; font-size: 11pt; margin: 2pt 0 0 18pt; }
.answer-key { break-before: page; page-break-before: always; }
.ai-note { color: #5B5468; font-size: 9pt; margin-top: 18pt; padding-top: 6pt; border-top: 1px solid #C9C4D3; }
`;

/** One string of HTML for the whole paper; every interpolated value is escaped. */
export function buildQuizPaperHtml(
  paper: AiQuizGenerationResponse,
  { includeAnswerKey }: { includeAnswerKey: boolean },
  t: TFunction
): string {
  const e = escapeHtml;
  const marks = (value: number) => e(t('teacherTools.paper.marks', { marks: value }));
  const typeLabel = t(`teacherTools.generator.assessmentTypes.${paper.assessmentType}`);

  const blanks = [t('teacherTools.paper.name'), t('teacherTools.paper.rollNo'), t('teacherTools.paper.date')]
    .map((label) => `<div><span>${e(label)}:</span><span class="fill"></span></div>`)
    .join('');
  const header =
    `<h1 class="pre">${e(paper.title)}</h1>` +
    `<p class="meta">${e(paper.subjectName)} · ${e(paper.classSectionLabel)} · ${e(typeLabel)}</p>` +
    `<p class="meta">${e(t('teacherTools.paper.totalMarks', { marks: paper.maxMarks }))} · ` +
    `${e(t('teacherTools.paper.questions', { count: paper.questions.length }))}</p>` +
    `<div class="student">${blanks}</div><hr>`;

  const questions = paper.questions
    .map((q) => {
      const options = hasChoices(q)
        ? `<ul class="options">${q.options
            .map((o, i) => `<li>(${optionLetter(i)}) <span class="pre">${e(o)}</span></li>`)
            .join('')}</ul>`
        : '';
      const lineCount = answerLineCount(q.questionType);
      const lines = lineCount > 0 ? `<div class="lines">${'<div class="line"></div>'.repeat(lineCount)}</div>` : '';
      return (
        `<div class="question"><div class="q-head">` +
        `<div class="q-text"><strong>Q${e(q.number)}.</strong> <span class="pre">${e(q.question)}</span></div>` +
        `<div class="q-marks">${marks(q.marks)}</div></div>${options}${lines}</div>`
      );
    })
    .join('');

  const answerKey = includeAnswerKey
    ? `<section class="answer-key"><h2 class="pre">${e(t('teacherTools.paper.answerKey'))} — ${e(paper.title)}</h2>` +
      paper.questions
        .map((q) => {
          const explanation = q.explanation?.trim() ? `<div class="explanation pre">${e(q.explanation.trim())}</div>` : '';
          return (
            `<div class="key-item"><div><strong>Q${e(q.number)}.</strong> <span class="pre">${e(answerKeyText(q))}</span></div>` +
            `${explanation}<div class="key-marks">${marks(q.marks)}</div></div>`
          );
        })
        .join('') +
      `<p class="ai-note">${e(t('teacherTools.paper.aiNote'))}</p></section>`
    : '';

  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${e(paper.title)}</title><style>${STYLES}</style></head>` +
    `<body>${header}${questions}${answerKey}</body></html>`
  );
}
