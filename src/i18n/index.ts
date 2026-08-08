import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import hi from './locales/hi.json';

export const LANGUAGE_STORAGE_KEY = 'gurukul.language';

export interface SupportedLanguage {
  code: 'en' | 'hi';
  nativeLabel: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', nativeLabel: 'English' },
  { code: 'hi', nativeLabel: 'हिन्दी' },
];

function isSupported(code: string | null | undefined): code is SupportedLanguage['code'] {
  return SUPPORTED_LANGUAGES.some((l) => l.code === code);
}

async function detectInitialLanguage(): Promise<SupportedLanguage['code']> {
  const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (isSupported(stored)) return stored;

  const deviceLanguage = Localization.getLocales()[0]?.languageCode;
  if (isSupported(deviceLanguage)) return deviceLanguage;

  return 'en';
}

export async function initI18n(): Promise<void> {
  const language = await detectInitialLanguage();
  await i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
    },
    lng: language,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
}

export async function setAppLanguage(code: SupportedLanguage['code']): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  await i18n.changeLanguage(code);
}

export default i18n;
