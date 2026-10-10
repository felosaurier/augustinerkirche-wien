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
  const MIN_PW = 8;

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
  const roleOf = (acc) => {
    if (!acc) return 'redaktion';
    const raw = acc.rolle;
    if (raw === undefined || raw === null || raw === '') return 'admin';
    return typeof raw === 'string' && raw.trim().toLowerCase() === 'admin' ? 'admin' : 'redaktion';
  };
  const isAdmin = () => roleOf(session()) === 'admin';

  /* Rechte der Redaktion: Bereiche (je eine Seite der Verwaltung) und einzelne
     Runden. Admins duerfen alles. Redaktionszugaenge ohne Angabe "rechte" (aus
     der Zeit davor) duerfen ebenfalls alles, damit niemand ausgesperrt wird.
     Gespeichert als rechte: { bereiche: [Schluessel], runden: [Runden-IDs] };
     der Schluessel "runden" bedeutet alle Runden samt Anlegen, Loeschen und
     Reihenfolge, sonst nur die einzeln genannten Runden bearbeiten. */
  const AREAS = [
    { key: 'startseite', label: 'Startseite (Titelfotos)', group: 'Allgemein', page: 'startseite.html' },
    { key: 'neuigkeiten', label: 'Neuigkeiten', group: 'Allgemein', page: 'neuigkeiten.html' },
    { key: 'termine', label: 'Termine (Ausflüge, Feste …)', group: 'Allgemein', page: 'termine.html' },
    { key: 'hochaemter', label: 'Hochämter', group: 'Kirchenmusik', page: 'hochaemter.html' },
    { key: 'solisten', label: 'Solisten', group: 'Kirchenmusik', page: 'solisten.html' },
    { key: 'paten', label: 'Paten', group: 'Kirchenmusik', page: 'paten.html' },
    { key: 'cds', label: 'CDs', group: 'Kirchenmusik', page: 'cds.html' },
    { key: 'musik-personen', label: 'Leitung & Organisten', group: 'Kirchenmusik', page: 'personen.html' },
    { key: 'repertoire', label: 'Repertoire', group: 'Kirchenmusik', page: 'repertoire.html' },
    { key: 'gottesdienste', label: 'Gottesdienste', group: 'Pfarre & Kloster', page: 'gottesdienste.html' },
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
    if (roleOf(acc) === 'admin' || !acc.rechte) return null;
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
    if (page === 'personen.html') return personenBereich() === 'kloster' ? 'mitbrueder' : 'musik-personen';
    const a = AREAS.find((x) => x.page === page);
    return a ? a.key : '';
  }
  const allowed = (key) => !key || (key === RUNDEN_KEY ? canAnyRunde() : can(key));

  /* Ohne gueltige Sitzung sofort zur Anmeldung, bevor die Seite sichtbar wird;
     Seiten nur fuer Admins (<html data-adm-rolle="admin">) und Seiten ohne
     Berechtigung leiten sonst zur Uebersicht */
  if (!PUBLIC && !session()) {
    ROOT.style.visibility = 'hidden';
    location.replace(`index.html?weiter=${encodeURIComponent(pageName() + location.search)}`);
  } else if (!PUBLIC && ROOT.dataset.admRolle === 'admin' && !isAdmin()) {
    ROOT.style.visibility = 'hidden';
    location.replace('uebersicht.html?hinweis=nur-admin');
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
    home: '<path d="M4 11l8-7 8 7M6 9.5V20h12V9.5M10 20v-6h4v6"/>',
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
  /* rechte nur fuer die Redaktion; Admins brauchen keine */
  async function makeAccount({ benutzer, name, passwort, rolle, rechte }) {
    const salt = toB64(crypto.getRandomValues(new Uint8Array(16)));
    const acc = {
      benutzer: normUser(benutzer),
      name: String(name || '').trim() || normUser(benutzer),
      salt, iter: ITER,
      hash: await derive(passwort, salt, ITER),
      rolle: rolle === 'redaktion' ? 'redaktion' : 'admin',
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
    const sources = [() => fetchText(ACCOUNTS)];
    if (folder.state === 'ok') sources.push(() => folder.read(ACCOUNTS));
    let readable = false;
    for (const src of sources) {
      try {
        const list = parseAccounts(await src());
        readable = true;
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
  async function serverMode() {
    if (serverFlag === undefined) {
      try {
        const res = await fetch(w.location.href, { method: 'HEAD', cache: 'no-store' });
        serverFlag = res.headers.get('X-Aug-Schreiben') === 'ja';
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
            `<div class="adm-folder-txt"><strong>Mit dem Server verbunden</strong><span class="adm-folder-sub">Änderungen werden direkt auf dem Server (${esc(folder.handle.name)}) gespeichert und sind sofort auf der Website zu sehen.</span></div>`;
        }
        return `<span class="adm-folder-ico">${icon('checkCircle')}</span>` +
          `<div class="adm-folder-txt"><strong>Projektordner verbunden</strong><span class="adm-folder-sub">Änderungen werden direkt im Ordner „${esc(folder.handle.name)}“ gespeichert.</span></div>` +
          '<button type="button" class="btn btn-quiet btn-sm" data-folder="disconnect">Trennen</button>';
      case 'prompt':
        return `<span class="adm-folder-ico">${icon('folder')}</span>` +
          `<div class="adm-folder-txt"><strong>Zugriff auf den Projektordner erlauben</strong>Der Ordner „${esc(folder.handle.name)}“ ist bekannt. Der Browser fragt nach jedem Neustart einmal nach, ob die Verwaltung dort speichern darf.</div>` +
          `<button type="button" class="btn btn-dark" data-folder="allow">${icon('check')}Zugriff erlauben</button>`;
      case 'unsupported':
        return `<span class="adm-folder-ico">${icon('download')}</span>` +
          '<div class="adm-folder-txt"><strong>Speichern per Download</strong>Dieser Browser kann nicht direkt in einen Ordner speichern. Du bekommst geänderte Dateien zum Herunterladen, mit Angabe, wohin sie gehören. Am bequemsten geht es mit Chrome oder Edge am Computer.</div>';
      default:
        return `<span class="adm-folder-ico">${icon('folder')}</span>` +
          '<div class="adm-folder-txt"><strong>Projektordner noch nicht verbunden</strong><span class="adm-folder-sub">Einmal verbinden, dann speichert die Verwaltung alles direkt an der richtigen Stelle. Ohne Verbindung bekommst du die Dateien zum Herunterladen.</span></div>' +
          `<button type="button" class="btn btn-dark" data-folder="connect">${icon('folder')}Projektordner verbinden</button>`;
    }
  }
  function renderFolderStrips() {
    d.querySelectorAll('[data-adm-folder]').forEach((el) => {
      el.className = `adm-folder is-${folder.state}`;
      el.innerHTML = folderStripHTML();
    });
  }

  /* ---------- Lesen und Speichern ---------- */
  /* Text einer Projektdatei: aus dem verbundenen Ordner, sonst vom Webserver */
  /* Pfad -> 'ok' | 'fehlt' | 'fehler': Konnte eine Datei nicht gelesen werden (oder war sie
     kaputt), darf sie in dieser Sitzung nicht geschrieben werden, sonst waere der Rest weg. */
  const readState = new Map();
  const notFoundErr = (e) => !!e && (e.name === 'NotFoundError' || e.status === 404);
  async function readText(path) {
    try {
      const text = folder.state === 'ok' ? await folder.read(path) : await fetchText(path);
      readState.set(path, 'ok');
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
  const GUARDED = /^(data\/.+\.(json|csv)|admin\/zugaenge\.json)$/;
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
    if (folder.state === 'ok') {
      await folder.write(path, blob);
      return true;
    }
    pending.set(path, { path, blob, done: false });
    renderPending();
    return false;
  }
  const saveJSON = (path, data) => saveFile(path, JSON.stringify(data, null, 2) + '\n');
  /* Eine eben erst geschriebene Datei wieder verwerfen (z. B. Foto, das doch nicht
     uebernommen wird): aus dem Ordner loeschen bzw. aus der Download-Leiste nehmen */
  async function discardFile(path) {
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

  /* ---------- Aenderungsprotokoll (nur auf diesem Geraet) ---------- */
  function log(text) {
    const s = session();
    const list = get(KEY_LOG) || [];
    list.unshift({ zeit: Date.now(), wer: s ? s.name : '', text });
    put(KEY_LOG, list.slice(0, 30));
  }
  const recentLog = () => get(KEY_LOG) || [];

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
    }
    dlg.showModal();
    ROOT.classList.add('adm-lock');
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
    if (isWebp || ['jpg', 'jpeg', 'png'].includes(ext)) return { blob: file, ext: isWebp ? 'webp' : ext === 'jpeg' ? 'jpg' : ext };
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
  const NEWS_HOME = 3;
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

  /* ---------- Kopfleiste ---------- */
  /* Hauptreiter; Bereiche mit mehreren Seiten zeigen darunter eine zweite
     Zeile. Zugaenge stehen (nur fuer Admins) rechts oben beim Namen. */
  const NAV = [
    { label: 'Übersicht', icon: 'home', href: 'uebersicht.html' },
    { label: 'Startseite', icon: 'image', href: 'startseite.html' },
    { label: 'Neuigkeiten', icon: 'news', href: 'neuigkeiten.html' },
    { label: 'Termine', icon: 'calendar', href: 'termine.html' },
    { label: 'Kirchenmusik', icon: 'music', href: 'hochaemter.html', sub: [
      ['hochaemter.html', 'Hochämter'],
      ['solisten.html', 'Solisten'],
      ['paten.html', 'Paten'],
      ['cds.html', 'CDs'],
      ['personen.html?bereich=musik', 'Leitung & Organisten'],
      ['repertoire.html', 'Repertoire']
    ] },
    { label: 'Pfarre & Kloster', icon: 'users', href: 'gottesdienste.html', sub: [
      ['gottesdienste.html', 'Gottesdienste'],
      ['kontakt.html', 'Pfarrkanzlei & Kontakt'],
      ['runden.html', 'Runden'],
      ['rundgang.html', 'Kirchenrundgang'],
      ['pgr.html', 'Pfarrgemeinderat'],
      ['personen.html?bereich=kloster', 'Mitbrüder']
    ] }
  ];
  /* Nur das zeigen, was die angemeldete Person bearbeiten darf; ein Reiter
     mit mehreren Seiten fuehrt zur ersten erlaubten */
  function allowedNav() {
    const ok = (href) => {
      const [page, query] = href.split('?');
      if (page === 'personen.html') return can(new URLSearchParams(query).get('bereich') === 'kloster' ? 'mitbrueder' : 'musik-personen');
      return allowed(rightOfPage(page));
    };
    return NAV.map((n) => {
      if (!n.sub) return ok(n.href) ? n : null;
      const sub = n.sub.filter(([href]) => ok(href));
      return sub.length ? { ...n, href: sub[0][0], sub } : null;
    }).filter(Boolean);
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
  function mountTop() {
    const el = $('adm-top');
    if (!el) return;
    const s = session();
    const here = pageName();
    const nav = allowedNav();
    const group = nav.find((n) => n.sub && n.sub.some(([href]) => isHere(href)));
    el.innerHTML = '<div class="adm-bar">' +
      '<a class="nav-logo-wrap" href="uebersicht.html">' +
        '<img class="nav-logo-img" src="../assets/logo.png" alt="" width="38" height="38" decoding="async"/>' +
        '<div><div class="nav-logo-text">Augustiner<span>kirche</span> Wien</div><span class="nav-logo-sub">Verwaltung</span></div>' +
      '</a>' +
      '<div class="adm-user">' +
        `<a class="adm-me" href="profil.html" title="Mein Profil: Passwort ändern"${here === 'profil.html' ? ' aria-current="page"' : ''}>` +
          `<span class="adm-avatar" aria-hidden="true">${esc(initials(s.name))}</span>` +
          `<span class="adm-user-name">${esc(s.name)}</span><span class="visually-hidden"> (Mein Profil)</span></a>` +
        (isAdmin() ? `<a class="adm-iconbtn" href="zugaenge.html" aria-label="Zugänge"${here === 'zugaenge.html' ? ' aria-current="page"' : ''}>${icon('key')}<span class="lbl">Zugänge</span></a>` : '') +
        `<a class="adm-iconbtn" href="../index.html" target="_blank" rel="noopener" aria-label="Website ansehen (neues Fenster)">${icon('external')}<span class="lbl">Website</span></a>` +
        `<button type="button" class="adm-iconbtn" id="adm-logout" aria-label="Abmelden">${icon('logout')}<span class="lbl">Abmelden</span></button>` +
      '</div></div>' +
      '<nav class="adm-nav" aria-label="Verwaltung"><div class="adm-nav-in">' +
        nav.map((n) => {
          const on = n.sub ? n.sub.some(([href]) => isHere(href)) : isHere(n.href);
          return `<a href="${n.href}"${on ? (n.sub ? ' class="is-open" aria-current="true"' : ' aria-current="page"') : ''}>${icon(n.icon)}${esc(n.label)}</a>`;
        }).join('') +
      '</div></nav>' +
      (group ? `<nav class="adm-subnav" aria-label="${esc(group.label)}"><div class="adm-subnav-in">` +
        group.sub.map(([href, label]) => `<a href="${href}"${isHere(href) ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('') +
        '</div></nav>' : '');
    $('adm-logout').addEventListener('click', () => logout('abgemeldet'));
    /* Der Seitenkopf mit der Ueberschrift steht ausserhalb von <main>: als benannter Bereich kennzeichnen */
    const head = d.querySelector('.adm-head');
    const h1 = head && head.querySelector('h1');
    if (head && h1) {
      head.setAttribute('role', 'region');
      head.setAttribute('aria-label', h1.textContent.trim());
    }
    /* Aktiven Reiter auf schmalen Bildschirmen sichtbar machen */
    el.querySelectorAll('.adm-nav [aria-current], .adm-subnav [aria-current]')
      .forEach((cur) => cur.scrollIntoView({ block: 'nearest', inline: 'center' }));
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

  /* ---------- Start ---------- */
  const starters = [];
  let readyResolve;
  const ready = new Promise((r) => { readyResolve = r; });
  d.addEventListener('DOMContentLoaded', async () => {
    if (!PUBLIC && !session()) return;
    d.querySelectorAll('[data-icon]').forEach((el) => el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)));
    if (!PUBLIC) mountTop();
    await folder.restore();
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
    session, login, logout, startSession, lockLeft, cryptoReady, isAdmin, roleOf, personenBereich,
    AREAS, RUNDEN_KEY, rightsOf, can, canRunde, canAllRunden, canAnyRunde,
    parseAccounts, accountsJSON, makeAccount, checkPassword, normUser, stampOf,
    pwLevel, pwProblem, suggestPassword, MIN_PW, ACCOUNTS,
    /* Dateien */
    folder, readText, readJSON, markUnreadable, fetchText, saveFile, saveJSON, discardFile, hasUnsaved, imageUrl, fileName, dirName, stableFile, stableImage: stableFile, focusPos: HD.focusPos,
    credits,
    /* Oberflaeche */
    toast, confirmBox, choiceBox, openDialog, requestClose, setError, showErrors, clearErrors, snapshot,
    listEditor, checkBlankRows, isBlankRow, toWebp, wireDrop, log, recentLog, missingInfo, NEWS_HEAD, NEWS_HOME, parseNews, newsOnHome, newsExpired,
    /* Datum */
    isoToday, isoOf, fmtDate, fmtShort
  };
})(window, document);
