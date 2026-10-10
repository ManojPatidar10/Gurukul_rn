import { createInstance, type TFunction } from 'i18next';

import en from '../i18n/locales/en.json';
import hi from '../i18n/locales/hi.json';

/**
 * Real `t` functions over the app's own locale files, for testing helpers that take `t`. Set up like
 * src/i18n/index.ts: English fallback, and no HTML escaping - without escapeValue: false the quotes
 * in `Bands "B" and "A" overlap.` would come out as &quot;. It lives here rather than in
 * src/__tests__ because jest runs every file in a __tests__ folder as a test, and a file with no
 * tests in it fails the run.
 */
function fixedT(lng: 'en' | 'hi'): TFunction {
  const instance = createInstance();
  instance.init({
    resources: { en: { translation: en }, hi: { translation: hi } },
    lng,
    fallbackLng: 'en',
    initAsync: false,
    interpolation: { escapeValue: false },
  });
  return instance.t;
}

export const tEn = fixedT('en');
export const tHi = fixedT('hi');

/**
 * A locale value with its {{variables}} filled in by hand, so a Hindi test asserts against whatever
 * hi.json says rather than a copy of the wording: `fill(hi.games.common.vs, { name: 'Riya' })`.
 */
export function fill(text: string, vars: Record<string, string | number> = {}): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}
