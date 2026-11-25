/* ============================================================
   Augustinerkirche Wien — admin-aspersdorf-monatsblatt.js
   Monatsblatt der Pfarre Aspersdorf (admin/aspersdorf-monatsblatt.html): Monat waehlen,
   je Gottesdienst die Angaben (Intention, LK, KH, Ministranten, L1, L2, Ev, fette Zeile,
   eigene Angabe rechts) und je Woche das Ewige Licht ergaenzen, daneben die Vorschau;
   Drucken bzw. PDF und Word (js/admin/aspersdorf-monatsblatt.js).
   Termine kommen aus data/aspersdorf-gottesdienste.json (gepflegt unter Gottesdienste &
   Termine); hier werden nur "details" und "licht" in dieselbe Datei geschrieben, alles
   andere bleibt, wie es beim Speichern in der Datei steht.
   Benoetigt js/gemeinsam/hochaemter-data.js, js/gemeinsam/kalender-daten.js,
   js/gemeinsam/aspersdorf-daten.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { HD, $, esc, icon } = A;
  const PATH = 'data/aspersdorf-gottesdienste.json';
  /* Stand von pages/aspersdorf.html, solange es die Datei noch nicht gibt (wie admin-aspersdorf-gottesdienste.js) */
  const VORGABE = [
    { tag: 'so', zeit: '08:30', name: 'Heilige Messe', hinweis: 'Pfarrkirche St. Georg, Aspersdorf' },
    { tag: 'mi', zeit: '17:30', name: 'Beichtgelegenheit', hinweis: 'vor den Werktags- und Vorabendmessen' },
    { tag: 'mi', zeit: '18:00', name: 'Heilige Messe', hinweis: 'monatlich, außer Juli/August — abwechselnd in Wieselsfeld' },
    { tag: 'sa', zeit: '18:00', name: 'Vorabendmesse', hinweis: 'in der Regel 1. und 3. Samstag im Monat, anstelle der Sonntagsmesse' }
  ];
  let daten = {};
  let ready = false;
  let snap = '';
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  /* ---------- Monatsblatt ---------- */
  /* Angaben je Termin und je Woche (bleiben beim Speichern erhalten, auch die anderer Monate) */
  let details = {};
  let licht = {};
  let heiligen = null;
  const FELDER = [['fuer', 'Intention (für …)', 'z. B. + Ehemann Josef Dötzl', true], ['lk', 'LK (Lektor/en)', 'z. B. Strobach, Weber S.'],
    ['l1', 'L1 (1. Lesung)', 'z. B. Weish 6,12-16'], ['kh', 'KH (Kommunionhelfer/in)', ''], ['l2', 'L2 (2. Lesung)', ''],
    ['mini', 'Ministrant/inn/en', 'z. B. I + II'], ['ev', 'Ev (Evangelium)', 'z. B. Mt 25,1-13'],
    ['zusatz', 'Fette Zeile darunter', 'z. B. Gräber-Gang & Gräber-Segnung', true],
    ['rechts', 'Rechts statt Kirchenjahr/Heiligem', 'z. B. Hl. Martin | Bischof von Tours (| = neue Zeile, - = nichts)', true]];
  const formData = () => ({ regelmaessig: daten.regelmaessig || [], termine: daten.termine || [], details, licht });
  const monatGewaehlt = () => $('ag-mb-monat').value.split('-').map(Number);
  function monatsblatt() {
    const MB = window.Monatsblatt;
    const stage = $('ag-mb-stage');
    if (!MB || !stage || !ready) return;
    const [jahr, monat] = monatGewaehlt();
    stage.innerHTML = MB.html(formData(), jahr, monat - 1, heiligen);
  }
  /* Eingabefelder des gewaehlten Monats: je Woche das Ewige Licht, je Termin die Angaben */
  function editor() {
    const host = $('ag-mb-edit');
    const AD = window.AspersdorfDaten;
    if (!host || !AD || !ready) return;
    const [jahr, monat] = monatGewaehlt();
    const von = AD.isoOf(new Date(jahr, monat - 1, 1));
    const bis = AD.isoOf(new Date(jahr, monat, 0));
    const its = AD.items(formData(), von, bis).filter((it) => !it.cancelled);
    if (!its.length) {
      host.innerHTML = '<p class="adm-muted">In diesem Monat gibt es noch keine Termine. Oben regelmäßige Gottesdienste oder besondere Termine eintragen.</p>';
      return;
    }
    const wochen = [];
    for (const it of its) {
      const so = AD.sonntagVon(it.date);
      if (!wochen.length || wochen[wochen.length - 1].so !== so) wochen.push({ so, its: [] });
      wochen[wochen.length - 1].its.push(it);
    }
    const kurzDatum = (iso) => {
      const d = HD.dateFromIso(iso);
      return `${HD.WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`;
    };
    const offen = new Set([...host.querySelectorAll('details[open]')].map((x) => x.dataset.key));
    host.innerHTML = wochen.map((wo) => {
      const so = HD.dateFromIso(wo.so);
      return '<div class="ag-mb-week">' +
        `<h3>Woche mit Sonntag, ${so.getDate()}. ${esc(HD.MONTHS[so.getMonth()])}</h3>` +
        `<label class="ag-mb-licht"><span>Ewiges Licht gespendet von</span><input class="adm-input" type="text" maxlength="120" data-licht="${wo.so}" placeholder="leer = „kann noch übernommen werden“" value="${esc(licht[wo.so] || '')}"/></label>` +
        wo.its.map((it) => {
          const d = details[it.key] || {};
          const voll = FELDER.some(([k]) => d[k]);
          return `<details class="ag-mb-it" data-key="${esc(it.key)}"${offen.has(it.key) ? ' open' : ''}><summary><b>${esc(kurzDatum(it.date))} ${esc(it.time || '')}</b><span>${esc(it.title)}</span><span class="ag-mb-ok">${voll ? 'Angaben ✓' : 'Angaben ergänzen'}</span></summary>` +
            '<div class="ag-mb-fields">' + FELDER.map(([k, label, ph, full]) =>
              `<label class="${full ? 'full' : ''}">${esc(label)}<input class="adm-input" type="text" maxlength="200" data-detail="${esc(it.key)}" data-f="${k}" placeholder="${esc(ph || '')}" value="${esc(d[k] || '')}"/></label>`).join('') +
            '</div></details>';
        }).join('') + '</div>';
    }).join('');
  }
  function onDetail(el) {
    const v = clean(el.value);
    if (el.dataset.licht) {
      if (v) licht[el.dataset.licht] = v;
      else delete licht[el.dataset.licht];
      return;
    }
    const k = el.dataset.detail;
    const d = { ...(details[k] || {}) };
    if (v) d[el.dataset.f] = v;
    else delete d[el.dataset.f];
    if (Object.keys(d).length) details[k] = d;
    else delete details[k];
    const ok = el.closest('details').querySelector('.ag-mb-ok');
    if (ok) ok.textContent = details[k] ? 'Angaben ✓' : 'Angaben ergänzen';
  }
  function fillMonate() {
    const sel = $('ag-mb-monat');
    if (!sel) return;
    const d = new Date();
    const opts = [];
    for (let i = -1; i <= 12; i++) {
      const m = new Date(d.getFullYear(), d.getMonth() + i, 1);
      opts.push(`<option value="${m.getFullYear()}-${HD.pad(m.getMonth() + 1)}"${i === (d.getDate() > 15 ? 1 : 0) ? ' selected' : ''}>${HD.MONTHS[m.getMonth()]} ${m.getFullYear()}</option>`);
    }
    sel.innerHTML = opts.join('');
  }
  /* Word-Datei des Monats (Name wie bisher: Gottesdienst-Ordnung_+_Termine_Aspersdorf_JJJJ-MM.docx) */
  async function word() {
    const MB = window.Monatsblatt;
    if (!MB || !ready) return;
    const [jahr, monat] = monatGewaehlt();
    let blob = null;
    try {
      blob = await MB.toWord(formData(), jahr, monat - 1, heiligen);
    } catch (err) {
      A.toast(`Die Word-Datei konnte nicht erstellt werden: ${err.message}`, 'err');
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Gottesdienst-Ordnung_+_Termine_Aspersdorf_${$('ag-mb-monat').value}.docx`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  /* Nur das Blatt drucken: Kopie direkt im body, alles andere ausgeblendet (css/monatsblatt.css) */
  function drucken() {
    monatsblatt();
    const blatt = $('ag-mb-stage').querySelector('.mb-blatt');
    if (!blatt) return;
    const host = document.createElement('div');
    host.className = 'mb-print-host';
    host.hidden = true;
    host.append(blatt.cloneNode(true));
    document.body.append(host);
    document.body.classList.add('mb-druck');
    const titel = document.title;
    document.title = `Gottesdienst-Ordnung + Termine Aspersdorf ${$('ag-mb-monat').value}`;
    const fertig = () => {
      document.body.classList.remove('mb-druck');
      host.remove();
      document.title = titel;
      window.removeEventListener('afterprint', fertig);
    };
    window.addEventListener('afterprint', fertig);
    window.print();
    setTimeout(() => {
      if (host.isConnected && !matchMedia('print').matches) fertig();
    }, 1500);
  }

  const state = () => JSON.stringify([details, licht]);
  function showState() {
    $('mb-state').textContent = ready && state() !== snap ? 'Noch nicht gespeichert' : '';
  }

  async function load() {
    ready = false;
    try {
      daten = (await A.readJSON(PATH)) || {};
    } catch (e) {
      if (!(e && (e.status === 404 || e.name === 'NotFoundError'))) {
        $('ag-mb-edit').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Datei <code>${PATH}</code> konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
        return;
      }
      /* Datei gibt es noch nicht: die Gottesdienste, wie sie auf der Website stehen (wie unter Gottesdienste & Termine) */
      daten = { regelmaessig: VORGABE, termine: [] };
    }
    details = daten.details && typeof daten.details === 'object' ? { ...daten.details } : {};
    licht = daten.licht && typeof daten.licht === 'object' ? { ...daten.licht } : {};
    snap = state();
    ready = true;
    showState();
    editor();
    monatsblatt();
  }

  async function save(ev) {
    ev.preventDefault();
    if (!ready) return;
    const btn = $('mb-save');
    btn.disabled = true;
    try {
      /* die Datei, wie sie jetzt ist (Gottesdienste & Termine koennen inzwischen geaendert sein) */
      let jetzt = {};
      try {
        jetzt = (await A.readJSON(PATH)) || {};
      } catch { /* gibt es noch nicht */ }
      const next = Object.keys(jetzt).length ? { ...jetzt } : { regelmaessig: VORGABE, termine: [] };
      delete next.details;
      delete next.licht;
      if (Object.keys(details).length) next.details = details;
      if (Object.keys(licht).length) next.licht = licht;
      const direct = await A.saveFile(PATH, JSON.stringify(next, null, 2) + '\n');
      daten = next;
      snap = state();
      showState();
      A.toast(direct ? 'Monatsblatt gespeichert.' : 'Übernommen. Bitte unten die Datei herunterladen.');
      A.log(`Aspersdorf: Monatsblatt ${$('ag-mb-monat').selectedOptions[0].textContent} geändert`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  A.start(async () => {
    fillMonate();
    $('ag-mb-monat').addEventListener('change', () => { editor(); monatsblatt(); });
    $('ag-mb-druck').addEventListener('click', drucken);
    $('ag-mb-word').addEventListener('click', word);
    let timer = 0;
    $('mb-form').addEventListener('input', (ev) => {
      const fld = ev.target.closest('[data-detail], [data-licht]');
      if (!fld) return;
      onDetail(fld);
      showState();
      clearTimeout(timer);
      timer = setTimeout(monatsblatt, 300);
    });
    $('mb-form').addEventListener('submit', save);
    A.guard(() => ready && state() !== snap);
    A.folder.on((s) => { if (s === 'ok') load(); });
    const KD = window.KalenderDaten;
    if (KD && KD.ladeHeilige) KD.ladeHeilige('../').then((h) => { heiligen = h; monatsblatt(); }).catch(() => {});
    await load();
  });
})();
