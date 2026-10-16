import { toApiLanguage } from '../utils/apiLanguage';

/**
 * The server's AiLanguage is EN / HI / HINGLISH; i18n.language is a BCP-47 tag. Sending the tag
 * straight through was rejected as "language has an invalid value", which took the whole practice
 * screen down - the session fetch carries the parameter too, not just the explain call.
 */
describe('toApiLanguage', () => {
  it('maps the app language tags the server actually sees', () => {
    expect(toApiLanguage('en')).toBe('EN');
    expect(toApiLanguage('hi')).toBe('HI');
  });

  it('maps a region-qualified tag, which is what a real device sends', () => {
    expect(toApiLanguage('en-IN')).toBe('EN');
    expect(toApiLanguage('hi-IN')).toBe('HI');
  });

  it('never returns a lowercase tag - that is the value the server refuses', () => {
    for (const tag of ['en', 'hi', 'en-GB', 'HI', 'Hi']) {
      expect(['EN', 'HI']).toContain(toApiLanguage(tag));
    }
  });

  it('leaves the parameter off when the caller has no language', () => {
    expect(toApiLanguage(undefined)).toBeUndefined();
    expect(toApiLanguage('')).toBeUndefined();
  });
});
