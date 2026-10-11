/* ============================================================
   Augustinerkirche Wien — admin-startseite.js
   Titelfotos im Vollbild-Start der Hauptseiten pflegen (admin/startseite.html), je Thema
   eine Datei (THEMES: Augustinerkirche = Startseite data/startseite.json, Kirchenmusik,
   Augustiner, Aspersdorf = data/startseite-<thema>.json):
   {sekunden, bilder: [{titel, bild, breite, hoehe, ausschnitt ("x% y%")}], frueher: [wie bilder]}.
   Ein Foto steht still, mehrere wechseln nacheinander (js/main.js). Fotos der anderen
   Themen lassen sich ebenfalls wieder verwenden. Hinzufuegen (auch mehrere Fotos auf einmal), ersetzen,
   Ausschnitt waehlen, Reihenfolge, Bildnachweis, Wechselzeit. Entfernte Fotos merkt
   sich "frueher", damit sie sich spaeter wieder verwenden lassen; mit verbundenem
   Projektordner kommen auch die uebrigen Bilder aus assets/img/startseite/ dazu.
   Benoetigt js/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { $, esc, icon } = A;
  /* Themen mit eigener Hauptseite (spaeter eigene Domains); leer: was die Seite ohne eigene Fotos zeigt */
  const THEMES = [
    { key: 'augustinerkirche', label: 'Augustinerkirche', path: 'data/startseite.json', seite: '../index.html', name: 'Startseite', leer: 'den Kirchturm' },
    { key: 'kirchenmusik', label: 'Kirchenmusik', path: 'data/startseite-kirchenmusik.json', seite: '../pages/musik.html', name: 'Seite Kirchenmusik', leer: 'den Innenraum der Kirche' },
    { key: 'augustiner', label: 'Augustiner', path: 'data/startseite-augustiner.json', seite: '../pages/augustiner.html', name: 'Seite Augustiner', leer: 'die Wiener Augustiner' },
    { key: 'aspersdorf', label: 'Aspersdorf', path: 'data/startseite-aspersdorf.json', seite: '../pages/aspersdorf.html', name: 'Seite Aspersdorf', leer: 'die Pfarrkirche St. Georg' }
  ];
  let theme = THEMES.find((t) => t.key === new URLSearchParams(location.search).get('thema')) || THEMES[0];
  const IMG_DIR = 'assets/img/startseite/';
  const SECS = [4, 6, 8, 10, 15, 20];
  const KEEP = 60;        /* so viele fruehere Fotos merkt sich die Datei */

  let list = [];
  let seconds = 6;
  let edit = -1;          /* Index oder -1 = neu */
  let snap = '';
  let image = null;       /* beim Bearbeiten neu gewaehltes Foto {blob, ext, url, name, w, h} */
  let previous = [];      /* frueher verwendete Fotos (data/startseite.json, "frueher") */
  let extra = [];         /* weitere Bilder im Ordner assets/img/startseite/ (nur mit Projektordner) */
  let pool = [];          /* Fotos der anderen Themen (aktuelle und fruehere) */
  /* Beim Hinzufuegen gewaehlte Fotos: neue Dateien {neu: true, blob, ext, url, name, w, h, titel, ausschnitt}
     oder fruehere {neu: false, bild, url, w, h, titel, ausschnitt}; dazu je ein Bildnachweis (credit) */
  let picks = [];

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  /* ---------- Laden und Liste ---------- */
  async function load() {
    const t = theme;
    renderTabs();
    try {
      const d = (await A.readJSON(t.path));
      if (!d || !Array.isArray(d.bilder)) throw new Error('unerwarteter Inhalt');
      list = d.bilder;
      previous = Array.isArray(d.frueher) ? d.frueher.filter((b) => b && b.bild) : [];
      seconds = SECS.includes(Number(d.sekunden)) ? Number(d.sekunden) : 6;
    } catch (e) {
      if (e && (e.status === 404 || e.name === 'NotFoundError')) {
        /* Datei gibt es (auf dem Server) noch nicht: leer beginnen, beim ersten Speichern entsteht sie */
        list = [];
        previous = [];
        seconds = 6;
      } else {
        $('st-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Datei <code>${t.path}</code> konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
        return;
      }
    }
    if (t !== theme) return;   /* inzwischen anderes Thema gewaehlt */
    render();
    const [folder, ...rest] = await Promise.all([folderPhotos(), ...THEMES.filter((o) => o !== t).map((o) =>
      fetchTheme(o).catch(() => null))]);
    extra = folder;
    pool = rest.filter(Boolean).flatMap((d) => [...(d.bilder || []), ...(d.frueher || [])]).filter((b) => b && b.bild);
  }
  /* Andere Themen nur lesen (ohne die Datei fuers Speichern zu sperren, falls sie fehlt) */
  async function fetchTheme(o) {
    const text = A.folder.state === 'ok' ? await (await A.folder.readBlob(o.path)).text() : await A.fetchText(o.path);
    return JSON.parse(text);
  }
  function renderTabs() {
    for (const b of document.querySelectorAll('#st-themes .adm-seg-btn')) b.setAttribute('aria-pressed', String(b.dataset.thema === theme.key));
    $('st-open').href = theme.seite;
    $('st-open').textContent = `${theme.name} ansehen`;
  }
  function switchTheme(key) {
    const next = THEMES.find((t) => t.key === key);
    if (!next || next === theme) return;
    theme = next;
    list = [];
    previous = [];
    pool = [];
    history.replaceState(null, '', `${location.pathname}${theme === THEMES[0] ? '' : `?thema=${theme.key}`}`);
    $('st-list').innerHTML = '<p class="adm-muted">Wird geladen …</p>';
    load();
  }

  /* Bilder im Ordner assets/img/startseite/ (der Webserver zeigt keine Ordnerinhalte,
     deshalb nur mit verbundenem Projektordner) */
  async function folderPhotos() {
    const f = A.folder;
    if (f.state !== 'ok' || f.server || !f.handle) return [];
    try {
      let dir = f.handle;
      for (const part of IMG_DIR.split('/').filter(Boolean)) dir = await dir.getDirectoryHandle(part);
      const out = [];
      for await (const [name, h] of dir.entries()) {
        if (h.kind === 'file' && /\.(webp|jpe?g|png)$/i.test(name)) out.push(IMG_DIR + name);
      }
      return out.sort();
    } catch {
      return [];
    }
  }
  const titleOf = (name) => clean(String(name).split('/').pop().replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));
  /* Fruehere Fotos, die gerade nicht auf dieser Seite stehen: zuletzt entfernte zuerst,
     dann die Fotos der anderen Themen, dann weitere Bilder aus dem Ordner */
  function others() {
    const used = new Set(list.map((b) => b.bild));
    const out = previous.filter((b) => !used.has(b.bild));
    const known = new Set(out.map((b) => b.bild));
    for (const b of pool) {
      if (!used.has(b.bild) && !known.has(b.bild)) {
        out.push({ titel: b.titel || titleOf(b.bild), bild: b.bild, breite: b.breite || 0, hoehe: b.hoehe || 0, ausschnitt: b.ausschnitt || '' });
        known.add(b.bild);
      }
    }
    for (const path of extra) {
      if (!used.has(path) && !known.has(path)) out.push({ titel: titleOf(path), bild: path, breite: 0, hoehe: 0, ausschnitt: '' });
    }
    return out;
  }
  /* Foto vorne in die Liste der frueheren aufnehmen */
  const remember = (prev, b) => [{ titel: b.titel, bild: b.bild, breite: b.breite || 0, hoehe: b.hoehe || 0, ausschnitt: b.ausschnitt || '' },
    ...prev.filter((p) => p.bild !== b.bild)].slice(0, KEEP);

  function rowHTML(b, i) {
    return `<li class="adm-row" data-key="${i}">` +
      `<button type="button" class="adm-row-open adm-st" data-act="edit" data-i="${i}">` +
        `<span class="adm-thumb"><img src="${esc(A.imageUrl(b.bild))}" alt=""${A.focusPos(b.ausschnitt) ? ` style="object-position:${A.focusPos(b.ausschnitt)}"` : ''} loading="lazy"/></span>` +
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
      : `<div class="adm-empty"><p class="adm-empty-title">Noch kein Foto eingetragen</p><p>Ohne eigene Fotos zeigt die ${esc(theme.name)} ${esc(theme.leer)}.</p><button type="button" class="btn btn-gold" data-act="new">${icon('plus')}Fotos hinzufügen</button></div>`;
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

  async function persist(next, secs = seconds, prev = previous) {
    const direct = await A.saveFile(theme.path, JSON.stringify({ sekunden: secs, bilder: next, frueher: prev }, null, 2) + '\n');
    list = next;
    seconds = secs;
    previous = prev;
    return direct;
  }

  /* ---------- Fenster: Foto und Ausschnitt ---------- */
  const current = () => (edit >= 0 ? list[edit] : null);
  const single = () => (edit < 0 && picks.length === 1 ? picks[0] : null);
  function srcNow() {
    if (edit < 0) return single() ? single().url : '';
    return image ? image.url : A.imageUrl(current().bild);
  }
  function renderImage() {
    const cur = current();
    $('st-imginfo').textContent = image ? `${image.name} · ${image.w} × ${image.h} Pixel` : cur ? `Aktuelles Foto: ${cur.bild}` : '';
  }

  /* ---------- Hinzufuegen: neue Dateien und fruehere Fotos ---------- */
  /* Ausschnitt eines einzeln gewaehlten Fotos festhalten, bevor sich die Auswahl aendert */
  function keepFocus() {
    if (single()) single().ausschnitt = $('f-focus').value;
  }
  function pickHTML(p, k) {
    const info = p.neu ? `Neu · ${p.name}${p.w ? ` · ${p.w} × ${p.h} Pixel` : ''}` : `Früheres Foto · ${p.bild.split('/').pop()}`;
    return `<div class="adm-ph" data-k="${k}">` +
      `<span class="adm-thumb adm-st-pthumb"><img src="${esc(p.url)}" alt=""/></span>` +
      '<div class="adm-ph-fields">' +
        `<label class="adm-label" for="st-pk-${k}">Beschreibung<span class="adm-req">Pflichtfeld</span></label>` +
        `<input class="adm-input" type="text" id="st-pk-${k}" data-k="${k}" data-f="titel" value="${esc(p.titel)}"/>` +
        `<span class="adm-hint">${esc(info)}</span>` +
        `<label class="adm-label" for="st-pc-${k}">Bildnachweis</label>` +
        `<input class="adm-input" type="text" id="st-pc-${k}" data-k="${k}" data-f="credit" value="${esc(p.credit)}" placeholder="z. B. © Augustiner Wien, Foto: Max Muster"/>` +
        (k === 0 && picks.length > 1 ? `<button type="button" class="adm-act adm-st-credall" data-credall>${icon('copy')}Diesen Bildnachweis für alle Fotos übernehmen</button>` : '') +
      '</div>' +
      `<div class="adm-ph-act"><button type="button" class="adm-act icon danger" data-unpick="${k}" aria-label="Nicht hinzufügen: ${esc(p.titel)}" title="Nicht hinzufügen">${icon('close')}</button></div>` +
      '</div>';
  }
  function renderPicks() {
    const box = $('st-picks');
    box.hidden = edit >= 0 || !picks.length;
    box.innerHTML = picks.length
      ? `<p class="adm-label">${picks.length === 1 ? 'Gewähltes Foto' : `${picks.length} Fotos gewählt`}</p>` +
        '<p class="adm-hint">Die Beschreibung wird nicht angezeigt, sondern Sehbehinderten vorgelesen. Der Bildnachweis steht auf der Website klein rechts unten im Foto.</p>' +
        `<div class="adm-ph-list">${picks.map(pickHTML).join('')}</div>` +
        (picks.length > 1 ? '<p class="adm-hint">Den Ausschnitt jedes Fotos kannst du danach in der Liste einstellen (Foto anklicken).</p>' : '')
      : '';
    renderOld();
    renderPan();
  }
  function renderOld() {
    const box = $('st-old');
    const all = edit < 0 ? others() : [];
    box.hidden = !all.length;
    if (!all.length) {
      box.innerHTML = '';
      return;
    }
    const chosen = new Set(picks.filter((p) => !p.neu).map((p) => p.bild));
    box.innerHTML = '<legend>Frühere Fotos wieder verwenden</legend>' +
      `<p class="adm-hint">Fotos, die schon einmal hier waren oder auf einer anderen Hauptseite stehen. Antippen, um sie wieder hinzuzufügen, gern auch mehrere.${all.length > 1 ? ' Nach links und rechts wischen oder die Pfeile nutzen, um alle zu sehen.' : ''}</p>` +
      '<div class="adm-st-oldwrap">' +
      `<button type="button" class="adm-st-oldnav prev" data-scroll="-1" aria-label="Weiter nach links" title="Nach links" hidden>${icon('left')}</button>` +
      '<div class="adm-st-old">' + all.map((b) => {
        const on = chosen.has(b.bild);
        return `<button type="button" class="adm-st-oldbtn" data-old="${esc(b.bild)}" aria-pressed="${on}" title="${esc(b.titel)}">` +
          `<span class="adm-st-oldimg"><img src="${esc(A.imageUrl(b.bild))}" alt=""${A.focusPos(b.ausschnitt) ? ` style="object-position:${A.focusPos(b.ausschnitt)}"` : ''} loading="lazy"/>` +
          `<span class="adm-st-oldmark" aria-hidden="true">${icon('check')}</span></span>` +
          `<span class="adm-st-oldcap">${esc(b.titel)}</span></button>`;
      }).join('') + '</div>' +
      `<button type="button" class="adm-st-oldnav next" data-scroll="1" aria-label="Weiter nach rechts" title="Nach rechts" hidden>${icon('right')}</button>` +
      '</div>';
    const strip = box.querySelector('.adm-st-old');
    strip.addEventListener('scroll', () => oldNav(), { passive: true });
    oldNav();
  }
  /* Pfeile nur zeigen, wenn es in diese Richtung noch etwas zu sehen gibt */
  function oldNav() {
    const strip = $('st-old').querySelector('.adm-st-old');
    if (!strip) return;
    const max = strip.scrollWidth - strip.clientWidth;
    $('st-old').querySelector('.prev').hidden = strip.scrollLeft <= 2;
    $('st-old').querySelector('.next').hidden = strip.scrollLeft >= max - 2;
  }
  function scrollOld(dir) {
    const strip = $('st-old').querySelector('.adm-st-old');
    strip.scrollBy({ left: dir * strip.clientWidth * 0.8, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  function toggleOld(path) {
    keepFocus();
    const k = picks.findIndex((p) => !p.neu && p.bild === path);
    if (k >= 0) {
      picks.splice(k, 1);
    } else {
      const b = others().find((o) => o.bild === path);
      if (!b) return;
      picks.push({ neu: false, bild: b.bild, url: A.imageUrl(b.bild), w: b.breite || 0, h: b.hoehe || 0, titel: b.titel, ausschnitt: b.ausschnitt || '', credit: A.credits.get(b.bild) });
    }
    afterPick();
  }
  function unpick(k) {
    keepFocus();
    const [p] = picks.splice(k, 1);
    if (p && p.neu) URL.revokeObjectURL(p.url);
    afterPick();
  }
  function afterPick() {
    const one = single();
    $('f-focus').value = one ? A.focusPos(one.ausschnitt) || '' : '';
    renderPicks();
  }
  /* Groesse eines Bildes, falls nicht bekannt (Bilder aus dem Ordner) */
  function sizeOf(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 0, h: 0 });
      img.src = url;
    });
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
    for (const b of document.querySelectorAll('#st-dlg .adm-seg-btn')) b.setAttribute('aria-pressed', String(b.dataset.view === view));
    $('st-pan-field').hidden = !src;
    box.innerHTML = src ? `<img src="${esc(src)}" alt="" draggable="false"${A.focusPos($('f-focus').value) ? ` style="object-position:${A.focusPos($('f-focus').value)}"` : ''}/>` : '';
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
    for (const b of document.querySelectorAll('#st-dlg .adm-seg-btn')) {
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

  /* Datei umwandeln (WebP, hoechstens 2000 Pixel) und Groesse bestimmen */
  async function prepare(file) {
    const conv = await A.toWebp(file, { maxSize: 2000, quality: 0.86 });
    let w = 0;
    let h = 0;
    try {
      const bmp = await createImageBitmap(conv.blob);
      w = bmp.width;
      h = bmp.height;
      if (bmp.close) bmp.close();
    } catch { /* Groesse unbekannt */ }
    return { ...conv, url: URL.createObjectURL(conv.blob), name: file.name, w, h };
  }
  async function onFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    if (imgs.length < files.length) A.toast(imgs.length ? 'Nur Bilddateien werden übernommen (WebP, JPG oder PNG).' : 'Bitte eine Bilddatei wählen (WebP, JPG oder PNG).', 'err');
    if (!imgs.length) return;
    /* Bearbeiten: ein Foto ersetzt das bisherige */
    if (edit >= 0) {
      let next;
      try {
        next = await prepare(imgs[0]);
      } catch {
        return;   /* Meldung kam schon von toWebp */
      }
      if (image) URL.revokeObjectURL(image.url);
      image = next;
      if (!$('f-titel').value.trim()) $('f-titel').value = titleOf(imgs[0].name);
      $('f-focus').value = '';
      renderImage();
      renderPan();
      return;
    }
    keepFocus();
    $('st-imginfo').textContent = imgs.length > 1 ? `${imgs.length} Fotos werden vorbereitet …` : 'Foto wird vorbereitet …';
    for (const file of imgs) {
      try {
        /* neues Foto: Bildnachweis des zuletzt gewaehlten vorschlagen (oft derselbe Fotograf) */
        const last = picks.length ? picks[picks.length - 1].credit : '';
        picks.push({ neu: true, ...(await prepare(file)), titel: titleOf(file.name), ausschnitt: '', credit: last || '' });
      } catch { /* Meldung kam schon von toWebp */ }
    }
    $('st-imginfo').textContent = '';
    afterPick();
  }
  /* Freier Dateiname; das eigene Foto darf ersetzt werden. taken: in diesem Durchgang schon vergeben */
  async function freePath(base, ext, old, taken = new Set()) {
    const used = new Set([...taken, ...list.map((b) => b.bild), ...previous.map((b) => b.bild), ...extra]);
    if (old) used.delete(old.bild);
    const busy = async (p) => used.has(p) || (A.folder.state === 'ok' && !(old && old.bild === p) && await A.folder.exists(p));
    let path = `${IMG_DIR}${base}.${ext}`;
    for (let n = 2; await busy(path); n++) path = `${IMG_DIR}${base}-${n}.${ext}`;
    return path;
  }
  const dirtyState = () => A.snapshot($('st-form')) + (image ? 'neu' : '') + picks.map((p) => p.bild || p.url).join('|');

  function openEditor(i) {
    edit = i === undefined ? -1 : i;
    const b = current();
    const form = $('st-form');
    form.reset();
    A.clearErrors(form);
    $('f-titel').value = b ? b.titel : '';
    $('f-credit').value = A.credits.get(b && b.bild);
    $('st-credit-field').hidden = !b;
    $('st-fs-text').textContent = b ? 'Beschriftung' : 'Reihenfolge';
    if (image) URL.revokeObjectURL(image.url);
    image = null;
    for (const p of picks) if (p.neu) URL.revokeObjectURL(p.url);
    picks = [];
    $('f-file').value = '';
    $('f-file').multiple = !b;
    $('st-drop-main').innerHTML = b ? 'Anderes Foto hierher ziehen oder <u>auswählen</u>' : 'Fotos hierher ziehen oder <u>auswählen</u>, auch mehrere auf einmal';
    $('f-focus').value = b ? A.focusPos(b.ausschnitt) : '';
    $('st-titel-field').hidden = !b;
    renderImage();
    renderPicks();
    $('f-pos').value = 'ende';
    $('st-pos-field').hidden = !!b;
    $('st-dlg-tag').textContent = b ? `Foto ${edit + 1}` : 'Hinzufügen';
    $('st-dlg-title').textContent = b ? b.titel : 'Fotos hinzufügen';
    $('st-delete').hidden = !b;
    A.openDialog($('st-dlg'), { isDirty: () => dirtyState() !== snap });
    snap = dirtyState();
  }

  /* Hinzufuegen: alle gewaehlten Fotos auf einmal (neue Dateien und fruehere Fotos) */
  async function saveNew() {
    const form = $('st-form');
    keepFocus();
    const errors = [];
    if (!picks.length) errors.push([$('f-file'), 'Bitte ein Foto wählen oder ein früheres antippen.']);
    picks.forEach((p, k) => {
      p.titel = clean(p.titel);
      if (!p.titel) errors.push([$(`st-pk-${k}`), 'Bitte eine Beschreibung eintragen.']);
    });
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }
    const btn = $('st-save');
    btn.disabled = true;
    try {
      const taken = new Set();
      const entries = [];
      const creditMap = {};
      for (const p of picks) {
        const entry = { titel: p.titel, bild: p.bild || '', breite: p.w || 0, hoehe: p.h || 0, ausschnitt: p.ausschnitt || '' };
        if (p.neu) {
          const path = await freePath(A.HD.slug(p.titel, 60) || 'foto', p.ext, null, taken);
          taken.add(path);
          await A.saveFile(path, p.blob);
          entry.bild = path;
          if (clean(p.credit)) creditMap[path] = clean(p.credit);
        } else {
          if (!entry.breite) {
            const size = await sizeOf(p.url);
            Object.assign(entry, { breite: size.w, hoehe: size.h });
          }
          creditMap[p.bild] = clean(p.credit);
        }
        entries.push(entry);
      }
      const atStart = $('f-pos').value === 'anfang';
      const next = atStart ? [...entries, ...list] : [...list, ...entries];
      const reused = new Set(entries.map((e) => e.bild));
      const direct = await persist(next, seconds, previous.filter((b) => !reused.has(b.bild)));
      if (Object.keys(creditMap).length) await A.credits.save(creditMap);
      const n = entries.length;
      $('st-dlg').close();
      render();
      for (let k = 0; k < n; k++) flash(atStart ? k : next.length - n + k);
      const what = n === 1 ? entries[0].titel : `${n} Fotos`;
      A.toast(direct ? `Hinzugefügt: ${what}.` : `${what} übernommen. Bitte unten die Dateien herunterladen.`);
      A.log(`Titelfotos ${theme.label} ergänzt: ${entries.map((e) => e.titel).join(', ')}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function save(ev) {
    ev.preventDefault();
    if (edit < 0) return saveNew();
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
      let prev = previous;
      if (image) {
        const path = await freePath(A.HD.slug(titel, 60) || 'foto', image.ext, old);
        await A.saveFile(path, image.blob);
        Object.assign(entry, { bild: path, breite: image.w, hoehe: image.h });
        /* das ersetzte Foto bleibt erhalten und laesst sich spaeter wieder verwenden */
        if (old && old.bild !== path && !next.some((b) => b.bild === old.bild)) prev = remember(prev, old);
      }
      const direct = await persist(next, seconds, prev);
      await A.credits.set(entry.bild, $('f-credit').value);
      $('st-dlg').close();
      render();
      flash(pos);
      A.toast(direct ? `Gespeichert: ${titel}.` : `${titel} übernommen. Bitte unten die Datei herunterladen.`);
      A.log(`Titelfotos ${theme.label} ${old ? 'geändert' : 'ergänzt'}: ${titel}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function remove(i) {
    const b = list[i];
    const ok = await A.confirmBox({
      title: `Foto von der ${theme.name} entfernen?`,
      html: `<strong>${esc(b.titel)}</strong><br><br>Das Foto verschwindet von der ${esc(theme.name)}. Die Bilddatei bleibt erhalten, unter „Fotos hinzufügen“ lässt es sich später wieder verwenden.` +
        (list.length === 1 ? `<br><br>Es ist das letzte Foto. Danach zeigt die ${esc(theme.name)} wieder ${esc(theme.leer)}.` : ''),
      ok: 'Entfernen', danger: true
    });
    if (!ok) return;
    try {
      const next = list.slice();
      next.splice(i, 1);
      const direct = await persist(next, seconds, next.some((x) => x.bild === b.bild) ? previous : remember(previous, b));
      if ($('st-dlg').open) $('st-dlg').close();
      render();
      A.toast(direct ? `Entfernt: ${b.titel}.` : 'Entfernt. Bitte unten die Datei herunterladen.');
      A.log(`Titelfotos ${theme.label} entfernt: ${b.titel}`);
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
    $('st-themes').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-thema]');
      if (b) switchTheme(b.dataset.thema);
    });
    A.credits.load();
    $('f-file').addEventListener('change', async (ev) => {
      await onFiles(ev.target.files);
      ev.target.value = '';   /* dieselbe Datei laesst sich so noch einmal waehlen */
    });
    A.wireDrop($('st-drop'));
    $('st-picks').addEventListener('input', (ev) => {
      const { k, f } = ev.target.dataset;
      if (k !== undefined && f && picks[k]) picks[k][f] = ev.target.value;
    });
    $('st-picks').addEventListener('click', (ev) => {
      if (ev.target.closest('[data-credall]')) {
        const text = clean(picks[0] && picks[0].credit);
        picks.forEach((p, k) => {
          p.credit = text;
          $(`st-pc-${k}`).value = text;
        });
        A.toast(text ? 'Bildnachweis für alle Fotos übernommen.' : 'Bildnachweis bei allen Fotos geleert.');
        return;
      }
      const b = ev.target.closest('[data-unpick]');
      if (b) unpick(Number(b.dataset.unpick));
    });
    $('st-old').addEventListener('click', (ev) => {
      const nav = ev.target.closest('[data-scroll]');
      if (nav) return scrollOld(Number(nav.dataset.scroll));
      const b = ev.target.closest('[data-old]');
      if (b) toggleOld(b.dataset.old);
    });
    window.addEventListener('resize', () => oldNav());
    /* Bilddatei gibt es nicht mehr: nicht anbieten */
    $('st-old').addEventListener('error', (ev) => {
      const b = ev.target.closest && ev.target.closest('.adm-st-oldbtn');
      if (b && b.getAttribute('aria-pressed') !== 'true') {
        b.hidden = true;
        oldNav();
      }
    }, true);
    wirePan();
    $('st-new').addEventListener('click', () => openEditor());
    $('st-form').addEventListener('submit', save);
    $('st-delete').addEventListener('click', () => { if (edit >= 0) remove(edit); });
    $('st-secs').addEventListener('change', async (ev) => {
      try {
        const direct = await persist(list, Number(ev.target.value));
        A.toast(direct ? `Wechsel alle ${seconds} Sekunden.` : 'Gespeichert. Bitte unten die Datei herunterladen.');
        A.log(`Titelfotos ${theme.label}: Wechsel alle ${seconds} Sekunden`);
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
      history.replaceState(null, '', `${location.pathname}${theme === THEMES[0] ? '' : `?thema=${theme.key}`}`);
    }
  });
})();
