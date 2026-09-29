import { fileSlug } from './reportCardPdfName';

/** The blood groups the backend accepts (it also normalises "b +ve" etc., but the app offers chips). */
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

/** Profile photos: the two formats the card PDF can embed, max 3 MB (same limits as the backend). */
export const PHOTO_CONTENT_TYPES = ['image/png', 'image/jpeg'] as const;
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

/** Null if the picked photo is acceptable, otherwise an i18n key describing why not. */
export function validatePhoto(contentType: string | null | undefined, sizeBytes: number | null | undefined): string | null {
  if (!contentType || !(PHOTO_CONTENT_TYPES as readonly string[]).includes(contentType)) return 'idCard.errors.photoType';
  if (sizeBytes != null && sizeBytes > MAX_PHOTO_BYTES) return 'idCard.errors.photoSize';
  return null;
}

/** Same rule as the backend: 7-15 digits, optional leading +, spaces/dashes/brackets ignored. Blank is allowed (clears it). */
export function isValidPhone(value: string): boolean {
  const normalised = value.replace(/[\s()-]/g, '');
  return normalised === '' || /^\+?[0-9]{7,15}$/.test(normalised);
}

/** i18n key for one entry of a card's `missing` list. */
export function missingLabelKey(code: string): string {
  switch (code) {
    case 'PHOTO':
      return 'idCard.missing.photo';
    case 'BLOOD_GROUP':
      return 'idCard.missing.bloodGroup';
    case 'EMERGENCY_CONTACT':
      return 'idCard.missing.emergencyContact';
    default:
      return 'idCard.missing.other';
  }
}

export function idCardFileName(name: string) {
  return `id-card-${fileSlug(name, 'person')}.pdf`;
}

export function sectionIdSheetFileName(className: string, section: string) {
  return `id-cards-${fileSlug(className, 'class')}-${fileSlug(section, 'section')}.pdf`;
}

export const STAFF_ID_SHEET_FILE_NAME = 'id-cards-staff.pdf';
