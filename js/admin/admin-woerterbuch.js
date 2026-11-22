/* ============================================================
   Augustinerkirche Wien — admin-woerterbuch.js
   Wörterbuch der übersetzten Seiten (admin/woerterbuch.html). Das eingebaute Wörterbuch steht in
   js/sprache.js (window.AugWoerter.basis), eigene Ergänzungen und Änderungen in
   data/woerterbuch.json: {en: {"deutscher Text": "Übersetzung"}, it: {…}, fr: {…}, es: {…}}.
   Gespeichert werden nur Einträge, die vom eingebauten Wörterbuch abweichen oder fehlen; sie
   gelten auf den Seiten vor den eingebauten (js/sprache.js liest die Datei beim Laden).
   Oben: deutsche Texte aus den Daten (Hochämter, Gottesdienstzeiten, Wochenkalender, Veranstaltungen),
   die noch nicht im Wörterbuch stehen. Unten: alle Einträge zum Bearbeiten, dazu CSV-Download
   (Deutsch;English;Italiano;Français;Español) und CSV-Upload zum Übernehmen.
   Benötigt js/sprache.js, js/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const HD = window.HochamtData;
  const { $, esc, icon } = A;
  const PATH = 'data/woerterbuch.json';
  const SPR = [['en', 'English'], ['it', 'Italiano'], ['fr', 'Français'], ['es', 'Español']];
  const BASIS = (window.AugWoerter && window.AugWoerter.basis) || { en: {}, it: {}, fr: {}, es: {} };

  /* cur[sprache][deutsch] = aktueller Text (eingebaut oder eigen); keys = alle deutschen Texte in Reihenfolge */
  let cur = {};
  let keys = [];
  let eigenKeys = new Set();
  let miss = [];
  let dirty = false;
  let query = '';
  let filter = 'alle';

  const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

  function init(extra) {
    keys = [];
    const seen = new Set();
    const add = (k) => { if (k && !seen.has(k)) { seen.add(k); keys.push(k); } };
    for (const [l] of SPR) for (const k of Object.keys(BASIS[l] || {})) add(k);
    for (const [l] of SPR) for (const k of Object.keys((extra && extra[l]) || {})) add(k);
    cur = {};
    eigenKeys = new Set();
    for (const [l] of SPR) {
      cur[l] = {};
      for (const k of keys) {
        const e = extra && extra[l] && typeof extra[l][k] === 'string' ? extra[l][k] : '';
        cur[l][k] = e || (BASIS[l] && BASIS[l][k]) || '';
        if (e && e !== (BASIS[l] && BASIS[l][k])) eigenKeys.add(k);
      }
    }
    dirty = false;
  }

  const isEigen = (k) => SPR.some(([l]) => (cur[l][k] || '') !== ((BASIS[l] && BASIS[l][k]) || ''));
  const fehlt = (k) => SPR.some(([l]) => !cur[l][k]);

  /* ---------- Anzeige ---------- */
  function render() {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const list = keys.filter((k) => {
      if (filter === 'fehlt' && !fehlt(k)) return false;
      if (filter === 'eigen' && !isEigen(k)) return false;
      const hay = `${k} ${SPR.map(([l]) => cur[l][k]).join(' ')}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    $('wb-count').textContent = `${list.length} von ${keys.length} Einträgen`;
    $('wb-list').innerHTML = list.length
      ? '<div class="wb-rows">' + list.map((k) =>
        `<div class="wb-row${isEigen(k) ? ' eigen' : ''}" data-k="${esc(k)}"><span class="wb-de">${esc(k)}</span>` +
        SPR.map(([l, name]) => `<label class="wb-cell"><span class="visually-hidden">${esc(name)}: ${esc(k)}</span>` +
          `<input class="adm-input${cur[l][k] ? '' : ' leer'}" type="text" data-l="${l}" value="${esc(cur[l][k])}" maxlength="400" placeholder="${esc(name)}"/></label>`).join('') +
        '</div>').join('') + '</div>'
      : '<div class="adm-empty"><p class="adm-empty-title">Keine Einträge</p></div>';
    renderMiss();
    $('wb-state').textContent = dirty ? 'Nicht gespeicherte Änderungen' : (eigenKeys.size ? `${eigenKeys.size} eigene Einträge gespeichert` : '');
    $('wb-reset').hidden = !isAnyEigen();
  }
  const isAnyEigen = () => dirty || keys.some(isEigen);

  function renderMiss() {
    const open = miss.filter((t) => !keys.includes(t));
    $('wb-miss-panel').hidden = !open.length;
    $('wb-miss').innerHTML = open.slice(0, 120).map((t) => `<button type="button" class="adm-act" data-miss="${esc(t)}">${icon('plus')}${esc(t)}</button>`).join('') +
      (open.length > 120 ? `<p class="adm-muted">… und ${open.length - 120} weitere</p>` : '');
  }

  /* ---------- Fehlende Texte aus den Daten ---------- */
  const SKIP_ORT = /\d{4}|@|https?:/;
  function sammeln(obj, out) {
    if (Array.isArray(obj)) { obj.forEach((x) => sammeln(x, out)); return; }
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && ['name', 'zusatz', 'ort', 'tag', 'titel', 'art'].includes(k)) {
        const t = clean(v);
        if (t && t.length <= 90 && /[A-Za-zÄÖÜäöü]{3}/.test(t) && !SKIP_ORT.test(t)) out.add(t);
      } else sammeln(v, out);
    }
  }
  async function scan() {
    const out = new Set();
    for (const f of ['data/gottesdienste.json', 'data/wochenkalender.json', 'data/termine.json']) {
      try { sammeln(await A.readJSON(f), out); } catch (e) { /* Datei fehlt */ }
    }
    try {
      const rows = HD.parseCSV(await A.readText('data/hochaemter.csv'));
      const head = (rows[0] || []).map((c) => String(c).replace(/^﻿/, '').trim());
      const iA = head.indexOf('Anlass');
      const iO = head.indexOf('Ort');
      for (const r of rows.slice(1)) for (const i of [iA, iO]) if (i >= 0 && clean(r[i])) out.add(clean(r[i]));
    } catch (e) { /* Datei fehlt */ }
    /* "Heilige Messe (Vorabendmesse)" -> beide Teile einzeln */
    const teile = new Set();
    for (const t of out) {
      const m = /^(.*?) \((.*)\)$/.exec(t);
      if (m) { teile.add(clean(m[1])); teile.add(clean(m[2])); } else teile.add(t);
    }
    /* Nicht aufnehmen: interne Kennungen (hochamt, runde …), Tagesnamen des Kirchenjahres und Ensembles "… von St. Augustin"
       (die uebersetzen Regeln in js/thema.js), Texte mit "+" (Verstorbene) */
    const regeln = (window.AugWoerter && window.AugWoerter.en && window.AugWoerter.en.REGELN) || [];
    const abgedeckt = (t) => /^[a-zäöü]+$/.test(t) || /\+/.test(t) || / von St\. Augustin$/.test(t) || regeln.some(([re]) => re.test(t));
    miss = [...teile].filter((t) => t && !abgedeckt(t) && !keys.includes(t)).sort((a, b) => a.localeCompare(b, 'de'));
  }

  /* ---------- Bearbeiten ---------- */
  function setValue(l, k, v) {
    cur[l][k] = clean(v);
    dirty = true;
    const row = document.querySelector(`.wb-row[data-k="${CSS.escape(k)}"]`);
    if (row) row.classList.toggle('eigen', isEigen(k));
    $('wb-state').textContent = 'Nicht gespeicherte Änderungen';
    $('wb-reset').hidden = false;
  }
  function addKey(k) {
    k = clean(k);
    if (!k || keys.includes(k)) return false;
    keys.push(k);
    for (const [l] of SPR) cur[l][k] = '';
    dirty = true;
    return true;
  }

  function ergebnis() {
    const out = {};
    for (const [l] of SPR) {
      out[l] = {};
      for (const k of keys) {
        const v = cur[l][k];
        if (v && v !== ((BASIS[l] && BASIS[l][k]) || '')) out[l][k] = v;
      }
    }
    return out;
  }

  async function save() {
    const btn = $('wb-save');
    btn.disabled = true;
    try {
      const next = ergebnis();
      const direct = await A.saveJSON(PATH, next);
      eigenKeys = new Set(keys.filter(isEigen));
      dirty = false;
      render();
      const note = 'Wörterbuch gespeichert.';
      A.toast(direct ? note : `${note} Bitte unten die Datei herunterladen.`);
      A.log(note);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function reset() {
    const ok = await A.confirmBox({
      title: 'Eigene Änderungen verwerfen?',
      html: 'Alle Einträge gehen zurück auf das eingebaute Wörterbuch. Gespeichert wird erst, wenn Sie danach auf <strong>Speichern</strong> klicken.',
      ok: 'Verwerfen', danger: true
    });
    if (!ok) return;
    init(null);
    dirty = true;
    render();
  }

  /* ---------- CSV ---------- */
  function download() {
    const rows = [['Deutsch', ...SPR.map(([, n]) => n)], ...keys.map((k) => [k, ...SPR.map(([l]) => cur[l][k] || '')])];
    HD.download(new Blob([HD.csvText(rows)], { type: 'text/csv;charset=utf-8' }), 'woerterbuch.csv');
  }
  async function upload(file) {
    if (!file) return;
    try {
      const rows = HD.parseCSV(await file.text());
      const head = (rows[0] || []).map((c) => String(c).replace(/^﻿/, '').trim().toLowerCase());
      const col = (l, n) => Math.max(head.indexOf(l), head.indexOf(n.toLowerCase()));
      const idx = SPR.map(([l, n]) => col(l, n));
      if (head[0] !== 'deutsch' || idx.every((i) => i < 0)) throw new Error('Die erste Spalte muss „Deutsch“ heißen, dazu English, Italiano, Français, Español.');
      let neu = 0;
      let geaendert = 0;
      for (const r of rows.slice(1)) {
        const k = clean(r[0]);
        if (!k) continue;
        if (!keys.includes(k)) { addKey(k); neu += 1; }
        SPR.forEach(([l], n) => {
          const v = idx[n] >= 0 ? clean(r[idx[n]]) : '';
          if (v && v !== cur[l][k]) { cur[l][k] = v; geaendert += 1; }
        });
      }
      dirty = true;
      render();
      A.toast(`CSV gelesen: ${geaendert} Übersetzungen übernommen, ${neu} neue Einträge. Zum Behalten bitte speichern.`);
    } catch (err) {
      A.toast(`CSV nicht lesbar: ${err.message}`, 'err');
    } finally {
      $('wb-file').value = '';
    }
  }

  /* ---------- Start ---------- */
  async function load() {
    let extra = null;
    try {
      extra = await A.readJSON(PATH);
    } catch (e) {
      if (!(e && (e.status === 404 || e.name === 'NotFoundError'))) {
        $('wb-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Das Wörterbuch konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
        return;
      }
    }
    init(extra);
    await scan();
    render();
  }

  A.start(async () => {
    let timer = 0;
    $('wb-search').addEventListener('input', (ev) => {
      clearTimeout(timer);
      timer = setTimeout(() => { query = ev.target.value.trim(); render(); }, 150);
    });
    $('wb-filter').addEventListener('change', (ev) => { filter = ev.target.value; render(); });
    $('wb-list').addEventListener('input', (ev) => {
      const input = ev.target.closest('input[data-l]');
      if (!input) return;
      setValue(input.dataset.l, input.closest('.wb-row').dataset.k, input.value);
    });
    $('wb-miss').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-miss]');
      if (!b) return;
      const k = b.dataset.miss;
      addKey(k);
      query = k;
      $('wb-search').value = k;
      filter = 'alle';
      $('wb-filter').value = 'alle';
      render();
      const first = document.querySelector('.wb-row input');
      if (first) first.focus();
    });
    $('wb-add').addEventListener('click', async () => {
      const k = clean(window.prompt('Deutscher Text, der übersetzt werden soll:') || '');
      if (!k) return;
      if (!addKey(k)) { A.toast('Diesen Text gibt es schon.', 'err'); return; }
      query = k;
      $('wb-search').value = k;
      render();
    });
    $('wb-down').addEventListener('click', download);
    $('wb-up').addEventListener('click', () => $('wb-file').click());
    $('wb-file').addEventListener('change', (ev) => upload(ev.target.files[0]));
    $('wb-save').addEventListener('click', save);
    $('wb-reset').addEventListener('click', reset);
    A.guard(() => dirty);
    A.folder.on((state) => { if (state === 'ok') load(); });
    await load();
  });
})();
