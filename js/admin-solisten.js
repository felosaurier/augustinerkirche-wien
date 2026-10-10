/* ============================================================
   Augustinerkirche Wien — admin-solisten.js
   Solisten pflegen (admin/solisten.html), Quelle ist
   data/solisten.json (Liste auf musik.html → Solisten).
   - Karten mit Foto, Suche und Filter nach Stimmlage
   - Aufnehmen, Bearbeiten, Entfernen
   - Foto: quadratischer Ausschnitt (verschiebbar), 400 × 400
     Pixel als WebP nach assets/img/personen/solisten/
   Benoetigt js/hochaemter-data.js und js/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { HD, $, esc, icon } = A;
  const PATH = 'data/solisten.json';
  const IMG_DIR = 'assets/img/personen/solisten/';
  const VOICES = ['Sopran', 'Mezzosopran', 'Alt', 'Altus', 'Countertenor', 'Tenor', 'Bariton', 'Bassbariton', 'Bass'];
  const collator = new Intl.Collator('de');

  let people = [];
  let voiceFilter = '';
  let query = '';
  let editIndex = -1;     /* -1 = neue Person */
  let image = null;       /* neu gewaehltes Foto {file, url, w, h} */
  let snap = '';

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const surnameOf = (name) => clean(name).split(' ').pop() || '';
  const bySurname = (a, b) => collator.compare(a.surname, b.surname) || collator.compare(a.name, b.name);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const landscape = () => image && image.w > image.h;

  /* ---------- Laden und Liste ---------- */
  async function load() {
    try {
      const data = JSON.parse(await A.readText(PATH));
      if (!Array.isArray(data)) throw new Error('unerwarteter Inhalt');
      people = data.sort(bySurname);
    } catch (e) {
      $('so-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Liste <code>${PATH}</code> konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
      return;
    }
    renderVoices();
    render();
  }

  function renderVoices() {
    const counts = new Map();
    for (const p of people) counts.set(p.voice || '', (counts.get(p.voice || '') || 0) + 1);
    if (voiceFilter && !counts.has(voiceFilter)) voiceFilter = '';
    const others = [...counts.keys()].filter((v) => !VOICES.includes(v)).sort(collator.compare);
    const list = [['', 'Alle', people.length],
      ...[...VOICES, ...others].filter((v) => counts.has(v)).map((v) => [v, v || 'Ohne Angabe', counts.get(v)])];
    $('so-voices').innerHTML = list.map(([v, label, n]) =>
      `<button type="button" class="week-filter-btn${v === voiceFilter ? ' active' : ''}" data-voice="${esc(v)}" aria-pressed="${v === voiceFilter}">${esc(label)} <span class="n">${n}</span></button>`
    ).join('');
  }

  function cardHTML({ p, i }) {
    const src = A.imageUrl(p.image);
    return `<button type="button" class="adm-person" data-i="${i}" data-key="${esc(p.name)}">` +
      (src
        ? `<img src="${esc(src)}" alt="" width="300" height="300" loading="lazy" decoding="async"/>`
        : '<span class="adm-person-noimg"><img src="../assets/logo-gold.png" alt=""/></span>') +
      `<span><span class="adm-person-name">${esc(p.name)}${p.deceased ? ' †' : ''}</span>` +
      `<span class="adm-person-role">${esc(p.voice || 'Ohne Stimmlage')}</span>` +
      (src ? '' : '<span class="adm-person-warn">Noch ohne Foto</span>') +
      '</span></button>';
  }

  function render() {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = people.map((p, i) => ({ p, i })).filter(({ p }) =>
      (!voiceFilter || (p.voice || '') === voiceFilter) && words.every((w) => `${p.name} ${p.voice}`.toLowerCase().includes(w)));
    $('so-count').textContent = `${plural(list.length, 'Person', 'Personen')}${voiceFilter ? ` · ${voiceFilter}` : ''}${words.length ? ` · Suche „${query.trim()}“` : ''}`;
    $('so-list').innerHTML = list.length
      ? `<div class="adm-cards">${list.map(cardHTML).join('')}</div>`
      : '<div class="adm-empty"><p class="adm-empty-title">Niemand gefunden</p><p>Bitte Suche oder Filter ändern.</p>' +
        '<button type="button" class="btn btn-quiet" data-clear>Alle anzeigen</button></div>';
  }

  function flash(name) {
    const card = document.querySelector(`.adm-person[data-key="${CSS.escape(name)}"]`);
    if (!card) return;
    card.classList.remove('flash');
    void card.offsetWidth;
    card.classList.add('flash');
    card.scrollIntoView({ block: 'nearest' });
    card.focus({ preventScroll: true });
  }

  /* ---------- Fenster ---------- */
  function fillVoices(current) {
    const list = VOICES.includes(current) || !current ? VOICES : [...VOICES, current];
    $('f-voice').innerHTML = '<option value="">Bitte wählen …</option>' +
      list.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    $('f-voice').value = current || '';
  }

  function renderPhoto() {
    const p = editIndex >= 0 ? people[editIndex] : null;
    const src = image ? image.url : p && p.image ? A.imageUrl(p.image) : '';
    $('so-prev').innerHTML = src ? `<img src="${esc(src)}" alt="Vorschau des Fotos"/>` : '<span class="none">Noch kein Foto</span>';
    if (image) {
      const v = $('f-crop').value;
      $('so-prev').querySelector('img').style.objectPosition = landscape() ? `${v}% 50%` : `50% ${v}%`;
    }
    $('so-crop').hidden = !image || image.w === image.h;
    $('so-imginfo').textContent = image
      ? `${image.file.name} · ${image.w} × ${image.h} Pixel`
      : p && p.image ? `Aktuelles Foto: ${p.image}. Nur ein neues wählen, wenn es ersetzt werden soll.` : '';
  }

  async function onFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      A.toast('Bitte eine Bilddatei wählen (WebP, JPG oder PNG).', 'err');
      return;
    }
    try {
      file = await A.stableImage(file);
    } catch {
      return;
    }
    let bmp;
    try {
      bmp = await createImageBitmap(file);
    } catch {
      A.toast('Dieses Bild kann der Browser nicht öffnen. Bitte JPG oder PNG verwenden.', 'err');
      return;
    }
    if (image) URL.revokeObjectURL(image.url);
    image = { file, url: URL.createObjectURL(file), w: bmp.width, h: bmp.height };
    if (bmp.close) bmp.close();
    /* Hochformat: Gesicht meist im oberen Drittel */
    $('f-crop').value = landscape() ? 50 : 25;
    $('f-crop-l').textContent = landscape() ? 'Ausschnitt nach links oder rechts verschieben' : 'Ausschnitt nach oben oder unten verschieben';
    renderPhoto();
  }

  function openEditor(i) {
    const p = i >= 0 ? people[i] : null;
    editIndex = i;
    const form = $('so-form');
    form.reset();
    A.clearErrors(form);
    fillVoices(p ? p.voice : '');
    $('f-credit').value = A.credits.get(p && p.image);
    $('f-name').value = p ? p.name : '';
    $('f-surname').value = p ? p.surname : '';
    if (p && p.surname !== surnameOf(p.name)) $('f-surname').dataset.touched = '1';
    else delete $('f-surname').dataset.touched;
    $('f-deceased').checked = !!(p && p.deceased);
    if (image) URL.revokeObjectURL(image.url);
    image = null;
    renderPhoto();
    $('so-dlg-tag').textContent = p ? 'Bearbeiten' : 'Neu aufnehmen';
    $('so-dlg-title').textContent = p ? p.name : 'Neue Solistin, neuer Solist';
    $('so-delete').hidden = !p;
    A.openDialog($('so-dlg'), { isDirty: () => A.snapshot(form) !== snap || !!image });
    snap = A.snapshot(form);
  }

  /* Freier Dateiname (nachname-vorname.webp, …-2.webp); das eigene Foto darf ersetzt werden */
  async function freePath(base, ext, old) {
    let path = `${IMG_DIR}${base}.${ext}`;
    if (A.folder.state !== 'ok') return path;
    for (let n = 2; !(old && old.image === path) && await A.folder.exists(path); n++) path = `${IMG_DIR}${base}-${n}.${ext}`;
    return path;
  }

  async function save(ev) {
    ev.preventDefault();
    const form = $('so-form');
    const name = clean($('f-name').value);
    const surname = clean($('f-surname').value) || surnameOf(name);
    const voice = $('f-voice').value;
    const errors = [];
    if (!name) errors.push([$('f-name'), 'Bitte Vor- und Nachnamen eintragen.']);
    else if (people.some((p, i) => i !== editIndex && p.name.toLowerCase() === name.toLowerCase())) {
      errors.push([$('f-name'), `„${name}“ steht schon in der Liste.`]);
    }
    if (!voice) errors.push([$('f-voice'), 'Bitte die Stimmlage wählen.']);
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }

    const old = editIndex >= 0 ? people[editIndex] : null;
    const person = { name, surname, voice, image: old ? old.image : '', deceased: $('f-deceased').checked };
    const btn = $('so-save');
    btn.disabled = true;
    try {
      if (image) {
        const crop = Number($('f-crop').value) / 100;
        const conv = await A.toWebp(image.file, { square: true, size: 400, x: landscape() ? crop : 0.5, y: landscape() ? 0.5 : crop, quality: 0.86 });
        const first = name.slice(0, Math.max(0, name.lastIndexOf(surname))).trim();
        const path = await freePath(HD.slug(`${surname} ${first}`, 60) || 'solist', conv.ext, old);
        await A.saveFile(path, conv.blob);
        person.image = path;
      }
      const next = people.slice();
      if (old) next[editIndex] = person;
      else next.push(person);
      next.sort(bySurname);
      const direct = await A.saveFile(PATH, JSON.stringify(next, null, 2));
      people = next;
      if (person.image) await A.credits.set(person.image, $('f-credit').value);
      $('so-dlg').close();
      renderVoices();
      render();
      flash(person.name);
      A.toast(direct
        ? `Gespeichert: ${name}${image ? ' mit Foto' : ''}.`
        : `${name} übernommen. Bitte unten ${image ? 'beide Dateien' : 'die Datei'} herunterladen.`);
      A.log(`Solist ${old ? 'geändert' : 'aufgenommen'}: ${name}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function remove() {
    const p = people[editIndex];
    if (!p) return;
    const ok = await A.confirmBox({
      title: 'Aus der Liste entfernen?',
      html: `<strong>${esc(p.name)}</strong> (${esc(p.voice)})<br><br>Die Person verschwindet von der Seite Kirchenmusik → Solisten. Das Foto bleibt im Ordner erhalten.`,
      ok: 'Entfernen', danger: true
    });
    if (!ok) return;
    try {
      const next = people.filter((x) => x !== p);
      const direct = await A.saveFile(PATH, JSON.stringify(next, null, 2));
      people = next;
      $('so-dlg').close();
      renderVoices();
      render();
      A.toast(direct ? `Entfernt: ${p.name}.` : 'Entfernt. Bitte unten die Datei herunterladen.');
      A.log(`Solist entfernt: ${p.name}`);
    } catch (err) {
      A.toast(`Entfernen nicht möglich: ${err.message}`, 'err');
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    A.credits.load();
    $('so-new').addEventListener('click', () => openEditor(-1));
    $('so-form').addEventListener('submit', save);
    $('so-delete').addEventListener('click', remove);
    $('f-file').addEventListener('change', (ev) => onFile(ev.target.files[0]));
    $('f-crop').addEventListener('input', renderPhoto);
    A.wireDrop($('so-drop'));
    /* Nachname folgt dem Namen, bis er von Hand geaendert wird */
    $('f-name').addEventListener('input', () => {
      if (!$('f-surname').dataset.touched) $('f-surname').value = surnameOf($('f-name').value);
    });
    $('f-surname').addEventListener('input', (ev) => { ev.target.dataset.touched = '1'; });
    $('so-list').addEventListener('click', (ev) => {
      const card = ev.target.closest('.adm-person');
      if (card) openEditor(Number(card.dataset.i));
      if (ev.target.closest('[data-clear]')) {
        voiceFilter = '';
        query = '';
        $('so-search').value = '';
        renderVoices();
        render();
      }
    });
    $('so-voices').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-voice]');
      if (!b) return;
      voiceFilter = b.dataset.voice;
      renderVoices();
      render();
      /* Knoepfe werden neu gezeichnet: Fokus auf den gewaehlten zurueck */
      const again = $('so-voices').querySelector(`[data-voice="${CSS.escape(voiceFilter)}"]`);
      if (again) again.focus();
    });
    let timer = 0;
    $('so-search').addEventListener('input', (ev) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        query = ev.target.value;
        render();
      }, 120);
    });
    A.guard(() => $('so-dlg').open && (A.snapshot($('so-form')) !== snap || !!image));
    A.folder.on((state) => { if (state === 'ok') load(); });

    await load();
    if (new URLSearchParams(location.search).has('neu')) {
      openEditor(-1);
      history.replaceState(null, '', location.pathname);
    }
  });
})();
