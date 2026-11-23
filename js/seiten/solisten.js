/* ============================================================
   Augustinerkirche Wien — solisten.js
   Vollstaendige Solistenliste auf musik.html. Laedt
   data/solisten.json und erlaubt Sortierung alphabetisch
   (nach Nachname) oder nach Stimmlage.
   Benoetigt js/gemeinsam/hochaemter-data.js (HTML-Escaping, sichere Pfade).
   ============================================================ */
(function () {
  'use strict';

  const HD = window.HochamtData;
  if (!HD) return;

  const UP = (window.AugT && window.AugT.up) || '';   /* auf uebersetzten Seiten (en/pages/…) eine Ebene tiefer */
  const DATA_URL = UP + '../data/solisten.json';
  /* Stimmlagen von hoch nach tief; unbekannte Angaben ans Ende */
  const VOICE_ORDER = ['Sopran', 'Mezzosopran', 'Alt', 'Altus', 'Tenor', 'Bariton', 'Bass'];
  const collator = new Intl.Collator('de');

  const qs = (sel) => document.querySelector(sel);
  const { esc } = HD;

  function cardHTML(p) {
    const name = esc(p.name) + (p.deceased ? ' †' : '');
    /* Mit Homepage ist der Name ein Link (neues Fenster) */
    const home = /^https?:\/\//i.test(String(p.homepage || '').trim()) && HD.safeUrl(p.homepage.trim());
    return '<div class="person-card-wide compact">' +
      `<img src="${esc(HD.safeUrl(p.image, UP + '../'))}" alt="${name}" width="300" height="300" loading="lazy" decoding="async"/>` +
      '<div class="person-body">' +
        `<div class="person-name">${home ? `<a href="${esc(home)}" target="_blank" rel="noopener">${name}</a>` : name}</div>` +
        `<div class="person-role">${esc(p.voice)}</div>` +
      '</div>' +
    '</div>';
  }

  const bySurname = (a, b) => collator.compare(a.surname, b.surname);
  const voiceRank = (p) => {
    const i = VOICE_ORDER.indexOf(p.voice);
    return i === -1 ? VOICE_ORDER.length : i;
  };
  const SORTS = {
    alpha: (data) => data.slice().sort(bySurname),
    voice: (data) => data.slice().sort((a, b) => voiceRank(a) - voiceRank(b) || bySurname(a, b))
  };

  async function init() {
    const container = qs('#solisten-list');
    if (!container) return;
    const status = qs('#solisten-status');
    const buttons = { alpha: qs('#solisten-sort-alpha'), voice: qs('#solisten-sort-voice') };

    let data;
    try {
      data = await HD.fetchJSON(DATA_URL);
      if (!Array.isArray(data) || !data.length) throw new Error('Leere Liste');
    } catch {
      container.innerHTML = '<p class="s-text">Die Solistenliste konnte nicht geladen werden.</p>';
      return;
    }

    function show(mode) {
      container.innerHTML = SORTS[mode](data).map(cardHTML).join('');
      for (const [key, btn] of Object.entries(buttons)) {
        if (!btn) continue;
        btn.classList.toggle('active', key === mode);
        btn.setAttribute('aria-pressed', String(key === mode));
      }
    }

    if (status) status.textContent = `${data.length} Sängerinnen und Sänger`;
    for (const [key, btn] of Object.entries(buttons)) {
      if (btn) btn.addEventListener('click', () => show(key));
    }
    show('alpha');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
