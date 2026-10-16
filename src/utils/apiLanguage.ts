/**
 * The server's AiLanguage names a language EN / HI / HINGLISH, while i18n.language is a BCP-47 tag
 * ("en", "hi", "en-IN"). Sending the tag straight through is refused as "language has an invalid
 * value", so every request that carries a language goes through this.
 */
export type ApiLanguage = 'EN' | 'HI';

export function toApiLanguage(language?: string): ApiLanguage | undefined {
  if (!language) return undefined;
  return language.toLowerCase().startsWith('hi') ? 'HI' : 'EN';
}
