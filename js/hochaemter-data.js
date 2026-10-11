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

  /* Masse (Breite/Hoehe) aus den Datendateien: nur eine vernuenftige ganze Zahl wird
     in width/height eingesetzt, sonst der Ersatzwert. So kann aus einem Zahlenfeld
     kein Attribut oder Skript ausbrechen. */
  function num(value, fallback) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) && n > 0 && n <= 20000 ? n : fallback;
  }
  /* Bildausschnitt "x% y%" (z. B. "50% 20%"); alles andere ergibt '' */
  const focusPos = (v) => (/^\d{1,3}% \d{1,3}%$/.test(String(v ?? '').trim()) ? String(v).trim() : '');

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

  /* E-Mail-Adressen stehen nie im Klartext im Quelltext der Seite: In
     data-mail liegt die Adresse rueckwaerts und mit "|" statt "@", als Text
     steht "name(at)domain(dot)at". main.js macht daraus beim Anzeigen wieder
     einen normalen mailto-Link. Das haelt einfache Adress-Sammler ab. */
  const mailCode = (addr) => [...String(addr)].reverse().join('').replace('@', '|');
  const mailText = (addr) => String(addr).replace('@', '(at)').replace(/\./g, '(dot)');
  const mailHTML = (addr, subject = '') =>
    `<a class="mail" data-mail="${esc(mailCode(addr))}"${subject ? ` data-subject="${esc(subject)}"` : ''}>${esc(mailText(addr))}</a>`;

  /* Freitext aus den Datendateien -> sicheres HTML. [Text](Adresse) wird ein
     Link (Adressen der Website relativ zur Wurzel, Praefix `base`), *Wort*
     kursiv; E-Mail- und https-Adressen werden automatisch verlinkt. */
  const RICH = /\[([^\]\n]+)\]\(([^)\s]+)\)|\*([^*\n]+)\*|([\w.+-]+@[\w-]+(?:\.[\w-]+)+)|(https?:\/\/[^\s<]*[^\s<.,;:!?)])/g;
  /* Die Muster oben sind bei sehr langen Woerter-Ketten ohne Leerzeichen langsam (quadratisch):
     ein eingefuegter Riesen-Absatz koennte die Seite sekundenlang blockieren. Absaetze sind kurz,
     darum wird nur der Anfang formatiert, der Rest als schlichter Text angehaengt. */
  const RICH_MAX = 4000;
  function richText(s, base = '') {
    const text = String(s ?? '');
    if (text.length > RICH_MAX) return richText(text.slice(0, RICH_MAX), base) + esc(text.slice(RICH_MAX));
    let html = '';
    let last = 0;
    for (const m of text.matchAll(RICH)) {
      html += esc(text.slice(last, m.index));
      if (m[1]) {
        const u = safeUrl(m[2], base);
        html += u ? `<a href="${esc(u)}"${/^https?:/i.test(u) ? ' target="_blank" rel="noopener"' : ''}>${esc(m[1])}</a>` : esc(m[1]);
      } else if (m[3]) {
        html += `<em>${esc(m[3])}</em>`;
      } else if (m[4]) {
        html += mailHTML(m[4]);
      } else {
        html += `<a href="${esc(m[5])}" target="_blank" rel="noopener">${esc(m[5])}</a>`;
      }
      last = m.index + m[0].length;
    }
    return html + esc(text.slice(last));
  }
  /* Telefonnummer -> tel:-Adresse ("+43 (0)1 533 70 99" -> "tel:+43153370099") */
  const telHref = (s) => `tel:${String(s).replace(/\(0\)/g, '').replace(/[^\d+]/g, '')}`;

  /* Laengere Texte mit Absaetzen (Impressum, Datenschutz): wie richText, dazu
       Leerzeile             neuer Absatz; ein einfacher Zeilenumbruch bleibt einer
       ### Ueberschrift      Zwischenueberschrift
       - Punkt               Aufzaehlung (jede Zeile ein Punkt)
       | A | B |             Tabelle, die erste Zeile ist die Kopfzeile
       **fett**              fett
       [Nummer](tel)         Telefonnummer als Link
       [[offen: …]]          gelb markiert: muss noch ergaenzt werden
       [[cookie-einstellungen]]  Knopf, der die Cookie-Einstellungen oeffnet
       [[kanzlei]]           Oeffnungszeiten der Pfarrkanzlei (aus data/kontakt.json) */
  const INLINE = /\*\*([^*\n]+)\*\*|\[\[offen:\s*([^\]\n]*)\]\]|\[([^\]\n]+)\]\(tel\)/g;
  function inlineHTML(s, base) {
    let html = '';
    let last = 0;
    for (const m of String(s).matchAll(INLINE)) {
      html += richText(s.slice(last, m.index), base);
      if (m[1] !== undefined) html += `<strong>${richText(m[1], base)}</strong>`;
      else if (m[2] !== undefined) html += `<span class="todo">[${esc(m[2])}]</span>`;
      else html += `<a href="${esc(telHref(m[3]))}">${esc(m[3])}</a>`;
      last = m.index + m[0].length;
    }
    return html + richText(String(s).slice(last), base);
  }
  const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  function blocksHTML(text, base = '') {
    const blocks = String(text ?? '').replace(/\r\n?/g, '\n').split(/\n[ \t]*\n+/);
    return blocks.map((block) => {
      const lines = block.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim());
      if (!lines.length) return '';
      const one = lines.length === 1 ? lines[0].trim() : '';
      if (one === '[[cookie-einstellungen]]') return '<p><button type="button" class="btn btn-outline cc-open" hidden>Cookie-Einstellungen öffnen</button></p>';
      if (one === '[[kanzlei]]') return '<p data-inhalt="kanzlei">Pfarrkanzlei: Öffnungszeiten siehe Kontakt</p>';
      if (lines.every((l) => /^\s*\|/.test(l))) {
        const rows = lines.filter((l) => !/^\s*\|[\s:|-]*$/.test(l)).map(cells);
        const width = Math.max(...rows.map((r) => r.length));
        /* data-label: auf dem Handy steht jede Zeile als Karte, die Spaltenueberschrift vor dem Wert */
        const label = (i) => esc(String(rows[0][i] || '').replace(/\*\*/g, ''));
        /* Telefonnummern und IBAN nicht mitten in der Nummer umbrechen */
        const plain = (c) => String(c || '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\*\*/g, '').trim();
        const number = (c) => /^[+\d(][\d\s()/.+-]{5,}$/.test(plain(c)) || /^[A-Z]{2}\d{2}(\s?[\dA-Z]{4})+/.test(plain(c));
        const row = (r, tag) => `<tr>${Array.from({ length: width }, (_, i) =>
          `<${tag}${tag === 'th' ? ' scope="col"' : ` data-label="${label(i)}"`}${tag === 'td' && number(r[i]) ? ' class="nw"' : ''}>${inlineHTML(r[i] || '', base)}</${tag}>`).join('')}</tr>`;
        return '<div class="legal-table-wrap"><table class="legal-table">' +
          `<thead>${row(rows[0], 'th')}</thead><tbody>${rows.slice(1).map((r) => row(r, 'td')).join('')}</tbody></table></div>`;
      }
      if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${inlineHTML(l.replace(/^\s*[-•]\s+/, ''), base)}</li>`).join('')}</ul>`;
      }
      let html = '';
      let para = [];
      const flush = () => {
        if (para.length) html += `<p>${para.map((l) => inlineHTML(l, base)).join('<br>')}</p>`;
        para = [];
      };
      for (const l of lines) {
        const h = l.match(/^\s*#{2,4}\s+(.+)$/);
        if (h) {
          flush();
          html += `<h3>${inlineHTML(h[1], base)}</h3>`;
        } else {
          para.push(l.trim());
        }
      }
      flush();
      return html;
    }).join('');
  }
  /* Impressum oder Datenschutz (data/rechtliches.json, ein Eintrag) -> Inhaltsverzeichnis und Abschnitte.
     Sprungmarke: "anker" oder aus der Ueberschrift (Links wie datenschutz.html#cookies bleiben gueltig). */
  function legalHTML(page, base = '') {
    const used = new Set();
    const secs = (page && Array.isArray(page.abschnitte) ? page.abschnitte : []).filter((s) => s && String(s.titel || '').trim());
    const items = secs.map((s, i) => {
      let id = slug(s.anker || s.titel, 40) || `abschnitt-${i + 1}`;
      while (used.has(id)) id += '-2';
      used.add(id);
      return { id, titel: String(s.titel).trim(), text: s.text || '' };
    });
    return {
      toc: items.map((s) => `<li><a href="#${s.id}">${esc(s.titel)}</a></li>`).join(''),
      body: items.map((s, i) =>
        `<section class="legal-sec" id="${s.id}" aria-labelledby="${s.id}-h">` +
        `<h2 id="${s.id}-h"><span class="legal-num" aria-hidden="true">${pad(i + 1)}</span>${esc(s.titel)}</h2>` +
        `<div class="legal-body">${blocksHTML(s.text, base)}</div></section>`).join('')
    };
  }

  /* Titel -> URL-taugliche Kennung (Umlaute ausgeschrieben) */
  function slug(s, maxLength = 40) {
    return String(s).toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, maxLength);
  }

  /* Eine CSV-Zelle: nur bei Trennzeichen, Anfuehrungszeichen oder Zeilenumbruch quoten.
     Beginnt der Text mit = + - @ (Excel wuerde ihn als Formel ausfuehren, "CSV-Injection"),
     steht davor ein Leerzeichen; beim Einlesen werden Zellen ohnehin getrimmt. Reine
     Zahlen wie -5 oder +43 bleiben unveraendert. */
  function csvCell(v) {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?\d[\d.,]*$/.test(s)) s = ` ${s}`;
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

  /* Meldungen ohne eigenes Enddatum stehen zwei Wochen ab ihrem Datum
     auf der Startseite (gleiche Regel fuer Website und Verwaltung) */
  const NEWS_DAYS = 14;
  function newsUntil(iso, bis) {
    const own = isoDate(bis);
    if (own || !isoDate(iso)) return own;
    const dt = dateFromIso(isoDate(iso));
    dt.setDate(dt.getDate() + NEWS_DAYS);
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
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
    esc, pad, num, focusPos, safeUrl, richText, blocksHTML, legalHTML, mailHTML, telHref, slug, csvText, download,
    parseCSV, rowsToRaw, isoDate, isoTime, dateFromIso, newsUntil, NEWS_DAYS, list,
    normalize, byDateTime, byDateTimeDesc,
    load, loadRaw, loadYear, archiveYears, isUpcoming, splitByDate, today, toCSV
  };
})(window);
