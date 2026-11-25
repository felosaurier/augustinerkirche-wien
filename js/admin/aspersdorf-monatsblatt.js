/* ============================================================
   Augustinerkirche Wien — aspersdorf-monatsblatt.js
   Monatsblatt "Gottesdienste & Termine der Pfarre St. Georg" (A5 hoch) nach der Vorlage
   der Pfarre (Gottesdienst-Ordnung_+_Termine_Aspersdorf_2026-11.docx): Kopf mit Monat,
   Kontakt und Logo des Pfarrverbands; je Woche (Samstag bis Freitag) "Das Ewige Licht für
   diese Woche …" mit Kerze; je Tag Wochentag, Datum, Uhrzeit, Bezeichnung (Vorabendmesse mit
   "(VA)"), rechts das Kirchenjahr bzw. der Heilige des Tages; darunter Intention ("für …"),
   LK, KH, Ministranten und die Lesungen L1, L2, Ev und eine fette Zusatzzeile. Am 1. Advent
   das Band "Beginn des Kirchenjahres". Ausgefallene Gottesdienste stehen nicht auf dem Blatt.
   - Monatsblatt.html(data, jahr, monat, heiligen): das Blatt als HTML (Vorschau in der
     Verwaltung; Drucken bzw. "Als PDF speichern" druckt nur das Blatt, css/monatsblatt.css)
   - Monatsblatt.toWord(data, jahr, monat, heiligen): dasselbe als Word-Datei (.docx, A5, mit
     Tabstopps wie in der Vorlage, zum Weiterbearbeiten) als Blob
   Beide aus model(), damit Vorschau, PDF und Word gleich sind.
   Benoetigt js/gemeinsam/hochaemter-data.js, js/gemeinsam/kalender-daten.js (Kirchenjahr,
   Heilige) und js/gemeinsam/aspersdorf-daten.js.
   ============================================================ */
(function (w) {
  'use strict';

  const HD = w.HochamtData;
  const KD = w.KalenderDaten;
  const AD = w.AspersdorfDaten;
  if (!HD || !AD) return;
  const { esc, MONTHS } = HD;
  const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const IMG = '../assets/img/aspersdorf/monatsblatt/';
  const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  /* "08:30" -> "8:30 Uhr" */
  const uhr = (t) => (t ? `${t.replace(/^0/, '')} Uhr` : '');
  /* "Heilige Messe" wie in der Vorlage als "Hl. Messe" */
  const kurz = (s) => clean(s).replace(/^Heilige Messe/i, 'Hl. Messe').replace(/^Vorabendmesse$/i, 'Hl. Messe');

  /* Rechts beim ersten Termin des Tages: eigene Angabe ("Hl. Martin | Bischof von Tours", "-" = nichts),
     sonst Kirchenjahr, sonst der erste Heilige (nur an Tagen mit Messe); am Samstagabend der Sonntag */
  function rechtsVon(iso, it, d, heiligen, messeAm) {
    if (clean(d.rechts) === '-') return [];
    if (clean(d.rechts)) return clean(d.rechts).split(/\s*\|\s*/);
    if (!KD) return [];
    const tag = AD.isVA(it) ? AD.sonntagVon(iso) : iso;
    const kj = KD.tagAm ? KD.tagAm(tag, heiligen).replace(/ · Lesejahr .*$/, '') : '';
    if (kj) return [kj];
    if (!messeAm) return [];
    const h = KD.heiligeAuto ? KD.heiligeAuto(tag, heiligen) : [];
    return h.length ? [h[0]] : [];
  }

  /* Inhalt des Blatts: {titel, wochen: [{band: [..], licht, tage: [{wt, dat, fett, its: [...]}]}]} */
  function model(data, jahr, monat, heiligen) {
    data = data || {};
    const details = data.details || {};
    const von = AD.isoOf(new Date(jahr, monat, 1));
    const bis = AD.isoOf(new Date(jahr, monat + 1, 0));
    const its = AD.items(data, von, bis).filter((it) => !it.cancelled);
    const wochen = [];
    for (const it of its) {
      const so = AD.sonntagVon(it.date);
      let wo = wochen[wochen.length - 1];
      if (!wo || wo.so !== so) wochen.push(wo = { so, tage: [] });
      let tag = wo.tage[wo.tage.length - 1];
      if (!tag || tag.iso !== it.date) wo.tage.push(tag = { iso: it.date, roh: [] });
      tag.roh.push(it);
    }
    for (const wo of wochen) {
      wo.band = [];
      if (KD && KD.kirchenjahr && KD.kirchenjahr(wo.so, true) === '1. Adventsonntag') {
        const y = Number(wo.so.slice(0, 4));
        wo.band = [`Beginn des Kirchenjahres ${y}/${y + 1}`, ...(KD.lesejahr ? [`Lesejahr ${KD.lesejahr(wo.so)}`] : [])];
      }
      const wer = clean((data.licht || {})[wo.so]);
      /* Woche, die im Vormonat beginnt: das Ewige Licht steht schon auf dessen Blatt */
      wo.licht = wo.so < von ? [] : ['Das Ewige Licht für diese Woche', wer ? `wird gespendet von ${wer}` : 'kann noch übernommen werden'];
      for (const tag of wo.tage) {
        const dt = HD.dateFromIso(tag.iso);
        const messeAm = tag.roh.some((it) => /messe/i.test(it.title));
        tag.wt = `${WT[dt.getDay()]},`;
        tag.dat = `${dt.getDate()}.${dt.getMonth() + 1}.`;
        tag.fett = dt.getDay() === 0 || tag.roh.some((it) => AD.isVA(it)) || !!(KD && KD.tagAm && KD.tagAm(tag.iso, heiligen));
        /* Kirchenjahr bzw. Heiliger rechts: beim ersten Termin, an Samstagen mit Vorabendmesse bei der Messe */
        const va = tag.roh.findIndex((it) => AD.isVA(it));
        const rechtsBei = va >= 0 ? va : 0;
        tag.its = tag.roh.map((it, i) => {
          const d = details[it.key] || {};
          const messe = /messe/i.test(it.title);
          return {
            zeit: uhr(it.time),
            /* "Hl. Messe | Adventkranz-Segnung": (VA) gehoert hinter den ersten Teil, wie in der Vorlage */
            titel: kurz(it.title).split(' | ')[0],
            nach: kurz(it.title).split(' | ').slice(1).map((t) => ` | ${t}`).join(''),
            fett: tag.fett && messe,
            va: AD.isVA(it),
            rechts: i === rechtsBei ? rechtsVon(tag.iso, it, d, heiligen, messeAm) : (clean(d.rechts) && clean(d.rechts) !== '-' ? clean(d.rechts).split(/\s*\|\s*/) : []),
            sub: clean(it.sub) && !it.regel ? clean(it.sub) : '',
            fuer: clean(d.fuer) ? `für ${clean(d.fuer).replace(/^für\s+/i, '')}` : '',
            links: [messe || d.lk ? ['LK', clean(d.lk)] : null, d.kh ? ['KH', clean(d.kh)] : null, d.mini ? ['Ministrant/inn/en', clean(d.mini)] : null].filter(Boolean),
            lesung: [d.l1 ? ['L1', clean(d.l1)] : null, d.l2 ? ['L2', clean(d.l2)] : null, d.ev ? ['Ev', clean(d.ev)] : null].filter(Boolean),
            zusatz: clean(d.zusatz),
            rechtsKlein: ''
          };
        });
        /* Zweite Zeile rechts ("Ordensfrau, Kirchenlehrerin") wie in der Vorlage neben dem naechsten Termin des Tages */
        tag.its.forEach((x, i) => {
          const n = tag.its[i + 1];
          if (x.rechts.length > 1 && n && !n.rechts.length) {
            n.rechtsKlein = x.rechts.slice(1).join(' ');
            x.rechts = x.rechts.slice(0, 1);
          }
        });
      }
    }
    return { titel: `${MONTHS[monat]} ${jahr}`, wochen };
  }

  /* ---------- HTML (Vorschau, Drucken, PDF) ---------- */
  function itemHTML(x) {
    const zeile = ([k, v]) => `<div><span class="mb-lab">${k}:</span> ${esc(v)}</div>`;
    return '<div class="mb-it">' +
      `<div class="mb-z">${esc(x.zeit)}</div>` +
      '<div class="mb-was">' +
        `<div class="mb-kopfzeile"><span class="mb-n">${x.fett ? `<b>${esc(x.titel)}</b>` : esc(x.titel)}${x.va ? ' (VA)' : ''}${x.nach ? (x.fett ? `<b>${esc(x.nach)}</b>` : esc(x.nach)) : ''}</span>` +
          `${x.rechts.length ? `<span class="mb-r"><b>${esc(x.rechts[0])}</b>${x.rechts[1] ? `<br>${esc(x.rechts[1])}` : ''}</span>` : x.rechtsKlein ? `<span class="mb-r">${esc(x.rechtsKlein)}</span>` : ''}</div>` +
        (x.sub ? `<div class="mb-h">${esc(x.sub)}</div>` : '') +
        (x.fuer ? `<div class="mb-fuer">${esc(x.fuer)}</div>` : '') +
        (x.links.length || x.lesung.length ? `<div class="mb-dienste"><div>${x.links.map(zeile).join('')}</div><div>${x.lesung.map(zeile).join('')}</div></div>` : '') +
        (x.zusatz ? `<div class="mb-zusatz">${esc(x.zusatz)}</div>` : '') +
      '</div></div>';
  }

  function html(data, jahr, monat, heiligen) {
    const m = model(data, jahr, monat, heiligen);
    const body = m.wochen.map((wo) =>
      (wo.band.length ? `<div class="mb-band">${wo.band.map(esc).join('<br>')}</div>` : '') +
      (wo.licht.length ? `<div class="mb-licht"><span>${wo.licht.map(esc).join('<br>')}</span><img src="${IMG}kerze.png" alt="" width="9" height="24"/></div>` : '') +
      wo.tage.map((tag) => `<div class="mb-tag${tag.fett ? ' mb-fett' : ''}">` +
        `<div class="mb-wt">${tag.wt}</div><div class="mb-dat">${tag.dat}</div>` +
        `<div class="mb-its">${tag.its.map(itemHTML).join('')}</div></div>`).join('')).join('');
    return '<div class="mb-blatt">' +
      '<div class="mb-kopf"><div class="mb-kopf-l">' +
        '<div class="mb-titel"><b>Gottesdienste</b> &amp; <b>Termine</b><br><b>der Pfarre St</b>. <b>Georg</b></div>' +
        `<div class="mb-monat">${esc(m.titel)}</div>` +
        '<div class="mb-kontakt">T: 0 29 52 / 30 1 98<br>E: pfarre@aspersdorf.at | H: www.aspersdorf.at</div>' +
      `</div><img class="mb-logo" src="${IMG}pfarrverband-logo.png" alt="Aspersdorf · Pfarrverband Klein Maria Dreieichen" width="314" height="161"/></div>` +
      (body || '<p class="mb-leer">Für diesen Monat sind noch keine Termine eingetragen.</p>') +
      '<div class="mb-legende">LK: Lektor/en | KH: Kommunionhelfer/in | L1: 1. Lesung | L2: 2. Lesung | Ev: Evangelium | VA: Vorabendgottesdienst</div>' +
    '</div>';
  }

  /* ---------- Word (.docx, A5 wie die Vorlage) ---------- */
  /* Masse in Zwanzigstel Punkt: A5 8392 × 11907, Raender 567 / 454 wie in der Vorlage */
  const PAGE_W = 8392;
  const PAGE_H = 11907;
  const MAR_X = 567;
  const MAR_Y = 454;
  const TEXT_W = PAGE_W - 2 * MAR_X;           /* 7258 */
  const T_DAT = 1080;                          /* Datum endet hier (rechtsbuendig) */
  const T_ZEIT = 2050;                         /* Uhrzeit endet hier (rechtsbuendig) */
  const T_TEXT = 2180;                         /* Bezeichnung beginnt hier */
  const T_LES = 4750;                          /* Lesungen beginnen hier */
  const x = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rpr = ({ b, i, sz = 21, caps } = {}) => `<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>${b ? '<w:b/>' : ''}${i ? '<w:i/>' : ''}${caps ? '<w:caps/>' : ''}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>`;
  const run = (t, o) => (t ? `<w:r>${rpr(o)}<w:t xml:space="preserve">${x(t)}</w:t></w:r>` : '');
  const tab = (o) => `<w:r>${rpr(o)}<w:tab/></w:r>`;
  const br = (o) => `<w:r>${rpr(o)}<w:br/></w:r>`;
  const para = (inner, { jc, ind, hang, tabs, before = 0, after = 0, keep } = {}) =>
    `<w:p><w:pPr>${keep ? '<w:keepNext/><w:keepLines/>' : ''}${tabs ? `<w:tabs>${tabs}</w:tabs>` : ''}<w:spacing w:before="${before}" w:after="${after}" w:line="240" w:lineRule="auto"/>` +
    `${ind != null ? `<w:ind w:left="${ind}"${hang ? ` w:hanging="${hang}"` : ''}/>` : ''}${jc ? `<w:jc w:val="${jc}"/>` : ''}</w:pPr>${inner}</w:p>`;
  const TABS_KOPF = `<w:tab w:val="right" w:pos="${T_DAT}"/><w:tab w:val="right" w:pos="${T_ZEIT}"/><w:tab w:val="left" w:pos="${T_TEXT}"/><w:tab w:val="right" w:pos="${TEXT_W}"/>`;
  const TABS_DIENST = `<w:tab w:val="left" w:pos="${T_LES}"/>`;
  /* Bild im Text (Breite, Hoehe in EMU) */
  const bild = (rid, id, cx, cy, name) => `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="${name}"/>` +
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    `<pic:nvPicPr><pic:cNvPr id="${id}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;

  function documentXml(m, mitLogo, mitKerze) {
    let bildId = 10;
    const kopfL = para(run('Gottesdienste', { b: true, sz: 32 }) + run(' & ', { sz: 32 }) + run('Termine', { b: true, sz: 32 })) +
      para(run('der Pfarre St', { b: true, sz: 32 }) + run('. ', { sz: 32 }) + run('Georg', { b: true, sz: 32 }), { after: 120 }) +
      para(run(m.titel, { b: true, sz: 25 }), { after: 100 }) +
      para(run('T: 0 29 52 / 30 1 98', { sz: 15 })) +
      para(run('E: pfarre@aspersdorf.at | H: www.aspersdorf.at', { sz: 15 }));
    const none = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="nil"/>`).join('');
    const LOGO_W = 2700;
    const kopf = `<w:tbl><w:tblPr><w:tblW w:w="${TEXT_W}" w:type="dxa"/><w:tblBorders>${none}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
      `<w:tblGrid><w:gridCol w:w="${TEXT_W - LOGO_W}"/><w:gridCol w:w="${LOGO_W}"/></w:tblGrid><w:tr>` +
      `<w:tc><w:tcPr><w:tcW w:w="${TEXT_W - LOGO_W}" w:type="dxa"/></w:tcPr>${kopfL}</w:tc>` +
      `<w:tc><w:tcPr><w:tcW w:w="${LOGO_W}" w:type="dxa"/></w:tcPr>${para(mitLogo ? bild('rIdLogo', 1, 1656000, 849000, 'Logo Pfarrverband') : '', { jc: 'right' })}</w:tc></w:tr></w:tbl>`;
    const k = { sz: 21 };
    const body = m.wochen.map((wo) => {
      const band = wo.band.length
        ? para(wo.band.map((t, i) => (i ? br({ b: true, sz: 20 }) : '') + run(t, { b: true, sz: 20, caps: true })).join(''), { jc: 'center', before: 240, after: 60, keep: true })
        : '';
      /* "Das Ewige Licht …" rechtsbuendig in zwei Zeilen, die Kerze rechts daneben (wie in der Vorlage):
         eine kleine Tabelle ohne Rahmen am rechten Rand */
      const lichtText = !wo.licht.length ? '' : para(run(wo.licht[0], k) + br(k) + run(wo.licht[1], k), { jc: 'right', keep: true });
      const KERZE_W = 260;
      const licht = mitKerze && wo.licht.length
        ? `<w:tbl><w:tblPr><w:tblW w:w="${TEXT_W}" w:type="dxa"/><w:tblBorders>${none}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
          `<w:tblGrid><w:gridCol w:w="${TEXT_W - KERZE_W}"/><w:gridCol w:w="${KERZE_W}"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>` +
          `<w:tc><w:tcPr><w:tcW w:w="${TEXT_W - KERZE_W}" w:type="dxa"/><w:vAlign w:val="bottom"/></w:tcPr>${lichtText}</w:tc>` +
          `<w:tc><w:tcPr><w:tcW w:w="${KERZE_W}" w:type="dxa"/><w:vAlign w:val="bottom"/></w:tcPr>${para(bild('rIdKerze', ++bildId, 86400, 230400, 'Kerze'), { jc: 'right', keep: true })}</w:tc></w:tr></w:tbl>`
        : lichtText;
      const abstand = para('', { before: 0, after: 0, keep: true }).replace('<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>', '<w:spacing w:before="0" w:after="0" w:line="160" w:lineRule="exact"/>');
      /* Ein Tag bleibt auf einer Seite (alle Absaetze ausser dem letzten "mit dem naechsten zusammen") */
      const tage = wo.tage.map((tag) => tag.its.map((it, i) => {
        const o = { b: tag.fett, sz: 21 };
        const r0 = it.rechts[0] ? run(it.rechts[0], { b: true, sz: 19 }) : it.rechtsKlein ? run(it.rechtsKlein, { sz: 19 }) : '';
        let p = para((i ? '' : run(tag.wt, o)) + tab(o) + (i ? '' : run(tag.dat, o)) + tab(o) + run(it.zeit, o) + tab(o) +
          run(it.titel, { b: it.fett, sz: 21 }) + (it.va ? run(' (VA)', k) : '') + run(it.nach, { b: it.fett, sz: 21 }) + (r0 ? tab(k) + r0 : ''),
        { tabs: TABS_KOPF, before: i ? 40 : 160, keep: true });
        const sub = (inner, opt = {}) => para(inner, { ind: T_TEXT, keep: true, ...opt });
        if (it.rechts[1]) p += sub(run(it.rechts[1], { sz: 19 }), { jc: 'right' });
        if (it.sub) p += sub(run(it.sub, { sz: 21 }));
        if (it.fuer) p += sub(run(it.fuer, { i: true, sz: 21 }));
        const n = Math.max(it.links.length, it.lesung.length);
        for (let j = 0; j < n; j++) {
          const l = it.links[j];
          const r = it.lesung[j];
          p += para((l ? run(`${l[0]}: ${l[1]}`, { sz: 19 }) : '') + (r ? tab({ sz: 19 }) + run(`${r[0]}: ${r[1]}`, { sz: 19 }) : ''),
            { ind: T_TEXT, tabs: TABS_DIENST, keep: true });
        }
        if (it.zusatz) p += sub(run(it.zusatz, { b: true, sz: 21 }), { before: 40 });
        return p;
      }).join('').replace(/<w:keepNext\/><w:keepLines\/>(?![\s\S]*<w:keepNext\/>)/, '<w:keepLines/>')).join('');
      return band + abstand + licht + tage;
    }).join('') || para(run('Für diesen Monat sind noch keine Termine eingetragen.', k), { before: 200 });
    const legende = para(run('LK: Lektor/en | KH: Kommunionhelfer/in | L1: 1. Lesung | L2: 2. Lesung | Ev: Evangelium | VA: Vorabendgottesdienst', { sz: 13 }), { jc: 'center', before: 240 });
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">' +
      `<w:body>${kopf}${body}${legende}<w:sectPr><w:pgSz w:w="${PAGE_W}" w:h="${PAGE_H}" w:code="11"/><w:pgMar w:top="${MAR_Y}" w:right="${MAR_X}" w:bottom="${MAR_Y}" w:left="${MAR_X}" w:header="300" w:footer="300" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  }

  /* ZIP ohne Kompression (wie js/admin/wochenplakat-word.js) */
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  const crc32 = (buf) => {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };
  function zip(files) {
    const enc = new TextEncoder();
    const now = new Date();
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const parts = [];
    const central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name);
      const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const size = central.reduce((s, p) => s + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, size, true); end.setUint32(16, offset, true);
    return [...parts, ...central, new Uint8Array(end.buffer)];
  }
  async function png(path) {
    try {
      const r = await fetch(path);
      return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
    } catch {
      return null;
    }
  }

  async function toWord(data, jahr, monat, heiligen) {
    const m = model(data, jahr, monat, heiligen);
    const [logo, kerze] = await Promise.all([png(`${IMG}pfarrverband-logo.png`), png(`${IMG}kerze.png`)]);
    const rels = (logo ? '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>' : '') +
      (kerze ? '<Relationship Id="rIdKerze" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/kerze.png"/>' : '');
    const files = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
      { name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>` },
      { name: 'word/document.xml', data: documentXml(m, !!logo, !!kerze) }
    ];
    if (logo) files.push({ name: 'word/media/logo.png', data: logo });
    if (kerze) files.push({ name: 'word/media/kerze.png', data: kerze });
    return new Blob(zip(files), { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  w.Monatsblatt = { model, html, toWord };
})(window);
