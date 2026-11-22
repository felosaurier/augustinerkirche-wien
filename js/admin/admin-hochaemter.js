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
   - Fotos je Termin (Uebersicht data/hochamt-fotos/index.json, je Hochamt
     data/hochamt-fotos/<Kennung>.json, Bilder in assets/img/hochaemter/<Kennung>/):
     viele auf einmal hinzufuegen (mit Fortschritt), Beschreibung und Bildnachweis,
     Reihenfolge, entfernen; erscheinen auf der Seite des Termins als Fotogitter.
     Ein Foto wird gleich beim Hinzufuegen als WebP (Grossfassung und Vorschau) in den
     Ordner geschrieben; wird das Fenster ohne Speichern geschlossen, wird es wieder
     geloescht. Ein entferntes Foto verschwindet beim Speichern samt Vorschau und
     Nachweis; ein geloeschtes Hochamt nimmt alle seine Fotos mit. Aendert sich Datum
     oder Uhrzeit, ziehen die Fotos in den neuen Ordner um (mit verbundenem Projektordner).
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
  /* Fotos: Uebersicht und je Hochamt eine Detail-Datei (siehe unten "Fotos") */
  const PHOTO_INDEX = 'data/hochamt-fotos/index.json';
  const PHOTO_LEGACY = 'data/hochamt-fotos.json';
  const detailPath = (key) => `data/hochamt-fotos/${key}.json`;
  const PHOTO_DIR = 'assets/img/hochaemter/';
  const BIG = 1920;          /* Grossfassung: laengste Seite */
  const THUMB = 640;         /* Vorschau im Fotogitter: laengste Seite */
  let photoIndex = {};       /* Kennung -> {anzahl, titelbild} */
  let legacy = null;         /* alte Sammeldatei, solange sie nicht uebernommen ist */
  let photoBroken = false;   /* Lesefehler: dann nichts ueberschreiben */
  let photos = [];           /* {path, thumb, url, ext, w, h, alt, credit, key, fresh}; fresh = in diesem Fenster neu geschrieben */
  let savedList = [];        /* Stand der Liste beim Oeffnen bzw. letzten Speichern */
  let removed = [];          /* Dateien entfernter (schon gespeicherter) Fotos: werden beim Speichern geloescht */
  let photosLoading = false;
  let photosReady = Promise.resolve();
  let uploading = Promise.resolve();
  let photoChain = Promise.resolve();
  let dialogToken = 0;       /* zaehlt hoch, wenn das Fenster neu geoeffnet oder geschlossen wird */
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

  const nPhotosOf = (e) => ((photoIndex[keyOf(e)] || {}).anzahl || 0);
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
          (nPhotosOf(e) ? `<span class="adm-row-people adm-row-photos">${icon('image')}${nPhotosOf(e)} ${nPhotosOf(e) === 1 ? 'Foto' : 'Fotos'}</span>` : '') +
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

  /* ---------- Fotos ----------
     Geteilte Ablage (Aufbau siehe tools/hochamt-fotos-teilen.py):
       data/hochamt-fotos/index.json      {hochaemter: {Kennung: {anzahl, titelbild}}} fuer Listen
       data/hochamt-fotos/<Kennung>.json  {kennung, bilder: [{bild, vorschau, alt, breite, hoehe}]}
     Je Foto zwei Dateien: foto-N.webp (Grossfassung, laengste Seite 1920 px) und foto-N-v.webp
     (Vorschau, 640 px) im Ordner des Hochamts. Gibt es nur die alte Sammeldatei
     data/hochamt-fotos.json, wird sie beim ersten Speichern uebernommen und danach entfernt. */
  async function loadPhotos() {
    photoBroken = false;
    try {
      photoIndex = (await A.readJSON(PHOTO_INDEX)).hochaemter || {};
      legacy = null;
      return;
    } catch (e) {
      photoIndex = {};
      if (!notFound(e)) {
        photoBroken = true;
        A.toast('Die Übersicht der Hochamt-Fotos konnte nicht geladen werden. Fotos lassen sich erst nach dem Neuladen wieder speichern.', 'err');
        return;
      }
    }
    /* Noch die alte Sammeldatei? */
    try {
      legacy = (await A.readJSON(PHOTO_LEGACY)).bilder || {};
      photoIndex = Object.fromEntries(Object.entries(legacy).filter(([, l]) => Array.isArray(l) && l.length)
        .map(([k, l]) => [k, { anzahl: l.length, titelbild: l[0].vorschau || l[0].bild }]));
    } catch (e) {
      legacy = null;
      if (!notFound(e)) {
        photoBroken = true;
        A.toast('Die Fotos der Hochämter konnten nicht geladen werden.', 'err');
      }
    }
  }
  /* Fotos eines Hochamts (Detail-Datei erst beim Oeffnen) */
  async function loadDetail(key) {
    if (!key) return [];
    if (legacy) return (legacy[key] || []).slice();
    if (!photoIndex[key]) return [];
    try {
      return (await A.readJSON(detailPath(key))).bilder || [];
    } catch (e) {
      if (notFound(e)) return [];
      throw e;
    }
  }
  const dirtyState = () => A.snapshot($('ha-form')) + photos.map((p) => `${p.key}:${p.alt}:${p.credit}`).join(',');
  /* Gibt es zu diesem Termin ein Plakat (verknuepfte Meldung mit Bild)? Dann zeigt die Seite keine Fotos */
  function hasPoster() {
    const entry = editIndex >= 0 ? entries[editIndex] : null;
    return !!entry && linkedNews(keyOf(entry)).some((n) => n.Plakat || n.Vorschaubild);
  }
  function renderPhotos() {
    $('ha-photo-note').hidden = !hasPoster();
    $('ha-photos').innerHTML = photosLoading
      ? `<p class="adm-hint">${icon('image')} Fotos werden geladen …</p>`
      : photos.map((p, i) =>
        `<div class="adm-ph" data-k="${p.key}">` +
          `<span class="adm-thumb photo"><img src="${esc(p.url)}" alt="" loading="lazy" decoding="async"/></span>` +
          '<div class="adm-ph-fields">' +
            `<label class="adm-label" for="ph-alt-${p.key}">Beschreibung <span class="adm-opt">steht unter dem Foto</span></label>` +
            `<input class="adm-input" type="text" id="ph-alt-${p.key}" data-ph="alt" value="${esc(p.alt)}" maxlength="200" placeholder="z. B. Chor und Orchester beim Gloria"/>` +
            `<label class="adm-label" for="ph-cr-${p.key}">Bildnachweis</label>` +
            `<input class="adm-input" type="text" id="ph-cr-${p.key}" data-ph="credit" value="${esc(p.credit)}" maxlength="200" placeholder="z. B. © Augustiner Wien, Foto: Max Muster"/>` +
          '</div>' +
          '<div class="adm-ph-act">' +
            `<span class="adm-ph-no" aria-hidden="true">${i + 1}</span>` +
            `<button type="button" class="adm-act icon" data-ph-act="up" aria-label="Foto ${i + 1} nach vorne"${i === 0 ? ' disabled' : ''}>${icon('up')}</button>` +
            `<button type="button" class="adm-act icon" data-ph-act="down" aria-label="Foto ${i + 1} nach hinten"${i === photos.length - 1 ? ' disabled' : ''}>${icon('down')}</button>` +
            `<button type="button" class="adm-act icon danger" data-ph-act="del" aria-label="Foto ${i + 1} entfernen">${icon('trash')}</button>` +
          '</div></div>'
      ).join('');
    const all = $('ha-photos-all');
    if (all) all.hidden = photosLoading || photos.length < 2;
  }
  /* Kennung nach dem Stand des Formulars; fehlt das Datum noch, ein Ordner "neu" */
  const formKey = () => (HD.isoDate(F('date').value)
    ? `${F('date').value}-${(HD.isoTime(F('time').value) || DEFAULTS.time).replace(':', '')}` : 'neu');
  const photoDir = (key) => `${PHOTO_DIR}${key}/`;
  const thumbOf = (path) => path.replace(/\.(webp|jpe?g|png)$/i, '-v.webp');
  /* Freier Name im Ordner: foto-1.webp, foto-2.webp … (auch gegenueber Fotos im Fenster und
     entfernten Fotos, deren Dateien erst beim Speichern geloescht werden) */
  async function freePhotoPath(key, ext, skip = []) {
    const taken = new Set([...photos.map((p) => p.path), ...removed, ...skip]);
    for (let n = 1; ; n++) {
      const path = `${photoDir(key)}foto-${n}.${ext}`;
      if (!taken.has(path) && !(A.folder.state === 'ok' && await A.folder.exists(path))) return path;
    }
  }
  /* Vorschau (laengste Seite 640 px) aus einem Bild; null, wenn der Browser kein WebP erzeugen kann */
  async function makeThumb(blob) {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, THUMB / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * scale));
    c.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const size = { w: bmp.width, h: bmp.height };
    if (bmp.close) bmp.close();
    const out = await new Promise((r) => c.toBlob(r, 'image/webp', 0.76));
    return { thumb: out && out.type === 'image/webp' ? out : null, ...size };
  }
  /* Fortschritt beim Hochladen mehrerer Fotos */
  function progress(done, total, name) {
    const box = $('ha-ph-progress');
    if (!box) return;
    box.hidden = total === 0;
    if (!total) return;
    box.querySelector('.adm-progress-text').textContent = done < total
      ? `Foto ${done + 1} von ${total} wird verarbeitet: ${name}`
      : `${total} ${total === 1 ? 'Foto' : 'Fotos'} verarbeitet`;
    box.querySelector('progress').value = done;
    box.querySelector('progress').max = total;
  }
  /* Mehrere Fotos nacheinander verarbeiten (so friert der Browser auch bei 30 Fotos nicht ein):
     je Foto Grossfassung und Vorschau als WebP in den Ordner des Hochamts schreiben.
     Defekte Dateien werden uebersprungen und am Ende genannt. */
  function addPhotos(files) {
    const list = Array.from(files || []);
    $('ha-photo-file').value = '';
    if (!list.length) return uploading;
    uploading = uploading.then(() => runUpload(list));
    return uploading;
  }
  async function runUpload(list) {
    const token = dialogToken;
    const failed = [];
    let added = 0;
    $('ha-save').disabled = true;
    try {
      await photosReady;
      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        if (token !== dialogToken) return;   /* Fenster inzwischen geschlossen */
        progress(i, list.length, file.name);
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
        if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|gif|heic|avif)$/i.test(file.name)) {
          failed.push(`${file.name} (keine Bilddatei)`);
          continue;
        }
        const written = [];
        try {
          const big = await A.toWebp(file, { maxSize: BIG, quality: 0.82, silent: true });
          const { thumb, w, h } = await makeThumb(big.blob);
          const key = formKey();
          const path = await freePhotoPath(key, big.ext);
          await A.saveFile(path, big.blob);
          written.push(path);
          let vorschau = '';
          if (thumb && thumb.size < big.blob.size) {
            vorschau = thumbOf(path);
            await A.saveFile(vorschau, thumb);
            written.push(vorschau);
          }
          if (token !== dialogToken) {
            for (const p of written) await A.discardFile(p);
            return;
          }
          ++photoSeq;
          photos.push({ key: `n${photoSeq}`, path, thumb: vorschau, url: URL.createObjectURL(thumb || big.blob), ext: big.ext, w, h, alt: '', credit: '', fresh: true });
          added++;
          renderPhotos();
        } catch (e) {
          for (const p of written) await A.discardFile(p).catch(() => {});
          failed.push(`${file.name}${e && e.message ? ` (${e.message === 'Bildformat nicht unterstützt' ? 'Format nicht lesbar' : e.message})` : ''}`);
        }
      }
      progress(list.length, list.length, '');
    } finally {
      if (token === dialogToken) $('ha-save').disabled = false;
      setTimeout(() => progress(0, 0, ''), 2500);
    }
    if (added) A.toast(A.folder.state === 'ok' ? `${added} ${added === 1 ? 'Foto' : 'Fotos'} hinzugefügt. Zum Übernehmen bitte speichern.` : `${added} ${added === 1 ? 'Foto' : 'Fotos'} bereit. Nach dem Speichern bitte unten herunterladen.`);
    if (failed.length) A.toast(`${failed.length} ${failed.length === 1 ? 'Datei ließ' : 'Dateien ließen'} sich nicht verarbeiten: ${failed.slice(0, 4).join(', ')}${failed.length > 4 ? ' …' : ''}`, 'err');
  }
  /* Fotos, die in diesem Fenster neu dazukamen und nicht uebernommen wurden, wieder loeschen */
  async function discardFresh(list) {
    for (const p of list) {
      if (p.url.startsWith('blob:')) URL.revokeObjectURL(p.url);
      if (!p.fresh) continue;
      await A.discardFile(p.path);
      if (p.thumb) await A.discardFile(p.thumb);
    }
  }
  function setPhotos(key) {
    for (const p of photos) if (p.url.startsWith('blob:')) URL.revokeObjectURL(p.url);
    photos = [];
    removed = [];
    savedList = [];
    photosLoading = !!key && !!(legacy ? legacy[key] : photoIndex[key]);
    const token = ++dialogToken;
    renderPhotos();
    photosReady = (async () => {
      let list = [];
      try {
        list = await loadDetail(key);
      } catch (e) {
        photoBroken = true;
        A.toast(`Die Fotos dieses Hochamts konnten nicht geladen werden (${e.message}). Bitte die Seite neu laden.`, 'err');
      }
      if (token !== dialogToken) return;
      const untouched = dirtyState() === snap;
      photos = list.filter((b) => b && b.bild).map((b) => ({
        key: `p${++photoSeq}`, path: b.bild, thumb: b.vorschau || '', url: A.imageUrl(b.vorschau || b.bild), ext: 'webp',
        w: b.breite || 0, h: b.hoehe || 0, alt: b.alt || '', credit: b.nachweis !== undefined ? b.nachweis : A.credits.get(b.bild)
      }));
      savedList = listOf(photos);
      photosLoading = false;
      renderPhotos();
      /* Abschnitt "Fotos" aufklappen und seine Angabe ("n ausgefuellt") nachziehen */
      const fold = $('ha-photos').closest('details');
      if (fold && photos.length) fold.open = true;
      $('ha-photos').dispatchEvent(new Event('change', { bubbles: true }));
      /* Laden ist keine Aenderung */
      if (untouched) snap = dirtyState();
    })();
    return photosReady;
  }
  /* Bildnachweis steht beim Foto (nachweis), nicht mehr in data/bildnachweise.json */
  const listOf = (arr) => arr.map((p) => ({ bild: p.path, ...(p.thumb ? { vorschau: p.thumb } : {}), alt: clean(p.alt), ...(clean(p.credit) ? { nachweis: clean(p.credit) } : {}), breite: p.w, hoehe: p.h }));
  const sameList = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);
  /* Fotos, die nicht im Ordner dieses Hochamts liegen (Datum geaendert), samt Vorschau dorthin verschieben */
  async function moveToKeyFolder(key) {
    if (A.folder.state !== 'ok') return;
    const dir = photoDir(key);
    const oldDirs = new Set();
    for (const p of photos) {
      if (p.path.startsWith(dir) || !p.path.startsWith(PHOTO_DIR)) continue;
      try {
        const target = await freePhotoPath(key, p.ext, photos.map((x) => x.path));
        await A.saveFile(target, await A.folder.readBlob(p.path));
        let thumb = '';
        if (p.thumb) {
          try {
            thumb = thumbOf(target);
            await A.saveFile(thumb, await A.folder.readBlob(p.thumb));
            await A.discardFile(p.thumb);
          } catch {
            thumb = '';
          }
        }
        oldDirs.add(A.dirName(p.path));
        await A.discardFile(p.path);
        p.path = target;
        p.thumb = thumb;
        p.url = A.imageUrl(thumb || target);
      } catch {
        /* bleibt im alten Ordner und funktioniert weiter */
      }
    }
    return [...oldDirs];
  }
  /* Uebersicht schreiben (sortiert) */
  async function writeIndex(next) {
    const sorted = Object.fromEntries(Object.keys(next).sort().map((k) => [k, next[k]]));
    await A.saveJSON(PHOTO_INDEX, { hochaemter: sorted });
    photoIndex = sorted;
  }
  const indexEntry = (list) => ({ anzahl: list.length, titelbild: list[0].vorschau || list[0].bild });
  /* Alte Sammeldatei in die geteilte Ablage uebernehmen: je Hochamt eine Datei, dann die Uebersicht,
     erst danach die alte Datei entfernen. Vorschaubilder entstehen spaeter beim Bearbeiten
     (oder mit tools/hochamt-fotos-teilen.py); bis dahin zeigt die Seite die Grossfassung. */
  async function migrateLegacy() {
    if (!legacy) return;
    const next = {};
    for (const [k, list] of Object.entries(legacy)) {
      if (!/^\d{4}-\d{2}-\d{2}-\d{4}$/.test(k) || !Array.isArray(list) || !list.length) continue;
      const valid = list.filter((b) => b && b.bild);
      if (!valid.length) continue;
      await A.saveJSON(detailPath(k), { kennung: k, bilder: valid });
      next[k] = indexEntry(valid);
    }
    await writeIndex(next);
    await A.discardFile(PHOTO_LEGACY);
    legacy = null;
    A.log('Fotos der Hochämter in die geteilte Ablage übernommen (data/hochamt-fotos/)');
  }
  /* Alle Dateien eines Hochamts loeschen: Fotos, Vorschauen, Nachweise, Detail-Datei, Eintrag in der Uebersicht */
  async function deleteAllPhotos(key) {
    const list = await loadDetail(key);
    if (legacy) {
      delete legacy[key];
      await migrateLegacy();
    } else {
      await A.discardFile(detailPath(key));
      if (photoIndex[key]) {
        const next = { ...photoIndex };
        delete next[key];
        await writeIndex(next);
      }
    }
    /* erst wenn die Daten weg sind: Dateien, Vorschauen, Nachweise und den Ordner des Hochamts loeschen */
    await A.media.remove(list.map((b) => b && b.bild).filter(Boolean), { ownDirs: [photoDir(key)] });
    return list.length;
  }
  /* Speichert Liste, Uebersicht und Nachweise dieses Termins und loescht entfernte Fotos;
     oldKey: bisherige Kennung (bei Verschiebung). Alles laeuft in einer Kette, damit zwei
     Speichervorgaenge die Uebersicht nicht gegenseitig ueberschreiben. */
  function savePhotos(oldKey, key) {
    photoChain = photoChain.catch(() => {}).then(() => savePhotosNow(oldKey, key));
    return photoChain;
  }
  async function savePhotosNow(oldKey, key) {
    await photosReady;
    await uploading;
    if (photoBroken) throw new Error('Die Fotos ließen sich vorher nicht laden, deshalb wurden sie nicht gespeichert. Bitte die Seite neu laden.');
    await migrateLegacy();
    const leftDirs = await moveToKeyFolder(key);
    const list = listOf(photos);
    const moved = !!oldKey && oldKey !== key;
    let changed = false;
    if (!sameList(savedList, list) || moved || removed.length) {
      if (list.length) await A.saveJSON(detailPath(key), { kennung: key, bilder: list });
      else if (photoIndex[key]) await A.discardFile(detailPath(key));
      if (moved && photoIndex[oldKey]) await A.discardFile(detailPath(oldKey));
      const next = { ...photoIndex };
      if (moved) delete next[oldKey];
      if (list.length) next[key] = indexEntry(list);
      else delete next[key];
      if (JSON.stringify(next) !== JSON.stringify(photoIndex)) await writeIndex(next);
      changed = true;
    }
    /* Entfernte Fotos jetzt wirklich loeschen (samt Vorschau, Nachweis, leerem Ordner); der alte
       Ordner nach einer Verschiebung verschwindet ebenfalls. Nachweise alter Art (data/bildnachweise.json)
       der Fotos dieses Hochamts werden dort entfernt, sie stehen jetzt beim Foto. */
    const gone = removed.filter((x) => !/-v\.webp$/.test(x));
    removed = [];
    const dirs = [...leftDirs, ...(list.length || !savedList.length ? [] : [photoDir(key)])];
    if (gone.length || dirs.length) await A.media.remove(gone, { ownDirs: dirs });
    const old = Object.fromEntries(photos.filter((p) => A.credits.get(p.path)).map((p) => [p.path, '']));
    if (Object.keys(old).length) await A.credits.save(old);
    for (const p of photos) p.fresh = false;   /* uebernommen: bleibt auch beim Schliessen */
    savedList = list;
    return changed;
  }
  /* Alle Fotos des Fensters auf einmal entfernen (nach Rueckfrage) */
  async function removeAllPhotos() {
    if (!photos.length) return;
    const ok = await A.confirmBox({
      title: 'Alle Fotos entfernen?',
      html: `Alle ${photos.length} Fotos dieses Termins werden beim Speichern gelöscht, samt Vorschaubildern und Bildnachweisen.`,
      ok: 'Alle entfernen', danger: true
    });
    if (!ok) return;
    const fresh = photos.filter((p) => p.fresh);
    for (const p of photos) if (!p.fresh) removed.push(p.path, ...(p.thumb ? [p.thumb] : []));
    await discardFresh(fresh);
    photos = [];
    renderPhotos();
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
    if (nextDayHint) nextDayHint();
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
  let nextDayHint = null;
  function shiftEnd() {
    const now = HD.isoTime(F('time').value);
    const before = HD.isoTime(lastTime);
    const end = HD.isoTime(F('end').value);
    if (now && before && end) F('end').value = hhmm(minutes(end) + minutes(now) - minutes(before) + 24 * 60);
    if (now) lastTime = now;
    if (nextDayHint) nextDayHint();
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

  /* ---------- Lebensdaten der Komponisten im Programm ----------
     Steht in "Weitere Musik" ein Komponist ohne Lebensdaten, ergaenzt die Verwaltung sie, und zwar wie
     ueblich nur beim ersten Stueck dieses Komponisten im Programm. Quelle ist zuerst die Liste der
     Komponisten (data/komponisten.json, gepflegt unter Kirchenmusik → Repertoire & Komponisten; andere Schreibweisen
     werden dort zum Namen der Liste), dann die bisherigen Hochaemter (Tabelle und Archiv) fuer alle,
     die noch nicht in der Liste stehen. Kurzformen ("Mozart", "W. A. Mozart") werden zum vollen Namen,
     wenn er eindeutig ist (oder mind. 90 % der Eintraege mit diesem Nachnamen ausmacht). */
  const PIECE = /^([^:(„"]+?)\s*(?:\(([^)]*)\))?\s*:\s*(.+)$/;
  const KOMPONISTEN = 'data/komponisten.json';
  const nk = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const nameTokens = (s) => nk(String(s).replace(/\./g, '. ')).split(' ').map((t) => t.replace(/\.$/, '')).filter(Boolean);
  /* "1756-1791; 225. Todestag" -> "1756-1791", "geb. 1944" / "*1944" -> "∗1944"; sonst '' */
  function nurJahre(y) {
    const s = String(y || '').split(/[;·,]/)[0].trim().replace(/^(?:geb\.\s*|\*|Ú)\s*/i, '∗').replace(/\s*[–-]\s*/g, '-');
    return /^(?:~?\d{3,4}-~?\d{3,4}|∗\d{4})$/.test(s) ? s : '';
  }
  let archivMusik = null;      /* "Weitere Musik" aller Archivjahre, sobald geladen */
  let komponistenListe = [];
  let quellenLaufen = null;
  function archivLaden() {
    if (!quellenLaufen) {
      quellenLaufen = (async () => {
        try {
          const d = await A.readJSON(KOMPONISTEN);
          komponistenListe = Array.isArray(d && d.komponisten) ? d.komponisten : [];
        } catch { /* ohne Liste nur aus den Hochaemtern */ }
        let jahre = [];
        try { jahre = await A.readJSON(`${ARCHIVE_DIR}jahre.json`); } catch { /* noch kein Archiv */ }
        const listen = await Promise.all((Array.isArray(jahre) ? jahre : []).map(async (j) => {
          const y = Number(typeof j === 'object' ? j.jahr : j);
          try { return parseTable(await A.readText(`${ARCHIVE_DIR}hochaemter-${y}.csv`)).map((e) => e.extra); } catch { return []; }
        }));
        archivMusik = listen.flat();
        return archivMusik;
      })();
    }
    return quellenLaufen;
  }
  /* Verzeichnis: Schreibweise (klein) -> Eintrag { name, jahre, n, formen, liste } */
  function verzeichnis(extra) {
    const map = new Map();
    for (const k of komponistenListe) {
      const jahre = nurJahre(k && k.jahre);
      const name = String((k && k.name) || '').replace(/\s+/g, ' ').trim();
      if (!jahre || !name) continue;
      const formen = [name, ...(Array.isArray(k.auch) ? k.auch : [])].map((x) => String(x).replace(/\s+/g, ' ').trim()).filter(Boolean);
      const e = { name, jahre, n: 1, formen, liste: true };
      for (const f of formen) if (!map.has(nk(f))) map.set(nk(f), e);
    }
    const roh = new Map();
    for (const feld of [...(archivMusik || []), ...entries.map((e) => e.extra), extra]) {
      for (const item of HD.list(feld)) {
        const m = PIECE.exec(item);
        if (!m) continue;
        const name = m[1].replace(/\s+/g, ' ').trim();
        const k = nk(name);
        if (map.has(k)) {
          map.get(k).n++;
          continue;
        }
        const j = m[2] !== undefined ? nurJahre(m[2]) : '';
        if (!j) continue;
        if (!roh.has(k)) roh.set(k, { namen: new Map(), jahre: new Map(), n: 0 });
        const r = roh.get(k);
        r.namen.set(name, (r.namen.get(name) || 0) + 1);
        r.jahre.set(j, (r.jahre.get(j) || 0) + 1);
        r.n++;
      }
    }
    const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
    for (const [k, r] of roh) {
      const name = top(r.namen);
      map.set(k, { name, jahre: top(r.jahre), n: r.n, formen: [name], liste: false });
    }
    return map;
  }
  function komponist(v, getippt) {
    const exakt = v.get(nk(getippt));
    if (exakt) return exakt;
    const t = nameTokens(getippt);
    const sur = t[t.length - 1];
    if (!sur || sur.length < 3) return null;
    const vorn = t.slice(0, -1);
    const passt = (form) => {
      const ct = nameTokens(form);
      const idx = ct.lastIndexOf(sur);
      if (idx < 0) return false;
      const vor = ct.slice(0, idx);
      let i = 0;
      return vorn.every((g) => {
        while (i < vor.length && !vor[i].startsWith(g)) i++;
        return i++ < vor.length;
      });
    };
    const treffer = [...new Set(v.values())].filter((c) => c.formen.some(passt));
    if (!treffer.length) return null;
    /* Nach Lebensdaten zusammenfassen (Kurz- und Langform derselben Person) */
    const gruppen = new Map();
    for (const c of treffer) gruppen.set(c.jahre, [...(gruppen.get(c.jahre) || []), c]);
    const summe = (cs) => cs.reduce((x, c) => x + c.n, 0);
    const [jahre, cs] = [...gruppen.entries()].sort((x, y) => summe(y[1]) - summe(x[1]))[0];
    if (summe(cs) < 0.9 * summe(treffer)) return null;
    /* Als Name: aus der Liste, ausgeschrieben (ohne Abkuerzungspunkte), sonst der haeufigste */
    const name = [...cs].sort((x, y) => (y.liste - x.liste) || (x.name.includes('.') - y.name.includes('.')) || (y.n - x.n))[0].name;
    return { name, jahre };
  }
  /* Ergaenzt die Zeilen; liefert den neuen Text und was ergaenzt wurde */
  function lebensdaten(text) {
    const v = verzeichnis(String(text).split('\n').join(' | '));
    const gesehen = new Set();
    const ergaenzt = [];
    const zeilen = String(text).split('\n').map((zeile) => {
      const m = PIECE.exec(zeile.trim());
      if (!m) return zeile;
      const getippt = m[1].replace(/\s+/g, ' ').trim();
      const hit = komponist(v, getippt);
      const name = hit ? hit.name : getippt;
      /* Dieselbe Person auch in anderer Schreibweise (Amadeus/Amadé) zaehlt nur einmal */
      const person = hit ? `${hit.jahre}|${nameTokens(hit.name).pop()}` : nk(name);
      const erstes = !gesehen.has(person);
      gesehen.add(person);
      if (!hit || m[2] !== undefined) return zeile;
      if (!erstes) return name === getippt ? zeile : `${name}: ${m[3]}`;
      ergaenzt.push(`${name} (${hit.jahre})`);
      return `${name} (${hit.jahre}): ${m[3]}`;
    });
    return { text: zeilen.join('\n'), ergaenzt };
  }

  function readForm() {
    const e = {};
    for (const k of SIMPLE) e[k] = k === 'note' ? A.HD.cleanLines(F(k).value) : clean(F(k).value);
    e.time = HD.isoTime(e.time) || DEFAULTS.time;
    /* Ende wieder als "Ende ca. … Uhr." an den Hinweis haengen */
    const end = HD.isoTime(F('end').value);
    const note = splitEnd(e.note).note;
    e.note = end ? `${note}${note ? ' ' : ''}Ende ca. ${end} Uhr.` : note;
    /* Lebensdaten auch dann, wenn direkt aus dem Feld heraus gespeichert wird */
    const extra = archivMusik ? lebensdaten(F('extra').value).text : F('extra').value;
    e.extra = extra.split(/\n+/).map(cleanItem).filter(Boolean).join(' | ');
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
    const endErr = A.endCheck(HD.isoTime(e.time), end);
    if (endErr) errors.push([F('end'), endErr]);
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
      render();
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
    const nPhotos = ((legacy ? (legacy[keyOf(e)] || []).length : (photoIndex[keyOf(e)] || {}).anzahl) || 0);
    const ok = await A.confirmBox({
      title: 'Termin löschen?',
      html: `<strong>${esc(A.fmtDate(e.date))}, ${esc(e.time)} Uhr</strong><br>${esc(e.piece || e.type)}<br><br>Der Termin verschwindet von der Website.` +
        (linked.length ? `<br>Die Meldung „${esc(linked[0].Titel)}“ verliert ihre Verknüpfung zu diesem Termin, bleibt aber bestehen.` : '') +
        (nPhotos ? `<br>Die ${nPhotos === 1 ? 'zugehörige Fotodatei wird' : `${nPhotos} zugehörigen Fotos werden`} ebenfalls gelöscht (samt Vorschaubildern und Bildnachweisen).` : ''),
      ok: 'Löschen', danger: true
    });
    if (!ok) return false;
    if (photoBroken && nPhotos) {
      A.toast('Die Fotos ließen sich vorher nicht laden. Bitte die Seite neu laden und noch einmal löschen.', 'err');
      return false;
    }
    try {
      const direct = await store(entries.filter((x) => x !== e));
      await relinkNews(keyOf(e), '');
      if (nPhotos) {
        photoChain = photoChain.catch(() => {}).then(() => deleteAllPhotos(keyOf(e)));
        await photoChain;
        render();
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
    /* Lebensdaten der Komponisten ergaenzen, sobald das Feld verlassen wird */
    F('extra').addEventListener('change', async () => {
      await archivLaden();
      const r = lebensdaten(F('extra').value);
      if (r.text === F('extra').value) return;
      F('extra').value = r.text;
      F('extra').dispatchEvent(new Event('input', { bubbles: true }));
      if (r.ergaenzt.length) A.toast(`Lebensdaten ergänzt: ${r.ergaenzt.join(', ')}`);
    });
    archivLaden();
    nextDayHint = A.wireNextDay(F('time'), F('end'), $('f-end-next'));

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
      dialogToken++;   /* laufendes Hochladen bricht ab und raeumt seine Dateien weg */
      discardFresh(photos.filter((p) => p.fresh));
      photos = [];
      removed = [];
      $('ha-save').disabled = false;
    });
    A.folder.on((state) => { if (state === 'ok') { load(); loadNews(); loadPhotos(); } });
    $('ha-photo-file').addEventListener('change', (ev) => addPhotos(ev.target.files));
    A.wireDrop($('ha-drop'), addPhotos);
    $('ha-photos-all')?.addEventListener('click', removeAllPhotos);
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
      if (i < 0) return;
      const act = b.dataset.phAct;
      const p = photos[i];
      if (act === 'del') {
        /* Neu hinzugefuegt: gleich weg; schon gespeichert: beim Speichern loeschen */
        if (p.fresh) discardFresh([p]);
        else removed.push(p.path, ...(p.thumb ? [p.thumb] : []));
        photos.splice(i, 1);
      } else {
        const j = i + (act === 'up' ? -1 : 1);
        if (j < 0 || j >= photos.length) return;
        [photos[i], photos[j]] = [photos[j], photos[i]];
      }
      renderPhotos();
      /* Fokus bleibt beim verschobenen Foto (Tastatur), nach dem Entfernen beim naechsten */
      const row = act === 'del' ? $('ha-photos').children[Math.min(i, photos.length - 1)] : $('ha-photos').querySelector(`[data-k="${p.key}"]`);
      const target = row && (row.querySelector(`[data-ph-act="${act}"]:not([disabled])`) || row.querySelector('[data-ph-act]:not([disabled])'));
      if (target) target.focus();
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
