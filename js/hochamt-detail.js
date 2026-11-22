/* ============================================================
   Augustinerkirche Wien — hochamt-detail.js
   Detailseite eines Hochamts (pages/hochamt.html?id=JJJJ-MM-TT-HHMM).
   Aus data/hochaemter.csv bzw. dem Jahresarchiv, in dieser Reihenfolge:
   Datum, liturgischer Tag und Uhrzeit (beides aus dem Hinweis: "Hochfest …",
   "Ende ca. …"), Werk, Anlass mit
   Zelebrant, Musik im Gottesdienst (Weitere Musik), Ausfuehrende (Chor und
   Orchester, Solisten, Organist, Dirigent), Ort, Hinweis, Bitte um Spende.
   Ist eine Meldung (data/news.csv) mit diesem Termin verknuepft
   (Link pages/hochamt.html?id=…), erscheint ihr Plakat daneben.
   Fotos des Termins (data/hochamt-fotos/, gepflegt in der Verwaltung):
   bis 4 Fotos in der Spalte neben dem Programm (unter dem Plakat), ab 5 als
   Fotogitter unter dem Programm (nur Vorschaubilder, die Grossfassung erst in
   der Vergroesserung). Alle Fotos lassen sich vergroessern und durchblaettern.
   ============================================================ */
(function () {
  'use strict';

  const HD = window.HochamtData;
  const qs = (sel) => document.querySelector(sel);
  /* Uebersetzung auf pages/hochamt.en.html und .it.html (js/sprache.js); Links fuehren dort zu den
     uebersetzten Seiten, sofern es sie gibt */
  const T = window.AugT || ((s, v) => (v ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s));
  const LANG = T.lang || 'de';
  const seite = (pfad) => (T.seite ? T.seite(pfad) : pfad);
  const FALLBACK = `<p class="s-text">${T('Die Termine konnten nicht geladen werden. Bitte laden Sie die Seite später noch einmal.')}</p>`;

  /* Adresse ohne Fehler dekodieren (kaputte %-Folgen bleiben unveraendert) */
  const safeDecode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
  const shortDate = (d) => (LANG === 'de' ? `${d.getDate()}. ${HD.MONTHS[d.getMonth()]} ${d.getFullYear()}` : `${d.getDate()} ${HD.MONTHS[d.getMonth()]} ${d.getFullYear()}`);
  const gross = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  /* Der Hinweis wird aufgeteilt: "Ende ca. 12:45 Uhr." wird zur Uhrzeit oben, der liturgische
     Tag ("Hochfest Allerheiligen.", "2. Sonntag nach Weihnachten.") steht oben beim Datum,
     alles andere (Karten, Eintritt …) bleibt Hinweis unter dem Programm */
  const END = /Ende\s+(ca\.\s*)?(\d{1,2})[:.](\d{2})\s*(Uhr)?\.?/i;
  const DAY = /^(Hochfest|Fest|Gedenktag|Christmette|Allerseelen|Allerheiligen|Gründonnerstag|Karfreitag|Osternacht|Pfingst|Palmsonntag|\d+\.\s+\S*sonntag|[A-ZÄÖÜ][a-zäöü]*sonntag)/;
  function splitNote(note) {
    const m = END.exec(note);
    const end = m ? `${m[1] ? 'ca. ' : ''}${m[2].padStart(2, '0')}:${m[3]}` : '';
    const rest = (m ? note.replace(m[0], '') : note).trim();
    const days = [];
    const lines = [];
    /* Zeilenumbrueche (Enter) aus der Verwaltung bleiben im Hinweis erhalten */
    for (const line of rest.split('\n')) {
      const other = [];
      for (const s of line.split(/(?<=\.)[^\S\n]+/).map((x) => x.trim()).filter(Boolean)) {
        if (DAY.test(HD.plainText(s)) && s.length <= 70) days.push(HD.plainText(s).replace(/\.$/, ''));
        else other.push(s);
      }
      if (other.length || line.trim() === '') lines.push(other.join(' '));
    }
    return { end, day: days.join(' · '), note: HD.cleanLines(lines.join('\n')) };
  }
  /* Sonntag, 1. November 2026 · Hochfest Allerheiligen · 11:00 – ca. 12:45 Uhr
     (jeder Teil bricht nur als Ganzes um) */
  /* "11:00 – ca. 12:45 Uhr", "11:00 am – approx. 12:45 pm", "ore 11:00 – ca. 12:45" */
  function zeitspanne(beginn, end) {
    const bis = end ? ` – ${HD.uhr(end.replace('ca. ', `${T('ca.')} `))}` : '';
    if (LANG === 'en') return `${HD.uhr(beginn)}${bis}`;
    if (LANG === 'it') return `ore ${beginn}${bis}`;
    return `${beginn}${bis} Uhr`;
  }
  const whenHTML = (e, day, end) => [
    gross(HD.fmtLang(e.dateObj, true)),
    day && T(day),
    zeitspanne(e.time, end)
  ].filter(Boolean).map((p) => `<span class="hd-when-part">${HD.esc(p)}</span>`).join(' · ');

  /* "Miriam Kutrowatz (Sopran)" -> {name, role: "Sopran"}; ohne Klammer die uebergebene Aufgabe */
  function performer(s, role = '') {
    const m = /^(.*?)\s*\(([^)]+)\)$/.exec(s);
    return m ? { name: m[1], role: T(m[2]) } : { name: s, role: role && T(role) };
  }
  /* "Kammerchor von St. Augustin" + "Orchester von St. Augustin" -> "Kammerchor & Orchester von St. Augustin" */
  function ensembles(choir, orchestra) {
    const a = /^(.+?)\s+(von .+)$/.exec(choir);
    const b = /^(.+?)\s+(von .+)$/.exec(orchestra);
    if (a && b && a[2] === b[2]) return [`${a[1]} & ${b[1]} ${a[2]}`];
    return [choir, orchestra].filter(Boolean);
  }
  /* "Joseph Haydn (1732-1809): „Harmoniemesse“, …" -> Komponist, Lebensdaten, Werk */
  function piece(s) {
    const m = /^([^:(„"]+?)\s*(?:\(([^)]*)\))?\s*:\s*(.+)$/.exec(s);
    if (!m) return { composer: '', years: '', work: s };
    return { composer: m[1], years: (m[2] || '').replace(/(\d)-(\d)/g, '$1–$2'), work: m[3] };
  }
  /* Augustinerkirche mit Adresse, andere Orte wie eingetragen */
  const place = (loc) => (/^augustinerkirche$/i.test(loc.trim())
    ? { name: 'Augustinerkirche', addr: T('1010 Wien, Hofburg – Josefsplatz'), query: 'Augustinerkirche, Augustinerstraße 3, 1010 Wien' } : { name: loc, addr: '' });
  /* Ort in Google Maps (Suche nach Name bzw. Adresse) */
  const mapsUrl = (w) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(w.query || `${w.name}, Wien`)}`;
  const PIN = '<svg class="hd-pin" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';

  function musicHTML(lines) {
    if (!lines.length) return '';
    return `<section class="hd-sec" aria-labelledby="hd-music-h"><h2 class="hd-sec-title" id="hd-music-h">${T('Musik im Gottesdienst')}</h2><ul class="hd-music">` +
      lines.map((l) => {
        const p = piece(l);
        return '<li>' + (p.composer
          ? `<span class="hd-composer">${HD.richText(p.composer, '../')}${p.years ? ` <span class="hd-years">${HD.esc(p.years)}</span>` : ''}</span>` : '') +
          `<span class="hd-work">${HD.richText(p.work, '../')}</span></li>`;
      }).join('') + '</ul></section>';
  }
  /* Name ohne Titel und Klammern zum Vergleichen: "KMD MMag. Peter Tiefengraber, MA"
     und "KMD Peter Tiefengraber" ergeben beide "peter tiefengraber" */
  const nameKey = (s) => String(s || '').replace(/\([^)]*\)/g, ' ').split(/[\s,]+/)
    .filter((t) => t && !t.includes('.') && !/^[A-ZÄÖÜ]{2,4}$/.test(t)).join(' ').toLowerCase();
  /* Name mit Link zur Homepage (aus data/solisten.json und data/personen.json), sonst nur der Name */
  function nameHTML(name, homepages) {
    const href = homepages.get(nameKey(name));
    return href ? `<a href="${HD.esc(href)}" target="_blank" rel="noopener">${HD.esc(name)}</a>` : HD.esc(name);
  }
  function castHTML(groups, people, homepages) {
    if (!groups.length && !people.length) return '';
    return `<section class="hd-sec" aria-labelledby="hd-cast-h"><h2 class="hd-sec-title" id="hd-cast-h">${T('Ausführende')}</h2><ul class="hd-cast">` +
      groups.map((g) => `<li class="hd-cast-group">${HD.esc(g)}</li>`).join('') +
      people.map((p) => `<li${p.gap ? ' class="hd-cast-gap"' : ''}><span class="hd-name">${nameHTML(p.name, homepages)}</span>${p.role ? `<span class="hd-role">${HD.esc(p.role)}</span>` : ''}</li>`).join('') +
      '</ul></section>';
  }
  /* Homepages der Solisten und der Kirchenmusik (Leitung, Gastdirigenten, Organisten):
     nameKey -> Adresse; fehlt eine Liste, gibt es fuer sie keine Links */
  async function loadHomepages() {
    const map = new Map();
    const add = (p) => {
      const href = p && /^https?:\/\//i.test(String(p.homepage || '').trim()) && HD.safeUrl(p.homepage.trim());
      if (p && p.name && href) map.set(nameKey(p.name), href);
    };
    const [sol, pers] = await Promise.allSettled([HD.fetchJSON('../data/solisten.json'), HD.fetchJSON('../data/personen.json')]);
    if (sol.status === 'fulfilled' && Array.isArray(sol.value)) sol.value.forEach(add);
    if (pers.status === 'fulfilled' && pers.value) {
      for (const g of ['leitung', 'gastdirigenten', 'organisten']) (pers.value[g] || []).forEach(add);
    }
    return map;
  }

  function navLink(e, dir) {
    if (!e) return '<span></span>';
    return `<a class="hd-nav-link hd-${dir}" href="${seite('hochamt.html')}?id=${encodeURIComponent(e.id)}">` +
      `<span class="hd-nav-dir">${dir === 'prev' ? `&larr; ${T('Vorheriges')}` : `${T('Nächstes')} &rarr;`}</span>` +
      `<span class="hd-nav-txt">${HD.esc(e.piece || T(e.type))}</span>` +
      `<span class="hd-nav-date">${shortDate(e.dateObj)}</span></a>`;
  }

  function renderNotFound(body) {
    qs('#hd-title').textContent = T('Hochamt nicht gefunden');
    body.innerHTML = `<p class="s-text">${T('Dieser Termin ist nicht (mehr) eingetragen.')}</p>` +
      `<p style="margin-top:1.5rem"><a class="btn btn-dark" href="${seite('musik.html')}#p-hochaemter">${T('Alle Hochämter')}</a></p>`;
  }

  function render(entries, id, homepages) {
    const body = qs('#hd-body');
    const idx = entries.findIndex((e) => e.id === id);
    if (idx < 0) {
      renderNotFound(body);
      return;
    }
    const e = entries[idx];
    const upcoming = HD.isUpcoming(e);
    const listHref = `${seite('musik.html')}#${upcoming ? 'p-hochaemter' : 'p-hochaemter-archiv'}`;

    /* Reihenfolge: Datum und Zeit, Werk, Anlass mit Zelebrant (Kopf), dann
       Musik im Gottesdienst, Ausfuehrende, Ort, Hinweis, Bitte um Spende */
    const { end, day, note } = splitNote(e.note);
    const typ = T(e.type);
    document.title = `${e.piece || typ} — ${typ} — Augustinerkirche Wien`;
    qs('#hd-type').innerHTML = whenHTML(e, day, end);
    qs('#hd-title').textContent = e.piece || typ;
    qs('#hd-when').textContent = e.celebrant ? T('{typ} mit {wer}', { typ, wer: e.celebrant }) : typ;

    const music = e.extra.length ? e.extra : (e.piece ? [e.piece] : []);
    const soloists = e.soloists.map((s) => performer(s));
    const others = [
      ...e.organist.map((s) => performer(s, 'Orgel')),
      ...(e.conductor ? [performer(e.conductor, 'Dirigent')] : [])
    ];
    /* Abstand zwischen den Solisten und Orgel/Dirigent */
    if (soloists.length && others.length) others[0].gap = true;
    const people = [...soloists, ...others];
    const program = musicHTML(music) + castHTML(ensembles(e.choir, e.orchestra), people, homepages);
    const where = place(e.location);

    body.innerHTML =
      (program || `<p class="s-text">${T('Die Mitwirkenden und das genaue Programm werden noch bekannt gegeben.')}</p>`) +
      `<p class="hd-place">${PIN}<a class="hd-map" href="${HD.esc(mapsUrl(where))}" target="_blank" rel="noopener" title="${T('In Google Maps öffnen (neues Fenster)')}"><strong>${HD.esc(where.name)}</strong>${where.addr ? `<span class="hd-addr">${HD.esc(where.addr)}</span>` : ''}</a></p>` +
      (note ? `<p class="hd-note"><span class="hd-note-label">${T('Hinweis')}</span>${HD.richText(note, '../')}</p>` : '') +
      `<div class="hd-thanks"><p>${T('Dankbar sind wir für Ihre Spende zur Erhaltung der Kirchenmusik!')}</p>` +
        `<a class="btn btn-gold hd-thanks-btn" href="${seite('musik.html')}#p-patenschaft">${T('Kirchenmusik unterstützen')}</a></div>` +
      `<p class="hd-list-link"><a class="link-arr" href="${listHref}">${upcoming ? T('Alle Hochämter') : T('Zum Archiv')}</a></p>`;

    qs('#hd-nav').innerHTML = navLink(entries[idx - 1], 'prev') + navLink(entries[idx + 1], 'next');

    /* Zurueck-Knopf: kam man von einer anderen Seite dieser Website, geht es
       dorthin zurueck (inkl. Scrollposition); sonst zur passenden Liste. */
    const back = qs('#hd-back');
    if (back) {
      back.setAttribute('href', listHref);
      back.addEventListener('click', (ev) => {
        const ref = document.referrer;
        if (ref.startsWith(location.origin) && !/hochamt(\.\w\w)?\.html/.test(ref) && history.length > 1) {
          ev.preventDefault();
          history.back();
        }
      });
    }
  }

  /* Fotos dieses Termins: zuerst die kleine Uebersicht (data/hochamt-fotos/index.json), nur wenn
     der Termin dort Fotos hat, seine Detail-Datei. Fehlt die Uebersicht noch, gilt die alte
     Sammeldatei data/hochamt-fotos.json. */
  async function loadPhotos(id) {
    const json = async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      return res.json();
    };
    try {
      const index = (await json('../data/hochamt-fotos/index.json')).hochaemter || {};
      if (!index[id]) return [];
      return (await json(`../data/hochamt-fotos/${encodeURIComponent(id)}.json`)).bilder || [];
    } catch (e) {
      if (e && e.status !== 404) return [];
      try {
        return ((await json('../data/hochamt-fotos.json')).bilder || {})[id] || [];
      } catch {
        return [];
      }
    }
  }
  /* Ein Foto als Link zur Grossfassung (Vergroesserung mit Blaettern, lightbox.js); im Gitter steht
     nur das kleine Vorschaubild. Breite und Hoehe stehen fest, damit beim Laden nichts springt.
     big: in der Spalte neben dem Programm darf der Browser auf scharfen Bildschirmen die Grossfassung nehmen. */
  function photoLink(b, title, cls, big = false) {
    const cap = String(b.alt || '').trim();
    const w = HD.num(b.breite, 0);
    const h = HD.num(b.hoehe, 0);
    const r = w && h ? (w / h).toFixed(4) : '1.3333';
    const tw = w && h ? Math.round(640 * Math.min(1, w / h)) : 640;
    const th = w && h ? Math.round(640 * Math.min(1, h / w)) : 480;
    const credit = String(b.nachweis || '').trim();
    return `<a class="${cls}" href="${HD.esc(b.src)}" data-lightbox data-gallery="hochamt" data-thumb="${HD.esc(b.thumb)}"` +
      (cap ? ` data-caption="${HD.esc(cap)}"` : '') + (credit ? ` data-credit="${HD.esc(credit)}"` : '') + ` style="--r:${r}" title="${T('Foto vergrößern')}">` +
      `<img src="${HD.esc(b.thumb)}"${big && b.thumb !== b.src && w ? ` srcset="${HD.esc(b.thumb)} ${tw}w, ${HD.esc(b.src)} ${w}w" sizes="(max-width: 900px) 92vw, 19rem"` : ''}` +
      ` alt="${HD.esc(cap || T('Foto: {titel}', { titel: title }))}" width="${tw}" height="${th}" loading="lazy" decoding="async"/></a>`;
  }
  async function showPhotos(id) {
    const aside = qs('#hd-poster');
    const layout = qs('#hd-layout');
    if (!aside || !layout || !id) return;
    const list = await loadPhotos(id);
    const shown = (Array.isArray(list) ? list : []).map((b) => ({
      ...b, src: HD.safeUrl(b && b.bild, '../'), thumb: HD.safeUrl((b && b.vorschau) || (b && b.bild), '../')
    })).filter((b) => b.src);
    if (!shown.length) return;
    const title = qs('#hd-title').textContent;
    const n = shown.length;
    /* Wenige Fotos stehen in der Spalte neben dem Programm (unter dem Plakat, falls es eines gibt).
       Ab 5 Fotos: dort das erste mit Hinweis, alle als Fotogitter unter dem Programm. */
    const MANY = 5;
    const host = document.createElement('div');
    host.className = 'hd-aside-photos';
    if (n < MANY) {
      host.innerHTML = shown.map((b) => {
        const cap = String(b.alt || '').trim();
        return `<figure class="hd-photo">${photoLink(b, title, 'hd-photo-link', true)}${cap ? `<figcaption>${HD.esc(cap)}</figcaption>` : ''}</figure>`;
      }).join('');
    } else {
      host.innerHTML = `<figure class="hd-photo">${photoLink(shown[0], title, 'hd-photo-link', true)}</figure>` +
        `<a class="link-arr hd-photos-jump" href="#hd-fotos">${T('Alle {n} Fotos ansehen', { n })}</a>`;
      const sec = document.createElement('section');
      sec.className = 'hd-photos-wrap';
      sec.id = 'hd-fotos';
      sec.setAttribute('aria-labelledby', 'hd-fotos-h');
      sec.innerHTML = `<h2 class="s-title hd-photos-title" id="hd-fotos-h">${T('Fotos')} <span class="hd-photos-n">${n}</span></h2>` +
        `<div class="hd-gallery">${shown.map((b) => photoLink(b, title, 'hd-gal-item')).join('')}</div>`;
      layout.after(sec);
    }
    aside.append(host);
    aside.classList.add('has-photos');
    aside.setAttribute('aria-label', T('Plakat und Fotos'));
    aside.hidden = false;
    layout.classList.add('has-poster');
  }

  /* Plakat der verknuepften Meldung neben dem Programm zeigen */
  const NEWS_KEYS = {
    datum: 'date', titel: 'title', plakat: 'poster', vorschaubild: 'thumb', link: 'link',
    weitererlink: 'link2', weitererlinktext: 'linktext2', entwurf: 'draft', ab: 'from', bildnachweis: 'credit'
  };
  async function showPoster(id) {
    const aside = qs('#hd-poster');
    if (!aside || !id) return false;
    let rows;
    try {
      const res = await fetch('../data/news.csv');
      if (!res.ok) return false;
      rows = HD.rowsToRaw(HD.parseCSV(HD.mailDecode(await res.text())), NEWS_KEYS);
    } catch {
      return false;
    }
    const target = `pages/hochamt.html?id=${id}`;
    const dd = new Date();
    const today = `${dd.getFullYear()}-${HD.pad(dd.getMonth() + 1)}-${HD.pad(dd.getDate())}`;
    const visible = (r) => !/^ja$/i.test(r.draft || '') && !(HD.isoDate(r.from || '') && HD.isoDate(r.from) > today);
    const n = rows.find((r) => visible(r) && (r.poster || r.thumb) && safeDecode(String(r.link || '').trim()) === target);
    const src = n && HD.safeUrl(n.poster || n.thumb, '../');
    if (!src) return false;
    const newsId = `${HD.isoDate(n.date)}-${HD.slug(n.title)}`;
    const credit = n.credit ? ` data-credit="${HD.esc(n.credit)}"` : '';
    const img = `<img src="${HD.esc(src)}" alt="${HD.esc(T('Plakat: {titel}', { titel: n.title }))}" loading="lazy" decoding="async"${credit}/>`;
    /* Eigener Block, damit die Fotos darunter nicht ueberschrieben werden */
    let host = aside.querySelector('.hd-aside-poster');
    if (!host) {
      host = document.createElement('div');
      host.className = 'hd-aside-poster';
      aside.prepend(host);
    }
    host.innerHTML = n.poster
      ? `<a href="${HD.esc(src)}" target="_blank" rel="noopener" title="${T('Plakat in voller Größe öffnen')}" data-lightbox${credit}>${img}</a><div class="runde-side-cap">${T('Plakat vergrößern')}</div>`
      : img;
    /* Zweite Schaltflaeche der Meldung, z. B. Kartenverkauf */
    const link2 = HD.safeUrl(n.link2, '../');
    if (link2) {
      const ext = /^https?:/i.test(link2) ? ' target="_blank" rel="noopener"' : '';
      host.insertAdjacentHTML('beforeend', `<a class="btn btn-gold hd-poster-btn" href="${HD.esc(link2)}"${ext}>${HD.esc(n.linktext2 || T('Mehr Informationen'))}</a>`);
    }
    host.insertAdjacentHTML('beforeend', `<a class="link-arr" href="../index.html?news=${encodeURIComponent(newsId)}">${LANG === 'de' ? 'Zur Meldung' : T('Zur Meldung (Deutsch)')}</a>`);
    aside.hidden = false;
    qs('#hd-layout').classList.add('has-poster');
    return true;
  }

  /* Aktuelle Tabelle laden; fehlt der Termin, im Archiv seines Jahres nachsehen */
  async function loadEntries(id) {
    const entries = await HD.load('../data/hochaemter.csv');
    if (entries.some((e) => e.id === id)) return entries;
    const year = parseInt(id.slice(0, 4), 10);
    if (!year) return entries;
    /* Nur Jahre nachladen, die es im Archiv gibt (sonst eine unnoetige 404-Anfrage) */
    const years = await HD.archiveYears('../data/archiv/');
    if (Array.isArray(years) && years.length && !years.some((y) => Number(y && y.jahr) === year)) return entries;
    try {
      const older = await HD.loadYear('../data/archiv/', year);
      return older.concat(entries).sort(HD.byDateTime);
    } catch {
      return entries;
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!HD) return;
    const id = new URLSearchParams(location.search).get('id') || '';
    try {
      const [entries, homepages] = await Promise.all([loadEntries(id), loadHomepages()]);
      render(entries, id, homepages);
      /* Fotos neben dem Programm; gibt es ein Plakat, darunter */
      await showPoster(id);
      showPhotos(id);
    } catch {
      qs('#hd-body').innerHTML = FALLBACK;
    }
  });
})();
