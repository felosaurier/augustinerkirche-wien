/* ============================================================
   Augustinerkirche Wien — thema.js
   Farben der Titelzeile und Logo je Thema (Hauptseite), gepflegt in der
   Verwaltung unter Einstellungen → Farben & Logo, gespeichert in data/themen.json:
   {themen: {augustinerkirche|kirchenmusik|augustiner|aspersdorf:
     {leiste: "#rrggbb", schrift: "auto"|"hell"|"dunkel", logo: "gold"|"weiss"|…,
      name: "Augustinerkirche Wien", untertitel: "Pfarre & Kloster St. Augustin"}}}
   (name und untertitel leer: es bleibt der Text der Seite)
   Welches Thema eine Seite hat, steht in <html data-thema="…"> (ohne Angabe:
   augustinerkirche). Wird im <head> geladen: zuerst gilt der zuletzt gesehene
   Stand (Browser-Speicher), dann der aus der Datei; so flackert die Leiste nicht.
   Logos: assets/logo/logo-<variante>.png.
   Stellt window.AugThema bereit (auch fuer die Vorschau in der Verwaltung).
   ============================================================ */
(function (w, d) {
  'use strict';

  const html = d.documentElement;
  const script = d.currentScript;
  const ROOT = script ? new URL('..', script.src).href : '/';
  const KEY = 'aug-themen';
  const THEMEN = ['augustinerkirche', 'kirchenmusik', 'augustiner', 'aspersdorf'];
  const LOGOS = ['gold', 'gold-dunkel', 'hellgold', 'weiss', 'schwarz', 'marine', 'bordeaux', 'tannengruen', 'gruen'];
  const STANDARD = { leiste: '#10192e', schrift: 'auto', logo: 'gold', name: '', untertitel: '' };
  const NAME = 'Augustinerkirche Wien';
  const UNTERTITEL = 'Pfarre & Kloster St. Augustin';
  const text = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 60);

  /* Helle Leiste (z. B. Gold, Weiss): dunkle Schrift, sonst helle */
  function isLight(hex) {
    const n = parseInt(hex.slice(1), 16);
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    return L > 0.25;
  }
  function clean(t) {
    const x = t && typeof t === 'object' ? t : {};
    return {
      leiste: /^#[0-9a-f]{6}$/i.test(x.leiste || '') ? x.leiste.toLowerCase() : STANDARD.leiste,
      schrift: ['auto', 'hell', 'dunkel'].includes(x.schrift) ? x.schrift : 'auto',
      logo: LOGOS.includes(x.logo) ? x.logo : STANDARD.logo,
      name: text(x.name),
      untertitel: text(x.untertitel)
    };
  }
  /* CSS-Variablen der Titelzeile (css/style.css, NAVIGATION) */
  function vars(t) {
    const c = clean(t);
    const dark = c.schrift === 'dunkel' || (c.schrift === 'auto' && isLight(c.leiste));
    return dark ? {
      '--nav-bg': c.leiste, '--nav-fg': '#10192e', '--nav-fg-soft': 'rgba(16,25,46,.8)', '--nav-sub': 'rgba(16,25,46,.68)',
      '--nav-accent': '#10192e', '--nav-line': 'rgba(16,25,46,.16)', '--nav-cta-line': 'rgba(16,25,46,.45)', '--nav-cta-hover-fg': c.leiste
    } : {
      '--nav-bg': c.leiste, '--nav-fg': '#fff', '--nav-fg-soft': 'rgba(255,255,255,.84)', '--nav-sub': 'rgba(255,255,255,.62)',
      '--nav-accent': '#d8b96e', '--nav-line': 'rgba(216,185,110,.2)', '--nav-cta-line': 'rgba(216,185,110,.6)', '--nav-cta-hover-fg': '#10192e'
    };
  }
  const logoUrl = (v) => `${ROOT}assets/logo/logo-${LOGOS.includes(v) ? v : STANDARD.logo}.png`;

  let logo = '';
  let names = null;
  function setLogo() {
    if (logo) {
      for (const img of d.querySelectorAll('nav .nav-logo-img')) {
        const src = logoUrl(logo);
        if (img.src !== src) img.src = src;
        img.classList.add('v');
      }
    }
    /* Text neben dem Logo: nur wenn in der Verwaltung eingetragen */
    if (names) {
      for (const el of d.querySelectorAll('nav .nav-logo-text')) if (names.name && el.textContent !== names.name) el.textContent = names.name;
      for (const el of d.querySelectorAll('nav .nav-logo-sub')) if (names.untertitel && el.textContent !== names.untertitel) el.textContent = names.untertitel;
    }
  }
  function apply(t) {
    if (!t) return;
    const c = clean(t);
    for (const [k, v] of Object.entries(vars(c))) html.style.setProperty(k, v);
    const meta = d.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', c.leiste);
    logo = c.logo;
    names = { name: c.name, untertitel: c.untertitel };
    if (d.readyState !== 'loading') setLogo();
  }

  const thema = THEMEN.includes(html.dataset.thema) ? html.dataset.thema : 'augustinerkirche';
  w.AugThema = { THEMEN, LOGOS, STANDARD, NAME, UNTERTITEL, clean, vars, logoUrl, isLight, thema };
  /* Die Verwaltung braucht nur die Hilfen oben */
  if (html.dataset.thema === 'keins') return;

  try {
    const cached = JSON.parse(w.localStorage.getItem(KEY) || 'null');
    if (cached && cached[thema]) apply(cached[thema]);
  } catch { /* kein Speicher: dann erst mit der Datei */ }
  d.addEventListener('DOMContentLoaded', setLogo);

  fetch(`${ROOT}data/themen.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const all = data && data.themen;
      if (!all || typeof all !== 'object') return;
      try { w.localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* egal */ }
      apply(all[thema] || STANDARD);
    })
    .catch(() => { /* ohne Datei bleibt die Titelzeile, wie sie ist */ });
})(window, document);
