import AsyncStorage from '@react-native-async-storage/async-storage';

import { mergeSavedNumbers, parseStoredQuizDraft, type StoredQuizDraft } from '../utils/quizGenerator';

export type { StoredQuizDraft } from '../utils/quizGenerator';

/**
 * The AI quiz generator's last draft, kept on this phone so Back doesn't lose it: one per signed-in
 * user per teacher the quiz is for. It is replaced only by a successful new generation and removed
 * only by "Discard draft" - not on logout, so logging back in keeps the work.
 *
 * Every function handles its own storage errors: a failure here never blocks generating or sharing,
 * it only means the draft won't survive.
 */

const KEY_PREFIX = 'gurukul.aiQuizDraft.v1.';

/** `ownerId` is the signed-in user; `teacherId` is who the quiz is for (the same person in self mode). */
export function quizDraftKey(schoolId: string, ownerId: string, teacherId: string): string {
  return `${KEY_PREFIX}${schoolId}.${ownerId}.${teacherId}`;
}

export async function loadQuizDraft(key: string): Promise<StoredQuizDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return null;
    const draft = parseStoredQuizDraft(raw);
    // Unreadable (corrupt, or written by an incompatible version): drop it rather than trip on it again.
    if (!draft) await AsyncStorage.removeItem(key);
    return draft;
  } catch (e) {
    console.warn('[quizDraft] Failed to load the stored draft', e);
    return null;
  }
}

/** True when the draft was stored. */
export async function saveQuizDraft(key: string, draft: StoredQuizDraft): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(draft));
    return true;
  } catch (e) {
    console.warn('[quizDraft] Failed to store the draft', e);
    return false;
  }
}

/** Records question numbers just saved to the question bank, so they show as saved and can't be picked again. */
export async function markQuizDraftSaved(key: string, numbers: number[]): Promise<void> {
  try {
    const draft = parseStoredQuizDraft(await AsyncStorage.getItem(key));
    if (!draft) return;
    await AsyncStorage.setItem(key, JSON.stringify({ ...draft, savedToBank: mergeSavedNumbers(draft.savedToBank, numbers) }));
  } catch (e) {
    console.warn('[quizDraft] Failed to mark questions as saved', e);
  }
}

export async function discardQuizDraft(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.warn('[quizDraft] Failed to discard the draft', e);
  }
}
