/* ==========================================================================
   Daniel Diaz · Peak Life Now — interface behaviour
   Global (once): smooth scroll, header, menu, cursor, preloader, and
   in-place page transitions. Per page: initPage(root) wires up the content
   of <main>; it runs on load and again after every in-place page swap.
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.SITE_CONFIG || {};
  var doc = document.documentElement;
  var body = document.body;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (reduced) doc.classList.add("reduced");

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  };
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  /* Per-page cleanup hooks (timers, observers, rAF loops) */
  var cleanups = [];
  function onCleanup(fn) { cleanups.push(fn); }
  function runCleanups() { cleanups.splice(0).forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } }); }

  /* ---------- Smooth scroll (Lenis) ---------- */
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
    if (lenis) lenis.scrollTo(target, { offset: -20 });
    else target.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  }
  function jumpTop() {
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
  }

  /* ---------- Booking links ---------- */
  function wireBooking(root) {
    if (!CFG.bookingUrl) return;
    $$("[data-book]", root).forEach(function (el) {
      el.setAttribute("href", CFG.bookingUrl);
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener");
    });
  }
  wireBooking(document);
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- Header ---------- */
  var header = $(".site-header");
  var lastY = window.scrollY;
  var ticking = false;
  function darkUnderHeader() {
    if (!header) return false;
    var y = header.offsetHeight / 2;
    var els = document.elementsFromPoint ? document.elementsFromPoint(window.innerWidth / 2, y) : [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (header.contains(el) || el.classList.contains("menu")) continue;
      var sec = el.closest("[data-theme]");
      if (sec) return sec.getAttribute("data-theme") === "dark";
    }
    return false;
  }
  function onScroll() {
    var y = window.scrollY;
    if (header) {
      header.classList.toggle("is-scrolled", y > 40);
      var goingDown = y > lastY && y > 400;
      if (!body.classList.contains("menu-open")) header.classList.toggle("is-hidden", goingDown);
      header.classList.toggle("on-dark", darkUnderHeader());
    }
    lastY = y;
    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  /* ---------- Menu ---------- */
  var toggle = $(".menu-toggle");
  var toggleText = $(".menu-toggle__text");
  var menu = $(".menu");
  function openMenu() {
    body.classList.add("menu-open");
    if (toggle) toggle.setAttribute("aria-expanded", "true");
    if (toggleText) toggleText.textContent = "Close";
    if (lenis) lenis.stop();
    if (menu) menu.removeAttribute("inert");
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

  /* ---------- Browser chrome colour ---------- */
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  function uiWine() { doc.classList.add("ui-wine"); if (themeMeta) themeMeta.setAttribute("content", "#1b140d"); }
  function uiIvory() { doc.classList.remove("ui-wine"); if (themeMeta) themeMeta.setAttribute("content", "#f4efe6"); }

  /* ---------- Preloader (first visit per session) ---------- */
  var pre = $(".preloader");
  if (pre) {
    if (doc.classList.contains("no-preloader") || reduced) {
      if (!doc.classList.contains("pt-enter")) uiIvory();
      doc.classList.remove("is-preloading");
      pre.remove();
      body.classList.add("is-loaded");
    } else {
      store.set("pl_seen", "1");
      var count = $(".preloader__count", pre);
      var letters = $$(".preloader__word span", pre);
      var start = performance.now();
      var DURATION = 1500;
      letters.forEach(function (l, i) {
        l.style.transition = "transform 1s cubic-bezier(.22,1,.36,1) " + (0.05 * i) + "s";
        requestAnimationFrame(function () { requestAnimationFrame(function () { l.style.transform = "translateY(0)"; }); });
      });
      var tick = function (now) {
        var p = Math.min(1, (now - start) / DURATION);
        var eased = 1 - Math.pow(1 - p, 3);
        if (count) count.textContent = String(Math.round(eased * 100)).padStart(2, "0") + "%";
        if (p < 1) requestAnimationFrame(tick);
        else finishPreloader();
      };
      requestAnimationFrame(tick);
    }
  } else {
    body.classList.add("is-loaded");
  }
  function finishPreloader() {
    pre.style.transition = "clip-path 1.1s cubic-bezier(.65,0,.35,1)";
    pre.style.clipPath = "inset(0 0 100% 0)";
    doc.classList.remove("is-preloading");
    setTimeout(uiIvory, 500);
    body.classList.add("is-loaded");
    document.dispatchEvent(new CustomEvent("site:loaded"));
    setTimeout(function () { pre.remove(); }, 1200);
  }

  /* ---------- Cursor (dot + trailing ring) ---------- */
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
      rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
      dot.style.transform = "translate3d(" + mx + "px," + my + "px,0)";
      ring.style.transform = "translate3d(" + rx + "px," + ry + "px,0)";
      requestAnimationFrame(loop);
    })();
    var DARK = '[data-theme="dark"], .dark, .dark-2, .cta-final, .site-footer, .program, .compass, .menu, .svc';
    document.addEventListener("mouseover", function (e) {
      var t = e.target.closest("[data-cursor], a, button, .choice, .option");
      cursor.classList.toggle("is-hover", false);
      cursor.classList.toggle("is-label", false);
      cursor.classList.toggle("on-dark", !!e.target.closest(DARK) || body.classList.contains("menu-open"));
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
     The browser never loads a new document: panels cover the screen, the
     next page's <main> is fetched and swapped in behind them, then they lift.
     No document swap = no frame where iOS Safari can flash or resize.
     ========================================================================== */
  var curtain = $(".curtain");
  var ctTitle = curtain ? $(".curtain__title", curtain) : null;
  var PAGE_TITLES = {
    "index": "Peak life <em>now</em>", "": "Peak life <em>now</em>",
    "about": "About <em>Daniel</em>", "coaching": "1:1 <em>coaching</em>",
    "ignition": "Ignite your <em>fire</em>", "speaking": "On <em>stage</em>",
    "results": "Client <em>results</em>", "scorecard": "Find your <em>gap</em>",
    "apply": "Take <em>action</em>", "404": "False <em>summit</em>"
  };
  function titleFor(path) {
    var key = (path.split("/").pop() || "").replace(/\.html$/, "");
    return PAGE_TITLES[key] || "Daniel <em>Diaz</em>";
  }
  function resetCurtain() {
    resetT = null;
    if (!curtain) return;
    curtain.classList.add("no-anim");
    doc.classList.remove("pt-enter", "pt-covered");
    curtain.classList.remove("is-leaving", "is-covering", "is-covered");
    doc.style.backgroundColor = "";
    uiIvory();
    void curtain.offsetHeight;
    requestAnimationFrame(function () { requestAnimationFrame(function () { curtain.classList.remove("no-anim"); }); });
  }
  var resetT = null;
  /* Lift the panels off a fully covered screen */
  function liftCurtain() {
    if (!curtain) return;
    curtain.classList.add("no-anim");
    doc.classList.add("pt-enter");
    curtain.classList.remove("is-covering", "is-covered");
    void curtain.offsetHeight;
    curtain.classList.remove("no-anim");
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      doc.classList.remove("pt-covered");
      curtain.classList.add("is-leaving");
      clearTimeout(resetT); resetT = setTimeout(resetCurtain, 2100);
    }); });
  }
  /* First load arriving from a full page load (fallback path) */
  if (curtain && doc.classList.contains("pt-enter")) {
    if (ctTitle) ctTitle.innerHTML = titleFor(location.pathname);
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      curtain.classList.add("is-leaving");
      clearTimeout(resetT); resetT = setTimeout(resetCurtain, 2100);
    }); });
  }

  /* Page HTML cache (filled by hover/touch prefetch) */
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

  /* Cover the screen; resolves once fully covered */
  function cover(path) {
    return new Promise(function (resolve) {
      var busy = curtain.classList.contains("is-leaving") || curtain.classList.contains("no-anim") || resetT !== null;
      if (busy) { clearTimeout(resetT); resetCurtain(); }
      setTimeout(function () { startCover(path, resolve); }, busy ? 70 : 0);
    });
  }
  function startCover(path, resolve) {
    (function () {
      if (ctTitle) ctTitle.innerHTML = titleFor(path);
      curtain.classList.add("is-covering");
      setTimeout(uiWine, 350);
      var done = false;
      var fin = function () {
        if (done) return; done = true;
        curtain.classList.add("is-covered"); doc.classList.add("pt-covered");
        setTimeout(resolve, 500);   /* hold on the page title for a beat */
      };
      var cols = $$(".curtain__cols--wine i", curtain).filter(function (c) { return c.offsetWidth > 0; });
      var last = cols[cols.length - 1];
      if (last) last.addEventListener("transitionend", function (ev) { if (ev.propertyName === "transform") setTimeout(fin, 60); }, { once: true });
      setTimeout(fin, 1700);
    })();
  }

  var navigating = false;
  function navigate(url, push) {
    if (navigating) return;
    navigating = true;
    var path = url.pathname;
    Promise.all([fetchPage(path), cover(path)]).then(function (res) {
      swapPage(res[0], url, push);
      navigating = false;
    }).catch(function () {
      /* Anything unexpected: fall back to a normal page load */
      location.href = url.href;
    });
  }

  function swapPage(html, url, push) {
    var next = new DOMParser().parseFromString(html, "text/html");
    var newMain = next.querySelector("main");
    if (!newMain) { location.href = url.href; return; }

    /* Tear down the old page (all hidden behind the solid curtain) */
    if (window.ARMotion) window.ARMotion.destroy();
    runCleanups();
    $$(".hover-img").forEach(function (el) { el.remove(); });
    closeMenu(true);

    /* Swap content, title, meta and current-page markers */
    var oldMain = $("main");
    oldMain.replaceWith(document.importNode(newMain, true));
    document.title = next.title;
    ["description"].forEach(function (n) {
      var a = $('meta[name="' + n + '"]'), b = next.querySelector('meta[name="' + n + '"]');
      if (a && b) a.setAttribute("content", b.getAttribute("content"));
    });
    var canon = $('link[rel="canonical"]'), nCanon = next.querySelector('link[rel="canonical"]');
    if (canon && nCanon) canon.setAttribute("href", nCanon.getAttribute("href"));
    body.setAttribute("data-page", next.body.getAttribute("data-page") || "");
    [".site-header .nav", ".menu__list"].forEach(function (sel) {
      var a = $(sel), b = next.querySelector(sel);
      if (a && b) a.innerHTML = b.innerHTML;
    });

    if (push) history.pushState({ ar: 1 }, "", url.href);
    jumpTop();
    if (header) header.classList.remove("is-hidden");

    /* Wire up the new page and play its entrance */
    var main = $("main");
    wireBooking(main);
    initPage(main);
    if (window.ARMotion) window.ARMotion.init(main, "enter");
    lastY = 0; onScroll();

    if (url.hash) {
      var t = document.getElementById(url.hash.slice(1));
      if (t) setTimeout(function () { scrollToEl(t); }, 900);
    }
    liftCurtain();
  }

  /* One delegated click handler for every link on the site */
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (a.target && a.target !== "_self") return;
    var href = a.getAttribute("href");
    if (!href || /^(mailto:|tel:|javascript:)/i.test(href)) return;

    /* In-page anchors */
    if (href.charAt(0) === "#") {
      if (href.length < 2) return;
      var target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      closeMenu();
      scrollToEl(target);
      return;
    }
    var url = new URL(a.href, location.href);
    if (!isPageLink(url)) return;
    if (url.pathname === location.pathname && url.search === location.search) {
      if (url.hash) {
        var t = document.getElementById(url.hash.slice(1));
        if (t) { e.preventDefault(); closeMenu(); scrollToEl(t); }
      }
      return;
    }
    if (!curtain || reduced) return;           /* plain navigation */
    e.preventDefault();
    navigate(url, true);
  });

  /* Back / forward */
  if (curtain && !reduced) {
    history.replaceState({ ar: 1 }, "", location.href);
    window.addEventListener("popstate", function () {
      var url = new URL(location.href);
      if (!isPageLink(url)) return;
      navigate(url, false);
    });
  }
  window.addEventListener("pageshow", function (e) { if (e.persisted) { closeMenu(true); resetCurtain(); } });

  /* Warm up pages as soon as a finger/cursor reaches a link */
  function warmPath(path) { if (path !== location.pathname) fetchPage(path).catch(function () {}); }
  var warm = function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#" || /^(mailto:|tel:)/i.test(href)) return;
    var u = new URL(a.href, location.href);
    if (isPageLink(u)) warmPath(u.pathname);
  };
  document.addEventListener("touchstart", warm, { passive: true });
  document.addEventListener("mouseover", warm, { passive: true });
  var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 1500); };
  idle(function () {
    $$(".site-header .nav a, .menu__list a").forEach(function (a) {
      var u = new URL(a.href, location.href);
      if (isPageLink(u)) warmPath(u.pathname);
    });
  });

  /* ==========================================================================
     PER-PAGE INITIALISATION (content inside <main>)
     ========================================================================== */
  function initPage(root) {


    /* Hero: tell CSS how tall the right-hand tile column is, so the big "now."
       can sit above it (the stage and the column share the same bottom edge). */
    var hvStage = $(".hv__stage", root), hvRight = $(".hv__right", root);
    if (hvStage && hvRight) {
      var setRightH = function () { hvStage.style.setProperty("--right-h", hvRight.offsetHeight + "px"); };
      setRightH();
      if ("ResizeObserver" in window) { var hvRO = new ResizeObserver(setRightH); hvRO.observe(hvRight); onCleanup(function () { hvRO.disconnect(); }); }
      else { window.addEventListener("resize", setRightH); onCleanup(function () { window.removeEventListener("resize", setRightH); }); }
    }

    /* Magnetic buttons + service hover image (desktop pointer) */
    if (finePointer && !reduced) {
      $$("[data-magnetic]", root).forEach(function (el) {
        el.addEventListener("mousemove", function (e) {
          var r = el.getBoundingClientRect();
          el.style.transform = "translate(" + (e.clientX - r.left - r.width / 2) * 0.22 + "px," + (e.clientY - r.top - r.height / 2) * 0.3 + "px)";
        });
        el.addEventListener("mouseleave", function () { el.style.transform = ""; });
      });
      $$("[data-hover-list]", root).forEach(function (list) {
        var box = document.createElement("div");
        box.className = "hover-img";
        box.setAttribute("aria-hidden", "true");
        var imgs = {};
        $$(".svc", list).forEach(function (row) {
          var src = row.getAttribute("data-img");
          if (!src || imgs[src]) return;
          var im = new Image(); im.src = src; im.alt = ""; box.appendChild(im); imgs[src] = im;
        });
        body.appendChild(box);
        var bx = 0, by = 0, tx = 0, ty = 0, on = false, alive = true;
        onCleanup(function () { alive = false; box.remove(); });
        (function follow() {
          if (!alive) return;
          bx += (tx - bx) * 0.12; by += (ty - by) * 0.12;
          box.style.left = bx + "px"; box.style.top = by + "px";
          requestAnimationFrame(follow);
        })();
        list.addEventListener("mousemove", function (e) { tx = e.clientX + 200; ty = e.clientY; if (!on) { bx = tx; by = ty; } });
        $$(".svc", list).forEach(function (row) {
          row.addEventListener("mouseenter", function () {
            on = true; box.classList.add("is-visible");
            Object.keys(imgs).forEach(function (k) { imgs[k].classList.toggle("is-active", k === row.getAttribute("data-img")); });
          });
        });
        list.addEventListener("mouseleave", function () { on = false; box.classList.toggle("is-visible", false); });
      });
    }

    /* Mobile carousel dots for the stacking cards */
    $$("[data-stack]", root).forEach(function (track) {
      var dots = $$(".stack-dots i", track.parentNode);
      if (!dots.length) return;
      var cards = $$(".stack-card", track);
      var busy = false;
      /* A card that only peeks in from the edge keeps its colour but hides its words,
         so no sliced letters show; the words fade in as the card slides into view. */
      function peek() {
        var swipe = track.scrollWidth > track.clientWidth + 2, rt = track.getBoundingClientRect();
        cards.forEach(function (c) {
          var rc = c.getBoundingClientRect();
          var seen = (Math.min(rc.right, rt.right) - Math.max(rc.left, rt.left)) / (rc.width || 1);
          c.classList.toggle("is-peek", swipe && seen < 0.94);
        });
      }
      track.addEventListener("scroll", function () {
        if (busy) return; busy = true;
        requestAnimationFrame(function () {
          var mid = track.scrollLeft + track.clientWidth / 2, best = 0, bestD = Infinity;
          cards.forEach(function (c, i) { var d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (d < bestD) { bestD = d; best = i; } });
          dots.forEach(function (d, i) { d.classList.toggle("is-on", i === best); });
          peek();
          busy = false;
        });
      }, { passive: true });
      peek();
      var peekT; function onPeekResize() { clearTimeout(peekT); peekT = setTimeout(peek, 150); }
      window.addEventListener("resize", onPeekResize);
      onCleanup(function () { clearTimeout(peekT); window.removeEventListener("resize", onPeekResize); });
    });

    /* Marquees: clone group for a seamless loop */
    $$(".marquee__track", root).forEach(function (track) {
      var group = $(".marquee__group", track);
      if (!group || track.children.length > 1) return;
      var clone = group.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      track.appendChild(clone);
    });

    /* Testimonial wall: duplicate cards for a seamless loop */
    $$("[data-wall] .wall__col", root).forEach(function (col) {
      if (col.dataset.cloned) return; col.dataset.cloned = "1";
      Array.prototype.slice.call(col.children).forEach(function (card) {
        var c = card.cloneNode(true); c.setAttribute("aria-hidden", "true"); col.appendChild(c);
      });
    });

    /* FAQ */
    $$(".faq__item", root).forEach(function (item) {
      var q = $(".faq__q", item);
      if (!q) return;
      q.addEventListener("click", function () {
        var open = item.classList.toggle("is-open");
        q.setAttribute("aria-expanded", open ? "true" : "false");
        setTimeout(function () { if (window.ScrollTrigger) window.ScrollTrigger.refresh(); }, 650);
      });
    });

    /* Testimonial slider */
    $$("[data-quotes]", root).forEach(function (qroot) {
      var slides = $$(".quote-slide", qroot);
      var bar = $(".quotes__bar", qroot);
      var cur = $(".quotes__count b", qroot);
      var total = $(".quotes__count span", qroot);
      var i = 0, timer = null, DUR = 9000;
      if (total) total.textContent = String(slides.length).padStart(2, "0");
      function show(n) {
        slides[i].classList.remove("is-active");
        i = (n + slides.length) % slides.length;
        slides[i].classList.add("is-active");
        if (cur) cur.textContent = String(i + 1).padStart(2, "0");
        run();
      }
      function run() {
        clearTimeout(timer);
        if (bar) { bar.classList.remove("is-running"); void bar.offsetWidth; bar.style.setProperty("--dur", DUR + "ms"); bar.classList.add("is-running"); }
        if (!reduced) timer = setTimeout(function () { show(i + 1); }, DUR);
      }
      onCleanup(function () { clearTimeout(timer); });
      var prev = $("[data-prev]", qroot), next = $("[data-next]", qroot);
      if (prev) prev.addEventListener("click", function () { show(i - 1); });
      if (next) next.addEventListener("click", function () { show(i + 1); });
      var started = false;
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) { if (en.isIntersecting && !started) { started = true; run(); } });
        }, { threshold: 0.3 });
        io.observe(qroot);
        onCleanup(function () { io.disconnect(); });
      } else run();
    });

    /* Story filters */
    var filterBar = $("[data-filters]", root);
    if (filterBar) {
      var chips = $$(".chip", filterBar);
      var stories = $$(".story", root);
      chips.forEach(function (chip) {
        var f = chip.getAttribute("data-filter");
        var n = f === "all" ? stories.length : stories.filter(function (s) { return (s.getAttribute("data-cat") || "").indexOf(f) > -1; }).length;
        if (!chip.querySelector("sup")) { var sup = document.createElement("sup"); sup.textContent = n; chip.appendChild(sup); }
        chip.addEventListener("click", function () {
          chips.forEach(function (c) { c.classList.remove("is-active"); c.setAttribute("aria-pressed", "false"); });
          chip.classList.add("is-active"); chip.setAttribute("aria-pressed", "true");
          stories.forEach(function (s) {
            var show = f === "all" || (s.getAttribute("data-cat") || "").indexOf(f) > -1;
            s.classList.toggle("is-hidden", !show);
          });
          if (window.ScrollTrigger) window.ScrollTrigger.refresh();
        });
      });
    }

    initForms(root);
  }

  function initForms(root) {
  /* ==========================================================================
     CLARITY COMPASS — a 60-second fit quiz that routes visitors to the right
     path and carries their answers into the enquiry form.
     ========================================================================== */
  var PATHS = {
    coaching: {
      title: '1:1 Peak Now <em>Coaching</em>',
      text: "You've built real results, but they're costing you your energy, your people or your joy. Six or twelve months one-on-one with Daniel rewires the beliefs and habits behind it, so achievement finally feels like something.",
      url: "coaching.html", program: "coaching-12", label: "1:1 Peak Now Coaching"
    },
    vip: {
      title: 'VIP Day <em>Intensive</em>',
      text: "You want to compress time. One full, in-person day with Daniel to release the blocks holding you back and leave with clarity, alignment, momentum and a plan for the road ahead.",
      url: "coaching.html#vip", program: "vip", label: "VIP Day Intensive"
    },
    ignition: {
      title: 'IGNITION <em>for men</em>',
      text: "You built the business, the family and the life, and you're ready to sharpen your edge. Sixteen weeks, four phases and twelve men who refuse to drift: physically, mentally and spiritually.",
      url: "ignition.html", program: "ignition", label: "IGNITION (men's cohort)"
    },
    speaking: {
      title: 'Keynotes <em>&amp; workshops</em>',
      text: "Bring Daniel to your stage. The Perfect Circle of Performance leaves rooms fired up about peak performance, self-love and a champion's mindset, told by someone who lived every word.",
      url: "speaking.html#enquire", program: "speaking", label: "Speaking enquiry"
    }
  };
  var FORMAT_LABEL = { ongoing: "One-on-one, six to twelve months", day: "One full day, in person", cohort: "Small group of men", event: "Keynote or workshop" };
  var TIMING_LABEL = { now: "Ready to start now", soon: "In the next month or two", exploring: "Just exploring" };

  $$("[data-compass]", root).forEach(function (root) {
    var steps = $$(".compass__step", root);
    var result = $(".compass__result", root);
    var bars = $$(".compass__progress i", root);
    var answers = {};
    var idx = 0;
    function go(n) {
      steps.forEach(function (s, k) { s.classList.toggle("is-active", k === n); });
      result.classList.remove("is-active");
      bars.forEach(function (b, k) { b.classList.toggle("is-done", k < n); });
      idx = n;
    }
    function score() {
      var tally = { coaching: 0, vip: 0, ignition: 0, speaking: 0 };
      Object.keys(answers).forEach(function (k) {
        var v = answers[k];
        if (v.path) v.path.split(" ").forEach(function (p) { tally[p] = (tally[p] || 0) + 1; });
      });
      var best = "coaching", max = -1;
      ["coaching", "vip", "ignition", "speaking"].forEach(function (p) { if (tally[p] > max) { max = tally[p]; best = p; } });
      return best;
    }
    function finish() {
      var best = score();
      var p = PATHS[best];
      var fmt = (answers.format && answers.format.value) || "ongoing";
      var tim = (answers.timing && answers.timing.value) || "exploring";
      $(".compass__result-title", result).innerHTML = p.title;
      $(".compass__result-text", result).textContent = p.text;
      $(".compass__result-tags", result).innerHTML =
        "<span>" + FORMAT_LABEL[fmt] + "</span><span>" + TIMING_LABEL[tim] + "</span>";
      var learn = $("[data-result-learn]", result);
      if (learn) learn.setAttribute("href", p.url);
      var send = $("[data-result-send]", result);
      if (send) send.setAttribute("href", best === "speaking" ? "speaking.html#enquire" : "apply.html?program=" + p.program + "&timing=" + tim + "#application");
      store.set("pl_compass", JSON.stringify({ path: best, program: p.program, format: fmt, timing: tim }));
      steps.forEach(function (s) { s.classList.remove("is-active"); });
      bars.forEach(function (b) { b.classList.add("is-done"); });
      result.classList.add("is-active");
    }
    steps.forEach(function (step, k) {
      $$(".option", step).forEach(function (opt) {
        opt.addEventListener("click", function () {
          $$(".option", step).forEach(function (o) { o.classList.remove("is-selected"); o.setAttribute("aria-pressed", "false"); });
          opt.classList.add("is-selected"); opt.setAttribute("aria-pressed", "true");
          answers[step.getAttribute("data-key")] = { path: opt.getAttribute("data-path"), value: opt.getAttribute("data-value") };
          setTimeout(function () { k < steps.length - 1 ? go(k + 1) : finish(); }, 280);
        });
      });
      var back = $(".compass__back", step);
      if (back) back.addEventListener("click", function () { if (k > 0) go(k - 1); });
    });
    var restart = $(".compass__restart", root);
    if (restart) restart.addEventListener("click", function () { answers = {}; $$(".option", root).forEach(function (o) { o.classList.remove("is-selected"); }); go(0); });
    go(0);
  });

  /* ==========================================================================
     APPLICATION — Anne's multi-step form engine, generalised: any number of
     steps, choice / check / scale groups, prefilled from ?program= or from the
     path finder, carries Scorecard results, posts JSON (or opens email).
     ========================================================================== */
  var form = $("[data-enquiry]", root);
  if (form) {
    var fSteps = $$(".form__step", form);
    var fBars = $(".form__steps", form);
    if (fBars && !fBars.children.length) fBars.innerHTML = fSteps.map(function () { return "<i></i>"; }).join("");
    fBars = $$(".form__steps i", form);
    var fCount = $(".form__count", form);
    var btnNext = $("[data-form-next]", form);
    var btnBack = $("[data-form-back]", form);
    var btnLabel = btnNext ? $(".btn__label", btnNext) : null;
    var cur = 0;

    var params = new URLSearchParams(window.location.search);
    var saved = {};
    try { saved = JSON.parse(store.get("pl_compass") || "{}"); } catch (e) { saved = {}; }
    var pre = { program: params.get("program") || saved.program, start: params.get("timing") || saved.timing };
    var START = { now: "Within 30 days", soon: "In 1–3 months", exploring: "Just exploring" };
    if (pre.start && START[pre.start]) pre.start = START[pre.start];
    Object.keys(pre).forEach(function (k) {
      if (!pre[k]) return;
      var input = form.querySelector('input[name="' + k + '"][value="' + pre[k] + '"]');
      if (input) input.checked = true;
    });
    var score = null;
    try { score = JSON.parse(store.get("pl_score") || "null"); } catch (e) { score = null; }
    var scoreNote = $("[data-score-note]", form);
    if (score && scoreNote) { scoreNote.hidden = false; $("b", scoreNote).textContent = score.profile + " · Achievement " + score.achievement + " / Fulfillment " + score.fulfillment; }

    function showStep(n) {
      fSteps.forEach(function (s, k) { s.classList.toggle("is-active", k === n); });
      fBars.forEach(function (b, k) { b.classList.toggle("is-done", k <= n); });
      if (fCount) fCount.textContent = "Step " + (n + 1) + " of " + fSteps.length;
      if (btnBack) btnBack.hidden = n === 0;
      if (btnLabel) btnLabel.textContent = n === fSteps.length - 1 ? (form.getAttribute("data-send-label") || "Send to Daniel") : "Continue";
      cur = n;
    }
    function validate(step) {
      var ok = true;
      $$(".field", step).forEach(function (f) { f.classList.remove("has-error"); });
      $$("[required]", step).forEach(function (input) {
        var field = input.closest(".field");
        var valid = input.type === "email" ? validEmail(input.value) : input.value.trim().length > 0;
        if (!valid) { ok = false; if (field) field.classList.add("has-error"); }
      });
      $$("[data-require-choice]", step).forEach(function (group) {
        var name = group.getAttribute("data-require-choice");
        if (!form.querySelector('input[name="' + name + '"]:checked')) {
          ok = false;
          group.classList.remove("shake"); void group.offsetWidth; group.classList.add("shake");
          var hint = step.querySelector(".form__hint");
          if (hint) { hint.style.color = "var(--claret)"; setTimeout(function () { hint.style.color = ""; }, 1600); }
        }
      });
      return ok;
    }
    function labelOf(input) {
      var span = input.parentNode.querySelector("span");
      return span ? span.firstChild.textContent.trim() : input.value;
    }
    function summary() {
      var out = {}, seen = {};
      $$("input, select, textarea", form).forEach(function (el) {
        if (!el.name || el.name === "_gotcha" || seen[el.name]) return;
        seen[el.name] = 1;
        var q = (el.closest("[data-q]") || {}).getAttribute ? el.closest("[data-q]").getAttribute("data-q") : el.name;
        var v;
        if (el.type === "radio") { var c = form.querySelector('input[name="' + el.name + '"]:checked'); v = c ? labelOf(c) : ""; }
        else if (el.type === "checkbox") v = $$('input[name="' + el.name + '"]:checked', form).map(labelOf).join(", ");
        else v = el.value.trim();
        if (v) out[q || el.name] = v;
      });
      if (score) out["Scorecard"] = score.profile + " (Achievement " + score.achievement + " / Fulfillment " + score.fulfillment + ", levers: " + score.levers + ")";
      return out;
    }
    function submit() {
      if (form.elements._gotcha && form.elements._gotcha.value) return;
      var data = summary();
      var name = (form.elements.name && form.elements.name.value) || "";
      if (btnNext) btnNext.setAttribute("aria-busy", "true");
      deliver(form.getAttribute("data-kind") || "application", (form.getAttribute("data-subject") || "Peak Life Now application") + " — " + name, data).then(function (how) {
        form.classList.add("is-sent");
        var nm = $("[data-sent-name]", form);
        if (nm) nm.textContent = name.split(" ")[0] || "friend";
        var dl = $("[data-sent-summary]", form);
        if (dl) dl.innerHTML = Object.keys(data).filter(function (k) { return ["Name", "Email", "Phone"].indexOf(k) < 0; }).slice(0, 6).map(function (k) { return "<div><dt>" + escHTML(k) + "</dt><dd>" + escHTML(data[k]) + "</dd></div>"; }).join("");
        if (lenis) lenis.scrollTo(form, { offset: -120 }); else form.scrollIntoView();
        store.set("pl_compass", "");
        if (how !== "mailto") toast("Sent. Daniel will be in touch " + (CFG.replyPromise || "soon") + ".");
      }).catch(function () { if (btnNext) btnNext.removeAttribute("aria-busy"); toast("Something went wrong. Please email " + CFG.email + "."); });
    }
    if (btnNext) btnNext.addEventListener("click", function (e) {
      e.preventDefault();
      if (!validate(fSteps[cur])) return;
      if (cur < fSteps.length - 1) { showStep(cur + 1); scrollIntoForm(); } else submit();
    });
    if (btnBack) btnBack.addEventListener("click", function (e) { e.preventDefault(); if (cur > 0) { showStep(cur - 1); scrollIntoForm(); } });
    form.addEventListener("submit", function (e) { e.preventDefault(); if (btnNext) btnNext.click(); });
    function scrollIntoForm() {
      var top = form.getBoundingClientRect().top + window.scrollY - 120;
      if (window.scrollY > top) { if (lenis) lenis.scrollTo(top); else window.scrollTo({ top: top, behavior: reduced ? "auto" : "smooth" }); }
    }
    $$(".form__step", form).forEach(function (step, k) {
      if (!step.hasAttribute("data-auto")) return;
      $$('input[type="radio"]', step).forEach(function (r) {
        r.addEventListener("change", function () { setTimeout(function () { if (cur === k && k < fSteps.length - 1) showStep(k + 1); }, 320); });
      });
    });
    showStep(0);
    var preNote = $("[data-prefilled]", form);
    if (preNote && pre.program && form.querySelector('input[name="program"]:checked')) preNote.hidden = false;
  }
  if (CFG.replyPromise) $$("[data-reply-promise]", root).forEach(function (el) { el.textContent = CFG.replyPromise; });
  if (CFG.nextCohort) $$("[data-cohort]", root).forEach(function (el) { el.textContent = CFG.nextCohort; });

  /* Peak Life Scorecard */
  $$("[data-scorecard]", root).forEach(initScorecard);

  /* Simple forms: speaking enquiry, IGNITION waitlist */
  $$("form[data-form]", root).forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!checkFields(f)) { toast("Please complete the highlighted fields."); return; }
      var btn = $('[type="submit"]', f); if (btn) btn.setAttribute("aria-busy", "true");
      deliver(f.getAttribute("data-form"), f.getAttribute("data-subject") || "Website enquiry", formData(f)).then(function (how) {
        f.classList.add("is-sent");
        if (how !== "mailto") toast("Sent. Daniel's team will reply " + (CFG.replyPromise || "soon") + ".");
      }).catch(function () { if (btn) btn.removeAttribute("aria-busy"); toast("Something went wrong. Please email " + CFG.email + "."); });
    });
    $$("input, textarea, select", f).forEach(function (el) {
      el.addEventListener("input", function () { var w = el.closest(".field"); if (w) w.classList.remove("has-error"); });
    });
  });
  }

  /* ==========================================================================
     SHARED HELPERS — delivery, validation, toast
     ========================================================================== */
  function escHTML(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var esc = escHTML;
  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim()); }
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
    window.location.href = "mailto:" + (CFG.email || "") + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(lines.join("\n"));
    return Promise.resolve("mailto");
  }
  function formData(f) {
    var out = {};
    $$("input, select, textarea", f).forEach(function (el) {
      if (!el.name || el.disabled || el.name === "_gotcha") return;
      if (el.type === "checkbox") { if (!out[el.name]) out[el.name] = []; if (el.checked) out[el.name].push(el.value); }
      else if (el.type === "radio") { if (el.checked) out[el.name] = el.value; else if (!(el.name in out)) out[el.name] = ""; }
      else out[el.name] = el.value.trim();
    });
    return out;
  }
  function checkFields(scope) {
    var ok = true, first = null;
    $$("[required]", scope).forEach(function (el) {
      var wrap = el.closest(".field");
      var bad = (el.type === "radio" || el.type === "checkbox") ? !$$('input[name="' + el.name + '"]', scope).some(function (i) { return i.checked; })
        : (!el.value.trim() || (el.type === "email" && !validEmail(el.value)));
      if (wrap) wrap.classList.toggle("has-error", bad);
      if (bad) { ok = false; if (!first) first = el; }
    });
    if (first && first.focus && first.type !== "radio" && first.type !== "checkbox") first.focus({ preventScroll: true });
    return ok;
  }
  var toastEl = document.createElement("div");
  toastEl.className = "toast"; toastEl.setAttribute("role", "status"); toastEl.setAttribute("aria-live", "polite");
  body.appendChild(toastEl);
  var toastT;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add("is-on"); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("is-on"); }, 4200); }

  /* Morning Mastery opt-in (footer, global) */
  $$("form[data-optin]").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (f.elements._gotcha && f.elements._gotcha.value) return;
      var em = f.elements.email;
      if (!validEmail(em.value)) { em.focus(); toast("Please enter a valid email address."); return; }
      deliver("morning-mastery", "Morning Mastery Checklist request", { first_name: f.elements.first_name.value.trim(), email: em.value.trim() })
        .then(function (how) { f.classList.add("is-sent"); var ok = $(".footer__optin-ok", f); if (ok) ok.hidden = false; if (how !== "mailto") toast("Done. Check your inbox."); })
        .catch(function () { toast("Something went wrong. Please try again."); });
    });
  });

  /* ==========================================================================
     PEAK LIFE SCORECARD — data, radar, profile and the step-through tool
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
      var ctaLabel = $(".btn__label", cta); if (ctaLabel) ctaLabel.textContent = p.cta; else cta.firstChild.nodeValue = p.cta + " ";
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


  initPage($("main") || document);
})();
