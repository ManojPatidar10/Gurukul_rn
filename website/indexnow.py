"""Tells IndexNow search engines (Bing, Yandex, Seznam, Naver and others) that the site's pages changed.

Run it by hand ONCE AFTER a website PR is merged and GitHub Pages has finished deploying, never before:
it announces the live URLs, and the engines fetch them straight away.

    python website/indexnow.py            # ping every URL in docs/sitemap.xml
    python website/indexnow.py --dry-run  # print the request without sending it

How it works: the key below is published at https://smartgurukul.org/<KEY>.txt (docs/<KEY>.txt), which
proves to the engines that this site sent the ping. The script POSTs every <loc> from the local
docs/sitemap.xml to https://api.indexnow.org/indexnow (one shared endpoint; it forwards to all
participating engines). Standard library only. Google does not use IndexNow; submit the sitemap in
Search Console instead.
"""
import json
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

KEY = "d0366ed382710c7f876600b5319e31a9"
HOST = "smartgurukul.org"
ENDPOINT = "https://api.indexnow.org/indexnow"
DOCS = Path(__file__).resolve().parent.parent / "docs"


def sitemap_urls():
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    root = ET.parse(DOCS / "sitemap.xml").getroot()
    return [loc.text.strip() for loc in root.findall("sm:url/sm:loc", ns)]


def main():
    key_file = DOCS / f"{KEY}.txt"
    if not key_file.is_file() or key_file.read_text(encoding="utf-8").strip() != KEY:
        raise SystemExit(f"{key_file} is missing or doesn't contain the key; IndexNow would reject the ping")
    urls = sitemap_urls()
    body = {"host": HOST, "key": KEY, "keyLocation": f"https://{HOST}/{KEY}.txt", "urlList": urls}
    if "--dry-run" in sys.argv:
        print(json.dumps(body, indent=2))
        return
    req = urllib.request.Request(ENDPOINT, data=json.dumps(body).encode("utf-8"), method="POST",
                                 headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            print(f"IndexNow: HTTP {res.status} for {len(urls)} URLs (200 or 202 means accepted)")
    except urllib.error.HTTPError as e:
        # 403: key file not live yet (wait for the Pages deploy); 422: a URL isn't on HOST; 429: too many pings.
        raise SystemExit(f"IndexNow: HTTP {e.code} {e.reason}: {e.read().decode('utf-8', 'replace')[:300]}")


if __name__ == "__main__":
    main()
