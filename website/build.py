"""Builds the smartgurukul.org marketing site into ../docs (served by GitHub Pages from main:/docs).

Each file in pages/ starts with a JSON meta block in an HTML comment, followed by the page body:

    <!--meta {"path": "ai-for-schools.html", "title": "...", "description": "...", ...} -->
    <section>...</section>

This script wraps every body in the shared <head> (title, description, canonical, Open Graph,
hreflang, JSON-LD), header and footer, then regenerates sitemap.xml. Run it after editing anything
here:  python website/build.py   (no third-party dependencies).
"""
import datetime
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent / "docs"
SITE = "https://smartgurukul.org"
BRAND = "Smart Gurukul"
EMAIL = "sales@smartgurukul.org"
INSTAGRAM = "https://www.instagram.com/smart__gurukul"
TODAY = datetime.date.today().isoformat()

ORG = {
    "@type": "Organization",
    "@id": f"{SITE}/#org",
    "name": BRAND,
    "alternateName": ["SmartGurukul", "Smart Gurukul App"],
    "url": f"{SITE}/",
    "logo": f"{SITE}/assets/brand/icon-512.png",
    "slogan": "Your whole school, connected.",
    "email": EMAIL,
    "sameAs": [INSTAGRAM],
    "areaServed": {"@type": "Country", "name": "India"},
    "description": "Smart Gurukul makes an AI-powered, gamified school app for Indian K-12 schools, built by an IIT-BHU team.",
}
SOFTWARE = {
    "@type": "SoftwareApplication",
    "@id": f"{SITE}/#app",
    "name": BRAND,
    "applicationCategory": "EducationalApplication",
    "applicationSubCategory": "School management software",
    "operatingSystem": "Android, iOS",
    "inLanguage": ["en-IN", "hi-IN"],
    "publisher": {"@id": f"{SITE}/#org"},
    "url": f"{SITE}/",
    "image": f"{SITE}/assets/og-image.png",
    "description": (
        "Smart Gurukul connects the whole school in one app. It combines AI (an AI helpdesk "
        "assistant for staff and students), school operations (GPS attendance with no hardware, "
        "fees, payroll, exams and report cards, chat, video calls and events) and game-based "
        "learning (XP, streaks, leagues, House Wars, quiz battles) for principals, teachers, "
        "students and parents, in English and Hindi."
    ),
    "featureList": [
        "AI helpdesk assistant inside the app for staff and students",
        "AI help for teachers preparing teaching notes and explanations",
        "GPS check-in attendance for teachers, with no biometric hardware",
        "Class attendance marked from a phone, with history calendars",
        "Fee structures, dues tracking and receipts",
        "Payroll runs, salary structures and payslips",
        "Exams, grading scales and report cards",
        "Parent app with multi-child access",
        "Chat, announcements and video calls for staff and students",
        "XP, daily streaks, weekly leagues and House Wars",
        "Live Battle Room quizzes and 1v1 Arena challenges",
        "School events with RSVP",
        "Activity log and attendance export",
    ],
}
WEBSITE = {
    "@type": "WebSite",
    "@id": f"{SITE}/#website",
    "url": f"{SITE}/",
    "name": BRAND,
    "publisher": {"@id": f"{SITE}/#org"},
    "inLanguage": ["en-IN", "hi-IN"],
}

NAV = [
    ("ai-for-schools.html", "AI", "एआई"),
    ("gamified-learning.html", "Games", "गेम्स"),
    ("gps-attendance.html", "GPS Attendance", "GPS हाज़िरी"),
    ("parent-app.html", "Parent App", "पैरेंट ऐप"),
    ("compare.html", "Compare", "तुलना"),
]

MENU_ICON = ('<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
             'stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>')


def rel(path, target):
    """Relative link from the page at `path` to site-root `target` (pages live at most one dir deep)."""
    if path == "404.html":
        # GitHub Pages serves 404.html for missing URLs at any depth, so its links must be root-absolute.
        return "/" + target
    depth = path.count("/")
    return ("../" * depth) + target


def header(meta):
    p = meta["path"]
    hi = meta.get("lang") == "hi"
    links = []
    for href, en, hin in NAV:
        cur = ' aria-current="page"' if p == href else ""
        links.append(f'<li><a href="{rel(p, href)}"{cur}>{hin if hi else en}</a></li>')
    alt = meta.get("alternate")
    if hi:
        lang_link = f'<a class="lang" href="{rel(p, alt or "index.html")}" hreflang="en" lang="en">English</a>'
    else:
        lang_link = f'<a class="lang" href="{rel(p, alt or "hi/index.html")}" hreflang="hi" lang="hi">हिन्दी</a>'
    home = rel(p, "hi/index.html" if hi else "index.html")
    demo = "#demo" if meta.get("has_form") else rel(p, ("hi/index.html" if hi else "index.html") + "#demo")
    return f"""<a class="skip" href="#main">{'मुख्य सामग्री पर जाएं' if hi else 'Skip to content'}</a>
<header class="site-header">
  <div class="wrap nav">
    <a class="brand" href="{home}">
      <img src="{rel(p, 'assets/brand/lockup-hindi.svg' if hi else 'assets/brand/lockup-horizontal.svg')}" width="{144 if hi else 193}" height="40" alt="{'स्मार्ट गुरुकुल' if hi else BRAND}">
    </a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-label="Menu">{MENU_ICON}</button>
    <ul class="nav-links">{''.join(links)}</ul>
    <div class="nav-cta">
      {lang_link}
      <a class="btn btn-primary btn-sm" href="{demo}">{'डेमो बुक करें' if hi else 'Book a free demo'}</a>
    </div>
  </div>
</header>"""


def footer(meta):
    p = meta["path"]
    hi = meta.get("lang") == "hi"
    r = lambda t: rel(p, t)
    return f"""<footer class="site-footer">
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <a class="brand" href="{r('hi/index.html' if hi else 'index.html')}"><img src="{r('assets/brand/lockup-hindi-reversed.svg' if hi else 'assets/brand/lockup-horizontal-reversed.svg')}" width="{137 if hi else 183}" height="38" alt="{'स्मार्ट गुरुकुल' if hi else BRAND}"></a>
        <p class="foot-tagline">{'पूरा स्कूल, एक ऐप पर जुड़ा।' if hi else 'Your whole school, connected.'}</p>
        <p style="max-width:34ch">{'AI, स्कूल और गेम्स — प्रिंसिपल, शिक्षक, छात्र और अभिभावक, सब एक ऐप पर। IIT-BHU की टीम द्वारा बनाया गया।' if hi else 'AI + School + Games for principals, teachers, students and parents. Built by an IIT-BHU team.'}</p>
      </div>
      <div>
        <h4>{'प्रोडक्ट' if hi else 'Product'}</h4>
        <ul>
          <li><a href="{r('ai-for-schools.html')}">AI for schools</a></li>
          <li><a href="{r('gamified-learning.html')}">Gamified learning</a></li>
          <li><a href="{r('gps-attendance.html')}">GPS attendance</a></li>
          <li><a href="{r('parent-app.html')}">Parent app</a></li>
          <li><a href="{r('money-features.html')}">Fees &amp; payroll</a></li>
        </ul>
      </div>
      <div>
        <h4>{'तुलना करें' if hi else 'Compare'}</h4>
        <ul>
          <li><a href="{r('compare.html')}">{'दूसरे सॉफ़्टवेयर से तुलना' if hi else 'vs. other school software'}</a></li>
          <li><a href="{r('index.html')}#faq">FAQ</a></li>
          <li><a href="{r('hi/index.html')}" lang="hi">हिन्दी</a></li>
        </ul>
      </div>
      <div>
        <h4>{'संपर्क' if hi else 'Contact'}</h4>
        <ul>
          <li><a href="mailto:{EMAIL}">{EMAIL}</a></li>
          <li><a href="{INSTAGRAM}" rel="noopener" target="_blank">Instagram @smart__gurukul</a></li>
          <li><a href="{r('hi/index.html' if hi else 'index.html')}#demo">{'मुफ़्त डेमो बुक करें' if hi else 'Book a free demo'}</a></li>
          <li><a href="{r('privacy.html')}">Privacy policy</a></li>
        </ul>
      </div>
    </div>
    <div class="foot-bottom">
      <span>&copy; <span id="year">{datetime.date.today().year}</span> {BRAND}. {'भारत में बना।' if hi else 'Made in India.'}</span>
      <span>smartgurukul.org</span>
    </div>
  </div>
</footer>"""


def breadcrumb(meta):
    if meta["path"] in ("index.html", "hi/index.html", "404.html"):
        return None
    return {
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": BRAND, "item": f"{SITE}/"},
            {"@type": "ListItem", "position": 2, "name": meta["crumb"], "item": canonical(meta)},
        ],
    }


def canonical(meta):
    p = meta["path"]
    if p == "index.html":
        return f"{SITE}/"
    if p.endswith("/index.html"):
        return f"{SITE}/{p[:-len('index.html')]}"
    return f"{SITE}/{p}"


def faq_schema(body):
    """FAQPage JSON-LD built from the page's own <details class="qa"> blocks, so markup never drifts from content."""
    items = []
    for q, a in re.findall(r'<details class="qa">\s*<summary>(.*?)</summary>(.*?)</details>', body, re.S):
        text = re.sub(r"<[^>]+>", " ", a)
        text = html.unescape(re.sub(r"\s+", " ", text)).strip()
        items.append({"@type": "Question", "name": html.unescape(re.sub(r"<[^>]+>", "", q)).strip(),
                      "acceptedAnswer": {"@type": "Answer", "text": text}})
    return {"@type": "FAQPage", "mainEntity": items} if items else None


def head(meta, body):
    p = meta["path"]
    lang = meta.get("lang", "en")
    url = canonical(meta)
    title = meta["title"]
    desc = meta["description"]
    graph = [ORG, WEBSITE]
    if meta.get("software", True):
        graph.append(SOFTWARE)
    page = {"@type": "WebPage", "@id": url + "#page", "url": url, "name": title, "description": desc,
            "isPartOf": {"@id": f"{SITE}/#website"}, "about": {"@id": f"{SITE}/#app"},
            "inLanguage": "hi-IN" if lang == "hi" else "en-IN", "dateModified": TODAY}
    graph.append(page)
    for extra in (breadcrumb(meta), faq_schema(body)):
        if extra:
            graph.append(extra)
    ld = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=1)
    hreflang = ""
    if meta.get("hreflang"):
        en_url, hi_url = meta["hreflang"]
        hreflang = (f'<link rel="alternate" hreflang="en-IN" href="{SITE}/{en_url}">\n'
                    f'<link rel="alternate" hreflang="hi-IN" href="{SITE}/{hi_url}">\n'
                    f'<link rel="alternate" hreflang="x-default" href="{SITE}/{en_url}">\n')
    robots = "noindex, follow" if meta.get("noindex") else "index, follow, max-image-preview:large, max-snippet:-1"
    fonts = "family=Poppins:wght@500;600;700&family=Mukta:wght@400;500;600;700;800"
    og_img = f"{SITE}/assets/og-image.png"
    return f"""<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<meta name="robots" content="{robots}">
<link rel="canonical" href="{url}">
{hreflang}<meta name="theme-color" content="#7C3AED">
<link rel="icon" href="{rel(p, 'assets/brand/favicon.svg')}" type="image/svg+xml">
<link rel="icon" href="{rel(p, 'assets/brand/favicon-48.png')}" type="image/png" sizes="48x48">
<link rel="apple-touch-icon" href="{rel(p, 'assets/brand/apple-touch-180.png')}">
<link rel="manifest" href="{rel(p, 'site.webmanifest')}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{BRAND}">
<meta property="og:title" content="{html.escape(meta.get('og_title', title))}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{og_img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="{'hi_IN' if lang == 'hi' else 'en_IN'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{html.escape(meta.get('og_title', title))}">
<meta name="twitter:description" content="{html.escape(desc)}">
<meta name="twitter:image" content="{og_img}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?{fonts}&display=swap">
<link rel="stylesheet" href="{rel(p, 'assets/site.css')}?v={TODAY}">
<script type="application/ld+json">
{ld}
</script>
</head>"""


def build():
    pages = []
    for src in sorted((ROOT / "pages").glob("**/*.html")):
        raw = src.read_text(encoding="utf-8")
        m = re.match(r"\s*<!--meta\s+(\{.*?\})\s*-->\s*", raw, re.S)
        if not m:
            raise SystemExit(f"{src}: missing <!--meta {{...}} --> block")
        meta = json.loads(m.group(1))
        body = raw[m.end():]
        mobile_cta = ""
        if not meta.get("has_form") and not meta.get("noindex"):
            hi = meta.get("lang") == "hi"
            target = rel(meta["path"], ("hi/index.html" if hi else "index.html") + "#demo")
            mobile_cta = (f'<div class="mobile-cta"><a class="btn btn-primary" href="{target}">'
                          f'{"मुफ़्त डेमो बुक करें" if hi else "Book a free demo"}</a></div>')
        doc = (head(meta, body)
               + f'\n<body class="{"has-mobile-cta" if mobile_cta else ""}">\n'
               + header(meta) + '\n<main id="main">\n' + body.strip() + "\n</main>\n"
               + footer(meta) + "\n" + mobile_cta
               + f'\n<script src="{rel(meta["path"], "assets/site.js")}?v={TODAY}" defer></script>\n</body>\n</html>\n')
        out = OUT / meta["path"]
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(doc, encoding="utf-8", newline="\n")
        pages.append(meta)
        print("built", meta["path"])

    urls = []
    for meta in pages:
        if meta.get("noindex"):
            continue
        alts = ""
        if meta.get("hreflang"):
            en_url, hi_url = meta["hreflang"]
            alts = (f'\n    <xhtml:link rel="alternate" hreflang="en-IN" href="{SITE}/{en_url}"/>'
                    f'\n    <xhtml:link rel="alternate" hreflang="hi-IN" href="{SITE}/{hi_url}"/>')
        urls.append(f"  <url>\n    <loc>{canonical(meta)}</loc>\n    <lastmod>{TODAY}</lastmod>{alts}\n"
                    f"    <priority>{meta.get('priority', '0.7')}</priority>\n  </url>")
    # Hand-written pages that live directly in docs/ rather than in pages/.
    for static in ("money-features.html",):
        urls.append(f"  <url>\n    <loc>{SITE}/{static}</loc>\n    <lastmod>{TODAY}</lastmod>\n"
                    f"    <priority>0.6</priority>\n  </url>")
    (OUT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
        + "\n".join(urls) + "\n</urlset>\n", encoding="utf-8", newline="\n")
    print("built sitemap.xml with", len(urls), "urls")


if __name__ == "__main__":
    build()
