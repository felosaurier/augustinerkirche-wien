/* ============================================================
   Augustinerkirche Wien — hochaemter-start.js
   Zeigt auf der Startseite (#hs-list) automatisch die naechsten
   Hochaemter aus data/hochaemter.csv. Jeder Eintrag fuehrt zur
   Detailseite pages/hochamt.html.
   ============================================================ */
(function () {
  'use strict';

  const HD = window.HochamtData;
  const COUNT = 3;

  function itemHTML(e) {
    const d = e.dateObj;
    return `<a class="hs-item" href="pages/hochamt.html?id=${encodeURIComponent(e.id)}">` +
      '<div class="hs-when">' +
        `<span class="hs-day">${HD.pad(d.getDate())}</span>` +
        `<span class="hs-mon">${HD.MONTHS_SHORT[d.getMonth()]}</span>` +
        `<span class="hs-yr">${d.getFullYear()}</span>` +
      '</div>' +
      `<div class="hs-time">${HD.esc(e.time)}</div>` +
      `<div class="hs-main"><div class="hs-piece">${HD.esc(e.piece || e.type)}</div>` +
        `<div class="hs-meta">${HD.WEEKDAYS[d.getDay()]}, ${HD.esc(e.type)}</div></div>` +
    '</a>';
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const list = document.getElementById('hs-list');
    if (!list || !HD) return;
    try {
      const next = HD.splitByDate(await HD.load('data/hochaemter.csv')).upcoming.slice(0, COUNT);
      list.innerHTML = next.length
        ? next.map(itemHTML).join('')
        : '<p class="hs-fallback">Derzeit sind keine kommenden Hochämter eingetragen.</p>';
    } catch {
      /* Tabelle nicht erreichbar: der statische Hinweis mit Link bleibt stehen */
    }
  });
})();
