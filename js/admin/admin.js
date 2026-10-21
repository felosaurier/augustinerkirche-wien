/* ============================================================
   Augustinerkirche Wien — admin.js
   Gemeinsame Grundlage der Verwaltung (Ordner admin/):
   - Anmeldung: Zugänge stehen in admin/zugaenge.json, Passwörter
     nur als Prüfsumme (PBKDF2-SHA256 mit Salz). Die Sitzung liegt
     im Browser und endet nach 4 Stunden ohne Aktivität oder beim
     Abmelden. Ohne gültige Sitzung geht es sofort zur Anmeldung.
   - Kopfleiste mit Navigation, Name und Abmelden
   - Projektordner (Chrome/Edge, File System Access API): einmal
     verbinden, dann gilt die Verbindung für alle Werkzeuge
     (der Ordner wird in IndexedDB gemerkt).
   - Speichern: direkt in den Projektordner, sonst als Download
     mit Angabe, wohin die Datei gehört.
   - Server-Modus: Liegt die Verwaltung auf einem Webserver, der
     Änderungen annimmt (Antwortkopf X-Aug-Schreiben: ja, siehe
     tools/server), gibt es keinen Projektordner. Dateien werden
     direkt auf dem Server gelesen (GET), geschrieben (PUT) und
     gelöscht (DELETE).
   - Meldungen (Toast), Rückfragen, Fenster, Formularfehler,
     Listen-Eingabe, Bilder in WebP, Änderungsprotokoll.

   Hinweis zur Sicherheit: Die Anmeldung hier hält Unbefugte nur in
   der Oberfläche fern; ändern lässt sich die öffentliche Website
   über den Projektordner (commit und push) oder, im Server-Modus,
   über den Webserver. Dort schützt die Anmeldung des Webservers
   (Basic Auth) und die Liste der beschreibbaren Pfade.

   Wird im <head> nach js/hochaemter-data.js geladen (ohne defer).
   ============================================================ */
(function (w, d) {
  'use strict';

  const HD = w.HochamtData;
  const ROOT = d.documentElement;
  const PUBLIC = ROOT.dataset.adm === 'public';

  /* Die Verwaltung gehoert nicht in einen fremden Rahmen (Clickjacking): ein <iframe> auf
     einer anderen Seite bekommt nur eine leere Seite. Ein Server-Header (X-Frame-Options)
     waere besser, das geht bei einer statischen Seite aber nicht. */
  if (w.top !== w.self) {
    ROOT.style.display = 'none';
    try {
      w.top.location.href = w.self.location.href;
    } catch {
      /* ueber fremde Adresse geblockt: die Seite bleibt verborgen */
    }
  }
  const ACCOUNTS = 'admin/zugaenge.json';
  const KEY_SESSION = 'aug-admin-sitzung';
  const KEY_FAILS = 'aug-admin-fehlversuche';
  const KEY_LOG = 'aug-admin-protokoll';
  const IDLE_MS = 4 * 60 * 60 * 1000;
  const ITER = 600000;
  const MIN_PW = 12;

  const { esc, pad } = HD;
  const $ = (id) => d.getElementById(id);

  /* ---------- Speicher im Browser (kann in privaten Fenstern fehlen) ---------- */
  const store = (() => {
    for (const name of ['localStorage', 'sessionStorage']) {
      try {
        const s = w[name];
        s.setItem('aug-probe', '1');
        s.removeItem('aug-probe');
        return s;
      } catch {
        /* naechsten Speicher versuchen */
      }
    }
    return null;
  })();
  function get(key) {
    try {
      return JSON.parse(store.getItem(key));
    } catch {
      return null;
    }
  }
  function put(key, value) {
    try {
      store.setItem(key, JSON.stringify(value));
    } catch {
      /* Speicher voll oder gesperrt */
    }
  }
  function drop(key) {
    try {
      store.removeItem(key);
    } catch {
      /* nichts zu tun */
    }
  }

  /* ---------- Sitzung ---------- */
  function session() {
    const s = get(KEY_SESSION);
    return s && s.benutzer && s.bis > Date.now() ? s : null;
  }
  const pageName = () => location.pathname.split('/').pop() || 'index.html';

  /* Rollen: "admin" darf zusaetzlich Zugaenge verwalten, "redaktion" pflegt
     Inhalte. Zugaenge ohne Angabe (aus der ersten Fassung) gelten als Admin. */
  /* Ohne Angabe gilt "admin" (so entstanden die ersten Zugaenge). Steht aber etwas anderes als
     "admin" da (ein Tippfehler, eine Zahl), gilt die Redaktion, und ohne Zugang auch: im Zweifel
     weniger Rechte. */
  /* "entwickler" steht ueber "admin": darf alles wie ein Admin und dazu die
     Mitteilungen der Verwaltung schreiben; nur Entwickler vergeben diese Rolle. */
  const ROLES = ['redaktion', 'admin', 'entwickler'];
  const roleOf = (acc) => {
    if (!acc) return 'redaktion';
    const raw = acc.rolle;
    if (raw === undefined || raw === null || raw === '') return 'admin';
    const r = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    return r === 'admin' || r === 'entwickler' ? r : 'redaktion';
  };
  /* Admin oder hoeher */
  const adminRole = (acc) => roleOf(acc) !== 'redaktion';
  const isAdmin = () => adminRole(session());
  const isDev = () => roleOf(session()) === 'entwickler';

  /* Rechte der Redaktion: Bereiche (je eine Seite der Verwaltung) und einzelne
     Runden. Admins duerfen alles. Redaktionszugaenge ohne Angabe "rechte" (aus
     der Zeit davor) duerfen ebenfalls alles, damit niemand ausgesperrt wird.
     Gespeichert als rechte: { bereiche: [Schluessel], runden: [Runden-IDs] };
     der Schluessel "runden" bedeutet alle Runden samt Anlegen, Loeschen und
     Reihenfolge, sonst nur die einzeln genannten Runden bearbeiten. */
  const AREAS = [
    { key: 'neuigkeiten', label: 'Neuigkeiten', group: 'Aktuelles', page: 'neuigkeiten.html' },
    { key: 'termine', label: 'Termine (Ausflüge, Feste …)', group: 'Aktuelles', page: 'termine.html' },
    { key: 'startseite', label: 'Titelfotos der Hauptseiten', group: 'Einstellungen', page: 'startseite.html' },
    { key: 'hinweise', label: 'Hinweisbanner (oben auf der Website)', group: 'Einstellungen', page: 'hinweise.html' },
    { key: 'sprueche', label: 'Sprüche (Zitate unten auf den Seiten)', group: 'Einstellungen', page: 'sprueche.html' },
    { key: 'design', label: 'Farben & Logo der Hauptseiten', group: 'Einstellungen', page: 'design.html' },
    { key: 'rechtliches', label: 'Impressum & Datenschutz', group: 'Einstellungen', page: 'rechtliches.html' },
    { key: 'hochaemter', label: 'Hochämter', group: 'Kirchenmusik', page: 'hochaemter.html' },
    { key: 'solisten', label: 'Solisten', group: 'Kirchenmusik', page: 'solisten.html' },
    { key: 'paten', label: 'Paten, Spenden & Möglichkeiten', group: 'Kirchenmusik', page: 'paten.html' },
    { key: 'cds', label: 'CDs', group: 'Kirchenmusik', page: 'cds.html' },
    { key: 'musik-personen', label: 'Leitung & Organisten', group: 'Kirchenmusik', page: 'personen.html' },
    { key: 'repertoire', label: 'Repertoire', group: 'Kirchenmusik', page: 'repertoire.html' },
    { key: 'gottesdienste', label: 'Regelmäßige Termine', group: 'Pfarre & Kloster', page: 'gottesdienste.html' },
    { key: 'wochenkalender', label: 'Wochenkalender', group: 'Pfarre & Kloster', page: 'wochenkalender.html' },
    { key: 'kontakt', label: 'Pfarrkanzlei & Kontakt', group: 'Pfarre & Kloster', page: 'kontakt.html' },
    { key: 'rundgang', label: 'Kirchenrundgang', group: 'Pfarre & Kloster', page: 'rundgang.html' },
    { key: 'pgr', label: 'Pfarrgemeinderat', group: 'Pfarre & Kloster', page: 'pgr.html' },
    { key: 'mitbrueder', label: 'Mitbrüder', group: 'Pfarre & Kloster', page: 'personen.html' }
  ];
  /* "Runden" gehoert zu Pfarre & Kloster, steht aber wegen der Einzelauswahl getrennt */
  const RUNDEN_KEY = 'runden';

  /* null = darf alles */
  function rightsOf(acc) {
    if (!acc) return { bereiche: [], runden: [] };
    if (adminRole(acc) || !acc.rechte) return null;
    const r = acc.rechte;
    return {
      bereiche: Array.isArray(r.bereiche) ? r.bereiche.map(String) : [],
      runden: Array.isArray(r.runden) ? r.runden.map(String) : []
    };
  }
  const can = (key) => {
    const r = rightsOf(session());
    return !r || r.bereiche.includes(key);
  };
  const canRunde = (id) => {
    const r = rightsOf(session());
    return !r || r.bereiche.includes(RUNDEN_KEY) || r.runden.includes(String(id));
  };
  const canAllRunden = () => can(RUNDEN_KEY);
  const canAnyRunde = () => {
    const r = rightsOf(session());
    return !r || r.bereiche.includes(RUNDEN_KEY) || r.runden.length > 0;
  };
  /* Schluessel einer Seite der Verwaltung ('' = fuer alle offen) */
  function rightOfPage(page) {
    if (page === 'runden.html') return RUNDEN_KEY;
    /* Spenden & Moeglichkeiten liegen in derselben Datei wie die Paten */
    if (page === 'spenden.html') return 'paten';
    if (page === 'personen.html') return personenBereich() === 'kloster' ? 'mitbrueder' : 'musik-personen';
    const a = AREAS.find((x) => x.page === page);
    return a ? a.key : '';
  }
  const allowed = (key) => !key || (key === RUNDEN_KEY ? canAnyRunde() : can(key));

  /* Ohne gueltige Sitzung sofort zur Anmeldung, bevor die Seite sichtbar wird;
     Seiten nur fuer Admins (<html data-adm-rolle="admin">), nur fuer Entwickler
     (data-adm-rolle="entwickler") und Seiten ohne
     Berechtigung leiten sonst zur Uebersicht */
  if (!PUBLIC && !session()) {
    ROOT.style.visibility = 'hidden';
    location.replace(`index.html?weiter=${encodeURIComponent(pageName() + location.search)}`);
  } else if (!PUBLIC && ROOT.dataset.admRolle === 'admin' && !isAdmin()) {
    ROOT.style.visibility = 'hidden';
    location.replace('uebersicht.html?hinweis=nur-admin');
  } else if (!PUBLIC && ROOT.dataset.admRolle === 'entwickler' && !isDev()) {
    ROOT.style.visibility = 'hidden';
    location.replace('uebersicht.html?hinweis=kein-recht');
  } else if (!PUBLIC && !allowed(rightOfPage(pageName()))) {
    ROOT.style.visibility = 'hidden';
    location.replace('uebersicht.html?hinweis=kein-recht');
  }

  /* ---------- Datum ---------- */
  const isoOf = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const isoToday = () => isoOf(new Date());
  function fmtDate(iso) {
    const dt = HD.dateFromIso(iso);
    return `${HD.WEEKDAYS[dt.getDay()]}, ${dt.getDate()}. ${HD.MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
  }
  function fmtShort(iso) {
    const dt = HD.dateFromIso(iso);
    return `${HD.WEEKDAYS_SHORT[dt.getDay()]} ${pad(dt.getDate())}.${pad(dt.getMonth() + 1)}.${dt.getFullYear()}`;
  }

  /* ---------- Symbole (Linien, 24er-Raster) ---------- */
  const ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M13.5 7.5l3 3"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="1"/><path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 13h11l1-13M9 7V4h6v3"/>',
    folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16 10"/>',
    logout: '<path d="M9 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H9M16 16l4-4-4-4M20 12H10"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="1.5"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    news: '<path d="M4 5h13v14H6.5A2.5 2.5 0 0 1 4 16.5z"/><path d="M17 9h3v8.5a1.5 1.5 0 0 1-3 0M7.5 9h6M7.5 12.5h6M7.5 16h4"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3M16.5 6.5l3 3M14 9l2 2"/>',
    alert: '<path d="M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16l-5-5-9 9"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01" stroke-width="2.6"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="1.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.4c2.1.7 3.5 2.8 3.5 5.6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5M8 7h8M8 11h6"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4L12 18.4"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    home: '<path d="M4 11l8-7 8 7M6 9.5V20h12V9.5M10 20v-6h4v6"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/>',
    disc: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    calendarWeek: '<rect x="3" y="5" width="18" height="16" rx="1.5"/><path d="M3 10h18M8 3v4M16 3v4M7 14.5h10"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
    quote: '<path d="M10 7H6a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h3v1.5A2.5 2.5 0 0 1 6.5 18M20 7h-4a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h3v1.5a2.5 2.5 0 0 1-2.5 2.5"/>',
    palette: '<path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.9 1.5-1.9-.3-1 .4-2.1 1.5-2.1H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    shield: '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6z"/><path d="M9 12l2 2 4-4"/>',
    history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6M3 4v4h4"/><path d="M12 8v4.5l3 2"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>'
  };
  const icon = (name) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;

  /* ---------- Passwoerter ---------- */
  const enc = new TextEncoder();
  const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const cryptoReady = () => !!(w.crypto && w.crypto.subtle);

  async function derive(password, salt, iter) {
    const key = await crypto.subtle.importKey('raw', enc.encode(String(password).normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(salt), iterations: iter }, key, 256);
    return toB64(bits);
  }
  const normUser = (s) => String(s || '').trim().toLowerCase();
  const stampOf = (acc) => String(acc.hash || '').slice(0, 16);

  function parseAccounts(text) {
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : data && data.zugaenge;
    return Array.isArray(list) ? list.filter((a) => a && a.benutzer && a.salt && a.hash) : [];
  }
  function accountsJSON(list) {
    return JSON.stringify({
      hinweis: 'Zugänge zur Verwaltung (admin/). Passwörter stehen hier nur als Prüfsumme (PBKDF2-SHA256), nie im Klartext. Bearbeiten über admin/zugaenge.html.',
      zugaenge: list
    }, null, 2) + '\n';
  }
  /* Entwickler-Code: ohne ihn laesst sich die Rolle Entwickler nicht vergeben
     (admin/zugaenge.html). Hier steht nur seine Pruefsumme (PBKDF2-SHA256). */
  const DEV_CODE = { salt: 'RMBdt0feRjP16llsWXx/PA==', iter: 600000, hash: 'xxTZ72nVhfNyc38vPuOBSr2MdRYqicCAMXlgp8kRnYQ=' };
  async function checkDevCode(code) {
    return (await derive(String(code).trim(), DEV_CODE.salt, DEV_CODE.iter)) === DEV_CODE.hash;
  }
  /* rechte nur fuer die Redaktion; Admins und Entwickler brauchen keine */
  async function makeAccount({ benutzer, name, passwort, rolle, rechte }) {
    const salt = toB64(crypto.getRandomValues(new Uint8Array(16)));
    const acc = {
      benutzer: normUser(benutzer),
      name: String(name || '').trim() || normUser(benutzer),
      salt, iter: ITER,
      hash: await derive(passwort, salt, ITER),
      rolle: ROLES.includes(rolle) ? rolle : 'redaktion',
      angelegt: isoToday()
    };
    if (acc.rolle === 'redaktion' && rechte) acc.rechte = rechte;
    return acc;
  }
  async function checkPassword(acc, passwort) {
    return (await derive(passwort, acc.salt, acc.iter || ITER)) === acc.hash;
  }

  /* Passwort pruefen: liefert den Grund, warum es nicht geht, sonst ''. Das Passwort steht
     nur als Pruefsumme in zugaenge.json, deshalb sollte es nicht zu kurz sein. */
  function pwProblem(pw, user = '') {
    if (pw.length < MIN_PW) return `Das Passwort braucht mindestens ${MIN_PW} Zeichen.`;
    const low = pw.toLowerCase();
    const u = normUser(user);
    if (u && (low === u || (u.length >= 4 && low.includes(u)))) return 'Das Passwort darf den Benutzernamen nicht enthalten.';
    return '';
  }

  /* Staerke grob einschaetzen: 0 leer, 1 zu kurz/schwach … 4 sehr gut */
  function pwLevel(pw) {
    if (!pw) return 0;
    if (pw.length < MIN_PW) return 1;
    let score = 1;
    if (pw.length >= 14) score++;
    if (/[a-zäöüß]/.test(pw) && /[A-ZÄÖÜ]/.test(pw)) score++;
    if (/\d/.test(pw) || /[^\p{L}\s]/u.test(pw)) score++;
    return Math.min(score, 4);
  }
  const PW_WORDS = ['Orgel', 'Kerze', 'Psalm', 'Choral', 'Kantor', 'Glocke', 'Altar', 'Kanzel', 'Hymnus', 'Credo', 'Gloria', 'Sanctus',
    'Kyrie', 'Motette', 'Kantate', 'Fuge', 'Toccata', 'Sonate', 'Geige', 'Pauke', 'Posaune', 'Harfe', 'Laute', 'Tenor', 'Sopran',
    'Bariton', 'Kapelle', 'Kloster', 'Garten', 'Brunnen', 'Turm', 'Fenster', 'Pfeiler', 'Bogen', 'Portal', 'Krypta', 'Laterne',
    'Leuchter', 'Kelch', 'Rose', 'Lilie', 'Linde', 'Eiche', 'Ahorn', 'Flieder', 'Efeu', 'Taube', 'Adler', 'Lamm', 'Anker', 'Stern',
    'Sonne', 'Mond', 'Komet', 'Wolke', 'Regen', 'Nebel', 'Morgen', 'Abend', 'Advent', 'Ostern', 'Sommer', 'Winter', 'Herbst', 'Donau',
    'Hofburg', 'Augustin', 'Monika', 'Ambrosius', 'Mailand', 'Ostia', 'Karthago', 'Pergament', 'Feder', 'Tinte', 'Siegel', 'Schlüssel',
    'Buch', 'Brief', 'Lied', 'Klang', 'Takt', 'Akkord', 'Melodie', 'Stimme', 'Echo', 'Stille', 'Frieden', 'Freude', 'Hoffnung', 'Segen',
    'Licht', 'Gold', 'Silber', 'Marmor', 'Bronze', 'Kupfer', 'Purpur', 'Brokat', 'Mosaik', 'Fresko', 'Kuppel', 'Kreuzgang', 'Zither',
    'Flöte', 'Oboe', 'Fagott', 'Cello', 'Kontrabass', 'Trompete', 'Horn', 'Kantorei', 'Vesper', 'Matutin', 'Laudes', 'Pilger', 'Brücke'];
  function randomIndex(n) {
    const max = Math.floor(0x100000000 / n) * n;
    const buf = new Uint32Array(1);
    do crypto.getRandomValues(buf); while (buf[0] >= max);
    return buf[0] % n;
  }
  /* Merkbares, aber starkes Passwort: vier Woerter und eine Zahl */
  function suggestPassword() {
    const words = Array.from({ length: 4 }, () => PW_WORDS[randomIndex(PW_WORDS.length)]);
    return `${words.join('-')}-${10 + randomIndex(90)}`;
  }

  /* ---------- Fehlversuche: nach 5 falschen Eingaben kurze Wartezeit ---------- */
  function lockLeft() {
    const f = get(KEY_FAILS);
    return f && f.bis > Date.now() ? Math.ceil((f.bis - Date.now()) / 1000) : 0;
  }
  function registerFail() {
    const f = get(KEY_FAILS) || { n: 0 };
    f.n += 1;
    if (f.n >= 5) f.bis = Date.now() + Math.min(300, 30 * 2 ** (f.n - 5)) * 1000;
    put(KEY_FAILS, f);
  }

  async function fetchText(path) {
    const res = await fetch(`../${path}`, { cache: 'no-store' });
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
    return res.text();
  }

  /* Anmelden gegen die Zugaenge, die der Webserver ausliefert */
  async function login(benutzer, passwort) {
    if (!cryptoReady()) throw Object.assign(new Error('unsicher'), { code: 'insecure' });
    if (lockLeft()) throw Object.assign(new Error('gesperrt'), { code: 'locked' });
    const accounts = parseAccounts(await fetchText(ACCOUNTS));
    const acc = accounts.find((a) => a.benutzer === normUser(benutzer));
    /* Auch bei unbekanntem Namen rechnen, damit die Antwort gleich lange dauert */
    const ok = acc ? await checkPassword(acc, passwort) : (await derive(passwort, 'AAAAAAAAAAAAAAAAAAAAAA==', ITER), false);
    if (!ok) {
      registerFail();
      throw Object.assign(new Error('falsch'), { code: lockLeft() ? 'locked' : 'wrong' });
    }
    /* Sendet der Webserver den angemeldeten Benutzer und heisst er wie ein persoenlicher Zugang,
       muss die Anmeldung dazu passen (sonst koennte sich jemand mit fremder Rolle anmelden).
       Ein gemeinsamer Server-Zugang (z. B. "admin", den es hier nicht gibt) ist nur die Haustuer:
       dann entscheidet die Anmeldung hier. Ohne Header wie bisher. */
    await serverMode();
    if (serverBinds(accounts) && acc.benutzer !== serverUser) {
      throw Object.assign(new Error('Server-Benutzer'), { code: 'server', serverUser });
    }
    drop(KEY_FAILS);
    startSession(acc);
    return acc;
  }
  function startSession(acc) {
    put(KEY_SESSION, { benutzer: acc.benutzer, name: acc.name, rolle: roleOf(acc), rechte: acc.rechte || null, stamp: stampOf(acc), bis: Date.now() + IDLE_MS });
  }
  function logout(reason) {
    drop(KEY_SESSION);
    location.replace(`index.html${reason ? `?hinweis=${reason}` : ''}`);
  }

  /* Gibt es den Zugang noch und gilt das Passwort noch? Sonst abmelden.
     Geprueft wird gegen die Datei des Webservers und, falls verbunden,
     gegen die im Projektordner (dort kann sie neuer sein). Ist keine
     der beiden lesbar (z. B. offline), bleibt die Sitzung bestehen. */
  async function verifySession() {
    const s = session();
    if (!s) return;
    await serverMode();
    const sources = [() => fetchText(ACCOUNTS)];
    if (folder.state === 'ok') sources.push(() => folder.read(ACCOUNTS));
    let readable = false;
    for (const src of sources) {
      try {
        const list = parseAccounts(await src());
        readable = true;
        if (serverBinds(list) && s.benutzer !== serverUser) return logout('ungueltig');
        const acc = list.find((a) => a.benutzer === s.benutzer);
        if (acc && stampOf(acc) === s.stamp) {
          /* Name, Rolle oder Rechte koennen sich inzwischen geaendert haben */
          const rightsChanged = JSON.stringify(acc.rechte || null) !== JSON.stringify(s.rechte || null);
          if (acc.name !== s.name || roleOf(acc) !== roleOf(s) || rightsChanged) {
            put(KEY_SESSION, { ...s, name: acc.name, rolle: roleOf(acc), rechte: acc.rechte || null });
            if (roleOf(acc) !== roleOf(s) || rightsChanged) location.reload();
          }
          return;
        }
      } catch {
        /* naechste Quelle */
      }
    }
    if (readable) logout('ungueltig');
  }

  /* ---------- Projektordner (File System Access API) ---------- */
  function idb(mode, fn) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open('aug-admin', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('kv');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('kv', mode);
        const req = fn(tx.objectStore('kv'));
        tx.oncomplete = () => { db.close(); resolve(req.result); };
        tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
      };
    });
  }
  const idbGet = (k) => idb('readonly', (s) => s.get(k));
  const idbSet = (k, v) => idb('readwrite', (s) => s.put(v, k));
  const idbDel = (k) => idb('readwrite', (s) => s.delete(k));

  async function handleFor(dir, path, create) {
    const parts = path.split('/');
    let cur = dir;
    for (const part of parts.slice(0, -1)) cur = await cur.getDirectoryHandle(part, { create: !!create });
    return cur.getFileHandle(parts[parts.length - 1], { create: !!create });
  }
  async function existsIn(dir, path) {
    try {
      await handleFor(dir, path, false);
      return true;
    } catch {
      return false;
    }
  }

  /* Kurze Pruefsumme eines Textes (FNV-1a), um zu erkennen, ob sich der Inhalt geaendert hat */
  function hashText(t) {
    let h = 2166136261;
    for (let i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return `${(h >>> 0).toString(36)}:${t.length}`;
  }
  /* ---------- Server-Modus ----------
     Meldet der Webserver mit dem Kopf "X-Aug-Schreiben: ja", dass er Aenderungen der Verwaltung
     annimmt (nginx oder Apache, siehe tools/server), gibt es keinen Projektordner: Dateien werden
     dort gelesen (GET), geschrieben (PUT) und geloescht (DELETE), wo die Website liegt. Die beiden
     Klassen haben dieselben Methoden wie Ordner und Dateien der File System Access API, damit
     der Rest der Verwaltung nichts davon merkt. Vor unbefugtem Schreiben schuetzt der Webserver
     (Anmeldung, Liste der beschreibbaren Pfade), nicht diese Seite. */
  function serverUrl(path) {
    const parts = path.split('/');
    /* nie aus der Website hinaus: kein "..", kein "." und keine leeren Teile (ausser am Ende, bei Ordnern) */
    if (parts.some((p, i) => p === '..' || p === '.' || (p === '' && i < parts.length - 1))) {
      throw new DOMException(`Ungültiger Pfad: ${path}`, 'SyntaxError');
    }
    return `../${parts.map(encodeURIComponent).join('/')}`;
  }
  const notFoundError = (path) => new DOMException(`„${path}“ gibt es auf dem Server nicht.`, 'NotFoundError');
  function serverError(res, path, verb) {
    const verboten = 'Der Server erlaubt dort kein Schreiben (PUT und DELETE sind nur für data/ und assets/ eingerichtet).';
    const was = {
      401: 'Der Server verlangt eine Anmeldung. Bitte die Seite neu laden und beim Server anmelden.',
      403: 'Der Server erlaubt dort kein Schreiben (Dateirechte oder Zugriffsregeln).',
      405: verboten,
      /* ein PUT auf einen Pfad ausserhalb der freigegebenen Ordner endet bei nginx in 404 */
      404: verb === 'PUT' || verb === 'MKCOL' ? verboten : 'Die Datei gibt es auf dem Server nicht.',
      413: 'Die Datei ist dem Server zu groß (client_max_body_size).',
      507: 'Auf dem Server ist kein Speicherplatz mehr frei.'
    }[res.status] || `Der Server antwortet mit HTTP ${res.status}.`;
    return Object.assign(new Error(`${was} (${verb} ${path})`), { status: res.status, name: res.status === 401 || res.status === 403 ? 'NotAllowedError' : 'Error' });
  }
  async function serverPut(path, body) {
    const put = () => fetch(serverUrl(path), { method: 'PUT', body, headers: body.type ? { 'Content-Type': body.type } : {} });
    let res = await put();
    if (res.status === 409) {
      /* Der Ordner fehlt (Apache/WebDAV legt ihn nicht von selbst an): anlegen, dann noch einmal */
      let dir = '';
      for (const part of path.split('/').slice(0, -1)) {
        dir += `${part}/`;
        const made = await fetch(serverUrl(dir), { method: 'MKCOL' });
        if (!made.ok && made.status !== 405) throw serverError(made, dir, 'MKCOL');   /* 405: gibt es schon */
      }
      res = await put();
    }
    if (!res.ok) throw serverError(res, path, 'PUT');
  }
  class ServerFile {
    constructor(path) {
      this.kind = 'file';
      this.path = path;
      this.name = path.split('/').pop();
    }
    async getFile() {
      const res = await fetch(serverUrl(this.path), { cache: 'no-store' });
      if (res.status === 404) throw notFoundError(this.path);
      if (!res.ok) throw serverError(res, this.path, 'GET');
      const blob = await res.blob();
      const modified = Date.parse(res.headers.get('Last-Modified') || '');
      return new File([blob], this.name, { type: blob.type, lastModified: Number.isNaN(modified) ? 0 : modified });
    }
    async createWritable() {
      const parts = [];
      return {
        write: async (data) => { parts.push(data); },
        close: async () => serverPut(this.path, parts.length === 1 && parts[0] instanceof Blob ? parts[0] : new Blob(parts))
      };
    }
  }
  class ServerDir {
    constructor(prefix, name) {
      this.kind = 'directory';
      this.prefix = prefix;
      this.name = name;
    }
    async getDirectoryHandle(name) {
      return new ServerDir(`${this.prefix}${name}/`, name);
    }
    async getFileHandle(name, options) {
      const path = this.prefix + name;
      if (!(options && options.create)) {
        const res = await fetch(serverUrl(path), { method: 'HEAD', cache: 'no-store' });
        if (res.status === 404) throw notFoundError(path);
        if (!res.ok) throw serverError(res, path, 'HEAD');
      }
      return new ServerFile(path);
    }
    async removeEntry(name) {
      const path = this.prefix + name;
      const res = await fetch(serverUrl(path), { method: 'DELETE' });
      if (res.status === 404) throw notFoundError(path);
      if (!res.ok) throw serverError(res, path, 'DELETE');
    }
  }
  let serverFlag;
  /* Am Server angemeldeter Benutzer (Header X-Aug-Benutzer, nur wenn der Webserver ihn sendet), sonst '' */
  let serverUser = '';
  /* Ist der Server-Benutzer ein persoenlicher Zugang (gleicher Benutzername)? Dann ist die
     Anmeldung an ihn gebunden; sonst (gemeinsamer Server-Zugang) gilt er nur als Haustuer */
  const serverBinds = (list) => !!serverUser && list.some((a) => a.benutzer === serverUser);
  async function serverMode() {
    if (serverFlag === undefined) {
      try {
        const res = await fetch(w.location.href, { method: 'HEAD', cache: 'no-store' });
        serverFlag = res.headers.get('X-Aug-Schreiben') === 'ja';
        serverUser = normUser(res.headers.get('X-Aug-Benutzer'));
      } catch {
        serverFlag = false;
      }
    }
    return serverFlag;
  }

  const folder = {
    supported: typeof w.showDirectoryPicker === 'function',
    server: false,       /* true: die Verwaltung liegt auf dem Webserver und speichert dort direkt */
    state: 'none',       /* unsupported | none | prompt | ok */
    handle: null,
    subs: new Set(),
    /* Pfad -> Stand der Datei beim letzten Lesen oder Schreiben (fuer Aenderungen von aussen) */
    seen: new Map(),
    on(fn) { this.subs.add(fn); },
    async read(path) {
      const file = await (await handleFor(this.handle, path, false)).getFile();
      const text = await file.text();
      this.seen.set(path, { stamp: `${file.lastModified}:${file.size}`, hash: hashText(text) });
      return text;
    },
    /* Wurde die Datei seit dem Lesen von einem anderen Programm oder Tab veraendert, wird
       nicht ueberschrieben: sonst gingen diese Aenderungen verloren. Nur der Inhalt zaehlt,
       ein reines Neuschreiben mit gleichem Text (z. B. durch git) stoert nicht. */
    async checkFresh(path) {
      const before = this.seen.get(path);
      if (!before) return;
      let file;
      try {
        file = await (await handleFor(this.handle, path, false)).getFile();
      } catch {
        return;   /* Datei inzwischen weg: neu anlegen ist in Ordnung */
      }
      if (`${file.lastModified}:${file.size}` === before.stamp) return;
      if (hashText(await file.text()) === before.hash) return;
      throw Object.assign(new Error(`„${path}“ wurde inzwischen woanders geändert (Excel, ein anderer Tab, ein Git-Update …). Damit nichts überschrieben wird, wurde nicht gespeichert. Bitte die Seite neu laden und die Änderung noch einmal machen.`), { name: 'KonfliktError' });
    },
    /* Schreibt eine Datei. Wurde sie gerade von einem anderen Programm angefasst (Cloud-Sync,
       Virenscanner, Editor), meldet der Browser "state had changed since it was read from disk";
       dann klappt meist ein zweiter oder dritter Versuch. Die Meldung nennt die Datei. */
    async write(path, blob) {
      const RETRY = ['InvalidStateError', 'NotReadableError', 'NoModificationAllowedError'];
      await this.checkFresh(path);
      for (let attempt = 0; ; attempt++) {
        try {
          const fh = await handleFor(this.handle, path, true);
          const out = await fh.createWritable();
          await out.write(blob);
          await out.close();
          /* neuer Stand (nur Text-Dateien, die die Verwaltung auch liest) */
          if (GUARDED.test(path)) {
            const file = await fh.getFile();
            this.seen.set(path, { stamp: `${file.lastModified}:${file.size}`, hash: hashText(await file.text()) });
          }
          return;
        } catch (e) {
          /* Im Server-Modus auch bei einem kurzen Netzwerkfehler noch einmal versuchen (PUT ist wiederholbar) */
          if (attempt < 2 && (RETRY.includes(e && e.name) || (this.server && e instanceof TypeError))) {
            await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
            continue;
          }
          if (this.server && e instanceof TypeError) throw Object.assign(new Error(`„${path}“ ließ sich nicht speichern: keine Verbindung zum Server, oder die Anmeldung ist abgelaufen (z. B. bei Cloudflare Access). Bitte die Seite neu laden.`), { cause: e });
          if (this.server) throw Object.assign(new Error(`„${path}“ ließ sich nicht auf dem Server speichern: ${e && e.message || e}`), { cause: e });
          throw Object.assign(new Error(`„${path}“ lässt sich nicht schreiben (${e && e.message || e}). Ist die Datei noch in einem anderen Programm geöffnet (z. B. Excel)? Bitte dort schließen und noch einmal speichern. Liegt der Projektordner in OneDrive, kann auch der Sync stören.`), { cause: e });
        }
      }
    },
    exists(path) {
      return existsIn(this.handle, path);
    },
    async readBlob(path) {
      return (await handleFor(this.handle, path, false)).getFile();
    },
    async remove(path) {
      const parts = path.split('/');
      let cur = this.handle;
      for (const part of parts.slice(0, -1)) cur = await cur.getDirectoryHandle(part);
      await cur.removeEntry(parts[parts.length - 1]);
    },
    async restore() {
      if (await serverMode()) {
        this.server = true;
        this.supported = true;
        this.handle = new ServerDir('', w.location.host);
        return setFolderState('ok');
      }
      if (!this.supported) return setFolderState('unsupported');
      try {
        const h = await idbGet('ordner');
        if (!h) return setFolderState('none');
        this.handle = h;
        const p = await h.queryPermission({ mode: 'readwrite' });
        return setFolderState(p === 'granted' ? 'ok' : 'prompt');
      } catch {
        return setFolderState('none');
      }
    },
    async connect() {
      if (this.server) return true;
      let dir;
      try {
        dir = await w.showDirectoryPicker({ id: 'augustiner-website', mode: 'readwrite' });
      } catch (e) {
        if (e && e.name !== 'AbortError') toast(`Verbinden nicht möglich: ${e.message}`, 'err');
        return false;
      }
      if (!(await existsIn(dir, 'index.html')) || !(await existsIn(dir, 'data/news.csv'))) {
        toast('Das ist nicht der Projektordner. Bitte den Ordner wählen, in dem index.html liegt.', 'err');
        return false;
      }
      this.handle = dir;
      try {
        await idbSet('ordner', dir);
      } catch {
        /* dann gilt die Verbindung nur fuer diese Seite */
      }
      toast(`Projektordner „${dir.name}“ verbunden.`);
      await becomeOk();
      return true;
    },
    async allow() {
      if (this.server) return true;
      try {
        const p = await this.handle.requestPermission({ mode: 'readwrite' });
        if (p !== 'granted') {
          toast('Ohne Erlaubnis kann nicht direkt gespeichert werden.', 'err');
          return false;
        }
      } catch {
        return this.connect();
      }
      toast('Zugriff auf den Projektordner erlaubt.');
      await becomeOk();
      return true;
    },
    async disconnect() {
      if (this.server) return;
      try {
        await idbDel('ordner');
      } catch {
        /* nichts zu tun */
      }
      this.handle = null;
      setFolderState('none');
      toast('Projektordner getrennt. Änderungen gibt es jetzt als Download.');
    }
  };
  /* Erst offene Downloads in den Ordner schreiben, dann die Werkzeuge
     benachrichtigen (die ihre Daten dann aus dem Ordner neu laden) */
  async function becomeOk() {
    folder.state = 'ok';
    await flushPending();
    setFolderState('ok');
  }
  function setFolderState(state) {
    folder.state = state;
    renderFolderStrips();
    renderPending();
    for (const fn of folder.subs) fn(state);
  }

  function folderStripHTML() {
    switch (folder.state) {
      case 'ok':
        if (folder.server) {
          return `<span class="adm-folder-ico">${icon('checkCircle')}</span>` +
            `<div class="adm-folder-txt"><strong>Mit dem Server verbunden</strong><span class="adm-folder-sub">Änderungen sind sofort auf der Website zu sehen.</span></div>`;
        }
        return `<span class="adm-folder-ico">${icon('checkCircle')}</span>` +
          `<div class="adm-folder-txt"><strong>Projektordner verbunden</strong><span class="adm-folder-sub">Gespeichert wird in „${esc(folder.handle.name)}“.</span></div>` +
          '<button type="button" class="btn btn-quiet" data-folder="disconnect">Trennen</button>';
      case 'prompt':
        return `<span class="adm-folder-ico">${icon('folder')}</span>` +
          `<div class="adm-folder-txt"><strong>Zugriff auf „${esc(folder.handle.name)}“ erlauben</strong><span class="adm-folder-sub">Der Browser fragt nach jedem Neustart einmal nach.</span></div>` +
          `<button type="button" class="btn btn-dark" data-folder="allow">${icon('check')}Erlauben</button>`;
      case 'unsupported':
        return `<span class="adm-folder-ico">${icon('download')}</span>` +
          '<div class="adm-folder-txt"><strong>Speichern per Download</strong><span class="adm-folder-sub" title="Dieser Browser kann nicht direkt in einen Ordner speichern. Du bekommst geänderte Dateien zum Herunterladen, mit Angabe, wohin sie gehören.">Direkt speichern geht mit Chrome oder Edge am Computer.</span></div>';
      default:
        return `<span class="adm-folder-ico">${icon('folder')}</span>` +
          '<div class="adm-folder-txt"><strong>Projektordner nicht verbunden</strong><span class="adm-folder-sub">Bis dahin gibt es Änderungen als Download.</span></div>' +
          `<button type="button" class="btn btn-dark" data-folder="connect">${icon('folder')}Verbinden</button>`;
    }
  }
  /* Unten in der Seitenleiste nur, wenn alles verbunden ist; sonst sagt es der Streifen auf der Seite */
  function folderSideHTML() {
    if (folder.state !== 'ok') return '';
    return folder.server
      ? `${icon('checkCircle')}<span>Mit dem Server verbunden</span>`
      : `${icon('checkCircle')}<span title="Gespeichert wird in „${esc(folder.handle.name)}“">Ordner verbunden</span>` +
        '<button type="button" class="adm-side-folder-btn" data-folder="disconnect">Trennen</button>';
  }
  function renderFolderStrips() {
    d.querySelectorAll('[data-adm-folder]').forEach((el) => {
      el.className = `adm-folder is-${folder.state}`;
      el.hidden = folder.state === 'ok';
      el.innerHTML = folderStripHTML();
    });
    d.querySelectorAll('[data-adm-folder-side]').forEach((el) => {
      el.className = `adm-side-folder is-${folder.state}`;
      el.innerHTML = folderSideHTML();
    });
  }

  /* ---------- Lesen und Speichern ---------- */
  /* Text einer Projektdatei: aus dem verbundenen Ordner, sonst vom Webserver */
  /* Pfad -> 'ok' | 'fehlt' | 'fehler': Konnte eine Datei nicht gelesen werden (oder war sie
     kaputt), darf sie in dieser Sitzung nicht geschrieben werden, sonst waere der Rest weg. */
  const readState = new Map();
  /* Pfad -> Text beim letzten Lesen oder Speichern: daraus ergibt sich im Protokoll, was genau geaendert wurde */
  const lastText = new Map();
  const notFoundErr = (e) => !!e && (e.name === 'NotFoundError' || e.status === 404);
  /* Datendateien liegen oeffentlich auf dem Server: E-Mail-Adressen darin werden beim Speichern
     verschluesselt und beim Lesen wieder lesbar gemacht (HD.mailEncode/mailDecode). In der
     Verwaltung und im Protokoll erscheinen sie deshalb immer ganz normal. */
  const MAIL_FILE = /^data\/.+\.(json|csv)$/;
  const plainText = (path, text) => (MAIL_FILE.test(path) ? HD.mailDecode(text) : text);
  async function readText(path) {
    try {
      const text = plainText(path, folder.state === 'ok' ? await folder.read(path) : await fetchText(path));
      readState.set(path, 'ok');
      lastText.set(path, text);
      return text;
    } catch (e) {
      readState.set(path, notFoundErr(e) ? 'fehlt' : 'fehler');
      throw e;
    }
  }
  /* Datei als JSON lesen; eine Datei, die nicht zu lesen ist, sperrt das Schreiben */
  async function readJSON(path) {
    const text = await readText(path);
    try {
      return JSON.parse(text);
    } catch (e) {
      readState.set(path, 'fehler');
      throw e;
    }
  }
  const markUnreadable = (path) => readState.set(path, 'fehler');
  const GUARDED = /^(data\/.+\.(json|csv)|admin\/(zugaenge|mitteilungen)\.json)$/;
  const fileName = (path) => path.split('/').pop();
  const dirName = (path) => path.replace(/[^/]+$/, '') || './';
  function typeFor(path) {
    if (path.endsWith('.csv')) return 'text/csv;charset=utf-8';
    if (path.endsWith('.json')) return 'application/json;charset=utf-8';
    return '';
  }

  /* Noch herunterzuladende Dateien (ohne verbundenen Projektordner) */
  const pending = new Map();
  /* In dieser Sitzung gespeicherte Bilder: so erscheinen sie sofort, auch
     wenn sie (ohne Projektordner) erst noch heruntergeladen werden muessen */
  const localImages = new Map();
  function imageUrl(path) {
    return localImages.get(path) || HD.safeUrl(path, '../');
  }
  /* Speichert eine Datei im Projektordner; ohne Ordner wird sie zum
     Herunterladen vorgemerkt. Liefert true, wenn direkt gespeichert. */
  async function saveFile(path, data) {
    if (GUARDED.test(path) && readState.get(path) === 'fehler') {
      throw new Error(`„${path}“ ließ sich vorher nicht lesen. Speichern würde den Rest der Datei überschreiben, deshalb wird nichts geändert. Bitte die Seite neu laden oder die Datei prüfen.`);
    }
    let blob = data instanceof Blob ? data : new Blob([data], { type: typeFor(path) });
    /* Eine Datei von der Festplatte (Auswahl, Ordner) zuerst in den Arbeitsspeicher holen: so wird
       eine seit dem Auswaehlen veraenderte Datei gleich bemerkt und nicht erst mitten im Schreiben */
    if (data instanceof Blob) {
      try {
        blob = new Blob([await data.arrayBuffer()], { type: data.type });
      } catch (e) {
        throw Object.assign(new Error(`Die Quelle für „${path}“ lässt sich nicht lesen (${e && e.message || e}). Bitte die Datei noch einmal wählen.`), { cause: e });
      }
    }
    if (blob.type.startsWith('image/')) {
      if (localImages.has(path)) URL.revokeObjectURL(localImages.get(path));
      localImages.set(path, URL.createObjectURL(blob));
    }
    const isText = /\.(json|csv)$/.test(path);
    const before = isText ? await previousText(path) : null;
    const after = isText ? await blob.text() : null;
    if (isText && MAIL_FILE.test(path)) {
      const encoded = HD.mailEncode(after);
      if (encoded !== after) blob = new Blob([encoded], { type: blob.type || typeFor(path) });
    }
    let direct = false;
    if (folder.state === 'ok') {
      await folder.write(path, blob);
      direct = true;
    } else {
      pending.set(path, { path, blob, done: false });
      renderPending();
    }
    if (isText) lastText.set(path, after);
    noteChange(path, isText ? describeChange(path, before, after) : [`Datei gespeichert: ${fileName(path)}`]);
    return direct;
  }
  /* Stand vor dem Speichern: zuletzt gelesen, sonst frisch geholt (ohne den Schutz vor
     Ueberschreiben in folder.read zu beruehren); null, wenn es die Datei noch nicht gab */
  async function previousText(path) {
    if (lastText.has(path)) return lastText.get(path);
    try {
      return plainText(path, folder.state === 'ok' ? await (await folder.readBlob(path)).text() : await fetchText(path));
    } catch {
      return null;
    }
  }
  const saveJSON = (path, data) => saveFile(path, JSON.stringify(data, null, 2) + '\n');
  /* Eine eben erst geschriebene Datei wieder verwerfen (z. B. Foto, das doch nicht
     uebernommen wird): aus dem Ordner loeschen bzw. aus der Download-Leiste nehmen */
  async function discardFile(path) {
    /* Eben erst gespeichert und noch nicht protokolliert: dann taucht die Datei im Protokoll gar nicht auf */
    const queued = changeQueue.findIndex((c) => c.datei === path);
    if (queued >= 0) changeQueue.splice(queued, 1);
    else noteChange(path, [`Datei entfernt: ${fileName(path)}`]);
    if (pending.has(path)) {
      pending.delete(path);
      renderPending();
    }
    if (localImages.has(path)) {
      URL.revokeObjectURL(localImages.get(path));
      localImages.delete(path);
    }
    if (folder.state === 'ok') {
      try {
        await folder.remove(path);
      } catch {
        /* war schon weg */
      }
    }
  }

  /* Offene Downloads in den gerade verbundenen Ordner schreiben; was
     nicht geklappt hat, bleibt zum Herunterladen stehen */
  async function flushPending() {
    const open = [...pending.values()].filter((p) => !p.done);
    if (folder.state === 'ok') {
      try {
        for (const p of open) {
          await folder.write(p.path, p.blob);
          pending.delete(p.path);
        }
        if (open.length) toast(open.length === 1 ? `${fileName(open[0].path)} im Projektordner gespeichert.` : `${open.length} Dateien im Projektordner gespeichert.`);
        pending.clear();
      } catch (e) {
        toast(`Speichern nicht möglich: ${e.message}`, 'err');
      }
    }
    renderPending();
  }
  function renderPending() {
    let bar = $('adm-pending');
    const items = [...pending.values()];
    if (d.body) d.body.classList.toggle('has-pending', items.length > 0);
    if (!items.length) {
      if (bar) bar.remove();
      return;
    }
    if (!bar) {
      bar = d.createElement('section');
      bar.id = 'adm-pending';
      bar.className = 'adm-pending';
      bar.setAttribute('aria-label', 'Noch zu speichern');
      d.body.appendChild(bar);
      bar.addEventListener('click', onPendingClick);
    }
    const allDone = items.every((p) => p.done);
    const list = items.map((p) =>
      `<code>${esc(fileName(p.path))}</code> in den Ordner <code>${esc(dirName(p.path))}</code>${p.done ? ' ✓' : ''}`
    ).join(' · ');
    const canConnect = folder.supported && folder.state !== 'ok' && !allDone;
    bar.innerHTML = '<div class="adm-pending-in"><div class="adm-pending-txt">' +
      (allDone
        ? `<strong>Heruntergeladen</strong>Jetzt die Dateien in den Projektordner legen (gleichnamige Datei ersetzen): ${list}`
        : `<strong>Noch nicht gespeichert</strong>Bitte herunterladen und in den Projektordner legen (gleichnamige Datei ersetzen): ${list}`) +
      '</div><div class="adm-pending-files">' +
      (allDone
        ? '<button type="button" class="btn btn-gold btn-sm" data-pending="ok">Erledigt</button>'
        : items.filter((p) => !p.done).map((p) =>
          `<button type="button" class="btn btn-gold btn-sm" data-dl="${esc(p.path)}">${icon('download')}${esc(fileName(p.path))}</button>`).join('') +
          (canConnect ? `<button type="button" class="btn btn-outline-w btn-sm" data-folder="${folder.state === 'prompt' ? 'allow' : 'connect'}">${icon('folder')}Lieber direkt speichern</button>` : '')) +
      '</div></div>';
    /* Meldungen erscheinen oberhalb der Leiste */
    ROOT.style.setProperty('--adm-pending-h', `${bar.offsetHeight}px`);
  }
  function onPendingClick(ev) {
    const dl = ev.target.closest('[data-dl]');
    if (dl) {
      const p = pending.get(dl.dataset.dl);
      if (p) {
        HD.download(p.blob, fileName(p.path));
        p.done = true;
        renderPending();
      }
    }
    if (ev.target.closest('[data-pending="ok"]')) {
      pending.clear();
      renderPending();
    }
  }
  const hasUnsaved = () => [...pending.values()].some((p) => !p.done);

  /* ---------- Aenderungsprotokoll ----------
     Jedes Speichern merkt sich, was sich in der Datei genau geaendert hat (vorher -> nachher,
     je Eintrag und Feld). log(text) fasst das mit einem Satz der Seite zu einem Eintrag
     zusammen; ruft eine Seite log() nicht auf, entsteht der Eintrag nach kurzer Zeit von selbst.
     Ein Eintrag landet
     - auf diesem Geraet (die letzten 30, Uebersicht "Zuletzt geaendert") und
     - mit Projektordner oder Server im gemeinsamen Protokoll admin/protokoll.json (alle
       Personen und Geraete; Entwickler sehen es als Tabelle unter "Aenderungen"). */
  const PROTOCOL = 'admin/protokoll.json';
  const PROTOCOL_MAX = 2000;
  const KEY_PROTOCOL_ERR = 'aug-protokoll-fehler';
  const AREA_FILES = [
    [/^data\/startseite\.json$/, 'Startseite'], [/^data\/hinweise\.json$/, 'Hinweisbanner'],
    [/^data\/news\.csv$/, 'Neuigkeiten'], [/^data\/termine\.json$/, 'Termine'],
    [/^data\/(archiv\/)?hochaemter.*\.csv$/, 'Hochämter'], [/^data\/hochamt-fotos\.json$/, 'Hochämter'],
    [/^data\/solisten\.json$/, 'Solisten'], [/^data\/paten\.json$/, 'Paten'], [/^data\/cds\.json$/, 'CDs'],
    [/^data\/personen\.json$/, 'Personen'], [/^data\/repertoire\.json$/, 'Repertoire'],
    [/^data\/gottesdienste\.json$/, 'Regelmäßige Termine'], [/^data\/wochenkalender\.json$/, 'Wochenkalender'], [/^data\/kontakt\.json$/, 'Pfarrkanzlei & Kontakt'],
    [/^data\/runden\.json$/, 'Runden'], [/^data\/rundgang\.json$/, 'Kirchenrundgang'], [/^data\/pgr\.json$/, 'Pfarrgemeinderat'],
    [/^data\/bildnachweise\.json$/, 'Bildnachweise'], [/^data\/rechtliches\.json$/, 'Impressum & Datenschutz'],
    [/^data\/sprueche\.json$/, 'Sprüche'], [/^data\/themen\.json$/, 'Farben & Logo'], [/^data\/startseite-[a-z]+\.json$/, 'Titelfotos'],
    [/^admin\/zugaenge\.json$/, 'Zugänge'], [/^admin\/mitteilungen\.json$/, 'Mitteilungen'],
    [/^assets\/img\/startseite\//, 'Startseite'], [/^assets\/img\/news\//, 'Neuigkeiten'], [/^assets\//, 'Dateien']
  ];
  const areaOf = (path) => (AREA_FILES.find(([re]) => re.test(path)) || [null, fileName(path)])[1];

  /* Werte fuer die Anzeige: kurz, Leerraum zusammengezogen; geheime Felder nie im Klartext */
  const SECRET = /^(hash|salt|code|codeHash|codeSalt|passwort|password)$/i;
  const SKIP = /^(salt|codeSalt|iter|__.*)$/;
  const LABELS = { sprueche: 'Sprüche', themen: 'Themen', hash: 'Passwort', code: 'Entwickler-Code', codeHash: 'Entwickler-Code', bilder: 'Fotos', frueher: 'Frühere Fotos', sekunden: 'Wechselzeit (Sekunden)', ausschnitt: 'Bildausschnitt' };
  const MAX_DETAILS = 60;
  function fmtValue(v) {
    if (v === undefined || v === null || v === '') return '(leer)';
    if (typeof v === 'boolean') return v ? 'ja' : 'nein';
    if (typeof v === 'object') return Array.isArray(v) ? `${v.length} Einträge` : '(Angaben)';
    const s = String(v).replace(/\s+/g, ' ').trim();
    return s.length > 140 ? `${s.slice(0, 140)}…` : s;
  }
  /* Lange Texte: nur die Stelle zeigen, die sich unterscheidet (mit etwas Umgebung) */
  function textChange(a, b) {
    const x = String(a ?? '').replace(/\s+/g, ' ');
    const y = String(b ?? '').replace(/\s+/g, ' ');
    if (x.length <= 120 && y.length <= 120) return `„${fmtValue(a)}“ → „${fmtValue(b)}“`;
    let p = 0;
    while (p < x.length && p < y.length && x[p] === y[p]) p++;
    let s = 0;
    while (s < x.length - p && s < y.length - p && x[x.length - 1 - s] === y[y.length - 1 - s]) s++;
    const cut = (t) => {
      const from = Math.max(0, p - 30);
      const to = Math.min(t.length, t.length - s + 30);
      const mid = t.slice(from, to);
      return `${from > 0 ? '…' : ''}${mid.length > 160 ? `${mid.slice(0, 160)}…` : mid}${to < t.length ? '…' : ''}`;
    };
    return `„${cut(x) || '(leer)'}“ → „${cut(y) || '(leer)'}“`;
  }
  const keyLabel = (k) => LABELS[k] || (/^[a-z]/.test(k) ? k[0].toUpperCase() + k.slice(1) : k);
  function nameOf(o) {
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      for (const k of ['titel', 'Titel', 'name', 'Name', 'benutzer', 'label', 'bezeichnung', 'nummer', 'tage', 'Werk', 'werk', 'text', 'datum', 'Datum', 'id', 'bild', '__id']) {
        if (o[k]) return k === 'bild' ? fileName(String(o[k])) : fmtValue(o[k]);
      }
      return '(Eintrag)';
    }
    return fmtValue(o);
  }
  /* Schluessel, an dem sich die Eintraege einer Liste wiedererkennen lassen (auch nach dem Verschieben) */
  function keyOf(a, b) {
    const objs = (l) => l.length && l.every((o) => o && typeof o === 'object' && !Array.isArray(o));
    if (!objs(a.concat(b))) return null;
    return ['__id', 'id', 'benutzer', 'bild', 'anker', 'name', 'titel', 'Titel'].find((k) =>
      [a, b].every((l) => l.every((o) => o[k] !== undefined && o[k] !== '') && new Set(l.map((o) => String(o[k]))).size === l.length)) || null;
  }
  function diffValue(a, b, label, out) {
    if (out.length > MAX_DETAILS) return;
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    /* fehlt -> leer (neues, noch leeres Feld): keine Aenderung */
    if ((a === undefined || a === '') && (b === undefined || b === '')) return;
    const where = label || 'Inhalt';
    if (Array.isArray(a) && Array.isArray(b)) {
      const k = keyOf(a, b);
      if (k) {
        const ma = new Map(a.map((o) => [String(o[k]), o]));
        const mb = new Map(b.map((o) => [String(o[k]), o]));
        const added = [...mb].filter(([id]) => !ma.has(id)).map(([, o]) => o);
        const removed = [...ma].filter(([id]) => !mb.has(id)).map(([, o]) => o);
        /* Gleich viele weg wie neu und sonst weitgehend gleich: das ist eine Aenderung (z. B. umbenannt) */
        const similar = (x, y) => {
          const keys = [...new Set([...Object.keys(x), ...Object.keys(y)])].filter((key) => key !== k && !SKIP.test(key));
          return keys.length > 0 && keys.filter((key) => JSON.stringify(x[key]) === JSON.stringify(y[key])).length >= keys.length / 2;
        };
        if (added.length && added.length === removed.length && added.every((o, i) => similar(removed[i], o))) {
          added.forEach((o, i) => diffValue(removed[i], o, `${where} › ${nameOf(removed[i])}`, out));
        } else {
          for (const o of added) out.push(`${where}: neu „${nameOf(o)}“`);
          for (const o of removed) out.push(`${where}: entfernt „${nameOf(o)}“`);
        }
        for (const [id, o] of mb) if (ma.has(id)) diffValue(ma.get(id), o, `${where} › ${nameOf(o)}`, out);
        const order = (l, m) => l.map((o) => String(o[k])).filter((id) => m.has(id));
        if (order(a, mb).join('\u0000') !== order(b, ma).join('\u0000')) out.push(`${where}: Reihenfolge geändert`);
        return;
      }
      if (a.concat(b).every((v) => v === null || typeof v !== 'object')) {
        const sa = a.map(String);
        const sb = b.map(String);
        for (const v of b) if (!sa.includes(String(v))) out.push(`${where}: neu „${fmtValue(v)}“`);
        for (const v of a) if (!sb.includes(String(v))) out.push(`${where}: entfernt „${fmtValue(v)}“`);
        if (sa.length === sb.length && sa.every((v) => sb.includes(v)) && sa.join('\u0000') !== sb.join('\u0000')) out.push(`${where}: Reihenfolge geändert`);
        return;
      }
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (i >= a.length) out.push(`${where}: neu „${nameOf(b[i])}“`);
        else if (i >= b.length) out.push(`${where}: entfernt „${nameOf(a[i])}“`);
        else diffValue(a[i], b[i], `${where} › ${nameOf(b[i])}`, out);
      }
      return;
    }
    const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
    if (isObj(a) && isObj(b)) {
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (SKIP.test(k) || JSON.stringify(a[k]) === JSON.stringify(b[k])) continue;
        const sub = label ? `${label} › ${keyLabel(k)}` : keyLabel(k);
        if (SECRET.test(k)) out.push(`${sub}: geändert`);
        else diffValue(a[k], b[k], sub, out);
      }
      return;
    }
    if (isObj(b) && (a === undefined || a === null)) out.push(`${where}: neu „${nameOf(b)}“`);
    else if (isObj(a) && (b === undefined || b === null)) out.push(`${where}: entfernt „${nameOf(a)}“`);
    else if (a === undefined) out.push(`${where}: „${fmtValue(b)}“ (neu)`);
    else if (b === undefined) out.push(`${where}: entfernt (war „${fmtValue(a)}“)`);
    else out.push(`${where}: ${textChange(a, b)}`);
  }
  /* CSV -> Liste von Zeilen-Objekten; die ersten beiden Spalten erkennen eine Zeile wieder */
  function csvRecords(text) {
    const rows = HD.parseCSV(String(text).replace(/^\ufeff/, ''));
    if (!rows.length) return [];
    const head = rows[0].map((h, i) => String(h).trim() || `Spalte ${i + 1}`);
    const seen = new Map();
    return rows.slice(1).filter((r) => r.some((c) => String(c).trim())).map((r) => {
      const o = {};
      head.forEach((h, i) => { o[h] = String(r[i] ?? '').trim(); });
      let id = `${o[head[0]]} ${o[head[1]] || ''}`.trim();
      const n = (seen.get(id) || 0) + 1;
      seen.set(id, n);
      if (n > 1) id += ` (${n})`;
      o.__id = id;
      return o;
    });
  }
  function describeChange(path, before, after) {
    if (before === null || before === undefined) return ['Datei neu angelegt'];
    if (before === after) return [];
    const out = [];
    try {
      if (path.endsWith('.json')) diffValue(JSON.parse(before), JSON.parse(after), '', out);
      else diffValue(csvRecords(before), csvRecords(after), 'Zeilen', out);
    } catch {
      return ['Inhalt geändert'];
    }
    if (!out.length) return ['Nur die Schreibweise der Datei geändert'];
    return out.length > MAX_DETAILS ? [...out.slice(0, MAX_DETAILS), `… und weitere Änderungen`] : out;
  }

  /* Gespeichert, aber noch nicht protokolliert */
  const changeQueue = [];
  let changeTimer = 0;
  function noteChange(path, details) {
    if (path === PROTOCOL) return;
    const same = changeQueue.find((c) => c.datei === path);
    if (same) same.details.push(...details);
    else changeQueue.push({ datei: path, bereich: areaOf(path), details: details.slice() });
    clearTimeout(changeTimer);
    /* Ohne log() der Seite: nach kurzer Zeit selbst eintragen */
    changeTimer = setTimeout(() => {
      if (changeQueue.length) log(`${[...new Set(changeQueue.map((c) => c.bereich))].join(', ')} geändert`);
    }, 2500);
  }
  function log(text) {
    clearTimeout(changeTimer);
    const s = session();
    const files = changeQueue.splice(0);
    const several = files.length > 1;
    const entry = {
      zeit: Date.now(),
      wer: s ? s.name : '',
      benutzer: s ? s.benutzer : '',
      text,
      bereiche: [...new Set(files.map((c) => c.bereich))],
      dateien: files.map((c) => c.datei),
      details: files.flatMap((c) => c.details.map((dt) => (several ? `${c.bereich}: ${dt}` : dt))),
      seite: pageName()
    };
    const list = get(KEY_LOG) || [];
    list.unshift(entry);
    put(KEY_LOG, list.slice(0, 30));
    appendProtocol(entry);
  }
  const recentLog = () => get(KEY_LOG) || [];

  /* Gemeinsames Protokoll: der Reihe nach (zwei Speichervorgaenge kurz hintereinander
     duerfen sich nicht gegenseitig ueberschreiben), immer frisch gelesen */
  let protocolChain = Promise.resolve();
  function appendProtocol(entry) {
    if (folder.state !== 'ok') return;
    protocolChain = protocolChain.then(async () => {
      let list = [];
      try {
        const data = JSON.parse(await (await folder.readBlob(PROTOCOL)).text());
        list = Array.isArray(data.eintraege) ? data.eintraege : [];
      } catch (e) {
        /* Fehlt die Datei, wird sie angelegt; ist sie kaputt, bleibt sie, wie sie ist */
        if (!notFoundErr(e)) throw e;
      }
      list.unshift(entry);
      const text = `{"eintraege":[\n${list.slice(0, PROTOCOL_MAX).map((x) => JSON.stringify(x)).join(',\n')}\n]}\n`;
      await folder.write(PROTOCOL, new Blob([text], { type: 'application/json;charset=utf-8' }));
      try { sessionStorage.removeItem(KEY_PROTOCOL_ERR); } catch { /* egal */ }
    }).catch((e) => {
      try { sessionStorage.setItem(KEY_PROTOCOL_ERR, String((e && e.message) || e)); } catch { /* egal */ }
    });
  }
  /* Gemeinsames Protokoll lesen (Seite "Aenderungen"): {list, error} */
  async function readProtocol() {
    if (folder.state !== 'ok') return { list: null, error: 'kein-ordner' };
    try {
      const data = JSON.parse(await (await folder.readBlob(PROTOCOL)).text());
      return { list: Array.isArray(data.eintraege) ? data.eintraege : [], error: '' };
    } catch (e) {
      return { list: notFoundErr(e) ? [] : null, error: notFoundErr(e) ? '' : String((e && e.message) || e) };
    }
  }
  const protocolError = () => { try { return sessionStorage.getItem(KEY_PROTOCOL_ERR) || ''; } catch { return ''; } };

  /* ---------- Meldungen ---------- */
  function toast(msg, kind) {
    let wrap = $('adm-toasts');
    if (!wrap) {
      wrap = d.createElement('div');
      wrap.id = 'adm-toasts';
      wrap.className = 'adm-toasts';
      wrap.setAttribute('aria-live', 'polite');
      d.body.appendChild(wrap);
    }
    const t = d.createElement('div');
    t.className = `adm-toast${kind === 'err' ? ' err' : ''}`;
    if (kind === 'err') t.setAttribute('role', 'alert');
    t.innerHTML = `${icon(kind === 'err' ? 'alert' : 'checkCircle')}<span>${esc(msg)}</span>`;
    wrap.appendChild(t);
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 300);
    }, kind === 'err' ? 8000 : 4200);
  }

  /* ---------- Fenster ---------- */
  function unlockIfLast() {
    if (!d.querySelector('dialog[open]')) ROOT.classList.remove('adm-lock');
  }
  /* Einklappbare Abschnitte in Fenstern: <details class="adm-fold" data-fold="auto"> mit
     <summary>Titel <span class="adm-fold-meta"></span></summary><div class="adm-fold-body">.
     Beim Oeffnen des Fensters ist ein Abschnitt aufgeklappt, wenn etwas darin ausgefuellt
     ist; die Angabe daneben zeigt "n ausgefuellt" oder "leer" und folgt den Eingaben. */
  function foldCount(det) {
    let n = 0;
    det.querySelectorAll('input, select, textarea').forEach((el) => {
      const hid = el.closest('[hidden]');
      /* Vorbelegungen zaehlen nicht: data-fold-skip und die Bezeichnung in Zeilen mit Bezeichnung vorn */
      if (el.hasAttribute('data-fold-skip') || (el.dataset.key === 'label' && el.closest('.label-first'))) return;
      if ((hid && det.contains(hid)) || el.disabled || ['hidden', 'file', 'button', 'submit', 'range', 'color'].includes(el.type)) return;
      if (el.type === 'checkbox' || el.type === 'radio') {
        if (el.checked && !el.defaultChecked) n++;
      } else if (el.tagName === 'SELECT') {
        if (el.selectedIndex > 0 && el.value !== '') n++;
      } else if (String(el.value).trim() !== '') {
        n++;
      }
    });
    /* Eintraege ohne Eingabefeld: Termine, Fotos, Bilder */
    det.querySelectorAll('.adm-date-chip, .adm-ph, .adm-image-prev img').forEach((el) => {
      const hid = el.closest('[hidden]');
      if (!(hid && det.contains(hid))) n++;
    });
    return n;
  }
  function foldMeta(det) {
    const meta = det.querySelector(':scope > summary .adm-fold-meta');
    const n = foldCount(det);
    if (meta) meta.textContent = n ? `${n} ausgefüllt` : 'leer';
    return n;
  }
  function foldSections(root) {
    const folds = root.querySelectorAll('details.adm-fold[data-fold="auto"]');
    folds.forEach((det) => { det.open = foldMeta(det) > 0; });
    if (root._foldWired) return;
    root._foldWired = true;
    const upd = (e) => {
      const det = e.target.closest && e.target.closest('details.adm-fold[data-fold="auto"]');
      if (det) setTimeout(() => foldMeta(det), 0);
    };
    root.addEventListener('input', upd);
    root.addEventListener('change', upd);
    root.addEventListener('click', upd);
  }

  /* Sichtbarer Stand "Ungespeicherte Aenderungen" im Fussbereich jedes Fensters: ein Text
     (aria-live) vor den Knoepfen und die Klasse is-dirty am Fenster. Der Stand folgt den
     Eingaben (input/change/click/drop, nach dem Ereignis per requestAnimationFrame) und
     zusaetzlich einer kurzen Abfrage, solange das Fenster offen ist (z. B. wenn ein Bild
     erst spaeter fertig geladen ist). dlg._isDirty ist eine Funktion ohne Argumente. */
  function syncDirtyState(dlg, reset) {
    let dirty = false;
    try {
      dirty = !reset && dlg.open && !!dlg._isDirty && !!dlg._isDirty();
    } catch {
      /* Zustand gerade nicht lesbar: als unveraendert zeigen */
    }
    if (dlg._dirtyShown === dirty && !reset) return;
    dlg._dirtyShown = dirty;
    dlg.classList.toggle('is-dirty', dirty);
    if (dlg._stateEl) dlg._stateEl.textContent = dirty ? 'Ungespeicherte Änderungen' : '';
  }
  function wireDirtyState(dlg) {
    const host = dlg.querySelector('.adm-dlg-foot-r') || dlg.querySelector('.adm-dlg-foot');
    if (host) {
      const st = d.createElement('span');
      st.className = 'adm-dlg-state';
      st.setAttribute('role', 'status');
      st.setAttribute('aria-live', 'polite');
      host.prepend(st);
      dlg._stateEl = st;
    }
    const save = dlg.querySelector('.adm-dlg-foot button[type="submit"]');
    if (save && !save.title) save.title = `Speichern (${/Mac|iP(hone|ad)/.test(w.navigator.platform || '') ? 'Cmd' : 'Strg'} + S)`;
    let raf = 0;
    const sync = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => syncDirtyState(dlg));
    };
    ['input', 'change', 'click', 'drop'].forEach((ev) => dlg.addEventListener(ev, sync));
    dlg.addEventListener('close', () => {
      clearInterval(dlg._dirtyTimer);
      cancelAnimationFrame(raf);
      syncDirtyState(dlg, true);
    });
  }

  /* Oeffnet ein <dialog>. isDirty(): ungespeicherte Eingaben? Dann wird
     beim Schliessen (Escape, X, Abbrechen) erst nachgefragt. */
  function openDialog(dlg, opts = {}) {
    dlg._isDirty = opts.isDirty || null;
    if (!dlg._wired) {
      dlg._wired = true;
      dlg.addEventListener('cancel', (e) => {
        e.preventDefault();
        requestClose(dlg);
      });
      dlg.addEventListener('click', (e) => {
        if (e.target.closest('[data-close]')) requestClose(dlg);
      });
      dlg.addEventListener('close', unlockIfLast);
      wireDirtyState(dlg);
    }
    foldSections(dlg);
    dlg.showModal();
    ROOT.classList.add('adm-lock');
    /* erst im naechsten Takt: die Aufrufer setzen ihren Ausgangsstand (snap) erst nach openDialog */
    requestAnimationFrame(() => syncDirtyState(dlg));
    clearInterval(dlg._dirtyTimer);
    dlg._dirtyTimer = setInterval(() => syncDirtyState(dlg), 1500);
    const body = dlg.querySelector('.adm-dlg-body');
    if (body) body.scrollTop = 0;
    const first = dlg.querySelector('[data-autofocus]') ||
      dlg.querySelector('.adm-dlg-body input:not([type="file"]):not([type="hidden"]), .adm-dlg-body select, .adm-dlg-body textarea');
    if (first) first.focus();
  }
  async function requestClose(dlg) {
    if (dlg._isDirty && dlg._isDirty()) {
      const ok = await confirmBox({
        title: 'Änderungen verwerfen?',
        text: 'In diesem Fenster wurde etwas geändert und noch nicht gespeichert.',
        ok: 'Verwerfen', cancel: 'Weiter bearbeiten', danger: true
      });
      if (!ok) return;
    }
    dlg.close();
  }

  /* Strg/Cmd + S speichert: im obersten offenen Fenster (Speichern-Knopf im Fussbereich),
     sonst im Formular direkt auf der Seite (genau ein Speichern-Knopf in .adm-inline-foot).
     Ruecksicht auf Rueckfragen: ohne Speichern-Knopf im Fenster passiert nichts. */
  d.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 's' || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.isComposing) return;
    const open = Array.from(d.querySelectorAll('dialog[open]')).pop();
    let btn = null;
    if (open) {
      btn = open.querySelector('.adm-dlg-foot button[type="submit"]');
    } else {
      const subs = d.querySelectorAll('.adm-inline-foot button[type="submit"]');
      if (subs.length === 1) btn = subs[0];
      else if (!subs.length) return;
    }
    e.preventDefault();
    if (btn && !btn.disabled) btn.click();
  });

  /* Sichtbare Hoehe beobachten. Auf iPad/iPhone verdeckt die
     Bildschirmtastatur den unteren Teil, ohne dass sich 100vh/100dvh oder
     Media Queries aendern; daher Klassen und Variablen aus visualViewport:
     adm-low (bis 760 px hoch), adm-short (bis 600 px), adm-kb (Tastatur
     offen), --adm-vh / --adm-vt = Hoehe und Lage des sichtbaren Teils. */
  function syncViewport() {
    const vv = w.visualViewport;
    const h = vv ? vv.height : w.innerHeight;
    ROOT.style.setProperty('--adm-vh', `${Math.round(h)}px`);
    ROOT.style.setProperty('--adm-vt', `${Math.round(vv ? vv.offsetTop : 0)}px`);
    ROOT.classList.toggle('adm-low', h <= 760);
    ROOT.classList.toggle('adm-short', h <= 600);
    ROOT.classList.toggle('adm-kb', !!vv && w.innerHeight - vv.height > 80);
  }
  (w.visualViewport || w).addEventListener('resize', syncViewport);
  if (w.visualViewport) w.visualViewport.addEventListener('scroll', syncViewport);
  syncViewport();

  let cfCount = 0;
  /* Rueckfrage als eigenes Fenster mit frei waehlbaren Knoepfen;
     liefert den value des gedrueckten Knopfes, bei Escape null */
  function choiceBox({ title, text, html, buttons, focus }) {
    return new Promise((resolve) => {
      const id = `adm-cf-${++cfCount}`;
      const dlg = d.createElement('dialog');
      dlg.className = 'adm-dialog small';
      dlg.setAttribute('aria-labelledby', `${id}-t`);
      dlg.setAttribute('aria-describedby', `${id}-x`);
      dlg.innerHTML =
        `<div class="adm-dlg-head"><div><div class="adm-dlg-tag">Rückfrage</div><h2 class="adm-dlg-title" id="${id}-t">${esc(title)}</h2></div></div>` +
        `<div class="adm-dlg-text" id="${id}-x">${html || esc(text)}</div>` +
        '<div class="adm-dlg-foot"><div class="adm-dlg-foot-r">' +
          buttons.map((b) => `<button type="button" class="btn ${b.cls || 'btn-quiet'}" value="${esc(b.value)}">${esc(b.label)}</button>`).join('') +
        '</div></div>';
      d.body.appendChild(dlg);
      let result = null;
      dlg.addEventListener('click', (e) => {
        const b = e.target.closest('button[value]');
        if (!b) return;
        result = b.value;
        dlg.close();
      });
      dlg.addEventListener('close', () => {
        dlg.remove();
        unlockIfLast();
        resolve(result);
      });
      dlg.showModal();
      ROOT.classList.add('adm-lock');
      (dlg.querySelector(`button[value="${focus}"]`) || dlg.querySelector('button[value]:last-child')).focus();
    });
  }

  /* Passwort oder Code abfragen. numeric: Ziffern-Tastatur (Code).
     verify(pw): liefert eine Fehlermeldung oder ''. Ergebnis: die Eingabe,
     bei Abbrechen null. */
  function passwordBox({ title, html, label = 'Passwort', ok = 'Bestätigen', numeric = false, verify }) {
    return new Promise((resolve) => {
      const id = `adm-pw-${++cfCount}`;
      const dlg = d.createElement('dialog');
      dlg.className = 'adm-dialog small';
      dlg.setAttribute('aria-labelledby', `${id}-t`);
      const field = (fid, lab) =>
        `<div class="adm-field full"><label class="adm-label" for="${fid}">${esc(lab)}</label>` +
        `<div class="adm-pw"><input class="adm-input${numeric ? ' adm-code' : ''}" type="password" id="${fid}" autocomplete="off"` +
          `${numeric ? ' inputmode="numeric" pattern="[0-9]*" maxlength="12"' : ''}/>` +
        `<button type="button" class="adm-pw-toggle" aria-label="Passwort anzeigen" aria-pressed="false">${icon('eye')}</button></div></div>`;
      dlg.innerHTML =
        `<div class="adm-dlg-head"><div><div class="adm-dlg-tag">${icon('lock')} Geschützt</div><h2 class="adm-dlg-title" id="${id}-t">${esc(title)}</h2></div></div>` +
        `<form class="adm-dlg-text" novalidate autocomplete="off"><div class="adm-pwbox-text">${html || ''}</div>` +
          '<div class="adm-grid" style="margin-top:1rem">' +
            field(`${id}-a`, label) +
          '</div><div class="adm-pwbox-err" aria-live="assertive"></div>' +
          `<button type="submit" hidden></button></form>` +
        '<div class="adm-dlg-foot"><div class="adm-dlg-foot-r">' +
          '<button type="button" class="btn btn-quiet" value="no">Abbrechen</button>' +
          `<button type="button" class="btn btn-dark" value="yes">${icon('check')}${esc(ok)}</button>` +
        '</div></div>';
      d.body.appendChild(dlg);
      const a = dlg.querySelector(`#${id}-a`);
      const err = dlg.querySelector('.adm-pwbox-err');
      const yes = dlg.querySelector('button[value="yes"]');
      let result = null;
      const fail = (msg, el) => {
        err.innerHTML = `<div class="adm-error">${icon('alert')}<span>${esc(msg)}</span></div>`;
        el.setAttribute('aria-invalid', 'true');
        el.focus();
        el.select();
      };
      async function submit() {
        a.removeAttribute('aria-invalid');
        const pw = a.value;
        if (!pw) return fail(`Bitte ${numeric ? 'den Code' : 'das Passwort'} eingeben.`, a);
        if (verify) {
          yes.disabled = true;
          const msg = await verify(pw);
          yes.disabled = false;
          if (msg) return fail(msg, a);
        }
        result = pw;
        dlg.close();
      }
      dlg.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        submit();
      });
      dlg.addEventListener('click', (e) => {
        const btn = e.target.closest('button[value]');
        if (!btn) return;
        if (btn.value === 'yes') submit();
        else dlg.close();
      });
      dlg.addEventListener('close', () => {
        dlg.remove();
        unlockIfLast();
        resolve(result);
      });
      dlg.showModal();
      ROOT.classList.add('adm-lock');
      a.focus();
    });
  }

  /* Ja/Nein-Rueckfrage; liefert true bei Bestaetigung */
  async function confirmBox({ title, text, html, ok = 'OK', cancel = 'Abbrechen', danger = false }) {
    const r = await choiceBox({
      title, text, html,
      buttons: [{ value: 'no', label: cancel }, { value: 'yes', label: ok, cls: danger ? 'btn-danger' : 'btn-dark' }],
      focus: danger ? 'no' : 'yes'
    });
    return r === 'yes';
  }

  /* ---------- Formularfehler: am Feld und als Liste oben ---------- */
  function describe(input, id, on) {
    const ids = new Set((input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    if (on) ids.add(id);
    else ids.delete(id);
    if (ids.size) input.setAttribute('aria-describedby', [...ids].join(' '));
    else input.removeAttribute('aria-describedby');
  }
  function setError(input, msg) {
    const id = `${input.id}-fehler`;
    let el = $(id);
    if (!msg) {
      if (el) el.remove();
      input.removeAttribute('aria-invalid');
      describe(input, id, false);
      return;
    }
    if (!el) {
      el = d.createElement('p');
      el.id = id;
      el.className = 'adm-error';
      (input.closest('.adm-field') || input.parentNode).appendChild(el);
    }
    el.innerHTML = `${icon('alert')}<span>${esc(msg)}</span>`;
    input.setAttribute('aria-invalid', 'true');
    describe(input, id, true);
    /* Liegt das Feld in einem eingeklappten Abschnitt, aufklappen, damit der Fehler zu sehen ist */
    for (let det = input.closest('details'); det; det = det.parentElement && det.parentElement.closest('details')) det.open = true;
  }
  function clearErrors(root) {
    root.querySelectorAll('[aria-invalid="true"]').forEach((i) => setError(i, ''));
    root.querySelectorAll('.adm-alert.form-errors').forEach((b) => b.remove());
  }
  /* errors: Liste von [Eingabefeld, Text]. Die Liste oben bekommt den Fokus. */
  function showErrors(root, errors) {
    clearErrors(root);
    for (const [input, msg] of errors) setError(input, msg);
    const box = d.createElement('div');
    box.className = 'adm-alert form-errors';
    box.setAttribute('role', 'alert');
    box.tabIndex = -1;
    box.innerHTML = `${icon('alert')}<div><b>Bitte noch prüfen:</b><ul>` +
      errors.map(([i, m]) => `<li><a href="#${esc(i.id)}">${esc(m)}</a></li>`).join('') + '</ul></div>';
    root.prepend(box);
    box.focus();
  }
  d.addEventListener('click', (e) => {
    const a = e.target.closest('.form-errors a');
    if (!a) return;
    e.preventDefault();
    const field = $(a.getAttribute('href').slice(1));
    if (field) field.focus();
  });
  /* Fehlermeldung verschwindet, sobald das Feld korrigiert wird */
  d.addEventListener('input', (e) => {
    const t = e.target;
    if (t.getAttribute && t.getAttribute('aria-invalid') === 'true') setError(t, '');
  });

  /* Momentaufnahme aller Eingaben (fuer "ungespeicherte Aenderungen?") */
  function snapshot(root) {
    return JSON.stringify(Array.from(root.querySelectorAll('input, select, textarea'), (el) => {
      if (el.type === 'file') return '';
      if (el.type === 'checkbox' || el.type === 'radio') return el.checked;
      return el.value;
    }));
  }

  /* ---------- Liste mit Zeilen (z. B. Solisten: Name und Stimme) ----------
     fields: [{key, label, placeholder, list}] — ein bis drei Felder je Zeile.
     Jede Zeile laesst sich mit den Pfeilen (oder Alt + Pfeil im Feld) nach
     oben und unten schieben. blanks: true = eine ganz leere Zeile darf als
     Abstand stehen bleiben (beim Speichern fragt checkBlankRows nach),
     name: wie die Liste in dieser Rueckfrage heisst. */
  const isBlankRow = (o) => Object.values(o).every((v) => !String(v || '').trim());

  function listEditor(host, { fields, addLabel, rowLabel, labelFirst, blanks = false, name = '' }) {
    host.innerHTML = `<div class="adm-list"></div><button type="button" class="adm-list-add">${icon('plus')}${esc(addLabel)}</button>`;
    const listEl = host.firstElementChild;
    const addBtn = host.lastElementChild;
    const rowValues = (row) => {
      const o = {};
      row.querySelectorAll('input').forEach((inp) => { o[inp.dataset.key] = inp.value.trim(); });
      return o;
    };
    function renumber() {
      const rows = Array.from(listEl.children);
      rows.forEach((row, i) => {
        row.querySelectorAll('input').forEach((inp, k) => inp.setAttribute('aria-label', `${fields[k].label} ${i + 1}`));
        row.querySelector('[data-move="-1"]').setAttribute('aria-label', `${rowLabel} ${i + 1} nach oben`);
        row.querySelector('[data-move="1"]').setAttribute('aria-label', `${rowLabel} ${i + 1} nach unten`);
        row.querySelector('.adm-list-del').setAttribute('aria-label', `${rowLabel} ${i + 1} entfernen`);
        row.querySelector('[data-move="-1"]').disabled = i === 0;
        row.querySelector('[data-move="1"]').disabled = i === rows.length - 1;
        row.classList.toggle('is-blank', blanks && rows.length > 1 && isBlankRow(rowValues(row)));
      });
    }
    function add(values = {}, focus = false) {
      const row = d.createElement('div');
      row.className = `adm-list-row${fields.length === 2 ? ' pair' : fields.length > 2 ? ' triple' : ''}${labelFirst ? ' label-first' : ''}`;
      row.innerHTML = fields.map((f) =>
        `<input type="${f.type || 'text'}" class="adm-input" data-key="${f.key}" autocomplete="off"${f.list ? ` list="${f.list}"` : ''}` +
        ` placeholder="${esc(f.placeholder || '')}" value="${esc(values[f.key] || '')}"/>`
      ).join('') +
        '<div class="adm-list-tools">' +
          `<button type="button" class="adm-list-btn" data-move="-1" title="Nach oben">${icon('up')}</button>` +
          `<button type="button" class="adm-list-btn" data-move="1" title="Nach unten">${icon('down')}</button>` +
          `<button type="button" class="adm-list-btn adm-list-del" title="Entfernen">${icon('close')}</button>` +
        '</div>';
      listEl.appendChild(row);
      renumber();
      if (focus) row.querySelector('input').focus();
      return row;
    }
    function move(row, dir) {
      const other = dir < 0 ? row.previousElementSibling : row.nextElementSibling;
      if (!other) return false;
      if (dir < 0) listEl.insertBefore(row, other);
      else listEl.insertBefore(other, row);
      renumber();
      row.classList.remove('moved');
      void row.offsetWidth;
      row.classList.add('moved');
      /* Aenderung melden, damit "noch nicht gespeichert" mitbekommt */
      row.querySelector('input').dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    listEl.addEventListener('click', (e) => {
      const mv = e.target.closest('[data-move]');
      if (mv) {
        const row = mv.closest('.adm-list-row');
        move(row, Number(mv.dataset.move));
        /* Fokus bleibt am Pfeil; am Rand auf den anderen Pfeil */
        (mv.disabled ? row.querySelector(`[data-move="${-Number(mv.dataset.move)}"]`) : mv).focus();
        return;
      }
      const del = e.target.closest('.adm-list-del');
      if (!del) return;
      const row = del.closest('.adm-list-row');
      const next = row.nextElementSibling || row.previousElementSibling;
      row.remove();
      renumber();
      (next ? next.querySelector('input') : addBtn).focus();
      listEl.dispatchEvent(new Event('input', { bubbles: true }));
    });
    listEl.addEventListener('keydown', (e) => {
      if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || e.target.tagName !== 'INPUT') return;
      e.preventDefault();
      move(e.target.closest('.adm-list-row'), e.key === 'ArrowUp' ? -1 : 1);
      e.target.focus();
    });
    listEl.addEventListener('input', () => renumber());
    addBtn.addEventListener('click', () => add({}, true));
    return {
      el: listEl,
      add,
      blanks,
      name: name || addLabel,
      set(items) {
        listEl.innerHTML = '';
        items.forEach((it) => add(it));
      },
      values() {
        return Array.from(listEl.children, rowValues);
      },
      /* Zahl der ganz leeren Zeilen (nur wenn es auch andere gibt) */
      blankCount() {
        const rows = Array.from(listEl.children, rowValues);
        return rows.length > 1 ? rows.filter(isBlankRow).length : 0;
      },
      dropBlanks() {
        for (const row of Array.from(listEl.children)) if (isBlankRow(rowValues(row))) row.remove();
        renumber();
      }
    };
  }

  /* Vor dem Speichern: Gibt es in Listen mit blanks: true ganz leere Zeilen,
     wird gefragt, ob sie als Abstand bleiben oder geloescht werden.
     Liefert false, wenn weiter bearbeitet werden soll. */
  async function checkBlankRows(editors) {
    const hit = editors.filter((ed) => ed && ed.blanks && ed.blankCount());
    if (!hit.length) return true;
    const n = hit.reduce((sum, ed) => sum + ed.blankCount(), 0);
    const where = hit.map((ed) => `<strong>${esc(ed.name)}</strong>`).join(' und ');
    const r = await choiceBox({
      title: n === 1 ? 'Freie Zeile gefunden' : `${n} freie Zeilen gefunden`,
      html: `In ${where} ${n === 1 ? 'ist eine Zeile' : `sind ${n} Zeilen`} ganz leer.<br><br>` +
        `Soll${n === 1 ? '' : 'en'} sie als <strong>Abstand</strong> stehen bleiben (auf der Website entsteht dort eine Lücke) oder gelöscht werden?`,
      buttons: [
        { value: 'back', label: 'Zurück' },
        { value: 'del', label: 'Löschen' },
        { value: 'keep', label: 'Als Abstand behalten', cls: 'btn-dark' }
      ],
      focus: 'keep'
    });
    if (r === 'del') hit.forEach((ed) => ed.dropBlanks());
    return r === 'del' || r === 'keep';
  }

  /* ---------- Bilder ----------
     Ohne Angaben: WebP bleibt unveraendert, andere Formate werden in voller
     Groesse in WebP umgewandelt. square: quadratischer Ausschnitt (x/y von
     0 bis 1 = Lage des Ausschnitts) in size × size Pixeln. Klappt die
     Umwandlung nicht, bleibt das Original. */
  /* Jedes hochgeladene Bild wird als WebP gespeichert (kleiner als JPG und PNG, von allen
     aktuellen Browsern unterstuetzt). Dabei wird es auf hoechstens 2000 Pixel an der
     laengsten Seite verkleinert (maxSize aendert das) und die Kamera-Angaben (Ort,
     Geraet) fallen weg. Ein kleines WebP bleibt unveraendert. Kann der Browser das
     Format nicht lesen (z. B. HEIC vom iPhone), bricht es mit einer Meldung ab. */
  const MAX_SIDE = 2000;
  const KEEP_WEBP_BYTES = 900 * 1024;

  /* Eine gewaehlte Datei sofort in den Arbeitsspeicher lesen. Der Browser prueft die Datei
     sonst erst beim spaeteren Lesen oder Speichern und meldet dann "state had changed since
     it was read from disk", z. B. bei Dateien in OneDrive, auf dem Handy oder solchen, die
     gerade noch geschrieben werden. Ein zweiter Versuch faengt kurze Aenderungen ab. */
  async function stableFile(file) {
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const buf = await file.arrayBuffer();
        return new File([buf], file.name, { type: file.type, lastModified: file.lastModified });
      } catch (e) {
        lastError = e;
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    toast(`„${file.name}“ lässt sich nicht lesen. Liegt die Datei in einem Cloud-Ordner (OneDrive …) oder auf dem Handy, oder wird sie noch bearbeitet? Bitte zuerst auf den Computer kopieren und dann noch einmal wählen.`, 'err');
    throw lastError;
  }

  /* Dateikopf pruefen (Magic Bytes), damit Endung und Inhalt zusammenpassen:
     kind = 'png' | 'jpg' | 'webp' | 'mp3' */
  async function magicOk(file, kind) {
    let b;
    try {
      b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    } catch {
      return false;
    }
    const at = (i, str) => [...str].every((c, k) => b[i + k] === c.charCodeAt(0));
    if (kind === 'png') return b.length >= 8 && b[0] === 0x89 && at(1, 'PNG') && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a;
    if (kind === 'jpg') return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    if (kind === 'webp') return b.length >= 12 && at(0, 'RIFF') && at(8, 'WEBP');
    if (kind === 'mp3') return b.length >= 3 && (at(0, 'ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0));
    return false;
  }

  async function toWebp(file, opts = {}) {
    file = await stableFile(file);
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const isWebp = file.type === 'image/webp' || ext === 'webp';
    const maxSize = opts.maxSize || MAX_SIDE;
    try {
      const bmp = await createImageBitmap(file);
      if (!opts.square && isWebp && Math.max(bmp.width, bmp.height) <= maxSize && file.size <= KEEP_WEBP_BYTES) {
        if (bmp.close) bmp.close();
        return { blob: file, ext: 'webp' };
      }
      const canvas = d.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (opts.square) {
        const side = Math.min(bmp.width, bmp.height);
        const size = Math.min(opts.size || 400, side);
        canvas.width = size;
        canvas.height = size;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bmp, (bmp.width - side) * (opts.x ?? 0.5), (bmp.height - side) * (opts.y ?? 0.5), side, side, 0, 0, size, size);
      } else {
        /* maxSize: laengste Seite hoechstens so viele Pixel */
        const scale = Math.min(1, maxSize / Math.max(bmp.width, bmp.height));
        canvas.width = Math.round(bmp.width * scale);
        canvas.height = Math.round(bmp.height * scale);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      }
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', opts.quality || 0.9));
      if (blob && blob.type === 'image/webp') return { blob, ext: 'webp', converted: true };
    } catch {
      /* Browser kann das Bild nicht umwandeln: unten entscheiden */
    }
    /* Ein Browser ohne WebP-Ausgabe: JPG, PNG und WebP bleiben, wie sie sind (das Web zeigt sie an) */
    if (isWebp || ['jpg', 'jpeg', 'png'].includes(ext)) {
      const kind = isWebp ? 'webp' : ext === 'png' ? 'png' : 'jpg';
      if (!(await magicOk(file, kind))) {
        toast(`„${file.name}“ ist keine gültige ${kind === 'jpg' ? 'JPG' : kind.toUpperCase()}-Bilddatei (Dateiinhalt und Endung passen nicht zusammen). Bitte das Bild neu als JPG, PNG oder WebP speichern.`, 'err');
        throw new Error('Dateiinhalt passt nicht zur Endung');
      }
      return { blob: file, ext: kind };
    }
    toast('Dieses Bildformat kann der Browser nicht umwandeln. Bitte als JPG, PNG oder WebP speichern und noch einmal wählen.', 'err');
    throw new Error('Bildformat nicht unterstützt');
  }
  /* Ablageflaeche: Ziehen und Ablegen hervorheben (das Dateifeld liegt darueber) */
  function wireDrop(label) {
    const on = () => label.classList.add('is-over');
    const off = () => label.classList.remove('is-over');
    label.addEventListener('dragenter', on);
    label.addEventListener('dragover', on);
    label.addEventListener('dragleave', off);
    label.addEventListener('drop', off);
  }

  /* Neuigkeiten (data/news.csv): Spalten ueber die Ueberschrift finden,
     damit die Reihenfolge egal ist; neueste Meldung zuerst */
  const NEWS_HEAD = ['Datum', 'Bis', 'Kategorie', 'Titel', 'Kurztext', 'Infos', 'Details', 'Vorschaubild', 'Plakat', 'Link', 'Linktext', 'Weiterer Link', 'Weiterer Linktext', 'Bildausschnitt'];
  function parseNews(text) {
    const rows = HD.parseCSV(text);
    if (!rows.length) return [];
    const header = rows[0].map((c) => String(c).trim().toLowerCase());
    const idx = NEWS_HEAD.map((h) => header.lastIndexOf(h.toLowerCase()));
    return rows.slice(1).map((r) => {
      const o = {};
      NEWS_HEAD.forEach((h, k) => { o[h] = idx[k] >= 0 ? (r[idx[k]] || '').trim() : ''; });
      return o;
    }).filter((o) => o.Titel && HD.isoDate(o.Datum))
      .sort((a, b) => HD.isoDate(b.Datum).localeCompare(HD.isoDate(a.Datum)));
  }

  /* Welche Meldungen stehen auf der Startseite? Zuerst die neuesten, deren
     "Bis"-Datum (einschliesslich) noch nicht vorbei ist (ohne Datum zwei
     Wochen ab dem Datum der Meldung); reicht das nicht fuer 3, wird mit den neuesten abgelaufenen
     aufgefuellt, die dann unten stehen. Gleiche Regel wie in js/news.js.
     Liefert ein Set. */
  const NEWS_HOME = 4;   /* gleiche Zahl wie LATEST in js/news.js */
  function newsExpired(e, today = isoToday()) {
    const until = HD.newsUntil(HD.isoDate(e.Datum), e.Bis);
    return Boolean(until) && until < today;
  }
  function newsOnHome(list) {
    const today = isoToday();
    const live = list.filter((e) => !newsExpired(e, today));
    const past = list.filter((e) => newsExpired(e, today));
    return new Set([...live, ...past].slice(0, NEWS_HOME));
  }

  /* Was fehlt bei einem Hochamt noch? Gilt fuer Hochaemter, Requiem und
     Pontifikalamt; bei anderen Anlaessen (Konzert, Adventlichter …) nur das Werk. */
  const MISSING = [['piece', 'Werk'], ['celebrant', 'Zelebrant'], ['conductor', 'Dirigent'], ['organist', 'Organist']];
  function missingInfo(e) {
    const keys = /hochamt|requiem|pontifikal/i.test(e.type || '') ? MISSING : MISSING.slice(0, 1);
    return keys.filter(([k]) => !String(e[k] || '').trim()).map(([, label]) => label);
  }

  /* ---------- Seitenleiste ---------- */
  /* Alle Bereiche links in einer festen Leiste, nach Themen gruppiert (dieselben
     Gruppen wie die Liste auf der Uebersicht). Gezeigt wird nur, was die angemeldete
     Person bearbeiten darf; leere Gruppen fallen weg. Am Handy klappt die Leiste
     ueber den Knopf "Menue" von links herein.
     Eintrag: [Adresse, Name, Symbol, weitere Suchwoerter] */
  const NAV = [
    { items: [['uebersicht.html', 'Übersicht', 'home', 'Start Noch offen Zuletzt geändert']] },
    { label: 'Aktuelles', items: [
      ['neuigkeiten.html', 'Neuigkeiten', 'news', 'Meldungen Plakat News'],
      ['termine.html', 'Termine', 'calendar', 'Ausflüge Feste Veranstaltungen'],
      ['hochaemter.html', 'Hochämter', 'music', 'Messen Werke Dirigent Organist Zelebrant']
    ] },
    { label: 'Pfarre & Kloster', items: [
      ['gottesdienste.html', 'Regelmäßige Termine', 'clock', 'Gottesdienste Messen Wochenplan Ferien Pausen Vesper Laudes'],
      ['wochenkalender.html', 'Wochenkalender', 'calendarWeek', 'Woche Zelebrant Heilige Druck'],
      ['runden.html', 'Runden', 'users', 'Gruppen Angebote Kreise Bibelrunde'],
      ['kontakt.html', 'Pfarrkanzlei & Kontakt', 'phone', 'Öffnungszeiten Telefon E-Mail Adresse Straße Kanzlei'],
      ['rundgang.html', 'Kirchenrundgang', 'image', 'Chronik Bilder Fotos Führung Geschichte'],
      ['pgr.html', 'Pfarrgemeinderat', 'users', 'PGR Mitglieder'],
      ['personen.html?bereich=kloster', 'Mitbrüder', 'user', 'Patres Brüder Kloster Konvent']
    ] },
    { label: 'Kirchenmusik', items: [
      ['solisten.html', 'Solisten', 'mic', 'Sänger Sopran Alt Tenor Bass Foto'],
      ['repertoire.html', 'Repertoire', 'book', 'Komponisten Werke Messen Chor'],
      ['personen.html?bereich=musik', 'Leitung & Organisten', 'user', 'Dirigent Chorleiter Organist Orgel Gastdirigenten'],
      ['paten.html', 'Paten & Ehrenpaten', 'heart', 'Patenschaft Ehrenpaten Förderer Spender'],
      ['spenden.html', 'Spenden & Möglichkeiten', 'heart', 'Patenschaft Spenden PayPal Beträge Preise Förderer Stifter'],
      ['cds.html', 'CDs', 'disc', 'Aufnahmen Hörproben Cover']
    ] },
    { label: 'Website', items: [
      ['startseite.html', 'Titelfotos', 'image', 'Startseite Fotos Vollbild Einstellungen'],
      ['hinweise.html', 'Hinweisbanner', 'alert', 'Banner Hinweis Einstellungen'],
      ['sprueche.html', 'Sprüche', 'quote', 'Zitate Einstellungen'],
      ['design.html', 'Farben & Logo', 'palette', 'Design Thema Titelzeile Einstellungen'],
      ['rechtliches.html', 'Impressum & Datenschutz', 'shield', 'Rechtliches Einstellungen']
    ] },
    { label: 'Verwaltung', items: [
      ['zugaenge.html', 'Zugänge', 'key', 'Benutzer Passwort Rollen Rechte'],
      ['aenderungen.html', 'Änderungen', 'history', 'Protokoll Wer wann was'],
      ['mitteilungen.html', 'Mitteilungen', 'info', 'Wartung Hinweis an alle']
    ] }
  ];
  /* Nur das zeigen, was die angemeldete Person bearbeiten darf */
  function allowedNav() {
    const ok = (href) => {
      const [page, query] = href.split('?');
      if (page === 'personen.html') return can(new URLSearchParams(query).get('bereich') === 'kloster' ? 'mitbrueder' : 'musik-personen');
      if (page === 'zugaenge.html') return isAdmin();
      if (page === 'aenderungen.html' || page === 'mitteilungen.html') return isDev();
      return allowed(rightOfPage(page));
    };
    return NAV.map((g) => ({ ...g, items: g.items.filter(([href]) => ok(href)) })).filter((g) => g.items.length);
  }
  /* Bereich der Personen-Seite: Mitbrueder (Kloster) oder Kirchenmusik */
  function personenBereich() {
    const q = new URLSearchParams(location.search);
    if (q.get('bereich') === 'kloster' || q.get('gruppe') === 'mitbrueder') return 'kloster';
    return 'musik';
  }
  /* Ist ein Eintrag (Adresse mit optionalem ?bereich=) die aktuelle Seite? */
  function isHere(href) {
    const [page, query] = href.split('?');
    if (page !== pageName()) return false;
    const bereich = query && new URLSearchParams(query).get('bereich');
    return !bereich || bereich === personenBereich();
  }
  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/);
    return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  /* Suche in der Leiste: ohne Akzente und Gross-/Kleinschreibung, "ss" findet auch "ß" */
  const normSearch = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
  /* Bis zu dieser Breite ist die Leiste eine Schublade (gleicher Wert wie in admin.css) */
  const DRAWER = w.matchMedia('(max-width: 960px)');
  const KEY_SIDE_SCROLL = 'aug-admin-leiste';
  /* Eingeklappte Leiste (nur Symbole) merkt sich der Browser dauerhaft */
  const KEY_SIDE_SLIM = 'aug-admin-leiste-schmal';
  function mountTop() {
    const el = $('adm-top');
    if (!el) return;
    const s = session();
    const here = pageName();
    const nav = allowedNav();
    const brand = '<a class="nav-logo-wrap adm-brand" href="uebersicht.html">' +
        '<img class="nav-logo-img" src="../assets/logo.png" alt="" width="38" height="38" decoding="async"/>' +
        '<div><div class="nav-logo-text">Augustiner<span>kirche</span> Wien</div><span class="nav-logo-sub">Verwaltung</span></div>' +
      '</a>';
    el.innerHTML =
      /* Handy und Tablet: schmale Leiste oben mit Menue-Knopf */
      '<div class="adm-mbar">' +
        `<button type="button" class="adm-menu-btn" id="adm-menu-btn" aria-expanded="false" aria-controls="adm-side" aria-label="Menü" title="Menü">${icon('menu')}</button>` +
        brand +
        `<a class="adm-mbar-me" href="profil.html" aria-label="Mein Profil"><span class="adm-avatar" aria-hidden="true">${esc(initials(s.name))}</span></a>` +
      '</div>' +
      '<div class="adm-side" id="adm-side">' +
        `<div class="adm-side-head">${brand}` +
          `<button type="button" class="adm-side-toggle" id="adm-side-toggle" aria-controls="adm-side">${icon('left')}</button>` +
          `<button type="button" class="adm-side-close" id="adm-side-close" aria-label="Menü schließen">${icon('close')}</button></div>` +
        '<div class="adm-side-search">' +
          `<button type="button" class="adm-side-qbtn" id="adm-side-qbtn" aria-label="Bereich suchen (Strg+K)" title="Bereich suchen (Strg+K)">${icon('search')}</button>` +
          `${icon('search')}<input type="search" id="adm-side-q" placeholder="Bereich suchen" aria-label="Bereich suchen (Strg+K)" autocomplete="off" spellcheck="false"/>` +
          '<kbd aria-hidden="true">Strg K</kbd>' +
        '</div>' +
        '<nav class="adm-side-nav" aria-label="Verwaltung">' +
          nav.map((g) => `<div class="adm-side-group">${g.label ? `<h2 class="adm-side-h">${esc(g.label)}</h2>` : ''}<ul>` +
            g.items.map(([href, label, ico, keys]) =>
              `<li><a href="${href}" data-keys="${esc(keys || '')}"${isHere(href) ? ' aria-current="page"' : ''}>${icon(ico)}<span>${esc(label)}</span></a></li>`).join('') +
            '</ul></div>').join('') +
          '<p class="adm-side-none" id="adm-side-none" hidden>Kein Bereich gefunden.</p>' +
        '</nav>' +
        '<div class="adm-side-foot">' +
          '<div class="adm-side-folder" data-adm-folder-side></div>' +
          '<div class="adm-user">' +
            `<a class="adm-me" href="profil.html" title="Mein Profil: Passwort ändern"${here === 'profil.html' ? ' aria-current="page"' : ''}>` +
              `<span class="adm-avatar" aria-hidden="true">${esc(initials(s.name))}</span>` +
              `<span class="adm-user-txt"><span class="adm-user-name">${esc(s.name)}</span><span class="adm-user-sub">Mein Profil</span></span></a>` +
          '</div>' +
          '<div class="adm-side-links">' +
            `<a class="adm-side-link" href="../index.html" target="_blank" rel="noopener" aria-label="Website ansehen (neues Fenster)" title="Website ansehen">${icon('globe')}</a>` +
            `<button type="button" class="adm-side-link" id="adm-logout" aria-label="Abmelden" title="Abmelden">${icon('logout')}</button>` +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="adm-side-scrim" id="adm-side-scrim" hidden></div>';
    d.body.classList.add('has-side');
    $('adm-logout').addEventListener('click', () => logout('abgemeldet'));
    /* Der Seitenkopf mit der Ueberschrift steht ausserhalb von <main>: als benannter Bereich kennzeichnen */
    const head = d.querySelector('.adm-head');
    const h1 = head && head.querySelector('h1');
    if (head && h1) {
      head.setAttribute('role', 'region');
      head.setAttribute('aria-label', h1.textContent.trim());
    }
    wireSide();
  }

  function wireSide() {
    const side = $('adm-side');
    const btn = $('adm-menu-btn');
    const scrim = $('adm-side-scrim');
    const q = $('adm-side-q');
    const links = [...side.querySelectorAll('.adm-side-nav a')];
    const isOpen = () => d.body.classList.contains('side-open');

    /* Einklappen (am Computer): nur noch die Symbole, Namen als Tooltip; als Schublade gilt es nicht */
    const toggle = $('adm-side-toggle');
    const isSlim = () => d.body.classList.contains('side-slim');
    const setSlim = (slim, save) => {
      d.body.classList.toggle('side-slim', slim);
      const label = slim ? 'Menü ausklappen' : 'Menü einklappen';
      toggle.setAttribute('aria-expanded', String(!slim));
      toggle.setAttribute('aria-label', label);
      toggle.title = label;
      toggle.innerHTML = icon(slim ? 'right' : 'left');
      links.forEach((a) => { if (slim) a.title = a.textContent.trim(); else a.removeAttribute('title'); });
      if (save) put(KEY_SIDE_SLIM, slim);
    };
    setSlim(get(KEY_SIDE_SLIM) === true, false);
    /* Erst nach dem ersten Zeichnen animieren, sonst klappt die Leiste beim Laden jeder Seite sichtbar zu */
    w.requestAnimationFrame(() => w.requestAnimationFrame(() => d.body.classList.add('side-anim')));
    toggle.addEventListener('click', () => setSlim(!isSlim(), true));
    const expandForSearch = () => {
      if (isSlim() && !DRAWER.matches) setSlim(false, true);
      q.focus();
      q.select();
    };
    $('adm-side-qbtn').addEventListener('click', expandForSearch);
    /* Die Leiste bleibt beim Seitenwechsel an derselben Stelle stehen (sonst springt sie
       nach jedem Klick nach oben); ohne gemerkte Stelle den aktuellen Eintrag sichtbar machen */
    const navEl = side.querySelector('.adm-side-nav');
    const cur = navEl.querySelector('[aria-current]');
    let kept = NaN;
    try { kept = parseFloat(sessionStorage.getItem(KEY_SIDE_SCROLL)); } catch { /* egal */ }
    if (!Number.isNaN(kept)) navEl.scrollTop = kept;
    if (cur) {
      const r = cur.getBoundingClientRect();
      const box = navEl.getBoundingClientRect();
      if (r.top < box.top || r.bottom > box.bottom) cur.scrollIntoView({ block: 'nearest' });
    }
    const keepScroll = () => { try { sessionStorage.setItem(KEY_SIDE_SCROLL, String(navEl.scrollTop)); } catch { /* egal */ } };
    navEl.addEventListener('click', keepScroll);
    w.addEventListener('pagehide', keepScroll);

    /* Als Schublade liegt die Leiste ausserhalb des Bildschirms: dann fuer Tastatur und Vorlesen verbergen */
    const sync = () => {
      if (!DRAWER.matches && isOpen()) d.body.classList.remove('side-open');
      side.inert = DRAWER.matches && !isOpen();
      scrim.hidden = !isOpen();
      btn.setAttribute('aria-expanded', String(isOpen()));
      if (DRAWER.matches && isOpen()) {
        side.setAttribute('role', 'dialog');
        side.setAttribute('aria-modal', 'true');
        side.setAttribute('aria-label', 'Menü');
      } else {
        ['role', 'aria-modal', 'aria-label'].forEach((a) => side.removeAttribute(a));
      }
    };
    const open = () => {
      d.body.classList.add('side-open');
      sync();
      (side.querySelector('.adm-side-nav [aria-current]') || q).focus();
    };
    const close = () => {
      d.body.classList.remove('side-open');
      sync();
      btn.focus();
    };
    btn.addEventListener('click', open);
    $('adm-side-close').addEventListener('click', close);
    scrim.addEventListener('click', close);
    side.addEventListener('keydown', (e) => {
      if (!isOpen()) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
      /* Fokus in der offenen Schublade halten */
      if (e.key === 'Tab') {
        const f = [...side.querySelectorAll('a[href],button,input')].filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        if (e.shiftKey && d.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && d.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    DRAWER.addEventListener('change', sync);
    sync();

    /* Suche: blendet nicht passende Eintraege aus; Enter oeffnet den ersten Treffer */
    const visible = () => links.filter((a) => !a.closest('li').hidden);
    const filter = () => {
      const words = normSearch(q.value).split(/\s+/).filter(Boolean);
      let any = 0;
      side.querySelectorAll('.adm-side-group').forEach((g) => {
        const h = g.querySelector('.adm-side-h');
        let n = 0;
        g.querySelectorAll('li').forEach((li) => {
          const a = li.querySelector('a');
          const hay = normSearch(`${a.textContent} ${a.dataset.keys} ${h ? h.textContent : ''}`);
          li.hidden = !words.every((x) => hay.includes(x));
          if (!li.hidden) n++;
        });
        g.hidden = !n;
        any += n;
      });
      $('adm-side-none').hidden = any > 0;
    };
    q.addEventListener('input', filter);
    q.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const first = visible()[0];
        if (first) location.href = first.href;
      } else if (e.key === 'Escape' && q.value) {
        e.stopPropagation();
        q.value = '';
        filter();
      } else if (e.key === 'ArrowDown') {
        const first = visible()[0];
        if (first) { e.preventDefault(); first.focus(); }
      }
    });
    /* In der Liste mit den Pfeiltasten weiter */
    side.querySelector('.adm-side-nav').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const list = visible();
      const i = list.indexOf(d.activeElement);
      if (i < 0) return;
      e.preventDefault();
      if (e.key === 'ArrowUp' && i === 0) q.focus();
      else (list[e.key === 'ArrowDown' ? Math.min(i + 1, list.length - 1) : i - 1]).focus();
    });
    /* Strg+K (Mac: Cmd+K) springt in die Suche; als Schublade oeffnet es dafuer die Leiste */
    d.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'k') return;
      if (d.querySelector('dialog[open]')) return;
      e.preventDefault();
      if (DRAWER.matches && !isOpen()) open();
      expandForSearch();
    });
  }

  /* ---------- Mitteilungen an alle in der Verwaltung (admin/mitteilungen.json) ----------
     Schreibt ein Entwickler unter admin/mitteilungen.html (z. B. Neustart des
     Servers, kurzfristige Updates). Erscheinen auf jeder Seite der Verwaltung
     und auf der Anmeldung, solange sie gelten (von/bis, Datum oder Datum mit
     Uhrzeit). "Gelesen" blendet eine Mitteilung auf diesem Geraet aus; wird
     sie geaendert, erscheint sie wieder. */
  const NOTICES = 'admin/mitteilungen.json';
  const KEY_READ = 'aug-admin-gelesen';
  const NOTICE_ART = { info: 'Information', wartung: 'Wartung', wichtig: 'Wichtig' };
  function noticeTime(v, end) {
    const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?$/.exec(String(v || ''));
    if (!m) return NaN;
    return new Date(`${m[1]}T${m[2] || (end ? '23:59:59' : '00:00')}`).getTime();
  }
  function noticeActive(h, now = Date.now()) {
    if (!h || h.aktiv === false || !h.titel) return false;
    const from = h.von ? noticeTime(h.von, false) : -Infinity;
    const to = h.bis ? noticeTime(h.bis, true) : Infinity;
    return !Number.isNaN(from) && !Number.isNaN(to) && from <= now && now <= to;
  }
  function noticeSig(h) {
    const str = `${h.id}|${h.titel}|${h.text}|${h.bis}`;
    let x = 0;
    for (let i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) | 0;
    return `${h.id}:${(x >>> 0).toString(36)}`;
  }
  function noticeWhen(h) {
    const f = (v) => {
      const [dd, t] = String(v).split('T');
      return `${fmtShort(dd)}${t ? `, ${t} Uhr` : ''}`;
    };
    return h.bis ? `gilt bis ${f(h.bis)}` : '';
  }
  function noticeHTML(h, closable = true) {
    const a = NOTICE_ART[h.art] ? h.art : 'info';
    const meta = [NOTICE_ART[a], h.von_wem ? `von ${h.von_wem}` : '', noticeWhen(h)].filter(Boolean).join(' · ');
    return `<div class="adm-notice is-${a}" role="${a === 'info' ? 'status' : 'alert'}" data-sig="${esc(noticeSig(h))}">` +
      `<span class="adm-notice-ico" aria-hidden="true">${icon(a === 'wichtig' ? 'alert' : a === 'wartung' ? 'refresh' : 'info')}</span>` +
      '<div class="adm-notice-body">' +
        `<strong class="adm-notice-title">${esc(h.titel)}</strong>` +
        (h.text ? `<p class="adm-notice-text">${String(h.text).split('\n').map((l) => HD.richText(l, '../')).join('<br>')}</p>` : '') +
        `<span class="adm-notice-meta">${esc(meta)}</span>` +
      '</div>' +
      (closable ? `<button type="button" class="adm-act adm-notice-close" aria-label="Gelesen, ausblenden: ${esc(h.titel)}">${icon('check')}Gelesen</button>` : '') +
    '</div>';
  }
  async function showNotices() {
    let list;
    try {
      const text = folder.state === 'ok' ? await folder.read(NOTICES) : await fetchText(NOTICES);
      list = JSON.parse(text).mitteilungen || [];
    } catch {
      return;   /* keine Mitteilungen (Datei fehlt) */
    }
    const read = get(KEY_READ) || [];
    const show = list.filter((h) => noticeActive(h) && !read.includes(noticeSig(h)))
      .sort((x, y) => (y.art === 'wichtig') - (x.art === 'wichtig'));
    d.querySelectorAll('.adm-notices').forEach((el) => el.remove());
    if (!show.length) return;
    const box = d.createElement('div');
    box.className = 'adm-notices';
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', 'Mitteilungen');
    box.innerHTML = `<div class="adm-notices-in">${show.map((h) => noticeHTML(h)).join('')}</div>`;
    const top = $('adm-top');
    const login = d.querySelector('.login-panel-in') || d.querySelector('.login-panel');
    if (top) top.after(box);
    else if (login) login.prepend(box);
    else d.body.prepend(box);
    box.addEventListener('click', (e) => {
      const btn = e.target.closest('.adm-notice-close');
      if (!btn) return;
      const n = btn.closest('.adm-notice');
      put(KEY_READ, [...(get(KEY_READ) || []), n.dataset.sig].slice(-50));
      n.remove();
      if (!box.querySelector('.adm-notice')) box.remove();
    });
  }

  /* Aktivitaet verlaengert die Sitzung; Abmelden in einem anderen Tab gilt ueberall */
  function watchSession() {
    let last = 0;
    const bump = () => {
      const now = Date.now();
      if (now - last < 60000) return;
      last = now;
      const s = session();
      if (!s) return logout('abgelaufen');
      put(KEY_SESSION, { ...s, bis: now + IDLE_MS });
    };
    d.addEventListener('pointerdown', bump, { passive: true });
    d.addEventListener('keydown', bump);
    setInterval(() => { if (!session()) logout('abgelaufen'); }, 60000);
    w.addEventListener('storage', (e) => {
      if (e.key === KEY_SESSION && !session()) logout('abgemeldet');
    });
    bump();
  }

  /* Warnung beim Verlassen mit ungespeicherten Aenderungen */
  const guards = [hasUnsaved];
  w.addEventListener('beforeunload', (e) => {
    if (guards.some((g) => g())) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  /* Klicks auf Ordner-Knoepfe und Passwort-Anzeigen ueberall auf der Seite */
  d.addEventListener('click', (e) => {
    const f = e.target.closest('[data-folder]');
    if (f) {
      const act = f.dataset.folder;
      if (act === 'connect') folder.connect();
      if (act === 'allow') folder.allow();
      if (act === 'disconnect') folder.disconnect();
    }
    const t = e.target.closest('.adm-pw-toggle');
    if (t) {
      const input = t.parentNode.querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      t.setAttribute('aria-pressed', String(show));
      t.setAttribute('aria-label', show ? 'Passwort verbergen' : 'Passwort anzeigen');
      t.innerHTML = icon(show ? 'eyeOff' : 'eye');
    }
  });

  /* ---------- Formatierungsleiste fuer Textfelder ----------
     Ueber jedem mehrzeiligen Textfeld der Verwaltung (textarea.adm-input) steht eine
     Leiste: fett, kursiv, unterstrichen, durchgestrichen, Link und "Formatierung
     entfernen"; dazu Strg+B, Strg+I, Strg+U. Sie schreibt die Zeichen, die die Website
     anzeigt (HD.richText): **fett** *kursiv* __unterstrichen__ ~~durchgestrichen~~
     [Text](Adresse). Ein zweiter Klick auf dasselbe Format nimmt es wieder weg.
     Ausnahmen: data-no-format am Feld, Impressum & Datenschutz (eigene Leiste, .rt-text). */
  const FORMATS = [
    ['bold', '**', 'Fett (Strg+B)', '<b>B</b>', 'fett'],
    ['italic', '*', 'Kursiv (Strg+I)', '<i>I</i>', 'kursiv'],
    ['underline', '__', 'Unterstrichen (Strg+U)', '<u>U</u>', 'unterstrichen'],
    ['strike', '~~', 'Durchgestrichen', '<s>S</s>', 'durchgestrichen']
  ];
  const FORMAT_KEYS = { b: 'bold', i: 'italic', u: 'underline' };
  /* Steht die Auswahl schon in diesem Format? "*" darf dabei nicht Teil von "**" sein */
  function hasMark(value, a, b, mark) {
    const before = value.slice(Math.max(0, a - mark.length - 1), a);
    const after = value.slice(b, b + mark.length + 1);
    if (!before.endsWith(mark) || !after.startsWith(mark)) return false;
    if (mark !== '*') return true;
    /* "**fett**": ein einzelnes * davor ist nur dann kursiv, wenn davor kein weiteres * steht (oder genau drei) */
    const left = value.slice(0, a).match(/\*+$/)[0].length;
    const right = value.slice(b).match(/^\*+/)[0].length;
    return left % 2 === 1 && right % 2 === 1;
  }
  function applyFormat(ta, kind) {
    const { selectionStart: a, selectionEnd: b, value } = ta;
    const sel = value.slice(a, b);
    ta.focus();
    if (kind === 'link') {
      const text = sel ? `[${sel}](https://)` : '[Text](https://)';
      ta.setRangeText(text, a, b, 'end');
      /* Adresse markieren (bzw. das Wort "Text"), damit man gleich weitertippt */
      if (sel) ta.setSelectionRange(a + text.length - 9, a + text.length - 1);
      else ta.setSelectionRange(a + 1, a + 5);
    } else if (kind === 'clear') {
      if (!sel) {
        toast('Bitte zuerst den Text markieren, dessen Formatierung entfernt werden soll.');
        return;
      }
      const plain = HD.plainText(sel);
      ta.setRangeText(plain, a, b, 'select');
    } else {
      const f = FORMATS.find((x) => x[0] === kind);
      if (!f) return;
      const mark = f[1];
      if (sel.length > mark.length * 2 && sel.startsWith(mark) && sel.endsWith(mark) && (mark !== '*' || !sel.startsWith('**') || sel.startsWith('***'))) {
        /* Auswahl samt Zeichen markiert: Zeichen entfernen */
        ta.setRangeText(sel.slice(mark.length, -mark.length), a, b, 'select');
      } else if (sel && hasMark(value, a, b, mark)) {
        /* Zeichen stehen um die Auswahl: entfernen */
        ta.setRangeText(sel, a - mark.length, b + mark.length, 'select');
      } else {
        /* Leerzeichen am Rand der Auswahl bleiben draussen ("**Wort** " statt "**Wort **") */
        const lead = sel.match(/^\s*/)[0];
        const trail = sel.slice(lead.length).match(/\s*$/)[0];
        const core = sel.slice(lead.length, sel.length - trail.length) || f[4];
        ta.setRangeText(`${lead}${mark}${core}${mark}${trail}`, a, b, 'end');
        const start = a + lead.length + mark.length;
        ta.setSelectionRange(start, start + core.length);
      }
    }
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function addFormatBar(ta) {
    if (ta.dataset.fmt || ta.hasAttribute('data-no-format') || ta.classList.contains('rt-text')) return;
    ta.dataset.fmt = '1';
    if (!ta.id) ta.id = `fmt-${Math.random().toString(36).slice(2, 9)}`;
    const bar = d.createElement('div');
    bar.className = 'fmt-bar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Text formatieren');
    bar.setAttribute('aria-controls', ta.id);
    bar.innerHTML = FORMATS.map(([k, , title, label]) =>
      `<button type="button" class="fmt-btn" data-fmt="${k}" title="${title}" aria-label="${title}">${label}</button>`).join('') +
      `<button type="button" class="fmt-btn fmt-wide" data-fmt="link" title="Link einfügen: markierten Text mit einer Adresse verknüpfen">${icon('link')}Link</button>` +
      '<button type="button" class="fmt-btn fmt-wide" data-fmt="clear" title="Formatierung des markierten Texts entfernen">Formatierung entfernen</button>';
    ta.before(bar);
  }
  function addFormatBars(root) {
    if (root.matches && root.matches('textarea.adm-input')) addFormatBar(root);
    if (root.querySelectorAll) root.querySelectorAll('textarea.adm-input').forEach(addFormatBar);
  }
  d.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.fmt-btn');
    const bar = btn && btn.closest('.fmt-bar');
    const ta = bar && d.getElementById(bar.getAttribute('aria-controls'));
    if (ta) applyFormat(ta, btn.dataset.fmt);
  });
  /* Die Leiste nimmt den Fokus nicht weg: die Auswahl im Feld bleibt beim Klick erhalten */
  d.addEventListener('mousedown', (ev) => { if (ev.target.closest('.fmt-btn')) ev.preventDefault(); });
  d.addEventListener('keydown', (ev) => {
    const ta = ev.target;
    if (!(ev.ctrlKey || ev.metaKey) || ev.altKey || ev.shiftKey || !ta.matches || !ta.matches('textarea[data-fmt]')) return;
    const kind = FORMAT_KEYS[ev.key.toLowerCase()];
    if (!kind) return;
    ev.preventDefault();
    applyFormat(ta, kind);
  });

  /* ---------- Start ---------- */
  const starters = [];
  let readyResolve;
  const ready = new Promise((r) => { readyResolve = r; });
  d.addEventListener('DOMContentLoaded', async () => {
    if (!PUBLIC && !session()) return;
    d.querySelectorAll('[data-icon]').forEach((el) => el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)));
    /* Formatierungsleiste: fuer die Textfelder der Seite und fuer spaeter eingefuegte */
    addFormatBars(d);
    new MutationObserver((list) => {
      for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1) addFormatBars(n);
    }).observe(d.body, { childList: true, subtree: true });
    if (!PUBLIC) mountTop();
    await folder.restore();
    showNotices();
    if (!PUBLIC) {
      watchSession();
      verifySession();
    }
    readyResolve();
    for (const fn of starters) {
      try {
        await fn();
      } catch (e) {
        console.error(e);
        toast(`Beim Laden ist ein Fehler aufgetreten: ${e.message}`, 'err');
      }
    }
  });

  /* ---------- Bildnachweise (data/bildnachweise.json) ----------
     Ein Nachweis je Bild (Pfad ab der Website-Wurzel); die Website zeigt ihn
     klein unter dem Bild (js/main.js). Gepflegt direkt beim Bild in den
     Werkzeugen mit Bildern. */
  const CREDITS = 'data/bildnachweise.json';
  let creditMap = null;
  const sortedMap = (map) => Object.fromEntries(Object.keys(map).sort().map((k) => [k, map[k]]));
  async function loadCredits(force) {
    if (creditMap && !force) return creditMap;
    try {
      creditMap = (await readJSON(CREDITS)).bilder || {};
    } catch {
      creditMap = creditMap || {};
    }
    return creditMap;
  }
  /* Mehrere Nachweise auf einmal: {pfad: text}; leerer Text entfernt den Eintrag.
     Liefert null, wenn sich nichts geaendert hat, sonst wie saveFile. */
  async function saveCredits(changes) {
    const map = { ...(await loadCredits(true)) };
    let changed = false;
    for (const [path, text] of Object.entries(changes)) {
      if (!path) continue;
      const t = String(text || '').replace(/\s+/g, ' ').trim();
      if ((map[path] || '') === t) continue;
      if (t) map[path] = t;
      else delete map[path];
      changed = true;
    }
    if (!changed) return null;
    const next = sortedMap(map);
    const direct = await saveFile(CREDITS, JSON.stringify({ bilder: next }, null, 2) + '\n');
    creditMap = next;
    return direct;
  }
  const credits = {
    load: loadCredits,
    get: (path) => (creditMap && path && creditMap[path]) || '',
    set: (path, text) => saveCredits({ [path]: text }),
    save: saveCredits,
    PATH: CREDITS
  };

  w.Admin = {
    HD, $, esc, icon, ready,
    start: (fn) => starters.push(fn),
    guard: (fn) => guards.push(fn),
    /* Anmeldung und Zugaenge */
    session, login, logout, startSession, lockLeft, cryptoReady, isAdmin, isDev, adminRole, roleOf, ROLES, personenBereich,
    AREAS, RUNDEN_KEY, rightsOf, can, canRunde, canAllRunden, canAnyRunde,
    parseAccounts, accountsJSON, makeAccount, checkDevCode, checkPassword, normUser, stampOf,
    pwLevel, pwProblem, suggestPassword, MIN_PW, ACCOUNTS,
    /* Dateien */
    folder, readText, readJSON, markUnreadable, fetchText, saveFile, saveJSON, discardFile, hasUnsaved, imageUrl, fileName, dirName, stableFile, stableImage: stableFile, focusPos: HD.focusPos,
    credits,
    /* Oberflaeche */
    toast, confirmBox, choiceBox, passwordBox, openDialog, requestClose, setError, showErrors, clearErrors, snapshot,
    noticeHTML, noticeActive, showNotices,
    listEditor, checkBlankRows, isBlankRow, toWebp, magicOk, wireDrop, log, recentLog, readProtocol, protocolError, PROTOCOL, missingInfo, NEWS_HEAD, NEWS_HOME, parseNews, newsOnHome, newsExpired,
    /* Datum */
    isoToday, isoOf, fmtDate, fmtShort, initials
  };
})(window, document);
