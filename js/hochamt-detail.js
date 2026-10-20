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
   Fotos des Termins (data/hochamt-fotos.json, gepflegt in der Verwaltung)
   erscheinen neben dem Programm, wo sonst das Plakat steht; gibt es ein
   Plakat, stehen sie unter dem Programm. Sie lassen sich vergroessern.
   ============================================================ */
(function () {
  'use strict';

  const HD = window.HochamtData;
  const qs = (sel) => document.querySelector(sel);
  const FALLBACK = '<p class="s-text">Die Termine konnten nicht geladen werden. Bitte laden Sie die Seite später noch einmal.</p>';

  /* Adresse ohne Fehler dekodieren (kaputte %-Folgen bleiben unveraendert) */
  const safeDecode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
  const shortDate = (d) => `${d.getDate()}. ${HD.MONTHS[d.getMonth()]} ${d.getFullYear()}`;

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
    const other = [];
    for (const s of rest.split(/(?<=\.)\s+/).map((x) => x.trim()).filter(Boolean)) {
      if (DAY.test(s) && s.length <= 70) days.push(s.replace(/\.$/, ''));
      else other.push(s);
    }
    return { end, day: days.join(' · '), note: other.join(' ') };
  }
  /* Sonntag, 1. November 2026 · Hochfest Allerheiligen · 11:00 – ca. 12:45 Uhr
     (jeder Teil bricht nur als Ganzes um) */
  const whenHTML = (e, day, end) => [
    `${HD.WEEKDAYS[e.dateObj.getDay()]}, ${shortDate(e.dateObj)}`,
    day,
    `${e.time}${end ? ` – ${end}` : ''} Uhr`
  ].filter(Boolean).map((p) => `<span class="hd-when-part">${HD.esc(p)}</span>`).join(' · ');

  /* "Miriam Kutrowatz (Sopran)" -> {name, role: "Sopran"}; ohne Klammer die uebergebene Aufgabe */
  function performer(s, role = '') {
    const m = /^(.*?)\s*\(([^)]+)\)$/.exec(s);
    return m ? { name: m[1], role: m[2] } : { name: s, role };
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
    ? { name: 'Augustinerkirche', addr: '1010 Wien, Hofburg – Josefsplatz' } : { name: loc, addr: '' });
  const PIN = '<svg class="hd-pin" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';

  function musicHTML(lines) {
    if (!lines.length) return '';
    return '<section class="hd-sec" aria-labelledby="hd-music-h"><h2 class="hd-sec-title" id="hd-music-h">Musik im Gottesdienst</h2><ul class="hd-music">' +
      lines.map((l) => {
        const p = piece(l);
        return '<li>' + (p.composer
          ? `<span class="hd-composer">${HD.esc(p.composer)}${p.years ? ` <span class="hd-years">${HD.esc(p.years)}</span>` : ''}</span>` : '') +
          `<span class="hd-work">${HD.esc(p.work)}</span></li>`;
      }).join('') + '</ul></section>';
  }
  function castHTML(groups, people) {
    if (!groups.length && !people.length) return '';
    return '<section class="hd-sec" aria-labelledby="hd-cast-h"><h2 class="hd-sec-title" id="hd-cast-h">Ausführende</h2><ul class="hd-cast">' +
      groups.map((g) => `<li class="hd-cast-group">${HD.esc(g)}</li>`).join('') +
      people.map((p) => `<li${p.gap ? ' class="hd-cast-gap"' : ''}><span class="hd-name">${HD.esc(p.name)}</span>${p.role ? `<span class="hd-role">${HD.esc(p.role)}</span>` : ''}</li>`).join('') +
      '</ul></section>';
  }

  function navLink(e, dir) {
    if (!e) return '<span></span>';
    return `<a class="hd-nav-link hd-${dir}" href="hochamt.html?id=${encodeURIComponent(e.id)}">` +
      `<span class="hd-nav-dir">${dir === 'prev' ? '&larr; Vorheriges' : 'Nächstes &rarr;'}</span>` +
      `<span class="hd-nav-txt">${HD.esc(e.piece || e.type)}</span>` +
      `<span class="hd-nav-date">${shortDate(e.dateObj)}</span></a>`;
  }

  function renderNotFound(body) {
    qs('#hd-title').innerHTML = 'Hochamt nicht gefunden';
    body.innerHTML = '<p class="s-text">Dieser Termin ist nicht (mehr) eingetragen.</p>' +
      '<p style="margin-top:1.5rem"><a class="btn btn-dark" href="musik.html#p-hochaemter">Alle Hochämter</a></p>';
  }

  function render(entries, id) {
    const body = qs('#hd-body');
    const idx = entries.findIndex((e) => e.id === id);
    if (idx < 0) {
      renderNotFound(body);
      return;
    }
    const e = entries[idx];
    const upcoming = HD.isUpcoming(e);
    const listHref = `musik.html#${upcoming ? 'p-hochaemter' : 'p-hochaemter-archiv'}`;

    /* Reihenfolge: Datum und Zeit, Werk, Anlass mit Zelebrant (Kopf), dann
       Musik im Gottesdienst, Ausfuehrende, Ort, Hinweis, Bitte um Spende */
    const { end, day, note } = splitNote(e.note);
    document.title = `${e.piece || e.type} — ${e.type} — Augustinerkirche Wien`;
    qs('#hd-type').innerHTML = whenHTML(e, day, end);
    qs('#hd-title').textContent = e.piece || e.type;
    qs('#hd-when').textContent = e.celebrant ? `${e.type} mit ${e.celebrant}` : e.type;

    const music = e.extra.length ? e.extra : (e.piece ? [e.piece] : []);
    const soloists = e.soloists.map((s) => performer(s));
    const others = [
      ...e.organist.map((s) => performer(s, 'Orgel')),
      ...(e.conductor ? [performer(e.conductor, 'Dirigent')] : [])
    ];
    /* Abstand zwischen den Solisten und Orgel/Dirigent */
    if (soloists.length && others.length) others[0].gap = true;
    const people = [...soloists, ...others];
    const program = musicHTML(music) + castHTML(ensembles(e.choir, e.orchestra), people);
    const where = place(e.location);

    body.innerHTML =
      (program || '<p class="s-text">Die Mitwirkenden und das genaue Programm werden noch bekannt gegeben.</p>') +
      `<p class="hd-place">${PIN}<span><strong>${HD.esc(where.name)}</strong>${where.addr ? `<span class="hd-addr">${HD.esc(where.addr)}</span>` : ''}</span></p>` +
      (note ? `<p class="hd-note"><span class="hd-note-label">Hinweis</span>${HD.esc(note)}</p>` : '') +
      '<div class="hd-thanks"><p>Dankbar sind wir für Ihre Spende zur Erhaltung der Kirchenmusik!</p>' +
        '<a class="btn btn-gold hd-thanks-btn" href="musik.html#p-patenschaft">Kirchenmusik unterstützen</a></div>' +
      `<p class="hd-list-link"><a class="link-arr" href="${listHref}">${upcoming ? 'Alle Hochämter' : 'Zum Archiv'}</a></p>`;

    qs('#hd-nav').innerHTML = navLink(entries[idx - 1], 'prev') + navLink(entries[idx + 1], 'next');

    /* Zurueck-Knopf: kam man von einer anderen Seite dieser Website, geht es
       dorthin zurueck (inkl. Scrollposition); sonst zur passenden Liste. */
    const back = qs('#hd-back');
    if (back) {
      back.setAttribute('href', listHref);
      back.addEventListener('click', (ev) => {
        const ref = document.referrer;
        if (ref.startsWith(location.origin) && !ref.includes('hochamt.html') && history.length > 1) {
          ev.preventDefault();
          history.back();
        }
      });
    }
  }

  /* Fotos dieses Termins zeigen: ohne Plakat neben dem Programm (Spalte des Plakats),
     mit Plakat unter dem Programm */
  async function showPhotos(id, hasPoster) {
    const aside = qs('#hd-poster');
    const body = qs('#hd-body');
    if (!aside || !body || !id) return;
    let list;
    try {
      const res = await fetch('../data/hochamt-fotos.json');
      if (!res.ok) return;
      list = ((await res.json()).bilder || {})[id];
    } catch {
      return;
    }
    const shown = (Array.isArray(list) ? list : []).map((b) => ({ ...b, src: HD.safeUrl(b.bild, '../') })).filter((b) => b.src);
    if (!shown.length) return;
    const title = qs('#hd-title').textContent;
    const figures = shown.map((b) => {
      const cap = String(b.alt || '').trim();
      const dim = b.breite && b.hoehe ? ` width="${HD.num(b.breite, 900)}" height="${HD.num(b.hoehe, 600)}"` : '';
      return `<figure class="hd-photo"><img src="${HD.esc(b.src)}" alt="${HD.esc(cap || `Foto: ${title}`)}"${dim} loading="lazy" decoding="async"/>` +
        (cap ? `<figcaption>${HD.esc(cap)}</figcaption>` : '') + '</figure>';
    }).join('');
    if (hasPoster) {
      /* Unter dem Programm, vor dem Link "Alle Hochaemter" */
      if (!body.lastElementChild) return;
      const sec = document.createElement('div');
      sec.className = 'hd-photos-wrap';
      sec.innerHTML = `<h2 class="s-title hd-photos-title">Fotos</h2><div class="hd-photos">${figures}</div>`;
      body.lastElementChild.before(sec);
      return;
    }
    const host = document.createElement('div');
    host.className = 'hd-aside-photos';
    host.innerHTML = figures;
    aside.append(host);
    aside.classList.add('has-photos');
    aside.setAttribute('aria-label', 'Plakat und Fotos');
    aside.hidden = false;
    qs('#hd-layout').classList.add('has-poster');
  }

  /* Plakat der verknuepften Meldung neben dem Programm zeigen */
  const NEWS_KEYS = {
    datum: 'date', titel: 'title', plakat: 'poster', vorschaubild: 'thumb', link: 'link',
    weitererlink: 'link2', weitererlinktext: 'linktext2'
  };
  async function showPoster(id) {
    const aside = qs('#hd-poster');
    if (!aside || !id) return false;
    let rows;
    try {
      const res = await fetch('../data/news.csv');
      if (!res.ok) return false;
      rows = HD.rowsToRaw(HD.parseCSV(await res.text()), NEWS_KEYS);
    } catch {
      return false;
    }
    const target = `pages/hochamt.html?id=${id}`;
    const n = rows.find((r) => (r.poster || r.thumb) && safeDecode(String(r.link || '').trim()) === target);
    const src = n && HD.safeUrl(n.poster || n.thumb, '../');
    if (!src) return false;
    const newsId = `${HD.isoDate(n.date)}-${HD.slug(n.title)}`;
    const img = `<img src="${HD.esc(src)}" alt="${HD.esc(`Plakat: ${n.title}`)}" loading="lazy" decoding="async"/>`;
    /* Eigener Block, damit die Fotos darunter nicht ueberschrieben werden */
    let host = aside.querySelector('.hd-aside-poster');
    if (!host) {
      host = document.createElement('div');
      host.className = 'hd-aside-poster';
      aside.prepend(host);
    }
    host.innerHTML = n.poster
      ? `<a href="${HD.esc(src)}" target="_blank" rel="noopener" title="Plakat in voller Größe öffnen" data-lightbox>${img}</a><div class="runde-side-cap">Plakat vergrößern</div>`
      : img;
    /* Zweite Schaltflaeche der Meldung, z. B. Kartenverkauf */
    const link2 = HD.safeUrl(n.link2, '../');
    if (link2) {
      const ext = /^https?:/i.test(link2) ? ' target="_blank" rel="noopener"' : '';
      host.insertAdjacentHTML('beforeend', `<a class="btn btn-gold hd-poster-btn" href="${HD.esc(link2)}"${ext}>${HD.esc(n.linktext2 || 'Mehr Informationen')}</a>`);
    }
    host.insertAdjacentHTML('beforeend', `<a class="link-arr" href="../index.html?news=${encodeURIComponent(newsId)}">Zur Meldung</a>`);
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
      render(await loadEntries(id), id);
      /* Fotos neben dem Programm; gibt es ein Plakat, darunter */
      showPhotos(id, await showPoster(id));
    } catch {
      qs('#hd-body').innerHTML = FALLBACK;
    }
  });
})();
