import { createInstance } from 'i18next';
import type { ReactElement } from 'react';
import { Text } from 'react-native';
import { initReactI18next, Trans } from 'react-i18next';

import en from '../i18n/locales/en.json';
import hi from '../i18n/locales/hi.json';

// The renderer jest-expo's preset brings (react-test-renderer, the same version as react). Typed here,
// as i18nParity.test.ts types fs, because the app has no @types for it.
const { act, create } = jest.requireActual<{
  act(callback: () => void): void;
  create(element: ReactElement): { toJSON(): unknown };
}>('react-test-renderer');

/**
 * AttendanceTakeBody's "You'll mark this as **name**" is the app's first <Trans>: one sentence per
 * language with the name in bold wherever the language puts it. Set up the way src/i18n/index.ts
 * sets the app up (initReactI18next registers the instance Trans reads), so a broken tag or
 * component mapping shows here rather than as a blank line on a teacher's phone.
 */
const i18n = createInstance();
i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi } },
  lng: 'en',
  fallbackLng: 'en',
  initAsync: false,
  interpolation: { escapeValue: false },
});

const BOLD = { fontWeight: '700' as const };

function render(lng: 'en' | 'hi', name: string) {
  let tree: { toJSON(): unknown } | undefined;
  act(() => {
    tree = create(
      <Text>
        <Trans
          t={i18n.getFixedT(lng)}
          i18nKey="attendance.take.youWillMark"
          values={{ name }}
          components={{ bold: <Text style={BOLD} /> }}
        />
      </Text>
    );
  });
  return tree!.toJSON();
}

const bold = (name: string) => ({ type: 'Text', props: { style: BOLD }, children: [name] });

describe('attendance.take.youWillMark', () => {
  it('reads as before in English, with the name in bold', () => {
    expect(render('en', 'Asha Verma (you)')).toEqual({
      type: 'Text',
      props: {},
      children: ["You'll mark this as ", bold('Asha Verma (you)')],
    });
  });

  it('puts the bold name mid-sentence in Hindi', () => {
    const [before, after] = hi.attendance.take.youWillMark.split(/<bold>\{\{name\}\}<\/bold>/);
    expect(render('hi', 'Asha Verma (आप)')).toEqual({
      type: 'Text',
      props: {},
      children: [before, bold('Asha Verma (आप)'), after],
    });
  });
});
