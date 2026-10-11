/* ============================================================
   Augustinerkirche Wien — admin-repertoire.js
   Repertoire des Chores pflegen (admin/repertoire.html), Quelle ist
   data/repertoire.json: Komponisten mit Lebensdaten und Werken
   (Titel und optionaler Hinweis), dazu der Einleitungssatz.
   Benoetigt js/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { $, esc, icon } = A;
  const PATH = 'data/repertoire.json';
  const collator = new Intl.Collator('de');

  let data = { komponisten: [] };
  let query = '';
  let editIndex = -1;
  let works = null;
  let snap = '';

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const surnameOf = (name) => clean(name).split(' ').pop() || '';
  const sortKey = (k) => k.sortierung || k.name;
  const sorted = (list) => list.slice().sort((a, b) => collator.compare(sortKey(a), sortKey(b)) || collator.compare(a.name, b.name));

  /* ---------- Liste ---------- */
  function render() {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const all = data.komponisten;
    const list = all.map((k, i) => ({ k, i })).filter(({ k }) =>
      words.every((w) => `${k.name} ${k.lebensdaten} ${k.werke.map((x) => `${x.titel} ${x.hinweis}`).join(' ')}`.toLowerCase().includes(w)));
    const total = all.reduce((n, k) => n + k.werke.length, 0);
    $('rp-count').textContent = words.length
      ? `${plural(list.length, 'Treffer', 'Treffer')} für „${query.trim()}“`
      : `${plural(all.length, 'Komponist', 'Komponisten')} · ${plural(total, 'Werk', 'Werke')}`;
    if (!list.length) {
      $('rp-list').innerHTML = words.length
        ? '<div class="adm-empty"><p class="adm-empty-title">Keine Treffer</p><button type="button" class="btn btn-quiet" data-act="clear">Suche zurücksetzen</button></div>'
        : `<div class="adm-empty"><p class="adm-empty-title">Noch kein Repertoire</p><button type="button" class="btn btn-gold" data-act="new">${icon('plus')}Komponist hinzufügen</button></div>`;
      return;
    }
    $('rp-list').innerHTML = '<ul class="adm-rows">' + list.map(({ k, i }) =>
      `<li class="adm-row" data-key="${esc(k.name)}">` +
        `<button type="button" class="adm-row-open" data-act="edit" data-i="${i}" style="grid-template-columns:minmax(0,1fr) auto">` +
          `<span class="adm-row-body"><span class="adm-row-title">${esc(k.name)}</span>` +
          `<span class="adm-row-meta">${esc(k.lebensdaten || '')}</span>` +
          `<span class="adm-row-people">${esc(k.werke.map((w) => w.titel).join(' · '))}</span></span>` +
          `<span class="adm-badge">${plural(k.werke.length, 'Werk', 'Werke')}</span>` +
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
    try {
      data = (await A.readJSON(PATH));
      data.komponisten = sorted(data.komponisten || []);
    } catch (e) {
      $('rp-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Das Repertoire konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
      return;
    }
    $('rp-intro').value = data.einleitung || '';
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
    const form = $('rp-form');
    form.reset();
    A.clearErrors(form);
    $('f-name').value = k ? k.name : '';
    $('f-sort').value = k ? k.sortierung || '' : '';
    if (k && k.sortierung && k.sortierung !== surnameOf(k.name)) $('f-sort').dataset.touched = '1';
    else delete $('f-sort').dataset.touched;
    $('f-jahre').value = k ? k.lebensdaten || '' : '';
    works.set(k && k.werke.length ? k.werke : [{}, {}]);
    $('rp-dlg-tag').textContent = k ? 'Komponist bearbeiten' : 'Komponist hinzufügen';
    $('rp-dlg-title').textContent = k ? k.name : 'Neuer Komponist';
    $('rp-delete').hidden = !k;
    A.openDialog($('rp-dlg'), { isDirty: () => A.snapshot(form) !== snap });
    snap = A.snapshot(form);
  }

  async function save(ev) {
    ev.preventDefault();
    const form = $('rp-form');
    const name = clean($('f-name').value);
    const errors = [];
    if (!name) errors.push([$('f-name'), 'Bitte den Namen eintragen.']);
    else if (data.komponisten.some((k, i) => i !== editIndex && k.name.toLowerCase() === name.toLowerCase())) {
      errors.push([$('f-name'), `„${name}“ steht schon im Repertoire. Werke bitte dort ergänzen.`]);
    }
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }
    const k = {
      name, sortierung: clean($('f-sort').value) || surnameOf(name), lebensdaten: clean($('f-jahre').value).replace(/(\d)\s*-\s*(\d)/g, '$1–$2'),
      werke: works.values().map((w) => ({ titel: clean(w.titel), hinweis: clean(w.hinweis) })).filter((w) => w.titel)
    };
    const next = { ...data, komponisten: data.komponisten.slice() };
    if (editIndex >= 0) next.komponisten[editIndex] = k;
    else next.komponisten.push(k);
    try {
      await store(next, `Repertoire gespeichert: ${name} (${plural(k.werke.length, 'Werk', 'Werke')}).`);
      $('rp-dlg').close();
      flash(name);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  async function remove(i) {
    const k = data.komponisten[i];
    const ok = await A.confirmBox({
      title: 'Aus dem Repertoire entfernen?',
      html: `<strong>${esc(k.name)}</strong> mit ${plural(k.werke.length, 'Werk', 'Werken')} verschwindet aus der Liste auf der Website.`,
      ok: 'Entfernen', danger: true
    });
    if (!ok) return false;
    try {
      await store({ ...data, komponisten: data.komponisten.filter((x) => x !== k) }, `Aus dem Repertoire entfernt: ${k.name}.`);
      return true;
    } catch (err) {
      A.toast(`Entfernen nicht möglich: ${err.message}`, 'err');
      return false;
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    works = A.listEditor($('rp-works'), {
      fields: [
        { key: 'titel', label: 'Werk', placeholder: 'z. B. „Nelsonmesse“, Missa in angustiis d-Moll, Hob. XXII:11' },
        { key: 'hinweis', label: 'Hinweis', placeholder: 'optional' }
      ],
      addLabel: 'Werk hinzufügen', rowLabel: 'Werk'
    });
    $('rp-new').addEventListener('click', () => openEditor(-1));
    $('rp-form').addEventListener('submit', save);
    $('f-name').addEventListener('input', () => {
      if (!$('f-sort').dataset.touched) $('f-sort').value = surnameOf($('f-name').value);
    });
    $('f-sort').addEventListener('input', (ev) => { ev.target.dataset.touched = '1'; });
    $('rp-delete').addEventListener('click', async () => {
      if (editIndex >= 0 && await remove(editIndex)) $('rp-dlg').close();
    });
    $('rp-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'edit') openEditor(Number(b.dataset.i));
      if (b.dataset.act === 'del') remove(Number(b.dataset.i));
      if (b.dataset.act === 'new') openEditor(-1);
      if (b.dataset.act === 'clear') {
        $('rp-search').value = '';
        query = '';
        render();
        $('rp-search').focus();
      }
    });
    let timer = 0;
    $('rp-search').addEventListener('input', (ev) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        query = ev.target.value;
        render();
      }, 120);
    });
    $('rp-intro-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try {
        await store({ ...data, einleitung: clean($('rp-intro').value) }, 'Einleitung des Repertoires geändert.');
      } catch (err) {
        A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
      }
    });
    A.guard(() => $('rp-dlg').open && A.snapshot($('rp-form')) !== snap);
    A.folder.on((state) => { if (state === 'ok') load(); });

    await load();
    if (new URLSearchParams(location.search).has('neu')) {
      openEditor(-1);
      history.replaceState(null, '', location.pathname);
    }
  });
})();
