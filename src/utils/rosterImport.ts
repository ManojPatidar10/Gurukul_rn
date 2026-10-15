import type { ClassSection, StudentRequest } from '../api/types';

/**
 * Turns a pasted or uploaded student register into rows for POST /api/v1/students/bulk.
 *
 * Input is whatever a school has: a sheet copied from Excel (tab-separated), a .csv export, or
 * lines typed in WhatsApp (comma-separated). A header row is recognised by English or Hindi
 * column names; without one the columns are taken in the order of {@link DEFAULT_COLUMNS}.
 * Every row is kept, with its problems listed, so the school can see which lines of a 400-row
 * register still need a fix before the clean ones go up.
 */

export type RosterColumn =
  | 'name'
  | 'className'
  | 'section'
  | 'gender'
  | 'dob'
  | 'parentName'
  | 'parentContact'
  | 'address'
  | 'ignore';

/** Column order assumed when the first line is not a header. */
export const DEFAULT_COLUMNS: RosterColumn[] = [
  'name',
  'className',
  'section',
  'gender',
  'dob',
  'parentName',
  'parentContact',
  'address',
];

export type RosterProblem = 'name' | 'className' | 'section' | 'gender' | 'dob' | 'parentName' | 'parentContact' | 'classSection';

export interface RosterRow {
  /** 1-based line number in the pasted text, for pointing at the line to fix. */
  line: number;
  name: string;
  className: string;
  section: string;
  /** MALE / FEMALE / OTHER once recognised; '' when the cell was blank or unreadable. */
  gender: string;
  /** ISO yyyy-mm-dd once recognised; '' otherwise. */
  dob: string;
  parentName: string;
  /** Ten digits once cleaned; '' otherwise. */
  parentContact: string;
  address: string;
  problems: RosterProblem[];
}

export interface ParsedRoster {
  columns: RosterColumn[];
  hadHeader: boolean;
  rows: RosterRow[];
}

// Header cells are matched after lowercasing and stripping punctuation, so "Father's Name",
// "FATHER NAME" and "पिता का नाम" all land on parentName.
const HEADER_SYNONYMS: [RosterColumn, string[]][] = [
  ['parentContact', ['mobile', 'phone', 'contact', 'whatsapp', 'मोबाइल', 'फोन', 'फ़ोन', 'संपर्क']],
  ['parentName', ['father', 'mother', 'parent', 'guardian', 'पिता', 'माता', 'अभिभावक', 'पालक']],
  ['className', ['class', 'std', 'standard', 'grade', 'कक्षा', 'क्लास']],
  ['section', ['section', 'sec', 'सेक्शन', 'अनुभाग', 'वर्ग']],
  ['gender', ['gender', 'sex', 'लिंग']],
  ['dob', ['dob', 'birth', 'जन्म']],
  ['address', ['address', 'पता', 'गांव', 'गाँव', 'village']],
  ['name', ['student', 'name', 'नाम', 'छात्र', 'विद्यार्थी']],
  ['ignore', ['roll', 'sr', 'sno', 'no', 'क्रम', 'रोल', 'admission', 'reg', 'id', 'remarks']],
];

const MALE = ['m', 'male', 'boy', 'लड़का', 'पुरुष', 'बालक', 'छात्र'];
const FEMALE = ['f', 'female', 'girl', 'लड़की', 'महिला', 'स्त्री', 'बालिका', 'छात्रा'];
const OTHER = ['o', 'other', 'अन्य'];

function normalise(cell: string): string {
  return cell
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();
}

function headerColumn(cell: string): RosterColumn | null {
  const words = normalise(cell);
  if (!words) return null;
  for (const [column, synonyms] of HEADER_SYNONYMS) {
    if (synonyms.some((s) => words === s || words.split(' ').includes(s) || words.includes(s))) return column;
  }
  return null;
}

/** The delimiter is whichever of tab, comma or semicolon splits the first line into the most cells. */
export function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
  return ['\t', ',', ';'].reduce((best, d) => (first.split(d).length > first.split(best).length ? d : best), '\t');
}

function splitLine(line: string, delimiter: string): string[] {
  if (delimiter !== ',') return line.split(delimiter).map((c) => c.trim());
  // Minimal CSV quoting: a quoted cell may hold a comma ("Sharma, Rahul").
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell.trim());
  return cells;
}

/** A line is a header when at least two of its cells name a known column and none looks like a phone. */
export function looksLikeHeader(cells: string[]): boolean {
  const known = cells.filter((c) => headerColumn(c) !== null).length;
  const hasPhone = cells.some((c) => normalisePhone(c) !== '');
  return known >= 2 && !hasPhone;
}

export function mapHeader(cells: string[]): RosterColumn[] {
  const used = new Set<RosterColumn>();
  return cells.map((cell) => {
    const column = headerColumn(cell) ?? 'ignore';
    if (column !== 'ignore' && used.has(column)) return 'ignore';
    used.add(column);
    return column;
  });
}

/** Keeps the last ten digits of anything that has at least ten (drops +91, 0, spaces, dashes). */
export function normalisePhone(cell: string): string {
  const digits = cell.replace(/\D/g, '');
  if (digits.length < 10) return '';
  const last10 = digits.slice(-10);
  return /^[6-9]\d{9}$/.test(last10) ? last10 : '';
}

export function normaliseGender(cell: string): string {
  const v = normalise(cell);
  if (!v) return '';
  if (MALE.includes(v)) return 'MALE';
  if (FEMALE.includes(v)) return 'FEMALE';
  if (OTHER.includes(v)) return 'OTHER';
  return '';
}

/** dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, yyyy-mm-dd or yyyy/mm/dd → yyyy-mm-dd; '' when not a past date. */
export function normaliseDob(cell: string, today: Date = new Date()): string {
  const v = cell.trim();
  let y: number;
  let m: number;
  let d: number;
  let match = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
    if (!match) return '';
    [d, m] = [Number(match[1]), Number(match[2])];
    y = Number(match[3]);
    if (match[3].length === 2) y += 2000;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return '';
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return '';
  if (date.getTime() >= Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) return '';
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "Class 5", "5th", "V", "LKG", "Nursery" → the class name as the school's class-sections spell it. */
export function normaliseClassName(cell: string): string {
  const v = cell.trim().replace(/^(class|std\.?|standard|grade|कक्षा)\s*/i, '').replace(/(st|nd|rd|th)$/i, '').trim();
  const roman: Record<string, string> = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10', xi: '11', xii: '12' };
  const lower = v.toLowerCase();
  if (roman[lower]) return roman[lower];
  if (/^\d{1,2}$/.test(v)) return String(Number(v));
  return v.toUpperCase() === v ? v : v.charAt(0).toUpperCase() + v.slice(1);
}

export function parseRoster(text: string, today: Date = new Date()): ParsedRoster {
  const delimiter = detectDelimiter(text);
  const lines = text.split(/\r?\n/);
  let columns = DEFAULT_COLUMNS;
  let hadHeader = false;
  const rows: RosterRow[] = [];
  let first = true;
  lines.forEach((raw, index) => {
    if (!raw.trim()) return;
    const cells = splitLine(raw, delimiter);
    if (first) {
      first = false;
      if (looksLikeHeader(cells)) {
        columns = mapHeader(cells);
        hadHeader = true;
        return;
      }
    }
    const get = (column: RosterColumn) => {
      const i = columns.indexOf(column);
      return i === -1 ? '' : (cells[i] ?? '');
    };
    const row: RosterRow = {
      line: index + 1,
      name: get('name').trim(),
      className: normaliseClassName(get('className')),
      section: get('section').trim().toUpperCase(),
      gender: normaliseGender(get('gender')),
      dob: normaliseDob(get('dob'), today),
      parentName: get('parentName').trim(),
      parentContact: normalisePhone(get('parentContact')),
      address: get('address').trim(),
      problems: [],
    };
    if (!row.name) row.problems.push('name');
    if (!row.className) row.problems.push('className');
    if (!row.section) row.problems.push('section');
    if (!row.gender) row.problems.push('gender');
    if (!row.dob) row.problems.push('dob');
    if (!row.parentName) row.problems.push('parentName');
    if (!row.parentContact) row.problems.push('parentContact');
    rows.push(row);
  });
  return { columns, hadHeader, rows };
}

const sectionKey = (className: string, section: string) => `${className.toLowerCase()}|${section.toLowerCase()}`;

/** The (class, section) pairs the register uses that the school has not created yet. */
export function missingClassSections(rows: RosterRow[], existing: ClassSection[]): { className: string; section: string }[] {
  const have = new Set(existing.map((cs) => sectionKey(cs.className, cs.section)));
  const missing = new Map<string, { className: string; section: string }>();
  for (const row of rows) {
    if (!row.className || !row.section) continue;
    const key = sectionKey(row.className, row.section);
    if (!have.has(key) && !missing.has(key)) missing.set(key, { className: row.className, section: row.section });
  }
  return [...missing.values()];
}

/**
 * Attaches each row to its class-section; rows that still have no section get a 'classSection'
 * problem. Returns the rows (all of them, problems updated) and the requests for the clean ones.
 */
export function toStudentRequests(
  rows: RosterRow[],
  existing: ClassSection[],
  defaults: { address: string; admissionDate: string }
): { rows: RosterRow[]; requests: StudentRequest[]; requestLines: number[] } {
  const byKey = new Map(existing.map((cs) => [sectionKey(cs.className, cs.section), cs.id]));
  const requests: StudentRequest[] = [];
  const requestLines: number[] = [];
  const updated = rows.map((row) => {
    const problems: RosterProblem[] = row.problems.filter((p) => p !== 'classSection');
    const classSectionId = row.className && row.section ? byKey.get(sectionKey(row.className, row.section)) : undefined;
    if (!classSectionId && row.className && row.section) problems.push('classSection');
    const next = { ...row, problems };
    if (problems.length === 0 && classSectionId) {
      requests.push({
        name: row.name,
        dob: row.dob,
        gender: row.gender,
        address: row.address || defaults.address,
        parentName: row.parentName,
        parentContact: row.parentContact,
        classSectionId,
        admissionDate: defaults.admissionDate,
      });
      requestLines.push(row.line);
    }
    return next;
  });
  return { rows: updated, requests, requestLines };
}
