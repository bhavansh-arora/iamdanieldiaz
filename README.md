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

## Editing
The pages in this folder are **generated**. Edit the source and rebuild:

```bash
python3 _src/build.py
```

- `_src/pages/*.html`: the body of each page (the meta block at the top sets the title and description)
- `_src/partials/*.html`: shared layout, header and menu, final call-to-action, footer with the Morning Mastery opt-in
- `_src/build.py`: icons, the logo mark, and `SITE_URL` (used for canonical and share links)
- `assets/css/main.css`: design tokens (colours, type scale, spacing) at the top, then the components
- `assets/js/site.js`: menu, header, cursor, in-place page transitions, testimonial slider, filters, keynote circle, scorecard engine, multi-step application, form delivery
- `assets/js/motion.js`: GSAP + ScrollTrigger animations (respects `prefers-reduced-motion`; content always shows if scripts fail)

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
