/* ============================================================
   Augustinerkirche Wien — admin-spenden.js
   Spenden & Möglichkeiten pflegen (admin/spenden.html), Quelle ist
   data/paten.json (Felder stufen: [{titel, betrag, text}] und
   paypal: Link; die Listen der Paten pflegt admin-paten.js).
   - PayPal-Link und die Arten der Unterstützung mit Betrag und
     Text (fehlen sie in der Datei, stehen hier die Karten, die
     bisher auf der Seite stehen)
   Benoetigt js/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { $, esc, icon } = A;
  const PATH = 'data/paten.json';

  /* Wie im HTML von musik.html, solange die Datei noch keine "stufen" hat */
  const STUFEN = [
    { titel: 'Förderer und Förderin', betrag: 'ab € 35 im Jahr', text: 'Sie erhalten Ermäßigungen bei allen Konzerten.' },
    { titel: 'Teil-Patenschaft', betrag: 'ab € 300', text: 'Sie tragen einen Teil der Kosten einer Messaufführung und erhalten eine Dankesurkunde und Ermäßigungen bei Konzerten und auf unsere CDs; auf Wunsch nennen wir Ihren Namen oder Ihr Unternehmen auf unserer Website.' },
    { titel: 'Pate und Patin', betrag: '', text: 'Sie übernehmen die Kosten einer Messaufführung. Auf Wunsch nennen wir Ihren Namen oder Ihr Unternehmen auf der Website, auf den Plakaten und Faltblättern des Hochamtes. Sie erhalten eine von Hand gestaltete Urkunde, Ermäßigungen bei Konzerten und auf unsere CDs und eine Einladung zum jährlichen Treffen in St. Augustin.' },
    { titel: 'Stifter und Stifterin', betrag: '', text: 'Sie übernehmen fünf Jahre oder länger jedes Jahr die gesamten Aufführungskosten einer Messe Ihrer Wahl. Auf Wunsch nennen wir Ihren Namen oder Ihr Unternehmen auf der Website. Sie erhalten eine von Hand gestaltete Urkunde aus dem Kloster-Scriptorium, Ermäßigungen bei Konzerten und auf unsere CDs und eine Einladung zum jährlichen Treffen in St. Augustin.' }
  ];

  let data = null;
  let spSnap = '';

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  /* ---------- Laden ---------- */
  async function load() {
    try {
      const d = (await A.readJSON(PATH));
      if (!d || !Array.isArray(d.paten)) throw new Error('unerwarteter Inhalt');
      /* Die Listen der Paten bleiben beim Speichern unveraendert erhalten */
      data = d;
    } catch (e) {
      $('sp-error').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Datei <code>${PATH}</code> konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
      $('sp-form').hidden = true;
      return;
    }
    $('sp-error').innerHTML = '';
    $('sp-form').hidden = false;
    fillSpenden();
  }

  /* ---------- Spenden & Möglichkeiten ---------- */
  function stufenHTML(list) {
    return list.map((st, i) =>
      `<div class="adm-block" data-st="${i}">` +
        '<div class="adm-block-head"><div class="adm-field">' +
          `<label class="adm-label" for="st-titel-${i}">Bezeichnung ${i + 1}</label>` +
          `<input class="adm-input" type="text" id="st-titel-${i}" data-key="titel" value="${esc(st.titel)}" placeholder="z. B. Teil-Patenschaft"/>` +
        '</div>' +
        '<div class="adm-block-tools">' +
          `<button type="button" class="adm-list-btn" data-st-move="${i}" data-dir="-1" aria-label="Möglichkeit ${i + 1} nach oben" title="Nach oben"${i === 0 ? ' disabled' : ''}>${icon('up')}</button>` +
          `<button type="button" class="adm-list-btn" data-st-move="${i}" data-dir="1" aria-label="Möglichkeit ${i + 1} nach unten" title="Nach unten"${i === list.length - 1 ? ' disabled' : ''}>${icon('down')}</button>` +
          `<button type="button" class="adm-act danger" data-st-del="${i}">${icon('trash')}Entfernen</button>` +
        '</div></div>' +
        '<div class="adm-grid">' +
          '<div class="adm-field full">' +
            `<label class="adm-label" for="st-betrag-${i}">Betrag <span class="adm-opt">darf leer bleiben</span></label>` +
            `<input class="adm-input" type="text" id="st-betrag-${i}" data-key="betrag" value="${esc(st.betrag)}" placeholder="z. B. ab € 35 im Jahr"/>` +
          '</div>' +
          '<div class="adm-field full">' +
            `<label class="adm-label" for="st-text-${i}">Text</label>` +
            `<textarea class="adm-input" id="st-text-${i}" data-key="text" rows="3">${esc(st.text)}</textarea>` +
          '</div>' +
        '</div>' +
      '</div>').join('');
  }
  function readStufen() {
    return Array.from($('sp-stufen').children, (b) => {
      const o = {};
      b.querySelectorAll('[data-key]').forEach((el) => { o[el.dataset.key] = el.value.trim(); });
      return o;
    });
  }
  function drawStufen(list, focus) {
    $('sp-stufen').innerHTML = stufenHTML(list);
    if (focus !== undefined) $(`st-titel-${focus}`).focus();
    spDirty();
  }
  function fillSpenden() {
    $('f-paypal').value = data.paypal || '';
    $('sp-stufen').innerHTML = stufenHTML(Array.isArray(data.stufen) && data.stufen.length ? data.stufen : STUFEN);
    spSnap = A.snapshot($('sp-form'));
    spDirty();
  }
  function spDirty() {
    const dirty = A.snapshot($('sp-form')) !== spSnap;
    $('sp-state').textContent = dirty ? 'Noch nicht gespeichert' : '';
    $('sp-state').classList.toggle('is-dirty', dirty);
  }
  async function saveSpenden(ev) {
    ev.preventDefault();
    if (!data) return;
    const form = $('sp-form');
    A.clearErrors(form);
    const paypal = clean($('f-paypal').value);
    const errors = [];
    if (paypal && !/^https:\/\/[^\s/]+\.[^\s]+$/i.test(paypal)) {
      errors.push([$('f-paypal'), 'Bitte den vollständigen Link eintragen, er beginnt mit https://']);
    }
    const blocks = Array.from($('sp-stufen').children);
    const stufen = [];
    readStufen().forEach((st, i) => {
      const titel = clean(st.titel);
      const betrag = clean(st.betrag);
      if (!titel && !betrag && !st.text) return;
      if (!titel) errors.push([blocks[i].querySelector('[data-key="titel"]'), 'Bitte eine Bezeichnung eintragen.']);
      stufen.push({ titel, betrag, text: st.text });
    });
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }
    const btn = $('sp-save');
    btn.disabled = true;
    try {
      /* Frisch lesen, damit inzwischen geaenderte Paten nicht verloren gehen */
      let base = data;
      try {
        const d = await A.readJSON(PATH);
        if (d && Array.isArray(d.paten)) base = d;
      } catch (e) { /* dann mit dem geladenen Stand */ }
      const next = { ...base, stufen, paypal };
      const direct = await A.saveFile(PATH, JSON.stringify(next, null, 2) + '\n');
      data = next;
      fillSpenden();
      $('sp-state').textContent = direct ? 'Gespeichert.' : 'Übernommen, bitte unten herunterladen.';
      A.toast(direct ? 'Spenden und Möglichkeiten gespeichert.' : 'Übernommen. Bitte unten die Datei herunterladen.');
      A.log('Patenschaft: Spenden und Möglichkeiten der Unterstützung geändert');
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    $('sp-form').addEventListener('submit', saveSpenden);
    $('sp-form').addEventListener('input', spDirty);
    $('sp-add').addEventListener('click', () => {
      const list = readStufen();
      list.push({ titel: '', betrag: '', text: '' });
      drawStufen(list, list.length - 1);
    });
    $('sp-stufen').addEventListener('click', (ev) => {
      const mv = ev.target.closest('[data-st-move]');
      const del = ev.target.closest('[data-st-del]');
      if (!mv && !del) return;
      const list = readStufen();
      if (mv) {
        const i = Number(mv.dataset.stMove);
        const j = i + Number(mv.dataset.dir);
        if (j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]];
        drawStufen(list);
        /* Fokus bleibt am Pfeil; am Rand auf den anderen Pfeil */
        const again = document.querySelector(`[data-st-move="${j}"][data-dir="${mv.dataset.dir}"]:not([disabled])`) ||
          document.querySelector(`[data-st-move="${j}"]:not([disabled])`);
        if (again) again.focus();
      } else {
        list.splice(Number(del.dataset.stDel), 1);
        drawStufen(list);
      }
    });
    A.guard(() => !!data && A.snapshot($('sp-form')) !== spSnap);
    A.folder.on((state) => { if (state === 'ok') load(); });

    await load();
  });
})();
