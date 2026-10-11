/* ============================================================
   Augustinerkirche Wien — hochaemter.js
   Kalender und Archiv der Hochaemter auf musik.html.
   Die Termine kommen aus data/hochaemter.csv (Excel-Tabelle,
   siehe js/hochaemter-data.js). Jede Zeile fuehrt zur Detailseite
   hochamt.html. Alle kommenden Termine untereinander in #p-hochaemter,
   vergangene in #p-hochaemter-archiv.
   ============================================================ */
(function () {
  'use strict';

  const HD = window.HochamtData;
  if (!HD) return;

  const DATA_URL = '../data/hochaemter.csv';
  const ARCHIVE_DIR = '../data/archiv/';

  const qs = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* Aktiven Knopf einer Gruppe markieren (Optik ueber .active, Screenreader ueber aria-pressed) */
  function setPressed(buttons, active) {
    for (const b of buttons) {
      b.classList.toggle('active', b === active);
      b.setAttribute('aria-pressed', String(b === active));
    }
  }

  function rowHTML(entry) {
    const d = entry.dateObj;
    return `<a class="kal-row" href="hochamt.html?id=${encodeURIComponent(entry.id)}">` +
      `<div><div class="kal-d">${HD.pad(d.getDate())}</div><div class="kal-wd">${HD.WEEKDAYS_SHORT[d.getDay()]}</div>` +
        `<div class="kal-wd kal-yr">${HD.MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}</div></div>` +
      `<div><div class="kal-time">${HD.esc(entry.time)}</div></div>` +
      `<div><div class="kal-name">${HD.esc(entry.piece || entry.type)}</div><div class="kal-type">${HD.esc(entry.type)}${entry.location ? `, ${HD.esc(entry.location)}` : ''}</div></div>` +
      '<div class="kal-go" aria-hidden="true">&rarr;</div>' +
    '</a>';
  }

  /* Auswahlfeld fuer das Handy (dort sind die Reiter ausgeblendet) */
  function selectHTML(id, label, options) {
    return `<label class="kal-select-label" for="${id}">${label}</label>` +
      `<select id="${id}" class="kal-select">` +
        options.map((o) => `<option value="${HD.esc(o.value)}">${HD.esc(o.label)}</option>`).join('') +
      '</select>';
  }

  /* Alle kommenden Termine untereinander, nach Datum */
  function renderUpcoming(entries, listEl) {
    listEl.innerHTML = entries.length
      ? entries.map(rowHTML).join('')
      : '<p class="s-text">Derzeit sind keine kommenden Hochämter eingetragen.</p>';
  }

  function renderArchive(entries, archiveYears, listEl) {
    /* Anzahl je Jahr: aus den geladenen Terminen, sonst aus data/archiv/jahre.json */
    const counts = new Map();
    for (const e of entries) {
      const y = e.dateObj.getFullYear();
      counts.set(y, (counts.get(y) || 0) + 1);
    }
    const known = new Map();
    for (const a of archiveYears || []) {
      const y = Number(a && a.jahr !== undefined ? a.jahr : a);
      if (!y) continue;
      if (a && Number(a.anzahl) > 0) known.set(y, Math.round(Number(a.anzahl)));   /* nur Zahlen: der Wert landet im HTML */
      if (!counts.has(y)) counts.set(y, 0);
    }
    const years = [...counts.keys()].sort((a, b) => b - a);
    if (!years.length) {
      listEl.innerHTML = '<p class="s-text">Es sind noch keine vergangenen Hochämter erfasst.</p>';
      return;
    }
    const yearCount = (y) => counts.get(y) || known.get(y) || 0;

    /* Nach Jahren geordnet, wie im Neuigkeiten-Archiv: neuestes Jahr zuerst.
       Aeltere Jahre liegen in eigenen Dateien und werden erst beim Anklicken geladen. */
    listEl.innerHTML =
      `<div class="kal-select-wrap kal-year-wrap">${selectHTML('kal-year-select', 'Jahr wählen',
        years.map((y) => ({ value: y, label: yearCount(y) ? `${y} (${yearCount(y)})` : String(y) })))}</div>` +
      '<div class="news-years" role="group" aria-label="Jahr wählen">' +
        years.map((y, i) =>
          `<button type="button" class="news-year${i === 0 ? ' active' : ''}" data-year="${y}" aria-pressed="${i === 0}">${y}` +
          (yearCount(y) ? `<span class="news-year-n">${yearCount(y)}</span>` : '') + '</button>'
        ).join('') +
      '</div>' +
      '<div class="kal-archive-rows" aria-live="polite"></div>';

    const rowsEl = qs('.kal-archive-rows', listEl);
    const yearSelect = qs('#kal-year-select', listEl);
    const buttons = qsa('.news-year', listEl);
    const fill = (list) => { rowsEl.innerHTML = list.slice().sort(HD.byDateTimeDesc).map(rowHTML).join(''); };

    /* Wird schnell zwischen Jahren gewechselt, darf eine spaet eintreffende
       Antwort das zuletzt gewaehlte Jahr nicht ueberschreiben: jede Anfrage
       bekommt eine laufende Nummer, nur die neueste wird angezeigt. */
    let request = 0;
    async function showYear(y) {
      const mine = ++request;
      const own = entries.filter((e) => e.dateObj.getFullYear() === y);
      if (own.length) {
        fill(own);
        return;
      }
      rowsEl.innerHTML = '<p class="s-text">Wird geladen …</p>';
      try {
        const list = await HD.loadYear(ARCHIVE_DIR, y);
        if (mine === request) fill(list);
      } catch {
        if (mine === request) rowsEl.innerHTML = '<p class="s-text">Dieses Jahr konnte nicht geladen werden.</p>';
      }
    }

    listEl.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.news-year');
      if (!btn) return;
      setPressed(buttons, btn);
      if (yearSelect) yearSelect.value = btn.dataset.year;
      showYear(Number(btn.dataset.year));
    });
    if (yearSelect) {
      yearSelect.addEventListener('change', () => {
        const btn = buttons.find((b) => b.dataset.year === yearSelect.value);
        if (btn) btn.click();
      });
    }
    showYear(years[0]);
  }

  async function init() {
    const listEl = qs('#kal-list');
    const archiveList = qs('#kal-archive-list');
    if (!listEl && !archiveList) return;

    try {
      const [data, years] = await Promise.all([
        HD.load(DATA_URL),
        archiveList ? HD.archiveYears(ARCHIVE_DIR) : []
      ]);
      const { upcoming, past } = HD.splitByDate(data);
      if (listEl) renderUpcoming(upcoming, listEl);
      if (archiveList) renderArchive(past, years, archiveList);
    } catch {
      const message = '<p class="s-text">Der Hochamt-Kalender konnte nicht geladen werden. Bitte laden Sie die Seite später noch einmal.</p>';
      if (listEl) listEl.innerHTML = message;
      if (archiveList) archiveList.innerHTML = message;
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
