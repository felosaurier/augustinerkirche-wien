/* ============================================================
   Augustinerkirche Wien — aspersdorf-daten.js
   Termine der Pfarre Aspersdorf fuer Wochenkalender, Monat und Monatsblatt.
   Quelle: data/aspersdorf-gottesdienste.json (Verwaltung → Aspersdorf: Gottesdienste & Termine)
     {regelmaessig: [{tag, zeit, name, hinweis, rhythmus, pause}],
      termine: [{datum, zeit, name, hinweis, art}]}
   - tag: so, mo, di, mi, do, fr, sa
   - rhythmus: ''  = jede Woche; '1'..'5' = der wievielte Wochentag im Monat, mehrere mit Komma
               ('1,3' = 1. und 3.); 'L' = der letzte im Monat; 'aus' = nicht automatisch im Kalender
               (steht nur in der Liste; einzelne Tage als besondere Termine eintragen)
   - pause: Monate ohne diesen Gottesdienst, z. B. [7, 8] fuer Juli und August
   - details: {"JJJJ-MM-TT HH:MM Bezeichnung": {fuer, lk, kh, mini, l1, l2, ev, zusatz, rechts}}: Angaben
     eines Termins fuers Monatsblatt (Intention, Lektoren, Kommunionhelfer, Ministranten, Lesungen,
     fette Zeile darunter, eigene Bezeichnung rechts statt Kirchenjahr/Heiliger)
   - licht: {"JJJJ-MM-TT" (Sonntag der Woche): "Frau …"}: wer das Ewige Licht der Woche spendet
   - art: '' = besonderer Termin; 'entfaellt' = ein regelmaessiger Gottesdienst faellt aus (bleibt
     durchgestrichen stehen, der Hinweis ist der Grund). Mit Uhrzeit: der Gottesdienst um diese Zeit;
     ohne Uhrzeit: der mit derselben Bezeichnung, sonst alle dieses Tages.
   Liefert Termine im Format von js/gemeinsam/kalender-daten.js (date, time, title, sub, group …),
   damit Darstellung und Gestaltung dieselben sind wie im Kalender der Augustinerkirche.
   Benoetigt js/gemeinsam/hochaemter-data.js.
   ============================================================ */
(function (w) {
  'use strict';

  const HD = w.HochamtData;
  if (!HD) return;
  const TAGE = ['so', 'mo', 'di', 'mi', 'do', 'fr', 'sa'];
  const pad = (n) => String(n).padStart(2, '0');
  const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

  /* Monate einer Pause: [7, 8] oder "7,8" */
  const pauseOf = (t) => (Array.isArray(t.pause) ? t.pause : String(t.pause || '').split(','))
    .map(Number).filter((m) => m >= 1 && m <= 12);

  /* Findet der regelmaessige Gottesdienst t am Tag d statt? */
  function passt(t, d) {
    const r = clean(t.rhythmus);
    if (r === 'aus') return false;
    if (pauseOf(t).includes(d.getMonth() + 1)) return false;
    if (!r) return true;
    const n = Math.floor((d.getDate() - 1) / 7) + 1;
    const letzter = d.getDate() + 7 > new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return r.split(',').some((x) => (x.trim() === 'L' ? letzter : Number(x) === n));
  }

  /* Rhythmus in Worten fuer die Liste: "1. und 3. im Monat", "nicht im Juli und August" */
  function rhythmusText(t) {
    const teile = [];
    const r = clean(t.rhythmus);
    if (r && r !== 'aus') {
      const n = r.split(',').map((x) => (x.trim() === 'L' ? 'letzten' : `${x.trim()}.`));
      teile.push(`am ${n.length > 1 ? `${n.slice(0, -1).join(', ')} und ${n[n.length - 1]}` : n[0]} im Monat`);
    }
    const p = pauseOf(t);
    if (p.length) {
      const m = p.map((x) => HD.MONTHS[x - 1]);
      teile.push(`nicht im ${m.length > 1 ? `${m.slice(0, -1).join(', ')} und ${m[m.length - 1]}` : m[0]}`);
    }
    return teile.join(', ');
  }

  const regelOf = (data) => (Array.isArray(data && data.regelmaessig) ? data.regelmaessig : [])
    .filter((t) => t && clean(t.name) && TAGE.includes(t.tag));
  const termineOf = (data) => (Array.isArray(data && data.termine) ? data.termine : [])
    .filter((t) => t && clean(t.name) && HD.isoDate(t.datum));

  /* Alle Termine von "von" bis "bis" (JJJJ-MM-TT, beide eingeschlossen), nach Tag und Uhrzeit */
  function items(data, von, bis) {
    const out = [];
    const regel = regelOf(data);
    const start = HD.dateFromIso(von);
    for (let d = start; isoOf(d) <= bis; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const iso = isoOf(d);
      for (const t of regel) {
        if (TAGE[d.getDay()] !== t.tag || !passt(t, d)) continue;
        out.push({ date: iso, time: HD.isoTime(t.zeit) || '', title: clean(t.name), sub: clean(t.hinweis), group: 'gottesdienst', art: 'Gottesdienst', regel: true });
      }
    }
    const termine = termineOf(data).filter((t) => t.datum >= von && t.datum <= bis);
    /* zuerst die Ausfaelle, damit sie nur regelmaessige Gottesdienste treffen */
    for (const t of termine.filter((x) => x.art === 'entfaellt')) {
      const zeit = HD.isoTime(t.zeit) || '';
      const amTag = out.filter((it) => it.regel && it.date === t.datum);
      const gleich = amTag.filter((it) => it.title.toLowerCase() === clean(t.name).toLowerCase());
      const treffer = zeit ? amTag.filter((it) => it.time === zeit) : gleich.length ? gleich : amTag;
      for (const it of treffer) {
        it.cancelled = true;
        it.why = clean(t.hinweis);
      }
    }
    for (const t of termine.filter((x) => x.art !== 'entfaellt')) {
      out.push({ date: t.datum, time: HD.isoTime(t.zeit) || '', title: clean(t.name), sub: clean(t.hinweis), group: 'veranstaltung', art: 'Besonderer Termin' });
    }
    out.sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')));
    for (const it of out) it.key = keyOf(it);
    return out;
  }

  /* Schluessel eines Termins fuer seine Angaben im Monatsblatt ("details"): Tag, Uhrzeit, Bezeichnung */
  const keyOf = (it) => `${it.date} ${it.time || '--:--'} ${it.title}`;
  /* Woche des Monatsblatts (fuer "Das Ewige Licht"): von Samstag (Vorabend) bis Freitag, benannt
     nach ihrem Sonntag. Sonntag -> derselbe Tag, Samstag -> der Sonntag danach, sonst der Sonntag davor */
  function sonntagVon(iso) {
    const d = HD.dateFromIso(iso);
    const n = d.getDay() === 6 ? 1 : -d.getDay();
    return isoOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
  }
  /* Vorabendmesse: Samstag ab 16 Uhr, eine Messe */
  const isVA = (it) => HD.dateFromIso(it.date).getDay() === 6 && (it.time || '') >= '16:00' && /messe/i.test(it.title);

  async function load(base = '') {
    try {
      const r = await fetch(`${base}data/aspersdorf-gottesdienste.json`, { cache: 'no-cache' });
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  }

  w.AspersdorfDaten = { TAGE, isoOf, passt, rhythmusText, items, load, regelOf, termineOf, keyOf, sonntagVon, isVA };
})(window);
