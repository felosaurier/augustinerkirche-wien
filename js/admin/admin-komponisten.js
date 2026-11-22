/* ============================================================
   Augustinerkirche Wien — admin-komponisten.js
   Reiter "Komponisten (Lebensdaten)" auf admin/repertoire.html, Quelle ist
   data/komponisten.json: {komponisten: [{name, jahre, auch: [andere Schreibweisen]}]}.
   Aufbau wie das Repertoire: Zeilenliste mit Suche, Bearbeiten im Fenster.
   Schaltet auch zwischen den Reitern um (Adresse mit #komponisten oeffnet diesen).
   Die Hochaemter (js/admin/admin-hochaemter.js) ergaenzen daraus unter
   "Weitere Musik" die Lebensdaten. Die Website selbst liest die Datei nicht.
   Benoetigt js/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { $, esc, icon } = A;
  const PATH = 'data/komponisten.json';
  const ZUSATZ = new Set(['sir', 'osb', 'sj', 'osa', 'canreg', 'i', 'ii', 'iii']);

  let data = { komponisten: [] };
  let query = '';
  let editIndex = -1;
  let snap = '';

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  /* "1756 – 1791" -> "1756-1791", "*1957" / "geb. 1957" -> "∗1957"; ungueltig: null */
  function jahre(s) {
    const v = clean(s).replace(/^(?:geb\.\s*|\*)\s*/i, '∗').replace(/\s*[–-]\s*/g, '-');
    return /^(?:~?\d{3,4}-~?\d{3,4}|∗\d{4})$/.test(v) ? v : null;
  }
  const auchListe = (s) => String(s || '').split(',').map(clean).filter(Boolean);
  /* Sortiert nach Nachnamen, ohne Titel und Ordenskuerzel, ohne Akzente */
  function sortKey(name) {
    const t = clean(name).split(' ').filter((w) => !ZUSATZ.has(w.toLowerCase().replace(/\.$/, '')));
    const nach = (t[t.length - 1] || name).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').toLowerCase();
    return `${nach} ${clean(name).toLowerCase()}`;
  }
  const sorted = (list) => list.slice().sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name), 'de'));

  /* ---------- Liste ---------- */
  function render() {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const all = data.komponisten;
    const list = all.map((k, i) => ({ k, i })).filter(({ k }) =>
      words.every((w) => `${k.name} ${k.jahre} ${(k.auch || []).join(' ')}`.toLowerCase().includes(w)));
    $('kp-count').textContent = words.length
      ? `${plural(list.length, 'Treffer', 'Treffer')} für „${query.trim()}“`
      : plural(all.length, 'Komponist', 'Komponisten');
    if (!list.length) {
      $('kp-list').innerHTML = words.length
        ? '<div class="adm-empty"><p class="adm-empty-title">Keine Treffer</p><button type="button" class="btn btn-quiet" data-act="clear">Suche zurücksetzen</button></div>'
        : `<div class="adm-empty"><p class="adm-empty-title">Noch keine Komponisten</p><button type="button" class="btn btn-gold" data-act="new">${icon('plus')}Komponist hinzufügen</button></div>`;
      return;
    }
    $('kp-list').innerHTML = '<ul class="adm-rows">' + list.map(({ k, i }) =>
      `<li class="adm-row" data-key="${esc(k.name)}">` +
        `<button type="button" class="adm-row-open" data-act="edit" data-i="${i}" style="grid-template-columns:minmax(0,1fr)">` +
          `<span class="adm-row-body"><span class="adm-row-title">${esc(k.name)}</span>` +
          `<span class="adm-row-meta">${esc(k.jahre || '')}</span>` +
          (k.auch && k.auch.length ? `<span class="adm-row-people">Auch: ${esc(k.auch.join(' · '))}</span>` : '') +
          '</span>' +
        '</button>' +
        '<div class="adm-row-actions">' +
          `<button type="button" class="adm-act danger" data-act="del" data-i="${i}" aria-label="Entfernen: ${esc(k.name)}">${icon('trash')}Entfernen</button>` +
        '</div></li>'
    ).join('') + '</ul>';
  }
  function flash(key) {
    const row = document.querySelector(`.adm-row[data-key="${CSS.escape(key)}"]`);
    if (!row) return;
    row.classList.add('flash');
    row.scrollIntoView({ block: 'nearest' });
    row.querySelector('.adm-row-open').focus({ preventScroll: true });
  }

  async function load() {
    let d = null;
    try {
      d = await A.readJSON(PATH);
    } catch (e) {
      if (!(e && (e.status === 404 || e.name === 'NotFoundError'))) {
        $('kp-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Komponisten konnten nicht geladen werden (${esc(e.message)}).</div></div>`;
        return;
      }
    }
    data = { komponisten: sorted((d && Array.isArray(d.komponisten) ? d.komponisten : []).filter((k) => k && k.name)) };
    render();
  }
  async function store(next, note) {
    next.komponisten = sorted(next.komponisten);
    const direct = await A.saveJSON(PATH, next);
    data = next;
    render();
    A.toast(direct ? note : `${note} Bitte unten die Datei herunterladen.`);
    A.log(note);
  }

  /* ---------- Fenster ---------- */
  function openEditor(i) {
    const k = i >= 0 ? data.komponisten[i] : null;
    editIndex = i;
    const form = $('kp-form');
    form.reset();
    A.clearErrors(form);
    $('k-name').value = k ? k.name : '';
    $('k-jahre').value = k ? k.jahre || '' : '';
    $('k-auch').value = k ? (k.auch || []).join(', ') : '';
    $('kp-dlg-tag').textContent = k ? 'Komponist bearbeiten' : 'Komponist hinzufügen';
    $('kp-dlg-title').textContent = k ? k.name : 'Neuer Komponist';
    $('kp-delete').hidden = !k;
    A.openDialog($('kp-dlg'), { isDirty: () => A.snapshot(form) !== snap });
    snap = A.snapshot(form);
  }

  async function save(ev) {
    ev.preventDefault();
    const form = $('kp-form');
    const name = clean($('k-name').value);
    const j = jahre($('k-jahre').value);
    const auch = auchListe($('k-auch').value).filter((a, n, arr) =>
      a.toLowerCase() !== name.toLowerCase() && arr.findIndex((b) => b.toLowerCase() === a.toLowerCase()) === n);
    const errors = [];
    if (!name) errors.push([$('k-name'), 'Bitte den Namen eintragen.']);
    else if (/[(:]/.test(name)) errors.push([$('k-name'), 'Der Name darf keine Klammer und keinen Doppelpunkt enthalten.']);
    if (!j) errors.push([$('k-jahre'), 'Lebensdaten bitte als 1756-1791, ~1450-1517 oder *1957 eintragen.']);
    /* Name und Schreibweisen duerfen bei keinem anderen Komponisten vorkommen */
    const vergeben = new Map();
    data.komponisten.forEach((k, i) => {
      if (i === editIndex) return;
      for (const f of [k.name, ...(k.auch || [])]) vergeben.set(f.toLowerCase(), k.name);
    });
    if (name && vergeben.has(name.toLowerCase())) errors.push([$('k-name'), `„${name}“ steht schon bei ${vergeben.get(name.toLowerCase())}.`]);
    const doppelt = auch.find((a) => vergeben.has(a.toLowerCase()));
    if (doppelt) errors.push([$('k-auch'), `„${doppelt}“ steht schon bei ${vergeben.get(doppelt.toLowerCase())}.`]);
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }
    const k = { name, jahre: j, ...(auch.length ? { auch } : {}) };
    const next = { komponisten: data.komponisten.slice() };
    if (editIndex >= 0) next.komponisten[editIndex] = k;
    else next.komponisten.push(k);
    const btn = $('kp-save');
    btn.disabled = true;
    try {
      await store(next, `Komponist gespeichert: ${name} (${j}).`);
      $('kp-dlg').close();
      flash(name);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function remove(i) {
    const k = data.komponisten[i];
    const ok = await A.confirmBox({
      title: 'Komponisten entfernen?',
      html: `<strong>${esc(k.name)}</strong> (${esc(k.jahre || '')}) verschwindet aus der Liste. Bei den Hochämtern werden seine Lebensdaten dann nicht mehr ergänzt.`,
      ok: 'Entfernen', danger: true
    });
    if (!ok) return false;
    try {
      await store({ komponisten: data.komponisten.filter((x) => x !== k) }, `Komponist entfernt: ${k.name}.`);
      return true;
    } catch (err) {
      A.toast(`Entfernen nicht möglich: ${err.message}`, 'err');
      return false;
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    $('kp-new').addEventListener('click', () => openEditor(-1));
    $('kp-form').addEventListener('submit', save);
    $('kp-delete').addEventListener('click', async () => {
      if (editIndex >= 0 && await remove(editIndex)) $('kp-dlg').close();
    });
    $('kp-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'edit') openEditor(Number(b.dataset.i));
      if (b.dataset.act === 'del') remove(Number(b.dataset.i));
      if (b.dataset.act === 'new') openEditor(-1);
      if (b.dataset.act === 'clear') {
        $('kp-search').value = '';
        query = '';
        render();
        $('kp-search').focus();
      }
    });
    let timer = 0;
    $('kp-search').addEventListener('input', (ev) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        query = ev.target.value;
        render();
      }, 120);
    });
    A.guard(() => $('kp-dlg').open && A.snapshot($('kp-form')) !== snap);
    A.folder.on((state) => { if (state === 'ok') load(); });

    /* Reiter Repertoire / Komponisten */
    function showTab(tab) {
      const kp = tab === 'komponisten';
      for (const b of document.querySelectorAll('#rp-tabs [data-tab]')) b.setAttribute('aria-pressed', String(b.dataset.tab === tab));
      $('tab-repertoire').hidden = kp;
      $('tab-komponisten').hidden = !kp;
      $('rp-sub').hidden = kp;
      $('kp-sub').hidden = !kp;
      $('rp-new').hidden = kp;
      $('kp-new').hidden = !kp;
    }
    $('rp-tabs').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-tab]');
      if (!b) return;
      showTab(b.dataset.tab);
      history.replaceState(null, '', b.dataset.tab === 'komponisten' ? '#komponisten' : location.pathname + location.search);
    });
    showTab(location.hash === '#komponisten' ? 'komponisten' : 'repertoire');

    await load();
  });
})();
