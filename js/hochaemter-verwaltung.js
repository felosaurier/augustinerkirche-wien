/* ============================================================
   Augustinerkirche Wien — hochaemter-verwaltung.js
   Komfortables Bearbeiten von data/hochaemter.csv im Browser.
   Laedt die Tabelle, erlaubt Hinzufuegen/Bearbeiten/Loeschen,
   importiert eine in Excel bearbeitete CSV und exportiert die
   Liste wieder als Excel-taugliche CSV-Datei.
   ============================================================ */
(function () {
  'use strict';

  const HD = window.HochamtData;
  const DATA_URL = '../data/hochaemter.csv';
  const { FIELDS } = HD;
  /* Felder mit viel Text bekommen breitere Eingabefelder */
  const LONG = new Set(['piece', 'soloists', 'organist', 'extra', 'note']);
  /* Vorbelegung neuer Eintraege */
  const DEFAULTS = { time: '11:00', location: 'Augustinerkirche', type: 'Hochamt' };

  let entries = [];

  const qs = (sel) => document.querySelector(sel);
  function status(msg) {
    const el = qs('#verw-status');
    if (el) el.textContent = msg;
  }

  const inputType = (key) => (key === 'date' ? 'date' : key === 'time' ? 'time' : 'text');

  /* Roh-Eintrag -> Formularwerte (ISO-Datum, HH:MM) */
  function prepare(o) {
    const e = {};
    for (const [key] of FIELDS) e[key] = o[key] || '';
    e.date = HD.isoDate(e.date);
    e.time = HD.isoTime(e.time) || DEFAULTS.time;
    return e;
  }
  const sortEntries = () => entries.sort(HD.byDateTime);
  function setEntries(raw) {
    entries = raw.map(prepare).filter((e) => e.date);
    sortEntries();
    render();
  }

  async function load() {
    try {
      setEntries(await HD.loadRaw(DATA_URL));
      status(`Aktuelle Liste geladen (${entries.length} Einträge).`);
    } catch {
      entries = [];
      render();
      status('Konnte data/hochaemter.csv nicht laden — die Liste ist leer.');
    }
  }

  function resetFormDefaults() {
    for (const [key, value] of Object.entries(DEFAULTS)) qs(`#f-${key}`).value = value;
  }

  function buildForm() {
    const form = qs('#verw-form');
    form.innerHTML = FIELDS.map(([key, label]) =>
      `<div class="verw-field${LONG.has(key) ? ' wide' : ''}"><label for="f-${key}">${label}</label>` +
        `<input type="${inputType(key)}" id="f-${key}"${key === 'date' || key === 'piece' ? ' required' : ''}` +
        (DEFAULTS[key] ? ` value="${HD.esc(DEFAULTS[key])}"` : '') + '/></div>'
    ).join('') + '<button type="submit" class="btn btn-dark">Hinzufügen</button>';

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const o = {};
      for (const [key] of FIELDS) o[key] = qs(`#f-${key}`).value;
      entries.push(prepare(o));
      sortEntries();
      render();
      form.reset();
      resetFormDefaults();
      qs('#f-date').focus();
    });
  }

  function render() {
    const head = qs('#verw-thead');
    const tbody = qs('#verw-tbody');
    if (!tbody) return;
    head.innerHTML = `<tr>${FIELDS.map(([, label]) => `<th scope="col">${label}</th>`).join('')}<th scope="col"><span class="visually-hidden">Aktion</span></th></tr>`;
    /* Jede Zelle ist ein Eingabefeld; aria-label nennt Spalte und Datum,
       weil es keine sichtbare Beschriftung direkt am Feld gibt. */
    tbody.innerHTML = entries.map((entry, i) => '<tr>' +
      FIELDS.map(([key, label]) =>
        `<td><input type="${inputType(key)}" data-field="${key}" value="${HD.esc(entry[key])}"` +
        ` aria-label="${HD.esc(`${label} (${entry.date || 'neu'})`)}"${LONG.has(key) ? ' class="wide"' : ''}/></td>`
      ).join('') +
      `<td><button type="button" class="verw-del" data-index="${i}">Entfernen</button></td></tr>`
    ).join('');
  }

  /* Event-Delegation: Aenderungen und Loeschen fuer alle Zeilen an einer Stelle */
  function initTable() {
    const tbody = qs('#verw-tbody');
    tbody.addEventListener('change', (ev) => {
      const input = ev.target.closest('input[data-field]');
      if (!input) return;
      const index = Array.prototype.indexOf.call(tbody.children, input.closest('tr'));
      if (entries[index]) entries[index][input.dataset.field] = input.value;
    });
    tbody.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.verw-del');
      if (!btn) return;
      entries.splice(Number(btn.dataset.index), 1);
      render();
    });
  }

  function initDownload() {
    qs('#verw-download').addEventListener('click', () => {
      sortEntries();
      HD.download(new Blob([HD.toCSV(entries)], { type: 'text/csv;charset=utf-8' }), 'hochaemter.csv');
      status('Datei heruntergeladen — bitte data/hochaemter.csv damit ersetzen.');
    });
  }

  function initImport() {
    qs('#verw-import').addEventListener('change', async (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      setEntries(HD.rowsToRaw(HD.parseCSV(await file.text())));
      status(`„${file.name}“ importiert (${entries.length} Einträge). Zum Übernehmen bitte wieder herunterladen.`);
      ev.target.value = '';
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    buildForm();
    initTable();
    initDownload();
    initImport();
    qs('#verw-reload').addEventListener('click', load);
    load();
  });
})();
