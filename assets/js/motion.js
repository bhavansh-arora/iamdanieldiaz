/* ==========================================================================
   Daniel Diaz · Peak Life Now — motion (GSAP + ScrollTrigger)
   PLMotion.init(root, mode) builds every animation inside <main>;
   PLMotion.destroy() tears them down before an in-place page swap.
   Respects prefers-reduced-motion: content is simply shown.
   ========================================================================== */
(function () {
  "use strict";
  var doc = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var gsap = window.gsap, ST = window.ScrollTrigger;

  if (!gsap || !ST || reduced) {
    doc.classList.add("no-motion");
    window.PLMotion = { init: function () {}, destroy: function () {} };
    return;
  }
  gsap.registerPlugin(ST);
  doc.classList.add("motion-ready");

  var lenis = window.lenis;
  if (lenis) {
    lenis.on("scroll", ST.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var EASE = "expo.out";
  var ctx = null, mm = null;

  /* Split an element's text into words, keeping inline elements (em, b, br). */
  function splitWords(el, wrapClass) {
    if (el.getAttribute("data-split-done")) return $$("." + wrapClass + " > span", el);
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var parts = n.textContent.split(/(\s+)/);
          var frag = document.createDocumentFragment();
          parts.forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(" ")); return; }
            var w = document.createElement("span"); w.className = wrapClass;
            var inner = document.createElement("span"); inner.textContent = p;
            w.appendChild(inner); frag.appendChild(w);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== "BR" && !n.classList.contains(wrapClass)) walk(n);
      });
    };
    walk(el);
    el.setAttribute("data-split-done", "1");
    return $$("." + wrapClass + " > span", el);
  }

  function build(root) {
    ctx = gsap.context(function () {

      /* Headline word rise */
      $$("[data-split]", root).forEach(function (el) {
        var words = splitWords(el, "sw");
        gsap.set(words, { yPercent: 115 });
        gsap.set(el, { visibility: "visible" });
        gsap.to(words, {
          yPercent: 0, duration: 1.25, ease: EASE, stagger: 0.05,
          scrollTrigger: { trigger: el, start: "top 90%", once: true }
        });
      });

      /* Reveal blocks (batched for stagger) */
      var rev = $$("[data-reveal]", root);
      rev.forEach(function (el) {
        var t = el.getAttribute("data-reveal");
        gsap.set(el, t === "scale" ? { opacity: 0, scale: 0.94, y: 0 } : t === "fade" ? { opacity: 0, y: 0 } : { opacity: 0, y: 40 });
      });
      ST.batch(rev, {
        start: "top 92%", once: true,
        onEnter: function (batch) { gsap.to(batch, { opacity: 1, y: 0, scale: 1, duration: 1.2, ease: EASE, stagger: 0.09, overwrite: true }); }
      });

      /* Parallax images */
      $$("[data-parallax]", root).forEach(function (el) {
        var img = el.tagName === "IMG" ? el : $("img", el);
        if (!img) return;
        var s = parseFloat(el.getAttribute("data-parallax")) || 0.12;
        gsap.set(img, { scale: 1 + s * 1.4 });
        gsap.fromTo(img, { yPercent: -s * 50 }, { yPercent: s * 50, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
      });

      /* Counters */
      $$("[data-count]", root).forEach(function (el) {
        var end = parseFloat(el.getAttribute("data-count")), dec = +(el.getAttribute("data-decimals") || 0);
        var o = { v: 0 };
        el.textContent = (0).toFixed(dec);
        gsap.to(o, { v: end, duration: 2.2, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%", once: true },
          onUpdate: function () { el.textContent = o.v.toFixed(dec); } });
      });

      /* Statement word scrub */
      $$("[data-scrub]", root).forEach(function (el) {
        var words = splitWords(el, "wsc").map(function (s) { return s.parentNode; });
        words.forEach(function (w) { w.classList.add("w"); });
        gsap.to(words, { opacity: 1, ease: "none", stagger: 0.1, scrollTrigger: { trigger: el, start: "top 82%", end: "bottom 50%", scrub: 0.6 } });
      });

      /* Home hero */
      var hero = $(".hero", root);
      if (hero) {
        var img = $(".hero__media img", hero);
        gsap.fromTo(img, { scale: 1.14 }, { scale: 1, duration: 2.6, ease: "power3.out" });
        gsap.from([$(".hero__glow", hero), $(".hero__rays", hero)], { opacity: 0, duration: 2.4, ease: "power2.out", delay: 0.4 });
        gsap.from($$(".hero__top .kicker, .hero__bottom > *, .hero__card, .hero__scroll, .hero__side", hero), { opacity: 0, y: 26, duration: 1.2, ease: EASE, stagger: 0.08, delay: 0.55 });
        gsap.to($(".hero__media", hero), { yPercent: 14, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
        gsap.to($(".hero__inner", hero), { opacity: 0.15, y: -60, ease: "none", scrollTrigger: { trigger: hero, start: "35% top", end: "bottom top", scrub: true } });
      }

      /* Inner page hero */
      var ph = $(".phero", root);
      if (ph) {
        var pimg = $(".phero__media img, .phero__card img", ph);
        if (pimg) gsap.fromTo(pimg, { scale: 1.12 }, { scale: 1, duration: 2.4, ease: "power3.out" });
        gsap.from($$(".phero__content > :not([data-split]), .phero__bottom, .phero__card", ph), { opacity: 0, y: 26, duration: 1.2, ease: EASE, stagger: 0.08, delay: 0.35 });
        var pm = $(".phero__media", ph);
        if (pm) gsap.to(pm, { yPercent: 12, ease: "none", scrollTrigger: { trigger: ph, start: "top top", end: "bottom top", scrub: true } });
      }

      /* Gap chart draw */
      $$("[data-gapviz]", root).forEach(function (el) {
        var rect = $("#gapreveal rect", el);
        if (!rect) return;
        gsap.set(rect, { attr: { width: 0 } });
        var tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 78%", once: true } });
        tl.to(rect, { attr: { width: 600 }, duration: 2.4, ease: "power2.inOut" })
          .from($$(".gap-callout", el), { opacity: 0, y: 10, duration: 0.8, ease: EASE, stagger: 0.12 }, "-=0.7");
      });

      /* Phase bars */
      $$(".phases", root).forEach(function (wrap) {
        gsap.from($$(".phase__bar i", wrap), { scaleX: 0, duration: 1.4, ease: "power3.inOut", stagger: 0.25, scrollTrigger: { trigger: wrap, start: "top 80%", once: true } });
      });

      /* Desktop-only: stacked program cards + horizontal timeline */
      mm = gsap.matchMedia();
      mm.add("(min-width: 901px)", function () {
        var cards = $$(".prog", root);
        cards.forEach(function (card, n) {
          var nxt = cards[n + 1];
          if (!nxt) return;
          gsap.to(card, { scale: 0.93, ease: "none", scrollTrigger: { trigger: nxt, start: "top bottom", end: "top 30%", scrub: true } });
        });
        $$("[data-hscroll]", root).forEach(function (sec) {
          var track = $(".tl__track", sec), pin = $(".tl__pin", sec), barI = $(".tl__bar i", sec);
          if (!track || !pin) return;
          var dist = function () { return Math.max(0, track.scrollWidth - pin.clientWidth); };
          gsap.to(track, { x: function () { return -dist(); }, ease: "none",
            scrollTrigger: { trigger: sec, start: "top top", end: function () { return "+=" + Math.round(dist() * 0.75); }, pin: true, scrub: true, invalidateOnRefresh: true,
              onUpdate: function (self) { if (barI) barI.style.transform = "scaleX(" + self.progress + ")"; } } });
        });
      });
    }, root);
  }

  function init(root, mode) {
    root = root || document.querySelector("main");
    if (doc.classList.contains("is-preloading")) {
      document.addEventListener("site:loaded", function once() { document.removeEventListener("site:loaded", once); build(root); ST.refresh(); });
      /* Hide headline words now so nothing flashes under the preloader */
      return;
    }
    if (mode === "enter") setTimeout(function () { build(root); ST.refresh(); }, 90);
    else build(root);
  }
  function destroy() {
    if (mm) { mm.revert(); mm = null; }
    if (ctx) { ctx.revert(); ctx = null; }
    ST.getAll().forEach(function (t) { t.kill(); });
  }

  window.PLMotion = { init: init, destroy: destroy };
  init(document.querySelector("main"), "load");

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(); });
  window.addEventListener("load", function () { ST.refresh(); });
})();
