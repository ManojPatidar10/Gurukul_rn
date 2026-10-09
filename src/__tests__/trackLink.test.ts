import { trackTokenFromUrl } from '../transport/trackLink';

describe('trackTokenFromUrl', () => {
  it('reads the token from a tracking link', () => {
    expect(trackTokenFromUrl('https://api.smartgurukul.org/track/tn85vQ5Hw2mH5dE2KCi9lw')).toBe('tn85vQ5Hw2mH5dE2KCi9lw');
    expect(trackTokenFromUrl('https://api.smartgurukul.org/track/tn85vQ5Hw2mH5dE2KCi9lw/')).toBe('tn85vQ5Hw2mH5dE2KCi9lw');
  });

  it('ignores anything else', () => {
    expect(trackTokenFromUrl('https://api.smartgurukul.org/track/tn85vQ5Hw2mH5dE2KCi9lw/data')).toBeNull();
    expect(trackTokenFromUrl('https://api.smartgurukul.org/api/v1/transport/me')).toBeNull();
    expect(trackTokenFromUrl('exp+gurukul-rn://expo-development-client/?url=x')).toBeNull();
    expect(trackTokenFromUrl('not a url')).toBeNull();
    expect(trackTokenFromUrl(null)).toBeNull();
  });
});
