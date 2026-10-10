/* ============================================================
   Augustinerkirche Wien — admin-termine.js
   Eigene Termine pflegen (admin/termine.html), Quelle ist
   data/termine.json (Kalender pages/kalender.html).
   - Liste der kommenden oder vergangenen Termine, Suche
   - Anlegen, Bearbeiten, Kopieren, Löschen
   Hochämter und Runden-Termine werden hier nicht gepflegt, sie
   kommen aus ihren eigenen Werkzeugen in den Kalender.
   Benoetigt js/hochaemter-data.js und js/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { HD, $, esc, icon } = A;
  const PATH = 'data/termine.json';

  let termine = [];
  let when = 'kommend';
  let query = '';
  let editIndex = -1;     /* -1 = neuer Termin */
  let snap = '';

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  /* Beschreibung: Absaetze behalten, sonst Leerraum zusammenziehen */
  const cleanText = (s) => String(s || '').split(/\n\s*\n/).map(clean).filter(Boolean).join('\n\n');
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const sortKey = (t) => `${t.datum}${t.zeit || '99'}`;
  const byDate = (a, b) => sortKey(a).localeCompare(sortKey(b));
  /* Ein Termin ist vorbei, wenn sein letzter Tag vor heute liegt */
  const isPast = (t) => (t.bis || t.datum) < A.isoToday();
  const keyOf = (t) => `${t.datum}-${HD.slug(t.titel, 40)}`;

  /* Adresse pruefen: Seite dieser Website (pages/…) oder https-Adresse */
  function webAddress(value) {
    let v = clean(value);
    if (!v) return '';
    if (/^(pages\/|index\.html)/.test(v)) return HD.safeUrl(v, '../') ? v : null;
    if (!/^[a-z][a-z\d+.-]*:/i.test(v)) v = `https://${v.replace(/^\/+/, '')}`;
    return HD.safeUrl(v) && /^https?:\/\/[^/\s]+\.[^/\s]+/i.test(v) ? v : null;
  }

  /* ---------- Laden und Liste ---------- */
  async function load() {
    try {
      const data = (await A.readJSON(PATH));
      if (!data || !Array.isArray(data.termine)) throw new Error('unerwarteter Inhalt');
      termine = data.termine.filter((t) => HD.isoDate(t.datum)).sort(byDate);
    } catch (e) {
      $('tm-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Datei <code>${PATH}</code> konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
      return;
    }
    render();
  }

  function rowHTML(t, i) {
    const dt = HD.dateFromIso(t.datum);
    const time = t.zeit ? `${t.zeit}${t.ende ? `–${t.ende}` : ''}` : '';
    const meta = [t.art, t.bis && t.bis > t.datum ? `bis ${A.fmtDate(t.bis)}` : '', t.ort].filter(Boolean).join(' · ');
    return `<li class="adm-row" data-key="${esc(keyOf(t))}">` +
      `<button type="button" class="adm-row-open" data-i="${i}">` +
        `<span class="adm-date"><span class="adm-day">${dt.getDate()}</span><span class="adm-wd">${esc(HD.MONTHS_SHORT[dt.getMonth()])} ${dt.getFullYear()}</span></span>` +
        '<span class="adm-row-body">' +
          `<span class="adm-row-title">${esc(t.titel)}</span>` +
          `<span class="adm-row-meta">${esc(HD.WEEKDAYS[dt.getDay()])}${meta ? ` · ${esc(meta)}` : ''}</span>` +
          (t.text ? `<span class="adm-row-people">${esc(t.text)}</span>` : '') +
        '</span>' +
        `<span class="adm-row-time">${esc(time)}</span>` +
      '</button></li>';
  }

  function render() {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let list = termine.map((t, i) => ({ t, i }))
      .filter(({ t }) => (when === 'vergangen') === isPast(t))
      .filter(({ t }) => words.every((w) => `${t.titel} ${t.art} ${t.ort} ${t.text} ${A.fmtDate(t.datum)}`.toLowerCase().includes(w)));
    /* Vergangene: neueste zuerst */
    if (when === 'vergangen') list = list.reverse();
    $('tm-count').textContent = `${plural(list.length, when === 'vergangen' ? 'vergangener Termin' : 'kommender Termin', when === 'vergangen' ? 'vergangene Termine' : 'kommende Termine')}` +
      `${words.length ? ` · Suche „${query.trim()}“` : ''}`;
    if (list.length) {
      $('tm-list').innerHTML = `<ul class="adm-rows">${list.map(({ t, i }) => rowHTML(t, i)).join('')}</ul>`;
      return;
    }
    $('tm-list').innerHTML = words.length
      ? '<div class="adm-empty"><p class="adm-empty-title">Nichts gefunden</p><p>Bitte die Suche ändern.</p>' +
        '<button type="button" class="btn btn-quiet" data-clear>Suche löschen</button></div>'
      : when === 'vergangen'
        ? '<div class="adm-empty"><p class="adm-empty-title">Keine vergangenen Termine</p><p>Hier erscheinen Termine, sobald sie vorbei sind.</p></div>'
        : '<div class="adm-empty"><p class="adm-empty-title">Noch keine kommenden Termine</p>' +
          '<p>Ausflüge, Feste und Vorträge, die hier eingetragen werden, erscheinen im Kalender. Hochämter und Runden stehen dort schon von selbst.</p>' +
          `<button type="button" class="btn btn-gold" data-new>${icon('plus')}Ersten Termin eintragen</button></div>`;
  }

  function flash(t) {
    const row = document.querySelector(`.adm-row[data-key="${CSS.escape(keyOf(t))}"]`);
    if (!row) return;
    row.classList.remove('flash');
    void row.offsetWidth;
    row.classList.add('flash');
    row.scrollIntoView({ block: 'nearest' });
    const btn = row.querySelector('button');
    if (btn) btn.focus({ preventScroll: true });
  }

  /* ---------- Fenster ---------- */
  function fill(t) {
    $('f-date').value = t ? t.datum : '';
    $('f-bis').value = t ? t.bis || '' : '';
    $('f-time').value = t ? t.zeit || '' : '';
    $('f-end').value = t ? t.ende || '' : '';
    $('f-art').value = t ? t.art || 'Sonstiges' : 'Ausflug';
    $('f-ort').value = t ? t.ort || '' : '';
    $('f-title').value = t ? t.titel : '';
    $('f-text').value = t ? t.text || '' : '';
    $('f-link').value = t ? t.link || '' : '';
  }

  function openEditor(i, copyOf) {
    const t = i >= 0 ? termine[i] : null;
    editIndex = i;
    const form = $('tm-form');
    form.reset();
    A.clearErrors(form);
    fill(t || copyOf || null);
    if (copyOf) {
      /* Kopie: neues Datum waehlen lassen */
      $('f-date').value = '';
      $('f-bis').value = '';
    }
    $('tm-dlg-tag').textContent = t ? 'Bearbeiten' : copyOf ? 'Kopie' : 'Neuer Termin';
    $('tm-dlg-title').textContent = t ? t.titel : copyOf ? `${copyOf.titel} (neues Datum)` : 'Neuer Termin';
    $('tm-delete').hidden = !t;
    $('tm-copy').hidden = !t;
    if (!$('tm-dlg').open) A.openDialog($('tm-dlg'), { isDirty: () => A.snapshot(form) !== snap });
    snap = copyOf ? '' : A.snapshot(form);
    (copyOf ? $('f-date') : $('f-title')).focus();
  }

  async function persist(next) {
    next.sort(byDate);
    const direct = await A.saveFile(PATH, JSON.stringify({ termine: next }, null, 2) + '\n');
    termine = next;
    return direct;
  }

  async function save(ev) {
    ev.preventDefault();
    const form = $('tm-form');
    const datum = HD.isoDate($('f-date').value);
    const bis = HD.isoDate($('f-bis').value);
    const zeit = HD.isoTime($('f-time').value);
    const ende = HD.isoTime($('f-end').value);
    const titel = clean($('f-title').value);
    const link = webAddress($('f-link').value);
    const errors = [];
    if (!datum) errors.push([$('f-date'), 'Bitte das Datum wählen.']);
    if (datum && bis && bis < datum) errors.push([$('f-bis'), 'Das Enddatum liegt vor dem Datum.']);
    if (ende && !zeit) errors.push([$('f-time'), 'Bitte auch den Beginn eintragen.']);
    else if (ende && !bis && ende <= zeit) errors.push([$('f-end'), 'Das Ende liegt vor dem Beginn.']);
    if (!clean($('f-art').value)) errors.push([$('f-art'), 'Bitte eine Art wählen oder eintragen.']);
    if (!titel) errors.push([$('f-title'), 'Bitte einen Titel eintragen.']);
    if (link === null) errors.push([$('f-link'), 'Diese Adresse sieht nicht richtig aus, z. B. www.beispiel.at oder pages/kalender.html.']);
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }

    const termin = {
      datum, bis: bis && bis > datum ? bis : '', zeit, ende,
      art: clean($('f-art').value), titel, ort: clean($('f-ort').value),
      text: cleanText($('f-text').value), link: link || ''
    };
    const old = editIndex >= 0 ? termine[editIndex] : null;
    const btn = $('tm-save');
    btn.disabled = true;
    try {
      const next = termine.slice();
      if (old) next[editIndex] = termin;
      else next.push(termin);
      const direct = await persist(next);
      $('tm-dlg').close();
      /* Liste zeigt den Zeitraum, in dem der Termin jetzt liegt */
      when = isPast(termin) ? 'vergangen' : 'kommend';
      syncWhen();
      render();
      flash(termin);
      A.toast(direct ? `Gespeichert: ${titel}.` : `${titel} übernommen. Bitte unten die Datei herunterladen.`);
      A.log(`Termin ${old ? 'geändert' : 'eingetragen'}: ${titel} (${A.fmtDate(datum)})`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function remove() {
    const t = termine[editIndex];
    if (!t) return;
    const ok = await A.confirmBox({
      title: 'Termin löschen?',
      html: `<strong>${esc(t.titel)}</strong><br>${esc(A.fmtDate(t.datum))}${t.zeit ? `, ${esc(t.zeit)} Uhr` : ''}<br><br>Der Termin verschwindet aus dem Kalender.`,
      ok: 'Löschen', danger: true
    });
    if (!ok) return;
    try {
      const direct = await persist(termine.filter((x) => x !== t));
      $('tm-dlg').close();
      render();
      A.toast(direct ? `Gelöscht: ${t.titel}.` : 'Gelöscht. Bitte unten die Datei herunterladen.');
      A.log(`Termin gelöscht: ${t.titel} (${A.fmtDate(t.datum)})`);
    } catch (err) {
      A.toast(`Löschen nicht möglich: ${err.message}`, 'err');
    }
  }

  function syncWhen() {
    for (const b of document.querySelectorAll('#tm-when [data-when]')) {
      const on = b.dataset.when === when;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    $('tm-new').addEventListener('click', () => openEditor(-1));
    $('tm-form').addEventListener('submit', save);
    $('tm-delete').addEventListener('click', remove);
    $('tm-copy').addEventListener('click', () => {
      const t = termine[editIndex];
      if (t) openEditor(-1, t);
    });
    $('tm-list').addEventListener('click', (ev) => {
      const row = ev.target.closest('.adm-row-open');
      if (row) openEditor(Number(row.dataset.i));
      if (ev.target.closest('[data-new]')) openEditor(-1);
      if (ev.target.closest('[data-clear]')) {
        query = '';
        $('tm-search').value = '';
        render();
      }
    });
    $('tm-when').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-when]');
      if (!b) return;
      when = b.dataset.when;
      syncWhen();
      render();
    });
    let timer = 0;
    $('tm-search').addEventListener('input', (ev) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        query = ev.target.value;
        render();
      }, 120);
    });
    A.guard(() => $('tm-dlg').open && A.snapshot($('tm-form')) !== snap);
    A.folder.on((state) => { if (state === 'ok') load(); });

    await load();
    if (new URLSearchParams(location.search).has('neu')) {
      openEditor(-1);
      history.replaceState(null, '', location.pathname);
    }
  });
})();
