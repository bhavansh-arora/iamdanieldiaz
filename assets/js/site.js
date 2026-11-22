/* ==========================================================================
   Daniel Diaz · Peak Life Now — interface behaviour
   Global (once): smooth scroll, header, menu, cursor, preloader, in-place
   page transitions, form delivery. Per page: initPage(root) wires up <main>;
   it runs on load and again after every in-place page swap.
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.SITE_CONFIG || {};
  var doc = document.documentElement;
  var body = document.body;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  var cleanups = [];
  function onCleanup(fn) { cleanups.push(fn); }
  function runCleanups() { cleanups.splice(0).forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } }); }

  /* ---------- Smooth scroll ---------- */
  var lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.12, smoothWheel: true });
    window.lenis = lenis;
    if (!window.gsap) {
      var raf = function (time) { lenis.raf(time); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  function scrollToEl(target) {
    if (lenis) lenis.scrollTo(target, { offset: -90 });
    else target.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  }
  function jumpTop() {
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
  }

  /* ---------- Toast ---------- */
  var toastEl = $(".toast"), toastT;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("is-on");
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove("is-on"); }, 4200);
  }

  /* ---------- Config-driven links ---------- */
  function wireLinks(root) {
    if (CFG.bookingUrl) {
      $$("[data-book]", root).forEach(function (el) {
        el.setAttribute("href", CFG.bookingUrl);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener");
      });
    }
    if (CFG.email) $$("[data-email]", root).forEach(function (el) { el.setAttribute("href", "mailto:" + CFG.email); });
    $$("[data-reply]", root).forEach(function (el) { el.textContent = CFG.replyPromise || "within one business day"; });
    $$("[data-cohort]", root).forEach(function (el) { el.textContent = CFG.nextCohort || "the next cohort"; });
    $$("[data-year]", root).forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }
  wireLinks(document);

  /* ---------- Form delivery ----------
     POSTs JSON to CFG.formEndpoint; without one, opens a pre-filled email. */
  function deliver(kind, subject, data) {
    var payload = Object.assign({ form: kind, page: location.pathname.split("/").pop() || "index.html", submitted_at: new Date().toISOString() }, data);
    if (CFG.formEndpoint) {
      return fetch(CFG.formEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return "sent"; });
    }
    var lines = Object.keys(data).filter(function (k) { return data[k] !== "" && data[k] != null; }).map(function (k) {
      return k.replace(/_/g, " ").replace(/^\w/, function (c) { return c.toUpperCase(); }) + ": " + (Array.isArray(data[k]) ? data[k].join(", ") : data[k]);
    });
    var href = "mailto:" + (CFG.email || "") + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(lines.join("\n"));
    window.location.href = href;
    return Promise.resolve("mailto");
  }
  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim()); }
  function formData(form) {
    var out = {};
    $$("input, select, textarea", form).forEach(function (el) {
      if (!el.name || el.disabled) return;
      if (el.type === "checkbox") {
        if (!out[el.name]) out[el.name] = [];
        if (el.checked) out[el.name].push(el.value);
      } else if (el.type === "radio") {
        if (el.checked) out[el.name] = el.value;
        else if (!(el.name in out)) out[el.name] = "";
      } else out[el.name] = el.value.trim();
    });
    return out;
  }
  function checkFields(scope) {
    var ok = true, first = null;
    $$("[required]", scope).forEach(function (el) {
      var wrap = el.closest(".field") || el.closest(".fgroup");
      var bad;
      if (el.type === "radio" || el.type === "checkbox") {
        bad = !$$('input[name="' + el.name + '"]', scope).some(function (i) { return i.checked; });
      } else bad = !el.value.trim() || (el.type === "email" && !validEmail(el.value));
      if (wrap) wrap.classList.toggle("has-error", bad);
      if (bad) { ok = false; if (!first) first = el; }
    });
    if (first && first.focus && first.type !== "radio" && first.type !== "checkbox") first.focus({ preventScroll: true });
    return ok;
  }

  /* ---------- Header ---------- */
  var header = $(".site-header");
  var bar = $(".progress i");
  var lastY = window.scrollY, ticking = false;
  function darkUnderHeader() {
    if (!header) return false;
    var r = header.getBoundingClientRect();
    var y = r.top + r.height / 2;
    var els = document.elementsFromPoint ? document.elementsFromPoint(window.innerWidth / 2, y) : [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (header.contains(el) || el.closest(".menu, .cursor, .preloader, .curtain, .toast") || el.classList.contains("progress")) continue;
      var sec = el.closest("[data-theme]");
      return sec ? sec.getAttribute("data-theme") === "dark" : false;
    }
    return false;
  }
  function onScroll() {
    var y = window.scrollY;
    if (header) {
      var down = y > lastY && y > 420;
      if (!body.classList.contains("menu-open")) header.classList.toggle("is-hidden", down);
      header.classList.toggle("on-dark", darkUnderHeader());
    }
    if (bar) {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = "scaleX(" + (h > 0 ? Math.min(1, y / h) : 0) + ")";
    }
    lastY = y;
    ticking = false;
  }
  window.addEventListener("scroll", function () { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });
  window.addEventListener("resize", function () { requestAnimationFrame(onScroll); });
  document.addEventListener("site:loaded", function () { requestAnimationFrame(onScroll); });
  onScroll();

  /* ---------- Menu ---------- */
  var toggle = $(".menu-toggle"), toggleText = $(".menu-toggle__text"), menu = $(".menu");
  function openMenu() {
    body.classList.add("menu-open");
    if (toggle) toggle.setAttribute("aria-expanded", "true");
    if (toggleText) toggleText.textContent = "Close";
    if (lenis) lenis.stop();
    if (menu) menu.removeAttribute("inert");
    if (header) header.classList.remove("is-hidden");
  }
  function closeMenu(instant) {
    if (!body.classList.contains("menu-open")) return;
    if (instant && menu) menu.classList.add("no-anim");
    body.classList.remove("menu-open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    if (toggleText) toggleText.textContent = "Menu";
    if (lenis) lenis.start();
    if (menu) menu.setAttribute("inert", "");
    if (instant && menu) requestAnimationFrame(function () { requestAnimationFrame(function () { menu.classList.remove("no-anim"); }); });
  }
  if (toggle) toggle.addEventListener("click", function () { body.classList.contains("menu-open") ? closeMenu() : openMenu(); });
  var backdrop = $(".menu-backdrop");
  if (backdrop) backdrop.addEventListener("click", function () { closeMenu(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
  window.matchMedia("(min-width: 1025px)").addEventListener("change", function (m) { if (m.matches) closeMenu(true); });

  /* ---------- Preloader (first visit to the home page per session) ---------- */
  var pre = $(".preloader");
  function loaded() { body.classList.add("is-loaded"); document.dispatchEvent(new CustomEvent("site:loaded")); }
  if (pre && doc.classList.contains("is-preloading")) {
    var count = $(".preloader__count", pre);
    var letters = $$(".preloader__word span", pre);
    var start = performance.now(), DURATION = 950;
    letters.forEach(function (l, i) {
      l.style.transition = "transform .7s cubic-bezier(.22,1,.36,1) " + (0.08 + 0.03 * i) + "s";
      requestAnimationFrame(function () { requestAnimationFrame(function () { l.style.transform = "translateY(0)"; }); });
    });
    var tick = function (now) {
      var p = Math.min(1, (now - start) / DURATION);
      var eased = 1 - Math.pow(1 - p, 3);
      if (count) count.textContent = String(Math.round(eased * 100)).padStart(3, "0");
      if (p < 1) requestAnimationFrame(tick);
      else {
        doc.classList.add("pre-out");
        pre.style.transition = "clip-path .75s cubic-bezier(.65,0,.35,1)";
        pre.style.clipPath = "inset(0 0 100% 0)";
        setTimeout(function () { doc.classList.remove("is-preloading", "pre-out"); pre.style.cssText = ""; }, 800);
        setTimeout(loaded, 120);
      }
    };
    requestAnimationFrame(tick);
  } else {
    doc.classList.remove("is-preloading");
    loaded();
  }

  /* ---------- Cursor ---------- */
  if (finePointer && !reduced) {
    var cursor = document.createElement("div");
    cursor.className = "cursor";
    cursor.setAttribute("aria-hidden", "true");
    cursor.innerHTML = '<div class="cursor__dot"></div><div class="cursor__ring"><span></span></div>';
    body.appendChild(cursor);
    var dot = $(".cursor__dot", cursor), ring = $(".cursor__ring", cursor), label = $("span", ring);
    var mx = -100, my = -100, rx = -100, ry = -100;
    window.addEventListener("mousemove", function (e) { mx = e.clientX; my = e.clientY; }, { passive: true });
    (function loop() {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      dot.style.transform = "translate3d(" + mx + "px," + my + "px,0)";
      ring.style.transform = "translate3d(" + rx + "px," + ry + "px,0)";
      requestAnimationFrame(loop);
    })();
    document.addEventListener("mouseover", function (e) {
      var t = e.target.closest("[data-cursor], a, button, label, summary, .seg");
      cursor.classList.remove("is-hover", "is-label");
      var dk = e.target.closest("[data-theme]");
      cursor.classList.toggle("on-dark", (dk && dk.getAttribute("data-theme") === "dark") || body.classList.contains("menu-open"));
      if (!t) return;
      var txt = t.getAttribute("data-cursor");
      if (txt) { label.textContent = txt; cursor.classList.add("is-label"); }
      else cursor.classList.add("is-hover");
    });
    document.addEventListener("mouseleave", function () { cursor.style.opacity = "0"; });
    document.addEventListener("mouseenter", function () { cursor.style.opacity = "1"; });
  }

  /* ==========================================================================
     IN-PLACE PAGE TRANSITIONS
     Panels cover the screen, the next page's <main> is fetched and swapped in
     behind them, then they lift. The document itself never reloads.
     ========================================================================== */
  var curtain = $(".curtain");
  var ctTitle = curtain ? $(".curtain__title", curtain) : null;
  var PAGE_TITLES = {
    "index": "Peak life <em>now</em>", "": "Peak life <em>now</em>",
    "about": "Born an <em>entrepreneur</em>", "coaching": "High-impact <em>coaching</em>",
    "ignition": "Ignite your <em>fire</em>", "speaking": "On <em>stage</em>",
    "results": "Proof from <em>the work</em>", "scorecard": "Find your <em>gap</em>",
    "apply": "Take <em>action</em>", "404": "False <em>summit</em>"
  };
  function titleFor(path) {
    var key = (path.split("/").pop() || "").replace(/\.html$/, "");
    return PAGE_TITLES[key] || "Daniel <em>Diaz</em>";
  }
  function resetCurtain() {
    if (!curtain) return;
    curtain.classList.add("no-anim");
    curtain.classList.remove("is-leaving", "is-covering", "is-covered");
    void curtain.offsetHeight;
    requestAnimationFrame(function () { requestAnimationFrame(function () { curtain.classList.remove("no-anim"); }); });
  }
  function liftCurtain() {
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      curtain.classList.add("is-leaving");
      setTimeout(resetCurtain, 900);
    }); });
  }

  var pageCache = {};
  function fetchPage(path) {
    if (!pageCache[path]) {
      pageCache[path] = fetch(path, { credentials: "same-origin" }).then(function (r) {
        if (!r.ok && r.status !== 404) throw new Error("HTTP " + r.status);
        return r.text();
      }).catch(function (err) { delete pageCache[path]; throw err; });
    }
    return pageCache[path];
  }
  function isPageLink(url) {
    return url.origin === location.origin && (/\.html$/.test(url.pathname) || /\/$/.test(url.pathname));
  }
  function cover(path) {
    return new Promise(function (resolve) {
      if (ctTitle) ctTitle.innerHTML = titleFor(path);
      curtain.classList.add("is-covering");
      var done = false;
      var fin = function () {
        if (done) return; done = true;
        curtain.classList.add("is-covered");
        setTimeout(resolve, 30);
      };
      var cols = $$(".curtain__cols--ink i", curtain);
      var last = cols[cols.length - 1];
      if (last) last.addEventListener("transitionend", function (ev) { if (ev.propertyName === "transform") fin(); }, { once: true });
      setTimeout(fin, 900);
    });
  }

  var navigating = false;
  function navigate(url, push) {
    if (navigating) return;
    navigating = true;
    Promise.all([fetchPage(url.pathname), cover(url.pathname)]).then(function (res) {
      swapPage(res[0], url, push);
      navigating = false;
    }).catch(function () { location.href = url.href; });
  }

  function swapPage(html, url, push) {
    var next = new DOMParser().parseFromString(html, "text/html");
    var newMain = next.querySelector("main");
    if (!newMain) { location.href = url.href; return; }

    if (window.PLMotion) window.PLMotion.destroy();
    runCleanups();
    closeMenu(true);

    $("main").replaceWith(document.importNode(newMain, true));
    document.title = next.title;
    var a = $('meta[name="description"]'), b = next.querySelector('meta[name="description"]');
    if (a && b) a.setAttribute("content", b.getAttribute("content"));
    var canon = $('link[rel="canonical"]'), nCanon = next.querySelector('link[rel="canonical"]');
    if (canon && nCanon) canon.setAttribute("href", nCanon.getAttribute("href"));
    body.setAttribute("data-page", next.body.getAttribute("data-page") || "");
    [".site-header .nav", ".menu__list"].forEach(function (sel) {
      var x = $(sel), y = next.querySelector(sel);
      if (x && y) x.innerHTML = y.innerHTML;
    });

    if (push) history.pushState({ pl: 1 }, "", url.href);
    jumpTop();
    if (header) header.classList.remove("is-hidden");

    var main = $("main");
    wireLinks(main);
    wireLinks($(".site-header"));
    initPage(main);
    if (window.PLMotion) window.PLMotion.init(main, "enter");
    lastY = 0; onScroll();

    if (url.hash) {
      var t = document.getElementById(url.hash.slice(1));
      if (t) setTimeout(function () { scrollToEl(t); }, 800);
    }
    liftCurtain();
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (a.target && a.target !== "_self") return;
    var href = a.getAttribute("href");
    if (!href || /^(mailto:|tel:|javascript:)/i.test(href)) return;
    if (href.charAt(0) === "#") {
      if (href.length < 2) return;
      var target = document.getElementById(href.slice(1));
      if (!target) return;
      e.preventDefault(); closeMenu(); scrollToEl(target);
      return;
    }
    var url = new URL(a.href, location.href);
    if (!isPageLink(url)) return;
    if (url.pathname === location.pathname && url.search === location.search) {
      e.preventDefault();
      closeMenu();
      if (url.hash) { var t = document.getElementById(url.hash.slice(1)); if (t) scrollToEl(t); }
      else if (lenis) lenis.scrollTo(0); else window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!curtain || reduced || location.protocol === "file:") return;
    e.preventDefault();
    navigate(url, true);
  });
  if (curtain && !reduced && location.protocol !== "file:") {
    history.replaceState({ pl: 1 }, "", location.href);
    window.addEventListener("popstate", function () {
      var url = new URL(location.href);
      if (isPageLink(url)) navigate(url, false);
    });
  }
  window.addEventListener("pageshow", function (e) { if (e.persisted) { closeMenu(true); resetCurtain(); } });

  function warmPath(path) { if (path !== location.pathname) fetchPage(path).catch(function () {}); }
  var warm = function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#" || /^(mailto:|tel:)/i.test(href)) return;
    var u = new URL(a.href, location.href);
    if (isPageLink(u)) warmPath(u.pathname);
  };
  if (location.protocol !== "file:") {
    document.addEventListener("touchstart", warm, { passive: true });
    document.addEventListener("mouseover", warm, { passive: true });
  }

  /* ==========================================================================
     PEAK LIFE SCORECARD — shared data + radar drawing
     ========================================================================== */
  var SC_Q = [
    { k: "performance", area: "Performance", side: "a", t: "I'm hitting the goals I set for my <em>business</em> or career." },
    { k: "income", area: "Income", side: "a", t: "My income reflects the <em>value</em> I bring." },
    { k: "drive", area: "Drive", side: "a", t: "I have the drive to keep pushing when things get <em>hard.</em>" },
    { k: "energy", area: "Energy", side: "f", t: "I end most days with energy left for the <em>people I love.</em>" },
    { k: "relationships", area: "Relationships", side: "f", t: "My closest relationships feel <em>deep,</em> not surface-level." },
    { k: "mindset", area: "Mindset", side: "f", t: "My beliefs about myself push me <em>forward,</em> not hold me back." },
    { k: "selflove", area: "Self-love", side: "f", t: "I genuinely like, respect and <em>back</em> the person I am." },
    { k: "joy", area: "Joy", side: "f", t: "I wake up calm, inspired and <em>excited</em> for the day ahead." }
  ];
  var RC = 200, RR = 140;
  function rPoint(i, v, n) {
    var ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
    var r = RR * (v / 10);
    return [RC + Math.cos(ang) * r, RC + Math.sin(ang) * r];
  }
  function polyStr(vals) { return vals.map(function (v, i) { return rPoint(i, v, vals.length).map(function (n) { return n.toFixed(1); }).join(","); }).join(" "); }
  function radarSVG(cls) {
    var n = SC_Q.length, s = '<svg class="radar ' + (cls || "") + '" viewBox="-40 -10 480 420" role="img" aria-label="Radar chart of your eight life areas">';
    [2.5, 5, 7.5, 10].forEach(function (v) { s += '<polygon class="ring" points="' + polyStr(SC_Q.map(function () { return v; })) + '"/>'; });
    SC_Q.forEach(function (q, i) { var p = rPoint(i, 10, n); s += '<line class="spoke" x1="' + RC + '" y1="' + RC + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '"/>'; });
    s += '<polygon class="poly-u" points="' + polyStr(SC_Q.map(function () { return 0; })) + '"/>';
    SC_Q.forEach(function (q, i) {
      var p = rPoint(i, 11.9, n), anchor = Math.abs(p[0] - RC) < 8 ? "middle" : (p[0] > RC ? "start" : "end");
      s += '<text class="lab" data-i="' + i + '" x="' + p[0].toFixed(1) + '" y="' + (p[1] + 4).toFixed(1) + '" text-anchor="' + anchor + '">' + q.area + "</text>";
    });
    SC_Q.forEach(function (q, i) { s += '<circle class="pt" data-i="' + i + '" cx="' + RC + '" cy="' + RC + '" r="0"/>'; });
    return s + "</svg>";
  }
  function drawRadar(svg, vals, current) {
    var poly = $(".poly-u", svg);
    if (poly) poly.setAttribute("points", polyStr(vals));
    $$(".pt", svg).forEach(function (c, i) {
      var p = rPoint(i, vals[i], vals.length);
      c.setAttribute("cx", p[0].toFixed(1)); c.setAttribute("cy", p[1].toFixed(1)); c.setAttribute("r", vals[i] ? 4.5 : 0);
    });
    $$(".lab", svg).forEach(function (l, i) { l.classList.toggle("is-on", i === current); });
  }
  function avg(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; }
  function scoreProfile(vals) {
    var A = avg(vals.slice(0, 3)), F = avg(vals.slice(3)), gap = A - F;
    var ranked = SC_Q.map(function (q, i) { return { area: q.area, v: vals[i] }; }).sort(function (x, y) { return x.v - y.v; });
    var p;
    if (A >= 6.5 && gap >= 1.5) p = { name: "The Driven Achiever", line: "You've built the results. Your life hasn't caught up yet.", body: "This is the exact gap Daniel built his coaching around: high achievement, low fulfillment. More hustle won't close it. Rebuilding your beliefs, energy and habits will.", rec: "1:1 Peak Now Coaching", recText: "Six or twelve months, one-on-one. The deepest level of support, for people committed to having it all.", href: "coaching.html", cta: "See 1:1 coaching" };
    else if (A >= 7.5 && F >= 7.5) p = { name: "The Peak Performer", line: "You're living high. Now protect it and compound it.", body: "You've done the work most people avoid. The next level is about compressing time and installing systems that hold under pressure.", rec: "VIP Day Intensive", recText: "One full day, in person, with Daniel. Release what's left, map the next season, and leave with momentum.", href: "coaching.html#vip", cta: "See the VIP Day" };
    else if (F - A >= 1.5) p = { name: "The Heart-Led Builder", line: "Your life feels good. Your results haven't caught up.", body: "Fulfillment is your foundation. Now it's time to turn that energy into performance with a roadmap, accountability and habits that move the needle.", rec: "1:1 Peak Now Coaching", recText: "A coach, a partner and a friend in your corner, with easy-to-follow steps and strategies.", href: "coaching.html", cta: "See 1:1 coaching" };
    else if (A < 5.5 && F < 5.5) p = { name: "Running on Fumes", line: "Spread thin and running low. Time to reset, not push harder.", body: "Daniel has been exactly here. The fastest way forward is a real conversation about where you are and the quickest route out.", rec: "Free discovery call", recText: "A conversation with Daniel to identify your quickest route to having it all. No pressure.", href: "apply.html", cta: "Book a discovery call", book: true };
    else p = { name: "On the Climb", line: "Solid footing. The next level is closer than you think.", body: "You're not stuck, but you're not at your peak either. A few targeted shifts in mindset and habits could change everything.", rec: "Free discovery call", recText: "Talk it through with Daniel and find out which path fits: 1:1 coaching, a VIP Day or IGNITION.", href: "apply.html", cta: "Book a discovery call", book: true };
    p.A = A; p.F = F; p.gap = gap; p.levers = ranked.slice(0, 2).map(function (r) { return r.area; });
    return p;
  }

  /* ==========================================================================
     PER-PAGE INITIALISATION
     ========================================================================== */
  function initPage(root) {

    /* Pause the hero's spinning rays while the hero is off screen */
    var heroEl = $(".hero", root);
    if (heroEl && "IntersectionObserver" in window) {
      var heroIO = new IntersectionObserver(function (en) { heroEl.classList.toggle("is-off", !en[0].isIntersecting); });
      heroIO.observe(heroEl);
      onCleanup(function () { heroIO.disconnect(); });
    }

    /* Magnetic buttons + pointer glow on cards */
    if (finePointer && !reduced) {
      $$("[data-magnetic]", root).forEach(function (el) {
        el.addEventListener("mousemove", function (e) {
          var r = el.getBoundingClientRect();
          el.style.transform = "translate(" + (e.clientX - r.left - r.width / 2) * 0.2 + "px," + (e.clientY - r.top - r.height / 2) * 0.28 + "px)";
        });
        el.addEventListener("mouseleave", function () { el.style.transform = ""; });
      });
      $$(".pillar", root).forEach(function (el) {
        el.addEventListener("mousemove", function (e) {
          var r = el.getBoundingClientRect();
          el.style.setProperty("--mx", (e.clientX - r.left) + "px");
          el.style.setProperty("--my", (e.clientY - r.top) + "px");
        });
      });
    }

    /* Testimonial slider */
    $$("[data-tslider]", root).forEach(function (sl) {
      var slides = $$(".tslide", sl), people = $$(".tperson", sl), count = $(".tslider__count b", sl), barI = $(".tslider__bar i", sl);
      var i = 0, t0 = performance.now(), DUR = 8000, paused = false, alive = true;
      function go(n) {
        i = (n + slides.length) % slides.length;
        slides.forEach(function (s, k) { s.classList.toggle("is-active", k === i); });
        people.forEach(function (p, k) { p.classList.toggle("is-active", k === i); p.setAttribute("aria-selected", k === i ? "true" : "false"); });
        if (count) count.textContent = String(i + 1).padStart(2, "0");
        t0 = performance.now();
        var active = people[i];
        if (active && active.parentNode.scrollWidth > active.parentNode.clientWidth) {
          active.parentNode.scrollTo({ left: active.offsetLeft - 20, behavior: reduced ? "auto" : "smooth" });
        }
        if (window.gsap && !reduced) {
          var q = $("blockquote", slides[i]);
          window.gsap.fromTo([q, $(".chip", slides[i]), $("figcaption", slides[i])], { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .8, ease: "expo.out", stagger: .06 });
        }
      }
      people.forEach(function (p, k) { p.addEventListener("click", function () { go(k); }); });
      var prev = $("[data-prev]", sl), nxt = $("[data-next]", sl);
      if (prev) prev.addEventListener("click", function () { go(i - 1); });
      if (nxt) nxt.addEventListener("click", function () { go(i + 1); });
      sl.addEventListener("mouseenter", function () { paused = true; });
      sl.addEventListener("mouseleave", function () { paused = false; t0 = performance.now() - (barI ? parseFloat(barI.dataset.p || 0) * DUR : 0); });
      var x0 = null;
      sl.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
      sl.addEventListener("touchend", function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1)); x0 = null; });
      (function loop(now) {
        if (!alive) return;
        if (!paused && !reduced) {
          var p = Math.min(1, (now - t0) / DUR);
          if (barI) { barI.style.transform = "scaleX(" + p + ")"; barI.dataset.p = p; }
          if (p >= 1) go(i + 1);
        }
        requestAnimationFrame(loop);
      })(performance.now());
      onCleanup(function () { alive = false; });
    });

    /* Filters (results) */
    $$("[data-filters]", root).forEach(function (group) {
      var target = $(group.getAttribute("data-filters"), root);
      if (!target) return;
      var cards = $$("[data-cat]", target);
      $$("button", group).forEach(function (btn) {
        var f = btn.getAttribute("data-filter");
        var n = f === "all" ? cards.length : cards.filter(function (c) { return c.getAttribute("data-cat").split(" ").indexOf(f) > -1; }).length;
        var sm = $("small", btn); if (sm) sm.textContent = String(n).padStart(2, "0");
        btn.addEventListener("click", function () {
          $$("button", group).forEach(function (b) { b.setAttribute("aria-pressed", b === btn ? "true" : "false"); });
          cards.forEach(function (c) {
            var show = f === "all" || c.getAttribute("data-cat").split(" ").indexOf(f) > -1;
            c.classList.toggle("is-hidden", !show);
          });
          if (window.gsap && !reduced) window.gsap.fromTo(cards.filter(function (c) { return !c.classList.contains("is-hidden"); }), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .7, ease: "expo.out", stagger: .04 });
          if (window.ScrollTrigger) window.ScrollTrigger.refresh();
        });
      });
    });

    /* Tabs (keynote circle) */
    $$("[data-tabs]", root).forEach(function (wrap) {
      var tabs = $$('[role="tab"]', wrap), panels = $$('[role="tabpanel"]', wrap), segs = $$("[data-seg]", wrap);
      function sel(k) {
        tabs.forEach(function (t, n) { t.setAttribute("aria-selected", n === k ? "true" : "false"); t.tabIndex = n === k ? 0 : -1; });
        panels.forEach(function (p, n) { p.hidden = n !== k; });
        segs.forEach(function (s) { var on = +s.getAttribute("data-seg") === k; s.classList.toggle("is-on", on); });
        $$(".seg-lab", wrap).forEach(function (l) { l.classList.toggle("is-on", +l.getAttribute("data-seg-lab") === k); });
      }
      tabs.forEach(function (t, n) {
        t.addEventListener("click", function () { sel(n); });
        t.addEventListener("keydown", function (e) {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") { var k = (n + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length; sel(k); tabs[k].focus(); }
        });
      });
      segs.forEach(function (s) {
        var k = +s.getAttribute("data-seg");
        s.addEventListener("click", function () { sel(k); });
        s.addEventListener("mouseenter", function () { sel(k); });
      });
      sel(0);
    });

    /* FAQ: one open at a time */
    $$(".faq__list", root).forEach(function (list) {
      var items = $$("details", list);
      items.forEach(function (d) { d.addEventListener("toggle", function () { if (d.open) items.forEach(function (o) { if (o !== d) o.open = false; }); if (window.ScrollTrigger) setTimeout(function () { window.ScrollTrigger.refresh(); }, 50); }); });
    });

    /* Home scorecard teaser: animate demo radar */
    $$("[data-radar-demo]", root).forEach(function (host) {
      host.innerHTML = radarSVG("radar-demo");
      var svg = $("svg", host);
      var sets = [[9, 8, 9, 4, 3, 5, 3, 4], [8, 7, 8, 7, 6, 7, 6, 7], [9, 9, 9, 8, 9, 8, 9, 9]];
      var k = 0, alive = true;
      var labs = $$(".lab", svg);
      function step() {
        if (!alive) return;
        var v = sets[k % sets.length];
        drawRadar(svg, v, -1);
        labs.forEach(function (l, i) { l.classList.toggle("is-low", v[i] <= 4); });
        k++;
        setTimeout(step, 2600);
      }
      setTimeout(step, 400);
      onCleanup(function () { alive = false; });
    });

    /* Full scorecard */
    $$("[data-scorecard]", root).forEach(initScorecard);

    /* Multi-step application */
    $$("[data-apply]", root).forEach(initApply);

    /* Simple forms (speaking enquiry, IGNITION waitlist, contact) */
    $$("form[data-form]", root).forEach(function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!checkFields(form)) { toast("Please complete the highlighted fields."); return; }
        var kind = form.getAttribute("data-form");
        var subj = form.getAttribute("data-subject") || "Website enquiry";
        var btn = $('[type="submit"]', form); if (btn) btn.disabled = true;
        deliver(kind, subj, formData(form)).then(function (how) {
          var done = form.parentNode.querySelector("[data-done]");
          if (done) { form.hidden = true; done.hidden = false; done.classList.add("is-active"); }
          toast(how === "mailto" ? "Your email app is opening with the details filled in." : "Sent. Daniel will be in touch " + (CFG.replyPromise || "soon") + ".");
        }).catch(function () { toast("Something went wrong. Please email " + CFG.email + "."); if (btn) btn.disabled = false; });
      });
      $$("input, textarea, select", form).forEach(function (el) {
        el.addEventListener("input", function () { var w = el.closest(".field, .fgroup"); if (w) w.classList.remove("has-error"); });
        el.addEventListener("change", function () { var w = el.closest(".field, .fgroup"); if (w) w.classList.remove("has-error"); });
      });
    });
  }

  /* ---------- Opt-in (global, lives in the footer area) ---------- */
  $$("[data-optin]").forEach(function (box) {
    var form = $("form", box);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var em = form.elements.email;
      if (!validEmail(em.value)) { em.focus(); toast("Please enter a valid email address."); return; }
      deliver("morning-mastery", "Morning Mastery Checklist request", { first_name: form.elements.first_name.value.trim(), email: em.value.trim() })
        .then(function (how) { box.classList.add("is-done"); if (how !== "mailto") toast("Done. Check your inbox."); })
        .catch(function () { toast("Something went wrong. Please try again."); });
    });
  });

  /* ---------- Scorecard ---------- */
  function initScorecard(host) {
    var vals = SC_Q.map(function () { return 0; });
    var i = 0;
    var q = $(".sc__q", host), viz = $(".sc__viz", host), res = $(".sc__result", host);
    var meta = $(".sc__meta", host), stmt = $(".sc__stmt", host), scale = $(".scale", host);
    var back = $("[data-sc-back]", host), skip = $("[data-sc-next]", host), track = $(".sc__track", host);
    var sA = $("[data-sc-a]", host), sF = $("[data-sc-f]", host);
    viz.insertAdjacentHTML("afterbegin", radarSVG("radar-live"));
    var svg = $("svg", viz);
    track.innerHTML = SC_Q.map(function () { return "<i></i>"; }).join("");
    var ticks = $$("i", track);

    scale.innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) {
      return '<label><input type="radio" name="sc" value="' + n + '"><span>' + n + "</span></label>";
    }).join("");
    var radios = $$("input", scale);

    function render() {
      var item = SC_Q[i];
      meta.innerHTML = '<span class="sc__area mono"><i class="' + (item.side === "f" ? "f" : "") + '"></i>' + (item.side === "a" ? "Achievement" : "Fulfillment") + " · " + item.area + '</span><span class="mono"><b>' + String(i + 1).padStart(2, "0") + "</b> / " + String(SC_Q.length).padStart(2, "0") + "</span>";
      stmt.innerHTML = item.t;
      radios.forEach(function (r) { r.checked = +r.value === vals[i]; });
      back.disabled = i === 0;
      back.style.visibility = i === 0 ? "hidden" : "visible";
      skip.hidden = !vals[i];
      ticks.forEach(function (t, k) { t.classList.toggle("is-done", !!vals[k] && k !== i); t.classList.toggle("is-current", k === i); });
      drawRadar(svg, vals, i);
      var a = vals.slice(0, 3).filter(Boolean), f = vals.slice(3).filter(Boolean);
      sA.textContent = a.length ? avg(a).toFixed(1) : "–";
      sF.textContent = f.length ? avg(f).toFixed(1) : "–";
      if (window.gsap && !reduced) window.gsap.fromTo(stmt, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: .7, ease: "expo.out" });
    }
    radios.forEach(function (r) {
      r.addEventListener("change", function () {
        vals[i] = +r.value;
        drawRadar(svg, vals, i);
        setTimeout(function () { if (i < SC_Q.length - 1) { i++; render(); } else finish(); }, reduced ? 0 : 320);
      });
    });
    back.addEventListener("click", function () { if (i > 0) { i--; render(); } });
    skip.addEventListener("click", function () { if (!vals[i]) return; if (i < SC_Q.length - 1) { i++; render(); } else finish(); });

    function finish() {
      var p = scoreProfile(vals);
      host.classList.add("is-done");
      drawRadar(svg, vals, -1);
      $$(".lab", svg).forEach(function (l) { l.classList.toggle("is-low", p.levers.indexOf(SC_Q[+l.getAttribute("data-i")].area) > -1); });
      sA.textContent = p.A.toFixed(1); sF.textContent = p.F.toFixed(1);
      $("[data-r-name]", res).textContent = p.name;
      $("[data-r-line]", res).textContent = p.line;
      $("[data-r-body]", res).textContent = p.body;
      $("[data-r-a]", res).textContent = p.A.toFixed(1);
      $("[data-r-f]", res).textContent = p.F.toFixed(1);
      $("[data-r-gap]", res).textContent = (p.gap >= 0 ? "+" : "") + p.gap.toFixed(1);
      $("[data-r-levers]", res).innerHTML = p.levers.map(function (l) { return '<span class="chip">' + esc(l) + "</span>"; }).join("");
      $("[data-r-rec]", res).textContent = p.rec;
      $("[data-r-rectext]", res).textContent = p.recText;
      var cta = $("[data-r-cta]", res);
      cta.firstChild.nodeValue = p.cta + " ";
      cta.setAttribute("href", p.href);
      if (p.book && CFG.bookingUrl) { cta.setAttribute("href", CFG.bookingUrl); cta.setAttribute("target", "_blank"); cta.setAttribute("rel", "noopener"); }
      else { cta.removeAttribute("target"); }
      res.classList.add("is-active");
      var ach = $(".ach", res), ful = $(".ful", res), span = $(".span", res);
      var pa = (p.A - 1) / 9 * 100, pf = (p.F - 1) / 9 * 100;
      requestAnimationFrame(function () {
        ach.style.left = pa + "%"; ful.style.left = pf + "%";
        span.style.left = Math.min(pa, pf) + "%"; span.style.width = Math.abs(pa - pf) + "%";
      });
      var saved = { profile: p.name, achievement: p.A.toFixed(1), fulfillment: p.F.toFixed(1), gap: p.gap.toFixed(1), levers: p.levers.join(", ") };
      SC_Q.forEach(function (qq, k) { saved[qq.k] = vals[k]; });
      store.set("pl_score", JSON.stringify(saved));
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
      var top = host.getBoundingClientRect().top + window.scrollY - 100;
      if (lenis) lenis.scrollTo(top); else window.scrollTo({ top: top, behavior: reduced ? "auto" : "smooth" });
    }
    var restart = $("[data-sc-restart]", host);
    if (restart) restart.addEventListener("click", function () {
      vals = SC_Q.map(function () { return 0; }); i = 0;
      host.classList.remove("is-done"); res.classList.remove("is-active");
      $$(".lab", svg).forEach(function (l) { l.classList.remove("is-low"); });
      render();
    });
    var send = $("form", res);
    if (send) send.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!checkFields(send)) { toast("Add your name and a valid email."); return; }
      var d = formData(send), saved = {};
      try { saved = JSON.parse(store.get("pl_score") || "{}"); } catch (err) { saved = {}; }
      deliver("scorecard", "Peak Life Scorecard: " + (saved.profile || "results"), Object.assign({ name: d.name, email: d.email, wants_call: (d.wants_call || []).length ? "Yes" : "No" }, saved)).then(function (how) {
        send.hidden = true;
        var ok = $("[data-done]", res); if (ok) ok.hidden = false;
        if (how !== "mailto") toast("Sent. Your results are on their way to Daniel.");
      }).catch(function () { toast("Something went wrong. Please try again."); });
    });
    render();
  }

  /* ---------- Multi-step application ---------- */
  function initApply(host) {
    var form = $("form", host), steps = $$(".fstep", host), labels = $$(".msf__steps li", host);
    var barI = $(".msf__bar i", host), back = $("[data-back]", host), next = $("[data-next-step]", host), submit = $("[data-submit]", host);
    var note = $(".fnote", host), done = $(".fdone", host), stepN = $("[data-step-n]", host);
    var i = 0;
    var params = new URLSearchParams(location.search);
    var pre = params.get("program");
    if (pre) { var r = $('input[name="program"][value="' + pre + '"]', form); if (r) r.checked = true; }
    var saved = null;
    try { saved = JSON.parse(store.get("pl_score") || "null"); } catch (e) { saved = null; }
    var scoreNote = $("[data-score-note]", host);
    if (saved && scoreNote) {
      scoreNote.hidden = false;
      $("b", scoreNote).textContent = saved.profile + " · Achievement " + saved.achievement + " / Fulfillment " + saved.fulfillment;
    }
    function show(n) {
      i = n;
      steps.forEach(function (s, k) { s.classList.toggle("is-active", k === i); });
      labels.forEach(function (l, k) { l.classList.toggle("is-current", k === i); l.classList.toggle("is-done", k < i); });
      if (barI) barI.style.transform = "scaleX(" + ((i + 1) / steps.length) + ")";
      if (stepN) stepN.textContent = String(i + 1).padStart(2, "0");
      back.hidden = i === 0;
      next.hidden = i === steps.length - 1;
      submit.hidden = i !== steps.length - 1;
      note.textContent = "";
    }
    function scrollIn() {
      var top = host.getBoundingClientRect().top + window.scrollY - 110;
      if (window.scrollY > top) { if (lenis) lenis.scrollTo(top); else window.scrollTo({ top: top, behavior: "smooth" }); }
    }
    next.addEventListener("click", function () {
      if (!checkFields(steps[i])) { note.textContent = "Pick an answer to keep going."; return; }
      show(i + 1); scrollIn();
    });
    back.addEventListener("click", function () { show(Math.max(0, i - 1)); scrollIn(); });
    $$("input, textarea, select", form).forEach(function (el) {
      el.addEventListener("change", function () { var w = el.closest(".field, .fgroup"); if (w) w.classList.remove("has-error"); note.textContent = ""; });
    });
    var LABELS = { "coaching-6": "Peak Now Coaching · 6 months", "coaching-12": "Peak Now Coaching · 12 months", "vip": "VIP Day Intensive", "ignition": "IGNITION (men's cohort)", "unsure": "Not sure yet" };
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!checkFields(steps[i])) { note.textContent = "Add your name and a valid email."; return; }
      var d = formData(form);
      var data = {
        name: d.name, email: d.email, phone: d.phone,
        program: LABELS[d.program] || d.program, role: d.role, revenue_last_30_days: d.revenue,
        missing_most: d.missing, goals_this_year: d.tenten, commitment: d.commit ? d.commit + "/10" : "",
        start: d.start, why_now: d.why_now, best_time: d.best_time, heard_about: d.heard
      };
      if (saved) { data.scorecard = saved.profile + " (A " + saved.achievement + " / F " + saved.fulfillment + ", levers: " + saved.levers + ")"; }
      submit.disabled = true;
      deliver("application", "Peak Life Now application: " + (d.name || ""), data).then(function (how) {
        form.hidden = true;
        $(".msf__bar", host).style.display = "none";
        labels.forEach(function (l) { l.classList.remove("is-current"); l.classList.add("is-done"); });
        var sum = $(".summary", done);
        if (sum) sum.innerHTML = [["Program", data.program], ["You are", data.role], ["Missing most", (data.missing_most || []).join(", ")], ["Commitment", data.commitment], ["Start", data.start]].filter(function (r) { return r[1]; }).map(function (r) { return "<div><dt>" + r[0] + "</dt><dd>" + esc(r[1]) + "</dd></div>"; }).join("");
        var first = $("[data-first]", done); if (first) first.textContent = (d.name || "").split(" ")[0] || "friend";
        done.classList.add("is-active");
        scrollIn();
        if (how !== "mailto") toast("Application sent.");
      }).catch(function () { submit.disabled = false; note.textContent = "Something went wrong. Please email " + CFG.email + "."; });
    });
    show(0);
  }

  /* Boot */
  initPage(document.querySelector("main"));
  window.PLSite = { initPage: initPage, toast: toast, lenis: lenis };
})();
