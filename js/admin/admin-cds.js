/* ============================================================
   Augustinerkirche Wien — admin-cds.js
   CDs von St. Augustin pflegen (admin/cds.html), Quelle ist
   data/cds.json: {gruppen: [{titel, cds: [{titel, cover: {pfad,
   breite, hoehe}, werke, mitwirkende, leitung, hoerproben:
   [{titel, datei}]}]}]}. Erscheint auf musik.html → CDs.
   - Anlegen, Bearbeiten, Verschieben (innerhalb der Gruppe), Löschen
   - Cover als WebP nach assets/img/cds/, Bildnachweis beim Cover
   - Hörproben: MP3-Dateien nach assets/audio/cds/
   Benoetigt js/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { HD, $, esc, icon } = A;
  const PATH = 'data/cds.json';
  const IMG_DIR = 'assets/img/cds/';
  const AUDIO_DIR = 'assets/audio/cds/';

  let data = { gruppen: [] };
  let query = '';
  let edit = null;        /* {g, i} oder null = neu */
  let image = null;       /* neu gewaehltes Cover {blob, ext, url, name, w, h} */
  const audio = new Map(); /* pfad -> File, neu gewaehlte Hoerproben */
  let samples = null;     /* Listen-Eingabe der Hoerproben */
  let snap = '';

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const copy = () => ({ gruppen: data.gruppen.map((g) => ({ titel: g.titel, cds: g.cds.slice() })) });
  const total = () => data.gruppen.reduce((n, g) => n + g.cds.length, 0);

  /* ---------- Laden und Liste ---------- */
  async function load() {
    try {
      const d = (await A.readJSON(PATH));
      if (!d || !Array.isArray(d.gruppen)) throw new Error('unerwarteter Inhalt');
      data = { gruppen: d.gruppen.map((g) => ({ titel: g.titel || '', cds: Array.isArray(g.cds) ? g.cds : [] })) };
    } catch (e) {
      $('cd-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Datei <code>${PATH}</code> konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
      return;
    }
    render();
  }

  function rowHTML(c, g, i, last, searching) {
    const src = c.cover && A.imageUrl(c.cover.pfad);
    const n = (c.hoerproben || []).length;
    const move = searching ? '' :
      `<button type="button" class="adm-act icon" data-act="up" data-g="${g}" data-i="${i}" aria-label="Nach oben: ${esc(c.titel)}" title="Nach oben"${i === 0 ? ' disabled' : ''}>${icon('up')}</button>` +
      `<button type="button" class="adm-act icon" data-act="down" data-g="${g}" data-i="${i}" aria-label="Nach unten: ${esc(c.titel)}" title="Nach unten"${i === last ? ' disabled' : ''}>${icon('down')}</button>`;
    return `<li class="adm-row" data-key="${g}-${i}">` +
      `<button type="button" class="adm-row-open has-thumb" data-act="edit" data-g="${g}" data-i="${i}">` +
        (src ? `<span class="adm-thumb"><img src="${esc(src)}" alt="" loading="lazy" decoding="async"/></span>`
          : '<span class="adm-thumb none"><img src="../assets/logo-gold.png" alt=""/></span>') +
        '<span class="adm-row-body">' +
          `<span class="adm-row-title">${esc(c.titel)}</span>` +
          `<span class="adm-row-meta">${esc([c.leitung ? `Leitung: ${c.leitung}` : '', n ? plural(n, 'Hörprobe', 'Hörproben') : 'ohne Hörprobe'].filter(Boolean).join(' · '))}</span>` +
          (c.werke ? `<span class="adm-row-people">${esc(c.werke)}</span>` : '') +
        '</span></button>' +
      `<div class="adm-row-actions">${move}` +
        `<button type="button" class="adm-act icon danger" data-act="del" data-g="${g}" data-i="${i}" aria-label="Löschen: ${esc(c.titel)}" title="Löschen">${icon('trash')}</button>` +
      '</div></li>';
  }

  function render() {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const match = (c) => words.every((w) => `${c.titel} ${c.werke} ${c.mitwirkende} ${c.leitung}`.toLowerCase().includes(w));
    let shown = 0;
    const html = data.gruppen.map((grp, g) => {
      const rows = grp.cds.map((c, i) => ({ c, i })).filter(({ c }) => match(c));
      shown += rows.length;
      if (!rows.length) return '';
      return `<li class="adm-divider-note">${esc(grp.titel || 'Ohne Gruppe')} · ${plural(grp.cds.length, 'CD', 'CDs')}</li>` +
        rows.map(({ c, i }) => rowHTML(c, g, i, grp.cds.length - 1, words.length > 0)).join('');
    }).join('');
    $('cd-count').textContent = words.length ? `${plural(shown, 'Treffer', 'Treffer')} für „${query.trim()}“` : plural(total(), 'CD', 'CDs');
    $('cd-list').innerHTML = shown
      ? `<ul class="adm-rows">${html}</ul>`
      : words.length
        ? '<div class="adm-empty"><p class="adm-empty-title">Keine Treffer</p><button type="button" class="btn btn-quiet" data-act="clear">Suche zurücksetzen</button></div>'
        : `<div class="adm-empty"><p class="adm-empty-title">Noch keine CDs</p><button type="button" class="btn btn-gold" data-act="new">${icon('plus')}Erste CD anlegen</button></div>`;
    $('dl-cd-gruppe').innerHTML = data.gruppen.map((grp) => `<option value="${esc(grp.titel)}"></option>`).join('');
  }

  function flash(g, i, sel) {
    const row = document.querySelector(`.adm-row[data-key="${g}-${i}"]`);
    if (!row) return;
    row.classList.remove('flash');
    void row.offsetWidth;
    row.classList.add('flash');
    row.scrollIntoView({ block: 'nearest' });
    const btn = row.querySelector(sel || '.adm-row-open');
    if (btn) btn.focus({ preventScroll: true });
  }

  async function persist(next) {
    next.gruppen = next.gruppen.filter((grp) => grp.cds.length);
    const direct = await A.saveFile(PATH, JSON.stringify(next, null, 2) + '\n');
    data = next;
    return direct;
  }

  /* ---------- Fenster: Cover ---------- */
  function currentCover() {
    const c = edit ? data.gruppen[edit.g].cds[edit.i] : null;
    return c && c.cover && c.cover.pfad ? c.cover : null;
  }
  function renderCover() {
    const cur = currentCover();
    const src = image ? image.url : cur ? A.imageUrl(cur.pfad) : '';
    $('cd-prev').innerHTML = src ? `<img src="${esc(src)}" alt="Vorschau des Covers"/>` : '<span class="none">Noch kein Cover</span>';
    $('cd-imginfo').textContent = image ? `${image.name} · ${image.w} × ${image.h} Pixel` : cur ? `Aktuelles Cover: ${cur.pfad}` : '';
  }
  async function onFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      A.toast('Bitte eine Bilddatei wählen (WebP, JPG oder PNG).', 'err');
      return;
    }
    const conv = await A.toWebp(file, { maxSize: 400, quality: 0.86 });
    let w = 0;
    let h = 0;
    try {
      const bmp = await createImageBitmap(conv.blob);
      w = bmp.width;
      h = bmp.height;
      if (bmp.close) bmp.close();
    } catch { /* Groesse unbekannt */ }
    if (image) URL.revokeObjectURL(image.url);
    image = { ...conv, url: URL.createObjectURL(conv.blob), name: file.name, w, h };
    renderCover();
  }

  /* ---------- Fenster: Hoerproben ---------- */
  const MAX_AUDIO_MB = 30;
  async function onAudio(files) {
    for (const picked of files) {
      if (!/\.mp3$/i.test(picked.name) && picked.type !== 'audio/mpeg') {
        A.toast(`${picked.name}: bitte eine MP3-Datei wählen.`, 'err');
        continue;
      }
      if (picked.size > MAX_AUDIO_MB * 1024 * 1024) {
        A.toast(`${picked.name} ist größer als ${MAX_AUDIO_MB} MB. Hörproben sollten kurz sein, bitte kürzen oder stärker komprimieren.`, 'err');
        continue;
      }
      let file;
      try {
        file = await A.stableFile(picked);   /* gleich einlesen: so fällt eine gesperrte oder geänderte Datei sofort auf */
      } catch {
        continue;
      }
      if (!(await A.magicOk(file, 'mp3'))) {
        A.toast(`${file.name}: Das ist keine gültige MP3-Datei (Dateiinhalt und Endung passen nicht zusammen).`, 'err');
        continue;
      }
      const base = HD.slug(file.name.replace(/\.[^.]+$/, ''), 60) || 'hoerprobe';
      let path = `${AUDIO_DIR}${base}.mp3`;
      for (let n = 2; audio.has(path); n++) path = `${AUDIO_DIR}${base}-${n}.mp3`;
      audio.set(path, file);
      samples.add({ titel: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), datei: path });
    }
    $('f-audio').value = '';
  }

  const dirtyState = () => A.snapshot($('cd-form')) + JSON.stringify(samples.values()) + (image ? 'neu' : '');

  function openEditor(g, i) {
    edit = g === undefined ? null : { g, i };
    const c = edit ? data.gruppen[g].cds[i] : null;
    const form = $('cd-form');
    form.reset();
    A.clearErrors(form);
    $('f-titel').value = c ? c.titel : '';
    $('f-gruppe').value = edit ? data.gruppen[g].titel : (data.gruppen[0] ? data.gruppen[0].titel : 'Messen');
    $('f-leitung').value = c ? c.leitung || '' : '';
    $('f-werke').value = c ? c.werke || '' : '';
    $('f-mitwirkende').value = c ? c.mitwirkende || '' : '';
    $('f-credit').value = A.credits.get(c && c.cover && c.cover.pfad);
    samples.set(c ? c.hoerproben || [] : []);
    audio.clear();
    if (image) URL.revokeObjectURL(image.url);
    image = null;
    renderCover();
    $('cd-dlg-tag').textContent = c ? 'Bearbeiten' : 'Neue CD';
    $('cd-dlg-title').textContent = c ? c.titel : 'Neue CD';
    $('cd-delete').hidden = !c;
    A.openDialog($('cd-dlg'), { isDirty: () => dirtyState() !== snap });
    snap = dirtyState();
  }

  async function freeCoverPath(base, ext, old) {
    let path = `${IMG_DIR}${base}.${ext}`;
    if (A.folder.state !== 'ok') return path;
    for (let n = 2; !(old && old.cover && old.cover.pfad === path) && await A.folder.exists(path); n++) path = `${IMG_DIR}${base}-${n}.${ext}`;
    return path;
  }

  async function save(ev) {
    ev.preventDefault();
    const form = $('cd-form');
    const titel = clean($('f-titel').value);
    const gruppe = clean($('f-gruppe').value) || 'Weitere Aufnahmen';
    const rows = samples.values().map((h) => ({ titel: clean(h.titel), datei: clean(h.datei) })).filter((h) => h.titel || h.datei);
    const errors = [];
    if (!titel) errors.push([$('f-titel'), 'Bitte den Titel eintragen.']);
    const bad = rows.find((h) => !h.datei || !/\.mp3$/i.test(h.datei) || !HD.safeUrl(h.datei, '../'));
    if (bad) {
      /* Feld der fehlerhaften Hoerprobe markieren */
      const field = [...samples.el.querySelectorAll('input[data-key="datei"]')].find((inp) => clean(inp.value) === bad.datei) ||
        samples.el.querySelector('input[data-key="datei"]');
      errors.push([field, `Hörprobe „${bad.titel || bad.datei}“: bitte eine MP3-Datei angeben.`]);
    }
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }

    const old = edit ? data.gruppen[edit.g].cds[edit.i] : null;
    const cd = {
      titel, cover: currentCover(), werke: clean($('f-werke').value),
      mitwirkende: clean($('f-mitwirkende').value), leitung: clean($('f-leitung').value),
      hoerproben: rows.map((h) => ({ titel: h.titel || 'Hörprobe', datei: h.datei }))
    };
    const btn = $('cd-save');
    btn.disabled = true;
    try {
      if (image) {
        const path = await freeCoverPath(HD.slug(titel, 60) || 'cd', image.ext, old);
        await A.saveFile(path, image.blob);
        cd.cover = { pfad: path, breite: image.w, hoehe: image.h };
      }
      for (const h of cd.hoerproben) if (audio.has(h.datei)) await A.saveFile(h.datei, audio.get(h.datei));

      const next = copy();
      let g = next.gruppen.findIndex((grp) => grp.titel.toLowerCase() === gruppe.toLowerCase());
      let i;
      if (edit && g === edit.g) {
        next.gruppen[g].cds[edit.i] = cd;
        i = edit.i;
      } else {
        if (edit) next.gruppen[edit.g].cds.splice(edit.i, 1);
        if (g < 0) {
          next.gruppen.push({ titel: gruppe, cds: [] });
          g = next.gruppen.length - 1;
        }
        next.gruppen[g].cds.push(cd);
        i = next.gruppen[g].cds.length - 1;
      }
      const targetTitle = next.gruppen[g].titel;
      const direct = await persist(next);
      if (cd.cover) await A.credits.set(cd.cover.pfad, $('f-credit').value);
      $('cd-dlg').close();
      query = '';
      $('cd-search').value = '';
      render();
      flash(data.gruppen.findIndex((grp) => grp.titel === targetTitle), i);
      A.toast(direct ? `Gespeichert: ${titel}.` : `${titel} übernommen. Bitte unten die Dateien herunterladen.`);
      A.log(`CD ${old ? 'geändert' : 'angelegt'}: ${titel}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function remove(g, i) {
    const c = data.gruppen[g].cds[i];
    const ok = await A.confirmBox({
      title: 'CD löschen?',
      html: `<strong>${esc(c.titel)}</strong><br><br>Die CD verschwindet von der Seite Kirchenmusik → CDs. Cover und Hörproben bleiben im Ordner erhalten.`,
      ok: 'Löschen', danger: true
    });
    if (!ok) return;
    try {
      const next = copy();
      next.gruppen[g].cds.splice(i, 1);
      const direct = await persist(next);
      if ($('cd-dlg').open) $('cd-dlg').close();
      render();
      A.toast(direct ? `Gelöscht: ${c.titel}.` : 'Gelöscht. Bitte unten die Datei herunterladen.');
      A.log(`CD gelöscht: ${c.titel}`);
    } catch (err) {
      A.toast(`Löschen nicht möglich: ${err.message}`, 'err');
    }
  }

  async function move(g, i, dir) {
    const j = i + dir;
    const next = copy();
    const list = next.gruppen[g].cds;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    try {
      await persist(next);
      render();
      flash(g, j, `[data-act="${dir < 0 ? 'up' : 'down'}"]:not([disabled])`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    A.credits.load();
    samples = A.listEditor($('cd-samples'), {
      fields: [
        { key: 'titel', label: 'Titel der Hörprobe', placeholder: 'z. B. Kyrie aus der Krönungsmesse' },
        { key: 'datei', label: 'MP3-Datei', placeholder: 'assets/audio/cds/….mp3' }
      ],
      addLabel: 'Hörprobe von Hand eintragen', rowLabel: 'Hörprobe'
    });
    $('cd-new').addEventListener('click', () => openEditor());
    $('cd-form').addEventListener('submit', save);
    $('cd-delete').addEventListener('click', () => { if (edit) remove(edit.g, edit.i); });
    $('f-file').addEventListener('change', (ev) => onFile(ev.target.files[0]));
    $('f-audio').addEventListener('change', (ev) => onAudio([...ev.target.files]));
    A.wireDrop($('cd-drop'));
    A.wireDrop($('cd-audio-drop'));
    $('cd-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      const g = Number(b.dataset.g);
      const i = Number(b.dataset.i);
      const act = b.dataset.act;
      if (act === 'edit') openEditor(g, i);
      else if (act === 'del') remove(g, i);
      else if (act === 'up' || act === 'down') move(g, i, act === 'up' ? -1 : 1);
      else if (act === 'new') openEditor();
      else if (act === 'clear') {
        query = '';
        $('cd-search').value = '';
        render();
      }
    });
    let timer = 0;
    $('cd-search').addEventListener('input', (ev) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        query = ev.target.value;
        render();
      }, 120);
    });
    A.guard(() => $('cd-dlg').open && dirtyState() !== snap);
    A.folder.on((state) => { if (state === 'ok') load(); });
    await load();
    if (new URLSearchParams(location.search).has('neu')) {
      openEditor();
      history.replaceState(null, '', location.pathname + location.search.replace(/[?&]neu=1/, '').replace(/^&/, '?'));
    }
  });
})();
