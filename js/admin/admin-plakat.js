/* ============================================================
   Augustinerkirche Wien — admin-plakat.js
   Werkzeug "Plakat fuer ein Hochamt" (admin/plakat.html): ein Hochamt
   aus data/hochaemter.csv waehlen, sehen, was auf dem Plakat steht, und
   es auf Klick als Word-Datei herunterladen (gestaltet von
   js/admin/plakat.js nach der Vorlage in assets/plakat/vorlage/).
   Es wird nur das gewaehlte Plakat erstellt und nichts gespeichert.
   Benoetigt js/gemeinsam/hochaemter-data.js, js/admin/admin.js und js/admin/plakat.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { HD, $, esc } = A;
  const VORLAGE = '../assets/plakat/vorlage/';

  let entries = [];
  let people = [];
  let lookup = () => null;

  /* Abgekuerzte Komponisten ("J. Haydn") zum vollen Namen mit Lebensdaten: zuerst die
     Komponistenliste (data/komponisten.json), dann alle Hochaemter mit "Name (Jahre):" */
  const nk = (s) => String(s || '').toLowerCase().replace(/\./g, '. ').replace(/\s+/g, ' ').trim();
  const tokens = (s) => nk(s).split(' ').map((t) => t.replace(/\.$/, '')).filter(Boolean);
  function makeLookup(list, extras) {
    const known = [];
    for (const k of list) {
      if (!k || !k.name || !k.jahre) continue;
      for (const f of [k.name, ...(Array.isArray(k.auch) ? k.auch : [])]) known.push({ form: f, name: k.name, jahre: k.jahre });
    }
    for (const field of extras) {
      for (const item of HD.list(field)) {
        const m = item.match(/^([^:(„"]+?)\s*\((\d{4}\s*[-–]\s*\d{4}|∗\d{4})\)\s*:/);
        if (m) known.push({ form: m[1].trim(), name: m[1].trim(), jahre: m[2].replace(/\s+/g, '') });
      }
    }
    return (typed) => {
      const t = tokens(typed);
      const sur = t[t.length - 1];
      if (!sur || sur.length < 3) return null;
      const exact = known.find((k) => nk(k.form) === nk(typed));
      if (exact) return { name: exact.name, jahre: exact.jahre };
      const front = t.slice(0, -1);
      const hits = known.filter((k) => {
        const ct = tokens(k.form);
        const idx = ct.lastIndexOf(sur);
        if (idx < 0) return false;
        const vor = ct.slice(0, idx);
        let i = 0;
        return front.every((g) => {
          while (i < vor.length && !vor[i].startsWith(g)) i++;
          return i++ < vor.length;
        });
      });
      /* nur wenn eindeutig (alle Treffer mit denselben Lebensdaten) */
      if (!hits.length || new Set(hits.map((h) => h.jahre)).size > 1) return null;
      const best = hits.find((h) => !h.name.includes('.')) || hits[0];
      return { name: best.name, jahre: best.jahre };
    };
  }

  const label = (e) => `${A.fmtShort(e.date)}, ${e.time} · ${e.piece || e.type}`;

  function fillSelect() {
    const today = A.isoToday();
    const up = entries.filter((e) => e.date >= today);
    const past = entries.filter((e) => e.date < today).reverse();
    const opts = (list) => list.map((e) => `<option value="${entries.indexOf(e)}">${esc(label(e))}</option>`).join('');
    $('pl-select').innerHTML = '<option value="">Bitte wählen …</option>' +
      (up.length ? `<optgroup label="Kommende">${opts(up)}</optgroup>` : '') +
      (past.length ? `<optgroup label="Vergangene">${opts(past)}</optgroup>` : '');
    if (up.length) $('pl-select').value = String(entries.indexOf(up[0]));
    show();
  }

  function show() {
    const e = entries[Number($('pl-select').value)];
    $('pl-preview').hidden = !e || $('pl-select').value === '';
    if ($('pl-preview').hidden) return;
    const m = window.Plakat.parse(e, people, lookup);
    const L = window.Plakat.layout(m);
    const row = (k, v) => (v ? `<dt>${esc(k)}</dt><dd>${v}</dd>` : '');
    const lines = (arr) => arr.map(esc).join('<br>');
    $('pl-list').innerHTML =
      row('Datum', esc(`${m.weekday}, ${m.day}. ${m.month}, ${m.time}${m.end ? ` bis ${m.end.ca ? 'ca. ' : ''}${m.end.time}` : ''} Uhr`)) +
      row('Anlass', esc(`${m.type} ${m.where}`)) +
      row('Zelebrant', m.celebrant ? esc(m.celebrant.name) + (m.celebrant.sub ? ` <span class="adm-muted">${esc(m.celebrant.sub)}</span>` : '') : '') +
      row('Werk', esc([m.mass.composer, m.mass.years && `(${m.mass.years})`].filter(Boolean).join(' ')) + `<br><strong>${esc(m.mass.title)}</strong>` + (m.mass.sub ? ` <span class="adm-muted">${esc(m.mass.sub)}</span>` : '')) +
      row('Weitere Musik', lines(m.pieces.map((p) => [p.name, p.years, p.title].filter(Boolean).join('  ')))) +
      row('Solisten', lines(m.soloists.map((s) => `${s.name}${s.voice ? ` (${s.voice})` : ''}`))) +
      row('Chor & Orchester', lines(m.ensemble)) +
      row('Orgel', lines(m.organists.map((o) => o.name))) +
      row('Dirigent', lines(m.conductors.map((c) => c.name)));
    $('pl-warn').hidden = !L.warn.length;
    $('pl-warn').textContent = L.warn.join(' ');
  }

  async function make() {
    const e = entries[Number($('pl-select').value)];
    if (!e) return;
    const btn = $('pl-make');
    btn.disabled = true;
    try {
      const fetchPart = async (name) => {
        /* Der Server liefert keine Dateien mit Punkt am Namensanfang aus: _rels/.rels liegt als _rels/rels.xml */
        const res = await fetch(VORLAGE + (name === '_rels/.rels' ? '_rels/rels.xml' : name));
        if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
        return new Uint8Array(await res.arrayBuffer());
      };
      const r = await window.Plakat.makeDocx(e, { people, lookup, fetchPart });
      HD.download(new Blob(r.parts, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), r.name);
      A.toast(`Plakat erstellt: ${r.name}`);
    } catch (err) {
      A.toast(`Plakat konnte nicht erstellt werden (${err.message}).`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  A.start(async () => {
    try {
      entries = HD.rowsToRaw(HD.parseCSV(await A.readText('data/hochaemter.csv')))
        .map((o) => ({ ...o, date: HD.isoDate(o.date), time: HD.isoTime(o.time) || '11:00' }))
        .filter((e) => e.date).sort(HD.byDateTime);
    } catch (err) {
      $('pl-select').innerHTML = '<option value="">Die Hochämter konnten nicht geladen werden</option>';
      A.toast(`Hochämter nicht lesbar (${err.message}).`, 'err');
      return;
    }
    try { people = (await A.readJSON('data/personen.json')).mitbrueder || []; } catch { /* Rolle des Zelebranten bleibt dann leer */ }
    let komponisten = [];
    try { komponisten = (await A.readJSON('data/komponisten.json')).komponisten || []; } catch { /* nur zum Ausschreiben */ }
    lookup = makeLookup(komponisten, entries.map((e) => e.extra));
    fillSelect();
    $('pl-select').addEventListener('change', show);
    $('pl-make').addEventListener('click', make);
  });
})();
