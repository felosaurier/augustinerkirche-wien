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
  const mobileNavQuery = window.matchMedia('(max-width: 1360px)');

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
  function initMobileNav() {
    const burger = qs('#hamburger');
    const menu = qs('#mob-menu');
    if (!burger || !menu) return;

    const setOpen = (open) => {
      menu.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
    };

    setOpen(false);
    burger.addEventListener('click', () => setOpen(!menu.classList.contains('open')));

    /* Ein Klick auf einen Link schliesst das Menue (Sprungziele auf derselben Seite) */
    menu.addEventListener('click', (e) => {
      if (e.target.closest('a')) setOpen(false);
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

      /* Horizontale Tab-Leiste (Hochformat): aktiven Reiter mittig zeigen */
      if (isMatch && sidebar.scrollWidth > sidebar.clientWidth) {
        sidebar.scrollTo({
          left: btn.offsetLeft - (sidebar.clientWidth - btn.offsetWidth) / 2,
          behavior: scrollBehavior()
        });
      }
    }

    for (const p of qsa('.tab-pane', area)) p.classList.toggle('active', p === pane);
    markCurrentNav();
    return true;
  }

  function initSidebarTabs() {
    /* Knoepfe mit ihrem Bereich verknuepfen, damit Screenreader den Zusammenhang kennen */
    for (const btn of qsa('.sidebar-item[data-pane]')) {
      btn.setAttribute('aria-controls', btn.dataset.pane);
      if (btn.classList.contains('active')) btn.setAttribute('aria-current', 'true');
    }

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.sidebar-item');
      const sidebar = btn && btn.closest('.sidebar');
      const paneId = btn && btn.dataset.pane;
      if (!sidebar || !paneId) return;
      e.preventDefault();
      if (activatePane(sidebar, paneId)) {
        history.replaceState(null, '', `${location.pathname}#${paneId}`);
        scheduleBleed();
        revealObserve();
      }
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
  function routeToHash() {
    const id = location.hash.slice(1);
    if (!id) return;
    const pane = document.getElementById(id);
    if (!pane || !pane.classList.contains('tab-pane')) return;
    const area = pane.closest('.tab-content-area');
    const sidebar = area && area.previousElementSibling;
    if (!sidebar) return;

    if (activatePane(sidebar, id)) {
      /* kurz warten, bis der Bereich sichtbar und vermessen ist */
      setTimeout(() => {
        const section = sidebar.closest('.with-sidebar') || pane;
        section.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
      }, 60);
    }
  }

  /* ---------- Markiert den aktiven Navigationspunkt ---------- */
  /* Seiten mit Reitern (z. B. Kirchenmusik): nur der Eintrag des geoeffneten
     Bereichs gilt als aktuell, nicht jeder Link auf diese Seite. */
  function markCurrentNav() {
    const path = location.pathname.replace(/\/+$/, '');
    const current = path.split('/').pop() || 'index.html';
    const activePane = qs('.tab-pane.active');
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

  /* ---------- Init ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    initDropdowns();
    initMobileNav();
    initSidebarTabs();
    initSakrChips();
    markCurrentNav();
    initAttributeFilter('.week-filter-btn[data-filter]', '.week-row', 'day');

    routeToHash();
    bleedBands();
    window.addEventListener('resize', scheduleBleed);
    window.addEventListener('load', bleedBands);
    revealObserve();
  });

  window.addEventListener('hashchange', () => {
    routeToHash();
    bleedBands();
  });
})();
