"""Builds the public pitch deck (docs/deck.html, plus docs/assets/deck/Smart-Gurukul-Pitch-Deck.pdf).

The source is the "Smart Gurukul Pitch Deck" claude.ai Slides artifact, copied into website/deck/
(deck.json for the order, one slides/<id>.html per slide). That artifact can't be shared publicly,
so schools get this static copy. To update: copy the changed slide files in, then run

    python website/build_deck.py

It renders every 1920x1080 slide scaled to the screen width, and (when Microsoft Edge or Chrome is
installed) prints the same page to a PDF, one slide per page. No third-party Python packages.
"""
import json
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DECK = ROOT / "deck"
OUT = ROOT.parent / "docs"
PDF = OUT / "assets" / "deck" / "Smart-Gurukul-Pitch-Deck.pdf"

# The Slides type's uploaded images -> files committed under docs/assets/deck/.
BLOBS = {
    "/_blob/200caf158631e4351b9c426be48e2cd7": "assets/deck/manoj.jpg",
    "/_blob/f50e05463441325d3e2138cc61b09e76": "assets/deck/yash.jpg",
}

# <x-icon name> -> inline SVG (Lucide-style strokes) for the icons the deck uses.
ICONS = {
    "Settings": '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    "Book": '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    "GraduationCap": '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/><path d="M22 10v6"/>',
    "Home": '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    "Lightning": '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    "Star": '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    "Users": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
}


def icon(m):
    name = re.search(r'name="([^"]+)"', m.group(1)).group(1)
    style = re.search(r'style="([^"]*)"', m.group(1))
    style = style.group(1) if style else ""
    return (f'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
            f'stroke-linejoin="round" style="{style};flex:none" aria-hidden="true">{ICONS[name]}</svg>')


def shape(m):
    kind = re.search(r'kind="([^"]+)"', m.group(1)).group(1)
    style = re.search(r'style="([^"]*)"', m.group(1)).group(1)
    color = re.search(r"background:\s*([^;]+)", style).group(1).strip()
    if kind != "arrow-right":
        raise SystemExit(f"build_deck.py: x-shape kind {kind!r} isn't supported yet")
    style = re.sub(r"background:[^;]+;?", "", style)
    return (f'<svg viewBox="0 0 64 32" style="{style};flex:none" aria-hidden="true">'
            f'<path d="M0 11h44V0l20 16-20 16V21H0z" fill="{color}"/></svg>')


def slide_html(path):
    s = path.read_text(encoding="utf-8")
    s = re.sub(r"<aside>.*?</aside>", "", s, flags=re.S)  # speaker notes stay private
    s = re.sub(r"<x-icon([^>]*)></x-icon>", icon, s)
    s = re.sub(r"<x-shape([^>]*)></x-shape>", shape, s)
    for blob, asset in BLOBS.items():
        s = s.replace(blob, asset)
    if "/_blob/" in s or "<x-" in s:
        raise SystemExit(f"{path.name}: unmapped image or element left in the slide")
    return s.strip()


def build():
    meta = json.loads((DECK / "deck.json").read_text(encoding="utf-8"))
    slides = "\n".join(
        f'<div class="slide"><div class="canvas">{slide_html(DECK / "slides" / f"{sid}.html")}</div></div>'
        for sid in meta["order"])
    fonts = "&".join(f["href"].split("?", 1)[1].replace("&display=swap", "") for f in meta["faces"].values())
    page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Smart Gurukul Pitch Deck</title>
<meta name="description" content="The Smart Gurukul pitch deck: one app for principals, teachers, students and parents.">
<meta name="robots" content="noindex, follow">
<meta property="og:title" content="Smart Gurukul Pitch Deck">
<meta property="og:description" content="One app to run an Indian school.">
<meta property="og:image" content="https://smartgurukul.org/assets/og-image.png">
<link rel="icon" href="assets/brand/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?{fonts}&display=swap">
<style>
:root {{ color-scheme: light; }}
* {{ box-sizing: border-box; }}
body {{ margin: 0; background: #2A2250; font-family: 'Nunito Sans', Arial, sans-serif; }}
.bar {{ position: sticky; top: 0; z-index: 2; display: flex; gap: 10px; align-items: center; justify-content: space-between; padding: 10px 16px; background: #1B1535; color: #F8F6F1; font-size: 15px; }}
.bar a {{ color: #1B1535; background: #F5A70A; font-weight: 700; text-decoration: none; padding: 9px 14px; border-radius: 10px; white-space: nowrap; }}
.bar a.ghost {{ background: transparent; color: #C4B5FD; padding: 9px 4px; }}
.deck {{ max-width: 1200px; margin: 0 auto; padding: 16px; display: grid; gap: 16px; }}
.slide {{ position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.35); }}
.canvas {{ position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; transform-origin: 0 0; }}
.canvas section {{ position: relative; width: 1920px; height: 1080px; overflow: hidden; }}
/* Slides paint in source order: flow children must stack above an earlier pinned backdrop. */
.canvas section > * {{ position: relative; }}
.canvas h1, .canvas h2, .canvas h3, .canvas p, .canvas ul, .canvas ol {{ margin: 0; }}
.canvas table {{ border-collapse: collapse; width: 100%; }}
.canvas th, .canvas td {{ padding: 18px 24px; text-align: left; }}
@page {{ size: 1920px 1080px; margin: 0; }}
@media print {{
  body {{ background: none; }}
  .bar {{ display: none; }}
  .deck {{ max-width: none; padding: 0; gap: 0; display: block; }}
  .slide {{ width: 1920px; height: 1080px; aspect-ratio: auto; border-radius: 0; box-shadow: none; break-after: page; }}
  .canvas {{ transform: none !important; }}
}}
</style>
</head>
<body>
<div class="bar"><span>Smart Gurukul · Pitch deck</span><span><a class="ghost" href="./">smartgurukul.org</a> <a href="assets/deck/{PDF.name}" download>Download PDF</a></span></div>
<main class="deck">
{slides}
</main>
<script>
function fit() {{
  document.querySelectorAll('.slide').forEach(function (s) {{
    s.firstElementChild.style.transform = 'scale(' + (s.clientWidth / 1920) + ')';
  }});
}}
if (!matchMedia('print').matches) {{ fit(); addEventListener('resize', fit); }}
addEventListener('beforeprint', function () {{ document.querySelectorAll('.canvas').forEach(function (c) {{ c.style.transform = 'none'; }}); }});
addEventListener('afterprint', fit);
</script>
</body>
</html>
"""
    (OUT / "deck.html").write_text(page, encoding="utf-8", newline="\n")
    print("built deck.html with", len(meta["order"]), "slides")

    browser = next((p for p in (
        shutil.which("msedge"), shutil.which("chrome"),
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    ) if p and Path(p).exists()), None)
    if not browser:
        print("no Edge/Chrome found: skipped the PDF")
        return
    subprocess.run([browser, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                    "--virtual-time-budget=8000", f"--print-to-pdf={PDF}", (OUT / "deck.html").as_uri()],
                   check=True, capture_output=True)
    print("built", PDF.relative_to(OUT), f"({PDF.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    build()
