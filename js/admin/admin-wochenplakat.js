/* ============================================================
   Augustinerkirche Wien — admin-wochenplakat.js
   Werkzeug "Plakat für den Wochenkalender" (admin/wochenplakat.html): eine Woche aus der Liste
   waehlen, das Plakat sehen (js/admin/wochenplakat.js), als PDF, Word oder PNG herunterladen, laden oder als
   "Bild der Woche" uebernehmen (data/wochenkalender.json, "wochen"; Bilder in assets/img/wochenkalender/).
   Das Plakat selbst wird nicht gespeichert.
   Benoetigt js/gemeinsam/hochaemter-data.js, kalender-daten.js, js/admin/admin.js und wochenplakat.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const KD = window.KalenderDaten;
  const WP = window.WochenPlakat;
  const { HD, $, esc } = A;
  const PATH = 'data/wochenkalender.json';
  const IMG_DIR = 'assets/img/wochenkalender/';
  const BACK = 4;
  const AHEAD = 52;

  let items = [];
  let poster = null;
  const DEF = { main: '#1a1680', accent: '#e03c1e' };
  /* Farben des Kirchenjahres: Weiß/Gold (Weihnachten, Ostern), Rot (Pfingsten, Märtyrer), Grün (Jahreskreis), Violett (Advent, Fastenzeit), Rosa (Gaudete, Laetare), Blau (Marienfeste) */
  const MAIN = [['#1a1680', 'Augustinerblau'], ['#1b2a4a', 'Marine'], ['#4a2370', 'Dunkelviolett (Advent, Fastenzeit)'], ['#1f3b2d', 'Tannengrün (Jahreskreis)'], ['#6e1f2b', 'Bordeaux'], ['#8a6a14', 'Dunkelgold (Weihnachten, Ostern)'], ['#9c1c1c', 'Dunkelrot (Pfingsten, Märtyrer)'], ['#10192e', 'Dunkelblau'], ['#0f5257', 'Petrol'], ['#5a3a22', 'Braun'], ['#2f2f35', 'Anthrazit'], ['#4b1d3f', 'Aubergine'], ['#111111', 'Schwarz']];
  const ACCENT = [['#e03c1e', 'Rot (Pfingsten, Märtyrer)'], ['#c9a24d', 'Gold (Weihnachten, Ostern)'], ['#6a2c91', 'Violett (Advent, Fastenzeit)'], ['#2e7d4f', 'Grün (Jahreskreis)'], ['#d9638b', 'Rosa (Gaudete, Laetare)'], ['#2f6fb5', 'Blau (Marienfeste)'], ['#e07a1e', 'Orange'], ['#a8324a', 'Weinrot'], ['#c0287a', 'Magenta'], ['#1a8a8a', 'Türkis'], ['#6e1f2b', 'Bordeaux'], ['#1a1680', 'Augustinerblau'], ['#7a7a82', 'Grau'], ['#111111', 'Schwarz']];
  const colors = () => ({ main: $('wp-c1').value, accent: $('wp-c2').value });

  const addDays = (dt, n) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n);
  const mondayOf = (dt) => addDays(dt, -((dt.getDay() + 6) % 7));
  const iso = A.isoOf;
  function weekNo(mon) {
    const thu = addDays(mon, 3);
    return 1 + Math.round((thu - mondayOf(new Date(thu.getFullYear(), 0, 4))) / 604800000);
  }
  function range(mon) {
    const sun = addDays(mon, 6);
    const st = addDays(mon, -1);   /* Woche von Sonntag bis Sonntag */
    const m = HD.MONTHS;
    return st.getMonth() === sun.getMonth()
      ? `${st.getDate()}.–${sun.getDate()}. ${m[sun.getMonth()]} ${sun.getFullYear()}`
      : `${st.getDate()}. ${m[st.getMonth()]} – ${sun.getDate()}. ${m[sun.getMonth()]} ${sun.getFullYear()}`;
  }
  const monday = () => HD.dateFromIso($('wp-select').value);

  function fillSelect() {
    const now = new Date();
    /* Sonntags ist die naechste Woche gemeint (der Aushang entsteht am Sonntag davor) */
    const cur = mondayOf(now.getDay() === 0 ? addDays(now, 1) : now);
    let html = '';
    for (let i = -BACK; i <= AHEAD; i++) {
      const mon = addDays(cur, i * 7);
      html += `<option value="${iso(mon)}">KW ${weekNo(mon)} · ${esc(range(mon))}${i === 0 ? ' (diese Woche)' : i === 1 ? ' (nächste Woche)' : ''}</option>`;
    }
    $('wp-select').innerHTML = html;
    $('wp-select').value = iso(cur);
  }

  async function show() {
    await WP.prepare(colors().main);
    const stage = $('wp-stage');
    $('wp-panel').hidden = false;
    stage.innerHTML = WP.build(monday(), items, { sonntag: $('wp-sun').checked, colors: colors() });
    poster = stage.firstElementChild;
    const s = WP.fit(poster);
    $('wp-fit').textContent = s < 1 ? `Es sind viele Termine: die Schrift wurde auf ${Math.round(s * 100)} % verkleinert.` : '';
    const k = Math.min(1, ($('wp-wrap').clientWidth || WP.W) / WP.W);
    stage.style.transform = `scale(${k})`;
    $('wp-wrap').style.height = `${Math.round(WP.H * k)}px`;
  }

  async function png(scale) {
    try {
      return await WP.toPng(poster, scale);
    } catch (err) {
      A.toast(`Das Bild konnte nicht erstellt werden: ${err.message}. Bitte später noch einmal versuchen.`, 'err');
      return null;
    }
  }
  async function download(kind) {
    let blob = null;
    try {
      blob = kind === 'pdf' ? await WP.toPdf(poster) : kind === 'word' ? await WP.toWord(monday(), items, { sonntag: $('wp-sun').checked, colors: colors() }) : await png(2);
    } catch (err) {
      A.toast(`Die Datei konnte nicht erstellt werden: ${err.message}`, 'err');
    }
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `wochenkalender-${$('wp-select').value}.${{ pdf: 'pdf', word: 'docx', png: 'png' }[kind]}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* Als Bild der Woche speichern: ersetzt ein vorhandenes Bild dieser Woche */
  async function take() {
    const m = $('wp-select').value;
    const blob = await png(1.45);
    if (!blob) return;
    try {
      const data = await A.readJSON(PATH);
      if (!data || !Array.isArray(data.tage)) throw new Error('Der Wochenkalender konnte nicht gelesen werden');
      const wochen = Array.isArray(data.wochen) ? data.wochen : [];
      const old = wochen.find((x) => x && x.montag === m);
      if (old) {
        const ok = await A.confirmBox({
          title: 'Bild der Woche ersetzen?',
          html: `Für die Woche ab <strong>${esc(A.fmtShort(m))}</strong> gibt es schon ein Bild. Es wird durch das Plakat ersetzt.`,
          ok: 'Ersetzen'
        });
        if (!ok) return;
      }
      const conv = await A.toWebp(new File([blob], `wochenkalender-${m}.png`, { type: 'image/png' }), { maxSize: 1600, quality: 0.86 });
      const bmp = await createImageBitmap(conv.blob);
      let path = `${IMG_DIR}${m}.${conv.ext}`;
      for (let n = 2; (old && old.bild === path) || (A.folder.state === 'ok' && await A.folder.exists(path)); n++) path = `${IMG_DIR}${m}-${n}.${conv.ext}`;
      await A.saveFile(path, conv.blob);
      const entry = { montag: m, bild: path, breite: bmp.width, hoehe: bmp.height };
      const next = wochen.filter((x) => x && x.montag !== m).concat(entry).sort((a, b) => a.montag.localeCompare(b.montag));
      const direct = await A.saveJSON(PATH, { ...data, wochen: next });
      if (old && old.bild !== path) await A.media.remove([old.bild]);
      const note = `Bild der Woche ab ${A.fmtShort(m)} gespeichert (Plakat).`;
      A.toast(direct ? note : `${note} Bitte unten die Datei herunterladen.`);
      A.log(note);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  A.start(async () => {
    fillSelect();
    try {
      KD.refresh('../');
      items = await KD.load('../', { all: true });
    } catch (e) {
      $('wp-select').innerHTML = '<option value="">Die Termine konnten nicht geladen werden</option>';
      return;
    }
    $('wp-select').addEventListener('change', show);
    try { const v = localStorage.getItem('wp-sonntag'); if (v !== null) $('wp-sun').checked = v === '1'; } catch { /* Standard */ }
    $('wp-sun').addEventListener('change', () => { try { localStorage.setItem('wp-sonntag', $('wp-sun').checked ? '1' : '0'); } catch { /* egal */ } show(); });
    try { const c = JSON.parse(localStorage.getItem('wp-farben') || 'null'); if (c) { $('wp-c1').value = c.main; $('wp-c2').value = c.accent; } } catch { /* Standard */ }
    const mark = () => [['wp-sw1', 'wp-c1'], ['wp-sw2', 'wp-c2']].forEach(([b, i]) => document.querySelectorAll(`#${b} .ds-swatch`).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.farbe === $(i).value.toLowerCase()))));
    const colorChanged = () => { mark(); save(); };
    [['wp-sw1', 'wp-c1', MAIN], ['wp-sw2', 'wp-c2', ACCENT]].forEach(([b, i, list]) => {
      $(b).innerHTML = list.map(([hex, name]) => `<button type="button" class="ds-swatch" data-farbe="${hex}" aria-pressed="false" title="${name}" style="--c:${hex}"><span class="visually-hidden">${name}</span></button>`).join('');
      $(b).addEventListener('click', (e) => { const x = e.target.closest('.ds-swatch'); if (x) { $(i).value = x.dataset.farbe; colorChanged(); } });
    });
    const save = () => { try { localStorage.setItem('wp-farben', JSON.stringify(colors())); } catch { /* egal */ } show(); };
    mark();
    $('wp-c1').addEventListener('input', colorChanged);
    $('wp-c2').addEventListener('input', colorChanged);
    $('wp-creset').addEventListener('click', () => { $('wp-c1').value = DEF.main; $('wp-c2').value = DEF.accent; colorChanged(); });
    $('wp-pdf').addEventListener('click', () => download('pdf'));
    $('wp-word').addEventListener('click', () => download('word'));
    $('wp-png').addEventListener('click', () => download('png'));
    $('wp-take').addEventListener('click', take);
    A.folder.on((state) => { if (state === 'ok') KD.refresh('../'); });
    show();
  });
})();
