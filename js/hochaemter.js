/* ============================================================
   Augustinerkirche Wien — hochaemter.js
   Kalender und Archiv der Hochaemter auf musik.html.
   Die Termine kommen aus data/hochaemter.csv (Excel-Tabelle,
   siehe js/hochaemter-data.js). Jede Zeile fuehrt zur Detailseite
   hochamt.html. Kommende Termine mit Monatsfilter in #p-hochaemter,
   vergangene in #p-hochaemter-archiv.
   ============================================================ */
(function () {
  'use strict';

  const HD = window.HochamtData;
  if (!HD) return;

  const DATA_URL = '../data/hochaemter.csv';
  const ARCHIVE_DIR = '../data/archiv/';
  /* Gleicher Umbruch wie in style.css: darunter ist das Seitenmenue eine Tab-Leiste */
  const wideLayout = window.matchMedia('(min-width: 1025px)');

  const qs = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const monthKey = (d) => `${d.getFullYear()}-${HD.pad(d.getMonth() + 1)}`;
  const monthLabel = (d) => `${HD.MONTHS[d.getMonth()]} ${d.getFullYear()}`;

  /* Aktiven Knopf einer Gruppe markieren (Optik ueber .active, Screenreader ueber aria-pressed) */
  function setPressed(buttons, active) {
    for (const b of buttons) {
      b.classList.toggle('active', b === active);
      b.setAttribute('aria-pressed', String(b === active));
    }
  }

  function rowHTML(entry) {
    const d = entry.dateObj;
    return `<a class="kal-row" data-m="${monthKey(d)}" href="hochamt.html?id=${encodeURIComponent(entry.id)}">` +
      `<div><div class="kal-d">${HD.pad(d.getDate())}</div><div class="kal-wd">${HD.WEEKDAYS_SHORT[d.getDay()]}</div>` +
        `<div class="kal-wd kal-yr">${HD.MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}</div></div>` +
      `<div><div class="kal-name">${HD.esc(entry.piece || entry.type)}</div><div class="kal-type">${HD.esc(entry.type)}</div></div>` +
      `<div><div class="kal-time">${HD.esc(entry.time)}</div><div class="kal-loc">${HD.esc(entry.location)}</div></div>` +
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

  /* Monatszeile (Querformat): eine Zeile, seitlich verschiebbar per Wischen,
     Trackpad oder Ziehen mit der Maus. Blendkanten zeigen, dass es weitergeht. */
  function initMonthScroller(monthsEl) {
    function updateEdges() {
      const max = monthsEl.scrollWidth - monthsEl.clientWidth;
      monthsEl.classList.toggle('has-left', monthsEl.scrollLeft > 2);
      monthsEl.classList.toggle('has-right', monthsEl.scrollLeft < max - 2);
    }
    monthsEl.addEventListener('scroll', updateEdges, { passive: true });
    window.addEventListener('resize', updateEdges);
    updateEdges();

    /* Ziehen mit der Maus (Touch und Trackpad scrollen nativ) */
    let down = false;
    let moved = false;
    let startX = 0;
    let startLeft = 0;
    monthsEl.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true;
      moved = false;
      startX = e.clientX;
      startLeft = monthsEl.scrollLeft;
    });
    window.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 5) {
        moved = true;
        monthsEl.classList.add('dragging');
      }
      if (moved) monthsEl.scrollLeft = startLeft - dx;
    });
    window.addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      monthsEl.classList.remove('dragging');
    });
    /* Nach dem Ziehen keinen Monat versehentlich anklicken (Capture-Phase faengt den Klick ab) */
    monthsEl.addEventListener('click', (e) => {
      if (!moved) return;
      e.preventDefault();
      e.stopPropagation();
      moved = false;
    }, true);

    /* Aktiven Reiter in die Mitte der Zeile holen */
    return function showActive() {
      const active = qs('.kal-m-btn.active', monthsEl);
      if (!active || monthsEl.scrollWidth <= monthsEl.clientWidth) return;
      monthsEl.scrollTo({ left: active.offsetLeft - (monthsEl.clientWidth - active.offsetWidth) / 2, behavior: 'smooth' });
    };
  }

  /* Wird der Bereich kuerzer, rutscht das klebende Seitenmenue (Querformat) aus dem Bild:
     dann an den Anfang des Bereichs zurueckscrollen. */
  function keepSidebarInView() {
    const sidebar = qs('.sidebar');
    if (!sidebar || !wideLayout.matches) return;
    const navH = (qs('nav') || { offsetHeight: 72 }).offsetHeight;
    if (sidebar.getBoundingClientRect().top < navH) {
      const wrap = sidebar.closest('.with-sidebar') || sidebar;
      window.scrollTo(0, wrap.getBoundingClientRect().top + window.pageYOffset - navH - 16);
    }
  }

  function renderUpcoming(entries, monthsEl, listEl) {
    if (!entries.length) {
      listEl.innerHTML = '<p class="s-text">Derzeit sind keine kommenden Hochämter eingetragen.</p>';
      return;
    }

    /* Monate in der Reihenfolge ihres ersten Termins */
    const groups = new Map();
    for (const { dateObj } of entries) {
      const key = monthKey(dateObj);
      if (!groups.has(key)) groups.set(key, monthLabel(dateObj));
    }
    const months = [...groups].map(([value, label]) => ({ value, label }));

    monthsEl.innerHTML = months.map((g, i) =>
      `<button type="button" class="kal-m-btn${i === 0 ? ' active' : ''}" data-filter="${g.value}" aria-pressed="${i === 0}">${g.label}</button>`
    ).join('');

    const oldSelect = qs('.kal-select-wrap', monthsEl.parentNode);
    if (oldSelect) oldSelect.remove();
    const selWrap = document.createElement('div');
    selWrap.className = 'kal-select-wrap';
    selWrap.innerHTML = selectHTML('kal-select', 'Monat wählen', months);
    monthsEl.before(selWrap);
    const select = qs('select', selWrap);

    listEl.innerHTML = entries.map(rowHTML).join('');

    const rows = qsa('.kal-row', listEl);
    const buttons = qsa('.kal-m-btn', monthsEl);
    const applyFilter = (key) => {
      for (const row of rows) row.style.display = row.dataset.m === key ? '' : 'none';
    };
    const showActive = initMonthScroller(monthsEl);

    for (const btn of buttons) {
      btn.addEventListener('click', () => {
        setPressed(buttons, btn);
        select.value = btn.dataset.filter;
        showActive();
        applyFilter(btn.dataset.filter);
        keepSidebarInView();
      });
    }
    select.addEventListener('change', () => {
      const btn = buttons.find((b) => b.dataset.filter === select.value);
      if (btn) btn.click();
    });
    applyFilter(months[0].value);
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
      if (a && a.anzahl) known.set(y, a.anzahl);
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
    const monthsEl = qs('#kal-months');
    const listEl = qs('#kal-list');
    const archiveList = qs('#kal-archive-list');
    if (!monthsEl && !listEl && !archiveList) return;

    try {
      const [data, years] = await Promise.all([
        HD.load(DATA_URL),
        archiveList ? HD.archiveYears(ARCHIVE_DIR) : []
      ]);
      const { upcoming, past } = HD.splitByDate(data);
      if (monthsEl && listEl) renderUpcoming(upcoming, monthsEl, listEl);
      if (archiveList) renderArchive(past, years, archiveList);
    } catch {
      const message = '<p class="s-text">Der Hochamt-Kalender konnte nicht geladen werden. Bitte laden Sie die Seite später noch einmal.</p>';
      if (listEl) listEl.innerHTML = message;
      if (archiveList) archiveList.innerHTML = message;
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
