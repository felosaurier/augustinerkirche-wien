/* ============================================================
   Augustinerkirche Wien — hochaemter-data.js
   Gemeinsames Datenmodul fuer alle Hochamt-Ansichten (Startseite,
   Kalender/Archiv auf musik.html, Detailseite hochamt.html und
   Verwaltung). Quelle ist data/hochaemter.csv — eine Tabelle, die
   sich direkt in Excel bearbeiten laesst (Semikolon-getrennt).

   Stellt ausserdem die Hilfen bereit, die mehrere Skripte teilen
   (HTML-Escaping, sichere URLs, CSV-Zellen, Download, Kurzlink-Slug).
   Muss daher vor news.js, solisten.js und den Verwaltungsseiten
   geladen werden.
   ============================================================ */
(function (w) {
  'use strict';

  const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

  /* Spaltenueberschriften (frei benennbar) -> interne Feldnamen */
  const ALIASES = {
    datum: 'date', uhrzeit: 'time', zeit: 'time', beginn: 'time',
    anlass: 'type', typ: 'type', werk: 'piece', musik: 'piece',
    ort: 'location', zelebrant: 'celebrant', dirigent: 'conductor',
    chor: 'choir', orchester: 'orchestra', solisten: 'soloists',
    organist: 'organist', organisten: 'organist',
    weiteremusik: 'extra', weiterestücke: 'extra', weiterelieder: 'extra', extralieder: 'extra', lieder: 'extra',
    hinweis: 'note', hinweise: 'note', bemerkung: 'note'
  };
  /* Reihenfolge und Beschriftung der Spalten beim Export */
  const FIELDS = [
    ['date', 'Datum'], ['time', 'Uhrzeit'], ['type', 'Anlass'], ['piece', 'Werk'], ['location', 'Ort'],
    ['celebrant', 'Zelebrant'], ['conductor', 'Dirigent'], ['choir', 'Chor'], ['orchestra', 'Orchester'],
    ['soloists', 'Solisten'], ['organist', 'Organist'], ['extra', 'Weitere Musik'], ['note', 'Hinweis']
  ];

  /* Nur diese Protokolle duerfen in href/src landen (kein javascript:, data: …) */
  const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

  /* ---------- Allgemeine Hilfen ---------- */
  const pad = (n) => String(n).padStart(2, '0');

  const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  /* Text fuer den Einbau in HTML (Inhalt und Attribute) unschaedlich machen */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC_MAP[c]);

  /* Prueft eine Adresse aus den Tabellen, bevor sie in href/src landet.
     Relative Pfade erhalten das Praefix `base`; absolute Adressen muessen ein
     erlaubtes Protokoll haben. Die Pruefung laeuft ueber den URL-Parser des
     Browsers, damit Tricks wie "java\tscript:" ebenfalls erkannt werden.
     Liefert '' fuer alles Unsichere. */
  function safeUrl(url, base = '') {
    const raw = String(url ?? '').trim();
    if (!raw) return '';
    const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(raw.replace(/[\u0000- \u007f]/g, ''));
    const candidate = hasScheme || raw.startsWith('//') ? raw : base + raw;
    try {
      return SAFE_PROTOCOLS.includes(new URL(candidate, location.href).protocol) ? candidate : '';
    } catch {
      return '';
    }
  }

  /* Titel -> URL-taugliche Kennung (Umlaute ausgeschrieben) */
  function slug(s, maxLength = 40) {
    return String(s).toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, maxLength);
  }

  /* Eine CSV-Zelle: nur bei Trennzeichen, Anfuehrungszeichen oder Zeilenumbruch quoten */
  function csvCell(v) {
    const s = String(v ?? '');
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  /* Zeilen -> Excel-taugliche CSV (Semikolon, CRLF, UTF-8-BOM fuer die Umlaute) */
  const csvText = (rows) => '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n';

  /* Blob als Datei anbieten; die Objekt-URL wird danach wieder freigegeben */
  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ---------- CSV lesen ----------
     Kleiner Zustandsautomat statt split(): Zellen duerfen in Anfuehrungs-
     zeichen stehen und dann Trennzeichen, Zeilenumbrueche und verdoppelte
     Anfuehrungszeichen ("") enthalten. Das Trennzeichen (; , Tab) wird an
     der Kopfzeile erkannt, weil Excel je nach Sprache anders speichert. */
  function parseCSV(text) {
    text = String(text).replace(/^﻿/, '');
    const firstLine = text.split(/\r?\n/, 1)[0];
    let delim = ';';
    let best = -1;
    for (const d of [';', ',', '\t']) {
      const count = firstLine.split(d).length;
      if (count > best) { best = count; delim = d; }
    }

    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
        } else cell += ch;
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === delim) {
        row.push(cell); cell = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        rows.push(row); row = [];
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  /* Kopfzeile -> Schluessel ueber eine Alias-Tabelle; Gross-/Kleinschreibung,
     Leer- und Sonderzeichen in den Ueberschriften spielen keine Rolle. */
  const headerKey = (h, aliases) => aliases[String(h).toLowerCase().replace(/[^a-zäöüß]/g, '')] || null;

  /* Datum 'TT.MM.JJJJ' oder 'JJJJ-MM-TT' -> 'JJJJ-MM-TT' ('' wenn ungueltig) */
  function isoDate(s) {
    s = String(s || '').trim();
    let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
    if (m) {
      let y = Number(m[3]);
      if (y < 100) y += 2000;
      return `${y}-${pad(m[2])}-${pad(m[1])}`;
    }
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    return m ? `${m[1]}-${pad(m[2])}-${pad(m[3])}` : '';
  }
  /* Uhrzeit '11:00', '11.00' oder '11h00' -> 'HH:MM' ('' wenn ungueltig) */
  function isoTime(s) {
    const m = String(s || '').match(/(\d{1,2})\s*[:.hH]\s*(\d{2})/);
    return m ? `${pad(m[1])}:${m[2]}` : '';
  }
  /* 'JJJJ-MM-TT' -> lokales Datum um Mitternacht */
  function dateFromIso(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  /* Zeilen -> Roh-Objekte (Textfelder, interne Feldnamen); leere Zeilen fallen weg */
  function rowsToRaw(rows, aliases = ALIASES) {
    if (!rows.length) return [];
    const keys = rows[0].map((h) => headerKey(h, aliases));
    const out = [];
    for (const r of rows.slice(1)) {
      const o = {};
      keys.forEach((k, i) => { if (k) o[k] = (r[i] || '').trim(); });
      if (Object.values(o).some(Boolean)) out.push(o);
    }
    return out;
  }

  /* Mehrere Eintraege in einer Zelle: mit | oder Zeilenumbruch getrennt */
  const list = (s) => String(s || '').split(/\s*(?:\||\r?\n)\s*/).map((x) => x.trim()).filter(Boolean);

  function normalize(o) {
    const date = isoDate(o.date);
    if (!date) return null;
    const time = isoTime(o.time) || '11:00';
    return {
      id: `${date}-${time.replace(':', '')}`,
      date, time,
      dateObj: dateFromIso(date),
      type: o.type || 'Hochamt',
      piece: o.piece || '',
      location: o.location || 'Augustinerkirche',
      celebrant: o.celebrant || '',
      conductor: o.conductor || '',
      choir: o.choir || '',
      orchestra: o.orchestra || '',
      soloists: list(o.soloists),
      organist: list(o.organist),
      extra: list(o.extra),
      note: o.note || ''
    };
  }

  /* Sortierung nach Datum und Uhrzeit (ISO-Strings sind direkt vergleichbar) */
  const byDateTime = (a, b) => (a.date + a.time).localeCompare(b.date + b.time);
  const byDateTimeDesc = (a, b) => byDateTime(b, a);

  async function fetchText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }

  /* Laedt die Tabelle; liefert normalisierte, chronologisch sortierte Eintraege */
  async function load(url) {
    const text = await fetchText(url);
    return rowsToRaw(parseCSV(text)).map(normalize).filter(Boolean).sort(byDateTime);
  }
  async function loadRaw(url) {
    return rowsToRaw(parseCSV(await fetchText(url)));
  }

  /* Archiv: je Jahr eine Datei (data/archiv/hochaemter-JJJJ.csv), Jahresliste in jahre.json.
     Ein Jahr wird erst geladen, wenn es gebraucht wird; das Promise wird
     zwischengespeichert, damit mehrfaches Anklicken nur einmal laedt. */
  const yearCache = new Map();
  function loadYear(dir, year) {
    const key = dir + year;
    if (!yearCache.has(key)) yearCache.set(key, load(`${dir}hochaemter-${year}.csv`));
    return yearCache.get(key);
  }
  async function archiveYears(dir) {
    try {
      const res = await fetch(`${dir}jahre.json`);
      return res.ok ? await res.json() : [];
    } catch {
      return [];
    }
  }

  function today() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  /* Kommend = heute oder spaeter */
  const isUpcoming = (e) => e.dateObj >= today();

  /* Teilt eine Liste in kommende und vergangene Termine ("heute" nur einmal berechnet) */
  function splitByDate(entries) {
    const ref = today();
    const upcoming = [];
    const past = [];
    for (const e of entries) (e.dateObj >= ref ? upcoming : past).push(e);
    return { upcoming, past };
  }

  /* Roh-Eintraege -> CSV im Format von data/hochaemter.csv (Datum als TT.MM.JJJJ) */
  function toCSV(raws) {
    const rows = [FIELDS.map((f) => f[1])];
    for (const o of raws) {
      rows.push(FIELDS.map(([key]) => {
        const v = o[key] || '';
        if (key !== 'date') return v;
        const iso = isoDate(v);
        return iso ? iso.split('-').reverse().join('.') : v;
      }));
    }
    return csvText(rows);
  }

  w.HochamtData = {
    MONTHS, MONTHS_SHORT, WEEKDAYS, WEEKDAYS_SHORT, FIELDS,
    esc, pad, safeUrl, slug, csvText, download,
    parseCSV, rowsToRaw, isoDate, isoTime, dateFromIso, list,
    normalize, byDateTime, byDateTimeDesc,
    load, loadRaw, loadYear, archiveYears, isUpcoming, splitByDate, today, toCSV
  };
})(window);
