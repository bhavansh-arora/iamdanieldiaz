# Daniel Diaz · Peak Life Now

A multi-page static website for Daniel Diaz (peak performance coach, speaker, Peak Life Now). No framework, no build tooling beyond one Python script; it runs on any static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages, cPanel).

The pitch email that goes with it is in [`docs/reply-to-daniel.md`](docs/reply-to-daniel.md).

## Pages
| Page | File |
| --- | --- |
| Home | `index.html` |
| About Daniel (story timeline, family, beliefs, mission) | `about.html` |
| 1:1 Peak Now Coaching + VIP Day Intensive (compare, process, FAQ) | `coaching.html` |
| IGNITION men's cohort + Cohort 02 waitlist | `ignition.html` |
| Speaking: The Perfect Circle of Performance + enquiry form | `speaking.html` |
| Client results (filterable) | `results.html` |
| Peak Life Scorecard (interactive assessment) | `scorecard.html` |
| Apply / book a discovery call (5-step application) | `apply.html` |
| Not found | `404.html` |

## Design system
The site runs on the same Code Bunny design system as annerose.codebunny.net: the same layout engine, components, typography (Bricolage Grotesque, Instrument Serif, Inter Tight) and motion, re-themed to Daniel's brand: warm near-black, Daniel's gold, burnt amber and ember. Colours are tokens at the top of `assets/css/main.css`.

Components used across the pages: magazine-cover hero with a cut-out portrait, page heroes with breadcrumbs, stacking cards, bento tiles, credentials marquee, the Peak Method circle, a pinned horizontal method strip, testimonial wall, "Find your path" quiz, program cards, timeline, statements that reveal word by word, quotes slider, FAQ, multi-step forms, and the Peak Life Scorecard.

Motion highlights: a welcome animation on every fresh page load (drawn peak, name rising, counter), Anne's page transition timing with a drawn peak and the destination title, every heading and text block animated in, the footer wordmark rising letter by letter (with a light sweep on "Now" and a cursor wave on desktop), animated proof graphics on About, and peak dials and contour dividers (`_src/partials/dial.html`, `divider.html`) in otherwise empty space.

The hero cut-out (`assets/img/daniel-laugh-cut.webp`) was made from `daniel-laugh.webp` by removing the plain wall behind Daniel. Any photo on a plain background can be cut the same way.

## Editing
The pages in this folder are **generated**. Edit the source and rebuild:

```bash
python3 _src/build.py
```

- `_src/pages/*.html`: the body of each page (the meta block at the top sets the title and description)
- `_src/partials/*.html`: layout, header and menu, footer with the Morning Mastery opt-in, final call-to-action, "Find your path" quiz, marquees, line-art peak
- `_src/build.py`: icons, `SITE_URL` (used for canonical and share links)
- `_src/og/og.html`: the link-preview card (1200×630). Open it in a browser at that size, screenshot it, and save as `assets/img/og-daniel-diaz.jpg`. When you change it, save under a new filename and update `og_image` in `_src/build.py`, because LinkedIn, Facebook and WhatsApp cache previews by URL
- `assets/css/main.css`: design tokens at the top, then the components; Daniel-specific pieces (scorecard, application extras, opt-in) are at the end
- `assets/js/site.js`: smooth scroll, header, menu, cursor, in-place page transitions, stacking cards, testimonial wall, quotes, filters, path finder, application, Peak Life Scorecard, form delivery
- `assets/js/motion.js`: GSAP + ScrollTrigger animations (hero intro and depth, word reveals, hand-drawn underlines, image wipes, pinned method strip, counters, rings). Respects `prefers-reduced-motion`; content always shows if scripts fail

## Connecting the automations
Everything is set in **`assets/js/config.js`**:

- `bookingUrl`: already set to Daniel's Kartra booking page. Every "Book a call" button opens it.
- `formEndpoint`: any endpoint that accepts a JSON POST (Kartra or GoHighLevel webhook, Make.com, Zapier, Formspree …). Every form posts here with a `form` field naming its source (`application`, `scorecard`, `speaking`, `ignition-waitlist`, `morning-mastery`), so one automation can tag, route and auto-reply. When it's empty, forms open a pre-filled email to Daniel instead.
- `email`, `replyPromise`, `nextCohort`: contact address, the response time shown to visitors, and the IGNITION cohort label.

## Preview locally
```bash
python3 -m http.server 8080
```
Run it from this folder, then open http://localhost:8080.

## Deploying
The site is served by GitHub Pages from the root of `main` at **https://iamdanieldiaz.codebunny.net** (set by the `CNAME` file). All links are relative, so it also works from any other static host or as a subfolder. If the domain changes, update `CNAME`, `SITE_URL` in `_src/build.py` and the absolute URLs in `_src/partials/layout.html`, then rebuild so canonical and share-preview links point to the right place.

`_config.yml` keeps `docs/`, `_src/` and this README off the published site, so the pitch email and build notes stay in the repo only.
