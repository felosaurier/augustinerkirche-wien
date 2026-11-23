/* ============================================================
   Augustinerkirche Wien — admin-aspersdorf-friedhof.js
   Gebuehrentabellen des Pfarrfriedhofs Aspersdorf pflegen
   (admin/aspersdorf-friedhof.html). Quelle ist data/friedhof.json:
   {tabellen: [{titel, stand, einleitung, zeilen: [{text, betrag}], hinweis}]};
   eine Zeile ohne Betrag ist eine Zwischenueberschrift. Erscheinen auf
   pages/aspersdorf.html → Pfarrfriedhof in der Reihenfolge der Liste.
   Tabellen anlegen, aendern, verschieben und loeschen.
   Benoetigt js/gemeinsam/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { $, esc, icon } = A;
  const PATH = 'data/friedhof.json';

  let tabellen = [];
  let edit = -1;          /* Index oder -1 = neu */
  let rows = null;        /* Zeilen-Editor im Fenster */
  let snap = '';

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  /* ---------- Laden und Liste ---------- */
  async function load() {
    try {
      const d = await A.readJSON(PATH);
      if (!d || !Array.isArray(d.tabellen)) throw new Error('unerwarteter Inhalt');
      tabellen = d.tabellen;
    } catch (e) {
      $('fh-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Datei <code>${PATH}</code> konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
      return;
    }
    render();
  }

  function render() {
    $('fh-count').textContent = plural(tabellen.length, 'Tabelle', 'Tabellen');
    if (!tabellen.length) {
      $('fh-list').innerHTML = `<div class="adm-empty"><p class="adm-empty-title">Noch keine Tabelle</p><button type="button" class="btn btn-gold" data-act="new">${icon('plus')}Tabelle anlegen</button></div>`;
      return;
    }
    const last = tabellen.length - 1;
    $('fh-list').innerHTML = '<ul class="adm-rows">' + tabellen.map((t, i) => {
      const lines = (t.zeilen || []).filter((z) => clean(z.betrag)).length;
      return `<li class="adm-row" data-key="t-${i}">` +
        `<button type="button" class="adm-row-open" data-act="edit" data-i="${i}">` +
          `<span class="adm-row-body"><span class="adm-row-title">${esc(t.titel)}</span>` +
          `<span class="adm-row-meta">${esc([t.stand, plural(lines, 'Betrag', 'Beträge')].filter(Boolean).join(' · '))}</span></span>` +
        '</button>' +
        '<div class="adm-row-actions">' +
          `<button type="button" class="adm-act icon" data-act="up" data-i="${i}" aria-label="Nach oben: ${esc(t.titel)}" title="Nach oben"${i === 0 ? ' disabled' : ''}>${icon('up')}</button>` +
          `<button type="button" class="adm-act icon" data-act="down" data-i="${i}" aria-label="Nach unten: ${esc(t.titel)}" title="Nach unten"${i === last ? ' disabled' : ''}>${icon('down')}</button>` +
          `<button type="button" class="adm-act danger" data-act="del" data-i="${i}" aria-label="Entfernen: ${esc(t.titel)}">${icon('trash')}Entfernen</button>` +
        '</div></li>';
    }).join('') + '</ul>';
  }

  function flash(i, sel) {
    const row = document.querySelector(`.adm-row[data-key="t-${i}"]`);
    if (!row) return;
    row.classList.remove('flash');
    void row.offsetWidth;
    row.classList.add('flash');
    row.scrollIntoView({ block: 'nearest' });
    const btn = row.querySelector(sel || '.adm-row-open');
    if (btn) btn.focus({ preventScroll: true });
  }

  async function persist(next) {
    const direct = await A.saveFile(PATH, JSON.stringify({ tabellen: next }, null, 2) + '\n');
    tabellen = next;
    return direct;
  }

  /* ---------- Fenster ---------- */
  const dirtyState = () => A.snapshot($('fh-form')) + JSON.stringify(rows ? rows.values() : []);

  function openEditor(i) {
    edit = i === undefined ? -1 : i;
    const t = edit >= 0 ? tabellen[edit] : null;
    const form = $('fh-form');
    form.reset();
    A.clearErrors(form);
    $('f-titel').value = t ? t.titel : '';
    $('f-stand').value = t ? t.stand || '' : '';
    $('f-einleitung').value = t ? t.einleitung || '' : '';
    $('f-hinweis').value = t ? t.hinweis || '' : '';
    rows.set(t && t.zeilen && t.zeilen.length ? t.zeilen : [{ text: '', betrag: '' }]);
    $('fh-dlg-tag').textContent = t ? `Tabelle ${edit + 1}` : 'Hinzufügen';
    $('fh-dlg-title').textContent = t ? t.titel : 'Neue Tabelle';
    $('fh-delete').hidden = !t;
    A.openDialog($('fh-dlg'), { isDirty: () => dirtyState() !== snap });
    snap = dirtyState();
  }

  async function save(ev) {
    ev.preventDefault();
    const form = $('fh-form');
    const titel = clean($('f-titel').value);
    if (!titel) {
      A.showErrors(form, [[$('f-titel'), 'Bitte eine Überschrift eintragen.']]);
      return;
    }
    const zeilen = rows.values().map((z) => ({ text: clean(z.text), betrag: clean(z.betrag) })).filter((z) => z.text || z.betrag);
    const missing = zeilen.findIndex((z) => !z.text);
    if (missing >= 0) {
      A.toast(`Zeile ${missing + 1} hat einen Betrag, aber keine Bezeichnung.`, 'err');
      return;
    }
    const t = { titel, stand: clean($('f-stand').value), einleitung: clean($('f-einleitung').value), zeilen, hinweis: clean($('f-hinweis').value) };
    const next = tabellen.slice();
    let pos;
    if (edit >= 0) {
      next[edit] = t;
      pos = edit;
    } else {
      next.push(t);
      pos = next.length - 1;
    }
    const btn = $('fh-save');
    btn.disabled = true;
    try {
      const direct = await persist(next);
      $('fh-dlg').close();
      render();
      flash(pos);
      A.toast(direct ? `Gespeichert: ${titel}.` : `${titel} übernommen. Bitte unten die Datei herunterladen.`);
      A.log(`Friedhofsgebühren Aspersdorf ${edit >= 0 ? 'geändert' : 'ergänzt'}: ${titel}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function remove(i) {
    const t = tabellen[i];
    const ok = await A.confirmBox({
      title: 'Tabelle entfernen?',
      html: `<strong>${esc(t.titel)}</strong>${t.stand ? `<br>${esc(t.stand)}` : ''}<br><br>Die Tabelle verschwindet von der Seite Pfarre Aspersdorf → Pfarrfriedhof.`,
      ok: 'Entfernen', danger: true
    });
    if (!ok) return;
    try {
      const direct = await persist(tabellen.filter((_, k) => k !== i));
      if ($('fh-dlg').open) $('fh-dlg').close();
      render();
      A.toast(direct ? `Entfernt: ${t.titel}.` : 'Entfernt. Bitte unten die Datei herunterladen.');
      A.log(`Friedhofsgebühren Aspersdorf entfernt: ${t.titel}`);
    } catch (err) {
      A.toast(`Entfernen nicht möglich: ${err.message}`, 'err');
    }
  }

  async function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= tabellen.length) return;
    const next = tabellen.slice();
    [next[i], next[j]] = [next[j], next[i]];
    try {
      await persist(next);
      render();
      flash(j, `[data-act="${dir < 0 ? 'up' : 'down'}"]:not([disabled])`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    rows = A.listEditor($('f-zeilen'), {
      fields: [
        { key: 'text', label: 'Bezeichnung', placeholder: 'Bezeichnung, z. B. Einzelgrab — bis zu 2 Personen' },
        { key: 'betrag', label: 'Betrag', placeholder: 'z. B. € 125,00' }
      ],
      addLabel: 'Zeile hinzufügen', rowLabel: 'Zeile'
    });
    $('fh-new').addEventListener('click', () => openEditor());
    $('fh-form').addEventListener('submit', save);
    $('fh-delete').addEventListener('click', () => { if (edit >= 0) remove(edit); });
    $('fh-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      const i = Number(b.dataset.i);
      const act = b.dataset.act;
      if (act === 'edit') openEditor(i);
      else if (act === 'del') remove(i);
      else if (act === 'up' || act === 'down') move(i, act === 'up' ? -1 : 1);
      else if (act === 'new') openEditor();
    });
    A.guard(() => $('fh-dlg').open && dirtyState() !== snap);
    A.folder.on((state) => { if (state === 'ok') load(); });
    await load();
    if (new URLSearchParams(location.search).has('neu')) {
      openEditor();
      history.replaceState(null, '', location.pathname);
    }
  });
})();
