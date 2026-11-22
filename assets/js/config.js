/* ==========================================================================
   Site configuration — the only file Daniel (or we) need to touch to connect
   the automations. Leave a value empty and the site falls back gracefully.
   ========================================================================== */
window.SITE_CONFIG = {
  name: "Daniel Diaz · Peak Life Now",
  email: "daniel@iamdanieldiaz.com",
  instagram: "https://www.instagram.com/itsdannydiaz/",

  /* Discovery call booking link. Every "Book a call" button opens it.
     Currently Daniel's existing Kartra booking page. Swap for Calendly,
     TidyCal, etc. any time. Empty = buttons go to the Apply page. */
  bookingUrl: "https://danieldiaz.kartra.com/page/bookyourcallnow",

  /* Form endpoint that accepts a JSON POST (Formspree, Make.com / Zapier
     webhook, Kartra/GoHighLevel webhook, Basin …). Every form on the site
     (application, scorecard results, speaking enquiry, IGNITION waitlist,
     Morning Mastery opt-in) posts here with a "form" field naming the source,
     so one automation can route each one: CRM tag, auto-reply, reminder.
     Empty = the visitor's email app opens pre-filled to Daniel instead. */
  formEndpoint: "",

  /* Shown to visitors after they enquire. */
  replyPromise: "within one business day",

  /* IGNITION: the cohort people are joining the waitlist for. */
  nextCohort: "Cohort 02"
};
