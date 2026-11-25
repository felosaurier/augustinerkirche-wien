/* ============================================================
   Augustinerkirche Wien — plakat-vorschau.js
   Vorschau des Hochamt-Plakats (Werkzeug "Plakat fuer ein Hochamt"): zeichnet die Absaetze,
   die js/admin/plakat.js fuer Word erzeugt (Plakat.layout), als HTML auf einer A4-Seite nach,
   mit denselben Schriftgroessen, Abstaenden, Tabstopps und Strichen. Kopf (Tag, Monat, Zeit,
   Anlass, Logo) und Fuss (Adressen, QR-Codes, Zeichnung) wie in der Vorlage
   assets/plakat/vorlage/. Alle Masse in pt, damit es genau der Word-Seite entspricht.
   PlakatVorschau.html(L, {urls, colors}) -> HTML der Seite (595,3 × 841,9 pt)
   ============================================================ */
(function () {
  'use strict';

  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" ' +
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const LINE = 1.2207;
  const PAGE_W = 595.3;
  const PAGE_H = 841.9;
  const MAR_X = 42.55;
  const MAR_Y = 19.85;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const n = (v, d = 0) => (v == null || v === '' ? d : Number(v));
  const child = (el, name) => (el ? [...el.children].find((c) => c.localName === name) : null);
  const attr = (el, name) => (el ? el.getAttributeNS(W, name) || el.getAttribute(`w:${name}`) : null);

  /* Zeichenformat eines Laufs */
  function runStyle(rPr) {
    const has = (k) => {
      const e = child(rPr, k);
      return !!e && !['0', 'false'].includes(attr(e, 'val'));
    };
    const fonts = child(rPr, 'rFonts');
    return {
      b: has('b'),
      color: attr(child(rPr, 'color'), 'val') || '000000',
      pt: n(attr(child(rPr, 'sz'), 'val'), 22) / 2,
      spc: n(attr(child(rPr, 'spacing'), 'val')) / 20,
      scale: n(attr(child(rPr, 'w'), 'val'), 100),
      light: /Light/.test((fonts && (attr(fonts, 'ascii') || '')) || ''),
      sh: !!(rPr && [...rPr.children].some((c) => c.localName === 'shadow'))
    };
  }
  const css = (s) => `line-height:0;font-size:${s.pt}pt;font-weight:${s.b ? 700 : s.light ? 300 : 400};color:#${s.color === 'auto' ? '000000' : s.color};` +
    (s.spc ? `letter-spacing:${s.spc}pt;` : '') + (s.light ? 'font-family:"Calibri Light",Calibri,Carlito,sans-serif;' : '') +
    (s.sh ? `text-shadow:${Math.max(0.4, s.pt / 40)}pt ${Math.max(0.4, s.pt / 40)}pt ${Math.max(0.6, s.pt / 25)}pt rgba(0,0,0,.45);` : '');
  /* Lauf als HTML; Dehnung (w) ueber scaleX in einem eigenen Kaestchen */
  const spanOf = (t) => (t.s.scale !== 100
    ? `<span style="${css(t.s)}display:inline-block;transform:scaleX(${t.s.scale / 100});transform-origin:0 50%;margin-right:${(-(1 - t.s.scale / 100) * width([t])).toFixed(2)}pt">${esc(t.text)}</span>`
    : `<span style="${css(t.s)}">${esc(t.text)}</span>`);
  const width = (toks) => toks.reduce((w, t) => w + (window.Plakat ? window.Plakat.textWidth(t.text, { bold: t.s.b, pt: t.s.pt, spc: t.s.spc, scale: t.s.scale }) : t.text.length * t.s.pt * 0.5), 0);

  /* Grundlinie wie in Word: bei festem Zeilenabstand ("exact") liegt sie bei 80 % der Zeilenhoehe,
     bei einfachem Abstand bei 78 % (Calibri: Oberlaenge 0,952 von 1,2207). Gemessen am echten Plakat:
     "Sonntag" -> "Hochamt" 28,2 pt, "Missa" -> "secunda" 80,1 pt. Der Browser setzt die Grundlinie dagegen
     in die Mitte der Zeile: Hoehe/2 + k × Schriftgroesse; k wird einmal mit Calibri gemessen. */
  let kMass = null;
  function k() {
    if (kMass !== null) return kMass;
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;left:-9999px;top:0;font:700 100px Calibri,Carlito,"Segoe UI",Arial,sans-serif;line-height:100px';
    d.innerHTML = 'Hg<span style="display:inline-block;width:0;height:0;vertical-align:baseline"></span>';
    document.body.append(d);
    const base = d.lastChild.getBoundingClientRect().top - d.getBoundingClientRect().top;
    d.remove();
    kMass = (base - 50) / 100;
    return kMass;
  }
  /* Verschiebung, damit die Grundlinie im Browser dort liegt, wo Word sie setzt */
  const shiftOf = (lh, maxPt, exact) => (exact ? 0.8 : 0.78) * lh - (lh / 2 + k() * maxPt);

  /* Ein Absatz: ohne Tabstopps als Zeile mit Ausrichtung, mit Tabstopps genau gesetzt (wie Word) */
  function para(p) {
    const pPr = child(p, 'pPr');
    const jc = attr(child(pPr, 'jc'), 'val') || 'left';
    const sp = child(pPr, 'spacing');
    const exact = attr(sp, 'lineRule') === 'exact';
    const before = n(attr(sp, 'before')) / 20;
    const ind = child(pPr, 'ind');
    const left = n(attr(ind, 'left')) / 20;
    const tabs = [...(child(pPr, 'tabs') ? child(pPr, 'tabs').children : [])]
      .map((t) => ({ val: attr(t, 'val'), pos: n(attr(t, 'pos')) / 20, leader: attr(t, 'leader') }))
      .sort((a, b) => a.pos - b.pos);
    const mark = runStyle(child(pPr, 'rPr'));
    const toks = [];
    for (const r of [...p.children].filter((c) => c.localName === 'r')) {
      const s = runStyle(child(r, 'rPr'));
      for (const c of r.children) {
        if (c.localName === 'tab') toks.push({ tab: true, s });
        else if (c.localName === 't') toks.push({ text: c.textContent, s });
      }
    }
    const maxPt = Math.max(mark.pt, ...toks.filter((t) => t.text).map((t) => t.s.pt), 0);
    const lh = exact ? n(attr(sp, 'line')) / 20 : maxPt * LINE;
    const box = `margin-top:${before}pt;line-height:${lh}pt;font-size:${maxPt || 11}pt;`;
    const shift = toks.some((t) => t.text) ? shiftOf(lh, maxPt, exact) : 0;
    if (!toks.some((t) => t.tab)) {
      const al = jc === 'both' ? 'left' : jc;
      return `<div class="pv-p" style="${box}min-height:${lh}pt;text-align:${al};margin-left:${left}pt"><div style="position:relative;top:${shift.toFixed(2)}pt">${toks.map(spanOf).join('')}</div></div>`;
    }
    /* Teile zwischen den Tabs */
    const segs = [[]];
    for (const t of toks) {
      if (t.tab) segs.push([]);
      else segs[segs.length - 1].push(t);
    }
    let x = left;
    let html = '';
    segs.forEach((seg, i) => {
      const w = width(seg);
      let at = x;
      let leader = null;
      if (i > 0) {
        const stop = tabs.find((t) => t.pos > x + 0.5) || { val: 'left', pos: Math.ceil((x + 0.5) / 36) * 36 };
        at = stop.val === 'center' ? stop.pos - w / 2 : stop.val === 'right' ? stop.pos - w : stop.pos;
        if (stop.leader && stop.leader !== 'none' && at > x) leader = [x, at];
      }
      if (leader) {
        const col = seg[0] ? seg[0].s.color : mark.color;
        html += `<span class="pv-lead" style="left:${leader[0]}pt;width:${leader[1] - leader[0]}pt;top:${((exact ? 0.8 : 0.78) * lh + 0.4).toFixed(2)}pt;border-color:#${col}"></span>`;
      }
      if (seg.length) html += `<span class="pv-seg" style="left:${at}pt;top:${shift.toFixed(2)}pt;line-height:${lh}pt">${seg.map(spanOf).join('')}</span>`;
      x = at + w;
    });
    return `<div class="pv-p pv-tabs" style="${box}height:${lh}pt">${html}</div>`;
  }

  function paras(xml) {
    const doc = new DOMParser().parseFromString(`<root ${NS}>${xml}</root>`, 'application/xml');
    if (doc.querySelector('parsererror')) return '';
    return [...doc.documentElement.children].filter((c) => c.localName === 'p').map(para).join('');
  }

  function html(L, { urls = {}, colors = {} } = {}) {
    const main = colors.main || '#000064';
    const accent = colors.accent || '#966E00';
    const img = (src, style, alt = '') => (src ? `<img src="${esc(src)}" alt="${esc(alt)}" style="${style}"/>` : '');
    /* Kopf: Tabelle 99,05 | 311,8 | 73,7 pt, 91,3 pt hoch, 14 pt eingerueckt, Trennstrich 3 pt in der Akzentfarbe */
    const kopf = '<div class="pv-kopf" style="margin-left:14pt;height:91.3pt">' +
      `<div class="pv-c" style="width:99.05pt;border-right:1.5pt solid ${accent}">${paras(L.kopf.tag)}</div>` +
      `<div class="pv-c" style="width:311.8pt;border-left:1.5pt solid ${accent}">${paras(L.kopf.monat + L.kopf.zeit + L.kopf.art)}</div>` +
      `<div class="pv-c" style="width:73.7pt;text-align:right;padding-top:2pt">${img(urls.logo, 'width:63.8pt;height:85pt;object-fit:contain', 'Logo')}</div>` +
      '</div>';
    const z = (t, s = '') => `<div style="line-height:12pt;${s}">${t}</div>`;
    const sep = `<span style="color:${accent}">|</span>`;
    const fuss = `<div class="pv-fuss" style="color:${main}">` +
      `<div style="position:relative;height:42.7pt">${img(urls.zeichnung, 'position:absolute;left:197.2pt;top:7.7pt;width:119pt;height:85pt;opacity:.35')}</div>` +
      '<div style="display:grid;grid-template-columns:144.55pt 110.55pt 110.55pt 144.55pt;height:46.75pt;font-size:10pt;position:relative">' +
        `<div style="text-align:right;padding-right:8.2pt">${z('Augustinerkirche')}${z(`Wien 1 ${sep} Hofburg - Josefsplatz`)}<div style="height:3pt"></div>${z('T: +43 1 533 70 99')}${z('E: pfarre@augustinerkirche.at')}</div>` +
        `<div style="position:relative">${img(urls.qr1, 'position:absolute;left:-0.45pt;top:0.2pt;width:46.8pt;height:46.8pt', 'QR-Code augustinerkirche.at')}</div>` +
        `<div style="position:relative">${img(urls.qr2, 'position:absolute;left:68.8pt;top:0.15pt;width:46.8pt;height:46.8pt', 'QR-Code hochamt.at')}</div>` +
        `<div style="padding-left:11pt">${z('Kirchenmusik St. Augustin')}${z(`Wien 1 ${sep} Augustinerstraße 3`)}<div style="height:3pt"></div>${z('T: +43 1 533 70 99')}${z('E: info@hochamt.at')}</div>` +
      '</div></div>';
    return `<div class="pv-seite" style="width:${PAGE_W}pt;height:${PAGE_H}pt;padding:${MAR_Y}pt ${MAR_X}pt">` +
      kopf + `<div class="pv-koerper">${paras(L.koerper)}</div>` + fuss + '</div>';
  }

  window.PlakatVorschau = { html, PAGE_W, PAGE_H };
})();
