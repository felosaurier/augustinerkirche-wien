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

  /* Farben als feste Paare (Schrift/Hauptfarbe und Akzent), aus den Farben des Wochenplakats nach dem
     Kirchenjahr; Standard: Marine und Gold der bisherigen Plakate */
  const PAARE = [
    ['standard', 'Standard', 'Marine & Gold', '#000064', '#966e00'],
    ['advent', 'Advent, Fastenzeit', 'Violett', '#4a2370', '#6a2c91'],
    ['jahreskreis', 'Jahreskreis', 'Grün', '#1f3b2d', '#2e7d4f'],
    ['fest', 'Weihnachten, Ostern', 'Gold', '#1b2a4a', '#c9a24d'],
    ['rot', 'Pfingsten, Märtyrer', 'Rot', '#9c1c1c', '#e03c1e'],
    ['rosa', 'Gaudete, Laetare', 'Rosa', '#4b1d3f', '#d9638b'],
    ['maria', 'Marienfeste', 'Blau', '#1b2a4a', '#2f6fb5'],
    ['bordeaux', 'Bordeaux', 'Bordeaux & Gold', '#6e1f2b', '#c9a24d'],
    ['trauer', 'Requiem', 'Schwarz & Grau', '#111111', '#7a7a82']
  ];
  let paar = PAARE[0];
  const colors = () => ({ main: paar[3], accent: paar[4] });

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
    const L = window.Plakat.layout(m, { colors: colors() });
    vorschau(L);
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

  /* Vorschau der Seite, auf die Breite des Rahmens verkleinert; die Bilder (Logo, QR-Codes) in den gewaehlten Farben */
  let nr = 0;
  async function vorschau(L) {
    const mine = ++nr;
    const PV = window.PlakatVorschau;
    let urls = {};
    try {
      urls = (await window.PlakatBilder.make(colors())).urls;
    } catch { /* ohne Bilder */ }
    if (mine !== nr) return;
    $('pl-stage').innerHTML = PV.html(L, { urls, colors: colors() });
    passen();
  }
  function passen() {
    const seite = $('pl-stage').firstElementChild;
    if (!seite) return;
    const breite = $('pl-wrap').clientWidth - 32;
    const k = Math.min(1.2, breite / seite.offsetWidth);
    $('pl-stage').style.transform = `scale(${k})`;
    $('pl-stage').style.height = `${seite.offsetHeight * k}px`;
    $('pl-stage').style.width = `${seite.offsetWidth * k}px`;
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
      let images = {};
      try {
        images = (await window.PlakatBilder.make(colors())).files;
      } catch { /* dann die Bilder der Vorlage */ }
      const r = await window.Plakat.makeDocx(e, { people, lookup, fetchPart, colors: colors(), images });
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
    /* Farbpaar: Auswahl merkt sich der Browser */
    const eigen = () => ['eigen', 'Eigene Farben', '', $('pl-c1').value, $('pl-c2').value];
    try {
      const k = localStorage.getItem('pl-farbpaar');
      const e = JSON.parse(localStorage.getItem('pl-eigen') || 'null');
      if (e) { $('pl-c1').value = e.main; $('pl-c2').value = e.accent; }
      paar = k === 'eigen' ? eigen() : PAARE.find((p) => p[0] === k) || PAARE[0];
    } catch { /* Standard */ }
    const host = $('pl-paare');
    host.innerHTML = PAARE.map(([k, name, sub, a, b]) =>
      `<button type="button" class="pl-paar" data-paar="${k}" aria-pressed="false" style="--a:${a};--b:${b}"><i aria-hidden="true"></i>${esc(name)}<small>${esc(sub)}</small></button>`).join('');
    const mark = () => {
      host.querySelectorAll('.pl-paar').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.paar === paar[0])));
      $('pl-eigen').classList.toggle('on', paar[0] === 'eigen');
    };
    host.addEventListener('click', (ev) => {
      const x = ev.target.closest('.pl-paar');
      if (!x) return;
      paar = PAARE.find((p) => p[0] === x.dataset.paar) || PAARE[0];
      /* die Felder zeigen das gewaehlte Paar: von dort aus laesst sich weiter anpassen */
      $('pl-c1').value = paar[3];
      $('pl-c2').value = paar[4];
      try { localStorage.setItem('pl-farbpaar', paar[0]); } catch { /* egal */ }
      mark();
      show();
    });
    /* Eigene Farben: jede Aenderung an einem Farbfeld waehlt "Eigene Farben" */
    let t = 0;
    const eigenGeaendert = () => {
      paar = eigen();
      try {
        localStorage.setItem('pl-farbpaar', 'eigen');
        localStorage.setItem('pl-eigen', JSON.stringify({ main: paar[3], accent: paar[4] }));
      } catch { /* egal */ }
      mark();
      clearTimeout(t);
      t = setTimeout(show, 150);
    };
    $('pl-c1').addEventListener('input', eigenGeaendert);
    $('pl-c2').addEventListener('input', eigenGeaendert);
    if (paar[0] !== 'eigen') { $('pl-c1').value = paar[3]; $('pl-c2').value = paar[4]; }
    mark();
    show();
    window.addEventListener('resize', passen);
  });
})();
