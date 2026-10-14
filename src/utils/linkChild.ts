import type { Student } from '../api/types';

/**
 * The registration number as the Link another child screen sends it: trimmed, since a number
 * pasted from a message often carries a space. The backend looks it up exactly as sent. An empty
 * result means there is nothing to send, so the button stays disabled.
 */
export function linkChildNumber(input: string): string {
  return input.trim();
}

/** Who the confirmation names: the linked child's name and class, as LinkChildScreen shows them. */
export interface LinkedChildSummary {
  name: string;
  classSection: string;
}

/**
 * What the confirmation after a link can say about the child. The backend returns the linked
 * child (POST /api/v1/parents/me/children); one from before that change returns null, and then the
 * confirmation is the generic "The child is now linked". A child without a name or class label is
 * treated the same way, so the named message never shows an empty name or "()".
 */
export function linkedChildSummary(
  child: Pick<Student, 'name' | 'classSectionLabel'> | null | undefined
): LinkedChildSummary | null {
  const name = child?.name?.trim();
  const classSection = child?.classSectionLabel?.trim();
  return name && classSection ? { name, classSection } : null;
}
