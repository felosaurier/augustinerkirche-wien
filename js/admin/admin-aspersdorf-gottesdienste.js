/* ============================================================
   Augustinerkirche Wien — admin-aspersdorf-gottesdienste.js
   Regelmaessige Gottesdienste und besondere Termine der Pfarre
   Aspersdorf pflegen (admin/aspersdorf-gottesdienste.html). Quelle ist
   data/aspersdorf-gottesdienste.json:
     {regelmaessig: [{tag, zeit, name, hinweis}], termine: [{datum, zeit, name, hinweis}]}
   tag: so, mo, di, mi, do, fr, sa; rhythmus und pause (wann im Kalender) sowie art ('entfaellt')
   siehe js/gemeinsam/aspersdorf-daten.js. Die Angaben fuers Monatsblatt (details, licht) pflegt
   admin/aspersdorf-monatsblatt.html; sie bleiben beim Speichern hier unveraendert.
   Fehlt die Datei, gilt die Tabelle in pages/aspersdorf.html; sie steht unten als Vorgabe (VORGABE) und wird
   beim ersten Speichern zur Datei. Anzeige: js/gemeinsam/inhalte.js (aspGottesdienste).
   Benoetigt js/gemeinsam/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { HD, $, esc, icon } = A;
  const PATH = 'data/aspersdorf-gottesdienste.json';
  const TAGE = [['so', 'Sonntag'], ['mo', 'Montag'], ['di', 'Dienstag'], ['mi', 'Mittwoch'], ['do', 'Donnerstag'], ['fr', 'Freitag'], ['sa', 'Samstag']];
  const ORDER = TAGE.map(([k]) => k);
  /* Stand der Seite pages/aspersdorf.html, solange es die Datei noch nicht gibt */
  const VORGABE = {
    regelmaessig: [
      { tag: 'so', zeit: '08:30', name: 'Heilige Messe', hinweis: 'Pfarrkirche St. Georg, Aspersdorf' },
      { tag: 'mi', zeit: '17:30', name: 'Beichtgelegenheit', hinweis: 'vor den Werktags- und Vorabendmessen' },
      { tag: 'mi', zeit: '18:00', name: 'Heilige Messe', hinweis: 'monatlich, außer Juli/August — abwechselnd in Wieselsfeld' },
      { tag: 'sa', zeit: '18:00', name: 'Vorabendmesse', hinweis: 'in der Regel 1. und 3. Samstag im Monat, anstelle der Sonntagsmesse' }
    ],
    termine: []
  };

  /* Wann ein regelmaessiger Gottesdienst im Kalender steht (js/gemeinsam/aspersdorf-daten.js) */
  const RHYTHMEN = [['', 'jede Woche'], ['1', '1. im Monat'], ['2', '2. im Monat'], ['3', '3. im Monat'], ['4', '4. im Monat'],
    ['L', 'letzter im Monat'], ['1,3', '1. und 3. im Monat'], ['2,4', '2. und 4. im Monat'], ['aus', 'nicht automatisch (als besondere Termine eintragen)']];
  const PAUSEN = [['', 'keine'], ['7,8', 'Juli und August'], ['8', 'August'], ['7', 'Juli']];
  const pauseKey = (t) => (Array.isArray(t.pause) ? t.pause.join(',') : String(t.pause || ''));
  const ARTEN = [['', 'Termin'], ['entfaellt', 'Entfällt']];

  let neu = false;        /* true = Datei gibt es noch nicht */
  let ready = false;
  let snap = '';

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  const byDay = (a, b) => ORDER.indexOf(a.tag) - ORDER.indexOf(b.tag) || String(a.zeit).localeCompare(String(b.zeit));
  const byDate = (a, b) => String(a.datum).localeCompare(String(b.datum)) || String(a.zeit).localeCompare(String(b.zeit));

  /* ---------- Zeilen ---------- */
  const tools = (label) =>
    '<div class="adm-list-tools">' +
      `<button type="button" class="adm-list-btn adm-list-del" data-del title="Entfernen" aria-label="${esc(label)} entfernen">${icon('close')}</button>` +
    '</div>';

  function regelRow(t = {}) {
    const row = document.createElement('div');
    row.className = 'adm-list-row ag-row ag-regel';
    row.innerHTML =
      `<select class="adm-input" data-key="tag" aria-label="Wochentag">${TAGE.map(([k, n]) => `<option value="${k}"${t.tag === k ? ' selected' : ''}>${n}</option>`).join('')}</select>` +
      `<input class="adm-input" type="time" data-key="zeit" aria-label="Uhrzeit" value="${esc(t.zeit || '')}"/>` +
      `<input class="adm-input" type="text" data-key="name" aria-label="Bezeichnung" maxlength="120" placeholder="z. B. Heilige Messe" value="${esc(t.name || '')}"/>` +
      `<input class="adm-input" type="text" data-key="hinweis" aria-label="Hinweis" maxlength="300" placeholder="optional, z. B. Ort" value="${esc(t.hinweis || '')}"/>` +
      tools('Gottesdienst') +
      '<div class="ag-more">' +
        `<label><span>Im Kalender</span><select class="adm-input" data-key="rhythmus">${RHYTHMEN.map(([v, n]) => `<option value="${v}"${String(t.rhythmus || '') === v ? ' selected' : ''}>${n}</option>`).join('')}</select></label>` +
        `<label><span>Pause</span><select class="adm-input" data-key="pause">${PAUSEN.map(([v, n]) => `<option value="${v}"${pauseKey(t) === v ? ' selected' : ''}>${n}</option>`).join('')}</select></label>` +
      '</div>';
    return row;
  }

  function terminRow(t = {}) {
    const row = document.createElement('div');
    row.className = 'adm-list-row ag-row ag-termin';
    row.innerHTML =
      `<input class="adm-input" type="date" data-key="datum" aria-label="Datum" value="${esc(t.datum || '')}"/>` +
      `<select class="adm-input" data-key="art" aria-label="Art">${ARTEN.map(([v, n]) => `<option value="${v}"${(t.art || '') === v ? ' selected' : ''}>${n}</option>`).join('')}</select>` +
      `<input class="adm-input" type="time" data-key="zeit" aria-label="Uhrzeit" value="${esc(t.zeit || '')}"/>` +
      `<input class="adm-input" type="text" data-key="name" aria-label="Bezeichnung" maxlength="120" placeholder="z. B. Christmette" value="${esc(t.name || '')}"/>` +
      `<input class="adm-input" type="text" data-key="hinweis" aria-label="Hinweis" maxlength="300" placeholder="optional, z. B. Ort oder Mitwirkende" value="${esc(t.hinweis || '')}"/>` +
      tools('Termin');
    markPast(row);
    return row;
  }

  /* Vergangene Termine grau (stehen nicht mehr auf der Website) */
  function markPast(row) {
    const d = row.querySelector('[data-key="datum"]');
    if (d) row.classList.toggle('is-past', !!d.value && d.value < A.isoToday());
    const art = row.querySelector('[data-key="art"]');
    if (art) {
      row.classList.toggle('is-off', art.value === 'entfaellt');
      const name = row.querySelector('[data-key="name"]');
      const hinweis = row.querySelector('[data-key="hinweis"]');
      name.placeholder = art.value === 'entfaellt' ? 'welcher Gottesdienst, z. B. Heilige Messe' : 'z. B. Christmette';
      hinweis.placeholder = art.value === 'entfaellt' ? 'Grund, z. B. Pfarrausflug' : 'optional, z. B. Ort oder Mitwirkende';
    }
  }

  const values = (host) => Array.from(host.querySelectorAll('.ag-row')).map((row) => {
    const o = {};
    row.querySelectorAll('[data-key]').forEach((el) => { o[el.dataset.key] = clean(el.value); });
    return o;
  });
  const state = () => JSON.stringify([values($('ag-regel')), values($('ag-termine'))]);

  function fill(data) {
    const regel = (Array.isArray(data.regelmaessig) ? data.regelmaessig : []).filter((t) => t && ORDER.includes(t.tag)).slice().sort(byDay);
    const termine = (Array.isArray(data.termine) ? data.termine : []).filter((t) => t && HD.isoDate(t.datum)).slice().sort(byDate);
    $('ag-regel').replaceChildren(...regel.map(regelRow));
    $('ag-termine').replaceChildren(...termine.map(terminRow));
    snap = state();
    showState();
  }

  function showState() {
    const dirty = ready && state() !== snap;
    $('ag-state').textContent = dirty ? 'Noch nicht gespeichert' : neu ? 'Noch nicht gespeichert: so steht es derzeit auf der Website' : '';
  }

  /* ---------- Laden ---------- */
  async function load() {
    ready = false;
    try {
      const d = await A.readJSON(PATH);
      if (!d || typeof d !== 'object') throw new Error('unerwarteter Inhalt');
      neu = false;
      fill(d);
    } catch (e) {
      if (e && (e.status === 404 || e.name === 'NotFoundError')) {
        neu = true;
        fill(VORGABE);
      } else {
        $('ag-form').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Datei <code>${PATH}</code> konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
        return;
      }
    }
    ready = true;
    showState();
  }

  /* ---------- Speichern ---------- */
  function check() {
    const errors = [];
    const rows = (host) => Array.from(host.querySelectorAll('.ag-row'));
    for (const row of [...rows($('ag-regel')), ...rows($('ag-termine'))]) {
      const get = (k) => row.querySelector(`[data-key="${k}"]`);
      const leer = Array.from(row.querySelectorAll('input')).every((el) => !clean(el.value));
      if (leer) continue;
      if (!clean(get('name').value)) errors.push([get('name'), 'Bitte eine Bezeichnung eintragen.']);
      const zeit = get('zeit');
      if (zeit.value && !isTime(zeit.value)) errors.push([zeit, 'Bitte die Uhrzeit als HH:MM angeben.']);
      if (row.classList.contains('ag-regel') && !zeit.value) errors.push([zeit, 'Bitte die Uhrzeit angeben.']);
      const datum = get('datum');
      if (datum && !HD.isoDate(datum.value)) errors.push([datum, 'Bitte das Datum angeben.']);
    }
    return errors;
  }

  async function save(ev) {
    ev.preventDefault();
    if (!ready) return;
    const form = $('ag-form');
    A.clearErrors(form);
    const errors = check();
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }
    const filled = (t) => t.name || t.hinweis;
    const data = {
      regelmaessig: values($('ag-regel')).filter(filled).map((t) => ({
        tag: t.tag, zeit: t.zeit, name: t.name, hinweis: t.hinweis,
        ...(t.rhythmus ? { rhythmus: t.rhythmus } : {}),
        ...(t.pause ? { pause: t.pause.split(',').map(Number) } : {})
      })).sort(byDay),
      termine: values($('ag-termine')).filter(filled).map((t) => ({ datum: t.datum, zeit: t.zeit, name: t.name, hinweis: t.hinweis, ...(t.art ? { art: t.art } : {}) })).sort(byDate),
    };
    /* Intention, Lektoren, Ewiges Licht … pflegt die Seite Monatsblatt: aus der Datei, wie sie jetzt ist, uebernehmen */
    try {
      const jetzt = await A.readJSON(PATH);
      if (jetzt && jetzt.details) data.details = jetzt.details;
      if (jetzt && jetzt.licht) data.licht = jetzt.licht;
    } catch { /* Datei gibt es noch nicht */ }
    const btn = $('ag-save');
    btn.disabled = true;
    try {
      const direct = await A.saveFile(PATH, JSON.stringify(data, null, 2) + '\n');
      neu = false;
      fill(data);
      A.toast(direct ? 'Gottesdienste & Termine gespeichert.' : 'Übernommen. Bitte unten die Datei herunterladen.');
      A.log('Aspersdorf: Gottesdienste & Termine geändert');
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    const add = (host, make) => {
      const row = make();
      host.append(row);
      row.querySelector('select, input').focus();
      showState();
    };
    $('ag-regel-add').addEventListener('click', () => add($('ag-regel'), () => regelRow({ tag: 'so' })));
    $('ag-termine-add').addEventListener('click', () => add($('ag-termine'), () => terminRow({})));
    $('ag-form').addEventListener('click', (ev) => {
      const del = ev.target.closest('[data-del]');
      if (!del) return;
      const row = del.closest('.ag-row');
      const next = row.nextElementSibling || row.previousElementSibling;
      row.remove();
      if (next) next.querySelector('input, select').focus();
      showState();
    });
    $('ag-form').addEventListener('input', (ev) => {
      const row = ev.target.closest('.ag-termin');
      if (row) markPast(row);
      showState();
    });
    $('ag-form').addEventListener('change', (ev) => {
      const row = ev.target.closest('.ag-termin');
      if (row) markPast(row);
      showState();
    });
    $('ag-form').addEventListener('submit', save);
    A.guard(() => ready && state() !== snap);
    A.folder.on((s) => { if (s === 'ok') load(); });
    await load();
  });
})();
