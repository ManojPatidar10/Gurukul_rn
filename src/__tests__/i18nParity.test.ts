// Reads the app's source files, so it needs Node's types (the app's tsconfig only loads jest's).
/// <reference types="node" />
import fs from 'fs';
import path from 'path';

import en from '../i18n/locales/en.json';
import hi from '../i18n/locales/hi.json';

/**
 * Keeps en.json and hi.json in step: the same keys, the same {{variables}}, complete plural pairs,
 * and every key the app asks for by name actually there. A key typo isn't a type error (keys aren't
 * typed), so without this the screen would show the raw key.
 */

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  for (const [key, value] of Object.entries(tree)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object') flatten(value, full, out);
    else out[full] = value;
  }
  return out;
}

const EN = flatten(en as Tree);
const HI = flatten(hi as Tree);

/** The {{name}} variables a value uses, ignoring any ", format" part, sorted and de-duplicated. */
function variables(value: unknown): string[] {
  const names = new Set<string>();
  for (const match of String(value).matchAll(/\{\{\s*([^,}]+?)\s*(?:,[^}]*)?\}\}/g)) names.add(match[1]);
  return [...names].sort();
}

const nestingCount = (value: unknown) => String(value).split('$t(').length - 1;

describe('locale parity (en.json / hi.json)', () => {
  it('has exactly the same keys in both files', () => {
    const missingInHi = Object.keys(EN).filter((k) => !(k in HI));
    const missingInEn = Object.keys(HI).filter((k) => !(k in EN));
    expect({ missingInHi, missingInEn }).toEqual({ missingInHi: [], missingInEn: [] });
  });

  it('uses the same interpolation variables and $t( nestings for each key', () => {
    const mismatched = Object.keys(EN)
      .filter((k) => k in HI)
      .filter(
        (k) =>
          variables(EN[k]).join(',') !== variables(HI[k]).join(',') || nestingCount(EN[k]) !== nestingCount(HI[k])
      )
      .map((k) => `${k}: en {${variables(EN[k])}} vs hi {${variables(HI[k])}}`);
    expect(mismatched).toEqual([]);
  });

  it('has a non-empty string for every value', () => {
    const bad = (map: Record<string, unknown>, lang: string) =>
      Object.entries(map)
        .filter(([, value]) => typeof value !== 'string' || value.trim() === '')
        .map(([key]) => `${lang}:${key}`);
    expect([...bad(EN, 'en'), ...bad(HI, 'hi')]).toEqual([]);
  });

  it('has both halves of every plural pair', () => {
    const incomplete = (map: Record<string, unknown>, lang: string) =>
      Object.keys(map)
        .filter(
          (k) =>
            (k.endsWith('_one') && !(`${k.slice(0, -4)}_other` in map)) ||
            (k.endsWith('_other') && !(`${k.slice(0, -6)}_one` in map))
        )
        .map((k) => `${lang}:${k}`);
    expect([...incomplete(EN, 'en'), ...incomplete(HI, 'hi')]).toEqual([]);
  });

  it('has every key the app asks for by name', () => {
    const SRC = path.join(__dirname, '..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__') walk(full);
        } else if (/\.tsx?$/.test(entry.name)) {
          files.push(full);
        }
      }
    };
    walk(SRC);

    // t('a.b') / t("a.b") calls, plus any quoted key in this task's namespaces - those include the
    // enum-to-key maps (Record<Union, string>), which hold keys rather than call t with them.
    const T_CALL = /\bt\(\s*(['"])([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)\1/g;
    const NAMESPACED = /(['"])((?:games|questionBank|assessments|gradingScale)\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\1/g;
    const exists = (key: string) => key in EN || `${key}_one` in EN || `${key}_other` in EN;

    const used = new Map<string, string>();
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      for (const regex of [T_CALL, NAMESPACED]) {
        for (const match of text.matchAll(regex)) used.set(match[2], path.relative(SRC, file));
      }
    }
    expect(used.size).toBeGreaterThan(100);
    const missing = [...used].filter(([key]) => !exists(key)).map(([key, file]) => `${key} (${file})`);
    expect(missing).toEqual([]);
  });

  it('has Hindi, not pasted English, in the games and assessment namespaces', () => {
    const OWN = /^(games|questionBank|assessments|gradingScale)\./;
    const hasWords = (value: unknown) =>
      /[A-Za-z]/.test(
        String(value)
          .replace(/\{\{[^}]*\}\}/g, '')
          .replace(/\b(XP|AI)\b/g, '')
      );
    const english = Object.keys(EN)
      .filter((k) => OWN.test(k) && hasWords(EN[k]))
      .filter((k) => !/[ऀ-ॿ]/.test(String(HI[k])));
    expect(english).toEqual([]);
  });
});
