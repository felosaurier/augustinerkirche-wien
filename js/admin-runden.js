/* ============================================================
   Augustinerkirche Wien — admin-runden.js
   Runden pflegen (admin/runden.html), Quelle ist data/runden.json.
   - Liste in der Reihenfolge der Uebersicht, mit Pfeilen umstellbar;
     naechster Termin und Hinweis, wenn alle Termine vorbei sind
   - Bearbeiten im Fenster: Uebersicht (Name, Kurzbeschreibung,
     eigene Seite oder Verweis), Kopf der Seite, Texte, Terminreihen
     mit Datumsauswahl, "Auf einen Blick", Kontakt, Plakat oder Foto
   - Neue Runden bekommen ihre Seite ueber pages/runden/runde.html?id=…
   Benoetigt js/hochaemter-data.js und js/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { HD, $, esc, icon } = A;
  const PATH = 'data/runden.json';
  const IMG_DIR = 'assets/img/runden/';

  let runden = [];
  let editIndex = -1;
  let blocks = [];        /* Terminreihen im Fenster: {label, name, zeit, ort, daten: [JJJJ-MM-TT]} */
  let fakten = null;
  let image = null;       /* neu gewaehltes Bild {blob, ext, url, name, w, h} */
  let removeImage = false;
  let snap = '';

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const lines = (s) => String(s || '').split(/\n+/).map(clean).filter(Boolean);
  const art = () => (document.querySelector('input[name="art"]:checked') || {}).value || 'seite';
  const bildart = () => (document.querySelector('input[name="bildart"]:checked') || {}).value || 'plakat';
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const pageHref = (r) => `../${r.link || r.seite || `pages/runden/runde.html?id=${encodeURIComponent(r.id)}`}`;
  function dateLabel(iso) {
    const dt = HD.dateFromIso(iso);
    return `${HD.WEEKDAYS_SHORT[dt.getDay()]} ${dt.getDate()}.${HD.pad(dt.getMonth() + 1)}.${dt.getFullYear()}`;
  }
  /* Naechster Termin ab heute; '' wenn keiner, null wenn es keine Termine gibt */
  function nextDate(r) {
    const all = (r.termine || []).flatMap((b) => b.daten || []);
    if (!all.length) return null;
    return all.filter((d) => d >= A.isoToday()).sort()[0] || '';
  }

  /* ---------- Liste ---------- */
  async function load() {
    try {
      runden = JSON.parse(await A.readText(PATH)).runden || [];
    } catch (e) {
      $('rd-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Runden konnten nicht geladen werden (${esc(e.message)}).</div></div>`;
      return;
    }
    render();
  }

  function render() {
    const shown = runden.filter((r) => r.sichtbar !== false).length;
    $('rd-count').textContent = `${plural(runden.length, 'Runde', 'Runden')} · ${shown} in der Übersicht · Reihenfolge wie auf der Website`;
    if (!runden.length) {
      $('rd-list').innerHTML = `<div class="adm-empty"><p class="adm-empty-title">Noch keine Runden</p><p>Lege die erste Runde an.</p><button type="button" class="btn btn-gold" data-act="new">${icon('plus')}Neue Runde</button></div>`;
      return;
    }
    $('rd-list').innerHTML = '<ul class="adm-rows">' + runden.map((r, i) => {
      const src = r.bild && r.bild.pfad ? A.imageUrl(r.bild.pfad) : '';
      const next = nextDate(r);
      return `<li class="adm-row" data-key="${esc(r.id)}">` +
        `<button type="button" class="adm-row-open has-thumb" data-act="edit" data-i="${i}">` +
          (src ? `<span class="adm-thumb${r.bild.art === 'foto' ? ' photo' : ''}"><img src="${esc(src)}" alt="" loading="lazy"/></span>`
            : '<span class="adm-thumb none"><img src="../assets/logo-gold.png" alt=""/></span>') +
          '<span class="adm-row-body">' +
            `<span class="adm-row-title">${esc(r.titel)}</span>` +
            `<span class="adm-row-people">${esc(r.kurztext)}</span>` +
            (next ? `<span class="adm-chip past">${icon('calendar')}Nächster Termin: ${esc(dateLabel(next))}</span>` : '') +
            (next === '' ? `<span class="adm-chip">${icon('alert')}Alle Termine sind vorbei: neue eintragen</span>` : '') +
          '</span>' +
          `<span>${r.sichtbar === false ? '<span class="adm-badge">Ausgeblendet</span>' : r.link ? '<span class="adm-badge">Verweis</span>' : '<span class="adm-badge on">Eigene Seite</span>'}</span>` +
        '</button>' +
        '<div class="adm-row-actions">' +
          `<button type="button" class="adm-act icon" data-act="up" data-i="${i}" aria-label="Nach oben: ${esc(r.titel)}"${i === 0 ? ' disabled' : ''}>${icon('up')}</button>` +
          `<button type="button" class="adm-act icon" data-act="down" data-i="${i}" aria-label="Nach unten: ${esc(r.titel)}"${i === runden.length - 1 ? ' disabled' : ''}>${icon('down')}</button>` +
          `<button type="button" class="adm-act danger" data-act="del" data-i="${i}" aria-label="Löschen: ${esc(r.titel)}">${icon('trash')}Löschen</button>` +
        '</div></li>';
    }).join('') + '</ul>';
  }

  function flash(key, focusSel = '.adm-row-open') {
    const row = document.querySelector(`.adm-row[data-key="${CSS.escape(key)}"]`);
    if (!row) return;
    row.classList.remove('flash');
    void row.offsetWidth;
    row.classList.add('flash');
    row.scrollIntoView({ block: 'nearest' });
    const target = row.querySelector(focusSel) || row.querySelector('.adm-row-open');
    target.focus({ preventScroll: true });
  }

  async function store(next, note) {
    const direct = await A.saveJSON(PATH, { runden: next });
    runden = next;
    render();
    A.toast(direct ? note : `${note} Bitte unten die Datei herunterladen.`);
    A.log(note);
  }

  async function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= runden.length) return;
    const next = runden.slice();
    [next[i], next[j]] = [next[j], next[i]];
    try {
      await store(next, `Reihenfolge geändert: ${next[j].titel}`);
      flash(next[j].id, `[data-act="${dir < 0 ? 'up' : 'down'}"]:not([disabled])`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  /* ---------- Fenster: Terminreihen ---------- */
  function syncBlocks() {
    /* Felder der Reihen: data-blk="Nummer", data-key="label|name|zeit|ort" */
    document.querySelectorAll('#rd-blocks [data-blk]').forEach((inp) => {
      const b = blocks[Number(inp.dataset.blk)];
      if (b) b[inp.dataset.key] = inp.value;
    });
  }
  function renderBlocks(focus) {
    const today = A.isoToday();
    $('rd-blocks').innerHTML = blocks.map((b, i) =>
      `<div class="adm-block" data-b="${i}">` +
        '<div class="adm-block-head"><div class="adm-field">' +
          `<label class="adm-label" for="blk-${i}">Überschrift der Reihe ${i + 1}</label>` +
          `<input class="adm-input" type="text" id="blk-${i}" data-blk="${i}" data-key="label" value="${esc(b.label)}" placeholder="z. B. Termine 2026/27 · donnerstags"/>` +
        '</div>' +
        `<button type="button" class="adm-act danger" data-del-block="${i}">${icon('trash')}Reihe entfernen</button></div>` +
        /* Fuer den Kalender: Name des Termins, Uhrzeit und Ort */
        '<div class="adm-grid adm-blk-cal">' +
          '<div class="adm-field">' +
            `<label class="adm-label" for="blk-name-${i}">Im Kalender als</label>` +
            `<input class="adm-input" type="text" id="blk-name-${i}" data-blk="${i}" data-key="name" value="${esc(b.name)}" placeholder="z. B. Seniorennachmittag"/>` +
          '</div>' +
          '<div class="adm-field">' +
            `<label class="adm-label" for="blk-zeit-${i}">Uhrzeit</label>` +
            `<input class="adm-input" type="time" id="blk-zeit-${i}" data-blk="${i}" data-key="zeit" value="${esc(b.zeit)}"/>` +
          '</div>' +
          '<div class="adm-field full">' +
            `<label class="adm-label" for="blk-ort-${i}">Ort</label>` +
            `<input class="adm-input" type="text" id="blk-ort-${i}" data-blk="${i}" data-key="ort" value="${esc(b.ort)}" placeholder="z. B. Pfarrsaal, Augustinerstraße 3"/>` +
          '</div>' +
        '</div>' +
        `<div class="adm-dates" role="list" aria-label="Termine der Reihe ${i + 1}">` +
          (b.daten.length ? b.daten.slice().sort().map((d) =>
            `<span class="adm-date-chip${d < today ? ' past' : ''}" role="listitem">${esc(dateLabel(d))}` +
            `<button type="button" data-del-date="${i}" data-date="${d}" aria-label="Termin ${esc(dateLabel(d))} entfernen">${icon('close')}</button></span>`
          ).join('') : '<span class="adm-muted">Noch keine Termine in dieser Reihe.</span>') +
        '</div>' +
        '<div class="adm-date-add">' +
          `<input class="adm-input" type="date" data-date-input="${i}" aria-label="Neuer Termin für Reihe ${i + 1}"/>` +
          `<button type="button" class="btn btn-quiet btn-sm" data-add-date="${i}">${icon('plus')}Termin hinzufügen</button>` +
          (b.daten.some((d) => d < today) ? `<button type="button" class="adm-act" data-clear-past="${i}">Vergangene entfernen</button>` : '') +
        '</div></div>'
    ).join('');
    if (focus) {
      const el = document.querySelector(focus);
      if (el) el.focus();
    }
  }
  function addDate(i) {
    const inp = document.querySelector(`[data-date-input="${i}"]`);
    const d = HD.isoDate(inp.value);
    if (!d) {
      A.toast('Bitte zuerst ein Datum wählen.', 'err');
      inp.focus();
      return;
    }
    syncBlocks();
    if (!blocks[i].daten.includes(d)) blocks[i].daten.push(d);
    renderBlocks(`[data-date-input="${i}"]`);
  }
  function onBlocksClick(ev) {
    const t = ev.target.closest('button');
    if (!t) return;
    syncBlocks();
    if (t.dataset.addDate !== undefined) addDate(Number(t.dataset.addDate));
    if (t.dataset.delDate !== undefined) {
      const b = blocks[Number(t.dataset.delDate)];
      b.daten = b.daten.filter((d) => d !== t.dataset.date);
      renderBlocks(`[data-date-input="${t.dataset.delDate}"]`);
    }
    if (t.dataset.clearPast !== undefined) {
      const b = blocks[Number(t.dataset.clearPast)];
      b.daten = b.daten.filter((d) => d >= A.isoToday());
      renderBlocks(`[data-date-input="${t.dataset.clearPast}"]`);
    }
    if (t.dataset.delBlock !== undefined) {
      blocks.splice(Number(t.dataset.delBlock), 1);
      renderBlocks('#rd-add-block');
    }
  }

  /* ---------- Fenster: Bild ---------- */
  function currentImage() {
    const r = editIndex >= 0 ? runden[editIndex] : null;
    return r && r.bild && r.bild.pfad && !removeImage ? r.bild : null;
  }
  function renderImage() {
    const cur = currentImage();
    const src = image ? image.url : cur ? A.imageUrl(cur.pfad) : '';
    $('rd-prev').innerHTML = src ? `<img src="${esc(src)}" alt="Vorschau des Bildes"/>` : '<span class="none">Noch kein Bild</span>';
    $('rd-imginfo').textContent = image
      ? `${image.name} · ${image.w} × ${image.h} Pixel${image.converted ? ' · in WebP umgewandelt' : ''}`
      : cur ? `Aktuelles Bild: ${cur.pfad}` : '';
    $('rd-img-remove').hidden = !src;
  }
  async function onFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      A.toast('Bitte eine Bilddatei wählen (WebP, JPG oder PNG).', 'err');
      return;
    }
    const conv = await A.toWebp(file);
    let w = 0;
    let h = 0;
    try {
      const bmp = await createImageBitmap(conv.blob);
      w = bmp.width;
      h = bmp.height;
      if (bmp.close) bmp.close();
    } catch {
      /* Groesse unbekannt: dann ohne width/height */
    }
    if (image) URL.revokeObjectURL(image.url);
    image = { ...conv, url: URL.createObjectURL(conv.blob), name: file.name, w, h };
    removeImage = false;
    if (!$('f-alt').value.trim()) $('f-alt').value = `${bildart() === 'plakat' ? 'Plakat' : 'Foto'} ${$('f-titel').value.trim()}`.trim();
    renderImage();
  }
  function dropImage() {
    if (image) {
      URL.revokeObjectURL(image.url);
      image = null;
    } else {
      removeImage = true;
    }
    $('f-file').value = '';
    renderImage();
  }

  /* ---------- Fenster: Oeffnen und Speichern ---------- */
  const dirtyState = () => A.snapshot($('rd-form')) + JSON.stringify(blocks) + (image ? 'neu' : '') + (removeImage ? 'weg' : '');
  function updateArt() {
    const isLink = art() === 'link';
    $('f-link-field').hidden = !isLink;
    $('rd-page').hidden = isLink;
  }

  function openEditor(i) {
    const r = i >= 0 ? runden[i] : null;
    editIndex = i;
    const form = $('rd-form');
    form.reset();
    A.clearErrors(form);
    const k = (r && r.kopf) || {};
    const s = (r && r.schwerpunkt) || {};
    const ko = (r && r.kontakt) || {};
    $('f-titel').value = r ? r.titel : '';
    $('f-kurztext').value = r ? r.kurztext : '';
    document.querySelector(`input[name="art"][value="${r && r.link ? 'link' : 'seite'}"]`).checked = true;
    $('f-link').value = r && r.link ? r.link : '';
    $('f-sichtbar').checked = !r || r.sichtbar !== false;
    $('f-zeile').value = k.zeile || '';
    $('f-betonung').value = k.betonung || '';
    $('f-untertitel').value = k.untertitel || '';
    $('f-einleitung').value = (r && r.einleitung || []).join('\n');
    $('f-sp-label').value = s.label || '';
    $('f-sp-titel').value = s.titel || '';
    $('f-sp-text').value = s.text || '';
    $('f-text').value = (r && r.text || []).join('\n');
    $('f-k-titel').value = ko.titel || 'Kontakt';
    $('f-k-text').value = ko.text || '';
    $('f-k-email').value = ko.email || '';
    $('f-k-telefon').value = ko.telefon || '';
    $('f-k-anschrift').value = ko.anschrift || '';
    blocks = (r && r.termine || []).map((b) => ({ label: b.label || '', name: b.name || '', zeit: b.zeit || '', ort: b.ort || '', daten: (b.daten || []).slice() }));
    renderBlocks();
    fakten.set((r && r.fakten || []).length ? r.fakten : [{ label: 'Zeit' }, { label: 'Ort' }, { label: 'Leitung' }]);
    if (image) URL.revokeObjectURL(image.url);
    image = null;
    removeImage = false;
    document.querySelector(`input[name="bildart"][value="${r && r.bild && r.bild.art === 'foto' ? 'foto' : 'plakat'}"]`).checked = true;
    $('f-alt').value = r && r.bild ? r.bild.alt || '' : '';
    $('f-credit').value = A.credits.get(r && r.bild && r.bild.pfad);
    renderImage();
    updateArt();

    $('rd-dlg-tag').textContent = r ? 'Runde bearbeiten' : 'Neue Runde';
    $('rd-dlg-title').textContent = r ? r.titel : 'Neue Runde';
    $('rd-delete').hidden = !r;
    $('rd-view').hidden = !r;
    if (r) $('rd-view').href = pageHref(r);
    A.openDialog($('rd-dlg'), { isDirty: () => dirtyState() !== snap });
    snap = dirtyState();
  }

  function uniqueId(title) {
    const base = HD.slug(title, 40) || 'runde';
    let id = base;
    for (let n = 2; runden.some((r, i) => r.id === id && i !== editIndex); n++) id = `${base}-${n}`;
    return id;
  }
  async function freeImagePath(id, ext, old) {
    let path = `${IMG_DIR}${id}.${ext}`;
    if (A.folder.state !== 'ok') return path;
    for (let n = 2; !(old && old.bild && old.bild.pfad === path) && await A.folder.exists(path); n++) path = `${IMG_DIR}${id}-${n}.${ext}`;
    return path;
  }

  async function save(ev) {
    ev.preventDefault();
    syncBlocks();
    const form = $('rd-form');
    const old = editIndex >= 0 ? runden[editIndex] : null;
    const titel = clean($('f-titel').value);
    const kurztext = clean($('f-kurztext').value);
    const link = clean($('f-link').value);
    const email = clean($('f-k-email').value);
    const errors = [];
    if (!titel) errors.push([$('f-titel'), 'Bitte den Namen der Runde eintragen.']);
    if (!kurztext) errors.push([$('f-kurztext'), 'Bitte eine Kurzbeschreibung für die Übersicht eintragen.']);
    if (art() === 'link' && (!link || !HD.safeUrl(link, '../'))) errors.push([$('f-link'), 'Bitte die Adresse der Seite eintragen, z. B. pages/musik.html#p-chor.']);
    if (art() === 'seite' && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push([$('f-k-email'), 'Diese E-Mail-Adresse sieht nicht richtig aus.']);
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }

    const id = old ? old.id : uniqueId(titel);
    const r = { id, titel, kurztext, sichtbar: $('f-sichtbar').checked };
    if (art() === 'link') {
      r.link = link;
    } else {
      if (old && old.seite) r.seite = old.seite;
      const ok = old && old.kopf && old.titel === titel ? old.kopf.titel : titel;
      const sp = { label: clean($('f-sp-label').value), titel: clean($('f-sp-titel').value), text: clean($('f-sp-text').value) };
      const ko = {
        titel: clean($('f-k-titel').value) || 'Kontakt', text: clean($('f-k-text').value), email,
        telefon: clean($('f-k-telefon').value), anschrift: clean($('f-k-anschrift').value)
      };
      Object.assign(r, {
        kopf: { zeile: clean($('f-zeile').value), titel: ok, betonung: clean($('f-betonung').value), untertitel: clean($('f-untertitel').value) },
        einleitung: lines($('f-einleitung').value),
        schwerpunkt: sp.titel || sp.text ? sp : null,
        text: lines($('f-text').value),
        termine: blocks.map((b) => ({ label: clean(b.label), name: clean(b.name), zeit: HD.isoTime(b.zeit), ort: clean(b.ort), daten: b.daten.slice().sort() }))
          .filter((b) => b.daten.length || b.label),
        fakten: fakten.values().map((f) => ({ label: clean(f.label), wert: clean(f.wert), zusatz: clean(f.zusatz) })).filter((f) => f.wert),
        kontakt: ko.email || ko.telefon || ko.anschrift ? ko : null,
        bild: currentImage() ? { ...currentImage(), art: bildart(), alt: clean($('f-alt').value) } : null
      });
    }
    const btn = $('rd-save');
    btn.disabled = true;
    try {
      if (image && art() === 'seite') {
        const path = await freeImagePath(id, image.ext, old);
        await A.saveFile(path, image.blob);
        r.bild = { pfad: path, art: bildart(), alt: clean($('f-alt').value), breite: image.w, hoehe: image.h };
      }
      const next = runden.slice();
      if (old) next[editIndex] = r;
      else next.push(r);
      await store(next, `Runde ${old ? 'gespeichert' : 'angelegt'}: ${titel}.`);
      if (r.bild && r.bild.pfad) await A.credits.set(r.bild.pfad, $('f-credit').value);
      $('rd-dlg').close();
      flash(id);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function remove(i) {
    const r = runden[i];
    const ok = await A.confirmBox({
      title: 'Runde löschen?',
      html: `<strong>${esc(r.titel)}</strong><br><br>Die Runde verschwindet aus der Übersicht.` +
        (r.seite ? ' Ihre bisherige Seite bleibt als Datei erhalten, ist aber nicht mehr verlinkt.' : ''),
      ok: 'Löschen', danger: true
    });
    if (!ok) return false;
    try {
      await store(runden.filter((x) => x !== r), `Runde gelöscht: ${r.titel}.`);
      return true;
    } catch (err) {
      A.toast(`Löschen nicht möglich: ${err.message}`, 'err');
      return false;
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    A.credits.load();
    fakten = A.listEditor($('rd-fakten'), {
      fields: [
        { key: 'label', label: 'Bezeichnung', placeholder: 'z. B. Ort', list: 'dl-rd-fakt' },
        { key: 'wert', label: 'Angabe', placeholder: 'z. B. Pfarrsaal, Augustinerstraße 3' },
        { key: 'zusatz', label: 'Zusatz', placeholder: 'klein darunter (optional)' }
      ],
      addLabel: 'Zeile hinzufügen', rowLabel: 'Angabe', labelFirst: true
    });
    $('rd-new').addEventListener('click', () => openEditor(-1));
    $('rd-form').addEventListener('submit', save);
    $('rd-form').addEventListener('change', (ev) => { if (ev.target.name === 'art') updateArt(); });
    $('rd-blocks').addEventListener('click', onBlocksClick);
    $('rd-blocks').addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && ev.target.dataset.dateInput !== undefined) {
        ev.preventDefault();
        addDate(Number(ev.target.dataset.dateInput));
      }
    });
    $('rd-add-block').addEventListener('click', () => {
      syncBlocks();
      blocks.push({ label: '', name: '', zeit: '', ort: '', daten: [] });
      renderBlocks(`#blk-${blocks.length - 1}`);
    });
    $('f-file').addEventListener('change', (ev) => onFile(ev.target.files[0]));
    A.wireDrop($('rd-drop'));
    $('rd-img-remove').addEventListener('click', dropImage);
    $('rd-delete').addEventListener('click', async () => {
      if (editIndex >= 0 && await remove(editIndex)) $('rd-dlg').close();
    });
    $('rd-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      const i = Number(b.dataset.i);
      if (b.dataset.act === 'edit') openEditor(i);
      if (b.dataset.act === 'up') move(i, -1);
      if (b.dataset.act === 'down') move(i, 1);
      if (b.dataset.act === 'del') remove(i);
      if (b.dataset.act === 'new') openEditor(-1);
    });
    A.guard(() => $('rd-dlg').open && dirtyState() !== snap);
    A.folder.on((state) => { if (state === 'ok') load(); });

    await load();
    const params = new URLSearchParams(location.search);
    const edit = params.get('bearbeiten');
    if (params.has('neu')) openEditor(-1);
    else if (edit) {
      const i = runden.findIndex((r) => r.id === edit);
      if (i >= 0) openEditor(i);
    }
    if (params.has('neu') || edit) history.replaceState(null, '', location.pathname);
  });
})();
