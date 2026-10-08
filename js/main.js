/* ============================================================
   Augustinerkirche Wien — main.js
   Globale Logik: Navigation, mobiles Menue, Sidebar-Tabs,
   Hash-Routing, Wochenfilter, Scroll-Reveal via IntersectionObserver.
   Alle Module pruefen defensiv, ob die benoetigten DOM-Knoten
   auf der jeweiligen Seite ueberhaupt existieren.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Hilfsfunktionen ---------- */
  const qs = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* Weiches Scrollen nur, wenn die Nutzerin/der Nutzer Bewegung nicht reduziert hat */
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scrollBehavior = () => (reducedMotion.matches ? 'auto' : 'smooth');

  /* Ab dieser Breite ersetzt das Hamburger-Menue die Dropdowns (siehe style.css) */
  const mobileNavQuery = window.matchMedia('(max-width: 1120px)');

  /* ---------- Dropdown-Menues (Event-Delegation) ---------- */
  function closeAllDropdowns() {
    for (const item of qsa('.nav-item.open')) item.classList.remove('open');
    for (const btn of qsa('.nav-btn[aria-expanded="true"]')) btn.setAttribute('aria-expanded', 'false');
  }

  function initDropdowns() {
    const nav = qs('nav');
    if (!nav) return;

    nav.addEventListener('click', (e) => {
      const btn = e.target.closest('.nav-btn');
      const item = btn && btn.closest('.nav-item');
      if (!item) return;
      const wasOpen = item.classList.contains('open');
      closeAllDropdowns();
      if (!wasOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });

    /* Tastatur: verlaesst der Fokus ein offenes Menue, schliesst es sich */
    nav.addEventListener('focusout', (e) => {
      const item = e.target.closest('.nav-item.open');
      if (item && !item.contains(e.relatedTarget)) closeAllDropdowns();
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.nav-item')) closeAllDropdowns();
    });

    /* Escape schliesst und setzt den Fokus zurueck auf den ausloesenden Knopf */
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const open = qs('.nav-item.open');
      if (!open) return;
      closeAllDropdowns();
      const btn = qs('.nav-btn', open);
      if (btn && open.contains(document.activeElement)) btn.focus();
    });
  }

  /* ---------- Mobile Navigation ---------- */
  const CHEVRON = '<svg viewBox="0 0 10 6" fill="none" stroke-width="1.8" aria-hidden="true" focusable="false"><path d="M1 1l4 4 4-4"/></svg>';
  const escHTML = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  /* Das Handy-Menue entsteht aus dem Laptop-Menue, damit beide immer dieselben
     Eintraege haben: oben drei Schnellzugriffe (Gottesdienste, Kalender, Kontakt), darunter die Bereiche zum Aufklappen. */
  function buildMobileMenu(menu) {
    const center = qs('.nav-center');
    const logo = qs('.nav-logo-wrap');
    if (!center || !logo) return;
    const base = (logo.getAttribute('href') || 'index.html').replace(/index\.html$/, '');
    const quick = [
      ['Gottesdienste', `${base}pages/gottesdienste.html`],
      ['Kalender', `${base}pages/kalender.html`],
      ['Kontakt', `${base}index.html#kontakt`]
    ];
    let html = '<div class="mob-quick">' +
      quick.map(([t, h]) => `<a class="mob-quick-link" href="${escHTML(h)}">${escHTML(t)}</a>`).join('') + '</div>';
    for (const item of qsa('.nav-item', center)) {
      const btn = qs('.nav-btn', item);
      const id = `mob-${item.id}`;
      html += `<div class="mob-sec" data-item="${escHTML(item.id)}">` +
        `<button type="button" class="mob-sec-btn" aria-expanded="false" aria-controls="${id}">` +
        `${escHTML(btn.textContent.trim())}${CHEVRON}</button><div class="mob-sec-panel" id="${id}" hidden>`;
      for (const group of qsa('.mega-group', item)) {
        const label = qs('.mega-group-label', group);
        if (label) html += `<span class="mob-group-title">${escHTML(label.textContent.trim())}</span>`;
        for (const a of qsa('a', group)) html += `<a class="mob-sub" href="${escHTML(a.getAttribute('href'))}">${escHTML(a.textContent.trim())}</a>`;
      }
      html += '</div></div>';
    }
    menu.innerHTML = html;
  }

  function setSection(btn, open) {
    btn.setAttribute('aria-expanded', String(open));
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (panel) panel.hidden = !open;
  }

  function initMobileNav() {
    const burger = qs('#hamburger');
    const menu = qs('#mob-menu');
    if (!burger || !menu) return;
    buildMobileMenu(menu);

    const setOpen = (open) => {
      menu.classList.toggle('open', open);
      document.documentElement.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
      if (!open) return;
      /* Der Bereich der aktuellen Seite ist beim Oeffnen schon aufgeklappt */
      if (!qs('.mob-sec-btn[aria-expanded="true"]', menu)) {
        const sec = qsa('.mob-sec', menu).find((el) => {
          const item = document.getElementById(el.dataset.item);
          return qs('.mob-sub.current', el) || (item && qs('.nav-btn.current', item));
        });
        if (sec) setSection(qs('.mob-sec-btn', sec), true);
      }
      menu.scrollTop = 0;
    };

    setOpen(false);
    burger.addEventListener('click', () => setOpen(!menu.classList.contains('open')));

    menu.addEventListener('click', (e) => {
      const secBtn = e.target.closest('.mob-sec-btn');
      if (secBtn) {
        setSection(secBtn, secBtn.getAttribute('aria-expanded') !== 'true');
        return;
      }
      const a = e.target.closest('a');
      if (!a) return;
      setOpen(false);
      /* Gleicher Bereich wie in der Adresszeile: kein hashchange, also selbst hinspringen */
      if (a.pathname === location.pathname && a.hash && a.hash === location.hash) {
        e.preventDefault();
        const target = hashTarget();
        if (target) target.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('open')) {
        setOpen(false);
        burger.focus();
      }
    });

    /* Wird das Fenster breiter als der Handy-Umbruch, darf das Menue nicht offen bleiben */
    mobileNavQuery.addEventListener('change', (e) => {
      if (!e.matches) setOpen(false);
    });
  }

  /* ---------- Sidebar-Tabs ---------- */
  /* Schaltet in einer Sidebar auf den Bereich paneId um; true bei Erfolg */
  function activatePane(sidebar, paneId) {
    const area = sidebar && sidebar.nextElementSibling;
    const pane = document.getElementById(paneId);
    if (!area || !pane || !area.contains(pane)) return false;

    for (const btn of qsa('.sidebar-item', sidebar)) {
      const isMatch = btn.dataset.pane === paneId;
      btn.classList.toggle('active', isMatch);
      if (isMatch) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
      if (isMatch) {
        const current = qs('.sidebar-toggle-current', sidebar);
        if (current) current.textContent = btn.textContent.trim();
      }
    }
    setSidebarOpen(sidebar, false);

    for (const p of qsa('.tab-pane', area)) p.classList.toggle('active', p === pane);
    markCurrentNav();
    return true;
  }

  /* Handy und Tablet: das Seitenmenue klappt unter einem Umschalter auf,
     der den geoeffneten Bereich nennt (Laptop: Liste links, siehe style.css) */
  function setSidebarOpen(sidebar, open) {
    const toggle = qs('.sidebar-toggle', sidebar);
    if (!toggle) return;
    sidebar.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  }

  function buildSidebarToggle(sidebar, index) {
    const items = qsa('.sidebar-item', sidebar);
    const list = document.createElement('div');
    list.className = 'sidebar-list';
    list.id = `sidebar-list-${index}`;
    list.append(...sidebar.childNodes);
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'sidebar-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', list.id);
    const active = items.find((b) => b.classList.contains('active')) || items[0];
    toggle.innerHTML = `<span class="sidebar-toggle-current">${escHTML(active ? active.textContent.trim() : '')}</span>` +
      `<span class="sidebar-toggle-hint">${items.length} Bereiche</span>${CHEVRON}`;
    sidebar.append(toggle, list);
  }

  /* Ablauf: am Ende jedes Bereichs geht es zum vorigen und naechsten weiter */
  function buildPaneSteps(sidebar) {
    const items = qsa('.sidebar-item[data-pane]', sidebar);
    items.forEach((btn, i) => {
      const pane = document.getElementById(btn.dataset.pane);
      if (!pane || qs('.pane-steps', pane)) return;
      const prev = items[i - 1];
      const next = items[i + 1];
      if (!prev && !next) return;
      const step = (b, cls, dir) => (b
        ? `<a class="pane-step ${cls}" href="#${b.dataset.pane}"><span class="pane-step-dir">${dir}</span>` +
          `<span class="pane-step-name">${escHTML(b.textContent.trim())}</span></a>`
        : '<span></span>');
      /* div statt nav: die Hauptnavigation ist in style.css als nav gestaltet */
      const nav = document.createElement('div');
      nav.className = 'pane-steps';
      nav.setAttribute('role', 'navigation');
      nav.setAttribute('aria-label', 'Weitere Bereiche dieser Seite');
      nav.innerHTML = step(prev, 'prev', 'Zurück') + step(next, 'next', 'Weiter');
      pane.append(nav);
    });
  }

  /* Ist der Anfang des Bereichs schon aus dem Bild gescrollt, dorthin zurueck */
  function scrollToSection(sidebar) {
    const section = sidebar.closest('.with-sidebar');
    const nav = qs('nav');
    if (section && section.getBoundingClientRect().top < (nav ? nav.offsetHeight : 0)) {
      section.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    }
  }

  function initSidebarTabs() {
    qsa('.sidebar').forEach((sidebar, i) => {
      buildSidebarToggle(sidebar, i);
      buildPaneSteps(sidebar);
    });
    /* Knoepfe mit ihrem Bereich verknuepfen, damit Screenreader den Zusammenhang kennen */
    for (const btn of qsa('.sidebar-item[data-pane]')) {
      btn.setAttribute('aria-controls', btn.dataset.pane);
      if (btn.classList.contains('active')) btn.setAttribute('aria-current', 'true');
    }

    document.addEventListener('click', (e) => {
      const toggle = e.target.closest('.sidebar-toggle');
      if (toggle) {
        const sb = toggle.closest('.sidebar');
        setSidebarOpen(sb, !sb.classList.contains('open'));
        return;
      }
      /* Klick neben das offene Menue schliesst es */
      for (const sb of qsa('.sidebar.open')) if (!sb.contains(e.target)) setSidebarOpen(sb, false);

      const btn = e.target.closest('.sidebar-item');
      const sidebar = btn && btn.closest('.sidebar');
      const paneId = btn && btn.dataset.pane;
      if (!sidebar || !paneId) return;
      e.preventDefault();
      if (activatePane(sidebar, paneId)) {
        history.replaceState(null, '', `${location.pathname}#${paneId}`);
        scrollToSection(sidebar);
        scheduleBleed();
        revealObserve();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const sb = qs('.sidebar.open');
      if (!sb) return;
      setSidebarOpen(sb, false);
      qs('.sidebar-toggle', sb).focus();
    });
  }

  /* ---------- Sakramente-Band ueber die volle Bildschirmbreite ----------
     Das Band liegt im Textbereich (neben dem Seitenmenue) und wird per
     negativem Rand bis an beide Bildschirmraender gezogen. Dazu wird der
     Rand zuerst zurueckgesetzt, die natuerliche linke Kante gemessen und
     dann genau um diesen Betrag nach links verschoben. */
  function bleedBands() {
    for (const band of qsa('.sakr-band-inline')) {
      if (!band.offsetParent) continue; /* verborgener Tab: nichts zu messen */
      band.style.marginLeft = '0px';
      band.style.width = 'auto';
      const left = band.getBoundingClientRect().left;
      band.style.marginLeft = `${-left}px`;
      band.style.width = `${document.documentElement.clientWidth}px`;
    }
  }
  /* Beim Ziehen des Fensters feuert resize sehr oft: hoechstens einmal pro Frame messen */
  let bleedFrame = 0;
  function scheduleBleed() {
    if (bleedFrame) return;
    bleedFrame = requestAnimationFrame(() => {
      bleedFrame = 0;
      bleedBands();
    });
  }

  /* ---------- URL-Hash-Routing ---------- */
  /* Sprungziel der Adresse: ein Reiter (Bereich wird geoeffnet, Ziel ist der
     Anfang des Bereichs) oder ein beliebiges Element mit dieser id */
  function hashTarget() {
    const id = decodeURIComponent(location.hash.slice(1));
    const el = id && document.getElementById(id);
    if (!el) return null;
    if (!el.classList.contains('tab-pane')) return el;
    const area = el.closest('.tab-content-area');
    const sidebar = area && area.previousElementSibling;
    if (!sidebar || !activatePane(sidebar, id)) return null;
    return sidebar.closest('.with-sidebar') || el;
  }

  function routeToHash() {
    const target = hashTarget();
    /* Nur Reiter selbst anfahren; andere Ziele scrollt der Browser */
    if (!target || target.id === location.hash.slice(1)) return;
    /* kurz warten, bis der Bereich sichtbar und vermessen ist */
    setTimeout(() => target.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }), 60);
  }

  /* Beim Oeffnen einer Seite mit Sprungziel (z. B. index.html#kontakt) laden
     Hochaemter, Neuigkeiten und Personen erst danach und schieben das Ziel nach
     unten. Bis alles steht, wird es deshalb immer wieder oben ausgerichtet;
     sobald man selbst scrollt, tippt oder eine Taste drueckt, hoert das auf. */
  function holdHashTarget() {
    const target = hashTarget();
    if (!target) return;
    const events = ['wheel', 'touchstart', 'keydown', 'mousedown'];
    let done = false;
    const jump = () => {
      if (!done) target.scrollIntoView({ behavior: 'instant', block: 'start' });
    };
    const ro = 'ResizeObserver' in window ? new ResizeObserver(jump) : null;
    const stop = () => {
      done = true;
      if (ro) ro.disconnect();
      for (const ev of events) window.removeEventListener(ev, stop);
    };
    for (const ev of events) window.addEventListener(ev, stop, { passive: true });
    if (ro) ro.observe(document.body);
    window.addEventListener('load', () => {
      jump();
      setTimeout(stop, 3000);
    }, { once: true });
    setTimeout(stop, 8000);
    requestAnimationFrame(jump);
  }

  /* ---------- Markiert den aktiven Navigationspunkt ---------- */
  /* Seiten mit Reitern (z. B. Kirchenmusik): nur der Eintrag des geoeffneten
     Bereichs gilt als aktuell, nicht jeder Link auf diese Seite. */
  function markCurrentNav() {
    const path = location.pathname.replace(/\/+$/, '');
    const current = path.split('/').pop() || 'index.html';
    const activePane = qs('.tab-pane.active');
    /* Startseite: Sprungmarken wie index.html#pfarre machen keinen Bereich zum aktuellen */
    if (current === 'index.html') return;
    for (const a of qsa('.mega a, .mob-sub')) {
      const [href, hash] = (a.getAttribute('href') || '').split('#');
      const page = href.split('/').pop();
      const onPage = Boolean(page) && page === current;
      const isCurrent = onPage && (!hash || !activePane || !document.getElementById(hash) || hash === activePane.id);
      a.classList.toggle('current', isCurrent);
      if (isCurrent) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
      const navItem = a.closest('.nav-item');
      const btn = navItem && qs('.nav-btn', navItem);
      if (btn && onPage) btn.classList.add('current');
    }
  }

  /* ---------- Filter ueber data-Attribute (z. B. Wochenueberblick) ----------
     Knoepfe tragen data-filter, Zeilen das Attribut data-<attr>; 'alle'/'all' zeigt alles. */
  function initAttributeFilter(buttonSelector, rowSelector, attr) {
    const buttons = qsa(buttonSelector);
    if (!buttons.length) return;

    for (const btn of buttons) {
      btn.setAttribute('aria-pressed', String(btn.classList.contains('active')));
      btn.addEventListener('click', () => {
        for (const b of buttons) {
          b.classList.toggle('active', b === btn);
          b.setAttribute('aria-pressed', String(b === btn));
        }
        const value = btn.dataset.filter;
        const showAll = value === 'alle' || value === 'all';
        /* Zeilen erst beim Klick suchen: sie koennen nachgeladen sein (js/inhalte.js) */
        for (const row of qsa(rowSelector)) row.style.display = showAll || row.dataset[attr] === value ? '' : 'none';
      });
    }
  }

  /* ---------- Scroll-Reveal via IntersectionObserver ---------- */
  let revealObserver = null;
  function revealObserve() {
    const targets = qsa('.reveal:not(.in)');
    if (!targets.length) return;

    if (!('IntersectionObserver' in window)) {
      for (const el of targets) el.classList.add('in');
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('in');
          revealObserver.unobserve(entry.target);
        }
      }, { threshold: 0.12 });
    }
    for (const el of targets) revealObserver.observe(el);
  }

  /* ---------- Sakramente-Band: Sprung zu Bereich oder Abschnitt ---------- */
  function initSakrChips() {
    document.addEventListener('click', (e) => {
      /* Aspersdorf: Sprung zu einem Abschnitt innerhalb desselben Bereichs */
      const jump = e.target.closest('.sakr-chip[data-target]');
      if (jump) {
        const target = document.getElementById(jump.dataset.target);
        if (target) target.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
        return;
      }
      /* Sakramente: den passenden Tab oeffnen */
      const chip = e.target.closest('.sakr-chip[data-pane]');
      const sidebar = chip && qs('.sidebar');
      if (!sidebar || !activatePane(sidebar, chip.dataset.pane)) return;
      history.replaceState(null, '', `${location.pathname}#${chip.dataset.pane}`);
      const section = sidebar.closest('.with-sidebar');
      if (section) section.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
      revealObserve();
    });
  }

  /* ---------- E-Mail-Adressen entschluesseln ----------
     Gegenstueck zu HochamtData.mailHTML: aus data-mail wird ein normaler
     mailto-Link. Auch fuer Inhalte, die spaeter nachgeladen werden
     (Kontaktleiste, Runden, Personen, Fenster der Neuigkeiten). */
  function decodeMail() {
    for (const a of qsa('a.mail[data-mail]')) {
      const addr = [...a.dataset.mail.replace('|', '@')].reverse().join('');
      const subject = a.dataset.subject;
      a.href = `mailto:${addr}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
      /* Nur die Ersatzschreibweise name(at)… ersetzen, eine Beschriftung wie "CDs bestellen" bleibt */
      if (a.textContent.includes('(at)')) a.textContent = addr;
      a.removeAttribute('data-mail');
    }
  }
  /* ---------- Bildnachweise ----------
     data/bildnachweise.json ordnet Bildern (Pfad ab der Website-Wurzel) ihren
     Nachweis zu, z. B. "© Augustiner Wien, Foto: …". Er steht klein unter dem
     Bild; bei Titelfotos (Hintergrundbild) unten in der Ecke. Gilt auch fuer
     Bilder, die spaeter nachgeladen werden (Personen, Runden, Neuigkeiten). */
  const siteRoot = (() => {
    const s = qs('script[src$="js/main.js"]');
    return s ? new URL('..', s.src).pathname : '/';
  })();
  /* Rahmen, die zum Bild gehoeren (Bildfeld einer Karte, Link um das Bild) */
  const BOX = /(^|[-\s])(img|thumb|cover|foto|photo)([-\s]|$)/;
  let credits = null;

  function creditFor(url) {
    if (!credits || !url) return '';
    let path;
    try {
      path = decodeURIComponent(new URL(url, location.href).pathname);
    } catch {
      return '';
    }
    if (!path.startsWith(siteRoot)) return '';
    return credits[path.slice(siteRoot.length)] || '';
  }

  function creditEl(text, over) {
    const el = document.createElement('small');
    el.className = over ? 'bn bn-over' : 'bn';
    el.textContent = text;
    return el;
  }

  function applyCredits() {
    if (!credits) return;
    for (const img of qsa('img:not([data-bn])')) {
      img.dataset.bn = '';
      const text = creditFor(img.currentSrc || img.getAttribute('src'));
      if (!text || img.closest('.mobile-menu, nav, footer')) continue;
      /* Zum Bild gehoerende Rahmen mitnehmen, damit der Text darunter steht */
      let box = img;
      for (let i = 0; i < 3; i++) {
        const p = box.parentElement;
        if (!p || p.matches('main, section, li, .tab-pane, .tab-content-area')) break;
        const single = p.children.length === 1 && /^(A|PICTURE|SPAN)$/.test(p.tagName);
        if (!single && !BOX.test(p.className)) break;
        box = p;
      }
      /* Rahmen um Bild und Nachweis nimmt den Platz des Bildes im Layout ein */
      const cs = getComputedStyle(box);
      const wrap = document.createElement('span');
      wrap.className = 'bn-wrap';
      for (const prop of ['flex', 'alignSelf', 'gridColumn', 'gridRow', 'order', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft']) {
        wrap.style[prop] = cs[prop];
      }
      if (cs.position === 'sticky') {
        wrap.style.position = 'sticky';
        wrap.style.top = cs.top;
      }
      box.style.margin = '0';
      box.replaceWith(wrap);
      wrap.append(box, creditEl(text));
    }
    /* Titelfotos als Hintergrundbild */
    for (const el of qsa('.hero-img:not([data-bn])')) {
      el.dataset.bn = '';
      const m = (el.getAttribute('style') || '').match(/url\(['"]?([^'")]+)/);
      const text = m && creditFor(m[1]);
      if (text) el.append(creditEl(text, true));
    }
  }

  async function initCredits() {
    try {
      const res = await fetch(`${siteRoot}data/bildnachweise.json`);
      if (!res.ok) return;
      credits = (await res.json()).bilder || {};
    } catch {
      return;
    }
    applyCredits();
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      /* Zeitgeber statt requestAnimationFrame: laeuft auch in Hintergrund-Tabs */
      setTimeout(() => {
        queued = false;
        applyCredits();
      }, 40);
    }).observe(document.body, { childList: true, subtree: true });
  }

  function initMail() {
    decodeMail();
    new MutationObserver(decodeMail).observe(document.body, { childList: true, subtree: true });
  }

  /* ---------- Init ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    initDropdowns();
    initMobileNav();
    initSidebarTabs();
    initSakrChips();
    initMail();
    initCredits();
    markCurrentNav();
    initAttributeFilter('.week-filter-btn[data-filter]', '.week-row', 'day');

    holdHashTarget();
    bleedBands();
    window.addEventListener('resize', scheduleBleed);
    window.addEventListener('load', bleedBands);
    revealObserve();
  });

  window.addEventListener('hashchange', () => {
    routeToHash();
    bleedBands();
    revealObserve();
  });
})();
