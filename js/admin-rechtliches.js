/* ============================================================
   Augustinerkirche Wien — admin-rechtliches.js
   Impressum und Datenschutz pflegen (admin/rechtliches.html), Quelle ist
   data/rechtliches.json: {impressum, datenschutz}, je
   {titel, untertitel, abschnitte: [{titel, anker, text}]}.
   Der Text kennt Absaetze, **fett**, Links, Listen, Tabellen und
   Platzhalter (HochamtData.blocksHTML); die Website zeichnet ihn mit
   js/inhalte.js. Die Werkzeugleiste ueber jedem Text fuegt die Zeichen ein.
   Benoetigt js/hochaemter-data.js und js/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { $, esc, icon, HD } = A;
  const PATH = 'data/rechtliches.json';
  const PAGES = { impressum: 'Impressum', datenschutz: 'Datenschutz' };
  const EMPTY = () => ({ titel: '', untertitel: '', abschnitte: [] });

  let data = { impressum: EMPTY(), datenschutz: EMPTY() };
  let saved = '';         /* Stand der Datei, wie zuletzt geladen oder gespeichert */
  let current = 'impressum';
  let loaded = false;

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const cleanText = (s) => String(s || '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/^\n+|\n+$/g, '');
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const openSpots = (page) => page.abschnitte.reduce((n, s) => n + (String(s.text || '').match(/\[\[offen:/g) || []).length, 0);

  /* ---------- Laden ---------- */
  async function load() {
    try {
      const d = await A.readJSON(PATH);
      for (const k of Object.keys(PAGES)) {
        const p = d && d[k];
        data[k] = {
          titel: (p && p.titel) || PAGES[k],
          untertitel: (p && p.untertitel) || '',
          abschnitte: p && Array.isArray(p.abschnitte) ? p.abschnitte.map((s) => ({ titel: s.titel || '', anker: s.anker || '', text: s.text || '' })) : []
        };
      }
      saved = JSON.stringify(normalized());
      loaded = true;
    } catch (e) {
      const missing = e && (e.status === 404 || e.name === 'NotFoundError');
      $('rt-secs').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Datei <code>${PATH}</code> konnte nicht geladen werden (${esc(e.message)}).` +
        (missing ? ' Sie ist neu: einmal aus dem Projekt an dieselbe Stelle auf den Server kopieren, bis dahin zeigt die Website den bisherigen Text.' : '') + '</div></div>';
      return;
    }
    renderPage();
  }

  /* ---------- Formular <-> Daten ---------- */
  function collect() {
    if (!loaded) return;
    data[current] = {
      titel: $('rt-titel').value,
      untertitel: $('rt-untertitel').value,
      abschnitte: Array.from(document.querySelectorAll('#rt-secs .rt-sec'), (el) => ({
        titel: el.querySelector('[data-f="titel"]').value,
        anker: el.querySelector('[data-f="anker"]').value,
        text: el.querySelector('[data-f="text"]').value
      }))
    };
  }
  /* So wird gespeichert: leere Abschnitte fallen weg */
  function normalized() {
    const out = {};
    for (const k of Object.keys(PAGES)) {
      const p = data[k];
      out[k] = {
        titel: clean(p.titel),
        untertitel: clean(p.untertitel),
        abschnitte: p.abschnitte.map((s) => ({ titel: clean(s.titel), anker: HD.slug(s.anker || '', 40), text: cleanText(s.text) }))
          .filter((s) => s.titel || s.text)
          .map((s) => (s.anker ? s : { titel: s.titel, text: s.text }))
      };
    }
    return out;
  }
  const dirty = () => loaded && (collect(), JSON.stringify(normalized()) !== saved);

  const TOOLS = [
    ['bold', 'Fett', 'B'],
    ['link', 'Link', 'Link'],
    ['tel', 'Telefonnummer', 'Tel.'],
    ['list', 'Aufzählung', '• Liste'],
    ['table', 'Tabelle', 'Tabelle'],
    ['h3', 'Zwischentitel', 'Zwischentitel'],
    ['todo', 'Noch offen (gelb)', 'Fehlt noch']
  ];
  function secHTML(s, i, n) {
    const id = `rt-${i}`;
    return `<article class="adm-panel rt-sec" data-i="${i}" aria-labelledby="${id}-n">` +
      '<div class="rt-sec-head">' +
        `<span class="rt-sec-num" id="${id}-n">Abschnitt ${i + 1}</span>` +
        '<div class="adm-row-actions">' +
          `<button type="button" class="adm-act icon" data-move="-1" aria-label="Abschnitt ${i + 1} nach oben" title="Nach oben"${i === 0 ? ' disabled' : ''}>${icon('up')}</button>` +
          `<button type="button" class="adm-act icon" data-move="1" aria-label="Abschnitt ${i + 1} nach unten" title="Nach unten"${i === n - 1 ? ' disabled' : ''}>${icon('down')}</button>` +
          `<button type="button" class="adm-act icon danger" data-del aria-label="Abschnitt ${i + 1} entfernen" title="Entfernen">${icon('trash')}</button>` +
        '</div>' +
      '</div>' +
      '<div class="adm-field">' +
        `<label class="adm-label" for="${id}-t">Überschrift<span class="adm-req">Pflichtfeld</span></label>` +
        `<input class="adm-input rt-sec-title" type="text" id="${id}-t" data-f="titel" value="${esc(s.titel)}"/>` +
      '</div>' +
      '<div class="adm-field">' +
        `<label class="adm-label" for="${id}-x">Text</label>` +
        `<div class="rt-tools" role="toolbar" aria-label="Text formatieren" aria-controls="${id}-x">` +
          TOOLS.map(([k, title, label]) => `<button type="button" class="rt-tool" data-tool="${k}" title="${esc(title)}">${k === 'bold' ? '<strong>B</strong>' : esc(label)}</button>`).join('') +
        '</div>' +
        `<textarea class="adm-input rt-text" id="${id}-x" data-f="text" rows="6" spellcheck="true">${esc(s.text)}</textarea>` +
      '</div>' +
      '<div class="rt-sec-foot">' +
        '<div class="adm-field rt-anker-field">' +
          `<label class="adm-label" for="${id}-a">Sprungmarke <span class="adm-opt">für Links wie datenschutz.html#cookies</span></label>` +
          `<input class="adm-input" type="text" id="${id}-a" data-f="anker" value="${esc(s.anker)}" placeholder="${esc(HD.slug(s.titel, 40))}"/>` +
        '</div>' +
        `<button type="button" class="adm-act" data-prev aria-expanded="false" aria-controls="${id}-p">${icon('eye')}Vorschau</button>` +
      '</div>' +
      `<div class="rt-prev legal" id="${id}-p" hidden></div>` +
      '</article>';
  }
  function renderPage() {
    const p = data[current];
    $('rt-titel').value = p.titel;
    $('rt-untertitel').value = p.untertitel;
    const n = p.abschnitte.length;
    $('rt-secs').innerHTML = n ? p.abschnitte.map((s, i) => secHTML(s, i, n)).join('')
      : `<div class="adm-empty"><p class="adm-empty-title">Noch kein Abschnitt</p><p>Ohne Abschnitte zeigt die Website den bisherigen Text.</p></div>`;
    for (const b of document.querySelectorAll('.rt-tabs .adm-seg-btn')) b.setAttribute('aria-pressed', String(b.dataset.seite === current));
    document.querySelectorAll('#rt-secs .rt-text').forEach(grow);
    A.clearErrors($('rt-form'));
    renderCount();
  }
  function renderCount() {
    collect();
    const p = data[current];
    const open = openSpots(p);
    $('rt-count').textContent = `${PAGES[current]}: ${plural(p.abschnitte.length, 'Abschnitt', 'Abschnitte')}` +
      (open ? ` · ${plural(open, 'Stelle', 'Stellen')} noch offen (gelb markiert)` : '');
    $('rt-state').textContent = dirty() ? 'Noch nicht gespeichert' : '';
  }
  function grow(ta) {
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight + 4, window.innerHeight * 0.7)}px`;
  }
  function preview(sec) {
    const box = sec.querySelector('.rt-prev');
    if (box.hidden) return;
    box.innerHTML = HD.blocksHTML(sec.querySelector('[data-f="text"]').value, '../') || '<p class="adm-muted">Noch kein Text.</p>';
  }

  /* ---------- Werkzeugleiste: Zeichen um die Auswahl setzen ---------- */
  function applyTool(ta, tool) {
    const NL = '\n';
    const { selectionStart: a, selectionEnd: b, value } = ta;
    const lineStart = value.lastIndexOf(NL, a - 1) + 1;
    /* Liste und Zwischentitel gelten fuer ganze Zeilen */
    const block = tool === 'list' || tool === 'h3';
    const from = block && a !== b ? lineStart : a;
    const sel = value.slice(from, b);
    let text;
    let caret = null;   /* neue Auswahl [Anfang, Ende] innerhalb von text */
    switch (tool) {
      case 'bold': text = `**${sel || 'fett'}**`; caret = [2, text.length - 2]; break;
      case 'link': text = sel ? `[${sel}](https://)` : '[Text](https://)'; caret = sel ? [text.length - 9, text.length - 1] : [1, 5]; break;
      case 'tel': text = `[${sel || '+43 (0)1 …'}](tel)`; caret = [1, text.length - 6]; break;
      case 'todo': text = `[[offen: ${sel || 'hier ergänzen'}]]`; caret = [9, text.length - 2]; break;
      case 'list':
        text = (sel || 'Punkt').split(NL).map((l) => `- ${l.replace(/^\s*[-•]\s+/, '')}`).join(NL);
        if (!sel) caret = [2, text.length];
        break;
      case 'h3': text = `### ${sel.replace(/^\s*#+\s*/, '') || 'Zwischentitel'}`; caret = [4, text.length]; break;
      case 'table': text = ['| Spalte 1 | Spalte 2 |', '| Wert | Wert |', '| Wert | Wert |'].join(NL); caret = [2, 10]; break;
      default: return;
    }
    /* Liste, Zwischentitel und Tabelle beginnen auf einer eigenen Zeile; eine Tabelle steht fuer sich (Leerzeile davor und danach) */
    let prefix = '';
    let suffix = '';
    const head = value.slice(0, from);
    const tail = value.slice(b);
    if ((block || tool === 'table') && head && !head.endsWith(NL)) prefix = NL;
    if (tool === 'table') {
      if (head.trim() && !(head + prefix).endsWith(NL + NL)) prefix += NL;
      if (tail.trim()) suffix = tail.startsWith(NL) ? NL : NL + NL;
    }
    ta.focus();
    ta.setRangeText(prefix + text + suffix, from, b, 'end');
    if (caret) ta.setSelectionRange(from + prefix.length + caret[0], from + prefix.length + caret[1]);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /* ---------- Abschnitte verschieben, entfernen, hinzufuegen ---------- */
  function move(i, dir) {
    collect();
    const list = data[current].abschnitte;
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    renderPage();
    const btn = document.querySelector(`.rt-sec[data-i="${j}"] [data-move="${dir}"]:not([disabled])`) || document.querySelector(`.rt-sec[data-i="${j}"] .rt-sec-title`);
    if (btn) {
      btn.focus();
      btn.closest('.rt-sec').scrollIntoView({ block: 'nearest' });
    }
  }
  async function remove(i) {
    collect();
    const s = data[current].abschnitte[i];
    if ((s.titel || s.text).trim()) {
      const ok = await A.confirmBox({
        title: 'Abschnitt entfernen?',
        html: `<strong>${esc(s.titel || `Abschnitt ${i + 1}`)}</strong><br><br>Der Abschnitt verschwindet aus ${esc(PAGES[current])}, sobald du speicherst.`,
        ok: 'Entfernen', danger: true
      });
      if (!ok) return;
    }
    data[current].abschnitte.splice(i, 1);
    renderPage();
  }
  function add() {
    collect();
    data[current].abschnitte.push({ titel: '', anker: '', text: '' });
    renderPage();
    const last = document.querySelector('#rt-secs .rt-sec:last-child .rt-sec-title');
    if (last) {
      last.focus();
      last.closest('.rt-sec').scrollIntoView({ block: 'center' });
    }
  }

  /* ---------- Speichern ---------- */
  async function save(ev) {
    ev.preventDefault();
    collect();
    const form = $('rt-form');
    A.clearErrors(form);
    const errors = [];
    if (!clean($('rt-titel').value)) errors.push([$('rt-titel'), 'Bitte eine Überschrift eintragen.']);
    document.querySelectorAll('#rt-secs .rt-sec').forEach((el) => {
      const t = el.querySelector('[data-f="titel"]');
      if (!clean(t.value) && el.querySelector('[data-f="text"]').value.trim()) errors.push([t, 'Bitte eine Überschrift für diesen Abschnitt eintragen.']);
    });
    /* Fehler auf der anderen Seite: dorthin wechseln */
    const other = Object.keys(PAGES).find((k) => k !== current && (!clean(data[k].titel) || data[k].abschnitte.some((s) => !clean(s.titel) && s.text.trim())));
    if (!errors.length && other) {
      current = other;
      renderPage();
      return save(ev);
    }
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }
    const before = JSON.parse(saved || '{}');
    const next = normalized();
    const changed = Object.keys(PAGES).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(next[k]));
    if (!changed.length) {
      A.toast('Keine Änderungen zu speichern.');
      return;
    }
    const btn = $('rt-save');
    btn.disabled = true;
    try {
      const direct = await A.saveJSON(PATH, next);
      saved = JSON.stringify(next);
      for (const k of Object.keys(PAGES)) data[k] = JSON.parse(JSON.stringify(next[k]));
      for (const k of Object.keys(PAGES)) data[k].abschnitte.forEach((s) => { s.anker = s.anker || ''; });
      renderPage();
      const names = changed.map((k) => PAGES[k]).join(' und ');
      A.toast(direct ? `${names} gespeichert.` : `${names} übernommen. Bitte unten die Datei herunterladen.`);
      A.log(`${names} geändert`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  function openPreview() {
    collect();
    const p = normalized()[current];
    $('rt-dlg-title').textContent = p.titel || PAGES[current];
    $('rt-dlg-sub').textContent = p.untertitel;
    $('rt-dlg-body').innerHTML = HD.legalHTML(p, '../').body || '<p class="adm-muted">Noch kein Abschnitt.</p>';
    A.openDialog($('rt-dlg'));
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    $('rt-form').addEventListener('submit', save);
    $('rt-add').addEventListener('click', add);
    $('rt-preview').addEventListener('click', openPreview);
    for (const b of document.querySelectorAll('.rt-tabs .adm-seg-btn')) {
      b.addEventListener('click', () => {
        if (b.dataset.seite === current) return;
        collect();
        current = b.dataset.seite;
        renderPage();
      });
    }
    const secs = $('rt-secs');
    secs.addEventListener('click', (ev) => {
      const sec = ev.target.closest('.rt-sec');
      if (!sec) return;
      const i = Number(sec.dataset.i);
      const tool = ev.target.closest('[data-tool]');
      if (tool) return applyTool(sec.querySelector('[data-f="text"]'), tool.dataset.tool);
      const mv = ev.target.closest('[data-move]');
      if (mv) return move(i, Number(mv.dataset.move));
      if (ev.target.closest('[data-del]')) return remove(i);
      const pv = ev.target.closest('[data-prev]');
      if (pv) {
        const box = sec.querySelector('.rt-prev');
        box.hidden = !box.hidden;
        pv.setAttribute('aria-expanded', String(!box.hidden));
        preview(sec);
      }
    });
    secs.addEventListener('input', (ev) => {
      const sec = ev.target.closest('.rt-sec');
      if (ev.target.matches('.rt-text')) {
        grow(ev.target);
        preview(sec);
      }
      if (ev.target.matches('[data-f="titel"]')) sec.querySelector('[data-f="anker"]').placeholder = HD.slug(ev.target.value, 40);
    });
    $('rt-form').addEventListener('input', () => renderCount());
    A.guard(dirty);
    A.folder.on((state) => { if (state === 'ok' && !dirty()) load(); });
    await load();
  });
})();
