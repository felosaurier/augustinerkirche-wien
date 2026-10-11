/* ============================================================
   Augustinerkirche Wien — admin-aenderungen.js
   Alle Aenderungen als Tabelle (admin/aenderungen.html, nur Entwickler).
   Quelle ist das gemeinsame Protokoll admin/protokoll.json, das admin.js
   bei jedem Speichern fortschreibt: {eintraege: [{zeit, wer, benutzer,
   text, bereiche, dateien, details, seite}]}, neueste zuerst. Ohne
   Projektordner oder Server gibt es nur die Eintraege dieses Geraets.
   Benoetigt js/hochaemter-data.js und js/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { $, esc, icon, HD } = A;
  const PAGE = 100;

  let all = [];
  let shown = PAGE;
  let source = 'gemeinsam';

  const when = (t) => new Date(t).toLocaleString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const areasOf = (e) => (e.bereiche && e.bereiche.length ? e.bereiche : ['–']);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  async function load() {
    const { list, error } = await A.readProtocol();
    const local = A.recentLog();
    const note = [];
    if (list) {
      all = list;
      source = 'gemeinsam';
    } else {
      all = local;
      source = 'geraet';
      note.push(error === 'kein-ordner'
        ? 'Ohne verbundenen Projektordner (oder Server) gibt es kein gemeinsames Protokoll. Angezeigt werden nur die letzten Änderungen auf diesem Gerät.'
        : `Das gemeinsame Protokoll lässt sich nicht lesen (${esc(error)}). Angezeigt werden nur die letzten Änderungen auf diesem Gerät.`);
    }
    const writeErr = A.protocolError();
    if (writeErr) {
      note.push(`Zuletzt ließ sich das Protokoll nicht speichern: ${esc(writeErr)}<br>Auf dem Server muss <code>admin/protokoll.json</code> beschreibbar sein: Konfiguration der Verwaltung aus dem aktuellen Paket übernehmen (siehe ANLEITUNG.md, „Konfiguration erneuern“).`);
    }
    $('ae-note').innerHTML = note.map((n) => `<div class="adm-alert">${icon('info')}<div>${n}</div></div>`).join('');
    fillSelect($('ae-wer'), [...new Set(all.map((e) => e.wer).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de')));
    fillSelect($('ae-bereich'), [...new Set(all.flatMap(areasOf).filter((b) => b !== '–'))].sort((a, b) => a.localeCompare(b, 'de')));
    shown = PAGE;
    render();
  }
  function fillSelect(sel, values) {
    const keep = sel.value;
    sel.innerHTML = '<option value="">Alle</option>' + values.map((v) => `<option>${esc(v)}</option>`).join('');
    sel.value = values.includes(keep) ? keep : '';
  }

  function filtered() {
    const words = $('ae-q').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const wer = $('ae-wer').value;
    const bereich = $('ae-bereich').value;
    const days = Number($('ae-zeit').value);
    const since = days ? (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - days + 1); return d.getTime(); })() : 0;
    return all.filter((e) => {
      if (wer && e.wer !== wer) return false;
      if (bereich && !areasOf(e).includes(bereich)) return false;
      if (since && e.zeit < since) return false;
      if (!words.length) return true;
      const hay = [e.wer, e.benutzer, e.text, ...(e.bereiche || []), ...(e.dateien || []), ...(e.details || [])].join(' ').toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }

  function rowHTML(e, i) {
    const det = e.details || [];
    const id = `ae-d-${i}`;
    return '<tr>' +
      `<td class="ae-when"><time datetime="${esc(new Date(e.zeit).toISOString())}">${esc(when(e.zeit))}</time></td>` +
      `<td class="ae-who">${esc(e.wer || '–')}${e.benutzer ? `<small>${esc(e.benutzer)}</small>` : ''}</td>` +
      `<td class="ae-area">${areasOf(e).map((b) => `<span class="ae-tag">${esc(b)}</span>`).join(' ')}</td>` +
      `<td class="ae-what"><span class="ae-text">${esc(e.text || '')}</span>` +
        (det.length
          ? `<button type="button" class="adm-act ae-toggle" aria-expanded="false" aria-controls="${id}">${plural(det.length, 'Änderung', 'Änderungen')} anzeigen</button>` +
            `<ul class="ae-details" id="${id}" hidden>${det.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
          : '') +
        (e.dateien && e.dateien.length ? `<small class="ae-files">${e.dateien.map(esc).join(', ')}</small>` : '') +
      '</td></tr>';
  }
  function render() {
    const list = filtered();
    const part = list.slice(0, shown);
    $('ae-count').textContent = `${plural(list.length, 'Eintrag', 'Einträge')}${list.length !== all.length ? ` von ${all.length}` : ''}` +
      (source === 'geraet' ? ' · nur dieses Gerät' : '');
    $('ae-table').innerHTML = part.length
      ? '<div class="ae-wrap"><table class="ae-table"><thead><tr>' +
        '<th scope="col">Zeitpunkt</th><th scope="col">Person</th><th scope="col">Bereich</th><th scope="col">Änderung</th>' +
        `</tr></thead><tbody>${part.map(rowHTML).join('')}</tbody></table></div>`
      : `<div class="adm-empty"><p class="adm-empty-title">${all.length ? 'Nichts gefunden' : 'Noch keine Änderungen protokolliert'}</p>` +
        `<p>${all.length ? 'Filter oder Suche lockern.' : 'Sobald jemand in der Verwaltung etwas speichert, steht es hier.'}</p></div>`;
    $('ae-more').hidden = list.length <= shown;
  }

  function exportCSV() {
    const rows = [['Zeitpunkt', 'Person', 'Benutzername', 'Bereich', 'Änderung', 'Einzelheiten', 'Dateien']];
    for (const e of filtered()) {
      rows.push([new Date(e.zeit).toLocaleString('de-AT'), e.wer || '', e.benutzer || '', areasOf(e).join(', '), e.text || '',
        (e.details || []).join('\n'), (e.dateien || []).join(', ')]);
    }
    HD.download(new Blob([HD.csvText(rows)], { type: 'text/csv;charset=utf-8' }), `aenderungen-${A.isoToday()}.csv`);
  }

  A.start(async () => {
    for (const id of ['ae-wer', 'ae-bereich', 'ae-zeit']) $(id).addEventListener('change', () => { shown = PAGE; render(); });
    $('ae-q').addEventListener('input', () => { shown = PAGE; render(); });
    $('ae-more').addEventListener('click', () => { shown += PAGE; render(); });
    $('ae-reload').addEventListener('click', load);
    $('ae-csv').addEventListener('click', exportCSV);
    $('ae-table').addEventListener('click', (ev) => {
      const b = ev.target.closest('.ae-toggle');
      if (!b) return;
      const box = $(b.getAttribute('aria-controls'));
      box.hidden = !box.hidden;
      b.setAttribute('aria-expanded', String(!box.hidden));
      b.textContent = b.textContent.replace(/anzeigen|ausblenden/, box.hidden ? 'anzeigen' : 'ausblenden');
    });
    A.folder.on((state) => { if (state === 'ok') load(); });
    await load();
  });
})();
