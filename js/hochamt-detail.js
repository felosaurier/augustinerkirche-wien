/* ============================================================
   Augustinerkirche Wien — hochamt-detail.js
   Detailseite eines Hochamts (pages/hochamt.html?id=JJJJ-MM-TT-HHMM).
   Zeigt Zelebrant, Dirigent, Chor, Orchester, Solisten, Organist
   und weitere Musik aus data/hochaemter.csv bzw. dem Jahresarchiv.
   ============================================================ */
(function () {
  'use strict';

  const HD = window.HochamtData;
  const qs = (sel) => document.querySelector(sel);
  const FALLBACK = '<p class="s-text">Die Termine konnten nicht geladen werden. Das vollständige Programm finden Sie unter <a class="link-arr" href="https://hochamt.augustiner.at">hochamt.augustiner.at</a>.</p>';

  const shortDate = (d) => `${d.getDate()}. ${HD.MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const longDate = (e) => `${HD.WEEKDAYS[e.dateObj.getDay()]}, ${shortDate(e.dateObj)} · ${e.time} Uhr`;

  /* Eine Zeile der Besetzung; leere Felder erscheinen gar nicht */
  function row(label, value) {
    if (!value || (Array.isArray(value) && !value.length)) return '';
    const html = Array.isArray(value)
      ? `<ul>${value.map((v) => `<li>${HD.esc(v)}</li>`).join('')}</ul>`
      : `<p>${HD.esc(value)}</p>`;
    return `<div class="hd-row"><div class="hd-label">${label}</div><div class="hd-value">${html}</div></div>`;
  }

  function navLink(e, dir) {
    if (!e) return '<span></span>';
    return `<a class="hd-nav-link hd-${dir}" href="hochamt.html?id=${encodeURIComponent(e.id)}">` +
      `<span class="hd-nav-dir">${dir === 'prev' ? '&larr; Vorheriges' : 'Nächstes &rarr;'}</span>` +
      `<span class="hd-nav-txt">${HD.esc(e.piece || e.type)}</span>` +
      `<span class="hd-nav-date">${shortDate(e.dateObj)}</span></a>`;
  }

  function renderNotFound(body) {
    qs('#hd-title').innerHTML = 'Hochamt nicht <em>gefunden</em>';
    body.innerHTML = '<p class="s-text">Dieser Termin ist nicht (mehr) eingetragen.</p>' +
      '<p style="margin-top:1.5rem"><a class="btn btn-dark" href="musik.html#p-hochaemter">Alle Hochämter</a></p>';
  }

  function render(entries, id) {
    const body = qs('#hd-body');
    const idx = entries.findIndex((e) => e.id === id);
    if (idx < 0) {
      renderNotFound(body);
      return;
    }
    const e = entries[idx];
    const upcoming = HD.isUpcoming(e);
    const listHref = `musik.html#${upcoming ? 'p-hochaemter' : 'p-hochaemter-archiv'}`;

    document.title = `${e.piece || e.type} — ${e.type} — Augustinerkirche Wien`;
    qs('#hd-type').textContent = e.type;
    qs('#hd-title').textContent = e.piece || e.type;
    qs('#hd-when').textContent = `${longDate(e)} · ${e.location}`;

    const rows =
      row('Zelebrant', e.celebrant) +
      row('Dirigent', e.conductor) +
      row('Chor', e.choir) +
      row('Orchester', e.orchestra) +
      row('Solisten', e.soloists) +
      row('Organist', e.organist) +
      row('Programm', e.extra) +
      row('Hinweis', e.note);

    body.innerHTML =
      '<div class="s-label">Programm &amp; Besetzung</div>' +
      '<h2 class="s-title">Musikalische <em>Gestaltung</em></h2>' +
      '<div class="divider-g"></div>' +
      (rows
        ? `<div class="hd-grid">${rows}</div>`
        : '<p class="s-text">Die Mitwirkenden und das genaue Programm werden noch bekannt gegeben.</p>') +
      `<p style="margin-top:2rem"><a class="link-arr" href="${listHref}">${upcoming ? 'Alle Hochämter' : 'Zum Archiv'}</a></p>`;

    qs('#hd-nav').innerHTML = navLink(entries[idx - 1], 'prev') + navLink(entries[idx + 1], 'next');

    /* Zurueck-Knopf: kam man von einer anderen Seite dieser Website, geht es
       dorthin zurueck (inkl. Scrollposition); sonst zur passenden Liste. */
    const back = qs('#hd-back');
    if (back) {
      back.setAttribute('href', listHref);
      back.addEventListener('click', (ev) => {
        const ref = document.referrer;
        if (ref.startsWith(location.origin) && !ref.includes('hochamt.html') && history.length > 1) {
          ev.preventDefault();
          history.back();
        }
      });
    }
  }

  /* Aktuelle Tabelle laden; fehlt der Termin, im Archiv seines Jahres nachsehen */
  async function loadEntries(id) {
    const entries = await HD.load('../data/hochaemter.csv');
    if (entries.some((e) => e.id === id)) return entries;
    const year = parseInt(id.slice(0, 4), 10);
    if (!year) return entries;
    try {
      const older = await HD.loadYear('../data/archiv/', year);
      return older.concat(entries).sort(HD.byDateTime);
    } catch {
      return entries;
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!HD) return;
    const id = new URLSearchParams(location.search).get('id') || '';
    try {
      render(await loadEntries(id), id);
    } catch {
      qs('#hd-body').innerHTML = FALLBACK;
    }
  });
})();
