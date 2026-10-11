/* ============================================================
   Augustinerkirche Wien — admin-sprueche.js
   Sprüche pflegen (admin/sprueche.html), Quelle ist data/sprueche.json:
   {sekunden, sprueche: [{text, quelle}]}. Die Website zeigt sie in den
   Zitat-Bändern (.quote-band, js/main.js) und wechselt sie nacheinander.
   Benoetigt js/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { $ } = A;
  const PATH = 'data/sprueche.json';
  const SECS = [6, 8, 10, 15, 20, 30];
  /* Anfuehrungszeichen setzt die Website; eingetippte am Anfang und Ende fallen weg */
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim().replace(/^[„"“]+|[“"”]+$/g, '').trim();

  let list = null;
  let snap = '';

  async function load() {
    let d = null;
    try {
      d = await A.readJSON(PATH);
    } catch (e) {
      if (!(e && (e.status === 404 || e.name === 'NotFoundError'))) {
        A.toast(`Die Sprüche konnten nicht geladen werden (${e.message}).`, 'err');
        return;
      }
    }
    const items = (d && Array.isArray(d.sprueche) ? d.sprueche : []).map((s) => ({ text: s.text || '', quelle: s.quelle || '' }));
    list.set(items.length ? items : [{}]);
    $('sp-secs').value = String(SECS.includes(Number(d && d.sekunden)) ? Number(d.sekunden) : 10);
    snap = A.snapshot($('sp-form'));
    $('sp-state').textContent = '';
  }

  async function save(ev) {
    ev.preventDefault();
    const form = $('sp-form');
    A.clearErrors(form);
    const rows = list.values();
    /* Quelle ohne Spruch: das ist ein Versehen */
    const inputs = Array.from(form.querySelectorAll('#sp-list .adm-list-row'));
    const errors = [];
    rows.forEach((r, i) => {
      if (!clean(r.text) && clean(r.quelle)) errors.push([inputs[i].querySelector('[data-key="text"]'), 'Bitte den Spruch eintragen oder die Zeile entfernen.']);
    });
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }
    const next = {
      sekunden: Number($('sp-secs').value) || 10,
      sprueche: rows.filter((r) => clean(r.text)).map((r) => ({ text: clean(r.text), quelle: clean(r.quelle) }))
    };
    const btn = $('sp-save');
    btn.disabled = true;
    try {
      const direct = await A.saveJSON(PATH, next);
      list.set(next.sprueche.length ? next.sprueche : [{}]);
      snap = A.snapshot(form);
      $('sp-state').textContent = direct ? 'Gespeichert.' : 'Übernommen, bitte unten herunterladen.';
      A.toast(direct ? `${next.sprueche.length === 1 ? 'Ein Spruch' : `${next.sprueche.length} Sprüche`} gespeichert.` : 'Übernommen. Bitte unten die Datei herunterladen.');
      A.log('Sprüche geändert');
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  A.start(async () => {
    list = A.listEditor($('sp-list'), {
      fields: [
        { key: 'text', label: 'Spruch', placeholder: 'z. B. Wer singt, betet doppelt.' },
        { key: 'quelle', label: 'Quelle', placeholder: 'z. B. Hl. Augustinus, Predigt 336' }
      ],
      addLabel: 'Weiterer Spruch', rowLabel: 'Spruch'
    });
    $('sp-form').addEventListener('submit', save);
    $('sp-form').addEventListener('input', () => {
      $('sp-state').textContent = A.snapshot($('sp-form')) !== snap ? 'Noch nicht gespeichert' : '';
    });
    $('sp-form').addEventListener('change', () => {
      $('sp-state').textContent = A.snapshot($('sp-form')) !== snap ? 'Noch nicht gespeichert' : '';
    });
    A.guard(() => A.snapshot($('sp-form')) !== snap);
    A.folder.on((state) => { if (state === 'ok' && A.snapshot($('sp-form')) === snap) load(); });
    await load();
  });
})();
