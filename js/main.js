/* ============================================================
   Augustinerkirche Wien — main.js
   Globale Logik: Navigation, mobiles Menue, Sidebar-Tabs,
   Hash-Routing, Wochenfilter, Scroll-Reveal via IntersectionObserver.
   Alle Module pruefen defensiv, ob die benoetigten DOM-Knoten
   auf der jeweiligen Seite ueberhaupt existieren.
   ============================================================ */
(function () {
  'use strict';

  /* Alte Adressen: Die Reiter zu Augustinus und Orden liegen jetzt auf augustiner.html */
  if (/\/chronik\.html$/.test(location.pathname) &&
      /^#p-(augustinus|regel|regel-geist|spiritualitaet|forschung|orden|ordensgeschichte|ordensheilige|bedeutende|berufung|vikariat|wien|links)$/.test(location.hash)) {
    const id = location.hash.replace(/^#p-(regel-geist)$/, '#p-regel').replace(/^#p-ordensgeschichte$/, '#p-orden');
    location.replace(location.pathname.replace('chronik.html', 'augustiner.html') + id);
    return;
  }

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

  /* Aufklappmenue ganz im Fenster halten: ragt es rechts oder links hinaus
     (z. B. "Augustiner" auf dem iPad quer), wird es seitlich verschoben.
     `translate` statt `transform`, weil transform die Einblend-Animation traegt. */
  function fitDropdown(item) {
    const mega = qs('.mega', item);
    if (!mega) return;
    mega.style.translate = '';
    const gap = 12;
    const vw = document.documentElement.clientWidth;
    const r = mega.getBoundingClientRect();
    let shift = 0;
    if (r.right > vw - gap) shift = vw - gap - r.right;
    if (r.left + shift < gap) shift = gap - r.left;
    if (shift) mega.style.translate = `${Math.round(shift)}px 0`;
  }

  /* ---------- Titel fuehren zu ihrer Titelseite ----------
     Ein Klick auf Augustinerkirche, Kirchenmusik oder Augustiner oeffnet zuerst
     die Titelseite (data-href) und dort das Menue dieses Titels. Auf der
     Titelseite selbst klappt der Titel nur sein Menue auf und zu. */
  const MENU_KEY = 'menue-nach-titel';
  const pagePath = (p) => p.replace(/\/index\.html$/, '/');

  function isTitlePage(btn) {
    const href = btn.dataset.href;
    return !href || pagePath(new URL(href, location.href).pathname) === pagePath(location.pathname);
  }

  /* true, wenn zur Titelseite gewechselt wird */
  function goToTitlePage(btn, itemId) {
    if (isTitlePage(btn)) return false;
    try { sessionStorage.setItem(MENU_KEY, itemId); } catch { /* ohne Speicher nur wechseln */ }
    location.href = btn.dataset.href;
    return true;
  }

  function openDropdown(item) {
    const btn = qs('.nav-btn', item);
    item.classList.add('open');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    fitDropdown(item);
  }

  let openMobileSection = null;

  function openMenuAfterTitle() {
    let id = null;
    try {
      id = sessionStorage.getItem(MENU_KEY);
      sessionStorage.removeItem(MENU_KEY);
    } catch { return; }
    const item = id && document.getElementById(id);
    if (!item || !item.classList.contains('nav-item')) return;
    if (mobileNavQuery.matches) {
      if (openMobileSection) openMobileSection(id);
    } else {
      openDropdown(item);
    }
  }

  /* Alle Aufklappmenues so hoch wie das laengste, damit sie beim
     Durchklicken dieselbe Form haben (Breite und Lage: style.css) */
  function equalizeDropdowns() {
    const megas = qsa('.nav-center .mega');
    for (const m of megas) m.style.minHeight = '';
    const h = Math.max(0, ...megas.map((m) => m.offsetHeight));
    for (const m of megas) m.style.minHeight = `${h}px`;
  }

  function initDropdowns() {
    const nav = qs('nav');
    if (!nav) return;
    equalizeDropdowns();
    if (document.fonts) document.fonts.ready.then(equalizeDropdowns);

    nav.addEventListener('click', (e) => {
      const btn = e.target.closest('.nav-btn');
      const item = btn && btn.closest('.nav-item');
      if (!item) return;
      if (goToTitlePage(btn, item.id)) return;
      const wasOpen = item.classList.contains('open');
      closeAllDropdowns();
      if (!wasOpen) openDropdown(item);
    });

    window.addEventListener('resize', () => {
      equalizeDropdowns();
      const open = qs('.nav-item.open');
      if (open) fitDropdown(open);
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
  /* Formatierung aus der Verwaltung (***fett kursiv***, **fett**, *kursiv*, __unterstrichen__,
     ~~durchgestrichen~~, [groß]…[/groß], [klein]…[/klein]), ohne Links; gleiche Regeln wie
     HochamtData.formatText, das hier nicht auf jeder Seite geladen ist */
  const FMT = /\*\*\*(?!\s)([^\n]+?)(?<!\s)\*\*\*|\*\*(?!\s)([^\n]+?)(?<!\s)\*\*|__(?!\s)([^\n]+?)(?<!\s)__|~~(?!\s)([^\n]+?)(?<!\s)~~|\*(?![\s*])([^*\n]+?)(?<!\s)\*|\[groß\]([^\n]+?)\[\/groß\]|\[klein\]([^\n]+?)\[\/klein\]/g;
  const FMT_TAGS = [['strong', 'em'], ['strong'], ['u'], ['s'], ['em'], ['span class="fs-gross"'], ['span class="fs-klein"']];
  function fmtHTML(s) {
    let html = '';
    let last = 0;
    const text = String(s ?? '');
    for (const m of text.matchAll(FMT)) {
      const k = [1, 2, 3, 4, 5, 6, 7].find((i) => m[i] !== undefined);
      const tags = FMT_TAGS[k - 1];
      html += escHTML(text.slice(last, m.index)) + tags.map((t) => `<${t}>`).join('') + fmtHTML(m[k]) + tags.slice().reverse().map((t) => `</${t.split(' ')[0]}>`).join('');
      last = m.index + m[0].length;
    }
    return html + escHTML(text.slice(last));
  }

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
      ['Kontakt', `${base}pages/augustinerkirche.html#kontakt`]
    ];
    let html = '<div class="mob-quick">' +
      quick.map(([t, h]) => `<a class="mob-quick-link" href="${escHTML(h)}">${escHTML(t)}</a>`).join('') + '</div>';
    for (const item of qsa('.nav-item', center)) {
      const btn = qs('.nav-btn', item);
      const id = `mob-${item.id}`;
      html += `<div class="mob-sec" data-item="${escHTML(item.id)}">` +
        `<button type="button" class="mob-sec-btn"${btn.dataset.href ? ` data-href="${escHTML(btn.dataset.href)}"` : ''} aria-expanded="false" aria-controls="${id}">` +
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
        const secs = qsa('.mob-sec', menu);
        const sec = secs.find((el) => {
          const item = document.getElementById(el.dataset.item);
          return item && qs('.nav-btn.current', item);
        }) || secs.find((el) => qs('.mob-sub.current', el));
        if (sec) setSection(qs('.mob-sec-btn', sec), true);
      }
      menu.scrollTop = 0;
    };

    setOpen(false);
    burger.addEventListener('click', () => setOpen(!menu.classList.contains('open')));

    /* Nach dem Wechsel auf eine Titelseite: Menue offen, nur dieser Titel aufgeklappt */
    openMobileSection = (itemId) => {
      for (const b of qsa('.mob-sec-btn', menu)) {
        setSection(b, b.closest('.mob-sec').dataset.item === itemId);
      }
      setOpen(true);
    };

    menu.addEventListener('click', (e) => {
      const secBtn = e.target.closest('.mob-sec-btn');
      if (secBtn) {
        if (goToTitlePage(secBtn, secBtn.closest('.mob-sec').dataset.item)) return;
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
  /* Adresse ohne Fehler dekodieren (kaputte %-Folgen bleiben unveraendert) */
  const safeDecode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

  /* Sprungziel der Adresse: ein Reiter (Bereich wird geoeffnet, Ziel ist der
     Anfang des Bereichs) oder ein beliebiges Element mit dieser id */
  function hashTarget() {
    const id = safeDecode(location.hash.slice(1));
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
    /* Auf einer Titelseite gilt nur ihr Titel als aktuell, auch wenn ein anderes
       Menue (z. B. Hochaemter unter Augustinerkirche) auf diese Seite zeigt */
    const titleBtn = qsa('.nav-btn[data-href]').find(isTitlePage);
    if (titleBtn) titleBtn.classList.add('current');
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
      if (btn && onPage && !titleBtn) btn.classList.add('current');
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
      /* Nur eine einfache Adresse wird ein Link; Zeichen wie ? & # : / bleiben draussen */
      if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(addr)) {
        a.href = `mailto:${addr}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
      }
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
  /* Datendatei als JSON (null, wenn sie fehlt). E-Mail-Adressen stehen darin verschluesselt
     als [[mail:ta.renitsugua|ofni]] und werden hier wieder lesbar (wie HochamtData.mailDecode;
     main.js laeuft auch auf Seiten ohne js/hochaemter-data.js) */
  async function dataJSON(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return null;
    const text = (await res.text()).replace(/\[\[mail:([^\]\s]+)\]\]/g, (_, code) => [...code.replace('|', '@')].reverse().join(''));
    return JSON.parse(text);
  }
  /* Rahmen, die zum Bild gehoeren (Bildfeld einer Karte, Link um das Bild) */
  const BOX = /(^|[-\s])(img|thumb|cover|foto|photo)([-\s]|$)/;
  let credits = null;

  /* Fuer die Vergroesserung (lightbox.js): Bildnachweis zu einer Bildadresse */
  window.AugCredit = (url) => creditFor(url);
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
    if (heroCredit) heroCredit();
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

  /* ---------- Titelbilder (Vollbild-Start der Hauptseiten) ----------
     Jede Hauptseite (Startseite, Kirchenmusik, Augustiner, Aspersdorf) nennt in
     #hero-show[data-show] ihre Datei, z. B. data/startseite.json oder
     data/startseite-kirchenmusik.json: {sekunden, bilder: [{titel, bild, ausschnitt}]},
     gepflegt in admin/startseite.html. Ohne Fotos: data-fallback (Bild),
     data-fallback-titel und data-fallback-ausschnitt. Ein Bild steht still, mehrere wechseln weich ineinander
     (nicht bei "reduzierte Bewegung"). Ein Klick oder Tipp aufs Foto zeigt Pfeile
     links und rechts zum Blaettern; solange sie da sind, wechselt das Foto nicht
     von selbst. Der Bildnachweis wechselt mit. */
  let heroCredit = null;
  const HERO_FALLBACK = [{ titel: 'Der Turm der Augustinerkirche', bild: 'assets/img/kirche/turm.webp', ausschnitt: '50% 20%' }];
  async function initHeroShow() {
    const box = qs('#hero-show');
    if (!box) return;
    /* Schrift wartet aufs erste Foto (hoechstens 0,6 s), damit beide gleich einblenden (style.css) */
    box.classList.add('is-loading');
    const deadline = new Promise((r) => setTimeout(r, 600));
    let data = null;
    try {
      const res = await fetch(`${siteRoot}${box.dataset.show}`);
      if (res.ok) data = await res.json();
    } catch {
      /* ohne Daten bleibt das Standardbild */
    }
    let items = data && Array.isArray(data.bilder)
      ? data.bilder.filter((b) => b && typeof b.bild === 'string' && !/^[a-z]+:|\.\.|^[/\\]/i.test(b.bild)) : [];
    if (!items.length && box.dataset.fallback) {
      items = [{ titel: box.dataset.fallbackTitel || '', bild: box.dataset.fallback, ausschnitt: box.dataset.fallbackAusschnitt || '' }];
    }
    if (!items.length) items = HERO_FALLBACK;
    const secs = Math.min(30, Math.max(3, Number(data && data.sekunden) || 6));
    const url = (b) => encodeURI(`${siteRoot}${b.bild}`);

    const slides = items.map((b) => {
      const el = document.createElement('div');
      el.className = 'hero-slide';
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', String(b.titel || ''));
      el.setAttribute('aria-hidden', 'true');
      if (/^\d{1,3}% \d{1,3}%$/.test(b.ausschnitt || '')) el.style.backgroundPosition = b.ausschnitt;
      box.append(el);
      return el;
    });
    const load = (i) => new Promise((resolve) => {
      const el = slides[i];
      if (!el.style.backgroundImage) el.style.backgroundImage = `url("${url(items[i])}")`;
      const img = new Image();
      img.onload = img.onerror = resolve;
      img.src = url(items[i]);
    });

    const credit = document.createElement('small');
    credit.className = 'bn bn-over';
    credit.hidden = true;
    box.append(credit);
    let cur = -1;
    heroCredit = () => {
      const text = cur >= 0 ? creditFor(url(items[cur])) : '';
      credit.textContent = text;
      credit.hidden = !text;
    };

    function show(i) {
      if (i === cur) return;
      cur = i;
      slides.forEach((el, k) => {
        el.classList.toggle('is-on', k === i);
        el.setAttribute('aria-hidden', String(k !== i));
      });
      heroCredit();
      if (slides.length > 1) load((i + 1) % slides.length);
    }

    await Promise.race([load(0), deadline]);
    slides[0].classList.add('is-first');
    slides[0].addEventListener('animationend', () => slides[0].classList.remove('is-first'), { once: true });
    box.classList.remove('is-loading');
    show(0);
    if (slides.length < 2) return;

    const go = (to) => {
      const next = (to + slides.length) % slides.length;
      load(next).then(() => show(next));
    };
    const arrow = (dir) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `hero-arrow hero-arrow-${dir < 0 ? 'prev' : 'next'}`;
      b.setAttribute('aria-label', dir < 0 ? 'Voriges Foto' : 'Nächstes Foto');
      b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${dir < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}"/></svg>`;
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        go(cur + dir);
        reveal();
      });
      return b;
    };
    let hideTimer = 0;
    function reveal() {
      box.classList.add('show-arrows');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => box.classList.remove('show-arrows'), 5000);
    }
    box.classList.add('hero-multi');
    box.append(arrow(-1), arrow(1));
    box.addEventListener('click', () => {
      if (box.classList.contains('show-arrows')) {
        clearTimeout(hideTimer);
        box.classList.remove('show-arrows');
      } else {
        reveal();
      }
    });
    box.addEventListener('focusin', () => clearTimeout(hideTimer));

    setInterval(() => {
      if (reducedMotion.matches || document.hidden || box.classList.contains('show-arrows') || box.contains(document.activeElement)) return;
      go(cur + 1);
    }, secs * 1000);
  }

  /* ---------- Hinweisbanner (data/hinweise.json) ----------
     Wichtige Hinweise (Kirche geschlossen, Pfarrgemeinderatswahl …), in der
     Verwaltung unter Einstellungen → Hinweisbanner gepflegt. Sichtbar von "von"
     bis einschliesslich "bis" (Datum oder Datum mit Uhrzeit), danach
     verschwindet der Banner von selbst. Wegklicken gilt bis zum Schliessen
     des Browsers (sessionStorage), ein geaenderter Text erscheint wieder. */
  const BANNER_KEY = 'aug-hinweise-zu';
  const bannerTime = (v, end) => {
    const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?$/.exec(String(v || ''));
    if (!m) return NaN;
    return new Date(`${m[1]}T${m[2] || (end ? '23:59:59' : '00:00')}`).getTime();
  };
  function bannerActive(h, now) {
    if (!h || h.aktiv === false || !h.titel) return false;
    const from = h.von ? bannerTime(h.von, false) : -Infinity;
    const to = h.bis ? bannerTime(h.bis, true) : Infinity;
    return !Number.isNaN(from) && !Number.isNaN(to) && from <= now && now <= to;
  }
  /* Kennung samt Inhalt: wird der Text geaendert, erscheint der Banner wieder */
  const bannerSig = (h) => {
    const str = `${h.id}|${h.titel}|${h.text}|${h.link}`;
    let x = 0;
    for (let i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) | 0;
    return `${h.id}:${(x >>> 0).toString(36)}`;
  };
  function bannerClosed() {
    try {
      return JSON.parse(window.sessionStorage.getItem(BANNER_KEY)) || [];
    } catch {
      return [];
    }
  }
  function bannerLink(link) {
    const v = String(link || '').trim();
    if (/^https?:\/\//i.test(v)) return v;
    if (/^(pages\/|index\.html|data\/|assets\/)/.test(v)) return `${siteRoot}${v}`;
    return '';
  }
  /* ---------- Sprüche (data/sprueche.json) ----------
     Die Zitat-Bänder unten auf den Seiten (.quote-band) zeigen die Sprüche aus der
     Verwaltung (Einstellungen → Sprüche): zuerst ein zufälliger, dann wechseln sie
     weich nacheinander (alle "sekunden"; nicht bei "reduzierte Bewegung", nicht
     solange das Band nicht zu sehen ist). Ohne Datei bleibt der Spruch im HTML. */
  async function initQuotes() {
    const bands = qsa('.quote-band');
    if (!bands.length) return;
    let data = null;
    try {
      data = await dataJSON(`${siteRoot}data/sprueche.json`);
    } catch {
      return;
    }
    const list = ((data && data.sprueche) || []).filter((s) => s && String(s.text || '').trim());
    if (!list.length) return;
    const secs = Math.min(60, Math.max(4, Number(data.sekunden) || 10));
    for (const band of bands) {
      const qt = qs('.qt', band);
      const src = qs('.qt-src', band);
      if (!qt) continue;
      let i = Math.floor(Math.random() * list.length);
      const show = (k) => {
        qt.textContent = String(list[k].text).trim().replace(/^[„"“]+|[“"”]+$/g, '');
        if (src) {
          src.textContent = String(list[k].quelle || '').trim();
          src.hidden = !src.textContent;
        }
      };
      show(i);
      if (list.length < 2) continue;
      /* nur wechseln, wenn das Band gerade im Fenster zu sehen ist */
      const visible = () => {
        const r = band.getBoundingClientRect();
        return r.bottom > 0 && r.top < window.innerHeight;
      };
      setInterval(() => {
        if (reducedMotion.matches || document.hidden || !visible()) return;
        band.classList.add('qt-out');
        setTimeout(() => {
          i = (i + 1) % list.length;
          show(i);
          band.classList.remove('qt-out');
        }, 600);
      }, secs * 1000);
    }
  }

  async function initBanner() {
    const host = qs('main');
    if (!host) return;
    let list;
    try {
      const data = await dataJSON(`${siteRoot}data/hinweise.json`);
      if (!data) return;
      list = data.hinweise || [];
    } catch {
      return;
    }
    const path = location.pathname;
    const home = path === siteRoot || path === `${siteRoot}index.html`;
    const closed = bannerClosed();
    const now = Date.now();
    const show = list.filter((h) => bannerActive(h, now) && (h.seiten !== 'start' || home) && (h.wegklickbar === false || !closed.includes(bannerSig(h))))
      /* Wichtiges zuerst */
      .sort((a, b) => (b.art === 'wichtig') - (a.art === 'wichtig'));
    if (!show.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'site-banners';
    wrap.innerHTML = show.map((h) => {
      const href = bannerLink(h.link);
      const ext = /^https?:/i.test(href) && !href.startsWith(location.origin);
      const wichtig = h.art === 'wichtig';
      return `<section class="site-banner${wichtig ? ' is-wichtig' : ''}" aria-label="${wichtig ? 'Wichtiger Hinweis' : 'Hinweis'}" data-sig="${escHTML(bannerSig(h))}">` +
        '<div class="site-banner-in">' +
          `<svg class="site-banner-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${wichtig
            ? '<path d="M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'
            : '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'}</svg>` +
          '<div class="site-banner-body">' +
            `<strong class="site-banner-title">${escHTML(h.titel)}</strong>` +
            (h.text ? `<span class="site-banner-text">${h.text.split('\n').map(fmtHTML).join('<br>')}</span>` : '') +
            (href ? `<a class="site-banner-link" href="${escHTML(href)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${escHTML(h.linktext || 'Mehr erfahren')}</a>` : '') +
          '</div>' +
          /* wegklickbar: false = Hinweis bleibt stehen (in der Verwaltung einstellbar) */
          (h.wegklickbar !== false
            ? `<button type="button" class="site-banner-close" aria-label="Hinweis ausblenden: ${escHTML(h.titel)}">` +
              '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'
            : '') +
        '</div></section>';
    }).join('');
    host.prepend(wrap);
    wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('.site-banner-close');
      if (!btn) return;
      const box = btn.closest('.site-banner');
      try {
        window.sessionStorage.setItem(BANNER_KEY, JSON.stringify([...bannerClosed(), box.dataset.sig].slice(-30)));
      } catch {
        /* ohne Speicher nur fuer diese Seite ausblenden */
      }
      const next = box.nextElementSibling;
      box.remove();
      if (!wrap.children.length) wrap.remove();
      else if (next && qs('.site-banner-close', next)) qs('.site-banner-close', next).focus();
    });
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
    initHeroShow();
    initCredits();
    initBanner();
    initQuotes();
    markCurrentNav();
    openMenuAfterTitle();

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
