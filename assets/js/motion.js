/* ==========================================================================
   Anne Rose — motion layer (GSAP + ScrollTrigger)
   Page-scoped: ARMotion.init(root, mode) builds a page's animations and
   ARMotion.destroy() tears them down, so pages can be swapped in place.
   ========================================================================== */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- Word splitting (keeps <em>, <br>, <strong>) ---------- */
  function splitWords(el) {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = "1";
    var out = document.createDocumentFragment();
    function wrapWord(text, wrapperTag, wrapperClass) {
      var mask = document.createElement("span");
      mask.className = "split-line";
      mask.style.display = "inline-block";
      mask.style.verticalAlign = "top";
      var inner = document.createElement("span");
      if (wrapperTag) {
        var w = document.createElement(wrapperTag);
        if (wrapperClass) w.className = wrapperClass;
        w.textContent = text;
        inner.appendChild(w);
      } else inner.textContent = text;
      mask.appendChild(inner);
      return mask;
    }
    function walk(node, target, wrapperTag, wrapperClass) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          child.textContent.split(/(\s+)/).forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) target.appendChild(document.createTextNode(" "));
            else target.appendChild(wrapWord(p, wrapperTag, wrapperClass));
          });
        } else if (child.nodeType === 1) {
          if (child.tagName === "BR") { target.appendChild(child.cloneNode()); return; }
          if (child.classList && child.classList.contains("row")) {
            var row = child.cloneNode(false);
            walk(child, row, wrapperTag, wrapperClass);
            target.appendChild(row);
            return;
          }
          walk(child, target, child.tagName.toLowerCase(), child.className);
        }
      });
    }
    walk(el, out, null, null);
    el.innerHTML = "";
    el.appendChild(out);
  }

  /* ---------- Statement words (scrubbed opacity) ---------- */
  function splitStatement(el) {
    if (el.dataset.wordsDone) return;
    el.dataset.wordsDone = "1";
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) frag.appendChild(document.createTextNode(p));
            else { var s = document.createElement("span"); s.className = "w"; s.textContent = p; frag.appendChild(s); }
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== "BR") walk(child);
      });
    })(el);
  }

  /* ---------- Static fallback (no GSAP / reduced motion) ---------- */
  if (!window.gsap || !window.ScrollTrigger || reduced) {
    window.ARMotion = {
      init: function (root) {
        root = root || document;
        $$("[data-reveal]", root).forEach(function (el) { el.classList.add("is-in"); });
        $$("[data-clip]", root).forEach(function (el) { el.style.clipPath = "none"; });
        $$(".statement__text .w", root).forEach(function (w) { w.style.opacity = 1; });
      },
      destroy: function () {}
    };
    window.ARMotion.init(document.querySelector("main"));
    return;
  }

  var gsap = window.gsap;
  var ST = window.ScrollTrigger;
  gsap.registerPlugin(ST);
  /* iOS shows/hides its address bar while scrolling, which fires resize;
     don't recalculate every trigger mid-scroll (prevents jumps/jitter). */
  ST.config({ ignoreMobileResize: true });

  /* Lenis <-> ScrollTrigger (once) */
  if (window.lenis) {
    window.lenis.on("scroll", ST.update);
    gsap.ticker.add(function (t) { window.lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  var SWASHES = [
    "M2 14 C 40 4, 90 2, 140 8 S 230 16, 298 6",
    "M2 10 C 60 18, 120 2, 180 10 S 260 14, 298 4",
    "M4 12 Q 80 2 150 10 T 296 8"
  ];
  var swashItems = [];
  function placeSwashes() {
    swashItems.forEach(function (it) {
      if (!it.h.isConnected) return;
      var boxes = $$("em", it.h).map(function (em) {
        var m = em.closest(".split-line") || em, b = m.getBoundingClientRect();
        if (m === em) return b;
        var cs = getComputedStyle(m), fs = parseFloat(cs.fontSize) || 16;
        var dl = parseFloat(cs.paddingLeft) - 0.1 * fs, dr = parseFloat(cs.paddingRight) - 0.14 * fs;
        var dt = parseFloat(cs.paddingTop) - 0.06 * fs, db = parseFloat(cs.paddingBottom) - 0.3 * fs;
        return { left: b.left + dl, right: b.right - dr, top: b.top + dt, bottom: b.bottom - db };
      });
      if (!boxes.length) return;
      var maxTop = Math.max.apply(null, boxes.map(function (b) { return Math.round(b.top); }));
      var last = boxes.filter(function (b) { return Math.abs(Math.round(b.top) - maxTop) < 6; });
      var left = Math.min.apply(null, last.map(function (b) { return b.left; }));
      var right = Math.max.apply(null, last.map(function (b) { return b.right; }));
      var bottom = Math.max.apply(null, last.map(function (b) { return b.bottom; }));
      var hr = it.h.getBoundingClientRect();
      var hgt = Math.max(10, (bottom - maxTop) * 0.22);
      it.svg.style.left = (left - hr.left) + "px";
      it.svg.style.width = (right - left) + "px";
      it.svg.style.top = (bottom - hr.top - hgt * 0.9) + "px";
      it.svg.style.height = hgt + "px";
      it.svg.style.bottom = "auto";
    });
  }
  window.addEventListener("resize", placeSwashes);

  var ctx = null, mm = null;

  function init(root, mode) {
    root = root || document.querySelector("main") || document;
    destroy();
    swashItems = [];
    mm = gsap.matchMedia();
    ctx = gsap.context(function () {

      $$("[data-split]", root).forEach(splitWords);

      function animateSplit(el) {
        var words = $$(".split-line > span", el);
        return gsap.fromTo(words, { yPercent: 118 }, {
          yPercent: 0, duration: 1.5, ease: "expo.out", stagger: 0.05,
          onComplete: function () { $$(".split-line", el).forEach(function (l) { l.classList.add("is-done"); }); }
        });
      }

      /* ---------- Hero intro ---------- */
      var giant = root.querySelector("[data-giant]");
      var giantLetters = [];
      if (giant) {
        if (!giant.dataset.lettersDone) {
          var txt = giant.textContent; giant.textContent = ""; giant.dataset.lettersDone = "1";
          txt.split("").forEach(function (ch) { var sp = document.createElement("span"); sp.textContent = ch; sp.style.display = "inline-block"; giant.appendChild(sp); });
        }
        giantLetters = $$("span", giant);
      }
      var hv = root.querySelector("[data-hv]");
      var pops = $$("[data-pop]", root);
      if (giantLetters.length) gsap.set(giantLetters, { yPercent: 60, autoAlpha: 0, rotate: 8 });
      if (pops.length) gsap.set(pops, { autoAlpha: 0, y: 40, scale: .94 });
      if (hv) gsap.set(hv, { scale: .965 });

      var heroSplits = $$(".hv [data-split], .page-hero [data-split], .notfound [data-split]", root);
      var heroBits = $$("[data-hero]", root);
      var heroWords = [];
      heroSplits.forEach(function (el) { heroWords = heroWords.concat($$(".split-line > span", el)); });
      if (heroWords.length) gsap.set(heroWords, { yPercent: 118 });
      if (heroBits.length) gsap.set(heroBits, { autoAlpha: 0, y: 30 });
      var heroRise = root.querySelector("[data-hero-rise]");
      if (heroRise) gsap.set(heroRise, { yPercent: 18, autoAlpha: 0 });

      function playHero() {
        var tl = gsap.timeline({ defaults: { ease: "expo.out" } });
        if (hv) tl.to(hv, { scale: 1, duration: 1.6, ease: "expo.out", clearProps: "transform" }, 0);
        if (giantLetters.length) tl.to(giantLetters, { yPercent: 0, autoAlpha: 1, rotate: 0, duration: 1.6, stagger: 0.05 }, 0.15);
        if (heroRise) tl.to(heroRise, { yPercent: 0, autoAlpha: 1, duration: 1.8 }, 0.45);
        if (pops.length) tl.to(pops, { autoAlpha: 1, y: 0, scale: 1, duration: 1.2, stagger: 0.09 }, 0.8);
        heroSplits.forEach(function (el, i) {
          tl.to($$(".split-line > span", el), { yPercent: 0, duration: 1.6, stagger: 0.07, onComplete: function () { $$(".split-line", el).forEach(function (l) { l.classList.add("is-done"); }); } }, 0.2 + i * 0.12);
        });
        if (heroBits.length) tl.to(heroBits, { autoAlpha: 1, y: 0, duration: 1.4, stagger: 0.1 }, 0.8);
      }
      if (mode === "preloader") document.addEventListener("site:loaded", playHero, { once: true });
      else if (mode === "enter") gsap.delayedCall(0.6, playHero);
      else playHero();

      /* Other split headings reveal on scroll */
      $$("[data-split]", root).forEach(function (el) {
        if (heroSplits.indexOf(el) > -1) return;
        gsap.set($$(".split-line > span", el), { yPercent: 118 });
        ST.create({ trigger: el, start: "top 96%", once: true, onEnter: function () { animateSplit(el); } });
      });

      /* Generic reveals */
      var reveals = $$("[data-reveal]", root);
      if (reveals.length) ST.batch(reveals, {
        start: "top 99%", once: true,
        onEnter: function (batch) {
          batch.forEach(function (el, i) {
            var d = parseFloat(el.getAttribute("data-delay") || 0);
            setTimeout(function () { el.classList.add("is-in"); }, (d * 0.5 + i * 0.05) * 1000);
          });
        }
      });

      /* Image clip reveals */
      $$("[data-clip]", root).forEach(function (el) {
        var img = el.querySelector("img");
        gsap.fromTo(el, { clipPath: "inset(100% 0% 0% 0%)" }, {
          clipPath: "inset(0% 0% 0% 0%)", duration: 1.8, ease: "expo.inOut",
          scrollTrigger: { trigger: el, start: "top 86%", once: true },
          onComplete: function () { el.style.clipPath = "none"; }
        });
        if (img) gsap.fromTo(img, { scale: 1.25 }, { scale: 1, duration: 2.4, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 86%", once: true } });
      });

      $$("[data-rule]", root).forEach(function (el) {
        gsap.to(el, { scaleX: 1, duration: 1.6, ease: "expo.inOut", scrollTrigger: { trigger: el, start: "top 92%", once: true } });
      });

      /* Hero depth on scroll (desktop) */
      if (hv) mm.add("(min-width: 1025px)", function () {
        var o = { trigger: hv, start: "top top", end: "bottom top", scrub: true };
        if (giant) gsap.to(giant, { xPercent: -14, ease: "none", scrollTrigger: o });
        /* Scroll depth uses a different transform channel than each element's intro
           (Daniel: intro yPercent, depth y; proof tile: intro y, depth yPercent), so the
           first scroll can't snap them back to their pre-intro offsets. */
        if (heroRise) gsap.fromTo(heroRise, { y: 0, scale: 1 }, { y: function () { return heroRise.offsetHeight * 0.08; }, scale: 1.04, ease: "none", scrollTrigger: Object.assign({ invalidateOnRefresh: true }, o) });
        gsap.to($$(".hv__left", root), { y: -60, ease: "none", scrollTrigger: Object.assign({}, o) });
        gsap.to($$(".hv__right", root), { y: -110, ease: "none", scrollTrigger: Object.assign({}, o) });
        /* "now." and the top row travel with the tiles, so nothing slides over them on the way out */
        var postEl = root.querySelector(".hv__post");
        if (postEl) gsap.fromTo(postEl, { y: 0 }, { y: -110, ease: "none", scrollTrigger: Object.assign({}, o) });
        var topRow = root.querySelector(".hv__top");
        if (topRow) gsap.fromTo(topRow, { yPercent: 0 }, { yPercent: function () { return -110 / Math.max(1, topRow.offsetHeight) * 100; }, ease: "none", scrollTrigger: Object.assign({ invalidateOnRefresh: true }, o) });
        var proofTile = root.querySelector(".hv__proof");
        if (proofTile) gsap.fromTo(proofTile, { yPercent: 0 }, { yPercent: function () { return -110 / Math.max(1, proofTile.offsetHeight) * 100; }, ease: "none", scrollTrigger: Object.assign({ invalidateOnRefresh: true }, o) });
      });

      /* Hand-drawn underlines */
      $$(".sec-head .h2, .stack-sec__intro .h2, .wall__intro .h2, .page-hero .h1, .cta-final .h-mega, .dims__copy .h2, .compass__intro .h2", root).forEach(function (h, i) {
        if (!h.querySelector("em")) return;
        var svg = h.querySelector(".swash");
        if (!svg) {
          if (getComputedStyle(h).position === "static") h.style.position = "relative";
          svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.setAttribute("class", "swash"); svg.setAttribute("viewBox", "0 0 300 20"); svg.setAttribute("preserveAspectRatio", "none"); svg.setAttribute("aria-hidden", "true");
          var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
          p.setAttribute("d", SWASHES[i % SWASHES.length]); p.setAttribute("pathLength", "1");
          p.style.strokeDasharray = "1"; p.style.strokeDashoffset = "1";
          svg.appendChild(p); h.appendChild(svg);
        }
        swashItems.push({ h: h, svg: svg });
        gsap.to(svg.querySelector("path"), { strokeDashoffset: 0, duration: 1.4, ease: "power2.inOut", delay: 0.7, scrollTrigger: { trigger: h, start: "top 85%", once: true } });
      });
      placeSwashes();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeSwashes);

      /* Line-art roses (inside page content) */
      $$("[data-draw]", root).forEach(function (svg) {
        gsap.to($$("path", svg), { strokeDashoffset: 0, duration: 2.6, ease: "power2.inOut", stagger: 0.12, scrollTrigger: { trigger: svg, start: "top 92%", once: true } });
      });

      /* Stacking cards recede (desktop pointer only) */
      var stackCards = $$(".stack-card", root);
      if (stackCards.length) mm.add("(min-width: 1025px) and (hover: hover) and (pointer: fine)", function () {
        stackCards.forEach(function (card, i) {
          var next = stackCards[i + 1];
          if (!next) return;
          gsap.fromTo(card, { scale: 1 }, { scale: 0.94, ease: "none", scrollTrigger: { trigger: next, start: "top 85%", end: "top 30%", scrub: true } });
        });
      });

      /* Progress ring */
      $$("[data-ring]", root).forEach(function (ring) {
        var fg = ring.querySelector(".ring__fg");
        var pct = parseFloat(ring.getAttribute("data-ring")) / 100;
        gsap.fromTo(fg, { strokeDashoffset: 289 }, { strokeDashoffset: 289 * (1 - pct), duration: 2.4, ease: "power3.out", scrollTrigger: { trigger: ring, start: "top 85%", once: true } });
      });

      $$(".sec-head .label, .statement__label .label", root).forEach(function (el) {
        gsap.fromTo(el, { autoAlpha: 0, x: -24 }, { autoAlpha: 1, x: 0, duration: 1.3, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } });
      });

      /* 3D tilt */
      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        $$("[data-tilt]", root).forEach(function (el) {
          el.style.transformStyle = "preserve-3d";
          el.addEventListener("mousemove", function (e) {
            var r = el.getBoundingClientRect();
            var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
            gsap.to(el, { rotateY: x * 6, rotateX: -y * 6, y: -6, transformPerspective: 1000, duration: 0.6, ease: "power3.out" });
          });
          el.addEventListener("mouseleave", function () { gsap.to(el, { rotateY: 0, rotateX: 0, y: 0, duration: 0.9, ease: "expo.out" }); });
        });
      }

      $$(".svc", root).forEach(function (row, i) {
        gsap.fromTo(row, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 1.3, ease: "expo.out", delay: i * 0.06, scrollTrigger: { trigger: row, start: "top 92%", once: true } });
      });

      $$("[data-speed]", root).forEach(function (el) {
        var speed = parseFloat(el.getAttribute("data-speed"));
        gsap.fromTo(el, { yPercent: -speed * 10 }, { yPercent: speed * 10, ease: "none", scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
      });

      $$("[data-words]", root).forEach(function (el) {
        splitStatement(el);
        gsap.to($$(".w", el), { opacity: 1, ease: "none", stagger: 0.1, scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 45%", scrub: 0.6 } });
      });

      $$("[data-count]", root).forEach(function (el) {
        var end = parseFloat(el.getAttribute("data-count"));
        var obj = { v: 0 };
        el.textContent = "0";
        ST.create({ trigger: el, start: "top 90%", once: true, onEnter: function () {
          gsap.to(obj, { v: end, duration: 2.2, ease: "power3.out", onUpdate: function () { el.textContent = Math.round(obj.v); } });
        } });
      });

      /* Method: pinned horizontal scroll (tablet landscape + desktop) */
      var method = root.querySelector("[data-method]");
      if (method) mm.add("(min-width: 761px)", function () {
        var pin = method.querySelector(".method__pin");
        var track = method.querySelector(".method__track");
        var bar = method.querySelector(".method__progress i");
        var distance = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
        gsap.to(track, {
          x: function () { return -distance(); }, ease: "none",
          scrollTrigger: {
            trigger: pin, start: "top top", end: function () { return "+=" + distance(); },
            pin: true, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1,
            onUpdate: function (self) { if (bar) bar.style.transform = "scaleX(" + self.progress + ")"; }
          }
        });
      });

      $$(".timeline", root).forEach(function (tl) {
        var fill = tl.querySelector(".timeline__fill");
        if (fill) gsap.to(fill, { scaleY: 1, ease: "none", scrollTrigger: { trigger: tl, start: "top 70%", end: "bottom 60%", scrub: true } });
      });

      $$("[data-stagger]", root).forEach(function (group) {
        gsap.fromTo(Array.prototype.slice.call(group.children), { y: 70, autoAlpha: 0 }, {
          y: 0, autoAlpha: 1, duration: 1.2, ease: "expo.out", stagger: 0.1,
          scrollTrigger: { trigger: group, start: "top 95%", once: true }
        });
      });

      /* ---------- Peak Life Now: animate every text block that isn't animated yet ---------- */
      var STILL = "[data-reveal], [data-split], [data-hero], [data-pop], [data-words], [data-no-anim], .hv, .page-hero, .notfound, .marquee, .compass__panel, .form, .sc, .faq__a, .wall__cols, .quotes__stage, .stack, .ticker, .split__float, .sec-head .label, .statement__label, .dims__visual, .method__track";
      var staggerHost = function (el) {
        for (var p = el.parentElement; p && p !== root; p = p.parentElement) if (p.parentElement && p.parentElement.hasAttribute("data-stagger")) return p;
        return null;
      };
      var noTransition = function (els, on) { els.forEach(function (e) { e.style.transition = on ? "none" : ""; }); };

      /* Headings without a reveal rise word by word, like the big ones */
      $$("h3, h4, .h3, .h4", root).forEach(function (h) {
        if (h.closest(STILL) || h.closest("[data-split]") || !h.textContent.trim()) return;
        if (h.matches(".compass__result-title, .form__title, .res__profile, .curtain__title")) return;
        splitWords(h);
        var words = $$(".split-line > span", h);
        if (!words.length) return;
        gsap.set(words, { yPercent: 118 });
        var host = staggerHost(h);
        ST.create({ trigger: h, start: "top 95%", once: true, onEnter: function () {
          gsap.to(words, { yPercent: 0, duration: 1.15, ease: "expo.out", stagger: 0.04, delay: host ? 0.28 : 0,
            onComplete: function () { $$(".split-line", h).forEach(function (l) { l.classList.add("is-done"); }); } });
        } });
      });

      /* Copy, lists, chips, numbers and buttons cascade in (inside cards: after the card lands) */
      var BLOCK = "p, li, blockquote, figcaption, dl, .label, .chips, .btn-row, .big-num, .stat, .program__price, .index-num, .card__num, .card__tag, .card__icon, .tile__top, .step__tags, .format__list, .topic, .book__pillars, .note-strip > div, .lead-item, .story, .avatars, .ring, .stars, .filters, .link-arrow, .press-marks, .g-bars, .g-canyon, .yl";
      var cands = $$(BLOCK, root).filter(function (el) {
        if (el.closest(STILL)) return false;
        if (el.closest("h1, h2, h3, h4, .h3, .h4, .split-line")) return false;
        if (el.parentElement && el.parentElement.hasAttribute("data-stagger")) return false;
        return el.offsetParent !== null;
      });
      var chosen = new Set(cands);
      cands = cands.filter(function (el) { for (var q = el.parentElement; q && q !== root; q = q.parentElement) if (chosen.has(q)) return false; return true; });
      var hosts = new Map(), free = [];
      cands.forEach(function (el) { var hst = staggerHost(el); if (hst) { if (!hosts.has(hst)) hosts.set(hst, []); hosts.get(hst).push(el); } else free.push(el); });
      hosts.forEach(function (els, hst) {
        gsap.set(els, { opacity: 0, y: 18 });
        ST.create({ trigger: hst, start: "top 94%", once: true, onEnter: function () {
          noTransition(els, true);
          gsap.to(els, { opacity: 1, y: 0, duration: 0.95, ease: "expo.out", stagger: 0.07, delay: 0.32, overwrite: "auto",
            onComplete: function () { noTransition(els, false); gsap.set(els, { clearProps: "transform" }); } });
        } });
      });
      if (free.length) {
        gsap.set(free, { opacity: 0, y: 28 });
        ST.batch(free, { start: "top 94%", once: true, onEnter: function (batch) {
          noTransition(batch, true);
          gsap.to(batch, { opacity: 1, y: 0, duration: 1.05, ease: "expo.out", stagger: 0.08, overwrite: "auto",
            onComplete: function () { noTransition(batch, false); gsap.set(batch, { clearProps: "transform" }); } });
        } });
      }

      /* Graphics: bars rise, routes draw, the years line fills */
      $$("[data-bars]", root).forEach(function (svg) {
        gsap.fromTo($$(".g-bar", svg), { scaleY: 0, transformOrigin: "50% 100%" }, { scaleY: 1, duration: 1.3, ease: "expo.out", stagger: 0.14, delay: 0.4, scrollTrigger: { trigger: svg, start: "top 92%", once: true } });
      });
      $$("[data-line]", root).forEach(function (svg) {
        var st = { trigger: svg, start: "top 92%", once: true };
        gsap.fromTo($$(".g-line:not(.g-line--ghost)", svg), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 2.2, ease: "power2.inOut", delay: 0.4, scrollTrigger: st });
        gsap.fromTo($$(".g-dot", svg), { scale: 0, transformOrigin: "50% 50%" }, { scale: 1, duration: 0.7, ease: "back.out(2.2)", stagger: 1.8, delay: 0.35, scrollTrigger: Object.assign({}, st) });
      });
      $$("[data-scrubline]", root).forEach(function (svg) {
        gsap.fromTo($$(".g-line", svg), { strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: "none", stagger: 0.08,
          scrollTrigger: { trigger: svg, start: "top 92%", end: "bottom 40%", scrub: 0.7 } });
      });
      $$("[data-yl]", root).forEach(function (yl) {
        var st = { trigger: yl, start: "top 92%", once: true };
        gsap.fromTo(yl.querySelector(".yl__fill"), { scaleX: 0 }, { scaleX: 1, duration: 2.2, ease: "power2.inOut", delay: 0.3, scrollTrigger: st });
        gsap.fromTo($$(".yl__pts li", yl), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.9, ease: "expo.out", stagger: 0.42, delay: 0.45, scrollTrigger: Object.assign({}, st) });
      });
    }, root);

    ST.refresh();
  }

  function destroy() {
    if (mm) { mm.revert(); mm = null; }
    if (ctx) { ctx.revert(); ctx = null; }
  }

  /* ---------- Global, once: footer + rose art outside page content ---------- */
  var footBits = $$(".footer__optin, .footer__brand > *, .footer__col, .footer__bar > *");
  if (footBits.length) {
    gsap.set(footBits, { opacity: 0, y: 26 });
    ST.batch(footBits, { start: "top 97%", once: true, onEnter: function (batch) { gsap.to(batch, { opacity: 1, y: 0, duration: 1.05, ease: "expo.out", stagger: 0.08, overwrite: "auto" }); } });
  }
  /* Footer wordmark: letters rise from behind the line once the footer is in view,
     "Now" catches a sweep of light, and on desktop a wave of letters follows the cursor. */
  var word = document.querySelector(".footer__word");
  if (word) {
    if (!word.getAttribute("data-letters")) {
      word.setAttribute("data-letters", "1");
      var em = word.querySelector("em");
      Array.prototype.slice.call(word.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split("").forEach(function (ch) {
            if (/\s/.test(ch)) { frag.appendChild(document.createTextNode(ch)); return; }
            var s = document.createElement("span"); s.className = "fw-l"; s.textContent = ch; frag.appendChild(s);
          });
          word.replaceChild(frag, n);
        }
      });
      if (em) { var nw = document.createElement("span"); nw.className = "fw-l fw-now"; nw.textContent = em.textContent; em.textContent = ""; em.appendChild(nw); }
    }
    word.classList.add("is-split");
    var wl = Array.prototype.slice.call(word.querySelectorAll(".fw-l"));
    gsap.set(wl, { yPercent: 112, rotate: 7 });
    ST.create({ trigger: word, start: "top bottom-=40", once: true, onEnter: function () {
      gsap.to(wl, { yPercent: 0, rotate: 0, duration: 1.35, ease: "expo.out", stagger: 0.05, overwrite: "auto",
        onComplete: function () { word.classList.add("is-risen", "is-shining"); } });
    } });
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      var lift = wl.map(function (l) { return gsap.quickTo(l, "y", { duration: 0.6, ease: "power3" }); });
      word.addEventListener("mousemove", function (e) {
        wl.forEach(function (l, i) {
          var r = l.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2);
          var f = Math.max(0, 1 - Math.abs(dx) / 240);
          lift[i](-f * f * 34);
        });
      });
      word.addEventListener("mouseleave", function () { lift.forEach(function (q) { q(0); }); });
    }
  }

  window.ARMotion = { init: init, destroy: destroy, refresh: function () { ST.refresh(); placeSwashes(); } };

  var html = document.documentElement;
  var firstMode = (document.querySelector(".preloader") && !html.classList.contains("no-preloader")) ? "preloader"
    : html.classList.contains("pt-enter") ? "enter" : "now";
  init(document.querySelector("main"), firstMode);

  window.addEventListener("load", function () { ST.refresh(); placeSwashes(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(); placeSwashes(); });
})();
