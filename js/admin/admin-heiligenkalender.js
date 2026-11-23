/* ============================================================
   Augustinerkirche Wien — admin-heiligenkalender.js
   Heiligenkalender (admin/heiligenkalender.html): Heilige und Gedenktage je Kalendertag.
   Sie stehen im Kalender, im Wochenkalender und auf der Startseite an jedem Tag, fuer den im
   Wochenkalender keine eigenen Heiligen eingetragen sind (js/gemeinsam/kalender-daten.js).
   Standard: assets/heiligenkalender.json (Roemischer Generalkalender, Regionalkalender fuer das
   deutsche Sprachgebiet mit den oesterreichischen Eigenfeiern, Feste des Augustinerordens).
   Aenderungen: data/heiligenkalender.json, immer der ganze Kalender
     {tage: {"MM-TT": ["Hl. …"]}, sonntags: ["MM-TT"]}
   sonntags: Tage, die auch an einem Sonntag stehen (Hochfeste, Herrenfeste); sonst hat der
   Sonntag Vorrang.
   Reiter Kirchenjahr: die berechneten Namen der Sonn- und Festtage (js/gemeinsam/kalender-daten.js) je
   Kirchenjahr ansehen, ein- und ausschalten, Lesejahr beim 1. Advent, eigene Schreibweisen:
     kirchenjahr: {aus: true|fehlt, lesejahr: false|fehlt, namen: {"berechnet": "eigene Fassung"}}
   Benoetigt js/gemeinsam/hochaemter-data.js, js/gemeinsam/kalender-daten.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const HD = window.HochamtData;
  const { $, esc, icon } = A;
  const PATH = 'data/heiligenkalender.json';
  const STANDARD = 'assets/heiligenkalender.json';
  const TAGE_IM_MONAT = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  let standard = { tage: {}, sonntags: [] };
  let kal = { tage: {}, sonntags: [] };
  let monat = new Date().getMonth();
  let edit = '';
  let snap = '';

  const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const md = (m, d) => `${HD.pad(m + 1)}-${HD.pad(d)}`;
  const datum = (k) => `${Number(k.slice(3))}. ${HD.MONTHS[Number(k.slice(0, 2)) - 1]}`;
  const namen = (k, q = kal) => (Array.isArray(q.tage[k]) ? q.tage[k] : []);
  const sonntags = (k, q = kal) => (q.sonntags || []).includes(k);
  const gleich = (k) => JSON.stringify(namen(k)) === JSON.stringify(namen(k, standard)) && sonntags(k) === sonntags(k, standard);
  const kjKopie = (kj) => ({ ...(kj && kj.aus ? { aus: true } : {}), ...(kj && kj.lesejahr === false ? { lesejahr: false } : {}), namen: { ...((kj && kj.namen) || {}) } });
  const kopie = (q) => ({
    tage: Object.fromEntries(Object.entries(q.tage || {}).map(([k, v]) => [k, v.slice()])), sonntags: (q.sonntags || []).slice(),
    kirchenjahr: kjKopie(q.kirchenjahr)
  });
  const ordnen = (q) => ({
    tage: Object.fromEntries(Object.keys(q.tage).sort().filter((k) => q.tage[k].length).map((k) => [k, q.tage[k]])),
    sonntags: [...new Set(q.sonntags)].filter((k) => (q.tage[k] || []).length).sort(),
    kirchenjahr: kjKopie(q.kirchenjahr)
  });
  const KD = window.KalenderDaten;

  async function load() {
    try {
      standard = await A.readJSON(STANDARD);
    } catch (e) {
      $('hk-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Der Standard-Heiligenkalender konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
      return;
    }
    kal = kopie(standard);
    let eigen = false;
    try {
      const d = await A.readJSON(PATH);
      if (d && d.tage && typeof d.tage === 'object') {
        kal = kopie(d);
        eigen = true;
      }
    } catch (e) {
      if (!(e && (e.status === 404 || e.name === 'NotFoundError'))) {
        $('hk-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Der Heiligenkalender konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
        return;
      }
    }
    $('hk-reset-all').hidden = !eigen;
    render();
    renderKj();
  }

  function render() {
    $('hk-months').innerHTML = HD.MONTHS.map((m, i) =>
      `<button type="button" class="adm-seg-btn" data-m="${i}" aria-pressed="${i === monat}">${esc(HD.MONTHS_SHORT ? HD.MONTHS_SHORT[i] : m.slice(0, 3))}</button>`).join('');
    const q = clean($('hk-search').value).toLowerCase();
    let keys;
    if (q) {
      keys = Object.keys(kal.tage).sort().filter((k) => namen(k).some((n) => n.toLowerCase().includes(q)) || datum(k).toLowerCase().includes(q));
    } else {
      keys = Array.from({ length: TAGE_IM_MONAT[monat] }, (_, i) => md(monat, i + 1));
    }
    const geaendert = Object.keys({ ...kal.tage, ...standard.tage }).filter((k) => !gleich(k)).length;
    $('hk-count').textContent = (q ? `${keys.length} Treffer` : `${HD.MONTHS[monat]}: ${keys.filter((k) => namen(k).length).length} Tage mit Heiligen`) +
      (geaendert ? ` · ${geaendert} ${geaendert === 1 ? 'Tag' : 'Tage'} geändert` : ' · Standard');
    $('hk-list').innerHTML = keys.length ? '<ul class="adm-rows">' + keys.map((k) => {
      const n = namen(k);
      return `<li class="adm-row hk-row"><button type="button" class="adm-row-open" data-k="${k}">` +
        `<span class="hk-date">${esc(datum(k))}</span>` +
        `<span class="adm-row-body"><span class="adm-row-title${n.length ? '' : ' hk-leer'}">${n.length ? esc(n.join(' · ')) : 'Kein Eintrag'}</span>` +
        (sonntags(k) ? '<span class="adm-chip">auch an Sonntagen</span>' : '') +
        (gleich(k) ? '' : '<span class="adm-chip on">geändert</span>') +
        '</span></button></li>';
    }).join('') + '</ul>' : '<p class="adm-muted">Nichts gefunden.</p>';
  }

  /* ---------- Fenster ---------- */
  function openEditor(k) {
    edit = k;
    const form = $('hk-form');
    form.reset();
    A.clearErrors(form);
    $('hk-dlg-title').textContent = datum(k);
    $('hk-namen').value = namen(k).join('\n');
    $('hk-sonntag').checked = sonntags(k);
    const s = namen(k, standard);
    $('hk-std-hint').innerHTML = s.length ? `Standard: ${esc(s.join(' · '))}` : 'Im Standard steht an diesem Tag nichts.';
    $('hk-std').hidden = gleich(k);
    A.openDialog($('hk-dlg'), { isDirty: () => A.snapshot(form) !== snap });
    snap = A.snapshot(form);
    $('hk-namen').focus();
  }

  async function persist(next, note) {
    const direct = await A.saveJSON(PATH, ordnen(next));
    kal = kopie(ordnen(next));
    $('hk-reset-all').hidden = false;
    render();
    renderKj();
    A.toast(direct ? note : `${note} Bitte unten die Datei herunterladen.`);
    A.log(note);
  }

  async function save(ev) {
    ev.preventDefault();
    const liste = $('hk-namen').value.split('\n').map(clean).filter(Boolean);
    const next = kopie(kal);
    next.tage[edit] = liste;
    next.sonntags = next.sonntags.filter((k) => k !== edit);
    if ($('hk-sonntag').checked && liste.length) next.sonntags.push(edit);
    try {
      await persist(next, `Heiligenkalender: ${datum(edit)} gespeichert.`);
      $('hk-dlg').close();
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  function standardTag() {
    const s = namen(edit, standard);
    $('hk-namen').value = s.join('\n');
    $('hk-sonntag').checked = sonntags(edit, standard);
    $('hk-namen').focus();
  }

  async function resetAll() {
    const ok = await A.confirmBox({
      title: 'Ganzen Heiligenkalender zurücksetzen?',
      html: 'Alle Änderungen gehen verloren; es gilt wieder der mitgelieferte Standard.',
      ok: 'Zurücksetzen', danger: true
    });
    if (!ok) return;
    try {
      await persist(kopie(standard), 'Heiligenkalender auf Standard zurückgesetzt.');
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  /* ---------- Kirchenjahr ---------- */
  const isoUtc = (ms) => new Date(ms).toISOString().slice(0, 10);
  const festStatt = (iso) => sonntags(iso.slice(5)) && namen(iso.slice(5)).length > 0;
  let kjEdit = '';
  let kjSnap = '';
  /* Kirchenjahr, das am 1. Advent des Jahres y beginnt */
  function jahre() {
    const heute = new Date();
    const y0 = heute.getTime() >= KD.advent1(heute.getFullYear()) ? heute.getFullYear() : heute.getFullYear() - 1;
    /* ein Jahr zurueck, das laufende und mindestens 10 im Voraus */
    return Array.from({ length: 12 }, (_, i) => y0 - 1 + i);
  }
  function renderKj() {
    if (!KD || !KD.kirchenjahr) {
      $('kj-list').innerHTML = '<p class="adm-muted">Die Berechnung (js/gemeinsam/kalender-daten.js) fehlt.</p>';
      return;
    }
    const kj = kal.kirchenjahr || {};
    $('kj-an').checked = !kj.aus;
    $('kj-lesejahr').checked = kj.lesejahr !== false;
    $('kj-lesejahr').disabled = !!kj.aus;
    const sel = $('kj-year');
    if (!sel.options.length) {
      const js = jahre();
      sel.innerHTML = js.map((y) => `<option value="${y}">${y}/${String(y + 1).slice(2)} · Lesejahr ${KD.lesejahr(isoUtc(KD.advent1(y)))}</option>`).join('');
      sel.value = String(js[1]);
    }
    const y = Number(sel.value);
    const von = KD.advent1(y);
    const bis = KD.advent1(y + 1);
    const zeilen = [];
    for (let t = von; t < bis; t += 86400000) {
      const iso = isoUtc(t);
      const name = KD.kirchenjahr(iso, !festStatt(iso));
      if (name) zeilen.push({ iso, name, text: KD.tagAm(iso, { ...kal, kirchenjahr: { ...kj, aus: false } }) });
    }
    const umbenannt = Object.keys(kj.namen || {}).length;
    $('kj-count').textContent = `${zeilen.length} Sonn- und Festtage` + (umbenannt ? ` · ${umbenannt} eigene Schreibweise${umbenannt === 1 ? '' : 'n'}` : '') + (kj.aus ? ' · ausgeschaltet' : '');
    $('kj-list').classList.toggle('kj-aus', !!kj.aus);
    $('kj-list').innerHTML = '<ul class="adm-rows">' + zeilen.map((z) => {
      const dt = HD.dateFromIso(z.iso);
      const eigen = kj.namen && kj.namen[z.name];
      return `<li class="adm-row hk-row kj-row"><button type="button" class="adm-row-open" data-name="${esc(z.name)}">` +
        `<span class="hk-date">${esc(HD.WEEKDAYS_SHORT[dt.getDay()])}, ${dt.getDate()}. ${esc(HD.MONTHS[dt.getMonth()])} ${dt.getFullYear()}</span>` +
        `<span class="adm-row-body"><span class="adm-row-title">${esc(z.text)}</span>` +
        (eigen ? `<span class="adm-chip on" title="Berechnet: ${esc(z.name)}">eigene Schreibweise</span>` : '') +
        '</span></button></li>';
    }).join('') + '</ul>';
  }
  async function kjSpeichern(kj, note) {
    const next = kopie(kal);
    next.kirchenjahr = kjKopie(kj);
    await persist(next, note);
  }
  function openKj(name) {
    kjEdit = name;
    const form = $('kj-form');
    form.reset();
    $('kj-dlg-title').textContent = name;
    $('kj-name').value = (kal.kirchenjahr.namen || {})[name] || '';
    $('kj-name').placeholder = name;
    $('kj-orig').textContent = `Berechnet: ${name}. Gilt für jedes Jahr, in dem dieser Name vorkommt.`;
    A.openDialog($('kj-dlg'), { isDirty: () => A.snapshot(form) !== kjSnap });
    kjSnap = A.snapshot(form);
    $('kj-name').focus();
  }
  async function saveKj(ev) {
    ev.preventDefault();
    const kj = kjKopie(kal.kirchenjahr);
    const text = clean($('kj-name').value);
    if (text && text !== kjEdit) kj.namen[kjEdit] = text;
    else delete kj.namen[kjEdit];
    try {
      await kjSpeichern(kj, `Kirchenjahr: ${kjEdit} ${text && text !== kjEdit ? `heißt jetzt „${text}“` : 'wieder berechnet'}.`);
      $('kj-dlg').close();
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }
  async function kjSchalter() {
    const kj = kjKopie(kal.kirchenjahr);
    if ($('kj-an').checked) delete kj.aus; else kj.aus = true;
    if ($('kj-lesejahr').checked) delete kj.lesejahr; else kj.lesejahr = false;
    try {
      await kjSpeichern(kj, kj.aus ? 'Kirchenjahr: automatische Namen ausgeschaltet.' : `Kirchenjahr: automatische Namen eingeschaltet${kj.lesejahr === false ? ', ohne Lesejahr' : ', mit Lesejahr'}.`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
      renderKj();
    }
  }
  function showTab(tab) {
    for (const b of document.querySelectorAll('#hk-tabs [data-tab]')) b.setAttribute('aria-pressed', String(b.dataset.tab === tab));
    $('tab-heilige').hidden = tab !== 'heilige';
    $('tab-kirchenjahr').hidden = tab !== 'kirchenjahr';
    history.replaceState(null, '', tab === 'kirchenjahr' ? '#kirchenjahr' : location.pathname + location.search);
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    $('hk-months').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-m]');
      if (!b) return;
      monat = Number(b.dataset.m);
      $('hk-search').value = '';
      render();
    });
    $('hk-search').addEventListener('input', render);
    $('hk-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-k]');
      if (b) openEditor(b.dataset.k);
    });
    $('hk-form').addEventListener('submit', save);
    $('hk-std').addEventListener('click', standardTag);
    $('hk-reset-all').addEventListener('click', resetAll);
    $('hk-tabs').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-tab]');
      if (b) showTab(b.dataset.tab);
    });
    if (location.hash === '#kirchenjahr') showTab('kirchenjahr');
    $('kj-year').addEventListener('change', renderKj);
    $('kj-an').addEventListener('change', kjSchalter);
    $('kj-lesejahr').addEventListener('change', kjSchalter);
    $('kj-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-name]');
      if (b) openKj(b.dataset.name);
    });
    $('kj-form').addEventListener('submit', saveKj);
    A.guard(() => ($('hk-dlg').open && A.snapshot($('hk-form')) !== snap) || ($('kj-dlg').open && A.snapshot($('kj-form')) !== kjSnap));
    A.folder.on((state) => { if (state === 'ok') load(); });
    await load();
  });
})();
