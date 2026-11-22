/* ============================================================
   Augustinerkirche Wien — thema.js
   Farben der Titelzeile und Logo je Thema (Hauptseite), gepflegt in der
   Verwaltung unter Einstellungen → Farben & Logo, gespeichert in data/themen.json:
   {themen: {startseite|augustinerkirche|kirchenmusik|augustiner|aspersdorf:
     {leiste: "#rrggbb", schrift: "auto"|"hell"|"dunkel", logo: "gold"|"weiss"|…,
      name: "Augustinerkirche Wien", untertitel: "Pfarre & Kloster St. Augustin"}}}
   (name und untertitel leer: es bleibt der Text der Seite)
   Welches Thema eine Seite hat, steht in <html data-thema="…"> (ohne Angabe:
   augustinerkirche; die Startseite hat data-thema="startseite" und nimmt ohne eigenen
   Eintrag den der Augustinerkirche). Wird im <head> geladen: zuerst gilt der zuletzt gesehene
   Stand (Browser-Speicher), dann der aus der Datei; so flackert die Leiste nicht.
   Logos: assets/logo/logo-<variante>.png.
   Stellt window.AugThema bereit (auch fuer die Vorschau in der Verwaltung).
   ============================================================ */
(function (w, d) {
  'use strict';

  const html = d.documentElement;
  /* Hell oder dunkel, vom Knopf in der Titelzeile gewaehlt (ohne Wahl folgt die Seite dem Geraet) */
  try {
    const modus = w.localStorage.getItem('aug-modus');
    if (modus === 'dark' || modus === 'light') html.dataset.theme = modus;
  } catch { /* ohne Speicher gilt die Einstellung des Geraets */ }
  const script = d.currentScript;
  const ROOT = script ? new URL('..', script.src).href : '/';
  const KEY = 'aug-themen';
  const THEMEN = ['startseite', 'augustinerkirche', 'kirchenmusik', 'augustiner', 'aspersdorf'];
  const LOGOS = ['gold', 'gold-dunkel', 'hellgold', 'weiss', 'schwarz', 'marine', 'bordeaux', 'tannengruen', 'gruen'];
  const STANDARD = { leiste: '#10192e', schrift: 'auto', logo: 'gold', name: '', untertitel: '' };
  const NAME = 'Augustinerkirche Wien';
  const UNTERTITEL = 'Pfarre & Kloster St. Augustin';
  const text = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 60);

  /* Sprache der Seite (<html lang>): de, en, it, fr oder es. Uebersetzte Seiten (index.en.html, pages/musik.it.html …)
     laden vorher js/sprache.js mit dem Woerterbuch window.AugWoerter = {en: {deutsch: englisch}, it: {…}}.
     AugT(text, werte) liefert die Uebersetzung (sonst den deutschen Text) und setzt {name} aus werte ein. */
  const LANG = ['en', 'it', 'fr', 'es'].includes((html.lang || '').slice(0, 2)) ? html.lang.slice(0, 2) : 'de';
  function T(s, werte) {
    const wb = LANG !== 'de' && w.AugWoerter && w.AugWoerter[LANG];
    const hit = wb && Object.prototype.hasOwnProperty.call(wb, s);
    let t = hit ? wb[s] : s;
    /* Kein Eintrag: Textregeln der Sprache (z. B. "mit P. Name", "Zentralfriedhof, Halle 4") */
    if (wb && !hit && Array.isArray(wb.TEXTREGELN)) {
      for (const [re, f] of wb.TEXTREGELN) {
        const m = re.exec(String(s));
        if (m) { t = f(m); break; }
      }
    }
    if (werte) t = String(t).replace(/\{(\w+)\}/g, (m, k) => (k in werte ? werte[k] : m));
    return t;
  }
  T.lang = LANG;
  /* Eintrag im Woerterbuch (z. B. Liste der Monate) oder null */
  T.wert = (k) => (LANG !== 'de' && w.AugWoerter && w.AugWoerter[LANG] && w.AugWoerter[LANG][k]) || null;
  /* Pfad einer Seite in der Sprache dieser Seite, falls es sie gibt (Dateinamen in js/sprache.js, "seiten") */
  T.seite = (pfad) => {
    const liste = LANG !== 'de' && w.AugWoerter && w.AugWoerter.seiten;
    const datei = String(pfad).replace(/[?#].*$/, '').split('/').pop();
    if (!liste || !liste.includes(datei)) return pfad;
    return String(pfad).replace(/\.html(?=$|[?#])/, `.${LANG}.html`);
  };
  /* Uhrzeiten in der Sprache der Seite: Englisch im 12-Stunden-Format ("18:30" -> "6:30 pm",
     "11:00 Uhr" -> "11:00 am"), sonst unveraendert */
  T.uhr = (s) => {
    const text = String(s == null ? '' : s);
    if (LANG !== 'en') return text;
    return text.replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b(\s*Uhr)?/g, (_, h, m) => `${Number(h) % 12 || 12}:${m} ${Number(h) < 12 ? 'am' : 'pm'}`);
  };
  /* Eintrag fuer einen Schluessel, der sich mit einem anderen deutschen Text deckt (z. B. "Gottesdienste" als
     Knopf und als Gruppe im Kalender): in der Sprache der Seite der Eintrag k, sonst der deutsche Text de */
  T.x = (k, de) => {
    const wb = LANG !== 'de' && w.AugWoerter && w.AugWoerter[LANG];
    return wb && Object.prototype.hasOwnProperty.call(wb, k) ? wb[k] : de;
  };
  /* Wochentag (deutscher Name) in der Sprache der Seite */
  const WT_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  T.wtag = (name) => {
    const l = T.wert('WOCHENTAGE');
    const i = WT_DE.indexOf(name);
    return l && i >= 0 ? l[i] : name;
  };
  /* Tagesbezeichnung des Kirchenjahres ("28. Sonntag im Jahreskreis · Lesejahr C"): Teile getrennt durch " · ",
     erst das Woerterbuch, dann die Regeln REGELN [[Muster, Funktion(match)]] */
  T.tag = (s) => {
    if (LANG === 'de') return s;
    const regeln = T.wert('REGELN') || [];
    return String(s).split(' · ').map((teil) => {
      const t = teil.trim();
      const wb = w.AugWoerter[LANG];
      if (Object.prototype.hasOwnProperty.call(wb, t)) return wb[t];
      for (const [re, f] of regeln) {
        const m = re.exec(t);
        if (m) return f(m);
      }
      return t;
    }).join(' · ');
  };
  /* Namen mit Titel und Ensembles aus den Hochamt-Daten ("Dechant P. Mag. … OSA", "KMD …",
     "Kammerchor & Orchester von St. Augustin"): Titel aus TITEL [[deutsch, Uebersetzung]] */
  T.person = (s) => {
    let t = String(s == null ? '' : s);
    if (LANG === 'de') return t;
    const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const [de, tr] of T.wert('TITEL') || []) t = t.replace(new RegExp(`(^|[\\s(])${esc(de)}(?=[\\s)]|$)`, 'g'), (_, v) => v + tr);
    const m = /^(.+?)\s+von St\. Augustin$/.exec(t);
    if (m) return `${m[1].split(' & ').map((x) => T(x)).join(' & ')} ${T('von St. Augustin')}`;
    return T(t);
  };
  w.AugT = T;

  /* Relative Helligkeit (WCAG) und Kontrastverhaeltnis zweier Farben */
  function lum(hex) {
    const n = parseInt(hex.slice(1), 16);
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  }
  function ratio(a, b) {
    const x = lum(a);
    const y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  /* Helle Leiste (z. B. Gold, Weiss): dunkle Schrift, sonst helle. Entscheidend ist,
     mit welcher Schrift (#10192e oder Weiss) der Kontrast groesser ist. */
  function isLight(hex) {
    return ratio(hex, '#10192e') >= ratio(hex, '#ffffff');
  }
  /* Kontrast der Schrift (nach Einstellung) zur Leistenfarbe */
  function contrast(t) {
    const c = clean(t);
    const dark = c.schrift === 'dunkel' || (c.schrift === 'auto' && isLight(c.leiste));
    return ratio(c.leiste, dark ? '#10192e' : '#ffffff');
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
    /* Text neben dem Logo: der in der Verwaltung eingetragene Name und Untertitel des Bereichs;
       leer gelassen bleibt der Text der Vorlage (tools/vorlagen/nav.html) */
    if (names) {
      /* Uebersetzte Seiten: der Untertitel steht in der Vorlage schon in der Sprache, ein deutscher aus der Verwaltung gilt dort nur mit Uebersetzung */
      /* Beim Umbruch nie nach dem St. trennen */
      const nb = (s) => String(s || '').replace(/St\. /g, 'St. ');
      const name = names.name && nb(T(names.name));
      const unter = names.untertitel && (LANG === 'de' || T(names.untertitel) !== names.untertitel) ? nb(T(names.untertitel)) : '';
      for (const el of d.querySelectorAll('nav .nav-logo-text')) if (name && el.textContent !== name) el.textContent = name;
      for (const el of d.querySelectorAll('nav .nav-logo-sub')) if (unter && el.textContent !== unter) el.textContent = unter;
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

  /* Kleine Bildfassungen fuers Handy: data/bilder-klein.json listet die Bilder, zu denen es "<name>-m.webp" gibt
     (erzeugt von tools/bilder-klein.py und beim Hochladen in der Verwaltung). klein(pfad) liefert auf schmalen
     Bildschirmen die kleine Fassung, sonst das Original; ready ist erfuellt, sobald die Liste da ist. */
  let kleinListe = new Set();
  const schmal = w.matchMedia ? w.matchMedia('(max-width: 900px)') : { matches: false };
  const kleinReady = fetch(`${ROOT}data/bilder-klein.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => { kleinListe = new Set((data && Array.isArray(data.bilder) ? data.bilder : []).filter((x) => typeof x === 'string')); })
    .catch(() => { /* ohne Liste gelten die Originale */ });
  w.AugBild = {
    ready: kleinReady,
    klein: (pfad) => (schmal.matches && kleinListe.has(pfad) ? String(pfad).replace(/\.webp$/, '-m.webp') : pfad),
    /* Fuer Vorschaubilder (Fotogitter): die kleine Fassung auf jedem Bildschirm, die grosse erst in der Vergroesserung */
    vorschau: (pfad) => (kleinListe.has(pfad) ? String(pfad).replace(/\.webp$/, '-m.webp') : pfad)
  };

  /* Farben der Website, gepflegt in der Verwaltung unter Werkzeuge → Farben, gespeichert in
     data/farben.json: {farben: {<k>: "#rrggbb"}}, nur was vom Standard (css/style.css) abweicht.
     Sie gelten in der hellen Ansicht. Im Dunkelmodus behalten die Variablen, die er selbst
     festlegt (DUNKEL), seine Werte; die uebrigen (z. B. Hellgold) gelten auch dort.
     gegen: Hintergrund fuer die Pruefung der Lesbarkeit (Farbe oder Schluessel einer Farbe). */
  const FARBEN = [
    { k: 'blau', name: 'Dunkelblau', wo: 'Überschriften, dunkle Flächen und Knöpfe', std: '#10192e', vars: ['--blue', '--blue-deep'], gegen: '#ffffff' },
    { k: 'gold', name: 'Gold', wo: 'Links, Akzente und Linien auf hellem Grund', std: '#8f6b25', vars: ['--gold'], gegen: '#ffffff' },
    { k: 'gold-dunkel', name: 'Gold beim Darüberfahren', wo: 'Gold, wenn man mit der Maus auf einen Link zeigt', std: '#7a5b1f', vars: ['--gold-h'], gegen: '#ffffff' },
    { k: 'gold-schrift', name: 'Gold für kleine Schrift', wo: 'Überzeilen und kleine goldene Texte', std: '#7f5f20', vars: ['--gold-text'], gegen: '#ffffff' },
    { k: 'hellgold', name: 'Hellgold', wo: 'Gold auf dunklem Grund, z. B. in der Titelzeile und im Handy-Menü', std: '#d8b96e', vars: ['--gold-l'], gegen: 'blau' },
    { k: 'gold-blass', name: 'Blasses Gold', wo: 'Markierungen und helle Goldflächen', std: '#f6efdc', vars: ['--gold-pale'] },
    { k: 'text', name: 'Fließtext', wo: 'normaler Text', std: '#1f2535', vars: ['--text'], gegen: '#ffffff' },
    { k: 'text-mittel', name: 'Text mittel', wo: 'Untertitel und Beschreibungen', std: '#4a5063', vars: ['--text-mid'], gegen: '#ffffff' },
    { k: 'text-hell', name: 'Text hell', wo: 'Nebeninfos wie Datum oder Bildnachweis', std: '#5f6574', vars: ['--text-light'], gegen: 'grund-warm' },
    { k: 'grund-sanft', name: 'Hintergrund sanft', wo: 'leicht getönte Abschnitte und Flächen', std: '#faf8f3', vars: ['--bg-soft'] },
    { k: 'grund-warm', name: 'Hintergrund warm', wo: 'beige Abschnitte', std: '#f4efe3', vars: ['--bg-warm'] },
    { k: 'linie', name: 'Linien', wo: 'Trennlinien und Rahmen', std: '#e4dfd3', vars: ['--line'] }
  ];
  const DUNKEL = new Set(['--blue', '--gold', '--gold-h', '--gold-text', '--gold-pale', '--text', '--text-mid', '--text-light', '--bg-soft', '--bg-warm', '--line']);
  const hex6 = (v) => (/^#[0-9a-f]{6}$/i.test(v || '') ? v.toLowerCase() : '');
  /* Nur gueltige Farben, die vom Standard abweichen */
  function farbenClean(x) {
    const src = x && typeof x === 'object' ? x : {};
    const out = {};
    for (const f of FARBEN) {
      const v = hex6(src[f.k]);
      if (v && v !== f.std) out[f.k] = v;
    }
    return out;
  }

  const thema = THEMEN.includes(html.dataset.thema) ? html.dataset.thema : 'augustinerkirche';
  /* Eintrag eines Themas; die Startseite hatte frueher keinen eigenen */
  const pick = (all, k) => all[k] || (k === 'startseite' ? all.augustinerkirche : null);
  w.AugThema = { THEMEN, LOGOS, STANDARD, NAME, UNTERTITEL, clean, vars, logoUrl, isLight, contrast, ratio, thema, pick, FARBEN, farbenClean };
  /* Die Verwaltung braucht nur die Hilfen oben */
  if (html.dataset.thema === 'keins') return;

  /* Farben der Website: zuerst der zuletzt gesehene Stand, dann die Datei. Beim Wechsel
     zwischen hell und dunkel (Knopf oder Geraet) neu setzen. */
  let farben = {};
  const dunkelMQ = w.matchMedia ? w.matchMedia('(prefers-color-scheme: dark)') : null;
  const istDunkel = () => html.dataset.theme === 'dark' || (html.dataset.theme !== 'light' && !!dunkelMQ && dunkelMQ.matches);
  function farbenSetzen() {
    const dunkel = istDunkel();
    for (const f of FARBEN) {
      const v = farben[f.k];
      for (const p of f.vars) {
        if (v && !(dunkel && DUNKEL.has(p))) html.style.setProperty(p, v);
        else html.style.removeProperty(p);
      }
    }
  }
  try {
    farben = farbenClean(JSON.parse(w.localStorage.getItem('aug-farben') || 'null'));
    if (Object.keys(farben).length) farbenSetzen();
  } catch { /* kein Speicher: dann erst mit der Datei */ }
  if ('MutationObserver' in w) new MutationObserver(farbenSetzen).observe(html, { attributes: true, attributeFilter: ['data-theme'] });
  if (dunkelMQ && dunkelMQ.addEventListener) dunkelMQ.addEventListener('change', farbenSetzen);
  fetch(`${ROOT}data/farben.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      farben = farbenClean(data && data.farben);
      try { w.localStorage.setItem('aug-farben', JSON.stringify(farben)); } catch { /* egal */ }
      farbenSetzen();
    })
    .catch(() => { /* offline: es bleibt der gemerkte Stand */ });

  /* Der Name neben dem Logo bleibt unsichtbar, bis der eingetragene Name feststeht: sonst blitzt kurz der
     Text aus dem HTML auf (css/style.css, .thema-wait). Spaetestens nach 0,8 s erscheint er in jedem Fall. */
  html.classList.add('thema-wait');
  const fertig = () => html.classList.remove('thema-wait');
  w.setTimeout(fertig, 800);
  let gemerkt = false;
  try {
    const cached = JSON.parse(w.localStorage.getItem(KEY) || 'null');
    if (cached && pick(cached, thema)) {
      apply(pick(cached, thema));
      gemerkt = true;
    }
  } catch { /* kein Speicher: dann erst mit der Datei */ }
  /* Gemerkter Name und Logo: sofort einsetzen, sobald die Titelzeile eingelesen ist (noch vor dem ersten
     Zeichnen der Seite). Sonst erscheint beim Wechsel in einen anderen Bereich erst die Titelzeile der
     Vorlage und kurz darauf die richtige, das sieht aus, als lade die Seite zweimal. */
  if (gemerkt && 'MutationObserver' in w) {
    const mo = new MutationObserver(() => {
      if (!d.querySelector('nav .nav-center, nav .nav-right')) return;
      mo.disconnect();
      setLogo();
      fertig();
    });
    mo.observe(html, { childList: true, subtree: true });
    d.addEventListener('DOMContentLoaded', () => mo.disconnect());
  }
  d.addEventListener('DOMContentLoaded', () => {
    setLogo();
    if (gemerkt) fertig();
  });

  fetch(`${ROOT}data/themen.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const all = data && data.themen;
      if (!all || typeof all !== 'object') return;
      try { w.localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* egal */ }
      apply(pick(all, thema) || STANDARD);
    })
    .catch(() => { /* ohne Datei bleibt die Titelzeile, wie sie ist */ })
    .finally(() => {
      if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', fertig);
      else fertig();
    });
})(window, document);
