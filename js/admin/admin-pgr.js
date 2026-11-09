/* ============================================================
   Augustinerkirche Wien — admin-pgr.js
   Pfarrgemeinderat pflegen (admin/pgr.html), Quelle ist
   data/pgr.json: {mitglieder: [...], weitere: [...]}, je Person
   {name, rolle, beruf, aufgaben: [..], email, telefon}.
   Erscheint auf pages/augustinerkirche.html#p-pfarre → Pfarrgemeinderat in der
   Reihenfolge der Listen.
   Dieselbe Seite pflegt auch die Gremien der Pfarre Aspersdorf
   (admin/aspersdorf-gremien.html, <body data-pgr="aspersdorf">): Quelle ist dann
   data/pgr-aspersdorf.json mit den Listen mitglieder (Pfarrgemeinderat) und
   vwr (Vermoegensverwaltungsrat), sie erscheinen auf pages/aspersdorf.html → Leitung.
   Benoetigt js/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { $, esc, icon } = A;
  const ASP = document.body.dataset.pgr === 'aspersdorf';
  const PATH = ASP ? 'data/pgr-aspersdorf.json' : 'data/pgr.json';
  const IMG_DIR = ASP ? 'assets/img/personen/aspersdorf/' : 'assets/img/personen/pgr/';
  const LABEL = ASP ? { mitglieder: 'Pfarrgemeinderat', vwr: 'Vermögensverwaltungsrat' } : { mitglieder: 'Mitglieder', weitere: 'Ersatzmitglieder & weitere' };
  const KEYS = Object.keys(LABEL);
  const WHAT = ASP ? 'Gremium der Pfarre Aspersdorf' : 'Pfarrgemeinderat';
  const WHERE = ASP ? 'Pfarre Aspersdorf → Leitung' : 'Pfarre → Pfarrgemeinderat';

  let data = Object.fromEntries(KEYS.map((k) => [k, []]));
  let query = '';
  let edit = null;        /* {group, i} oder null = neu */
  let snap = '';
  let image = null;       /* neu gewaehltes Foto {blob, ext, url, name, w, h} */
  let removeImage = false;

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const copy = () => Object.fromEntries(KEYS.map((k) => [k, data[k].slice()]));

  /* ---------- Laden und Liste ---------- */
  async function load() {
    try {
      const d = (await A.readJSON(PATH));
      if (!d || !Array.isArray(d.mitglieder)) throw new Error('unerwarteter Inhalt');
      data = Object.fromEntries(KEYS.map((k) => [k, Array.isArray(d[k]) ? d[k] : []]));
    } catch (e) {
      $('pg-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Datei <code>${PATH}</code> konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
      return;
    }
    render();
  }

  function rowHTML(g, p, i, last, searching) {
    const move = searching ? '' :
      `<button type="button" class="adm-act icon" data-act="up" data-i="${i}" aria-label="Nach oben: ${esc(p.name)}" title="Nach oben"${i === 0 ? ' disabled' : ''}>${icon('up')}</button>` +
      `<button type="button" class="adm-act icon" data-act="down" data-i="${i}" aria-label="Nach unten: ${esc(p.name)}" title="Nach unten"${i === last ? ' disabled' : ''}>${icon('down')}</button>`;
    const meta = [p.rolle, p.beruf].filter(Boolean).join(' · ');
    const hints = [p.aufgaben && p.aufgaben.length ? plural(p.aufgaben.length, 'Aufgabe', 'Aufgaben') : '', p.email ? 'E-Mail' : '', p.telefon ? 'Telefon' : ''].filter(Boolean).join(', ');
    return `<li class="adm-row" data-key="${g}-${i}" data-g="${g}">` +
      `<button type="button" class="adm-row-open adm-pate" data-act="edit" data-i="${i}">` +
        `<span class="adm-pgr-photo">${p.bild ? `<img src="${esc(A.imageUrl(p.bild))}" alt="" loading="lazy"/>` : esc(p.name.replace(/^(?:(?:Dr|Ing|Mag|MMag|P|Hw|Diakon)\.?\s+)+/i, '').charAt(0))}</span>` +
        `<span class="adm-row-body"><span class="adm-row-title">${esc(p.name)}</span>` +
        (meta ? `<span class="adm-row-meta">${esc(meta)}</span>` : '') +
        (hints ? `<span class="adm-row-people">${esc(hints)}</span>` : '') +
      '</span></button>' +
      `<div class="adm-row-actions">${move}` +
        `<button type="button" class="adm-act icon danger" data-act="del" data-i="${i}" aria-label="Entfernen: ${esc(p.name)}" title="Entfernen">${icon('trash')}</button>` +
      '</div></li>';
  }

  function render() {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    const sections = Object.keys(LABEL).map((g) => {
      const all = data[g];
      const list = all.map((p, i) => ({ p, i })).filter(({ p }) =>
        words.every((w) => `${p.name} ${p.rolle} ${p.beruf} ${(p.aufgaben || []).join(' ')}`.toLowerCase().includes(w)));
      shown += list.length;
      if (!list.length) return '';
      return `<section class="adm-pgr-sec" aria-label="${LABEL[g]}"><h2 class="adm-pgr-h">${LABEL[g]} <span class="n">${all.length}</span></h2>` +
        `<ul class="adm-rows">${list.map(({ p, i }) => rowHTML(g, p, i, all.length - 1, words.length > 0)).join('')}</ul></section>`;
    });
    const total = KEYS.reduce((n, k) => n + data[k].length, 0);
    $('pg-count').textContent = words.length
      ? `${plural(shown, 'Treffer', 'Treffer')} für „${query.trim()}“`
      : plural(total, 'Person', 'Personen');
    if (shown) {
      $('pg-list').innerHTML = sections.join('');
      return;
    }
    $('pg-list').innerHTML = words.length
      ? '<div class="adm-empty"><p class="adm-empty-title">Keine Treffer</p><button type="button" class="btn btn-quiet" data-act="clear">Suche zurücksetzen</button></div>'
      : `<div class="adm-empty"><p class="adm-empty-title">Noch niemand eingetragen</p><button type="button" class="btn btn-gold" data-act="new">${icon('plus')}Person hinzufügen</button></div>`;
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
    const direct = await A.saveFile(PATH, JSON.stringify(next, null, 2) + '\n');
    data = next;
    return direct;
  }

  /* ---------- Fenster: Foto ---------- */
  function currentPhoto() {
    const p = edit ? data[edit.group][edit.i] : null;
    return p && p.bild && !removeImage ? p : null;
  }
  function renderImage() {
    const cur = currentPhoto();
    const src = image ? image.url : cur ? A.imageUrl(cur.bild) : '';
    $('pg-prev').innerHTML = src ? `<img src="${esc(src)}" alt="Vorschau des Fotos"/>` : '<span class="none">Noch kein Foto</span>';
    $('pg-imginfo').textContent = image ? `${image.name} · ${image.w} × ${image.h} Pixel` : cur ? `Aktuelles Foto: ${cur.bild}` : '';
    $('pg-img-remove').hidden = !src;
  }
  async function onFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      A.toast('Bitte eine Bilddatei wählen (WebP, JPG oder PNG).', 'err');
      return;
    }
    const conv = await A.toWebp(file, { maxSize: 800, quality: 0.86 });
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
    removeImage = false;
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
  /* Freier Dateiname; das eigene Foto darf ersetzt werden */
  async function freePath(base, ext, old) {
    let path = `${IMG_DIR}${base}.${ext}`;
    if (A.folder.state !== 'ok') return path;
    for (let n = 2; !(old && old.bild === path) && await A.folder.exists(path); n++) path = `${IMG_DIR}${base}-${n}.${ext}`;
    return path;
  }
  const dirtyState = () => A.snapshot($('pg-form')) + (image ? 'neu' : '') + (removeImage ? 'weg' : '');

  /* ---------- Fenster ---------- */
  function openEditor(g, i) {
    edit = i === undefined ? null : { group: g, i };
    const p = edit ? data[g][i] : null;
    const form = $('pg-form');
    form.reset();
    A.clearErrors(form);
    $('f-name').value = p ? p.name : '';
    $('f-rolle').value = p ? p.rolle || '' : '';
    $('f-beruf').value = p ? p.beruf || '' : '';
    $('f-aufgaben').value = p ? (p.aufgaben || []).join('\n') : '';
    $('f-email').value = p ? p.email || '' : '';
    $('f-telefon').value = p ? p.telefon || '' : '';
    $('f-credit').value = A.credits.get(p && p.bild);
    if (image) URL.revokeObjectURL(image.url);
    image = null;
    removeImage = false;
    $('f-file').value = '';
    renderImage();
    $('f-group').value = g;
    $('f-pos').value = 'ende';
    $('pg-pos-field').hidden = !!edit;
    $('pg-dlg-tag').textContent = edit ? `Nr. ${i + 1}` : 'Hinzufügen';
    $('pg-dlg-title').textContent = p ? p.name : 'Neue Person';
    $('pg-delete').hidden = !edit;
    A.openDialog($('pg-dlg'), { isDirty: () => dirtyState() !== snap });
    snap = dirtyState();
  }

  async function save(ev) {
    ev.preventDefault();
    const form = $('pg-form');
    const name = clean($('f-name').value);
    const email = clean($('f-email').value);
    const target = $('f-group').value;
    const errors = [];
    if (!name) errors.push([$('f-name'), 'Bitte den Namen eintragen.']);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push([$('f-email'), 'Diese E-Mail-Adresse sieht nicht richtig aus.']);
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }
    const old = edit ? data[edit.group][edit.i] : null;
    const cur = currentPhoto();
    const person = {
      name, rolle: clean($('f-rolle').value), beruf: clean($('f-beruf').value),
      aufgaben: $('f-aufgaben').value.split(/\n+/).map(clean).filter(Boolean),
      email, telefon: clean($('f-telefon').value),
      bild: cur ? cur.bild : '', breite: cur ? cur.breite || 0 : 0, hoehe: cur ? cur.hoehe || 0 : 0
    };
    const next = copy();
    let pos;
    if (edit && edit.group === target) {
      next[target][edit.i] = person;
      pos = edit.i;
    } else {
      if (edit) next[edit.group].splice(edit.i, 1);
      if (!edit && $('f-pos').value === 'anfang') {
        next[target].unshift(person);
        pos = 0;
      } else {
        next[target].push(person);
        pos = next[target].length - 1;
      }
    }
    const btn = $('pg-save');
    btn.disabled = true;
    try {
      if (image) {
        const path = await freePath(A.HD.slug(name, 60) || 'person', image.ext, old);
        await A.saveFile(path, image.blob);
        Object.assign(person, { bild: path, breite: image.w, hoehe: image.h });
      }
      const direct = await persist(next);
      if (person.bild) await A.credits.set(person.bild, $('f-credit').value);
      if (old && old.bild && old.bild !== person.bild) await A.media.remove([old.bild]);
      $('pg-dlg').close();
      query = '';
      $('pg-search').value = '';
      render();
      flash(target, pos);
      A.toast(direct ? `Gespeichert: ${name}.` : `${name} übernommen. Bitte unten die Datei herunterladen.`);
      A.log(`${WHAT} ${edit ? 'geändert' : 'ergänzt'}: ${name}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function remove(g, i) {
    const p = data[g][i];
    const ok = await A.confirmBox({
      title: ASP ? `Aus „${LABEL[g]}“ entfernen?` : 'Aus dem Pfarrgemeinderat entfernen?',
      html: `<strong>${esc(p.name)}</strong>${p.rolle ? `<br>${esc(p.rolle)}` : ''}<br><br>Die Person verschwindet von der Seite ${WHERE}.${p.bild ? ' Das Foto wird mitgelöscht, sofern es nicht noch anderswo verwendet wird.' : ''}`,
      ok: 'Entfernen', danger: true
    });
    if (!ok) return;
    try {
      const next = copy();
      next[g].splice(i, 1);
      const direct = await persist(next);
      if (p.bild) await A.media.remove([p.bild]);
      if ($('pg-dlg').open) $('pg-dlg').close();
      render();
      A.toast(direct ? `Entfernt: ${p.name}.` : 'Entfernt. Bitte unten die Datei herunterladen.');
      A.log(`${WHAT} entfernt: ${p.name}`);
    } catch (err) {
      A.toast(`Entfernen nicht möglich: ${err.message}`, 'err');
    }
  }

  async function move(group, i, dir) {
    const j = i + dir;
    const next = copy();
    const list = next[group];
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    try {
      await persist(next);
      render();
      flash(group, j, `[data-act="${dir < 0 ? 'up' : 'down'}"]:not([disabled])`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    A.credits.load();
    $('f-file').addEventListener('change', (ev) => onFile(ev.target.files[0]));
    $('pg-img-remove').addEventListener('click', dropImage);
    A.wireDrop($('pg-drop'));
    $('pg-new').addEventListener('click', () => openEditor('mitglieder'));
    $('pg-form').addEventListener('submit', save);
    $('pg-delete').addEventListener('click', () => { if (edit) remove(edit.group, edit.i); });
    $('pg-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      const i = Number(b.dataset.i);
      const act = b.dataset.act;
      const row = b.closest('[data-g]');
      const group = row ? row.dataset.g : 'mitglieder';
      if (act === 'edit') openEditor(group, i);
      else if (act === 'del') remove(group, i);
      else if (act === 'up' || act === 'down') move(group, i, act === 'up' ? -1 : 1);
      else if (act === 'new') openEditor(group);
      else if (act === 'clear') {
        query = '';
        $('pg-search').value = '';
        render();
      }
    });
    let timer = 0;
    $('pg-search').addEventListener('input', (ev) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        query = ev.target.value;
        render();
      }, 120);
    });
    A.guard(() => $('pg-dlg').open && dirtyState() !== snap);
    A.folder.on((state) => { if (state === 'ok') load(); });
    await load();
    if (new URLSearchParams(location.search).has('neu')) {
      openEditor('mitglieder');
      history.replaceState(null, '', location.pathname + location.search.replace(/[?&]neu=1/, '').replace(/^&/, '?'));
    }
  });
})();
