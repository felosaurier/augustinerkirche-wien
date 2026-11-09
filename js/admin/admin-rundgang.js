/* ============================================================
   Augustinerkirche Wien — admin-rundgang.js
   Kirchenrundgang pflegen (admin/rundgang.html), Quelle ist
   data/rundgang.json: {bilder: [{titel, bild, breite, hoehe, format (normal|breit|hoch), ausschnitt ("x% y%")}]}.
   Erscheint auf pages/augustinerkirche.html#p-geschichte → Rundgang in der Reihenfolge
   der Liste; ein Klick vergroessert das Bild.
   Benoetigt js/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { $, esc, icon } = A;
  const PATH = 'data/rundgang.json';
  const IMG_DIR = 'assets/img/kirche/';

  let list = [];
  let edit = -1;          /* Index oder -1 = neu */
  let snap = '';
  let image = null;       /* neu gewaehltes Bild {blob, ext, url, name, w, h} */

  const RATIO = { normal: '7 / 5', breit: '14 / 5', hoch: '7 / 10' };
  const format = () => (document.querySelector('input[name="format"]:checked') || {}).value || 'normal';

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  /* ---------- Laden und Liste ---------- */
  async function load() {
    try {
      const d = (await A.readJSON(PATH));
      if (!d || !Array.isArray(d.bilder)) throw new Error('unerwarteter Inhalt');
      list = d.bilder;
    } catch (e) {
      $('rg-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Datei <code>${PATH}</code> konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
      return;
    }
    render();
  }

  function rowHTML(b, i) {
    return `<li class="adm-row" data-key="${i}">` +
      `<button type="button" class="adm-row-open adm-rg" data-act="edit" data-i="${i}">` +
        `<span class="adm-thumb"><img src="${esc(A.imageUrl(b.bild))}" alt="" loading="lazy"/></span>` +
        `<span class="adm-row-body"><span class="adm-row-title">${esc(b.titel)}</span>` +
        `<span class="adm-row-meta">Stelle ${i + 1}</span></span>` +
      '</button>' +
      '<div class="adm-row-actions">' +
        `<button type="button" class="adm-act icon" data-act="up" data-i="${i}" aria-label="Nach oben: ${esc(b.titel)}" title="Nach oben"${i === 0 ? ' disabled' : ''}>${icon('up')}</button>` +
        `<button type="button" class="adm-act icon" data-act="down" data-i="${i}" aria-label="Nach unten: ${esc(b.titel)}" title="Nach unten"${i === list.length - 1 ? ' disabled' : ''}>${icon('down')}</button>` +
        `<button type="button" class="adm-act icon danger" data-act="del" data-i="${i}" aria-label="Entfernen: ${esc(b.titel)}" title="Entfernen">${icon('trash')}</button>` +
      '</div></li>';
  }

  function render() {
    $('rg-count').textContent = plural(list.length, 'Bild', 'Bilder');
    $('rg-list').innerHTML = list.length
      ? `<ul class="adm-rows">${list.map(rowHTML).join('')}</ul>`
      : `<div class="adm-empty"><p class="adm-empty-title">Noch kein Bild eingetragen</p><button type="button" class="btn btn-gold" data-act="new">${icon('plus')}Bild hinzufügen</button></div>`;
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
    const direct = await A.saveFile(PATH, JSON.stringify({ bilder: next }, null, 2) + '\n');
    list = next;
    return direct;
  }

  /* ---------- Fenster: Bild ---------- */
  const current = () => (edit >= 0 ? list[edit] : null);
  function renderImage() {
    const cur = current();
    const src = image ? image.url : cur ? A.imageUrl(cur.bild) : '';
    $('rg-prev').innerHTML = src ? `<img src="${esc(src)}" alt="Vorschau des Bildes"/>` : '<span class="none">Noch kein Bild</span>';
    $('rg-imginfo').textContent = image ? `${image.name} · ${image.w} × ${image.h} Pixel` : cur ? `Aktuelles Bild: ${cur.bild}` : '';
  }
  /* Ausschnitt: Bild in der Kachel ziehen oder mit Pfeiltasten verschieben,
     gespeichert als object-position ("x% y%") */
  function renderPan() {
    const cur = current();
    const src = image ? image.url : cur ? A.imageUrl(cur.bild) : '';
    const box = $('rg-pan');
    box.style.aspectRatio = RATIO[format()];
    box.style.maxWidth = { normal: '20rem', breit: '26rem', hoch: '13rem' }[format()];
    box.hidden = !src;
    $('rg-pan-help').hidden = !src;
    box.innerHTML = src ? `<img src="${esc(src)}" alt="" draggable="false"${A.focusPos($('f-focus').value) ? ` style="object-position:${A.focusPos($('f-focus').value)}"` : ''}/>` : '';
  }
  const panImg = () => {
    const img = $('rg-pan').querySelector('img');
    return img && img.naturalWidth ? img : null;
  };
  function panTo(x, y) {
    const img = panImg();
    if (!img) return;
    const clamp = (v) => Math.round(Math.min(100, Math.max(0, v)));
    $('f-focus').value = `${clamp(x)}% ${clamp(y)}%`;
    img.style.objectPosition = $('f-focus').value;
  }
  function panStart() {
    const v = $('f-focus').value.match(/^(\d+)% (\d+)%$/);
    return v ? { x: Number(v[1]), y: Number(v[2]) } : { x: 50, y: 50 };
  }
  function wirePan() {
    const box = $('rg-pan');
    let drag = null;
    box.addEventListener('pointerdown', (ev) => {
      const img = panImg();
      if (!img) return;
      const r = box.getBoundingClientRect();
      const scale = Math.max(r.width / img.naturalWidth, r.height / img.naturalHeight);
      drag = { x0: ev.clientX, y0: ev.clientY, ...panStart(), rx: img.naturalWidth * scale - r.width, ry: img.naturalHeight * scale - r.height };
      box.setPointerCapture(ev.pointerId);
      box.classList.add('dragging');
      ev.preventDefault();
    });
    box.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      panTo(drag.rx > 1 ? drag.x - ((ev.clientX - drag.x0) / drag.rx) * 100 : drag.x,
        drag.ry > 1 ? drag.y - ((ev.clientY - drag.y0) / drag.ry) * 100 : drag.y);
    });
    const end = () => { drag = null; box.classList.remove('dragging'); };
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
    box.addEventListener('keydown', (ev) => {
      const step = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }[ev.key];
      if (!step || !panImg()) return;
      ev.preventDefault();
      const s = panStart();
      panTo(s.x + step[0], s.y + step[1]);
    });
    $('rg-pan-reset').addEventListener('click', () => {
      $('f-focus').value = '';
      renderPan();
    });
    for (const r of document.querySelectorAll('input[name="format"]')) r.addEventListener('change', renderPan);
  }

  async function onFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      A.toast('Bitte eine Bilddatei wählen (WebP, JPG oder PNG).', 'err');
      return;
    }
    const conv = await A.toWebp(file, { maxSize: 1600, quality: 0.86 });
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
    if (!$('f-titel').value.trim()) $('f-titel').value = clean(file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));
    $('f-focus').value = '';
    renderImage();
    renderPan();
  }
  /* Freier Dateiname; das eigene Bild darf ersetzt werden */
  async function freePath(base, ext, old) {
    let path = `${IMG_DIR}${base}.${ext}`;
    if (A.folder.state !== 'ok') return path;
    for (let n = 2; !(old && old.bild === path) && await A.folder.exists(path); n++) path = `${IMG_DIR}${base}-${n}.${ext}`;
    return path;
  }
  const dirtyState = () => A.snapshot($('rg-form')) + (image ? 'neu' : '');

  function openEditor(i) {
    edit = i === undefined ? -1 : i;
    const b = current();
    const form = $('rg-form');
    form.reset();
    A.clearErrors(form);
    $('f-titel').value = b ? b.titel : '';
    $('f-credit').value = A.credits.get(b && b.bild);
    if (image) URL.revokeObjectURL(image.url);
    image = null;
    $('f-file').value = '';
    $('f-focus').value = b ? A.focusPos(b.ausschnitt) : '';
    document.querySelector(`input[name="format"][value="${b && b.format ? b.format : 'normal'}"]`).checked = true;
    renderImage();
    renderPan();
    $('f-pos').value = 'ende';
    $('rg-pos-field').hidden = !!b;
    $('rg-dlg-tag').textContent = b ? `Stelle ${edit + 1}` : 'Hinzufügen';
    $('rg-dlg-title').textContent = b ? b.titel : 'Neues Bild';
    $('rg-delete').hidden = !b;
    A.openDialog($('rg-dlg'), { isDirty: () => dirtyState() !== snap });
    snap = dirtyState();
  }

  async function save(ev) {
    ev.preventDefault();
    const form = $('rg-form');
    const titel = clean($('f-titel').value);
    const old = current();
    const errors = [];
    if (!titel) errors.push([$('f-titel'), 'Bitte einen Titel eintragen.']);
    if (!old && !image) errors.push([$('f-file'), 'Bitte ein Bild wählen.']);
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }
    const entry = {
      titel, bild: old ? old.bild : '', breite: old ? old.breite || 0 : 0, hoehe: old ? old.hoehe || 0 : 0,
      format: format(), ausschnitt: $('f-focus').value
    };
    const next = list.slice();
    let pos;
    if (old) {
      next[edit] = entry;
      pos = edit;
    } else if ($('f-pos').value === 'anfang') {
      next.unshift(entry);
      pos = 0;
    } else {
      next.push(entry);
      pos = next.length - 1;
    }
    const btn = $('rg-save');
    btn.disabled = true;
    try {
      if (image) {
        const path = await freePath(A.HD.slug(titel, 60) || 'bild', image.ext, old);
        await A.saveFile(path, image.blob);
        Object.assign(entry, { bild: path, breite: image.w, hoehe: image.h });
      }
      const direct = await persist(next);
      await A.credits.set(entry.bild, $('f-credit').value);
      if (old && old.bild && old.bild !== entry.bild) await A.media.remove([old.bild]);
      $('rg-dlg').close();
      render();
      flash(pos);
      A.toast(direct ? `Gespeichert: ${titel}.` : `${titel} übernommen. Bitte unten die Datei herunterladen.`);
      A.log(`Rundgang ${old ? 'geändert' : 'ergänzt'}: ${titel}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function remove(i) {
    const b = list[i];
    const ok = await A.confirmBox({
      title: 'Bild aus dem Rundgang entfernen?',
      html: `<strong>${esc(b.titel)}</strong><br><br>Das Bild verschwindet von der Seite Chronik → Rundgang. Die Bilddatei wird mitgelöscht, sofern sie nicht noch anderswo verwendet wird.`,
      ok: 'Entfernen', danger: true
    });
    if (!ok) return;
    try {
      const next = list.slice();
      next.splice(i, 1);
      const direct = await persist(next);
      if (b.bild) await A.media.remove([b.bild]);
      if ($('rg-dlg').open) $('rg-dlg').close();
      render();
      A.toast(direct ? `Entfernt: ${b.titel}.` : 'Entfernt. Bitte unten die Datei herunterladen.');
      A.log(`Rundgang entfernt: ${b.titel}`);
    } catch (err) {
      A.toast(`Entfernen nicht möglich: ${err.message}`, 'err');
    }
  }

  async function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = list.slice();
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
    $('f-file').addEventListener('change', (ev) => onFile(ev.target.files[0]));
    A.wireDrop($('rg-drop'));
    wirePan();
    $('rg-new').addEventListener('click', () => openEditor());
    $('rg-form').addEventListener('submit', save);
    $('rg-delete').addEventListener('click', () => { if (edit >= 0) remove(edit); });
    $('rg-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      const i = Number(b.dataset.i);
      const act = b.dataset.act;
      if (act === 'edit') openEditor(i);
      else if (act === 'del') remove(i);
      else if (act === 'up' || act === 'down') move(i, act === 'up' ? -1 : 1);
      else if (act === 'new') openEditor();
    });
    A.guard(() => $('rg-dlg').open && dirtyState() !== snap);
    A.folder.on((state) => { if (state === 'ok') load(); });
    await load();
    if (new URLSearchParams(location.search).has('neu')) {
      openEditor();
      history.replaceState(null, '', location.pathname + location.search.replace(/[?&]neu=1/, '').replace(/^&/, '?'));
    }
  });
})();
