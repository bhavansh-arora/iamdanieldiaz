#!/usr/bin/env python3
"""
Static-site builder for Daniel Diaz · Peak Life Now.

  _src/pages/*.html     page bodies, starting with  <!--meta {...json...} -->
  _src/partials/*.html  shared pieces, included with {{> name}}

Placeholders:
  {{> partial}}         include _src/partials/partial.html
  {{icon:name}}         inline SVG icon (see ICONS below)
  {{mark}}              the Peak Life Now logo mark
  {{page.key}}          a value from the page's meta block
  {{nav:key}}           aria-current="page" when the page's "nav" matches

Run:  python3 _src/build.py      (writes the finished pages next to _src/)
"""
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "_src"
SITE_URL = "https://iamdanieldiaz.codebunny.net"

S = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'
ICONS = {
    "arrow": f'<svg viewBox="0 0 24 24" {S}><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    "arrow-ur": f'<svg viewBox="0 0 24 24" {S}><path d="M7 17 17 7M8 7h9v9"/></svg>',
    "arrow-left": f'<svg viewBox="0 0 24 24" {S}><path d="M19 12H5M11 18l-6-6 6-6"/></svg>',
    "arrow-down": f'<svg viewBox="0 0 24 24" {S}><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    "chev": f'<svg viewBox="0 0 24 24" {S}><path d="m6 9 6 6 6-6"/></svg>',
    "plus": f'<svg viewBox="0 0 24 24" {S}><path d="M12 5v14M5 12h14"/></svg>',
    "mail": f'<svg viewBox="0 0 24 24" {S}><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>',
    "instagram": f'<svg viewBox="0 0 24 24" {S}><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/></svg>',
    "linkedin": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3zM9.5 9.5h3.8v1.6h.06c.53-1 1.83-2.06 3.77-2.06 4.03 0 4.77 2.65 4.77 6.1V21h-4v-5.1c0-1.22-.02-2.79-1.7-2.79-1.7 0-1.96 1.33-1.96 2.7V21h-4z"/></svg>',
    "check": f'<svg viewBox="0 0 24 24" {S} stroke-width="2.2"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    "x": f'<svg viewBox="0 0 24 24" {S} stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    "star": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2.5 2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>',
    "spark": '<svg viewBox="0 0 40 40" fill="currentColor" aria-hidden="true"><path d="M20 2c1.2 11.6 6.4 16.8 18 18-11.6 1.2-16.8 6.4-18 18-1.2-11.6-6.4-16.8-18-18C13.6 18.8 18.8 13.6 20 2z"/></svg>',
    "bolt": f'<svg viewBox="0 0 24 24" {S}><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
    "flame": f'<svg viewBox="0 0 24 24" {S}><path d="M12 22c4.4 0 7-2.9 7-6.6 0-4.4-3.6-6.6-4.6-10.4-1.9 1.5-2.8 3.6-2.6 5.9-1.3-.8-2.1-2.3-2.2-3.9C7.4 8.8 5 11.8 5 15.4 5 19.1 7.6 22 12 22z"/><path d="M12 22c-1.7 0-3-1.2-3-3 0-2 1.6-3 2.4-4.8.9 1.2 3.6 2.4 3.6 4.8 0 1.8-1.3 3-3 3z"/></svg>',
    "book": f'<svg viewBox="0 0 24 24" {S}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>',
    "bulb": f'<svg viewBox="0 0 24 24" {S}><path d="M9 18h6M10 21.5h4"/><path d="M12 2.5a6.5 6.5 0 0 0-3.8 11.8c.6.5 1 1.2 1 2V16h5.6v-.2c0-.8.4-1.5 1-2A6.5 6.5 0 0 0 12 2.5z"/></svg>',
    "brain": f'<svg viewBox="0 0 24 24" {S}><path d="M9.5 3.5a3 3 0 0 0-3 3v.2a3 3 0 0 0-2 5.3 3 3 0 0 0 2 5.3 3 3 0 0 0 3 3.2c.9 0 1.7-.4 2.5-1V4.5c-.7-.6-1.6-1-2.5-1z"/><path d="M14.5 3.5a3 3 0 0 1 3 3v.2a3 3 0 0 1 2 5.3 3 3 0 0 1-2 5.3 3 3 0 0 1-3 3.2c-.9 0-1.7-.4-2.5-1"/></svg>',
    "heart": f'<svg viewBox="0 0 24 24" {S}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
    "repeat": f'<svg viewBox="0 0 24 24" {S}><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>',
    "target": f'<svg viewBox="0 0 24 24" {S}><circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="1.5"/></svg>',
    "users": f'<svg viewBox="0 0 24 24" {S}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg>',
    "sun": f'<svg viewBox="0 0 24 24" {S}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    "pulse": f'<svg viewBox="0 0 24 24" {S}><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>',
    "calendar": f'<svg viewBox="0 0 24 24" {S}><rect x="3" y="4.5" width="18" height="17" rx="3"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/></svg>',
    "phone": f'<svg viewBox="0 0 24 24" {S}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
    "mic": f'<svg viewBox="0 0 24 24" {S}><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4M8 22h8"/></svg>',
    "compass": f'<svg viewBox="0 0 24 24" {S}><circle cx="12" cy="12" r="9.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>',
    "mountain": f'<svg viewBox="0 0 24 24" {S}><path d="m3 20 6.5-11 3.5 6 2.5-3.5L21 20z"/><circle cx="17" cy="5.5" r="1.6"/></svg>',
    "clock": f'<svg viewBox="0 0 24 24" {S}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    "shield": f'<svg viewBox="0 0 24 24" {S}><path d="M12 2.5 4 5.5v6c0 5 3.4 8.9 8 10 4.6-1.1 8-5 8-10v-6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>',
    "map": f'<svg viewBox="0 0 24 24" {S}><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H17a3.5 3.5 0 0 0 0-7H7a3.5 3.5 0 0 1 0-7h8.5"/></svg>',
    "lock": f'<svg viewBox="0 0 24 24" {S}><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/></svg>',
    "quote": '<svg viewBox="0 0 48 48" fill="currentColor" aria-hidden="true"><path d="M8 38V27.4C8 17.6 13.2 11.3 21 9l1.8 3.6c-4.6 1.9-7.3 5.6-7.6 10.4H21V38zm19 0V27.4C27 17.6 32.2 11.3 40 9l1.8 3.6c-4.6 1.9-7.3 5.6-7.6 10.4H40V38z"/></svg>',
    "play": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>',
}

# Peak Life Now mark: a ring, a summit and a rising sun
MARK = ('<svg class="mark" viewBox="0 0 40 40" aria-hidden="true">'
        '<circle class="mark__sun" cx="27.5" cy="12.5" r="6.2"/>'
        '<path fill="currentColor" d="M2.5 34 15.6 9.6l7.1 12.2 4.1-6.2L37.5 34z"/>'
        '<path class="mark__cut" d="M15.6 9.6 11.9 16.5l2.4-1.5 1.6 1.9 2-1.8 2 1.2z"/></svg>')


def render(text, meta, depth=0):
    if depth > 8:
        raise RuntimeError("include depth exceeded")

    def inc(m):
        name = m.group(1).strip()
        return render((SRC / "partials" / f"{name}.html").read_text(), meta, depth + 1)

    text = re.sub(r"\{\{>\s*([\w-]+)\s*\}\}", inc, text)
    text = re.sub(r"\{\{icon:([\w-]+)\}\}", lambda m: ICONS[m.group(1)], text)
    text = text.replace("{{mark}}", MARK)
    text = re.sub(r"\{\{nav:([\w-]+)\}\}",
                  lambda m: 'aria-current="page"' if meta.get("nav") == m.group(1) else "", text)
    text = re.sub(r"\{\{page\.([\w-]+)\}\}", lambda m: str(meta.get(m.group(1), "")), text)
    return text


def bust_cache(html):
    """Append ?v=<content hash> to local CSS/JS so browsers fetch fresh files after each change."""
    def ver(m):
        path = m.group(2)
        f = ROOT / path
        if not f.is_file():
            return m.group(0)
        return f'{m.group(1)}{path}?v={hashlib.md5(f.read_bytes()).hexdigest()[:8]}"'
    return re.sub(r'((?:href|src)=")(assets/(?:css|js|vendor)/[\w.-]+\.(?:css|js))"', ver, html)


def build():
    layout = (SRC / "partials" / "layout.html").read_text()
    for page in sorted((SRC / "pages").glob("*.html")):
        raw = page.read_text()
        m = re.match(r"\s*<!--meta\s*(\{.*?\})\s*-->", raw, re.S)
        meta = json.loads(m.group(1)) if m else {}
        body = raw[m.end():] if m else raw
        meta.setdefault("slug", page.name)
        meta["canonical"] = SITE_URL + "/" + ("" if page.name == "index.html" else page.name)
        meta.setdefault("og_image", "assets/img/og-peak-life-now.jpg")
        meta.setdefault("htmlclass", "" if page.name == "index.html" else "no-preloader")
        html = render(layout, meta).replace("{{BODY}}", render(body, meta))
        (ROOT / page.name).write_text(bust_cache(html))
        print("built", page.name)


if __name__ == "__main__":
    build()
