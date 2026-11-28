#!/usr/bin/env python3
"""
Tiny static-site builder for Daniel Diaz · Peak Life Now.

  _src/pages/*.html     page bodies, starting with  <!--meta {...json...} -->
  _src/partials/*.html  shared pieces, included with {{> name}}

Placeholders:
  {{> partial}}         include _src/partials/partial.html
  {{icon:name}}         inline SVG icon (see ICONS below)
  {{page.key}}          a value from the page's meta block
  {{nav:key}}           aria-current="page" when the page's "nav" matches

Run:  python3 _src/build.py      (writes the finished pages to the repo root)
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "_src"
SITE_URL = "https://iamdanieldiaz.codebunny.net"

ICONS = {
    "arrow": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    "arrow-ur": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>',
    "arrow-left": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>',
    "phone": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
    "mail": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>',
    "pin": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.6"/></svg>',
    "linkedin": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3zM9.5 9.5h3.8v1.6h.06c.53-1 1.83-2.06 3.77-2.06 4.03 0 4.77 2.65 4.77 6.1V21h-4v-5.1c0-1.22-.02-2.79-1.7-2.79-1.7 0-1.96 1.33-1.96 2.7V21h-4z"/></svg>',
    "x": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L1.8 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z"/></svg>',
    "check": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" opacity=".35"/><path d="m7.5 12.5 3 3 6-6.5"/></svg>',
    "tick": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    "star": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2.5 2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>',
    "spark": '<svg viewBox="0 0 40 40" fill="currentColor" aria-hidden="true"><path d="M20 2c1.2 11.6 6.4 16.8 18 18-11.6 1.2-16.8 6.4-18 18-1.2-11.6-6.4-16.8-18-18C13.6 18.8 18.8 13.6 20 2z"/></svg>',
    "clock": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    "lock": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/></svg>',
    "video": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="6" width="13" height="12" rx="3"/><path d="m15.5 10.5 6-3.5v10l-6-3.5"/></svg>',
    "chair": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 21v-4M17 21v-4M5 13h14v4H5zM7 13V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8"/></svg>',
    "compass": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>',
    "target": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="1.5"/></svg>',
    "heart": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
    "bolt": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
    "eye": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    "users": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg>',
    "route": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H17a3.5 3.5 0 0 0 0-7H7a3.5 3.5 0 0 1 0-7h8.5"/></svg>',
    "calendar": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="17" rx="3"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/></svg>',
    "bell": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    "book": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>',
    "mic": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4M8 22h8"/></svg>',
    "leaf": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 20A7 7 0 0 1 4 13c0-6 6-9 16-10-1 10-4 16-10 16"/><path d="M2 22c3-4 6-7 11-10"/></svg>',
    "sun": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    "quote": '<svg viewBox="0 0 48 48" fill="currentColor" aria-hidden="true"><path d="M8 38V27.4C8 17.6 13.2 11.3 21 9l1.8 3.6c-4.6 1.9-7.3 5.6-7.6 10.4H21V38zm19 0V27.4C27 17.6 32.2 11.3 40 9l1.8 3.6c-4.6 1.9-7.3 5.6-7.6 10.4H40V38z"/></svg>',
    "play": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>',
    "instagram": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/></svg>',
    "flame": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22c4.4 0 7-2.9 7-6.6 0-4.4-3.6-6.6-4.6-10.4-1.9 1.5-2.8 3.6-2.6 5.9-1.3-.8-2.1-2.3-2.2-3.9C7.4 8.8 5 11.8 5 15.4 5 19.1 7.6 22 12 22z"/><path d="M12 22c-1.7 0-3-1.2-3-3 0-2 1.6-3 2.4-4.8.9 1.2 3.6 2.4 3.6 4.8 0 1.8-1.3 3-3 3z"/></svg>',
    "brain": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 3.5a3 3 0 0 0-3 3v.2a3 3 0 0 0-2 5.3 3 3 0 0 0 2 5.3 3 3 0 0 0 3 3.2c.9 0 1.7-.4 2.5-1V4.5c-.7-.6-1.6-1-2.5-1z"/><path d="M14.5 3.5a3 3 0 0 1 3 3v.2a3 3 0 0 1 2 5.3 3 3 0 0 1-2 5.3 3 3 0 0 1-3 3.2c-.9 0-1.7-.4-2.5-1"/></svg>',
    "repeat": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>',
    "pulse": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>',
    "mountain": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 20 6.5-11 3.5 6 2.5-3.5L21 20z"/><circle cx="17" cy="5.5" r="1.6"/></svg>',
    "shield": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.5 4 5.5v6c0 5 3.4 8.9 8 10 4.6-1.1 8-5 8-10v-6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>',
    "map": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H17a3.5 3.5 0 0 0 0-7H7a3.5 3.5 0 0 1 0-7h8.5"/></svg>',
    "bulb": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21.5h4"/><path d="M12 2.5a6.5 6.5 0 0 0-3.8 11.8c.6.5 1 1.2 1 2V16h5.6v-.2c0-.8.4-1.5 1-2A6.5 6.5 0 0 0 12 2.5z"/></svg>',
    "arrow-down": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    "chev": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    "plus": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    "close": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
}

MARK = ('<svg class="brand__mark" viewBox="0 0 40 40" aria-hidden="true">'
        '<circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" stroke-width="1.4"/>'
        '<path fill="currentColor" d="M20 6c.9 8.6 5.4 13.1 14 14-8.6.9-13.1 5.4-14 14-.9-8.6-5.4-13.1-14-14 8.6-.9 13.1-5.4 14-14z"/></svg>')


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
    text = re.sub(r"\{\{cur:([\w.-]+)\}\}",
                  lambda m: 'aria-current="page"' if meta.get("slug") == m.group(1) else "", text)
    text = re.sub(r"\{\{page\.([\w-]+)\}\}", lambda m: str(meta.get(m.group(1), "")), text)
    return text


def bust_cache(html):
    """Append ?v=<content hash> to local CSS/JS so browsers fetch fresh files after each change."""
    import hashlib

    def ver(m):
        path = m.group(2)
        f = ROOT / path
        if not f.is_file():
            return m.group(0)
        h = hashlib.md5(f.read_bytes()).hexdigest()[:8]
        return f'{m.group(1)}{path}?v={h}"'

    return re.sub(r'((?:href|src)=")(assets/(?:css|js|vendor)/[\w.-]+\.(?:css|js))"', ver, html)


def _text(fragment):
    """Plain text from a small HTML fragment (for structured data)."""
    import html as htmlmod
    s = re.sub(r"<[^>]+>", " ", fragment)
    return re.sub(r"\s+", " ", htmlmod.unescape(s)).strip()


def faq_schema(body):
    """FAQPage structured data built from the page's own FAQ markup, so Google sees the same answers people do."""
    qa = re.findall(r'<button class="faq__q"[^>]*>(.*?)<span class="faq__icon".*?<div class="faq__a"><div>(.*?)</div></div>', body, re.S)
    if not qa:
        return ""
    data = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": _text(q), "acceptedAnswer": {"@type": "Answer", "text": _text(a)}} for q, a in qa]}
    return '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False) + "</script>"


def write_seo_files(listed):
    """sitemap.xml and robots.txt at the site root (pages marked noindex stay out)."""
    import datetime
    today = datetime.date.today().isoformat()
    order = ["index.html", "coaching.html", "scorecard.html", "apply.html", "about.html", "ignition.html", "speaking.html", "results.html"]
    listed.sort(key=lambda x: order.index(x[1]) if x[1] in order else 99)
    rows = "".join(f"  <url><loc>{url}</loc><lastmod>{today}</lastmod><priority>{'1.0' if name == 'index.html' else '0.8'}</priority></url>\n" for url, name in listed)
    (ROOT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + rows + "</urlset>\n")
    (ROOT / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {SITE_URL}/sitemap.xml\n")
    print("wrote sitemap.xml and robots.txt")


CTA_DEFAULTS = {
    "cta_label": "Your next level starts with one conversation",
    "cta_title": "Your peak life <em>starts now.</em>",
    "cta_text": "How long will you allow yourself to stay exactly where you are? Book a free discovery call and leave with your quickest route to having it all.",
    "cta_p_label": "Book a discovery call", "cta_p_href": "apply.html", "cta_p_attr": "data-book", "cta_p_icon": "arrow-ur",
    "cta_s_label": "Take the scorecard", "cta_s_href": "scorecard.html", "cta_s_attr": "", "cta_s_icon": "compass",
}


def cta_meta(meta):
    """Closing call to action: shared design, page-specific wording (set cta_* in a page's meta block)."""
    for k, v in CTA_DEFAULTS.items():
        meta.setdefault(k, v)
    for k in ("cta_p_icon", "cta_s_icon"):
        if not meta[k].lstrip().startswith("<"):
            meta[k] = ICONS[meta[k]]


def build():
    layout = (SRC / "partials" / "layout.html").read_text()
    pages = sorted((SRC / "pages").glob("*.html"))
    listed = []
    for page in pages:
        raw = page.read_text()
        m = re.match(r"\s*<!--meta\s*(\{.*?\})\s*-->", raw, re.S)
        meta = json.loads(m.group(1)) if m else {}
        body = raw[m.end():] if m else raw
        meta.setdefault("slug", page.name)
        meta["canonical"] = SITE_URL + "/" + ("" if page.name == "index.html" else page.name)
        meta.setdefault("og_image", "assets/img/og-daniel-diaz.jpg")
        meta.setdefault("htmlclass", "")
        meta.setdefault("robots", "index, follow")
        cta_meta(meta)
        meta["body"] = "{{BODY}}"
        meta["faq_schema"] = faq_schema(body)
        html = render(layout, meta)
        html = html.replace("{{BODY}}", render(body, meta))
        html = bust_cache(html)
        (ROOT / page.name).write_text(html)
        if "noindex" not in meta["robots"]:
            listed.append((meta["canonical"], page.name))
        print("built", page.name)
    write_seo_files(listed)


if __name__ == "__main__":
    build()
