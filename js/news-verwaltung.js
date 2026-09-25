/* ============================================================
   Augustinerkirche Wien — news-verwaltung.js
   Interne Seite zum Anlegen, Bearbeiten und Loeschen von Neuigkeiten
   (data/news.csv) samt Plakat/Bild.
   - Chrome/Edge: Projektordner einmal verbinden, dann werden Tabelle
     und Bild direkt an die richtige Stelle gespeichert
     (File System Access API).
   - Sonst: Tabelle und Bild werden zum Herunterladen angeboten.
   Benoetigt js/hochaemter-data.js (CSV-Parser und Hilfen).
   ============================================================ */
(function () {
  'use strict';

  const HD = window.HochamtData;
  const HEAD = ['Datum', 'Kategorie', 'Titel', 'Kurztext', 'Infos', 'Details', 'Vorschaubild', 'Plakat', 'Link', 'Linktext'];
  const LATEST = 6;
  const CSV_TYPE = { type: 'text/csv;charset=utf-8' };

  let entries = [];         // Objekte mit den Schluesseln aus HEAD (Text)
  let root = null;          // Ordner-Handle (Projektordner)
  let editIndex = -1;       // -1 = neue Meldung
  let image = null;         // {blob, ext, url, converted}
  let pendingImage = null;  // Bild zum Herunterladen (ohne Ordner-Verbindung)
  let dirty = false;        // Aenderungen noch nicht gespeichert (ohne Ordner)

  const $ = (id) => document.getElementById(id);
  const { esc } = HD;
  function status(msg, kind) {
    const el = $('nv-status');
    el.textContent = msg;
    el.className = `nv-status${kind ? ` ${kind}` : ''}`;
  }

  /* ---------- Hilfen ---------- */
  const fileSlug = (s) => HD.slug(s, 50) || 'bild';
  /* | und ; sind in der CSV Trennzeichen und werden im Freitext ersetzt */
  const clean = (s) => String(s || '').replace(/\|/g, '/').replace(/;/g, ',').trim();
  const isoToDe = (iso) => iso.split('-').reverse().join('.');
  const deToIso = (de) => HD.isoDate(de);
  function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${HD.pad(d.getMonth() + 1)}-${HD.pad(d.getDate())}`;
  }

  /* ---------- CSV lesen/schreiben ---------- */
  function parseEntries(text) {
    const rows = HD.parseCSV(text);
    if (!rows.length) return [];
    /* Spalten ueber die Ueberschrift finden, damit die Reihenfolge egal ist */
    const header = rows[0].map((c) => String(c).trim().toLowerCase());
    const idx = HEAD.map((h) => header.lastIndexOf(h.toLowerCase()));
    return rows.slice(1).map((r) => {
      const o = {};
      HEAD.forEach((h, k) => { o[h] = idx[k] >= 0 ? (r[idx[k]] || '').trim() : ''; });
      return o;
    }).filter((o) => o.Titel && deToIso(o.Datum));
  }
  const toCSV = (list) => HD.csvText([HEAD, ...list.map((o) => HEAD.map((h) => o[h]))]);
  const csvBlob = () => new Blob([toCSV(entries)], CSV_TYPE);

  /* Neueste zuerst; bei gleichem Datum bleibt die bisherige Reihenfolge (stabile Sortierung) */
  function sortEntries() {
    entries.sort((a, b) => deToIso(b.Datum).localeCompare(deToIso(a.Datum)));
  }

  /* ---------- Ordner (File System Access API) ---------- */
  async function getFile(dir, parts, create) {
    let d = dir;
    for (const part of parts.slice(0, -1)) d = await d.getDirectoryHandle(part, { create: !!create });
    return d.getFileHandle(parts[parts.length - 1], { create: !!create });
  }
  async function writeFile(parts, data) {
    const fh = await getFile(root, parts, true);
    const w = await fh.createWritable();
    await w.write(data);
    await w.close();
  }
  async function fileExists(parts) {
    try {
      await getFile(root, parts, false);
      return true;
    } catch {
      return false;
    }
  }
  async function connect() {
    try {
      const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
      let fh;
      try {
        fh = await getFile(dir, ['data', 'news.csv'], false);
      } catch {
        status('Das ist nicht der Projektordner. Bitte den Ordner wählen, in dem index.html liegt.', 'err');
        return;
      }
      const text = await (await fh.getFile()).text();
      root = dir;
      entries = parseEntries(text);
      sortEntries();
      dirty = false;
      renderTable();
      updateModeUI();
      status(`Projektordner verbunden. ${entries.length} Meldungen geladen. Neue Meldungen werden jetzt direkt gespeichert.`, 'ok');
    } catch (e) {
      if (e && e.name !== 'AbortError') status(`Verbindung nicht möglich: ${e.message}`, 'err');
    }
  }
  function updateModeUI() {
    const supported = 'showDirectoryPicker' in window;
    $('nv-connect').hidden = !supported || !!root;
    $('nv-connected').hidden = !root;
    $('nv-fallback-note').hidden = supported;
    $('nv-downloads').hidden = !!root || !dirty;
    const editing = editIndex >= 0;
    $('nv-save').textContent = root
      ? (editing ? 'Änderung speichern' : 'Meldung speichern')
      : (editing ? 'Änderung übernehmen' : 'Meldung übernehmen');
  }

  /* ---------- Formular ---------- */
  function addInfoRow(label, value) {
    const row = document.createElement('div');
    row.className = 'nv-info-row';
    row.innerHTML =
      `<input type="text" class="nv-info-label" list="nv-labels" placeholder="Bezeichnung" aria-label="Bezeichnung" value="${esc(label || '')}"/>` +
      `<input type="text" class="nv-info-value" placeholder="Wert, z. B. Sonntag, 20. September 2026, 11:00 Uhr" aria-label="Wert" value="${esc(value || '')}"/>` +
      '<button type="button" class="nv-mini" aria-label="Zeile entfernen">&times;</button>';
    row.querySelector('button').addEventListener('click', () => row.remove());
    $('nv-infos').appendChild(row);
  }
  function readInfos() {
    return Array.from($('nv-infos').querySelectorAll('.nv-info-row'), (r) => {
      const l = clean(r.querySelector('.nv-info-label').value);
      const v = clean(r.querySelector('.nv-info-value').value);
      return v ? (l ? `${l}: ${v}` : v) : '';
    }).filter(Boolean).join(' | ');
  }
  function readDetails() {
    return $('f-details').value.split(/\n+/).map(clean).filter(Boolean).join(' | ');
  }

  function resetForm() {
    $('nv-form').reset();
    $('f-date').value = todayIso();
    $('nv-infos').innerHTML = '';
    addInfoRow('Termin', '');
    addInfoRow('Ort', '');
    editIndex = -1;
    clearImage();
    $('nv-formtitle').textContent = 'Neue Meldung';
    $('nv-cancel').hidden = true;
    updateModeUI();
  }
  function clearImage() {
    if (image && image.url) URL.revokeObjectURL(image.url);
    image = null;
    $('f-file').value = '';
    $('nv-preview').innerHTML = '<span class="nv-noimg">Noch kein Bild gewählt</span>';
    $('f-filename').value = '';
    delete $('f-filename').dataset.touched;
    $('nv-imginfo').textContent = '';
  }

  /* WebP wird unveraendert uebernommen. Andere Formate werden in voller
     Pixelgroesse (ohne Verkleinerung) in WebP umgewandelt; klappt das nicht,
     bleibt das Original erhalten. */
  async function toWebp(file, ext) {
    if (file.type === 'image/webp' || ext === 'webp') return { blob: file, ext: 'webp' };
    try {
      const bmp = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      canvas.getContext('2d').drawImage(bmp, 0, 0);
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.92));
      if (blob && blob.type === 'image/webp') return { blob, ext: 'webp', converted: true };
    } catch {
      /* Browser kann das Format nicht umwandeln: Original verwenden */
    }
    return { blob: file, ext: ext || 'jpg' };
  }

  async function onFile() {
    const f = $('f-file').files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      status('Bitte eine Bilddatei wählen (WebP, JPG oder PNG).', 'err');
      return;
    }
    const conv = await toWebp(f, (f.name.split('.').pop() || '').toLowerCase());
    if (image && image.url) URL.revokeObjectURL(image.url);
    conv.url = URL.createObjectURL(conv.blob);
    image = conv;

    const preview = document.createElement('img');
    Object.assign(preview, { src: conv.url, alt: 'Vorschau des gewählten Bildes' });
    $('nv-preview').replaceChildren(preview);
    $('f-filename').value = fileSlug($('f-title').value || f.name.replace(/\.[^.]+$/, ''));
    $('nv-imginfo').textContent = 'Original in voller Größe' +
      (conv.converted ? ', in WebP umgewandelt (ohne Verkleinerung)' : '') +
      ` · ${Math.round(conv.blob.size / 1024)} KB`;
  }

  /* ---------- Speichern ---------- */
  /* Freien Dateinamen im Jahresordner finden (name.webp, name-2.webp …);
     die eigene Datei einer bearbeiteten Meldung darf ueberschrieben werden. */
  async function freeImagePath(year, name, ext, old) {
    const dir = `assets/img/news/${year}/`;
    let path = `${dir}${name}.${ext}`;
    if (!root) return path;
    const isOwn = (p) => old && (old.Plakat === p || old.Vorschaubild === p);
    for (let n = 2; !isOwn(path) && await fileExists(path.split('/')); n++) path = `${dir}${name}-${n}.${ext}`;
    return path;
  }

  async function save(ev) {
    ev.preventDefault();
    const date = $('f-date').value;
    const title = clean($('f-title').value);
    const teaser = clean($('f-teaser').value);
    if (!date || !title || !teaser) {
      status('Bitte Datum, Titel und Kurztext ausfüllen.', 'err');
      return;
    }

    const old = editIndex >= 0 ? entries[editIndex] : null;
    const entry = {
      Datum: isoToDe(date), Kategorie: clean($('f-cat').value), Titel: title, Kurztext: teaser,
      Infos: readInfos(), Details: readDetails(),
      Vorschaubild: old ? old.Vorschaubild : '', Plakat: old ? old.Plakat : '',
      Link: clean($('f-link').value), Linktext: clean($('f-linktext').value)
    };

    let imgPath = '';
    if (image) {
      imgPath = await freeImagePath(date.slice(0, 4), fileSlug($('f-filename').value || title), image.ext, old);
      const isPoster = $('f-imgtype').value === 'poster';
      entry.Plakat = isPoster ? imgPath : '';
      entry.Vorschaubild = isPoster ? '' : imgPath;
    }

    if (old) entries[editIndex] = entry;
    else entries.push(entry);
    sortEntries();

    try {
      if (root) {
        if (image) await writeFile(imgPath.split('/'), image.blob);
        await writeFile(['data', 'news.csv'], csvBlob());
        status(`Gespeichert: „${title}“${imgPath ? ` mit Bild ${imgPath}` : ''}. Zum Veröffentlichen bitte Bescheid sagen (commit und push).`, 'ok');
        dirty = false;
      } else {
        dirty = true;
        pendingImage = image ? { blob: image.blob, path: imgPath } : null;
        status('Übernommen. Jetzt unten die Dateien herunterladen und an die angegebenen Stellen legen.', 'ok');
        $('nv-where').innerHTML =
          (imgPath ? `<li>Bild in den Ordner <code>${esc(imgPath.replace(/\/[^/]+$/, '/'))}</code> legen (Dateiname <code>${esc(imgPath.split('/').pop())}</code>)</li>` : '') +
          '<li><code>news.csv</code> in den Ordner <code>data/</code> legen und die alte Datei ersetzen</li>';
      }
    } catch (e) {
      status(`Speichern nicht möglich: ${e.message}`, 'err');
      return;
    }
    renderTable();
    resetForm();
    updateModeUI();
    window.scrollTo({ top: $('nv-tablewrap').getBoundingClientRect().top + window.pageYOffset - 80, behavior: 'smooth' });
  }

  /* ---------- Tabelle ---------- */
  function renderTable() {
    $('nv-tbody').innerHTML = entries.map((e, i) => {
      const img = e.Plakat || e.Vorschaubild;
      const badge = i < LATEST
        ? '<span class="nv-badge on">Startseite</span>'
        : `<span class="nv-badge">Archiv ${esc(e.Datum.split('.')[2])}</span>`;
      return `<tr><td>${esc(e.Datum)}</td><td><strong>${esc(e.Titel)}</strong><div class="nv-sub">${esc(e.Kategorie)}</div></td>` +
        `<td>${badge}</td><td>${img ? 'ja' : '<span class="nv-warn">kein Bild</span>'}</td>` +
        `<td class="nv-actions"><button type="button" class="nv-mini txt" data-edit="${i}">Bearbeiten</button>` +
        `<button type="button" class="nv-mini txt danger" data-del="${i}">Entfernen</button></td></tr>`;
    }).join('');
    $('nv-count').textContent = `${entries.length} Meldungen · die ${Math.min(LATEST, entries.length)} neuesten stehen auf der Startseite`;
  }

  function edit(i) {
    const e = entries[i];
    editIndex = i;
    $('f-date').value = deToIso(e.Datum);
    $('f-cat').value = e.Kategorie;
    $('f-title').value = e.Titel;
    $('f-teaser').value = e.Kurztext;
    $('f-link').value = e.Link;
    $('f-linktext').value = e.Linktext;
    $('f-details').value = e.Details.split(' | ').join('\n\n');
    $('nv-infos').innerHTML = '';
    const rows = e.Infos ? e.Infos.split(' | ') : [];
    for (const r of rows) {
      const m = r.match(/^([^:]{1,60}):\s+(.+)$/);
      addInfoRow(m ? m[1] : '', m ? m[2] : r);
    }
    if (!rows.length) addInfoRow('', '');
    clearImage();
    const cur = e.Plakat || e.Vorschaubild;
    if (cur) {
      $('nv-preview').innerHTML = `<img src="${esc(HD.safeUrl(cur, '../'))}" alt="Aktuelles Bild"/>`;
      $('nv-imginfo').textContent = `Aktuelles Bild: ${cur} (nur ein neues Bild wählen, wenn es ersetzt werden soll)`;
      $('f-imgtype').value = e.Plakat ? 'poster' : 'photo';
    }
    $('nv-formtitle').textContent = 'Meldung bearbeiten';
    $('nv-cancel').hidden = false;
    updateModeUI();
    window.scrollTo({ top: $('nv-formtitle').getBoundingClientRect().top + window.pageYOffset - 80, behavior: 'smooth' });
  }

  async function remove(i) {
    const e = entries[i];
    if (!window.confirm(`„${e.Titel}“ wirklich entfernen?\n(Das Bild bleibt im Ordner erhalten.)`)) return;
    entries.splice(i, 1);
    try {
      if (root) {
        await writeFile(['data', 'news.csv'], csvBlob());
        status('Entfernt und gespeichert.', 'ok');
      } else {
        dirty = true;
        $('nv-where').innerHTML = '<li><code>news.csv</code> in den Ordner <code>data/</code> legen und die alte Datei ersetzen</li>';
        status('Entfernt. Bitte unten die news.csv herunterladen und ersetzen.', 'ok');
      }
    } catch (err) {
      status(`Speichern nicht möglich: ${err.message}`, 'err');
    }
    renderTable();
    updateModeUI();
  }

  /* ---------- Start ---------- */
  document.addEventListener('DOMContentLoaded', async () => {
    $('nv-connect').addEventListener('click', connect);
    $('nv-form').addEventListener('submit', save);
    $('f-file').addEventListener('change', onFile);
    $('nv-addinfo').addEventListener('click', () => addInfoRow('', ''));
    $('nv-cancel').addEventListener('click', () => {
      resetForm();
      status('Bearbeiten abgebrochen.', '');
    });
    /* Dateiname folgt dem Titel, bis er von Hand geaendert wurde */
    $('f-title').addEventListener('input', (ev) => {
      if (image && !$('f-filename').dataset.touched) $('f-filename').value = fileSlug(ev.target.value);
    });
    $('f-filename').addEventListener('input', (ev) => { ev.target.dataset.touched = '1'; });
    $('nv-tbody').addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.edit !== undefined) edit(Number(b.dataset.edit));
      if (b.dataset.del !== undefined) remove(Number(b.dataset.del));
    });
    $('nv-dl-csv').addEventListener('click', () => HD.download(csvBlob(), 'news.csv'));
    $('nv-dl-img').addEventListener('click', () => {
      if (pendingImage) HD.download(pendingImage.blob, pendingImage.path.split('/').pop());
      else status('Es gibt kein neues Bild zum Herunterladen.', 'err');
    });

    resetForm();
    updateModeUI();
    try {
      const res = await fetch('../data/news.csv');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      entries = parseEntries(await res.text());
      sortEntries();
      renderTable();
    } catch {
      status('Die Tabelle konnte nicht geladen werden. Bitte den Projektordner verbinden.', 'err');
    }
  });
})();
