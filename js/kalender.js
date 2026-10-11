/* ============================================================
   Augustinerkirche Wien — kalender.js
   Kalender der Pfarre St. Augustin (pages/kalender.html). Die Termine
   (Hochämter, Gottesdienste mit Ferien und Ausfällen, Runden, eigene
   Termine) stellt js/kalender-daten.js zusammen.
   Links ein Monatsblatt (Tage mit Terminen haben Punkte in der Farbe
   der Gruppe), rechts bzw. darunter die Termine des Monats nach Tagen.
   Aufruf mit ?monat=JJJJ-MM öffnet einen Monat direkt, ?gruppe=hochamt,konzert
   zeigt nur diese Gruppen (Filter, wieder abwählbar).
   Benötigt js/hochaemter-data.js und js/kalender-daten.js.
   ============================================================ */
(function () {
  'use strict';

  const HD = window.HochamtData;
  const root = document.getElementById('cal');
  if (!HD || !window.KalenderDaten || !root) return;

  const { pad, MONTHS, WEEKDAYS } = HD;
  const base = root.dataset.base || '';

  const KD = window.KalenderDaten;
  const { GROUPS, groupName } = KD;

  let items = [];
  let month = null;             /* {y, m} mit m = 0..11 */
  const filter = new Set();     /* leer = alle Gruppen; sonst die gewaehlten, auch mehrere zusammen */
  let showPast = false;         /* laufender Monat: vergangene Tage aufgeklappt? */

  const { isoOf } = KD;
  const todayIso = () => isoOf(new Date());
  const monthKey = ({ y, m }) => `${y}-${pad(m + 1)}`;

  /* ---------- Darstellung ---------- */
  const inMonth = (it) => it.date.slice(0, 7) === monthKey(month);
  const visible = () => items.filter((it) => !filter.size || filter.has(it.group));

  function monthGrid() {
    const first = new Date(month.y, month.m, 1);
    const days = new Date(month.y, month.m + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7;         /* Montag zuerst */
    const today = todayIso();
    /* Tag -> Gruppe -> gibt es mindestens einen Termin, der stattfindet? */
    const byDay = new Map();
    for (const it of visible().filter(inMonth)) {
      if (!byDay.has(it.date)) byDay.set(it.date, new Map());
      const g = byDay.get(it.date);
      g.set(it.group, g.get(it.group) || !it.cancelled);
    }
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span class="cal-cell empty" aria-hidden="true"></span>';
    for (let d = 1; d <= days; d++) {
      const iso = `${monthKey(month)}-${pad(d)}`;
      const groups = byDay.get(iso);
      const cls = `cal-cell${iso === today ? ' today' : ''}${iso < today ? ' past' : ''}`;
      if (!groups) {
        cells += `<span class="${cls}"><span class="cal-num">${d}</span></span>`;
        continue;
      }
      /* Fällt eine Gruppe an diesem Tag ganz aus, ist ihr Zeichen nur ein Umriss */
      const dots = GROUPS.filter(([g]) => groups.has(g)).map(([g]) => `<i class="cal-dot g-${g}${groups.get(g) ? '' : ' off'}"></i>`).join('');
      const wd = WEEKDAYS[new Date(month.y, month.m, d).getDay()];
      const names = [...groups].map(([g, on]) => groupName.get(g) + (on ? '' : ' (entfällt)')).join(', ');
      cells += `<button type="button" class="${cls} has" data-day="${iso}" aria-label="${wd}, ${d}. ${MONTHS[month.m]}: ${names}">` +
        `<span class="cal-num">${d}</span><span class="cal-dots" aria-hidden="true">${dots}</span></button>`;
    }
    return '<div class="cal-week" aria-hidden="true"><span>Mo</span><span>Di</span><span>Mi</span><span>Do</span><span>Fr</span><span>Sa</span><span>So</span></div>' +
      `<div class="cal-grid">${cells}</div>`;
  }

  function daysHTML(list, today) {
    const days = new Map();
    for (const it of list) {
      if (!days.has(it.date)) days.set(it.date, []);
      days.get(it.date).push(it);
    }
    return [...days].map(([iso, its]) => KD.dayHTML(iso, its, today, { base })).join('');
  }

  function listHTML() {
    const today = todayIso();
    const all = visible().filter(inMonth)
      .sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')));
    if (!all.length) {
      const any = items.filter(inMonth).length;
      return `<p class="cal-empty">${any
        ? `Im ${MONTHS[month.m]} ${month.y} gibt es keine ${[...filter].map((g) => groupName.get(g)).join(' oder ')}.`
        : `Für ${MONTHS[month.m]} ${month.y} sind noch keine Termine eingetragen.`}</p>`;
    }
    /* Laufender Monat: die Liste beginnt heute, Vergangenes auf Wunsch */
    const upcoming = all.filter((it) => it.date >= today);
    const list = showPast || !upcoming.length ? all : upcoming;
    const hidden = all.length - list.length;
    const more = hidden
      ? `<button type="button" class="cal-earlier" data-cal="frueher">${hidden === 1 ? 'Einen früheren Termin' : `${hidden} frühere Termine`} im ${MONTHS[month.m]} anzeigen</button>`
      : '';
    return more + daysHTML(list, today);
  }

  function filterHTML() {
    const counts = new Map(GROUPS.map(([g]) => [g, 0]));
    const inThis = items.filter(inMonth);
    for (const it of inThis) counts.set(it.group, counts.get(it.group) + 1);
    const btn = (g, label, n) =>
      `<button type="button" class="cal-filter${g ? ` g-${g}` : ''}" data-group="${g}" aria-pressed="${g ? filter.has(g) : !filter.size}">` +
        `${g ? `<i class="cal-dot g-${g}"></i>` : ''}${label}<span class="n">${n}</span></button>`;
    return btn('', 'Alle', inThis.length) +
      GROUPS.filter(([g]) => counts.get(g) || filter.has(g)).map(([g, label]) => btn(g, label, counts.get(g))).join('');
  }

  function render(focusSel) {
    root.querySelector('.cal-title-m').textContent = `${MONTHS[month.m]} ${month.y}`;
    root.querySelector('.cal-month').innerHTML = monthGrid();
    root.querySelector('.cal-filters').innerHTML = filterHTML();
    root.querySelector('.cal-list').innerHTML = listHTML();
    const now = new Date();
    root.querySelector('[data-cal="heute"]').hidden = month.y === now.getFullYear() && month.m === now.getMonth();
    const q = new URLSearchParams(location.search);
    q.set('monat', monthKey(month));
    if (filter.size) q.set('gruppe', [...filter].join(','));
    else q.delete('gruppe');
    history.replaceState(null, '', `${location.pathname}?${q}${location.hash}`);
    if (focusSel) {
      const el = root.querySelector(focusSel);
      if (el) el.focus();
    }
  }

  function shift(delta) {
    const dt = new Date(month.y, month.m + delta, 1);
    month = { y: dt.getFullYear(), m: dt.getMonth() };
    showPast = false;
    render();
  }

  function scrollToDay(iso) {
    let day = document.getElementById(`tag-${iso}`);
    /* Tag liegt im eingeklappten Teil des Monats: zuerst aufklappen */
    if (!day && !showPast) {
      showPast = true;
      root.querySelector('.cal-list').innerHTML = listHTML();
      day = document.getElementById(`tag-${iso}`);
    }
    if (!day) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    day.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    day.classList.remove('flash');
    void day.offsetWidth;
    day.classList.add('flash');
  }

  /* ---------- Start ---------- */
  async function init() {
    const q = new URLSearchParams(location.search).get('monat');
    const m = q && q.match(/^(\d{4})-(\d{2})$/);
    const now = new Date();
    month = m ? { y: Number(m[1]), m: Math.min(11, Math.max(0, Number(m[2]) - 1)) } : { y: now.getFullYear(), m: now.getMonth() };
    /* Vorauswahl der Gruppen, z. B. von der Kirchenmusik: nur Hochämter und Konzerte */
    for (const g of (new URLSearchParams(location.search).get('gruppe') || '').split(',')) {
      if (groupName.has(g)) filter.add(g);
    }

    items = await KD.load(base);
    root.classList.add('ready');
    render();

    root.addEventListener('click', (ev) => {
      const nav = ev.target.closest('[data-cal]');
      if (nav) {
        const what = nav.dataset.cal;
        if (what === 'frueher') {
          showPast = true;
          root.querySelector('.cal-list').innerHTML = listHTML();
          const first = root.querySelector('.cal-day');
          if (first) first.querySelector('.cal-row').focus({ preventScroll: true });
        } else if (what === 'heute') {
          month = { y: now.getFullYear(), m: now.getMonth() };
          showPast = false;
          render('[data-cal="next"]');
        } else {
          shift(what === 'prev' ? -1 : 1);
        }
        return;
      }
      const f = ev.target.closest('.cal-filter');
      if (f) {
        const g = f.dataset.group;
        /* "Alle" hebt die Auswahl auf; eine Gruppe wird dazu- oder wieder weggenommen (Hochaemter + Gottesdienste zusammen) */
        if (!g) filter.clear();
        else if (filter.has(g)) filter.delete(g);
        else filter.add(g);
        render(`.cal-filter[data-group="${g}"]`);
        return;
      }
      const day = ev.target.closest('.cal-cell[data-day]');
      if (day) scrollToDay(day.dataset.day);
    });
  }

  init();
})();
