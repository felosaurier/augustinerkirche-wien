/* ============================================================
   Augustinerkirche Wien — wochenplakat-word.js
   Das Wochenplakat (js/admin/wochenplakat.js) als Word-Datei (.docx, A4 hoch) zum Weiterbearbeiten:
   eine echte Word-Tabelle mit Spalten Wochentag, Tageszahl und Termine, Kopf mit Logo.
   WochenPlakat.toWord(montag, items, opts) liefert die Datei als Blob (opts wie bei build()).
   Benötigt js/admin/wochenplakat.js (und davor prepare() für das Logo).
   ============================================================ */
(function () {
  'use strict';

  const WP = window.WochenPlakat;
  const NAVY = '1A1680';
  const RED = 'E03C1E';
  const PAGE_W = 11906;
  const PAGE_H = 16838;
  const MAR_X = 794;
  const MAR_T = 567;
  const MAR_B = 454;
  const CONTENT_W = PAGE_W - 2 * MAR_X;
  const TIME_TAB = 1000;
  const TEXT_TAB = 1130;

  const x = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* Auszeichnungen der Verwaltung (**fett**, [Text](Adresse) …) entfernen */
  const plain = (s) => String(s || '').replace(/\[(groß|klein)\]|\[\/(groß|klein)\]/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\*\*|__|~~/g, '').replace(/(^|\s)\*([^*\s][^*]*)\*(?=\s|$)/g, '$1$2');

  /* ---------- Bausteine ---------- */
  const rpr = ({ b, i, sz, color = NAVY }) => `<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>${b ? '<w:b/>' : ''}${i ? '<w:i/>' : ''}<w:color w:val="${color}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>`;
  const run = (t, o) => `<w:r>${rpr(o)}<w:t xml:space="preserve">${x(t)}</w:t></w:r>`;
  const tab = (o) => `<w:r>${rpr(o)}<w:tab/></w:r>`;
  const para = (inner, { jc, ind, tabs, after = 0, before = 0, keep } = {}) =>
    `<w:p><w:pPr>${keep ? '<w:keepNext/>' : ''}${tabs ? `<w:tabs>${tabs}</w:tabs>` : ''}<w:spacing w:before="${before}" w:after="${after}" w:line="240" w:lineRule="auto"/>${ind ? `<w:ind w:left="${ind[0]}" w:hanging="${ind[1] || 0}"/>` : ''}${jc ? `<w:jc w:val="${jc}"/>` : ''}</w:pPr>${inner}</w:p>`;
  const borders = (sz, color = NAVY) => ['top', 'left', 'bottom', 'right'].map((s) => `<w:${s} w:val="single" w:sz="${sz}" w:space="0" w:color="${color}"/>`).join('');
  const cell = (w, inner, { fill, vAlign = 'top', b = 6 } = {}) =>
    `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:tcBorders>${borders(b)}</w:tcBorders>${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ''}<w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar><w:vAlign w:val="${vAlign}"/></w:tcPr>${inner}</w:tc>`;

  function itemParas(it, c3) {
    const col = it.red ? RED : NAVY;
    const head = tab({ sz: 20 }) + run(it.time, { b: true, sz: 20, color: col }) + tab({ sz: 20 }) +
      run(it.title, { b: true, sz: 20, color: col }) +
      (it.paren ? run(` (${it.paren})`, { sz: 20 }) : '') +
      (it.zel ? run(` | Z: ${it.zel}`, { sz: 20 }) : '') +
      (it.place ? tab({ sz: 17 }) + run(it.place, { sz: 17 }) : '');
    const tabs = `<w:tab w:val="right" w:pos="${TIME_TAB}"/><w:tab w:val="left" w:pos="${TEXT_TAB}"/><w:tab w:val="right" w:pos="${c3}"/>`;
    const out = [para(head, { ind: [TEXT_TAB, TEXT_TAB], tabs, after: 10 })];
    const sub = (inner) => para(inner, { ind: [TEXT_TAB], after: 10 });
    if (it.bis) out.push(sub(run(it.bis, { sz: 18 })));
    if (it.musik) out.push(sub(run('♫ ', { sz: 18, color: RED }) + run(it.musik, { sz: 18 })));
    if (it.note) out.push(sub(run(it.note, { i: true, sz: 18 })));
    return out.join('');
  }

  /* Das Logo als Bild im Dokument (Breite und Höhe in EMU) */
  const logoXml = (emu) => `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${emu}" cy="${emu}"/><wp:docPr id="1" name="Logo" descr="Logo der Augustinerkirche"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu}" cy="${emu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;

  function documentXml(days, withLogo) {
    /* Spaltenbreiten: die erste so breit, dass der längste Heilige (8 pt) in eine Zeile passt */
    const longest = Math.max(0, ...days.flatMap((d) => d.info.map((s) => plain(s).length)));
    const c1 = Math.max(1800, Math.min(3300, longest * 78 + 260));
    const c2 = 1250;
    const c3 = CONTENT_W - c1 - c2;
    const rowH = Math.floor((PAGE_H - MAR_T - MAR_B - 2300 - 500) / days.length);
    const rows = days.map((d) => {
      const col = d.red ? RED : NAVY;
      const info = d.info.map((s) => para(run(plain(s), { sz: 16 }), { after: 10 })).join('');
      const items = d.items.length ? d.items.map((it) => itemParas(it, c3 - 220)).join('') : para('');
      return `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="${rowH}" w:hRule="atLeast"/></w:trPr>` +
        cell(c1, para(run(d.wd, { b: true, sz: 24, color: col }), { after: 30 }) + info) +
        cell(c2, para(run(String(d.date.getDate()), { b: true, sz: 76, color: d.red ? 'FFFFFF' : NAVY }), { jc: 'center' }), { fill: d.red ? RED : undefined, vAlign: 'center' }) +
        cell(c3, items) + '</w:tr>';
    }).join('');
    const pad = (n) => String(n).padStart(2, '0');
    const dmy = (dt) => `${pad(dt.getDate())}.${pad(dt.getMonth() + 1)}.${dt.getFullYear()}`;
    const headL = para(run('Wochenkalender der', { b: true, sz: 36 })) +
      para(run('Wiener Augustinerkirche', { b: true, sz: 64 })) +
      para(run(`${dmy(days[0].date)}–${dmy(days[days.length - 1].date)}`, { b: true, sz: 40 }), { after: 120 });
    const none = ['top', 'left', 'bottom', 'right'].map((s) => `<w:${s} w:val="nil"/>`).join('');
    const head = `<w:tbl><w:tblPr><w:tblW w:w="${CONTENT_W}" w:type="dxa"/><w:tblBorders>${none}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="${CONTENT_W - 1700}"/><w:gridCol w:w="1700"/></w:tblGrid><w:tr>` +
      `<w:tc><w:tcPr><w:tcW w:w="${CONTENT_W - 1700}" w:type="dxa"/></w:tcPr>${headL}</w:tc>` +
      `<w:tc><w:tcPr><w:tcW w:w="1700" w:type="dxa"/></w:tcPr>${para(withLogo ? logoXml(900000) : '', { jc: 'right' })}</w:tc></w:tr></w:tbl>`;
    const table = `<w:tbl><w:tblPr><w:tblW w:w="${CONTENT_W}" w:type="dxa"/><w:tblBorders>${borders(18)}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="${c1}"/><w:gridCol w:w="${c2}"/><w:gridCol w:w="${c3}"/></w:tblGrid>${rows}</w:tbl>`;
    const foot = para(run('Z = Zelebrant des Gottesdienstes | P = Pater | D = Diakon | Pr = Predigt | ♫ = Musikalische Gestaltung | Änderungen vorbehalten', { sz: 16, color: '222222' }), { jc: 'center', before: 100 });
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">' +
      `<w:body>${head}${table}${foot}<w:sectPr><w:pgSz w:w="${PAGE_W}" w:h="${PAGE_H}"/><w:pgMar w:top="${MAR_T}" w:right="${MAR_X}" w:bottom="${MAR_B}" w:left="${MAR_X}" w:header="300" w:footer="300" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  }

  /* ---------- ZIP (ohne Kompression) ---------- */
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

  async function toWord(montag, items, opts = {}) {
    const days = WP.model(montag, items, opts);
    const logo = WP.logo();
    let png = null;
    if (/^data:image\/png;base64,/.test(logo)) {
      const bin = atob(logo.split(',')[1]);
      png = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    }
    const files = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
      { name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${png ? '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>' : ''}</Relationships>` },
      { name: 'word/document.xml', data: documentXml(days, !!png) }
    ];
    if (png) files.push({ name: 'word/media/logo.png', data: png });
    return new Blob(zip(files), { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  WP.toWord = toWord;
})();
