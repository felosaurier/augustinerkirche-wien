/* ============================================================
   Augustinerkirche Wien — admin-startseite.js
   Titelfotos der Startseite pflegen (admin/startseite.html), Quelle ist
   data/startseite.json: {sekunden, bilder: [{titel, bild, breite, hoehe, ausschnitt ("x% y%")}]}.
   Ein Foto steht still, mehrere wechseln auf der Startseite nacheinander
   (js/main.js). Hinzufuegen, ersetzen, Ausschnitt waehlen, Reihenfolge,
   Bildnachweis, Wechselzeit.
   Benoetigt js/hochaemter-data.js und js/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { $, esc, icon } = A;
  const PATH = 'data/startseite.json';
  const IMG_DIR = 'assets/img/startseite/';
  const SECS = [4, 6, 8, 10, 15, 20];

  let list = [];
  let seconds = 6;
  let edit = -1;          /* Index oder -1 = neu */
  let snap = '';
  let image = null;       /* neu gewaehltes Foto {blob, ext, url, name, w, h} */

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  /* ---------- Laden und Liste ---------- */
  async function load() {
    try {
      const d = JSON.parse(await A.readText(PATH));
      if (!d || !Array.isArray(d.bilder)) throw new Error('unerwarteter Inhalt');
      list = d.bilder;
      seconds = SECS.includes(Number(d.sekunden)) ? Number(d.sekunden) : 6;
    } catch (e) {
      $('st-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Datei <code>${PATH}</code> konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
      return;
    }
    render();
  }

  function rowHTML(b, i) {
    return `<li class="adm-row" data-key="${i}">` +
      `<button type="button" class="adm-row-open adm-st" data-act="edit" data-i="${i}">` +
        `<span class="adm-thumb"><img src="${esc(A.imageUrl(b.bild))}" alt=""${b.ausschnitt ? ` style="object-position:${esc(b.ausschnitt)}"` : ''} loading="lazy"/></span>` +
        `<span class="adm-row-body"><span class="adm-row-title">${esc(b.titel)}</span>` +
        `<span class="adm-row-meta">${i === 0 ? 'Erstes Foto, steht beim Öffnen der Seite' : `Foto ${i + 1}`}</span></span>` +
      '</button>' +
      '<div class="adm-row-actions">' +
        `<button type="button" class="adm-act icon" data-act="up" data-i="${i}" aria-label="Nach vorne: ${esc(b.titel)}" title="Nach vorne"${i === 0 ? ' disabled' : ''}>${icon('up')}</button>` +
        `<button type="button" class="adm-act icon" data-act="down" data-i="${i}" aria-label="Nach hinten: ${esc(b.titel)}" title="Nach hinten"${i === list.length - 1 ? ' disabled' : ''}>${icon('down')}</button>` +
        `<button type="button" class="adm-act icon danger" data-act="del" data-i="${i}" aria-label="Entfernen: ${esc(b.titel)}" title="Entfernen">${icon('trash')}</button>` +
      '</div></li>';
  }

  function render() {
    $('st-count').textContent = list.length > 1 ? `${plural(list.length, 'Foto', 'Fotos')} · wechseln nacheinander` : plural(list.length, 'Foto', 'Fotos');
    $('st-speed').hidden = list.length < 2;
    $('st-secs').value = String(seconds);
    $('st-list').innerHTML = list.length
      ? `<ul class="adm-rows">${list.map(rowHTML).join('')}</ul>`
      : `<div class="adm-empty"><p class="adm-empty-title">Noch kein Foto eingetragen</p><p>Ohne eigene Fotos zeigt die Startseite den Kirchturm.</p><button type="button" class="btn btn-gold" data-act="new">${icon('plus')}Foto hinzufügen</button></div>`;
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

  async function persist(next, secs = seconds) {
    const direct = await A.saveFile(PATH, JSON.stringify({ sekunden: secs, bilder: next }, null, 2) + '\n');
    list = next;
    seconds = secs;
    return direct;
  }

  /* ---------- Fenster: Foto und Ausschnitt ---------- */
  const current = () => (edit >= 0 ? list[edit] : null);
  const srcNow = () => (image ? image.url : current() ? A.imageUrl(current().bild) : '');
  function renderImage() {
    const cur = current();
    $('st-imginfo').textContent = image ? `${image.name} · ${image.w} × ${image.h} Pixel` : cur ? `Aktuelles Foto: ${cur.bild}` : '';
  }
  /* Rahmen des Fotos wie auf der Startseite (css/style.css, .hero-home):
     Querformat: rechte Spalte = 52 % der Breite ohne Seitenrand, Hoehe = Fenster minus Menue.
     Hochformat und Handy: volle Breite, 4:5, hoechstens 62 % der Hoehe.
     "computer" rechnet mit dem Fenster dieses Geraetes, "handy" mit einem Telefon (375 × 812). */
  function probe(css) {
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;${css}`;
    document.body.append(el);
    const r = el.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    el.remove();
    return { w: r.width, h: r.height, pad };
  }
  function frame(view) {
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const portraitScreen = view === 'handy' || vh > vw;
    if (portraitScreen) {
      const w = view === 'handy' ? 375 : vw;
      const h = Math.min(w * 1.25, 0.62 * (view === 'handy' ? 812 : vh));
      return { ratio: w / h, note: view === 'handy' ? 'Handy hochkant' : 'Dein Fenster ist hochkant, so sieht es auch am Computer aus' };
    }
    const navH = probe('width:1px;height:var(--nav-h)').h;
    const edge = probe('width:100%;padding-left:var(--edge);box-sizing:border-box').pad;
    const w = 0.52 * (vw - edge);
    const h = vh - navH;
    return { ratio: Math.min(2, Math.max(0.5, w / h)), note: `Computer, so wie bei einem Fenster dieser Größe (${Math.round(vw)} × ${Math.round(vh)})` };
  }
  let view = 'computer';

  /* Ausschnitt: Foto im Rahmen ziehen oder mit Pfeiltasten verschieben,
     gespeichert als background-position ("x% y%") */
  function renderPan() {
    const src = srcNow();
    const box = $('st-pan');
    const f = frame(view);
    box.style.aspectRatio = String(f.ratio);
    $('st-pan-note').textContent = `Foto ziehen (oder Pfeiltasten), bis der gewünschte Ort zu sehen ist. Vorschau: ${f.note}.`;
    for (const b of document.querySelectorAll('.adm-seg-btn')) b.setAttribute('aria-pressed', String(b.dataset.view === view));
    box.hidden = !src;
    $('st-pan-help').hidden = !src;
    box.innerHTML = src ? `<img src="${esc(src)}" alt="" draggable="false"${$('f-focus').value ? ` style="object-position:${$('f-focus').value}"` : ''}/>` : '';
  }
  const panImg = () => {
    const img = $('st-pan').querySelector('img');
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
    const box = $('st-pan');
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
    for (const b of document.querySelectorAll('.adm-seg-btn')) {
      b.addEventListener('click', () => {
        view = b.dataset.view;
        renderPan();
      });
    }
    $('st-pan-reset').addEventListener('click', () => {
      $('f-focus').value = '';
      renderPan();
    });
  }

  async function onFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      A.toast('Bitte eine Bilddatei wählen (WebP, JPG oder PNG).', 'err');
      return;
    }
    const conv = await A.toWebp(file, { maxSize: 2000, quality: 0.86 });
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
  /* Freier Dateiname; das eigene Foto darf ersetzt werden */
  async function freePath(base, ext, old) {
    let path = `${IMG_DIR}${base}.${ext}`;
    if (A.folder.state !== 'ok') return path;
    for (let n = 2; !(old && old.bild === path) && await A.folder.exists(path); n++) path = `${IMG_DIR}${base}-${n}.${ext}`;
    return path;
  }
  const dirtyState = () => A.snapshot($('st-form')) + (image ? 'neu' : '');

  function openEditor(i) {
    edit = i === undefined ? -1 : i;
    const b = current();
    const form = $('st-form');
    form.reset();
    A.clearErrors(form);
    $('f-titel').value = b ? b.titel : '';
    $('f-credit').value = A.credits.get(b && b.bild);
    if (image) URL.revokeObjectURL(image.url);
    image = null;
    $('f-file').value = '';
    $('f-focus').value = b && b.ausschnitt ? b.ausschnitt : '';
    renderImage();
    renderPan();
    $('f-pos').value = 'ende';
    $('st-pos-field').hidden = !!b;
    $('st-dlg-tag').textContent = b ? `Foto ${edit + 1}` : 'Hinzufügen';
    $('st-dlg-title').textContent = b ? b.titel : 'Neues Foto';
    $('st-delete').hidden = !b;
    A.openDialog($('st-dlg'), { isDirty: () => dirtyState() !== snap });
    snap = dirtyState();
  }

  async function save(ev) {
    ev.preventDefault();
    const form = $('st-form');
    const titel = clean($('f-titel').value);
    const old = current();
    const errors = [];
    if (!titel) errors.push([$('f-titel'), 'Bitte eine Beschreibung eintragen.']);
    if (!old && !image) errors.push([$('f-file'), 'Bitte ein Foto wählen.']);
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }
    const entry = {
      titel, bild: old ? old.bild : '', breite: old ? old.breite || 0 : 0, hoehe: old ? old.hoehe || 0 : 0,
      ausschnitt: $('f-focus').value
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
    const btn = $('st-save');
    btn.disabled = true;
    try {
      if (image) {
        const path = await freePath(A.HD.slug(titel, 60) || 'foto', image.ext, old);
        await A.saveFile(path, image.blob);
        Object.assign(entry, { bild: path, breite: image.w, hoehe: image.h });
      }
      const direct = await persist(next);
      await A.credits.set(entry.bild, $('f-credit').value);
      $('st-dlg').close();
      render();
      flash(pos);
      A.toast(direct ? `Gespeichert: ${titel}.` : `${titel} übernommen. Bitte unten die Datei herunterladen.`);
      A.log(`Startseite ${old ? 'geändert' : 'ergänzt'}: ${titel}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function remove(i) {
    const b = list[i];
    const ok = await A.confirmBox({
      title: 'Foto von der Startseite entfernen?',
      html: `<strong>${esc(b.titel)}</strong><br><br>Das Foto verschwindet von der Startseite. Die Bilddatei bleibt im Ordner erhalten.` +
        (list.length === 1 ? '<br><br>Es ist das letzte Foto. Danach zeigt die Startseite wieder den Kirchturm.' : ''),
      ok: 'Entfernen', danger: true
    });
    if (!ok) return;
    try {
      const next = list.slice();
      next.splice(i, 1);
      const direct = await persist(next);
      if ($('st-dlg').open) $('st-dlg').close();
      render();
      A.toast(direct ? `Entfernt: ${b.titel}.` : 'Entfernt. Bitte unten die Datei herunterladen.');
      A.log(`Startseite entfernt: ${b.titel}`);
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
    A.wireDrop($('st-drop'));
    wirePan();
    $('st-new').addEventListener('click', () => openEditor());
    $('st-form').addEventListener('submit', save);
    $('st-delete').addEventListener('click', () => { if (edit >= 0) remove(edit); });
    $('st-secs').addEventListener('change', async (ev) => {
      try {
        const direct = await persist(list, Number(ev.target.value));
        A.toast(direct ? `Wechsel alle ${seconds} Sekunden.` : 'Gespeichert. Bitte unten die Datei herunterladen.');
        A.log(`Startseite: Wechsel alle ${seconds} Sekunden`);
      } catch (err) {
        ev.target.value = String(seconds);
        A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
      }
    });
    $('st-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      const i = Number(b.dataset.i);
      const act = b.dataset.act;
      if (act === 'edit') openEditor(i);
      else if (act === 'del') remove(i);
      else if (act === 'up' || act === 'down') move(i, act === 'up' ? -1 : 1);
      else if (act === 'new') openEditor();
    });
    A.guard(() => $('st-dlg').open && dirtyState() !== snap);
    A.folder.on((state) => { if (state === 'ok') load(); });
    await load();
    if (new URLSearchParams(location.search).has('neu')) {
      openEditor();
      history.replaceState(null, '', location.pathname);
    }
  });
})();
