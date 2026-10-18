#!/usr/bin/env python3
"""
Generate app/dark-theme.css from app/globals.css.

Every rule in globals.css that sets a colour-bearing property is re-emitted
under  html[data-theme='dark']  with its colours remapped for a dark UI.
globals.css itself is never modified, so light mode cannot regress.

Usage:  python3 scripts/generate-dark-theme.py
Hand-tuned overrides live in app/dark-theme.manual.css and are appended.
"""
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'app' / 'globals.css'
MANUAL = ROOT / 'app' / 'dark-theme.manual.css'
OUT = ROOT / 'app' / 'dark-theme.css'

D = "html[data-theme='dark']"

# Final (last-declared) values of the colour custom properties in globals.css.
ROOT_VARS = {
    '--paper': '#fbf7f2', '--white': '#fff', '--ink': '#26202c',
    '--muted': '#77717e', '--line': '#e9dfd7', '--purple': '#7650a0',
    '--purple-dark': '#563579', '--lavender': '#eee4f7',
}

# ---------------------------------------------------------------- colour maths
def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def lin_to_srgb(c):
    return 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055

def rgb_to_oklch(r, g, b):
    r, g, b = (srgb_to_lin(x / 255) for x in (r, g, b))
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l, m, s = (x ** (1 / 3) for x in (l, m, s))
    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return L, math.hypot(a, bb), math.degrees(math.atan2(bb, a)) % 360

def oklch_to_rgb(L, C, h):
    for _ in range(40):  # reduce chroma until in gamut
        a, b = C * math.cos(math.radians(h)), C * math.sin(math.radians(h))
        l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
        m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
        s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
        r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
        g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
        bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
        if all(-0.001 <= x <= 1.001 for x in (r, g, bl)):
            break
        C *= 0.93
    return tuple(max(0, min(255, round(lin_to_srgb(max(0, min(1, x))) * 255))) for x in (r, g, bl))

def clamp(x, lo, hi):
    return max(lo, min(hi, x))

# ---------------------------------------------------------------- colour parse
HEX_RE = re.compile(r'#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b')
RGB_RE = re.compile(r'rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)')
NAMED_RE = re.compile(r'(?<![-\w#])(white|black)(?![-\w])')
COLOR_RE = re.compile('|'.join([HEX_RE.pattern, RGB_RE.pattern, NAMED_RE.pattern]))

def parse_color(tok):
    tok = tok.strip()
    if tok == 'white':
        return 255, 255, 255, 1.0
    if tok == 'black':
        return 0, 0, 0, 1.0
    if tok.startswith('#'):
        h = tok[1:]
        if len(h) == 3:
            h = ''.join(c * 2 for c in h)
        r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
        return r, g, b, a
    m = RGB_RE.fullmatch(tok)
    r, g, b = (round(float(m.group(i))) for i in (1, 2, 3))
    return r, g, b, float(m.group(4)) if m.group(4) is not None else 1.0

def fmt(r, g, b, a):
    if a >= 0.995:
        return '#%02x%02x%02x' % (r, g, b)
    return 'rgba(%d, %d, %d, %s)' % (r, g, b, ('%.3f' % a).rstrip('0').rstrip('.'))

# ---------------------------------------------------------------- mapping
PAGE_HEXES = {'#f8f7f4', '#fbf7f2', '#fbf8f5'}
PAGE_RGB = {(248, 247, 244), (251, 247, 242)}

def tone(C, h, amount):
    """Low-chroma creams would turn brown in dark mode: re-tint them cool-purple."""
    if C < 0.017:
        return amount, 300.0
    return None, h

def map_surface(L, C, h, page=False):
    """light surface -> dark surface (cards lighter than page, tints lighter still)"""
    if page:
        return 0.18, 0.011, 300.0
    if L >= 0.985:
        newL = 0.225
    else:
        newL = clamp(0.23 + (0.985 - L) * 1.0, 0.23, 0.38)
    cc, hh = tone(C, h, 0.012)
    return newL, (cc if cc is not None else clamp(C * 1.7, 0, 0.05)), hh

def map_text(L, C, h):
    """dark/mid text -> light text"""
    return clamp(1.02 - 0.45 * L, 0.62, 0.95), C * 0.9, h

def map_border(L, C, h):
    cc, hh = tone(C, h, 0.014)
    return clamp(0.27 + (1 - L) * 0.6, 0.29, 0.40), (cc if cc is not None else clamp(C * 1.2, 0, 0.04)), hh

def map_strong(L, C, h):
    """saturated button/panel fill: keep identity, keep white text legible"""
    return clamp(0.50 + (L - 0.40) * 0.5, 0.44, 0.56), C, h

def map_color(tok, cat, strong_ctx):
    r, g, b, a = parse_color(tok)
    L, C, h = rgb_to_oklch(r, g, b)
    chromatic = C >= 0.04
    is_page = tok.lower() in PAGE_HEXES or (r, g, b) in PAGE_RGB

    # ---- shadows / glows
    if cat == 'shadow':
        if L > 0.9:                      # white inset highlight
            return fmt(255, 255, 255, a * 0.12)
        if chromatic and L >= 0.45:      # purple focus ring / glow
            r2, g2, b2 = oklch_to_rgb(0.72, C, h)
            return fmt(r2, g2, b2, clamp(a * 1.1, 0, 0.8))
        return fmt(0, 0, 0, clamp(a * 1.9 + 0.02, 0, 0.7))

    # ---- text / icon colours
    if cat == 'text':
        if L > 0.78:                     # designed for dark backgrounds already
            return fmt(r, g, b, a)
        if strong_ctx and L > 0.6:
            return fmt(r, g, b, a)
        r2, g2, b2 = oklch_to_rgb(*map_text(L, C, h))
        return fmt(r2, g2, b2, a)

    # ---- borders / outlines
    if cat == 'border':
        if L > 0.80:
            r2, g2, b2 = oklch_to_rgb(*map_border(L, C, h))
            return fmt(r2, g2, b2, a)
        if strong_ctx and chromatic and L < 0.62:
            r2, g2, b2 = oklch_to_rgb(*map_strong(L, C, h))
            return fmt(r2, g2, b2, a)
        if L < 0.3 and not chromatic:    # black-ish hairline
            return fmt(255, 255, 255, clamp(a * 0.6, 0, 0.3)) if a < 0.5 else fmt(r, g, b, a)
        r2, g2, b2 = oklch_to_rgb(*map_text(L, C, h))
        return fmt(r2, g2, b2, a)

    # ---- backgrounds
    if a < 0.5 and L < 0.45 and a <= 0.12:        # subtle dark tint (hover wash)
        return fmt(255, 255, 255, clamp(a * 1.3, 0, 0.12))
    if a < 0.5 and chromatic and 0.45 <= L <= 0.8:  # translucent purple tint
        r2, g2, b2 = oklch_to_rgb(0.72, C, h)
        return fmt(r2, g2, b2, clamp(a * 1.15, 0, 0.5))
    if L >= 0.78:
        r2, g2, b2 = oklch_to_rgb(*map_surface(L, C, h, page=is_page))
        return fmt(r2, g2, b2, a)
    if chromatic and L < 0.62 and a >= 0.5:        # saturated fill
        r2, g2, b2 = oklch_to_rgb(*map_strong(L, C, h))
        return fmt(r2, g2, b2, a)
    if chromatic and a >= 0.5 and 0.62 <= L < 0.78:  # bright accent fill (pink/lilac gradient stop)
        r2, g2, b2 = oklch_to_rgb(L - 0.04, C, h)
        return fmt(r2, g2, b2, a)
    if L < 0.35:                                   # near-black scrim / dark panel
        return fmt(r, g, b, a)
    r2, g2, b2 = oklch_to_rgb(*map_surface(clamp(L + 0.15, 0, 1), C, h))
    return fmt(r2, g2, b2, a)

# ---------------------------------------------------------------- css parsing
def strip_comments(s):
    return re.sub(r'/\*.*?\*/', '', s, flags=re.S)

def find_block_end(s, i):
    depth = 0
    in_str = None
    while i < len(s):
        c = s[i]
        if in_str:
            if c == in_str:
                in_str = None
        elif c in '"\'':
            in_str = c
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise ValueError('unbalanced braces')

def parse_nodes(s):
    nodes, i = [], 0
    while i < len(s):
        j = s.find('{', i)
        if j == -1:
            break
        prelude = s[i:j].strip()
        k = find_block_end(s, j)
        body = s[j + 1:k]
        if prelude.startswith('@'):
            nodes.append(('at', prelude, parse_nodes(body) if re.match(r'@(media|supports|layer|(-webkit-)?keyframes)', prelude) else None))
        else:
            nodes.append(('rule', prelude, body))
        i = k + 1
    return nodes

def split_decls(body):
    out, buf, depth, in_str = [], '', 0, None
    for c in body:
        if in_str:
            buf += c
            if c == in_str:
                in_str = None
            continue
        if c in '"\'':
            in_str = c
        elif c == '(':
            depth += 1
        elif c == ')':
            depth -= 1
        if c == ';' and depth == 0:
            if buf.strip():
                out.append(buf.strip())
            buf = ''
        else:
            buf += c
    if buf.strip():
        out.append(buf.strip())
    return out

TEXT_PROPS = {'color', 'fill', 'stroke', 'caret-color', 'accent-color',
              '-webkit-text-fill-color', 'text-decoration-color', 'text-decoration'}
SHADOW_PROPS = {'box-shadow', 'text-shadow', 'filter', 'drop-shadow'}
BORDER_NON_COLOR = re.compile(r'border-(radius|width|style|collapse|spacing|image|image-.*)|border-(top|bottom)-(left|right)-radius|outline-(offset|width|style)')

def categorize(prop):
    if prop in TEXT_PROPS:
        return 'text'
    if prop in SHADOW_PROPS:
        return 'shadow'
    if prop.startswith('background'):
        return 'bg'
    if prop.startswith('border') or prop.startswith('outline') or prop == 'column-rule':
        return None if BORDER_NON_COLOR.fullmatch(prop) else 'border'
    return None

def substitute_vars(value, cat):
    def repl(m):
        name = m.group(1)
        if name in ROOT_VARS:
            return ROOT_VARS[name]
        return m.group(0)
    return re.sub(r'var\((--[a-z-]+)\)', repl, value)

def decl_has_color(value):
    return bool(COLOR_RE.search(value)) or 'var(--' in value or 'transparent' in value

def rule_is_strong(decls):
    """Does this rule paint a saturated fill (so its light text must stay light)?"""
    for d in decls:
        if ':' not in d:
            continue
        prop, val = (x.strip() for x in d.split(':', 1))
        if prop.startswith('background'):
            val = substitute_vars(val, 'bg')
            for m in COLOR_RE.finditer(val):
                r, g, b, a = parse_color(m.group(0))
                L, C, _ = rgb_to_oklch(r, g, b)
                if a >= 0.5 and C >= 0.04 and L < 0.62:
                    return True
            if 'var(--grad-brand)' in val:
                return True
    return False

def map_declaration(decl, strong):
    prop, val = (x.strip() for x in decl.split(':', 1))
    cat = categorize(prop)
    if cat is None or not decl_has_color(val):
        return None
    important = ''
    if re.search(r'!\s*important\s*$', val):
        important = ' !important'
        val = re.sub(r'\s*!\s*important\s*$', '', val)
    val = substitute_vars(val, cat)
    # 'filter' only matters if it contains a drop-shadow colour
    if prop == 'filter' and 'drop-shadow' not in val:
        return None
    if prop == 'text-decoration' and not COLOR_RE.search(val):
        return None
    if cat == 'text' and prop in ('stroke', 'fill') and 'currentColor' in val:
        return None
    # url(...) payloads (inline SVG data URIs) are left untouched
    parts = re.split(r'(url\([^)]*\))', val)
    new_parts = []
    for p in parts:
        if p.startswith('url('):
            new_parts.append(p)
        else:
            new_parts.append(COLOR_RE.sub(lambda m: map_color(m.group(0), cat, strong), p))
    new_val = ''.join(new_parts)
    return '%s: %s%s' % (prop, new_val, important)

def prefix_selector(sel):
    out = []
    for s in (x.strip() for x in sel.split(',')):
        if not s:
            continue
        if re.match(r'^(html|:root)(?![\w-])', s):
            s = re.sub(r'^(html|:root)', D, s, count=1)
        else:
            s = D + ' ' + s
        out.append(s)
    return ',\n'.join(out)

stats = {'rules': 0, 'decls': 0}

DARK_KEYFRAMES = set()

def collect_dark_keyframes(nodes):
    """Names of @keyframes that animate colours (they get a '-dark' twin)."""
    for kind, prelude, body in nodes:
        if kind != 'at' or body is None:
            continue
        m = re.match(r'@(?:-webkit-)?keyframes\s+([\w-]+)', prelude)
        if m:
            for k2, p2, b2 in body:
                if k2 == 'rule' and any(map_declaration(d, False) for d in split_decls(b2) if ':' in d):
                    DARK_KEYFRAMES.add(m.group(1))
        else:
            collect_dark_keyframes(body)

def rename_animation(decl):
    prop, val = (x.strip() for x in decl.split(':', 1))
    if prop not in ('animation', 'animation-name'):
        return None
    new_val = val
    for name in DARK_KEYFRAMES:
        new_val = re.sub(r'(?<![\w-])%s(?![\w-])' % re.escape(name), name + '-dark', new_val)
    return None if new_val == val else '%s: %s' % (prop, new_val)

def emit_keyframes(prelude, frames, depth):
    m = re.match(r'(@(?:-webkit-)?keyframes)\s+([\w-]+)', prelude)
    if not m or m.group(2) not in DARK_KEYFRAMES:
        return ''
    pad = '  ' * depth
    out = []
    for _, sel, body in frames:
        decls = [d for d in split_decls(body) if ':' in d]
        rows = []
        for d in decls:
            rows.append(map_declaration(d, False) or d)
        out.append('%s  %s {\n%s\n%s  }\n' % (pad, sel, '\n'.join('%s    %s;' % (pad, r) for r in rows), pad))
    return '%s%s %s-dark {\n%s%s}\n' % (pad, m.group(1), m.group(2), ''.join(out), pad)

def emit(nodes, depth=0):
    out = []
    pad = '  ' * depth
    for kind, prelude, body in nodes:
        if kind == 'at':
            if body is None:
                continue  # font-face etc.: skipped
            if re.match(r'@(?:-webkit-)?keyframes', prelude):
                kf = emit_keyframes(prelude, body, depth)
                if kf:
                    out.append(kf)
                continue
            inner = emit(body, depth + 1)
            if inner:
                out.append('%s%s {\n%s%s}\n' % (pad, prelude, inner, pad))
            continue
        if prelude.strip().startswith(':root'):
            continue
        decls = [d for d in split_decls(body) if ':' in d]
        strong = rule_is_strong(decls)
        mapped = []
        for d in decls:
            r = map_declaration(d, strong) or rename_animation(d)
            if r:
                mapped.append(r)
        # A re-emitted `background` shorthand resets background-clip/size/etc.,
        # so carry the rule's other background longhands along after it.
        if any(m.startswith('background:') for m in mapped):
            have = set(mapped)
            for d in decls:
                prop = d.split(':', 1)[0].strip()
                if (prop.startswith('background-') or prop == '-webkit-background-clip') \
                        and prop != 'background-color' and d not in have and map_declaration(d, strong) is None:
                    mapped.append(d)
            # -webkit-text-fill-color etc. that make clipped text visible
            for d in decls:
                if d.split(':', 1)[0].strip() == '-webkit-text-fill-color' and d not in have and d not in mapped:
                    mapped.append(d)
        # `animation` shorthand also resets animation-timeline / -range / -delay...
        if any(m.startswith('animation:') for m in mapped):
            for d in decls:
                prop = d.split(':', 1)[0].strip()
                if prop.startswith('animation-') and prop != 'animation-name' and d not in mapped:
                    mapped.append(d)
        if not mapped:
            continue
        stats['rules'] += 1
        stats['decls'] += len(mapped)
        sel = prefix_selector(prelude)
        sel = ',\n'.join(pad + x for x in sel.split(',\n'))
        out.append('%s {\n%s\n%s}\n' % (sel, '\n'.join('%s  %s;' % (pad, m) for m in mapped), pad))
    return '\n'.join(out) + ('\n' if out else '')

def dark_root_block():
    def m(tok, cat, strong=False):
        return map_color(tok, cat, strong)
    lines = [
        '--paper: %s' % m('#fbf7f2', 'bg'),
        '--white: %s' % m('#ffffff', 'bg'),
        '--ink: %s' % m('#26202c', 'text'),
        '--muted: %s' % m('#77717e', 'text'),
        '--line: %s' % m('#e9dfd7', 'border'),
        '--purple: %s' % m('#7650a0', 'text'),
        '--purple-dark: %s' % m('#563579', 'text'),
        '--lavender: %s' % m('#eee4f7', 'bg'),
        '--grad-brand: linear-gradient(135deg, %s 0%%, %s 52%%, %s 100%%)' % (
            m('#8d66b0', 'bg'), m('#6b4192', 'bg'), m('#55337a', 'bg')),
        '--grad-text: linear-gradient(100deg, %s 0%%, %s 45%%, %s 70%%, %s 100%%)' % (
            m('#6d3f98', 'text'), m('#a45fb8', 'text'), m('#d0709a', 'text'), m('#8a5bb5', 'text')),
        '--shadow-sm: 0 1px 2px rgba(0, 0, 0, .35), 0 6px 18px rgba(0, 0, 0, .28)',
        '--shadow-md: 0 2px 4px rgba(0, 0, 0, .35), 0 14px 34px rgba(0, 0, 0, .38)',
        '--shadow-lg: 0 4px 10px rgba(0, 0, 0, .4), 0 28px 64px rgba(0, 0, 0, .5)',
    ]
    return "%s {\n  color-scheme: dark;\n%s;\n}\n" % (D, ';\n'.join('  ' + l for l in lines))

def main():
    css = strip_comments(SRC.read_text())
    css = re.sub(r'@import[^;]+;', '', css)
    nodes = parse_nodes(css)
    collect_dark_keyframes(nodes)
    body = emit(nodes)
    header = ("/* AUTO-GENERATED by scripts/generate-dark-theme.py from app/globals.css.\n"
              "   Do not hand-edit; put tweaks in app/dark-theme.manual.css and re-run. */\n\n")
    manual = MANUAL.read_text() if MANUAL.exists() else ''
    OUT.write_text(header + dark_root_block() + '\n' + body + '\n/* ---- manual overrides ---- */\n' + manual)
    print('wrote %s: %d rules, %d declarations, %d bytes' % (OUT, stats['rules'], stats['decls'], OUT.stat().st_size))

if __name__ == '__main__':
    sys.exit(main())
