/**
 * The WhatsApp "track the bus" link, https://api.smartgurukul.org/track/{token}. When the app is
 * installed it opens these itself (App Links / Universal Links, see app.json) - this pulls the
 * token out so the app can show the same live map as the web page.
 */
const TRACK_PATH = /^\/track\/([A-Za-z0-9_-]{8,32})\/?$/;

export function trackTokenFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    const match = TRACK_PATH.exec(parsed.pathname);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
