import { useTranslation } from 'react-i18next';

import { setAppLanguage, SUPPORTED_LANGUAGES, SupportedLanguage } from './index';

export function useLanguage() {
  const { i18n } = useTranslation();

  return {
    language: i18n.language as SupportedLanguage['code'],
    languages: SUPPORTED_LANGUAGES,
    setLanguage: (code: SupportedLanguage['code']) => setAppLanguage(code),
  };
}
