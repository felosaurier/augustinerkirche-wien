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

  const addDays = (dt, n) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n);
  const mondayOf = (dt) => addDays(dt, -((dt.getDay() + 6) % 7));
  const iso = A.isoOf;
  function weekNo(mon) {
    const thu = addDays(mon, 3);
    return 1 + Math.round((thu - mondayOf(new Date(thu.getFullYear(), 0, 4))) / 604800000);
  }
  function range(mon) {
    const sun = addDays(mon, 6);
    const m = HD.MONTHS;
    return mon.getMonth() === sun.getMonth()
      ? `${mon.getDate()}.–${sun.getDate()}. ${m[sun.getMonth()]} ${sun.getFullYear()}`
      : `${mon.getDate()}. ${m[mon.getMonth()]} – ${sun.getDate()}. ${m[sun.getMonth()]} ${sun.getFullYear()}`;
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
    await WP.prepare();
    const stage = $('wp-stage');
    $('wp-panel').hidden = false;
    stage.innerHTML = WP.build(monday(), items, { sonntag: $('wp-sun').checked });
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
      blob = kind === 'pdf' ? await WP.toPdf(poster) : kind === 'word' ? await WP.toWord(monday(), items, { sonntag: $('wp-sun').checked }) : await png(2);
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
    $('wp-sun').addEventListener('change', show);
    $('wp-pdf').addEventListener('click', () => download('pdf'));
    $('wp-word').addEventListener('click', () => download('word'));
    $('wp-png').addEventListener('click', () => download('png'));
    $('wp-take').addEventListener('click', take);
    A.folder.on((state) => { if (state === 'ok') KD.refresh('../'); });
    show();
  });
})();
