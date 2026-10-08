/* ============================================================
   Augustinerkirche Wien — admin-paten.js
   Paten der Kirchenmusik pflegen (admin/paten.html), Quelle ist
   data/paten.json: {ehrenpaten: [Namen], paten: [Namen]}.
   Auf musik.html → Patenschaft erscheinen die Paten nummeriert in
   der Reihenfolge der Liste, die Ehrenpaten im Satz darüber.
   - Hinzufügen (am Ende oder ganz oben), Ändern, Verschieben,
     zwischen Paten und Ehrenpaten wechseln, Entfernen
   Benoetigt js/hochaemter-data.js und js/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { $, esc, icon } = A;
  const PATH = 'data/paten.json';
  const LABEL = { paten: 'Paten', ehrenpaten: 'Ehrenpaten' };

  let data = { ehrenpaten: [], paten: [] };
  let group = 'paten';
  let query = '';
  let edit = null;        /* {group, i} oder null = neu */
  let snap = '';

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const same = (a, b) => clean(a).toLowerCase() === clean(b).toLowerCase();

  /* ---------- Laden und Liste ---------- */
  async function load() {
    try {
      const d = JSON.parse(await A.readText(PATH));
      if (!d || !Array.isArray(d.paten)) throw new Error('unerwarteter Inhalt');
      data = { ehrenpaten: Array.isArray(d.ehrenpaten) ? d.ehrenpaten : [], paten: d.paten };
    } catch (e) {
      $('pt-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Datei <code>${PATH}</code> konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
      return;
    }
    render();
  }

  function rowHTML(name, i, last, searching) {
    /* Beim Suchen kein Verschieben: die Nachbarn waeren nicht sichtbar */
    const move = searching ? '' :
      `<button type="button" class="adm-act icon" data-act="up" data-i="${i}" aria-label="Nach oben: ${esc(name)}" title="Nach oben"${i === 0 ? ' disabled' : ''}>${icon('up')}</button>` +
      `<button type="button" class="adm-act icon" data-act="down" data-i="${i}" aria-label="Nach unten: ${esc(name)}" title="Nach unten"${i === last ? ' disabled' : ''}>${icon('down')}</button>`;
    return `<li class="adm-row" data-key="${esc(group)}-${i}">` +
      `<button type="button" class="adm-row-open adm-pate" data-act="edit" data-i="${i}">` +
        `<span class="adm-pate-n">${i + 1}</span><span class="adm-row-title" title="${esc(name)}">${esc(name)}</span></button>` +
      `<div class="adm-row-actions">${move}` +
        `<button type="button" class="adm-act icon danger" data-act="del" data-i="${i}" aria-label="Entfernen: ${esc(name)}" title="Entfernen">${icon('trash')}</button>` +
      '</div></li>';
  }

  function render() {
    const all = data[group];
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = all.map((n, i) => ({ n, i })).filter(({ n }) => words.every((w) => n.toLowerCase().includes(w)));
    $('pt-n-paten').textContent = data.paten.length;
    $('pt-n-ehrenpaten').textContent = data.ehrenpaten.length;
    $('pt-count').textContent = words.length
      ? `${plural(list.length, 'Treffer', 'Treffer')} für „${query.trim()}“`
      : `${plural(all.length, group === 'paten' ? 'Pate' : 'Ehrenpate', LABEL[group])}`;
    if (list.length) {
      $('pt-list').innerHTML = `<ul class="adm-rows adm-rows-compact">${list.map(({ n, i }) => rowHTML(n, i, all.length - 1, words.length > 0)).join('')}</ul>`;
      return;
    }
    $('pt-list').innerHTML = words.length
      ? '<div class="adm-empty"><p class="adm-empty-title">Keine Treffer</p><button type="button" class="btn btn-quiet" data-act="clear">Suche zurücksetzen</button></div>'
      : `<div class="adm-empty"><p class="adm-empty-title">Noch keine ${LABEL[group]}</p><button type="button" class="btn btn-gold" data-act="new">${icon('plus')}Hinzufügen</button></div>`;
  }

  function flash(g, i, sel) {
    const row = document.querySelector(`.adm-row[data-key="${g}-${i}"]`);
    if (!row) return;
    row.classList.remove('flash');
    void row.offsetWidth;
    row.classList.add('flash');
    row.scrollIntoView({ block: 'nearest' });
    const btn = row.querySelector(sel || '.adm-row-open');
    if (btn) btn.focus({ preventScroll: true });
  }

  function setGroup(g) {
    group = g;
    for (const b of document.querySelectorAll('#pt-group [data-group]')) {
      const on = b.dataset.group === g;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    }
  }

  async function persist(next) {
    const direct = await A.saveFile(PATH, JSON.stringify(next, null, 2) + '\n');
    data = next;
    return direct;
  }
  const copy = () => ({ ehrenpaten: data.ehrenpaten.slice(), paten: data.paten.slice() });

  /* ---------- Fenster ---------- */
  function openEditor(g, i) {
    edit = i === undefined ? null : { group: g, i };
    const form = $('pt-form');
    form.reset();
    A.clearErrors(form);
    $('f-name').value = edit ? data[g][i] : '';
    $('f-group').value = g;
    $('f-pos').value = 'ende';
    $('pt-pos-field').hidden = !!edit;
    $('pt-dlg-tag').textContent = edit ? `Nr. ${i + 1}` : 'Hinzufügen';
    $('pt-dlg-title').textContent = edit ? data[g][i] : g === 'paten' ? 'Neuer Pate' : 'Neuer Ehrenpate';
    $('pt-delete').hidden = !edit;
    A.openDialog($('pt-dlg'), { isDirty: () => A.snapshot(form) !== snap });
    snap = A.snapshot(form);
  }

  async function save(ev) {
    ev.preventDefault();
    const form = $('pt-form');
    const name = clean($('f-name').value);
    const target = $('f-group').value;
    const errors = [];
    if (!name) errors.push([$('f-name'), 'Bitte den Namen eintragen.']);
    else if (data[target].some((n, i) => same(n, name) && !(edit && edit.group === target && edit.i === i))) {
      errors.push([$('f-name'), `„${name}“ steht schon bei den ${LABEL[target]}.`]);
    }
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }
    const next = copy();
    let pos;
    if (edit && edit.group === target) {
      next[target][edit.i] = name;
      pos = edit.i;
    } else {
      if (edit) next[edit.group].splice(edit.i, 1);
      if (!edit && $('f-pos').value === 'anfang') {
        next[target].unshift(name);
        pos = 0;
      } else {
        next[target].push(name);
        pos = next[target].length - 1;
      }
    }
    const btn = $('pt-save');
    btn.disabled = true;
    try {
      const direct = await persist(next);
      $('pt-dlg').close();
      setGroup(target);
      query = '';
      $('pt-search').value = '';
      render();
      flash(target, pos);
      A.toast(direct ? `Gespeichert: ${name}.` : `${name} übernommen. Bitte unten die Datei herunterladen.`);
      A.log(`${target === 'paten' ? 'Pate' : 'Ehrenpate'} ${edit ? 'geändert' : 'hinzugefügt'}: ${name}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function remove(g, i) {
    const name = data[g][i];
    const ok = await A.confirmBox({
      title: 'Aus der Liste entfernen?',
      html: `<strong>${esc(name)}</strong><br><br>Der Name verschwindet von der Seite Kirchenmusik → Patenschaft${g === 'paten' ? ', die Nummern danach rücken auf' : ''}.`,
      ok: 'Entfernen', danger: true
    });
    if (!ok) return;
    try {
      const next = copy();
      next[g].splice(i, 1);
      const direct = await persist(next);
      if ($('pt-dlg').open) $('pt-dlg').close();
      render();
      A.toast(direct ? `Entfernt: ${name}.` : 'Entfernt. Bitte unten die Datei herunterladen.');
      A.log(`${g === 'paten' ? 'Pate' : 'Ehrenpate'} entfernt: ${name}`);
    } catch (err) {
      A.toast(`Entfernen nicht möglich: ${err.message}`, 'err');
    }
  }

  async function move(i, dir) {
    const j = i + dir;
    const next = copy();
    const list = next[group];
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    try {
      await persist(next);
      render();
      flash(group, j, `[data-act="${dir < 0 ? 'up' : 'down'}"]:not([disabled])`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    $('pt-new').addEventListener('click', () => openEditor(group));
    $('pt-form').addEventListener('submit', save);
    $('pt-delete').addEventListener('click', () => { if (edit) remove(edit.group, edit.i); });
    $('pt-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      const i = Number(b.dataset.i);
      const act = b.dataset.act;
      if (act === 'edit') openEditor(group, i);
      else if (act === 'del') remove(group, i);
      else if (act === 'up' || act === 'down') move(i, act === 'up' ? -1 : 1);
      else if (act === 'new') openEditor(group);
      else if (act === 'clear') {
        query = '';
        $('pt-search').value = '';
        render();
      }
    });
    $('pt-group').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-group]');
      if (!b) return;
      setGroup(b.dataset.group);
      render();
    });
    let timer = 0;
    $('pt-search').addEventListener('input', (ev) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        query = ev.target.value;
        render();
      }, 120);
    });
    A.guard(() => $('pt-dlg').open && A.snapshot($('pt-form')) !== snap);
    A.folder.on((state) => { if (state === 'ok') load(); });

    await load();
    if (new URLSearchParams(location.search).has('neu')) {
      openEditor('paten');
      history.replaceState(null, '', location.pathname);
    }
  });
})();
