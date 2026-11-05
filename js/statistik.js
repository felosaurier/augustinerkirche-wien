/* ============================================================
   Augustinerkirche Wien — statistik.js
   Cookie-Hinweis und Besucherstatistik (Google Analytics 4).
   - Ohne Mess-ID (GA_ID leer) passiert nichts: kein Hinweis, keine
     Cookies, keine Verbindung zu Google. So wird die Seite ausgeliefert.
   - Mit Mess-ID wird Google Analytics erst geladen, NACHDEM der Besucher
     im Hinweis zugestimmt hat. "Ablehnen" und "Zustimmen" sind gleichwertig,
     die Website funktioniert in beiden Faellen gleich.
   - Die Entscheidung steht im localStorage ("aug-cookies") und gilt ein Jahr.
     "Cookie-Einstellungen" (Fusszeile, Datenschutzseite) oeffnet den Hinweis
     erneut; Ablehnen loescht die Analytics-Cookies wieder.
   - Gemessen wird nie auf localhost und nie in einem Browser, in dem gerade
     jemand in der Verwaltung angemeldet ist.
   Die Content-Security-Policy der Seiten erlaubt dafuer nur www.googletagmanager.com/gtag/
   (das Skript, nicht den Container-Lader gtm.js) sowie google-analytics.com und
   analytics.google.com (Messdaten).
   ============================================================ */
(function () {
  'use strict';

  /* Mess-ID des Datenstreams in Google Analytics 4 (Verwaltung > Datenstreams),
     Form "G-ABC123DEF4". Leer lassen = keine Statistik, kein Cookie-Hinweis. */
  const GA_ID = '';

  /* Laufzeit des Analytics-Cookies in Tagen; die Datenschutzerklaerung nennt sechs Monate */
  const COOKIE_TAGE = 180;

  const KEY = 'aug-cookies';
  const KEY_ADMIN = 'aug-admin-sitzung';
  const GUELTIG_MS = 365 * 24 * 3600 * 1000;

  const doc = document;
  const win = window;
  const SELF = doc.currentScript ? doc.currentScript.src : '';
  const host = location.hostname;
  const lokal = host === 'localhost' || host === '[::1]' || host.endsWith('.localhost') || /^127\.\d+\.\d+\.\d+$/.test(host);

  let choice = null;     /* true = Statistik erlaubt, false = abgelehnt, null = noch nicht gefragt */
  let gestartet = false; /* Analytics wurde auf dieser Seite schon geladen */
  let box = null;        /* der Hinweis, wird erst bei Bedarf gebaut */
  let opener = null;     /* Knopf, der den Hinweis geoeffnet hat: bekommt den Fokus zurueck */

  /* ---------- Entscheidung merken (der Speicher kann in privaten Fenstern fehlen) ---------- */
  function readChoice() {
    try {
      const v = JSON.parse(win.localStorage.getItem(KEY));
      if (v && v.v === 1 && typeof v.statistik === 'boolean' && typeof v.t === 'number' && Date.now() - v.t < GUELTIG_MS) return v.statistik;
    } catch {
      /* kein Speicher oder kaputter Eintrag: es gibt noch keine Entscheidung */
    }
    return null;
  }

  function writeChoice(ja) {
    try {
      win.localStorage.setItem(KEY, JSON.stringify({ v: 1, statistik: ja, t: Date.now() }));
    } catch {
      /* ohne Speicher gilt die Auswahl nur, bis die Seite geschlossen wird */
    }
  }

  /* Angemeldete Verwaltung: weder messen noch fragen. Das schuetzt auch die Sitzung,
     denn ein Skript von Google soll nie dort laufen, wo ein Zugang offen ist. */
  function adminAngemeldet() {
    for (const name of ['localStorage', 'sessionStorage']) {
      try {
        const s = JSON.parse(win[name].getItem(KEY_ADMIN));
        if (s && s.benutzer && s.bis > Date.now()) return true;
      } catch {
        /* naechsten Speicher pruefen */
      }
    }
    return false;
  }

  /* ---------- Google Analytics ---------- */
  function startAnalytics() {
    if (lokal) {
      console.info('Statistik: auf localhost wird nicht gemessen.');
      return;
    }
    win['ga-disable-' + GA_ID] = false;
    if (gestartet) {
      if (win.gtag) win.gtag('consent', 'update', { analytics_storage: 'granted' });
      return;
    }
    gestartet = true;
    win.dataLayer = win.dataLayer || [];
    /* gtag.js erwartet echte "arguments"-Objekte in der dataLayer */
    win.gtag = function () {
      win.dataLayer.push(arguments);
    };
    /* Nur Statistik, nie Werbung */
    win.gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' });
    win.gtag('js', new Date());
    win.gtag('config', GA_ID, {
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: COOKIE_TAGE * 24 * 3600,
      cookie_flags: location.protocol === 'https:' ? 'SameSite=Lax;Secure' : 'SameSite=Lax'
    });
    const s = doc.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    doc.head.appendChild(s);
  }

  function deleteCookies() {
    const names = doc.cookie.split(';').map((c) => c.split('=')[0].trim()).filter((n) => /^(_ga|_gid|_gat|_gac_|_gcl_)/.test(n));
    if (!names.length) return;
    /* Analytics legt seine Cookies auf die Hauptdomain; geloescht wird mit jeder moeglichen Domain */
    const parts = location.hostname.split('.');
    const domains = [''];
    for (let i = 0; i < parts.length - 1; i++) domains.push('.' + parts.slice(i).join('.'));
    domains.push(location.hostname);
    for (const n of names) {
      for (const d of domains) doc.cookie = n + '=; Max-Age=0; Path=/' + (d ? '; Domain=' + d : '');
    }
  }

  function stopAnalytics() {
    win['ga-disable-' + GA_ID] = true;
    if (gestartet && win.gtag) win.gtag('consent', 'update', { analytics_storage: 'denied' });
    deleteCookies();
  }

  function apply() {
    if (choice === true) startAnalytics();
    else if (choice === false) stopAnalytics();
  }

  /* ---------- Hinweis ---------- */
  function el(tag, cls, text) {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function privacyUrl() {
    try {
      return new URL('../pages/datenschutz.html#cookies', SELF || location.href).href;
    } catch {
      return '#';
    }
  }

  function build() {
    const wrap = el('div', 'cc');
    wrap.id = 'cc-hinweis';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'false');
    wrap.setAttribute('aria-labelledby', 'cc-titel');
    wrap.setAttribute('aria-describedby', 'cc-text');
    wrap.hidden = true;

    const inner = el('div', 'cc-box');
    inner.tabIndex = -1;
    const h = el('h2', 'cc-titel', 'Cookies und Statistik');
    h.id = 'cc-titel';
    const p = el('p', 'cc-text');
    p.id = 'cc-text';
    p.append('Mit Ihrer Zustimmung messen wir mit Google Analytics, wie unsere Website genutzt wird. Dafür werden Cookies gesetzt und Daten an Google übermittelt. Ohne Zustimmung geschieht das nicht, und die Website bleibt voll nutzbar. ');
    const a = el('a', null, 'Mehr in der Datenschutzerklärung');
    a.href = privacyUrl();
    p.append(a, '.');
    const status = el('p', 'cc-status');
    const actions = el('div', 'cc-actions');
    const no = el('button', 'cc-btn', 'Ablehnen');
    no.type = 'button';
    no.addEventListener('click', () => decide(false));
    const yes = el('button', 'cc-btn', 'Zustimmen');
    yes.type = 'button';
    yes.addEventListener('click', () => decide(true));
    actions.append(no, yes);
    inner.append(h, p, status, actions);
    wrap.append(inner);

    /* hinter dem Sprunglink: der bleibt der erste Tabulator-Stopp */
    const skip = doc.querySelector('.skip-link');
    doc.body.insertBefore(wrap, skip ? skip.nextSibling : doc.body.firstChild);
    if (win.ResizeObserver) new win.ResizeObserver(measure).observe(inner);
    return wrap;
  }

  /* Der Hinweis liegt fest am unteren Rand; die Seite bekommt so viel Platz darunter, dass
     auch die Links in der Fusszeile (Impressum, Datenschutz) frei bleiben. */
  function measure() {
    if (!box || box.hidden) return;
    doc.documentElement.style.setProperty('--cc-h', box.offsetHeight + 'px');
  }

  function show(vomBesucher) {
    if (!box) box = build();
    box.querySelector('.cc-status').textContent = choice === null ? '' : choice ? 'Ihre aktuelle Auswahl: Statistik erlaubt.' : 'Ihre aktuelle Auswahl: Statistik abgelehnt.';
    box.hidden = false;
    doc.body.classList.add('cc-offen');
    measure();
    if (vomBesucher) box.firstChild.focus();
  }

  function hide() {
    if (box) box.hidden = true;
    doc.body.classList.remove('cc-offen');
  }

  function decide(ja) {
    choice = ja;
    writeChoice(ja);
    hide();
    apply();
    if (opener && doc.contains(opener)) opener.focus();
    opener = null;
  }

  /* ---------- Start ---------- */
  function init() {
    if (!GA_ID) return;
    if (!/^G-[A-Z0-9]{6,16}$/.test(GA_ID)) {
      console.warn('Statistik: GA_ID in js/statistik.js hat nicht die Form G-ABC123DEF4, die Statistik bleibt aus.');
      return;
    }
    if (!/^https?:$/.test(location.protocol)) return;
    if (adminAngemeldet()) return;

    choice = readChoice();

    /* "Cookie-Einstellungen" in der Fusszeile und auf der Datenschutzseite */
    for (const links of doc.querySelectorAll('.f-links')) {
      const b = el('button', 'cc-open', 'Cookie-Einstellungen');
      b.type = 'button';
      links.append(b);
    }
    for (const b of doc.querySelectorAll('.cc-open[hidden]')) b.hidden = false;
    doc.addEventListener('click', (e) => {
      const b = e.target instanceof Element ? e.target.closest('.cc-open') : null;
      if (!b) return;
      e.preventDefault();
      opener = b;
      show(true);
    });

    /* eine Entscheidung in einem anderen Tab gilt sofort auch hier */
    win.addEventListener('storage', (e) => {
      if (e.key !== KEY) return;
      choice = readChoice();
      if (choice !== null) hide();
      apply();
    });

    if (choice === null) show(false);
    else apply();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
