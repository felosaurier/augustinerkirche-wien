/* ============================================================
   Augustinerkirche Wien — woche.js
   Wochenüberblick im Kalender (pages/kalender.html#woche): alle Termine einer
   Kalenderwoche, dieselben wie im Monat (js/kalender-daten.js), Montag bis
   Sonntag, auch Tage ohne Termin. Woche wählen: Pfeile (vier Wochen zurück,
   ein Jahr voraus) und „Zur aktuellen Woche“; dazu der Filter nach
   Wochentag. Oben die Umschaltung Monat / Woche (.cal-views). Aufruf mit
   #woche zeigt die Woche, ?woche=JJJJ-MM-TT (ein Tag der Woche) öffnet sie direkt.
   Benötigt js/hochaemter-data.js und js/kalender-daten.js.
   ============================================================ */
(function () {
  'use strict';

  const HD = window.HochamtData;
  const KD = window.KalenderDaten;
  const root = document.getElementById('woche');
  if (!HD || !KD || !root) return;

  const { MONTHS } = HD;
  const base = root.dataset.base || '';
  const DAY_KEYS = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
  const BACK = 4;       /* so viele Wochen zurueck */
  const AHEAD = 52;     /* so viele voraus */

  let items = [];
  let monday = null;    /* Date, Montag der gezeigten Woche */
  let day = 'alle';     /* Filter nach Wochentag */
  let ready = false;    /* Termine sind geladen */

  const isoOf = KD.isoOf;
  const addDays = (dt, n) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n);
  const mondayOf = (dt) => addDays(new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()), -((dt.getDay() + 6) % 7));
  const thisMonday = () => mondayOf(new Date());
  /* Kalenderwoche nach ISO 8601 (die Woche mit dem ersten Donnerstag ist KW 1) */
  function weekNo(mon) {
    const thu = addDays(mon, 3);
    const jan4 = new Date(thu.getFullYear(), 0, 4);
    return 1 + Math.round((thu - mondayOf(jan4)) / 604800000);
  }
  /* „12.–18. Oktober 2026“, über den Monatswechsel „28. September – 4. Oktober 2026“ */
  function rangeText(mon) {
    const sun = addDays(mon, 6);
    const m = (d) => MONTHS[d.getMonth()];
    if (mon.getMonth() === sun.getMonth()) return `${mon.getDate()}.–${sun.getDate()}. ${m(sun)} ${sun.getFullYear()}`;
    return `${mon.getDate()}. ${m(mon)}${mon.getFullYear() !== sun.getFullYear() ? ` ${mon.getFullYear()}` : ''} – ${sun.getDate()}. ${m(sun)} ${sun.getFullYear()}`;
  }

  function render(focusSel) {
    const today = isoOf(new Date());
    const from = isoOf(monday);
    const to = isoOf(addDays(monday, 6));
    const rel = { 0: 'Diese Woche', 1: 'Nächste Woche', '-1': 'Letzte Woche' }[Math.round((monday - thisMonday()) / 604800000)];
    root.querySelector('.wk-range').innerHTML = `KW ${weekNo(monday)} · ${rangeText(monday)}${rel ? `<span class="wk-rel">${rel}</span>` : ''}`;
    /* Wochenwahl oben und unten */
    for (const b of root.querySelectorAll('[data-wk="heute"]')) b.hidden = from === isoOf(thisMonday());
    for (const b of root.querySelectorAll('[data-wk="prev"]')) b.disabled = from <= isoOf(addDays(thisMonday(), -BACK * 7));
    for (const b of root.querySelectorAll('[data-wk="next"]')) b.disabled = from >= isoOf(addDays(thisMonday(), AHEAD * 7));

    const inWeek = items.filter((it) => it.date >= from && it.date <= to);
    const days = DAY_KEYS.map((key, i) => ({ key, iso: isoOf(addDays(monday, i)) }))
      .filter((d) => day === 'alle' || d.key === day);
    root.querySelector('.wk-list').innerHTML = days.map(({ key, iso }) =>
      KD.dayHTML(iso, inWeek.filter((it) => it.date === iso), today, { base, empty: 'Keine Termine', extraClass: `wk-day d-${key}`, id: `woche-${iso}` })).join('');
    const n = inWeek.length;
    /* „in dieser Woche“ fällt am Handy weg (.wk-count-lang), damit die Zeile nicht umbricht */
    root.querySelector('.wk-count').innerHTML = `${n === 1 ? 'Ein Termin' : `${n || 'Keine'} Termine`}<span class="wk-count-lang"> in dieser Woche</span>` +
      (inWeek.some((it) => it.cancelled) ? ', durchgestrichene entfallen' : '');
    root.querySelector('.wk-cal').href = `${base}pages/kalender.html?monat=${from.slice(0, 7)}`;
    for (const b of root.querySelectorAll('.week-filter-btn')) {
      b.classList.toggle('active', b.dataset.filter === day);
      b.setAttribute('aria-pressed', String(b.dataset.filter === day));
    }
    const q = new URLSearchParams(location.search);
    if (from === isoOf(thisMonday())) q.delete('woche');
    else q.set('woche', from);
    history.replaceState(null, '', `${location.pathname}${q.toString() ? `?${q}` : ''}${location.hash}`);
    if (focusSel) {
      const el = root.querySelector(focusSel);
      if (el && !el.disabled) el.focus();
    }
  }

  function go(mon, focusSel) {
    monday = mon;
    render(focusSel);
  }

  /* Zum heutigen Tag springen (nur wenn die aktuelle Woche gezeigt wird; die Kopfzeile bleibt sichtbar) */
  function scrollToToday(smooth) {
    if (root.hidden || monday === null || isoOf(monday) !== isoOf(thisMonday())) return;
    const el = root.querySelector(`#woche-${isoOf(new Date())}`);
    if (!el) return;
    const behavior = smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto';
    el.scrollIntoView({ block: 'start', behavior });
  }

  /* Monat oder Woche zeigen */
  const cal = document.getElementById('cal');
  function setView(view, push) {
    const week = view === 'woche';
    root.hidden = !week;
    if (cal) cal.hidden = week;
    for (const a of document.querySelectorAll('.cal-view')) {
      if (a.dataset.view === view) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    if (push) history.replaceState(null, '', `${location.pathname}${location.search}${week ? '#woche' : ''}`);
    /* Beim Wechsel zur Woche: immer zum heutigen Tag (bei einer anderen Woche bleibt es oben) */
    if (week && ready) {
      if (monday !== null && isoOf(monday) !== isoOf(thisMonday()) && !new URLSearchParams(location.search).has('woche')) go(thisMonday());
      scrollToToday(true);
    }
  }
  document.addEventListener('click', (ev) => {
    const v = ev.target.closest('.cal-view');
    if (!v) return;
    ev.preventDefault();
    setView(v.dataset.view, true);
  });
  window.addEventListener('hashchange', () => setView(location.hash === '#woche' ? 'woche' : 'monat'));
  setView(location.hash === '#woche' || new URLSearchParams(location.search).has('woche') ? 'woche' : 'monat');

  async function init() {
    const q = new URLSearchParams(location.search).get('woche');
    const start = q && HD.isoDate(q) ? HD.dateFromIso(HD.isoDate(q)) : new Date();
    monday = mondayOf(start);
    items = await KD.load(base);
    root.classList.add('ready');
    render();
    ready = true;
    /* Aufruf der Woche (#woche): zum heutigen Tag; ?woche=... zeigt bewusst eine andere Woche */
    if (!q) window.requestAnimationFrame(() => scrollToToday(false));
    KD.watchPast(root, () => render());

    root.addEventListener('click', (ev) => {
      const nav = ev.target.closest('[data-wk]');
      if (nav) {
        const what = nav.dataset.wk;
        /* unten gedrückt: der Fokus bleibt unten, die Seite springt zum Anfang der neuen Woche */
        const foot = nav.closest('.wk-foot');
        const sel = (s) => `${foot ? '.wk-foot ' : ''}${s}`;
        if (what === 'heute') {
          go(thisMonday(), sel('[data-wk="next"]'));
          scrollToToday(true);
        }
        else go(addDays(monday, what === 'prev' ? -7 : 7), sel(`[data-wk="${what}"]`));
        if (foot) root.querySelector('.wk-head').scrollIntoView({ block: 'start' });
        return;
      }
      const f = ev.target.closest('.week-filter-btn');
      if (f) {
        day = f.dataset.filter;
        render();
      }
    });
  }

  init();
})();
