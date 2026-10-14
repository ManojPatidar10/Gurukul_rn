/**
 * The locale to format a date or time in, for the app's language: 'hi' when the app is in Hindi, so
 * months and weekdays come out in Hindi, and undefined otherwise - the phone's own locale, which is
 * what every date in the app used before it had a language setting. Passing i18n.language ('en')
 * instead would turn an Indian-English phone's "14 Oct 2026" into the US "Oct 14, 2026".
 */
export function dateLocale(language: string | undefined): 'hi' | undefined {
  return language?.split('-')[0] === 'hi' ? 'hi' : undefined;
}
