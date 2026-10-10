/* ============================================================
   Augustinerkirche Wien — admin-hinweise.js
   Zwei Seiten mit demselben Aufbau, unterschieden durch
   <body data-quelle="…">:
   - "website" (admin/hinweise.html): Hinweisbanner oben auf der
     Website, Quelle data/hinweise.json, Anzeige durch js/main.js.
     Fuer Admins und alle mit dem Recht "Hinweisbanner".
   - "verwaltung" (admin/mitteilungen.html): Mitteilungen an alle in
     der Verwaltung (Neustart des Servers, Updates …), Quelle
     admin/mitteilungen.json, Anzeige durch js/admin.js. Nur Entwickler.
   Jeder Eintrag gilt von "von" bis einschliesslich "bis" (Datum, auf
   Wunsch mit Uhrzeit) und verschwindet danach von selbst.
   Benoetigt js/hochaemter-data.js und js/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { HD, $, esc, icon } = A;

  const WEBSITE = document.body.dataset.quelle === 'website';
  const CFG = WEBSITE
    ? { path: 'data/hinweise.json', key: 'hinweise', one: 'Hinweis', many: 'Hinweise', first: 'Ersten Hinweis', fresh: 'Neuer Hinweis', needEnd: true }
    : { path: 'admin/mitteilungen.json', key: 'mitteilungen', one: 'Mitteilung', many: 'Mitteilungen', first: 'Erste Mitteilung', fresh: 'Neue Mitteilung', needEnd: false };
  const ARTEN = WEBSITE
    ? { info: 'Information', wichtig: 'Wichtig' }
    : { info: 'Information', wartung: 'Wartung', wichtig: 'Wichtig' };

  let items = [];
  let editIndex = -1;     /* -1 = neuer Eintrag */
  let snap = '';

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  /* Text: Zeilenumbrueche behalten, sonst Leerraum zusammenziehen */
  const cleanText = (s) => String(s || '').split('\n').map(clean).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  /* "2026-10-12" oder "2026-10-12T22:00"; Ende eines reinen Datums = Tagesende */
  function timeOf(v, end) {
    const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?$/.exec(String(v || ''));
    if (!m) return NaN;
    return new Date(`${m[1]}T${m[2] || (end ? '23:59:59' : '00:00')}`).getTime();
  }
  /* jetzt | geplant | vorbei | aus */
  function stateOf(h, now = Date.now()) {
    if (h.aktiv === false) return 'aus';
    if (h.bis && timeOf(h.bis, true) < now) return 'vorbei';
    if (h.von && timeOf(h.von, false) > now) return 'geplant';
    return 'jetzt';
  }
  const STATES = {
    jetzt: ['Jetzt sichtbar', 'on'],
    geplant: ['Geplant', ''],
    vorbei: ['Abgelaufen', ''],
    aus: ['Ausgeschaltet', '']
  };
  function fmtWhen(v) {
    if (!v) return '';
    const [d, t] = v.split('T');
    return `${A.fmtShort(d)}${t ? `, ${t} Uhr` : ''}`;
  }
  function rangeText(h) {
    if (h.von && h.bis) return `${fmtWhen(h.von)} bis ${fmtWhen(h.bis)}`;
    if (h.bis) return `bis ${fmtWhen(h.bis)}`;
    if (h.von) return `ab ${fmtWhen(h.von)}, ohne Ende`;
    return 'ohne Zeitraum';
  }
  const newId = () => `h-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

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
      const data = await A.readJSON(CFG.path);
      if (!data || !Array.isArray(data[CFG.key])) throw new Error('unerwarteter Inhalt');
      items = data[CFG.key].filter((h) => h && h.titel);
    } catch (e) {
      /* Datei fehlt noch: leer anfangen (wird beim ersten Speichern angelegt) */
      if (e && (e.status === 404 || e.name === 'NotFoundError')) {
        items = [];
      } else {
        $('hw-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Datei <code>${CFG.path}</code> konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
        return;
      }
    }
    render();
  }

  function rowHTML(h, i) {
    const st = stateOf(h);
    const [label, on] = STATES[st];
    const meta = [ARTEN[h.art] || ARTEN.info, rangeText(h), WEBSITE ? (h.seiten === 'start' ? 'nur Startseite' : 'alle Seiten') : '',
      WEBSITE && h.wegklickbar === false ? 'nicht wegklickbar' : ''].filter(Boolean).join(' · ');
    return `<li class="adm-row" data-key="${esc(h.id)}">` +
      `<button type="button" class="adm-row-open adm-hw" data-i="${i}">` +
        `<span class="adm-hw-mark is-${esc(h.art || 'info')}" aria-hidden="true">${icon(h.art === 'wichtig' ? 'alert' : h.art === 'wartung' ? 'refresh' : 'info')}</span>` +
        '<span class="adm-row-body">' +
          `<span class="adm-row-title">${esc(h.titel)} <span class="adm-badge${on ? ' on' : ''}">${label}</span></span>` +
          `<span class="adm-row-meta">${esc(meta)}</span>` +
          (h.text ? `<span class="adm-row-people">${esc(h.text.replace(/\n+/g, ' '))}</span>` : '') +
        '</span>' +
      '</button></li>';
  }

  function render() {
    const order = { jetzt: 0, geplant: 1, aus: 2, vorbei: 3 };
    const list = items.map((h, i) => ({ h, i, st: stateOf(h) }))
      .sort((a, b) => order[a.st] - order[b.st] || String(a.h.von || '').localeCompare(String(b.h.von || '')));
    const live = list.filter((x) => x.st === 'jetzt').length;
    $('hw-count').textContent = items.length
      ? `${plural(items.length, CFG.one, CFG.many)} · ${live ? `${live} gerade sichtbar` : 'gerade ist keiner sichtbar'}`
      : '';
    if (!list.length) {
      $('hw-list').innerHTML = '<div class="adm-empty">' +
        `<p class="adm-empty-title">Noch keine ${CFG.many}</p>` +
        `<p>${WEBSITE
          ? 'Ein Hinweis erscheint als Streifen oben auf der Website, z. B. „Kirche am Samstag geschlossen“, und verschwindet nach dem Enddatum von selbst.'
          : 'Eine Mitteilung sehen alle, die sich in der Verwaltung anmelden, z. B. „Server-Neustart am Freitag um 22 Uhr“.'}</p>` +
        `<button type="button" class="btn btn-gold" data-new>${icon('plus')}${CFG.first} anlegen</button></div>`;
      return;
    }
    $('hw-list').innerHTML = `<ul class="adm-rows">${list.map(({ h, i }) => rowHTML(h, i)).join('')}</ul>`;
  }

  function flash(id) {
    const row = document.querySelector(`.adm-row[data-key="${CSS.escape(id)}"]`);
    if (!row) return;
    row.classList.remove('flash');
    void row.offsetWidth;
    row.classList.add('flash');
    row.scrollIntoView({ block: 'nearest' });
    row.querySelector('button').focus({ preventScroll: true });
  }

  /* ---------- Fenster ---------- */
  const art = () => (document.querySelector('input[name="hw-art"]:checked') || {}).value || 'info';
  const join = (d, t) => (d ? `${d}${t ? `T${t}` : ''}` : '');

  function fill(h) {
    const [vd, vt] = String(h ? h.von || '' : A.isoToday()).split('T');
    const [bd, bt] = String(h ? h.bis || '' : '').split('T');
    $('f-titel').value = h ? h.titel : '';
    $('f-text').value = h ? h.text || '' : '';
    document.querySelector(`input[name="hw-art"][value="${h && ARTEN[h.art] ? h.art : 'info'}"]`).checked = true;
    $('f-von').value = vd || '';
    $('f-von-zeit').value = vt || '';
    $('f-bis').value = bd || '';
    $('f-bis-zeit').value = bt || '';
    $('f-aktiv').checked = !h || h.aktiv !== false;
    if (WEBSITE) {
      document.querySelector(`input[name="hw-seiten"][value="${h && h.seiten === 'start' ? 'start' : 'alle'}"]`).checked = true;
      $('f-link').value = h ? h.link || '' : '';
      $('f-linktext').value = h ? h.linktext || '' : '';
      $('f-weg').checked = !h || h.wegklickbar !== false;
    }
  }

  /* Vorschau mit denselben Klassen wie auf der Website bzw. in der Verwaltung */
  function preview() {
    const titel = clean($('f-titel').value) || 'Überschrift';
    const text = cleanText($('f-text').value);
    const a = art();
    const box = $('hw-preview');
    if (WEBSITE) {
      const wichtig = a === 'wichtig';
      box.innerHTML = `<div class="site-banner${wichtig ? ' is-wichtig' : ''}"><div class="site-banner-in">` +
        `<svg class="site-banner-ico" viewBox="0 0 24 24" aria-hidden="true">${wichtig
          ? '<path d="M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'
          : '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'}</svg>` +
        `<div class="site-banner-body"><strong class="site-banner-title">${esc(titel)}</strong>` +
        (text ? `<span class="site-banner-text">${esc(text).replace(/\n/g, '<br>')}</span>` : '') +
        (clean($('f-link').value) ? `<span class="site-banner-link">${esc(clean($('f-linktext').value) || 'Mehr erfahren')}</span>` : '') +
        '</div>' +
        ($('f-weg').checked ? '<span class="site-banner-close" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></span>' : '') +
        '</div></div>';
    } else {
      box.innerHTML = A.noticeHTML({ id: 'vorschau', titel, text, art: a }, false);
    }
  }

  function openEditor(i, copyOf) {
    const h = i >= 0 ? items[i] : null;
    editIndex = i;
    const form = $('hw-form');
    form.reset();
    A.clearErrors(form);
    fill(h || copyOf || null);
    if (copyOf) {
      $('f-von').value = A.isoToday();
      $('f-von-zeit').value = '';
      $('f-bis').value = '';
      $('f-bis-zeit').value = '';
    }
    preview();
    $('hw-dlg-tag').textContent = h ? 'Bearbeiten' : copyOf ? 'Kopie' : CFG.fresh;
    $('hw-dlg-title').textContent = h ? h.titel : copyOf ? `${copyOf.titel} (Kopie)` : CFG.fresh;
    $('hw-delete').hidden = !h;
    $('hw-copy').hidden = !h;
    if (!$('hw-dlg').open) A.openDialog($('hw-dlg'), { isDirty: () => A.snapshot(form) !== snap });
    snap = copyOf ? '' : A.snapshot(form);
    (copyOf ? $('f-bis') : $('f-titel')).focus();
  }

  async function persist(next) {
    const direct = await A.saveFile(CFG.path, JSON.stringify({ [CFG.key]: next }, null, 2) + '\n');
    items = next;
    return direct;
  }

  async function save(ev) {
    ev.preventDefault();
    const form = $('hw-form');
    const titel = clean($('f-titel').value);
    const vonD = HD.isoDate($('f-von').value);
    const bisD = HD.isoDate($('f-bis').value);
    const vonT = HD.isoTime($('f-von-zeit').value);
    const bisT = HD.isoTime($('f-bis-zeit').value);
    const von = join(vonD, vonT);
    const bis = join(bisD, bisT);
    const link = WEBSITE ? webAddress($('f-link').value) : '';
    const errors = [];
    if (!titel) errors.push([$('f-titel'), 'Bitte eine Überschrift eintragen.']);
    if (!vonD) errors.push([$('f-von'), 'Bitte wählen, ab wann der Eintrag sichtbar ist.']);
    if (CFG.needEnd && !bisD) errors.push([$('f-bis'), 'Bitte das Enddatum wählen. Danach verschwindet der Hinweis von selbst.']);
    if (vonT && !vonD) errors.push([$('f-von'), 'Zur Uhrzeit fehlt das Datum.']);
    if (bisT && !bisD) errors.push([$('f-bis'), 'Zur Uhrzeit fehlt das Datum.']);
    if (vonD && bisD && timeOf(bis, true) < timeOf(von, false)) errors.push([$('f-bis'), 'Das Ende liegt vor dem Beginn.']);
    if (link === null) errors.push([$('f-link'), 'Diese Adresse sieht nicht richtig aus, z. B. www.beispiel.at oder pages/pfarre.html.']);
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }

    const old = editIndex >= 0 ? items[editIndex] : null;
    const h = {
      id: old ? old.id : newId(),
      titel, text: cleanText($('f-text').value), art: art(), von, bis,
      aktiv: $('f-aktiv').checked
    };
    if (WEBSITE) {
      h.seiten = (document.querySelector('input[name="hw-seiten"]:checked') || {}).value === 'start' ? 'start' : 'alle';
      h.link = link || '';
      h.linktext = h.link ? clean($('f-linktext').value) : '';
      h.wegklickbar = $('f-weg').checked;
    } else {
      h.von_wem = old && old.von_wem ? old.von_wem : (A.session() || {}).name || '';
    }
    const btn = $('hw-save');
    btn.disabled = true;
    try {
      const next = items.slice();
      if (old) next[editIndex] = h;
      else next.push(h);
      const direct = await persist(next);
      $('hw-dlg').close();
      render();
      flash(h.id);
      const st = stateOf(h);
      const when = st === 'jetzt' ? 'ist jetzt sichtbar' : st === 'geplant' ? `erscheint ab ${fmtWhen(h.von)}` : 'ist nicht sichtbar';
      A.toast(direct ? `Gespeichert: ${titel} ${when}.` : `${titel} übernommen. Bitte unten die Datei herunterladen.`);
      A.log(`${CFG.one} ${old ? 'geändert' : 'angelegt'}: ${titel}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function remove() {
    const h = items[editIndex];
    if (!h) return;
    const ok = await A.confirmBox({
      title: `${CFG.one} löschen?`,
      html: `<strong>${esc(h.titel)}</strong><br>${esc(rangeText(h))}<br><br>` +
        (WEBSITE ? 'Der Hinweis verschwindet sofort von der Website.' : 'Die Mitteilung wird niemandem mehr angezeigt.'),
      ok: 'Löschen', danger: true
    });
    if (!ok) return;
    try {
      const direct = await persist(items.filter((x) => x !== h));
      $('hw-dlg').close();
      render();
      A.toast(direct ? `Gelöscht: ${h.titel}.` : 'Gelöscht. Bitte unten die Datei herunterladen.');
      A.log(`${CFG.one} gelöscht: ${h.titel}`);
    } catch (err) {
      A.toast(`Löschen nicht möglich: ${err.message}`, 'err');
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    $('hw-new').addEventListener('click', () => openEditor(-1));
    $('hw-form').addEventListener('submit', save);
    $('hw-form').addEventListener('input', preview);
    $('hw-form').addEventListener('change', preview);
    $('hw-delete').addEventListener('click', remove);
    $('hw-copy').addEventListener('click', () => {
      const h = items[editIndex];
      if (h) openEditor(-1, h);
    });
    /* Schnellwahl fuer das Ende: ab Beginn (oder ab heute, wenn der schon vorbei ist) */
    $('hw-quick').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-days]');
      if (!b) return;
      const von = HD.isoDate($('f-von').value);
      const start = von && von > A.isoToday() ? von : A.isoToday();
      const dt = HD.dateFromIso(start);
      dt.setDate(dt.getDate() + Number(b.dataset.days));
      $('f-bis').value = A.isoOf(dt);
      $('f-bis').dispatchEvent(new Event('input', { bubbles: true }));
    });
    $('hw-list').addEventListener('click', (ev) => {
      const row = ev.target.closest('.adm-row-open');
      if (row) openEditor(Number(row.dataset.i));
      if (ev.target.closest('[data-new]')) openEditor(-1);
    });
    A.guard(() => $('hw-dlg').open && A.snapshot($('hw-form')) !== snap);
    A.folder.on((state) => { if (state === 'ok') load(); });

    await load();
    if (new URLSearchParams(location.search).has('neu')) {
      openEditor(-1);
      history.replaceState(null, '', location.pathname);
    }
  });
})();
