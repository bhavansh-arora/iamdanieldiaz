# Reply to Daniel

**Subject:** Your ideas, built out: a preview for Peak Life Now

---

Hi Daniel,

Thanks for being open to it. Rather than send a list of written ideas, we went a step further and built them out, using your own story, words, photos and client results, so you can click through and see how each one would work.

Your current site already does a lot right. Your story is genuinely powerful, your clients describe specific, believable results, and being named in Yahoo Finance's "Top 10 Performance Coaches To Be Following" is proof most coaches don't have. Everything below is about getting more of the right owners to act on that.

**Here's the preview:** https://iamdanieldiaz.codebunny.net

It works on phones, tablets and desktop. Here's what we added and how each piece helps you:

**1. A homepage that leads with proof.** The Yahoo Finance mention, your zero-capital-to-seven-figures story, and client results like a company grown 5x in under a year and the 32-mile Grand Canyon run now appear within the first few scrolls. A busy owner can tell quickly that you're the real deal.

**2. The Peak Life Scorecard.** A two-minute, eight-question check-in built around your own idea of matching achievement with fulfillment. Visitors see their achievement and fulfillment scores side by side, their two biggest levers (for example, relationships and energy), and the path that fits them: 1:1 coaching, a VIP Day or a discovery call. They can send the results to you, so you know where someone stands before you ever speak.

**3. A five-step application.** Your current application asks great questions, but it's one long page, which is a lot on a phone. We kept your key questions (goals, 30-day revenue, why now) and broke them into short, tap-to-answer steps, with a 1–10 commitment question so you can see at a glance who's ready now and who's exploring. If someone took the scorecard first, their results arrive with the application.

**4. IGNITION on your main site.** The cohort gets a full page: the six-part system, the four phases, what men walk away with and the founders' results, plus a waitlist for Cohort 02. One small thing we noticed: when the current IGNITION link is shared, its preview text still reads "built on Replit. Update this description to reflect the app." The new page has proper share previews.

**5. A speaking page that books.** The Perfect Circle of Performance gets its own page, with an interactive view of the keynote's themes and an enquiry form that captures the date, format and audience size up front, so every speaking lead arrives ready to quote.

**6. All your client stories in one place.** Nine stories, filterable by business, life and IGNITION, so a founder and a dad who wants his edge back can each find someone like them.

**7. A Morning Mastery opt-in that keeps every sign-up.** On your current pages, the newsletter block includes a Squarespace notice that it "needs a storage option," which usually means sign-ups aren't being saved. The new opt-in sits at the bottom of every page and can feed Kartra or any email tool.

It all connects to what you already use. Every "Book a call" button goes straight to your existing Kartra booking page, and every form can feed Kartra or your CRM, so follow-up happens on its own.

None of this replaces your voice; it's built from it, and it can sit on your current domain.

Would you be open to a 15-minute call this week? I'd love to walk you through it and hear what you'd change.

Best,
Rick
Code Bunny

---

### Before sending, confirm with Daniel (or adjust on the site)

- **Preview link:** the email links to https://iamdanieldiaz.codebunny.net. Open it once before sending to confirm GitHub Pages is serving it.
- **Title:** the site calls Daniel "Co-founder, Peak Life Now" (signature in the Meet section of `_src/pages/index.html`). His current site says "Founder and CEO". Pick one.
- **IGNITION dates:** Cohort 01 began June 2026, so the site shows "Cohort 02 · Waitlist open". Change `nextCohort` in `assets/js/config.js` once dates are set.
- **Testimonials:** we used the five from his main site plus the four IGNITION testimonials that name a company or role (Brett Selestay, Josh Goodman, Jacob Cox, Jordan Watts). The IGNITION page lists six more (Mark Henderson, Chris Navarro, Jason Miller, Eric Thompson, Robert Garcia, David Walker) with generic titles. We left those out until Daniel confirms they're real clients. Labels such as "1:1 coaching client" are ours; swap in real titles if he has them.
- **Email:** the site uses daniel@iamdanieldiaz.com (from his signature). His contact page lists Danieldiazlifecoach@gmail.com. Change `email` in `assets/js/config.js` if needed.
- **Keynote framing:** "Three forces, one circle" (peak performance, self-love and a champion's mindset around a core of energy) is drawn from his bio and his Yahoo Finance quote. Check that it matches the talk.
- **Program details:** inclusions are written from his own program copy. No prices are shown; the FAQ says the investment is shared on the discovery call.
- **Forms:** until `formEndpoint` is set in `assets/js/config.js`, every form opens a pre-filled email to Daniel. Booking buttons already open his Kartra page.
- **LinkedIn:** LinkedIn blocks automated reading, so nothing was taken from his profile. Content came from iamdanieldiaz.com, the IGNITION page and the Yahoo Finance article. If there's something on LinkedIn worth adding (certifications, recent roles), it slots in easily.
