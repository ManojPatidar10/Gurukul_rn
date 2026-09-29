import {
  fileSlug,
  MAX_LOGO_BYTES,
  sectionReportCardsFileName,
  studentReportCardFileName,
  validateLogo,
} from '../utils/reportCardPdfName';

describe('report card PDF file names', () => {
  it('slugifies names and terms to ASCII', () => {
    expect(studentReportCardFileName('Aarav Kumar', 'Term 1')).toBe('report-card-aarav-kumar-term-1.pdf');
    expect(sectionReportCardsFileName('Grade 7', 'A', 'Annual')).toBe('report-cards-grade-7-a-annual.pdf');
  });

  it('falls back when a name has no ASCII characters (e.g. Hindi only)', () => {
    expect(fileSlug('प्रिया शर्मा')).toBe('student');
    expect(studentReportCardFileName('प्रिया', 'Term 1')).toBe('report-card-student-term-1.pdf');
    expect(fileSlug('', 'term')).toBe('term');
  });
});

describe('validateLogo', () => {
  it('accepts PNG and JPEG up to 2 MB', () => {
    expect(validateLogo('image/png', 1000)).toBeNull();
    expect(validateLogo('image/jpeg', MAX_LOGO_BYTES)).toBeNull();
    expect(validateLogo('image/png', undefined)).toBeNull();
  });

  it('rejects other types and oversize files', () => {
    expect(validateLogo('image/webp', 1000)).toBe('schoolLogo.errors.type');
    expect(validateLogo(undefined, 1000)).toBe('schoolLogo.errors.type');
    expect(validateLogo('image/png', MAX_LOGO_BYTES + 1)).toBe('schoolLogo.errors.size');
  });
});
