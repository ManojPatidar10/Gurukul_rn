import {
  idCardFileName,
  isValidPhone,
  MAX_PHOTO_BYTES,
  missingLabelKey,
  sectionIdSheetFileName,
  validatePhoto,
} from '../utils/idCard';

describe('validatePhoto', () => {
  it('accepts PNG and JPEG up to 3 MB', () => {
    expect(validatePhoto('image/jpeg', 1000)).toBeNull();
    expect(validatePhoto('image/png', MAX_PHOTO_BYTES)).toBeNull();
    expect(validatePhoto('image/jpeg', undefined)).toBeNull();
  });

  it('rejects other types and oversize files', () => {
    expect(validatePhoto('image/heic', 1000)).toBe('idCard.errors.photoType');
    expect(validatePhoto(null, 1000)).toBe('idCard.errors.photoType');
    expect(validatePhoto('image/jpeg', MAX_PHOTO_BYTES + 1)).toBe('idCard.errors.photoSize');
  });
});

describe('isValidPhone', () => {
  it('matches the backend rule', () => {
    expect(isValidPhone('+91 98765 43210')).toBe(true);
    expect(isValidPhone('(0731) 234-5678')).toBe(true);
    expect(isValidPhone('')).toBe(true);
    expect(isValidPhone('12345')).toBe(false);
    expect(isValidPhone('98765abcde')).toBe(false);
  });
});

describe('ID card helpers', () => {
  it('maps missing codes to i18n keys', () => {
    expect(missingLabelKey('PHOTO')).toBe('idCard.missing.photo');
    expect(missingLabelKey('BLOOD_GROUP')).toBe('idCard.missing.bloodGroup');
    expect(missingLabelKey('EMERGENCY_CONTACT')).toBe('idCard.missing.emergencyContact');
    expect(missingLabelKey('SOMETHING_NEW')).toBe('idCard.missing.other');
  });

  it('builds ASCII file names', () => {
    expect(idCardFileName('Aarav Kumar')).toBe('id-card-aarav-kumar.pdf');
    expect(idCardFileName('प्रिया')).toBe('id-card-person.pdf');
    expect(sectionIdSheetFileName('Grade 7', 'A')).toBe('id-cards-grade-7-a.pdf');
  });
});
