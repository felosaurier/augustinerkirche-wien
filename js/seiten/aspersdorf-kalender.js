/* ============================================================
   Augustinerkirche Wien — aspersdorf-kalender.js
   Kalender der Pfarre Aspersdorf (pages/aspersdorf.html → Gottesdienste & Kalender):
   umschaltbar zwischen Woche (Sonntag bis Sonntag, wie der Wochenkalender der
   Augustinerkirche) und Monat. Gleiche Darstellung wie pages/kalender.html
   (KalenderDaten.dayHTML): Tag, Kirchenjahr, Uhrzeit, Bezeichnung, Hinweis;
   ausgefallene Gottesdienste durchgestrichen. Termine aus
   js/gemeinsam/aspersdorf-daten.js (data/aspersdorf-gottesdienste.json).
   Woche: vier zurueck, ein Jahr voraus; Monat: zwei zurueck, zwoelf voraus.
   ============================================================ */
(function () {
  'use strict';

  const HD = window.HochamtData;
  const KD = window.KalenderDaten;
  const AD = window.AspersdorfDaten;
  const root = document.getElementById('asp-kal');
  if (!HD || !KD || !AD || !root) return;

  const { MONTHS } = HD;
  const base = root.dataset.base || '';
  const addDays = (dt, n) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n);
  const isoOf = AD.isoOf;
  const today0 = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  /* Woche von Sonntag bis Sonntag, benannt nach dem Montag dazwischen; am Sonntag beginnt die neue */
  const isoMonday = (dt) => addDays(dt, -((dt.getDay() + 6) % 7));
  const mondayOf = (dt) => isoMonday(dt.getDay() === 0 ? addDays(dt, 1) : dt);
  const firstOf = (dt) => new Date(dt.getFullYear(), dt.getMonth(), 1);

  let data = null;
  let view = 'woche';
  let monday = mondayOf(today0());
  let month = firstOf(today0());

  const list = root.querySelector('.wk-list');
  const range = root.querySelector('.wk-range');
  const count = root.querySelector('.wk-count');
  const heute = root.querySelector('[data-k="heute"]');
  const prev = root.querySelector('[data-k="prev"]');
  const next = root.querySelector('[data-k="next"]');

  function weekNo(mon) {
    const thu = addDays(mon, 3);
    return 1 + Math.round((thu - isoMonday(new Date(thu.getFullYear(), 0, 4))) / 604800000);
  }
  function weekText(mon) {
    const a = addDays(mon, -1);
    const b = addDays(mon, 6);
    return a.getMonth() === b.getMonth()
      ? `${a.getDate()}.–${b.getDate()}. ${MONTHS[b.getMonth()]} ${b.getFullYear()}`
      : `${a.getDate()}. ${MONTHS[a.getMonth()]} – ${b.getDate()}. ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  }

  function render() {
    const t = today0();
    const todayIso = isoOf(t);
    let von;
    let bis;
    let days;
    let rel = '';
    if (view === 'woche') {
      von = isoOf(addDays(monday, -1));
      bis = isoOf(addDays(monday, 6));
      days = Array.from({ length: 8 }, (_, i) => isoOf(addDays(monday, i - 1)));
      const diff = Math.round((monday - mondayOf(t)) / 604800000);
      rel = { 0: 'Diese Woche', 1: 'Nächste Woche', '-1': 'Letzte Woche' }[diff] || '';
      range.innerHTML = `KW ${weekNo(monday)} · ${weekText(monday)}${rel ? `<span class="wk-rel">${rel}</span>` : ''}`;
      prev.disabled = diff <= -4;
      next.disabled = diff >= 52;
      heute.hidden = diff === 0;
      heute.textContent = 'Zur aktuellen Woche';
      prev.setAttribute('aria-label', 'Vorige Woche');
      next.setAttribute('aria-label', 'Nächste Woche');
    } else {
      const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      von = isoOf(month);
      bis = isoOf(last);
      const diff = (month.getFullYear() - t.getFullYear()) * 12 + month.getMonth() - t.getMonth();
      range.innerHTML = `${MONTHS[month.getMonth()]} ${month.getFullYear()}${diff === 0 ? '<span class="wk-rel">Dieser Monat</span>' : ''}`;
      prev.disabled = diff <= -2;
      next.disabled = diff >= 12;
      heute.hidden = diff === 0;
      heute.textContent = 'Zum aktuellen Monat';
      prev.setAttribute('aria-label', 'Voriger Monat');
      next.setAttribute('aria-label', 'Nächster Monat');
    }
    const its = AD.items(data, von, bis);
    /* Monat: nur Tage mit Terminen; Woche: alle acht Tage */
    if (view === 'monat') days = [...new Set(its.map((it) => it.date))];
    list.innerHTML = days.length
      ? days.map((iso) => KD.dayHTML(iso, its.filter((it) => it.date === iso), todayIso,
        { base, empty: 'Keine Termine', extraClass: 'wk-day', id: `asp-${iso}` })).join('')
      : '<p class="cal-empty">In diesem Monat sind keine Termine eingetragen.</p>';
    const n = its.length;
    count.textContent = `${n === 1 ? 'Ein Termin' : n ? `${n} Termine` : 'Keine Termine'} ${view === 'woche' ? 'in dieser Woche' : 'in diesem Monat'}` +
      (its.some((it) => it.cancelled) ? ', durchgestrichene entfallen' : '');
    for (const b of root.querySelectorAll('.cal-view')) {
      if (b.dataset.view === view) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    }
  }

  root.addEventListener('click', (ev) => {
    const v = ev.target.closest('.cal-view');
    if (v) {
      view = v.dataset.view;
      render();
      return;
    }
    const k = ev.target.closest('[data-k]');
    if (!k || k.disabled) return;
    const step = k.dataset.k;
    if (view === 'woche') {
      monday = step === 'heute' ? mondayOf(today0()) : addDays(monday, step === 'prev' ? -7 : 7);
    } else {
      month = step === 'heute' ? firstOf(today0()) : new Date(month.getFullYear(), month.getMonth() + (step === 'prev' ? -1 : 1), 1);
    }
    render();
    if (step === 'heute') prev.focus();
  });

  (async () => {
    data = await AD.load(base);
    if (!data || !(AD.regelOf(data).length || AD.termineOf(data).length)) return;
    root.hidden = false;
    render();
    KD.watchPast(root, render);
  })();
})();
