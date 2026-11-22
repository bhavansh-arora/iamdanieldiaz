/* ==========================================================================
   Daniel Diaz · Peak Life Now — motion (GSAP + ScrollTrigger)
   PLMotion.init(root, mode) builds every animation inside <main>;
   PLMotion.destroy() tears them down before an in-place page swap.
   Respects prefers-reduced-motion: content is simply shown.
   Everything animates transform, opacity or clip-path, plays once or follows
   the scroll directly, and never pins the page beyond the About timeline.
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
  /* iOS resizes the viewport as its toolbar shows/hides; don't recalc mid-scroll */
  ST.config({ ignoreMobileResize: true });
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
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var ctx = null, mm = null;
  var tickers = [], scrambles = [], swashes = [], keepTriggers = [];

  /* ---------- Splitting ---------- */
  /* Words, keeping inline elements (em, b, br). */
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
  /* Characters, keeping nested spans (e.g. the gold "Now"). */
  function splitChars(el) {
    if (el.getAttribute("data-chars-done")) return $$(".ch", el);
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split("").forEach(function (c) {
            if (/\s/.test(c)) { frag.appendChild(document.createTextNode(c)); return; }
            var s = document.createElement("span"); s.className = "ch"; s.textContent = c; frag.appendChild(s);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) walk(n);
      });
    })(el);
    el.setAttribute("data-chars-done", "1");
    return $$(".ch", el);
  }

  /* ---------- Mono labels decode from random glyphs ---------- */
  var GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=";
  function scramble(el) {
    if (el.getAttribute("data-scrambled")) return;
    el.setAttribute("data-scrambled", "1");
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [], n;
    while ((n = walker.nextNode())) if (n.nodeValue.trim()) nodes.push({ n: n, t: n.nodeValue });
    var total = nodes.reduce(function (a, o) { return a + o.t.length; }, 0);
    if (!total) return;
    var st = { p: 0 }, frame = 0;
    var restore = function () { nodes.forEach(function (o) { o.n.nodeValue = o.t; }); };
    var tw = gsap.to(st, {
      p: 1, duration: Math.min(1.1, 0.5 + total * 0.012), ease: "none",
      onUpdate: function () {
        if (frame++ % 2) return; /* change glyphs every other frame: readable, not noisy */
        var idx = 0;
        nodes.forEach(function (o) {
          var out = "";
          for (var i = 0; i < o.t.length; i++, idx++) {
            var c = o.t.charAt(i);
            out += (/[\s·—–()\-\/&,.:'’]/.test(c) || st.p >= (idx / total) * 0.82 + 0.12) ? c : GLYPHS.charAt((Math.random() * GLYPHS.length) | 0);
          }
          o.n.nodeValue = out;
        });
      },
      onComplete: restore
    });
    scrambles.push(function () { tw.kill(); restore(); });
  }

  /* ---------- Hand-drawn swash under the italic word ---------- */
  var SWASHES = [
    "M3 13 C 46 5, 96 3, 148 8 S 236 15, 297 6",
    "M3 9 C 62 17, 122 3, 182 10 S 262 13, 297 5",
    "M4 12 Q 82 3 152 10 T 296 7"
  ];
  function placeSwash(it) {
    if (!it.h.isConnected) return;
    var boxes = $$("em .sw", it.h).map(function (b) { return b.getBoundingClientRect(); });
    if (!boxes.length) boxes = $$("em", it.h).map(function (b) { return b.getBoundingClientRect(); });
    if (!boxes.length) return;
    var maxTop = Math.max.apply(null, boxes.map(function (b) { return Math.round(b.top); }));
    var line = boxes.filter(function (b) { return Math.abs(Math.round(b.top) - maxTop) < 8; });
    var left = Math.min.apply(null, line.map(function (b) { return b.left; }));
    var right = Math.max.apply(null, line.map(function (b) { return b.right; }));
    var bottom = Math.max.apply(null, line.map(function (b) { return b.bottom; }));
    var hr = it.h.getBoundingClientRect();
    var sy = hr.height ? it.h.offsetHeight / hr.height : 1; /* undo any reveal scale */
    var hgt = Math.max(8, (bottom - maxTop) * 0.2 * sy);
    it.svg.style.left = ((left - hr.left) * sy - 4) + "px";
    it.svg.style.width = ((right - left) * sy + 8) + "px";
    it.svg.style.top = ((bottom - hr.top) * sy - hgt * 1.15) + "px";
    it.svg.style.height = hgt + "px";
  }
  function placeSwashes() { swashes.forEach(placeSwash); }
  window.addEventListener("resize", function () { requestAnimationFrame(placeSwashes); });

  function build(root) {
    ctx = gsap.context(function () {

      /* ---------- Headlines: words rise and kick upright ---------- */
      $$("[data-split]", root).forEach(function (el) {
        var words = splitWords(el, "sw");
        gsap.set(words, { yPercent: 118, rotate: 7, transformOrigin: "0% 100%" });
        gsap.set(el, { visibility: "visible" });
        gsap.to(words, {
          yPercent: 0, rotate: 0, duration: 1.3, ease: EASE, stagger: 0.055,
          delay: el.closest(".hero, .phero") ? 0.18 : 0,
          scrollTrigger: { trigger: el, start: "top 90%", once: true },
          onComplete: function () { $$(".sw", el).forEach(function (s) { s.classList.add("is-done"); }); }
        });
      });

      /* ---------- Reveal blocks (batched for stagger) ---------- */
      var rev = $$("[data-reveal]", root);
      rev.forEach(function (el) {
        var t = el.getAttribute("data-reveal");
        gsap.set(el, t === "scale" ? { opacity: 0, scale: 0.94, y: 0 } : t === "fade" ? { opacity: 0, y: 0 } : { opacity: 0, y: 40 });
      });
      ST.batch(rev, {
        start: "top 92%", once: true,
        onEnter: function (batch) { gsap.to(batch, { opacity: 1, y: 0, scale: 1, duration: 1.2, ease: EASE, stagger: 0.09, overwrite: "auto" }); }
      });

      /* ---------- Parallax images ---------- */
      $$("[data-parallax]", root).forEach(function (el) {
        var img = el.tagName === "IMG" ? el : $("img", el);
        if (!img) return;
        var s = parseFloat(el.getAttribute("data-parallax")) || 0.12;
        gsap.set(img, { scale: 1 + s * 1.4 });
        gsap.fromTo(img, { yPercent: -s * 50 }, { yPercent: s * 50, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
      });

      /* ---------- Images wipe open from below as they arrive ---------- */
      $$(".media, .prog__media, .cta-final__media", root).forEach(function (el) {
        if (el.closest(".hero, .phero") || el.classList.contains("media--wide")) return;
        var img = $("img", el), base = img ? (gsap.getProperty(img, "scale") || 1) : 1;
        if (base < 0) img = null; /* never scale a mirrored image (it would flip) */
        var tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 88%", once: true } });
        tl.fromTo(el, { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.5, ease: "expo.inOut", clearProps: "clipPath" }, 0);
        if (img) tl.fromTo(img, { scale: base * 1.3 }, { scale: base, duration: 2.2, ease: EASE, immediateRender: true }, 0.1);
      });

      /* ---------- Wide images open out to full width as you scroll ---------- */
      $$(".media--wide", root).forEach(function (el) {
        var img = $("img", el), base = img ? (gsap.getProperty(img, "scale") || 1) : 1;
        var R = getComputedStyle(el).borderTopLeftRadius || "0px";
        var side = window.innerWidth < 700 ? 5 : 11;
        var st = { trigger: el, start: "top bottom", end: "center 58%", scrub: true };
        gsap.fromTo(el, { clipPath: "inset(5% " + side + "% 5% " + side + "% round " + R + ")" }, { clipPath: "inset(0% 0% 0% 0% round " + R + ")", ease: "none", scrollTrigger: st });
        if (img) gsap.fromTo(img, { scale: base * 1.2 }, { scale: base, ease: "none", scrollTrigger: Object.assign({}, st) });
      });

      /* ---------- Section dividers draw across ---------- */
      $$(".shead__top, .phero__bottom", root).forEach(function (el) {
        gsap.fromTo(el, { "--rule": 0 }, { "--rule": 1, duration: 1.6, ease: "expo.inOut", delay: el.closest(".phero") ? 0.5 : 0, scrollTrigger: { trigger: el, start: "top 94%", once: true } });
      });

      /* ---------- Mono labels decode ---------- */
      $$(".kicker, .shead__top .mono", root).forEach(function (el) {
        if (el.querySelector("a, input, button")) return;
        ST.create({ trigger: el, start: "top 94%", once: true, onEnter: function () { gsap.delayedCall(el.closest(".hero, .phero") ? 0.35 : 0, function () { scramble(el); }); } });
      });

      /* ---------- Gold swash under the italic word of each big heading ---------- */
      $$("h1, h2", root).forEach(function (h, i) {
        if (!$("em", h) || h.matches("[data-scrub], .ignite__title, [data-noswash]") || h.closest(".bigquote, .ignite")) return;
        var svg = h.querySelector(".swash");
        if (!svg) {
          if (getComputedStyle(h).position === "static") h.style.position = "relative";
          svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.setAttribute("class", "swash"); svg.setAttribute("viewBox", "0 0 300 20");
          svg.setAttribute("preserveAspectRatio", "none"); svg.setAttribute("aria-hidden", "true");
          var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
          p.setAttribute("d", SWASHES[i % SWASHES.length]); p.setAttribute("pathLength", "1");
          p.style.strokeDasharray = "1";
          svg.appendChild(p); h.appendChild(svg);
        }
        var path = svg.querySelector("path");
        var it = { h: h, svg: svg };
        swashes.push(it);
        gsap.set(path, { strokeDashoffset: 1 });
        var hero = !!h.closest(".hero, .phero");
        ST.create({ trigger: h, start: "top 86%", once: true, onEnter: function () {
          placeSwash(it);
          gsap.to(path, { strokeDashoffset: 0, duration: 1.1, ease: "power2.inOut", delay: hero ? 1.25 : 0.8, onStart: function () { placeSwash(it); } });
        } });
      });
      placeSwashes();

      /* ---------- Counters ---------- */
      $$("[data-count]", root).forEach(function (el) {
        var end = parseFloat(el.getAttribute("data-count")), dec = +(el.getAttribute("data-decimals") || 0);
        var o = { v: 0 };
        el.textContent = (0).toFixed(dec);
        gsap.to(o, { v: end, duration: 2.2, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%", once: true },
          onUpdate: function () { el.textContent = o.v.toFixed(dec); } });
      });

      /* ---------- Statement word scrub ---------- */
      $$("[data-scrub]", root).forEach(function (el) {
        var words = splitWords(el, "wsc").map(function (s) { return s.parentNode; });
        words.forEach(function (w) { w.classList.add("w"); });
        gsap.to(words, { opacity: 1, ease: "none", stagger: 0.1, scrollTrigger: { trigger: el, start: "top 82%", end: "bottom 50%", scrub: 0.6 } });
      });

      /* ---------- Big pillar words flip up letter by letter ---------- */
      $$(".pillar__word", root).forEach(function (w) {
        var chars = splitChars(w);
        gsap.fromTo(chars, { yPercent: 55, rotationX: -85, opacity: 0, transformOrigin: "50% 100%", transformPerspective: 600 },
          { yPercent: 0, rotationX: 0, opacity: 1, duration: 1.2, ease: EASE, stagger: 0.07, scrollTrigger: { trigger: w, start: "top 90%", once: true } });
      });

      /* ---------- Home hero: frame opens, light rises, depth on scroll ---------- */
      var hero = $(".hero", root);
      if (hero) {
        var frame = $(".hero__frame", hero), img = $(".hero__media img", hero), card = $(".hero__card", hero);
        var R = getComputedStyle(frame).borderTopLeftRadius || "0px";
        var tl = gsap.timeline({ defaults: { ease: EASE } });
        tl.fromTo(frame, { clipPath: "inset(6% 5% 6% 5% round " + R + ")" }, { clipPath: "inset(0% 0% 0% 0% round " + R + ")", duration: 1.7, ease: "expo.inOut", clearProps: "clipPath" }, 0)
          .fromTo(img, { scale: 1.32 }, { scale: 1, duration: 2.8 }, 0)
          .fromTo($(".hero__rays", hero), { "--rs": 0.35, opacity: 0 }, { "--rs": 1, opacity: 1, duration: 2.8 }, 0.45)
          .from($(".hero__glow", hero), { opacity: 0, duration: 2.2, ease: "power2.out" }, 0.45)
          .from($$(".hero__top .kicker, .hero__bottom > *", hero), { opacity: 0, y: 30, duration: 1.2, stagger: 0.09 }, 0.85)
          .from($$(".hero__scroll, .hero__side", hero), { opacity: 0, duration: 1.2 }, 1.2)
          .fromTo($$("h1 em .sw > span", hero), { backgroundPosition: "100% 0%" }, { backgroundPosition: "0% 0%", duration: 1.5, ease: "power2.inOut" }, 1.55);
        if (card) {
          card.style.transition = "none"; /* its CSS transform transition would smear the intro */
          tl.from(card, { opacity: 0, x: 80, rotationY: -30, transformPerspective: 900, transformOrigin: "100% 50%", duration: 1.5, clearProps: "transform,transition" }, 1.0);
        }

        var depth = { trigger: hero, start: "top top", end: "bottom top", scrub: true };
        gsap.to($(".hero__media", hero), { yPercent: 14, ease: "none", scrollTrigger: depth });
        gsap.to(frame, { scale: 0.93, transformOrigin: "50% 0%", ease: "none", scrollTrigger: Object.assign({}, depth) });
        gsap.to($("h1", hero), { y: -70, ease: "none", scrollTrigger: Object.assign({}, depth) });
        if (card) gsap.fromTo(card, { "--cy": "0px" }, { "--cy": "-130px", ease: "none", scrollTrigger: Object.assign({}, depth) });
        gsap.to($(".hero__inner", hero), { opacity: 0.15, y: -60, ease: "none", scrollTrigger: { trigger: hero, start: "35% top", end: "bottom top", scrub: true } });
      }

      /* ---------- Inner page hero ---------- */
      var ph = $(".phero", root);
      if (ph) {
        var pf = $(".phero__frame", ph), pm = $(".phero__media", ph), pc = $(".phero__card", ph);
        var pimg = $(".phero__media img, .phero__card img", ph);
        var PR = getComputedStyle(pf).borderTopLeftRadius || "0px";
        var ptl = gsap.timeline({ defaults: { ease: EASE } });
        ptl.fromTo(pf, { clipPath: "inset(5% 4% 5% 4% round " + PR + ")" }, { clipPath: "inset(0% 0% 0% 0% round " + PR + ")", duration: 1.5, ease: "expo.inOut", clearProps: "clipPath" }, 0);
        if (pc) ptl.fromTo(pc, { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.5, ease: "expo.inOut", clearProps: "clipPath" }, 0.25);
        if (pimg) ptl.fromTo(pimg, { scale: 1.28 }, { scale: 1, duration: 2.6 }, 0);
        ptl.from($$(".phero__content > :not([data-split]), .phero__bottom > *", ph), { opacity: 0, y: 26, duration: 1.2, stagger: 0.08 }, 0.55)
          .from($$(".phero__glow", ph), { opacity: 0, duration: 2 }, 0.3);

        var pdepth = { trigger: ph, start: "top top", end: "bottom top", scrub: true };
        if (pm) gsap.to(pm, { yPercent: 12, ease: "none", scrollTrigger: pdepth });
        gsap.to(pf, { scale: 0.94, transformOrigin: "50% 0%", ease: "none", scrollTrigger: Object.assign({}, pdepth) });
        gsap.to($(".phero__content", ph), { y: -60, opacity: 0.3, ease: "none", scrollTrigger: { trigger: ph, start: "25% top", end: "bottom top", scrub: true } });
      }

      /* ---------- Gap chart draw ---------- */
      $$("[data-gapviz]", root).forEach(function (el) {
        var rect = $("#gapreveal rect", el);
        if (!rect) return;
        gsap.set(rect, { attr: { width: 0 } });
        var gtl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 78%", once: true } });
        gtl.to(rect, { attr: { width: 600 }, duration: 2.4, ease: "power2.inOut" })
          .from($$(".gap-callout", el), { opacity: 0, y: 10, duration: 0.8, ease: EASE, stagger: 0.12 }, "-=0.7");
      });

      /* ---------- Phase bars ---------- */
      $$(".phases", root).forEach(function (wrap) {
        gsap.from($$(".phase__bar i", wrap), { scaleX: 0, duration: 1.4, ease: "power3.inOut", stagger: 0.25, scrollTrigger: { trigger: wrap, start: "top 80%", once: true } });
      });

      /* ---------- Marquees react to scroll: speed up, follow direction, lean ---------- */
      var tracks = $$(".marquee__track", root);
      if (tracks.length) {
        var vel = 0, dir = 1, boost = 1;
        ST.create({ start: 0, end: "max", onUpdate: function (s) { vel = s.getVelocity(); dir = s.direction || dir; } });
        var items = tracks.map(function (t) {
          var m = t.parentNode;
          var dur = parseFloat(getComputedStyle(m).getPropertyValue("--dur")) || 38;
          var rev = m.classList.contains("marquee--rev");
          var o = { t: t, base: rev ? -1 : 1, speed: 50 / dur, x: rev ? -50 : 0, on: false, skew: gsap.quickTo(t, "skewX", { duration: 0.6, ease: "power3" }) };
          gsap.set(t, { xPercent: o.x });
          ST.create({ trigger: m, start: "top bottom", end: "bottom top", onToggle: function (s) { o.on = s.isActive; } });
          return o;
        });
        var tick = function (time, dt) {
          var target = 1 + Math.min(Math.abs(vel) / 380, 6);
          boost += (target - boost) * 0.08;
          vel *= 0.92;
          var lean = gsap.utils.clamp(-9, 9, -vel / 260);
          for (var k = 0; k < items.length; k++) {
            var o = items[k];
            if (!o.on) continue;
            o.x -= o.base * dir * o.speed * boost * Math.min(dt, 50) / 1000;
            if (o.x <= -50) o.x += 50; else if (o.x > 0) o.x -= 50;
            gsap.set(o.t, { xPercent: o.x });
            o.skew(lean);
          }
        };
        gsap.ticker.add(tick);
        tickers.push(tick);
      }

      /* ---------- Desktop-only: stacked program cards, timeline, 3D tilt ---------- */
      mm = gsap.matchMedia();
      mm.add("(min-width: 901px)", function () {
        var cards = $$(".prog", root);
        cards.forEach(function (c, n) {
          var nxt = cards[n + 1];
          if (!nxt) return;
          gsap.to(c, { scale: 0.93, ease: "none", scrollTrigger: { trigger: nxt, start: "top bottom", end: "top 30%", scrub: true } });
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
      if (finePointer) mm.add("(min-width: 1025px)", function () {
        var offs = [];
        $$(".area, .card, .belief, .way, .step, .sys, .pillar", root).forEach(function (el) {
          el.classList.add("is-tilt");
          var glare = document.createElement("i"); glare.className = "tilt-glare"; glare.setAttribute("aria-hidden", "true");
          el.appendChild(glare);
          gsap.set(el, { transformPerspective: 1100 });
          var rx = gsap.quickTo(el, "rotationX", { duration: 0.7, ease: "power3" });
          var ry = gsap.quickTo(el, "rotationY", { duration: 0.7, ease: "power3" });
          var rz = gsap.quickTo(el, "z", { duration: 0.7, ease: "power3" });
          var move = function (e) {
            var r = el.getBoundingClientRect();
            var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
            rx(-y * 7); ry(x * 8); rz(26);
            el.style.setProperty("--gx", ((x + 0.5) * 100).toFixed(1) + "%");
            el.style.setProperty("--gy", ((y + 0.5) * 100).toFixed(1) + "%");
          };
          var leave = function () { rx(0); ry(0); rz(0); };
          el.addEventListener("mousemove", move);
          el.addEventListener("mouseleave", leave);
          offs.push(function () {
            el.removeEventListener("mousemove", move); el.removeEventListener("mouseleave", leave);
            el.classList.remove("is-tilt"); if (glare.parentNode) glare.parentNode.removeChild(glare);
          });
        });
        return function () { offs.forEach(function (f) { f(); }); };
      });
    }, root);
  }

  function init(root, mode) {
    root = root || document.querySelector("main");
    if (doc.classList.contains("is-preloading")) {
      document.addEventListener("site:loaded", function once() { document.removeEventListener("site:loaded", once); build(root); ST.refresh(); });
      return;
    }
    if (mode === "enter") setTimeout(function () { build(root); ST.refresh(); }, 90);
    else build(root);
  }
  function destroy() {
    tickers.splice(0).forEach(function (t) { gsap.ticker.remove(t); });
    scrambles.splice(0).forEach(function (f) { f(); });
    swashes = [];
    if (mm) { mm.revert(); mm = null; }
    if (ctx) { ctx.revert(); ctx = null; }
    ST.getAll().forEach(function (t) { if (keepTriggers.indexOf(t) < 0) t.kill(); });
  }

  /* ---------- Footer wordmark (outside <main>, built once) ---------- */
  var mega = $(".footer__mega");
  if (mega) {
    var letters = splitChars(mega);
    gsap.set(letters, { yPercent: 70, opacity: 0, rotate: 9, transformOrigin: "0% 100%" });
    keepTriggers.push(ST.create({ trigger: mega, start: "top 99%", once: true, onEnter: function () {
      gsap.to(letters, { yPercent: 0, opacity: 1, rotate: 0, duration: 1.4, ease: EASE, stagger: 0.045 });
    } }));
  }

  window.PLMotion = { init: init, destroy: destroy };
  init(document.querySelector("main"), "load");

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(); placeSwashes(); });
  window.addEventListener("load", function () { ST.refresh(); placeSwashes(); });
})();
