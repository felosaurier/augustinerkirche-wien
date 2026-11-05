/* ============================================================
   Augustinerkirche Wien — admin-aspersdorf-wochen.js
   Wochenblaetter (PDF) der Pfarre Aspersdorf pflegen
   (admin/aspersdorf-wochen.html). Quelle ist
   data/aspersdorf-wochen.json: {wochen: [{datum, titel, datei}]}, die PDFs
   liegen in assets/pdf/aspersdorf/. Erscheinen auf pages/aspersdorf.html →
   Gottesdienste & Kalender: das neueste Blatt gross, die aelteren darunter.
   Benoetigt js/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { HD, $, esc, icon } = A;
  const PATH = 'data/aspersdorf-wochen.json';
  const DIR = 'assets/pdf/aspersdorf/';
  const MAX_MB = 15;

  let wochen = [];
  let edit = -1;          /* Index in wochen oder -1 = neu */
  let picked = null;      /* neu gewaehltes PDF (File) */
  let snap = '';

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const longDate = (iso) => {
    const d = HD.dateFromIso(iso);
    return d ? `${d.getDate()}. ${HD.MONTHS[d.getMonth()]} ${d.getFullYear()}` : iso;
  };
  const sortDesc = (list) => list.slice().sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
  const label = (w) => w.titel || `Gottesdienste der Woche vom ${longDate(w.datum)}`;

  /* ---------- Laden und Liste ---------- */
  async function load() {
    try {
      const d = await A.readJSON(PATH);
      if (!d || !Array.isArray(d.wochen)) throw new Error('unerwarteter Inhalt');
      wochen = sortDesc(d.wochen);
    } catch (e) {
      $('aw-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Datei <code>${PATH}</code> konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
      return;
    }
    render();
  }

  function render() {
    $('aw-count').textContent = wochen.length === 1 ? '1 Wochenblatt' : `${wochen.length} Wochenblätter`;
    if (!wochen.length) {
      $('aw-list').innerHTML = `<div class="adm-empty"><p class="adm-empty-title">Noch kein Wochenblatt hochgeladen</p><button type="button" class="btn btn-gold" data-act="new">${icon('plus')}Wochenblatt hinzufügen</button></div>`;
      return;
    }
    $('aw-list').innerHTML = '<ul class="adm-rows">' + wochen.map((w, i) =>
      `<li class="adm-row" data-key="${esc(w.datei)}">` +
        `<button type="button" class="adm-row-open" data-act="edit" data-i="${i}">` +
          `<span class="adm-row-body"><span class="adm-row-title">${esc(label(w))}</span>` +
          `<span class="adm-row-meta">${i === 0 ? 'Aktuell auf der Website · ' : ''}Woche ab ${esc(longDate(w.datum))} · ${esc(A.fileName(w.datei))}</span></span>` +
        '</button>' +
        '<div class="adm-row-actions">' +
          `<a class="adm-act" href="${esc(A.imageUrl(w.datei))}" target="_blank" rel="noopener" aria-label="PDF ansehen: ${esc(label(w))}">${icon('external')}PDF</a>` +
          `<button type="button" class="adm-act danger" data-act="del" data-i="${i}" aria-label="Entfernen: ${esc(label(w))}">${icon('trash')}Entfernen</button>` +
        '</div></li>').join('') + '</ul>';
  }

  function flash(file) {
    const row = document.querySelector(`.adm-row[data-key="${CSS.escape(file)}"]`);
    if (!row) return;
    row.classList.remove('flash');
    void row.offsetWidth;
    row.classList.add('flash');
    row.scrollIntoView({ block: 'nearest' });
  }

  async function persist(next) {
    const sorted = sortDesc(next);
    const direct = await A.saveFile(PATH, JSON.stringify({ wochen: sorted }, null, 2) + '\n');
    wochen = sorted;
    return direct;
  }

  /* ---------- Fenster ---------- */
  const dirtyState = () => A.snapshot($('aw-form')) + (picked ? `neu:${picked.name}:${picked.size}` : '');

  function showFile() {
    const cur = edit >= 0 ? wochen[edit] : null;
    $('aw-fileinfo').textContent = picked
      ? `${picked.name} · ${(picked.size / 1024 / 1024).toFixed(picked.size > 1048576 ? 1 : 2)} MB`
      : cur ? `Aktuelles PDF: ${A.fileName(cur.datei)}` : 'Noch kein PDF gewählt';
    const link = $('aw-open');
    link.hidden = !(cur && !picked);
    if (cur) link.href = A.imageUrl(cur.datei);
  }

  async function onFile(file) {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      A.toast('Bitte eine PDF-Datei wählen.', 'err');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      A.toast(`„${file.name}“ ist größer als ${MAX_MB} MB. Bitte das PDF verkleinern.`, 'err');
      return;
    }
    let stable;
    try {
      stable = await A.stableFile(file);
    } catch {
      return;
    }
    if (!(await A.magicOk(stable, 'pdf'))) {
      A.toast(`„${file.name}“ ist keine gültige PDF-Datei (Dateiinhalt und Endung passen nicht zusammen).`, 'err');
      $('f-file').value = '';
      return;
    }
    picked = stable;
    showFile();
  }

  function openEditor(i) {
    edit = i === undefined ? -1 : i;
    const w = edit >= 0 ? wochen[edit] : null;
    const form = $('aw-form');
    form.reset();
    A.clearErrors(form);
    picked = null;
    $('f-file').value = '';
    $('f-datum').value = w ? w.datum : A.isoToday();
    $('f-titel').value = w ? w.titel || '' : '';
    $('aw-dlg-tag').textContent = w ? 'Bearbeiten' : 'Hinzufügen';
    $('aw-dlg-title').textContent = w ? label(w) : 'Neues Wochenblatt';
    $('aw-delete').hidden = !w;
    showFile();
    A.openDialog($('aw-dlg'), { isDirty: () => dirtyState() !== snap });
    snap = dirtyState();
  }

  /* Freier Dateiname; das eigene PDF darf ersetzt werden */
  async function freePath(datum, old) {
    const base = `${DIR}${datum}-wochenblatt`;
    let path = `${base}.pdf`;
    if (A.folder.state !== 'ok') return path;
    for (let n = 2; !(old && old.datei === path) && await A.folder.exists(path); n++) path = `${base}-${n}.pdf`;
    return path;
  }

  async function save(ev) {
    ev.preventDefault();
    const form = $('aw-form');
    const datum = $('f-datum').value;
    const old = edit >= 0 ? wochen[edit] : null;
    const errors = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) errors.push([$('f-datum'), 'Bitte das Datum angeben, an dem die Woche beginnt.']);
    if (!old && !picked) errors.push([$('f-file'), 'Bitte ein PDF auswählen.']);
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }
    const btn = $('aw-save');
    btn.disabled = true;
    try {
      const entry = { datum, titel: clean($('f-titel').value), datei: old ? old.datei : '' };
      if (picked) {
        entry.datei = await freePath(datum, old);
        await A.saveFile(entry.datei, new Blob([picked], { type: 'application/pdf' }));
      }
      const next = wochen.slice();
      if (old) next[edit] = entry;
      else next.push(entry);
      const direct = await persist(next);
      /* Ersetztes PDF unter altem Namen aufraeumen */
      if (old && picked && old.datei !== entry.datei) await A.discardFile(old.datei);
      $('aw-dlg').close();
      render();
      flash(entry.datei);
      A.toast(direct ? `Gespeichert: ${label(entry)}.` : `${label(entry)} übernommen. Bitte unten die Dateien herunterladen.`);
      A.log(`Wochenblatt Aspersdorf ${old ? 'geändert' : 'hochgeladen'}: ${label(entry)}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function remove(i) {
    const w = wochen[i];
    const ok = await A.confirmBox({
      title: 'Wochenblatt entfernen?',
      html: `<strong>${esc(label(w))}</strong><br>${esc(A.fileName(w.datei))}<br><br>Das Blatt verschwindet von der Seite Pfarre Aspersdorf → Gottesdienste &amp; Kalender, die PDF-Datei wird gelöscht.`,
      ok: 'Entfernen', danger: true
    });
    if (!ok) return;
    try {
      const next = wochen.filter((_, k) => k !== i);
      const direct = await persist(next);
      await A.discardFile(w.datei);
      if ($('aw-dlg').open) $('aw-dlg').close();
      render();
      A.toast(direct ? `Entfernt: ${label(w)}.` : 'Entfernt. Bitte unten die Datei herunterladen.');
      A.log(`Wochenblatt Aspersdorf entfernt: ${label(w)}`);
    } catch (err) {
      A.toast(`Entfernen nicht möglich: ${err.message}`, 'err');
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    $('f-file').addEventListener('change', (ev) => onFile(ev.target.files[0]));
    A.wireDrop($('aw-drop'));
    $('aw-new').addEventListener('click', () => openEditor());
    $('aw-form').addEventListener('submit', save);
    $('aw-delete').addEventListener('click', () => { if (edit >= 0) remove(edit); });
    $('aw-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'edit') openEditor(Number(b.dataset.i));
      else if (act === 'del') remove(Number(b.dataset.i));
      else if (act === 'new') openEditor();
    });
    A.guard(() => $('aw-dlg').open && dirtyState() !== snap);
    A.folder.on((state) => { if (state === 'ok') load(); });
    await load();
    if (new URLSearchParams(location.search).has('neu')) {
      openEditor();
      history.replaceState(null, '', location.pathname);
    }
  });
})();
