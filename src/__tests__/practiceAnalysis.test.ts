import type { ChapterBreakdown, PracticeAnalysis } from '../api/types';
import { chapterBarColor, chapterTone } from '../utils/practiceAnalysis';

function chapter(id: string, percentCorrect: number, lowConfidence = false): ChapterBreakdown {
  return {
    chapterId: id,
    chapterNumber: Number(id),
    chapterLabel: `${id}. Chapter ${id}`,
    answered: lowConfidence ? 2 : 5,
    correct: Math.round((percentCorrect / 100) * (lowConfidence ? 2 : 5)),
    percentCorrect,
    lowConfidence,
  };
}

function analysisOf(chapters: ChapterBreakdown[], strengths: string[], focusAreas: string[]): PracticeAnalysis {
  const pick = (ids: string[]) => chapters.filter((c) => ids.includes(c.chapterId));
  return {
    sessionId: 'session-1',
    subjectName: 'Science',
    completed: true,
    answered: chapters.reduce((n, c) => n + c.answered, 0),
    correct: chapters.reduce((n, c) => n + c.correct, 0),
    percentCorrect: 50,
    chapters,
    strengths: pick(strengths),
    focusAreas: pick(focusAreas),
    missedQuestions: [],
    untaggedAnswered: 0,
  };
}

describe('chapterTone', () => {
  const strong = chapter('10', 100);
  const weak = chapter('12', 0);
  const middling = chapter('11', 70);
  const analysis = analysisOf([strong, middling, weak], ['10'], ['12']);

  it('marks a chapter the student struggled with as a focus area', () => {
    expect(chapterTone(weak, analysis)).toBe('focus');
  });

  it('marks a chapter the student did well in as a strength', () => {
    expect(chapterTone(strong, analysis)).toBe('strength');
  });

  it('leaves a chapter that is neither as neutral', () => {
    expect(chapterTone(middling, analysis)).toBe('neutral');
  });

  it('refuses to judge a chapter with too few answers, whatever the percentage says', () => {
    // Two right out of two is 100%, and drawing that like a strength would congratulate a student
    // on a chapter they answered twice.
    const barelyAnswered = chapter('9', 100, true);
    const withIt = analysisOf([strong, barelyAnswered], ['10', '9'], []);

    expect(chapterTone(barelyAnswered, withIt)).toBe('unjudged');
  });

  it('keeps the muted bar even if a low-confidence chapter is listed as a focus area', () => {
    // The server excludes these from both lists today. If that ever slips, the bar must not start
    // making a claim the sentence underneath it does not.
    const barelyAnswered = chapter('9', 0, true);
    const withIt = analysisOf([barelyAnswered, weak], [], ['9', '12']);

    expect(chapterTone(barelyAnswered, withIt)).toBe('unjudged');
  });
});

describe('chapterBarColor', () => {
  it('draws strengths and ordinary chapters the same - the callout is what names a strength', () => {
    expect(chapterBarColor('strength')).toBe(chapterBarColor('neutral'));
  });

  it('separates a focus area from everything else', () => {
    expect(chapterBarColor('focus')).not.toBe(chapterBarColor('neutral'));
    expect(chapterBarColor('focus')).not.toBe(chapterBarColor('unjudged'));
  });
});
