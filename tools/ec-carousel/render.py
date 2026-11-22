#!/usr/bin/env python3
"""Elevating CHRIST carousel renderer (dashboard "Make images", 17 Nov 2026).

Turns a Content Queue row's planned "Slide Text" into 1080x1350 JPG slides in the house style
(heavenly light background, navy/gold, Baloo 2, logo footer). Every quoted Bible verse is checked
word for word against the Hindi O.V. chapter before anything is drawn; if one doesn't match, nothing
is rendered and the reason is reported.

Usage:
  python3 render.py --job job.json --out OUTDIR --fonts FONTDIR [--ov-dir DIR] [--fetch]

job.json: {"title": "...", "slideText": "1) ... | 2) ... | 3) ...", "rows": [104, 105]}
Writes OUTDIR/slide-N.jpg and OUTDIR/result.json ({ok, error, slides, verses}).
Exit code 0 on success, 2 on a content problem (bad verse, empty text), 1 on anything else.
"""
import argparse, html, json, math, os, random, re, sys, unicodedata, urllib.request
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 1080, 1350
NAVY = (16, 32, 63); GOLD = (201, 162, 39); GOLDL = (231, 199, 102); INK = (30, 30, 40); SOFT = (85, 90, 105)

# Hindi book name -> (wordproject book number, english slug used in ref/hindi-bible on the media branch)
BOOKS = {
    'उत्पत्ति': (1, 'genesis'), 'निर्गमन': (2, 'exodus'), 'लैव्यव्यवस्था': (3, 'leviticus'), 'गिनती': (4, 'numbers'),
    'व्यवस्थाविवरण': (5, 'deuteronomy'), 'यहोशू': (6, 'joshua'), 'न्यायियों': (7, 'judges'), 'रूत': (8, 'ruth'),
    '1 शमूएल': (9, '1samuel'), '2 शमूएल': (10, '2samuel'), '1 राजाओं': (11, '1kings'), '2 राजाओं': (12, '2kings'),
    '1 इतिहास': (13, '1chronicles'), '2 इतिहास': (14, '2chronicles'), 'एज्रा': (15, 'ezra'), 'नहेम्याह': (16, 'nehemiah'),
    'एस्तेर': (17, 'esther'), 'अय्यूब': (18, 'job'), 'भजन संहिता': (19, 'psalm'), 'भजन': (19, 'psalm'),
    'नीतिवचन': (20, 'proverbs'), 'सभोपदेशक': (21, 'ecclesiastes'), 'श्रेष्ठगीत': (22, 'songofsongs'),
    'यशायाह': (23, 'isaiah'), 'यिर्मयाह': (24, 'jeremiah'), 'विलापगीत': (25, 'lamentations'), 'यहेजकेल': (26, 'ezekiel'),
    'दानिय्येल': (27, 'daniel'), 'होशे': (28, 'hosea'), 'योएल': (29, 'joel'), 'आमोस': (30, 'amos'), 'ओबद्याह': (31, 'obadiah'),
    'योना': (32, 'jonah'), 'मीका': (33, 'micah'), 'नहूम': (34, 'nahum'), 'हबक्कूक': (35, 'habakkuk'), 'सपन्याह': (36, 'zephaniah'),
    'हाग्गै': (37, 'haggai'), 'जकर्याह': (38, 'zechariah'), 'मलाकी': (39, 'malachi'),
    'मत्ती': (40, 'matthew'), 'मरकुस': (41, 'mark'), 'लूका': (42, 'luke'), 'यूहन्ना': (43, 'john'),
    'प्रेरितों के काम': (44, 'acts'), 'प्रेरितों': (44, 'acts'), 'रोमियों': (45, 'romans'), '1 कुरिन्थियों': (46, '1cor'),
    '2 कुरिन्थियों': (47, '2cor'), 'गलातियों': (48, 'galatians'), 'इफिसियों': (49, 'ephesians'), 'फिलिप्पियों': (50, 'philippians'),
    'कुलुस्सियों': (51, 'colossians'), '1 थिस्सलुनीकियों': (52, '1thess'), '2 थिस्सलुनीकियों': (53, '2thess'),
    '1 तीमुथियुस': (54, '1timothy'), '2 तीमुथियुस': (55, '2timothy'), 'तीतुस': (56, 'titus'), 'फिलेमोन': (57, 'philemon'),
    'इब्रानियों': (58, 'hebrews'), 'याकूब': (59, 'james'), '1 पतरस': (60, '1peter'), '2 पतरस': (61, '2peter'),
    '1 यूहन्ना': (62, '1john'), '2 यूहन्ना': (63, '2john'), '3 यूहन्ना': (64, '3john'), 'यहूदा': (65, 'jude'),
    'प्रकाशितवाक्य': (66, 'revelation'),
}
VERSE_RE = re.compile(r'[“"]([^”"]+)[”"]\s*[—–-]\s*((?:[123]\s)?[ऀ-ॿ ]+?)\s+(\d+):(\d+)(?:\s*[-–]\s*(\d+))?')


class ContentError(Exception):
    pass


# ---------- verse check ----------

def norm(s):
    s = unicodedata.normalize('NFC', s)
    s = re.sub(r'[“”"‘’\'।,;:!?.…\-—–()]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


def chapter_verses(raw):
    """wordproject chapter page -> {verse number: text}."""
    body = raw.split('अध्याय', 1)[-1] if 'अध्याय' in raw else raw
    body = re.sub(r'<span[^>]*class="verse"[^>]*id="(\d+)"[^>]*>\s*\d+\s*</span>', r' @@\1@@ ', body)
    text = html.unescape(re.sub(r'<[^>]+>', ' ', body))
    text = re.sub(r'\s+', ' ', text)
    parts = re.split(r'@@(\d+)@@', text)
    out = {}
    if len(parts) > 2:
        for i in range(1, len(parts) - 1, 2):
            out[int(parts[i])] = parts[i + 1].strip()
        if 1 not in out:  # verse 1 often has no span
            m = re.search(r'(?:^|\s)1 (\D+)$', parts[0])
            if m:
                out[1] = m.group(1).strip()
        return out
    # Pages saved without verse spans: numbers inline ("1 text 2 text").
    for m in re.finditer(r'(?:^|\s)(\d{1,3}) ([^0-9]+?)(?=\s\d{1,3} |$)', text):
        out.setdefault(int(m.group(1)), m.group(2).strip())
    return out


def load_chapter(book, ch, ov_dir, fetch):
    num, slug = BOOKS[book]
    path = os.path.join(ov_dir, f'{slug}-{ch}.htm') if ov_dir else None
    if path and os.path.exists(path):
        return open(path, encoding='utf-8', errors='ignore').read(), path
    if not fetch:
        raise ContentError(f'O.V. text for {book} {ch} is not in ref/hindi-bible yet ({slug}-{ch}.htm).')
    url = f'https://www.wordproject.org/bibles/hi/{num:02d}/{ch}.htm'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (ElevatingCHRIST carousel check)'})
    raw = urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'ignore')
    if path:
        os.makedirs(ov_dir, exist_ok=True)
        open(path, 'w', encoding='utf-8').write(raw)
    return raw, url


def check_verse(quote, book, ch, v1, v2, ov_dir, fetch):
    book = re.sub(r'\s+', ' ', book).strip()
    if book not in BOOKS:
        raise ContentError(f'Unknown book name "{book}" in a verse reference.')
    raw, src = load_chapter(book, int(ch), ov_dir, fetch)
    verses = chapter_verses(raw)
    want = range(int(v1), int(v2 or v1) + 1)
    if not all(n in verses for n in want):
        raise ContentError(f'Could not read {book} {ch}:{v1} from the O.V. chapter.')
    full = norm(' '.join(verses[n] for n in want))
    for frag in re.split(r'…|\.\.\.', quote):
        f = norm(frag)
        if len(f) < 3:
            continue
        if f not in full:
            raise ContentError(f'{book} {ch}:{v1} does not match the O.V. word for word: "{frag.strip()}". O.V. reads: "{" ".join(verses[n] for n in want)}"')
    return {'ref': f'{book} {ch}:{v1}' + (f'-{v2}' if v2 else ''), 'source': os.path.basename(src)}


# ---------- slide text ----------

def split_slides(text):
    parts = [p.strip() for p in re.split(r'\s*\|\s*', text or '') if p.strip()]
    return [re.sub(r'^\d+\s*[).:-]\s*', '', p).strip() for p in parts]


def parse_slide(s):
    m = VERSE_RE.search(s)
    if not m:
        return {'kind': 'text', 'text': s}
    before = s[:m.start()].strip().rstrip(':—–- ').strip()
    after = s[m.end():].strip().lstrip('+ ').strip()
    ref = f'— {m.group(2).strip()} {m.group(3)}:{m.group(4)}' + (f'-{m.group(5)}' if m.group(5) else '')
    return {'kind': 'verse', 'head': before, 'quote': f'“{m.group(1).strip()}”', 'ref': ref, 'note': after,
            'check': (m.group(1), m.group(2), m.group(3), m.group(4), m.group(5))}


# ---------- drawing ----------

class Fonts:
    def __init__(self, d):
        self.d = d
        self.cache = {}

    def __call__(self, size, weight=700):
        name = {500: '500Medium/Baloo2_500Medium', 600: '600SemiBold/Baloo2_600SemiBold', 700: '700Bold/Baloo2_700Bold',
                800: '800ExtraBold/Baloo2_800ExtraBold'}[weight]
        k = (size, weight)
        if k not in self.cache:
            self.cache[k] = ImageFont.truetype(os.path.join(self.d, name + '.ttf'), size)
        return self.cache[k]


def heaven(seed):
    top, bot = (255, 250, 238), (226, 236, 247)
    grad = Image.new('RGB', (1, H))
    for y in range(H):
        t = y / H
        grad.putpixel((0, y), tuple(int(top[i] * (1 - t) + bot[i] * t) for i in range(3)))
    im = grad.resize((W, H))
    rays = Image.new('L', (W, H), 0); rd = ImageDraw.Draw(rays); rnd = random.Random(seed); cx = W / 2; L = H * 1.4
    for k in range(14):
        a = -math.pi / 2 + (k - 6.5) * 0.13 + rnd.uniform(-0.03, 0.03); w = rnd.uniform(0.025, 0.05)
        rd.polygon([(cx, -60), (cx + L * math.cos(a - w), -60 + L * math.sin(a - w)),
                    (cx + L * math.cos(a + w), -60 + L * math.sin(a + w))], fill=rnd.randint(18, 34))
    rays = rays.filter(ImageFilter.GaussianBlur(28))
    glow = Image.new('L', (W, H), 0); ImageDraw.Draw(glow).ellipse((W * .15, -H * .25, W * .85, H * .35), fill=90)
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    white = Image.new('RGB', (W, H), (255, 253, 245))
    return Image.composite(white, Image.composite(white, im, rays), glow)


LOGO = None


def badge(size):
    global LOGO
    if LOGO is None:
        LOGO = Image.open(os.path.join(HERE, 'assets', 'logo.png')).convert('RGBA')
    l = LOGO.copy(); l.thumbnail((int(size * .88),) * 2)
    c = Image.new('RGBA', (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(c)
    d.ellipse((0, 0, size - 1, size - 1), fill=(255, 255, 255, 255), outline=GOLDL + (255,), width=max(3, size // 40))
    c.alpha_composite(l, ((size - l.width) // 2, (size - l.height) // 2))
    return c


def wrap(d, text, font, maxw):
    lines, cur = [], ''
    for w in text.split(' '):
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=font) <= maxw or not cur:
            cur = t
        else:
            lines.append(cur); cur = w
    if cur:
        lines.append(cur)
    return lines


def balanced(d, text, font, maxw):
    """Same number of lines as a greedy wrap, but evened out so no line is a lone word."""
    lines = wrap(d, text, font, maxw)
    if len(lines) < 2:
        return lines
    lo, hi = maxw * 0.5, maxw
    for _ in range(12):
        mid = (lo + hi) / 2
        if len(wrap(d, text, font, mid)) == len(lines):
            hi = mid
        else:
            lo = mid
    return wrap(d, text, font, hi + 1)


def block(d, text, font, maxw, lh=1.25):
    return balanced(d, text, font, maxw), int(font.size * lh)


def ctext(d, y, text, font, fill, maxw=940, lh=1.25):
    lines, step = block(d, text, font, maxw, lh)
    for ln in lines:
        d.text(((W - d.textlength(ln, font=font)) / 2, y), ln, font=font, fill=fill); y += step
    return y


def fit(d, text, B, sizes, weight, maxw, max_lines):
    for s in sizes:
        if len(wrap(d, text, B(s, weight), maxw)) <= max_lines:
            return B(s, weight)
    return B(sizes[-1], weight)


def card(im, box, outline=GOLD):
    x0, y0, x1, y1 = box
    sh = Image.new('L', im.size, 0); ImageDraw.Draw(sh).rounded_rectangle((x0 + 6, y0 + 14, x1 + 6, y1 + 14), 36, fill=60)
    im.paste(Image.new('RGB', im.size, (170, 160, 140)), (0, 0), sh.filter(ImageFilter.GaussianBlur(18)))
    m = Image.new('L', im.size, 0); ImageDraw.Draw(m).rounded_rectangle(box, 36, fill=235)
    im.paste(Image.new('RGB', im.size, (255, 255, 255)), (0, 0), m)
    ImageDraw.Draw(im).rounded_rectangle(box, 36, outline=outline, width=3)


def footer(im, B):
    d = ImageDraw.Draw(im); b = badge(110); im.paste(b, (60, H - 160), b)
    d.text((190, H - 140), 'Elevating CHRIST', font=B(44, 800), fill=NAVY)
    d.text((190, H - 92), 'www.elevatingchrist.com', font=B(30, 500), fill=SOFT)


def tag(d, y, txt, B):
    f = B(40, 800); w = d.textlength(txt, font=f) + 70
    d.rounded_rectangle(((W - w) / 2, y, (W + w) / 2, y + 70), 35, fill=NAVY)
    d.text((W / 2, y + 35), txt, font=f, fill=GOLDL, anchor='mm')


def measure_verse(d, quote, B):
    f = fit(d, quote, B, [56, 52, 48, 44, 40], 600, 800, 6)
    lines, step = block(d, quote, f, 800, 1.4)
    return f, lines, step, len(lines) * step + 140


def draw_verse_card(im, y, f, lines, step, ref, B):
    h = len(lines) * step + 140
    card(im, (100, y, W - 100, y + h)); d = ImageDraw.Draw(im); yy = y + 40
    for ln in lines:
        d.text(((W - d.textlength(ln, font=f)) / 2, yy), ln, font=f, fill=INK); yy += step
    r = B(40, 800); d.text(((W - d.textlength(ref, font=r)) / 2, yy + 10), ref, font=r, fill=GOLD)
    return y + h


def cover(text, B, seed):
    im = heaven(seed); d = ImageDraw.Draw(im)
    b = badge(200); im.paste(b, ((W - 200) // 2, 150), b)
    if ' बनाम ' in text or ' vs ' in text.lower():
        a, c = re.split(r'\s+(?:बनाम|vs\.?|VS\.?)\s+', text, maxsplit=1)
        fa = fit(d, a, B, [108, 96, 84], 800, 980, 2); fc = fit(d, c, B, [108, 96, 84], 800, 980, 2)
        h = len(wrap(d, a, fa, 980)) * int(fa.size * 1.15) + 100 + len(wrap(d, c, fc, 980)) * int(fc.size * 1.15)
        y = max(420, (H - 170 - h) // 2 + 60)
        y = ctext(d, y, a, fa, NAVY, 980, 1.15); tag(d, y + 10, 'बनाम', B)
        ctext(d, y + 100, c, fc, GOLD, 980, 1.15)
    else:
        # "Head — rest": head in navy, the rest in gold. Otherwise all navy.
        a, c = heads(text) if not re.search(r'[“"][^”"]*\s[—–]\s', text) else (text, '')
        fa = fit(d, a, B, [112, 100, 88, 76], 800, 960, 3)
        fc = fit(d, c, B, [96, 84, 72, 64], 800, 960, 3) if c else None
        la, sa = block(d, a, fa, 960, 1.15)
        lc, sc = block(d, c, fc, 960, 1.15) if c else ([], 0)
        y = max(420, (H - 170 - len(la) * sa - len(lc) * sc) // 2 + 60)
        y = ctext(d, y, a, fa, NAVY, 960, 1.15)
        if c:
            ctext(d, y + 10, c, fc, GOLD, 960, 1.15)
    footer(im, B)
    return im


def heads(text):
    m = re.split(r'\s+[—–]\s+', text, maxsplit=1)
    return (m[0], m[1]) if len(m) == 2 else (text, '')


def verse_slide(p, B, seed):
    im = heaven(seed); d = ImageDraw.Draw(im)
    head, sub = heads(p['head']) if p['head'] else ('', '')
    fh = fit(d, head, B, [92, 80, 70], 800, 960, 2) if head else None
    fs = B(48, 700)
    f, lines, step, ch = measure_verse(d, p['quote'], B)
    fn = fit(d, p['note'], B, [46, 42, 38], 700, 880, 3) if p['note'] else None
    total = (len(wrap(d, head, fh, 960)) * int(fh.size * 1.25) if head else 0) + (len(wrap(d, sub, fs, 900)) * int(fs.size * 1.25) if sub else 0)
    total += (45 if head or sub else 0) + ch + (55 + len(wrap(d, p['note'], fn, 880)) * int(fn.size * 1.25) if fn else 0)
    y = max(140, (H - 190 - total) // 2)
    if head:
        y = ctext(d, y, head, fh, NAVY, 960)
    if sub:
        y = ctext(d, y, sub, fs, SOFT, 900)
    if head or sub:
        y += 45
    y = draw_verse_card(im, y, f, lines, step, p['ref'], B); d = ImageDraw.Draw(im)
    if fn:
        ctext(d, y + 55, p['note'], fn, NAVY, 880)
    footer(im, B)
    return im


def text_slide(text, B, seed, last):
    im = heaven(seed); d = ImageDraw.Draw(im)
    head, sub = heads(text)
    fh = fit(d, head, B, [96, 84, 74, 64], 800, 940, 4)
    fs = fit(d, sub, B, [56, 50, 44], 700, 900, 4) if sub else None
    hl, hs = block(d, head, fh, 940, 1.2)
    sl, ss = block(d, sub, fs, 900, 1.25) if sub else ([], 0)
    total = len(hl) * hs + (40 + len(sl) * ss if sub else 0)
    y = max(160, (H - 190 - total) // 2)
    y = ctext(d, y, head, fh, NAVY, 940, 1.2)
    if sub:
        d.line(((W - 160) / 2, y + 12, (W + 160) / 2, y + 12), fill=GOLD, width=5)
        ctext(d, y + 40, sub, fs, GOLD if last else SOFT, 900)
    footer(im, B)
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--job', required=True); ap.add_argument('--out', required=True); ap.add_argument('--fonts', required=True)
    ap.add_argument('--ov-dir'); ap.add_argument('--fetch', action='store_true')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    result = {'ok': False, 'error': None, 'slides': [], 'verses': []}
    code = 1
    try:
        job = json.load(open(a.job, encoding='utf-8'))
        slides = split_slides(job.get('slideText', ''))
        if len(slides) < 2:
            raise ContentError('The row has no planned Slide Text (need "1) … | 2) …").')
        if len(slides) > 10:
            raise ContentError('Instagram allows at most 10 slides; the Slide Text has more.')
        parsed = [parse_slide(s) for s in slides]
        for p in parsed:  # check every verse before drawing anything
            if p['kind'] == 'verse':
                result['verses'].append(check_verse(*p['check'], a.ov_dir, a.fetch))
        B = Fonts(a.fonts)
        seed = sum(map(ord, job.get('title', ''))) % 1000
        for i, (raw, p) in enumerate(zip(slides, parsed)):
            if i == 0 and p['kind'] == 'text':
                im = cover(raw, B, seed)
            elif p['kind'] == 'verse':
                im = verse_slide(p, B, seed + i)
            else:
                im = text_slide(p['text'], B, seed + i, i == len(slides) - 1)
            name = f'slide-{i + 1}.jpg'
            im.save(os.path.join(a.out, name), quality=92)
            result['slides'].append(name)
        result['ok'] = True; code = 0
    except ContentError as e:
        result['error'] = str(e); code = 2
    except Exception as e:  # noqa: BLE001
        result['error'] = f'Renderer error: {type(e).__name__}: {e}'
    json.dump(result, open(os.path.join(a.out, 'result.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(code)


if __name__ == '__main__':
    main()
