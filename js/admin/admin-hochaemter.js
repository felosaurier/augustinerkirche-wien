/* ============================================================
   Augustinerkirche Wien — admin-hochaemter.js
   Hochaemter pflegen (admin/hochaemter.html), Quelle ist
   data/hochaemter.csv (dieselbe Tabelle, die Excel oeffnet).
   - Liste nach Monaten, Suche, Filter kommende/vergangene/alle
   - Bearbeiten im Fenster: Termin, Musik, Mitwirkende, Programm;
     Vorschlaege aus den bisherigen Eintraegen und der Solistenliste
   - Kopieren (eine Woche spaeter), Loeschen mit Rueckfrage
   - Jahreswechsel: Termine der Vorjahre ins Jahresarchiv
     (data/archiv/hochaemter-JJJJ.csv und jahre.json)
   - Excel: Tabelle herunterladen oder eine bearbeitete einlesen
   - Verknuepfte Meldungen (Plakat): im Fenster anzeigen, Verknuepfung
     aufheben; beim Verschieben oder Loeschen eines Termins zieht die
     Meldung mit bzw. verliert ihre Verknuepfung
   - Fotos je Termin (data/hochamt-fotos.json, Bilder in assets/img/hochaemter/<Kennung>/,
     jedes Hochamt hat seinen eigenen Ordner):
     mehrere hinzufuegen, Beschreibung und Bildnachweis, Reihenfolge, entfernen;
     erscheinen auf der Seite des Termins. Beim Verschieben ziehen sie mit.
     Ein Foto wird gleich beim Hinzufuegen als WebP in den Ordner geschrieben;
     wird das Fenster ohne Speichern geschlossen oder das Foto entfernt,
     wird die Datei wieder geloescht. Aendert sich Datum oder Uhrzeit des Termins,
     ziehen die Fotos in den neuen Ordner um (mit verbundenem Projektordner).
   Benoetigt js/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { HD, $, esc, icon } = A;
  const PATH = 'data/hochaemter.csv';
  const ARCHIVE_DIR = 'data/archiv/';
  const KEYS = HD.FIELDS.map(([k]) => k);
  const SIMPLE = ['date', 'time', 'type', 'location', 'piece', 'conductor', 'choir', 'orchestra', 'celebrant', 'note'];
  const DEFAULTS = { time: '11:00', type: 'Hochamt', location: 'Augustinerkirche' };
  const DEFAULT_END = '12:30';
  /* Das Ende steht in der Tabelle im Hinweis ("Ende ca. 12:45 Uhr.", wie auf der
     Detailseite gelesen); im Fenster hat es ein eigenes Feld neben dem Beginn. */
  const END = /\s*Ende\s+(ca\.\s*)?(\d{1,2})[:.](\d{2})\s*(Uhr)?\.?/i;
  const VOICES = ['Sopran', 'Mezzosopran', 'Alt', 'Altus', 'Tenor', 'Bariton', 'Bass', 'Trompete', 'Violine', 'Flöte', 'Orgel', 'Rezitation'];

  let entries = [];          /* Textfelder wie in der CSV, Datum JJJJ-MM-TT, Uhrzeit HH:MM */
  let filter = 'upcoming';
  let query = '';
  let editIndex = -1;        /* -1 = neuer Termin */
  let snap = '';             /* Stand des Formulars beim Oeffnen */
  let soloists = null;
  let news = [];           /* Meldungen aus data/news.csv (fuer verknuepfte Plakate) */
  const NEWS_PATH = 'data/news.csv';
  const HA_PREFIX = 'pages/hochamt.html?id=';
  let organists = null;
  /* Fotos: {bilder: {Kennung: [{bild, alt, breite, hoehe}]}} und die im Fenster bearbeitete Liste */
  const PHOTOS_PATH = 'data/hochamt-fotos.json';
  const PHOTO_DIR = 'assets/img/hochaemter/';
  let photoMap = {};
  let photos = [];         /* {path, url, ext, w, h, alt, credit, key, fresh}; fresh = in diesem Fenster neu geschrieben */
  let photoSeq = 0;
  const knownVoices = new Map();  /* Name -> Stimme, fuer das automatische Ergaenzen */

  const F = (k) => $(`f-${k}`);
  /* Kennung wie auf der Detailseite (pages/hochamt.html?id=…) */
  const keyOf = (e) => `${e.date}-${e.time.replace(':', '')}`;
  const isUpcoming = (e) => e.date >= A.isoToday();
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  /* | trennt in der Tabelle mehrere Eintraege einer Zelle */
  const cleanItem = (s) => clean(s).replace(/\|/g, '/');
  const notFound = (e) => e && (e.name === 'NotFoundError' || e.status === 404);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  function prepare(o) {
    const e = {};
    for (const k of KEYS) e[k] = String(o[k] || '').trim();
    e.date = HD.isoDate(e.date);
    e.time = HD.isoTime(e.time) || DEFAULTS.time;
    return e;
  }
  const parseTable = (text) => HD.rowsToRaw(HD.parseCSV(text)).map(prepare).filter((e) => e.date).sort(HD.byDateTime);

  function splitSoloist(s) {
    const m = String(s).match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    return m ? { name: m[1].trim(), voice: m[2].trim() } : { name: String(s).trim(), voice: '' };
  }
  const joinSoloist = (p) => (p.voice ? `${p.name} (${p.voice})` : p.name);

  /* Hinweis -> {end: "HH:MM" oder "", note: Hinweis ohne Ende} */
  function splitEnd(note) {
    const m = END.exec(note || '');
    if (!m) return { end: '', note: note || '' };
    return { end: `${m[2].padStart(2, '0')}:${m[3]}`, note: HD.cleanLines(note.replace(m[0], ' ')) };
  }
  const minutes = (t) => (t ? +t.slice(0, 2) * 60 + +t.slice(3, 5) : NaN);
  const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  /* ---------- Laden ---------- */
  async function load() {
    try {
      entries = parseTable(await A.readText(PATH));
    } catch (e) {
      entries = [];
      $('ha-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Tabelle <code>${PATH}</code> konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
      return;
    }
    buildSuggestions();
    render();
    renderArchiveBanner();
  }
  async function loadKnownVoices() {
    try {
      for (const p of (await A.readJSON('data/solisten.json'))) {
        if (p.name && p.voice) knownVoices.set(p.name, p.voice);
      }
    } catch {
      /* nur fuer Vorschlaege */
    }
  }

  /* Vorschlagslisten: haeufigste Eintraege zuerst */
  function byFrequency(values) {
    const m = new Map();
    for (const v of values) if (v) m.set(v, (m.get(v) || 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de')).map(([v]) => v);
  }
  function fillList(id, values) {
    $(id).innerHTML = values.map((v) => `<option value="${esc(v)}"></option>`).join('');
  }
  function buildSuggestions() {
    for (const k of ['type', 'location', 'piece', 'conductor', 'choir', 'orchestra', 'celebrant']) {
      fillList(`dl-${k}`, byFrequency(entries.map((e) => e[k])));
    }
    fillList('dl-organist', byFrequency(entries.flatMap((e) => HD.list(e.organist))));
    const solo = entries.flatMap((e) => HD.list(e.soloists).map(splitSoloist));
    for (const p of solo) if (p.voice && !knownVoices.has(p.name)) knownVoices.set(p.name, p.voice);
    fillList('dl-soloist', byFrequency([...solo.map((p) => p.name), ...knownVoices.keys()]));
    fillList('dl-voice', byFrequency([...VOICES, ...solo.map((p) => p.voice)]));
  }

  /* ---------- Liste ---------- */
  function matches(e, words) {
    if (!words.length) return true;
    const dt = HD.dateFromIso(e.date);
    const hay = [...KEYS.map((k) => e[k]), A.fmtShort(e.date), HD.MONTHS[dt.getMonth()], HD.WEEKDAYS[dt.getDay()]].join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  }

  function rowHTML({ e, i }) {
    const dt = HD.dateFromIso(e.date);
    const miss = isUpcoming(e) ? A.missingInfo(e) : [];
    const people = [e.celebrant, e.conductor, e.choir].filter(Boolean).join(' · ');
    const label = `${A.fmtShort(e.date)}, ${e.time}`;
    return `<li class="adm-row" data-key="${esc(keyOf(e))}">` +
      `<button type="button" class="adm-row-open" data-act="edit" data-i="${i}">` +
        `<span class="adm-date"><span class="adm-day">${HD.pad(dt.getDate())}</span><span class="adm-wd">${HD.WEEKDAYS_SHORT[dt.getDay()]}</span></span>` +
        '<span class="adm-row-body">' +
          `<span class="adm-row-title">${esc(e.piece || e.type || 'Ohne Titel')}</span>` +
          `<span class="adm-row-meta"><span class="kal-type">${esc(e.type)}</span>${e.location && e.location !== DEFAULTS.location ? ` · ${esc(e.location)}` : ''}</span>` +
          (people ? `<span class="adm-row-people">${esc(people)}</span>` : '') +
          (miss.length ? `<span class="adm-chip">${icon('alert')}Noch offen: ${esc(miss.join(', '))}</span>` : '') +
        '</span>' +
        `<span class="adm-row-time">${esc(e.time)}</span>` +
      '</button>' +
      '<div class="adm-row-actions">' +
        `<button type="button" class="adm-act" data-act="copy" data-i="${i}" aria-label="Kopieren: ${esc(label)}">${icon('copy')}Kopieren</button>` +
        `<button type="button" class="adm-act danger" data-act="del" data-i="${i}" aria-label="Löschen: ${esc(label)}">${icon('trash')}Löschen</button>` +
      '</div></li>';
  }

  function emptyHTML(words) {
    if (words.length) {
      return '<div class="adm-empty"><p class="adm-empty-title">Keine Treffer</p>' +
        `<p>Für „${esc(query.trim())}“ wurde nichts gefunden${filter !== 'all' ? '. Vielleicht unter „Alle“?' : '.'}</p>` +
        '<button type="button" class="btn btn-quiet" data-act="clear">Suche zurücksetzen</button></div>';
    }
    if (filter === 'upcoming') {
      return '<div class="adm-empty"><p class="adm-empty-title">Keine kommenden Termine</p><p>Lege das nächste Hochamt an.</p>' +
        `<button type="button" class="btn btn-gold" data-act="new">${icon('plus')}Neues Hochamt</button></div>`;
    }
    return '<div class="adm-empty"><p class="adm-empty-title">Keine Termine</p><p>In dieser Ansicht gibt es nichts.</p></div>';
  }

  function render() {
    const up = entries.filter(isUpcoming).length;
    $('ha-n-upcoming').textContent = up;
    $('ha-n-past').textContent = entries.length - up;
    $('ha-n-all').textContent = entries.length;

    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = entries.map((e, i) => ({ e, i }))
      .filter(({ e }) => (filter === 'all' || (filter === 'upcoming') === isUpcoming(e)) && matches(e, words));
    if (filter === 'past') list.reverse();
    $('ha-count').textContent = words.length ? `${plural(list.length, 'Treffer', 'Treffer')} für „${query.trim()}“` : '';
    if (!list.length) {
      $('ha-list').innerHTML = emptyHTML(words);
      return;
    }
    const groups = new Map();
    for (const item of list) {
      const m = item.e.date.slice(0, 7);
      if (!groups.has(m)) groups.set(m, []);
      groups.get(m).push(item);
    }
    $('ha-list').innerHTML = [...groups].map(([m, items]) => {
      const dt = HD.dateFromIso(`${m}-01`);
      return `<h2 class="adm-group-title">${HD.MONTHS[dt.getMonth()]} ${dt.getFullYear()} <small>${plural(items.length, 'Termin', 'Termine')}</small></h2>` +
        `<ul class="adm-rows">${items.map(rowHTML).join('')}</ul>`;
    }).join('');
  }

  function setFilter(f) {
    filter = f;
    document.querySelectorAll('[data-filter]').forEach((b) => {
      const on = b.dataset.filter === f;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    render();
  }

  /* Gerade gespeicherten Termin zeigen, hervorheben und fokussieren */
  function flash(key) {
    const row = document.querySelector(`.adm-row[data-key="${CSS.escape(key)}"]`);
    if (!row) return;
    row.classList.remove('flash');
    void row.offsetWidth;
    row.classList.add('flash');
    row.scrollIntoView({ block: 'nearest' });
    row.querySelector('.adm-row-open').focus({ preventScroll: true });
  }

  /* ---------- Verknuepfte Meldungen ---------- */
  async function loadNews() {
    try {
      news = A.parseNews(await A.readText(NEWS_PATH));
    } catch {
      news = [];
    }
  }
  const newsId = (n) => `${HD.isoDate(n.Datum)}-${HD.slug(n.Titel)}`;
  const linkedNews = (key) => news.filter((n) => decodeURIComponent(String(n.Link || '').trim()) === HA_PREFIX + key);
  const saveNews = () => A.saveFile(NEWS_PATH, HD.csvText([A.NEWS_HEAD, ...news.map((o) => A.NEWS_HEAD.map((h) => o[h]))]));

  function renderPoster() {
    const box = $('ha-poster');
    const entry = editIndex >= 0 ? entries[editIndex] : null;
    const list = entry ? linkedNews(keyOf(entry)) : [];
    if (!list.length) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    box.hidden = false;
    box.innerHTML = list.map((n) => {
      const src = n.Plakat || n.Vorschaubild ? A.imageUrl(n.Plakat || n.Vorschaubild) : '';
      return `<div class="adm-suggest ok adm-linked">${src ? `<img src="${esc(src)}" alt=""/>` : ''}<div>` +
        `<b>${icon('checkCircle')}Verknüpfte Meldung: „${esc(n.Titel)}“</b>` +
        `<span>${src ? 'Ihr Plakat erscheint auf der Seite dieses Termins.' : 'Die Meldung führt zum Programm dieses Termins.'}</span>` +
        '<div class="adm-suggest-row">' +
          `<a class="adm-act" href="neuigkeiten.html?bearbeiten=${encodeURIComponent(newsId(n))}">${icon('edit')}Meldung öffnen</a>` +
          `<button type="button" class="btn btn-quiet btn-sm" data-unlink-news="${esc(newsId(n))}">${icon('close')}Verknüpfung aufheben</button>` +
        '</div></div></div>';
    }).join('');
  }

  async function unlinkNews(id) {
    const n = news.find((x) => newsId(x) === id);
    if (!n) return;
    const ok = await A.confirmBox({
      title: 'Verknüpfung aufheben?',
      html: `Die Meldung <strong>„${esc(n.Titel)}“</strong> führt danach nicht mehr zu diesem Termin, ihr Plakat erscheint nicht mehr auf seiner Seite. Die Meldung selbst bleibt bestehen.`,
      ok: 'Aufheben'
    });
    if (!ok) return;
    const before = { Link: n.Link, Linktext: n.Linktext };
    n.Link = '';
    n.Linktext = '';
    try {
      const direct = await saveNews();
      A.toast(direct ? `Verknüpfung aufgehoben: „${n.Titel}“.` : 'Verknüpfung aufgehoben. Bitte unten die Datei herunterladen.');
      A.log(`Verknüpfung aufgehoben: Meldung „${n.Titel}“`);
      renderPoster();
      const first = $('ha-dlg').querySelector('.adm-dlg-body input');
      if (first) first.focus();
    } catch (err) {
      Object.assign(n, before);
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  /* Termin verschoben oder geloescht: verknuepfte Meldungen anpassen.
     newKey = neue Kennung oder '' (Verknuepfung loesen). Liefert die Anzahl. */
  async function relinkNews(oldKey, newKey) {
    const list = linkedNews(oldKey);
    if (!list.length) return 0;
    for (const n of list) {
      n.Link = newKey ? HA_PREFIX + newKey : '';
      if (!newKey) n.Linktext = '';
    }
    await saveNews();
    return list.length;
  }

  /* ---------- Fotos ---------- */
  async function loadPhotos() {
    try {
      photoMap = (await A.readJSON(PHOTOS_PATH)).bilder || {};
    } catch (e) {
      photoMap = {};
      if (!notFound(e)) A.toast('Die Fotos der Hochämter konnten nicht geladen werden.', 'err');
    }
  }
  const dirtyState = () => A.snapshot($('ha-form')) + photos.map((p) => p.key).join(',');
  /* Gibt es zu diesem Termin ein Plakat (verknuepfte Meldung mit Bild)? Dann zeigt die Seite keine Fotos */
  function hasPoster() {
    const entry = editIndex >= 0 ? entries[editIndex] : null;
    return !!entry && linkedNews(keyOf(entry)).some((n) => n.Plakat || n.Vorschaubild);
  }
  function renderPhotos() {
    $('ha-photo-note').hidden = !hasPoster();
    $('ha-photos').innerHTML = photos.map((p, i) =>
      `<div class="adm-ph" data-k="${p.key}">` +
        `<span class="adm-thumb"><img src="${esc(p.url)}" alt=""/></span>` +
        '<div class="adm-ph-fields">' +
          `<label class="adm-label" for="ph-alt-${p.key}">Beschreibung <span class="adm-opt">steht unter dem Foto</span></label>` +
          `<input class="adm-input" type="text" id="ph-alt-${p.key}" data-ph="alt" value="${esc(p.alt)}" placeholder="z. B. Chor und Orchester beim Gloria"/>` +
          `<label class="adm-label" for="ph-cr-${p.key}">Bildnachweis</label>` +
          `<input class="adm-input" type="text" id="ph-cr-${p.key}" data-ph="credit" value="${esc(p.credit)}" placeholder="z. B. © Augustiner Wien, Foto: Max Muster"/>` +
        '</div>' +
        '<div class="adm-ph-act">' +
          `<button type="button" class="adm-act icon" data-ph-act="up" aria-label="Nach vorne"${i === 0 ? ' disabled' : ''}>${icon('up')}</button>` +
          `<button type="button" class="adm-act icon" data-ph-act="down" aria-label="Nach hinten"${i === photos.length - 1 ? ' disabled' : ''}>${icon('down')}</button>` +
          `<button type="button" class="adm-act icon danger" data-ph-act="del" aria-label="Foto entfernen">${icon('trash')}</button>` +
        '</div></div>'
    ).join('');
  }
  /* Kennung nach dem Stand des Formulars; fehlt das Datum noch, ein Ordner "neu" */
  const formKey = () => (HD.isoDate(F('date').value)
    ? `${F('date').value}-${(HD.isoTime(F('time').value) || DEFAULTS.time).replace(':', '')}` : 'neu');
  const photoDir = (key) => `${PHOTO_DIR}${key}/`;
  /* Freier Name im Ordner: foto-1.webp, foto-2.webp … (auch gegenueber Fotos im Fenster) */
  async function freePhotoPath(key, ext, skip = []) {
    const taken = new Set([...photos.map((p) => p.path), ...skip]);
    for (let n = 1; ; n++) {
      const path = `${photoDir(key)}foto-${n}.${ext}`;
      if (!taken.has(path) && !(A.folder.state === 'ok' && await A.folder.exists(path))) return path;
    }
  }
  async function addPhotos(files) {
    for (const file of Array.from(files || [])) {
      if (!file.type.startsWith('image/')) {
        A.toast(`„${file.name}“ ist keine Bilddatei.`, 'err');
        continue;
      }
      try {
        /* Nur eine Fassung, und die klein: laengste Seite 1280 px, WebP mit maessiger Qualitaet */
        const conv = await A.toWebp(file, { maxSize: 1280, quality: 0.78 });
        let w = 0;
        let h = 0;
        try {
          const bmp = await createImageBitmap(conv.blob);
          w = bmp.width;
          h = bmp.height;
          if (bmp.close) bmp.close();
        } catch { /* Groesse unbekannt */ }
        /* Gleich in den Ordner dieses Hochamts schreiben (Name foto-1, foto-2 …) */
        const path = await freePhotoPath(formKey(), conv.ext);
        await A.saveFile(path, conv.blob);
        ++photoSeq;
        photos.push({ key: `n${photoSeq}`, path, url: URL.createObjectURL(conv.blob), ext: conv.ext, w, h, alt: '', credit: '', fresh: true });
        A.toast(A.folder.state === 'ok' ? `Foto gespeichert: ${path}` : `Foto bereit: ${path}. Bitte unten herunterladen.`);
      } catch {
        /* Meldung hat toWebp schon gezeigt */
      }
    }
    $('ha-photo-file').value = '';
    renderPhotos();
  }
  /* Fotos, die in diesem Fenster neu dazukamen und nicht uebernommen wurden, wieder loeschen */
  async function discardFresh(list) {
    for (const p of list) {
      if (p.url.startsWith('blob:')) URL.revokeObjectURL(p.url);
      if (p.fresh) await A.discardFile(p.path);
    }
  }
  function setPhotos(key) {
    for (const p of photos) if (p.url.startsWith('blob:')) URL.revokeObjectURL(p.url);
    photos = ((key && photoMap[key]) || []).map((b) => ({
      key: `p${++photoSeq}`, path: b.bild, url: A.imageUrl(b.bild), ext: 'webp',
      w: b.breite || 0, h: b.hoehe || 0, alt: b.alt || '', credit: A.credits.get(b.bild)
    }));
    renderPhotos();
  }
  const sameList = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);
  /* Speichert neue Dateien, Nachweise und die Liste dieses Termins; oldKey: bisherige Kennung (bei Verschiebung) */
  /* Fotos, die nicht im Ordner dieses Hochamts liegen (Datum geaendert), dorthin verschieben */
  async function moveToKeyFolder(key) {
    if (A.folder.state !== 'ok') return;
    const dir = photoDir(key);
    const creditChanges = {};
    for (const p of photos) {
      if (p.path.startsWith(dir) || !p.path.startsWith(PHOTO_DIR)) continue;
      try {
        const blob = await A.folder.readBlob(p.path);
        const target = await freePhotoPath(key, p.ext, photos.map((x) => x.path));
        await A.saveFile(target, blob);
        creditChanges[p.path] = '';
        creditChanges[target] = p.credit;
        await A.discardFile(p.path);
        p.path = target;
        p.url = A.imageUrl(target);
      } catch {
        /* bleibt im alten Ordner und funktioniert weiter */
      }
    }
    if (Object.keys(creditChanges).length) await A.credits.save(creditChanges);
  }
  async function savePhotos(oldKey, key) {
    await moveToKeyFolder(key);
    const list = photos.map((p) => ({ bild: p.path, alt: clean(p.alt), breite: p.w, hoehe: p.h }));
    const next = { ...photoMap };
    if (oldKey && oldKey !== key) delete next[oldKey];
    if (list.length) next[key] = list;
    else delete next[key];
    let changed = false;
    if (!sameList(photoMap[oldKey || key], list) || (oldKey && oldKey !== key) || Object.keys(next).length !== Object.keys(photoMap).length) {
      const sorted = Object.fromEntries(Object.keys(next).sort().map((k) => [k, next[k]]));
      await A.saveJSON(PHOTOS_PATH, { bilder: sorted });
      photoMap = sorted;
      changed = true;
    }
    await A.credits.save(Object.fromEntries(photos.map((p) => [p.path, p.credit])));
    for (const p of photos) p.fresh = false;   /* uebernommen: bleibt auch beim Schliessen */
    return changed;
  }

  /* ---------- Fenster: Bearbeiten ---------- */
  function updateDay() {
    const iso = F('date').value;
    const hint = $('f-date-day');
    if (!HD.isoDate(iso)) {
      hint.textContent = '';
      return;
    }
    const dt = HD.dateFromIso(iso);
    hint.textContent = HD.WEEKDAYS[dt.getDay()] + (iso < A.isoToday() ? ' · liegt in der Vergangenheit' : '');
  }

  function openEditor(entry, mode, title) {
    editIndex = mode === 'edit' ? entries.indexOf(entry) : -1;
    const form = $('ha-form');
    A.clearErrors(form);
    for (const k of SIMPLE) F(k).value = entry[k] || '';
    const split = splitEnd(entry.note);
    F('note').value = split.note;
    F('end').value = entry.end !== undefined ? entry.end : split.end;
    lastTime = F('time').value;
    F('extra').value = HD.list(entry.extra).join('\n');
    const solo = HD.list(entry.soloists).map(splitSoloist);
    soloists.set(solo.length ? solo : [{}]);
    const org = HD.list(entry.organist).map((name) => ({ name }));
    organists.set(org.length ? org : [{}]);
    updateDay();
    renderPoster();
    setPhotos(mode === 'edit' ? keyOf(entry) : '');
    $('ha-dlg-tag').textContent = mode === 'edit' ? 'Termin bearbeiten' : 'Neuer Termin';
    $('ha-dlg-title').textContent = title || (mode === 'edit' ? `${A.fmtDate(entry.date)}, ${entry.time} Uhr` : 'Neues Hochamt');
    $('ha-delete').hidden = mode !== 'edit';
    $('ha-view').hidden = mode !== 'edit';
    if (mode === 'edit') $('ha-view').href = `../pages/hochamt.html?id=${encodeURIComponent(keyOf(entry))}`;
    A.openDialog($('ha-dlg'), { isDirty: () => dirtyState() !== snap });
    snap = dirtyState();
  }

  /* Naechster Sonntag (ab heute), an dem um 11:00 noch nichts eingetragen ist */
  function nextFreeSunday() {
    const dt = HD.today();
    dt.setDate(dt.getDate() + ((7 - dt.getDay()) % 7));
    for (;;) {
      const date = A.isoOf(dt);
      if (!entries.some((x) => keyOf(x) === keyOf({ date, time: DEFAULTS.time }))) return date;
      dt.setDate(dt.getDate() + 7);
    }
  }
  const openNew = () => openEditor({ ...DEFAULTS, end: DEFAULT_END, date: nextFreeSunday() }, 'new');

  /* Beginn verschoben: Ende rueckt um gleich viel mit (Dauer bleibt) */
  let lastTime = '';
  function shiftEnd() {
    const now = HD.isoTime(F('time').value);
    const before = HD.isoTime(lastTime);
    const end = HD.isoTime(F('end').value);
    if (now && before && end) F('end').value = hhmm(minutes(end) + minutes(now) - minutes(before) + 24 * 60);
    if (now) lastTime = now;
  }

  /* Kopie eine Woche spaeter (bzw. die naechste freie Woche) */
  function copy(i) {
    const src = entries[i];
    const e = { ...src };
    const dt = HD.dateFromIso(src.date);
    do {
      dt.setDate(dt.getDate() + 7);
      e.date = A.isoOf(dt);
    } while (entries.some((x) => keyOf(x) === keyOf(e)));
    openEditor(e, 'copy', `Kopie von ${A.fmtShort(src.date)}`);
  }

  function readForm() {
    const e = {};
    for (const k of SIMPLE) e[k] = k === 'note' ? A.HD.cleanLines(F(k).value) : clean(F(k).value);
    e.time = HD.isoTime(e.time) || DEFAULTS.time;
    /* Ende wieder als "Ende ca. … Uhr." an den Hinweis haengen */
    const end = HD.isoTime(F('end').value);
    const note = splitEnd(e.note).note;
    e.note = end ? `${note}${note ? ' ' : ''}Ende ca. ${end} Uhr.` : note;
    e.extra = F('extra').value.split(/\n+/).map(cleanItem).filter(Boolean).join(' | ');
    e.soloists = soloists.values().filter((p) => p.name)
      .map((p) => joinSoloist({ name: cleanItem(p.name), voice: cleanItem(p.voice).replace(/[()]/g, '') })).join(' | ');
    e.organist = organists.values().map((p) => cleanItem(p.name)).filter(Boolean).join(' | ');
    return e;
  }

  /* Schreibt die Tabelle; im Fehlerfall bleibt die bisherige Liste */
  async function store(next) {
    next.sort(HD.byDateTime);
    const direct = await A.saveFile(PATH, HD.toCSV(next));
    entries = next;
    buildSuggestions();
    render();
    renderArchiveBanner();
    return direct;
  }
  const savedNote = (direct, what) => (direct ? `Gespeichert: ${what}` : `${what} übernommen. Bitte unten die Datei herunterladen.`);

  async function save(ev) {
    ev.preventDefault();
    const form = $('ha-form');
    const e = readForm();
    const errors = [];
    if (!HD.isoDate(e.date)) errors.push([F('date'), 'Bitte ein Datum wählen.']);
    if (!e.piece) errors.push([F('piece'), 'Bitte das Werk eintragen. Es erscheint als Titel.']);
    const end = HD.isoTime(F('end').value);
    if (end && minutes(end) <= minutes(e.time)) errors.push([F('end'), 'Das Ende muss nach dem Beginn liegen.']);
    const clash = e.date && entries.find((x, i) => i !== editIndex && keyOf(x) === keyOf(e));
    if (clash) {
      errors.push([F('time'), `Am ${A.fmtShort(e.date)} um ${e.time} Uhr gibt es schon einen Termin („${clash.piece || clash.type}“). Bitte eine andere Uhrzeit wählen.`]);
    }
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }

    const isNew = editIndex < 0;
    const oldKey = isNew ? '' : keyOf(entries[editIndex]);
    const next = entries.slice();
    if (isNew) next.push(e);
    else next[editIndex] = e;
    const btn = $('ha-save');
    btn.disabled = true;
    try {
      const direct = await store(next);
      /* Datum oder Uhrzeit geaendert: verknuepfte Meldungen ziehen mit */
      const moved = oldKey && oldKey !== keyOf(e) ? await relinkNews(oldKey, keyOf(e)) : 0;
      await savePhotos(oldKey, keyOf(e));
      $('ha-dlg').close();
      A.toast(savedNote(direct, `${A.fmtShort(e.date)} · ${e.piece}`) + (moved ? ' Die verknüpfte Meldung wurde mitgeändert.' : ''));
      A.log(`Hochamt ${A.fmtShort(e.date)} ${isNew ? 'angelegt' : 'geändert'}: ${e.piece}`);
      if (filter !== 'all' && isUpcoming(e) !== (filter === 'upcoming')) setFilter(isUpcoming(e) ? 'upcoming' : 'past');
      flash(keyOf(e));
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function remove(i) {
    const e = entries[i];
    const linked = linkedNews(keyOf(e));
    const ok = await A.confirmBox({
      title: 'Termin löschen?',
      html: `<strong>${esc(A.fmtDate(e.date))}, ${esc(e.time)} Uhr</strong><br>${esc(e.piece || e.type)}<br><br>Der Termin verschwindet von der Website.` +
        (linked.length ? `<br>Die Meldung „${esc(linked[0].Titel)}“ verliert ihre Verknüpfung zu diesem Termin, bleibt aber bestehen.` : ''),
      ok: 'Löschen', danger: true
    });
    if (!ok) return false;
    try {
      const direct = await store(entries.filter((x) => x !== e));
      await relinkNews(keyOf(e), '');
      if (photoMap[keyOf(e)]) {
        const rest = { ...photoMap };
        delete rest[keyOf(e)];
        await A.saveJSON(PHOTOS_PATH, { bilder: rest });
        photoMap = rest;
      }
      A.toast(direct ? `Gelöscht: ${A.fmtShort(e.date)} · ${e.piece || e.type}` : 'Gelöscht. Bitte unten die Datei herunterladen.');
      A.log(`Hochamt ${A.fmtShort(e.date)} gelöscht: ${e.piece || e.type}`);
      return true;
    } catch (err) {
      A.toast(`Löschen nicht möglich: ${err.message}`, 'err');
      return false;
    }
  }

  /* ---------- Jahreswechsel: Vorjahre ins Archiv ---------- */
  const oldEntries = () => entries.filter((e) => Number(e.date.slice(0, 4)) < new Date().getFullYear());

  function renderArchiveBanner() {
    const old = oldEntries();
    const host = $('ha-archive');
    if (!old.length) {
      host.innerHTML = '';
      return;
    }
    const years = [...new Set(old.map((e) => e.date.slice(0, 4)))].sort();
    host.innerHTML = '<div class="adm-banner" id="archiv">' +
      `<span class="adm-folder-ico">${icon('archive')}</span>` +
      `<div class="adm-banner-txt"><strong>Jahreswechsel: ${plural(old.length, 'Termin', 'Termine')} aus ${years.join(', ')} ins Archiv</strong>` +
      'Sie stehen noch in der laufenden Tabelle. Im Archiv bleiben sie im „Hochämter-Archiv“ sichtbar, die laufende Tabelle wird wieder übersichtlich.</div>' +
      `<button type="button" class="btn btn-dark" id="ha-archive-btn">${icon('archive')}Ins Archiv verschieben</button></div>`;
    $('ha-archive-btn').addEventListener('click', archiveOld);
  }

  async function archiveOld() {
    const old = oldEntries();
    if (!old.length) return;
    const byYear = new Map();
    for (const e of old) {
      const y = Number(e.date.slice(0, 4));
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y).push(e);
    }
    const ok = await A.confirmBox({
      title: 'Ins Archiv verschieben?',
      html: [...byYear].map(([y, l]) => `<strong>${plural(l.length, 'Termin', 'Termine')} aus ${y}</strong> nach <code>${ARCHIVE_DIR}hochaemter-${y}.csv</code>`).join('<br>') +
        '<br><br>Auf der Website bleibt alles sichtbar, im „Hochämter-Archiv“.',
      ok: 'Verschieben'
    });
    if (!ok) return;
    try {
      let years = [];
      try {
        years = (await A.readJSON(`${ARCHIVE_DIR}jahre.json`));
      } catch (e) {
        if (!notFound(e)) throw e;
      }
      years = years.map((j) => (typeof j === 'object' ? j : { jahr: Number(j), anzahl: 0 }));
      /* Je Jahr mit einer schon vorhandenen Archivdatei zusammenfuehren */
      for (const [y, list] of byYear) {
        const path = `${ARCHIVE_DIR}hochaemter-${y}.csv`;
        let existing = [];
        try {
          existing = parseTable(await A.readText(path));
        } catch (e) {
          if (!notFound(e)) throw e;
        }
        const merged = new Map(existing.map((e) => [keyOf(e), e]));
        for (const e of list) merged.set(keyOf(e), e);
        const rows = [...merged.values()].sort(HD.byDateTime);
        await A.saveFile(path, HD.toCSV(rows));
        years = years.filter((j) => Number(j.jahr) !== y);
        years.push({ jahr: y, anzahl: rows.length });
      }
      years.sort((a, b) => b.jahr - a.jahr);
      await A.saveFile(`${ARCHIVE_DIR}jahre.json`, `[${years.map((j) => `{"jahr": ${Number(j.jahr)}, "anzahl": ${Number(j.anzahl) || 0}}`).join(', ')}]`);
      const direct = await store(entries.filter((e) => !old.includes(e)));
      A.toast(direct ? `${plural(old.length, 'Termin', 'Termine')} ins Archiv verschoben.` : 'Verschoben. Bitte unten alle Dateien herunterladen.');
      A.log(`Jahreswechsel: ${plural(old.length, 'Hochamt', 'Hochämter')} ins Archiv verschoben`);
    } catch (e) {
      A.toast(`Verschieben nicht möglich: ${e.message}`, 'err');
    }
  }

  /* ---------- Excel ---------- */
  async function importFile(ev) {
    const file = ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    const list = parseTable(await file.text());
    if (!list.length) {
      A.toast('In der Datei wurden keine Termine gefunden. Ist es die richtige Tabelle?', 'err');
      return;
    }
    const ok = await A.confirmBox({
      title: 'Tabelle übernehmen?',
      html: `„${esc(file.name)}“ enthält <strong>${plural(list.length, 'Termin', 'Termine')}</strong>. Sie ersetzt die aktuelle Liste mit ${plural(entries.length, 'Termin', 'Terminen')}.`,
      ok: 'Übernehmen'
    });
    if (!ok) return;
    try {
      const direct = await store(list);
      A.toast(direct ? `Tabelle übernommen: ${plural(list.length, 'Termin', 'Termine')}.` : 'Übernommen. Bitte unten die Datei herunterladen.');
      A.log(`Hochämter aus Excel übernommen (${file.name})`);
    } catch (e) {
      A.toast(`Übernehmen nicht möglich: ${e.message}`, 'err');
    }
  }

  async function reload() {
    if (A.hasUnsaved() && !(await A.confirmBox({
      title: 'Neu laden?',
      text: 'Es gibt Änderungen, die noch nicht heruntergeladen wurden. Die Liste zeigt danach wieder den gespeicherten Stand.',
      ok: 'Neu laden'
    }))) return;
    await load();
    A.toast('Tabelle neu geladen.');
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    soloists = A.listEditor($('f-soloists'), {
      fields: [
        { key: 'name', label: 'Solist', placeholder: 'Name', list: 'dl-soloist' },
        { key: 'voice', label: 'Stimme', placeholder: 'Stimme', list: 'dl-voice' }
      ],
      addLabel: 'Solist hinzufügen', rowLabel: 'Solist'
    });
    organists = A.listEditor($('f-organist'), {
      fields: [{ key: 'name', label: 'Organist', placeholder: 'Name', list: 'dl-organist' }],
      addLabel: 'Weiteren Organisten hinzufügen', rowLabel: 'Organist'
    });
    /* Bekannter Name: Stimme ergaenzen, wenn das Feld noch leer ist */
    $('f-soloists').addEventListener('input', (ev) => {
      const inp = ev.target;
      if (inp.dataset.key !== 'name') return;
      const voice = inp.parentNode.querySelector('[data-key="voice"]');
      const known = knownVoices.get(inp.value.trim());
      if (known && !voice.value) voice.value = known;
    });
    F('date').setAttribute('aria-describedby', 'f-date-day');
    F('date').addEventListener('input', updateDay);
    F('time').addEventListener('change', shiftEnd);

    $('ha-new').addEventListener('click', openNew);
    $('ha-form').addEventListener('submit', save);
    $('ha-delete').addEventListener('click', async () => {
      if (editIndex >= 0 && await remove(editIndex)) $('ha-dlg').close();
    });
    $('ha-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      const i = Number(b.dataset.i);
      if (b.dataset.act === 'edit') openEditor(entries[i], 'edit');
      if (b.dataset.act === 'copy') copy(i);
      if (b.dataset.act === 'del') remove(i);
      if (b.dataset.act === 'new') openNew();
      if (b.dataset.act === 'clear') {
        $('ha-search').value = '';
        query = '';
        render();
        $('ha-search').focus();
      }
    });
    document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => setFilter(b.dataset.filter)));
    let timer = 0;
    $('ha-search').addEventListener('input', (ev) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        query = ev.target.value;
        render();
      }, 120);
    });
    $('ha-export').addEventListener('click', () => {
      HD.download(new Blob([HD.toCSV(entries)], { type: 'text/csv;charset=utf-8' }), 'hochaemter.csv');
    });
    $('ha-import-btn').addEventListener('click', () => $('ha-import').click());
    $('ha-import').addEventListener('change', importFile);
    $('ha-reload').addEventListener('click', reload);
    A.guard(() => $('ha-dlg').open && dirtyState() !== snap);
    $('ha-dlg').addEventListener('close', () => {
      discardFresh(photos.filter((p) => p.fresh));
      photos = [];
    });
    A.folder.on((state) => { if (state === 'ok') { load(); loadNews(); loadPhotos(); } });
    $('ha-photo-file').addEventListener('change', (ev) => addPhotos(ev.target.files));
    A.wireDrop($('ha-drop'), addPhotos);
    $('ha-photos').addEventListener('input', (ev) => {
      const k = ev.target.closest('.adm-ph');
      const p = k && photos.find((x) => x.key === k.dataset.k);
      if (p && ev.target.dataset.ph) p[ev.target.dataset.ph] = ev.target.value;
    });
    $('ha-photos').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-ph-act]');
      const k = b && b.closest('.adm-ph');
      if (!k) return;
      const i = photos.findIndex((x) => x.key === k.dataset.k);
      const act = b.dataset.phAct;
      if (act === 'del') {
        discardFresh([photos[i]]);
        photos.splice(i, 1);
      } else {
        const j = i + (act === 'up' ? -1 : 1);
        if (j < 0 || j >= photos.length) return;
        [photos[i], photos[j]] = [photos[j], photos[i]];
      }
      renderPhotos();
    });

    $('ha-poster').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-unlink-news]');
      if (b) unlinkNews(b.dataset.unlinkNews);
    });

    A.credits.load();
    await Promise.all([loadKnownVoices(), loadNews(), loadPhotos()]);
    await load();

    /* Direkt aus der Uebersicht: ?neu=1 oder ?bearbeiten=JJJJ-MM-TT-HHMM */
    const params = new URLSearchParams(location.search);
    const edit = params.get('bearbeiten');
    if (params.has('neu')) openNew();
    else if (edit) {
      const e = entries.find((x) => keyOf(x) === edit);
      if (e) openEditor(e, 'edit');
      else A.toast('Dieser Termin wurde nicht gefunden.', 'err');
    }
    if (params.has('neu') || edit) history.replaceState(null, '', location.pathname + location.hash);
    if (location.hash === '#archiv' && $('archiv')) $('archiv').scrollIntoView({ block: 'center' });
  });
})();
