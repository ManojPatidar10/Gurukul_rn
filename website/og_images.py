"""Draws the site's Open Graph cards (the image WhatsApp, Facebook, LinkedIn and X show for a shared link).

    python website/og_images.py      then    python website/build.py

Needs Pillow, uharfbuzz and fonttools (pip install pillow uharfbuzz fonttools). build.py itself stays
standard-library only; it just checks the cards this script wrote.

Writes, under docs/assets/:
- og/<page path, "/" -> "-">.png for every page whose meta has og_headline (og_eyebrow is the small line
  above it), e.g. og/hi-parent-app.png. 1200x630 PNG.
- og-image.png, the default card for pages without og_headline (privacy, 404, thanks, the toolkit, the deck).
- og/manifest.json: {page path: hash of what its card was drawn from}. build.py FAILs when a page's
  og_eyebrow/og_headline no longer matches, so a card can't silently go stale.

Text is shaped with HarfBuzz and drawn from the fonts' glyph outlines, never with ImageDraw.text: Pillow
without raqm can't shape Devanagari (it puts ि after its consonant and breaks conjuncts such as र्ट).
Outlines are filled even-odd (each contour XORed in), at 4x, then scaled down with LANCZOS.

Design: brand tokens from marketing-sales-pipeline/brand/tokens.json (60% paper, 30% violet, 10% marigold).
Left: the lockup, eyebrow, headline (up to 3 lines), a marigold bar and smartgurukul.org on paper. Right:
violet, with the demo button in a marigold pill (ink text: never white on marigold). No screenshots,
numbers, prices or people. Fonts and lockups are in website/og/ (fonts under the SIL OFL, see OFL.txt).
"""
import json
import sys
from pathlib import Path

try:
    import uharfbuzz as hb
    from fontTools.pens.basePen import BasePen
    from fontTools.ttLib import TTFont
    from PIL import Image, ImageChops, ImageDraw
except ImportError as e:  # pragma: no cover - a setup problem, not a code path
    raise SystemExit(f"{e}. og_images.py needs: pip install pillow uharfbuzz fonttools")

from build import OUT, ROOT, og_card_path, og_hash, read_pages

ASSETS = ROOT / "og"
CARD_DIR = OUT / "assets" / "og"
DEFAULT_CARD = OUT / "assets" / "og-image.png"
DEFAULT_TEXT = ("en", "School management app", "Your whole school, connected.")

W, H = 1200, 630
SPLIT = 744          # the paper side is ~62% of the card, the violet side ~38%
PAD = 64
SS = 4               # supersampling for text and shapes

PAPER = (0xFA, 0xF8, 0xFD)
INK = (0x1E, 0x16, 0x33)
INK_600 = (0x56, 0x4E, 0x6B)
VIOLET = (0x7C, 0x3A, 0xED)
VIOLET_700 = (0x6D, 0x28, 0xD9)
MARIGOLD = (0xF5, 0xA7, 0x0A)
WHITE = (0xFF, 0xFF, 0xFF)

CTA = {"en": "Book a free demo", "hi": "मुफ़्त डेमो बुक करें"}
TRIO = {"en": "AI + School + Games", "hi": "AI + स्कूल + गेम्स"}
LOCKUP = {"en": "lockup-horizontal@2x.png", "hi": "lockup-hindi@2x.png"}


def script_runs(text):
    """Splits text into (run, "Deva" | "Latn") runs. Spaces, digits and punctuation join the run
    they follow (or the first run, at the start), so words keep their spacing and kerning."""
    def script(ch):
        if "ऀ" <= ch <= "ॿ" or "꣠" <= ch <= "ꣿ" or ch in "‌‍":
            return "Deva"
        if ch.isalpha():
            return "Latn"
        return None
    runs = []
    for ch in text:
        sc = script(ch)
        if runs and (sc is None or sc == runs[-1][1]):
            runs[-1][0] += ch
        elif runs and runs[-1][1] is None:
            runs[-1] = [runs[-1][0] + ch, sc]
        else:
            runs.append([ch, sc])
    return [(run, sc or "Latn") for run, sc in runs]


class _FlattenPen(BasePen):
    """Collects a glyph's contours as polygons, flattening curves into short straight segments."""

    def __init__(self, glyphset, steps=10):
        super().__init__(glyphset)
        self.contours, self.cur, self.steps = [], [], steps

    def _moveTo(self, p):
        self.cur = [p]

    def _lineTo(self, p):
        self.cur.append(p)

    def _curveToOne(self, p1, p2, p3):
        (x0, y0) = self.cur[-1]
        for i in range(1, self.steps + 1):
            t = i / self.steps
            u = 1 - t
            self.cur.append((u ** 3 * x0 + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
                             u ** 3 * y0 + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]))

    def _qCurveToOne(self, p1, p2):
        (x0, y0) = self.cur[-1]
        for i in range(1, self.steps + 1):
            t = i / self.steps
            u = 1 - t
            self.cur.append((u * u * x0 + 2 * u * t * p1[0] + t * t * p2[0],
                             u * u * y0 + 2 * u * t * p1[1] + t * t * p2[1]))

    def _closePath(self):
        if len(self.cur) > 2:
            self.contours.append(self.cur)
        self.cur = []

    _endPath = _closePath


class Font:
    """A TTF that can be shaped with HarfBuzz and drawn from its outlines.

    top/bottom: how far (in em) the ink of a typical line reaches above and below the baseline, and
    pitch: the line spacing in em. Devanagari needs more room for its matras than Latin does.
    """

    def __init__(self, name, top, bottom, pitch):
        path = str(ASSETS / "fonts" / name)
        self.tt = TTFont(path)
        self.hb = hb.Font(hb.Face(hb.Blob.from_file_path(path)))
        self.upem = self.tt["head"].unitsPerEm
        self.glyphset = self.tt.getGlyphSet()
        self.order = self.tt.getGlyphOrder()
        self.top, self.bottom, self.pitch = top, bottom, pitch
        self._outlines = {}

    def shape(self, text):
        """Shapes each script run on its own: HarfBuzz guesses one script per buffer, so a line like
        "GPS से हाज़िरी" shaped whole would be treated as Latin and lose its Devanagari conjuncts."""
        infos, positions = [], []
        for run, script in script_runs(text):
            buf = hb.Buffer()
            buf.add_str(run)
            buf.direction = "ltr"
            buf.script = script
            buf.language = "hi" if script == "Deva" else "en"
            hb.shape(self.hb, buf, {"kern": True, "liga": True})
            infos += buf.glyph_infos
            positions += buf.glyph_positions
        return infos, positions

    def width(self, text, size):
        return sum(p.x_advance for p in self.shape(text)[1]) * size / self.upem

    def outline(self, gid):
        if gid not in self._outlines:
            pen = _FlattenPen(self.glyphset)
            self.glyphset[self.order[gid]].draw(pen)
            self._outlines[gid] = pen.contours
        return self._outlines[gid]


def draw_text(img, text, font, size, color, x, baseline):
    """Draws one shaped line with its baseline at `baseline` and its pen starting at x (card pixels)."""
    infos, positions = font.shape(text)
    scale = size * SS / font.upem
    polys, pen_x = [], 0.0
    for info, pos in zip(infos, positions):
        gx = x * SS + (pen_x + pos.x_offset) * scale
        gy = baseline * SS - pos.y_offset * scale
        contours = [[(gx + px * scale, gy - py * scale) for px, py in c] for c in font.outline(info.codepoint)]
        if contours:
            polys.append(contours)
        pen_x += pos.x_advance
    if not polys:
        return
    xs = [px for g in polys for c in g for px, _ in c]
    ys = [py for g in polys for c in g for _, py in c]
    # The line's mask, aligned to whole card pixels so it scales down to an exact paste position.
    ox, oy = int(min(xs) // SS) * SS - SS, int(min(ys) // SS) * SS - SS
    mw = (int(max(xs) - ox) // SS + 2) * SS
    mh = (int(max(ys) - oy) // SS + 2) * SS
    mask = Image.new("L", (mw, mh), 0)
    for glyph in polys:
        gx0 = int(min(px for c in glyph for px, _ in c)) - 1
        gy0 = int(min(py for c in glyph for _, py in c)) - 1
        gx1 = int(max(px for c in glyph for px, _ in c)) + 2
        gy1 = int(max(py for c in glyph for _, py in c)) + 2
        gmask = Image.new("L", (gx1 - gx0, gy1 - gy0), 0)
        for contour in glyph:  # even-odd: each contour flips the pixels it covers
            layer = Image.new("L", gmask.size, 0)
            ImageDraw.Draw(layer).polygon([(px - gx0, py - gy0) for px, py in contour], fill=255)
            gmask = ImageChops.difference(gmask, layer)
        box = (gx0 - ox, gy0 - oy, gx1 - ox, gy1 - oy)
        mask.paste(ImageChops.lighter(mask.crop(box), gmask), box)  # glyphs may overlap: union them
    small = mask.resize((mw // SS, mh // SS), Image.LANCZOS)
    img.paste(Image.new("RGB", small.size, color), (ox // SS, oy // SS), small)


def wrap(text, font, size, max_width):
    """Greedy word wrap by measured (shaped) advance."""
    lines, cur = [], ""
    for word in text.split():
        trial = f"{cur} {word}".strip()
        if cur and font.width(trial, size) > max_width:
            lines.append(cur)
            cur = word
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines


def balanced_wrap(text, font, size, max_width):
    """The fewest lines that fit, then the narrowest width that keeps that many lines, so the lines come
    out even (like CSS text-wrap: balance) instead of leaving one word alone on the last line."""
    lines = wrap(text, font, size, max_width)
    lo, hi = max_width / 3, max_width
    while hi - lo > 2:
        mid = (lo + hi) / 2
        if len(wrap(text, font, size, mid)) == len(lines):
            hi = mid
        else:
            lo = mid
    return wrap(text, font, size, hi)


def shape_layer(size, draw_fn):
    """An anti-aliased mask: draw_fn(ImageDraw, ss) draws at 4x, then the mask is scaled down."""
    big = Image.new("L", (size[0] * SS, size[1] * SS), 0)
    draw_fn(ImageDraw.Draw(big), SS)
    return big.resize(size, Image.LANCZOS)


def card(lang, eyebrow, headline, fonts):
    hi = lang == "hi"
    display = fonts["mukta"] if hi else fonts["poppins_bold"]
    small = fonts["mukta"] if hi else fonts["poppins_semi"]
    img = Image.new("RGB", (W, H), PAPER)

    # Right: violet panel with a soft marigold circle (as on the site's violet sections) and the CTA.
    img.paste(VIOLET, (SPLIT, 0, W, H))
    circle = shape_layer((W - SPLIT, H), lambda d, s: d.ellipse((96 * s, -250 * s, 616 * s, 270 * s), fill=255))
    tint = Image.blend(Image.new("RGB", circle.size, VIOLET), Image.new("RGB", circle.size, MARIGOLD), 0.16)
    img.paste(tint, (SPLIT, 0), circle)
    circle2 = shape_layer((W - SPLIT, H), lambda d, s: d.ellipse((-160 * s, 430 * s, 200 * s, 790 * s), fill=255))
    img.paste(Image.new("RGB", circle2.size, VIOLET_700), (SPLIT, 0), circle2)

    panel_mid = SPLIT + (W - SPLIT) // 2
    cta_size = 34 if hi else 30
    cta_w = small.width(CTA[lang], cta_size)
    pill_w, pill_h = int(cta_w + 2 * 40), 84
    pill_x, pill_y = panel_mid - pill_w // 2, H // 2 - pill_h // 2 + 24
    pill = shape_layer((pill_w, pill_h), lambda d, s: d.rounded_rectangle(
        (0, 0, pill_w * s - 1, pill_h * s - 1), radius=pill_h * s // 2, fill=255))
    img.paste(Image.new("RGB", pill.size, MARIGOLD), (pill_x, pill_y), pill)
    cta_base = pill_y + pill_h / 2 + (small.top - small.bottom) * cta_size / 2
    draw_text(img, CTA[lang], small, cta_size, INK, panel_mid - cta_w / 2, cta_base)
    trio_size = 26 if hi else 24
    trio_w = small.width(TRIO[lang], trio_size)
    draw_text(img, TRIO[lang], small, trio_size, WHITE, panel_mid - trio_w / 2, pill_y - 34)

    # Left: lockup, eyebrow, headline, marigold bar, URL.
    lockup = Image.open(ASSETS / LOCKUP[lang]).convert("RGBA")
    lockup = lockup.crop(lockup.getbbox())
    lh = 72
    lockup = lockup.resize((round(lockup.width * lh / lockup.height), lh), Image.LANCZOS)
    img.paste(lockup, (PAD, 52), lockup)

    url_size = 24
    url_base = H - 52
    draw_text(img, "smartgurukul.org", fonts["poppins_semi"], url_size, INK_600, PAD, url_base)

    max_w = SPLIT - PAD - 48
    for head_size in ((66, 58) if hi else (60, 52)):
        lines = balanced_wrap(headline, display, head_size, max_w)
        if len(lines) <= 3:
            break
    if len(lines) > 3:
        raise SystemExit(f"headline too long for 3 lines: {headline!r}")
    brow_size = 30 if hi else 28
    pitch = display.pitch * head_size
    block = (brow_size * (small.top + small.bottom) + 18
             + head_size * (display.top + display.bottom) + pitch * (len(lines) - 1) + 30 + 10)
    region_top = 52 + lh + 30
    region_bottom = url_base - url_size * fonts["poppins_semi"].top - 34
    y = region_top + max(0, (region_bottom - region_top - block) / 2)
    y += brow_size * small.top
    draw_text(img, eyebrow, small, brow_size, VIOLET_700, PAD, y)
    y += brow_size * small.bottom + 18 + head_size * display.top
    for i, line in enumerate(lines):
        draw_text(img, line, display, head_size, INK, PAD, y + i * pitch)
    y += pitch * (len(lines) - 1) + head_size * display.bottom + 30
    img.paste(MARIGOLD, (PAD, round(y), PAD + 120, round(y) + 10))
    return img


def save(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG", optimize=True)
    kb = path.stat().st_size / 1024
    print(f"wrote {path.relative_to(OUT.parent).as_posix()} ({kb:.0f} KB)")
    if kb > 300:
        raise SystemExit(f"{path} is over 300 KB")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="backslashreplace")
    fonts = {
        "poppins_bold": Font("Poppins-Bold.ttf", 0.75, 0.24, 1.16),
        "poppins_semi": Font("Poppins-SemiBold.ttf", 0.75, 0.24, 1.16),
        "mukta": Font("Mukta-SemiBold.ttf", 0.92, 0.36, 1.32),
    }
    manifest, expected = {}, set()
    for meta, _ in read_pages():
        if not meta.get("og_headline"):
            continue
        lang = meta.get("lang", "en")
        out = OUT / og_card_path(meta["path"])
        save(card(lang, meta.get("og_eyebrow", ""), meta["og_headline"], fonts), out)
        manifest[meta["path"]] = og_hash(meta)
        expected.add(out.name)
    save(card(*DEFAULT_TEXT, fonts), DEFAULT_CARD)
    for stale in sorted(CARD_DIR.glob("*.png")):
        if stale.name not in expected:  # a page lost its og_headline or was renamed
            stale.unlink()
            print("removed stale", stale.name)
    (CARD_DIR / "manifest.json").write_text(json.dumps(manifest, indent=1, sort_keys=True) + "\n",
                                           encoding="utf-8", newline="\n")
    print(f"{len(manifest)} page cards + the default card")


if __name__ == "__main__":
    main()
