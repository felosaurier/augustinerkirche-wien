/* ============================================================
   Augustinerkirche Wien — admin-gottesdienste.js
   Gottesdienste pflegen (admin/gottesdienste.html):
   - Wochenplan aus data/gottesdienste.json: Termine anlegen,
     bearbeiten, loeschen; je Termin, ob er auch unter
     "Liturgie-Zeiten" erscheint und ob er hervorgehoben wird,
     und in welchen Monaten er gilt (von/bis, z. B. September bis Juni).
     Der Wochenplan erscheint auch im Kalender.
   - Ferien und Pausen ("ferien": [{name, von, bis, tage}]): Zeitraeume mit den
     Wochentagen, an denen in dieser Zeit nichts stattfindet (einmal pflegen,
     aendern sich jedes Jahr).
   - Ausfaelle ("entfaellt": [{datum, zeit, grund}]): faellt an einem Tag
     eine Messe aus (zeit leer = alle Gottesdienste des Tages), bleibt sie
     im Kalender stehen, durchgestrichen mit dem Hinweis "Entfällt"
   Benoetigt js/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { $, esc, icon } = A;
  const PATH = 'data/gottesdienste.json';
  const DAYS = { so: 'Sonntag', mo: 'Montag', di: 'Dienstag', mi: 'Mittwoch', do: 'Donnerstag', fr: 'Freitag', sa: 'Samstag' };
  const ORDER = Object.keys(DAYS);
  const keyOf = (t) => t.zeit || `${t.nach || '99:99'}~`;
  const timeText = (t) => t.zeit || 'anschl.';
  /* Anzeige von Montag an (ORDER bleibt Sonntag zuerst, wie getDay()) */
  const FROM_MONDAY = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
  const byDay = (a, b) => FROM_MONDAY.indexOf(a.tag) - FROM_MONDAY.indexOf(b.tag) || keyOf(a).localeCompare(keyOf(b));
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const MONTHS = A.HD.MONTHS;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const season = (t) => (t.von && t.bis ? `${MONTHS[t.von - 1]} bis ${MONTHS[t.bis - 1]}` : '');
  const dayKey = (iso) => ORDER[A.HD.dateFromIso(iso).getDay()];
  const byDate = (a, b) => a.datum.localeCompare(b.datum) || String(a.zeit).localeCompare(String(b.zeit));
  const byFrom = (a, b) => a.von.localeCompare(b.von);
  const range = (f) => `${A.fmtShort(f.von)} bis ${A.fmtShort(f.bis)}`;
  const WEEK = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
  const tageOf = (f) => (Array.isArray(f.tage) ? f.tage : ORDER);
  const tageText = (f) => {
    const t = WEEK.filter((k) => tageOf(f).includes(k));
    if (t.length === 7) return 'alle Wochentage';
    if (t.join() === 'mo,di,mi,do,fr') return 'Montag bis Freitag';
    return t.map((k) => DAYS[k]).join(', ');
  };
  /* Alle Teile, die den Wochenplan und die uebrigen Listen gemeinsam speichern */
  const pauses = (t) => ferien.filter((f) => tageOf(f).includes(t.tag));
  const payload = (over = {}) => ({ termine, ferien, entfaellt: ausfaelle, ...over });

  let termine = [];
  let ausfaelle = [];
  let ferien = [];
  let fpIndex = -1;
  let fpSnap = '';
  let axIndex = -1;
  let axSnap = '';
  let editIndex = -1;
  let snap = '';

  /* ---------- Wochenplan ---------- */
  function render() {
    if (!termine.length) {
      $('gd-list').innerHTML = '<div class="adm-empty"><p class="adm-empty-title">Noch keine Termine</p>' +
        `<p>Lege den ersten Gottesdienst der Woche an.</p><button type="button" class="btn btn-gold" data-act="new">${icon('plus')}Neuer Termin</button></div>`;
      return;
    }
    $('gd-list').innerHTML = '<ul class="adm-rows">' + termine.map((t, i) =>
      `<li class="adm-row" data-key="${esc(`${t.tag}-${keyOf(t)}-${t.name}`)}">` +
        `<button type="button" class="adm-row-open" data-act="edit" data-i="${i}">` +
          `<span class="adm-date"><span class="adm-day">${esc(DAYS[t.tag].slice(0, 2))}</span><span class="adm-wd">${esc(DAYS[t.tag])}</span></span>` +
          '<span class="adm-row-body">' +
            `<span class="adm-row-title">${t.hervorheben ? '<span class="gd-dot"></span>' : ''}${esc(t.name)}</span>` +
            (t.hinweis ? `<span class="adm-row-meta">${esc(t.hinweis)}</span>` : '') +
            (season(t) ? `<span class="adm-row-meta">Im Kalender nur ${esc(season(t))}</span>` : '') +
            (pauses(t).length ? `<span class="adm-row-meta">Pause: ${pauses(t).map((f) => esc(f.name)).join(', ')}</span>` : '') +
            `<span class="adm-chip${t.liturgie || t.art ? '' : ' past'}">${t.liturgie ? 'Liturgie-Zeiten und Kalender' : t.art === 'ohne' ? 'Im Kalender, ohne Kategorie' : t.art === 'tagzeit' ? 'Im Kalender als Tagzeitenliturgie' : t.art ? 'Im Kalender als Veranstaltung' : 'Nicht im Kalender'}</span>` +
          '</span>' +
          `<span class="adm-row-time">${esc(timeText(t))}</span>` +
        '</button>' +
        '<div class="adm-row-actions">' +
          `<button type="button" class="adm-act danger" data-act="del" data-i="${i}" aria-label="Löschen: ${esc(`${DAYS[t.tag]} ${timeText(t)} ${t.name}`)}">${icon('trash')}Löschen</button>` +
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
      const d = (await A.readJSON(PATH));
      termine = (d.termine || []).sort(byDay);
      ausfaelle = (d.entfaellt || []).filter((a) => a && A.HD.isoDate(a.datum)).sort(byDate);
      ferien = (d.ferien || []).filter((f) => f && A.HD.isoDate(f.von) && A.HD.isoDate(f.bis)).sort(byFrom);
    } catch (e) {
      $('gd-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Der Wochenplan konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
      return;
    }
    render();
    renderFerien();
    renderAusfaelle();
  }

  /* ---------- Ferien und Pausen ---------- */
  function renderFerien() {
    const today = A.isoToday();
    if (!ferien.length) {
      $('fp-list').innerHTML = '<p class="adm-muted">Noch keine Pause eingetragen. Gottesdienste mit „Entfällt in den Ferien“ stehen deshalb immer im Kalender.</p>';
      return;
    }
    $('fp-list').innerHTML = '<ul class="adm-rows">' + ferien.map((f, i) =>
      `<li class="adm-row" data-key="fp-${i}">` +
        `<button type="button" class="adm-row-open" data-fp="edit" data-i="${i}">` +
          `<span class="adm-date"><span class="adm-day">${icon('calendar')}</span><span class="adm-wd">${esc(plural(Math.round((A.HD.dateFromIso(f.bis) - A.HD.dateFromIso(f.von)) / 864e5) + 1, 'Tag', 'Tage'))}</span></span>` +
          '<span class="adm-row-body">' +
            `<span class="adm-row-title">${esc(f.name)}</span>` +
            `<span class="adm-row-meta">${esc(range(f))} · ${esc(tageText(f))}</span>` +
            `<span class="adm-chip${f.bis < today ? ' past' : ''}">${f.bis < today ? 'Schon vorbei' : `${f.von <= today ? 'Läuft gerade, ' : ''}${plural(termine.filter((t) => (t.liturgie || t.art) && tageOf(f).includes(t.tag)).length, 'Gottesdienst', 'Gottesdienste')} im Wochenplan betroffen`}</span>` +
          '</span><span></span>' +
        '</button>' +
        '<div class="adm-row-actions">' +
          `<button type="button" class="adm-act danger" data-fp="del" data-i="${i}" aria-label="Löschen: ${esc(`${f.name} ${range(f)}`)}">${icon('trash')}Löschen</button>` +
        '</div></li>'
    ).join('') + '</ul>';
  }
  function openFerien(i) {
    const f = i >= 0 ? ferien[i] : null;
    fpIndex = i;
    const form = $('fp-form');
    form.reset();
    A.clearErrors(form);
    $('fp-name').value = f ? f.name : '';
    $('fp-von').value = f ? f.von : '';
    $('fp-bis').value = f ? f.bis : '';
    const on = f ? tageOf(f) : [];
    $('fp-days').innerHTML = WEEK.map((k) =>
      `<label class="adm-check"><input type="checkbox" name="fp-tag" value="${k}"${on.includes(k) ? ' checked' : ''}/>${esc(DAYS[k])}</label>`).join('');
    $('fp-dlg-tag').textContent = f ? 'Pause ändern' : 'Ferien & Pausen';
    $('fp-dlg-title').textContent = f ? f.name : 'Neue Pause';
    $('fp-delete').hidden = !f;
    A.openDialog($('fp-dlg'), { isDirty: () => A.snapshot(form) !== fpSnap });
    fpSnap = A.snapshot(form);
  }
  async function storeFerien(next, note) {
    next.sort(byFrom);
    const direct = await A.saveJSON(PATH, payload({ ferien: next }));
    ferien = next;
    renderFerien();
    A.toast(direct ? note : `${note} Bitte unten die Datei herunterladen.`);
    A.log(note);
  }
  async function saveFerien(ev) {
    ev.preventDefault();
    const form = $('fp-form');
    const name = clean($('fp-name').value);
    const von = A.HD.isoDate($('fp-von').value);
    const bis = A.HD.isoDate($('fp-bis').value);
    const errors = [];
    if (!name) errors.push([$('fp-name'), 'Bitte eine Bezeichnung eintragen, z. B. Sommerferien.']);
    if (!von) errors.push([$('fp-von'), 'Bitte den ersten Tag wählen.']);
    if (!bis) errors.push([$('fp-bis'), 'Bitte den letzten Tag wählen.']);
    if (von && bis && bis < von) errors.push([$('fp-bis'), 'Das Ende liegt vor dem Anfang.']);
    const tage = WEEK.filter((k) => form.querySelector(`input[name="fp-tag"][value="${k}"]`).checked);
    if (!tage.length) errors.push([form.querySelector('input[name="fp-tag"]'), 'Bitte mindestens einen Wochentag wählen.']);
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }
    const f = { name, von, bis, tage };
    const next = ferien.slice();
    if (fpIndex >= 0) next[fpIndex] = f;
    else next.push(f);
    try {
      await storeFerien(next, `Pause gespeichert: ${name}, ${range(f)}.`);
      $('fp-dlg').close();
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }
  async function removeFerien(i) {
    const f = ferien[i];
    const ok = await A.confirmBox({
      title: 'Pause löschen?',
      html: `<strong>${esc(f.name)}</strong> (${esc(range(f))})<br><br>Die Gottesdienste stehen in diesem Zeitraum dann wieder im Kalender.`,
      ok: 'Löschen', danger: true
    });
    if (!ok) return false;
    try {
      await storeFerien(ferien.filter((x) => x !== f), `Pause gelöscht: ${f.name}.`);
      return true;
    } catch (err) {
      A.toast(`Löschen nicht möglich: ${err.message}`, 'err');
      return false;
    }
  }

  /* ---------- Ausfaelle ---------- */
  function renderAusfaelle() {
    const today = A.isoToday();
    const past = ausfaelle.filter((a) => a.datum < today).length;
    if (!ausfaelle.length) {
      $('ax-list').innerHTML = '<p class="adm-muted">Im Moment fällt nichts aus.</p>';
      return;
    }
    const what = (a) => {
      if (!a.zeit) return 'Alle Gottesdienste an diesem Tag';
      const t = termine.find((x) => (x.liturgie || x.art) && x.zeit === a.zeit && x.tag === dayKey(a.datum));
      return `${a.zeit} Uhr${t ? ` · ${t.name}` : ''}`;
    };
    $('ax-list').innerHTML = '<ul class="adm-rows">' + ausfaelle.map((a, i) =>
      `<li class="adm-row" data-key="ax-${i}">` +
        `<button type="button" class="adm-row-open" data-ax="edit" data-i="${i}">` +
          `<span class="adm-date"><span class="adm-day">${esc(A.HD.dateFromIso(a.datum).getDate())}</span><span class="adm-wd">${esc(A.fmtShort(a.datum))}</span></span>` +
          '<span class="adm-row-body">' +
            `<span class="adm-row-title">${esc(what(a))}</span>` +
            (a.grund ? `<span class="adm-row-meta">${esc(a.grund)}</span>` : '') +
            `<span class="adm-chip${a.datum < today ? ' past' : ''}">${a.datum < today ? 'Schon vorbei' : 'Entfällt'}</span>` +
          '</span><span></span>' +
        '</button>' +
        '<div class="adm-row-actions">' +
          `<button type="button" class="adm-act danger" data-ax="del" data-i="${i}" aria-label="Wieder streichen: ${esc(`${A.fmtShort(a.datum)} ${what(a)}`)}">${icon('trash')}Streichen</button>` +
        '</div></li>'
    ).join('') + '</ul>' +
      (past ? `<p style="margin-top:.8rem"><button type="button" class="adm-act" data-ax="clear">Vergangene entfernen (${plural(past, 'Eintrag', 'Einträge')})</button></p>` : '');
  }
  /* Auswahl: alle Gottesdienste des Tages, die Messen des Wochenplans fuer diesen Wochentag, andere Uhrzeit */
  function fillWelche(datum, zeit) {
    const sel = $('ax-welche');
    const day = A.HD.isoDate(datum) ? dayKey(A.HD.isoDate(datum)) : '';
    const plan = termine.filter((t) => (t.liturgie || t.art) && t.zeit && t.tag === day);
    sel.innerHTML = '<option value="">Alle Gottesdienste an diesem Tag</option>' +
      plan.map((t) => `<option value="${esc(t.zeit)}">${esc(t.zeit)} Uhr · ${esc(t.name)}</option>`).join('') +
      '<option value="andere">Andere Uhrzeit …</option>';
    sel.value = !zeit ? '' : plan.some((t) => t.zeit === zeit) ? zeit : 'andere';
    $('ax-zeit-field').hidden = sel.value !== 'andere';
    $('ax-zeit').value = sel.value === 'andere' ? zeit || '' : '';
  }
  function openAusfall(i) {
    const a = i >= 0 ? ausfaelle[i] : null;
    axIndex = i;
    const form = $('ax-form');
    form.reset();
    A.clearErrors(form);
    $('ax-datum').value = a ? a.datum : '';
    fillWelche(a ? a.datum : '', a ? a.zeit : '');
    $('ax-grund').value = a ? a.grund || '' : '';
    $('ax-dlg-tag').textContent = a ? 'Eintrag ändern' : 'Entfällt';
    $('ax-dlg-title').textContent = a ? A.fmtDate(a.datum) : 'Gottesdienst entfällt';
    $('ax-delete').hidden = !a;
    A.openDialog($('ax-dlg'), { isDirty: () => A.snapshot(form) !== axSnap });
    axSnap = A.snapshot(form);
  }
  async function storeAusfaelle(next, note) {
    next.sort(byDate);
    const direct = await A.saveJSON(PATH, payload({ entfaellt: next }));
    ausfaelle = next;
    renderAusfaelle();
    A.toast(direct ? note : `${note} Bitte unten die Datei herunterladen.`);
    A.log(note);
  }
  async function saveAusfall(ev) {
    ev.preventDefault();
    const form = $('ax-form');
    const datum = A.HD.isoDate($('ax-datum').value);
    const welche = $('ax-welche').value;
    const zeit = welche === 'andere' ? A.HD.isoTime($('ax-zeit').value) : welche;
    const errors = [];
    if (!datum) errors.push([$('ax-datum'), 'Bitte das Datum wählen.']);
    if (welche === 'andere' && !zeit) errors.push([$('ax-zeit'), 'Bitte die Uhrzeit eintragen.']);
    if (datum && ausfaelle.some((a, i) => i !== axIndex && a.datum === datum && (a.zeit || '') === (zeit || ''))) {
      errors.push([$('ax-datum'), 'Dafür gibt es schon einen Eintrag.']);
    }
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }
    const a = { datum, zeit: zeit || '', grund: clean($('ax-grund').value) };
    const next = ausfaelle.slice();
    if (axIndex >= 0) next[axIndex] = a;
    else next.push(a);
    try {
      await storeAusfaelle(next, `Entfällt: ${A.fmtShort(datum)}${zeit ? `, ${zeit}` : ''}.`);
      $('ax-dlg').close();
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }
  async function removeAusfall(i) {
    const a = ausfaelle[i];
    try {
      await storeAusfaelle(ausfaelle.filter((x) => x !== a), `Wieder im Kalender: ${A.fmtShort(a.datum)}${a.zeit ? `, ${a.zeit}` : ''}.`);
      return true;
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
      return false;
    }
  }

  /* "Anschließend an": die Termine mit Uhrzeit am gewählten Wochentag */
  function fillNach(tag, selected) {
    const timed = termine.filter((x) => x.tag === tag && x.zeit);
    $('f-nach').innerHTML = timed.length
      ? timed.map((x) => `<option value="${esc(x.zeit)}">${esc(x.zeit)} Uhr · ${esc(x.name)}</option>`).join('')
      : '<option value="">(an diesem Tag gibt es noch keinen Termin mit Uhrzeit)</option>';
    const hochamt = timed.find((x) => /hochamt/i.test(x.name));
    $('f-nach').value = selected || (hochamt || timed[0] || {}).zeit || '';
  }
  function syncAnschl() {
    $('f-nach-field').hidden = !$('f-anschl').checked;
  }

  function openEditor(i) {
    const t = i >= 0 ? termine[i] : null;
    editIndex = i;
    const form = $('gd-form');
    form.reset();
    A.clearErrors(form);
    $('f-tag').value = t ? t.tag : 'so';
    $('f-zeit').value = t ? t.zeit : '18:30';
    $('f-anschl').checked = !!(t && t.anschliessend);
    fillNach(t ? t.tag : 'so', t && t.nach);
    syncAnschl();
    $('f-name').value = t ? t.name : 'Heilige Messe';
    $('f-hinweis').value = t ? t.hinweis : 'Augustinerkirche';
    $('f-von').value = t && t.von ? String(t.von) : '';
    $('f-bis').value = t && t.bis ? String(t.bis) : '';
    $('f-art').value = t && t.art === 'ohne' ? 'ohne' : '';
    $('f-liturgie').checked = t ? !!t.liturgie : true;
    $('f-hervorheben').checked = !!(t && t.hervorheben);
    $('gd-dlg-tag').textContent = t ? 'Termin bearbeiten' : 'Neuer Termin';
    $('gd-dlg-title').textContent = t ? `${DAYS[t.tag]}, ${t.zeit ? `${t.zeit} Uhr` : 'anschließend'}` : 'Neuer regelmäßiger Termin';
    $('gd-delete').hidden = !t;
    A.openDialog($('gd-dlg'), { isDirty: () => A.snapshot(form) !== snap });
    snap = A.snapshot(form);
  }

  async function store(next, note) {
    next.sort(byDay);
    const direct = await A.saveJSON(PATH, payload({ termine: next }));
    termine = next;
    render();
    A.toast(direct ? note : `${note} Bitte unten die Datei herunterladen.`);
    A.log(note);
  }

  async function save(ev) {
    ev.preventDefault();
    const form = $('gd-form');
    const anschl = $('f-anschl').checked;
    const t = {
      tag: $('f-tag').value, zeit: anschl ? '' : A.HD.isoTime($('f-zeit').value), name: clean($('f-name').value),
      hinweis: clean($('f-hinweis').value), liturgie: $('f-liturgie').checked, hervorheben: $('f-hervorheben').checked
    };
    if (anschl) Object.assign(t, { anschliessend: true, nach: $('f-nach').value });
    if ($('f-art').value) t.art = $('f-art').value;
    const von = Number($('f-von').value);
    const bis = Number($('f-bis').value);
    if (von && bis) Object.assign(t, { von, bis });
    const errors = [];
    if (!von !== !bis) errors.push([$(von ? 'f-bis' : 'f-von'), 'Bitte beide Monate wählen, oder beide leer lassen (das ganze Jahr).']);
    if (!anschl && !t.zeit) errors.push([$('f-zeit'), 'Bitte die Uhrzeit eintragen oder „anschließend“ wählen.']);
    if (anschl && !t.nach) errors.push([$('f-nach'), 'Lege zuerst den Termin mit Uhrzeit an, an den dieser anschließt.']);
    if (!t.name) errors.push([$('f-name'), 'Bitte eine Bezeichnung eintragen, z. B. Heilige Messe.']);
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }
    const next = termine.slice();
    if (editIndex >= 0) next[editIndex] = t;
    else next.push(t);
    try {
      await store(next, `Gespeichert: ${DAYS[t.tag]}, ${timeText(t)} · ${t.name}.`);
      $('gd-dlg').close();
      flash(`${t.tag}-${keyOf(t)}-${t.name}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  async function remove(i) {
    const t = termine[i];
    const ok = await A.confirmBox({
      title: 'Termin löschen?',
      html: `<strong>${esc(DAYS[t.tag])}, ${esc(timeText(t))}</strong> · ${esc(t.name)}<br><br>Der Termin verschwindet aus dem Kalender und Wochenplan der Website.`,
      ok: 'Löschen', danger: true
    });
    if (!ok) return false;
    try {
      await store(termine.filter((x) => x !== t), `Gelöscht: ${DAYS[t.tag]}, ${timeText(t)} · ${t.name}.`);
      return true;
    } catch (err) {
      A.toast(`Löschen nicht möglich: ${err.message}`, 'err');
      return false;
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    const months = (first) => `<option value="">${first}</option>` + MONTHS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
    $('f-von').innerHTML = months('Das ganze Jahr');
    $('f-bis').innerHTML = months('Das ganze Jahr');
    const setDays = (list) => document.querySelectorAll('#fp-days input').forEach((i) => { i.checked = list.includes(i.value); });
    $('fp-werktage').addEventListener('click', () => setDays(['mo', 'di', 'mi', 'do', 'fr']));
    $('fp-alle').addEventListener('click', () => setDays(WEEK));
    $('fp-new').addEventListener('click', () => openFerien(-1));
    $('fp-form').addEventListener('submit', saveFerien);
    $('fp-delete').addEventListener('click', async () => {
      if (fpIndex >= 0 && await removeFerien(fpIndex)) $('fp-dlg').close();
    });
    $('fp-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-fp]');
      if (!b) return;
      if (b.dataset.fp === 'edit') openFerien(Number(b.dataset.i));
      if (b.dataset.fp === 'del') removeFerien(Number(b.dataset.i));
    });
    $('ax-new').addEventListener('click', () => openAusfall(-1));
    $('ax-form').addEventListener('submit', saveAusfall);
    $('ax-datum').addEventListener('change', () => fillWelche($('ax-datum').value, ''));
    $('ax-welche').addEventListener('change', () => {
      $('ax-zeit-field').hidden = $('ax-welche').value !== 'andere';
    });
    $('ax-delete').addEventListener('click', async () => {
      if (axIndex >= 0 && await removeAusfall(axIndex)) $('ax-dlg').close();
    });
    $('ax-list').addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-ax]');
      if (!b) return;
      const act = b.dataset.ax;
      if (act === 'edit') openAusfall(Number(b.dataset.i));
      if (act === 'del') removeAusfall(Number(b.dataset.i));
      if (act === 'clear') {
        try {
          await storeAusfaelle(ausfaelle.filter((a) => a.datum >= A.isoToday()), 'Vergangene Einträge entfernt.');
        } catch (err) {
          A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
        }
      }
    });
    $('f-anschl').addEventListener('change', syncAnschl);
    $('f-tag').addEventListener('change', () => fillNach($('f-tag').value));
    $('gd-new').addEventListener('click', () => openEditor(-1));
    $('gd-form').addEventListener('submit', save);
    $('gd-delete').addEventListener('click', async () => {
      if (editIndex >= 0 && await remove(editIndex)) $('gd-dlg').close();
    });
    $('gd-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'edit') openEditor(Number(b.dataset.i));
      if (b.dataset.act === 'del') remove(Number(b.dataset.i));
      if (b.dataset.act === 'new') openEditor(-1);
    });
    A.guard(() => ($('gd-dlg').open && A.snapshot($('gd-form')) !== snap) || ($('ax-dlg').open && A.snapshot($('ax-form')) !== axSnap) || ($('fp-dlg').open && A.snapshot($('fp-form')) !== fpSnap));
    A.folder.on((state) => { if (state === 'ok') load(); });

    await load();
    if (new URLSearchParams(location.search).has('neu')) {
      openEditor(-1);
      history.replaceState(null, '', location.pathname);
    }
  });
})();
