/* ============================================================
   Augustinerkirche Wien — admin-galerie.js
   Galerie der Kirchenmusik pflegen (admin/galerie.html), Quelle ist
   data/galerie.json: {alben: [{titel, datum, text, fotos: [{bild, alt,
   breite, hoehe}], videos: [{titel, url}], audio: [{titel, datei}]}]}.
   Erscheint auf musik.html → Galerie (js/inhalte.js).
   - Anlegen, Bearbeiten, Verschieben, Löschen
   - Fotos als WebP nach assets/img/galerie/<album>/, mit Beschreibung
     und Bildnachweis; geschrieben wird erst beim Speichern
   - Videos: Adressen von YouTube
   - Aufnahmen: MP3-Dateien nach assets/audio/galerie/
   Fehlt die Datei noch, beginnt die Liste leer; das erste Speichern legt sie an.
   Benoetigt js/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { HD, $, esc, icon } = A;
  const PATH = 'data/galerie.json';
  const IMG_DIR = 'assets/img/galerie/';
  const AUDIO_DIR = 'assets/audio/galerie/';
  const MAX_PHOTOS = 60;
  const MAX_AUDIO_MB = 30;

  let alben = [];
  let query = '';
  let edit = -1;          /* Index des Albums, -1 = neu */
  let photos = [];        /* {key, path, blob, ext, url, w, h, alt, credit}; ohne path = neu gewaehlt */
  let photoSeq = 0;
  const audio = new Map(); /* pfad -> File, neu gewaehlte Aufnahmen */
  let videos = null;      /* Listen-Eingabe der Videos */
  let tracks = null;      /* Listen-Eingabe der Aufnahmen */
  let snap = '';

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const notFound = (e) => !!e && (e.status === 404 || e.name === 'NotFoundError');
  /* YouTube-Adresse -> Kennung (gleiche Regel wie js/inhalte.js) */
  function youtubeId(u) {
    const m = String(u || '').trim().match(/^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})(?:[?&#/].*)?$/i);
    return m ? m[1] : '';
  }

  /* ---------- Laden und Liste ---------- */
  async function load() {
    try {
      const d = await A.readJSON(PATH);
      if (!d || !Array.isArray(d.alben)) throw new Error('unerwarteter Inhalt');
      alben = d.alben.filter((a) => a && typeof a === 'object');
    } catch (e) {
      if (!notFound(e)) {
        $('ga-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Datei <code>${PATH}</code> konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
        return;
      }
      alben = [];
    }
    render();
  }

  function rowHTML(a, i, searching) {
    const fotos = a.fotos || [];
    const src = fotos[0] && A.imageUrl(fotos[0].bild);
    const parts = [
      a.datum ? A.fmtShort(a.datum) : '',
      plural(fotos.length, 'Foto', 'Fotos'),
      (a.videos || []).length ? plural(a.videos.length, 'Video', 'Videos') : '',
      (a.audio || []).length ? plural(a.audio.length, 'Aufnahme', 'Aufnahmen') : ''
    ].filter(Boolean);
    const move = searching ? '' :
      `<button type="button" class="adm-act icon" data-act="up" data-i="${i}" aria-label="Nach oben: ${esc(a.titel)}" title="Nach oben"${i === 0 ? ' disabled' : ''}>${icon('up')}</button>` +
      `<button type="button" class="adm-act icon" data-act="down" data-i="${i}" aria-label="Nach unten: ${esc(a.titel)}" title="Nach unten"${i === alben.length - 1 ? ' disabled' : ''}>${icon('down')}</button>`;
    return `<li class="adm-row" data-key="${i}">` +
      `<button type="button" class="adm-row-open has-thumb" data-act="edit" data-i="${i}">` +
        (src ? `<span class="adm-thumb photo"><img src="${esc(src)}" alt="" loading="lazy" decoding="async"/></span>`
          : '<span class="adm-thumb none"><img src="../assets/logo-gold.png" alt=""/></span>') +
        '<span class="adm-row-body">' +
          `<span class="adm-row-title">${esc(a.titel)}</span>` +
          `<span class="adm-row-meta">${esc(parts.join(' · '))}</span>` +
          (a.text ? `<span class="adm-row-people">${esc(HD.plainText(a.text))}</span>` : '') +
        '</span></button>' +
      `<div class="adm-row-actions">${move}` +
        `<button type="button" class="adm-act icon danger" data-act="del" data-i="${i}" aria-label="Löschen: ${esc(a.titel)}" title="Löschen">${icon('trash')}</button>` +
      '</div></li>';
  }

  function render() {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = alben.map((a, i) => ({ a, i }))
      .filter(({ a }) => words.every((w) => `${a.titel} ${a.text} ${a.datum}`.toLowerCase().includes(w)));
    $('ga-count').textContent = words.length ? `${plural(list.length, 'Treffer', 'Treffer')} für „${query.trim()}“` : plural(alben.length, 'Album', 'Alben');
    $('ga-list').innerHTML = list.length
      ? `<ul class="adm-rows">${list.map(({ a, i }) => rowHTML(a, i, words.length > 0)).join('')}</ul>`
      : words.length
        ? '<div class="adm-empty"><p class="adm-empty-title">Keine Treffer</p><button type="button" class="btn btn-quiet" data-act="clear">Suche zurücksetzen</button></div>'
        : `<div class="adm-empty"><p class="adm-empty-title">Noch keine Alben</p><p>Ohne Album zeigt die Seite Galerie einen kurzen Hinweis.</p><button type="button" class="btn btn-gold" data-act="new">${icon('plus')}Erstes Album anlegen</button></div>`;
  }

  function flash(i, sel) {
    const row = document.querySelector(`.adm-row[data-key="${i}"]`);
    if (!row) return;
    row.classList.remove('flash');
    void row.offsetWidth;
    row.classList.add('flash');
    row.scrollIntoView({ block: 'nearest' });
    const btn = row.querySelector(sel || '.adm-row-open');
    if (btn) btn.focus({ preventScroll: true });
  }

  async function persist(next) {
    const direct = await A.saveFile(PATH, JSON.stringify({ alben: next }, null, 2) + '\n');
    alben = next;
    return direct;
  }

  /* ---------- Fenster: Fotos ---------- */
  function renderPhotos() {
    $('ga-photos').innerHTML = photos.map((p, i) =>
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
    $('ga-photo-count').textContent = photos.length ? `${plural(photos.length, 'Foto', 'Fotos')} von höchstens ${MAX_PHOTOS}` : '';
    $('ga-photo-drop').hidden = photos.length >= MAX_PHOTOS;
  }

  async function addPhotos(files) {
    let list = Array.from(files || []);
    const free = MAX_PHOTOS - photos.length;
    if (list.length > free) {
      A.toast(free > 0
        ? `Es passen nur noch ${plural(free, 'Foto', 'Fotos')} dazu (höchstens ${MAX_PHOTOS}). Die übrigen wurden nicht übernommen.`
        : `Es sind schon ${MAX_PHOTOS} Fotos da.`, 'err');
      list = list.slice(0, Math.max(0, free));
    }
    for (const file of list) {
      if (!file.type.startsWith('image/')) {
        A.toast(`„${file.name}“ ist keine Bilddatei.`, 'err');
        continue;
      }
      try {
        const conv = await A.toWebp(file);
        let w = 0;
        let h = 0;
        try {
          const bmp = await createImageBitmap(conv.blob);
          w = bmp.width;
          h = bmp.height;
          if (bmp.close) bmp.close();
        } catch { /* Groesse unbekannt */ }
        photos.push({ key: `g${++photoSeq}`, path: '', blob: conv.blob, ext: conv.ext, url: URL.createObjectURL(conv.blob), w, h, alt: '', credit: '' });
        renderPhotos();
      } catch {
        /* Meldung hat toWebp schon gezeigt */
      }
    }
    $('ga-photo-file').value = '';
  }

  function setPhotos(a) {
    for (const p of photos) if (p.url.startsWith('blob:')) URL.revokeObjectURL(p.url);
    photos = ((a && a.fotos) || []).filter((f) => f && f.bild).map((f) => ({
      key: `g${++photoSeq}`, path: f.bild, url: A.imageUrl(f.bild), w: f.breite || 0, h: f.hoehe || 0,
      alt: f.alt || '', credit: A.credits.get(f.bild)
    }));
    renderPhotos();
  }

  /* Ordner des Albums: der Ordner der vorhandenen Fotos, sonst nach Titel (und Datum) */
  function folderFor(titel, datum) {
    const own = photos.find((p) => p.path && p.path.startsWith(IMG_DIR));
    if (own) return own.path.replace(/[^/]+$/, '');
    return `${IMG_DIR}${[HD.isoDate(datum), HD.slug(titel, 50)].filter(Boolean).join('-') || 'album'}/`;
  }
  async function freePhotoPath(dir, ext) {
    const taken = new Set(photos.map((p) => p.path));
    for (let n = 1; ; n++) {
      const path = `${dir}foto-${n}.${ext}`;
      if (!taken.has(path) && !(A.folder.state === 'ok' && await A.folder.exists(path))) return path;
    }
  }

  /* ---------- Fenster: Aufnahmen ---------- */
  async function onAudio(files) {
    for (const picked of files) {
      if (!/\.mp3$/i.test(picked.name) && picked.type !== 'audio/mpeg') {
        A.toast(`${picked.name}: bitte eine MP3-Datei wählen.`, 'err');
        continue;
      }
      if (picked.size > MAX_AUDIO_MB * 1024 * 1024) {
        A.toast(`${picked.name} ist größer als ${MAX_AUDIO_MB} MB. Bitte kürzen oder stärker komprimieren.`, 'err');
        continue;
      }
      let file;
      try {
        file = await A.stableFile(picked);
      } catch {
        continue;
      }
      if (!(await A.magicOk(file, 'mp3'))) {
        A.toast(`${file.name}: Das ist keine gültige MP3-Datei (Dateiinhalt und Endung passen nicht zusammen).`, 'err');
        continue;
      }
      const base = HD.slug(file.name.replace(/\.[^.]+$/, ''), 60) || 'aufnahme';
      let path = `${AUDIO_DIR}${base}.mp3`;
      for (let n = 2; audio.has(path) || (A.folder.state === 'ok' && await A.folder.exists(path)); n++) path = `${AUDIO_DIR}${base}-${n}.mp3`;
      audio.set(path, file);
      tracks.add({ titel: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), datei: path });
    }
    $('f-audio').value = '';
  }

  /* ---------- Fenster ---------- */
  const dirtyState = () => A.snapshot($('ga-form')) + JSON.stringify(videos.values()) + JSON.stringify(tracks.values()) +
    JSON.stringify(photos.map((p) => [p.key, p.alt, p.credit]));

  function openEditor(i = -1) {
    edit = i;
    const a = i >= 0 ? alben[i] : null;
    const form = $('ga-form');
    form.reset();
    A.clearErrors(form);
    $('f-titel').value = a ? a.titel || '' : '';
    $('f-datum').value = a ? HD.isoDate(a.datum) : '';
    $('f-text').value = a ? a.text || '' : '';
    setPhotos(a);
    videos.set(a ? a.videos || [] : []);
    tracks.set(a ? a.audio || [] : []);
    audio.clear();
    $('ga-dlg-tag').textContent = a ? 'Bearbeiten' : 'Neues Album';
    $('ga-dlg-title').textContent = a ? a.titel : 'Neues Album';
    $('ga-delete').hidden = !a;
    A.openDialog($('ga-dlg'), { isDirty: () => dirtyState() !== snap });
    snap = dirtyState();
  }

  async function save(ev) {
    ev.preventDefault();
    const form = $('ga-form');
    const titel = clean($('f-titel').value);
    const datum = HD.isoDate($('f-datum').value) || '';
    const vids = videos.values().map((v) => ({ titel: clean(v.titel), url: clean(v.url) })).filter((v) => v.titel || v.url);
    const rows = tracks.values().map((h) => ({ titel: clean(h.titel), datei: clean(h.datei) })).filter((h) => h.titel || h.datei);
    const errors = [];
    if (!titel) errors.push([$('f-titel'), 'Bitte den Titel eintragen.']);
    const badVideo = vids.find((v) => !youtubeId(v.url));
    if (badVideo) {
      const field = [...videos.el.querySelectorAll('input[data-key="url"]')].find((inp) => clean(inp.value) === badVideo.url) ||
        videos.el.querySelector('input[data-key="url"]');
      errors.push([field, `Video „${badVideo.titel || badVideo.url || 'ohne Adresse'}“: bitte eine Adresse von YouTube eintragen.`]);
    }
    const badTrack = rows.find((h) => !h.datei || !/\.mp3$/i.test(h.datei) || !HD.safeUrl(h.datei, '../'));
    if (badTrack) {
      const field = [...tracks.el.querySelectorAll('input[data-key="datei"]')].find((inp) => clean(inp.value) === badTrack.datei) ||
        tracks.el.querySelector('input[data-key="datei"]');
      errors.push([field, `Aufnahme „${badTrack.titel || badTrack.datei}“: bitte eine MP3-Datei angeben.`]);
    }
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }

    const old = edit >= 0 ? alben[edit] : null;
    const btn = $('ga-save');
    btn.disabled = true;
    try {
      /* Neue Fotos erst jetzt schreiben */
      const dir = folderFor(titel, datum);
      for (const p of photos) {
        if (p.path) continue;
        p.path = await freePhotoPath(dir, p.ext);
        await A.saveFile(p.path, p.blob);
        p.blob = null;
      }
      for (const h of rows) if (audio.has(h.datei)) await A.saveFile(h.datei, audio.get(h.datei));
      const album = {
        titel, datum, text: HD.cleanLines($('f-text').value),
        fotos: photos.map((p) => ({ bild: p.path, alt: clean(p.alt), breite: p.w, hoehe: p.h })),
        /* einheitliche Adresse, egal wie sie eingetragen wurde */
        videos: vids.map((v) => ({ titel: v.titel, url: `https://www.youtube.com/watch?v=${youtubeId(v.url)}` })),
        audio: rows.map((h) => ({ titel: h.titel || 'Aufnahme', datei: h.datei }))
      };
      const next = alben.slice();
      if (old) next[edit] = album;
      else next.unshift(album);
      const direct = await persist(next);
      if (photos.length) await A.credits.save(Object.fromEntries(photos.map((p) => [p.path, clean(p.credit)])));
      $('ga-dlg').close();
      query = '';
      $('ga-search').value = '';
      render();
      flash(old ? edit : 0);
      A.toast(direct ? `Gespeichert: ${titel}.` : `${titel} übernommen. Bitte unten die Dateien herunterladen.`);
      A.log(`Galerie ${old ? 'geändert' : 'angelegt'}: ${titel}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function remove(i) {
    const a = alben[i];
    const ok = await A.confirmBox({
      title: 'Album löschen?',
      html: `<strong>${esc(a.titel)}</strong><br><br>Das Album verschwindet von der Seite Kirchenmusik → Galerie. Fotos und Aufnahmen bleiben im Ordner erhalten.`,
      ok: 'Löschen', danger: true
    });
    if (!ok) return;
    try {
      const next = alben.slice();
      next.splice(i, 1);
      const direct = await persist(next);
      if ($('ga-dlg').open) $('ga-dlg').close();
      render();
      A.toast(direct ? `Gelöscht: ${a.titel}.` : 'Gelöscht. Bitte unten die Datei herunterladen.');
      A.log(`Galerie gelöscht: ${a.titel}`);
    } catch (err) {
      A.toast(`Löschen nicht möglich: ${err.message}`, 'err');
    }
  }

  async function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= alben.length) return;
    const next = alben.slice();
    [next[i], next[j]] = [next[j], next[i]];
    try {
      await persist(next);
      render();
      flash(j, `[data-act="${dir < 0 ? 'up' : 'down'}"]:not([disabled])`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    A.credits.load();
    videos = A.listEditor($('ga-videos'), {
      fields: [
        { key: 'titel', label: 'Titel des Videos', placeholder: 'z. B. Gloria aus der Harmoniemesse' },
        { key: 'url', label: 'Adresse auf YouTube', placeholder: 'https://www.youtube.com/watch?v=…' }
      ],
      addLabel: 'Video hinzufügen', rowLabel: 'Video'
    });
    tracks = A.listEditor($('ga-audio'), {
      fields: [
        { key: 'titel', label: 'Titel der Aufnahme', placeholder: 'z. B. Kyrie' },
        { key: 'datei', label: 'MP3-Datei', placeholder: 'assets/audio/galerie/….mp3' }
      ],
      addLabel: 'Aufnahme von Hand eintragen', rowLabel: 'Aufnahme'
    });
    $('ga-new').addEventListener('click', () => openEditor());
    $('ga-form').addEventListener('submit', save);
    $('ga-delete').addEventListener('click', () => { if (edit >= 0) remove(edit); });
    $('ga-photo-file').addEventListener('change', (ev) => addPhotos(ev.target.files));
    A.wireDrop($('ga-photo-drop'), addPhotos);
    $('f-audio').addEventListener('change', (ev) => onAudio([...ev.target.files]));
    A.wireDrop($('ga-audio-drop'));
    $('ga-photos').addEventListener('input', (ev) => {
      const k = ev.target.closest('.adm-ph');
      const p = k && photos.find((x) => x.key === k.dataset.k);
      if (p && ev.target.dataset.ph) p[ev.target.dataset.ph] = ev.target.value;
    });
    $('ga-photos').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-ph-act]');
      const k = b && b.closest('.adm-ph');
      if (!k) return;
      const i = photos.findIndex((x) => x.key === k.dataset.k);
      const act = b.dataset.phAct;
      if (act === 'del') {
        const [p] = photos.splice(i, 1);
        if (p.url.startsWith('blob:')) URL.revokeObjectURL(p.url);
      } else {
        const j = i + (act === 'up' ? -1 : 1);
        if (j < 0 || j >= photos.length) return;
        [photos[i], photos[j]] = [photos[j], photos[i]];
      }
      renderPhotos();
    });
    $('ga-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      const i = Number(b.dataset.i);
      const act = b.dataset.act;
      if (act === 'edit') openEditor(i);
      else if (act === 'del') remove(i);
      else if (act === 'up' || act === 'down') move(i, act === 'up' ? -1 : 1);
      else if (act === 'new') openEditor();
      else if (act === 'clear') {
        query = '';
        $('ga-search').value = '';
        render();
      }
    });
    let timer = 0;
    $('ga-search').addEventListener('input', (ev) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        query = ev.target.value;
        render();
      }, 120);
    });
    A.guard(() => $('ga-dlg').open && dirtyState() !== snap);
    A.folder.on((state) => { if (state === 'ok') load(); });
    await load();
    if (new URLSearchParams(location.search).has('neu')) {
      openEditor();
      history.replaceState(null, '', location.pathname + location.search.replace(/[?&]neu=1/, '').replace(/^&/, '?'));
    }
  });
})();
