import type { ChapterBreakdown, PracticeAnalysis } from '../api/types';
import { CATEGORICAL_PALETTE, SINGLE_SERIES_COLOR } from '../theme/chartPalette';
import { colors } from '../theme/colors';

/** What a chapter's bar is saying. */
export type ChapterTone =
  /** Scored low enough to be worth going back to. */
  | 'focus'
  /** Scored well. Drawn like a neutral chapter - the callout is what names it. */
  | 'strength'
  /** Answered enough to judge, and the verdict is "fine". */
  | 'neutral'
  /** Too few answers to say anything. Drawn muted, with no verdict attached. */
  | 'unjudged';

const TONE_COLORS: Record<ChapterTone, string> = {
  focus: CATEGORICAL_PALETTE[7], // red, the diverging partner of slot 0
  strength: SINGLE_SERIES_COLOR,
  neutral: SINGLE_SERIES_COLOR,
  unjudged: colors.textMuted,
};

/**
 * How to draw one chapter's bar.
 *
 * <p>`lowConfidence` wins over everything else on purpose. Two correct out of two is 100%, and a
 * full green bar would tell a student they have mastered a chapter they answered twice. The server
 * already keeps those chapters out of both verdict lists; checking here too means the bar cannot
 * contradict the sentence underneath it even if that ever changes.
 */
export function chapterTone(chapter: ChapterBreakdown, analysis: PracticeAnalysis): ChapterTone {
  if (chapter.lowConfidence) {
    return 'unjudged';
  }
  if (analysis.focusAreas.some((c) => c.chapterId === chapter.chapterId)) {
    return 'focus';
  }
  if (analysis.strengths.some((c) => c.chapterId === chapter.chapterId)) {
    return 'strength';
  }
  return 'neutral';
}

export function chapterBarColor(tone: ChapterTone): string {
  return TONE_COLORS[tone];
}
