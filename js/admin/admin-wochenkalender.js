/* ============================================================
   Augustinerkirche Wien — admin-wochenkalender.js
   Wochenkalender (admin/wochenkalender.html): Vorschau des gedruckten Wochenkalenders.
   Gezeigt wird alles, was im Kalender steht (regelmäßige Termine, Hochämter, Runden,
   eigene Termine, js/kalender-daten.js), Woche für Woche. Dazu trägst du die Einzelheiten
   der Woche ein, gespeichert in data/wochenkalender.json:
   {"tage": [{datum, tag, heilige: [], termine: [{zeit, anschliessend, nach, name, zusatz,
   zelebrant, musik, ort, hinweis, art, entfaellt}]}],
   "wochen": [{montag, bild, breite, hoehe}]}
   - je Tag Tagesbezeichnung und Heilige und Gedenktage
   - je Termin Zelebrant, Musik, Ort und Hinweis; ein Eintrag ersetzt den Termin des Kalenders
     um dieselbe Uhrzeit, ein Termin, den es dort nicht gibt, kommt neu dazu
   - kein Löschen und Kopieren: ein Termin "entfällt", dann steht er nicht im Wochenkalender
     und ist hier durchgestrichen
   - je Woche ein Bild (z. B. der gedruckte Wochenkalender), auf der Website rechts neben dem
     Wochenueberblick (js/woche.js); die Bilder liegen in assets/img/wochenkalender/
   Benoetigt js/hochaemter-data.js, js/kalender-daten.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const KD = window.KalenderDaten;
  const { HD, $, esc, icon } = A;
  const PATH = 'data/wochenkalender.json';
  const BASE = '../';
  const IMG_DIR = 'assets/img/wochenkalender/';
  const GROUP = { hochamt: 'Hochamt', gottesdienst: 'Gottesdienst', tagzeit: 'Tagzeitenliturgie', veranstaltung: 'Veranstaltung', konzert: 'Konzert', runde: 'Runden', ohne: 'Termin' };
  const FROM = { plan: 'Gottesdienstzeiten', hochamt: 'Hochämter', runde: 'Runden', termin: 'Veranstaltungen' };

  let tage = [];          /* data/wochenkalender.json */
  let wochen = [];        /* Bilder je Woche: {montag, bild, breite, hoehe} */
  let items = [];         /* alle Termine des Kalenders samt Wochenkalender */
  let monday = null;
  let editDay = '';
  let editItem = null;    /* der Termin im Fenster, null = neu */
  let teSnap = '';
  let tdDay = '';
  let tdSnap = '';

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const addDays = (dt, n) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n);
  const mondayOf = (dt) => addDays(dt, -((dt.getDay() + 6) % 7));
  const iso = A.isoOf;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const dayOf = (d) => tage.find((x) => x.datum === d) || null;
  const weekIsos = () => Array.from({ length: 7 }, (_, i) => iso(addDays(monday, i)));
  const whenOf = (it) => it.time || it.label || '';
  /* Platz des Termins im Tag: Uhrzeit, bei "anschließend" die Uhrzeit davor mit ~ */
  const slotOfTermin = (t) => (HD.isoTime(t.zeit) ? HD.isoTime(t.zeit) : `${HD.isoTime(t.nach)}~`);
  const slotOfItem = (it) => it.time || it.sort || '';

  /* ---------- Laden ---------- */
  async function loadItems() {
    KD.refresh(BASE);
    items = await KD.load(BASE, { all: true });
  }
  async function load() {
    try {
      const d = await A.readJSON(PATH);
      if (!d || !Array.isArray(d.tage)) throw new Error('unerwarteter Inhalt');
      tage = d.tage.filter((x) => x && HD.isoDate(x.datum)).map((x) => ({
        datum: x.datum, tag: x.tag || '', heilige: Array.isArray(x.heilige) ? x.heilige : [],
        termine: Array.isArray(x.termine) ? x.termine : [], ...(x.ohneHeilige ? { ohneHeilige: true } : {})
      }));
      wochen = (Array.isArray(d.wochen) ? d.wochen : []).filter((x) => x && HD.isoDate(x.montag) && x.bild);
      await loadItems();
    } catch (e) {
      $('wk-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Der Wochenkalender konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
      return false;
    }
    render();
    return true;
  }

  /* ---------- Anzeige ---------- */
  function rowHTML(day, it, i) {
    const off = it.hidden;
    const chips = [
      `<span class="adm-chip">${esc(GROUP[it.group] || 'Termin')}</span>`,
      it.src === 'wk' ? `<span class="adm-chip">${it.from ? 'Angaben ergänzt' : 'Nur im Wochenkalender'}</span>` : `<span class="adm-chip past">${esc(FROM[it.src] || 'Kalender')}</span>`,
      off ? '<span class="adm-chip wk-chip-off">Entfällt im Wochenkalender</span>' : '',
      it.cancelled && !off ? `<span class="adm-chip wk-chip-off">Entfällt${it.why ? `: ${esc(it.why)}` : ''}</span>` : ''
    ].join('');
    return `<li class="adm-row${off || it.cancelled ? ' wk-off' : ''}">` +
      `<button type="button" class="adm-row-open" data-act="edit" data-day="${day}" data-i="${i}">` +
                '<span class="adm-row-body">' +
          `<span class="adm-row-title">${esc(it.title)}</span>` +
          (it.sub ? `<span class="adm-row-meta">${esc(it.sub)}</span>` : '') +
          chips +
        '</span>' +
        `<span class="adm-row-time">${esc(whenOf(it))}</span>` +
      '</button></li>';
  }

  function render() {
    const days = weekIsos();
    const sun = addDays(monday, 6);
    const m = HD.MONTHS;
    $('wk-title').textContent = monday.getMonth() === sun.getMonth()
      ? `${monday.getDate()}.–${sun.getDate()}. ${m[sun.getMonth()]} ${sun.getFullYear()}`
      : `${monday.getDate()}. ${m[monday.getMonth()]} – ${sun.getDate()}. ${m[sun.getMonth()]} ${sun.getFullYear()}`;
    $('wk-date').value = iso(monday);
    const inWeek = items.filter((it) => it.date >= days[0] && it.date <= days[6]);
    const shown = inWeek.filter((it) => !it.hidden).length;
    $('wk-count').textContent = `${plural(shown, 'Termin', 'Termine')} im Wochenkalender` +
      (inWeek.length > shown ? `, ${inWeek.length - shown} entfallen (durchgestrichen)` : '');
    $('wk-today').hidden = $('wk-today2').hidden = iso(monday) === iso(mondayOf(new Date()));
    $('wk-list').innerHTML = days.map((d) => {
      const day = dayOf(d);
      const dt = HD.dateFromIso(d);
      const its = inWeek.filter((it) => it.date === d);
      /* Heilige: eigene des Tages, sonst automatisch aus dem Heiligenkalender (kursiv markiert) */
      const auto = day && (day.heilige.length || day.ohneHeilige) ? [] : autoHeilige(d);
      /* Tagesbezeichnung: eigene, sonst automatisch aus dem Kirchenjahr (kursiv) */
      const autoTag = day && day.tag ? '' : autoTagAm(d);
      const info = [day ? day.tag : '', ...(day ? day.heilige : [])].filter(Boolean).join(' · ');
      const autoInfo = [
        autoTag ? `<span class="wk-auto" title="Automatisch aus dem Kirchenjahr">${esc(autoTag)}</span>` : '',
        auto.length ? `<span class="wk-auto" title="Automatisch aus dem Heiligenkalender">${esc(auto.join(' · '))}</span>` : ''
      ].filter(Boolean).join(' · ');
      return '<section class="wk-adm-day">' +
        '<div class="adm-group-head">' +
          `<h3 class="adm-group-title" style="margin:0">${esc(HD.WEEKDAYS[dt.getDay()])}, ${dt.getDate()}. ${esc(m[dt.getMonth()])}</h3>` +
          '<span>' +
            `<button type="button" class="adm-act" data-act="day" data-day="${d}">${icon('edit')}Tag</button> ` +
            `<button type="button" class="adm-act" data-act="new" data-day="${d}">${icon('plus')}Termin</button>` +
          '</span></div>' +
        `<p class="adm-hint" style="margin:.2rem 0 .6rem">${info || autoInfo ? [info ? HD.formatText(info) : '', autoInfo].filter(Boolean).join(' · ') : 'Keine Tagesbezeichnung'}</p>` +
        (its.length
          ? `<ul class="adm-rows">${its.map((it) => rowHTML(d, it, items.indexOf(it))).join('')}</ul>`
          : '<p class="adm-muted">Keine Termine</p>') +
      '</section>';
    }).join('');
    renderBild();
  }

  /* ---------- Bild der Woche ---------- */
  const bildOf = (m) => wochen.find((x) => x.montag === m) || null;
  function renderBild() {
    const b = bildOf(iso(monday));
    $('wk-bild-prev').innerHTML = b ? `<img src="${esc(A.imageUrl(b.bild))}" alt="Bild der Woche"/>` : '<span class="none">Kein Bild</span>';
    $('wk-bild-info').textContent = b ? A.fileName(b.bild) : '';
    $('wk-bild-label').textContent = b ? 'Anderes Bild wählen' : 'Bild wählen';
    $('wk-bild-del').hidden = !b;
  }
  async function onBild(file) {
    $('wk-bild-file').value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      A.toast('Bitte eine Bilddatei wählen (WebP, JPG oder PNG). Ein PDF bitte vorher als Bild speichern.', 'err');
      return;
    }
    let conv;
    try {
      conv = await A.toWebp(file, { maxSize: 1600, quality: 0.86 });
    } catch {
      return;
    }
    let w = 0;
    let h = 0;
    try {
      const bmp = await createImageBitmap(conv.blob);
      w = bmp.width;
      h = bmp.height;
      if (bmp.close) bmp.close();
    } catch { /* Groesse unbekannt */ }
    const m = iso(monday);
    const old = bildOf(m);
    /* immer ein neuer Name, damit Browser nicht das alte Bild zeigen */
    let path = `${IMG_DIR}${m}.${conv.ext}`;
    for (let n = 2; (old && old.bild === path) || (A.folder.state === 'ok' && await A.folder.exists(path)); n++) path = `${IMG_DIR}${m}-${n}.${conv.ext}`;
    try {
      await A.saveFile(path, conv.blob);
      const entry = { montag: m, bild: path, ...(w && h ? { breite: w, hoehe: h } : {}) };
      await store(tage, `Bild der Woche ab ${label(m)} gespeichert.`, wochen.filter((x) => x.montag !== m).concat(entry));
      if (old && old.bild !== path) await A.media.remove([old.bild]);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }
  async function removeBild() {
    const m = iso(monday);
    const old = bildOf(m);
    if (!old) return;
    const ok = await A.confirmBox({
      title: 'Bild der Woche entfernen?',
      html: `Woche ab <strong>${esc(label(m))}</strong><br><br>Das Bild verschwindet aus dem Wochenüberblick, die Datei wird gelöscht.`,
      ok: 'Entfernen', danger: true
    });
    if (!ok) return;
    try {
      await store(tage, `Bild der Woche ab ${label(m)} entfernt.`, wochen.filter((x) => x.montag !== m));
      await A.media.remove([old.bild]);
    } catch (err) {
      A.toast(`Entfernen nicht möglich: ${err.message}`, 'err');
    }
  }

  /* Speichern: Tage ohne Inhalt fallen weg; die Bilder der Wochen bleiben, wie sie sind */
  async function store(next, note, nextWochen = wochen) {
    const kept = next.filter((d) => d.tag || d.heilige.length || d.termine.length || d.ohneHeilige).sort((a, b) => a.datum.localeCompare(b.datum));
    const bilder = nextWochen.slice().sort((a, b) => a.montag.localeCompare(b.montag));
    const direct = await A.saveJSON(PATH, bilder.length ? { tage: kept, wochen: bilder } : { tage: kept });
    tage = kept;
    wochen = bilder;
    await loadItems();
    render();
    A.toast(direct ? note : `${note} Bitte unten die Datei herunterladen.`);
    A.log(note);
  }
  const withDay = (d) => {
    const next = tage.map((x) => ({ ...x, heilige: x.heilige.slice(), termine: x.termine.slice() }));
    let day = next.find((x) => x.datum === d);
    if (!day) {
      day = { datum: d, tag: '', heilige: [], termine: [] };
      next.push(day);
    }
    return { next, day };
  };
  const label = (d) => A.fmtShort(d);

  /* Heilige aus dem Heiligenkalender (Verwaltung: Heiligenkalender) */
  const autoHeilige = (d) => (KD.heiligeAuto ? KD.heiligeAuto(d) : []);
  /* Tagesbezeichnung aus dem Kirchenjahr ("28. Sonntag im Jahreskreis", "1. Adventsonntag" …) */
  const autoTagAm = (d) => (KD.tagAm ? KD.tagAm(d) : '');

  /* ---------- Tag ---------- */
  function openDay(d) {
    const day = dayOf(d);
    tdDay = d;
    const form = $('td-form');
    form.reset();
    $('td-tag').value = day ? day.tag : '';
    $('td-heilige').value = day ? day.heilige.join('\n') : '';
    /* Vorschlag aus dem Heiligenkalender: steht im Kalender, solange hier nichts eingetragen ist */
    const auto = autoHeilige(d);
    $('td-auto').innerHTML = auto.length
      ? `Ohne eigenen Eintrag steht automatisch da: <b>${esc(auto.join(' · '))}</b> <button type="button" class="adm-act" id="td-auto-take">Übernehmen</button>`
      : 'Für diesen Tag steht im Heiligenkalender nichts (oder es ist ein Sonntag).';
    $('td-ohne').checked = !!(day && day.ohneHeilige);
    const tagAuto = autoTagAm(d);
    $('td-tag').placeholder = tagAuto || 'z. B. Vom Tag';
    $('td-tag-auto').textContent = tagAuto
      ? `Ohne eigenen Eintrag steht automatisch da: ${tagAuto}. Eine eigene Bezeichnung ersetzt sie.`
      : 'Aus dem Kirchenjahr gibt es für diesen Tag keine Bezeichnung (Werktag).';
    $('td-ohne-wrap').hidden = !auto.length;
    $('td-dlg-title').textContent = A.fmtDate(d);
    A.openDialog($('td-dlg'), { isDirty: () => A.snapshot(form) !== tdSnap });
    tdSnap = A.snapshot(form);
  }
  async function saveDay(ev) {
    ev.preventDefault();
    const { next, day } = withDay(tdDay);
    day.tag = clean($('td-tag').value);
    day.heilige = $('td-heilige').value.split('\n').map(clean).filter(Boolean);
    if ($('td-ohne').checked && !day.heilige.length && autoHeilige(tdDay).length) day.ohneHeilige = true;
    else delete day.ohneHeilige;
    try {
      await store(next, `Tag gespeichert: ${label(tdDay)}.`);
      $('td-dlg').close();
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  /* ---------- Termin ---------- */
  function fillNach(d, selected) {
    const timed = items.filter((it) => it.date === d && it.time);
    $('te-nach').innerHTML = timed.length
      ? timed.map((it) => `<option value="${esc(it.time)}">${esc(it.time)} Uhr · ${esc(it.title)}</option>`).join('')
      : '<option value="">(an diesem Tag gibt es noch keinen Termin mit Uhrzeit)</option>';
    const hochamt = timed.find((it) => it.group === 'hochamt');
    $('te-nach').value = selected || (hochamt || timed[0] || {}).time || '';
  }
  function syncAnschl() {
    const on = $('te-anschl').checked;
    $('te-nach-field').hidden = !on;
    $('te-zeit-field').hidden = on;
  }
  function openTermin(d, it) {
    editDay = d;
    editItem = it || null;
    const form = $('te-form');
    form.reset();
    A.clearErrors(form);
    const x = it ? it.d || {} : { art: 'gottesdienst', name: 'Heilige Messe' };
    $('te-new').style.display = it ? 'none' : 'contents';
    $('te-when-text').hidden = !it;
    $('te-when-text').textContent = it ? (it.label ? `Anschließend, nach ${it.sort.slice(0, -1)} Uhr` : `${it.time} Uhr`) : '';
    $('te-zeit').value = '18:30';
    $('te-anschl').checked = false;
    fillNach(d);
    syncAnschl();
    $('te-art').value = x.art || 'veranstaltung';
    $('te-name').value = x.name || '';
    $('te-zusatz').value = x.zusatz || '';
    $('te-zel').value = x.zelebrant || '';
    $('te-ort').value = x.ort || '';
    $('te-musik').value = x.musik || '';
    $('te-hinweis').value = x.hinweis || '';
    $('te-off').checked = !!(it && it.hidden);
    $('te-dlg-tag').textContent = it ? 'Termin bearbeiten' : 'Neuer Termin';
    $('te-dlg-title').textContent = A.fmtDate(d);
    A.openDialog($('te-dlg'), { isDirty: () => A.snapshot(form) !== teSnap });
    teSnap = A.snapshot(form);
  }
  async function saveTermin(ev) {
    ev.preventDefault();
    const form = $('te-form');
    const name = clean($('te-name').value);
    const errors = [];
    let zeit = '';
    let nach = '';
    if (editItem) {
      zeit = editItem.time || '';
      nach = editItem.label ? editItem.sort.slice(0, -1) : '';
    } else if ($('te-anschl').checked) {
      nach = $('te-nach').value;
      if (!nach) errors.push([$('te-nach'), 'Es gibt an diesem Tag noch keinen Termin mit Uhrzeit, an den dieser anschließen könnte.']);
    } else {
      zeit = HD.isoTime($('te-zeit').value);
      if (!zeit) errors.push([$('te-zeit'), 'Bitte die Uhrzeit eintragen oder „anschließend“ wählen.']);
    }
    if (!name) errors.push([$('te-name'), 'Bitte eine Bezeichnung eintragen, z. B. Heilige Messe.']);
    const t = { zeit };
    if (nach) Object.assign(t, { anschliessend: true, nach });
    if (!editItem && !errors.length && items.some((it) => it.date === editDay && slotOfItem(it) === slotOfTermin(t))) {
      errors.push([$(nach ? 'te-nach' : 'te-zeit'), 'Dafür gibt es schon einen Termin. Klicke ihn in der Liste an, um ihn zu ergänzen.']);
    }
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }
    t.name = name;
    for (const [k, id] of [['zusatz', 'te-zusatz'], ['zelebrant', 'te-zel'], ['musik', 'te-musik'], ['ort', 'te-ort'], ['hinweis', 'te-hinweis']]) {
      const v = clean($(id).value);
      if (v) t[k] = v;
    }
    t.art = $('te-art').value;
    if ($('te-off').checked) t.entfaellt = true;
    const { next, day } = withDay(editDay);
    const i = day.termine.findIndex((x) => slotOfTermin(x) === slotOfTermin(t));
    if (i >= 0) day.termine[i] = t;
    else day.termine.push(t);
    try {
      await store(next, `${t.entfaellt ? 'Entfällt' : 'Gespeichert'}: ${label(editDay)}, ${zeit || 'anschließend'} · ${name}.`);
      $('te-dlg').close();
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    monday = mondayOf(new Date());
    const go = (m, top) => {
      monday = m;
      render();
      if (top) window.scrollTo({ top: 0, behavior: 'auto' });
    };
    /* Wochenwahl oben und unten */
    for (const [suffix, top] of [['', false], ['2', true]]) {
      $(`wk-prev${suffix}`).addEventListener('click', () => go(addDays(monday, -7), top));
      $(`wk-next${suffix}`).addEventListener('click', () => go(addDays(monday, 7), top));
      $(`wk-today${suffix}`).addEventListener('click', () => go(mondayOf(new Date()), top));
    }
    $('wk-date').addEventListener('change', () => {
      const v = HD.isoDate($('wk-date').value);
      if (v) go(mondayOf(HD.dateFromIso(v)));
    });
    $('te-anschl').addEventListener('change', syncAnschl);
    $('wk-bild-file').addEventListener('change', (ev) => onBild(ev.target.files[0]));
    $('wk-bild-del').addEventListener('click', removeBild);
    $('te-form').addEventListener('submit', saveTermin);
    $('td-form').addEventListener('submit', saveDay);
    /* Heilige aus dem Heiligenkalender ins Feld uebernehmen (zum Ergaenzen oder Aendern) */
    $('td-auto').addEventListener('click', (ev) => {
      if (!ev.target.closest('#td-auto-take')) return;
      $('td-heilige').value = autoHeilige(tdDay).join('\n');
      $('td-ohne').checked = false;
      $('td-heilige').focus();
    });
    $('wk-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      const { act, day } = b.dataset;
      if (act === 'new') openTermin(day, null);
      if (act === 'day') openDay(day);
      if (act === 'edit') openTermin(day, items[Number(b.dataset.i)]);
    });
    A.guard(() => ($('te-dlg').open && A.snapshot($('te-form')) !== teSnap) || ($('td-dlg').open && A.snapshot($('td-form')) !== tdSnap));
    A.folder.on((state) => { if (state === 'ok') load(); });

    await load();
    const q = new URLSearchParams(location.search).get('woche');
    if (q && HD.isoDate(q)) go(mondayOf(HD.dateFromIso(HD.isoDate(q))));
  });
})();
