import type { ClassSection } from '../api/types';
import {
  detectDelimiter,
  missingClassSections,
  normaliseClassName,
  normaliseDob,
  normaliseGender,
  normalisePhone,
  parseRoster,
  toStudentRequests,
} from '../utils/rosterImport';

const TODAY = new Date(2026, 9, 15);

const section = (className: string, sectionName: string): ClassSection => ({
  id: `${className}-${sectionName}`,
  schoolId: 's',
  className,
  section: sectionName,
  academicYear: '2026-27',
  displayLabel: `${className}-${sectionName}`,
  classTeacherId: null,
  classTeacherName: null,
});

describe('parseRoster', () => {
  it('reads an Excel paste (tabs) with an English header in any column order', () => {
    const text = [
      'Roll\tStudent Name\tClass\tSection\tGender\tDate of Birth\tFather Name\tMobile No',
      '1\tRahul Sharma\t5\tA\tM\t15/05/2015\tRajesh Sharma\t98765 43210',
      '2\tPriya Verma\tClass 5\tB\tFemale\t2016-01-20\tSunita Verma\t+91 9123456789',
    ].join('\n');
    const parsed = parseRoster(text, TODAY);
    expect(parsed.hadHeader).toBe(true);
    expect(parsed.columns).toEqual(['ignore', 'name', 'className', 'section', 'gender', 'dob', 'parentName', 'parentContact']);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({
      line: 2,
      name: 'Rahul Sharma',
      className: '5',
      section: 'A',
      gender: 'MALE',
      dob: '2015-05-15',
      parentName: 'Rajesh Sharma',
      parentContact: '9876543210',
      problems: [],
    });
    expect(parsed.rows[1]).toMatchObject({ className: '5', section: 'B', gender: 'FEMALE', dob: '2016-01-20', parentContact: '9123456789', problems: [] });
  });

  it('reads a Hindi header', () => {
    const text = ['नाम,कक्षा,सेक्शन,लिंग,जन्म तिथि,पिता का नाम,मोबाइल', 'अमित पाटीदार,8,A,लड़का,01-04-2013,राम पाटीदार,9988776655'].join('\n');
    const parsed = parseRoster(text, TODAY);
    expect(parsed.hadHeader).toBe(true);
    expect(parsed.rows[0]).toMatchObject({ name: 'अमित पाटीदार', className: '8', gender: 'MALE', dob: '2013-04-01', parentContact: '9988776655', problems: [] });
  });

  it('takes the default column order when there is no header', () => {
    const text = 'Rahul Sharma, 5, A, M, 15/05/2015, Rajesh Sharma, 9876543210, Ujjain\nPriya Verma, 5, A, F, 20/01/2016, Sunita Verma, 9123456789';
    const parsed = parseRoster(text, TODAY);
    expect(parsed.hadHeader).toBe(false);
    expect(parsed.rows[0]).toMatchObject({ name: 'Rahul Sharma', address: 'Ujjain', problems: [] });
    expect(parsed.rows[1]).toMatchObject({ name: 'Priya Verma', address: '', problems: [] });
  });

  it('keeps a bad row and names what is wrong with it', () => {
    const text = ['Name,Class,Section,Gender,DOB,Parent,Mobile', 'Rahul Sharma,5,A,M,15/05/2015,Rajesh Sharma,9876543210', ',5,A,X,31/02/2015,,12345'].join('\n');
    const parsed = parseRoster(text, TODAY);
    expect(parsed.rows[0].problems).toEqual([]);
    expect(parsed.rows[1].line).toBe(3);
    expect(parsed.rows[1].problems).toEqual(['name', 'gender', 'dob', 'parentName', 'parentContact']);
  });

  it('skips blank lines and keeps a quoted comma inside a CSV cell', () => {
    const text = 'Name,Class,Section,Gender,DOB,Parent,Mobile\n\n"Sharma, Rahul",5,A,M,15/05/2015,Rajesh,9876543210\n\n';
    const parsed = parseRoster(text, TODAY);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].name).toBe('Sharma, Rahul');
  });
});

describe('cell normalisers', () => {
  it('picks the delimiter that splits the first line most', () => {
    expect(detectDelimiter('a\tb\tc\n')).toBe('\t');
    expect(detectDelimiter('a,b,c')).toBe(',');
    expect(detectDelimiter('a;b;c')).toBe(';');
  });

  it('keeps the last ten digits of an Indian mobile and rejects the rest', () => {
    expect(normalisePhone('+91 98765-43210')).toBe('9876543210');
    expect(normalisePhone('09876543210')).toBe('9876543210');
    expect(normalisePhone('12345')).toBe('');
    expect(normalisePhone('0413 2234567')).toBe(''); // a landline
  });

  it('reads gender in English and Hindi', () => {
    expect(normaliseGender('M')).toBe('MALE');
    expect(normaliseGender('Girl')).toBe('FEMALE');
    expect(normaliseGender('लड़की')).toBe('FEMALE');
    expect(normaliseGender('अन्य')).toBe('OTHER');
    expect(normaliseGender('?')).toBe('');
  });

  it('reads the date formats registers use and refuses impossible or future dates', () => {
    expect(normaliseDob('15/05/2015', TODAY)).toBe('2015-05-15');
    expect(normaliseDob('5-5-15', TODAY)).toBe('2015-05-05');
    expect(normaliseDob('2015.05.15', TODAY)).toBe('2015-05-15');
    expect(normaliseDob('31/02/2015', TODAY)).toBe('');
    expect(normaliseDob('15/05/2027', TODAY)).toBe('');
    expect(normaliseDob('May 2015', TODAY)).toBe('');
  });

  it('spells a class the way class-sections do', () => {
    expect(normaliseClassName('Class 5')).toBe('5');
    expect(normaliseClassName('05')).toBe('5');
    expect(normaliseClassName('VIII')).toBe('8');
    expect(normaliseClassName('10th')).toBe('10');
    expect(normaliseClassName('lkg')).toBe('Lkg');
    expect(normaliseClassName('LKG')).toBe('LKG');
    expect(normaliseClassName('nursery')).toBe('Nursery');
  });
});

describe('class-section matching', () => {
  const rows = parseRoster(
    ['Name,Class,Section,Gender,DOB,Parent,Mobile', 'A,5,A,M,15/05/2015,P,9876543210', 'B,5,B,M,15/05/2015,P,9876543210', 'C,6,a,F,15/05/2015,P,9876543210'].join('\n'),
    TODAY
  ).rows;

  it('lists each missing class-section once, ignoring case', () => {
    expect(missingClassSections(rows, [section('5', 'A')])).toEqual([
      { className: '5', section: 'B' },
      { className: '6', section: 'A' },
    ]);
  });

  it('builds requests for the clean rows only and flags rows whose section does not exist', () => {
    const { rows: updated, requests, requestLines } = toStudentRequests(rows, [section('5', 'A'), section('6', 'A')], {
      address: 'Ujjain',
      admissionDate: '2026-10-15',
    });
    expect(updated.map((r) => r.problems)).toEqual([[], ['classSection'], []]);
    expect(requestLines).toEqual([2, 4]);
    expect(requests[0]).toEqual({
      name: 'A',
      dob: '2015-05-15',
      gender: 'MALE',
      address: 'Ujjain',
      parentName: 'P',
      parentContact: '9876543210',
      classSectionId: '5-A',
      admissionDate: '2026-10-15',
    });
    expect(requests[1].classSectionId).toBe('6-A');
  });
});
