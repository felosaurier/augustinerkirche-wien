/* ============================================================
   Augustinerkirche Wien — admin-personen.js
   Personen pflegen (admin/personen.html), Quelle ist
   data/personen.json mit vier Gruppen, aufgeteilt auf zwei Bereiche
   der Verwaltung: ?bereich=kloster (Mitbrueder, Chronik) und
   ?bereich=musik (Leitung, Gastdirigenten, Organisten; dazu Homepage) und
   ?bereich=aspersdorf (Leitung der Pfarre Aspersdorf). Je Person Name, Aufgabe, Foto, Fotonachweis und
   Text; Reihenfolge mit Pfeilen, Wechsel der Gruppe im Fenster.
   Benoetigt js/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { HD, $, esc, icon } = A;
  const PATH = 'data/personen.json';
  const GROUPS = {
    mitbrueder: { label: 'Mitbrüder', page: 'pages/augustiner.html#p-wien', dir: 'patres' },
    leitung: { label: 'Leitung', page: 'pages/musik.html#p-leitung', dir: 'dirigenten' },
    gastdirigenten: { label: 'Gastdirigenten', page: 'pages/musik.html#p-gastdirigenten', dir: 'dirigenten' },
    organisten: { label: 'Organisten', page: 'pages/musik.html#p-organisten', dir: 'organisten' },
    'asp-leitung': { label: 'Leitung', page: 'pages/aspersdorf.html#p-leitung', dir: 'aspersdorf' }
  };

  const AREAS = {
    kloster: { groups: ['mitbrueder'], title: 'Mitbrüder <em>pflegen</em>',
      sub: 'Die Mitbrüder des Wiener Augustinerklosters, wie sie unter Chronik → Die Augustiner in Wien erscheinen.' },
    aspersdorf: { groups: ['asp-leitung'], title: 'Pfarrer & Leitung <em>Aspersdorf</em>',
      sub: 'Pfarrmoderator, Pfarrvikar und weitere Verantwortliche der Pfarre Aspersdorf, wie sie unter Pfarre Aspersdorf → Leitung erscheinen.' },
    musik: { groups: ['leitung', 'gastdirigenten', 'organisten'], title: 'Leitung &amp; Organisten <em>pflegen</em>',
      sub: 'Leitung der Kirchenmusik, Gastdirigenten und Organisten mit Foto und Text. Die Solisten haben einen eigenen Bereich.' }
  };
  const area = AREAS[A.personenBereich()];

  let data = {};
  /* Stand der Seite Pfarre Aspersdorf → Leitung: fehlt die Gruppe in der Datei, wird er als Vorschlag gezeigt und mit dem ersten Speichern uebernommen */
  const VORGABE = { 'asp-leitung': [{"name": "Mag. Eduard Schipfer", "rolle": "Pfarrmoderator", "bild": "", "bildtext": "", "breite": 0, "hoehe": 0, "text": ["Pfarrmoderator des Pfarrverbands Klein Maria Dreieichen. Seit 1. Mai 2021 gehört die Pfarre Aspersdorf gemeinsam mit Groß, Hollabrunn und Oberfellabrunn zu diesem Pfarrverband.", "Kontakt: [[mail:ta.ehcrikehcsilohtak|refpihcs.draude]], Kirchenplatz 5, 2020 Hollabrunn"]}, {"name": "P. Mag. Dominic Sadrawetz OSA", "rolle": "Pfarrvikar mit Schwerpunkt Aspersdorf", "bild": "", "bildtext": "", "breite": 0, "hoehe": 0, "text": ["Betreut als Pfarrvikar die Pfarre Aspersdorf, die er von 2002 bis 2021 als Moderator geleitet hat.", "P. Dominic gehört dem Augustinerorden an und lebt im Augustinerkloster an der Wiener Hofburg; als Prior leitet er die Augustinerklöster in Wien und in Zwiesel im Bayerischen Wald. Er ist außerdem Mitglied des Ritterordens vom Heiligen Grab zu Jerusalem.", "Sprechstunden im Pfarrhaus, Hauptstraße 2 (unterhalb der Pfarrkirche): mittwochs 19:00 bis 19:30 Uhr und nach Vereinbarung.", "Kontakt: [+43 (0)2952 30198](tel:+43295230198), [[mail:ta.frodsrepsa|cinimod.p]]", "Pfarramt: [[mail:ta.frodsrepsa|errafp]], Pfarre St. Georg, Hauptstraße 2, 2020 Aspersdorf"]}] };
  let group = area.groups[0];
  let editGroup = '';
  let editIndex = -1;
  let image = null;
  let removeImage = false;
  let snap = '';

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const list = (g) => data[g] || (data[g] = []);

  /* ---------- Liste ---------- */
  function renderGroups() {
    $('ps-groups').hidden = area.groups.length < 2;
    $('ps-groups').innerHTML = area.groups.map((key) => [key, GROUPS[key]]).map(([key, g]) =>
      `<button type="button" class="week-filter-btn${key === group ? ' active' : ''}" data-group="${key}" aria-pressed="${key === group}">${g.label} <span class="n">${list(key).length}</span></button>`
    ).join('');
    $('ps-view').href = `../${GROUPS[group].page}`;
  }
  function render() {
    renderGroups();
    const people = list(group);
    $('ps-count').textContent = `${plural(people.length, 'Person', 'Personen')} · Reihenfolge wie auf der Website`;
    if (!people.length) {
      $('ps-list').innerHTML = `<div class="adm-empty"><p class="adm-empty-title">Noch niemand in dieser Gruppe</p><button type="button" class="btn btn-gold" data-act="new">${icon('plus')}Person hinzufügen</button></div>`;
      return;
    }
    $('ps-list').innerHTML = '<ul class="adm-rows">' + people.map((p, i) => {
      const src = p.bild ? A.imageUrl(p.bild) : '';
      return `<li class="adm-row" data-key="${esc(`${group}-${p.name}`)}">` +
        `<button type="button" class="adm-row-open has-thumb" data-act="edit" data-i="${i}">` +
          (src ? `<span class="adm-thumb photo"><img src="${esc(src)}" alt="" loading="lazy"/></span>`
            : '<span class="adm-thumb none"><img src="../assets/logo-gold.png" alt=""/></span>') +
          `<span class="adm-row-body"><span class="adm-row-title">${esc(p.name)}</span>` +
          `<span class="adm-row-meta">${esc(p.rolle || '')}</span>` +
          `<span class="adm-row-people">${esc((p.text || [])[0] || '')}</span></span><span></span>` +
        '</button>' +
        '<div class="adm-row-actions">' +
          `<button type="button" class="adm-act icon" data-act="up" data-i="${i}" aria-label="Nach oben: ${esc(p.name)}"${i === 0 ? ' disabled' : ''}>${icon('up')}</button>` +
          `<button type="button" class="adm-act icon" data-act="down" data-i="${i}" aria-label="Nach unten: ${esc(p.name)}"${i === people.length - 1 ? ' disabled' : ''}>${icon('down')}</button>` +
          `<button type="button" class="adm-act danger" data-act="del" data-i="${i}" aria-label="Entfernen: ${esc(p.name)}">${icon('trash')}Entfernen</button>` +
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
    (row.querySelector(focusSel) || row.querySelector('.adm-row-open')).focus({ preventScroll: true });
  }

  async function load() {
    try {
      data = (await A.readJSON(PATH));
      for (const [g, list] of Object.entries(VORGABE)) {
        if (area.groups.includes(g) && !Array.isArray(data[g])) {
          data[g] = JSON.parse(JSON.stringify(list));
          A.toast('Die Leitung der Pfarre Aspersdorf ist hier vorbefüllt. Mit „Speichern“ bei einer Person wird sie übernommen.');
        }
      }
    } catch (e) {
      $('ps-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Personen konnten nicht geladen werden (${esc(e.message)}).</div></div>`;
      return;
    }
    render();
  }
  async function store(next, note) {
    const direct = await A.saveJSON(PATH, next);
    data = next;
    render();
    A.toast(direct ? note : `${note} Bitte unten die Datei herunterladen.`);
    A.log(note);
  }
  const copy = () => JSON.parse(JSON.stringify(data));

  async function move(i, dir) {
    const next = copy();
    const arr = next[group];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    try {
      await store(next, `Reihenfolge geändert: ${arr[j].name}`);
      flash(`${group}-${arr[j].name}`, `[data-act="${dir < 0 ? 'up' : 'down'}"]:not([disabled])`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  /* ---------- Fenster ---------- */
  function currentPhoto() {
    const p = editIndex >= 0 ? list(editGroup)[editIndex] : null;
    return p && p.bild && !removeImage ? p : null;
  }
  function renderImage() {
    const cur = currentPhoto();
    const src = image ? image.url : cur ? A.imageUrl(cur.bild) : '';
    $('ps-prev').innerHTML = src ? `<img src="${esc(src)}" alt="Vorschau des Fotos"/>` : '<span class="none">Noch kein Foto</span>';
    $('ps-imginfo').textContent = image ? `${image.name} · ${image.w} × ${image.h} Pixel` : cur ? `Aktuelles Foto: ${cur.bild}` : '';
    $('ps-img-remove').hidden = !src;
  }
  async function onFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      A.toast('Bitte eine Bilddatei wählen (WebP, JPG oder PNG).', 'err');
      return;
    }
    const conv = await A.toWebp(file, { maxSize: 1000, quality: 0.86 });
    let w = 0;
    let h = 0;
    try {
      const bmp = await createImageBitmap(conv.blob);
      w = bmp.width;
      h = bmp.height;
      if (bmp.close) bmp.close();
    } catch {
      /* Groesse unbekannt */
    }
    if (image) URL.revokeObjectURL(image.url);
    image = { ...conv, url: URL.createObjectURL(conv.blob), name: file.name, w, h };
    removeImage = false;
    if (!$('f-bildtext').value.trim()) $('f-bildtext').value = $('f-name').value.trim();
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

  const dirtyState = () => A.snapshot($('ps-form')) + (image ? 'neu' : '') + (removeImage ? 'weg' : '');
  function openEditor(i) {
    editGroup = group;
    editIndex = i;
    const p = i >= 0 ? list(group)[i] : null;
    const form = $('ps-form');
    form.reset();
    A.clearErrors(form);
    $('f-gruppe').value = group;
    $('f-name').value = p ? p.name : '';
    $('f-rolle').value = p ? p.rolle || '' : '';
    $('f-homepage').value = (p && p.homepage) || '';
    $('f-text').value = p ? (p.text || []).join('\n') : '';
    $('f-bildtext').value = p ? p.bildtext || '' : '';
    $('f-credit').value = A.credits.get(p && p.bild);
    if (image) URL.revokeObjectURL(image.url);
    image = null;
    removeImage = false;
    renderImage();
    $('ps-dlg-tag').textContent = p ? `${GROUPS[group].label} · bearbeiten` : 'Person hinzufügen';
    $('ps-dlg-title').textContent = p ? p.name : 'Neue Person';
    $('ps-delete').hidden = !p;
    A.openDialog($('ps-dlg'), { isDirty: () => dirtyState() !== snap });
    snap = dirtyState();
  }

  async function freePath(dir, name, ext, old) {
    const base = `assets/img/personen/${dir}/${HD.slug(name, 50) || 'person'}`;
    let path = `${base}.${ext}`;
    for (let n = 2; ((old && old.bild === path) || (A.folder.state === 'ok' && await A.folder.exists(path))); n++) path = `${base}-${n}.${ext}`;
    return path;
  }

  async function save(ev) {
    ev.preventDefault();
    const form = $('ps-form');
    const name = clean($('f-name').value);
    const target = $('f-gruppe').value;
    if (!name) {
      A.showErrors(form, [[$('f-name'), 'Bitte den Namen eintragen.']]);
      return;
    }
    /* Homepage nur bei der Kirchenmusik; ohne https:// wird es ergaenzt */
    let homepage = area === AREAS.musik ? $('f-homepage').value.trim() : '';
    if (homepage && !/^[a-z]+:/i.test(homepage)) homepage = `https://${homepage}`;
    if (homepage && !/^https?:\/\/[^\s/.]+\.[^\s]+$/i.test(homepage)) {
      A.showErrors(form, [[$('f-homepage'), 'Bitte eine vollständige Adresse eintragen, z. B. https://www.name.at']]);
      return;
    }
    const old = editIndex >= 0 ? list(editGroup)[editIndex] : null;
    const cur = currentPhoto();
    const p = {
      name, rolle: clean($('f-rolle').value),
      bild: cur ? cur.bild : '', bildtext: clean($('f-bildtext').value),
      breite: cur ? cur.breite || 0 : 0, hoehe: cur ? cur.hoehe || 0 : 0,
      text: $('f-text').value.split(/\n+/).map(clean).filter(Boolean)
    };
    if (homepage) p.homepage = homepage;
    const btn = $('ps-save');
    btn.disabled = true;
    try {
      if (image) {
        const path = await freePath(GROUPS[target].dir, name, image.ext, old);
        await A.saveFile(path, image.blob);
        Object.assign(p, { bild: path, breite: image.w, hoehe: image.h });
      }
      const next = copy();
      next[editGroup] = next[editGroup] || [];
      next[target] = next[target] || [];
      if (old && editGroup === target) next[target][editIndex] = p;
      else {
        if (old) next[editGroup].splice(editIndex, 1);
        next[target].push(p);
      }
      group = target;
      await store(next, `${old ? 'Gespeichert' : 'Hinzugefügt'}: ${name} (${GROUPS[target].label}).`);
      if (p.bild) await A.credits.set(p.bild, $('f-credit').value);
      if (old && old.bild && old.bild !== p.bild) await A.media.remove([old.bild]);
      $('ps-dlg').close();
      flash(`${target}-${name}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function remove(g, i) {
    const p = list(g)[i];
    const ok = await A.confirmBox({
      title: 'Person entfernen?',
      html: `<strong>${esc(p.name)}</strong> (${esc(GROUPS[g].label)})<br><br>Die Karte verschwindet von der Website.${p.bild ? ' Das Foto wird mitgelöscht, sofern es nicht noch anderswo verwendet wird.' : ''}`,
      ok: 'Entfernen', danger: true
    });
    if (!ok) return false;
    try {
      const next = copy();
      next[g].splice(i, 1);
      await store(next, `Entfernt: ${p.name} (${GROUPS[g].label}).`);
      if (p.bild) await A.media.remove([p.bild]);
      return true;
    } catch (err) {
      A.toast(`Entfernen nicht möglich: ${err.message}`, 'err');
      return false;
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    A.credits.load();
    $('ps-title').innerHTML = area.title;
    $('ps-sub').textContent = area.sub;
    $('f-gruppe').innerHTML = area.groups.map((key) => `<option value="${key}">${GROUPS[key].label}</option>`).join('');
    $('f-gruppe').closest('.adm-field').hidden = area.groups.length < 2;
    $('f-homepage-field').hidden = area !== AREAS.musik;
    $('ps-new').addEventListener('click', () => openEditor(-1));
    $('ps-form').addEventListener('submit', save);
    $('f-file').addEventListener('change', (ev) => onFile(ev.target.files[0]));
    A.wireDrop($('ps-drop'));
    $('ps-img-remove').addEventListener('click', dropImage);
    $('ps-delete').addEventListener('click', async () => {
      if (editIndex >= 0 && await remove(editGroup, editIndex)) $('ps-dlg').close();
    });
    $('ps-groups').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-group]');
      if (!b) return;
      group = b.dataset.group;
      render();
      $('ps-groups').querySelector(`[data-group="${group}"]`).focus();
    });
    $('ps-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      const i = Number(b.dataset.i);
      if (b.dataset.act === 'edit') openEditor(i);
      if (b.dataset.act === 'up') move(i, -1);
      if (b.dataset.act === 'down') move(i, 1);
      if (b.dataset.act === 'del') remove(group, i);
      if (b.dataset.act === 'new') openEditor(-1);
    });
    A.guard(() => $('ps-dlg').open && dirtyState() !== snap);
    A.folder.on((state) => { if (state === 'ok') load(); });

    const g = new URLSearchParams(location.search).get('gruppe');
    if (g && area.groups.includes(g)) group = g;
    await load();
    if (new URLSearchParams(location.search).has('neu')) {
      openEditor(-1);
      history.replaceState(null, '', location.pathname + location.search.replace(/[?&]neu=1/, '').replace(/^&/, '?'));
    }
  });
})();
